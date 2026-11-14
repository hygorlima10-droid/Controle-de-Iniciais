// Testa o acesso individual (e-mail + senha, sessões no banco, recuperação, tabela de rotas).
// Servidor SEM a variável LOGIN_ANTIGO e com banco novo.  Rode:  BASE=http://127.0.0.1:8813 node test/login-individual.test.mjs
const B = process.env.BASE || 'http://127.0.0.1:8813', CHAVE = process.env.SENHA || 'senha-de-teste-123';
const EMAIL = 'hygor@exemplo.com.br', SENHA1 = 'minha-senha-forte-1', SENHA2 = 'outra-senha-forte-22', SENHA3 = 'terceira-senha-forte-333';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0';
const form = (o) => Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
const enviar = (rota, corpo, { ip = '1.1.1.1', ua = UA_EDGE, cookie } = {}) => fetch(B + rota, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': ip, 'user-agent': ua, ...(cookie ? { cookie } : {}) }, body: form(corpo) });
const entrar = (email, senha, o) => enviar('/login', { email, senha }, o);
const ck = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
const api = (rota, cookie, opc = {}) => fetch(B + rota, { redirect: 'manual', ...opc, headers: { cookie, ...(opc.headers || {}) } });
const jsonPut = (rota, cookie, corpo) => api(rota, cookie, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });

/* 1 — antes de existir acesso individual: só a senha antiga, e só serve para criar o acesso */
let r = await fetch(B + '/login'); let t = await r.text();
check(r.status === 200 && t.includes('type="password"') && !t.includes('type="email"'), 'sem acesso individual: a tela pede só a senha atual');
r = await entrar('', 'errada', { ip: '9.9.9.1' }); check(r.status === 401, 'senha antiga errada: 401');
r = await enviar('/login', { senha: CHAVE }, { ip: '9.9.9.2' }); const legado = ck(r);
check(r.status === 303 && r.headers.get('location') === '/criar-acesso' && legado.includes('.'), 'senha antiga certa: vai para "Crie o seu acesso", com cookie temporário');
r = await api('/', legado); check(r.status === 303 && r.headers.get('location') === '/criar-acesso', 'com o cookie temporário: a página manda para criar o acesso');
r = await api('/api/db/casos', legado); check(r.status === 401, 'com o cookie temporário: a API continua fechada');
r = await api('/criar-acesso', legado); t = await r.text(); check(r.status === 200 && t.includes('Crie o seu acesso') && t.includes('chave de emergência'), 'a tela de criar acesso abre');
r = await api('/criar-acesso'); check(r.status === 303 && r.headers.get('location') === '/login', 'sem cookie: criar acesso não abre');
r = await enviar('/criar-acesso', { nome: 'Hygor', email: EMAIL, senha: 'curta', senha2: 'curta' }, { cookie: legado }); check(r.status === 400 && (await r.text()).includes('pelo menos 12'), 'senha curta é recusada');
r = await enviar('/criar-acesso', { nome: 'Hygor', email: EMAIL, senha: SENHA1, senha2: SENHA1 + 'x' }, { cookie: legado }); check(r.status === 400 && (await r.text()).includes('não são iguais'), 'senhas diferentes são recusadas');
r = await enviar('/criar-acesso', { nome: 'Hygor', email: 'sem-arroba', senha: SENHA1, senha2: SENHA1 }, { cookie: legado }); check(r.status === 400, 'e-mail inválido é recusado');
r = await enviar('/criar-acesso', { nome: 'Hygor', email: EMAIL.toUpperCase(), senha: SENHA1, senha2: SENHA1 }, { cookie: legado, ua: UA_IPHONE });
const c1 = ck(r), sc = r.headers.get('set-cookie') || '';
check(r.status === 303 && r.headers.get('location') === '/' && /^sessao=[A-Za-z0-9_-]{30,}$/.test(c1) && /HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Strict/.test(sc) && /Max-Age=2592000/.test(sc), 'criar o acesso: entra, com cookie de sessão HttpOnly/Secure/SameSite=Strict por 30 dias');
r = await api('/api/db/casos', c1); check(r.status === 200, 'com a sessão nova: a API responde');
r = await api('/', c1); check(r.status === 200 && (await r.text()).includes('<title>'), 'com a sessão nova: a página abre');

