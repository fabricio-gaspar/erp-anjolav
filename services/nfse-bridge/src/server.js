import { createServer } from 'node:http';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import pg from 'pg';
import { cancel, issue, reconcile } from './bridge.js';

const token = process.env.NFSE_BRIDGE_TOKEN;
const profileDir = process.env.NFSE_PROFILE_DIR;
if (!token || Buffer.byteLength(token) < 32 || !profileDir || !isAbsolute(profileDir) || !process.env.DATABASE_URL) {
  throw new Error('Configure token seguro, diretório absoluto de perfis e banco do bridge');
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const port = Number(process.env.PORT || 8787);
const equalToken = (value) => {
  const actual = Buffer.from(value || ''); const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
async function readJson(req) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length; if (bytes > 65536) throw new Error('Requisição muito grande');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function readProfile(ref) {
  if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{3,80}$/.test(ref)) throw new Error('Referência fiscal inválida');
  const profile = JSON.parse(await readFile(resolve(profileDir, `${ref}.json`), 'utf8'));
  if (!isAbsolute(profile.certificatePath || '') || !/^NFSE_CERT_PASS_[A-Z0-9_]+$/.test(profile.passwordEnv || '')) throw new Error('Perfil de certificado inválido');
  const password = process.env[profile.passwordEnv];
  if (!password) throw new Error('Senha do certificado indisponível');
  return { profile, certificate: { pfx: await readFile(profile.certificatePath), password } };
}

createServer(async (req, res) => {
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (req.method !== 'POST' || !['/v1/nfse/emitir', '/v1/nfse/consultar', '/v1/nfse/cancelar'].includes(req.url)) return send(404, { message: 'Operação não disponível' });
  if (!equalToken(req.headers.authorization)) return send(401, { message: 'Não autorizado' });
  try {
    const body = await readJson(req);
    if (!body || typeof body !== 'object' || typeof body.idempotencyKey !== 'string'
      || body.idempotencyKey.length > 180 || body.idempotencyKey !== req.headers['idempotency-key']) {
      return send(400, { message: 'Identificador de operação inválido' });
    }
    const { profile, certificate } = await readProfile(body.credentialRef);
    const result = req.url.endsWith('/emitir') ? await issue(body, profile, pool, certificate)
      : req.url.endsWith('/cancelar') ? await cancel(body, profile, pool, certificate)
        : await reconcile(body, profile, pool, certificate);
    return send(result.status === 'incerto' ? 409 : 200, result);
  } catch (error) {
    // Não enviar detalhes de arquivos, certificados ou credenciais ao cliente.
    console.error('Falha no bridge fiscal', { type: error?.constructor?.name || 'Error' });
    return send(400, { message: 'Não foi possível processar a solicitação fiscal. Confira a configuração e os dados.' });
  }
}).listen(port, '127.0.0.1', () => console.log(`Bridge fiscal de homologação iniciado na porta ${port}`));
