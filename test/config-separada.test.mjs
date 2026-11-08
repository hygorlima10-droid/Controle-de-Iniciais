// Testa a separação da configuração (Fase 1, item 6): migração para configDono, tabela de coleções, compatibilidade do endereço antigo,
// restauração de backup antigo e o Início só com honorários.
// Precisa de um banco semeado ANTES de subir o servidor (ver /tmp/rodar_cfg.sh: config/planejamento, obra, personalizacao, vinculoIniciais, alertasDispensados, backup, modelosHonorario).
//   BASE=http://127.0.0.1:8814 node test/config-separada.test.mjs   (servidor com LOGIN_ANTIGO=1)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { checarColecao, resolverColecao } from '../src/colecoes.js';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8814', SENHA = 'senha-de-teste-123', DATA = process.env.DADOS || '/tmp/dev-data-cfg';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.81' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); return { s: x.status, j: await x.json().catch(() => ({})) }; };
const sql = q => JSON.parse(execSync(`cd /home/user/Controle-de-Iniciais && npx wrangler d1 execute controle-juridico --local --persist-to ${DATA} --json --command "${q}"`, { encoding: 'utf8' }))[0].results;
const DONO = ['planejamento', 'obra', 'extratos', 'relatorioMurilo', 'alertasDispensados', 'backup'];