/* 2 — depois de existir acesso individual */
r = await api('/', legado); check(r.status === 303 && r.headers.get('location') === '/login', 'o cookie temporário deixou de valer');
r = await api('/api/db/casos', legado); check(r.status === 401, 'o cookie temporário não abre a API');
r = await api('/criar-acesso', legado); check(r.status === 303 && r.headers.get('location') === '/login', 'criar acesso não abre de novo');
r = await fetch(B + '/login'); t = await r.text(); check(r.status === 200 && t.includes('type="email"') && t.includes('Esqueci minha senha'), 'a tela de entrada pede e-mail e senha');
r = await entrar(EMAIL, 'senha-errada-qualquer', { ip: '3.3.3.3' }); t = await r.text(); check(r.status === 401 && t.includes('E-mail ou senha incorretos'), 'senha errada: 401 com mensagem genérica');
r = await entrar('outro@exemplo.com', SENHA1, { ip: '3.3.3.4' }); t = await r.text(); check(r.status === 401 && t.includes('E-mail ou senha incorretos'), 'e-mail desconhecido: a mesma mensagem (não revela quem existe)');
r = await entrar(EMAIL, CHAVE, { ip: '3.3.3.5' }); check(r.status === 401, 'a chave de emergência não serve para entrar');
r = await entrar(EMAIL, SENHA1, { ip: '3.3.3.6', ua: UA_EDGE }); const c2 = ck(r); check(r.status === 303 && r.headers.get('location') === '/' && c2 && c2 !== c1, 'e-mail e senha certos: entra (e-mail sem diferenciar maiúsculas)');

/* 3 — sessões */
r = await api('/api/seguranca/sessoes', c1); let j = await r.json();
check(r.status === 200 && j.sessoes.length === 2 && j.sessoes.filter((s) => s.atual).length === 1 && j.usuario.email === EMAIL, 'lista de sessões: duas abertas, uma é a atual');
check(j.sessoes.some((s) => s.rotulo === 'iPhone · Safari') && j.sessoes.some((s) => s.rotulo === 'Windows · Edge'), 'cada sessão mostra aparelho e navegador');
check(!JSON.stringify(j).includes('hash') && !JSON.stringify(j).includes('"sal"') && !JSON.stringify(j).includes(c1.slice(7)), 'a lista não expõe senha, sal nem o cookie');
const outra = j.sessoes.find((s) => !s.atual);
r = await api('/api/seguranca/sessoes/' + j.sessoes.find((s) => s.atual).id, c1, { method: 'DELETE' }); check(r.status === 400, 'a sessão atual não se encerra por aqui');
r = await api('/api/seguranca/sessoes/' + outra.id, c1, { method: 'DELETE' }); check(r.status === 200, 'encerrar uma sessão específica');
r = await api('/api/db/casos', c2); check(r.status === 401, 'a sessão encerrada perde o acesso na hora');
r = await entrar(EMAIL, SENHA1, { ip: '3.3.3.7' }); const c3 = ck(r); r = await entrar(EMAIL, SENHA1, { ip: '3.3.3.8' }); const c4 = ck(r);
r = await api('/api/seguranca/sessoes/encerrar-outras', c1, { method: 'POST' }); j = await r.json(); check(r.status === 200 && j.encerradas === 2, 'encerrar todas as outras');
r = await api('/api/db/casos', c3); const a3 = r.status; r = await api('/api/db/casos', c4); r = [a3, r.status];
check(r[0] === 401 && r[1] === 401, 'as outras sessões caíram');
r = await api('/api/db/casos', c1); check(r.status === 200, 'a sessão atual continua');

