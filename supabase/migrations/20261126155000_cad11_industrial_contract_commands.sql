-- CAD-11: versioned industrial contracts. Existing legacy rows remain readable;
-- only the command RPCs may mutate contracts and their item composition.

ALTER TABLE public.contratos_aluguel
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periodicidade_fechamento text NOT NULL DEFAULT 'avulso',
  ADD COLUMN IF NOT EXISTS dia_fechamento integer,
  ADD COLUMN IF NOT EXISTS dia_vencimento integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS autoriza_faturamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regras_comerciais text,
  ADD COLUMN IF NOT EXISTS encerrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS encerrado_por uuid,
  ADD COLUMN IF NOT EXISTS encerramento_motivo text,
  ADD COLUMN IF NOT EXISTS criado_por uuid,
  ADD COLUMN IF NOT EXISTS atualizado_por uuid;

-- The UI accepts measured quantities (for example, kilograms with decimals).
ALTER TABLE public.itens_contrato_aluguel
  ALTER COLUMN quantidade TYPE numeric(12,3) USING quantidade::numeric(12,3),
  ADD COLUMN IF NOT EXISTS unidade text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.contratos_aluguel
    WHERE valor_servico < 0 OR versao < 0 OR dia_vencimento NOT BETWEEN 1 AND 31
      OR (data_fim IS NOT NULL AND data_fim < data_inicio)
      OR periodicidade_fechamento NOT IN ('avulso','mensal','quinzenal')
      OR (periodicidade_fechamento = 'avulso' AND dia_fechamento IS NOT NULL)
      OR (periodicidade_fechamento = 'mensal' AND (dia_fechamento IS NULL OR dia_fechamento NOT BETWEEN 1 AND 31))
      OR (periodicidade_fechamento = 'quinzenal' AND (dia_fechamento IS NULL OR dia_fechamento NOT BETWEEN 1 AND 16))
      OR (forma_pagamento IS NOT NULL AND forma_pagamento NOT IN ('dinheiro','pix','cartao_credito','cartao_debito','boleto','transferencia'))
  ) OR EXISTS (
    SELECT 1 FROM public.itens_contrato_aluguel
    WHERE quantidade <= 0 OR valor_unitario < 0
  ) THEN
    RAISE EXCEPTION 'CAD-11: corrija contratos ou itens legados invalidos antes de aplicar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.contratos_aluguel WHERE ativo
    GROUP BY tenant_id, cliente_id HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM public.itens_contrato_aluguel WHERE produto_id IS NOT NULL
    GROUP BY tenant_id, contrato_id, produto_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'CAD-11: contratos ativos ou produtos duplicados precisam de conciliacao';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.contratos_aluguel'::regclass AND conname = 'contratos_aluguel_cad11_integrity') THEN
    ALTER TABLE public.contratos_aluguel ADD CONSTRAINT contratos_aluguel_cad11_integrity CHECK (
      valor_servico >= 0 AND versao >= 0 AND dia_vencimento BETWEEN 1 AND 31
      AND (data_fim IS NULL OR data_fim >= data_inicio)
      AND periodicidade_fechamento IN ('avulso','mensal','quinzenal')
      AND ((periodicidade_fechamento = 'avulso' AND dia_fechamento IS NULL)
        OR (periodicidade_fechamento = 'mensal' AND dia_fechamento IS NOT NULL AND dia_fechamento BETWEEN 1 AND 31)
        OR (periodicidade_fechamento = 'quinzenal' AND dia_fechamento IS NOT NULL AND dia_fechamento BETWEEN 1 AND 16))
      AND (forma_pagamento IS NULL OR forma_pagamento IN ('dinheiro','pix','cartao_credito','cartao_debito','boleto','transferencia'))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.itens_contrato_aluguel'::regclass AND conname = 'itens_contrato_aluguel_cad11_integrity') THEN
    ALTER TABLE public.itens_contrato_aluguel ADD CONSTRAINT itens_contrato_aluguel_cad11_integrity
      CHECK (quantidade > 0 AND valor_unitario >= 0);
  END IF;
END;
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS contratos_aluguel_one_active_per_client_cad11
  ON public.contratos_aluguel (tenant_id, cliente_id) WHERE ativo;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contratos_aluguel_id_tenant
  ON public.contratos_aluguel (id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS itens_contrato_aluguel_one_product_cad11
  ON public.itens_contrato_aluguel (tenant_id, contrato_id, produto_id) WHERE produto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS itens_contrato_aluguel_tenant_contract_cad11
  ON public.itens_contrato_aluguel (tenant_id, contrato_id, created_at);

CREATE TABLE IF NOT EXISTS public.contrato_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  contrato_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('CRIAR','ATUALIZAR','ENCERRAR','MIGRACAO')),
  versao_anterior integer,
  versao_nova integer NOT NULL CHECK (versao_nova >= 0),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contrato_operacoes_contract_tenant_fkey FOREIGN KEY (contrato_id, tenant_id)
    REFERENCES public.contratos_aluguel (id, tenant_id) ON DELETE RESTRICT
);
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.contrato_operacoes'::regclass
        AND conname = 'contrato_operacoes_contract_tenant_fkey') THEN
    ALTER TABLE public.contrato_operacoes
      ADD CONSTRAINT contrato_operacoes_contract_tenant_fkey
      FOREIGN KEY (contrato_id, tenant_id)
      REFERENCES public.contratos_aluguel (id, tenant_id) ON DELETE RESTRICT;
  END IF;
