// Testa o relatório de processos dentro do perfil do cliente: em andamento e arquivados, período, partes, vara, últimos andamentos e próximos passos.
// O Diário Oficial é simulado na porta 8890.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var DJEN_URL:http://127.0.0.1:8890/api/v1/comunicacao --port 8812
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const N1 = '5593217-64.2021.8.09.0107', N2 = '5111111-11.2024.8.09.0107', N3 = '5222222-22.2023.8.09.0107', N4 = '5333333-33.2025.8.09.0107';
const itens = [{ id: 950001, data_disponibilizacao: hoje, siglaTribunal: 'TJGO', tipoComunicacao: 'Intimação', tipoDocumento: 'Decisão', nomeOrgao: 'Morrinhos - 1ª Vara Cível', nomeClasse: 'CUMPRIMENTO DE SENTENÇA', numero_processo: N1.replace(/\D/g, ''), numeroprocessocommascara: N1, link: 'https://exemplo.test/p/1', texto: 'Autos n.: ' + N1 + '\nPolo Ativo: Complem\nPolo Passivo: Osmar\nDECISÃO\nDefiro a penhora via SISBAJUD em desfavor do executado.', destinatarios: [{ nome: 'Complem', polo: 'A' }], destinatarioadvogados: [] }];
const fake = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', count: itens.length, items: itens })); }).listen(8890);
await new Promise(ok => fake.on('listening', ok));
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.37' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'config', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('PUT', '/api/db/clientes/cl1', { nome: 'Complem', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/cl2', { nome: 'Outro Cliente', pagador: 'cliente', criadoEm: agora });
const P = o => f('POST', '/api/db/processos', Object.assign({ honorarios: 'sem', arquivado: false, origem: 'manual', clienteIds: ['cl1'], criadoEm: agora }, o));
await P({ numero: N1, partes: 'Complem x Osmar', orgao: 'TJGO · Morrinhos 1ª Vara Cível', classe: 'Cumprimento de sentença', ajuizamento: dia(-400), proxima: 'Pedir penhora via SISBAJUD', proximaData: dia(6) });
await P({ numero: N2, partes: 'Complem x Fulano', orgao: 'TJGO · Morrinhos 2ª Vara Cível', classe: 'Execução', arquivado: true, arquivadoEm: agora, dataArquivo: dia(-60), motivoArquivo: 'Acordo cumprido', resultado: 'acordo' });
await P({ numero: N3, partes: 'Complem x Antigo', orgao: 'TJGO · Bela Vista', classe: 'Cobrança', arquivado: true, arquivadoEm: iso0(), dataArquivo: dia(-800), motivoArquivo: 'Desistência / renúncia ao mandato', resultado: 'desistencia' });
await P({ numero: N4, partes: 'Outro x Réu', orgao: 'TJGO · Outra', clienteIds: ['cl2'] });
function iso0() { return dia(-800) + 'T12:00:00.000Z'; }
await f('PUT', '/api/db/casos/c1', { tipo: 'inicial', cliente: 'Complem', nomeAcao: 'Cumprimento', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 777, avista: { data: dia(20), pago: false }, numeroProcesso: N1, clienteIds: ['cl1'], criadoEm: agora, atualizadoEm: agora });
const A = o => f('POST', '/api/db/agenda', Object.assign({ situacao: 'afazer', concluido: false, avisos: [], criadoEm: agora }, o));
await A({ tipo: 'prazo', titulo: 'Impugnar cálculos', processo: N1, cliente: 'Complem', data: dia(3) });
await A({ tipo: 'audiencia', titulo: 'Audiência de conciliação', processo: N1, cliente: 'Complem', data: dia(10), hora: '14:00' });
await A({ tipo: 'prazo', titulo: 'Réplica à contestação', processo: N1, cliente: 'Complem', data: dia(-5), situacao: 'feito', concluido: true, protocoladoEm: dia(-6) });
await f('POST', '/api/djen/buscar', {});

