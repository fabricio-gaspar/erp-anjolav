import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { Ambiente, NfseClient, buildDps, buildDpsXml, validateDpsXml } from 'open-nfse';
import forge from 'node-forge';
import { buildParameters } from '../src/parameters.js';

const profile = {
  tenantId: 'tenant-example', emitterId: 'issuer-example', cnpj: '11222333000181', serie: '1',
  fiscal: { codigoTributacaoNacional: '140101', regime: { opSimpNac: '3', regEspTrib: '0', regApTribSN: '1' }, valoresTributarios: { pTotTribSN: 6, tribISSQN: '1', tpRetISSQN: '1' } },
};
const request = {
  tenantId: 'tenant-example', emitterId: 'issuer-example', environment: 'homologacao', idempotencyKey: 'test:1',
  invoice: {
    issuer: { cnpj: '11222333000181', codigo_municipio_ibge: '3550308', inscricao_municipal: '1234', codigo_servico: '140101', regime_tributario: 'simples-nacional' },
    customer: { cpf_cnpj: '12345678909', razao_social: 'CLIENTE EXEMPLO', endereco: { codigo_municipio_ibge: '3550308', cep: '01001000', logradouro: 'Rua Exemplo', numero: '1', bairro: 'Centro' } },
    periodEnd: '2026-10-31', total: 19.99, serviceDescription: 'Serviço de exemplo', operationNature: 'tributacao_municipio',
  },
};

test('gera DPS restrita e valida XML com XSD do pacote', async () => {
  const params = buildParameters(request, profile, new Date('2026-11-24T12:00:00-03:00'));
  assert.equal(params.tpAmb, '2');
  assert.equal(params.valores.vServ, 19.99);
  const xml = buildDpsXml(buildDps(params));
  const validation = await validateDpsXml(xml, { throwOnInvalid: false });
  assert.deepEqual(validation, { valid: true, violations: [] });
});

test('bloqueia produção, outro tenant e endereço incompleto', () => {
  assert.throws(() => buildParameters({ ...request, environment: 'producao' }, profile), /somente produção restrita/);
  assert.throws(() => buildParameters({ ...request, tenantId: 'other' }, profile), /não autorizado/);
  const missing = JSON.parse(JSON.stringify(request)); delete missing.invoice.customer.endereco.codigo_municipio_ibge;
  assert.throws(() => buildParameters(missing, profile), /IBGE/);
});

test('assina DPS local com certificado gerado para teste, sem transmitir', async () => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey; cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 60000); cert.validity.notAfter = new Date(Date.now() + 86400000);
  const attributes = [{ name: 'commonName', value: 'Somente teste local' }];
  cert.setSubject(attributes); cert.setIssuer(attributes); cert.sign(keys.privateKey, forge.md.sha256.create());
  const pfx = Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, 'local')).getBytes(), 'binary');
  const client = new NfseClient({ ambiente: Ambiente.ProducaoRestrita, certificado: { pfx, password: 'local' } });
  try {
    const result = await client.emitir({ ...buildParameters(request, profile), dryRun: true });
    assert.equal(result.dryRun, true);
    assert.match(result.xmlDpsAssinado, /<Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">/);
  } finally { client.close(); }
});
