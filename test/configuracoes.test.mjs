// Testa o menu lateral enxuto e a aba Configurações: grupos do menu, itens que saíram do menu, linhas da aba abrindo as telas de antes,
// e a Cobrança de clientes separada do Relatório do Murilo.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.54' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
await fetch(B + '/api/db/config/backup', { method: 'PUT', headers: { cookie: ck, 'content-type': 'application/json' }, body: JSON.stringify({ ultimoEm: new Date().toISOString() }) });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } });
const page = await ctx.newPage(); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const vis = s => page.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, s);
const t = s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
await page.click('#menuBtn'); await page.waitForTimeout(500);
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/cfg-menu.png' });
const itens = await page.evaluate(() => Array.from(document.querySelectorAll('#drawer .dr-nav > *')).filter(e => e.getClientRects().length > 0).map(e => (e.classList.contains('dr-grp') ? '## ' : '') + e.innerText.trim().replace(/\n.*/, '')));
check(itens.join('|') === 'Início|Iniciais|Termos de Acordo|Alvarás|Agenda|Processos|Publicações|Clientes|Arquivados|Cobrança de clientes|## FINANCEIRO|Visão geral|Divisão do mês|Hygor (PJ)|Pessoa física|Patrimônio e metas|Orçamento|Análises|Construção|Extratos do banco|Recebi R$|Fechamento do mês|Relatório do Murilo|## SISTEMA|Configurações|Desfazer última ação|Sair', 'menu lateral: ' + itens.join(' | '));
check(!(await vis('#backupBtn')) && !(await vis('#exportBtn')) && !(await vis('#abrirLembretesBtn')), 'Backup, Exportar CSV e Lembretes saíram do menu (os botões originais ficam escondidos)');
// Cobrança de clientes: abre a tela de cobrança no modo "clientes próprios"
await page.click('#abrirCobrancaMenuBtn'); await page.waitForTimeout(800);
check(await vis('#overlayRelMurilo.show') && !(await vis('#relModoSeg')), 'Cobrança de clientes abre a tela de cobrança, sem o seletor Murilo/Clientes próprios');
check(await page.evaluate(() => document.querySelector('#relModoSeg .seg-btn.active, #relModoSeg .active') ? document.querySelector('#relModoSeg .active').getAttribute('data-value') === 'proprio' : true), 'no modo clientes próprios');
await page.click('#closeRelMurilo'); await page.waitForTimeout(300);
await page.click('#menuBtn'); await page.waitForTimeout(400);
await page.click('#abrirRelMuriloBtn'); await page.waitForTimeout(800);
check(await vis('#overlayRelMurilo.show') && /Murilo/i.test(await t('#relMuriloTitulo')), 'Relatório do Murilo abre no modo do Murilo: ' + (await t('#relMuriloTitulo')));
await page.click('#closeRelMurilo'); await page.waitForTimeout(300);
// aba Configurações
await page.click('#menuBtn'); await page.waitForTimeout(400);
await page.click('#drawer [data-tab="configuracoes"]'); await page.waitForTimeout(800);
check(await vis('#cfWrap') && /Configurações/.test(await t('#tituloTela')), 'a aba Configurações abre com o título certo');
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/cfg-aba.png' });
const linhas = await t('#cfWrap');
check(/Notificações e lembretes do iPhone/.test(linhas) && /Backup e restauração/.test(linhas) && /Exportar lista \(CSV\)/.test(linhas) && /Lixeira/.test(linhas) && /Registro de ações/.test(linhas) && !/em breve/.test(linhas) && await vis('#cfWrap [data-cf="lixeira"]') && await vis('#cfWrap [data-cf="registro"]'), 'as linhas da aba: notificações, backup, exportar, lixeira e registro de ações (todas ativas)');
check(/OABs e publicações[^]*depois/.test(linhas) && /Agendas e regras operacionais[^]*depois/.test(linhas) && !/Perfis e permissões/.test(linhas) && /Usuários[^]*convidar pessoas/.test(linhas), 'Usuários virou item de verdade; OABs e Agendas seguem reservadas para depois');
check(await page.evaluate(() => Array.from(document.querySelectorAll('#cfWrap button')).every(b => b.closest('.pb-painel'))), 'todas as linhas ficam dentro de cartões');
await page.click('#cfWrap [data-cf="backup"]'); await page.waitForTimeout(700);
check(await vis('#overlayBackup.show'), 'a linha Backup e restauração abre a tela de backup de antes');
await page.click('#closeModalBackup'); await page.waitForTimeout(300);
await page.click('#cfWrap [data-cf="notif"]'); await page.waitForTimeout(700);
check(await vis('#overlayLembretes.show'), 'a linha Notificações abre a tela de lembretes de antes');
await page.click('#ntFechar'); await page.waitForTimeout(300);
check(!(await vis('#fabNew')) && !(await vis('#mesNav')), 'a aba Configurações não mostra o botão “+” nem o seletor de mês');
await page.click('#menuBtn'); await page.waitForTimeout(400); await page.click('#drawer [data-tab="processos"]'); await page.waitForTimeout(600);
check(!(await vis('#cfWrap')), 'voltar para outra aba esconde as Configurações');
check(erros.length === 0, 'sem erros na página: ' + erros.join(' | '));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