/* 1 — migração (o servidor roda sozinho na primeira requisição) */
await f('GET', '/api/db/config');
const bk = (await f('GET', '/api/backup')).j.docs; const em = c => bk.filter(d => d.colecao === c).map(d => d.id).sort();
check(JSON.stringify(em('configDono')) === JSON.stringify(['alertasDispensados', 'backup', 'obra', 'planejamento']), 'os documentos do proprietário foram para configDono: ' + em('configDono').join(', '));
check(JSON.stringify(em('config')) === JSON.stringify(['modelosHonorario', 'personalizacao', 'vinculoIniciais']), 'config ficou só com os gerais: ' + em('config').join(', '));
check(bk.find(d => d.colecao === 'configDono' && d.id === 'planejamento').dados.reservaRecusada['2026-10'] === 111.5, 'o conteúdo foi copiado sem alteração');
const cofre = sql("SELECT id FROM docs WHERE colecao = '_sistema' AND id LIKE 'cfg-antes-%' ORDER BY id").map(r => r.id);
check(cofre.length === 4 && cofre.includes('cfg-antes-planejamento'), 'o original de cada um ficou guardado no cofre interno (' + cofre.length + ')');
check(sql("SELECT id FROM docs WHERE colecao = '_sistema' AND id = 'mig-config-dono-v1'").length === 1, 'a marca de migração foi gravada');
/* 2 — compatibilidade do endereço antigo */
let r = await f('GET', '/api/db/config'); const ids = (r.j.docs || []).map(d => d.id);
check(['planejamento', 'obra', 'personalizacao', 'vinculoIniciais'].every(i => ids.includes(i)), 'a lista de config (para o proprietário) continua trazendo todos os documentos, como o app já aberto espera');
r = await f('PUT', '/api/db/config/planejamento', { reservaRecusada: { '2026-10': 222 }, atualizadoEm: 'x' }); check(r.s === 200, 'gravar no endereço antigo funciona');
const bk2 = (await f('GET', '/api/backup')).j.docs;
check(bk2.find(d => d.colecao === 'configDono' && d.id === 'planejamento').dados.reservaRecusada['2026-10'] === 222 && !bk2.some(d => d.colecao === 'config' && d.id === 'planejamento'), 'e vai para configDono (não recria o documento em config)');
r = await f('PUT', '/api/db/config/personalizacao', { colunasPeticao: [] }); check(r.s === 200 && (await f('GET', '/api/backup')).j.docs.some(d => d.colecao === 'config' && d.id === 'personalizacao'), 'documento geral continua em config');
r = await f('PUT', '/api/db/configDono/novo1', { a: 1 }); check(r.s === 200, 'configDono aceita gravação direta (proprietário)');
await f('DELETE', '/api/db/configDono/novo1');
r = await f('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'config', id: 'obra', dados: { orcamento: 9 } }] }); check(r.s === 200 && (await f('GET', '/api/backup')).j.docs.some(d => d.colecao === 'configDono' && d.id === 'obra' && d.dados.orcamento === 9), 'o lote também leva config/<doc do proprietário> para configDono');
/* 3 — tabela de coleções */
r = await f('GET', '/api/db/colecaoInventada'); check(r.s === 404, 'coleção fora da tabela é recusada');
r = await f('PUT', '/api/db/colecaoInventada/x', { a: 1 }); check(r.s === 404, 'e não aceita gravação');
r = await f('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'colecaoInventada', id: 'x', dados: { a: 1 } }] }); check(r.s === 404, 'nem pelo lote');
const outro = { usuario: { papel: 'advogado' } }, dono = { usuario: { papel: 'proprietario' } };
check(['despesas', 'receitasManuais', 'saldos', 'metas', 'extratos', 'obraMov', 'configDono'].every(c => checarColecao(c, outro).status === 403 && checarColecao(c, dono) === null && checarColecao(c, null) === null), 'quem não é proprietário é recusado (403) nas 7 coleções de finanças; o proprietário e o modo antigo passam');
check(['casos', 'termosAcordo', 'alvaras', 'clientes', 'processos', 'agenda', 'pecasAprendidas', 'prazosPub', 'config'].every(c => checarColecao(c, outro) === null), 'as coleções do jurídico passam para qualquer papel');
check(checarColecao('qualquer', dono).status === 404 && resolverColecao('config', 'planejamento') === 'configDono' && resolverColecao('config', 'personalizacao') === 'config' && resolverColecao('despesas', 'planejamento') === 'despesas', 'resolverColecao leva só os 6 documentos do proprietário');
/* 4 — backup antigo (documentos do proprietário dentro de config) restaura no lugar novo */
const antigo = { versao: 1, casos: [], config: { planejamento: { reservaRecusada: { '2026-09': 77 } }, obra: { orcamento: 5 }, personalizacao: { colunasPeticao: [] } } };
r = await f('POST', '/api/restaurar/conferir', antigo); const nomes = (r.j.colecoes || []).map(c => c.colecao);
check(r.j.ok !== false && nomes.includes('configDono') && nomes.includes('config'), 'conferir mostra configDono como coleção do arquivo antigo (' + nomes.join(', ') + ')');
r = await f('POST', '/api/restaurar/aplicar', { confirmar: true, arquivo: antigo }); check(r.s === 200 && r.j.ok, 'restauração do backup antigo aplicada');
const bk3 = (await f('GET', '/api/backup')).j.docs;
check(bk3.some(d => d.colecao === 'configDono' && d.id === 'planejamento' && d.dados.reservaRecusada['2026-09'] === 77) && !bk3.some(d => d.colecao === 'config' && DONO.includes(d.id)), 'o backup antigo coloca os documentos do proprietário em configDono, não em config');
/* 5 — Início: total só de honorários e quadro da PJ à parte */
for (const c of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'saldos']) for (const d of (await f('GET', '/api/db/' + c)).j.docs || []) await f('DELETE', '/api/db/' + c + '/' + d.id);
const hoje = new Date().toISOString().slice(0, 10), agora = new Date().toISOString();
await f('PUT', '/api/db/receitasManuais/pj1', { descricao: 'Venda do tablet', coluna: 'pj', valor: 3500, mesReferencia: hoje.slice(0, 7), data: hoje, recorrente: false, criadoEm: agora });
await f('PUT', '/api/db/casos/c1', { tipo: 'inicial', cliente: 'Cliente A', nomeAcao: 'x', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 4000, parcelas: [{ numero: 1, valor: 4000, data: hoje, pago: true, dataRecebimento: hoje }], clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } });
const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
check(/Honorários recebidos no mês/.test(await t('#resumoRecebidoLbl')), 'o rótulo do Início é "Honorários recebidos no mês"');
check(/R\$\s*4\.000,00/.test(await t('#resumoRecebido')), 'a renda de R$ 3.500 da PJ não entra no total: só os R$ 4.000 de honorários (' + (await t('#resumoRecebido')).replace(/\n/g, ' ') + ')');
check(await page.evaluate(() => document.querySelectorAll('#inicioBarra span').length === 2 && !document.querySelector('#inicioBarra .seg-out')), 'a barra tem só os segmentos de honorários (próprios e Murilo)');
check(await page.evaluate(() => { const e = document.getElementById('inicioPjCard'); return !!e && e.style.display !== 'none'; }) && /3\.500,00/.test(await t('#inicioPjCard')) && /Só você vê/.test(await t('#inicioPjCard')), 'o quadro "Renda da PJ no mês" aparece à parte, marcado como só do proprietário: ' + (await t('#inicioPjCard')).replace(/\n/g, ' '));
check(!/Outras receitas/.test(await t('#inicioLegenda')) && !(await page.evaluate(() => !!document.getElementById('resumoOrigemOutrasCard'))), 'sem "Outras receitas" na barra nem em "Ver por origem"');
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/inicio-pj.png' });
await page.click('#inicioPjCard'); await page.waitForTimeout(900);
check(await page.evaluate(() => { const e = document.getElementById('colunaFinanceiroPj'); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }), 'tocar no quadro abre a PJ');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
