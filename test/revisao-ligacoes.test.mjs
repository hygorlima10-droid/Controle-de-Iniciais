// Testa a revisão de ligações (correções 4 e 6 da análise de interligação): números sem processo cadastrado (inclusive só na Agenda),
// processos sem cliente (com sugestão) e cliente diferente entre o ato e o processo.
// Grupo principal (porta 8812):  node test/rodar.mjs revisao-ligacoes
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), em = (n) => new Date(Date.parse(hoje) + n * 864e5).toISOString().slice(0, 10);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.32' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov', 'prazosPub', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
const NA = '5500001-11.2026.8.09.0107', NB = '5500002-22.2026.8.09.0107', NC = '5500003-33.2026.8.09.0107', ND = '5500004-44.2026.8.09.0107', NE = '5500005-55.2026.8.09.0107', NF = '5500006-66.2026.8.09.0107';
await f('PUT', '/api/db/clientes/cl1', { nome: 'Cliente Um', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/cl2', { nome: 'Cliente Dois', pagador: 'cliente', criadoEm: agora });
const proc = (n, o) => f('POST', '/api/db/processos', Object.assign({ numero: n, honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora }, o));
const caso = (id, o) => f('PUT', '/api/db/casos/' + id, Object.assign({ tipo: 'inicial', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 100, criadoEm: agora }, o));
await proc(NA, { partes: 'A x B', clienteIds: ['cl1'] });
await caso('ia', { cliente: 'Cliente Dois', nomeAcao: 'Ação A', numeroProcesso: NA, clienteIds: ['cl2'] });                       // cliente diferente do processo
await caso('ib', { cliente: 'Cliente Um', nomeAcao: 'Ação B', numeroProcesso: NB, clienteIds: ['cl1'], advogados: [{ oab: '60456/GO', nome: 'Hygor' }] });   // número sem processo
await f('PUT', '/api/db/termosAcordo/ac', { partes: 'Cliente Um', numeroProcesso: NB, clienteIds: ['cl1'], status: 'pendente', criadoEm: agora });
await f('POST', '/api/db/agenda', { tipo: 'prazo', titulo: 'Prazo só na agenda', processo: NC, cliente: 'Fulano da Agenda', data: em(5), situacao: 'afazer', concluido: false });
await proc(ND, { partes: 'Sem Nome Conhecido x Banco', clienteIds: [] });
await caso('id', { cliente: 'Cliente Um', nomeAcao: 'Ação D', numeroProcesso: ND, clienteIds: ['cl1'] });                         // sugestão pelos atos
await proc(NE, { partes: 'Cliente Dois x Banco', clienteIds: [] });                                                          // sugestão pelo nome
await proc(NF, { partes: 'Zé Ninguém x Empresa', clienteIds: [] });                                                          // sem sugestão

const br = await chromium.launch(), page = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage(), erros = [];
page.on('pageerror', (e) => erros.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
await page.route(/fonts\./, (x) => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(4500);
const shot = async (n) => { if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'lg-' + n + '.png', fullPage: true }); };
const C = () => page.locator('#overlayLgRevC').textContent();

console.log('\n— aviso na aba Processos');
await page.click('[data-tab="processos"]'); await page.waitForTimeout(1200);
const av = await page.locator('#prMdResumo').innerText();
check(/2 sem processo cadastrado/.test(av) && /3 sem cliente/.test(av) && /1 com cliente diferente/.test(av), 'o aviso conta: 2 sem processo, 3 sem cliente, 1 com cliente diferente (' + av.replace(/\n/g, ' ').slice(0, 160) + ')');
await page.click('[data-lgr="abrir"]'); await page.waitForSelector('#overlayLgRev.show .es-it'); await shot('rev-sem');
let t = await C();
check(t.includes(NB) && t.includes(NC) && t.includes('Inicial, Acordo') && t.includes('Agenda'), 'aba "Sem processo": o número que está em Inicial e Acordo e o que só está na Agenda');

console.log('\n— cadastrar os processos que faltam');
await page.click('[data-lgr="todos"]'); await page.click('[data-lgr="cadastrar"]'); await page.waitForTimeout(1500);
const ps = await docs('processos'), pb = ps.find((d) => d.numero === NB), pc = ps.find((d) => d.numero === NC);
check(pb && pb.clienteIds.join() === 'cl1' && pb.advogados && pb.advogados[0].oab === '60456/GO' && pb.derivado === true, 'o processo do número da Inicial/Acordo nasce com o cliente e os advogados dos atos');
check(pc && pc.partes === 'Fulano da Agenda' && pc.clienteIds.length === 0, 'o processo que só estava na Agenda nasce com o nome que a Agenda tinha (e cai em "sem cliente")');
check((await C()).includes('Todos os números têm processo cadastrado'), 'a aba esvazia');

console.log('\n— processos sem cliente');
await page.click('[data-lgr="aba"][data-k="semcli"]'); await page.waitForTimeout(300); await shot('rev-semcli');
t = await C();
check(t.includes('cliente dos atos deste processo') && t.includes('nome parecido com as partes') && /Zé Ninguém/.test(t), 'mostra a sugestão pelos atos, a sugestão pelo nome e o que fica sem sugestão');
check(await page.locator('#overlayLgRevC input[data-lgr="marca"]:disabled').count() === 2, 'sem sugestão não dá para marcar (só abrir): Zé Ninguém e o processo da Agenda');
await page.click('[data-lgr="todos"]'); await page.click('[data-lgr="vincular"]'); await page.waitForTimeout(1500);
const ps2 = await docs('processos'), pd = ps2.find((d) => d.numero === ND), pe = ps2.find((d) => d.numero === NE), pf = ps2.find((d) => d.numero === NF);
check(pd.clienteIds.join() === 'cl1' && pe.clienteIds.join() === 'cl2' && pf.clienteIds.length === 0, 'vincula os que têm sugestão e deixa o resto');

console.log('\n— cliente diferente entre ato e processo');
await page.click('[data-lgr="aba"][data-k="dif"]'); await page.waitForTimeout(300); await shot('rev-dif');
t = await C();
check(t.includes('Cliente no inicial') && t.includes('Cliente Dois') && t.includes('Cliente Um'), 'mostra o cliente de cada lado');
await page.click('[data-lgr="ajusta-proc"]'); await page.waitForTimeout(1200);
check((await docs('processos')).find((d) => d.numero === NA).clienteIds.join() === 'cl2' && (await C()).includes('Nenhuma divergência'), '"Usar o do ato no processo" acerta o processo e a divergência some');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
