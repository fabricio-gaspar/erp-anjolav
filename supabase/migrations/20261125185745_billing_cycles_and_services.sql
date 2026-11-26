-- Configuracao de faturamento por empresa, separada da capacidade operacional do PDV.
ALTER TABLE public.configuracoes_gerais
  ADD COLUMN IF NOT EXISTS faturamento_limite_rols integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS faturamento_relatorios_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS faturamento_nfse_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS faturamento_boleto_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS faturamento_email_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS faturamento_whatsapp_ativo boolean NOT NULL DEFAULT false;

ALTER TABLE public.configuracoes_gerais
  ADD CONSTRAINT faturamento_limite_rols_range CHECK (faturamento_limite_rols BETWEEN 1 AND 500);

ALTER TABLE public.configuracoes_pagamento_cliente
  ADD COLUMN IF NOT EXISTS faturamento_data_base date;

ALTER TABLE public.configuracoes_pagamento_cliente
  ADD CONSTRAINT faturamento_ciclo_data_base CHECK (
    tipo_faturamento NOT IN ('a_cada_10_dias', 'a_cada_20_dias')
    OR faturamento_data_base IS NOT NULL
  );

-- O limite anterior de 100 era fixo em uma funcao existente. A substituicao
-- preserva todas as verificacoes de tenant, operacao, itens e idempotencia.
DO $migration$
DECLARE
  v_source text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef('public.fechar_faturamento_rols(text,uuid,date,date,uuid[],text,text)'::regprocedure)
    INTO v_source;
  IF v_source IS NULL
     OR position('v_count integer := 0;' IN v_source) = 0
     OR position('array_length(v_ids, 1) > 100' IN v_source) = 0
     OR position('Selecione entre 1 e 100 ROLs distintos' IN v_source) = 0 THEN
    RAISE EXCEPTION 'A funcao de fechamento mudou; revise a migracao de limite antes de aplicar';
  END IF;
  v_updated := replace(v_source,
    'v_count integer := 0;',
    'v_count integer := 0; v_limite_rols integer := 200;');
  v_updated := replace(v_updated,
    '  select array_agg(distinct item order by item) into v_ids',
    '  select coalesce(faturamento_limite_rols, 200) into v_limite_rols from public.configuracoes_gerais where tenant_id = v_tenant;'
    || chr(10) || '  v_limite_rols := coalesce(v_limite_rols, 200);'
    || chr(10) || '  select array_agg(distinct item order by item) into v_ids');
  v_updated := replace(v_updated,
    'array_length(v_ids, 1) > 100',
    'array_length(v_ids, 1) > v_limite_rols');
  v_updated := replace(v_updated,
    'raise exception ''Selecione entre 1 e 100 ROLs distintos'';',
    'raise exception ''Selecione entre 1 e % ROLs distintos'', v_limite_rols;');
  IF v_updated = v_source OR position('v_limite_rols := coalesce' IN v_updated) = 0 THEN
    RAISE EXCEPTION 'Nao foi possivel atualizar o limite do fechamento';
  END IF;
  EXECUTE v_updated;
END;
$migration$;

-- Preparacao e emissao passam pelo mesmo RPC. Consulta e cancelamento de
-- documentos ja emitidos permanecem acessiveis por obrigacao operacional.
DO $migration$
DECLARE
  v_source text;
BEGIN
  SELECT pg_get_functiondef('public.preparar_documento_nfse(uuid,uuid,text,text)'::regprocedure)
    INTO v_source;
  IF v_source IS NULL OR position('  select * into v_fatura from public.faturas' IN v_source) = 0 THEN
    RAISE EXCEPTION 'A funcao de NFS-e mudou; revise o bloqueio antes de aplicar';
  END IF;
  v_source := replace(v_source,
    '  select * into v_fatura from public.faturas',
    '  if not coalesce((select faturamento_nfse_ativo from public.configuracoes_gerais where tenant_id = v_tenant), false) then'
    || chr(10) || '    raise exception ''NFS-e desabilitada nas configuracoes de faturamento'';'
    || chr(10) || '  end if;'
    || chr(10) || '  select * into v_fatura from public.faturas');
  EXECUTE v_source;
END;
$migration$;

-- Um boleto de fatura so pode ser vinculado enquanto o servico estiver ativo.
DO $migration$
DECLARE
  v_source text;
BEGIN
  SELECT pg_get_functiondef('public.vincular_boleto_fatura(uuid,uuid,text)'::regprocedure)
    INTO v_source;
  IF v_source IS NULL OR position('  select * into v_fatura from public.faturas' IN v_source) = 0 THEN
    RAISE EXCEPTION 'A funcao de boleto mudou; revise o bloqueio antes de aplicar';
  END IF;
  v_source := replace(v_source,
    '  select * into v_fatura from public.faturas',
    '  if not coalesce((select faturamento_boleto_ativo from public.configuracoes_gerais where tenant_id = v_tenant), false) then'
    || chr(10) || '    raise exception ''Boleto desabilitado nas configuracoes de faturamento'';'
    || chr(10) || '  end if;'
    || chr(10) || '  select * into v_fatura from public.faturas');
  EXECUTE v_source;
END;
$migration$;
