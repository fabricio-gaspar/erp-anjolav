-- ADM-01 P0 prerequisite for the 14:30 payroll summary/generation migration.
-- The original payroll tables predate tenant-scoped transactional commands.
-- Preserve historical rows; all new payroll writes go through the RPCs below.
DO $migration$
BEGIN
  IF to_regclass('public.folha_pagamento') IS NULL
     OR to_regclass('public.folha_beneficios') IS NULL
     OR to_regclass('public.beneficios_catalogo') IS NULL
     OR to_regclass('public.funcionarios') IS NULL
     OR to_regclass('public.contas_pagar') IS NULL
     OR to_regprocedure('private.current_tenant_id()') IS NULL
     OR to_regprocedure('private.is_tenant_admin(uuid)') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_constraint c
       WHERE c.conrelid = 'public.folha_pagamento'::regclass
         AND c.conname = 'folha_pagamento_funcionario_id_competencia_key'
         AND c.contype = 'u'
     )
     OR EXISTS (
       SELECT 1 FROM (VALUES
         ('folha_pagamento'), ('folha_beneficios'), ('beneficios_catalogo'),
         ('funcionarios'), ('contas_pagar')
       ) AS required_table(name)
       WHERE NOT EXISTS (
         SELECT 1 FROM information_schema.columns columns
         WHERE columns.table_schema = 'public'
           AND columns.table_name = required_table.name
           AND columns.column_name = 'tenant_id'
       )
     ) THEN
    RAISE EXCEPTION 'ADM-01 P0 requires the tenant-scoped payroll, catalog and payables baseline';
  END IF;
END;
$migration$;

ALTER TABLE public.folha_pagamento
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cancelamento_motivo text,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid;

ALTER TABLE public.folha_beneficios
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;

ALTER TABLE public.beneficios_catalogo
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;

-- The original global name constraint prevents two tenants using the same
-- catalog label. Existing global uniqueness guarantees this new index builds.
ALTER TABLE public.beneficios_catalogo
  DROP CONSTRAINT IF EXISTS beneficios_catalogo_nome_key;
CREATE UNIQUE INDEX IF NOT EXISTS beneficios_catalogo_tenant_nome_key
  ON public.beneficios_catalogo (tenant_id, lower(btrim(nome)));

CREATE UNIQUE INDEX IF NOT EXISTS folha_beneficios_folha_beneficio_unique
  ON public.folha_beneficios (folha_id, beneficio_id)
  WHERE beneficio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS folha_pagamento_tenant_competencia_status_idx
  ON public.folha_pagamento (tenant_id, competencia, status);

CREATE TABLE public.folha_pagamento_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  competencia date NOT NULL,
  folha_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('gerar', 'atualizar', 'cancelar', 'beneficio', 'fechar', 'catalogo')),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 180),
  request_hash text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT folha_pagamento_operacoes_tenant_key UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT folha_pagamento_operacoes_folha_tenant_fkey
    FOREIGN KEY (folha_id, tenant_id)
    REFERENCES public.folha_pagamento (id, tenant_id) ON DELETE RESTRICT
);
CREATE INDEX folha_pagamento_operacoes_tenant_competencia_idx
  ON public.folha_pagamento_operacoes (tenant_id, competencia, created_at);
ALTER TABLE public.folha_pagamento_operacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.folha_pagamento_operacoes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.folha_pagamento_operacoes TO authenticated;
CREATE POLICY folha_pagamento_operacoes_admin_read
  ON public.folha_pagamento_operacoes FOR SELECT TO authenticated
  USING (tenant_id = (SELECT private.current_tenant_id())
    AND private.is_tenant_admin(tenant_id));

