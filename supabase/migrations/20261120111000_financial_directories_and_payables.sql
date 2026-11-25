-- Restore protected finance directory queries and transactional payable actions.
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS criado_por uuid,
  ADD COLUMN IF NOT EXISTS atualizado_por uuid,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid,
  ADD COLUMN IF NOT EXISTS cancelamento_motivo text;
ALTER TABLE public.contas_pagar ALTER COLUMN valor_pago SET DEFAULT 0;
UPDATE public.contas_pagar SET valor_pago=0 WHERE valor_pago IS NULL;
ALTER TABLE public.contas_pagar ALTER COLUMN valor_pago SET NOT NULL;
ALTER TABLE public.contas_pagar DROP CONSTRAINT IF EXISTS contas_pagar_status_check;
ALTER TABLE public.contas_pagar ADD CONSTRAINT contas_pagar_status_check
  CHECK (status = ANY (ARRAY['pendente','vencido','parcial','pago','cancelado']::text[]));
ALTER TABLE public.contas_pagar ADD CONSTRAINT contas_pagar_id_tenant_key UNIQUE (id,tenant_id);

CREATE TABLE IF NOT EXISTS public.contas_pagar_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  conta_pagar_id uuid NOT NULL,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  data_pagamento date NOT NULL,
  forma_pagamento text NOT NULL CHECK (forma_pagamento IN ('PIX','TRANSFERENCIA','BOLETO','CARTAO','DINHEIRO','OUTRO')),
  referencia text,
  observacoes text,
  criado_por uuid,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'confirmado',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contas_pagar_pagamentos_id_tenant_key UNIQUE (id,tenant_id),
  CONSTRAINT contas_pagar_pagamentos_account_tenant_fkey
    FOREIGN KEY (conta_pagar_id,tenant_id) REFERENCES public.contas_pagar(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT contas_pagar_pagamentos_tenant_idempotency_key
    UNIQUE (tenant_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_pagamentos_conta_data
  ON public.contas_pagar_pagamentos(tenant_id,conta_pagar_id,data_pagamento,created_at);
ALTER TABLE public.contas_pagar_pagamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contas_pagar_pagamentos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.contas_pagar_pagamentos TO authenticated;
DROP POLICY IF EXISTS tenant_select_payable_payments ON public.contas_pagar_pagamentos;
CREATE POLICY tenant_select_payable_payments ON public.contas_pagar_pagamentos
  FOR SELECT TO authenticated
  USING (tenant_id=private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['contas_pagar']::text[]));
DROP TRIGGER IF EXISTS audit_mutation ON public.contas_pagar_pagamentos;
CREATE TRIGGER audit_mutation
AFTER INSERT OR UPDATE OR DELETE ON public.contas_pagar_pagamentos
FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();

CREATE TABLE IF NOT EXISTS public.contas_pagar_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  conta_pagar_id uuid NOT NULL,
  pagamento_id uuid,
  criado_por uuid,
  tipo text NOT NULL,
  idempotency_key text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_fingerprint text NOT NULL,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contas_pagar_operacoes_account_tenant_fkey
    FOREIGN KEY (conta_pagar_id,tenant_id) REFERENCES public.contas_pagar(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT contas_pagar_operacoes_payment_tenant_fkey
    FOREIGN KEY (pagamento_id,tenant_id) REFERENCES public.contas_pagar_pagamentos(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT contas_pagar_operacoes_tenant_idempotency_key UNIQUE (tenant_id,idempotency_key)
);
ALTER TABLE public.contas_pagar_operacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contas_pagar_operacoes FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.contas_pagar_begin(_tenant uuid,_key text,_operation text,_request jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public,private,auth,pg_temp
AS $function$
DECLARE v_old public.contas_pagar_operacoes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR _tenant IS NULL OR nullif(trim(_key),'') IS NULL OR length(_key)>180 THEN
    RAISE EXCEPTION 'Sessão e chave de operação são obrigatórias';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_tenant::text||':'||_key,0));
  SELECT * INTO v_old FROM public.contas_pagar_operacoes
  WHERE tenant_id=_tenant AND idempotency_key=_key;
  IF FOUND THEN
    IF v_old.tipo<>_operation OR v_old.dados IS DISTINCT FROM _request THEN
      RAISE EXCEPTION 'Chave de operação já usada com outros dados';
    END IF;
    RETURN v_old.resultado || jsonb_build_object('idempotent',true);
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION private.contas_pagar_begin(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.contas_pagar_finish(_tenant uuid,_account uuid,_payment uuid,_key text,_operation text,_request jsonb,_result jsonb,_actor uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path TO public,private,pg_temp
AS $function$
  INSERT INTO public.contas_pagar_operacoes(tenant_id,conta_pagar_id,pagamento_id,criado_por,idempotency_key,tipo,dados,request_fingerprint,resultado)
  VALUES (_tenant,_account,_payment,_actor,_key,_operation,_request,md5(_request::text),_result);
$function$;
REVOKE ALL ON FUNCTION private.contas_pagar_finish(uuid,uuid,uuid,text,text,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.consultar_diretorio_contas_receber(
  _busca text DEFAULT NULL,_data_fim date DEFAULT NULL,_data_inicio date DEFAULT NULL,
  _origem text DEFAULT 'todos',_pagina integer DEFAULT 1,_situacao text DEFAULT 'todos',
  _tamanho_pagina integer DEFAULT 25
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO public,pg_temp
AS $function$
DECLARE
  v_page integer:=greatest(coalesce(_pagina,1),1);
  v_size integer:=least(greatest(coalesce(_tamanho_pagina,25),1),100);
  v_result jsonb;
BEGIN
  IF coalesce(_origem,'todos') NOT IN ('todos','fatura','pdv_loja','pdv_industrial','asaas','manual')
     OR coalesce(_situacao,'todos') NOT IN ('todos','pendente','atrasado','parcial','recebido','cancelado','estornado')
     OR (_data_inicio IS NOT NULL AND _data_fim IS NOT NULL AND _data_inicio>_data_fim) THEN
    RAISE EXCEPTION 'Filtros de contas a receber inválidos';
  END IF;
  WITH base AS (
    SELECT v.id,v.origem,v.cliente_id,v.cliente_nome,v.descricao,v.valor,
      v.valor_recebido,v.data_vencimento,v.data_recebimento,
      CASE WHEN v.status IN ('pendente','parcial') AND v.data_vencimento<current_date
        THEN 'atrasado' ELSE v.status END AS status,
      v.categoria_id,v.centro_custo_id,v.created_at
    FROM public.v_contas_receber v
  ), filtered AS (
    SELECT * FROM base
    WHERE (coalesce(_origem,'todos')='todos' OR origem=_origem)
      AND (coalesce(_situacao,'todos')='todos' OR status=_situacao)
      AND (_data_inicio IS NULL OR data_vencimento>=_data_inicio)
      AND (_data_fim IS NULL OR data_vencimento<=_data_fim)
      AND (nullif(trim(_busca),'') IS NULL OR cliente_nome ILIKE '%'||trim(_busca)||'%'
        OR descricao ILIKE '%'||trim(_busca)||'%')
  ), paged AS (
    SELECT * FROM filtered ORDER BY data_vencimento DESC NULLS LAST,created_at DESC,id DESC
    OFFSET (v_page-1)*v_size LIMIT v_size
  )
  SELECT jsonb_build_object(
    'items',coalesce((SELECT jsonb_agg(to_jsonb(paged) ORDER BY data_vencimento DESC NULLS LAST,created_at DESC,id DESC) FROM paged),'[]'::jsonb),
    'total',(SELECT count(*) FROM filtered),'page',v_page,'pageSize',v_size,
    'summary',jsonb_build_object(
      'quantidade',(SELECT count(*) FROM filtered),
      'quantidade_aberta',(SELECT count(*) FROM filtered WHERE status IN ('pendente','atrasado','parcial')),
      'quantidade_recebida',(SELECT count(*) FROM filtered WHERE status='recebido'),
      'valor_aberto',(SELECT coalesce(sum(greatest(valor-valor_recebido,0)),0) FROM filtered WHERE status IN ('pendente','atrasado','parcial')),
      'valor_recebido',(SELECT coalesce(sum(valor_recebido),0) FROM filtered)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.consultar_diretorio_contas_receber(text,date,date,text,integer,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consultar_diretorio_contas_receber(text,date,date,text,integer,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.consultar_diretorio_contas_pagar(
  _busca text DEFAULT NULL,_data_fim date DEFAULT NULL,_data_inicio date DEFAULT NULL,
  _pagina integer DEFAULT 1,_situacao text DEFAULT 'todos',_tamanho_pagina integer DEFAULT 25
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO public,pg_temp
AS $function$
DECLARE
  v_tenant uuid:=private.current_tenant_id();
  v_page integer:=greatest(coalesce(_pagina,1),1);
  v_size integer:=least(greatest(coalesce(_tamanho_pagina,25),1),100);
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['contas_pagar']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para consultar contas a pagar';
  END IF;
  IF coalesce(_situacao,'todos') NOT IN ('todos','pendente','atrasado','parcial','pago','cancelado')
     OR (_data_inicio IS NOT NULL AND _data_fim IS NOT NULL AND _data_inicio>_data_fim) THEN
    RAISE EXCEPTION 'Filtros de contas a pagar inválidos';
  END IF;
  WITH base AS (
    SELECT p.id,p.descricao,p.fornecedor,p.fornecedor_id,p.valor,coalesce(p.valor_pago,0) AS valor_pago,
      p.vencimento,p.data_pagamento,
      CASE WHEN p.status='pago' OR coalesce(p.valor_pago,0)>=p.valor THEN 'pago'
        WHEN p.status='cancelado' THEN 'cancelado'
        WHEN coalesce(p.valor_pago,0)>0 THEN 'parcial' ELSE 'pendente' END AS status,
      p.categoria,p.categoria_id,p.centro_custo_id,p.observacoes,
      coalesce(p.versao,1) AS versao,p.criado_por,p.atualizado_por,p.cancelado_em,
      p.cancelado_por,p.cancelamento_motivo,p.created_at,p.updated_at,
      CASE WHEN p.status='cancelado' THEN 'cancelado'
        WHEN p.status='pago' OR coalesce(p.valor_pago,0)>=p.valor THEN 'pago'
        WHEN coalesce(p.valor_pago,0)>0 THEN 'parcial'
        WHEN p.vencimento<current_date OR p.status='vencido' THEN 'atrasado'
        ELSE 'pendente' END AS status_exibicao
    FROM public.contas_pagar p
    WHERE p.tenant_id=v_tenant
  ), filtered AS (
    SELECT * FROM base
    WHERE (coalesce(_situacao,'todos')='todos' OR status_exibicao=_situacao)
      AND (_data_inicio IS NULL OR vencimento>=_data_inicio)
      AND (_data_fim IS NULL OR vencimento<=_data_fim)
      AND (nullif(trim(_busca),'') IS NULL OR descricao ILIKE '%'||trim(_busca)||'%'
        OR coalesce(fornecedor,'') ILIKE '%'||trim(_busca)||'%'
        OR coalesce(categoria,'') ILIKE '%'||trim(_busca)||'%')
  ), paged AS (
    SELECT * FROM filtered ORDER BY vencimento ASC,created_at DESC,id DESC
    OFFSET (v_page-1)*v_size LIMIT v_size
  )
  SELECT jsonb_build_object(
    'items',coalesce((SELECT jsonb_agg(to_jsonb(paged) ORDER BY vencimento ASC,created_at DESC,id DESC) FROM paged),'[]'::jsonb),
    'total',(SELECT count(*) FROM filtered),'page',v_page,'pageSize',v_size,
    'summary',jsonb_build_object(
      'quantidade',(SELECT count(*) FROM filtered),
      'quantidade_aberta',(SELECT count(*) FROM filtered WHERE status_exibicao IN ('pendente','atrasado','parcial')),
      'quantidade_vencida',(SELECT count(*) FROM filtered WHERE status_exibicao='atrasado'),
      'valor_aberto',(SELECT coalesce(sum(greatest(valor-valor_pago,0)),0) FROM filtered WHERE status_exibicao IN ('pendente','atrasado','parcial')),
      'valor_pago',(SELECT coalesce(sum(valor_pago),0) FROM filtered WHERE status_exibicao<>'cancelado'),
      'valor_vencido',(SELECT coalesce(sum(greatest(valor-valor_pago,0)),0) FROM filtered WHERE status_exibicao='atrasado')
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.consultar_diretorio_contas_pagar(text,date,date,integer,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consultar_diretorio_contas_pagar(text,date,date,integer,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_conta_pagar(
  _conta_id uuid,_descricao text,_fornecedor text,_fornecedor_id uuid,_valor numeric,
  _vencimento date,_categoria text,_categoria_id uuid,_centro_custo_id uuid,
  _observacoes text,_versao_esperada integer,_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public,private,auth,pg_temp
AS $function$
DECLARE
  v_tenant uuid:=private.current_tenant_id();
  v_account public.contas_pagar%ROWTYPE;
  v_request jsonb:=jsonb_build_object('conta_id',_conta_id,'descricao',_descricao,
    'fornecedor',_fornecedor,'fornecedor_id',_fornecedor_id,'valor',_valor,
    'vencimento',_vencimento,'categoria',_categoria,'categoria_id',_categoria_id,
    'centro_custo_id',_centro_custo_id,'observacoes',_observacoes,
    'versao_esperada',_versao_esperada);
  v_result jsonb;
  v_status text;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['contas_pagar']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para alterar contas a pagar';
  END IF;
  IF length(trim(coalesce(_descricao,'')))=0 OR length(trim(_descricao))>240
     OR _valor IS NULL OR _valor<=0 OR _valor>999999999999.99
     OR _vencimento IS NULL OR nullif(trim(_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'Descrição, valor, vencimento e chave são obrigatórios';
  END IF;
  IF _fornecedor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.fornecedores
      WHERE id=_fornecedor_id AND tenant_id=v_tenant) THEN
    RAISE EXCEPTION 'Fornecedor não pertence à empresa ativa';
  END IF;
  IF _categoria_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.categorias_financeiras
      WHERE id=_categoria_id AND tenant_id=v_tenant) THEN
    RAISE EXCEPTION 'Categoria não pertence à empresa ativa';
  END IF;
  IF _centro_custo_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.centros_custo
      WHERE id=_centro_custo_id AND tenant_id=v_tenant) THEN
    RAISE EXCEPTION 'Centro de custo não pertence à empresa ativa';
  END IF;
  v_request:=v_request||jsonb_build_object('descricao',trim(_descricao),'valor',round(_valor,2),
    'observacoes',nullif(left(trim(coalesce(_observacoes,'')),2000),''),'idempotency_key',_idempotency_key);
  v_result:=private.contas_pagar_begin(v_tenant,_idempotency_key,'save',v_request);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  IF _conta_id IS NULL THEN
    INSERT INTO public.contas_pagar(tenant_id,descricao,fornecedor,fornecedor_id,valor,
      valor_pago,vencimento,status,categoria,categoria_id,centro_custo_id,observacoes,
      versao,criado_por,atualizado_por)
    VALUES(v_tenant,trim(_descricao),nullif(trim(coalesce(_fornecedor,'')),''),_fornecedor_id,
      round(_valor,2),0,_vencimento,'pendente',nullif(trim(coalesce(_categoria,'')),''),_categoria_id,
      _centro_custo_id,nullif(left(trim(coalesce(_observacoes,'')),2000),''),1,auth.uid(),auth.uid())
    RETURNING * INTO v_account;
    v_status:='pendente';
  ELSE
    SELECT * INTO v_account FROM public.contas_pagar
    WHERE id=_conta_id AND tenant_id=v_tenant FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conta a pagar não encontrada'; END IF;
    IF v_account.status IN ('pago','cancelado') THEN RAISE EXCEPTION 'Uma conta paga ou cancelada não pode ser editada'; END IF;
    IF _versao_esperada IS NULL OR v_account.versao IS DISTINCT FROM _versao_esperada THEN
      RAISE EXCEPTION 'Esta conta foi alterada por outro usuário. Atualize e tente novamente';
    END IF;
    IF round(_valor,2)<coalesce(v_account.valor_pago,0) THEN
      RAISE EXCEPTION 'O valor da conta não pode ficar abaixo do valor já pago';
    END IF;
    UPDATE public.contas_pagar SET descricao=trim(_descricao),
      fornecedor=nullif(trim(coalesce(_fornecedor,'')),''),fornecedor_id=_fornecedor_id,
      valor=round(_valor,2),vencimento=_vencimento,
      categoria=nullif(trim(coalesce(_categoria,'')),''),categoria_id=_categoria_id,
      centro_custo_id=_centro_custo_id,
      observacoes=nullif(left(trim(coalesce(_observacoes,'')),2000),''),
      status=CASE WHEN coalesce(valor_pago,0)>=round(_valor,2) THEN 'pago'
        WHEN coalesce(valor_pago,0)>0 THEN 'parcial' ELSE 'pendente' END,
      versao=versao+1,atualizado_por=auth.uid(),updated_at=now()
      WHERE id=_conta_id AND tenant_id=v_tenant RETURNING * INTO v_account;
    v_status:=v_account.status;
  END IF;
  v_result:=jsonb_build_object('id',v_account.id,'status',v_status,'valor',v_account.valor,
    'valorPago',v_account.valor_pago,'saldo',greatest(v_account.valor-v_account.valor_pago,0),
    'versao',v_account.versao,'idempotent',false);
  PERFORM private.contas_pagar_finish(v_tenant,v_account.id,NULL,_idempotency_key,'save',v_request,v_result,auth.uid());
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.salvar_conta_pagar(uuid,text,text,uuid,numeric,date,text,uuid,uuid,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_conta_pagar(uuid,text,text,uuid,numeric,date,text,uuid,uuid,text,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_pagamento_conta_pagar(
  _conta_id uuid,_valor numeric,_data_pagamento date,_forma_pagamento text,
  _referencia text,_observacoes text,_versao_esperada integer,_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public,private,auth,pg_temp
AS $function$
DECLARE
  v_tenant uuid:=private.current_tenant_id();
  v_account public.contas_pagar%ROWTYPE;
  v_payment public.contas_pagar_pagamentos%ROWTYPE;
  v_request jsonb:=jsonb_build_object('conta_id',_conta_id,'valor',_valor,
    'data_pagamento',_data_pagamento,'forma_pagamento',_forma_pagamento,
    'referencia',_referencia,'observacoes',_observacoes,
    'versao_esperada',_versao_esperada,'idempotency_key',_idempotency_key);
  v_result jsonb;
  v_new_paid numeric(12,2);
  v_status text;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['contas_pagar']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para registrar pagamentos';
  END IF;
  IF _conta_id IS NULL OR _valor IS NULL OR _valor<=0 OR _data_pagamento IS NULL
     OR _forma_pagamento NOT IN ('PIX','TRANSFERENCIA','BOLETO','CARTAO','DINHEIRO','OUTRO')
     OR nullif(trim(_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'Dados do pagamento inválidos';
  END IF;
  v_result:=private.contas_pagar_begin(v_tenant,_idempotency_key,'payment',v_request);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  SELECT * INTO v_account FROM public.contas_pagar
  WHERE id=_conta_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta a pagar não encontrada'; END IF;
  IF v_account.status IN ('cancelado','cancelada','pago') THEN
    RAISE EXCEPTION 'Esta conta não aceita novos pagamentos';
  END IF;
  IF _versao_esperada IS NULL OR v_account.versao IS DISTINCT FROM _versao_esperada THEN
    RAISE EXCEPTION 'Esta conta foi alterada por outro usuário. Atualize e tente novamente';
  END IF;
  IF round(_valor,2)>greatest(v_account.valor-coalesce(v_account.valor_pago,0),0) THEN
    RAISE EXCEPTION 'O pagamento excede o saldo pendente';
  END IF;
  INSERT INTO public.contas_pagar_pagamentos(tenant_id,conta_pagar_id,valor,data_pagamento,
    forma_pagamento,referencia,observacoes,criado_por,idempotency_key,request_fingerprint)
  VALUES(v_tenant,_conta_id,round(_valor,2),_data_pagamento,_forma_pagamento,
    nullif(left(trim(coalesce(_referencia,'')),160),''),nullif(left(trim(coalesce(_observacoes,'')),1000),''),
    auth.uid(),_idempotency_key,md5(v_request::text))
  RETURNING * INTO v_payment;
  v_new_paid:=coalesce(v_account.valor_pago,0)+round(_valor,2);
  v_status:=CASE WHEN v_new_paid>=v_account.valor THEN 'pago' ELSE 'parcial' END;
  UPDATE public.contas_pagar SET valor_pago=v_new_paid,status=v_status,
    data_pagamento=_data_pagamento,versao=versao+1,atualizado_por=auth.uid(),updated_at=now()
    WHERE id=_conta_id AND tenant_id=v_tenant RETURNING * INTO v_account;
  v_result:=jsonb_build_object('id',v_account.id,'status',v_status,'valor',v_account.valor,
    'valorPago',v_account.valor_pago,'saldo',greatest(v_account.valor-v_account.valor_pago,0),
    'versao',v_account.versao,'pagamentoId',v_payment.id,'idempotent',false);
  PERFORM private.contas_pagar_finish(v_tenant,v_account.id,v_payment.id,_idempotency_key,'payment',v_request,v_result,auth.uid());
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.registrar_pagamento_conta_pagar(uuid,numeric,date,text,text,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_conta_pagar(uuid,numeric,date,text,text,text,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_conta_pagar(
  _conta_id uuid,_motivo text,_versao_esperada integer,_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public,private,auth,pg_temp
AS $function$
DECLARE
  v_tenant uuid:=private.current_tenant_id();
  v_account public.contas_pagar%ROWTYPE;
  v_request jsonb:=jsonb_build_object('conta_id',_conta_id,'motivo',_motivo,
    'versao_esperada',_versao_esperada,'idempotency_key',_idempotency_key);
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['contas_pagar']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar contas a pagar';
  END IF;
  IF _conta_id IS NULL OR length(trim(coalesce(_motivo,'')))<5
     OR length(trim(coalesce(_motivo,'')))>500 OR nullif(trim(_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'Informe um motivo de cancelamento válido';
  END IF;
  v_result:=private.contas_pagar_begin(v_tenant,_idempotency_key,'cancel',v_request);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  SELECT * INTO v_account FROM public.contas_pagar
  WHERE id=_conta_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta a pagar não encontrada'; END IF;
  IF v_account.status IN ('pago','cancelado') THEN
    RAISE EXCEPTION 'Esta conta já está paga ou cancelada';
  END IF;
  IF coalesce(v_account.valor_pago,0)>0 THEN
    RAISE EXCEPTION 'Esta conta já possui pagamento. Estorne ou concilie o valor antes de cancelar';
  END IF;
  IF _versao_esperada IS NULL OR v_account.versao IS DISTINCT FROM _versao_esperada THEN
    RAISE EXCEPTION 'Esta conta foi alterada por outro usuário. Atualize e tente novamente';
  END IF;
  UPDATE public.contas_pagar SET status='cancelado',cancelado_em=now(),
    cancelado_por=auth.uid(),cancelamento_motivo=trim(_motivo),versao=versao+1,
    atualizado_por=auth.uid(),updated_at=now()
    WHERE id=_conta_id AND tenant_id=v_tenant RETURNING * INTO v_account;
  v_result:=jsonb_build_object('id',v_account.id,'status',v_account.status,
    'valor',v_account.valor,'valorPago',v_account.valor_pago,
    'saldo',CASE WHEN v_account.status='cancelado' THEN 0 ELSE greatest(v_account.valor-v_account.valor_pago,0) END,
    'versao',v_account.versao,'idempotent',false);
  PERFORM private.contas_pagar_finish(v_tenant,v_account.id,NULL,_idempotency_key,'cancel',v_request,v_result,auth.uid());
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.cancelar_conta_pagar(uuid,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancelar_conta_pagar(uuid,text,integer,text) TO authenticated;

-- Financial values now change only through the guarded RPCs; existing RLS policies stay in place.
REVOKE INSERT,UPDATE,DELETE ON TABLE public.contas_pagar FROM anon,authenticated;

