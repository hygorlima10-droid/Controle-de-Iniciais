// Testa a aba Publicações (Diário Oficial): leitura, deduplicação, OABs extras, vínculo, prazo e Central de atenção.
// O Diário Oficial é simulado por um servidor de mentira que este teste abre na porta 8890.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var DJEN_URL:http://127.0.0.1:8890/api/v1/comunicacao --port 8812
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();

// ---- Diário Oficial de mentira ----
const adv = (nome, n, uf) => ({ advogado: { nome, numero_oab: n, uf_oab: uf } });
const item = (id, disp, tribunal, orgao, tipo, proc, texto, dest, advs = []) => ({ destinatarioadvogados: advs, id, data_disponibilizacao: disp, siglaTribunal: tribunal, nomeOrgao: orgao, tipoDocumento: tipo, tipoComunicacao: 'Intimação', nomeClasse: 'CUMPRIMENTO DE SENTENçA', numero_processo: proc.replace(/\D/g, ''), numeroprocessocommascara: proc, link: 'https://projudi.tjgo.jus.br/p?c=' + id, texto, destinatarios: dest });
const A = item(900001, hoje, 'TJGO', 'Morrinhos - 1ª Vara Cível', 'Decisão', '5368644-67.2026.8.09.0107', 'Poder Judici&aacute;rio\nTribunal de Justi&ccedil;a do Estado de Goi&aacute;s\nAutos n.:&nbsp;5368644-67.2026.8.09.0107\nDECIS&Atilde;O\nDEFIRO a per&iacute;cia cont&aacute;bil. Concedo o prazo improrrog&aacute;vel de 15 (quinze) dias para juntada integral dos documentos pela r&eacute;.', [{ nome: 'COOPERATIVA MISTA DOS PRODUTORES', polo: 'P' }], [adv('HYGOR LIMA ANDRADE', '60456', 'GO'), adv('MURILO FALONE ROCHA', '49308', 'GO')]);
const Bp = item(900002, hoje, 'TJGO', 'Morrinhos - 1ª Vara Cível', 'Ato ordinatório', '5593217-64.2021.8.09.0107', 'CERTID&Atilde;O\nCertifico que, nesta data, intimei a parte autora/exequente para realizar o recolhimento do sistema deferido, no prazo de quinze dias.\nO referido &eacute; verdade e dou f&eacute;.', [{ nome: 'COOPERATIVA MISTA DOS PRODUTORES', polo: 'A' }], [adv('HYGOR LIMA ANDRADE', '60456', 'GO'), adv('ALCIONE CELLA', '23852', 'SC')]);
const C = item(900003, hoje, 'STJ', 'COORDENADORIA DE CLASSIFICAÇÃO', 'ATA DE DISTRIBUIÇÃO', '5385296-78.2023.8.09.0071', '<html><body><table><tr><td><b>AREsp 3307791/GO</b></td></tr></table><p>Processo distribuído em 05/11/2026.</p></body></html>', [{ nome: '1. TRANSPORTADORA NUNES (AGRAVANTE)', polo: 'A' }, { nome: '2. LÍDER VIATURAS (AGRAVADO)', polo: 'P' }], [adv('MURILO FALONE ROCHA', '49308', 'GO'), adv('HYGOR LIMA ANDRADE', '60456', 'GO')]);
const D = item(900004, hoje, 'TJGO', 'Goiânia - 2ª Vara', 'Sentença', '5000001-11.2026.8.09.0051', 'SENTEN&Ccedil;A\nJulgo procedente o pedido. Prazo de 15 dias para recurso.', [{ nome: 'FULANO DE TAL', polo: 'A' }]);
const E = item(900005, hoje, 'TJGO', 'Morrinhos - Vara Criminal', 'Despacho', '5706736-75.2025.8.09.0107', 'DESPACHO\nIntime-se. Prazo de 5 (cinco) dias.', [{ nome: 'SERGIO PENIDO', polo: 'A' }]);
const feeds = { '60456': [A, Bp, C], '49308': [A, D], '12345': [] };
let consultas = 0, queda = false;
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), q = u.searchParams; consultas++;
  if (queda) { res.writeHead(503); res.end('indisponível'); return; }
  let lista = [];
  if (q.get('numeroOab')) lista = feeds[q.get('numeroOab')] || [];
  else if (q.get('numeroProcesso')) lista = Object.values(feeds).flat().filter(i => i.numero_processo === q.get('numeroProcesso'));
  lista = lista.filter(i => (!q.get('dataDisponibilizacaoInicio') || i.data_disponibilizacao >= q.get('dataDisponibilizacaoInicio')) && (!q.get('dataDisponibilizacaoFim') || i.data_disponibilizacao <= q.get('dataDisponibilizacaoFim')));
  const uniq = [...new Map(lista.map(i => [i.id, i])).values()], tam = Math.min(Number(q.get('itensPorPagina')) || 5, 100), pg = Number(q.get('pagina')) || 1;
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ status: 'success', count: uniq.length, items: uniq.slice((pg - 1) * tam, pg * tam) }));
}).listen(8890);

let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.7' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov', 'prazosPub']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('PUT', '/api/db/casos/c1', { tipo: 'inicial', cliente: 'Maquele Viana Pacheco', nomeAcao: 'Declaratória', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 3000, parcelas: [{ numero: 1, valor: 3000, data: hoje, pago: false }], numeroProcesso: '5368644-67.2026.8.09.0107', clienteIds: [], criadoEm: agora, atualizadoEm: agora });

