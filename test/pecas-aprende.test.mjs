// Testa o aprendizado das peças (Fase 2): aprende o que você escolhe de diferente, só sugere depois de 2 usos, reforça quando aceita,
// desativa depois de 3 trocas seguidas e a tela "Peças e prazos" (desativar, apagar, regras do sistema, desfazer tudo).
// O Diário Oficial é simulado na porta 8890.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var DJEN_URL:http://127.0.0.1:8890/api/v1/comunicacao --port 8812
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const nomes = ['Lia Aprende Um', 'Lia Aprende Dois', 'Lia Aprende Tres', 'Lia Aprende Quatro', 'Lia Aprende Cinco', 'Lia Aprende Seis', 'Lia Aprende Sete', 'Lia Aprende Oito'];
const num = k => '59' + String(k).padStart(5, '0') + '-10.2026.8.09.0107';
const itens = nomes.map((n, k) => ({ id: 940001 + k, data_disponibilizacao: hoje, siglaTribunal: 'TJGO', tipoComunicacao: 'Intimação', tipoDocumento: 'Decisão', nomeOrgao: 'Morrinhos - 1ª Vara Cível', nomeClasse: 'PROCEDIMENTO COMUM', numero_processo: num(k + 1).replace(/\D/g, ''), numeroprocessocommascara: num(k + 1), link: 'https://exemplo.test/p/' + k,
  texto: 'Autos n.: ' + num(k + 1) + '\nPolo Ativo: ' + n + '\nPolo Passivo: Parte Contrária\nDECISÃO\nIndefiro a tutela de urgência requerida pela parte autora, por ausência de perigo de dano. Intimem-se.', destinatarios: [{ nome: n, polo: 'A' }], destinatarioadvogados: [] }));
const fake = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', count: itens.length, items: itens })); }).listen(8890);
await new Promise(ok => fake.on('listening', ok));
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.35' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'clientes', 'config', 'agenda', 'processos', 'pecasAprendidas']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('POST', '/api/djen/buscar', {});
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const v = async id => page.evaluate(i => (document.getElementById(i) || {}).value, id);
const cartao = n => page.evaluate(x => { const c = Array.from(document.querySelectorAll('.pb-card')).find(e => e.innerText.includes(x)); return c ? c.innerText : ''; }, n);
const abrir = async n => { await page.evaluate(x => { const c = Array.from(document.querySelectorAll('.pb-card')).find(e => e.innerText.includes(x)); c.querySelector('[data-pb="abrir"]').click(); }, n); await page.waitForTimeout(800); };
const aprend = async () => (await docs('pecasAprendidas')).filter(e => e.tipo === 'peca');
await page.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await page.waitForTimeout(1500);
await page.click('[data-pb="filtro"][data-v="todas"]'); await page.waitForTimeout(400);

