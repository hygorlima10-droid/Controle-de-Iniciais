// Testa que a mesma publicação vista por duas OABs (ou entregue a vários destinatários) vira um cartão só, e que atos diferentes não se misturam.
// O Diário Oficial é simulado na porta 8890 e responde por OAB.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var DJEN_URL:http://127.0.0.1:8890/api/v1/comunicacao --var DJEN_ESPERA_MS:0 --port 8812
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), ontem = new Date(Date.parse(hoje + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
const num = k => '61' + String(k).padStart(5, '0') + '-10.2026.8.09.0107';
const it = (id, k, data, tipo, texto, dest, advs) => ({ id, data_disponibilizacao: data, siglaTribunal: 'TJGO', tipoComunicacao: 'Intimação', tipoDocumento: tipo, nomeOrgao: 'Morrinhos - 1ª Vara Cível', nomeClasse: 'PROCEDIMENTO COMUM', numero_processo: num(k).replace(/\D/g, ''), numeroprocessocommascara: num(k), link: '', texto: 'Autos n.: ' + num(k) + '\n' + texto, destinatarios: [{ nome: dest, polo: 'A' }], destinatarioadvogados: advs.map(o => ({ advogado: { nome: 'Adv ' + o, numero_oab: o, uf_oab: 'GO' } })) });
const T1 = 'DECISÃO\nDefiro o pedido de penhora em face do executado, nos termos do art. 854.', T2 = 'DECISÃO\nIntime-se a parte para se manifestar sobre o laudo pericial juntado aos autos.', T3 = 'DECISÃO\nCumpra-se a determinação anterior no prazo legal estabelecido.', T4a = 'DECISÃO\nDefiro a juntada dos documentos novos apresentados.', T4b = 'DESPACHO\nVista à parte contrária para se manifestar em cinco dias.', T5 = 'EMENTA\nApelação cível. Negado provimento. Unânime.';
const H = [it(1, 1, hoje, 'Decisão', T1, 'Cliente A', ['60456', '49308']), it(2, 2, hoje, 'Decisão', T2, 'Cliente B', ['60456']), it(4, 3, hoje, 'Decisão', T3, 'Cliente C', ['60456']), it(5, 3, ontem, 'Decisão', T3, 'Cliente C', ['60456']), it(6, 4, hoje, 'Decisão', T4a, 'Cliente D', ['60456']), it(7, 4, hoje, 'Despacho', T4b, 'Cliente D', ['60456']), it(8, 5, hoje, 'Ementa', T5, 'Autor Um', ['60456']), it(9, 5, hoje, 'Ementa', T5, 'Autor Dois', ['60456']), it(10, 5, hoje, 'Ementa', T5, 'Autor Três', ['60456'])];
const M = [it(1, 1, hoje, 'Decisão', T1, 'Cliente A', ['60456', '49308']), it(3, 2, hoje, 'Outros', T2, 'Cliente B', ['49308'])];
const dados = { '60456': H, '49308': M };
const fake = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'), l = dados[u.searchParams.get('numeroOab')] || []; res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', count: l.length, items: Number(u.searchParams.get('pagina') || 1) === 1 ? l : [] })); }).listen(8890);
await new Promise(ok => fake.on('listening', ok));
const r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.41' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
await f('PUT', '/api/db/config/backup', { ultimoEm: new Date().toISOString() });
const est = (await f('GET', '/api/djen/estado')).j;
await f('PUT', '/api/djen/oabs', { oabs: est.oabs.filter(o => o.numero === '60456').concat([{ id: '', nome: 'Murilo', numero: '49308', uf: 'GO', ativo: true, escopo: 'tudo', avisar: true }]) });
const b = await f('POST', '/api/djen/buscar', { dias: 30 });
check(b.j.porOab.every(o => !o.erro), 'lê as duas OABs sem erro');
const lista = (await f('GET', '/api/djen/lista?dias=90')).j.pubs;
check(lista.length === 10, 'guarda 10 publicações (as repetidas entre as duas OABs não duplicam no banco): ' + lista.length);
const p1 = lista.find(p => p.id === '1'); check(p1 && p1.oabs.length === 2, 'a mesma publicação (mesmo id) fica com as duas OABs de origem');
check(lista.every(p => p.th && p.th.length > 3), 'toda publicação nova guarda a impressão digital do texto');
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.escopoPub', 'todas'); } catch (e) { } });   /* o proprietário abre em "Minhas"; este teste usa duas OABs e precisa ver "Todas" */
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(4500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await page.waitForTimeout(1500);
await page.click('[data-pb="filtro"][data-v="todas"]'); await page.waitForTimeout(500);
const cards = await page.evaluate(() => Array.from(document.querySelectorAll('.pb-card')).map(c => c.innerText));
const doProc = k => cards.filter(c => c.includes(num(k)));
check(cards.length === 7, 'na tela são 7 cartões (e não 10): ' + cards.length);
check(doProc(1).length === 1 && /via OAB Hygor/.test(doProc(1)[0]) && /via OAB Murilo/.test(doProc(1)[0]), 'a publicação vista pelas duas OABs é um cartão só, marcado com as duas OABs');
check(doProc(2).length === 1 && /2 publicações idênticas reunidas/.test(doProc(2)[0]), 'mesmo texto no mesmo dia, com tipo diferente entre as OABs ("Decisão" e "Outros"): um cartão só');
check(doProc(3).length === 2, 'mesmo texto em dias diferentes: dois cartões (são atos diferentes)');
check(doProc(4).length === 2, 'textos diferentes no mesmo dia: dois cartões');
check(doProc(5).length === 1 && /3 publicações idênticas reunidas/.test(doProc(5)[0]), 'o mesmo ato para três destinatários continua um cartão só');
await br.close(); fake.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
