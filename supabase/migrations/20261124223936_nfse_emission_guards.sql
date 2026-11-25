-- CNPJ alfanumérico: preserva os caracteres e mantém unicidade por empresa.
alter table public.configuracoes_fiscais drop constraint if exists configuracoes_fiscais_cnpj_valido_check;
alter table public.configuracoes_fiscais add constraint configuracoes_fiscais_cnpj_valido_check
  check (cnpj is null or regexp_replace(upper(cnpj), '[./-]', '', 'g') ~ '^[A-Z0-9]{12}[0-9]{2}$');
drop index if exists public.configuracoes_fiscais_tenant_cnpj_uidx;
create unique index configuracoes_fiscais_tenant_cnpj_uidx on public.configuracoes_fiscais
  (tenant_id, regexp_replace(upper(cnpj), '[./-]', '', 'g')) where cnpj is not null;

-- Preserva o estado de emissão e impede a reescrita de dados fiscais concluídos.
create or replace function public.preparar_documento_nfse(
  _fatura_id uuid,
  _configuracao_fiscal_id uuid default null,
  _descricao_servico text default null,
  _natureza_operacao text default 'tributacao_municipio'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_fatura public.faturas%rowtype;
  v_cliente public.clientes%rowtype;
  v_config public.configuracoes_fiscais%rowtype;
  v_config_id uuid;
  v_cliente_config uuid;
  v_config_count integer;
  v_endereco jsonb := '{}'::jsonb;
  v_snapshot_cliente jsonb;
  v_snapshot_emitente jsonb;
  v_descricao text;
  v_fingerprint text;
  v_doc public.nfse_documentos%rowtype;
  v_documento text;
begin
  if auth.uid() is null or v_tenant is null
     or not private.has_any_module_access(array['faturamento']::text[]) then
    raise exception 'Sem permissão para preparar NFS-e';
  end if;
  if _fatura_id is null then raise exception 'Fatura obrigatória'; end if;
  if _natureza_operacao not in ('tributacao_municipio', 'tributacao_fora', 'isencao', 'imune', 'suspensa_judicial', 'suspensa_administrativa') then
    raise exception 'Natureza da operação inválida';
  end if;
  if length(coalesce(_descricao_servico, '')) > 2000 then
    raise exception 'Descrição do serviço muito longa';
  end if;

  select * into v_fatura from public.faturas
  where id = _fatura_id and tenant_id = v_tenant for update;
  if not found or not private.can_access_client(v_fatura.cliente_id) then
    raise exception 'Fatura indisponível';
  end if;
  if v_fatura.status = 'cancelado' or v_fatura.valor_total <= 0
     or coalesce(jsonb_array_length(v_fatura.itens_snapshot), 0) = 0 then
    raise exception 'Fatura sem dados válidos para emissão fiscal';
  end if;

  select * into v_cliente from public.clientes
  where id = v_fatura.cliente_id and tenant_id = v_tenant and ativo;
  if not found then raise exception 'Cliente indisponível'; end if;

  select cnpj_emissor_id into v_cliente_config
  from public.configuracoes_pagamento_cliente
  where tenant_id = v_tenant and cliente_id = v_fatura.cliente_id;

  v_config_id := coalesce(_configuracao_fiscal_id, v_fatura.configuracao_fiscal_id, v_cliente_config);
  if v_config_id is null and v_fatura.operation_type is not null then
    select count(*), (array_agg(id order by id))[1] into v_config_count, v_config_id
    from public.configuracoes_fiscais
    where tenant_id = v_tenant and ativo and operation_type = v_fatura.operation_type;
    if v_config_count <> 1 then v_config_id := null; end if;
  end if;
  if v_config_id is null then
    select count(*), (array_agg(id order by id))[1] into v_config_count, v_config_id
    from public.configuracoes_fiscais where tenant_id = v_tenant and ativo;
    if v_config_count <> 1 then v_config_id := null; end if;
  end if;
  if v_config_id is null then
    raise exception 'Selecione o CNPJ emissor desta fatura';
  end if;

  select * into v_config from public.configuracoes_fiscais
  where id = v_config_id and tenant_id = v_tenant and ativo;
  if not found then raise exception 'CNPJ emissor inativo ou indisponível'; end if;
  if v_config.provedor_nfse <> 'nacional'
     or regexp_replace(upper(coalesce(v_config.cnpj, '')), '[./-]', '', 'g') !~ '^[A-Z0-9]{12}[0-9]{2}$'
     or nullif(trim(coalesce(v_config.razao_social, '')), '') is null
     or nullif(trim(coalesce(v_config.inscricao_municipal, '')), '') is null
     or coalesce(v_config.codigo_municipio_ibge, '') !~ '^\d{7}$'
     or nullif(trim(coalesce(v_config.codigo_servico, '')), '') is null then
    raise exception 'Complete CNPJ, razão social, inscrição municipal, município IBGE e código de serviço do emitente';
  end if;

  v_documento := regexp_replace(upper(coalesce(v_cliente.cpf_cnpj, '')), '[./-]', '', 'g');
  if v_documento !~ '^[0-9]{11}$' and v_documento !~ '^[A-Z0-9]{12}[0-9]{2}$' then
    raise exception 'CPF/CNPJ do tomador inválido ou ausente';
  end if;
  select jsonb_build_object(
    'logradouro', e.logradouro, 'numero', e.numero, 'complemento', e.complemento,
    'bairro', e.bairro, 'cidade', e.cidade, 'uf', e.uf, 'cep', e.cep
  ) into v_endereco
  from public.enderecos_clientes e
  where e.tenant_id = v_tenant and e.cliente_id = v_cliente.id and e.ativo
  order by e.principal desc, e.updated_at desc limit 1;
  if v_endereco is null
     or nullif(trim(coalesce(v_endereco->>'logradouro', '')), '') is null
     or nullif(trim(coalesce(v_endereco->>'numero', '')), '') is null
     or nullif(trim(coalesce(v_endereco->>'cidade', '')), '') is null
     or coalesce(v_endereco->>'uf', '') !~ '^[A-Za-z]{2}$'
     or length(regexp_replace(coalesce(v_endereco->>'cep', ''), '\D', '', 'g')) <> 8 then
    raise exception 'Complete o endereço fiscal do tomador';
  end if;

  select * into v_doc from public.nfse_documentos
  where tenant_id = v_tenant and fatura_id = v_fatura.id for update;
  if found and v_doc.status in ('processando', 'erro_temporario') then
    raise exception 'NFS-e em processamento ou com resultado incerto. Consulte a situação oficial antes de qualquer nova tentativa';
  end if;
  if found and v_doc.status in ('autorizada', 'cancelada') then
    if v_doc.configuracao_fiscal_id <> v_config.id then
      raise exception 'O CNPJ emissor não pode ser trocado após a autorização da NFS-e';
    end if;
    return jsonb_build_object('id', v_doc.id, 'faturaId', v_doc.fatura_id,
      'configuracaoFiscalId', v_doc.configuracao_fiscal_id, 'status', v_doc.status,
      'ambiente', v_doc.ambiente, 'idempotencyKey', v_doc.idempotency_key,
      'requestFingerprint', v_doc.request_fingerprint);
  end if;
  if found and v_doc.status in ('autorizada', 'cancelada')
     and v_doc.configuracao_fiscal_id <> v_config.id then
    raise exception 'O CNPJ emissor não pode ser trocado após a autorização da NFS-e';
  end if;

  v_descricao := left(coalesce(nullif(trim(coalesce(_descricao_servico, '')), ''),
    'Serviços de lavanderia referentes ao período de ' ||
    to_char(v_fatura.periodo_inicio, 'DD/MM/YYYY') || ' a ' ||
    to_char(v_fatura.periodo_fim, 'DD/MM/YYYY')), 2000);
  v_snapshot_cliente := jsonb_build_object(
    'id', v_cliente.id, 'razao_social', v_cliente.razao_social,
    'nome_fantasia', v_cliente.nome_fantasia, 'cpf_cnpj', v_cliente.cpf_cnpj,
    'email', v_cliente.email, 'telefone', v_cliente.telefone,
    'inscricao_municipal', v_cliente.inscricao_municipal,
    'inscricao_estadual', v_cliente.inscricao_estadual,
    'regime_tributario', v_cliente.regime_tributario, 'endereco', v_endereco
  );
  v_snapshot_emitente := jsonb_build_object(
    'id', v_config.id, 'nome', v_config.nome, 'razao_social', v_config.razao_social,
    'cnpj', v_config.cnpj, 'inscricao_municipal', v_config.inscricao_municipal,
    'inscricao_estadual', v_config.inscricao_estadual, 'endereco', v_config.endereco,
    'codigo_municipio_ibge', v_config.codigo_municipio_ibge,
    'codigo_servico', v_config.codigo_servico, 'aliquota_iss', v_config.aliquota_iss,
    'regime_tributario', v_config.regime_tributario,
    'provedor_nfse', v_config.provedor_nfse, 'ambiente', v_config.ambiente
  );
  v_fingerprint := md5(jsonb_build_object(
    'fatura_id', v_fatura.id, 'emitente', v_snapshot_emitente,
    'tomador', v_snapshot_cliente, 'itens', v_fatura.itens_snapshot,
    'valor', v_fatura.valor_total, 'descricao', v_descricao,
    'natureza', _natureza_operacao
  )::text);

  update public.faturas set
    configuracao_fiscal_id = v_config.id,
    snapshot_cliente = v_snapshot_cliente,
    snapshot_emitente = v_snapshot_emitente,
    descricao_servico = v_descricao,
    natureza_operacao = _natureza_operacao,
    nfse_status = case when nfse_status in ('autorizada', 'cancelada') then nfse_status else 'validada' end,
    status_sefaz = case when nfse_status in ('autorizada', 'cancelada') then status_sefaz else 'validada' end,
    updated_at = now()
  where id = v_fatura.id and tenant_id = v_tenant;

  insert into public.nfse_documentos (
    tenant_id, fatura_id, configuracao_fiscal_id, ambiente, status,
    idempotency_key, request_fingerprint, payload_resumo, criado_por, atualizado_por
  ) values (
    v_tenant, v_fatura.id, v_config.id, coalesce(v_config.ambiente, 'homologacao'), 'validada',
    'nfse:fatura:' || v_fatura.id::text, v_fingerprint,
    jsonb_build_object('valor_total', v_fatura.valor_total, 'periodo_inicio', v_fatura.periodo_inicio,
      'periodo_fim', v_fatura.periodo_fim, 'quantidade_itens', jsonb_array_length(v_fatura.itens_snapshot)),
    auth.uid(), auth.uid()
  ) on conflict (tenant_id, fatura_id) do update set
    configuracao_fiscal_id = excluded.configuracao_fiscal_id,
    ambiente = excluded.ambiente,
    status = case when public.nfse_documentos.status in ('autorizada', 'cancelada')
      then public.nfse_documentos.status else 'validada' end,
    request_fingerprint = excluded.request_fingerprint,
    payload_resumo = excluded.payload_resumo,
    erros = case when public.nfse_documentos.status in ('autorizada', 'cancelada')
      then public.nfse_documentos.erros else '[]'::jsonb end,
    atualizado_por = auth.uid()
  returning * into v_doc;

  insert into public.audit_events (
    tenant_id, actor_id, action, entity_schema, entity_table, entity_id,
    new_data, unidade_id, operation_type
  ) values (
    v_tenant, auth.uid(), 'nfse.preparada', 'public', 'nfse_documentos', v_doc.id::text,
    jsonb_build_object('fatura_id', v_fatura.id, 'configuracao_fiscal_id', v_config.id,
      'status', v_doc.status, 'ambiente', v_doc.ambiente),
    v_fatura.unidade_id, v_fatura.operation_type
  );

  return jsonb_build_object(
    'id', v_doc.id, 'faturaId', v_doc.fatura_id, 'configuracaoFiscalId', v_config.id,
    'status', v_doc.status, 'ambiente', v_doc.ambiente,
    'idempotencyKey', v_doc.idempotency_key, 'requestFingerprint', v_doc.request_fingerprint,
    'emitente', jsonb_build_object('nome', v_config.nome, 'razaoSocial', v_config.razao_social,
      'cnpjFinal', right(regexp_replace(upper(v_config.cnpj), '[./-]', '', 'g'), 4),
      'credencialStatus', v_config.credencial_status, 'modoEmissao', v_config.modo_emissao,
      'operationType', v_config.operation_type)
  );
end;
$$;

revoke all on function public.preparar_documento_nfse(uuid,uuid,text,text) from public, anon;
grant execute on function public.preparar_documento_nfse(uuid,uuid,text,text) to authenticated;

