import { Ambiente, TipoAmbiente, JustificativaCancelamento, NfseClient, ReceitaRejectionError, validateCnpj } from 'open-nfse';
import { buildParameters } from './parameters.js';
import { acquire, findEmission, requestHash, reserve, saveResult } from './repository.js';

export function authorizedResult(result, cnpj) {
  const numero = result?.nfse?.infNFSe?.nNFSe;
  if (!/^[0-9]{6}[A-Z0-9]{14}[0-9]{30}$/.test(result?.chaveAcesso || '')
    || result.chaveAcesso.slice(6, 20) !== cnpj || result.tipoAmbiente !== TipoAmbiente.Homologacao
    || !result.xmlNfse || !numero) throw new Error('Resposta fiscal incompleta ou incompatível');
  return { status: 'autorizada', chaveAcesso: result.chaveAcesso, numero: String(numero), xml: result.xmlNfse };
}

export async function issue(payload, profile, pool, certificate, makeClient = (cert) => new NfseClient({ ambiente: Ambiente.ProducaoRestrita, certificado: cert, timeoutMs: 20000 })) {
  const params = buildParameters(payload, profile);
  const db = await pool.connect();
  let unlock;
  const client = makeClient(certificate);
  try {
    unlock = await acquire(db, payload);
    const existing = await findEmission(db, payload);
    if (existing) {
      if (existing.request_hash !== requestHash(payload)) throw new Error('A fatura já possui solicitação com outros dados; revise a situação fiscal');
      if (existing.state === 'authorized') return { status: 'autorizada', numero: existing.number, chaveAcesso: existing.access_key, xml: existing.xml };
      if (existing.state === 'rejected') return { status: 'rejeitada', message: 'DPS rejeitada; revise a situação fiscal antes de nova tentativa' };
      return { status: 'incerto', message: 'DPS já reservada; consulte a situação oficial antes de reenviar' };
    }
    // XSD e assinatura são verificados antes de reservar número. O dry-run não envia.
    await client.emitir({ ...params, dryRun: true });
    const reserved = await reserve(db, payload, params);
    try {
      const result = await client.emitir({ ...params, nDPS: reserved.dps_number });
      if (result.status !== 'ok') {
        await saveResult(db, payload, 'uncertain');
        return { status: 'incerto', message: 'Resposta fiscal pendente; consulte a situação oficial' };
      }
      if (result.nfse.idDps !== reserved.dps_id) throw new Error('Identificador da DPS divergente');
      const authorized = authorizedResult(result.nfse, params.emitente.cnpj);
      await saveResult(db, payload, 'authorized', authorized);
      return authorized;
    } catch (error) {
      if (error instanceof ReceitaRejectionError) {
        await saveResult(db, payload, 'rejected');
        return { status: 'rejeitada', message: error.message };
      }
      await saveResult(db, payload, 'uncertain');
      return { status: 'incerto', message: 'Resultado fiscal incerto; consulte a situação oficial antes de reenviar' };
    }
  } finally {
    try { if (unlock) await unlock(); } finally { db.release(); client.close(); }
  }
}

export async function reconcile(payload, profile, pool, certificate, makeClient = (cert) => new NfseClient({ ambiente: Ambiente.ProducaoRestrita, certificado: cert, timeoutMs: 20000 })) {
  buildParameters(payload, profile);
  const db = await pool.connect();
  let unlock;
  const client = makeClient(certificate);
  try {
    unlock = await acquire(db, payload);
    const row = await findEmission(db, payload);
    if (!row || row.request_hash !== requestHash(payload)) throw new Error('Solicitação fiscal não localizada');
    if (row.state === 'authorized') return { status: 'autorizada', numero: row.number, chaveAcesso: row.access_key, xml: row.xml };
    if (row.state === 'rejected') return { status: 'rejeitada', message: 'DPS rejeitada; revise os dados fiscais' };
    try {
      const status = await client.fetchDpsStatus(row.dps_id);
      if (status.idDps !== row.dps_id || status.tipoAmbiente !== TipoAmbiente.Homologacao) throw new Error('Consulta de DPS divergente');
      const result = await client.fetchByChave(status.chaveAcesso);
      if (result.chaveAcesso !== status.chaveAcesso || result.nfse?.infNFSe?.DPS?.infDPS?.Id !== row.dps_id) throw new Error('Nota consultada não corresponde à DPS');
      const authorized = authorizedResult(result, String(profile.cnpj).toUpperCase().replace(/[./-]/g, ''));
      await saveResult(db, payload, 'authorized', authorized);
      return authorized;
    } catch {
      // Um 404 isolado ou falha de rede não prova que o pedido não será processado.
      return { status: 'incerto', message: 'Resultado ainda não confirmado; não reenvie a DPS' };
    }
  } finally {
    try { if (unlock) await unlock(); } finally { db.release(); client.close(); }
  }
}

