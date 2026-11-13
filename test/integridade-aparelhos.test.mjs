// Auditoria F-05 e F-06 (grupo principal):
//  - config/obra e config/extratos: o app manda só o que mudou (?mesclar=1) e o servidor junta ao que está gravado; dois aparelhos mexendo em chaves diferentes não se sobrescrevem;
//  - lote (transferência PJ/PF): com a versão lida (`base`), se alguém alterou o registro em outro aparelho o lote inteiro é recusado (409) e nada é apagado.
import { createRequire } from 'node:module';
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.72' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const doc = async (col, id) => { const l = await f('GET', '/api/db/' + col); return (l.j.docs || []).find((d) => d.id === id); };
for (const col of ['despesas', 'receitasManuais']) for (const d of (await f('GET', '/api/db/' + col)).j.docs) await f('DELETE', '/api/db/' + col + '/' + d.id);

console.log('\n— configuração da obra: gravação por chave');
await f('PUT', '/api/db/config/obra', { nome: 'Casa', etapas: [{ id: 'e1', nome: 'Terraplanagem' }], financiamento: { banco: 'Sicoob', valor: 300000 }, checklist: [] });
const a = await f('PUT', '/api/db/config/obra?mesclar=1', { etapas: [{ id: 'e1', nome: 'Terraplanagem' }, { id: 'e2', nome: 'Fundação' }] });
const b = await f('PUT', '/api/db/config/obra?mesclar=1', { financiamento: { banco: 'Caixa', valor: 280000 } });
const o = (await doc('config', 'obra')).data;
check(a.s === 200 && b.s === 200 && o.etapas.length === 2 && o.financiamento.banco === 'Caixa' && o.nome === 'Casa', 'o aparelho A mexeu nas etapas e o B no financiamento: as duas mudanças ficam e o resto do documento não se perde');
check(b.j.doc && b.j.doc.etapas.length === 2, 'o servidor devolve o documento já juntado, para a tela conferir');
const c1 = await f('PUT', '/api/db/config/obra', { nome: 'Casa', etapas: [], financiamento: {}, checklist: [] });
check(c1.s === 200 && (await doc('config', 'obra')).data.etapas.length === 0, 'a gravação completa de antes continua funcionando (compatível com aparelhos ainda não atualizados)');
await f('PUT', '/api/db/config/extratos?mesclar=1', { pastaId: 'p1' }); await f('PUT', '/api/db/config/extratos?mesclar=1', { dataCorte: '2026-01-01' });
const ex = (await doc('config', 'extratos')).data; check(ex.pastaId === 'p1' && ex.dataCorte === '2026-01-01', 'o mesmo vale para a configuração dos extratos');
check((await f('PUT', '/api/db/despesas/zz?mesclar=1', { a: 1 })).s === 200 && (await doc('despesas', 'zz')).data.a === 1, 'fora da configuração, "mesclar" é ignorado (grava normal)');
await f('DELETE', '/api/db/despesas/zz');

console.log('\n— lote com versão esperada');
await f('PUT', '/api/db/despesas/ld1', { nome: 'Despesa do lote', coluna: 'pj', tipo: 'unica', valorPadrao: 100, criadoEm: agora });
await f('PUT', '/api/db/receitasManuais/lr1', { nome: 'Receita do lote', coluna: 'pf', valor: 100, data: agora.slice(0, 10), mesReferencia: agora.slice(0, 7), criadoEm: agora });
const v1 = (await doc('despesas', 'ld1')).v, w1 = (await doc('receitasManuais', 'lr1')).v;
await f('PUT', '/api/db/despesas/ld1', { nome: 'Despesa do lote (alterada em outro aparelho)', coluna: 'pj', tipo: 'unica', valorPadrao: 120, criadoEm: agora });
r = await f('POST', '/api/lote', { ops: [{ acao: 'excluir', colecao: 'despesas', id: 'ld1', base: v1 }, { acao: 'excluir', colecao: 'receitasManuais', id: 'lr1', base: w1 }] });
check(r.s === 409 && r.j.error.code === 'conflict' && r.j.id === 'ld1', 'excluir em lote um registro que mudou em outro aparelho é recusado (409), apontando qual');
check(!!(await doc('despesas', 'ld1')) && !!(await doc('receitasManuais', 'lr1')), 'e nada é apagado, nem o registro que estava em dia (o lote é tudo ou nada)');
const v2 = (await doc('despesas', 'ld1')).v;
r = await f('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'despesas', id: 'ld1', dados: { nome: 'x', coluna: 'pj', tipo: 'unica', valorPadrao: 1 }, base: v1 }] });
check(r.s === 409, 'gravar em lote com a versão antiga também é recusado');
r = await f('POST', '/api/lote', { ops: [{ acao: 'excluir', colecao: 'despesas', id: 'ld1', base: v2 }, { acao: 'excluir', colecao: 'receitasManuais', id: 'lr1', base: w1 }] });
check(r.s === 200 && !(await doc('despesas', 'ld1')) && !(await doc('receitasManuais', 'lr1')), 'com as versões em dia o lote apaga os dois de uma vez');
r = await f('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'despesas', id: 'ld2', dados: { nome: 'sem base', coluna: 'pj', tipo: 'unica', valorPadrao: 5, criadoEm: agora } }, { acao: 'gravar', colecao: 'receitasManuais', id: 'lr2', dados: { nome: 'sem base', coluna: 'pf', valor: 5, data: agora.slice(0, 10), mesReferencia: agora.slice(0, 7), criadoEm: agora } }] });
check(r.s === 200 && !!(await doc('despesas', 'ld2')), 'sem versão informada (aparelho antigo), o lote continua funcionando e continua atômico');
await f('DELETE', '/api/db/despesas/ld2'); await f('DELETE', '/api/db/receitasManuais/lr2');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
