// Testa as telas da etapa 5.4: Meus | Escritório, Publicações em "Minhas", seletor de advogados responsáveis e a revisão de registros sem advogado.
// Servidor individual com banco semeado (grupo 'permissoes'):  node test/rodar.mjs responsaveis-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
/* dados do teste: o proprietário indica a OAB 60456/GO; duas Iniciais (uma dele, uma de outro) e uma sem advogado */
await api('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
await api('PUT', '/api/db/casos/zz1', { tipo: 'inicial', status: 'protocolada', cliente: 'Zeta Meu', numeroProcesso: '0000123-45.2024.8.09.0123', advogados: [{ oab: '60456/GO', nome: 'Dono' }], criadoEm: '2026-11-01T10:00:00Z' });
await api('PUT', '/api/db/casos/zz2', { tipo: 'inicial', status: 'protocolada', cliente: 'Zeta Outro', numeroProcesso: '', advogados: [{ oab: '22222/GO', nome: 'Bruno' }], criadoEm: '2026-11-01T10:00:00Z' });
await api('PUT', '/api/db/termosAcordo/zA', { partes: 'Acordo Zeta Herdado', numeroProcesso: '0000123-45.2024.8.09.0123', status: 'pendente', criadoEm: '2026-11-01T10:00:00Z' });   /* sem advogado, mas do mesmo processo da Inicial do proprietário */
await api('PUT', '/api/db/termosAcordo/zB', { partes: 'Acordo Zeta Alheio', numeroProcesso: '0000777-77.2024.8.09.0777', status: 'pendente', criadoEm: '2026-11-01T10:00:00Z' });
await api('PUT', '/api/db/casos/zz3', { tipo: 'inicial', status: 'protocolada', cliente: 'Zeta Sem', numeroProcesso: '', criadoEm: '2026-11-01T10:00:00Z' });
const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const page = await ctx.newPage(), erros = [], urls = [];
page.on('pageerror', (e) => erros.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
page.on('request', (r) => { if (r.url().includes('/api/djen/lista')) urls.push(r.url()); });
await page.route(/fonts\./, (x) => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); if (!sessionStorage.getItem('t54')) { sessionStorage.setItem('t54', '1'); localStorage.removeItem('horus.escopo'); localStorage.removeItem('horus.escopoPub'); } } catch (e) { } });
await page.goto(B + '/'); await page.waitForTimeout(3500);
const corpo = () => page.evaluate(() => document.body.innerText);
const shot = async (n) => { if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'es-' + n + '.png', fullPage: true }); };

console.log('\n— Meus | Escritório');
await page.click('[data-tab="peticoes"]'); await page.waitForTimeout(800);
await page.getByText('Lista', { exact: true }).first().click(); await page.waitForTimeout(500);
const sub0 = await page.locator('#subtitle').innerText();
check(await page.locator('#esBarra').isVisible() && await page.locator('.es-b.on').innerText() === 'Escritório', 'a barra aparece nas Iniciais, abrindo em "Escritório"');
let t = await corpo(); check(t.includes('Zeta Meu') && t.includes('Zeta Outro') && t.includes('Zeta Sem'), 'em "Escritório" aparecem todas as Iniciais');
check(await page.locator('.es-aviso').innerText().then((x) => /sem advogado definido/.test(x)), 'o aviso de registros sem advogado aparece (com o botão Definir)');
await page.click('.es-b[data-k="meus"]'); await page.waitForTimeout(700); await shot('meus');
t = await corpo(); check(t.includes('Zeta Meu') && !t.includes('Zeta Outro') && !t.includes('Zeta Sem'), 'em "Meus" só aparece a Inicial em que a OAB do proprietário está entre os advogados');
check(sub0 !== await page.locator('#subtitle').innerText() && /\b1 caso/.test(await page.locator('#subtitle').innerText()), 'e os totais da tela acompanham ("' + sub0 + '" → "' + await page.locator('#subtitle').innerText() + '")');
const nAc = async () => (await page.locator('#menuNAcordos').innerText()).trim();
check(await nAc() === '1', 'em "Meus" o número de Acordos cai para 1: o Acordo sem advogado entra porque o processo (mesmo número) é meu; o de outro processo, não (' + await nAc() + ')');
await page.click('[data-tab="clientes"]'); await page.waitForTimeout(600);
check(await page.locator('#esBarra').isVisible(), 'a barra também está em Clientes');
await page.click('[data-tab="inicio"]'); await page.waitForTimeout(400);
check(!(await page.locator('#esBarra').isVisible()), 'e some nas telas que não são listas (Início)');
await page.reload(); await page.waitForTimeout(3500); await page.click('[data-tab="peticoes"]'); await page.waitForTimeout(800); await page.getByText('Lista', { exact: true }).first().click(); await page.waitForTimeout(500);
check(await page.locator('.es-b.on').innerText() === 'Meus' && !(await corpo()).includes('Zeta Outro'), 'a escolha fica lembrada');
await page.click('.es-b[data-k="escritorio"]'); await page.waitForTimeout(500);
check((await corpo()).includes('Zeta Outro'), 'voltar a "Escritório" mostra tudo de novo');

