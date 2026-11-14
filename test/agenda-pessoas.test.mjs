// Testa as telas da Agenda por pessoa (Fase 5, etapa 5.5): Minha agenda | Escritório, responsáveis no formulário (sugeridos pelo processo),
// visibilidade da tarefa, duplicidade, conflitos, carga por pessoa e revisão em lote sem responsável.
// Servidor individual com banco semeado (grupo 'permissoes'):  node test/rodar.mjs agenda-pessoas
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), em = (n) => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const N1 = '0000001-11.2024.8.09.0001', N2 = '0000002-22.2024.8.09.0002';
await api('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
for (const d of (await api('GET', '/api/db/agenda')).j.docs) await api('DELETE', '/api/db/agenda/' + d.id);
const ag = (id, o) => api('PUT', '/api/db/agenda/' + id, Object.assign({ tipo: 'prazo', situacao: 'afazer', concluido: false, avisos: [], data: em(1), criadoEm: new Date().toISOString() }, o));
await ag('m1', { titulo: 'Prazo MEU m1', processo: N1, resp: ['60456/GO'], criadoPor: 'u2', data: em(2) });
await ag('m2', { titulo: 'Prazo do Bruno m2', processo: N2, criadoPor: 'u3', data: em(2) });
await ag('m3', { tipo: 'tarefa', titulo: 'Tarefa pessoal do Bruno m3', criadoPor: 'u3', data: em(2) });
await ag('m4', { tipo: 'tarefa', titulo: 'Tarefa do escritório m4', criadoPor: 'u3', compartilhada: true, data: em(2) });
await ag('m5', { tipo: 'tarefa', titulo: 'Minha tarefa m5', criadoPor: 'u1', data: em(2) });
await ag('m6', { titulo: 'Prazo sem responsável m6 da Ana', processo: N1, criadoPor: 'u2', data: em(3) });
await ag('m7', { tipo: 'audiencia', titulo: 'Audiência do processo da Ana m7', processo: N1, hora: '09:00', resp: ['11111/GO'], criadoPor: 'u2', data: em(5) });
await ag('m8', { titulo: 'Contestação', processo: N1, resp: ['11111/GO'], criadoPor: 'u2', data: em(6) });
const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const page = await ctx.newPage(), erros = [];
page.on('pageerror', (e) => erros.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
await page.route(/fonts\./, (x) => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); if (!sessionStorage.getItem('t55')) { sessionStorage.setItem('t55', '1'); localStorage.removeItem('horus.agendaEscopo'); localStorage.removeItem('horus.subaba.v1'); } } catch (e) { } });
await page.goto(B + '/'); await page.waitForTimeout(3500);
const corpo = () => page.evaluate(() => document.body.innerText);
const shot = async (n) => { if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'ap-' + n + '.png', fullPage: true }); };
const lista = async () => { await page.evaluate(() => { const b = document.querySelector('[data-ag="vista"][data-v="lista"]'); b && b.click(); }); await page.waitForTimeout(500); };

console.log('\n— Minha agenda | Escritório');
await page.click('[data-tab="agenda"]'); await page.waitForTimeout(900);
check(await page.locator('#esBarra .es-b.on').innerText() === 'Minha agenda' && (await page.locator('#esBarra .es-b').allInnerTexts()).join() === 'Minha agenda,Escritório', 'o proprietário abre em "Minha agenda"');
await lista(); let t = await corpo(); await shot('minha');
check(t.includes('Prazo MEU m1') && t.includes('Minha tarefa m5') && !t.includes('Prazo sem responsável m6') && !t.includes('Prazo do Bruno m2') && !t.includes('Tarefa pessoal do Bruno m3') && !t.includes('Tarefa do escritório m4'), 'em "Minha agenda": só o que o proprietário é responsável ou criou; não os prazos dos processos dos outros advogados nem as tarefas dos outros');
check(await page.locator('.agc-av').count() > 0, 'os cartões mostram as iniciais dos responsáveis');
await page.click('#esBarra .es-b[data-k="escritorio"]'); await page.waitForTimeout(600); t = await corpo(); await shot('escritorio');
check(t.includes('Prazo do Bruno m2') && t.includes('Prazo sem responsável m6') && t.includes('Tarefa do escritório m4') && t.includes('Prazo MEU m1') && !t.includes('Tarefa pessoal do Bruno m3'), 'em "Escritório": prazos de todos e tarefas compartilhadas; a tarefa pessoal de outra pessoa continua escondida');
check(t.includes('compartilhada') && !t.includes('só eu'), 'os cartões de tarefa compartilhada dizem "compartilhada" (a marca "só eu" saiu dos cartões)');

console.log('\n— carga por pessoa');
await page.evaluate(() => { const b = document.querySelector('[data-ag="vista"][data-v="resumo"]'); b && b.click(); }); await page.waitForSelector('#agCargaBox .agc-av', { timeout: 8000 }); await shot('carga');
t = await page.locator('#agCargaBox').innerText();
check(/Ana/.test(t) && /Bruno/.test(t) && /mais carregado/.test(t), 'o Resumo mostra a carga dos próximos 7 dias por pessoa (' + t.replace(/\n/g, ' ').slice(0, 90) + ')');

