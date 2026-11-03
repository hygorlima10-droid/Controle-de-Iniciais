// Testa o Open Finance com uma "Pluggy de mentira" (servidor simulado): diagnóstico, sincronização, repetição e erros.
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --var PLUGGY_CLIENT_ID:id --var PLUGGY_CLIENT_SECRET:segredo --var PLUGGY_BASE_URL:http://127.0.0.1:9997 --port 8792
import http from 'node:http'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8792', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
let modo = 'ok', pedidos = [];
const itens = { 'item-itau': { name: 'Itaú', type: 'PERSONAL_BANK' }, 'item-sicoob': { name: 'Sicoob', type: 'BUSINESS_BANK' } };
const contas = { 'item-itau': [{ id: 'cc1', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta Corrente', number: '12345-6', owner: 'HYGOR LIMA', taxNumber: '12345678900', balance: 1500.25, bankData: { transferNumber: '0123/12345-6' } }, { id: 'cart1', type: 'CREDIT', subtype: 'CREDIT_CARD', name: 'Cartão Visa', number: '1111222233334444', balance: 800, creditData: { creditLimit: 5000 } }],
  'item-sicoob': [{ id: 'cc2', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta PJ', number: '9876-5', owner: 'ESCRITORIO LTDA', taxNumber: '12345678000199', balance: 20000, bankData: { transferNumber: '3001/98765' } }] };
const movs = { cc1: [
  { id: 't1', date: '2026-10-20T00:00:00.000Z', description: 'PIX RECEBIDO MURILO', amount: 3000, type: 'CREDIT', status: 'POSTED', paymentData: { payer: { name: 'MURILO ADVOGADOS', documentNumber: { value: '11222333000144' } } } },
  { id: 't2', date: '2026-10-21T00:00:00.000Z', description: 'PIX ENVIADO ALUGUEL', amount: -1200.5, type: 'DEBIT', status: 'POSTED', paymentData: { receiver: { name: 'IMOBILIARIA XPTO', documentNumber: { value: '99888777000166' } } } },
  { id: 't3', date: '2026-10-25T00:00:00.000Z', description: 'COMPRA MERCADO', amount: -230.4, type: 'DEBIT', status: 'PENDING' },
  { id: 't4', date: '2026-09-10T00:00:00.000Z', description: 'ANTIGA', amount: -10, type: 'DEBIT', status: 'POSTED' }],
  cc2: [{ id: 't5', date: '2026-10-22T00:00:00.000Z', description: 'RECEBIMENTO PIX', amount: 5000, type: 'CREDIT', status: 'POSTED' }], cart1: [{ id: 'c1', date: '2026-10-23T00:00:00.000Z', description: 'POSTO IPIRANGA', amount: 245.9, type: 'DEBIT', status: 'POSTED' }] };
const mock = http.createServer((q, s) => { let d = ''; q.on('data', c => d += c); q.on('end', () => {
  const u = new URL(q.url, 'http://x'); pedidos.push(q.method + ' ' + u.pathname); const out = (st, o) => { s.writeHead(st, { 'content-type': 'application/json' }); s.end(JSON.stringify(o)); };
  if (u.pathname === '/auth') { if (modo === 'chave') return out(401, { message: 'Invalid credentials' }); return out(200, { apiKey: 'k-' + Date.now() }); }
  if (q.headers['x-api-key'] === undefined) return out(401, { message: 'sem chave' });
  if (u.pathname === '/items') return out(200, { results: Object.keys(itens).map(id => ({ id })) });
  let m = u.pathname.match(/^\/items\/(.+)$/); if (m) return itens[m[1]] ? out(200, { id: m[1], status: 'UPDATED', connector: itens[m[1]], lastUpdatedAt: '2026-11-03T03:00:00Z' }) : out(404, { message: 'nope' });
  if (u.pathname === '/accounts') return out(200, { results: contas[u.searchParams.get('itemId')] || [] });
  if (u.pathname === '/transactions') { const de = u.searchParams.get('from'), lista = (movs[u.searchParams.get('accountId')] || []).filter(x => x.date.slice(0, 10) >= de); return out(200, { total: lista.length, totalPages: 1, page: 1, results: lista }); }
  out(404, { message: 'rota' });
}); }).listen(9997);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }) }); const ck = r.headers.get('set-cookie').split(';')[0];
r = await fetch(B + '/api/of/status', { headers: { cookie: ck } }); check((await r.json()).configurado === true, 'status: Open Finance configurado');
r = await fetch(B + '/api/of/status'); check(r.status === 401, 'status sem sessão: bloqueado');
r = await fetch(B + '/api/of/sincronizar?desde=2026-10-01'); check(r.status === 401, 'sincronizar sem sessão: bloqueado');
r = await fetch(B + '/api/of/sincronizar?desde=ontem', { headers: { cookie: ck } }); check(r.status === 400, 'data inicial inválida: recusa');
let j = await (await fetch(B + '/api/of/diagnostico', { headers: { cookie: ck } })).json();
check(j.autenticou === true && j.itens.length === 2 && j.itens[0].conector === 'Itaú' && j.itens[0].contas.length === 2, 'diagnóstico: autentica e lista 2 conexões (uma com conta e cartão)');
check(!JSON.stringify(j).includes('12345-6') && !JSON.stringify(j).includes('1111222233334444') && !JSON.stringify(j).includes('segredo'), 'diagnóstico não expõe número completo da conta, do cartão nem o segredo');
check(j.itens[0].contas[0].movimentos90d === 4, 'diagnóstico conta movimentos dos últimos 90 dias');
j = await (await fetch(B + '/api/of/sincronizar?desde=2026-10-01', { headers: { cookie: ck } })).json();
const c1 = j.contas.find(c => c.contaId === 'cc1'), c2 = j.contas.find(c => c.contaId === 'cc2');
check(j.contas.length === 2 && c1.lanc.length === 2 && c1.lanc[0].valor === 300000 && c1.lanc[1].valor === -120050, 'sincronizar: 2 contas correntes; pendentes e anteriores ao período ficam de fora; valores em centavos com sinal');
check(c1.chave === 'itau-0123-12345-6' && c1.tipoConta === 'pf' && c2.chave === 'sicoob-3001-98765' && c2.tipoConta === 'pj', 'chaves no padrão do app e PF/PJ pelo tipo do banco');
check(c1.lanc[0].nome === 'MURILO ADVOGADOS' && c1.lanc[0].doc === '11222333000144' && c1.saldoAtual === 150025, 'contraparte, documento e saldo');
check(j.cartoes.length === 1 && j.cartoes[0].movimentos === 1, 'cartão aparece à parte (ainda não vira lançamento)');
modo = 'chave'; r = await fetch(B + '/api/of/diagnostico', { headers: { cookie: ck } }); j = await r.json(); check(j.autenticou === false && /Autentica/.test(j.erro), 'chave recusada: diagnóstico explica');
modo = 'ok';
// pela tela
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 400, height: 860 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(1500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(800);
check(/Open Finance/.test(await page.evaluate(() => document.getElementById('extTopo').innerText)) && await page.evaluate(() => !!document.getElementById('ofAtualizar')), 'tela Extratos mostra o Open Finance (sem pedir pasta do Drive)');
await page.click('#ofAtualizar'); await page.waitForTimeout(600);
check(/Escolha a data/.test(await page.evaluate(() => document.getElementById('extTopo').innerText)), 'sem data inicial: pede a data');
await page.fill('#ofDesde', '2026-10-01'); await page.click('#ofAtualizar'); await page.waitForTimeout(2500);
check(/Trouxe 3 lançamento/.test(await page.evaluate(() => document.getElementById('extTopo').innerText)), 'atualizar traz 3 lançamentos novos de 2 contas');
const docs = await page.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.filter(d => d.data.tipo === 'arquivo'));
check(docs.length === 2 && docs.every(d => d.data.status === 'pendente') && docs.reduce((n, d) => n + d.data.lanc.length, 0) === 3, 'gravou 2 extratos pendentes com 3 linhas');
await page.click('#ofAtualizar'); await page.waitForTimeout(2000);
const tx2 = await page.evaluate(() => document.getElementById('extTopo').innerText); check(/Nenhum lançamento novo/.test(tx2), 'atualizar de novo não repete lançamentos' + (/Nenhum lançamento novo/.test(tx2) ? '' : ' -> ' + tx2.replace(/\n/g, ' | ')));
const docs2 = await page.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.filter(d => d.data.tipo === 'arquivo').length); check(docs2 === 2, 'continua com 2 extratos pendentes');
check(await page.evaluate(() => !!document.getElementById('extConferir')), 'botão Conferir aparece');
await page.click('#extConferir'); await page.waitForTimeout(1200);
check(/MURILO|ALUGUEL|RECEBIMENTO/i.test(await page.evaluate(() => document.getElementById('extCorpo').innerText)), 'tela de conferência abre com as linhas do Open Finance');
await page.evaluate(() => document.getElementById('overlayExt').classList.remove('show'));
await page.evaluate(() => document.getElementById('ofDiag').click()); await page.waitForTimeout(1500);
check(/Itaú/.test(await page.evaluate(() => document.getElementById('extCorpo').innerText)) && /movimentos|mov\./.test(await page.evaluate(() => document.getElementById('extCorpo').innerText)), 'diagnóstico abre na tela');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ' -> ' + erros.join(' | ') : ''));
await br.close(); mock.close(); console.log(falhas ? falhas + ' FALHAS' : 'tudo ok'); process.exit(falhas ? 1 : 0);
