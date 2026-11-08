// Testa pela tela: Configurações > Lixeira (listar, restaurar, restaurar quando foi recriado, esvaziar) e Configurações > Registro de ações.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var IMPORTAR_AUTO:0 --port 8812
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.56' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
for (const c of ['clientes', 'processos']) for (const d of (await f('GET', '/api/db/' + c)).j.docs || []) await f('DELETE', '/api/db/' + c + '/' + d.id);
await f('POST', '/api/lixeira/esvaziar', {});
const agora = new Date().toISOString();
await f('PUT', '/api/db/config/backup', { ultimoEm: agora }); await f('PUT', '/api/db/config/importacaoAuto', { ativo: false, desde: agora }); await f('PUT', '/api/db/config/processosIgnorados', { numeros: {} }); await f('PUT', '/api/db/config/vinculoIniciais', { corte: agora.slice(0, 10) });
await f('PUT', '/api/db/clientes/ca', { nome: 'Maria Souza', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/cb', { nome: 'João Alves', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/processos/pa', { numero: '5368644-67.2026.8.09.0107', partes: 'Autor A x Réu B', clienteIds: ['ca'], honorarios: 'sem', arquivado: false, criadoEm: agora });
await f('PUT', '/api/db/clientes/ca', { nome: 'Maria Souza Lima', pagador: 'cliente', criadoEm: agora });   // alteração para o registro
await f('DELETE', '/api/db/clientes/cb'); await f('DELETE', '/api/db/processos/pa');
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } });
const page = await ctx.newPage(); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const vis = s => page.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, s);
const abrirCfg = async () => { await page.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await page.waitForTimeout(700); };
await abrirCfg(); await page.click('#cfWrap [data-cf="lixeira"]'); await page.waitForTimeout(900);
check(await vis('#overlaySgLix.show'), 'a Lixeira abre pela aba Configurações');
let tx = await t('#overlaySgLixC');
check(/2 itens/.test(tx) && /Cliente/.test(tx) && /João Alves/.test(tx) && /Processo/.test(tx) && /Autor A x Réu B/.test(tx) && /some em 30 dias/.test(tx), 'lista os 2 itens excluídos, com tipo, nome e validade: ' + tx.replace(/\n/g, ' ').slice(0, 170));
check(await page.evaluate(() => Array.from(document.querySelectorAll('#overlaySgLixC button')).filter(b => b.getAttribute('data-sg') === 'restaurar').every(b => b.closest('.pb-card'))), 'o botão Restaurar fica dentro de cada cartão');
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/lixeira.png' });
await page.selectOption('#sgFLix', 'Cliente'); await page.waitForTimeout(300);
check(/João Alves/.test(await t('#overlaySgLixC')) && !/Autor A x Réu B/.test(await t('#overlaySgLixC')), 'o filtro por tipo funciona');
// restaurar o cliente
await page.click('#overlaySgLixC [data-sg="restaurar"]'); await page.waitForTimeout(3500);
check((await f('GET', '/api/db/clientes')).j.docs.some(d => d.id === 'cb' && d.data.nome === 'João Alves'), 'Restaurar devolve o cliente (e a tela recarrega)');
// recriar o processo e tentar restaurar: pede confirmação
await f('PUT', '/api/db/processos/pa', { numero: '5368644-67.2026.8.09.0107', partes: 'Recriado', honorarios: 'sem', arquivado: false });
await abrirCfg(); await page.click('#cfWrap [data-cf="lixeira"]'); await page.waitForTimeout(900);
await page.click('#overlaySgLixC [data-sg="restaurar"]'); await page.waitForTimeout(900);
check(/foi recriado depois de excluído/.test(await t('#overlaySgLixC')) && await vis('#overlaySgLixC [data-sg="substituir"]'), 'se o registro foi recriado, a tela avisa e pede para confirmar a substituição');
await page.click('#overlaySgLixC [data-sg="cancela"]'); await page.waitForTimeout(300);
check((await f('GET', '/api/db/processos')).j.docs.find(d => d.id === 'pa').data.partes === 'Recriado', 'cancelar não muda nada');
await page.click('#overlaySgLixC [data-sg="restaurar"]'); await page.waitForTimeout(700); await page.click('#overlaySgLixC [data-sg="substituir"]'); await page.waitForTimeout(3500);
check((await f('GET', '/api/db/processos')).j.docs.find(d => d.id === 'pa').data.partes === 'Autor A x Réu B', 'confirmando, substitui pelo da lixeira');
// registro de ações
await abrirCfg(); await page.click('#cfWrap [data-cf="registro"]'); await page.waitForTimeout(1000);
tx = await t('#overlaySgRegC');
check(await vis('#overlaySgReg.show') && /restaurou/.test(tx) && /excluiu/.test(tx) && /alterou/.test(tx) && /criou/.test(tx), 'o Registro de ações lista criou, alterou, excluiu e restaurou');
check(/Nome[^]*Maria Souza[^]*Maria Souza Lima/.test(tx), 'a alteração mostra o campo, o antes e o depois: ' + tx.replace(/\n/g, ' ').slice(0, 240));
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/registro.png' });
await page.selectOption('#sgFReg', 'processos'); await page.waitForTimeout(800);
tx = await t('#overlaySgRegC');
check(/Processo/.test(tx) && !/Cliente ·/.test(tx), 'o filtro por tipo mostra só processos');
check(await page.evaluate(() => Array.from(document.querySelectorAll('#overlaySgRegC button')).every(b => b.closest('.pb-card') || b.closest('.field') || b.getAttribute('data-sg') === 'mais-reg')), 'sem botões soltos fora de cartões');
// esvaziar
await page.evaluate(() => document.getElementById('overlaySgReg').classList.remove('show'));
await f('DELETE', '/api/db/clientes/cb');
await abrirCfg(); await page.click('#cfWrap [data-cf="lixeira"]'); await page.waitForTimeout(900);
await page.click('#overlaySgLixC [data-sg="menu"]'); await page.waitForTimeout(300);
check(await vis('#overlaySgLixC [data-sg="esvaziar-pede"]'), 'o menu ☰ da lixeira tem “Esvaziar a lixeira”');
await page.click('#overlaySgLixC [data-sg="esvaziar-pede"]'); await page.waitForTimeout(300);
check(/Apagar de vez/.test(await t('#overlaySgLixC')), 'esvaziar pede confirmação');
await page.click('#overlaySgLixC [data-sg="esvaziar"]'); await page.waitForTimeout(900);
check((await f('GET', '/api/lixeira')).j.itens.length === 0 && /vazia/.test(await t('#overlaySgLixC')), 'confirmando, a lixeira fica vazia');
check(erros.length === 0, 'sem erros na página: ' + erros.join(' | '));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
