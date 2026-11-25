-- Registra o funcionário vinculado à sessão autenticada em cada movimento
-- manual e expõe o nome no histórico dentro do tenant autorizado.
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
  v_employee_id uuid;
  v_after numeric;
BEGIN
  IF _tipo NOT IN ('entrada','saida') OR _quantidade IS NULL
    OR _quantidade <= 0 OR nullif(trim(_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'Movimentação inválida';
  END IF;
  IF _tipo = 'saida' AND nullif(trim(_motivo),'') IS NULL THEN
    RAISE EXCEPTION 'O motivo da retirada é obrigatório';
  END IF;

  SELECT f.id INTO v_employee_id
  FROM public.funcionarios f
  WHERE f.user_id = auth.uid() AND f.tenant_id = v_tenant AND f.ativo
  ORDER BY f.created_at DESC
  LIMIT 1;

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
      natureza,idempotency_key,criado_por,funcionario_id,local_origem_id,local_destino_id)
  VALUES (v_tenant,_estoque_produto_id,_estoque_local_id,_tipo,_quantidade,
    nullif(trim(_motivo),''),_fornecedor_id,_custo_unitario,
    v_balance.quantidade,v_after,'manual',_idempotency_key,auth.uid(),v_employee_id,
    CASE WHEN _tipo='saida' THEN _estoque_local_id END,
    CASE WHEN _tipo='entrada' THEN _estoque_local_id END)
  RETURNING * INTO v_movement;
  RETURN to_jsonb(v_movement);
END;
$function$;
REVOKE ALL ON FUNCTION public.registrar_movimentacao_estoque_local(
  uuid,text,numeric,text,uuid,numeric,uuid,text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_estoque_local(
  uuid,text,numeric,text,uuid,numeric,uuid,text
) TO authenticated;

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
  v_motivo text := COALESCE(nullif(trim(_motivo),''),'Transferência entre locais');
BEGIN
  IF _local_origem_id = _local_destino_id OR _quantidade IS NULL
    OR _quantidade <= 0 OR nullif(trim(_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'Transferência inválida';
  END IF;
  v_saida := public.registrar_movimentacao_estoque_local(
    _estoque_produto_id,'saida',_quantidade,v_motivo,NULL,NULL,
    _local_origem_id,_idempotency_key || ':saida'
  );
  v_entrada := public.registrar_movimentacao_estoque_local(
    _estoque_produto_id,'entrada',_quantidade,v_motivo,NULL,NULL,
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
REVOKE ALL ON FUNCTION public.transferir_estoque(uuid,uuid,uuid,numeric,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transferir_estoque(uuid,uuid,uuid,numeric,text,text)
  TO authenticated;

-- Backfill linked employee names for existing movements where possible.
UPDATE public.movimentacoes_estoque m
SET funcionario_id = f.id
FROM public.funcionarios f
WHERE m.funcionario_id IS NULL
  AND m.criado_por = f.user_id
  AND m.tenant_id = f.tenant_id;

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
      lo.codigo AS local_origem_codigo, ld.codigo AS local_destino_codigo,
      COALESCE(fn.nome, CASE WHEN m.criado_por IS NULL THEN NULL
        ELSE 'Usuário ' || left(m.criado_por::text, 8) END) AS responsavel_nome
    FROM public.movimentacoes_estoque m
    JOIN public.estoque_produtos p ON p.id = m.estoque_produto_id
      AND p.tenant_id = m.tenant_id
    LEFT JOIN public.fornecedores f ON f.id = m.fornecedor_id
      AND f.tenant_id = m.tenant_id
    LEFT JOIN public.funcionarios fn ON fn.id = m.funcionario_id
      AND fn.tenant_id = m.tenant_id
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
        OR motivo ILIKE '%' || trim(_busca) || '%'
        OR responsavel_nome ILIKE '%' || trim(_busca) || '%')
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
REVOKE ALL ON FUNCTION public.consultar_diretorio_movimentacoes_estoque(
  text,text,integer,integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_diretorio_movimentacoes_estoque(
  text,text,integer,integer
) TO authenticated;

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
        FROM base WHERE ativo),
      'totalUnits', (SELECT COALESCE(sum(quantidade_atual), 0)
        FROM base WHERE ativo)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.consultar_diretorio_insumos(
  text,text,text,integer,integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_diretorio_insumos(
  text,text,text,integer,integer
) TO authenticated;
