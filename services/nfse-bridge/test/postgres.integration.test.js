import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { cancel, issue, reconcile } from '../src/bridge.js';
import { buildDpsId } from 'open-nfse';

const databaseUrl = process.env.NFSE_TEST_DATABASE_URL;
const profile = { tenantId: '11111111-1111-4111-8111-111111111111', emitterId: '22222222-2222-4222-8222-222222222222', cnpj: '11222333000181', serie: '1', fiscal: { codigoTributacaoNacional: '140101', regime: { opSimpNac: '3', regEspTrib: '0', regApTribSN: '1' }, valoresTributarios: { pTotTribSN: 6, tribISSQN: '1', tpRetISSQN: '1' } } };
const request = { tenantId: profile.tenantId, emitterId: profile.emitterId, environment: 'homologacao', idempotencyKey: `local-test-${randomUUID()}`, invoice: { issuer: { cnpj: profile.cnpj, codigo_municipio_ibge: '3550308', inscricao_municipal: '1234', codigo_servico: '140101', regime_tributario: 'simples-nacional' }, customer: { cpf_cnpj: '12345678909', razao_social: 'Cliente exemplo', endereco: { codigo_municipio_ibge: '3550308', cep: '01001000', logradouro: 'Rua exemplo', numero: '1', bairro: 'Centro' } }, periodEnd: '2026-10-31', total: 19.99, serviceDescription: 'Serviço exemplo', operationNature: 'tributacao_municipio' } };
const response = { chaveAcesso: '123456' + profile.cnpj + '1'.repeat(30), tipoAmbiente: 'HOMOLOGACAO', xmlNfse: '<NFSe/>', nfse: { infNFSe: { nNFSe: '123' } } };

test('usa trava, evita reenvio e reconcilia após timeout', { skip: !databaseUrl }, async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4 });
  let sends = 0; let shouldFail = true; let wrongDps = true;
  let requestedDps;
  const makeClient = () => ({
    close() {},
    async emitir(params) {
      if (params.dryRun) return { dryRun: true };
      sends++;
      await new Promise(resolve => setTimeout(resolve, 100));
      if (shouldFail) throw new Error('timeout simulado');
      return { status: 'ok', nfse: response };
    },
    async fetchDpsStatus(id) { requestedDps = id; return { chaveAcesso: response.chaveAcesso, idDps: wrongDps ? `${id}0` : id, tipoAmbiente: 'HOMOLOGACAO' }; },
    async fetchByChave() { return { ...response, nfse: { infNFSe: { nNFSe: '123', DPS: { infDPS: { Id: requestedDps } } } } }; },
  });
  try {
    const first = issue(request, profile, pool, {}, makeClient);
    await new Promise(resolve => setTimeout(resolve, 30));
    await assert.rejects(issue(request, profile, pool, {}, makeClient), /processamento/);
    assert.equal((await first).status, 'incerto');
    shouldFail = false;
    assert.equal((await issue(request, profile, pool, {}, makeClient)).status, 'incerto');
    assert.equal(sends, 1);
    assert.equal((await reconcile(request, profile, pool, {}, makeClient)).status, 'incerto');
    wrongDps = false;
    assert.equal((await reconcile(request, profile, pool, {}, makeClient)).status, 'autorizada');
    assert.equal((await issue(request, profile, pool, {}, makeClient)).status, 'autorizada');
    assert.equal(sends, 1);
  } finally { await pool.end(); }
});

test('cancelamento incerto não é reenviado automaticamente', { skip: !databaseUrl }, async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const key = '123456' + profile.cnpj + '1'.repeat(30);
  const issueKey = `fixture-${randomUUID()}`;
  const cancelRequest = { tenantId: profile.tenantId, emitterId: profile.emitterId, environment: 'homologacao', idempotencyKey: `${issueKey}:cancel`, issuerCnpj: profile.cnpj, accessKey: key, reason: 'Motivo de cancelamento de teste' };
  let sends = 0;
  const makeClient = () => ({ close() {}, async cancelar() { sends++; throw new Error('timeout simulado'); } });
  try {
    await pool.query("insert into nfse_bridge_private.emissions (tenant_id,emitter_id,environment,idempotency_key,request_hash,dps_id,dps_number,state,access_key) values ($1,$2,'homologacao',$3,'fixture',$4,'1','authorized',$5)", [profile.tenantId, profile.emitterId, issueKey, issueKey, key]);
    assert.equal((await cancel(cancelRequest, profile, pool, {}, makeClient)).status, 'incerto');
    assert.equal((await cancel(cancelRequest, profile, pool, {}, makeClient)).status, 'incerto');
    assert.equal(sends, 1);
  } finally { await pool.end(); }
});

test('confirma nota apenas com DPS e ambiente correspondentes', { skip: !databaseUrl }, async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const req = { ...request, idempotencyKey: `success-${randomUUID()}` };
  let sends = 0;
  const makeClient = () => ({ close() {}, async emitir(params) {
    if (params.dryRun) return { dryRun: true };
    sends++;
    const idDps = buildDpsId({ cLocEmi: params.emitente.codMunicipio, tipoInsc: 'CNPJ', inscricaoFederal: params.emitente.cnpj, serie: params.serie, nDPS: params.nDPS });
    return { status: 'ok', nfse: { ...response, idDps } };
  } });
  try {
    assert.equal((await issue(req, profile, pool, {}, makeClient)).status, 'autorizada');
    assert.equal((await issue(req, profile, pool, {}, makeClient)).status, 'autorizada');
    assert.equal(sends, 1);
  } finally { await pool.end(); }
});
