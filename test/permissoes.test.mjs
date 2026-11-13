// Testa a política de acesso por papel (Fase 5, etapa 5.1): proprietário, advogado (por participação) e estagiário.
// Banco semeado com test/semente-permissoes.sql (cinco pessoas com sessão pronta). O test/rodar.mjs sobe o servidor:  node test/rodar.mjs permissoes
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004', dani: 'tok-est-dani-0000000000000000000000005', edu: 'tok-est-edu-00000000000000000000000000006' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), caio = quem('caio'), dani = quem('dani'), edu = quem('edu');
const ids = (r) => (r.j && r.j.docs ? r.j.docs.map((d) => d.id).sort().join(',') : '?' + r.s);

console.log('\n— quem é quem');
check((await ana('GET', '/api/eu')).j.papel === 'advogado' && (await ana('GET', '/api/eu')).j.oabs[0] === '11111/GO', 'o servidor informa papel e OABs da advogada');
check((await caio('GET', '/api/eu')).j.permissoes.excluir === false && (await dani('GET', '/api/eu')).j.permissoes.excluir === true && (await dono('GET', '/api/eu')).j.permissoes.excluir === true, 'permissão de excluir: desligada por padrão, ligada para a Dani e para o proprietário');

console.log('\n— áreas só do proprietário (advogado e estagiário recebem 403)');
for (const [nome, u] of [['advogada', ana], ['estagiário', caio]]) {
  let tudo = true; const lista = [];
  for (const p of ['/api/db/despesas', '/api/db/receitasManuais', '/api/db/saldos', '/api/db/metas', '/api/db/extratos', '/api/db/obraMov', '/api/db/configDono', '/api/db/config/planejamento', '/api/db/config/importacaoAuto', '/api/backup', '/api/backups', '/api/lixeira', '/api/auditoria', '/api/seguranca', '/api/ler', '/api/recebidos', '/api/datajud/x', '/api/notif/x', '/api/restaurar']) { const r = await u('GET', p); if (r.s !== 403 && r.s !== 404 && r.s !== 405) { tudo = false; lista.push(p + '=' + r.s); } }
  check(tudo, nome + ' não abre finanças, configurações, backup, lixeira, registro de ações nem Diário/DataJud' + (lista.length ? ' → ' + lista.join(' ') : ''));
  check((await u('POST', '/api/db/despesas', { descricao: 'x', valor: 1 })).s === 403 && (await u('PUT', '/api/db/configDono/planejamento', { x: 2 })).s === 403 && (await u('PUT', '/api/db/config/planejamento', { x: 2 })).s === 403 && (await u('PUT', '/api/db/config/importacaoAuto', { ativo: false })).s === 403, nome + ' não grava finanças nem configurações');
  check((await u('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'despesas', id: 'zz', dados: { v: 1 } }] })).s === 403, nome + ' não grava finanças pelo lote');
}
check((await dono('GET', '/api/db/despesas')).j.docs.length === 1 && (await dono('GET', '/api/db/config/planejamento')).s !== 403, 'o proprietário continua abrindo tudo');
check((await ana('PUT', '/api/db/config/personalizacao', { tema: 'escuro' })).s === 200 && ids(await ana('GET', '/api/db/config')) === 'personalizacao', 'a preferência de aparência (personalização) é liberada, e só ela aparece na lista de config');

console.log('\n— jurídico: o advogado vê só onde está cadastrado');
check(ids(await dono('GET', '/api/db/casos')) === 'c1,c2,c3,c4,c5', 'proprietário vê todas as Iniciais');
check(ids(await ana('GET', '/api/db/casos')) === 'c1,c3,c5', 'Ana vê só as Iniciais dela (c1, c3 — compartilhada — e c5)');
check(ids(await bruno('GET', '/api/db/casos')) === 'c2,c3', 'Bruno vê só as dele (c2 e c3)');
check(ids(await ana('GET', '/api/db/termosAcordo')) === 'a1' && ids(await bruno('GET', '/api/db/termosAcordo')) === 'a2', 'Acordos por participação');
check(ids(await ana('GET', '/api/db/alvaras')) === '' && ids(await bruno('GET', '/api/db/alvaras')) === 'v1', 'Alvarás por participação');
check(ids(await ana('GET', '/api/db/processos')) === 'p1' && ids(await bruno('GET', '/api/db/processos')) === 'p2', 'Processos por participação');
check(ids(await ana('GET', '/api/db/clientes')) === 'cl1' && ids(await bruno('GET', '/api/db/clientes')) === 'cl1,cl2', 'cada advogado vê só os clientes ligados aos seus processos (o Bruno também vê o cl1 porque está na Inicial c3 dele)');
check(!ids(await ana('GET', '/api/db/casos')).includes('c4') && !ids(await bruno('GET', '/api/db/casos')).includes('c4'), 'registro sem advogado definido fica só com o proprietário (e o estagiário)');
const rs = await ana('GET', '/api/db/casos?resumo=1'); check(rs.j.n === 3, 'o "resumo" da lista conta só o que a pessoa pode ver (3)');
const pg = await ana('GET', '/api/db/casos?limit=2'); check(pg.j.docs.length === 2 && pg.j.mais === true && ids(await ana('GET', '/api/db/casos?limit=2&after=' + pg.j.docs[1].id)) === 'c5', 'paginação continua funcionando com o filtro');
check(ids(await ana('GET', '/api/db/agenda')) === 'g2,g3,g4' && ids(await bruno('GET', '/api/db/agenda')) === 'g2', 'agenda: a própria, as compartilhadas e as de processos em que participa');
check(ids(await caio('GET', '/api/db/casos')) === 'c1,c2,c3,c4,c5' && ids(await caio('GET', '/api/db/clientes')) === 'cl1,cl2,cl3' && ids(await caio('GET', '/api/db/agenda')) === 'g1,g2,g3,g4', 'estagiário vê o escritório inteiro');

console.log('\n— gravação do advogado');
check((await bruno('PUT', '/api/db/casos/c1', { cliente: 'x', advogados: [{ oab: '22222/GO' }] })).s === 404, 'não altera registro de outro advogado');
check((await bruno('DELETE', '/api/db/casos/c1')).s === 404 || (await bruno('DELETE', '/api/db/casos/c1')).s === 403, 'não exclui registro de outro advogado');
check((await ana('PUT', '/api/db/casos/c5', { cliente: 'Cliente Um', numeroProcesso: '0000005-55.2024.8.09.0005', advogados: [{ oab: '22222/GO' }] })).s === 403, 'não se retira do registro ao salvar (processo em que só ela está)');
check((await ana('PUT', '/api/db/casos/c1', { cliente: 'Cliente Um', numeroProcesso: '0000001-11.2024.8.09.0001', advogados: [{ oab: '22222/GO' }] })).s === 200, 'já no processo 0000001, em que ela também está no Acordo e no cadastro, o registro dela pode mudar de advogado: o processo continua dela');
check((await ana('PUT', '/api/db/casos/c1', { cliente: 'Cliente Um alterado', numeroProcesso: '0000001-11.2024.8.09.0001', advogados: [{ oab: '11111/GO', nome: 'Ana' }] })).s === 200, 'altera o que é dela');
check((await ana('POST', '/api/db/casos', { cliente: 'Sem responsável', numeroProcesso: '0000009-99.2024.8.09.0009' })).s === 400, 'quem cadastra precisa escolher os advogados responsáveis (o app não inclui ninguém sozinho)');
const nov = await ana('POST', '/api/db/casos', { cliente: 'Novo', numeroProcesso: '0000009-99.2024.8.09.0009', advogados: [{ oab: '11111/GO', nome: 'Ana' }, { oab: '22222/GO', nome: 'Bruno' }] });
check(nov.s === 200 && ids(await bruno('GET', '/api/db/casos')).includes(nov.j.id), 'ao escolher os responsáveis, o registro aparece para cada um deles');
check((await ana('DELETE', '/api/db/casos/' + nov.j.id)).s === 403, 'advogado também só exclui com permissão (desligada por padrão)');
check((await ana('PUT', '/api/db/casos/c5', { cliente: 'Cliente Um', advogados: [{ oab: '11111/GO' }], parcelas: [{ numero: 1, valor: 100, pago: true, dataRecebimento: '2026-01-10', recebidoEm: '2026-01-10T10:00:00Z' }, { numero: 2, valor: 100, pago: true, dataRecebimento: '2026-11-11' }] })).s === 200, 'o advogado marca recebimento no processo em que participa');
const ag = await ana('POST', '/api/db/agenda', { tipo: 'tarefa', titulo: 'Minha', data: '2026-11-14' });
check(ag.s === 200 && ids(await bruno('GET', '/api/db/agenda')) === 'g2' && (await ana('GET', '/api/db/agenda')).j.docs.find((d) => d.id === ag.j.id).data.criadoPor === 'u2', 'tarefa nova é só de quem criou (carimbo de autor)');
check((await ana('PUT', '/api/db/agenda/g2', { tipo: 'tarefa', titulo: 'mexeu', compartilhada: true })).s === 403, 'tarefa compartilhada de outro só quem criou altera');
console.log('\n— tarefas: autoria vale para todos os papéis; concluir tarefa compartilhada vale para quem a vê (auditoria F-02)');
const g2 = { tipo: 'tarefa', titulo: 'Compartilhada', criadoPor: 'u1', compartilhada: true, data: '2026-11-12' };
check((await ana('PUT', '/api/db/agenda/g2', { ...g2, concluido: true, situacao: 'feito', concluidoPor: 'Ana Advogada', concluidoEm: '2026-11-12' })).s === 200, 'advogada que vê uma tarefa compartilhada de outro pode CONCLUIR (só os campos de conclusão mudam)');
check((await caio('PUT', '/api/db/agenda/g2', { ...g2, concluido: false, situacao: 'afazer', concluidoPor: '', concluidoEm: '' })).s === 200, 'estagiário também pode reabri-la');
check((await caio('PUT', '/api/db/agenda/g2', { ...g2, titulo: 'mexeu' })).s === 403 && (await caio('PUT', '/api/db/agenda/g2', { ...g2, titulo: 'mexeu', concluido: true })).s === 403, 'estagiário não muda o conteúdo da tarefa compartilhada de outro (nem junto com a conclusão)');
check((await caio('PUT', '/api/db/agenda/g4', { tipo: 'tarefa', titulo: 'invadida', data: '2026-11-12', criadoPor: 'u2' })).s === 403 && (await dani('DELETE', '/api/db/agenda/g4')).s === 403, 'estagiário não altera nem exclui a tarefa de outra pessoa (mesmo com a permissão de excluir)');
check((await caio('PUT', '/api/db/agenda/g3', { tipo: 'prazo', titulo: 'Prazo do processo Um', processo: '0000001-11.2024.8.09.0001', data: '2026-11-13', obs: 'ajustado pelo estagiário' })).s === 200, 'prazo de um processo o estagiário altera (ele trabalha em todos os processos)');
await dono('PUT', '/api/db/agenda/gx1', { tipo: 'tarefa', titulo: 'do processo', processo: '0000001-11.2024.8.09.0001', data: '2026-11-15', criadoPor: 'u1' });
const gxp = await dani('POST', '/api/db/agenda', { tipo: 'tarefa', titulo: 'da Dani', data: '2026-11-16' });
check((await dani('DELETE', '/api/db/agenda/' + gxp.j.id)).s === 200 && (await dani('DELETE', '/api/db/agenda/gx1')).s === 200, 'com a permissão, o estagiário exclui a própria tarefa e a de um processo');
check((await ana('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'casos', id: 'c2', dados: { cliente: 'x', advogados: [{ oab: '11111/GO' }] } }] })).s === 404, 'o lote segue as mesmas regras');

console.log('\n— estagiário: publicações e agendas de todo o escritório (com opção de desligar)');
check((await caio('GET', '/api/eu')).j.permissoes.verPublicacoes === true && (await caio('GET', '/api/eu')).j.permissoes.verAgendas === true, 'estagiário já vem com publicações e agendas ligadas');
check((await caio('GET', '/api/djen/lista')).s === 200 && (await caio('GET', '/api/djen/estado')).s === 200, 'estagiário lê as publicações');
check((await caio('POST', '/api/djen/buscar', {})).s === 403 && (await caio('PUT', '/api/djen/oabs', {})).s === 403 && (await caio('POST', '/api/djen/advogados', {})).s === 403 && (await caio('POST', '/api/djen/importar', {})).s === 403, 'mas não busca, não importa nem altera as OABs');
check((await ana('GET', '/api/djen/lista')).s === 200 && (await ana('POST', '/api/djen/buscar', {})).s === 403 && (await ana('PUT', '/api/djen/oabs', {})).s === 403, 'advogado lê as publicações (filtradas por OAB, ver teste publicacoes-acesso) mas não busca nem altera OABs');
check((await edu('GET', '/api/djen/lista')).s === 403, 'com a permissão desligada, o estagiário não abre as publicações');
check(ids(await edu('GET', '/api/db/agenda')) === 'g2,g3' && ids(await edu('GET', '/api/db/casos')).includes('c4') && ids(await edu('GET', '/api/db/casos')).includes('c2'), 'com a de agendas desligada ele vê só a própria, as compartilhadas e as de processos (g1 do dono e g4 da Ana, particulares, somem), mas o resto do escritório continua');
console.log('\n— estagiário');
check((await caio('POST', '/api/db/casos', { cliente: 'Do estagiário', numeroProcesso: '0000008-88.2024.8.09.0008' })).s === 200, 'estagiário lança Inicial');
check((await caio('PUT', '/api/db/casos/c1', { cliente: 'Editado pelo estagiário', numeroProcesso: '0000001-11.2024.8.09.0001', advogados: [{ oab: '11111/GO' }] })).s === 200, 'estagiário edita registro de qualquer advogado');
check((await caio('PUT', '/api/db/casos/c5', { cliente: 'Cliente Um', advogados: [{ oab: '11111/GO' }], parcelas: [{ numero: 1, valor: 100, pago: true, dataRecebimento: '2026-01-10', recebidoEm: '2026-01-10T10:00:00Z' }, { numero: 2, valor: 100, pago: true }, { numero: 3, valor: 50 }] })).s === 403, 'estagiário NÃO marca recebimento');
check((await caio('PUT', '/api/db/casos/c5', { cliente: 'Cliente Um', advogados: [{ oab: '11111/GO' }], parcelas: [{ numero: 1, valor: 100 }, { numero: 2, valor: 100 }] })).s === 403, 'estagiário NÃO desmarca recebimento');
check((await caio('PUT', '/api/db/casos/c5', { cliente: 'Cliente Um', advogados: [{ oab: '11111/GO' }], parcelas: [{ numero: 1, valor: 120, pago: true, dataRecebimento: '2026-01-10', recebidoEm: '2026-01-10T10:00:00Z' }, { numero: 2, valor: 100, pago: true, dataRecebimento: '2026-11-11' }, { numero: 3, valor: 50 }] })).s === 200, 'estagiário pode mudar valor/parcelas se os recebimentos continuam iguais');
check((await caio('POST', '/api/db/casos', { cliente: 'Já pago', parcelas: [{ numero: 1, valor: 10, pago: true }] })).s === 403, 'estagiário não cria registro já recebido');
check((await caio('DELETE', '/api/db/casos/c4')).s === 403, 'estagiário não exclui (permissão desligada)');
check((await dani('DELETE', '/api/db/casos/c4')).s === 200, 'estagiária com a permissão "excluir" exclui (e vai para a lixeira)');
check((await dono('GET', '/api/lixeira')).j && JSON.stringify((await dono('GET', '/api/lixeira')).j).includes('c4'), 'a exclusão feita por ela foi para a lixeira');

console.log('\n— o proprietário não perde nada');
check((await dono('PUT', '/api/db/casos/c2', { cliente: 'Cliente Dois', numeroProcesso: '0000002-22.2024.8.09.0002', advogados: [{ oab: '22222/GO' }], obs: 'dono' })).s === 200 && (await dono('DELETE', '/api/db/agenda/g4')).s === 200, 'proprietário grava e exclui em qualquer coleção');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
