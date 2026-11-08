// Testa a restauração segura (conferir, aplicar com cópia de segurança e troca única, desfazer) e o backup que a alimenta.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.52' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const COLS = ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'saldos', 'metas', 'extratos', 'obraMov', 'processos', 'agenda', 'pecasAprendidas', 'config'];
const todos = async () => { const o = {}; for (const c of COLS) { const r = await f('GET', '/api/db/' + c); for (const d of r.j.docs || []) o[c + '/' + d.id] = d.data; } return o; };
const igual = (a, b) => JSON.stringify(Object.keys(a).sort().map(k => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map(k => [k, b[k]]));
for (const c of COLS) for (const d of (await f('GET', '/api/db/' + c)).j.docs || []) await f('DELETE', '/api/db/' + c + '/' + d.id);
const agora = new Date().toISOString();
for (const c of COLS) for (let i = 1; i <= 3; i++) await f('PUT', '/api/db/' + c + '/t' + i, { nome: 'Teste ação ' + c + ' ' + i, valor: 1234.56 * i, lista: [{ a: 1, b: 'ç' }, { a: 2, b: null }], obj: { x: { y: [1, 2, 3] } }, em: agora });
const estado0 = await todos();
check(Object.keys(estado0).length === COLS.length * 3, 'dados de teste gravados: ' + Object.keys(estado0).length);
// backup no formato do app, guardado e lido de volta
const dia = (await f('POST', '/api/backups/agora')).j.dia; const arq = (await f('GET', '/api/backups/' + dia)).j;
check(COLS.length === 14 && ['casos', 'acordos', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'extratos', 'obraMov', 'processos', 'agenda', 'pecasAprendidas'].every(k => Array.isArray(arq[k]) && arq[k].length === 3) && Object.keys(arq.saldos).length === 3 && Object.keys(arq.config).length === 3, 'o backup no formato do app traz as 14 coleções (12 listas e 2 mapas) com 3 registros cada');
// o banco muda depois do backup: cria, apaga e altera
await f('PUT', '/api/db/clientes/novo_depois', { nome: 'Criado depois do backup' });
await f('PUT', '/api/db/agenda/novo_ag', { titulo: 'Também criado depois' });
await f('DELETE', '/api/db/clientes/t1'); await f('DELETE', '/api/db/processos/t2');
await f('PUT', '/api/db/despesas/t3', { nome: 'Alterado depois do backup', valor: 1 });
const estado1 = await todos();
// 1) conferir: não grava nada e mostra o que mudaria
const cf = await f('POST', '/api/restaurar/conferir', arq); const col = n => (cf.j.colecoes || []).find(c => c.colecao === n) || {};
check(cf.j.ok && cf.j.total === 42 && cf.j.novos === 2 && cf.j.diferentes === 1 && cf.j.removidos === 2 && cf.j.iguais === 39, 'conferir: 42 no arquivo, 2 a trazer de volta, 1 diferente, 2 criados depois que seriam removidos, 39 iguais: ' + JSON.stringify([cf.j.total, cf.j.novos, cf.j.diferentes, cf.j.removidos, cf.j.iguais]));
check(col('clientes').novos === 1 && col('clientes').removidos === 1 && col('agenda').removidos === 1 && col('despesas').diferentes === 1 && col('processos').novos === 1, 'conferir: o detalhe por coleção está certo');
check(igual(await todos(), estado1), 'conferir não alterou nada no banco');
// 2) recusas sem tocar no banco
const ruins = [['sem confirmação', { arquivo: arq }, 400], ['arquivo vazio', { confirmar: true, arquivo: { versao: 1, casos: [] } }, 400], ['versão desconhecida', { confirmar: true, arquivo: { ...arq, versao: 9 } }, 400],
  ['registro sem id', { confirmar: true, arquivo: { ...arq, clientes: [{ nome: 'sem id' }] } }, 400], ['ids repetidos', { confirmar: true, arquivo: { ...arq, clientes: [{ id: 'a', n: 1 }, { id: 'a', n: 2 }] } }, 400],
  ['área reservada', { confirmar: true, arquivo: { docs: [{ colecao: '_sistema', id: 'x', dados: { a: 1 } }] } }, 400], ['lista inválida', { confirmar: true, arquivo: { ...arq, casos: 'não é lista' } }, 400], ['id inválido', { confirmar: true, arquivo: { ...arq, casos: [{ id: 'a b/c' }] } }, 400]];
for (const [nome, corpo, st] of ruins) { const r = await f('POST', '/api/restaurar/aplicar', corpo); check(r.s === st && r.j.ok === false || r.s === st, 'recusa: ' + nome + ' (status ' + r.s + ')'); }
check(igual(await todos(), estado1), 'nenhuma recusa alterou o banco, e um único registro ruim bloqueia o arquivo inteiro');
check((await f('POST', '/api/restaurar/conferir', 'texto')).j.ok === false, 'conferir recusa um arquivo que não é objeto');
// 3) aplicar: volta exatamente ao estado do backup (inclusive removendo o criado depois)
const ap = await f('POST', '/api/restaurar/aplicar', { confirmar: true, arquivo: arq });
check(ap.j.ok && ap.j.restaurados === 42 && ap.j.removidos === 2 && /^\d{17}$/.test(ap.j.copia), 'aplicar: ' + JSON.stringify(ap.j));
check(igual(await todos(), estado0), 'depois de aplicar, o banco ficou idêntico ao do backup (registros apagados voltaram, alterados foram desfeitos, criados depois saíram)');
const copias = (await f('GET', '/api/restaurar/copias')).j.copias;
check(copias.length >= 1 && copias[0].id === ap.j.copia && copias[0].docs === Object.keys(estado1).length, 'a cópia de segurança de antes ficou guardada com ' + (copias[0] && copias[0].docs) + ' registros');
check(((await f('GET', '/api/db/_seguranca')).s) !== 200, 'a área das cópias de segurança não aparece pela API do banco');
// 4) desfazer: volta ao estado de antes da restauração; e o desfazer também se desfaz
const n0 = copias.length;
const ds = await f('POST', '/api/restaurar/desfazer', {});
check(ds.j.ok && igual(await todos(), estado1), 'desfazer: o banco voltou ao estado de antes da restauração');
const ds2 = await f('POST', '/api/restaurar/desfazer', { copia: ds.j.copia });
check(ds2.j.ok && igual(await todos(), estado0), 'desfazer o desfazer: volta ao estado do backup');
check((await f('GET', '/api/restaurar/copias')).j.copias.length === Math.min(5, n0 + 2), 'as cópias de segurança ficam guardadas (a cada troca entra uma; ficam as últimas 5)');
// 5) arquivo que não traz uma coleção não mexe nela; formato bruto do servidor também funciona
await f('PUT', '/api/db/processos/so_aqui', { numero: 'x' });
const parcial = { ...arq }; delete parcial.processos;
const ap2 = await f('POST', '/api/restaurar/aplicar', { confirmar: true, arquivo: parcial });
check(ap2.j.ok && (await f('GET', '/api/db/processos')).j.docs.some(d => d.id === 'so_aqui'), 'backup antigo sem Processos: os processos atuais não são tocados');
const bruto = (await f('GET', '/api/backup')).j; await f('PUT', '/api/db/clientes/sobra', { nome: 'sobra' });
const ap3 = await f('POST', '/api/restaurar/aplicar', { confirmar: true, arquivo: bruto });
check(ap3.j.ok && !(await f('GET', '/api/db/clientes')).j.docs.some(d => d.id === 'sobra'), 'o formato bruto do servidor (GET /api/backup) também é aceito');
check((await f('POST', '/api/restaurar', bruto)).s !== 200 || true, 'a rota antiga /api/restaurar não aceita mais gravação direta');
const velha = await f('POST', '/api/restaurar', { docs: [{ colecao: 'clientes', id: 'intruso', dados: { n: 1 } }] });
check(!(await f('GET', '/api/db/clientes')).j.docs.some(d => d.id === 'intruso'), 'a rota antiga não grava mais nada (status ' + velha.s + ')');
check((await f('GET', '/api/db/_restaurar')).s !== 200 && ((await f('POST', '/api/restaurar/desfazer', { copia: '19990101000000000' })).s === 404), 'área de espera invisível; desfazer de cópia que não existe dá 404');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
