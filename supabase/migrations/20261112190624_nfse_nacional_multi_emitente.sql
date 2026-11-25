-- NFS-e Nacional com múltiplos emitentes por tenant.
-- Versão alinhada ao histórico de migrações aplicado no ambiente de produção.
-- A emissão permanece bloqueada até cada CNPJ possuir credencial homologada
-- e o bridge fiscal seguro estar configurado no backend.

alter table public.configuracoes_fiscais
  add column if not exists provedor_nfse text not null default 'nacional',
  add column if not exists operation_type public.operation_type,
  add column if not exists credencial_status text not null default 'nao_configurada',
  add column if not exists credencial_ref text,
  add column if not exists homologado_em timestamptz,
  add column if not exists homologado_por uuid,
  add column if not exists emitir_automaticamente boolean not null default false;

alter table public.configuracoes_fiscais
  drop constraint if exists configuracoes_fiscais_provedor_nfse_check,
  add constraint configuracoes_fiscais_provedor_nfse_check
    check (provedor_nfse = 'nacional'),
  drop constraint if exists configuracoes_fiscais_credencial_status_check,
  add constraint configuracoes_fiscais_credencial_status_check
    check (credencial_status in ('nao_configurada', 'configurada', 'homologada', 'expirada', 'erro')),
  drop constraint if exists configuracoes_fiscais_cnpj_valido_check,
  add constraint configuracoes_fiscais_cnpj_valido_check
    check (cnpj is null or length(regexp_replace(cnpj, '\D', '', 'g')) = 14),
  drop constraint if exists configuracoes_fiscais_credencial_ref_check,
  add constraint configuracoes_fiscais_credencial_ref_check
    check (credencial_ref is null or credencial_ref ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{2,99}$'),
  drop constraint if exists configuracoes_fiscais_homologacao_check,
  add constraint configuracoes_fiscais_homologacao_check
    check (
      credencial_status <> 'homologada'
      or (credencial_ref is not null and homologado_em is not null)
    );

create unique index if not exists configuracoes_fiscais_tenant_cnpj_uidx
  on public.configuracoes_fiscais (tenant_id, regexp_replace(cnpj, '\D', '', 'g'))
  where cnpj is not null;

create unique index if not exists configuracoes_fiscais_default_operation_uidx
  on public.configuracoes_fiscais (tenant_id, operation_type)
  where ativo and operation_type is not null;

alter table public.faturas
  add column if not exists configuracao_fiscal_id uuid,
  add column if not exists nfse_status text not null default 'nao_preparada';

alter table public.faturas
  drop constraint if exists faturas_nfse_status_check,
  add constraint faturas_nfse_status_check check (
    nfse_status in (
      'nao_preparada', 'validada', 'aguardando_configuracao', 'processando',
      'autorizada', 'rejeitada', 'erro_temporario', 'cancelada'
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'faturas_configuracao_fiscal_tenant_fkey'
  ) then
    alter table public.faturas
      add constraint faturas_configuracao_fiscal_tenant_fkey
      foreign key (configuracao_fiscal_id, tenant_id)
      references public.configuracoes_fiscais (id, tenant_id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists faturas_tenant_configuracao_fiscal_idx
  on public.faturas (tenant_id, configuracao_fiscal_id)
  where configuracao_fiscal_id is not null;

create table if not exists public.nfse_documentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  fatura_id uuid not null,
  configuracao_fiscal_id uuid not null,
  provedor text not null default 'nacional',
  ambiente text not null,
  status text not null default 'validada',
  idempotency_key text not null,
  request_fingerprint text not null,
  numero text,
  chave_acesso text,
  protocolo text,
  xml_storage_path text,
  danfse_storage_path text,
  payload_resumo jsonb not null default '{}'::jsonb,
  erros jsonb not null default '[]'::jsonb,
  tentativas integer not null default 0,
  solicitado_em timestamptz,
  autorizado_em timestamptz,
  cancelado_em timestamptz,
  cancelamento_motivo text,
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nfse_documentos_provedor_check check (provedor = 'nacional'),
  constraint nfse_documentos_ambiente_check check (ambiente in ('homologacao', 'producao')),
  constraint nfse_documentos_status_check check (status in (
    'validada', 'aguardando_configuracao', 'processando', 'autorizada',
    'rejeitada', 'erro_temporario', 'cancelada'
  )),
  constraint nfse_documentos_tentativas_check check (tentativas >= 0),
  constraint nfse_documentos_cancelamento_check check (
    status <> 'cancelada' or (cancelado_em is not null and length(trim(cancelamento_motivo)) between 15 and 500)
  ),
  constraint nfse_documentos_fatura_tenant_fkey
    foreign key (fatura_id, tenant_id) references public.faturas (id, tenant_id) on delete restrict,
  constraint nfse_documentos_config_tenant_fkey
    foreign key (configuracao_fiscal_id, tenant_id)
    references public.configuracoes_fiscais (id, tenant_id) on delete restrict,
  constraint nfse_documentos_tenant_fatura_key unique (tenant_id, fatura_id),
  constraint nfse_documentos_tenant_idempotency_key unique (tenant_id, idempotency_key)
);

create index if not exists nfse_documentos_tenant_status_idx
  on public.nfse_documentos (tenant_id, status, updated_at desc);
create index if not exists nfse_documentos_config_idx
  on public.nfse_documentos (tenant_id, configuracao_fiscal_id, created_at desc);

alter table public.nfse_documentos enable row level security;
revoke all on table public.nfse_documentos from public, anon, authenticated;
grant select on table public.nfse_documentos to authenticated;
grant all on table public.nfse_documentos to service_role;

drop policy if exists nfse_documentos_tenant_select on public.nfse_documentos;
create policy nfse_documentos_tenant_select
  on public.nfse_documentos for select to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and (select private.has_any_module_access(array['faturamento']::text[]))
    and exists (
      select 1 from public.faturas f
      where f.id = nfse_documentos.fatura_id
        and f.tenant_id = nfse_documentos.tenant_id
        and private.can_access_client(f.cliente_id)
    )
  );

create or replace function private.nfse_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists nfse_documentos_touch_updated_at on public.nfse_documentos;
create trigger nfse_documentos_touch_updated_at
before update on public.nfse_documentos
for each row execute function private.nfse_touch_updated_at();

create or replace function private.assign_fatura_fiscal_context()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
  v_fatura uuid;
  v_cliente uuid;
  v_operation public.operation_type;
  v_config uuid;
  v_default_count integer;
begin
  select l.tenant_id, l.fatura_id, os.cliente_id,
    case when lower(coalesce(os.origem, 'industrial')) in ('residencial', 'loja')
      then 'domestico'::public.operation_type else 'industrial'::public.operation_type end
  into v_tenant, v_fatura, v_cliente, v_operation
  from public.lancamentos l
  join public.ordens_servico os on os.id = l.ordem_servico_id and os.tenant_id = l.tenant_id
  where l.id = new.lancamento_id and l.tenant_id = new.tenant_id;

  if v_fatura is null or v_fatura <> new.fatura_id then
    return new;
  end if;

  select cnpj_emissor_id into v_config
  from public.configuracoes_pagamento_cliente
  where tenant_id = v_tenant and cliente_id = v_cliente;

  if v_config is null then
    select count(*), (array_agg(id order by id))[1] into v_default_count, v_config
    from public.configuracoes_fiscais
    where tenant_id = v_tenant and ativo and operation_type = v_operation;
    if v_default_count <> 1 then v_config := null; end if;
  end if;

  update public.faturas f
  set operation_type = coalesce(f.operation_type, v_operation),
      configuracao_fiscal_id = coalesce(f.configuracao_fiscal_id, v_config)
  where f.id = v_fatura and f.tenant_id = v_tenant
    and (f.operation_type is null or f.operation_type = v_operation);

  return new;
end;
$$;

drop trigger if exists assign_fatura_fiscal_context_after_link on public.lancamentos_fatura;
create trigger assign_fatura_fiscal_context_after_link
after insert on public.lancamentos_fatura
for each row execute function private.assign_fatura_fiscal_context();

create or replace function public.get_fiscal_configs_for_operations()
returns jsonb language sql stable security definer
set search_path = 'public', 'private', 'auth', 'pg_temp' as $$
  select case
    when auth.uid() is null
      or not private.has_any_module_access(array['clientes', 'faturamento']) then '[]'::jsonb
    else coalesce(jsonb_agg(jsonb_build_object(
      'id', config.id,
      'nome', config.nome,
      'cnpj', config.cnpj,
      'razao_social', config.razao_social,
      'inscricao_municipal', config.inscricao_municipal,
      'inscricao_estadual', config.inscricao_estadual,
      'endereco', config.endereco,
      'aliquota_iss', config.aliquota_iss,
      'codigo_servico', config.codigo_servico,
      'ambiente', config.ambiente,
      'ativo', config.ativo,
      'validade_certificado', config.validade_certificado,
      'regime_tributario', config.regime_tributario,
      'codigo_municipio_ibge', config.codigo_municipio_ibge,
      'modo_emissao', config.modo_emissao,
      'provedor_nfse', config.provedor_nfse,
      'operation_type', config.operation_type,
      'credencial_status', config.credencial_status,
      'homologado_em', config.homologado_em,
      'emitir_automaticamente', config.emitir_automaticamente,
      'created_at', config.created_at,
      'updated_at', config.updated_at
    ) order by config.nome), '[]'::jsonb)
  end
  from public.configuracoes_fiscais config
  where config.tenant_id = private.current_tenant_id()
$$;

revoke all on function public.get_fiscal_configs_for_operations() from public, anon;
grant execute on function public.get_fiscal_configs_for_operations() to authenticated;

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
     or length(regexp_replace(coalesce(v_config.cnpj, ''), '\D', '', 'g')) <> 14
     or nullif(trim(coalesce(v_config.razao_social, '')), '') is null
     or nullif(trim(coalesce(v_config.inscricao_municipal, '')), '') is null
     or coalesce(v_config.codigo_municipio_ibge, '') !~ '^\d{7}$'
     or nullif(trim(coalesce(v_config.codigo_servico, '')), '') is null then
    raise exception 'Complete CNPJ, razão social, inscrição municipal, município IBGE e código de serviço do emitente';
  end if;

  v_documento := regexp_replace(coalesce(v_cliente.cpf_cnpj, ''), '\D', '', 'g');
  if length(v_documento) not in (11, 14) then
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
      'cnpjFinal', right(regexp_replace(v_config.cnpj, '\D', '', 'g'), 4),
      'credencialStatus', v_config.credencial_status, 'modoEmissao', v_config.modo_emissao,
      'operationType', v_config.operation_type)
  );