END;
$migration$;
CREATE UNIQUE INDEX IF NOT EXISTS contrato_operacoes_tenant_key_cad11
  ON public.contrato_operacoes (tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS contrato_operacoes_tenant_contract_created_cad11
  ON public.contrato_operacoes (tenant_id, contrato_id, created_at DESC);

ALTER TABLE public.contrato_operacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contrato_operacoes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.contrato_operacoes TO authenticated;
DROP POLICY IF EXISTS contrato_operacoes_select_cad11 ON public.contrato_operacoes;
CREATE POLICY contrato_operacoes_select_cad11 ON public.contrato_operacoes
  FOR SELECT TO authenticated USING (
    tenant_id = (SELECT private.current_tenant_id())
    AND (SELECT private.has_any_module_access(ARRAY['clientes','faturamento','relatorios']::text[]))
    AND private.can_access_contract(contrato_id)
  );

-- Direct Data API writes would bypass the version and audit guarantees.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.contratos_aluguel, public.itens_contrato_aluguel
  FROM PUBLIC, anon, authenticated;

-- Fiscal preferences may still be edited through the payment settings screen,
-- but an active contract owns the commercial terms and its config row.
CREATE OR REPLACE FUNCTION private.guard_active_contract_payment_terms()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_contract public.contratos_aluguel%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.contratos_aluguel contract
        JOIN public.clientes client ON client.id = contract.cliente_id AND client.tenant_id = contract.tenant_id
        WHERE contract.tenant_id = OLD.tenant_id AND contract.cliente_id = OLD.cliente_id
          AND contract.ativo AND client.classificacao = 'industrial') THEN
      RAISE EXCEPTION 'A configuracao de um contrato ativo nao pode ser removida' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.cliente_id IS DISTINCT FROM OLD.cliente_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
       AND EXISTS (SELECT 1 FROM public.contratos_aluguel contract
         JOIN public.clientes client ON client.id = contract.cliente_id AND client.tenant_id = contract.tenant_id
         WHERE contract.tenant_id = OLD.tenant_id AND contract.cliente_id = OLD.cliente_id
           AND contract.ativo AND client.classificacao = 'industrial') THEN
      RAISE EXCEPTION 'A configuracao de um contrato ativo nao pode mudar de cliente' USING ERRCODE = '23514';
    END IF;
    IF NEW.cliente_id IS NOT DISTINCT FROM OLD.cliente_id
       AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
       AND ROW(NEW.condicao_pagamento, NEW.tipo_faturamento, NEW.dia_fechamento,
         NEW.dia_vencimento, NEW.forma_pagamento, NEW.faturamento_data_base)
         IS NOT DISTINCT FROM ROW(OLD.condicao_pagamento, OLD.tipo_faturamento,
           OLD.dia_fechamento, OLD.dia_vencimento, OLD.forma_pagamento,
           OLD.faturamento_data_base) THEN
      RETURN NEW;
    END IF;
  END IF;
  SELECT contract.* INTO v_contract FROM public.contratos_aluguel contract
  JOIN public.clientes client ON client.id = contract.cliente_id AND client.tenant_id = contract.tenant_id
  WHERE contract.tenant_id = NEW.tenant_id AND contract.cliente_id = NEW.cliente_id
    AND contract.ativo AND client.classificacao = 'industrial';
  IF FOUND AND (
       NEW.condicao_pagamento IS DISTINCT FROM CASE WHEN v_contract.autoriza_faturamento THEN 'faturado' ELSE 'retirada' END
       OR NEW.tipo_faturamento IS DISTINCT FROM CASE WHEN v_contract.autoriza_faturamento THEN v_contract.periodicidade_fechamento ELSE 'avulso' END
       OR NEW.dia_fechamento IS DISTINCT FROM CASE WHEN v_contract.autoriza_faturamento THEN v_contract.dia_fechamento ELSE NULL END
       OR NEW.dia_vencimento IS DISTINCT FROM CASE WHEN v_contract.autoriza_faturamento THEN v_contract.dia_vencimento ELSE NULL END
       OR NEW.forma_pagamento IS DISTINCT FROM v_contract.forma_pagamento
       OR NEW.faturamento_data_base IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Condicoes de pagamento pertencem ao contrato industrial ativo' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.guard_active_contract_payment_terms() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_active_contract_payment_terms ON public.configuracoes_pagamento_cliente;
CREATE TRIGGER guard_active_contract_payment_terms
  BEFORE INSERT OR UPDATE OR DELETE ON public.configuracoes_pagamento_cliente
  FOR EACH ROW EXECUTE FUNCTION private.guard_active_contract_payment_terms();

CREATE OR REPLACE FUNCTION private.salvar_contrato_industrial_command(
  _contrato_id uuid, _cliente_id uuid, _descricao text, _valor_servico numeric,
  _data_inicio date, _data_fim date, _periodicidade_fechamento text,
  _dia_fechamento integer, _dia_vencimento integer, _forma_pagamento text,
  _autoriza_faturamento boolean, _regras_comerciais text, _observacoes text,
  _itens jsonb, _versao_esperada integer, _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_actor uuid := auth.uid();
  v_key text := btrim(coalesce(_idempotency_key, ''));
  v_description text := btrim(coalesce(_descricao, ''));
  v_rules text := nullif(btrim(_regras_comerciais), '');
  v_notes text := nullif(btrim(_observacoes), '');
  v_kind text := CASE WHEN _contrato_id IS NULL THEN 'CRIAR' ELSE 'ATUALIZAR' END;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_request jsonb;
  v_result jsonb;
  v_prior public.contrato_operacoes%ROWTYPE;
  v_contract public.contratos_aluguel%ROWTYPE;
  v_product public.produtos%ROWTYPE;
  v_product_id uuid;
  v_product_ids uuid[] := ARRAY[]::uuid[];
  v_quantity numeric;
  v_unit_price numeric;
  v_service_total numeric := 0;
  v_quantity_total numeric := 0;
  v_before jsonb;
  v_client_classification text;
  v_client_active boolean;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['clientes']::text[])
     OR NOT private.has_any_module_access(ARRAY['alterar_condicoes_comerciais']::text[])
     OR NOT private.can_access_area('industrial') THEN
    RAISE EXCEPTION 'Sem permissao para alterar contratos industriais' USING ERRCODE = '42501';
  END IF;
  IF v_key = '' OR length(v_key) > 180 THEN
    RAISE EXCEPTION 'Chave de operacao invalida' USING ERRCODE = '22023';
  END IF;
  IF _cliente_id IS NULL OR length(v_description) NOT BETWEEN 3 AND 240
     OR _valor_servico IS NULL OR _valor_servico < 0 OR _valor_servico > 99999999.99
     OR _valor_servico <> round(_valor_servico, 2)
     OR _data_inicio IS NULL OR (_data_fim IS NOT NULL AND _data_fim < _data_inicio)
     OR _periodicidade_fechamento IS NULL
     OR _periodicidade_fechamento NOT IN ('avulso','mensal','quinzenal')
     OR _dia_vencimento IS NULL OR _dia_vencimento NOT BETWEEN 1 AND 31
     OR (_periodicidade_fechamento = 'avulso' AND _dia_fechamento IS NOT NULL)
     OR (_periodicidade_fechamento = 'mensal' AND (_dia_fechamento IS NULL OR _dia_fechamento NOT BETWEEN 1 AND 31))
     OR (_periodicidade_fechamento = 'quinzenal' AND (_dia_fechamento IS NULL OR _dia_fechamento NOT BETWEEN 1 AND 16))
     OR _autoriza_faturamento IS NULL
     OR (NOT _autoriza_faturamento AND _periodicidade_fechamento <> 'avulso')
     OR (_forma_pagamento IS NOT NULL AND _forma_pagamento NOT IN ('dinheiro','pix','cartao_credito','cartao_debito','boleto','transferencia'))
     OR (NOT _autoriza_faturamento AND _forma_pagamento IN ('boleto','transferencia'))
     OR length(coalesce(v_rules,'')) > 5000 OR length(coalesce(v_notes,'')) > 5000
     OR jsonb_typeof(_itens) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Dados do contrato industrial invalidos' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(_itens) > 100 THEN
    RAISE EXCEPTION 'O contrato aceita ate 100 servicos' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(_itens) AS item(value) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_item->'produtoId') IS DISTINCT FROM 'string'
       OR coalesce(v_item->>'produtoId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR jsonb_typeof(v_item->'quantidade') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_item->'valorUnitario') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Servico contratual invalido' USING ERRCODE = '22023';
    END IF;
    v_product_id := (v_item->>'produtoId')::uuid;
    v_quantity := (v_item->>'quantidade')::numeric;
    v_unit_price := (v_item->>'valorUnitario')::numeric;
    IF v_product_id = ANY(v_product_ids) OR v_quantity <= 0 OR v_quantity > 999999999.999
       OR v_quantity <> round(v_quantity, 3)
       OR v_unit_price < 0 OR v_unit_price > 99999999.99
       OR v_unit_price <> round(v_unit_price, 2) THEN
      RAISE EXCEPTION 'Quantidade, preco ou servico duplicado invalido' USING ERRCODE = '22023';
    END IF;
    v_product_ids := array_append(v_product_ids, v_product_id);
    v_service_total := v_service_total + v_quantity * v_unit_price;
    v_quantity_total := v_quantity_total + v_quantity;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'produtoId', v_product_id, 'quantidade', v_quantity, 'valorUnitario', v_unit_price));
  END LOOP;
  IF _valor_servico + v_service_total <= 0 THEN
    RAISE EXCEPTION 'Informe valor fixo ou servico com valor' USING ERRCODE = '22023';
  END IF;

  v_request := jsonb_build_object(
    'contratoId', _contrato_id, 'clienteId', _cliente_id, 'descricao', v_description,
    'valorServico', _valor_servico, 'dataInicio', _data_inicio, 'dataFim', _data_fim,
    'periodicidade', _periodicidade_fechamento, 'diaFechamento', _dia_fechamento,
    'diaVencimento', _dia_vencimento, 'formaPagamento', _forma_pagamento,
    'autorizaFaturamento', _autoriza_faturamento, 'regrasComerciais', v_rules,
    'observacoes', v_notes, 'itens', v_items, 'versaoEsperada', _versao_esperada);
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text || ':' || v_key, 0));
  SELECT * INTO v_prior FROM public.contrato_operacoes
  WHERE tenant_id = v_tenant AND idempotency_key = v_key;
  IF FOUND THEN
    IF v_prior.criado_por IS DISTINCT FROM v_actor OR v_prior.tipo <> v_kind
       OR v_prior.dados->'request' IS DISTINCT FROM v_request THEN
      RAISE EXCEPTION 'Chave de operacao ja usada com outros dados ou operador' USING ERRCODE = '23505';
    END IF;
    RETURN v_prior.resultado || jsonb_build_object('idempotent', true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('industrial-contract:' || v_tenant::text || ':' || _cliente_id::text, 0));
  SELECT classificacao, ativo INTO v_client_classification, v_client_active
  FROM public.clientes WHERE id = _cliente_id AND tenant_id = v_tenant FOR SHARE;
  IF NOT FOUND OR v_client_classification <> 'industrial' OR NOT v_client_active THEN
    RAISE EXCEPTION 'Cliente industrial ativo nao encontrado nesta empresa' USING ERRCODE = '22023';
  END IF;

  FOREACH v_product_id IN ARRAY v_product_ids LOOP
    SELECT * INTO v_product FROM public.produtos
    WHERE id = v_product_id AND tenant_id = v_tenant AND status = 'ativo'
      AND unidade_negocio IN ('ID1','ambos') FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Servico industrial ativo nao encontrado nesta empresa' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF _contrato_id IS NULL THEN
    IF _versao_esperada IS NOT NULL OR EXISTS (
      SELECT 1 FROM public.contratos_aluguel
      WHERE tenant_id = v_tenant AND cliente_id = _cliente_id AND ativo
    ) THEN
      RAISE EXCEPTION 'Ja existe contrato ativo ou versao inicial invalida' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.contratos_aluguel (
      tenant_id, cliente_id, descricao, valor_servico, data_inicio, data_fim,
      periodicidade_fechamento, dia_fechamento, dia_vencimento, forma_pagamento,
      autoriza_faturamento, regras_comerciais, observacoes, ativo, versao,
      criado_por, atualizado_por
    ) VALUES (
      v_tenant, _cliente_id, v_description, _valor_servico, _data_inicio, _data_fim,
      _periodicidade_fechamento, _dia_fechamento, _dia_vencimento, _forma_pagamento,
      _autoriza_faturamento, v_rules, v_notes, true, 0, v_actor, v_actor
    ) RETURNING * INTO v_contract;
    v_before := NULL;
  ELSE
    SELECT * INTO v_contract FROM public.contratos_aluguel
    WHERE id = _contrato_id AND tenant_id = v_tenant FOR UPDATE;
    IF NOT FOUND OR v_contract.cliente_id IS DISTINCT FROM _cliente_id THEN
      RAISE EXCEPTION 'Contrato nao encontrado para este cliente' USING ERRCODE = '22023';
    END IF;
    IF NOT v_contract.ativo OR _versao_esperada IS NULL
       OR v_contract.versao IS DISTINCT FROM _versao_esperada THEN
      RAISE EXCEPTION 'Contrato encerrado ou alterado por outro usuario. Atualize e tente novamente' USING ERRCODE = '40001';
    END IF;
    SELECT jsonb_build_object('contrato', to_jsonb(v_contract), 'itens',
      coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.created_at, i.id), '[]'::jsonb))
      INTO v_before FROM public.itens_contrato_aluguel i
      WHERE i.tenant_id = v_tenant AND i.contrato_id = v_contract.id;
    UPDATE public.contratos_aluguel SET
      descricao = v_description, valor_servico = _valor_servico,
      data_inicio = _data_inicio, data_fim = _data_fim,
      periodicidade_fechamento = _periodicidade_fechamento,
      dia_fechamento = _dia_fechamento, dia_vencimento = _dia_vencimento,
      forma_pagamento = _forma_pagamento, autoriza_faturamento = _autoriza_faturamento,
      regras_comerciais = v_rules, observacoes = v_notes,
      versao = versao + 1, atualizado_por = v_actor, updated_at = now()
    WHERE id = v_contract.id AND tenant_id = v_tenant RETURNING * INTO v_contract;
    DELETE FROM public.itens_contrato_aluguel
    WHERE contrato_id = v_contract.id AND tenant_id = v_tenant;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) AS item(value) LOOP
    SELECT * INTO v_product FROM public.produtos WHERE id = (v_item->>'produtoId')::uuid AND tenant_id = v_tenant;
    INSERT INTO public.itens_contrato_aluguel (
      tenant_id, contrato_id, produto_id, descricao_item, quantidade, valor_unitario, unidade
    ) VALUES (
      v_tenant, v_contract.id, v_product.id, v_product.nome,
      (v_item->>'quantidade')::numeric, (v_item->>'valorUnitario')::numeric,
      coalesce(nullif(btrim(v_product.unidade), ''), 'unidade')
    );
  END LOOP;

  INSERT INTO public.configuracoes_pagamento_cliente (
    tenant_id, cliente_id, condicao_pagamento, tipo_faturamento,
    dia_fechamento, dia_vencimento, forma_pagamento, faturamento_data_base
  ) VALUES (
    v_tenant, _cliente_id,
    CASE WHEN _autoriza_faturamento THEN 'faturado' ELSE 'retirada' END,
    CASE WHEN _autoriza_faturamento THEN _periodicidade_fechamento ELSE 'avulso' END,
    CASE WHEN _autoriza_faturamento THEN _dia_fechamento ELSE NULL END,
    CASE WHEN _autoriza_faturamento THEN _dia_vencimento ELSE NULL END,
    _forma_pagamento, NULL
  ) ON CONFLICT (cliente_id) DO UPDATE SET
    condicao_pagamento = EXCLUDED.condicao_pagamento,
    tipo_faturamento = EXCLUDED.tipo_faturamento,
    dia_fechamento = EXCLUDED.dia_fechamento,
    dia_vencimento = EXCLUDED.dia_vencimento,
    forma_pagamento = EXCLUDED.forma_pagamento,
    faturamento_data_base = NULL,
    updated_at = now()
  WHERE public.configuracoes_pagamento_cliente.tenant_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuracao de pagamento fora da empresa ativa' USING ERRCODE = '42501';
  END IF;

  v_result := jsonb_build_object(
    'id', v_contract.id, 'clienteId', v_contract.cliente_id,
    'ativo', true, 'versao', v_contract.versao,
    'valorFixo', _valor_servico, 'valorServicos', v_service_total,
    'valorReferencia', _valor_servico + v_service_total,
    'quantidadeServicos', v_quantity_total,
    'autorizaFaturamento', _autoriza_faturamento, 'idempotent', false);
  INSERT INTO public.contrato_operacoes (
    tenant_id, contrato_id, tipo, versao_anterior, versao_nova,
    dados, resultado, criado_por, idempotency_key, request_fingerprint
  ) VALUES (
    v_tenant, v_contract.id, v_kind,
    CASE WHEN v_kind = 'CRIAR' THEN NULL ELSE _versao_esperada END,
    v_contract.versao,
    jsonb_build_object('request', v_request, 'before', v_before,
      'after', jsonb_build_object('contrato', to_jsonb(v_contract), 'itens', v_items)),
    v_result, v_actor, v_key, md5(v_request::text)
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION private.encerrar_contrato_industrial_command(
  _contrato_id uuid, _motivo text, _versao_esperada integer, _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_actor uuid := auth.uid();
  v_key text := btrim(coalesce(_idempotency_key, ''));
  v_reason text := btrim(coalesce(_motivo, ''));
  v_request jsonb;
  v_result jsonb;
  v_prior public.contrato_operacoes%ROWTYPE;
  v_contract public.contratos_aluguel%ROWTYPE;
  v_before jsonb;
  v_client_id uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['clientes']::text[])
     OR NOT private.has_any_module_access(ARRAY['alterar_condicoes_comerciais']::text[])
     OR NOT private.can_access_area('industrial') THEN
    RAISE EXCEPTION 'Sem permissao para encerrar contratos industriais' USING ERRCODE = '42501';
  END IF;
  IF _contrato_id IS NULL OR _versao_esperada IS NULL
     OR length(v_reason) NOT BETWEEN 5 AND 1000
     OR v_key = '' OR length(v_key) > 180 THEN
    RAISE EXCEPTION 'Dados do encerramento invalidos' USING ERRCODE = '22023';
  END IF;
  v_request := jsonb_build_object('contratoId', _contrato_id,
    'motivo', v_reason, 'versaoEsperada', _versao_esperada);
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text || ':' || v_key, 0));
  SELECT * INTO v_prior FROM public.contrato_operacoes
  WHERE tenant_id = v_tenant AND idempotency_key = v_key;
  IF FOUND THEN
    IF v_prior.criado_por IS DISTINCT FROM v_actor OR v_prior.tipo <> 'ENCERRAR'
       OR v_prior.dados->'request' IS DISTINCT FROM v_request THEN
      RAISE EXCEPTION 'Chave de operacao ja usada com outros dados ou operador' USING ERRCODE = '23505';
    END IF;
    RETURN v_prior.resultado || jsonb_build_object('idempotent', true);
  END IF;

  SELECT cliente_id INTO v_client_id FROM public.contratos_aluguel
  WHERE id = _contrato_id AND tenant_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato nao encontrado nesta empresa' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('industrial-contract:' || v_tenant::text || ':' || v_client_id::text, 0));
  SELECT * INTO v_contract FROM public.contratos_aluguel
  WHERE id = _contrato_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND OR NOT v_contract.ativo OR v_contract.versao IS DISTINCT FROM _versao_esperada THEN
    RAISE EXCEPTION 'Contrato encerrado ou alterado por outro usuario. Atualize e tente novamente' USING ERRCODE = '40001';
  END IF;
  SELECT jsonb_build_object('contrato', to_jsonb(v_contract), 'itens',
    coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.created_at, i.id), '[]'::jsonb))
    INTO v_before FROM public.itens_contrato_aluguel i
    WHERE i.tenant_id = v_tenant AND i.contrato_id = v_contract.id;

  UPDATE public.contratos_aluguel SET
    ativo = false, autoriza_faturamento = false,
    encerrado_em = now(), encerrado_por = v_actor, encerramento_motivo = v_reason,
    versao = versao + 1, atualizado_por = v_actor, updated_at = now()
  WHERE id = _contrato_id AND tenant_id = v_tenant RETURNING * INTO v_contract;
  UPDATE public.configuracoes_pagamento_cliente SET
    condicao_pagamento = 'retirada', tipo_faturamento = 'avulso',
    dia_fechamento = NULL, dia_vencimento = NULL, faturamento_data_base = NULL,
    forma_pagamento = CASE WHEN forma_pagamento IN ('boleto','transferencia') THEN NULL ELSE forma_pagamento END,
    updated_at = now()
  WHERE cliente_id = v_contract.cliente_id AND tenant_id = v_tenant;

  v_result := jsonb_build_object('id', v_contract.id, 'clienteId', v_contract.cliente_id,
    'ativo', false, 'versao', v_contract.versao,
    'autorizaFaturamento', false, 'encerradoEm', v_contract.encerrado_em,
    'motivo', v_reason, 'idempotent', false);
  INSERT INTO public.contrato_operacoes (
    tenant_id, contrato_id, tipo, versao_anterior, versao_nova,
    dados, resultado, criado_por, idempotency_key, request_fingerprint
  ) VALUES (
    v_tenant, v_contract.id, 'ENCERRAR', _versao_esperada, v_contract.versao,
    jsonb_build_object('request', v_request, 'before', v_before, 'after', to_jsonb(v_contract)),
    v_result, v_actor, v_key, md5(v_request::text)
  );
  RETURN v_result;
