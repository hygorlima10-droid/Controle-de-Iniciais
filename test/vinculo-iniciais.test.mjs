// Testa o vínculo transitório entre o cadastro de processo (aba Publicações) e as Iniciais já cadastradas:
// só Iniciais (inclusive arquivadas) até o dia da implantação, aviso de número repetido, "não tem processo" só no cadastro da Inicial,
// a opção some quando não sobra nenhuma. Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.7' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov', 'prazosPub', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
const NOVO = '5400100-10.2026.8.09.0107', N9 = '5000111-22.2023.8.09.0107', N1 = '5368644-67.2026.8.09.0107';
await f('PUT', '/api/db/clientes/cl1', { nome: 'Maquele Viana Pacheco', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/cl2', { nome: 'Complem', pagador: 'cliente', criadoEm: agora });
const caso = (id, o) => f('PUT', '/api/db/casos/' + id, Object.assign({ tipo: 'inicial', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 2000, avista: { data: hoje, pago: false }, numeroProcesso: '', clienteIds: [], criadoEm: '2025-03-10T10:00:00.000Z', atualizadoEm: agora }, o));
await caso('ca', { cliente: 'Complem', nomeAcao: 'Cobrança', clienteIds: ['cl2'] });
await caso('cb', { cliente: 'Maquele Viana Pacheco', nomeAcao: 'Declaratória antiga', clienteIds: ['cl1'], arquivado: true, arquivadoEm: agora });
await caso('cc', { cliente: 'João da Silva', nomeAcao: 'Indenização', numeroProcesso: N9 });
await caso('cd', { cliente: 'Extra Judicial', nomeAcao: 'Notificação', tipo: 'extrajudicial' });
await caso('ce', { cliente: 'Sem Processo Algum', nomeAcao: 'Parecer', semProcesso: true });
await caso('cf', { cliente: 'Já Ligada', nomeAcao: 'Execução', numeroProcesso: N1 });
await f('POST', '/api/db/processos', { numero: N1, partes: 'Já Ligada x Banco', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'publicacao', criadoEm: agora });

const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const cfg = (await docs('config')).filter(d => d.id === 'vinculoIniciais')[0];
check(cfg && cfg.corte && cfg.corte >= agora, 'a data de corte (dia da implantação) foi gravada na primeira abertura');
const pend = await page.evaluate(() => window.__horusTeste.prIniciaisPend(true).sort());
check(JSON.stringify(pend) === JSON.stringify(['ca', 'cb', 'cc']), 'pendentes: Iniciais sem processo cadastrado, inclusive arquivada e a que tem número solto; ficam de fora extrajudicial, "sem processo" e a já ligada: ' + pend.join(','));
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(800);
check(/2 Iniciais ainda não estão ligadas/.test(await t('#prAvisoVinc')), 'a aba Processos avisa quantas Iniciais faltam (as arquivadas não contam no aviso): ' + (await t('#prAvisoVinc')).slice(0, 60));

// cadastrar processo (como se viesse da publicação, com o nome completo do cliente)
await page.evaluate(n => window.__horusTeste.prAbrirNovo({ numero: n, partes: 'Cooperativa Mista dos Produtores de Leite de Morrinhos - Complem x Banco Alfa', autor: 'Cooperativa Mista dos Produtores de Leite de Morrinhos - Complem', reu: 'Banco Alfa S/A', nomes: ['Cooperativa Mista dos Produtores de Leite de Morrinhos - Complem'], ids: [], origem: 'publicacao' }), NOVO); await page.waitForTimeout(500);
check(/já está cadastrado como Inicial/i.test(await t('#pr_vinc')), 'o cadastro de processo oferece vincular a uma Inicial');
check(/\(3\)/.test(await t('#pr_vinc')), 'mostra quantas Iniciais há para vincular');
await page.click('[data-prf="vinc-abrir"]'); await page.waitForTimeout(300);
const linhas = await page.evaluate(() => Array.from(document.querySelectorAll('#pr_vinclista .pb-lin')).map(e => e.innerText));
check(linhas.length === 3, 'lista as 3 Iniciais pendentes: ' + linhas.length);
check(/Complem/.test(linhas[0]) && /provável/.test(linhas[0]), 'a mais parecida com o nome da publicação vem primeiro, marcada como provável');
check(linhas.some(l => /Declaratória antiga/.test(l) && /arquivada/.test(l)), 'a Inicial arquivada também aparece');
check(linhas.some(l => /já tem o nº/.test(l) && /João da Silva/.test(l)), 'a que já tem número mostra isso na linha');
check(!(await page.evaluate(() => /Não tem processo/i.test(document.getElementById('pr_vinclista').innerText))), 'não há botão "Não tem processo" nos cards da lista');
await page.fill('#pr_vincq', 'indeniza'); await page.waitForTimeout(200);
check(await page.evaluate(() => document.querySelectorAll('#pr_vinclista .pb-lin').length) === 1, 'a busca filtra a lista');
// candidato que já tem outro número: avisa e deixa cancelar
await page.click('#pr_vinclista [data-prf="vinc-esc"]'); await page.waitForTimeout(200);
check(/já tem o número 5000111/.test(await t('#pr_vinclista')) && /trocado/.test(await t('#pr_vinclista')), 'avisa que a Inicial já tem número e que será trocado');
await page.click('[data-prf="vinc-cancel"]'); await page.waitForTimeout(200);
check(!(await page.evaluate(() => /Ligado à Inicial/i.test(document.getElementById('pr_vinc').innerText))), 'cancelar não vincula nada');
// escolher a Complem
await page.fill('#pr_vincq', ''); await page.waitForTimeout(200);
await page.click('#pr_vinclista [data-prf="vinc-esc"]'); await page.waitForTimeout(300);
check(/Ligado à Inicial/i.test(await t('#pr_vinc')) && /Complem · Cobrança/.test(await t('#pr_vinc')), 'escolher a Inicial mostra o vínculo');
check(await page.evaluate(() => document.getElementById('pr_classe').value) === 'Cobrança' && /Complem/.test(await t('#pr_chips')), 'completa classe e cliente a partir da Inicial');
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1500);
const ca = (await docs('casos')).filter(c => c.id === 'ca')[0], procs = await docs('processos');
check(ca && ca.numeroProcesso === NOVO, 'o número do processo foi gravado na Inicial: ' + (ca && ca.numeroProcesso));
check(procs.some(p => p.numero === NOVO), 'o processo foi cadastrado');
check(/Toque|Desfazer/i.test(await t('#toast')) || /ligado à Inicial/i.test(await t('#toast')), 'avisa que ligou (com Desfazer)');
const mapa = await page.evaluate(n => { const c = document.querySelector('[data-pr-card="' + n.replace(/\D/g, '') + '"]'); return c ? c.innerText : ''; }, NOVO);
check(/Inicial/.test(mapa) && /Complem/.test(mapa), 'na lista única o processo já aparece junto com a Inicial (sem duplicar): ' + mapa.replace(/\n/g, ' | ').slice(0, 100));
check(await page.evaluate(n => document.querySelectorAll('[data-pr-card="' + n.replace(/\D/g, '') + '"]').length, NOVO) === 1, 'um só cartão para o processo');
check(/1 Inicial ainda/.test(await t('#prAvisoVinc')), 'o aviso caiu para 1');
// desfazer
await page.evaluate(() => { const b = document.querySelector('#toast button'); if (b) b.click(); }); await page.waitForTimeout(1200);
check((await docs('casos')).filter(c => c.id === 'ca')[0].numeroProcesso === '', 'Desfazer devolve a Inicial como estava');

// "não tem processo": só no cadastro da Inicial
await page.evaluate(() => document.querySelector('#drawer [data-tab="peticoes"]').click()); await page.waitForTimeout(600);
const abrirIni = async id => { await page.evaluate(i => { const b = document.querySelector('[data-p-editar="' + i + '"], [data-editar="' + i + '"]'); if (b) b.click(); }, id); await page.waitForTimeout(500); };
await abrirIni('ca');
check(await page.evaluate(() => document.getElementById('overlay').classList.contains('show') && document.getElementById('modalTitle').textContent === 'Editar inicial'), 'abre o cadastro da Inicial');
check(await page.evaluate(() => { const c = document.getElementById('semProcessoInput'); return !!c && !c.checked && getComputedStyle(c.closest('.field')).display !== 'none'; }), 'o cadastro da Inicial tem a opção "não tem processo", desmarcada');
await page.fill('#processoInput', '5000'); await page.waitForTimeout(100);
check(await page.evaluate(() => getComputedStyle(document.getElementById('semProcessoInput').closest('.field')).display) === 'none', 'ao digitar um número, a opção some');
await page.fill('#processoInput', ''); await page.waitForTimeout(100);
check(await page.evaluate(() => getComputedStyle(document.getElementById('semProcessoInput').closest('.field')).display) !== 'none', 'sem número, ela volta');
await page.check('#semProcessoInput'); await page.click('#saveBtn'); await page.waitForTimeout(1200);
check((await docs('casos')).filter(c => c.id === 'ca')[0].semProcesso === true, 'marcar "não tem processo" grava no cadastro da Inicial');
check(!(await page.evaluate(() => window.__horusTeste.prIniciaisPend(true))).includes('ca'), 'e ela sai da lista de pendentes');
await abrirIni('ca');
check(await page.evaluate(() => document.getElementById('semProcessoInput').checked), 'ao reabrir a Inicial, a opção continua marcada');
await page.click('#closeModal'); await page.waitForTimeout(300);
// quando não sobra nenhuma, a opção some
await f('PUT', '/api/db/casos/cb', Object.assign((await docs('casos')).filter(c => c.id === 'cb')[0], { id: undefined, semProcesso: true }));
await f('PUT', '/api/db/casos/cc', Object.assign((await docs('casos')).filter(c => c.id === 'cc')[0], { id: undefined, semProcesso: true }));
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(800);
check(!/Inicia/.test(await t('#prAvisoVinc')), 'sem pendências de Inicial, o aviso de Iniciais da aba Processos some (o de "ligações a revisar" é outro)');
await page.evaluate(() => window.__horusTeste.prAbrirNovo({ numero: '5400200-20.2026.8.09.0107', nomes: [], ids: [], origem: 'publicacao' })); await page.waitForTimeout(400);
check(await t('#pr_vinc') === '', 'sem pendências, o cadastro de processo não oferece mais o vínculo');
// Iniciais criadas depois do corte TAMBÉM entram (o vínculo agora é permanente)
await f('PUT', '/api/db/casos/cz', { tipo: 'inicial', cliente: 'Cliente Novo', nomeAcao: 'Nova ação', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 1000, avista: { data: hoje, pago: false }, numeroProcesso: '', clienteIds: [], criadoEm: new Date(Date.now() + 60000).toISOString(), atualizadoEm: agora });
await page.reload(); await page.waitForTimeout(3500);
check((await page.evaluate(() => window.__horusTeste.prIniciaisPend(true))).length === 1, 'Inicial cadastrada depois do corte também entra na lista (o vínculo agora é permanente)');
const cfg2 = (await docs('config')).filter(d => d.id === 'vinculoIniciais')[0];
check(cfg2.corte === cfg.corte, 'a data de corte não muda nas aberturas seguintes');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
for (const col of ['casos', 'clientes', 'config', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);   // deixa o banco limpo para os outros testes
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
