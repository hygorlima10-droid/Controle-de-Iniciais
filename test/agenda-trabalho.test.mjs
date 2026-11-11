// O cartão "Dia de trabalhar na peça" (prazo visto no dia em que se deve trabalhar nele) tem o mesmo desenho dos demais cartões da Agenda:
// clicável (abre a ficha do prazo), com a bolinha de concluir e sem o botão "Abrir prazo".
// Use: node test/rodar.mjs agenda-trabalho
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.59' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['agenda', 'processos', 'casos', 'clientes']) { const j = await (await api('GET', '/api/db/' + col)).json(); for (const d of j.docs) await api('DELETE', '/api/db/' + col + '/' + d.id); }
await api('PUT', '/api/db/config/backup', { ultimoEm: agora });
await api('POST', '/api/db/agenda', { tipo: 'prazo', titulo: 'Manifestação sobre os documentos', cliente: 'Cooperativa Teste', data: dia(2), trabalhar: hoje, situacao: 'afazer', concluido: false, avisos: [], criadoEm: agora });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { agenda: 'semana' }, per: 6 })); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(1200);
const cartaoT = () => page.evaluate(() => { const c = Array.from(document.querySelectorAll('.agc')).find(e => /Dia de trabalhar na peça/.test(e.innerText)); if (!c) return null; return { html: c.outerHTML, texto: c.innerText, det: c.getAttribute('data-ag') === 'det', ok: !!c.querySelector('.agc-ok'), chip: /interno/.test(c.innerText) }; });
let c = await cartaoT();
check(!!c && /Dia de trabalhar na peça/.test(c.texto) && /interno/.test(c.texto) && /Manifestação sobre os documentos/.test(c.texto), 'o "dia de trabalhar" aparece como cartão da Agenda, com a marca "interno"');
check(!!c && c.det && c.ok, 'o cartão é clicável (abre a ficha) e tem a bolinha de concluir');
check(!(await page.evaluate(() => /Abrir prazo/.test(document.getElementById('bodyAgenda') ? document.getElementById('bodyAgenda').innerText : document.body.innerText))), 'não existe mais o botão "Abrir prazo"');
check(!!c && /Prazo fatal/.test(c.texto) && /Cooperativa Teste/.test(c.texto), 'o cartão mostra o prazo fatal e o cliente');
await page.evaluate(() => Array.from(document.querySelectorAll('.agc')).find(e => /Dia de trabalhar na peça/.test(e.innerText)).querySelector('.agc-t').click()); await page.waitForTimeout(500);
check(await page.evaluate(() => !!document.querySelector('.overlay.show') && /Manifestação sobre os documentos/.test(document.querySelector('.overlay.show').innerText)), 'tocar no cartão abre a ficha do prazo');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