const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
await page.evaluate(() => document.querySelector('#drawer [data-tab="clientes"]').click()); await page.waitForTimeout(700);
await page.evaluate(() => { const el = Array.from(document.querySelectorAll('#bodyClientes *')).find(e => /^Complem$/.test((e.textContent || '').trim()) && e.children.length === 0); if (el) el.click(); }); await page.waitForTimeout(700);
check(await page.evaluate(() => !!document.querySelector('#perfilBody [data-pr-relcli]')), 'o perfil do cliente tem o botão “Relatório de processos deste cliente”');
await page.click('[data-pr-relcli]'); await page.waitForTimeout(600);
let fo = await t('#rptFolha');
if (process.env.SHOT){ await page.screenshot({ path: process.env.SHOT + 'rc-1.png' }); await page.evaluate(() => { document.getElementById('overlayRpt').scrollTop = 750; }); await page.waitForTimeout(200); await page.screenshot({ path: process.env.SHOT + 'rc-2.png' }); await page.evaluate(() => { document.getElementById('overlayRpt').scrollTop = 0; }); }
check(/Relatório de processos: Complem/.test(fo) && /Complem · Últimos 12 meses · 2 processos/.test(fo), 'o relatório abre com o nome do cliente, o período e o total: ' + (fo.match(/Complem · [^\n]*/) || [''])[0]);
check(/Em andamento \(1\)/.test(fo) && /Arquivados no período \(1\)/.test(fo), 'separa em andamento (1) e arquivados no período (1)');
check(fo.includes(N1) && fo.includes('Complem x Osmar') && /Morrinhos 1ª Vara Cível/.test(fo) && /Cumprimento de sentença/.test(fo), 'cada processo traz número, partes, vara e classe');
check(fo.includes(N2) && /Acordo cumprido/.test(fo) && /Resultado: Acordo/.test(fo) && /Arquivado em/.test(fo), 'o arquivado mostra a data, o motivo e o resultado');
check(!fo.includes(N3) && !fo.includes(N4), 'não traz o arquivado fora do período nem o processo de outro cliente');
check(/1 com êxito e 0 sem êxito/.test(fo), 'o resumo conta o resultado dos arquivados');
check(/Últimos andamentos/.test(fo) && /Réplica à contestação/.test(fo) && /Protocolada em/.test(fo) && /Decisão/.test(fo) && /penhora via SISBAJUD/.test(fo), 'os últimos andamentos trazem o prazo cumprido e a publicação (com o trecho)');
check(/Próximos passos/.test(fo) && /Providência: Pedir penhora via SISBAJUD \(até/.test(fo) && /Prazo: Impugnar cálculos/.test(fo) && /Audiência: Audiência de conciliação às 14:00/.test(fo) && !/ATRASADO/.test(fo), 'os próximos passos trazem a providência, o prazo e a audiência');
check(!/Honorários/.test(fo), 'por padrão não mostra honorários (relatório pode ir ao cliente)');
await page.check('#rptop_hon'); await page.waitForTimeout(300); fo = await t('#rptFolha');
check(/Honorários/.test(fo) && /777,00/.test(fo), 'com a opção marcada, mostra os honorários a receber');
await page.uncheck('#rptop_pubs'); await page.waitForTimeout(300); fo = await t('#rptFolha');
check(!/penhora via SISBAJUD em desfavor/.test(fo) && /Decisão/.test(fo), 'sem “mostrar o trecho das publicações”, fica só o título do andamento');
await page.selectOption('#rptop_quais', 'arquivados'); await page.waitForTimeout(300); fo = await t('#rptFolha');
check(!fo.includes(N1) && fo.includes(N2) && !/Próximos passos/.test(fo), '“Só arquivados”: some o processo em andamento e os próximos passos');
await page.selectOption('#rptop_quais', 'todos'); await page.selectOption('#rptop_periodo', 'tudo'); await page.waitForTimeout(300); fo = await t('#rptFolha');
check(fo.includes(N3) && /Arquivados no período \(2\)/.test(fo) && /Desistência/.test(fo), 'período “Tudo”: inclui o arquivado antigo');
await page.selectOption('#rptop_periodo', 'custom'); await page.fill('#rptop_de', dia(-900)); await page.fill('#rptop_ate', dia(-700)); await page.waitForTimeout(400); fo = await t('#rptFolha');
check(fo.includes(N3) && !fo.includes(N1) && !fo.includes(N2) && /1 processo/.test(fo), 'datas escolhidas: só o que foi arquivado dentro delas');
await page.selectOption('#rptop_periodo', 'custom'); await page.fill('#rptop_de', dia(-30)); await page.fill('#rptop_ate', dia(-20)); await page.waitForTimeout(400); fo = await t('#rptFolha');
check(/Nenhum processo deste cliente neste período/.test(fo) || !fo.includes(N2), 'período sem processos: avisa em vez de mostrar vazio');
await page.emulateMedia({ media: 'print' });
check(await page.evaluate(() => { const v = e => !!e && e.getClientRects().length > 0; return v(document.getElementById('rptFolha')) && !v(document.getElementById('perfilBody')) && !v(document.querySelector('#overlayRpt .rpt-barra')); }), 'na impressão só a folha aparece');
await page.emulateMedia({ media: 'screen' });
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
for (const col of ['casos', 'clientes', 'agenda', 'processos', 'config']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await br.close(); fake.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
