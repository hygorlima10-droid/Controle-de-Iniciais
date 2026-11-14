// Testa que as barras de sub-abas não mexem na vertical (defeito do iPhone: balançavam ao arrastar o dedo) e que, no celular, rolam só na horizontal,
// numa linha só, com a sub-aba ativa à vista. Grupo principal (porta 8812):  node test/rodar.mjs abas-fixas
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
  const barras = () => page.evaluate(() => [...document.querySelectorAll('.md-abas')].filter((e) => e.getClientRects().length).map((e) => { const cs = getComputedStyle(e), on = e.querySelector('button.on'), r = e.getBoundingClientRect(), o = on && on.getBoundingClientRect(); return { n: e.children.length, rola: e.scrollWidth > e.clientWidth + 1, vertical: cs.overflowY === 'auto' || cs.overflowY === 'scroll' || e.scrollHeight > e.clientHeight, linhas: new Set([...e.children].map((b) => Math.round(b.getBoundingClientRect().top))).size, ativaVisivel: !o || (o.left >= r.left - 1 && o.right <= r.right + 1) }; }));
  let vistas = 0, ruins = [];
  const alvos = [['financeiro', 'resumo'], ['financeiro', 'geral'], ['financeiro', 'pj'], ['financeiro', 'pf'], ['financeiro', 'patrimonio'], ['financeiro', 'orcamento'], ['obra'], ['extratos'], ['analises'], ['inicio'], ['peticoes'], ['acordos'], ['alvaras'], ['agenda'], ['processos'], ['publicacoes'], ['clientes']];
  for (const [tab, fin] of alvos) {
    await page.evaluate(([tab, fin]) => { const b = document.querySelector('#drawer [data-tab="' + tab + '"]' + (fin ? '[data-fin="' + fin + '"]' : '')) || document.querySelector('#drawer [data-tab="' + tab + '"]'); if (b) b.click(); }, [tab, fin]);
    await page.waitForTimeout(600);
    for (const b of await barras()) { vistas++; if (b.vertical || b.linhas !== 1 || !b.ativaVisivel) ruins.push(tab + (fin ? '/' + fin : '') + ' ' + JSON.stringify(b)); }
  }
  check(vistas > 10 && ruins.length === 0, nome + ': ' + vistas + ' barras de sub-abas conferidas: nenhuma mexe na vertical, todas numa linha só, com a sub-aba ativa à vista' + (ruins.length ? ' → ' + ruins.join(' | ') : ''));
  if (celular) {
    await page.evaluate(() => document.querySelector('#drawer [data-tab="financeiro"][data-fin="resumo"]').click()); await page.waitForTimeout(600);
    const b = (await barras())[0]; check(b.n === 7 && b.rola && b.linhas === 1, nome + ': as 7 sub-abas do Financeiro ficam numa linha só, com rolagem na horizontal');
    /* a rolagem é só na horizontal: tentar mexer na vertical não move nada, e na horizontal a barra anda */
    const r = await page.evaluate(() => { const e = [...document.querySelectorAll('.md-abas')].find((x) => x.getClientRects().length); e.scrollTop = 25; e.scrollLeft = 120; return { st: e.scrollTop, sl: e.scrollLeft, sh: e.scrollHeight, ch: e.clientHeight }; });
    check(r.st === 0 && r.sl > 20, nome + ': a barra anda na horizontal (scrollLeft ' + Math.round(r.sl) + ') e não tem vertical (scrollTop ' + r.st + '; altura ' + r.sh + '/' + r.ch + ')');
    const ult = await page.evaluate(() => { const e = [...document.querySelectorAll('.md-abas')].find((x) => x.getClientRects().length); const b = e.querySelector('button:last-child'); b.click(); return b.textContent; }); await page.waitForTimeout(700);
    const vis = await barras(); check(vis[0].ativaVisivel, nome + ': ao escolher a última sub-aba (' + ult.trim() + '), a barra rola sozinha e ela fica à vista');
  }
  check(erros.length === 0, nome + ': sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await page.close();
}
await varrer(await br.newContext({ ...devices['iPhone 13'] }), 'celular', true);
await varrer(await br.newContext({ viewport: { width: 1280, height: 900 } }), 'computador', false);
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
