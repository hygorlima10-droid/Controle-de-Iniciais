// Testa o login do servidor: sem configuração, sem token, token falso, token certo, e-mail errado.
import { generateKeyPairSync, createSign } from 'node:crypto';
import worker from '../src/index.js';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function token(pay, kid = 'k1') { const h = b({ alg: 'RS256', kid }), p = b(pay); const s = createSign('RSA-SHA256').update(h + '.' + p).sign(privateKey).toString('base64url'); return h + '.' + p + '.' + s; }
globalThis.fetch = async (u) => { if (String(u).includes('/cdn-cgi/access/certs')) return new Response(JSON.stringify({ keys: [jwk] })); throw new Error('rede'); };
const env0 = { DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }), run: async () => ({}) }), all: async () => ({ results: [] }) }) }, ASSETS: { fetch: async () => new Response('pagina') } };
const env = { ...env0, ACCESS_TEAM_DOMAIN: 'time.cloudflareaccess.com', ACCESS_AUD: 'aud123' };
const req = (path, tk) => new Request('https://x.test' + path, { headers: tk ? { 'cf-access-jwt-assertion': tk } : {} });
const ok = { aud: ['aud123'], iss: 'https://time.cloudflareaccess.com', exp: Math.floor(Date.now() / 1000) + 600, email: 'eu@x.com' };
check((await worker.fetch(req('/api/db/casos'), env0)).status === 503, 'sem configurar o login: bloqueia tudo (503)');
check((await worker.fetch(req('/'), env)).status === 401, 'sem token: bloqueia a página (401)');
check((await worker.fetch(req('/api/db/casos'), env)).status === 401, 'sem token: bloqueia a API (401)');
check((await worker.fetch(req('/api/db/casos', token({ ...ok, aud: ['outro'] })), env)).status === 401, 'token de outro aplicativo: bloqueia');
check((await worker.fetch(req('/api/db/casos', token({ ...ok, exp: 1 })), env)).status === 401, 'token vencido: bloqueia');
check((await worker.fetch(req('/api/db/casos', token(ok).slice(0, -6) + 'AAAAAA'), env)).status === 401, 'assinatura adulterada: bloqueia');
check((await worker.fetch(req('/api/db/casos', token(ok)), env)).status === 200, 'token certo: libera a API');
check(await (await worker.fetch(req('/', token(ok)), env)).text() === 'pagina', 'token certo: libera a página');
check((await worker.fetch(req('/api/db/casos', token(ok)), { ...env, EMAIL_PERMITIDO: 'outro@x.com' })).status === 403, 'e-mail diferente do permitido: bloqueia (403)');
check((await worker.fetch(req('/api/db/casos', token(ok)), { ...env, EMAIL_PERMITIDO: 'EU@x.com' })).status === 200, 'e-mail permitido (sem diferenciar maiúsculas): libera');
const t = token(ok);
check((await worker.fetch(new Request('https://x.test/api/db/..%2Fx/a', { method: 'PUT', headers: { 'cf-access-jwt-assertion': t }, body: '{}' }), env)).status === 404, 'nome de coleção inválido: recusa');
check((await worker.fetch(new Request('https://x.test/api/db/casos/a', { method: 'PUT', headers: { 'cf-access-jwt-assertion': t }, body: '[1]' }), env)).status === 400, 'registro que não é objeto: recusa');
console.log(falhas ? falhas + ' FALHAS' : 'tudo ok'); process.exit(falhas ? 1 : 0);
