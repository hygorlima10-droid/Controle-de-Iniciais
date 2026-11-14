// Testa o novo cabeçalho e os cartões da aba Acordos.
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --port 8802
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const dia = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10), agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.1' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('PUT', 'config/backup', { ultimoEm: agora });
const ac = (id, partes, ps, extra = {}) => api('PUT', 'termosAcordo/' + id, { partes, numeroProcesso: '123', origem: 'murilo', status: 'pendente', valorTotal: 4000, valorMeuHonorario: ps.reduce((t, p) => t + p.valor, 0), parcelas: ps.map((p, i) => ({ numero: i + 1, valor: p.valor, data: p.data, pago: !!p.pago, ...(p.pago ? { dataRecebimento: dia(-3) } : {}) })), data: ps[0].data, clienteIds: [], criadoEm: agora, atualizadoEm: agora, ...extra });
await ac('a1', 'Complem x Maurício', [{ valor: 1000, data: dia(-20), pago: true }, { valor: 1000, data: dia(-5) }]);
await ac('a2', 'Wancley x Rener', [{ valor: 500, data: dia(3) }, { valor: 500, data: dia(33) }, { valor: 500, data: dia(63) }]);
await api('PUT', 'termosAcordo/a3', { partes: 'Único x Pagamento', numeroProcesso: '9', origem: 'proprio', status: 'pendente', valorTotal: 900, valorMeuHonorario: 900, data: dia(10), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2800);
await page.evaluate(() => document.querySelector('[data-tab="acordos"]').click()); await page.waitForTimeout(800);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const tx = await t('#mdPainel-acordos');   // desde a etapa 2.2 os números ficam na sub-aba Resumo
check(/PENDENTE A RECEBER/i.test(tx) && /R\$\s*3\.400,00/.test(tx), 'número principal: pendente a receber (1.000 + 1.500 + 900 = 3.400)');
check(await page.evaluate(() => document.querySelectorAll('#mdPainel-acordos .md-kpi .ct-ic svg').length) === 4 && /Vencido/i.test(tx) && /Meus honorários/i.test(tx), 'indicadores com ícone (honorários e vencido)');
check(/R\$\s*1\.000,00/.test(await t('#mdPainel-acordos .md-kpi:nth-child(3)')), 'vencido = parcela atrasada (R$ 1.000)');
await page.click('#mdAbas-acordos [data-md-aba="lista"]'); await page.waitForTimeout(500);
check(await page.evaluate(() => document.querySelectorAll('#listAcordos .cliente-cell .ct-ic').length) === 3, 'cada termo tem ícone');
const c1 = await t('[data-acordo-card="a1"]');
check(/Parcela 2\/2/.test(c1) && /atrasada desde/.test(c1) && /1 de 2 parcelas recebidas/.test(c1), 'termo com parcelas: selo da próxima parcela (atrasada) e progresso');
check(/Parcela 1\/3/.test(await t('[data-acordo-card="a2"]')) && /0 de 3/.test(await t('[data-acordo-card="a2"]')), 'outro termo: próxima parcela e 0 de 3');
check(/Vence/.test(await t('[data-acordo-card="a3"]')) && !(await page.evaluate(() => !!document.querySelector('[data-acordo-card="a3"] .kc-barra'))), 'termo sem parcelas: só o selo de vencimento, sem barra');
check(await page.evaluate(() => !!document.querySelector('[data-acordo-card="a1"] .kc-barra i') && parseInt(document.querySelector('[data-acordo-card="a1"] .kc-barra i').style.width) === 50), 'barra em 50%');
await page.click('[data-acordo-toggle="a2"]'); await page.waitForTimeout(500);
check(await page.evaluate(() => !!document.querySelector('[data-acordo-card="a2"] .card-detail [data-baixa-doc]')), 'abrir o termo continua mostrando "Registrar pagamento"');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
