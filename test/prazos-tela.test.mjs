// Calculadora de prazos (tela): regimes, memória de cálculo, "Criar prazo na Agenda", "Calcular a partir da intimação" no editor e como o prazo foi contado na ficha.
// Use: node test/rodar.mjs prazos-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.63' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['agenda', 'processos', 'casos', 'clientes', 'diasSemExpediente']) { const j = await (await api('GET', '/api/db/' + col)).json(); for (const d of j.docs) await api('DELETE', '/api/db/' + col + '/' + d.id); }
await api('PUT', '/api/db/config/backup', { ultimoEm: agora });
const docs = async () => (await (await api('GET', '/api/db/agenda')).json()).docs.map(d => ({ id: d.id, ...d.data }));
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 420, height: 900 }, timezoneId: 'America/Sao_Paulo' }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { agenda: 'lista' }, per: 6 })); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(1200);
const txt = (s) => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', s).then(t => t.replace(/\s+/g, ' '));
const set = async (id, v, ev = 'input') => { await page.evaluate(([id, v, ev]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true })); }, [id, v, ev]); await page.waitForTimeout(150); };

check(await page.evaluate(() => !!document.querySelector('#agWrap [data-ag="calc"]')), 'a Agenda tem o botão "Calculadora de prazos"');
await page.evaluate(() => document.querySelector('#agWrap > [data-ag="calc"], #agWrap [data-ag="calc"]').click()); await page.waitForTimeout(500);
check(await page.evaluate(() => document.getElementById('overlayPz').classList.contains('show')), 'o botão abre a calculadora');
const regs = await page.evaluate(() => Array.from(document.querySelectorAll('#pz_regime option')).map(o => o.textContent));
check(regs.length === 6 && regs.some(x => /CPC/.test(x)) && regs.some(x => /Juizados/.test(x)) && regs.some(x => /CLT/.test(x)) && regs.some(x => /penal/i.test(x)) && regs.some(x => /administrativo/i.test(x)) && regs.some(x => /Personalizado/.test(x)), 'os regimes: CPC, Juizados, CLT, penal, administrativo e personalizado: ' + regs.join(' | '));
await set('pz_data', '2026-11-12'); await set('pz_dias', '15');
let t = await txt('#pzRes');
check(/segunda-feira, 07\/12\/2026/.test(t) && /Publicação\s*sex 13\/11\/2026/.test(t) && /Começa a contar\s*seg 16\/11\/2026/.test(t), 'CPC: disponibilização 12/11, 15 dias úteis → vence segunda-feira, 07/12/2026 (publicação sex 13/11, começa seg 16/11)');
check(/Pulou[^V]*sábados e domingos[^V]*20\/11/.test(t), 'resume o que pulou: sábados e domingos e o feriado de 20/11');
await page.evaluate(() => document.querySelector('[data-pz="mem"]').click()); await page.waitForTimeout(200);
t = await txt('#pzRes'); check(/20\/11 sex\s*não conta/i.test(t) && /VENCE/.test(t) && /dia 15/.test(t), 'a memória de cálculo mostra cada dia (20/11 não conta; dia 15 vence)');
// regime penal
await set('pz_regime', 'cpp', 'change'); await page.evaluate(() => document.querySelector('[data-pz="modo"][data-v="ciencia"]').click()); await page.waitForTimeout(200);
await set('pz_data', '2026-11-13'); await set('pz_dias', '5');
t = await txt('#pzRes'); check(/segunda-feira, 23\/11\/2026/.test(t) && /prorrogado/.test(t), 'CPP (dias corridos): ciência sex 13/11, 5 dias → vence 20/11 (feriado) e passa para segunda 23/11 (prorrogado)');
check(/Processo penal/.test(await txt('#pz_ref')) || /CPP/.test(await txt('#pz_ref')), 'a tela cita a base legal (CPP, art. 798 e Súmula 310)');
// CLT e dobro
await set('pz_regime', 'clt', 'change'); await page.evaluate(() => document.querySelector('[data-pz="modo"][data-v="dje"]').click()); await page.waitForTimeout(200);
await set('pz_data', '2026-11-12'); await set('pz_dias', '8');
t = await txt('#pzRes'); check(/quinta-feira, 26\/11\/2026/.test(t), 'CLT: 8 dias úteis a partir da publicação de 13/11 (pula o feriado de 20/11) vencem quinta-feira, 26/11/2026: ' + (t.match(/(segunda|terça|quarta|quinta|sexta)-feira, \d\d\/\d\d\/\d{4}/) || [''])[0]);
const v8 = (t.match(/(\d\d\/\d\d\/\d{4})/) || [])[1];
await page.evaluate(() => { const e = document.getElementById('pz_dobro'); e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(200);
t = await txt('#pzRes'); check(/em dobro/.test(t) && /16 dias úteis/.test(t), 'em dobro: 16 dias úteis');
// personalizado
await set('pz_regime', 'personalizado' === '' ? 'custom' : 'custom', 'change');
check(await page.evaluate(() => !!document.getElementById('pz_unid') && !!document.getElementById('pz_rec') && !!document.getElementById('pz_pro')), 'no regime personalizado aparecem as opções (contagem, recesso, prorrogação)');
// criar prazo na Agenda a partir do CPC
await set('pz_regime', 'cpc', 'change'); await set('pz_data', '2026-11-12'); await set('pz_dias', '15');
await page.evaluate(() => { const e = document.getElementById('pz_dobro'); if (e.checked) { e.checked = false; e.dispatchEvent(new Event('change', { bubbles: true })); } }); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('[data-pz="criar"]').click()); await page.waitForTimeout(700);
check(await page.evaluate(() => document.getElementById('overlayAg').classList.contains('show') && document.getElementById('age_data').value === '2026-12-07'), '"Criar prazo na Agenda" abre o editor já com o prazo fatal 07/12/2026');
check(/contado: Processo civil/.test(await txt('#age_calc_info')), 'e avisa como foi contado');
await set('age_tit', 'Contestação (teste da calculadora)'); await set('age_cli', 'Cliente Calculadora');
await page.evaluate(() => { const b = document.querySelector('#overlayAg [data-age="salvar"]'); b.click(); }); await page.waitForTimeout(1500);
let d = (await docs()).find(x => x.titulo === 'Contestação (teste da calculadora)');
check(!!d && d.data === '2026-12-07' && d.calculo && d.calculo.regime === 'cpc' && d.calculo.dias === 15 && d.calculo.data === '2026-11-12' && d.calculo.modo === 'dje', 'o prazo é salvo com a data e com os parâmetros do cálculo');
// ficha mostra como foi contado
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500);
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => /Contestação \(teste/.test(e.innerText)).querySelector('.agc-t').click()); await page.waitForTimeout(500);
check(/Como o prazo foi contado[\s\S]*Processo civil[\s\S]*15 dias úteis/i.test(await page.evaluate(() => document.getElementById('agdC').innerText)), 'a ficha mostra "Como o prazo foi contado"');
await page.evaluate(() => document.querySelector('#overlayAgDet').classList.remove('show'));
// editor: Calcular a partir da intimação num prazo existente, depois mudar a data à mão
const idMan = (await (await api('POST', '/api/db/agenda', { tipo: 'prazo', titulo: 'Prazo manual para calcular', cliente: 'Cliente M', data: '2026-12-15', situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora })).json()).id;
await page.reload(); await page.waitForTimeout(3000); await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(1000);
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500);
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => /Prazo manual para calcular/.test(e.innerText)).querySelector('[data-ag="abrir"]').click()); await page.waitForTimeout(600);
check(await page.evaluate(() => document.getElementById('age_calc_box').style.display !== 'none'), 'no editor do prazo há "Calcular a partir da intimação"');
await page.evaluate(() => document.querySelector('#overlayAg [data-age="calc"]').click()); await page.waitForTimeout(500);
await set('pz_regime', 'cpc', 'change'); await set('pz_data', '2026-11-12'); await set('pz_dias', '10');
check(await page.evaluate(() => /Usar esta data/.test(document.getElementById('pzRes').innerText) && !/Criar prazo na Agenda/.test(document.getElementById('pzRes').innerText)), 'vindo do editor, o botão é "Usar esta data"');
await page.evaluate(() => document.querySelector('[data-pz="usar"]').click()); await page.waitForTimeout(500);
const dtUsada = await page.evaluate(() => document.getElementById('age_data').value);
check(dtUsada === '2026-11-30' && /contado:/.test(await txt('#age_calc_info')), 'a data calculada (10 dias úteis, 30/11/2026) entra no editor: ' + dtUsada);
await page.evaluate(() => { const b = document.querySelector('#overlayAg [data-age="salvar"]'); b.click(); }); await page.waitForTimeout(1500);
d = (await docs()).find(x => x.id === idMan); check(d.data === '2026-11-30' && d.calculo && d.calculo.dias === 10, 'salvou a data e o cálculo');
// mudar a data à mão derruba o cálculo
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => /Prazo manual para calcular/.test(e.innerText)).querySelector('[data-ag="abrir"]').click()); await page.waitForTimeout(600);
await set('age_data', '2026-12-01', 'change');
await page.evaluate(() => { const b = document.querySelector('#overlayAg [data-age="salvar"]'); b.click(); }); await page.waitForTimeout(1500);
d = (await docs()).find(x => x.id === idMan); check(d.data === '2026-12-01' && !d.calculo, 'se a data for mudada à mão, o cálculo deixa de valer (não é recalculado depois)');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
