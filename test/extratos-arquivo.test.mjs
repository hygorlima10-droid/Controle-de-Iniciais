// Testa a leitura de extratos por arquivo (OFX e PDF) e o recebimento pelo Compartilhar (/api/enviar).
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --var ENVIO_TOKEN:token-de-teste-com-mais-de-24-caracteres --port 8795
// Opcional: PDFS=/pasta/com/b_itau.pdf,c_sicoob.pdf e PDFJS=/pasta/do/pdfjs/build/ (dados reais ficam fora do repositório)
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8795', SENHA = 'senha-de-teste-123', TOKEN = 'token-de-teste-com-mais-de-24-caracteres';
const PDFDIR = process.env.PDFS || '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/extratos/', PDFJS = process.env.PDFJS || '/tmp/claude-0/-home-user/73bc448f-589a-50cb-a941-bd114c59c1e4/scratchpad/pdfjs_test/node_modules/pdfjs-dist/build/';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const OFX = `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>0341<BRANCHID>0123<ACCTID>45678-9<ACCTTYPE>CHECKING</BANKACCTFROM>\n<BANKTRANLIST><DTSTART>20261001<DTEND>20261031\n<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261020120000<TRNAMT>3000.00<FITID>A1<MEMO>PIX RECEBIDO MURILO ADVOGADOS</STMTTRN>\n<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261021<TRNAMT>-1200,50<FITID>A2<NAME>IMOBILIARIA XPTO<MEMO>PIX ENVIADO ALUGUEL</STMTTRN>\n</BANKTRANLIST><LEDGERBAL><BALAMT>1799.50<DTASOF>20261031</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
{ const l = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.1' } }); const c0 = l.headers.get('set-cookie').split(';')[0];
  for (const col of ['extratos', 'config']) for (const d of (await (await fetch(B + '/api/db/' + col, { headers: { cookie: c0 } })).json()).docs) await fetch(B + '/api/db/' + col + '/' + d.id, { method: 'DELETE', headers: { cookie: c0 } });
  for (const d of (await (await fetch(B + '/api/recebidos', { headers: { cookie: c0 } })).json()).itens) await fetch(B + '/api/recebidos/' + d.id, { method: 'DELETE', headers: { cookie: c0 } }); }
const env = (n, o = {}) => fetch(B + '/api/enviar', { method: 'POST', ...o, headers: { ...(o.headers || {}) } });
let r = await env(0, { body: 'x' }); check(r.status === 401, 'enviar sem token: 401');
r = await env(0, { body: 'x', headers: { authorization: 'Bearer errado' } }); check(r.status === 401, 'enviar com token errado: 401');
r = await env(0, { body: Buffer.from(OFX), headers: { authorization: 'Bearer ' + TOKEN, 'x-nome': encodeURIComponent('extrato outubro.ofx'), 'content-type': 'application/x-ofx' } }); let j = await r.json();
check(r.status === 200 && j.ok && j.nome === 'extrato outubro.ofx', 'enviar com token certo: recebe o arquivo e o nome');
const fd = new FormData(); fd.append('arquivo', new Blob([OFX.replace('A1', 'B1').replace('A2', 'B2')], { type: 'application/x-ofx' }), 'segundo.ofx');
r = await env(0, { body: fd, headers: { authorization: 'Bearer ' + TOKEN } }); j = await r.json(); check(r.status === 200 && j.nome === 'segundo.ofx', 'enviar em formato multipart também funciona');
r = await env(0, { body: Buffer.alloc(700 * 1024, 65), headers: { authorization: 'Bearer ' + TOKEN } }); check(r.status === 413, 'arquivo grande demais: 413 com mensagem');
r = await env(0, { body: Buffer.alloc(0), headers: { authorization: 'Bearer ' + TOKEN } }); check(r.status === 400, 'arquivo vazio: 400');
for (let i = 0; i < 5; i++) await fetch(B + '/api/enviar', { method: 'POST', body: 'x', headers: { authorization: 'Bearer ruim' + i, 'cf-connecting-ip': '5.5.5.5' } });
r = await fetch(B + '/api/enviar', { method: 'POST', body: 'x', headers: { authorization: 'Bearer ' + TOKEN, 'cf-connecting-ip': '5.5.5.5' } }); check(r.status === 429, 'depois de 5 tokens errados o IP é bloqueado');
r = await fetch(B + '/api/recebidos'); check(r.status === 401, 'lista de recebidos exige sessão');
r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }) }); const ck = r.headers.get('set-cookie').split(';')[0];
j = await (await fetch(B + '/api/recebidos', { headers: { cookie: ck } })).json(); check(j.itens.length === 2 && !JSON.stringify(j).includes('"b64"'), 'sessão vê 2 recebidos (só os nomes, sem o conteúdo)');
r = await fetch(B + '/api/db/_recebidos', { headers: { cookie: ck } }); check(r.status === 404, 'a área interna não aparece pela API de dados');
// tela
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 400, height: 860 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
if (fs.existsSync(PDFJS + 'pdf.min.js')) { await page.route(/cdnjs.*pdf\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.min.js') })); await page.route(/cdnjs.*pdf\.worker\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PDFJS + 'pdf.worker.min.js') })); }
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(1500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(1200);
const topo = () => page.evaluate(() => document.getElementById('extTopo').innerText);
check(/Escolher extratos/.test(await topo()) && !/Drive/.test(await topo()), 'tela Extratos oferece "Escolher extratos" (sem pedir pasta do Drive)');
check(/Recebidos pelo Compartilhar \(2\)/.test(await topo()), 'mostra os 2 arquivos recebidos pelo Compartilhar');
await page.click('#impLerRec'); await page.waitForTimeout(2500);
check(/Li 2 arquivo/.test(await topo()) && !/Recebidos pelo Compartilhar/.test(await topo()), 'ler os recebidos: leu 2 e limpou a lista de recebidos');
let docs = await page.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.filter(d => d.data.tipo === 'arquivo').map(d => d.data));
check(docs.length === 2 && docs.every(d => d.status === 'pendente' && d.banco === 'Itaú' && d.chave === 'itau-0123-45678-9'), 'OFX: 2 extratos pendentes do Itaú, conta itau-0123-45678-9');
check(docs[0].lanc.length === 2 && docs[0].lanc.some(l => l.v === 300000) && docs[0].lanc.some(l => l.v === -120050 && l.n === 'IMOBILIARIA XPTO'), 'OFX: valores em centavos, vírgula decimal e contraparte lidos');
check(docs[0].saldoAtual === 179950, 'OFX: saldo final lido');
await page.evaluate(() => { document.getElementById('impArq').style.display = 'block'; });
fs.writeFileSync('/tmp/ofx1.ofx', OFX);
await page.setInputFiles('#impArq', '/tmp/ofx1.ofx'); await page.waitForTimeout(1500);
check(/já tinha/.test(await topo()), 'mesmo arquivo de novo: avisa que já foi lido, sem duplicar');
fs.writeFileSync('/tmp/lixo.txt', 'isto não é extrato');
await page.setInputFiles('#impArq', '/tmp/lixo.txt'); await page.waitForTimeout(1200);
check(/Formato não suportado/.test(await topo()), 'arquivo que não é extrato: mensagem clara');
await page.fill('#impCorte', '2026-01-01'); await page.waitForTimeout(800);
const cfg = await page.evaluate(async () => (await (await fetch('/api/db/config')).json()).docs.find(d => d.id === 'extratos').data);
check(cfg.dataCorte === '2026-01-01', 'a data de corte pode ser alterada e fica salva');
const pdfs = (process.env.PDFS_LISTA || 'b_itau.pdf,c_sicoob.pdf,a_comprovante.pdf').split(',').map(x => PDFDIR + x).filter(f => fs.existsSync(f));
if (pdfs.length && fs.existsSync(PDFJS + 'pdf.min.js')) {
  await page.setInputFiles('#impArq', pdfs); await page.waitForTimeout(6000);
  const t = await topo(); check(/Li \d+ arquivo/.test(t), 'PDFs reais: leitura concluída (' + t.split('\n').filter(x => /Li |Não reconheci/.test(x)).join(' | ').slice(0, 160) + ')');
  docs = await page.evaluate(async () => (await (await fetch('/api/db/extratos')).json()).docs.filter(d => d.data.tipo === 'arquivo').map(d => d.data));
  check(docs.filter(d => d.formato !== 'ofx').length >= 0 && docs.some(d => /sicoob|itau/.test(d.chave) && d.titulo && /\.pdf$/i.test(d.titulo)) , 'PDFs reais viraram extratos pendentes');
  await page.click('#extConferir'); await page.waitForTimeout(1500);
  const conf = await page.evaluate(() => document.getElementById('extCorpo').innerText);
  check(conf.length > 200 && /R\$/.test(conf), 'a tela de conferência abre com as linhas dos extratos lidos');
} else console.log('  (PDFs reais ou pdf.js local não encontrados: etapa dos PDFs ignorada)');
// arquivo mandado pelo Atalho com o app JÁ aberto: aparece ao abrir a tela de Extratos, sem reabrir o app (e avisa no menu)
const menuAntes = Number((await page.evaluate(() => document.getElementById('menuNExtratos').textContent)).trim() || 0);
r = await env(0, { body: Buffer.from(OFX.replace('A1', 'C1').replace('A2', 'C2')), headers: { authorization: 'Bearer ' + TOKEN, 'x-nome': encodeURIComponent('Entradas_Saidas_teste'), 'content-type': 'application/pdf' } }); check(r.status === 200, 'Atalho manda mais um arquivo com o app aberto');
await page.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await page.waitForTimeout(500);
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(1000);
check(Number((await page.evaluate(() => document.getElementById('menuNExtratos').textContent)).trim() || 0) === menuAntes + 1, 'o menu Extratos passa a contar o arquivo recebido esperando leitura (+1)');
await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(1200);
check(/Recebidos pelo Compartilhar \(1\)/.test(await topo()) && /Entradas_Saidas_teste/.test(await topo()), 'ao abrir Extratos, o arquivo novo aparece na lista de recebidos (sem reabrir o app)');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ' -> ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? falhas + ' FALHAS' : 'tudo ok'); process.exit(falhas ? 1 : 0);
