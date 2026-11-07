// Testa a Agenda (prazos, audiências, tarefas), o cartão de prazos no Início, a migração dos prazos antigos,
// o nome "Iniciais" e o menu lateral que não rola de lado.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.8' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov', 'prazosPub', 'agenda']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('PUT', '/api/db/casos/c1', { tipo: 'inicial', cliente: 'Maquele Viana Pacheco', nomeAcao: 'Declaratória', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 3000, parcelas: [{ numero: 1, valor: 3000, data: dia(30), pago: false }], numeroProcesso: '5368644-67.2026.8.09.0107', prazo: { data: dia(3), descricao: 'Réplica à contestação', concluido: false }, clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await f('POST', '/api/db/prazosPub', { pubId: '900002', processo: '5593217-64.2021.8.09.0107', cliente: 'Cooperativa Mista', descricao: 'Recolher o sistema', dias: 15, contagem: 'uteis', disp: dia(-5), inicio: dia(-3), data: dia(2), concluido: false, criadoEm: agora });

// unidade: quem recebe aviso hoje
const { prazosDoDia, montarNotificacoes } = await import('../src/index.js');
const prz = [{ d: hoje, h: '14:30', n: 'Fulano', l: 'Audiência', t: 'audiencia', a: [5, 2, 1, 0] }, { d: dia(2), n: 'Osmar', l: 'Manifestar sobre laudo', t: 'prazo', a: [5, 2, 1, 0] }, { d: dia(3), n: 'Maquele', l: 'Réplica', t: 'prazo', a: [5, 2, 1, 0] }, { d: dia(1), n: 'Só no dia', l: 'Tarefa', t: 'tarefa', a: [0] }, { d: dia(5), n: 'Cinco', l: 'Recurso', t: 'prazo' }, { d: dia(-1), n: 'Ontem', l: 'Passado', t: 'prazo', a: [0] }];
const pd = prazosDoDia(prz, hoje);
check(pd.map(p => p.n).join(',') === 'Fulano,Osmar,Cinco', 'avisa no dia e 5, 2 e 1 dia antes; respeita "só no dia" e não avisa passados: ' + pd.map(p => p.n).join(','));
const nt = montarNotificacoes({ itens: [], alertas: [], prazos: prz }, {}, { alertas: {} }, hoje, hoje.slice(0, 7));
check(nt.length === 1 && /^Prazos: 1 vence hoje, 2 nos próximos dias$/.test(nt[0].titulo) && /Audiência · Fulano · 14:30 \(HOJE\)/.test(nt[0].corpo) && /em 2 dias/.test(nt[0].corpo), 'a notificação de prazos é separada: ' + nt[0].titulo);
check(montarNotificacoes({ itens: [], alertas: [], prazos: prz }, { esconder: true }, { alertas: {} }, hoje, hoje.slice(0, 7))[0].corpo === 'Abra o app para ver.', 'com "esconder", não mostra os nomes');
const put = await f('PUT', '/api/notif/resumo', { itens: [], alertas: [], prazos: [{ d: hoje, h: '9:5', n: 'X', l: 'Y', t: 'qualquer', a: [0, 99, 'a'] }, { d: 'lixo' }] });
check(put.s === 200 && put.j.prazos === 1, 'o servidor aceita só prazos com data válida');

