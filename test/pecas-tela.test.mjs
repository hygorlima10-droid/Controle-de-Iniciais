// Testa na tela das Publicações a peça sugerida: cartão, escolha entre opções, prazo em dobro, lado do cliente, Juizado,
// criação do prazo na Agenda com a peça e "Registrar no processo". O Diário Oficial é simulado na porta 8890.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var DJEN_URL:http://127.0.0.1:8890/api/v1/comunicacao --port 8812
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const num = k => '58' + String(k).padStart(5, '0') + '-10.2026.8.09.0107';
const item = (id, k, tipo, texto, polo, nome, orgao = 'Morrinhos - 1ª Vara Cível', classe = 'PROCEDIMENTO COMUM') => ({ id, data_disponibilizacao: hoje, siglaTribunal: 'TJGO', tipoComunicacao: 'Intimação', tipoDocumento: tipo, nomeOrgao: orgao, nomeClasse: classe, numero_processo: num(k).replace(/\D/g, ''), numeroprocessocommascara: num(k), link: 'https://exemplo.test/p/' + id, texto: 'Autos n.: ' + num(k) + '\nPolo Ativo: ' + nome + '\nPolo Passivo: Parte Contrária\n' + texto, destinatarios: Array.isArray(polo) ? polo : [{ nome, polo }], destinatarioadvogados: [] });
const itens = [
  item(930001, 1, 'Ato ordinatório', 'Certifico que a contestação foi juntada. Intime-se a parte autora para, no prazo de 15 (quinze) dias, impugnar a contestação e especificar provas.', 'A', 'Reta Replica Silva'),
  item(930002, 2, 'Sentença', 'Ante o exposto, julgo IMPROCEDENTES os pedidos. Condeno o autor em custas.', 'A', 'Sara Sentenca Lima'),
  item(930003, 3, 'Decisão', 'Indefiro a tutela de urgência requerida pela parte autora, por ausência de perigo de dano.', 'A', 'Tarcio Tutela Souza'),
  item(930004, 4, 'Sentença', 'Julgo improcedentes os pedidos.', 'A', 'Jairo Juizado Alves', 'Juizado Especial Cível de Morrinhos', 'PROCEDIMENTO DO JUIZADO ESPECIAL CÍVEL'),
  item(930005, 5, 'Decisão', 'Defiro o pedido de busca de informações no sistema e determino a juntada dos documentos como diligência.', 'A', 'Gabriel Generico Reis'),
  item(930006, 6, 'Sentença', 'Julgo improcedentes os pedidos.', [{ nome: 'Ambos Autor', polo: 'A' }, { nome: 'Ambos Reu', polo: 'P' }], 'Ambos Autor'),
  item(930007, 7, 'Sentença', 'Julgo improcedentes os pedidos.', 'P', 'MUNICÍPIO DE MORRINHOS'),
];
const fake = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', count: itens.length, items: itens })); }).listen(8890);
await new Promise(ok => fake.on('listening', ok));
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.34' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'config', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('PUT', '/api/db/casos/c5', { tipo: 'inicial', cliente: 'Gabriel Generico Reis', nomeAcao: 'Cobrança', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 1000, avista: { data: hoje, pago: false }, numeroProcesso: num(5), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await f('POST', '/api/djen/buscar', {});

const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const v = async id => page.evaluate(i => (document.getElementById(i) || {}).value, id);
const cartao = nome => page.evaluate(n => { const c = Array.from(document.querySelectorAll('.pb-card')).find(x => x.innerText.includes(n)); return c ? c.innerText : ''; }, nome);
const abrir = async nome => { await page.evaluate(n => { const c = Array.from(document.querySelectorAll('.pb-card')).find(x => x.innerText.includes(n)); c.querySelector('[data-pb="abrir"]').click(); }, nome); await page.waitForTimeout(900); };
const fechar = async () => { await page.click('#pbFechar'); await page.waitForTimeout(300); };
await page.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await page.waitForTimeout(1500);

