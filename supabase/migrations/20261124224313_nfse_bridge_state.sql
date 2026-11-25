-- Estado interno do bridge fiscal. A aplicação web não recebe acesso.
create schema if not exists nfse_bridge_private;
revoke all on schema nfse_bridge_private from public, anon, authenticated;
grant usage on schema nfse_bridge_private to service_role;

create table nfse_bridge_private.dps_counters (
  tenant_id uuid not null,
  emitter_id uuid not null,
  environment text not null check (environment in ('homologacao', 'producao')),
  cnpj text not null check (cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
  serie text not null,
  next_number bigint not null check (next_number between 1 and 999999999999999),
  primary key (tenant_id, emitter_id, environment, serie)
);

create table nfse_bridge_private.emissions (
  tenant_id uuid not null,
  emitter_id uuid not null,
  environment text not null check (environment in ('homologacao', 'producao')),
  idempotency_key text not null,
  request_hash text not null,
  dps_id text not null,
  dps_number text not null,
  state text not null check (state in ('reserved', 'authorized', 'rejected', 'uncertain')),
  access_key text,
  number text,
  xml text,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, emitter_id, environment, idempotency_key),
  unique (tenant_id, emitter_id, environment, dps_id)
);
create table nfse_bridge_private.events (
  tenant_id uuid not null,
  emitter_id uuid not null,
  environment text not null check (environment in ('homologacao', 'producao')),
  idempotency_key text not null,
  request_hash text not null,
  access_key text not null,
  state text not null check (state in ('reserved', 'accepted', 'rejected', 'uncertain')),
  xml text,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, emitter_id, environment, idempotency_key)
);
revoke all on all tables in schema nfse_bridge_private from public, anon, authenticated;
grant select, insert, update on all tables in schema nfse_bridge_private to service_role;
