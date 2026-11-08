// Fase 0: confere o backup do servidor e a restauração com dados de teste (ida e volta) e registra o comportamento atual da restauração.
// Falha só se a ida e volta perder ou alterar dados; as "OBSERVAÇÕES" descrevem limites conhecidos (a Fase 1 vai tratá-los).
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const obs = (m) => console.log('  OBS   ' + m);
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.52' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const COLS = ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'saldos', 'metas', 'extratos', 'obraMov', 'processos', 'agenda', 'pecasAprendidas', 'config'];
const todos = async () => { const o = {}; for (const c of COLS) { const r = await f('GET', '/api/db/' + c); for (const d of r.j.docs || []) o[c + '/' + d.id] = d.data; } return o; };
for (const c of COLS) for (const d of (await f('GET', '/api/db/' + c)).j.docs || []) await f('DELETE', '/api/db/' + c + '/' + d.id);
const agora = new Date().toISOString();
// dados de teste em todas as coleções (com acentos, números, listas e objetos aninhados)
for (const c of COLS) for (let i = 1; i <= 3; i++) await f('PUT', '/api/db/' + c + '/t' + i, { nome: 'Teste ação ' + c + ' ' + i, valor: 1234.56 * i, lista: [{ a: 1, b: 'ç' }, { a: 2, b: null }], obj: { x: { y: [1, 2, 3] } }, em: agora });
const antes = await todos();
check(Object.keys(antes).length === COLS.length * 3, 'dados de teste gravados: ' + Object.keys(antes).length);
// 1) backup completo do servidor
const raw = (await f('GET', '/api/backup')).j;
check(raw.docs && raw.docs.length === COLS.length * 3, 'GET /api/backup traz todos os registros: ' + (raw.docs || []).length);
// 2) backup automático guardado no banco e lido de volta
const ag = await f('POST', '/api/backups/agora'); const dia = ag.j.dia;
check(ag.j.docs === COLS.length * 3 && ag.j.partes >= 1, 'backup automático guardado: ' + JSON.stringify(ag.j));
const bk = (await f('GET', '/api/backups/' + dia)).j;
const cobre = (n, c) => (bk[n] ? (Array.isArray(bk[n]) ? bk[n].length : Object.keys(bk[n]).length) : 0) === 3;
check(cobre('casos') && cobre('acordos') && cobre('alvaras') && cobre('clientes') && cobre('despesas') && cobre('receitasManuais') && cobre('saldos') && cobre('metas') && cobre('extratos') && cobre('obraMov') && cobre('processos') && cobre('agenda') && cobre('pecasAprendidas') && cobre('config'), 'o backup no formato do app tem as 14 coleções com os 3 registros de cada');
// 3) ida e volta: apaga tudo e restaura
for (const k of Object.keys(antes)) { const [c, id] = k.split('/'); await f('DELETE', '/api/db/' + c + '/' + id); }
check(Object.keys(await todos()).length === 0, 'banco de teste esvaziado');
const rs = await f('POST', '/api/restaurar', raw);
check(rs.j.ok && rs.j.importados === COLS.length * 3, 'restaurar importou ' + rs.j.importados);
const depois = await todos();
check(JSON.stringify(depois) === JSON.stringify(antes), 'depois de restaurar, todos os registros ficaram idênticos aos de antes (conteúdo e ids)');
// 4) comportamento atual da restauração (para a Fase 1)
await f('PUT', '/api/db/clientes/novo_depois', { nome: 'Criado depois do backup' });
await f('DELETE', '/api/db/clientes/t1');
await f('PUT', '/api/db/clientes/t2', { nome: 'Alterado depois do backup' });
await f('POST', '/api/restaurar', raw);
const c2 = (await f('GET', '/api/db/clientes')).j.docs.map(d => d.id).sort();
if (c2.includes('novo_depois')) obs('restaurar NÃO remove o que foi criado depois do backup (só grava por cima e traz de volta o que foi apagado): não é uma volta ao estado do backup.');
check(c2.includes('t1') && ((await f('GET', '/api/db/clientes')).j.docs.find(d => d.id === 't2').data.nome.startsWith('Teste')), 'restaurar traz de volta o apagado e desfaz alterações dos registros que estão no backup');
const mal = await f('POST', '/api/restaurar', { docs: [{ colecao: 'clientes', id: 'bom1', dados: { nome: 'Bom' } }, { colecao: 'clientes', id: 'ruim', dados: null }, { colecao: '_sistema', id: 'x', dados: { a: 1 } }, { colecao: 'clientes', id: 'bom2', dados: { nome: 'Bom 2' } }] });
obs('restaurar com 1 registro inválido e 1 de coleção reservada: importou ' + mal.j.importados + ' de 4, sem erro e sem avisar quais foram ignorados.');
check(mal.j.importados === 2, 'registros inválidos e de coleções reservadas (_) são ignorados e não gravam em coleção do sistema');
const semArq = await f('POST', '/api/restaurar', { docs: 'não é lista' });
check(semArq.s === 400, 'arquivo sem lista de registros é recusado com erro 400');
obs('restaurar não faz cópia de segurança antes, grava em blocos de 50 (a falha no meio deixa o banco metade novo, metade antigo) e não confere o arquivo antes de gravar.');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
