// Testa Processos › Análises: números de destaque, andamento, área, procedimento, resultado, novos por mês, carga de prazos,
// filtros, os campos Área e Resultado (ao arquivar e na ficha) e o relatório.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const iso = n => dia(n) + 'T12:00:00.000Z';
const N = k => '60' + String(k).padStart(5, '0') + '-10.2026.8.09.0107', NT = '0000123-45.2026.5.18.0001';
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.36' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'config', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('PUT', '/api/db/clientes/cl1', { nome: 'Cliente Um', pagador: 'cliente', criadoEm: agora });
const P = (o) => f('POST', '/api/db/processos', Object.assign({ honorarios: 'sem', arquivado: false, origem: 'manual', clienteIds: ['cl1'] }, o));
await P({ numero: N(1), partes: 'Alfa x Beta', classe: 'Procedimento comum', criadoEm: iso(-10) });
await P({ numero: N(2), partes: 'Gama x Delta', classe: 'Cumprimento de sentença', assunto: 'Cédula rural', criadoEm: iso(-200) });
await P({ numero: N(3), partes: 'Eta x Teta', classe: 'Execução de título extrajudicial', clienteIds: [], criadoEm: iso(-100) });
await P({ numero: NT, partes: 'Vitor x Empresa', classe: 'Reclamação trabalhista', criadoEm: iso(-20) });
const ARQ = (k, res) => P({ numero: N(k), partes: 'Arq ' + k, classe: 'Procedimento comum', criadoEm: iso(-150), arquivado: true, arquivadoEm: iso(-30), dataArquivo: dia(-30), motivoArquivo: 'Trânsito em julgado / extinto', resultado: res, resultadoEm: res ? iso(-30) : '' });
await ARQ(4, 'procedente'); await ARQ(5, 'acordo'); await ARQ(6, 'improcedente'); await ARQ(7, '');
await f('PUT', '/api/db/casos/c1', { tipo: 'inicial', cliente: 'Alfa', nomeAcao: 'Cobrança', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 500, avista: { data: dia(20), pago: false }, numeroProcesso: N(1), clienteIds: ['cl1'], criadoEm: iso(-10), atualizadoEm: agora });
const A = (o) => f('POST', '/api/db/agenda', Object.assign({ tipo: 'prazo', situacao: 'afazer', concluido: false, avisos: [], criadoEm: agora }, o));
await A({ titulo: 'Prazo aberto', processo: N(2), data: dia(10) });
await A({ titulo: 'Protocolo A', data: dia(-20), situacao: 'feito', concluido: true, protocoladoEm: dia(-22) });
await A({ titulo: 'Protocolo B', data: dia(-15), situacao: 'feito', concluido: true, protocoladoEm: dia(-15) });
await A({ titulo: 'Protocolo C', data: dia(-10), situacao: 'feito', concluido: true, protocoladoEm: dia(-8) });
await A({ tipo: 'audiencia', titulo: 'Audiência', processo: N(1), data: dia(12), hora: '10:00' });

