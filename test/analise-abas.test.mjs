// Testa as correções da análise das abas Publicações, Processos e Agenda:
// audiência que passou, processo "parado" sem cadastro, backup/restauração com Processos e Agenda, aviso de leitura parada e desempenho.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.9' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov', 'prazosPub', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
// Inicial já quitada, recente, só com número (não tem processo cadastrado, nem publicação, nem prazo)
await f('PUT', '/api/db/casos/quit', { tipo: 'inicial', cliente: 'Quitada Recente', nomeAcao: 'Cobrança', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 1000, avista: { data: dia(-2), pago: true, dataRecebimento: dia(-2) }, numeroProcesso: '5999999-33.2026.8.09.0107', clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await f('POST', '/api/db/agenda', { tipo: 'audiencia', titulo: 'Audiência de conciliação', cliente: 'Fulano', data: dia(-3), hora: '14:00', situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora });
await f('POST', '/api/db/agenda', { tipo: 'audiencia', titulo: 'Audiência de instrução', cliente: 'Sicrano', data: dia(4), hora: '09:00', situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora });
await f('POST', '/api/db/processos', { numero: '5111222-33.2025.8.09.0107', partes: 'Backup x Teste', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });

const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 }, acceptDownloads: true }); const page = await ctx.newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); page.on('console', m => { if (m.type() === 'error') console.log('   [console]', m.text().slice(0, 200)); }); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);

// 1) audiência que passou
check(await page.evaluate(() => (document.getElementById('menuNAgenda') || {}).textContent) === '', 'o contador da Agenda não fica preso numa audiência que já passou');
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(700);
for (const [v, nome] of [['semana', 'Semana'], ['lista', 'Lista'], ['quadro', 'Quadro']]) {
  await page.click('[data-ag="vista"][data-v="' + v + '"]'); await page.waitForTimeout(400);
  const txt = await t('#agWrap');
  check(/Audiência de conciliação/.test(txt), 'a audiência de 3 dias atrás aparece na vista ' + nome + ' para você marcar');
  if (v !== 'quadro') check(/foi realizada\?/i.test(txt), 'e vem com o título perguntando se foi realizada (' + nome + ')');
}
await page.click('[data-ag="vista"][data-v="lista"]'); await page.waitForTimeout(300);
check((await t('#agWrap')).match(/Audiência de conciliação/g).length === 1, 'sem repetir o mesmo cartão');
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#agWrap .agc')).find(x => /conciliação/.test(x.innerText)); b.querySelector('[data-ag="concluir"]').click(); }); await page.waitForTimeout(900);
check(!/foi realizada\?/i.test(await t('#agWrap')), 'ao marcar como realizada, ela sai da lista');

// 2) processo vindo só de Inicial, quitado e novo: não é "parado"
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(900);
const card = await page.evaluate(() => { const c = document.querySelector('[data-pr-card="59999993320268090107"]'); return c ? c.innerText : ''; });
check(card && !/sem andamento/.test(card), 'Inicial quitada e recente não é marcada como "sem andamento há 60 dias": ' + card.replace(/\n+/g, ' | ').slice(0, 90));

// 3) aviso de leitura parada (ainda não leu)
await page.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await page.waitForTimeout(1500);
const est = (await f('GET', '/api/djen/estado')).j, parada = !est.ultimaLeitura || Date.now() - Date.parse(est.ultimaLeitura) > 30 * 3600e3 || (est.oabs || []).some(o => o.ativo && o.erro);
const aviso = await t('#pbAvisoLeitura');
check(parada ? /ainda não rodou|não roda desde|falhou/.test(aviso) : aviso === '', 'Publicações ' + (parada ? 'avisa que a leitura do Diário Oficial não rodou' : 'não avisa nada quando a leitura está em dia') + ': ' + aviso.slice(0, 60));

// 4) backup do app e do servidor levam Processos e Agenda
const dl = page.waitForEvent('download', { timeout: 8000 });
await page.evaluate(() => document.getElementById('exportarBackupBtn').click());
const arq = await dl, caminho = await arq.path(), bk = JSON.parse(fs.readFileSync(caminho, 'utf8'));
check(Array.isArray(bk.processos) && bk.processos.some(p => p.numero === '5111222-33.2025.8.09.0107') && Array.isArray(bk.agenda) && bk.agenda.length >= 2, 'o “Baixar backup completo” inclui os processos e a agenda: ' + (bk.processos || []).length + ' e ' + (bk.agenda || []).length);
const feito = await f('POST', '/api/backups/agora'), lista = await f('GET', '/api/backups');
const srv = await f('GET', '/api/backups/' + lista.j.itens[0].dia);
check(srv.s === 200 && srv.j.processos.length === 1 && srv.j.agenda.length >= 2, 'o backup automático do servidor, no formato do app, também inclui processos e agenda');
// restaurar: apaga um processo e um item da agenda e volta pelo arquivo
for (const p of await docs('processos')) await f('DELETE', '/api/db/processos/' + p.id);
for (const a of await docs('agenda')) await f('DELETE', '/api/db/agenda/' + a.id);
await page.reload(); await page.waitForTimeout(3500);
fs.writeFileSync('/tmp/bk-teste.json', JSON.stringify(bk));
await page.evaluate(() => { const m = document.getElementById('exportarBackupBtn'); let el = m; while (el && !(el.classList && el.classList.contains('overlay'))) el = el.parentElement; if (el) el.classList.add('show'); });
await page.setInputFiles('#importarBackupInput', '/tmp/bk-teste.json'); await page.waitForTimeout(800);
check(/processos\s[^]*?\+1 a trazer/.test(await t('#importarBackupResumo')) && /itens da agenda\s[^]*?\+\d+ a trazer/.test(await t('#importarBackupResumo')), 'a conferência da restauração mostra processos e agenda a trazer de volta: ' + (await t('#importarBackupResumo')).replace(/\n/g, ' ').slice(0, 160));
const dl2 = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await page.evaluate(() => document.getElementById('confirmarImportarBackup').click()); await page.waitForTimeout(5000);
console.log('   erro na tela:', await t('#formErrorBackup'), '| progresso:', await t('#backupProgresso'));
const pr2 = await docs('processos'), ag2 = await docs('agenda');
check(pr2.length === 1 && pr2[0].numero === '5111222-33.2025.8.09.0107', 'restaurar traz de volta o processo apagado');
check(ag2.length === bk.agenda.length, 'e os itens da agenda: ' + ag2.length);
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
for (const col of ['casos', 'processos', 'agenda', 'config']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
