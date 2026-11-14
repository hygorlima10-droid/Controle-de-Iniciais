// Testa os repasses entre advogados (Fase 5, etapa 5.6, servidor): quem vê, quem cria e quem muda cada situação.
// Banco semeado do grupo 'permissoes':  node test/rodar.mjs repasses
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), caio = quem('caio');
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
for (const d of (await dono('GET', '/api/db/repasses')).j.docs) await dono('DELETE', '/api/db/repasses/' + d.id);
const D = { dono: { oab: '60456/GO', nome: 'Hygor Lima Andrade' }, ana: { oab: '11111/GO', nome: 'Ana Advogada' }, bruno: { oab: '22222/GO', nome: 'Bruno Advogado' } };
const rp = (de, para, o = {}) => Object.assign({ docTipo: 'caso', docId: 'c1', chave: 'caso|c1|p3', valor: 700, cliente: 'Cliente Um', processo: '0000001-11.2024.8.09.0001', label: 'Parcela 3/5', de: D[de], para: D[para], status: 'pendente', criadoEm: new Date().toISOString() }, o);
const ids = (r) => (r.j && r.j.docs ? r.j.docs.map((d) => d.id).sort().join(',') : '?' + r.s);

console.log('\n— criar');
const r1 = await ana('POST', '/api/db/repasses', rp('ana', 'dono'));
check(r1.s === 200 && (await ana('POST', '/api/db/repasses', { ...rp('ana', 'dono'), valor: 0 })).s === 403 && (await ana('POST', '/api/db/repasses', { ...rp('ana', 'dono'), status: 'qualquer' })).s === 403, 'advogado cria o repasse ao marcar o recebimento (valor e situação são conferidos)');
check((await caio('POST', '/api/db/repasses', rp('ana', 'dono'))).s === 403 && ids(await caio('GET', '/api/db/repasses')) === '', 'estagiário não cria nem vê repasses');
const r2 = await bruno('POST', '/api/db/repasses', rp('bruno', 'ana', { valor: 300, chave: 'caso|c1|p4' }));

console.log('\n— quem vê');
check(ids(await ana('GET', '/api/db/repasses')) === [r1.j.id, r2.j.id].sort().join(','), 'Ana vê o que ela paga e o que ela recebe');
check(ids(await bruno('GET', '/api/db/repasses')) === r2.j.id, 'Bruno vê só o dele');
check(ids(await dono('GET', '/api/db/repasses')) === [r1.j.id, r2.j.id].sort().join(','), 'o proprietário vê todos');

console.log('\n— situações');
const g = async (n, id) => (await n('GET', '/api/db/repasses')).j.docs.find((d) => d.id === id).data;
const atual = await g(ana, r1.j.id);
check((await bruno('PUT', '/api/db/repasses/' + r1.j.id, { ...atual, status: 'feito' })).s === 404, 'quem não é parte não mexe');
check((await dono('PUT', '/api/db/repasses/' + r1.j.id, { ...atual, status: 'feito' })).s === 200, 'o proprietário (como sempre) mexe em tudo');
await dono('PUT', '/api/db/repasses/' + r1.j.id, { ...atual, status: 'pendente' });
check((await ana('PUT', '/api/db/repasses/' + r1.j.id, { ...atual, status: 'confirmado' })).s === 403, 'quem paga não confirma o próprio repasse');
check((await ana('PUT', '/api/db/repasses/' + r1.j.id, { ...atual, status: 'feito' })).s === 200, 'quem paga marca "já repassei" (pendente → feito)');
const feito = await g(ana, r1.j.id);
check((await ana('PUT', '/api/db/repasses/' + r1.j.id, { ...feito, valor: 999 })).s === 403, 'valor e partes não mudam depois de criado');
const a2 = await g(bruno, r2.j.id);
check((await bruno('PUT', '/api/db/repasses/' + r2.j.id, { ...a2, status: 'confirmado' })).s === 403 && (await ana('PUT', '/api/db/repasses/' + r2.j.id, { ...a2, status: 'feito' })).s === 403, 'só quem paga marca feito, só quem recebe confirma');
check((await ana('PUT', '/api/db/repasses/' + r2.j.id, { ...a2, status: 'confirmado' })).s === 200, 'quem recebe confirma (mesmo sem o "já repassei" do outro lado)');
check((await bruno('PUT', '/api/db/repasses/' + r2.j.id, { ...await g(bruno, r2.j.id), status: 'cancelado' })).s === 403, 'repasse já confirmado não se cancela');
check((await dono('PUT', '/api/db/repasses/' + r1.j.id, { ...feito, status: 'pendente' })).s === 200 && (await ana('PUT', '/api/db/repasses/' + r1.j.id, { ...feito, status: 'cancelado', valor: 700 })).s === 200, 'quem recebe devolve ("ainda não recebi") e quem paga cancela (recebimento desfeito)');
check((await ana('DELETE', '/api/db/repasses/' + r1.j.id)).s === 403, 'advogado não exclui repasse (só cancela)');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
