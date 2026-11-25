-- Operational stock locations and balances are tenant scoped. The existing
-- estoque_produtos table remains the product catalog and global stock total.
CREATE TABLE public.estoque_locais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT private.current_tenant_id() REFERENCES public.tenants(id),
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, codigo),
  UNIQUE (id, tenant_id)
);

CREATE TABLE public.estoque_saldos (
  tenant_id uuid NOT NULL DEFAULT private.current_tenant_id() REFERENCES public.tenants(id),
  estoque_produto_id uuid NOT NULL,
  estoque_local_id uuid NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, estoque_produto_id, estoque_local_id),
  FOREIGN KEY (estoque_produto_id, tenant_id)
    REFERENCES public.estoque_produtos(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (estoque_local_id, tenant_id)
    REFERENCES public.estoque_locais(id, tenant_id) ON DELETE RESTRICT
);

ALTER TABLE public.movimentacoes_estoque
  ADD COLUMN estoque_local_id uuid,
  ADD COLUMN local_origem_id uuid,
  ADD COLUMN local_destino_id uuid,
  ADD COLUMN saldo_local_anterior numeric,
  ADD COLUMN saldo_local_posterior numeric,
  ADD COLUMN natureza text NOT NULL DEFAULT 'manual',
  ADD COLUMN idempotency_key text,
  ADD COLUMN criado_por uuid;

ALTER TABLE public.movimentacoes_estoque
  ADD CONSTRAINT movimentacoes_estoque_local_tenant_fk
  FOREIGN KEY (estoque_local_id, tenant_id)
  REFERENCES public.estoque_locais(id, tenant_id);
CREATE UNIQUE INDEX movimentacoes_estoque_tenant_request_idx
  ON public.movimentacoes_estoque(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX movimentacoes_estoque_tenant_created_idx
  ON public.movimentacoes_estoque(tenant_id, created_at DESC);

-- Assign any existing stock to the initial location before location-aware writes.
INSERT INTO public.estoque_locais (tenant_id, codigo, nome)
SELECT t.id, 'PRINCIPAL', 'Estoque principal'
FROM public.tenants t
ON CONFLICT (tenant_id, codigo) DO NOTHING;

INSERT INTO public.estoque_saldos
  (tenant_id, estoque_produto_id, estoque_local_id, quantidade)
SELECT p.tenant_id, p.id, l.id, p.quantidade_atual
FROM public.estoque_produtos p
JOIN public.estoque_locais l ON l.tenant_id = p.tenant_id
  AND l.codigo = 'PRINCIPAL'
WHERE p.quantidade_atual > 0
ON CONFLICT DO NOTHING;

ALTER TABLE public.estoque_locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_saldos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.estoque_locais, public.estoque_saldos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.estoque_locais, public.estoque_saldos TO authenticated;
CREATE POLICY estoque_locais_select ON public.estoque_locais
  FOR SELECT TO authenticated
  USING (tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['produtos']::text[]));
CREATE POLICY estoque_saldos_select ON public.estoque_saldos
  FOR SELECT TO authenticated
  USING (tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['produtos']::text[]));

CREATE OR REPLACE FUNCTION private.require_stock_access()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL
    OR NOT private.has_any_module_access(ARRAY['produtos']::text[]) THEN
    RAISE EXCEPTION 'Acesso ao estoque não autorizado';
  END IF;
  RETURN v_tenant;