END;
$function$;

-- Exposed functions remain invokers; the privileged implementation lives in
-- the private schema and verifies actor, module, area, tenant, and ownership.
CREATE OR REPLACE FUNCTION public.salvar_contrato_industrial(
  _contrato_id uuid, _cliente_id uuid, _descricao text, _valor_servico numeric,
  _data_inicio date, _data_fim date, _periodicidade_fechamento text,
  _dia_fechamento integer, _dia_vencimento integer, _forma_pagamento text,
  _autoriza_faturamento boolean, _regras_comerciais text, _observacoes text,
  _itens jsonb, _versao_esperada integer, _idempotency_key text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $function$
  SELECT private.salvar_contrato_industrial_command($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16);
$function$;

CREATE OR REPLACE FUNCTION public.encerrar_contrato_industrial(
  _contrato_id uuid, _motivo text, _versao_esperada integer, _idempotency_key text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $function$
  SELECT private.encerrar_contrato_industrial_command($1,$2,$3,$4);
$function$;

REVOKE ALL ON FUNCTION private.salvar_contrato_industrial_command(uuid,uuid,text,numeric,date,date,text,integer,integer,text,boolean,text,text,jsonb,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.encerrar_contrato_industrial_command(uuid,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salvar_contrato_industrial(uuid,uuid,text,numeric,date,date,text,integer,integer,text,boolean,text,text,jsonb,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encerrar_contrato_industrial(uuid,text,integer,text) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.salvar_contrato_industrial_command(uuid,uuid,text,numeric,date,date,text,integer,integer,text,boolean,text,text,jsonb,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.encerrar_contrato_industrial_command(uuid,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_contrato_industrial(uuid,uuid,text,numeric,date,date,text,integer,integer,text,boolean,text,text,jsonb,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encerrar_contrato_industrial(uuid,text,integer,text) TO authenticated;
