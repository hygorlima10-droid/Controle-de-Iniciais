// Dias sem expediente: todos leem (valem nos cálculos de todos), só o proprietário cadastra e remove.
// Banco semeado do grupo 'permissoes':  node test/rodar.mjs dias-permissoes
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), caio = quem('caio');
const doc = { data: '2027-09-02', nome: 'Aniversário do município', tipo: 'municipal' };
let r = await dono('PUT', '/api/db/diasSemExpediente/2027-09-02', doc);
check(r.s === 200, 'o proprietário cadastra um dia sem expediente');
r = await ana('GET', '/api/db/diasSemExpediente'); check(r.s === 200 && r.j.docs.some((d) => d.id === '2027-09-02'), 'a advogada lê o calendário (vale nos cálculos dela)');
r = await caio('GET', '/api/db/diasSemExpediente'); check(r.s === 200 && r.j.docs.length >= 1, 'o estagiário também lê');
r = await ana('PUT', '/api/db/diasSemExpediente/2027-10-01', { ...doc, data: '2027-10-01' }); check(r.s === 403, 'a advogada não cadastra');
r = await caio('PUT', '/api/db/diasSemExpediente/2027-10-01', { ...doc, data: '2027-10-01' }); check(r.s === 403, 'o estagiário não cadastra');
r = await ana('PUT', '/api/db/diasSemExpediente/2027-09-02', { ...doc, nome: 'mudei' }); check(r.s === 403 && (await dono('GET', '/api/db/diasSemExpediente')).j.docs.find((d) => d.id === '2027-09-02').data.nome === 'Aniversário do município', 'ninguém além do proprietário altera um dia já cadastrado');
r = await ana('DELETE', '/api/db/diasSemExpediente/2027-09-02'); check(r.s === 403, 'a advogada não remove');
r = await caio('DELETE', '/api/db/diasSemExpediente/2027-09-02'); check(r.s === 403, 'o estagiário não remove');
r = await dono('DELETE', '/api/db/diasSemExpediente/2027-09-02'); check(r.s === 200 || r.s === 204, 'o proprietário remove');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