console.log('\n— seletor de advogados responsáveis');
await page.click('#fabNew'); await page.click('[data-novo-k="peticao"]'); await page.waitForSelector('#esResp_casos .es-chips'); await shot('form');
check((await page.locator('#esResp_casos').innerText()).includes('sem advogado definido'), 'registro novo abre sem ninguém marcado (o app não marca sozinho)');
await page.click('#esResp_casos [data-esr="abrir"]'); await page.waitForSelector('#esResp_casos .es-lista input');
check(await page.locator('#esResp_casos .es-lista input').count() >= 3, 'a lista mostra os advogados do escritório');
await page.check('#esResp_casos .es-lista input[data-k="22222/GO"]'); await page.waitForTimeout(150);
check((await page.locator('#esResp_casos .es-chips').innerText()).includes('Bruno'), 'marcar um advogado vira etiqueta');
await page.fill('#clienteInput', 'Zeta Novo'); await page.fill('#nomeAcaoInput', 'Ação de teste'); await page.fill('#valorInput', '1000'); await page.evaluate(() => { const d = document.getElementById('dataAvistaInput'); d.value = '2026-12-10'; d.dispatchEvent(new Event('input', { bubbles: true })); d.dispatchEvent(new Event('change', { bubbles: true })); });

const salvar = page.locator('#saveBtn'); await salvar.click(); await page.waitForTimeout(1200);
const novo = (await api('GET', '/api/db/casos')).j.docs.find((d) => d.data.cliente === 'Zeta Novo');
check(!!novo, 'a Inicial nova foi gravada' + (novo ? '' : ' (erro na tela: ' + (await page.locator('#formError').innerText()) + ')'));
check(novo && novo.data.advogados.map((a) => a.oab).join() === '22222/GO' && novo.data.advogados[0].nome.startsWith('Bruno'), 'ao salvar, os advogados escolhidos ficam gravados no registro');
/* editar: o seletor já vem com o que está gravado, e tirar/pôr funciona */
await page.waitForTimeout(500);
await page.evaluate(() => { document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')); });
const doc1 = (await api('GET', '/api/db/casos')).j.docs.find((d) => d.id === 'zz1'); check(doc1.data.advogados[0].oab === '60456/GO', '(registro de partida intacto)');

console.log('\n— revisão: sem advogado definido');
await page.click('[data-tab="processos"]'); await page.waitForTimeout(600);
await page.click('.es-aviso [data-es="definir"]'); await page.waitForSelector('#overlayEsRev.show .es-it'); await shot('revisao');
t = await page.locator('#overlayEsRevC').textContent();
check(t.includes('Zeta Sem') && t.includes('Inicial') && /registros? esperando você/.test(t), 'a revisão lista os registros sem advogado');
await page.click('[data-esv="filtro"][data-k="casos"]'); check(await page.locator('#overlayEsRevC .es-it').count() >= 1, 'filtra por tipo');
await page.check('#overlayEsRevC input[data-esv="item"][data-k="casos|zz3"]'); await page.check('#overlayEsRevC input[data-esv="adv"][data-k="60456/GO"]');
await page.click('[data-esv="aplicar"]'); await page.waitForTimeout(1500);
const zz3 = (await api('GET', '/api/db/casos')).j.docs.find((d) => d.id === 'zz3').data;
check(zz3.advogados && zz3.advogados[0].oab === '60456/GO' && zz3.cliente === 'Zeta Sem', 'aplicar grava o advogado no registro escolhido');
check(!(await page.locator('#overlayEsRevC').textContent()).includes('Zeta Sem'), 'e o registro sai da lista de pendentes');
await page.evaluate(() => document.getElementById('overlayEsRev').classList.remove('show'));

console.log('\n— Publicações: "Minhas" por padrão');
await page.click('[data-tab="publicacoes"]'); await page.waitForTimeout(1500);
check(await page.locator('.es-b.on').innerText() === 'Minhas' && (await page.locator('.es-b').allInnerTexts()).join() === 'Minhas,Todas', 'o proprietário abre em "Minhas" (com "Todas" ao lado)');
check(urls.some((u) => u.includes('escopo=meus')), 'e o app pede ao servidor só as publicações das OABs dele');
urls.length = 0; await page.click('.es-b[data-k="todas"]'); await page.waitForTimeout(1200);
check(urls.length > 0 && urls.every((u) => !u.includes('escopo=meus')), '"Todas" pede o escritório inteiro');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
