import { createHash } from 'node:crypto';
import { buildDpsId } from 'open-nfse';

const schema = 'nfse_bridge_private';
export const requestHash = (payload) => createHash('sha256').update(JSON.stringify(payload)).digest('hex');

export async function acquire(db, payload) {
  const key = `${payload.tenantId}:${payload.emitterId}:${payload.environment}:${payload.idempotencyKey}`;
  const locked = await db.query('select pg_try_advisory_lock(hashtextextended($1, 0)) as locked', [key]);
  if (!locked.rows[0].locked) throw new Error('Solicitação fiscal em processamento');
  return async () => { await db.query('select pg_advisory_unlock(hashtextextended($1, 0))', [key]); };
}

export async function findEmission(db, p) {
  const result = await db.query(`select * from ${schema}.emissions where tenant_id=$1 and emitter_id=$2 and environment=$3 and idempotency_key=$4`,
    [p.tenantId, p.emitterId, p.environment, p.idempotencyKey]);
  return result.rows[0] ?? null;
}

export async function reserve(db, payload, params) {
  await db.query('begin');
  try {
    const counter = await db.query(`insert into ${schema}.dps_counters (tenant_id,emitter_id,environment,cnpj,serie,next_number)
      values ($1,$2,$3,$4,$5,2) on conflict (tenant_id,emitter_id,environment,serie)
      do update set next_number=${schema}.dps_counters.next_number+1 returning (next_number-1)::text as number`,
      [payload.tenantId, payload.emitterId, payload.environment, params.emitente.cnpj, params.serie]);
    const number = counter.rows[0].number;
    const dpsId = buildDpsId({ cLocEmi: params.emitente.codMunicipio, tipoInsc: 'CNPJ', inscricaoFederal: params.emitente.cnpj, serie: params.serie, nDPS: number });
    const result = await db.query(`insert into ${schema}.emissions
      (tenant_id,emitter_id,environment,idempotency_key,request_hash,dps_id,dps_number,state)
      values ($1,$2,$3,$4,$5,$6,$7,'reserved') returning *`,
      [payload.tenantId, payload.emitterId, payload.environment, payload.idempotencyKey, requestHash(payload), dpsId, number]);
    await db.query('commit');
    return result.rows[0];
  } catch (error) { await db.query('rollback'); throw error; }
}

export async function saveResult(db, p, state, result = {}) {
  await db.query(`update ${schema}.emissions set state=$5,access_key=$6,number=$7,xml=$8,updated_at=now()
    where tenant_id=$1 and emitter_id=$2 and environment=$3 and idempotency_key=$4`,
    [p.tenantId,p.emitterId,p.environment,p.idempotencyKey,state,result.chaveAcesso ?? null,result.numero ?? null,result.xml ?? null]);
}
