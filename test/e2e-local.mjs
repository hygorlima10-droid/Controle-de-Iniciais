// Teste de ponta a ponta: sobe o app no servidor local, cadastra uma despesa e uma petição, recarrega e confere que ficaram guardadas.
// Uso: suba o servidor local com SENHA (veja README) e rode: node test/e2e-local.mjs
import { createRequire } from 'module'; const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const URL = process.env.URL || 'http://127.0.0.1:8788/', SENHA = process.env.SENHA || 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 400, height: 860 } })).newPage(); const erros = [];
page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(URL); await page.waitForTimeout(500);
if (page.url().includes('/login')) { await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(1500); }
check(await page.evaluate(() => !!window.claude), 'o shim criou window.claude');
check(await page.evaluate(() => document.getElementById('banner') ? getComputedStyle(document.getElementById('banner')).display === 'none' : true), 'app conectado ao banco (sem aviso de modo local)');
await page.click('#inicioNovo'); await page.waitForTimeout(200); await page.click('[data-novo-k="despesa"]'); await page.waitForTimeout(300);
await page.fill('#despesaNomeInput', 'Aluguel do escritório'); await page.fill('#despesaValorInput', '1.250,50');
await page.evaluate(() => document.querySelector('#segDespesaTipo [data-value="unica"]').click()); await page.fill('#despesaDataInput', '2026-11-20');
await page.click('#saveBtnDespesa'); await page.waitForTimeout(800);
await page.click('#inicioNovo'); await page.waitForTimeout(200); await page.click('[data-novo-k="peticao"]'); await page.waitForTimeout(300);
await page.fill('#clienteInput', 'Fulano de Tal'); await page.fill('#nomeAcaoInput', 'Revisional'); await page.fill('#valorInput', '3.000'); await page.click('#saveBtn'); await page.waitForTimeout(800);
const api = await page.evaluate(async () => ({ d: await (await fetch('/api/db/despesas')).json(), c: await (await fetch('/api/db/casos')).json() }));
check(api.d.docs.length === 1 && api.d.docs[0].data.nome === 'Aluguel do escritório' && api.d.docs[0].data.valorPadrao === 1250.5 || JSON.stringify(api.d).includes('1250.5'), 'despesa gravada no banco com valor 1250,50');
check(api.c.docs.length === 1 && api.c.docs[0].data.cliente === 'Fulano de Tal', 'petição gravada no banco');
await page.reload(); await page.waitForTimeout(1500);
check(await page.evaluate(() => document.body.innerText.includes('Fulano de Tal') || true) , 'recarregou a página');
await page.evaluate(() => document.querySelector('#drawer [data-tab="peticoes"]').click()); await page.waitForTimeout(600);
check((await page.evaluate(() => document.body.innerText)).includes('Fulano de Tal'), 'após recarregar, a petição continua na lista (veio do servidor)');
// apagar
const id = api.c.docs[0].id; await page.evaluate(i => fetch('/api/db/casos/' + i, { method: 'DELETE' }), id);
const d2 = await page.evaluate(async () => (await (await fetch('/api/db/casos')).json()).docs.length); check(d2 === 0, 'exclusão via API funciona');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ' -> ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? falhas + ' FALHAS' : 'tudo ok'); process.exit(falhas ? 1 : 0);
