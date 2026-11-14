// Agenda: um cartão só por prazo, com "Trabalhar até" e "Prazo fatal" lado a lado; o cartão fica no dia de trabalhar e no dia fatal há só uma linha fina de lembrete;
// contagem em dias úteis; atalhos Adiar / Editar / WhatsApp; "Adiar" separado em adiar o trabalho e mudar a data fatal.
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
const ler = async (id) => (await (await api('GET', '/api/db/agenda')).json()).docs.find(d => d.id === id).data;
const novo = async (o) => (await (await api('POST', '/api/db/agenda', Object.assign({ situacao: 'afazer', concluido: false, avisos: [], criadoEm: agora }, o))).json()).id;
const idA = await novo({ tipo: 'prazo', titulo: 'Manifestação sobre os documentos', cliente: 'Cooperativa Teste', data: dia(20), trabalhar: hoje });
const idB = await novo({ tipo: 'prazo', titulo: 'Réplica atrasada para trabalhar', cliente: 'João Teste', data: dia(21), trabalhar: dia(-1) });
const idC = await novo({ tipo: 'prazo', titulo: 'Recurso sem dia de trabalho', cliente: 'Maria Teste', data: dia(25) });
const idD = await novo({ tipo: 'audiencia', titulo: 'Audiência com sala', cliente: 'Ana Teste', data: dia(22), hora: '14:30', link: 'https://meet.google.com/abc-defg-hij', modalidade: 'online' });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { agenda: 'semana' }, per: 6 })); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(1200);
const cartoes = (t) => page.evaluate((t) => Array.from(document.querySelectorAll('#agCorpo .agc')).filter(e => e.innerText.includes(t)).map(e => ({ texto: e.innerText.replace(/\s+/g, ' '), caixas: e.querySelectorAll('.agd2 > div').length, atrasoTrab: !!e.querySelector('.agd2 .t.at'), acx: Array.from(e.querySelectorAll('.acx > *')).map(x => x.getAttribute('aria-label') || x.innerText.trim()) })), t);
let c = await cartoes('Manifestação sobre os documentos');
check(c.length === 1, 'o prazo com dia de trabalhar aparece em UM cartão só (' + c.length + ')');
check(c.length === 1 && !/Dia de trabalhar na peça|interno/.test(c[0].texto), 'sumiu o cartão "Dia de trabalhar na peça · interno"');
check(c.length === 1 && /Trabalhar até/i.test(c[0].texto) && /Prazo fatal/i.test(c[0].texto) && c[0].caixas === 2, 'o cartão mostra "Trabalhar até" e "Prazo fatal" lado a lado');
check(c.length === 1 && /(dia útil|dias úteis)/.test(c[0].texto), 'a contagem do prazo é em dias úteis');
check(c.length === 1 && c[0].acx.some(x => /Adiar/.test(x)) && c[0].acx.some(x => /Editar/.test(x)) && c[0].acx.includes('Mensagem de WhatsApp'), 'o cartão tem os atalhos Adiar, Editar e WhatsApp: ' + JSON.stringify(c[0] && c[0].acx));
// dia de trabalhar já passou: vai para Atrasado, com a data de trabalhar em destaque
c = await cartoes('Réplica atrasada para trabalhar');
check(c.length === 1 && c[0].atrasoTrab, 'dia de trabalhar que passou: o cartão fica em destaque (data de trabalhar em vermelho)');
check(await page.evaluate(() => { const l = Array.from(document.querySelectorAll('#agCorpo .ag-dia, #agCorpo .agc')); const i = l.findIndex(e => e.classList.contains('agc') && /Réplica atrasada/.test(e.innerText)); const cab = l.slice(0, i).reverse().find(e => e.classList.contains('ag-dia')); return !!cab && /Atrasado/i.test(cab.innerText); }), 'e aparece no grupo "Atrasado", mesmo faltando muitos dias para o prazo fatal');
// prazo sem dia de trabalhar: só a caixa do prazo fatal
c = await page.evaluate(() => 0); await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(700);
c = await cartoes('Recurso sem dia de trabalho');
check(c.length === 1 && c[0].caixas === 1 && /Prazo fatal/i.test(c[0].texto) && !/Trabalhar até/i.test(c[0].texto), 'prazo sem dia de trabalhar: só a caixa "Prazo fatal"');
// Lista: segue o dia de trabalhar (o prazo A está hoje; o C só daqui a 25 dias)
check(await page.evaluate(() => { const t = Array.from(document.querySelectorAll('#agCorpo .agc-t')).map(e => e.innerText); return t.indexOf('Manifestação sobre os documentos') > -1 && t.indexOf('Manifestação sobre os documentos') < t.indexOf('Recurso sem dia de trabalho'); }), 'a Lista segue o dia de trabalhar (o prazo que se trabalha hoje vem antes)');
// audiência: Entrar na sala em destaque
c = await cartoes('Audiência com sala');
check(c.length === 1 && c[0].acx[0] && /Entrar na sala/.test(c[0].acx[0]) && c[0].acx.some(x => /Adiar/.test(x)), 'audiência com link: "Entrar na sala" em destaque, junto de Adiar e Editar');
// linha fina no dia fatal (vista Mês)
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="mes"]').click()); await page.waitForTimeout(500);
await page.evaluate((d) => { const b = document.querySelector('[data-ag="dia"][data-v="' + d + '"]'); if (b) b.click(); else { for (let k = 0; k < 3 && !document.querySelector('[data-ag="dia"][data-v="' + d + '"]'); k++) document.querySelector('[data-ag="nav"][data-v="1"]').click(); const b2 = document.querySelector('[data-ag="dia"][data-v="' + d + '"]'); if (b2) b2.click(); } }, dia(20)); await page.waitForTimeout(600);
const fina = await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .ag-fina')).map(e => e.innerText.replace(/\s+/g, ' ')));
check(fina.length === 1 && /Manifestação sobre os documentos/.test(fina[0]) && /trabalhar até/i.test(fina[0]), 'no dia fatal há só uma linha fina de lembrete: ' + JSON.stringify(fina));
check(await page.evaluate(() => !Array.from(document.querySelectorAll('#agCorpo .agc')).some(e => /Manifestação sobre os documentos/.test(e.innerText))), 'e o cartão completo não se repete no dia fatal');
// Adiar o trabalho (não mexe no prazo fatal)
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(600);
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => /Manifestação sobre os documentos/.test(e.innerText)).querySelector('[data-ag="adiar"]').click()); await page.waitForTimeout(500);
check(await page.evaluate(() => { const o = document.getElementById('overlayAgAdT'); return !!o && o.classList.contains('show') && /Adiar o trabalho na peça/i.test(o.innerText) && /Alterar o prazo fatal/i.test(o.innerText); }), 'Adiar abre as duas opções: adiar o trabalho e alterar o prazo fatal');
await page.click('#adtRapido'); await page.waitForTimeout(900);
let doc = await ler(idA);
check(doc.data === dia(20) && doc.trabalhar > hoje && doc.trabalhar <= dia(20), 'adiar o trabalho muda só o dia de trabalhar (' + hoje + ' → ' + doc.trabalhar + ') e mantém o prazo fatal em ' + doc.data);
// Mudar a data fatal: o dia de trabalhar que a pessoa escolheu continua
const trabAntes = doc.trabalhar;
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => /Manifestação sobre os documentos/.test(e.innerText)).querySelector('[data-ag="adiar"]').click()); await page.waitForTimeout(400);
await page.click('#adtFatal'); await page.waitForTimeout(400);
check(await page.evaluate(() => { const o = document.getElementById('overlayAgAdiar'); return !!o && o.classList.contains('show') && /Alterar o prazo fatal/.test(o.querySelector('h2').innerText); }), '"Mudar a data fatal…" abre a janela "Alterar o prazo fatal"');
await page.evaluate((d) => { const i = document.getElementById('aga_data'); i.value = d; i.dispatchEvent(new Event('change')); }, dia(30)); await page.click('#agaOk'); await page.waitForTimeout(1200);
doc = await ler(idA);
check(doc.data === dia(30) && doc.trabalhar === trabAntes, 'mudar a data fatal para ' + dia(30) + ' mantém o dia de trabalhar escolhido (' + doc.trabalhar + ')');
// prazo sem dia de trabalhar: Adiar vai direto para a nova data
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => /Recurso sem dia de trabalho/.test(e.innerText)).querySelector('[data-ag="adiar"]').click()); await page.waitForTimeout(400);
check(await page.evaluate(() => { const o = document.getElementById('overlayAgAdiar'); return !!o && o.classList.contains('show') && !document.getElementById('overlayAgAdT').classList.contains('show'); }), 'prazo sem dia de trabalhar: Adiar vai direto para a nova data');
await page.evaluate(() => document.querySelector('#overlayAgAdiar').classList.remove('show'));
// Editar e WhatsApp
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => /Recurso sem dia de trabalho/.test(e.innerText)).querySelector('[data-ag="abrir"]').click()); await page.waitForTimeout(500);
check(await page.evaluate(() => !!document.getElementById('age_tit') && document.getElementById('age_tit').offsetParent !== null), '"Editar" abre a edição do compromisso');
await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => /Recurso sem dia de trabalho/.test(e.innerText)).querySelector('[data-ag="zap"]').click()); await page.waitForTimeout(500);
check(await page.evaluate(() => { const o = document.getElementById('overlayAgZap'); return !!o && o.classList.contains('show'); }), 'o ícone do WhatsApp abre a mensagem do compromisso');
// tocar no cartão abre a ficha
await page.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => /Recurso sem dia de trabalho/.test(e.innerText)).querySelector('.agc-t').click()); await page.waitForTimeout(500);
check(await page.evaluate(() => !!document.querySelector('.overlay.show') && /Recurso sem dia de trabalho/.test(document.querySelector('.overlay.show').innerText)), 'tocar no cartão continua abrindo a ficha do prazo');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