const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(1000);
check(await page.evaluate(() => document.querySelectorAll('#prSub [data-pr="sub"]').length) === 3 && /Lista/.test(await t('#prSub')) && /Análises/.test(await t('#prSub')), 'a aba Processos tem as sub-abas Resumo | Lista | Análises');
await page.click('[data-pr="sub"][data-v="analises"]'); await page.waitForTimeout(600);
const an = await t('#prAnalises');
check(await page.evaluate(() => document.getElementById('prListaBloco').style.display === 'none'), 'em Análises, a lista some');
const kpi = k => page.evaluate(x => { const e = Array.from(document.querySelectorAll('.pan-kpi')).find(y => y.innerText.includes(x)); return e ? e.innerText.replace(/\n+/g, ' | ') : ''; }, k);
check(/Processos em andamento \| 4 \| \+2 nos últimos 30 dias/.test(await kpi('Processos em andamento')), 'destaque 1: 4 em andamento, +2 nos últimos 30 dias: ' + await kpi('Processos em andamento'));
check(/Êxito nos encerrados \| 67% \| 3 de 4 com resultado/.test(await kpi('Êxito')), 'destaque 2: êxito 67% (2 de 3), 3 de 4 com resultado: ' + await kpi('Êxito'));
check(/Peças no prazo \| 67% \| protocola 1 dia\(s\) antes do fatal/.test(await kpi('Peças no prazo')), 'destaque 3: peças no prazo 67%, média de antecedência: ' + await kpi('Peças no prazo'));
check(/Honorários a receber \| R\$\s?500,00 \| 1 processo/.test(await kpi('Honorários')), 'destaque 4: honorários a receber R$ 500,00 em 1 processo: ' + await kpi('Honorários'));
const leg = await page.evaluate(() => Array.from(document.querySelectorAll('.pan-leg')).map(x => x.innerText.replace(/\n/g, ' ')).join(' || '));
check(/Em andamento 1/.test(leg) && /Com prazo aberto 2/.test(leg) && /Parados há 60\+ dias 1/.test(leg) && /Arquivados no período 4/.test(leg), 'andamento: 1 em andamento, 2 com prazo ou audiência aberta, 1 parado, 4 arquivados: ' + leg.slice(0, 160));
const barras = tit => page.evaluate(x => { const c = Array.from(document.querySelectorAll('.pan-card')).find(y => y.innerText.toLowerCase().includes(x.toLowerCase())); return c ? Array.from(c.querySelectorAll('.pan-bar')).map(b => b.innerText.replace(/\n+/g, ':')) : []; }, tit);
const ba = await barras('Processos por área');
check(ba.includes('Cível:2') && ba.includes('Bancário / rural:1') && ba.includes('Trabalhista:1'), 'por área: Cível 2, Bancário/rural 1, Trabalhista 1 (sugeridas pelo tribunal e pela classe): ' + ba.join(' | '));
const bp = await barras('Por procedimento');
check(bp.includes('Procedimento comum:1') && bp.includes('Cumprimento de sentença:1') && bp.includes('Execução:1') && bp.includes('Outros:1'), 'por procedimento: ' + bp.join(' | '));
const bres = await barras('Resultado dos encerrados');
check(bres.includes('Procedente:1') && bres.includes('Acordo:1') && bres.includes('Improcedente:1') && !bres.some(x => /Desistência/.test(x)) && /Êxito 2 \(67%\)/.test(an), 'resultado dos encerrados, com êxito 2 (67%) e sem inventar categorias vazias');
check(/1 arquivado\(s\) sem resultado informado/.test(an), 'avisa quantos arquivados estão sem resultado');
check(await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.pan-card')).find(y => /novos por mês/i.test(y.innerText)); return c && c.querySelectorAll('.pan-col').length === 12; }), 'processos novos por mês: 12 colunas');
const carga = await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.pan-card')).find(y => /Carga de prazos/i.test(y.innerText)); return { cols: c.querySelectorAll('.pan-col').length, soma: Array.from(c.querySelectorAll('.pan-col i')).reduce((s, i) => s + (Number(i.innerText) || 0), 0), txt: c.innerText }; });
check(carga.cols === 8 && carga.soma === 1 && /mais 1 audiência/.test(carga.txt), 'carga de prazos: 8 semanas, 1 prazo em aberto e 1 audiência citada');
check(/parados há mais de 60 dias\s*\n?\s*1/i.test(an.replace(/\n+/g, ' ')) || /Processos parados há mais de 60 dias/.test(an), 'bloco “quem pede atenção” aparece');
if (process.env.SHOT){ await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: process.env.SHOT + 'an-1.png' }); await page.evaluate(() => window.scrollTo(0, 780)); await page.waitForTimeout(200); await page.screenshot({ path: process.env.SHOT + 'an-2.png' }); await page.evaluate(() => window.scrollTo(0, 1600)); await page.waitForTimeout(200); await page.screenshot({ path: process.env.SHOT + 'an-3.png' }); await page.evaluate(() => window.scrollTo(0, 0)); }
// filtros
await page.selectOption('#pan_area', 'Trabalhista'); await page.waitForTimeout(400);
check(/Processos em andamento \| 1/.test(await kpi('Processos em andamento')), 'filtro por área: Trabalhista mostra 1 em andamento');
await page.selectOption('#pan_area', ''); await page.waitForTimeout(300);
await page.click('[data-pan="periodo"][data-v="ano"]'); await page.waitForTimeout(300);
check(await page.evaluate(() => document.querySelector('#panPer .active').innerText) === 'Este ano', 'o período pode ser trocado');
await page.click('[data-pan="periodo"][data-v="12m"]'); await page.waitForTimeout(300);
// relatório
await page.click('[data-pan="rel"]'); await page.waitForTimeout(500);
const rel = await t('#rptFolha');
check(/Relatório das análises de processos/.test(rel) && /Números de destaque/.test(rel) && /67%/.test(rel) && /Carga de prazos/.test(rel) && /Bancário \/ rural/.test(rel), 'o relatório em PDF traz os mesmos números');
await page.click('#rptX'); await page.waitForTimeout(300);
// campos Área e Resultado
await page.click('[data-pr="sub"][data-v="lista"]'); await page.waitForTimeout(500);
await page.click('[data-pr="filtro"][data-v="todos"]'); await page.waitForTimeout(400);
await page.click('[data-pr="abrir"][data-n="' + N(4).replace(/\D/g, '') + '"]'); await page.waitForTimeout(600);
check(await page.evaluate(() => document.getElementById('pr_res').value) === 'procedente' && await page.evaluate(() => /Automática \(/.test(document.getElementById('pr_area').innerText)), 'a ficha do processo arquivado mostra o Resultado e a Área (automática, com a sugestão)');
await page.selectOption('#pr_res', 'parcial'); await page.selectOption('#pr_area', 'Consumidor'); await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
const p4 = (await docs('processos')).filter(p => p.numero === N(4))[0];
check(p4.resultado === 'parcial' && p4.area === 'Consumidor' && p4.resultadoEm, 'mudar o resultado e a área na ficha grava no processo');
// arquivar já com resultado
await page.click('[data-pr="filtro"][data-v="andamento"]'); await page.waitForTimeout(300);
await page.click('[data-pr="arquivar"][data-n="' + N(1).replace(/\D/g, '') + '"]'); await page.waitForTimeout(500);
check(await page.evaluate(() => /Resultado/.test(document.getElementById('praCorpo').innerText)), 'o diálogo de arquivar pergunta o Resultado');
await page.selectOption('#pra_res', 'acordo'); await page.click('#praOk'); await page.waitForTimeout(1500);
const p1 = (await docs('processos')).filter(p => p.numero === N(1))[0];
check(p1 && p1.arquivado && p1.resultado === 'acordo', 'arquivar já grava o resultado (acordo)');
// reabrir limpa
await page.click('[data-pr="filtro"][data-v="todos"]'); await page.waitForTimeout(300);
await page.click('[data-pr="reabrir"][data-n="' + N(1).replace(/\D/g, '') + '"]'); await page.waitForTimeout(1500);
check(!(await docs('processos')).filter(p => p.numero === N(1))[0].resultado, 'reabrir o processo limpa o resultado');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
for (const col of ['casos', 'clientes', 'agenda', 'processos', 'config']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