export async function cancel(payload, profile, pool, certificate, makeClient = (cert) => new NfseClient({ ambiente: Ambiente.ProducaoRestrita, certificado: cert, timeoutMs: 20000 })) {
  if (payload.environment !== 'homologacao' || payload.tenantId !== profile.tenantId || payload.emitterId !== profile.emitterId) throw new Error('Perfil fiscal não autorizado');
  const cnpj = String(payload.issuerCnpj || '').toUpperCase().replace(/[./-]/g, '');
  validateCnpj(cnpj);
  if (cnpj !== String(profile.cnpj || '').toUpperCase().replace(/[./-]/g, '')) throw new Error('Emitente não autorizado');
  if (!/^[0-9]{6}[A-Z0-9]{14}[0-9]{30}$/.test(payload.accessKey || '') || payload.accessKey.slice(6, 20) !== cnpj) throw new Error('Chave fiscal inválida');
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (reason.length < 15 || reason.length > 255) throw new Error('Motivo fiscal inválido');
  const db = await pool.connect(); let unlock;
  const client = makeClient(certificate);
  try {
    unlock = await acquire(db, payload);
    const args = [payload.tenantId, payload.emitterId, payload.environment, payload.idempotencyKey];
    const existing = (await db.query('select * from nfse_bridge_private.events where tenant_id=$1 and emitter_id=$2 and environment=$3 and idempotency_key=$4', args)).rows[0];
    if (existing) {
      if (existing.request_hash !== requestHash(payload)) throw new Error('Solicitação de cancelamento divergente');
      return existing.state === 'accepted' ? { status: 'cancelada' } : { status: 'incerto', message: 'Consulte o resultado oficial antes de tentar novamente' };
    }
    const authorized = (await db.query('select 1 from nfse_bridge_private.emissions where tenant_id=$1 and emitter_id=$2 and environment=$3 and access_key=$4 and state=$5', [payload.tenantId, payload.emitterId, payload.environment, payload.accessKey, 'authorized'])).rowCount;
    if (!authorized) throw new Error('Nota não está registrada para este emitente');
    await db.query("insert into nfse_bridge_private.events (tenant_id,emitter_id,environment,idempotency_key,request_hash,access_key,state) values ($1,$2,$3,$4,$5,$6,'reserved')", [...args, requestHash(payload), payload.accessKey]);
    try {
      const result = await client.cancelar({ chaveAcesso: payload.accessKey, autor: { CNPJ: cnpj }, cMotivo: JustificativaCancelamento.Outros, xMotivo: reason, tpAmb: '2' });
      if (result.status !== 'ok') throw new Error('Resultado pendente');
      await db.query("update nfse_bridge_private.events set state='accepted', xml=$5, updated_at=now() where tenant_id=$1 and emitter_id=$2 and environment=$3 and idempotency_key=$4", [...args, result.evento.xmlEvento]);
      return { status: 'cancelada' };
    } catch (error) {
      const rejected = error instanceof ReceitaRejectionError;
      await db.query('update nfse_bridge_private.events set state=$5, updated_at=now() where tenant_id=$1 and emitter_id=$2 and environment=$3 and idempotency_key=$4', [...args, rejected ? 'rejected' : 'uncertain']);
      return rejected ? { status: 'rejeitada', message: error.message } : { status: 'incerto', message: 'Cancelamento com resultado incerto; não reenviar antes de conferir' };
    }
  } finally { try { if (unlock) await unlock(); } finally { db.release(); client.close(); } }
}
