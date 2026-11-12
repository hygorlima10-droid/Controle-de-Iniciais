// Testa a Agenda por pessoa (Fase 5, etapa 5.5, servidor): responsáveis (resp) decidem quem vê e quem altera; carga por pessoa sem vazar conteúdo.
// Banco semeado do grupo 'permissoes':  node test/rodar.mjs agenda-resp
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', edu: 'tok-est-edu-00000000000000000000000000006' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), edu = quem('edu');
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), em = (n) => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const N1 = '0000001-11.2024.8.09.0001', N2 = '0000002-22.2024.8.09.0002';
for (const d of (await dono('GET', '/api/db/agenda')).j.docs) await dono('DELETE', '/api/db/agenda/' + d.id);
const ag = (id, o) => dono('PUT', '/api/db/agenda/' + id, Object.assign({ tipo: 'prazo', situacao: 'afazer', concluido: false, data: em(1), criadoPor: 'u1' }, o));
await ag('r10', { titulo: 'SEGREDO-10 prazo do processo do Bruno', processo: N2, resp: ['u:u6'] });
await ag('r11', { tipo: 'tarefa', titulo: 'SEGREDO-11 tarefa da Ana', resp: ['11111/GO'], data: em(2) });
await ag('r12', { tipo: 'tarefa', titulo: 'SEGREDO-12 tarefa só do dono' });
await ag('r13', { titulo: 'SEGREDO-13 prazo do processo da Ana (sem responsável)', processo: N1, data: em(2) });
await ag('r14', { titulo: 'SEGREDO-14 já concluído', processo: N1, concluido: true });
await ag('r15', { titulo: 'SEGREDO-15 longe demais', processo: N1, data: em(40) });
await ag('r16', { tipo: 'tarefa', titulo: 'SEGREDO-16 do escritório', compartilhada: true, data: em(3) });
const ids = (r) => (r.j && r.j.docs ? r.j.docs.map((d) => d.id).sort().join(',') : '?' + r.s);

console.log('\n— quem vê');
check(ids(await ana('GET', '/api/db/agenda')) === 'r11,r13,r14,r15,r16', 'Ana vê a tarefa em que é responsável (r11), os prazos do processo dela e a tarefa do escritório; não vê o prazo do processo do Bruno nem a tarefa só do dono');
check(ids(await bruno('GET', '/api/db/agenda')) === 'r10,r16', 'Bruno vê o prazo do processo dele e a do escritório, não a tarefa da Ana');
check(ids(await edu('GET', '/api/db/agenda')) === 'r10,r13,r14,r15,r16', 'estagiário com "ver agendas" desligado vê o que o escolheu como responsável (r10), os prazos de processos e a tarefa do escritório; não vê as tarefas pessoais de ninguém (r11, r12)');

console.log('\n— quem altera');
check((await ana('PUT', '/api/db/agenda/r11', { tipo: 'tarefa', titulo: 'SEGREDO-11 editada', resp: ['11111/GO'], data: em(2), concluido: true, concluidoPor: 'Ana Advogada' })).s === 200, 'o responsável altera e conclui (um só "concluído" para todos)');
check((await bruno('PUT', '/api/db/agenda/r11', { tipo: 'tarefa', titulo: 'x' })).s === 404, 'quem não vê não altera');
check((await edu('PUT', '/api/db/agenda/r10', { tipo: 'prazo', titulo: 'SEGREDO-10 editado pelo estagiário', processo: N2, resp: ['u:u6'], data: em(1) })).s === 200, 'o estagiário responsável também altera');
const r11 = (await dono('GET', '/api/db/agenda')).j.docs.find((d) => d.id === 'r11').data;
check(r11.concluido === true && r11.concluidoPor === 'Ana Advogada' && r11.resp[0] === '11111/GO' && r11.criadoPor === 'u1', 'fica gravado quem concluiu, os responsáveis e o autor original');
await ag('r11', { tipo: 'tarefa', titulo: 'SEGREDO-11 tarefa da Ana', resp: ['11111/GO'], data: em(2) });   // reabre para a contagem

console.log('\n— carga por pessoa (todos veem, sem conteúdo)');
const c = await bruno('GET', '/api/agenda/carga'), j = c.j, p = (k) => j.pessoas.find((x) => x.chave === k);
check(c.s === 200 && j.dias === 7 && j.inicio === hoje && j.pessoas.length >= 3, 'qualquer pessoa logada recebe a carga dos próximos 7 dias');
check(p('11111/GO').total === 2 && p('11111/GO').dias[2] === 2, 'Ana: a tarefa em que é responsável + o prazo sem responsável do processo dela (vai para os advogados do processo): 2 itens, ambos no dia +2');
check(p('u:u6') && p('u:u6').nome === 'Edu Estagiario' && p('u:u6').total === 1 && p('22222/GO').total === 0, 'o responsável explícito (estagiário) leva o prazo, e o advogado do processo não conta o que foi dado a outro');
check(!JSON.stringify(j).includes('SEGREDO') && !JSON.stringify(j).includes('r1'), 'a resposta não traz título, id nem processo de nenhum item');
check(j.pessoas.reduce((t, x) => t + x.total, 0) === 4, 'não contam: concluído, longe demais e a tarefa só do dono; a tarefa do escritório sem responsável conta para quem a criou (4 itens no total)');
check(!(p('11111/GO').dias.slice(3).some((n) => n)), 'cada item cai no dia certo');
check((await edu('GET', '/api/agenda/carga')).s === 200 && (await ana('GET', '/api/agenda/carga?dias=14')).j.dias === 14, 'estagiário também vê; dá para pedir até 14 dias');

console.log('\n— equipe para os seletores');
const eq = await ana('GET', '/api/equipe');
check(eq.j.estagiarios.some((e) => e.id === 'u6' && e.nome === 'Edu Estagiario') && eq.j.estagiarios.length >= 3 && !JSON.stringify(eq.j).includes('@'), '/api/equipe traz também os estagiários ativos (id e nome), sem e-mails');
check((await ana('GET', '/api/eu')).j.id === 'u2', '/api/eu informa o id (para reconhecer "eu" como responsável)');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
