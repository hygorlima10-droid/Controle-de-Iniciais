// Testa pela tela: escolher o arquivo de backup, ver a conferência, restaurar com segurança e voltar para a cópia de segurança.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.53' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const COLS = ['casos', 'clientes', 'despesas', 'processos', 'agenda', 'config'];
const todos = async () => { const o = {}; for (const c of COLS) for (const d of (await f('GET', '/api/db/' + c)).j.docs || []) o[c + '/' + d.id] = d.data; return o; };
const dif = (a, b) => Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
const igual = (a, b) => JSON.stringify(Object.keys(a).sort().map(k => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map(k => [k, b[k]]));
for (const c of COLS) for (const d of (await f('GET', '/api/db/' + c)).j.docs || []) await f('DELETE', '/api/db/' + c + '/' + d.id);
const agora = new Date().toISOString();
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('PUT', '/api/db/config/importacaoAuto', { ativo: false, desde: agora }); await f('PUT', '/api/db/config/processosIgnorados', { numeros: {} }); await f('PUT', '/api/db/config/vinculoIniciais', { corte: agora.slice(0, 10) });   // o app cria estes dois ao abrir; já existindo, o estado do teste fica estável
await f('PUT', '/api/db/clientes/c1', { nome: 'Maria Souza', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/c2', { nome: 'João Alves', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/despesas/d1', { nome: 'Aluguel', valor: 1500, coluna: 'pj', tipo: 'fixa', criadoEm: agora });
await f('PUT', '/api/db/processos/p1', { numero: '5368644-67.2026.8.09.0107', partes: 'A x B', clienteIds: ['c1'], honorarios: 'sem', arquivado: false, criadoEm: agora });
const estado0 = await todos();
const dia = (await f('POST', '/api/backups/agora')).j.dia; const arq = (await f('GET', '/api/backups/' + dia)).j;
fs.writeFileSync('/tmp/backup-teste.json', JSON.stringify(arq));
// o banco muda depois do backup
await f('PUT', '/api/db/clientes/c3', { nome: 'Cliente novo depois', pagador: 'cliente', criadoEm: agora });
await f('DELETE', '/api/db/clientes/c2'); await f('PUT', '/api/db/despesas/d1', { nome: 'Aluguel ALTERADO', valor: 9, coluna: 'pj', tipo: 'fixa', criadoEm: agora });
const estado1 = await todos();
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } });
const page = await ctx.newPage(); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const vis = s => page.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, s);
const abrirBackup = async () => { await page.evaluate(() => document.getElementById('backupBtn').click()); await page.waitForTimeout(900); };
await abrirBackup();
check(await vis('#overlayBackup.show'), 'a janela Backup e restauração abre');
await page.setInputFiles('#importarBackupInput', '/tmp/backup-teste.json'); await page.waitForTimeout(1500);
const conf = await t('#importarBackupResumo');
check(/Arquivo válido/.test(conf) && /\+1 a trazer/.test(conf) && /1 trocados/.test(conf) && /−1 removidos/.test(conf), 'a conferência mostra o que mudaria (1 volta, 1 trocado, 1 removido): ' + conf.replace(/\n/g, ' ').slice(0, 200));
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/bk-1.png' });
check(await t('#confirmarImportarBackup') === 'Restaurar com segurança' && await page.evaluate(() => !!document.querySelector('#importarBackupConfirm #confirmarImportarBackup')), 'o botão “Restaurar com segurança” fica dentro do cartão de confirmação');
check(igual(await todos(), estado1), 'só conferir não alterou o banco: ' + dif(await todos(), estado1).join());
const nCopias = async () => (await f('GET', '/api/restaurar/copias')).j.copias.length, c0 = await nCopias();
await page.click('#confirmarImportarBackup'); await page.waitForTimeout(4500);
check(igual(await todos(), estado0), 'depois de restaurar, o banco ficou igual ao do backup');
await page.waitForTimeout(500);
check(await nCopias() === Math.min(5, c0 + 1), 'a cópia de segurança de antes ficou guardada');
await abrirBackup();
check(/Cópias de segurança automáticas/.test(await t('#bkCopias')) && /Voltar para esta cópia/.test(await t('#bkCopias')) && /antes de restaurar/.test(await t('#bkCopias')), 'a lista “Cópias de segurança automáticas” aparece com a cópia de antes');
if (process.env.FOTOS) { await page.evaluate(() => document.getElementById('bkCopias').scrollIntoView()); await page.screenshot({ path: process.env.FOTOS + '/bk-2.png' }); }
await page.click('#bkCopias [data-bk="voltar"]'); await page.waitForTimeout(500);
check(/Os dados de hoje também ficam guardados/.test(await t('#bkCopias')) && await vis('#bkCopias [data-bk="confirmar"]'), 'voltar pede confirmação antes de trocar');
await page.click('#bkCopias [data-bk="confirmar"]'); await page.waitForTimeout(4500);
check(igual(await todos(), estado1), 'voltar para a cópia devolveu os dados de antes da restauração');
check(await nCopias() === Math.min(5, c0 + 2), 'e o estado anterior ao “voltar” também ficou guardado');
// arquivo ruim: mensagem clara e nada muda
fs.writeFileSync('/tmp/backup-ruim.json', JSON.stringify({ versao: 1, casos: [{ nome: 'sem id' }] }));
await abrirBackup(); await page.setInputFiles('#importarBackupInput', '/tmp/backup-ruim.json'); await page.waitForTimeout(1500);
check(/sem identificador|inválid/i.test(await t('#formErrorBackup')) && !(await vis('#importarBackupConfirm')), 'arquivo com registro sem identificador é recusado com mensagem: ' + (await t('#formErrorBackup')).slice(0, 80));
check(igual(await todos(), estado1), 'o arquivo ruim não alterou nada');
check(erros.length === 0, 'sem erros na página: ' + erros.join(' | '));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
