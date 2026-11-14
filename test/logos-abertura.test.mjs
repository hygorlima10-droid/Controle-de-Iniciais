// Três versões do logo (escuro, transparente, branco) e tela de abertura (logo escuro + círculo girando, some em até 5 s).
// Use: node test/rodar.mjs logos-abertura
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
// 1) os arquivos são públicos (a tela de entrada e o iPhone os buscam sem sessão) e são PNG de verdade
const tipoPng = async n => { const r = await fetch(B + '/logo/' + n); const b = Buffer.from(await r.arrayBuffer()); return { st: r.status, ct: r.headers.get('content-type') || '', assinatura: b.slice(0, 8).toString('hex'), cor: b[25] }; };
const d = await tipoPng('logo-dark.png'), t = await tipoPng('logo-transparent.png'), w = await tipoPng('logo-white.png');
check([d, t, w].every(x => x.st === 200 && /image\/png/.test(x.ct) && x.assinatura === '89504e470d0a1a0a'), 'os três logos abrem sem sessão e são PNG');
check(t.cor === 6, 'o logo transparente tem canal de transparência de verdade (RGBA)');
check(w.cor !== 6 && d.cor !== 6, 'os logos de fundo branco e fundo escuro não têm transparência (fundo sólido)');
const lg = await fetch(B + '/login', { redirect: 'manual' }); const html = await lg.text();
check(/\/logo\/logo-dark\.png/.test(html), 'a tela de entrada usa o logo de fundo escuro');
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.41' } });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
// 2) testes automáticos pulam a abertura; no uso normal ela aparece
check((await page.locator('#abertura').count()) === 0, 'em teste automático (webdriver) a abertura não atrapalha');
// 3) menu lateral: logo transparente, sem quadrado atrás
const menu = await page.evaluate(() => { const i = document.querySelector('.dr-logo img'), c = document.querySelector('.dr-logo'); return { src: i.getAttribute('src'), ok: i.naturalWidth > 0, fundo: getComputedStyle(c).backgroundColor, larg: Math.round(i.getBoundingClientRect().width) }; });
check(/logo-transparent\.png/.test(menu.src) && menu.ok, 'o menu lateral usa o logo transparente e a imagem carrega');
check(menu.fundo === 'rgba(0, 0, 0, 0)' && menu.larg >= 44, 'sem quadrado preto atrás (fundo transparente, ' + menu.larg + ' px)');
// 4) abertura: ?abertura=1 mostra logo escuro + círculo e some sozinha em até 5 s
await page.goto(B + '/?abertura=1'); await page.waitForTimeout(500);
const ab = await page.evaluate(() => { const e = document.getElementById('abertura'); if (!e) return null; const g = e.querySelector('.ab-gira'); return { img: e.querySelector('img').getAttribute('src'), anim: g ? getComputedStyle(g).animationName : '', visivel: e.getClientRects().length > 0, z: getComputedStyle(e).position }; });
check(!!ab && ab.visivel && /logo-dark\.png/.test(ab.img), 'a tela de abertura aparece com o logo de fundo escuro');
check(!!ab && /gira/.test(ab.anim), 'tem o círculo girando');
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'abertura.png' });
const t0 = Date.now(); let some = false;
while (Date.now() - t0 < 5200) { if ((await page.locator('#abertura').count()) === 0) { some = true; break; } await page.waitForTimeout(150); }
check(some && Date.now() - t0 <= 5000, 'a abertura some sozinha (até 5 segundos), deixando o app à mostra');
// 5) toque fecha antes
await page.goto(B + '/?abertura=1'); await page.waitForTimeout(400); await page.click('#abertura'); await page.waitForTimeout(900);
check((await page.locator('#abertura').count()) === 0, 'tocar na abertura fecha na hora');
// 6) celular: logo do botão de menu transparente, sem quadrado
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
const mb = await page.evaluate(() => { const b = document.getElementById('menuBtn'), i = b.querySelector('.tb-logo'); return { src: i.getAttribute('src'), ok: i.naturalWidth > 0, fundo: getComputedStyle(b).backgroundColor, l: Math.round(i.getBoundingClientRect().width) }; });
check(/logo-transparent\.png/.test(mb.src) && mb.ok && mb.fundo === 'rgba(0, 0, 0, 0)' && mb.l >= 40, 'no celular o botão do menu usa o logo transparente, sem quadrado (' + mb.l + ' px)');
await page.setViewportSize({ width: 390, height: 844 }); await page.goto(B + '/?abertura=1'); await page.waitForTimeout(500);
const cab = await page.evaluate(() => { const i = document.querySelector('#abertura img').getBoundingClientRect(); return { w: Math.round(i.width), cx: Math.round(i.left + i.width / 2) }; });
check(Math.abs(cab.cx - 195) <= 2 && cab.w >= 120 && cab.w <= 200, 'no celular a abertura é a mesma, redimensionada e centralizada (' + cab.w + ' px)');
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'abertura-celular.png' });
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