/* 4 — bloqueio por aparelho */
for (let i = 0; i < 5; i++) await entrar(EMAIL, 'x' + i + 'x-errada', { ip: '7.7.7.7' });
r = await entrar(EMAIL, SENHA1, { ip: '7.7.7.7' }); check(r.status === 429, 'depois de 5 erros seguidos: aquele aparelho fica bloqueado, mesmo com a senha certa');
r = await entrar(EMAIL, SENHA1, { ip: '8.8.8.8' }); check(r.status === 303, 'outro aparelho não é afetado (ninguém de fora tranca a sua entrada)');
const c5 = ck(r);

/* 5 — trocar a senha */
r = await jsonPut('/api/seguranca/senha', c1, { atual: 'errada-errada-1', nova: SENHA2 }); check(r.status === 401, 'trocar a senha: a atual errada é recusada');
r = await jsonPut('/api/seguranca/senha', c1, { atual: SENHA1, nova: 'curta' }); check(r.status === 400, 'trocar a senha: nova curta é recusada');
r = await jsonPut('/api/seguranca/senha', c1, { atual: SENHA1, nova: SENHA2 }); check(r.status === 200, 'senha trocada');
r = await api('/api/db/casos', c5); check(r.status === 401, 'trocar a senha encerra as outras sessões');
r = await api('/api/db/casos', c1); check(r.status === 200, 'e mantém a sessão atual');
r = await entrar(EMAIL, SENHA1, { ip: '4.4.4.1' }); check(r.status === 401, 'a senha antiga deixou de valer');
r = await entrar(EMAIL, SENHA2, { ip: '4.4.4.2' }); check(r.status === 303, 'a senha nova vale');
r = await jsonPut('/api/seguranca/alertas', c1, { ativo: false }); j = await r.json(); check(r.status === 200 && j.alertas === false, 'os avisos podem ser desligados');
r = await api('/api/seguranca/sessoes', c1); j = await r.json(); check(j.usuario.alertas === false, 'e o estado fica salvo');
await jsonPut('/api/seguranca/alertas', c1, { ativo: true });

/* 6 — recuperar pela chave de emergência */
r = await fetch(B + '/recuperar'); t = await r.text(); check(r.status === 200 && t.includes('Recuperar o acesso'), 'a tela de recuperação abre sem login');
r = await enviar('/recuperar', { chave: 'chave-errada-1234', senha: SENHA3, senha2: SENHA3 }, { ip: '5.5.5.1' }); check(r.status === 401, 'recuperar: chave errada é recusada');
r = await enviar('/recuperar', { chave: CHAVE, senha: 'curta', senha2: 'curta' }, { ip: '5.5.5.2' }); check(r.status === 400, 'recuperar: senha curta é recusada');
r = await enviar('/recuperar', { chave: CHAVE, senha: SENHA3, senha2: SENHA3 }, { ip: '5.5.5.3' }); const c6 = ck(r);
check(r.status === 303 && r.headers.get('location') === '/' && c6, 'recuperar: chave certa redefine a senha e já entra');
r = await api('/api/db/casos', c1); check(r.status === 401, 'recuperar encerra todas as sessões antigas');
r = await api('/api/db/casos', c6); check(r.status === 200, 'a sessão da recuperação funciona');
r = await entrar(EMAIL, SENHA2, { ip: '4.4.4.3' }); check(r.status === 401, 'a senha anterior deixou de valer');
r = await entrar(EMAIL, SENHA3, { ip: '4.4.4.4' }); check(r.status === 303, 'a senha redefinida vale');
for (let i = 0; i < 5; i++) await enviar('/recuperar', { chave: 'errada-' + i + '-xxxxx', senha: SENHA3, senha2: SENHA3 }, { ip: '6.6.6.6' });
r = await enviar('/recuperar', { chave: CHAVE, senha: SENHA3, senha2: SENHA3 }, { ip: '6.6.6.6' }); check(r.status === 429, 'recuperar: também bloqueia por aparelho depois de 5 erros');