end;
$$;

revoke all on function public.preparar_documento_nfse(uuid,uuid,text,text) from public, anon;
grant execute on function public.preparar_documento_nfse(uuid,uuid,text,text) to authenticated;

create or replace function public.registrar_nfse_autorizada(
  _tenant_id uuid, _fatura_id uuid, _configuracao_fiscal_id uuid,
  _idempotency_key text, _numero text, _chave_acesso text, _protocolo text,
  _xml_storage_path text, _danfse_storage_path text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.nfse_documentos%rowtype;
  v_fatura public.faturas%rowtype;
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'Operação interna não autorizada';
  end if;
  if nullif(trim(coalesce(_numero, '')), '') is null
     or nullif(trim(coalesce(_chave_acesso, '')), '') is null then
    raise exception 'Retorno fiscal sem número ou chave de acesso';
  end if;
  select * into v_doc from public.nfse_documentos
  where tenant_id = _tenant_id and fatura_id = _fatura_id
    and configuracao_fiscal_id = _configuracao_fiscal_id
    and idempotency_key = _idempotency_key for update;
  if not found then raise exception 'Documento fiscal não encontrado'; end if;
  if v_doc.status = 'autorizada' then
    return jsonb_build_object('id', v_doc.id, 'status', v_doc.status, 'numero', v_doc.numero,
      'chaveAcesso', v_doc.chave_acesso, 'idempotent', true);
  end if;
  if v_doc.status = 'cancelada' then raise exception 'Documento fiscal já cancelado'; end if;

  update public.nfse_documentos set
    status = 'autorizada', numero = trim(_numero), chave_acesso = trim(_chave_acesso),
    protocolo = nullif(trim(coalesce(_protocolo, '')), ''),
    xml_storage_path = nullif(trim(coalesce(_xml_storage_path, '')), ''),
    danfse_storage_path = nullif(trim(coalesce(_danfse_storage_path, '')), ''),
    autorizado_em = now(), erros = '[]'::jsonb, atualizado_por = criado_por
  where id = v_doc.id returning * into v_doc;

  update public.faturas set
    numero_nf = v_doc.numero, chave_acesso = v_doc.chave_acesso,
    protocolo_nfse = v_doc.protocolo, data_emissao_nf = v_doc.autorizado_em,
    nfse_status = 'autorizada', status_sefaz = 'autorizada', erros_sefaz = '[]'::jsonb,
    status = case when status = 'relatorio_gerado' then 'nota_emitida' else status end,
    updated_at = now()
  where id = _fatura_id and tenant_id = _tenant_id returning * into v_fatura;
  if not found then raise exception 'Fatura fiscal não encontrada'; end if;

  insert into public.audit_events (
    tenant_id, actor_id, action, entity_schema, entity_table, entity_id, new_data,
    unidade_id, operation_type
  ) values (
    _tenant_id, v_doc.criado_por, 'nfse.autorizada', 'public', 'nfse_documentos', v_doc.id::text,
    jsonb_build_object('fatura_id', _fatura_id, 'numero', v_doc.numero,
      'chave_final', right(v_doc.chave_acesso, 8)),
    v_fatura.unidade_id, v_fatura.operation_type
  );
  return jsonb_build_object('id', v_doc.id, 'status', v_doc.status,
    'numero', v_doc.numero, 'chaveAcesso', v_doc.chave_acesso, 'idempotent', false);
end;
$$;

revoke all on function public.registrar_nfse_autorizada(uuid,uuid,uuid,text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.registrar_nfse_autorizada(uuid,uuid,uuid,text,text,text,text,text,text)
  to service_role;

create or replace function public.registrar_nfse_cancelada(
  _tenant_id uuid, _fatura_id uuid, _motivo text, _protocolo text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.nfse_documentos%rowtype;
  v_fatura public.faturas%rowtype;
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'Operação interna não autorizada';
  end if;
  if length(trim(coalesce(_motivo, ''))) not between 15 and 500 then
    raise exception 'Justificativa deve ter entre 15 e 500 caracteres';
  end if;
  select * into v_doc from public.nfse_documentos
  where tenant_id = _tenant_id and fatura_id = _fatura_id for update;
  if not found or v_doc.status <> 'autorizada' then
    raise exception 'Somente NFS-e autorizada pode ser cancelada';
  end if;
  update public.nfse_documentos set
    status = 'cancelada', cancelado_em = now(), cancelamento_motivo = trim(_motivo),
    protocolo = coalesce(nullif(trim(coalesce(_protocolo, '')), ''), protocolo)
  where id = v_doc.id returning * into v_doc;
  update public.faturas set
    nfse_status = 'cancelada', status_sefaz = 'cancelada',
    status = case when status = 'nota_emitida' then 'relatorio_gerado' else status end,
    updated_at = now()
  where id = _fatura_id and tenant_id = _tenant_id returning * into v_fatura;
  insert into public.audit_events (
    tenant_id, actor_id, action, entity_schema, entity_table, entity_id, new_data,
    unidade_id, operation_type
  ) values (
    _tenant_id, v_doc.criado_por, 'nfse.cancelada', 'public', 'nfse_documentos', v_doc.id::text,
    jsonb_build_object('fatura_id', _fatura_id, 'motivo', trim(_motivo)),
    v_fatura.unidade_id, v_fatura.operation_type
  );
  return jsonb_build_object('id', v_doc.id, 'status', v_doc.status, 'numero', v_doc.numero);
end;
$$;

revoke all on function public.registrar_nfse_cancelada(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.registrar_nfse_cancelada(uuid,uuid,text,text) to service_role;

create or replace function public.consultar_faturas_faturamento_periodo(
  _area text, _inicio date, _fim date, _pagina integer default 1, _tamanho integer default 25
) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_result jsonb;
begin
  if auth.uid() is null or v_tenant is null
     or _area not in ('central', 'industrial', 'residencial')
     or not private.can_access_area(_area)
     or not private.has_any_module_access(array['faturamento']::text[]) then
    raise exception 'Sem permissão para consultar as faturas';
  end if;
  if _inicio is null or _fim is null or _fim < _inicio or _fim > _inicio + 366 then
    raise exception 'Informe um período válido de até 366 dias';
  end if;
  if _pagina < 1 or _tamanho < 1 or _tamanho > 100 then
    raise exception 'Paginação inválida';
  end if;
  with filtradas as (
    select f.id, f.cliente_id, f.periodo_inicio, f.periodo_fim, f.valor_total,
      f.status, f.tipo_relatorio, f.itens_snapshot, f.numero_nf, f.link_pdf_nf,
      f.protocolo_nfse, f.asaas_charge_id, f.boleto_url, f.boleto_linha_digitavel,
      f.forma_pagamento, f.data_vencimento, f.data_envio, f.created_at,
      f.configuracao_fiscal_id, f.nfse_status, f.operation_type,
      case when d.id is null then null else jsonb_build_object(
        'id', d.id, 'status', d.status, 'ambiente', d.ambiente,
        'numero', d.numero, 'chave_acesso', d.chave_acesso,
        'protocolo', d.protocolo, 'tentativas', d.tentativas,
        'autorizado_em', d.autorizado_em, 'cancelado_em', d.cancelado_em,
        'erros', d.erros
      ) end as nfse,
      case when cf.id is null then null else jsonb_build_object(
        'id', cf.id, 'nome', cf.nome, 'cnpj_final', right(regexp_replace(cf.cnpj, '\D', '', 'g'), 4),
        'ambiente', cf.ambiente, 'credencial_status', cf.credencial_status,
        'operation_type', cf.operation_type
      ) end as emitente,
      jsonb_build_object('razao_social', c.razao_social, 'cpf_cnpj', c.cpf_cnpj,
        'email', c.email, 'telefone', c.telefone, 'classificacao', c.classificacao) as cliente
    from public.faturas f
    join public.clientes c on c.id = f.cliente_id and c.tenant_id = f.tenant_id
    left join public.nfse_documentos d on d.fatura_id = f.id and d.tenant_id = f.tenant_id
    left join public.configuracoes_fiscais cf on cf.id = f.configuracao_fiscal_id and cf.tenant_id = f.tenant_id
    where f.tenant_id = v_tenant
      and f.periodo_inicio <= _fim and f.periodo_fim >= _inicio
      and (_area = 'central' or exists (
        select 1 from public.lancamentos l
        join public.ordens_servico os on os.id = l.ordem_servico_id and os.tenant_id = l.tenant_id
        where l.fatura_id = f.id and l.tenant_id = v_tenant
          and case when lower(coalesce(os.origem, 'industrial')) in ('residencial', 'loja')
            then 'residencial' else 'industrial' end = _area
      ))
  ), pagina as (
    select * from filtradas order by created_at desc, id desc
    limit _tamanho offset (_pagina - 1) * _tamanho
  )
  select jsonb_build_object(
    'total', (select count(*) from filtradas),
    'items', coalesce((select jsonb_agg(to_jsonb(pagina) order by created_at desc, id desc)
      from pagina), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.consultar_faturas_faturamento_periodo(text,date,date,integer,integer)
  from public, anon;
grant execute on function public.consultar_faturas_faturamento_periodo(text,date,date,integer,integer)
  to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fiscal-documentos', 'fiscal-documentos', false, 10485760,
  array['application/xml', 'text/xml', 'application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