// ---- servidor: leitura, deduplicação, OABs ----
let e = (await f('GET', '/api/djen/estado')).j;
check(e.oabs.length === 1 && e.oabs[0].numero === '60456' && e.oabs[0].uf === 'GO' && e.oabs[0].principal, 'começa com a sua OAB 60456/GO');
r = (await f('POST', '/api/djen/buscar', {})).j;
check(r.ok && r.novas === 3 && r.lidas === 3 && !r.porOab[0].erro, 'primeira leitura traz as 3 publicações: ' + JSON.stringify(r.porOab));
e = (await f('GET', '/api/djen/estado')).j;
check(e.total === 3 && e.naoLidas === 3 && e.aAvisar === 0, 'a leitura do histórico não vira notificação (aAvisar = 0)');
r = (await f('POST', '/api/djen/buscar', {})).j;
check(r.novas === 0 && (await f('GET', '/api/djen/estado')).j.total === 3, 'ler de novo não duplica nada');
let pubs = (await f('GET', '/api/djen/lista')).j.pubs, pa = pubs.find(p => p.id === '900001');
check(pa && pa.processo === '53686446720268090107' && pa.numero === '5368644-67.2026.8.09.0107' && pa.tribunal === 'TJGO' && pa.tipo === 'Decisão', 'a publicação guarda tribunal, tipo e número do processo');
check(pa.trecho.startsWith('DEFIRO a perícia contábil') && !/&\w+;/.test(pa.trecho) && pa.trecho.length <= 300, 'o trecho vem limpo e sem o cabeçalho: ' + pa.trecho.slice(0, 50));
check(pa.sug && pa.sug.dias === 15 && pa.sug.tipo === 'uteis', 'prazo sugerido: 15 dias úteis');
check(!pubs.find(p => p.id === '900003').sug, 'ata de distribuição não sugere prazo');
check(pa.advs && pa.advs.length === 2 && pa.advs[1].n === 'MURILO FALONE ROCHA' && pa.advs[1].o === '49308/GO', 'guarda os advogados citados em cada publicação (nome e OAB)');
// OAB do Murilo
let bad = await f('PUT', '/api/djen/oabs', { oabs: [{ numero: '', uf: 'GO' }] });
check(bad.s === 400, 'não aceita OAB sem número');
r = (await f('PUT', '/api/djen/oabs', { oabs: [...e.oabs, { nome: 'Murilo Falone Rocha', numero: '49308', uf: 'GO', escopo: 'conjunto', avisar: true }] })).j;
check(r.oabs.length === 2 && r.oabs[1].numero === '49308' && r.oabs[0].principal && !r.oabs[1].principal, 'cadastra a OAB do Murilo como OAB extra');
r = (await f('POST', '/api/djen/buscar', {})).j;
check(r.novas === 1 && r.porOab.length === 2, 'a leitura passa a incluir a OAB do Murilo (1 publicação nova, a que já existia não duplica): ' + JSON.stringify(r.porOab.map(o => o.novas)));
pubs = (await f('GET', '/api/djen/lista')).j.pubs; pa = pubs.find(p => p.id === '900001');
check(pa.oabs.length === 2, 'a publicação em comum guarda as duas OABs de origem (um cartão só)');
// texto completo sob demanda
let tx = (await f('GET', '/api/djen/texto?id=900002')).j;
check(tx.ok && /Certifico que/.test(tx.texto) && /verdade e dou fé/.test(tx.texto) && !/&\w+;/.test(tx.texto) && tx.sug && tx.sug.dias === 15, 'o texto completo é buscado ao abrir e vem limpo, com o prazo sugerido');
check((await f('GET', '/api/djen/texto?id=999')).s === 404 && (await f('GET', '/api/djen/texto?id=abc')).s === 400, 'texto de publicação inexistente/ inválida dá erro claro');
queda = true; tx = (await f('GET', '/api/djen/texto?id=900002')).j; queda = false;
check(tx.ok === false && tx.trecho && /503/.test(tx.motivo), 'com o Diário fora do ar, cai no trecho guardado e explica o motivo: ' + tx.motivo);
queda = true; r = (await f('POST', '/api/djen/buscar', {})).j; queda = false;
check(r.porOab.every(o => o.erro) && (await f('GET', '/api/djen/estado')).j.oabs.every(o => /503/.test(o.erro)), 'falha na leitura é registrada em cada OAB, sem perder dados');
check((await f('GET', '/api/djen/estado')).j.total === 4, 'nada foi apagado na falha');
// publicação nova depois da primeira leitura: vira aviso
feeds['60456'].push(E);
r = (await f('POST', '/api/djen/buscar', {})).j;
check(r.novas === 1 && (await f('GET', '/api/djen/estado')).j.aAvisar === 1, 'publicação nova entra na lista de avisos das 10h');
check((await f('POST', '/api/djen/marcar', { ids: ['900005'], lida: true })).j.alteradas === 1 && (await f('GET', '/api/djen/lista')).j.pubs.find(p => p.id === '900005').lida === true, 'marcar como lida grava no servidor');
await f('POST', '/api/djen/marcar', { ids: ['900005'], lida: false });

