// Testa o login com senha contra o servidor local.
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --port 8788   e rode:  node test/login.test.mjs
const B = process.env.BASE || 'http://127.0.0.1:8788', SENHA = process.env.SENHA || 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const post = (senha, ip) => fetch(B + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': ip || '1.1.1.1' }, body: 'senha=' + encodeURIComponent(senha) });
let r = await fetch(B + '/apple-touch-icon.png', { redirect: 'manual' }); check(r.status === 200 && r.headers.get('content-type').includes('image/png'), 'o ícone do app abre sem login (o iPhone precisa dele)');
r = await fetch(B + '/manifest.webmanifest', { redirect: 'manual' }); check(r.status === 200, 'o manifesto abre sem login');
r = await fetch(B + '/', { redirect: 'manual' }); check(r.status === 303 && r.headers.get('location') === '/login', 'sem sessão: a página manda para /login');
r = await fetch(B + '/api/db/casos'); check(r.status === 401, 'sem sessão: a API responde 401');
r = await fetch(B + '/shim.js', { redirect: 'manual' }); check(r.status === 303, 'sem sessão: nem os arquivos do app abrem');
r = await fetch(B + '/login'); check(r.status === 200 && (await r.text()).includes('type="password"'), 'a tela de login abre');
r = await post('errada', '9.9.9.9'); check(r.status === 401, 'senha errada: 401');
r = await post('senha-de-teste-123', '2.2.2.2'); const ck = (r.headers.get('set-cookie') || '').split(';')[0];
check(r.status === 303 && /^sessao=/.test(ck) && /HttpOnly/.test(r.headers.get('set-cookie')) && /Secure/.test(r.headers.get('set-cookie')) && /SameSite=Strict/.test(r.headers.get('set-cookie')), 'senha certa: entra e o cookie é HttpOnly, Secure e SameSite=Strict');
const H = { cookie: ck };
r = await fetch(B + '/api/db/casos', { headers: H }); check(r.status === 200, 'com sessão: a API responde');
r = await fetch(B + '/', { headers: H }); check(r.status === 200 && (await r.text()).includes('<title>'), 'com sessão: a página abre');
r = await fetch(B + '/api/db/casos/t1', { method: 'PUT', headers: { ...H, 'content-type': 'application/json' }, body: '{"a":1}' }); check(r.status === 200, 'com sessão: grava');
r = await fetch(B + '/api/db/casos/t1', { method: 'PUT', headers: { ...H, 'content-type': 'application/json', origin: 'https://site-malicioso.com' }, body: '{"a":2}' }); check(r.status === 403, 'pedido vindo de outro site: bloqueado');
r = await fetch(B + '/api/db/casos/t1', { method: 'DELETE', headers: H }); check(r.status === 200, 'com sessão: apaga');
r = await fetch(B + '/api/db/_sistema', { headers: H }); check(r.status === 404, 'área reservada do sistema não é acessível pela API');
const falso = ck.slice(0, -4) + 'AAAA'; r = await fetch(B + '/api/db/casos', { headers: { cookie: falso } }); check(r.status === 401, 'cookie adulterado: bloqueia');
r = await fetch(B + '/api/backup', { headers: H }); const bk = await r.json(); check(r.status === 200 && !JSON.stringify(bk).includes('tent-'), 'backup funciona e não inclui dados internos do sistema');
for (let i = 0; i < 5; i++) await post('x' + i, '7.7.7.7');
r = await post('senha-de-teste-123', '7.7.7.7'); check(r.status === 429, 'depois de 5 erros seguidos: bloqueia o IP por 15 min, mesmo com a senha certa');
r = await post('senha-de-teste-123', '8.8.8.8'); check(r.status === 303, 'outro IP não é afetado');
r = await fetch(B + '/sair', { redirect: 'manual' }); check(r.status === 303 && /Max-Age=0/.test(r.headers.get('set-cookie')), 'sair apaga o cookie');
console.log(falhas ? falhas + ' FALHAS' : 'tudo ok'); process.exit(falhas ? 1 : 0);