// tela
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const ag = async () => (await f('GET', '/api/db/agenda')).j.docs.map(d => ({ id: d.id, ...d.data }));
let docs = await ag();
check(docs.length === 1 && docs[0].titulo === 'Recolher o sistema' && docs[0].tipo === 'prazo' && docs[0].pubId === '900002' && (await f('GET', '/api/db/prazosPub')).j.docs.length === 0, 'o prazo da primeira versão foi migrado para a Agenda e a coleção antiga ficou vazia');
const cartao = await t('#inicioPrazos');
check(/Prazos processuais/.test(cartao) && /Recolher o sistema/.test(cartao) && /Réplica à contestação/.test(cartao) && /2 prazos/.test(cartao), 'o Início mostra o cartão de prazos com a migração e o prazo da inicial: ' + cartao.replace(/\n/g, ' ').slice(0, 120));
check(!/Réplica|Recolher/.test(await t('#atencaoLista')), 'a Central de atenção ficou só com dinheiro');
// nomes
check(!/Petições/.test(await t('#drawer')) && /Iniciais/.test(await t('#drawer')) && /Agenda/.test(await t('#drawer')), 'o menu usa "Iniciais" e tem a Agenda');
check(/Iniciais/.test(await t('#btbar')) && !/Petições/.test(await t('#btbar')), 'a barra de baixo também');
// menu lateral parado e com quebra de linha
await page.click('#menuBtn'); await page.waitForTimeout(400);
const dr = await page.evaluate(() => { const d = document.getElementById('drawer'), n = d.querySelector('.dr-nav'), cs = getComputedStyle(n); return { ox: cs.overflowX, sw: n.scrollWidth, cw: n.clientWidth, dsw: d.scrollWidth, dcw: d.clientWidth, ws: getComputedStyle(d.querySelector('.dr-it')).whiteSpace }; });
check(dr.ox === 'hidden' && dr.sw <= dr.cw + 1 && dr.dsw <= dr.dcw + 1 && dr.ws === 'normal', 'o menu lateral não rola de lado e quebra linha: ' + JSON.stringify(dr));
await page.evaluate(() => { const n = document.querySelector('#drawer .dr-nav'); n.scrollLeft = 120; });
check(await page.evaluate(() => document.querySelector('#drawer .dr-nav').scrollLeft) === 0, 'mesmo arrastando de lado, o menu volta para a posição');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#drawer [data-tab="peticoes"]').click()); await page.waitForTimeout(600);
check(/Iniciais/.test(await t('#tituloTela')), 'o título da tela passou a ser "Iniciais"');
// agenda
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(900);
check(/Prazos, audiências e tarefas/.test(await t('#subtitle')) && /Semana/.test(await t('#agSeg')), 'abre a Agenda na visão Semana');
await page.click('[data-ag="vista"][data-v="lista"]'); await page.waitForTimeout(400);
let lista = await t('#agWrap');
check(/Réplica à contestação/.test(lista) && /da inicial/.test(lista) && /Recolher o sistema/.test(lista) && /via publicação/.test(lista), 'a Lista junta o prazo da inicial e o da publicação, com a origem de cada um');
await page.click('.ag-it:has-text("Réplica") [data-ag="concluir"]'); await page.waitForTimeout(900);
check((await f('GET', '/api/db/casos')).j.docs[0].data.prazo.concluido === true && !/Réplica/.test(await t('#agWrap')), 'marcar o prazo da inicial como protocolado grava na própria ação e some da lista');
// novo prazo
await page.click('[data-ag="novo"]'); await page.waitForTimeout(400);
check(await page.evaluate(() => document.getElementById('overlayAg').classList.contains('show')), 'abre o formulário de novo item');
await page.click('#age_save, [data-age="salvar"]'); await page.waitForTimeout(200);
check(/Escreva o que precisa/.test(await t('#age_erro')), 'não deixa salvar sem título');
await page.fill('#age_tit', 'Contestação'); await page.fill('#age_proc', '5368644-67.2026.8.09.0107'); await page.waitForTimeout(200);
check(/cadastrada · cliente: Maquele Viana Pacheco/.test(await t('#age_dica')) && (await page.evaluate(() => document.getElementById('age_cli').value)) === 'Maquele Viana Pacheco', 'o processo cadastrado preenche o cliente sozinho');
await page.fill('#age_data', dia(10)); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1200);
docs = await ag(); const nova = docs.find(d => d.titulo === 'Contestação');
check(nova && nova.tipo === 'prazo' && nova.data === dia(10) && nova.situacao === 'afazer' && JSON.stringify(nova.avisos) === '[5,2,1,0]' && nova.cliente === 'Maquele Viana Pacheco', 'o prazo novo é gravado com cliente e avisos padrão');
check(nova.trabalhar && nova.trabalhar < nova.data, 'sem "trabalhar até", o app marca 2 dias úteis antes do fatal: ' + nova.trabalhar);
// audiência
await page.click('[data-ag="novo"]'); await page.waitForTimeout(300); await page.click('[data-age="tipo"][data-v="audiencia"]'); await page.waitForTimeout(200);
check(await page.evaluate(() => getComputedStyle(document.getElementById('age_hora_box')).display !== 'none' && getComputedStyle(document.getElementById('age_trab_box')).display === 'none'), 'audiência pede a hora e não pede "trabalhar até"');
await page.fill('#age_tit', 'Audiência de conciliação'); await page.fill('#age_cli', 'Sergio Penido'); await page.fill('#age_data', dia(1)); await page.fill('#age_hora', '14:30'); await page.selectOption('#age_av', 'dia'); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1200);
docs = await ag(); const aud = docs.find(d => d.tipo === 'audiencia');
check(aud && aud.hora === '14:30' && aud.data === dia(1) && JSON.stringify(aud.avisos) === '[0]' && !aud.trabalhar, 'audiência gravada com hora e aviso só no dia');
// tarefa + concluir + reabrir
await page.click('[data-ag="novo"]'); await page.waitForTimeout(300); await page.click('[data-age="tipo"][data-v="tarefa"]');
await page.fill('#age_tit', 'Preparar inicial do cliente'); await page.fill('#age_data', hoje); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1200);
await page.click('.ag-it:has-text("Preparar inicial") [data-ag="concluir"]'); await page.waitForTimeout(900);
check(!/Preparar inicial/.test(await t('#agWrap')), 'tarefa concluída sai da lista');
await page.click('[data-ag="feitos"]'); await page.waitForTimeout(400);
check(/Preparar inicial/.test(await t('#agWrap')) && /Reabrir/.test(await t('#agWrap')), '"Concluídos" mostra de novo, com Reabrir');
await page.click('.ag-it:has-text("Preparar inicial") [data-ag="reabrir"]'); await page.waitForTimeout(800);
check((await ag()).find(d => d.titulo === 'Preparar inicial do cliente').concluido === false, 'Reabrir volta para a lista');
await page.click('[data-ag="feitos"]');
// filtros
await page.click('[data-ag="filtro"][data-v="audiencia"]'); await page.waitForTimeout(300);
check(/Audiência de conciliação/.test(await t('#agWrap')) && !/Contestação/.test(await t('#agWrap')), 'filtro "Audiências"');
await page.click('[data-ag="filtro"][data-v="tudo"]');
// editar
await page.click('.ag-it:has-text("Audiência de conciliação") [data-ag="abrir"]'); await page.waitForTimeout(400);
check((await page.evaluate(() => document.getElementById('age_hora').value)) === '14:30' && (await page.evaluate(() => document.getElementById('age_seg').style.display)) === 'none', 'editar abre os dados salvos');
await page.fill('#age_hora', '15:00'); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1000);
check((await ag()).find(d => d.tipo === 'audiencia').hora === '15:00' && /15:00/.test(await t('#agWrap')), 'a edição é salva e aparece');
// semana e mês
await page.click('[data-ag="vista"][data-v="semana"]'); await page.waitForTimeout(400);
check((await page.evaluate(() => document.querySelectorAll('.ag-sem .ag-d').length)) === 7 && /Preparar inicial/.test(await t('#agWrap')), 'visão Semana: 7 dias e o que vence hoje');
await page.click('[data-ag="vista"][data-v="mes"]'); await page.waitForTimeout(400);
const mes = await page.evaluate(() => ({ cel: document.querySelectorAll('.ag-mes .ag-c').length, sel: !!document.querySelector('.ag-c.on'), dom: document.querySelectorAll('.ag-c.fer').length >= 4, pontos: document.querySelectorAll('.ag-c .ag-p').length > 0 }));
check(mes.cel === 42 && mes.sel && mes.dom && mes.pontos, 'visão Mês: 42 dias, dia selecionado, domingos em vermelho e marcadores');
await page.click('[data-ag="nav"][data-v="1"]'); await page.waitForTimeout(300);
check(/\d{4}/.test(await t('.ag-nav b')), 'dá para trocar de mês');
await page.click('[data-ag="hoje"]');
const fer = await page.evaluate(() => { const H = window.__horusTeste; return ['2026-11-20', '2026-04-03', '2026-02-17', '2026-12-25', '2026-11-16'].map(d => H.agNomeFeriado(d)); });
check(fer.join('|') === 'Consciência Negra|Sexta-feira Santa|Carnaval|Natal|', 'nomes dos feriados do calendário: ' + fer.join('|'));
// Início
await page.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await page.waitForTimeout(800);
const c2 = await t('#inicioPrazos');
check(/Audiência 15:00/.test(c2) && /Preparar inicial/.test(c2) && /Amanhã/.test(c2), 'o cartão do Início mostra audiência, tarefa e prazos da semana: ' + c2.replace(/\n/g, ' ').slice(0, 140));
check(/[1-9]/.test(await page.evaluate(() => (document.getElementById('menuNAgenda') || {}).textContent || '')), 'o menu mostra quantos prazos vencem hoje ou estão atrasados');
await page.click('[data-ag-ir="agenda"]'); await page.waitForTimeout(500);
check(/Semana|Mês|Lista/.test(await t('#agSeg')), '"Ver agenda completa" abre a Agenda');
// excluir
await page.click('[data-ag="vista"][data-v="lista"]'); await page.click('.ag-it:has-text("Contestação") [data-ag="abrir"]'); await page.waitForTimeout(300);
await page.click('[data-age="excluir"]'); await page.waitForTimeout(150);
check((await ag()).some(d => d.titulo === 'Contestação'), 'o primeiro toque em Excluir só pede confirmação');
await page.click('[data-age="excluir"]'); await page.waitForTimeout(900);
check(!(await ag()).some(d => d.titulo === 'Contestação'), 'o segundo toque exclui');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