/* 7 — registro de ações */
r = await api('/api/auditoria?limite=200', c6); j = await r.json(); const ops = new Set((j.itens || j.registros || j.docs || []).map((x) => (x.dados || x.data || x).op));
check(r.status === 200 && ['criou', 'entrou', 'falhou', 'encerrou', 'alterou'].every((o) => ops.has(o)), 'o registro anota criou, entrou, falhou, encerrou e alterou');
const textoAud = JSON.stringify(j); check(!textoAud.includes(SENHA1) && !textoAud.includes(SENHA3) && !textoAud.includes(CHAVE), 'o registro nunca contém senhas');

/* 8 — sair */
r = await api('/sair', c6); check(r.status === 303 && /Max-Age=0/.test(r.headers.get('set-cookie') || ''), 'sair apaga o cookie');
r = await api('/api/db/casos', c6); check(r.status === 401, 'e encerra a sessão no servidor (o cookie copiado não vale mais)');
r = await entrar(EMAIL, SENHA3, { ip: '4.4.4.5' }); const c7 = ck(r);
r = await api('/api/auditoria?limite=200', c7); j = await r.json(); check((j.itens || j.registros || j.docs || []).some((x) => (x.dados || x.data || x).op === 'saiu'), 'sair fica no registro');

/* 9 — tabela de rotas e áreas reservadas */
const RAIZES = ['ler', 'recebidos', 'anexos', 'notif', 'djen', 'datajud', 'db', 'backup', 'backups', 'restaurar', 'lixeira', 'auditoria', 'seguranca', 'lote', 'eu'];
let todas = true; for (const raiz of RAIZES) { const x = await fetch(B + '/api/' + raiz + '/x', { redirect: 'manual' }); const y = await fetch(B + '/api/' + raiz, { redirect: 'manual' }); if (x.status !== 401 || y.status !== 401) { todas = false; console.log('   sem sessão, /api/' + raiz + ' respondeu', x.status, y.status); } }
check(todas, 'sem sessão: toda raiz da API responde 401 (' + RAIZES.length + ' conferidas)');
r = await api('/api/inventada', c7); check(r.status === 404, 'com sessão: raiz desconhecida da API é recusada');
r = await api('/api/inventada', ''); check(r.status === 401, 'sem sessão: raiz desconhecida também 401');
r = await fetch(B + '/api/enviar', { method: 'POST', headers: { 'cf-connecting-ip': '2.2.2.2' }, body: 'x' }); check(r.status === 401, '/api/enviar sem token: 401 (tem token próprio, sem sessão)');
for (const col of ['_usuarios', '_sessoes', '_sistema']) { r = await api('/api/db/' + col, c7); check(r.status === 404, col + ' não é acessível pela API do banco'); }
r = await api('/api/backup', c7); const bk = JSON.stringify(await r.json()); check(r.status === 200 && !bk.includes(EMAIL) && !bk.includes('"hash"') && !bk.includes('"sal"'), 'o backup não leva usuários, senhas nem sessões');
r = await fetch(B + '/apple-touch-icon.png'); check(r.status === 200, 'os ícones continuam públicos');
r = await fetch(B + '/shim.js', { redirect: 'manual' }); check(r.status === 303, 'sem sessão: nem os arquivos do app abrem');
r = await api('/api/db/casos/t1', c7, { method: 'PUT', headers: { 'content-type': 'application/json', origin: 'https://site-malicioso.com' }, body: '{"a":2}' }); check(r.status === 403, 'pedido vindo de outro site: bloqueado');
const falso = c7.slice(0, -3) + 'AAA'; r = await api('/api/db/casos', falso); check(r.status === 401, 'cookie adulterado: bloqueia');

console.log(falhas ? falhas + ' FALHAS' : 'tudo ok'); process.exit(falhas ? 1 : 0);
