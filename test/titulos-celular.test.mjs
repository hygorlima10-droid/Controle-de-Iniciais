// O título da tela (barra do topo) não pode ficar cortado ("Divisão d…") no celular, nem em telas estreitas de 360 px.
// Use: node test/rodar.mjs titulos-celular
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.61' } }); const ck = r.headers.get('set-cookie').split(';')[0];
await fetch(B + '/api/db/config/backup', { method: 'PUT', headers: { cookie: ck, 'content-type': 'application/json' }, body: JSON.stringify({ ultimoEm: agora }) });
const br = await chromium.launch();
for (const w of [390, 360]) {
  const ctx = await br.newContext({ viewport: { width: w, height: 800 } }); const page = await ctx.newPage(); await page.route(/fonts\./, x => x.abort());
  await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
  const cortados = [];
  for (const sel of ['[data-tab="inicio"]', '[data-tab="peticoes"]', '[data-tab="acordos"]', '[data-tab="alvaras"]', '[data-tab="agenda"]', '[data-tab="processos"]', '[data-tab="publicacoes"]', '[data-tab="clientes"]', '[data-tab="arquivados"]', '[data-fin="resumo"]', '[data-fin="geral"]', '[data-fin="pj"]', '[data-fin="pf"]', '[data-fin="patrimonio"]', '[data-fin="orcamento"]', '[data-tab="analises"]', '[data-tab="obra"]', '[data-tab="extratos"]', '[data-tab="configuracoes"]']) {
    await page.evaluate(s => document.querySelector('#drawer ' + s).click(), sel); await page.waitForTimeout(500);
    const t = await page.evaluate(() => { const b = document.getElementById('tituloTela'); return { txt: b.innerText, corta: b.scrollWidth > b.clientWidth + 1 }; });
    if (t.corta) cortados.push(t.txt);
  }
  check(cortados.length === 0, 'celular de ' + w + ' px: nenhum título cortado' + (cortados.length ? ' → ' + cortados.join(', ') : ''));
  await ctx.close();
}
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
