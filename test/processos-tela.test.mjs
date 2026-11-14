// Testa na aba Processos: filtros (cliente, sem cliente, vara), próxima providência (com tarefa na Agenda) e linha do tempo na ficha.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const N1 = '5368644-67.2026.8.09.0107', N2 = '5593217-64.2021.8.09.0107', N3 = '5118774-16.2026.8.09.0017', N4 = '5200100-10.2025.8.09.0051';
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.32' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'config', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('PUT', '/api/db/clientes/cl1', { nome: 'Maquele Viana Pacheco', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/cl2', { nome: 'Cooperativa Mista', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/casos/c1', { tipo: 'inicial', cliente: 'Maquele Viana Pacheco', nomeAcao: 'Declaratória', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 3000, parcelas: [{ numero: 1, valor: 1500, data: dia(-10), pago: true, dataRecebimento: dia(-10) }, { numero: 2, valor: 1500, data: dia(15), pago: false }], numeroProcesso: N1, clienteIds: ['cl1'], criadoEm: agora, atualizadoEm: agora });
await f('PUT', '/api/db/termosAcordo/a1', { partes: 'Cooperativa x Osmar', numeroProcesso: N2, origem: 'proprio', status: 'pendente', valorTotal: 4000, valorMeuHonorario: 1200, parcelas: [{ numero: 1, valor: 1200, data: dia(20), pago: false }], data: dia(20), clienteIds: ['cl2'], criadoEm: agora, atualizadoEm: agora });
await f('POST', '/api/db/processos', { numero: N3, partes: 'Sem Cliente x Banco', orgao: 'TJGO · Bela Vista 1ª Vara', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
await f('POST', '/api/db/processos', { numero: N4, partes: 'Fulano x Beltrano', orgao: 'TJGO · Morrinhos 1ª Vara Cível', clienteIds: ['cl2'], honorarios: 'sem', arquivado: false, origem: 'manual', ajuizamento: dia(-200), criadoEm: agora });
await f('POST', '/api/db/agenda', { tipo: 'prazo', titulo: 'Recurso de apelação', processo: N4, cliente: 'Fulano', data: dia(5), situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora });
await f('POST', '/api/db/agenda', { tipo: 'audiencia', titulo: 'Audiência de instrução', processo: N4, cliente: 'Fulano', data: dia(30), hora: '09:00', audTipo: 'Instrução e julgamento', local: 'Fórum de Morrinhos', situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora });
await f('POST', '/api/db/agenda', { tipo: 'prazo', titulo: 'Contestação', processo: N4, cliente: 'Fulano', data: dia(-20), situacao: 'feito', concluido: true, protocoladoEm: dia(-22), avisos: [], criadoEm: agora });

const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const cards = () => page.evaluate(() => Array.from(document.querySelectorAll('#prLista .pr-card')).map(c => c.getAttribute('data-pr-card')));
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(1000);
const d = n => n.replace(/\D/g, '');
check((await cards()).length === 4, 'a lista tem os 4 processos: ' + (await cards()).length);

// filtros
await page.click('#prFunil'); await page.waitForTimeout(300);
check(await page.evaluate(() => !!document.getElementById('prf_cli') && !!document.getElementById('prf_orgao')), 'o botão de funil abre os filtros de cliente e vara');
check(/Sem cliente vinculado \(1\)/.test(await t('#prf_cli')), 'a opção “Sem cliente vinculado” mostra quantos são');
await page.selectOption('#prf_cli', '__sem'); await page.waitForTimeout(300);
let c = await cards(); check(c.length === 1 && c[0] === d(N3), 'filtro “sem cliente vinculado” mostra só o processo sem cliente');
check(/sem cliente vinculado/.test(await t('#prLista')), 'e o cartão traz a etiqueta');
check(await page.evaluate(() => document.getElementById('prFunil').classList.contains('ativo') && /1/.test(document.getElementById('prFunil').innerText)), 'o funil mostra que há 1 filtro ativo');
await page.selectOption('#prf_cli', 'cl2'); await page.waitForTimeout(300);
c = await cards(); check(c.length === 2 && c.includes(d(N2)) && c.includes(d(N4)), 'filtro por cliente (inclui o processo que vem do Termo de acordo)');
await page.selectOption('#prf_orgao', 'TJGO · Morrinhos 1ª Vara Cível'); await page.waitForTimeout(300);
c = await cards(); check(c.length === 1 && c[0] === d(N4), 'cliente + vara juntos');
await page.click('[data-pr="limpar"]'); await page.waitForTimeout(300);
check((await cards()).length === 4, 'limpar volta todos');
await page.click('[data-pr="painel"]'); await page.waitForTimeout(200);

// ficha: linha do tempo
await page.click('[data-pr="abrir"][data-n="' + d(N4) + '"]'); await page.waitForTimeout(600);
const tl = await t('#prCorpo');
check(/Linha do tempo/i.test(tl) && /Recurso de apelação/.test(tl) && /Audiência de instrução/.test(tl) && /Contestação/.test(tl), 'a ficha mostra a linha do tempo com prazos e audiência');
check(/Protocolada em/.test(tl), 'o prazo cumprido mostra a data do protocolo');
check(/Processo ajuizado/.test(tl) && /Cadastrado no Horus/.test(tl), 'e os marcos do processo');
const ordem = await page.evaluate(() => Array.from(document.querySelectorAll('.pr-tl-g')).map(x => x.textContent));
check(ordem[0] === 'Próximos' && ordem[1] === 'Anteriores', 'separa o que vem pela frente do que já passou');
{ const blocos = tl.split(/ANTERIORES|Anteriores/); check(blocos.length >= 2 && !/Cadastrado no Horus/.test(blocos[0]) && /Cadastrado no Horus/.test(blocos[1]), 'o que aconteceu hoje (como o cadastro) fica em “Anteriores”, não em “Próximos”'); }
// próxima providência com data cria tarefa na Agenda
await page.fill('#pr_prox', 'Pedir penhora via SISBAJUD'); await page.fill('#pr_proxdata', dia(7)); await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1500);
let p4 = (await docs('processos')).filter(p => p.numero === N4)[0], tarefa = (await docs('agenda')).filter(a => a.provProc)[0];
check(p4.proxima === 'Pedir penhora via SISBAJUD' && p4.proximaData === dia(7) && p4.proximaAgId && tarefa && tarefa.id === p4.proximaAgId, 'a próxima providência é gravada e vira tarefa na Agenda');
check(tarefa.tipo === 'tarefa' && tarefa.data === dia(7) && tarefa.titulo === 'Pedir penhora via SISBAJUD' && tarefa.processo === N4, 'a tarefa tem a data, o texto e o processo');
check(/Próxima: Pedir penhora/.test(await t('#prLista')), 'o cartão do processo mostra “Próxima: …”');
// mudar a data atualiza a mesma tarefa (sem duplicar)
await page.click('[data-pr="abrir"][data-n="' + d(N4) + '"]'); await page.waitForTimeout(500);
await page.fill('#pr_proxdata', dia(9)); await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
const ags = (await docs('agenda')).filter(a => a.provProc);
check(ags.length === 1 && ags[0].data === dia(9), 'mudar a data atualiza a mesma tarefa (sem duplicar)');
// concluir a tarefa na Agenda: a ficha mostra concluída
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(600);
await page.click('[data-ag="vista"][data-v="lista"]'); await page.waitForTimeout(300);
await page.click('.agc:has-text("Pedir penhora") [data-ag="concluir"]'); await page.waitForTimeout(900);
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(700);
check(/✓ Pedir penhora/.test(await t('#prLista')), 'quando a tarefa é concluída, o cartão mostra ✓');
await page.click('[data-pr="abrir"][data-n="' + d(N4) + '"]'); await page.waitForTimeout(500);
check(/Concluída/.test(await t('#prCorpo')), 'e a ficha avisa que foi concluída');
// limpar a providência apaga a tarefa
await page.fill('#pr_prox', ''); await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
check((await docs('agenda')).filter(a => a.provProc).length === 0 && !(await docs('processos')).filter(p => p.numero === N4)[0].proxima, 'limpar a providência remove a tarefa da Agenda');
// processo vindo de Inicial: honorários na linha do tempo
await page.click('[data-pr="abrir"][data-n="' + d(N1) + '"]'); await page.waitForTimeout(600);
const tl1 = await t('#prCorpo');
check(/Parcela 1\/2/.test(tl1) && /Parcela 2\/2/.test(tl1) && /Recebido/.test(tl1) && /A receber/.test(tl1), 'a linha do tempo junta as parcelas dos honorários (recebida e a receber)');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
for (const col of ['casos', 'termosAcordo', 'clientes', 'agenda', 'processos', 'config']) for (const x of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + x.id);
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