-- The helper locks a request before looking up the ledger. Replays return the
-- exact original result even after the underlying row has changed again.
CREATE FUNCTION private.folha_operacao_anterior(
  _tenant uuid, _key text, _tipo text, _dados jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_previous public.folha_pagamento_operacoes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR _tenant IS DISTINCT FROM private.current_tenant_id()
     OR NOT private.is_tenant_admin(_tenant)
     OR nullif(btrim(_key), '') IS NULL OR length(_key) > 180 THEN
    RAISE EXCEPTION 'Sem permissão ou chave de operação inválida' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('folha_requisicao:' || _tenant::text || ':' || _key, 0)
  );
  SELECT * INTO v_previous
  FROM public.folha_pagamento_operacoes o
  WHERE o.tenant_id = _tenant AND o.idempotency_key = _key;
  IF FOUND THEN
    IF v_previous.tipo IS DISTINCT FROM _tipo
       OR v_previous.request_hash IS DISTINCT FROM md5(_dados::text)
       OR v_previous.dados IS DISTINCT FROM _dados THEN
      RAISE EXCEPTION 'Chave de operação já usada com outros dados' USING ERRCODE = '22023';
    END IF;
    RETURN v_previous.resultado;
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION private.folha_operacao_anterior(uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.registrar_operacao_folha(
  _tenant uuid, _competencia date, _folha_id uuid, _tipo text,
  _key text, _dados jsonb, _resultado jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.folha_pagamento_operacoes (
    tenant_id, competencia, folha_id, tipo, idempotency_key,
    request_hash, dados, resultado, criado_por
  ) VALUES (
    _tenant, _competencia, _folha_id, _tipo, _key,
    md5(_dados::text), _dados, _resultado, auth.uid()
  );
END;
$function$;
REVOKE ALL ON FUNCTION private.registrar_operacao_folha(uuid, date, uuid, text, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.salvar_beneficio_catalogo(
  _nome text, _cor text, _ordem integer, _ativo boolean, _idempotency_key text,
  _beneficio_id uuid DEFAULT NULL, _versao_observada integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_dados jsonb := jsonb_build_object(
    'beneficio_id', _beneficio_id, 'versao', _versao_observada,
    'nome', btrim(_nome), 'cor', _cor, 'ordem', _ordem, 'ativo', _ativo
  );
  v_previous jsonb;
  v_item public.beneficios_catalogo%ROWTYPE;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT private.is_tenant_admin(v_tenant) THEN
    RAISE EXCEPTION 'Sem permissão para editar o catálogo' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(_nome), '') IS NULL OR length(btrim(_nome)) > 120
     OR _cor IS NULL OR _cor NOT IN ('blue','green','orange','rose','cyan','amber','purple','slate')
     OR _ordem IS NULL OR _ordem < 0 OR _ordem > 10000 OR _ativo IS NULL THEN
    RAISE EXCEPTION 'Dados do benefício inválidos' USING ERRCODE = '22023';
  END IF;
  v_previous := private.folha_operacao_anterior(v_tenant, _idempotency_key, 'catalogo', v_dados);
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;

  IF _beneficio_id IS NULL THEN
    IF _versao_observada IS NOT NULL THEN
      RAISE EXCEPTION 'Versão inesperada para novo benefício' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.beneficios_catalogo (tenant_id, nome, cor, ordem, ativo)
    VALUES (v_tenant, btrim(_nome), _cor, _ordem, _ativo)
    RETURNING * INTO v_item;
  ELSE
    SELECT * INTO v_item FROM public.beneficios_catalogo
    WHERE id = _beneficio_id AND tenant_id = v_tenant FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Benefício não encontrado nesta empresa' USING ERRCODE = 'P0002';
    END IF;
    IF _versao_observada IS DISTINCT FROM v_item.versao THEN
      RAISE EXCEPTION 'Benefício alterado por outra operação' USING ERRCODE = '40001';
    END IF;
    UPDATE public.beneficios_catalogo
    SET nome = btrim(_nome), cor = _cor, ordem = _ordem, ativo = _ativo,
        versao = versao + 1
    WHERE id = v_item.id AND tenant_id = v_tenant
    RETURNING * INTO v_item;
  END IF;
  v_result := to_jsonb(v_item);
  PERFORM private.registrar_operacao_folha(
    v_tenant, date_trunc('month', now())::date, NULL, 'catalogo',
    _idempotency_key, v_dados, v_result
  );
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.salvar_beneficio_catalogo(text, text, integer, boolean, text, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_beneficio_catalogo(text, text, integer, boolean, text, uuid, integer)
  TO authenticated;

CREATE FUNCTION public.atualizar_folha_aberta(
  _folha_id uuid, _versao_observada integer, _campo text,
  _valor numeric, _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_dados jsonb := jsonb_build_object(
    'folha_id', _folha_id, 'versao', _versao_observada,
    'campo', _campo, 'valor', _valor
  );
  v_previous jsonb;
  v_folha public.folha_pagamento%ROWTYPE;
  v_valor numeric(12,2);
  v_delta numeric(12,2);
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT private.is_tenant_admin(v_tenant) THEN
    RAISE EXCEPTION 'Sem permissão para editar a folha' USING ERRCODE = '42501';
  END IF;
  IF _folha_id IS NULL OR _campo IS NULL
     OR _campo NOT IN ('salario_base','adiantamento_salarial')
     OR _valor IS NULL OR _valor::text IN ('NaN','Infinity','-Infinity')
     OR _valor < 0 OR _valor > 9999999999.99
     OR _versao_observada IS NULL THEN
    RAISE EXCEPTION 'Alteração de folha inválida' USING ERRCODE = '22023';
  END IF;
  v_previous := private.folha_operacao_anterior(v_tenant, _idempotency_key, 'atualizar', v_dados);
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  SELECT * INTO v_folha FROM public.folha_pagamento
  WHERE id = _folha_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folha não encontrada nesta empresa' USING ERRCODE = 'P0002';
  END IF;
  IF v_folha.status <> 'aberto' OR v_folha.conta_pagar_id IS NOT NULL THEN
    RAISE EXCEPTION 'Somente folhas abertas podem ser editadas' USING ERRCODE = '22023';
  END IF;
  IF v_folha.versao IS DISTINCT FROM _versao_observada THEN
    RAISE EXCEPTION 'Folha alterada por outra operação' USING ERRCODE = '40001';
  END IF;
  v_valor := round(_valor, 2);
  IF _campo = 'salario_base' THEN
    v_delta := v_valor - v_folha.salario_base;
    UPDATE public.folha_pagamento
    SET salario_base = v_valor,
        total_proventos = total_proventos + v_delta,
        liquido = liquido + v_delta,
        custo_total_empresa = custo_total_empresa + v_delta,
        versao = versao + 1
    WHERE id = v_folha.id AND tenant_id = v_tenant
    RETURNING * INTO v_folha;
  ELSE
    v_delta := v_valor - coalesce(v_folha.adiantamento_salarial, 0);
    UPDATE public.folha_pagamento
    SET adiantamento_salarial = v_valor,
        total_descontos = total_descontos + v_delta,
        liquido = liquido - v_delta,
        versao = versao + 1
    WHERE id = v_folha.id AND tenant_id = v_tenant
    RETURNING * INTO v_folha;
  END IF;
  v_result := to_jsonb(v_folha);
  PERFORM private.registrar_operacao_folha(
    v_tenant, v_folha.competencia, v_folha.id, 'atualizar',
    _idempotency_key, v_dados, v_result
  );
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.atualizar_folha_aberta(uuid, integer, text, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_folha_aberta(uuid, integer, text, numeric, text)
  TO authenticated;

CREATE FUNCTION public.definir_beneficio_folha(
  _folha_id uuid, _versao_folha_observada integer, _beneficio_id uuid,
  _valor numeric, _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_dados jsonb := jsonb_build_object(
    'folha_id', _folha_id, 'versao', _versao_folha_observada,
    'beneficio_id', _beneficio_id, 'valor', _valor
  );
  v_previous jsonb;
  v_folha public.folha_pagamento%ROWTYPE;
  v_catalogo public.beneficios_catalogo%ROWTYPE;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT private.is_tenant_admin(v_tenant) THEN
    RAISE EXCEPTION 'Sem permissão para editar benefícios da folha' USING ERRCODE = '42501';
  END IF;
  IF _folha_id IS NULL OR _beneficio_id IS NULL OR _versao_folha_observada IS NULL
     OR _valor IS NULL OR _valor::text IN ('NaN','Infinity','-Infinity')
     OR _valor < 0 OR _valor > 99999999.99 THEN
    RAISE EXCEPTION 'Valor de benefício inválido' USING ERRCODE = '22023';
  END IF;
  v_previous := private.folha_operacao_anterior(v_tenant, _idempotency_key, 'beneficio', v_dados);
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  SELECT * INTO v_folha FROM public.folha_pagamento
  WHERE id = _folha_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folha não encontrada nesta empresa' USING ERRCODE = 'P0002';
  END IF;
  IF v_folha.status <> 'aberto' OR v_folha.conta_pagar_id IS NOT NULL THEN
    RAISE EXCEPTION 'Somente folhas abertas podem receber benefícios' USING ERRCODE = '22023';
  END IF;
  IF v_folha.versao IS DISTINCT FROM _versao_folha_observada THEN
    RAISE EXCEPTION 'Folha alterada por outra operação' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO v_catalogo FROM public.beneficios_catalogo
  WHERE id = _beneficio_id AND tenant_id = v_tenant AND ativo FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Benefício indisponível nesta empresa' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.folha_beneficios (
    tenant_id, folha_id, funcionario_id, beneficio_id,
    nome, categoria, tipo, valor, ativo
  ) VALUES (
    v_tenant, v_folha.id, v_folha.funcionario_id, v_catalogo.id,
    v_catalogo.nome, 'beneficio', 'beneficio', round(_valor, 2), round(_valor, 2) > 0
  )
  ON CONFLICT (folha_id, beneficio_id) WHERE beneficio_id IS NOT NULL
  DO UPDATE SET nome = EXCLUDED.nome, valor = EXCLUDED.valor,
                ativo = EXCLUDED.ativo, versao = public.folha_beneficios.versao + 1;
  UPDATE public.folha_pagamento SET versao = versao + 1
  WHERE id = v_folha.id AND tenant_id = v_tenant
  RETURNING * INTO v_folha;
  v_result := to_jsonb(v_folha);
  PERFORM private.registrar_operacao_folha(
    v_tenant, v_folha.competencia, v_folha.id, 'beneficio',
    _idempotency_key, v_dados, v_result
  );
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.definir_beneficio_folha(uuid, integer, uuid, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_beneficio_folha(uuid, integer, uuid, numeric, text)
  TO authenticated;

CREATE FUNCTION public.cancelar_folha_aberta(
  _folha_id uuid, _versao_observada integer, _motivo text, _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_dados jsonb := jsonb_build_object(
    'folha_id', _folha_id, 'versao', _versao_observada, 'motivo', btrim(_motivo)
  );
  v_previous jsonb;
  v_folha public.folha_pagamento%ROWTYPE;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT private.is_tenant_admin(v_tenant) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar a folha' USING ERRCODE = '42501';
  END IF;
  IF _folha_id IS NULL OR _versao_observada IS NULL
     OR length(btrim(coalesce(_motivo, ''))) < 5
     OR length(btrim(_motivo)) > 500 THEN
    RAISE EXCEPTION 'Motivo de cancelamento inválido' USING ERRCODE = '22023';
  END IF;
  v_previous := private.folha_operacao_anterior(v_tenant, _idempotency_key, 'cancelar', v_dados);
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  SELECT * INTO v_folha FROM public.folha_pagamento
  WHERE id = _folha_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folha não encontrada nesta empresa' USING ERRCODE = 'P0002';
  END IF;
  IF v_folha.status <> 'aberto' OR v_folha.conta_pagar_id IS NOT NULL THEN
    RAISE EXCEPTION 'Somente folhas abertas podem ser canceladas' USING ERRCODE = '22023';
  END IF;
  IF v_folha.versao IS DISTINCT FROM _versao_observada THEN
    RAISE EXCEPTION 'Folha alterada por outra operação' USING ERRCODE = '40001';
  END IF;
  UPDATE public.folha_pagamento
  SET status = 'cancelado', cancelamento_motivo = btrim(_motivo),
      cancelado_em = now(), cancelado_por = auth.uid(), versao = versao + 1
  WHERE id = v_folha.id AND tenant_id = v_tenant
  RETURNING * INTO v_folha;
  v_result := to_jsonb(v_folha);
  PERFORM private.registrar_operacao_folha(
    v_tenant, v_folha.competencia, v_folha.id, 'cancelar',
    _idempotency_key, v_dados, v_result
  );
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.cancelar_folha_aberta(uuid, integer, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_folha_aberta(uuid, integer, text, text)
  TO authenticated;

CREATE FUNCTION public.fechar_folha_competencia(
  _competencia date, _vencimento date, _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_dados jsonb := jsonb_build_object('competencia', _competencia, 'vencimento', _vencimento);
  v_previous jsonb;
  v_folha public.folha_pagamento%ROWTYPE;
  v_nome text;
  v_beneficios numeric;
  v_valor numeric;
  v_conta_id uuid;
  v_closed integer := 0;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT private.is_tenant_admin(v_tenant) THEN
    RAISE EXCEPTION 'Sem permissão para fechar a folha' USING ERRCODE = '42501';
  END IF;
  IF _competencia IS NULL OR EXTRACT(DAY FROM _competencia) <> 1
     OR _vencimento IS NULL THEN
    RAISE EXCEPTION 'Competência ou vencimento inválido' USING ERRCODE = '22023';
  END IF;
  v_previous := private.folha_operacao_anterior(v_tenant, _idempotency_key, 'fechar', v_dados);
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  -- Generation takes this same month lock, so no new row can appear mid-close.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('gerar_folha:' || v_tenant::text || ':' || _competencia::text, 0)
  );
  FOR v_folha IN
    SELECT * FROM public.folha_pagamento
    WHERE tenant_id = v_tenant AND competencia = _competencia AND status = 'aberto'
    ORDER BY id FOR UPDATE
  LOOP
    IF v_folha.conta_pagar_id IS NOT NULL THEN
      RAISE EXCEPTION 'Folha aberta já tem conta a pagar' USING ERRCODE = '22023';
    END IF;
    SELECT e.nome INTO v_nome FROM public.funcionarios e
    WHERE e.id = v_folha.funcionario_id AND e.tenant_id = v_tenant;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Funcionário da folha não encontrado nesta empresa' USING ERRCODE = 'P0002';
    END IF;
    SELECT coalesce(sum(b.valor), 0) INTO v_beneficios
    FROM public.folha_beneficios b
    WHERE b.tenant_id = v_tenant AND b.folha_id = v_folha.id
      AND b.ativo AND b.tipo = 'beneficio';
    v_valor := round(v_folha.salario_base + v_beneficios, 2);
    IF v_valor::text IN ('NaN','Infinity','-Infinity')
       OR v_valor <= 0 OR v_valor > 99999999.99 THEN
      RAISE EXCEPTION 'Valor de conta a pagar inválido para a folha %', v_folha.id
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.contas_pagar (
      tenant_id, descricao, fornecedor, valor, vencimento, status,
      categoria, observacoes, criado_por
    ) VALUES (
      v_tenant,
      'Folha ' || pg_catalog.to_char(_competencia, 'MM/YYYY') || ' - ' || v_nome,
      v_nome, v_valor, _vencimento, 'pendente', 'folha_pagamento',
      'Gerada pelo fechamento da folha', auth.uid()
    ) RETURNING id INTO v_conta_id;
    UPDATE public.folha_pagamento
    SET status = 'fechado', data_pagamento = _vencimento,
        conta_pagar_id = v_conta_id, versao = versao + 1
    WHERE id = v_folha.id AND tenant_id = v_tenant;
    v_closed := v_closed + 1;
  END LOOP;
  v_result := jsonb_build_object('closed', v_closed);
  PERFORM private.registrar_operacao_folha(
    v_tenant, _competencia, NULL, 'fechar', _idempotency_key, v_dados, v_result
  );
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.fechar_folha_competencia(date, date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_folha_competencia(date, date, text)
  TO authenticated;

-- Reads remain subject to the existing tenant/employee RLS policies. Direct
-- browser writes would bypass version checks and closed-row immutability.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.folha_pagamento,
  public.folha_beneficios, public.beneficios_catalogo FROM PUBLIC, anon, authenticated;
