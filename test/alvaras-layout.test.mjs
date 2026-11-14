// Testa o novo cabeçalho e os cartões da aba Alvarás (Kanban e Lista).
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
const al = (id, partes, fase, prev, v, origem = 'proprio') => api('PUT', 'alvaras/' + id, { numeroProcesso: '9' + id, partes, origem, valorTotalHonorarios: v, valorMeuHonorario: v, status: 'pendente', fase, faseDesde: dia(-3), previsaoLevantamento: prev, clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await al('v1', 'Ciclano x Banco', 'expedido', dia(5), 8000);
await al('v2', 'Beltrano x Estado', 'aguardando', dia(40), 3000, 'murilo');
await al('v3', 'Fulano x Seguradora', 'protocolada', dia(-2), 1500);
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2800);
await page.evaluate(() => document.querySelector('[data-tab="alvaras"]').click()); await page.waitForTimeout(800);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const tx = await t('#mdPainel-alvaras');   // desde a etapa 2.2 os números ficam na sub-aba Resumo
check(/PENDENTE A RECEBER/i.test(tx) && /R\$\s*12\.500,00/.test(tx), 'número principal: pendente a receber (12.500)');
check(await page.evaluate(() => document.querySelectorAll('#mdPainel-alvaras .md-kpi .ct-ic svg').length) === 4, 'indicadores com ícone');
check(/Previsão vencida/i.test(tx) && /R\$\s*1\.500,00/.test(tx), 'com previsão vencida, o 2º cartão avisa em vermelho (1.500)');
await api('PUT', 'alvaras/v3', { numeroProcesso: '9v3', partes: 'Fulano x Seguradora', origem: 'proprio', valorTotalHonorarios: 1500, valorMeuHonorario: 1500, status: 'pendente', fase: 'protocolada', faseDesde: dia(-3), previsaoLevantamento: dia(60), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await page.reload(); await page.waitForTimeout(2800); await page.evaluate(() => document.querySelector('[data-tab="alvaras"]').click()); await page.waitForTimeout(800);
check(/nenhuma previsão vencida/.test(await t('#mdPainel-alvaras .md-kpi:nth-child(3)')) && /R\$\s*8\.000,00/.test(await t('#mdPainel-alvaras .md-kpi:nth-child(4)')), 'sem atraso: nenhuma previsão vencida e "Previsão em 7 dias" = 8.000');
await page.click('#mdAbas-alvaras [data-md-aba="fases"]'); await page.waitForTimeout(500);
check(await page.evaluate(() => document.querySelectorAll('.kanban-card .kc-top .ct-ic').length) === 3, 'cartões do Kanban com ícone');
const k1 = await t('[data-kcard="v1"]');
check(/Previsão \d\d\/\d\d · em 5 dias/.test(k1) && /nesta fase/.test(k1) && /Cliente próprio/.test(k1), 'cartão: selo de previsão (em 5 dias), tempo na fase e origem');
check(await page.evaluate(() => !!document.querySelector('.kanban-col-head .ct-ic') && !!document.querySelector('.kanban-col-head .fv-chip')), 'colunas com ícone e contador');
await page.click('[data-kcard="v2"] .kc-avancar'); await page.waitForTimeout(800);
check(await page.evaluate(() => !!document.querySelector('[data-kcard="v2"] .kc-confirm')) || (await get('alvaras', 'v2')).fase !== 'aguardando', '"Avançar" continua funcionando (pede confirmação ou move)');
if (await page.evaluate(() => !!document.querySelector('[data-kcard="v2"] [data-k-nao]'))) { await page.click('[data-kcard="v2"] [data-k-nao]'); await page.waitForTimeout(300); }
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#bodyAlvaras button, #headAlvaras button')).find(b => /^Lista$/.test(b.innerText.trim())); b && b.click(); }); await page.waitForTimeout(600);
check(await page.evaluate(() => document.querySelectorAll('#listAlvaras .cliente-cell .ct-ic').length >= 3), 'na Lista, cada alvará tem ícone');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
