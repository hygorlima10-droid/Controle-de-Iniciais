// Testa a lixeira de 30 dias e o registro de ações no ponto central do servidor (/api/db passa por eles).
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import { execSync } from 'node:child_process';
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.55' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const reg = async (q = '') => (await f('GET', '/api/auditoria?limite=200' + q)).j.itens;
const lix = async () => (await f('GET', '/api/lixeira')).j.itens;
for (const c of ['clientes', 'processos', 'despesas']) for (const d of (await f('GET', '/api/db/' + c)).j.docs || []) await f('DELETE', '/api/db/' + c + '/' + d.id);
await f('POST', '/api/lixeira/esvaziar', {});
const base = ((await reg())[0] || { chave: '' }).chave, novos = async () => (await reg()).filter(x => x.chave > base);   // só conta o que este teste gerou (o banco pode ter registros de outros testes)
// 1) criar, alterar, alterar igual
const c1 = await f('POST', '/api/db/clientes', { nome: 'Maria Souza', telefone: '6299999-0000', pagador: 'cliente', apelidos: ['Maria'], atualizadoEm: 'a' });
let R = await reg();
check((await novos()).length === 1 && R[0].op === 'criou' && R[0].colecao === 'clientes' && R[0].rotulo === 'Cliente' && R[0].titulo === 'Maria Souza' && R[0].por === 'Você' && R[0].id === c1.j.id, 'criar cliente registra “criou” com tipo, nome e quem: ' + JSON.stringify(R[0]));
await f('PUT', '/api/db/clientes/' + c1.j.id, { nome: 'Maria Souza Lima', telefone: '6299999-0000', pagador: 'cliente', apelidos: ['Maria', 'Mari'], atualizadoEm: 'b' });
R = await reg();
const mud = R[0].mud || [];
check((await novos()).length === 2 && R[0].op === 'alterou' && mud.some(m => m.c === 'nome' && m.a === 'Maria Souza' && m.d === 'Maria Souza Lima') && mud.some(m => m.c === 'apelidos' && m.lista) && !mud.some(m => m.c === 'atualizadoEm' || m.c === 'telefone'), 'alterar registra campo a campo (antes e depois), ignora atualizadoEm e o que não mudou: ' + JSON.stringify(mud));
await f('PUT', '/api/db/clientes/' + c1.j.id, { nome: 'Maria Souza Lima', telefone: '6299999-0000', pagador: 'cliente', apelidos: ['Maria', 'Mari'], atualizadoEm: 'c' });
check((await novos()).length === 2, 'gravar de novo o mesmo conteúdo não gera registro');
// 2) o que não entra no registro
await f('PUT', '/api/db/config/backup', { ultimoEm: 'x' }); await f('PUT', '/api/db/config/backup', { ultimoEm: 'y' }); await f('DELETE', '/api/db/config/backup');
check((await novos()).length === 2 && !(await lix()).some(i => i.colecao === 'config'), 'configurações não entram no registro nem na lixeira (mudam sozinhas)');
// 3) criar com id (importação) e excluir → lixeira
const cr = await f('PUT', '/api/db/processos/dteste?soNovo=1', { numero: '5368644-67.2026.8.09.0107', partes: 'A x B', clienteIds: [c1.j.id] });
const cr2 = await f('PUT', '/api/db/processos/dteste?soNovo=1', { numero: 'outro' });
R = await reg();
check(cr.j.criado === true && cr2.j.criado === false && R[0].op === 'criou' && R[0].colecao === 'processos' && R.filter(x => x.id === 'dteste' && x.op === 'criou' && x.chave > base).length === 1, 'criação “só se não existe” registra uma vez (e a segunda, recusada, não registra): ' + JSON.stringify(R.slice(0, 3).map(x => [x.op, x.colecao, x.id])));
const antesProc = (await f('GET', '/api/db/processos')).j.docs.find(d => d.id === 'dteste').data;
const del = await f('DELETE', '/api/db/processos/dteste');
check(del.j.ok && !(await f('GET', '/api/db/processos')).j.docs.some(d => d.id === 'dteste'), 'excluir remove do banco');
let L = await lix(); const it = L.find(x => x.id === 'dteste');
check(it && it.colecao === 'processos' && it.rotulo === 'Processo' && /A x B/.test(it.titulo) && new Date(it.expira) - new Date(it.em) === 30 * 864e5, 'a exclusão foi para a lixeira, com tipo, nome e validade de 30 dias: ' + JSON.stringify(it));
check((await reg())[0].op === 'excluiu' && (await reg())[0].id === 'dteste', 'e o registro de ações guardou “excluiu”: ' + JSON.stringify((await reg()).slice(0, 3).map(x => [x.op, x.colecao, x.id])));
// excluir um registro que não existe não polui
const nR = (await reg()).length, nL = (await lix()).length; await f('DELETE', '/api/db/processos/nao_existe');
check((await reg()).length === nR && (await lix()).length === nL, 'excluir o que não existe não registra nem vai para a lixeira');
// 4) restaurar
const rs = await f('POST', '/api/lixeira/restaurar', { chave: it.chave });
const volta = (await f('GET', '/api/db/processos')).j.docs.find(d => d.id === 'dteste');
check(rs.j.ok && volta && JSON.stringify(volta.data) === JSON.stringify(antesProc) && !(await lix()).some(x => x.chave === it.chave), 'restaurar devolve o registro idêntico e tira da lixeira: ' + JSON.stringify([rs.s, rs.j, volta && volta.data, antesProc]));
check((await reg())[0].op === 'restaurou' && (await reg())[0].titulo.includes('A x B'), 'e registra “restaurou”');
// 5) recriado depois de excluído: pede confirmação para substituir
await f('DELETE', '/api/db/processos/dteste'); await f('PUT', '/api/db/processos/dteste', { numero: 'recriado', partes: 'novo' });
const it2 = (await lix()).find(x => x.id === 'dteste');
const conf = await f('POST', '/api/lixeira/restaurar', { chave: it2.chave });
check(conf.s === 409 && conf.j.existe === true && (await f('GET', '/api/db/processos')).j.docs.find(d => d.id === 'dteste').data.partes === 'novo', 'se o registro foi recriado, restaurar avisa (409) e não sobrescreve');
const sub = await f('POST', '/api/lixeira/restaurar', { chave: it2.chave, substituir: true });
check(sub.j.ok && sub.j.substituiu && (await f('GET', '/api/db/processos')).j.docs.find(d => d.id === 'dteste').data.partes === 'A x B', 'com confirmação, substitui pelo da lixeira');
// 6) processo excluído na revisão volta da lista de ignorados ao restaurar
await f('PUT', '/api/db/config/processosIgnorados', { numeros: { '53686446720268090107': 'x', '999': 'y' } });
await f('DELETE', '/api/db/processos/dteste'); const it3 = (await lix()).find(x => x.id === 'dteste');
await f('POST', '/api/lixeira/restaurar', { chave: it3.chave });
const ign = ((await f('GET', '/api/db/config')).j.docs.find(d => d.id === 'processosIgnorados') || {}).data;
check(ign && !ign.numeros['53686446720268090107'] && ign.numeros['999'], 'restaurar um processo tira o número dele da lista de excluídos (não volta a ser ignorado)');
// 7) isolamento e validade
check((await f('GET', '/api/db/_lixeira')).s !== 200 && (await f('GET', '/api/db/_auditoria')).s !== 200, 'as áreas _lixeira e _auditoria não aparecem pela API do banco');
check((await f('POST', '/api/lixeira/restaurar', { chave: 'nao|existe|1' })).s === 404, 'restaurar item que não existe dá 404');
await f('DELETE', '/api/db/clientes/' + c1.j.id); const it4 = (await lix()).find(x => x.id === c1.j.id);
try { execSync('npx wrangler d1 execute controle-juridico --local --persist-to ' + (process.env.DADOS || '/tmp/dev-data-pub') + ' --command "UPDATE docs SET atualizado = 1 WHERE colecao = \'_lixeira\' AND id = \'' + it4.chave.replace(/'/g, '') + '\'"', { stdio: 'pipe', cwd: '/home/user/Controle-de-Iniciais' }); } catch (e) { console.log('   (não consegui envelhecer o item: ' + String(e.message).slice(0, 80) + ')'); }
check(!(await lix()).some(x => x.id === c1.j.id) && (await f('POST', '/api/lixeira/restaurar', { chave: it4.chave })).s === 404, 'item com mais de 30 dias some da lista e não pode ser restaurado');
// 8) paginação do registro e filtro por tipo
for (let i = 0; i < 5; i++) await f('POST', '/api/db/despesas', { nome: 'Despesa ' + i, valor: i });
const p1 = await f('GET', '/api/auditoria?limite=3'); const p2 = await f('GET', '/api/auditoria?limite=3&antes=' + p1.j.mais);
check(p1.j.itens.length === 3 && p1.j.mais && p2.j.itens.length === 3 && p2.j.itens[0].chave < p1.j.itens[2].chave, 'o registro é paginado (mais recentes primeiro)');
check((await reg('&colecao=despesas')).every(x => x.colecao === 'despesas') && (await reg('&colecao=despesas')).length >= 5, 'o registro filtra por tipo (coleção)');
// 9) esvaziar
const ev = await f('POST', '/api/lixeira/esvaziar', {});
check(ev.j.ok && (await lix()).length === 0 && (await reg())[0].op === 'esvaziou', 'esvaziar a lixeira apaga tudo e registra');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