// 1) base: sugere agravo
check(/✦ Agravo de instrumento/.test(await cartao(nomes[0])), 'no começo, vale a regra da lei: agravo de instrumento');
// 2) você escolhe outra peça duas vezes
await abrir(nomes[0]); await page.fill('#pbf_desc', 'Pedido de reconsideração'); await page.fill('#pbf_dias', '5'); await page.click('[data-pbd="confirmar"]'); await page.waitForTimeout(1500);
let ap = await aprend();
check(ap.length === 1 && ap[0].peca === 'Pedido de reconsideração' && ap[0].usos === 1 && ap[0].dias === 5, 'a primeira escolha diferente é guardada (1 uso)');
check(/✦ Agravo de instrumento/.test(await cartao(nomes[1])), 'com 1 uso ainda não sugere: continua a regra da lei');
await abrir(nomes[1]); await page.fill('#pbf_desc', 'Pedido de reconsideração'); await page.fill('#pbf_dias', '5'); await page.click('[data-pbd="confirmar"]'); await page.waitForTimeout(1500);
ap = await aprend();
check(ap.length === 1 && ap[0].usos === 2, 'a segunda vez junta com a primeira (2 usos, sem duplicar)');
// 3) agora sugere a aprendida
const c3 = await cartao(nomes[2]);
check(/✦ Pedido de reconsideração · 5 dias/.test(c3), 'com 2 usos, a peça aprendida passa a ser a sugerida no cartão');
await abrir(nomes[2]);
check(/aprendida/.test(await t('#pbCorpo')) && /você usou 2 vezes/.test(await t('#pbCorpo')) && await v('pbf_desc') === 'Pedido de reconsideração' && await v('pbf_dias') === '5', 'a leitura mostra “aprendida”, quantas vezes usou, e já preenche o prazo');
check(/Agravo de instrumento/.test(await t('#pbCorpo')), 'e mantém o agravo da lei como alternativa');
await page.click('[data-pbd="confirmar"]'); await page.waitForTimeout(1500);
ap = await aprend(); check(ap[0].usos === 3 && ap[0].trocas === 0, 'aceitar a sugestão reforça (3 usos)');
// 4) trocar 3 vezes seguidas desativa
for (const k of [3, 4, 5]) {
  await abrir(nomes[k]); await page.click('.pb-pc:has-text("Agravo de instrumento")'); await page.waitForTimeout(400);
  check(await v('pbf_desc') === 'Agravo de instrumento', 'troca ' + (k - 2) + ': você escolhe o agravo no lugar da aprendida');
  await page.click('[data-pbd="confirmar"]'); await page.waitForTimeout(1500);
}
ap = await aprend(); const recons = ap.find(e => e.peca === 'Pedido de reconsideração');
check(recons && recons.ativa === false && recons.trocas >= 3, 'depois de 3 trocas seguidas a peça aprendida é desativada');
check(!/✦ Pedido de reconsideração/.test(await cartao(nomes[6])) && /✦ Agravo de instrumento/.test(await cartao(nomes[6])), 'e o cartão volta a sugerir o agravo');

// 5) tela “Peças e prazos”
await page.click('[data-pb="menu"]'); await page.click('[data-pb="pecas"]'); await page.waitForTimeout(500);
let tela = await t('#pcsCorpo');
check(/Aprendido com você/i.test(tela) && /Pedido de reconsideração/.test(tela) && /desativada/.test(tela) && /Regras do sistema/i.test(tela), 'a tela mostra o que foi aprendido (com o estado) e as regras do sistema');
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#pcsCorpo .pb-oab')).find(x => /Pedido de reconsideração/.test(x.innerText)); b.querySelector('[data-pcs="toggle"]').click(); }); await page.waitForTimeout(900);
check((await aprend()).find(e => e.peca === 'Pedido de reconsideração').ativa === true, 'dá para reativar uma peça desativada');
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#pcsCorpo .pb-oab')).find(x => /Pedido de reconsideração/.test(x.innerText)); b.querySelector('input[type=number]').value = '7'; b.querySelector('[data-pcs="dias"]').click(); }); await page.waitForTimeout(900);
check((await aprend()).find(e => e.peca === 'Pedido de reconsideração').dias === 7, 'e mudar o prazo aprendido');
// regra do sistema desativada
await page.evaluate(() => { const l = Array.from(document.querySelectorAll('#pcsCorpo .pb-lin')).find(x => /tutela-nega/.test(x.innerText)); l.querySelector('[data-pcs="regra"]').click(); }); await page.waitForTimeout(900);
check((await docs('pecasAprendidas')).some(e => e.tipo === 'regra' && e.rid === 'tutela-nega' && e.desativada === true), 'desativar uma regra do sistema fica gravado');
await page.click('#pcsX'); await page.waitForTimeout(300);
const c7 = await cartao(nomes[7]);
check(!/Agravo de instrumento/.test(c7) || /Pedido de reconsideração/.test(c7), 'com a regra desativada, o agravo da lei deixa de ser sugerido');
// desfazer tudo
await page.click('[data-pb="menu"]'); await page.click('[data-pb="pecas"]'); await page.waitForTimeout(400);
await page.click('[data-pcs="zerar"]'); await page.click('[data-pcs="zerar"]'); await page.waitForTimeout(1500);
check((await aprend()).length === 0 && (await docs('pecasAprendidas')).some(e => e.tipo === 'regra'), '“Desfazer tudo o que aprendeu” apaga o aprendido e mantém as regras que você desativou');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
for (const col of ['agenda', 'processos', 'config', 'pecasAprendidas']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await br.close(); fake.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