// ---- tela ----
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
// calendário (funções puras)
const cal = await page.evaluate(() => { const H = window.__horusTeste; return ({
  a: H.pbCalcular('2026-11-06', 15, 'uteis'), b: H.pbCalcular('2026-12-15', 15, 'uteis'), c: H.pbCalcular('2026-03-30', 5, 'uteis'), d: H.pbCalcular('2026-11-06', 30, 'corridos'),
  geral: (function(){ var g = H.pbFeriadosGeral(2026), o = {}; H.feriados2026.forEach(function(x){ o[x] = 1; }); return JSON.stringify(Object.keys(g).sort()) === JSON.stringify(Object.keys(o).sort()); })(),
  pascoa: [H.pbPascoa(2026), H.pbPascoa(2027)], nu: [H.pbNaoUtil('2026-11-20'), H.pbNaoUtil('2026-11-16'), H.pbNaoUtil('2027-01-10'), H.pbNaoUtil('2027-01-21')],
}); });
check(cal.a.pub === '2026-11-09' && cal.a.ini === '2026-11-10' && cal.a.venc === '2026-12-01', 'disponibilizada 06/11, 15 dias úteis: publica 09/11, conta de 10/11 e vence 01/12 (pulando 20/11, Consciência Negra): ' + JSON.stringify(cal.a));
check(cal.b.venc > '2027-01-20' && cal.nu[2] === true && cal.nu[3] === false, 'prazo que atravessa o recesso (20/12 a 20/01) volta a correr só em 21/01: vence ' + cal.b.venc);
check(cal.c.ini === '2026-04-06' && cal.c.venc === '2026-04-10', 'Semana Santa (1 a 3/04) não conta: 30/03 + 5 dias úteis → ' + cal.c.venc + ' (publica ' + cal.c.pub + ')');
check(cal.d.venc === '2026-12-09', '30 dias corridos: o dia 1 é 10/11 e o dia 30 é 09/12: ' + cal.d.venc);
check(cal.geral && cal.pascoa[0] === '2026-04-05' && cal.pascoa[1] === '2027-03-28', 'a regra geral reproduz exatamente a lista oficial do TJGO 2026 (e a Páscoa está certa)');
check(cal.nu[0] === true && cal.nu[1] === false, 'feriado nacional (20/11) não é dia útil e a segunda seguinte é');
// aba
check(await page.evaluate(() => !!document.querySelector('#drawer [data-tab="publicacoes"]')), 'o menu tem a aba Publicações');
check(/[1-9]/.test(await page.evaluate(() => (document.getElementById('menuNPub') || {}).textContent || '')), 'o menu mostra quantas publicações não foram lidas');
await page.evaluate(() => document.querySelector('[data-tab="publicacoes"]').click()); await page.waitForTimeout(1200);
check(/não lidas?/i.test(await t('#pbWrap')) && (await page.evaluate(() => document.querySelectorAll('.pb-card').length)) === 4, 'lista os cartões (A, B, C e a nova E; D do Murilo fica escondida por ser "só em conjunto")');
check(!/Fulano/i.test(await t('#pbWrap')), 'publicação do Murilo sem processo em comum não aparece (escopo "só em conjunto")');
const cardDe = async id => page.evaluate(id => { const b = document.querySelector('.pb-b[data-id="' + id + '"]'); return b ? b.closest('.pb-card').innerText : ''; }, id);
const ta = await cardDe('900001'), tb = await cardDe('900002'), tc = await cardDe('900003');
check(/inicial cadastrada/i.test(ta) && /via OAB Hygor/.test(ta) && /via OAB Murilo/.test(ta) && /Maquele Viana Pacheco/.test(ta), 'processo cadastrado mostra o cliente e as duas OABs de origem');
check(/processo novo/i.test(tb) && /(sugerido: 15 dias|✦ .{3,60}15 dias)/.test(tb) && /Confirmar/.test(tb) && /Cadastrar processo/.test(tb), 'processo não cadastrado: "+ processo novo", prazo sugerido e botão para cadastrar');
check(/Ata/i.test(tc) && !/prazo/i.test(tc) && /STJ/.test(tc) && /TRANSPORTADORA NUNES/.test(tc), 'ata do STJ: sem botão de prazo, com as partes');
// filtros
await page.click('[data-pb="filtro"][data-v="meus"]'); await page.waitForTimeout(300);
check((await page.evaluate(() => document.querySelectorAll('.pb-card').length)) === 1 && /Maquele/.test(await t('#pbWrap')), 'filtro "Meus processos" mostra só os cadastrados');
await page.click('[data-pb="filtro"][data-v="todas"]'); await page.waitForTimeout(300);
check((await page.evaluate(() => document.querySelectorAll('.pb-card').length)) === 4, 'filtro "Todas"');
// botão "Marcar como lida" igual aos demais
const lidaBtn = await page.evaluate(() => { const b = document.querySelector('.pb-b[data-pb="lida"]'); return { t: b.innerText.trim(), c: b.className }; });
check(lidaBtn.t === 'Marcar como lida' && /\bbtn\b/.test(lidaBtn.c) && /btn-ghost/.test(lidaBtn.c) && !/btn-text/.test(lidaBtn.c), 'o botão é "Marcar como lida" e tem o mesmo estilo dos outros: ' + lidaBtn.c);
// filtros
check(await page.evaluate(() => !!document.querySelector('.pb-funil svg')) && !(await page.evaluate(() => !!document.querySelector('.pb-painel'))), 'há um botão de filtro com símbolo de funil e o painel começa fechado');
await page.click('.pb-funil'); await page.waitForTimeout(300);
check(await page.evaluate(() => ['pbf_q', 'pbf_de', 'pbf_ate', 'pbOabSel', 'pbf_adv', 'pbf_trib'].every(id => !!document.getElementById(id))), 'o painel tem cliente, data (de/até), OAB, advogado e tribunal');
check(await page.evaluate(() => { const pn = document.querySelector('.pb-painel').getBoundingClientRect(); return Array.from(document.querySelectorAll('.pb-painel input, .pb-painel select')).every(e => { const r = e.getBoundingClientRect(); return r.left >= pn.left - 1 && r.right <= pn.right + 1; }); }), 'os campos do painel cabem na largura do celular (datas lado a lado sem sair da caixa)');
const nCards = () => page.evaluate(() => document.querySelectorAll('.pb-card').length);
await page.selectOption('#pbOabSel', { index: 2 }); await page.waitForTimeout(400);
check(await nCards() === 1 && /1/.test(await t('.pb-funil')), 'filtro por OAB (Murilo): só a publicação em comum, e o botão mostra 1 filtro ativo');
await page.selectOption('#pbOabSel', { index: 0 }); await page.waitForTimeout(300);
await page.fill('#pbf_q', 'maquele'); await page.waitForTimeout(600);
check(await nCards() === 1 && /Maquele/.test(await t('#pbListaBox')), 'filtro por cliente (nome)');
await page.fill('#pbf_q', '5593217'); await page.waitForTimeout(600);
check(await nCards() === 1 && /5593217/.test(await t('#pbListaBox')), 'filtro por parte do número do processo');
await page.fill('#pbf_q', 'zzzz'); await page.waitForTimeout(600);
check(await nCards() === 0 && /Nenhuma publicação com esses filtros/.test(await t('#pbListaBox')), 'sem resultado: avisa');
await page.fill('#pbf_q', ''); await page.waitForTimeout(500);
await page.fill('#pbf_adv', 'alcione'); await page.waitForTimeout(600);
check(await nCards() === 1 && /5593217/.test(await t('#pbListaBox')), 'filtro por advogado (nome, inclusive o de fora das suas OABs): só a publicação com Alcione');
await page.fill('#pbf_adv', '49308'); await page.waitForTimeout(600);
check(await nCards() === 2, 'filtro por advogado (número da OAB)');
await page.fill('#pbf_adv', ''); await page.waitForTimeout(400);
await page.selectOption('#pbf_trib', 'STJ'); await page.waitForTimeout(400);
check(await nCards() === 1 && /STJ/.test(await t('#pbListaBox')), 'filtro por tribunal');
await page.selectOption('#pbf_trib', ''); await page.waitForTimeout(300);
await page.fill('#pbf_de', hoje); await page.fill('#pbf_ate', hoje); await page.waitForTimeout(500);
check(await nCards() === 4, 'filtro por data (só hoje): todas as de hoje');
const ontem = new Date(Date.parse(hoje + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
await page.fill('#pbf_ate', ontem); await page.waitForTimeout(500);
check(await nCards() === 0, 'filtro por data (até ontem): nenhuma');
await page.fill('#pbf_de', ''); await page.fill('#pbf_ate', ''); await page.fill('#pbf_adv', 'hygor'); await page.selectOption('#pbf_trib', 'TJGO'); await page.waitForTimeout(500);
check(await nCards() === 2 && /2/.test(await t('.pb-funil')), 'filtros combinados (advogado Hygor + TJGO) e o botão mostra 2 filtros');
await page.click('.pb-painel [data-pb="limpar"]'); await page.waitForTimeout(400);
check(await nCards() === 4 && !(await page.evaluate(() => !!document.querySelector('.pb-n'))), '"Limpar filtros" volta a lista completa e tira o número do botão');
await page.click('.pb-painel [data-pb="painel"]'); await page.waitForTimeout(300);
check(!(await page.evaluate(() => !!document.querySelector('.pb-painel'))), '"Fechar" esconde o painel');
await page.click('[data-pb="filtro"][data-v="naolidas"]'); await page.waitForTimeout(300);
// detalhe + prazo
await page.click('.pb-b[data-pb="prazo"][data-id="900002"]'); await page.waitForTimeout(1500);
check(await page.evaluate(() => document.getElementById('overlayPb').classList.contains('show')), 'abre o detalhe da publicação');
const corpo = await t('#pbCorpo');
check(/Certifico que, nesta data/.test(corpo) && !/&\w+;/.test(corpo) && /verdade e dou fé/.test(corpo), 'o texto completo aparece, sem códigos estranhos');
check(/(Prazo sugerido pelo texto|Prazo da peça escolhida)/i.test(corpo) && /no prazo de quinze dias/.test(corpo) && (await page.evaluate(() => document.getElementById('pbf_dias').value)) === '15', 'mostra a frase do prazo e já vem com 15 dias');
const calcTxt = await t('#pbCalc');
const esperado = await page.evaluate(h => { const H = window.__horusTeste; return H.fmtData(H.pbCalcular(h, 15, 'uteis').venc); }, hoje);
check(calcTxt.includes(esperado) && /Considerada publicada/.test(calcTxt) && /Começa a contar/.test(calcTxt) && /feriados do TJGO/.test(calcTxt), 'mostra o cálculo passo a passo (vence em ' + esperado + ')');
await page.fill('#pbf_dias', '5'); await page.waitForTimeout(200);
const esp5 = await page.evaluate(h => { const H = window.__horusTeste; return H.fmtData(H.pbCalcular(h, 5, 'uteis').venc); }, hoje);
check((await t('#pbCalc')).includes(esp5) && !(await t('#pbCalc')).includes(esperado), 'mudar os dias recalcula na hora (5 dias → ' + esp5 + ')');
await page.fill('#pbf_dias', '15'); await page.fill('#pbf_desc', 'Recolher o sistema (PrevJUD)'); await page.waitForTimeout(200);
await page.click('[data-pbd="confirmar"]'); await page.waitForTimeout(1500);
const pz = (await f('GET', '/api/db/agenda')).j.docs;
check(pz.length === 1 && pz[0].data.pubId === '900002' && pz[0].data.titulo === 'Recolher o sistema (PrevJUD)' && pz[0].data.tipo === 'prazo' && pz[0].data.data.length === 10 && pz[0].data.concluido === false && pz[0].data.contagem === 'uteis', 'o prazo confirmado fica gravado (' + (pz[0] && pz[0].data.data) + ')');
await page.click('[data-pb="filtro"][data-v="todas"]'); await page.waitForTimeout(300);
check(/prazo \d\d\/\d\d\/\d{4}/.test(await cardDe('900002')), 'o cartão passa a mostrar o prazo confirmado (e sai de "não lidas" porque já foi aberto)');
// Início, Agenda e avisos das 10h
const venc = pz[0].data.data;
await page.evaluate(() => document.querySelector('[data-tab="inicio"]').click()); await page.waitForTimeout(1200);
check(!/Recolher o sistema/.test(await t('#atencaoLista')), 'a Central de atenção não recebe prazos processuais (só dinheiro)');
check(/Prazos processuais/.test(await t('#inicioPrazos')), 'o Início tem o cartão "Prazos processuais"');
await f('POST', '/api/db/agenda', { tipo: 'prazo', titulo: 'Juntar documentos', processo: '5593217-64.2021.8.09.0107', cliente: 'Cooperativa Mista', data: new Date(Date.now() + 86400000).toISOString().slice(0, 10), situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora });
await page.reload(); await page.waitForTimeout(3200);
const card = await t('#inicioPrazos');
check(/Juntar documentos/.test(card) && /Cooperativa Mista/.test(card) && /Amanhã/.test(card), 'prazo de amanhã aparece no cartão do Início: ' + card.replace(/\n/g, ' ').slice(0, 100));
check(!/Juntar documentos/.test(await t('#atencaoLista')), 'e continua fora da Central de atenção');
const resumo = await page.evaluate(() => window.__horusTeste.ntResumo());
check(resumo.prazos.some(i => /Juntar documentos/.test(i.l) && i.t === 'prazo' && JSON.stringify(i.a) === '[5,2,1,0]') && !resumo.prazos.some(i => /Recolher o sistema/.test(i.l)) && !resumo.itens.some(i => i.t === 'prazo'), 'os prazos dos próximos 10 dias vão numa lista própria para a notificação (e não misturam com o dinheiro)');
// cadastrar processo pela publicação: processo já em andamento (sem honorários) ou nova inicial
await page.evaluate(() => document.querySelector('[data-tab="publicacoes"]').click()); await page.waitForTimeout(700);
await page.click('[data-pb="filtro"][data-v="todas"]'); await page.waitForTimeout(300);
await page.click('.pb-b[data-pb="cadastrar"][data-id="900003"]'); await page.waitForTimeout(400);
check(await page.evaluate(() => document.getElementById('overlayPrEsc').classList.contains('show')) && /Processo já em andamento/.test(await t('#preCorpo')) && /Nova inicial/.test(await t('#preCorpo')), 'o botão "Cadastrar processo" pergunta: processo já em andamento ou nova inicial');
await page.click('[data-pre="processo"]'); await page.waitForTimeout(500);
check((await page.evaluate(() => document.getElementById('pr_numero').value)) === '5385296-78.2023.8.09.0071' && /TRANSPORTADORA/.test(await page.evaluate(() => document.getElementById('pr_partes').value)) && /STJ/.test(await page.evaluate(() => document.getElementById('pr_orgao').value)), 'o cadastro já vem preenchido com número, partes e órgão da publicação');
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
const procs = (await f('GET', '/api/db/processos')).j.docs.map(d => d.data);
check(procs.length === 1 && procs[0].origem === 'publicacao' && procs[0].honorarios === 'sem', 'o processo é gravado (origem: publicação, sem honorários)');
check(/processo cadastrado/.test(await cardDe('900003')) && !/Cadastrar processo/.test(await cardDe('900003')), 'a publicação passa a mostrar "processo cadastrado"');
await page.click('[data-pb="ir"][data-id="900003"]'); await page.waitForTimeout(500);
check(await page.evaluate(() => document.getElementById('overlayPr').classList.contains('show')) && /Linha do tempo/i.test(await t('#prCorpo')) && /Publicação/.test(await t('#prCorpo')), 'tocar na etiqueta abre a ficha do processo, com as publicações');
await page.click('[data-prf="arquivar"]'); await page.waitForTimeout(400); await page.click('#praOk'); await page.waitForTimeout(1200);
check(/arquivado/.test(await cardDe('900003')) && /Reabrir processo/.test(await cardDe('900003')), 'processo arquivado: a publicação mostra "arquivado" e oferece "Reabrir processo"');
await page.click('.pb-b[data-pb="reabrir-proc"][data-id="900003"]'); await page.waitForTimeout(1200);
check(!/Reabrir processo/.test(await cardDe('900003')) && (await f('GET', '/api/db/processos')).j.docs[0].data.arquivado === false, 'Reabrir processo desfaz');
await page.click('.pb-b[data-pb="cadastrar"][data-id="900005"]'); await page.waitForTimeout(400); await page.click('[data-pre="inicial"]'); await page.waitForTimeout(700);
check(await page.evaluate(() => document.getElementById('overlay').classList.contains('show')) && (await page.evaluate(() => document.getElementById('processoInput').value)) === '5706736-75.2025.8.09.0107', 'a outra opção abre o cadastro de Nova inicial com o número preenchido');
await page.click('#closeModal'); await page.waitForTimeout(300);
// dentro do texto da publicação: cadastrar o processo e manter como não lida
await page.evaluate(() => document.querySelector('[data-tab="publicacoes"]').click()); await page.waitForTimeout(700);
await page.click('[data-pb="filtro"][data-v="todas"]'); await page.waitForTimeout(400);
await page.click('.pb-b[data-pb="abrir"][data-id="900005"]'); await page.waitForTimeout(1500);
check(await page.evaluate(() => !!document.querySelector('#pbCorpo [data-pbd="cadastrar"]') && !!document.querySelector('#pbCorpo [data-pbd="naolida"]')), 'o texto da publicação tem o botão "Cadastrar processo" (processo ainda não cadastrado) e "Manter como não lida"');
check((await f('GET', '/api/djen/lista')).j.pubs.find(p => p.id === '900005').lida === true, 'abrir marca como lida');
await page.click('#pbCorpo [data-pbd="naolida"]'); await page.waitForTimeout(1000);
check((await f('GET', '/api/djen/lista')).j.pubs.find(p => p.id === '900005').lida === false && !(await page.evaluate(() => document.getElementById('overlayPb').classList.contains('show'))), '"Manter como não lida" desfaz e fecha, e a publicação continua em "Não lidas"');
await page.click('.pb-b[data-pb="abrir"][data-id="900005"]'); await page.waitForTimeout(1200);
await page.click('#pbCorpo [data-pbd="cadastrar"]'); await page.waitForTimeout(500);
const sobre = await page.evaluate(() => { const el = document.getElementById('preCorpo'), r = el.getBoundingClientRect(), x = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return !!(x && x.closest('#overlayPrEsc')); });
check(await page.evaluate(() => document.getElementById('overlayPb').classList.contains('show') && document.getElementById('overlayPrEsc').classList.contains('show')) && sobre && /Processo já em andamento/.test(await t('#preCorpo')), '"Cadastrar processo" no texto abre a escolha POR CIMA e a leitura continua aberta por baixo');
await page.click('[data-pre="processo"]'); await page.waitForTimeout(500);
check((await page.evaluate(() => document.getElementById('pr_numero').value)) === '5706736-75.2025.8.09.0107', 'e o cadastro já vem com o número da publicação');
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
check(await page.evaluate(() => document.getElementById('overlayPb').classList.contains('show') && !!document.querySelector('#pbCorpo [data-pbd="irproc"]') && !document.querySelector('#pbCorpo [data-pbd="cadastrar"]') && !!document.getElementById('pbPrazoBox')), 'depois de cadastrar, a leitura continua aberta e já mostra "Abrir o processo", o prazo e as opções de lida / não lida');
await page.click('#pbCorpo [data-pbd="naolida"]'); await page.waitForTimeout(800);
check((await f('GET', '/api/djen/lista')).j.pubs.find(p => p.id === '900005').lida === false, 'e dá para escolher depois se fica lida ou não lida');
await page.click('.pb-b[data-pb="abrir"][data-id="900005"]'); await page.waitForTimeout(1200);
await page.click('#pbFechar'); await page.waitForTimeout(300);
// publicações idênticas (um autor em cada uma) viram um cartão só
const NG = '5700000-10.2026.8.09.0107', numG = NG.replace(/\D/g, '');
['AUTOR UM', 'AUTOR DOIS', 'AUTOR TRES'].forEach((n, i) => feeds['60456'].push(item(900101 + i, hoje, 'TJGO', 'Morrinhos - 1ª Vara Cível', 'Decisão', NG, 'DECISÃO\nIntimem-se os autores para manifestação em 5 (cinco) dias.', [{ nome: n, polo: 'A' }])));
feeds['60456'].push(item(900104, hoje, 'TJGO', 'Morrinhos - 1ª Vara Cível', 'Ato ordinatório', NG, 'CERTIDÃO\nCertifico o decurso do prazo.', [{ nome: 'AUTOR UM', polo: 'A' }]));
await f('POST', '/api/djen/buscar', {});
check((await f('GET', '/api/djen/lista')).j.pubs.filter(p => p.processo === numG).length === 4, 'o servidor guarda as 4 publicações (nada se perde)');
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('[data-tab="publicacoes"]').click()); await page.waitForTimeout(800);
await page.click('[data-pb="filtro"][data-v="todas"]'); await page.waitForTimeout(400);
const doProc = async () => page.evaluate(n => Array.from(document.querySelectorAll('.pb-card')).filter(c => c.innerText.includes(n)).map(c => c.innerText), NG);
let cg = await doProc();
check(cg.length === 2, 'no mesmo processo e dia, as 3 decisões idênticas viram 1 cartão e o ato ordinatório (outro tipo) continua separado: ' + cg.length + ' cartões');
const grupo = cg.find(x => /idênticas reunidas/.test(x)) || '';
check(/3 publicações idênticas reunidas/.test(grupo) && /AUTOR UM/.test(grupo) && /AUTOR DOIS/.test(grupo) && /AUTOR TRES/.test(grupo), 'o cartão reunido diz quantas são e para quem: ' + grupo.replace(/\n/g, ' | ').slice(0, 130));
const heroNum = async () => Number(await page.evaluate(() => (document.querySelector('#pbSeg [data-v="naolidas"] .md-n') || { innerText: '0' }).innerText));   // o total de não lidas agora fica no selo da sub-aba
const antes = await heroNum();
await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.pb-card')).find(c => /idênticas reunidas/.test(c.innerText)); c.querySelector('[data-pb="lida"]').click(); }); await page.waitForTimeout(1200);
const lg = (await f('GET', '/api/djen/lista')).j.pubs.filter(p => p.processo === numG);
check(lg.filter(p => p.lida).map(p => p.id).sort().join() === '900101,900102,900103' && lg.find(p => p.id === '900104').lida === false, 'um toque em "Marcar como lida" marca as 3 de uma vez (e só elas)');
check(await heroNum() === antes - 1 && String(await page.evaluate(() => document.getElementById('menuNPub').textContent)) === String(await heroNum()), 'o contador de não lidas conta o grupo como 1 (de ' + antes + ' para ' + (antes - 1) + ')');
await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.pb-card')).find(c => /idênticas reunidas/.test(c.innerText)); c.querySelector('[data-pb="abrir"]').click(); }); await page.waitForTimeout(1500);
check(/3 publicações idênticas reunidas/i.test(await t('#pbCorpo')) && /AUTOR DOIS/.test(await t('#pbCorpo')), 'o detalhe mostra os destinatários reunidos');
await page.click('#pbFechar'); await page.waitForTimeout(300);
await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.pb-card')).find(c => /idênticas reunidas/.test(c.innerText)); c.querySelector('[data-pb="lida"]').click(); }); await page.waitForTimeout(1000);
check((await f('GET', '/api/djen/lista')).j.pubs.filter(p => p.processo === numG && !p.lida).length === 4, '"Marcar como não lida" desfaz nas 3');
// vários autores na mesma publicação, processo ainda não cadastrado: reconhece clientes e cadastra os que faltam
const NG2 = '5800000-20.2026.8.09.0107', NG3 = '5900000-30.2026.8.09.0107', NOME_COMPL = 'COOPERATIVA MISTA DOS PRODUTORES DE LEITE DE MORRINHOS - COMPLEM';
await f('PUT', '/api/db/clientes/clc', { nome: 'Complem', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/clf', { nome: 'Fulano de Tal', pagador: 'cliente', criadoEm: agora });
[NOME_COMPL, 'FULANO DE TAL', 'CICLANO SANTOS'].forEach((n, i) => feeds['60456'].push(item(900201 + i, hoje, 'TJGO', 'Goiânia - 3ª Vara', 'Decisão', NG2, 'DECISÃO\nIntimem-se.', [{ nome: n, polo: 'A' }])));
await f('POST', '/api/djen/buscar', {});
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('[data-tab="publicacoes"]').click()); await page.waitForTimeout(800);
await page.click('[data-pb="filtro"][data-v="todas"]'); await page.waitForTimeout(400);
const cartaoNG2 = async () => page.evaluate(n => { const c = Array.from(document.querySelectorAll('.pb-card')).find(c => c.innerText.includes(n)); return c ? c.innerText : ''; }, NG2);
const ct2 = await cartaoNG2();
check(/3 publicações idênticas reunidas/.test(ct2) && /provável cliente: Complem, Fulano de Tal|provável cliente: Fulano de Tal, Complem/.test(ct2), 'o cartão reunido sugere os clientes prováveis (Complem e Fulano de Tal): ' + ct2.replace(/\n/g, ' | ').slice(0, 150));
await page.evaluate(n => { const c = Array.from(document.querySelectorAll('.pb-card')).find(c => c.innerText.includes(n)); c.querySelector('[data-pb="cadastrar"]').click(); }, NG2); await page.waitForTimeout(500);
await page.click('[data-pre="processo"]'); await page.waitForTimeout(600);
check(/Fulano de Tal/.test(await t('#pr_chips')) && !/Complem/.test(await t('#pr_chips')), 'o nome igual (Fulano de Tal) já vem vinculado e o abreviado só como sugestão');
const partesPub = await t('#pr_partesPub');
check(/COOPERATIVA MISTA/.test(partesPub) && /FULANO DE TAL/.test(partesPub) && /CICLANO SANTOS/.test(partesPub) && /É o cliente Complem/.test(partesPub) && /✓ cliente: Fulano de Tal/.test(partesPub), 'a ficha lista as 3 partes da publicação com o que fazer em cada uma');
check(/COOPERATIVA/.test(await page.evaluate(() => document.getElementById('pr_partes').value)) && /CICLANO/.test(await page.evaluate(() => document.getElementById('pr_partes').value)), 'e o campo de partes já traz os 3 nomes');
await page.click('[data-prf="sug-add"]'); await page.waitForTimeout(700);
check(/Complem/.test(await t('#pr_chips')), 'um toque em "É o cliente Complem" vincula o cliente cadastrado');
const clc = (await f('GET', '/api/db/clientes')).j.docs.find(d => d.id === 'clc').data;
check(Array.isArray(clc.apelidos) && clc.apelidos.some(a => /Complem/.test(a) && /Produtores/.test(a)), 'e o app aprende o nome completo como outro nome do cliente: ' + JSON.stringify(clc.apelidos));
await page.evaluate(() => { const l = Array.from(document.querySelectorAll('#pr_partesPub .pb-lin')).find(x => /CICLANO SANTOS/.test(x.innerText)); l.querySelector('[data-prf="sug-new"]').click(); }); await page.waitForTimeout(600);
const ce = await page.evaluate(() => { const el = document.getElementById('cliNomeInput'), r = el.getBoundingClientRect(), x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { nome: el.value, porCima: !!(x && x.closest('#overlayClienteEdit')), apelidos: !!document.getElementById('cliApelidosInput') }; });
check(ce.nome === 'Ciclano Santos' && ce.porCima && ce.apelidos, 'a parte que ainda não é cliente abre o cadastro por cima, com o nome já preenchido e o campo "Outros nomes"');
await page.click('#cliSalvarBtn'); await page.waitForTimeout(1000);
check(/Ciclano Santos/.test(await t('#pr_chips')), 'e o novo cliente já entra no processo');
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
const pNG2 = (await f('GET', '/api/db/processos')).j.docs.map(d => d.data).find(d => d.numero === NG2);
check(pNG2 && pNG2.clienteIds.length === 3 && pNG2.clienteIds.includes('clc') && pNG2.clienteIds.includes('clf'), 'o processo é gravado com os 3 autores como clientes');
// da próxima vez o nome completo já é reconhecido sozinho
feeds['60456'].push(item(900301, hoje, 'TJGO', 'Goiânia - 4ª Vara', 'Decisão', NG3, 'DECISÃO\nIntimem-se.', [{ nome: NOME_COMPL, polo: 'A' }]));
await f('POST', '/api/djen/buscar', {});
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('[data-tab="publicacoes"]').click()); await page.waitForTimeout(800);
await page.click('[data-pb="filtro"][data-v="todas"]'); await page.waitForTimeout(400);
await page.evaluate(n => { const c = Array.from(document.querySelectorAll('.pb-card')).find(c => c.innerText.includes(n)); c.querySelector('[data-pb="cadastrar"]').click(); }, NG3); await page.waitForTimeout(500);
await page.click('[data-pre="processo"]'); await page.waitForTimeout(600);
check(/Complem/.test(await t('#pr_chips')), 'depois de aprender, o mesmo nome completo vem vinculado ao Complem sozinho');
await page.click('#prX'); await page.waitForTimeout(300);
// dados básicos do processo vindos do Diário Oficial: réu, órgão, natureza, valor da causa
const NH = '6000000-40.2026.8.09.0107', NI = '6100000-50.2026.8.09.0107', numH = NH.replace(/\D/g, '');
const cab = (n, at, pa) => 'Poder Judici&aacute;rio\nAutos n.:&nbsp;' + n + '\nNatureza:&nbsp;PROCESSO C&Iacute;VEL E DO TRABALHO -&gt; Procedimento Comum C&iacute;vel\nPolo Ativo:&nbsp;' + at + '\nPolo Passivo:&nbsp;' + pa + '\nSENTEN&Ccedil;A\nJulgo procedente. Valor da causa: R$ 25.000,00';
feeds['60456'].push(item(900401, hoje, 'TJGO', 'Morrinhos - 2ª Vara Cível', 'Sentença', NH, cab(NH, 'Cooperativa Mista', 'Banco Exemplo S.A.'), [{ nome: 'COOPERATIVA MISTA', polo: 'A' }]));
feeds['60456'].push(item(900402, hoje, 'TJGO', 'Morrinhos - 1ª Vara Cível', 'Despacho', NI, cab(NI, 'Maria Souza', 'Construtora Beta Ltda'), [{ nome: 'MARIA SOUZA', polo: 'A' }]));
await f('POST', '/api/djen/buscar', {});
const dh = (await f('GET', '/api/djen/processo?numero=' + numH)).j;
check(dh.ok && dh.achou && dh.dados.ativo === 'Cooperativa Mista' && dh.dados.passivo === 'Banco Exemplo S.A.' && dh.dados.natureza === 'Procedimento Comum Cível' && dh.dados.orgao === 'Morrinhos - 2ª Vara Cível' && dh.dados.tribunal === 'TJGO' && dh.dados.valorCausa === 25000 && dh.dados.comunicacoes === 1, 'o servidor busca pelo número e devolve autor, réu, natureza, órgão e valor da causa: ' + JSON.stringify(dh.dados));
check((await f('GET', '/api/djen/processo?numero=123')).s === 400 && (await f('GET', '/api/djen/processo?numero=99999999999999999999')).j.achou === false, 'número inválido dá erro e número sem publicação responde "não achou"');
const pH = (await f('GET', '/api/djen/lista')).j.pubs.find(p => p.id === '900401');
check(pH.ativo === 'Cooperativa Mista' && pH.passivo === 'Banco Exemplo S.A.' && pH.natureza === 'Procedimento Comum Cível', 'as publicações novas já guardam autor, réu e natureza');
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('[data-tab="publicacoes"]').click()); await page.waitForTimeout(800);
await page.click('[data-pb="filtro"][data-v="todas"]'); await page.waitForTimeout(400);
await page.evaluate(n => { const c = Array.from(document.querySelectorAll('.pb-card')).find(c => c.innerText.includes(n)); c.querySelector('[data-pb="cadastrar"]').click(); }, NH); await page.waitForTimeout(500);
await page.click('[data-pre="processo"]'); await page.waitForTimeout(1500);
const fh = await page.evaluate(() => ({ reu: document.getElementById('pr_reu').value, autor: document.getElementById('pr_autor').value, partes: document.getElementById('pr_partes').value, orgao: document.getElementById('pr_orgao').value, classe: document.getElementById('pr_classe').value, valor: document.getElementById('pr_valor').value, msg: document.getElementById('pr_dados').innerText }));
check(fh.reu === 'Banco Exemplo S.A.' && fh.autor === 'Cooperativa Mista' && fh.partes === 'Cooperativa Mista x Banco Exemplo S.A.' && /Morrinhos - 2ª Vara Cível/.test(fh.orgao) && fh.valor === '25.000,00' && /Dados do Diário Oficial preenchidos/.test(fh.msg), 'ao cadastrar pela publicação, o réu, o órgão, as partes e o valor da causa vêm sozinhos: ' + JSON.stringify(fh));
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
const dH = (await f('GET', '/api/db/processos')).j.docs.map(d => d.data).find(d => d.numero === NH);
check(dH && dH.reu === 'Banco Exemplo S.A.' && dH.autor === 'Cooperativa Mista' && dH.valorCausa === 25000 && /Morrinhos - 2ª Vara/.test(dH.orgao), 'e tudo é gravado no processo');
// cadastro manual: digitar o número já puxa os dados
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(700);
await page.click('[data-pr="novo"]'); await page.waitForTimeout(400);
await page.fill('#pr_numero', NI); await page.press('#pr_numero', 'Tab'); await page.waitForTimeout(1500);
const fi2 = await page.evaluate(() => ({ reu: document.getElementById('pr_reu').value, partes: document.getElementById('pr_partes').value, orgao: document.getElementById('pr_orgao').value }));
check(fi2.reu === 'Construtora Beta Ltda' && fi2.partes === 'Maria Souza x Construtora Beta Ltda' && /Morrinhos - 1ª Vara Cível/.test(fi2.orgao), 'digitando só o número no cadastro manual, os dados do Diário Oficial são preenchidos: ' + JSON.stringify(fi2));
await page.fill('#pr_numero', '9999999-99.2026.8.09.0000'); await page.press('#pr_numero', 'Tab'); await page.waitForTimeout(1200);
check(/ainda não tem publicação/.test(await t('#pr_dados')), 'número sem publicação: avisa que dá para preencher à mão');
await page.click('#prX'); await page.waitForTimeout(300);
// ficha de um processo já cadastrado, com campos vazios: botão para completar
await f('POST', '/api/db/processos', { numero: NI, partes: '', orgao: '', classe: '', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(800);
await page.click('[data-pr="abrir"][data-n="' + NI.replace(/\D/g, '') + '"]'); await page.waitForTimeout(500);
await page.click('[data-prf="buscar-dados"]'); await page.waitForTimeout(1500);
check((await page.evaluate(() => document.getElementById('pr_reu').value)) === 'Construtora Beta Ltda' && /Morrinhos - 1ª Vara Cível/.test(await page.evaluate(() => document.getElementById('pr_orgao').value)), 'na ficha de um processo já cadastrado, "Buscar dados no Diário Oficial" completa o que estiver vazio');
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
check(/Réu: Construtora Beta Ltda|Maria Souza x Construtora Beta Ltda/.test(await t('#prLista')), 'e a lista de Processos mostra o réu para diferenciar os processos do mesmo cliente');
// OABs na tela
await page.evaluate(() => document.querySelector('[data-tab="publicacoes"]').click()); await page.waitForTimeout(900);
await page.click('[data-pb="oabs"]'); await page.waitForTimeout(500);
check(await page.evaluate(() => document.getElementById('overlayPbOab').classList.contains('show') && document.querySelectorAll('#pboCorpo .pb-oab').length === 3), 'a janela de OABs lista as duas cadastradas e o formulário para adicionar');
await page.fill('#pbo_nome', 'Dr. Carlos'); await page.fill('#pbo_num', '12345'); await page.click('[data-pbo="novo"]'); await page.waitForTimeout(300);
check(await page.evaluate(() => document.querySelectorAll('#pboCorpo .pb-oab').length === 4), 'adiciona outra OAB à lista');
await page.click('[data-pbo="salvar"]'); await page.waitForTimeout(2500);
e = (await f('GET', '/api/djen/estado')).j;
check(e.oabs.length === 3 && e.oabs[2].nome === 'Dr. Carlos' && e.oabs[2].numero === '12345', 'salvar grava a nova OAB e já busca');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); srv.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