console.log('\n— formulário: responsáveis sugeridos pelo processo, conflito e duplicidade');
await page.click('[data-ag="novo"]'); await page.waitForSelector('#overlayAg.show #age_proc');
await page.click('[data-age="tipo"][data-v="prazo"]');
await page.fill('#age_tit', 'Contestação'); await page.fill('#age_proc', '0000001-11'); await page.waitForTimeout(300);
check(await page.locator('#age_sug [data-age="sug"]').count() >= 1, 'digitar parte do número ou do nome mostra os processos cadastrados para escolher');
await page.click('#age_sug [data-age="sug"]'); await page.waitForTimeout(300); await shot('form');
let rt = await page.locator('#esResp_agenda').innerText();
check(/Ana/.test(rt) && /sugeridos pelo processo/i.test(rt), 'ao escolher o processo, os responsáveis vêm preenchidos com os advogados dele (' + rt.replace(/\n/g, ' ').slice(0, 80) + ')');
await page.fill('#age_data', em(5)); await page.dispatchEvent('#age_data', 'input'); await page.waitForTimeout(300);
check((await page.locator('#age_dica2').innerText()).includes('audiência no mesmo dia'), 'prazo no dia de uma audiência do mesmo processo: avisa');
await page.fill('#age_data', em(6)); await page.dispatchEvent('#age_data', 'input'); await page.waitForTimeout(200);
await page.click('[data-age="salvar"]'); await page.waitForTimeout(500);
check((await page.locator('#age_dup').innerText()).includes('Já existe um prazo igual'), 'prazo igual (mesmo processo, dia e título) já existente: avisa antes de salvar');
await page.click('[data-age="dup-salvar"]'); await page.waitForTimeout(1200);
const docs = (await api('GET', '/api/db/agenda')).j.docs, novo = docs.filter((d) => d.data.titulo === 'Contestação' && d.id !== 'm8');
check(novo.length === 1 && novo[0].data.resp.join() === '11111/GO' && novo[0].data.criadoPor === 'u1', '"Salvar mesmo assim" grava, com os responsáveis (Ana) e o autor (proprietário) ' + JSON.stringify(novo.map((d) => ({ resp: d.data.resp, por: d.data.criadoPor }))) + ' erro: ' + (await page.locator('#age_erro').innerText()));

console.log('\n— tarefa: quem vê');
await page.click('[data-ag="novo"]'); await page.waitForSelector('#overlayAg.show #age_proc'); await page.click('[data-age="tipo"][data-v="tarefa"]'); await page.waitForTimeout(200);
check(await page.locator('#age_vis_box').isVisible() && await page.locator('#age_vis').inputValue() === 'so_eu' && !(await page.locator('#esResp_agenda').isVisible()), 'tarefa sem processo começa em "Só eu" e esconde os responsáveis');
await page.selectOption('#age_vis', 'todos'); await page.fill('#age_tit', 'Organizar pasta Silva'); await page.fill('#age_data', em(4)); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1200);
const tar = (await api('GET', '/api/db/agenda')).j.docs.find((d) => d.data.titulo === 'Organizar pasta Silva');
check(tar && tar.data.compartilhada === true && Array.isArray(tar.data.resp) && tar.data.criadoPor === 'u1', '"Todo o escritório" grava a tarefa como compartilhada (e o autor)');

console.log('\n— revisão em lote: sem responsável');
await page.waitForTimeout(500);
check(/sem responsável/.test(await page.locator('#esBarra').innerText()), 'a barra avisa quantos prazos e audiências estão sem responsável');
await page.click('#esBarra [data-es="agrev"]'); await page.waitForSelector('#overlayAgRev.show .es-it'); await shot('revisao');
t = await page.locator('#overlayAgRevC').textContent();
check(t.includes('Prazo sem responsável m6 da Ana') && t.includes('Prazo do Bruno m2') && /sugestão: Ana/.test(t) && /sugestão: Bruno/.test(t), 'a revisão lista os itens sem responsável com a sugestão tirada do processo');
await page.click('[data-arv="sugestoes"]'); await page.click('[data-arv="aplicar"]'); await page.waitForTimeout(2500);
const d2 = (await api('GET', '/api/db/agenda')).j.docs, m6 = d2.find((d) => d.id === 'm6').data, m2 = d2.find((d) => d.id === 'm2').data;
check(m6.resp.join() === '11111/GO' && m2.resp.join() === '22222/GO' && m6.titulo === 'Prazo sem responsável m6 da Ana', 'aplicar grava os advogados do processo como responsáveis de cada item');
check((await page.locator('#overlayAgRevC').textContent()).includes('Todos os prazos e audiências têm responsável'), 'e a lista esvazia');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
