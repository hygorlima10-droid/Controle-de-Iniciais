// Testa que as barras de sub-abas ficam paradas (Financeiro e demais abas): no celular nada rola (quebra em linhas), em qualquer tela a barra não rola na vertical.
// Grupo principal (porta 8812):  node test/rodar.mjs abas-fixas
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch();
async function varrer(ctx, nome, celular) {
  const page = await ctx.newPage(), erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.route(/fonts\./, (x) => x.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
  const barras = () => page.evaluate(() => [...document.querySelectorAll('.md-abas')].filter((e) => e.getClientRects().length).map((e) => { const cs = getComputedStyle(e); return { n: e.children.length, rola: e.scrollWidth > e.clientWidth + 1, vertical: cs.overflowY === 'auto' || cs.overflowY === 'scroll', linhas: new Set([...e.children].map((b) => Math.round(b.getBoundingClientRect().top))).size }; }));
  let vistas = 0, ruins = [];
  const alvos = [['financeiro', 'resumo'], ['financeiro', 'geral'], ['financeiro', 'pj'], ['financeiro', 'pf'], ['financeiro', 'patrimonio'], ['financeiro', 'orcamento'], ['obra'], ['extratos'], ['analises'], ['inicio'], ['peticoes'], ['acordos'], ['alvaras'], ['agenda'], ['processos'], ['publicacoes'], ['clientes']];
  for (const [tab, fin] of alvos) {
    await page.evaluate(([tab, fin]) => { const b = document.querySelector('#drawer [data-tab="' + tab + '"]' + (fin ? '[data-fin="' + fin + '"]' : '')) || document.querySelector('#drawer [data-tab="' + tab + '"]'); if (b) b.click(); }, [tab, fin]);
    await page.waitForTimeout(600);
    for (const b of await barras()) { vistas++; if (b.vertical || (celular && b.rola)) ruins.push(tab + (fin ? '/' + fin : '') + ' ' + JSON.stringify(b)); }
  }
  check(vistas > 10 && ruins.length === 0, nome + ': ' + vistas + ' barras de sub-abas conferidas, nenhuma rola' + (celular ? ' (nem na horizontal)' : ' na vertical') + (ruins.length ? ' → ' + ruins.join(' | ') : ''));
  if (celular) {
    await page.evaluate(() => document.querySelector('#drawer [data-tab="financeiro"][data-fin="resumo"]').click()); await page.waitForTimeout(600);
    const b = (await barras())[0]; check(b.n === 7 && b.linhas === 2, nome + ': as 7 sub-abas do Financeiro aparecem todas, em ' + b.linhas + ' linhas');
  }
  check(erros.length === 0, nome + ': sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await page.close();
}
await varrer(await br.newContext({ ...devices['iPhone 13'] }), 'celular', true);
await varrer(await br.newContext({ viewport: { width: 1280, height: 900 } }), 'computador', false);
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
