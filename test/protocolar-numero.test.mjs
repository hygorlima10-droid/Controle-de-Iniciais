// Testa "protocolar pede o número" (correções 1 e 2 da análise de interligação): ao mover uma Inicial para Protocolado o app pede o número do processo,
// liga a um processo já cadastrado ou cadastra um novo (levando cliente e advogados); dá para protocolar sem o número ou cancelar.
// Grupo principal (porta 8812):  node test/rodar.mjs protocolar-numero
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.31' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov', 'prazosPub', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
const EXISTE = '5400100-10.2026.8.09.0107', NOVO = '5400200-20.2026.8.09.0107';
await f('PUT', '/api/db/clientes/cl1', { nome: 'Cliente Um', pagador: 'cliente', criadoEm: agora });
await f('POST', '/api/db/processos', { numero: EXISTE, partes: 'Um x Banco', clienteIds: ['cl1'], honorarios: 'sem', arquivado: false, origem: 'publicacao', criadoEm: agora });
const caso = (id, o) => f('PUT', '/api/db/casos/' + id, Object.assign({ tipo: 'inicial', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 100, criadoEm: agora }, o));
await caso('p1', { cliente: 'Cliente Um', nomeAcao: 'Ação A', clienteIds: ['cl1'] });
await caso('p2', { cliente: 'Cliente Dois', nomeAcao: 'Ação B', clienteIds: ['cl1'], advogados: [{ oab: '60456/GO', nome: 'Hygor' }] });
await caso('p3', { cliente: 'Cliente Três', nomeAcao: 'Ação C' });
await caso('p4', { cliente: 'Cliente Quatro', nomeAcao: 'Ação D' });
await caso('p5', { cliente: 'Extra', nomeAcao: 'Notificação', tipo: 'extrajudicial' });
await caso('p6', { cliente: 'Já com número', nomeAcao: 'Ação E', numeroProcesso: EXISTE });

const br = await chromium.launch(), page = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage(), erros = [];
page.on('pageerror', (e) => erros.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
await page.route(/fonts\./, (x) => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(4000);
const mover = async (id) => { await page.evaluate((id) => window.__horusTeste.mudarStatusCaso(id, 'protocolado'), id); await page.waitForTimeout(400); };
const aberta = () => page.locator('#overlayLgProt.show').count().then((n) => n === 1);
const caso1 = async (id) => (await docs('casos')).find((d) => d.id === id);
const shot = async (n) => { if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'lg-' + n + '.png' }); };

console.log('\n— quando pergunta');
await mover('p5'); check(!(await aberta()) && (await caso1('p5')).status === 'protocolado', 'extrajudicial (sem processo) protocola direto, sem perguntar');
await mover('p6'); check(!(await aberta()) && (await caso1('p6')).status === 'protocolado', 'Inicial que já tem número protocola direto');

console.log('\n— ligar a um processo já cadastrado');
await mover('p1'); check(await aberta() && (await caso1('p1')).status === 'pendente', 'Inicial sem número: abre a pergunta e ainda não mexe no status');
await page.click('[data-lgp="ok"]'); check((await page.locator('#lgErro').innerText()).includes('Informe o número'), 'sem número e sem escolher "sem o número agora": avisa');
await page.fill('#lgNum', EXISTE.replace(/\D/g, '')); await page.waitForTimeout(200); await shot('existente');
check((await page.locator('#lgCadBox').innerText()).includes('já está cadastrado') && await page.locator('#lgCad').count() === 0, 'número que já tem processo: mostra que vai ligar, sem oferecer cadastrar de novo');
await page.click('[data-lgp="ok"]'); await page.waitForTimeout(800);
let p1 = await caso1('p1');
check(p1.status === 'protocolado' && p1.numeroProcesso === EXISTE && (await docs('processos')).length === 1, 'salva o número já formatado, protocola e não duplica o processo');

console.log('\n— cadastrar o processo a partir da Inicial');
await mover('p2'); await page.fill('#lgNum', NOVO); await page.waitForTimeout(200); await shot('novo');
check(await page.locator('#lgCad').isChecked(), 'número novo: oferece cadastrar o processo (marcado)');
await page.click('[data-lgp="ok"]'); await page.waitForTimeout(1000);
const pr = (await docs('processos')).find((d) => d.numero === NOVO), p2 = await caso1('p2');
check(p2.status === 'protocolado' && p2.numeroProcesso === NOVO && pr && pr.clienteIds.join() === 'cl1' && pr.advogados && pr.advogados[0].oab === '60456/GO' && pr.partes === 'Cliente Dois', 'protocola e cadastra o processo levando cliente(s) e advogados da Inicial');
await mover('p3'); await page.fill('#lgNum', '5400300-30.2026.8.09.0107'); await page.waitForTimeout(150); await page.uncheck('#lgCad'); await page.click('[data-lgp="ok"]'); await page.waitForTimeout(900);
check((await caso1('p3')).numeroProcesso === '5400300-30.2026.8.09.0107' && !(await docs('processos')).some((d) => d.numero === '5400300-30.2026.8.09.0107'), 'desmarcando "cadastrar o processo", só o número é salvo');

console.log('\n— protocolar sem o número e cancelar');
await mover('p4'); await page.click('[data-lgp="cancela"]'); await page.waitForTimeout(300);
check(!(await aberta()) && (await caso1('p4')).status === 'pendente', 'cancelar não protocola');
await mover('p4'); await page.click('[data-lgp="sem"]'); await page.waitForTimeout(600);
check((await caso1('p4')).status === 'protocolado' && !(await caso1('p4')).numeroProcesso, '"Protocolar sem o número agora" protocola e deixa o número para depois');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
