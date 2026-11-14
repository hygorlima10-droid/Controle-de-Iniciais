// Testa os advogados responsáveis (Fase 5, etapa 5.4): lista da equipe, registros sem advogado, sugestão e definição em lote.
// Servidor do grupo 'permissoes' (banco semeado):  node test/rodar.mjs responsaveis
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), caio = quem('caio'); TOK.bruno = 'tok-adv-bruno-000000000000000000000003';

console.log('\n— equipe (para os seletores)');
const eq = await ana('GET', '/api/equipe');
check(eq.s === 200 && eq.j.advogados.some((a) => a.oab === '11111/GO' && a.nome.startsWith('Ana')) && eq.j.advogados.some((a) => a.oab === '22222/GO') && eq.j.advogados.some((a) => a.oab === '60456/GO'), 'qualquer pessoa logada recebe a lista de advogados do escritório (nome e OAB)');
check(!JSON.stringify(eq.j).includes('@') && (await caio('GET', '/api/equipe')).s === 200, 'sem e-mails; estagiário também recebe');

console.log('\n— registros sem advogado (só o proprietário)');
check((await ana('GET', '/api/sem-advogado')).s === 403 && (await caio('POST', '/api/sem-advogado', {})).s === 403, 'advogado e estagiário não abrem a revisão');
await dono('PUT', '/api/db/casos/t1', { cliente: 'Cliente Sete', numeroProcesso: '0000070-70.2024.8.09.0070', advogados: [{ oab: '11111/GO', nome: 'Ana' }] });
await dono('PUT', '/api/db/casos/t2', { cliente: 'Cliente Sete', numeroProcesso: '0000070-70.2024.8.09.0070' });
await dono('PUT', '/api/db/termosAcordo/s1', { cliente: 'Cliente Seis', advogados: [{ oab: '22222/GO', nome: 'Bruno' }] });
await dono('PUT', '/api/db/termosAcordo/s2', { cliente: 'Cliente Seis' });
await dono('PUT', '/api/db/alvaras/v9', { cliente: 'Cliente Oito', numeroProcesso: '0000080-80.2024.8.09.0080', arquivado: true });
const r = await dono('GET', '/api/sem-advogado'), por = (id) => r.j.itens.find((i) => i.id === id);
check(r.s === 200 && por('s2') && por('p3') && !por('c1') && !por('v9'), 'lista só quem está sem advogado (e não arquivado)');
check(!por('t2'), 'registro sem advogado, mas de um processo em que outro registro já tem advogado, herda (não está sem advogado)');
check(por('s2').sugestao.map((x) => x.oab).join() === '22222/GO' && por('s2').motivo.includes('cliente'), 'sugestão pelos outros registros do cliente');
check(por('p3').sugestao.length === 0 && r.j.contagem.processos >= 1 && por('p3').rotulo === 'Processo', 'sem base para sugerir, não inventa');

console.log('\n— definir em lote');
check((await dono('POST', '/api/sem-advogado', { itens: [{ colecao: 'casos', id: 't2' }], advogados: [] })).s === 400, 'exige ao menos um advogado');
const ap = await dono('POST', '/api/sem-advogado', { itens: [{ colecao: 'casos', id: 't2' }, { colecao: 'termosAcordo', id: 's2' }, { colecao: 'despesas', id: 'd1' }, { colecao: 'casos', id: 'nao-existe' }], advogados: [{ oab: '11111/GO' }, { oab: '22222/GO' }] });
check(ap.j.alterados === 2, 'aplica só nos itens válidos (despesa e id inexistente são ignorados)');
const t2 = (await dono('GET', '/api/db/casos')).j.docs.find((d) => d.id === 't2').data;
check(t2.advogados.map((a) => a.oab).join() === '11111/GO,22222/GO' && t2.advogados[0].nome.startsWith('Ana') && t2.cliente === 'Cliente Sete', 'grava os advogados (com o nome do escritório) e preserva o resto do registro');
check(!(await dono('GET', '/api/sem-advogado')).j.itens.some((i) => i.id === 't2' || i.id === 's2'), 'sai da lista de pendentes');

console.log('\n— o processo é a unidade (visibilidade pelo número)');
await dono('PUT', '/api/db/termosAcordo/h1', { partes: 'Herdado', numeroProcesso: '0000001-11.2024.8.09.0001', clienteIds: ['cl9'] });
await dono('PUT', '/api/db/clientes/cl9', { nome: 'Cliente Nove' });
const veAna = (await ana('GET', '/api/db/termosAcordo')).j.docs.map((d) => d.id), veBruno = (await quem('bruno')('GET', '/api/db/termosAcordo')).j.docs.map((d) => d.id);
check(veAna.includes('h1') && !veBruno.includes('h1'), 'a Ana vê o Acordo sem advogado porque o mesmo processo tem Inicial dela (o Bruno, não)');
check((await ana('GET', '/api/db/clientes')).j.docs.some((d) => d.id === 'cl9'), 'e vê o cliente desse Acordo');
check((await ana('PUT', '/api/db/termosAcordo/h1', { partes: 'Herdado 2', numeroProcesso: '0000001-11.2024.8.09.0001', clienteIds: ['cl9'] })).s === 200, 'e pode alterá-lo (sem precisar estar marcada nele)');
check((await ana('POST', '/api/db/termosAcordo', { partes: 'Novo do mesmo processo', numeroProcesso: '0000001-11.2024.8.09.0001' })).s === 200 && (await ana('POST', '/api/db/termosAcordo', { partes: 'Outro processo', numeroProcesso: '0000999-99.2024.8.09.0999' })).s === 400, 'cadastrar sem escolher advogado vale se o processo já tem ela; num processo novo precisa escolher');
check((await ana('GET', '/api/db/termosAcordo')).j.docs.some((d) => d.id === 's2'), 'e passa a aparecer para o advogado escolhido');
check(JSON.stringify((await dono('GET', '/api/auditoria')).j).includes('Cliente Sete'), 'fica no registro de ações');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