// 1) cartão
let c1 = await cartao('Reta Replica');
check(/✦ Réplica/.test(c1) && /15 dias/.test(c1) && /Confirmar: Réplica/.test(c1), 'o cartão mostra a peça sugerida e o botão “Confirmar: Réplica”');
// 2) detalhe: opções, escolha, prazo
await abrir('Reta Replica');
let det = await t('#pbCorpo');
check(/Peça sugerida/i.test(det) && /Ato ordinatório/.test(det) && /seu cliente é o autor/.test(det), 'a leitura mostra a natureza do ato e o lado do cliente');
check(/Réplica \(impugnação à contestação\)/.test(det) && /CPC 350 e 351/.test(det) && /Especificação de provas/.test(det), 'lista a peça principal e as alternativas com a base legal');
check(await v('pbf_desc') === 'Réplica (impugnação à contestação)' && await v('pbf_dias') === '15', 'o prazo já vem preenchido com a peça principal');
await page.click('.pb-pc:has-text("Especificação de provas")'); await page.waitForTimeout(500);
check(await v('pbf_desc') === 'Especificação de provas', 'escolher outra peça troca a descrição do prazo');
await page.click('.pb-pc:has-text("Réplica")'); await page.waitForTimeout(400);
const venc1 = await page.evaluate(() => (document.querySelector('#pbCalc .pb-venc b') || {}).innerText);
await page.selectOption('#pbf_dobro', 'fazenda'); await page.waitForTimeout(300);
check(/15 × 2 = 30 dias/.test(await t('#pbCalc')) && (await page.evaluate(() => document.querySelector('#pbCalc .pb-venc b').innerText)) !== venc1, 'prazo em dobro: 15 × 2 = 30 dias e o vencimento muda');
await page.selectOption('#pbf_dobro', ''); await page.waitForTimeout(300);
await page.click('[data-pbd="confirmar"]'); await page.waitForTimeout(1200);
let ag = (await docs('agenda')).filter(d => d.pubId === '930001')[0];
check(ag && ag.peca === 'Réplica (impugnação à contestação)' && ag.pecaBase === 'CPC 350 e 351' && ag.pecaId === 'replica' && ag.pecaOrigem === 'sugerida' && ag.dias === 15 && ag.natureza === 'ato', 'o prazo na Agenda guarda a peça, a base, de onde veio (sugerida) e a natureza');
// 3) sentença
await abrir('Sara Sentenca');
det = await t('#pbCorpo');
check(/Sentença/.test(det) && /Apelação/.test(det) && /CPC 1\.009 e 1\.003, §5º/.test(det) && /Embargos de declaração/.test(det) && (await v('pbf_desc')) === 'Apelação' && (await v('pbf_dias')) === '15', 'sentença → apelação (15 dias) com embargos de declaração como alternativa');
await page.click('.pb-pc:has-text("Embargos de declaração")'); await page.waitForTimeout(400);
check(await v('pbf_dias') === '5' && await v('pbf_desc') === 'Embargos de declaração', 'trocar para embargos de declaração muda para 5 dias');
await page.fill('#pbf_desc', 'ED com pedido de prequestionamento'); await page.click('[data-pbd="confirmar"]'); await page.waitForTimeout(1200);
ag = (await docs('agenda')).filter(d => d.pubId === '930002')[0];
check(ag && ag.pecaOrigem === 'ajustada' && ag.titulo === 'ED com pedido de prequestionamento' && ag.dias === 5, 'se você muda o texto da descrição, fica registrado como “ajustada”');
// 4) tutela
await abrir('Tarcio Tutela');
check(/Agravo de instrumento/.test(await t('#pbCorpo')) && /CPC 1\.015, I/.test(await t('#pbCorpo')) && /Tema 988/.test(await t('#pbCorpo')), 'tutela indeferida → agravo de instrumento, com o aviso do art. 1.015');
await fechar();
// 5) Juizado
await abrir('Jairo Juizado');
det = await t('#pbCorpo'); check(/Recurso inominado/.test(det) && /Lei 9\.099, art\. 42/.test(det) && await v('pbf_dias') === '10', 'Juizado → recurso inominado em 10 dias');
check(await page.evaluate(() => !document.getElementById('pbf_dobro')), 'no Juizado não oferece prazo em dobro');
await fechar();
// 6) lado do cliente desconhecido
await abrir('Ambos Autor');
check(await page.evaluate(() => !!document.getElementById('pbf_polo')), 'quando a publicação não diz o lado do cliente, pergunta');
await page.selectOption('#pbf_polo', 'P'); await page.waitForTimeout(500);
check(/seu cliente é o réu/.test(await t('#pbCorpo')) && /Contrarrazões/.test(await t('#pbCorpo')) && (await v('pbf_desc')).startsWith('Contrarrazões'), 'informado que é o réu e a sentença é de improcedência: contrarrazões como principal');
await fechar();
// 7) Fazenda: dobro sugerido
await abrir('MUNICÍPIO');
check(await v('pbf_dobro') === 'fazenda', 'cliente é o Município: o prazo em dobro já vem marcado');
await fechar();
// 8) registro sem prazo
await abrir('Gabriel Generico');
det = await t('#pbCorpo'); check(/Registrar para futura preliminar/.test(det) && /sem prazo imediato/.test(det) && /CPC 1\.009, §1º/.test(det), 'interlocutória sem agravo → registro, sem prazo');
await page.click('[data-pbd="registrar"]'); await page.waitForTimeout(1200);
const prG = (await docs('processos')).filter(p => p.numero === num(5))[0];
check(prG && prG.registros && prG.registros.length === 1 && /preliminar de apelação/.test(prG.registros[0].texto) && prG.registros[0].pubId === '930005', 'registrar grava a anotação no processo (cria o cadastro do processo se só havia a Inicial)');
await fechar();
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(700);
await page.click('[data-pr="abrir"][data-n="' + num(5).replace(/\D/g, '') + '"]'); await page.waitForTimeout(600);
check(/Registro · /.test(await t('#prCorpo')) && /preliminar de apelação/.test(await t('#prCorpo')), 'o registro aparece na linha do tempo do processo');
// 9) seletor ▾ do campo Descrição: todas as peças cadastradas (Fase 3, etapa 3.1); a escolha entra no aprendizado
await page.click('#prX'); await page.waitForTimeout(400);   // fecha a ficha do processo aberta no passo anterior
await page.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await page.waitForTimeout(500);
await page.click('#pbSeg [data-v="todas"]'); await page.waitForTimeout(500);   // abrir uma publicação a marca como lida: volta a listá-las pela sub-aba “Todas”
await abrir('Jairo Juizado');
await page.click('#pbCatBtn'); await page.waitForTimeout(300);
check(/Recurso inominado/.test(await t('#pbCatLista')) && !/\nApelação\n/.test('\n' + (await t('#pbCatLista')).replace(/ \d+ dias.*\n/g, '\n')), 'no Juizado a lista mostra os prazos do Juizado (recurso inominado, não apelação)');
await fechar();
await abrir('Tarcio Tutela');
const sugAntes = await t('.pb-pc.on'), nSugAntes = await page.evaluate(() => document.querySelectorAll('.pb-pc').length);
check(await page.evaluate(() => !!document.getElementById('pbCatBtn') && document.getElementById('pbCatBox').hidden), 'o campo Descrição tem a setinha ▾ e a lista começa fechada');
await page.click('#pbCatBtn'); await page.waitForTimeout(300);
const lista = await t('#pbCatLista');
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'lista.png' });
check(/MANIFESTAÇÕES E DEFESAS/i.test(lista) && /RECURSOS/i.test(lista) && /EXECUÇÃO E CUMPRIMENTO/i.test(lista) && /Contestação/.test(lista) && /Agravo de instrumento/.test(lista) && /CPC 335/.test(lista), 'a lista traz as peças agrupadas, com dias e base legal');
await page.fill('#pbCatBusca', 'embargos de declaracao'); await page.waitForTimeout(300);
const filtrada = await t('#pbCatLista');
check(/Manifestação sobre os embargos de declaração/.test(filtrada) && !/Contestação/.test(filtrada), 'digitar filtra a lista (sem acento também)');
await page.click('.pb-cat-i:has-text("Manifestação sobre os embargos de declaração")'); await page.waitForTimeout(500);
check(await v('pbf_desc') === 'Manifestação sobre os embargos de declaração' && await v('pbf_dias') === '5' && await v('pbf_tipo') === 'uteis', 'escolher preenche descrição, dias e contagem');
check(/Vence em/.test(await t('#pbCalc')), 'e o vencimento é recalculado');
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'escolhida.png' });
check(await page.evaluate(() => document.querySelectorAll('.pb-pc.on').length) === 0 && await page.evaluate(() => document.querySelectorAll('.pb-pc').length) === nSugAntes && /Agravo de instrumento/.test(await t('#pbCorpo')), 'a sugestão de cima não muda (só deixa de estar marcada)');
await page.click('.pb-pc:has-text("Agravo de instrumento")'); await page.waitForTimeout(400);
check(await v('pbf_desc') === 'Agravo de instrumento' && await v('pbf_dias') === '15', 'voltar a uma peça sugerida desfaz a escolha da lista');
await page.click('#pbCatBtn'); await page.waitForTimeout(300); await page.click('.pb-cat-i:has-text("Manifestação sobre os embargos de declaração")'); await page.waitForTimeout(500);
await page.click('[data-pbd="confirmar"]'); await page.waitForTimeout(1300);
ag = (await docs('agenda')).filter(d => d.pubId === '930003')[0];
check(ag && ag.peca === 'Manifestação sobre os embargos de declaração' && ag.pecaOrigem === 'escolhida' && ag.dias === 5 && ag.pecaBase === 'CPC 1.023, §2º', 'o prazo na Agenda guarda a peça escolhida na lista (origem “escolhida”)');
const apr = (await docs('pecasAprendidas')).filter(e => e.tipo === 'peca' && e.peca === 'Manifestação sobre os embargos de declaração');
check(apr.length === 1 && apr[0].usos === 1 && apr[0].dias === 5 && apr[0].ativa !== false, 'a escolha entrou no aprendizado (1 uso)');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
for (const col of ['casos', 'agenda', 'processos', 'config']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await br.close(); fake.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
