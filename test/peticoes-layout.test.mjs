// Testa o novo cabeçalho e os cartões da aba Petições (Kanban e Lista).
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --port 8802
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const dia = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10), agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.1' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
const get = async (col, id) => (await (await api('GET', col)).json()).docs.find(d => d.id === id)?.data;
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('PUT', 'config/backup', { ultimoEm: agora });
const caso = (id, cliente, origem, ps) => api('PUT', 'casos/' + id, { tipo: 'inicial', cliente, nomeAcao: 'Cobrança', origem, prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: ps.reduce((t, p) => t + p.valor, 0), parcelas: ps.map((p, i) => ({ numero: i + 1, valor: p.valor, data: p.data, pago: !!p.pago, ...(p.pago ? { dataRecebimento: dia(-2) } : {}) })), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await caso('c1', 'Joana Murilo', 'murilo', [{ valor: 1000, data: dia(-40), pago: true }, { valor: 1000, data: dia(-10) }, { valor: 1000, data: dia(20) }]);
await caso('c3', 'Ana Própria', 'proprio', [{ valor: 700, data: dia(15) }, { valor: 700, data: dia(45) }]);
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2800);
await page.evaluate(() => document.querySelector('[data-tab="peticoes"]').click()); await page.waitForTimeout(800);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
let tx = await t('#mdPainel-peticoes');   // desde a etapa 2.2 os números ficam na sub-aba Resumo
check(/PENDENTE A RECEBER/i.test(tx) && /R\$\s*3\.400,00/.test(tx), 'número principal: pendente a receber (3.400)');
check(/em \w{3}\/\d\d/.test(tx) && /Honorários contratados/i.test(tx) && /Vencido/i.test(tx), 'selo do recebido no mês e os indicadores de honorários e vencido');
check(await page.evaluate(() => document.querySelectorAll('#mdPainel-peticoes .md-kpi .ct-ic svg').length) === 4, 'os indicadores têm ícone');
check(/R\$\s*1\.000,00/.test(await t('#mdPainel-peticoes .md-kpi:nth-child(3)')), 'vencido = parcela em atraso (R$ 1.000)');
await page.click('#mdAbas-peticoes [data-md-aba="quadro"]'); await page.waitForTimeout(500);
check(await page.evaluate(() => document.querySelectorAll('.kanban-card .kc-top .ct-ic').length) === 2, 'cartões do Kanban com ícone');
const k1 = await t('[data-pcard="c1"]');
check(/Murilo/.test(k1) && /parcela vencida/.test(k1) && /1 de 3 parcelas recebidas/.test(k1), 'cartão mostra origem, selo de atraso e progresso das parcelas');
check(await page.evaluate(() => !!document.querySelector('[data-pcard="c1"] .kc-barra i') && parseInt(document.querySelector('[data-pcard="c1"] .kc-barra i').style.width) === 33), 'barra de parcelas em 33%');
check(await page.evaluate(() => !!document.querySelector('.kanban-col-head .ct-ic') && !!document.querySelector('.kanban-col-head .fv-chip')), 'coluna com ícone e contador');
await page.click('[data-pcard="c3"] [data-p-mover]'); await page.waitForTimeout(1200);
check((await get('casos', 'c3')).status !== 'pendente', '"Avançar" continua movendo o caso de fase');
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#bodyPeticoes button, #headPeticoes button')).find(b => /^Lista$/.test(b.innerText.trim())); b && b.click(); }); await page.waitForTimeout(600);
check(await page.evaluate(() => document.querySelectorAll('#listPeticoes .card .cliente-cell .ct-ic, .list .card .cliente-cell .ct-ic').length >= 2) || await page.evaluate(() => document.querySelectorAll('.cliente-cell .ct-ic').length >= 2), 'na Lista, cada caso tem ícone');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