END;
$function$;
REVOKE ALL ON FUNCTION private.require_stock_access() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consultar_diretorio_insumos(
  _busca text DEFAULT NULL, _categoria text DEFAULT NULL,
  _situacao text DEFAULT 'active', _pagina integer DEFAULT 1,
  _tamanho integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_page integer := GREATEST(COALESCE(_pagina, 1), 1);
  v_size integer := LEAST(GREATEST(COALESCE(_tamanho, 25), 1), 100);
  v_search text := nullif(trim(_busca), '');
  v_status text := COALESCE(_situacao, 'active');
  v_result jsonb;
BEGIN
  IF v_status NOT IN ('active', 'archived', 'low', 'zero', 'all') THEN
    RAISE EXCEPTION 'Situação de estoque inválida';
  END IF;
  WITH base AS (
    SELECT p.*, CASE WHEN f.id IS NULL THEN NULL
      ELSE jsonb_build_object('id', f.id, 'nome', f.nome) END AS fornecedores
    FROM public.estoque_produtos p
    LEFT JOIN public.fornecedores f
      ON f.id = p.fornecedor_id AND f.tenant_id = p.tenant_id
    WHERE p.tenant_id = v_tenant
  ), filtered AS (
    SELECT * FROM base b
    WHERE (_categoria IS NULL OR b.categoria = _categoria)
      AND (v_search IS NULL OR b.nome ILIKE '%' || v_search || '%'
        OR b.localizacao ILIKE '%' || v_search || '%'
        OR b.fornecedores->>'nome' ILIKE '%' || v_search || '%')
      AND (v_status = 'all'
        OR (v_status = 'active' AND b.ativo)
        OR (v_status = 'archived' AND NOT b.ativo)
        OR (v_status = 'low' AND b.ativo AND b.quantidade_minima > 0
          AND b.quantidade_atual <= b.quantidade_minima)
        OR (v_status = 'zero' AND b.ativo AND b.quantidade_atual <= 0))
  ), paged AS (
    SELECT * FROM filtered
    ORDER BY nome, id OFFSET (v_page - 1) * v_size LIMIT v_size
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY nome, id)
      FROM paged), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'page', v_page, 'pageSize', v_size,
    'summary', jsonb_build_object(
      'activeCount', (SELECT count(*) FROM base WHERE ativo),
      'lowCount', (SELECT count(*) FROM base WHERE ativo
        AND quantidade_minima > 0 AND quantidade_atual <= quantidade_minima),
      'zeroCount', (SELECT count(*) FROM base WHERE ativo AND quantidade_atual <= 0),
      'totalValue', (SELECT COALESCE(sum(quantidade_atual * preco_custo), 0)
        FROM base WHERE ativo)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consultar_diretorio_locais_estoque(
  _busca text DEFAULT NULL, _situacao text DEFAULT 'active',
  _pagina integer DEFAULT 1, _tamanho integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_page integer := GREATEST(COALESCE(_pagina, 1), 1);
  v_size integer := LEAST(GREATEST(COALESCE(_tamanho, 25), 1), 100);
  v_result jsonb;
BEGIN
  WITH base AS (
    SELECT l.*, COALESCE(s.produtos_com_saldo, 0) AS produtos_com_saldo,
      COALESCE(s.quantidade_total, 0) AS quantidade_total,
      s.saldo_atualizado_em
    FROM public.estoque_locais l
    LEFT JOIN LATERAL (
      SELECT count(*) FILTER (WHERE quantidade > 0) AS produtos_com_saldo,
        sum(quantidade) AS quantidade_total,
        max(updated_at) AS saldo_atualizado_em
      FROM public.estoque_saldos s
      WHERE s.tenant_id = l.tenant_id AND s.estoque_local_id = l.id
    ) s ON true
    WHERE l.tenant_id = v_tenant
  ), filtered AS (
    SELECT * FROM base
    WHERE (nullif(trim(_busca), '') IS NULL OR nome ILIKE '%' || trim(_busca) || '%'
      OR codigo ILIKE '%' || trim(_busca) || '%')
      AND (COALESCE(_situacao, 'active') = 'all'
        OR (COALESCE(_situacao, 'active') = 'active' AND ativo)
        OR (COALESCE(_situacao, 'active') = 'archived' AND NOT ativo)
        OR (COALESCE(_situacao, 'active') = 'with_balance' AND quantidade_total > 0))
  ), paged AS (
    SELECT * FROM filtered ORDER BY nome, id
    OFFSET (v_page - 1) * v_size LIMIT v_size
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY nome,id)
      FROM paged), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'page', v_page, 'pageSize', v_size,
    'summary', jsonb_build_object(
      'activeCount', (SELECT count(*) FROM base WHERE ativo),
      'archivedCount', (SELECT count(*) FROM base WHERE NOT ativo),
      'withBalanceCount', (SELECT count(*) FROM base WHERE quantidade_total > 0),
      'totalQuantity', (SELECT COALESCE(sum(quantidade_total), 0) FROM base)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consultar_saldos_local_estoque(
  _estoque_local_id uuid, _busca text DEFAULT NULL, _situacao text DEFAULT 'all',
  _pagina integer DEFAULT 1, _tamanho integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_location public.estoque_locais%ROWTYPE;
  v_page integer := GREATEST(COALESCE(_pagina, 1), 1);
  v_size integer := LEAST(GREATEST(COALESCE(_tamanho, 25), 1), 100);
  v_result jsonb;
BEGIN
  SELECT * INTO v_location FROM public.estoque_locais
  WHERE id = _estoque_local_id AND tenant_id = v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Local não encontrado'; END IF;
  WITH base AS (
    SELECT v_location.id AS estoque_local_id, p.id AS estoque_produto_id,
      p.nome AS produto_nome, p.categoria AS produto_categoria,
      p.unidade AS produto_unidade, p.ativo AS produto_ativo,
      p.quantidade_atual AS estoque_total, p.quantidade_minima,
      COALESCE(s.quantidade, 0) AS quantidade_local,
      COALESCE(s.versao, 0) AS versao_saldo,
      s.updated_at AS saldo_atualizado_em
    FROM public.estoque_produtos p
    LEFT JOIN public.estoque_saldos s ON s.tenant_id = p.tenant_id
      AND s.estoque_produto_id = p.id AND s.estoque_local_id = v_location.id
    WHERE p.tenant_id = v_tenant
  ), filtered AS (
    SELECT * FROM base
    WHERE (nullif(trim(_busca), '') IS NULL
      OR produto_nome ILIKE '%' || trim(_busca) || '%')
      AND (COALESCE(_situacao,'all') = 'all'
        OR (COALESCE(_situacao,'all') = 'with_balance' AND quantidade_local > 0)
        OR (COALESCE(_situacao,'all') = 'zero' AND quantidade_local = 0)
        OR (COALESCE(_situacao,'all') = 'active' AND produto_ativo)
        OR (COALESCE(_situacao,'all') = 'archived' AND NOT produto_ativo))
  ), paged AS (
    SELECT * FROM filtered ORDER BY produto_nome, estoque_produto_id
    OFFSET (v_page - 1) * v_size LIMIT v_size
  )
  SELECT jsonb_build_object(
    'location', jsonb_build_object('id',v_location.id,'codigo',v_location.codigo,
      'nome',v_location.nome,'ativo',v_location.ativo),
    'items',COALESCE((SELECT jsonb_agg(to_jsonb(paged)
      ORDER BY produto_nome,estoque_produto_id) FROM paged),'[]'::jsonb),
    'total',(SELECT count(*) FROM filtered),
    'page',v_page,'pageSize',v_size,
    'summary',jsonb_build_object(
      'activeProductCount',(SELECT count(*) FROM base WHERE produto_ativo),
      'withBalanceCount',(SELECT count(*) FROM base WHERE quantidade_local > 0),
      'totalQuantity',(SELECT COALESCE(sum(quantidade_local),0) FROM base)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consultar_diretorio_movimentacoes_estoque(
  _busca text DEFAULT NULL, _tipo text DEFAULT 'all',
  _pagina integer DEFAULT 1, _tamanho integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_page integer := GREATEST(COALESCE(_pagina, 1), 1);
  v_size integer := LEAST(GREATEST(COALESCE(_tamanho, 25), 1), 100);
  v_result jsonb;
BEGIN
  WITH base AS (
    SELECT m.id, m.tipo, m.quantidade, m.motivo,
      m.saldo_local_anterior, m.saldo_local_posterior, m.natureza,
      m.created_at, p.nome AS produto_nome, f.nome AS fornecedor_nome,
      lo.codigo AS local_origem_codigo, ld.codigo AS local_destino_codigo
    FROM public.movimentacoes_estoque m
    JOIN public.estoque_produtos p ON p.id = m.estoque_produto_id
      AND p.tenant_id = m.tenant_id
    LEFT JOIN public.fornecedores f ON f.id = m.fornecedor_id
      AND f.tenant_id = m.tenant_id
    LEFT JOIN public.estoque_locais lo ON lo.id =
      COALESCE(m.local_origem_id, CASE WHEN m.tipo = 'saida' THEN m.estoque_local_id END)
      AND lo.tenant_id = m.tenant_id
    LEFT JOIN public.estoque_locais ld ON ld.id =
      COALESCE(m.local_destino_id, CASE WHEN m.tipo = 'entrada' THEN m.estoque_local_id END)
      AND ld.tenant_id = m.tenant_id
    WHERE m.tenant_id = v_tenant
  ), filtered AS (
    SELECT * FROM base
    WHERE (COALESCE(_tipo,'all') = 'all' OR tipo = _tipo)
      AND (nullif(trim(_busca), '') IS NULL
        OR produto_nome ILIKE '%' || trim(_busca) || '%'
        OR fornecedor_nome ILIKE '%' || trim(_busca) || '%'
        OR motivo ILIKE '%' || trim(_busca) || '%')
  ), paged AS (
    SELECT * FROM filtered ORDER BY created_at DESC, id DESC
    OFFSET (v_page - 1) * v_size LIMIT v_size
  )
  SELECT jsonb_build_object(
    'items',COALESCE((SELECT jsonb_agg(to_jsonb(paged)
      ORDER BY created_at DESC,id DESC) FROM paged),'[]'::jsonb),
    'total',(SELECT count(*) FROM filtered),
    'page',v_page,'pageSize',v_size,
    'summary',jsonb_build_object(
      'entryCount',(SELECT count(*) FROM base WHERE tipo = 'entrada'),
      'exitCount',(SELECT count(*) FROM base WHERE tipo = 'saida')
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

ALTER TABLE public.estoque_locais ADD COLUMN idempotency_key text;
CREATE UNIQUE INDEX estoque_locais_tenant_request_idx
  ON public.estoque_locais(tenant_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.salvar_estoque_local(
  _local_id uuid, _codigo text, _nome text, _descricao text,
  _ativo boolean, _versao_esperada integer, _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_location public.estoque_locais%ROWTYPE;
BEGIN
  IF nullif(trim(_codigo),'') IS NULL OR nullif(trim(_nome),'') IS NULL
    OR nullif(trim(_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'Código, nome e chave da operação são obrigatórios';
  END IF;
  IF _local_id IS NULL THEN
    SELECT * INTO v_location FROM public.estoque_locais
    WHERE tenant_id = v_tenant AND idempotency_key = _idempotency_key;
    IF FOUND THEN RETURN to_jsonb(v_location); END IF;
    INSERT INTO public.estoque_locais
      (tenant_id,codigo,nome,descricao,ativo,idempotency_key)
    VALUES (v_tenant,trim(_codigo),trim(_nome),nullif(trim(_descricao),''),
      COALESCE(_ativo,true),_idempotency_key)
    RETURNING * INTO v_location;
  ELSE
    SELECT * INTO v_location FROM public.estoque_locais
    WHERE id = _local_id AND tenant_id = v_tenant FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Local não encontrado'; END IF;
    IF v_location.versao <> _versao_esperada THEN
      RAISE EXCEPTION 'Local alterado por outro usuário. Atualize a tela';
    END IF;
    IF NOT COALESCE(_ativo,true) AND EXISTS (
      SELECT 1 FROM public.estoque_saldos s
      WHERE s.tenant_id = v_tenant AND s.estoque_local_id = _local_id
        AND s.quantidade > 0
    ) THEN RAISE EXCEPTION 'Não é possível arquivar local com saldo'; END IF;
    UPDATE public.estoque_locais
    SET codigo = trim(_codigo), nome = trim(_nome),
      descricao = nullif(trim(_descricao),''),
      ativo = COALESCE(_ativo,true), versao = versao + 1,
      updated_at = now()
    WHERE id = _local_id RETURNING * INTO v_location;
  END IF;
  RETURN to_jsonb(v_location);
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_estoque_local(
  _estoque_produto_id uuid, _tipo text, _quantidade numeric,
  _motivo text, _fornecedor_id uuid, _custo_unitario numeric,
  _estoque_local_id uuid, _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_product public.estoque_produtos%ROWTYPE;
  v_location public.estoque_locais%ROWTYPE;
  v_balance public.estoque_saldos%ROWTYPE;
  v_existing public.movimentacoes_estoque%ROWTYPE;
  v_movement public.movimentacoes_estoque%ROWTYPE;
  v_after numeric;
BEGIN
  IF _tipo NOT IN ('entrada','saida') OR _quantidade IS NULL
    OR _quantidade <= 0 OR nullif(trim(_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'Movimentação inválida';
  END IF;
  SELECT * INTO v_product FROM public.estoque_produtos
  WHERE id = _estoque_produto_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND OR NOT v_product.ativo THEN
    RAISE EXCEPTION 'Insumo não encontrado ou arquivado';
  END IF;
  SELECT * INTO v_location FROM public.estoque_locais
  WHERE id = _estoque_local_id AND tenant_id = v_tenant AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Local de estoque não encontrado ou arquivado'; END IF;
  SELECT * INTO v_existing FROM public.movimentacoes_estoque
  WHERE tenant_id = v_tenant AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_existing.estoque_produto_id <> _estoque_produto_id
      OR v_existing.estoque_local_id <> _estoque_local_id
      OR v_existing.tipo <> _tipo OR v_existing.quantidade <> _quantidade THEN
      RAISE EXCEPTION 'Chave de operação já usada com outros dados';
    END IF;
    RETURN to_jsonb(v_existing);
  END IF;
  IF _fornecedor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.fornecedores WHERE id = _fornecedor_id
      AND tenant_id = v_tenant AND ativo
  ) THEN RAISE EXCEPTION 'Fornecedor inválido'; END IF;
  IF _custo_unitario IS NOT NULL AND _custo_unitario < 0 THEN
    RAISE EXCEPTION 'Custo unitário inválido';
  END IF;
  INSERT INTO public.estoque_saldos
    (tenant_id,estoque_produto_id,estoque_local_id,quantidade)
  VALUES (v_tenant,_estoque_produto_id,_estoque_local_id,0)
  ON CONFLICT DO NOTHING;
  SELECT * INTO v_balance FROM public.estoque_saldos
  WHERE tenant_id = v_tenant AND estoque_produto_id = _estoque_produto_id
    AND estoque_local_id = _estoque_local_id FOR UPDATE;
  v_after := v_balance.quantidade + CASE WHEN _tipo = 'entrada'
    THEN _quantidade ELSE -_quantidade END;
  IF v_after < 0 THEN RAISE EXCEPTION 'Saldo insuficiente neste local'; END IF;
  UPDATE public.estoque_saldos
  SET quantidade = v_after, versao = versao + 1, updated_at = now()
  WHERE tenant_id = v_tenant AND estoque_produto_id = _estoque_produto_id
    AND estoque_local_id = _estoque_local_id;
  UPDATE public.estoque_produtos
  SET quantidade_atual = quantidade_atual + CASE WHEN _tipo = 'entrada'
    THEN _quantidade ELSE -_quantidade END,
    preco_custo = CASE WHEN _tipo = 'entrada' AND _custo_unitario IS NOT NULL
      THEN _custo_unitario ELSE preco_custo END,
    updated_at = now()
  WHERE id = _estoque_produto_id AND tenant_id = v_tenant;
  INSERT INTO public.movimentacoes_estoque
    (tenant_id,estoque_produto_id,estoque_local_id,tipo,quantidade,motivo,
      fornecedor_id,custo_unitario,saldo_local_anterior,saldo_local_posterior,
      natureza,idempotency_key,criado_por,local_origem_id,local_destino_id)
  VALUES (v_tenant,_estoque_produto_id,_estoque_local_id,_tipo,_quantidade,
    nullif(trim(_motivo),''),_fornecedor_id,_custo_unitario,
    v_balance.quantidade,v_after,'manual',_idempotency_key,auth.uid(),
    CASE WHEN _tipo='saida' THEN _estoque_local_id END,
    CASE WHEN _tipo='entrada' THEN _estoque_local_id END)
  RETURNING * INTO v_movement;
  RETURN to_jsonb(v_movement);
END;
$function$;

CREATE OR REPLACE FUNCTION public.transferir_estoque(
  _estoque_produto_id uuid, _local_origem_id uuid, _local_destino_id uuid,
  _quantidade numeric, _motivo text, _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_saida jsonb;
  v_entrada jsonb;
BEGIN
  IF _local_origem_id = _local_destino_id OR _quantidade IS NULL
    OR _quantidade <= 0 OR nullif(trim(_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'Transferência inválida';
  END IF;
  v_saida := public.registrar_movimentacao_estoque_local(
    _estoque_produto_id,'saida',_quantidade,_motivo,NULL,NULL,
    _local_origem_id,_idempotency_key || ':saida'
  );
  v_entrada := public.registrar_movimentacao_estoque_local(
    _estoque_produto_id,'entrada',_quantidade,_motivo,NULL,NULL,
    _local_destino_id,_idempotency_key || ':entrada'
  );
  UPDATE public.movimentacoes_estoque
  SET natureza = 'transferencia', local_origem_id = _local_origem_id,
    local_destino_id = _local_destino_id
  WHERE tenant_id = v_tenant AND idempotency_key IN (
    _idempotency_key || ':saida', _idempotency_key || ':entrada'
  );
  RETURN jsonb_build_object('saida',v_saida,'entrada',v_entrada);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ajustar_estoque_contagem(
  _estoque_produto_id uuid, _estoque_local_id uuid,
  _quantidade_contada numeric, _motivo text,
  _versao_esperada integer, _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_balance public.estoque_saldos%ROWTYPE;
  v_difference numeric;
  v_movement jsonb;
BEGIN
  IF _quantidade_contada IS NULL OR _quantidade_contada < 0
    OR nullif(trim(_motivo),'') IS NULL
    OR nullif(trim(_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'Contagem, motivo e chave são obrigatórios';
  END IF;
  PERFORM 1 FROM public.estoque_produtos
  WHERE id = _estoque_produto_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insumo não encontrado'; END IF;
  SELECT * INTO v_balance FROM public.estoque_saldos
  WHERE tenant_id = v_tenant AND estoque_produto_id = _estoque_produto_id
    AND estoque_local_id = _estoque_local_id FOR UPDATE;
  IF NOT FOUND THEN
    IF COALESCE(_versao_esperada,0) <> 0 THEN
      RAISE EXCEPTION 'Saldo alterado por outro usuário';
    END IF;
    INSERT INTO public.estoque_saldos
      (tenant_id,estoque_produto_id,estoque_local_id,quantidade)
    VALUES (v_tenant,_estoque_produto_id,_estoque_local_id,0)
    RETURNING * INTO v_balance;
  ELSIF v_balance.versao <> _versao_esperada THEN
    -- A retry with the same key is safe even after its first version increment.
    SELECT to_jsonb(m) INTO v_movement FROM public.movimentacoes_estoque m
    WHERE m.tenant_id = v_tenant AND m.idempotency_key = _idempotency_key;
    IF v_movement IS NOT NULL THEN RETURN v_movement; END IF;
    RAISE EXCEPTION 'Saldo alterado por outro usuário';
  END IF;
  v_difference := _quantidade_contada - v_balance.quantidade;
  IF v_difference = 0 THEN RETURN to_jsonb(v_balance); END IF;
  v_movement := public.registrar_movimentacao_estoque_local(
    _estoque_produto_id,
    CASE WHEN v_difference > 0 THEN 'entrada' ELSE 'saida' END,
    abs(v_difference),_motivo,NULL,NULL,_estoque_local_id,_idempotency_key
  );
  UPDATE public.movimentacoes_estoque SET natureza = 'contagem'
  WHERE tenant_id = v_tenant AND idempotency_key = _idempotency_key;
  RETURN v_movement;
END;
$function$;

-- Only the RPC may change physical quantities. Product catalog editing remains
-- available on the columns used by the existing form.
REVOKE INSERT, UPDATE, DELETE ON public.movimentacoes_estoque
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.estoque_produtos
  FROM PUBLIC, anon, authenticated;
GRANT INSERT (tenant_id,nome,categoria,unidade,quantidade_minima,
  fornecedor_id,localizacao,ativo)
  ON public.estoque_produtos TO authenticated;
GRANT UPDATE (nome,categoria,unidade,quantidade_minima,
  fornecedor_id,localizacao,ativo)
  ON public.estoque_produtos TO authenticated;

DROP POLICY IF EXISTS tenant_insert ON public.estoque_produtos;
DROP POLICY IF EXISTS tenant_update ON public.estoque_produtos;
DROP POLICY IF EXISTS tenant_delete ON public.estoque_produtos;
CREATE POLICY estoque_produtos_catalog_insert ON public.estoque_produtos
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['produtos']::text[]));
CREATE POLICY estoque_produtos_catalog_update ON public.estoque_produtos
  FOR UPDATE TO authenticated USING (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['produtos']::text[]))
  WITH CHECK (tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['produtos']::text[]));
DROP POLICY IF EXISTS tenant_insert ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS tenant_update ON public.movimentacoes_estoque;

CREATE TABLE public.pedidos_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT private.current_tenant_id() REFERENCES public.tenants(id),
  numero bigint GENERATED BY DEFAULT AS IDENTITY,
  fornecedor_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','aprovado','parcial','recebido','cancelado')),
  data_pedido date NOT NULL DEFAULT current_date,
  previsao_entrega date,
  prazo_pagamento_dias integer NOT NULL DEFAULT 0
    CHECK (prazo_pagamento_dias BETWEEN 0 AND 3650),
  valor_total numeric NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  observacoes text,
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  aprovado_em timestamptz,
  cancelado_em timestamptz,
  cancelamento_motivo text,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,tenant_id),
  UNIQUE (tenant_id,numero),
  FOREIGN KEY (fornecedor_id,tenant_id)
    REFERENCES public.fornecedores(id,tenant_id)
);

CREATE TABLE public.pedido_compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pedido_compra_id uuid NOT NULL,
  estoque_produto_id uuid NOT NULL,
  descricao text NOT NULL,
  unidade text NOT NULL,
  quantidade_solicitada numeric NOT NULL CHECK (quantidade_solicitada > 0),
  quantidade_recebida numeric NOT NULL DEFAULT 0 CHECK (quantidade_recebida >= 0),
  quantidade_devolvida numeric NOT NULL DEFAULT 0 CHECK (quantidade_devolvida >= 0),
  custo_unitario numeric NOT NULL CHECK (custo_unitario > 0),
  valor_total numeric GENERATED ALWAYS AS
    (quantidade_solicitada * custo_unitario) STORED,
  UNIQUE (id,tenant_id),
  UNIQUE (pedido_compra_id,estoque_produto_id),
  FOREIGN KEY (pedido_compra_id,tenant_id)
    REFERENCES public.pedidos_compra(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (estoque_produto_id,tenant_id)
    REFERENCES public.estoque_produtos(id,tenant_id) ON DELETE RESTRICT
);

CREATE TABLE public.recebimentos_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pedido_compra_id uuid NOT NULL,
  estoque_local_id uuid NOT NULL,
  conta_pagar_id uuid,
  data_recebimento date NOT NULL,
  documento_fornecedor text,
  valor_total numeric NOT NULL DEFAULT 0 CHECK (valor_total > 0),
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,tenant_id),
  FOREIGN KEY (pedido_compra_id,tenant_id)
    REFERENCES public.pedidos_compra(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (estoque_local_id,tenant_id)
    REFERENCES public.estoque_locais(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (conta_pagar_id,tenant_id)
    REFERENCES public.contas_pagar(id,tenant_id) ON DELETE RESTRICT
);

CREATE TABLE public.recebimento_compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  recebimento_id uuid NOT NULL,
  pedido_item_id uuid NOT NULL,
  estoque_produto_id uuid NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  quantidade_devolvida numeric NOT NULL DEFAULT 0 CHECK (quantidade_devolvida >= 0),
  custo_unitario numeric NOT NULL CHECK (custo_unitario > 0),
  valor_total numeric GENERATED ALWAYS AS (quantidade * custo_unitario) STORED,
  UNIQUE (id,tenant_id),
  UNIQUE (recebimento_id,pedido_item_id),
  FOREIGN KEY (recebimento_id,tenant_id)
    REFERENCES public.recebimentos_compra(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (pedido_item_id,tenant_id)
    REFERENCES public.pedido_compra_itens(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (estoque_produto_id,tenant_id)
    REFERENCES public.estoque_produtos(id,tenant_id) ON DELETE RESTRICT
);

CREATE TABLE public.devolucoes_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pedido_compra_id uuid NOT NULL,
  recebimento_id uuid NOT NULL,
  estoque_local_id uuid NOT NULL,
  data_devolucao date NOT NULL,
  motivo text NOT NULL,
  valor_total numeric NOT NULL CHECK (valor_total > 0),
  reducao_obrigacao numeric NOT NULL CHECK (reducao_obrigacao >= 0),
  credito_fornecedor numeric NOT NULL CHECK (credito_fornecedor >= 0),
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,tenant_id),
  FOREIGN KEY (pedido_compra_id,tenant_id)
    REFERENCES public.pedidos_compra(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (recebimento_id,tenant_id)
    REFERENCES public.recebimentos_compra(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (estoque_local_id,tenant_id)
    REFERENCES public.estoque_locais(id,tenant_id) ON DELETE RESTRICT
);

CREATE TABLE public.devolucao_compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  devolucao_id uuid NOT NULL,
  recebimento_item_id uuid NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  custo_unitario numeric NOT NULL CHECK (custo_unitario > 0),
  FOREIGN KEY (devolucao_id,tenant_id)
    REFERENCES public.devolucoes_compra(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (recebimento_item_id,tenant_id)
    REFERENCES public.recebimento_compra_itens(id,tenant_id) ON DELETE RESTRICT
);

CREATE TABLE public.creditos_fornecedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  fornecedor_id uuid NOT NULL,
  pedido_compra_id uuid NOT NULL,
  devolucao_id uuid NOT NULL,
  valor_original numeric NOT NULL CHECK (valor_original > 0),
  valor_disponivel numeric NOT NULL CHECK (valor_disponivel >= 0),
  status text NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel','utilizado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (fornecedor_id,tenant_id)
    REFERENCES public.fornecedores(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (pedido_compra_id,tenant_id)
    REFERENCES public.pedidos_compra(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (devolucao_id,tenant_id)
    REFERENCES public.devolucoes_compra(id,tenant_id) ON DELETE RESTRICT
);

CREATE TABLE public.pedido_compra_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_data jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,idempotency_key)
);

DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'pedidos_compra','pedido_compra_itens','recebimentos_compra',
    'recebimento_compra_itens','devolucoes_compra','devolucao_compra_itens',
    'creditos_fornecedor','pedido_compra_operacoes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',v_table);
    IF v_table <> 'pedido_compra_operacoes' THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated',v_table);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id = private.current_tenant_id() AND private.has_any_module_access(ARRAY[''produtos'']::text[]))',
        v_table || '_select',v_table
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.require_purchase_admin()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE v_tenant uuid := private.require_stock_access();
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Esta operação exige administrador';
  END IF;
  RETURN v_tenant;
END;
$function$;
REVOKE ALL ON FUNCTION private.require_purchase_admin() FROM PUBLIC, anon, authenticated;
