// Fase 3, etapa 3.5: Finanças > Orçamento por categoria: limites, alertas de 80% e 100%, aviso do que ainda vai vencer,
// edição do limite (vale nos meses seguintes), categoria × mês e alerta em "Precisa de atenção" na Visão geral.
// Use: node test/rodar.mjs orcamento
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3), hojeISO = hoje.toISOString().slice(0, 10);
const m0 = hojeISO.slice(0, 7), mAnt = (() => { const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.53' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('DELETE', 'config/orcamento'); await api('PUT', 'config/backup', { ultimoEm: agora }); await api('PUT', 'config/importacaoAuto', { ativo: false, desde: agora });
await api('PUT', 'saldos/pj', { coluna: 'pj', saldoAtual: 9000, atualizadoEm: agora, historico: [{ valor: 9000, data: agora }] });
const desp = (id, nome, v, cat, pago, col = 'pj') => api('PUT', 'despesas/' + id, { nome, coluna: col, tipo: 'unica', valor: v, data: m0 + '-20', mesReferencia: m0, categoria: cat, pago, ...(pago ? { dataPagamento: hojeISO } : {}), criadoEm: agora });
await desp('e1', 'Aluguel do escritório', 2480, 'estrutura', true); await desp('i1', 'Imposto do mês', 1500, 'impostos', true); await desp('p1', 'Salário', 1150, 'pessoal', true);
await desp('s1', 'Cartão de crédito', 2890, 'sistemas', true, 'pf'); await desp('o1', 'Seguro a vencer', 900, 'estrutura', false);
await api('PUT', 'extratos/dd_' + m0 + '_x', { tipo: 'diaadia', mes: m0, conta: 'x', coluna: 'pf', cats: { 'Alimentação': { v: 420, n: 2 } }, linhas: [{ id: 'l1', d: m0 + '-03', t: 'Mercado', v: 300, c: 'Alimentação', h: 'a' }, { id: 'l2', d: m0 + '-04', t: 'Padaria', v: 120, c: 'Alimentação', h: 'b' }], atualizadoEm: agora });
await api('PUT', 'config/orcamento', { limites: { Estrutura: { [mAnt]: 3000 }, Impostos: { [m0]: 1500 }, Pessoal: { [m0]: 2000 }, Sistemas: { [m0]: 2500 } } });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const txt = () => page.evaluate(() => document.getElementById('finOrcamento').innerText);
await page.evaluate(() => document.querySelector('#drawer [data-tab="financeiro"][data-fin="resumo"]').click()); await page.waitForTimeout(800);
// 1) a sub-aba existe, antes de Análises
check(await page.evaluate(() => { const l = Array.from(document.querySelectorAll('#headFinanceiro button')).map(b => b.innerText.replace(/\s+/g, ' ').trim()); return l.join('|'); }) === 'Visão geral|Divisão do mês|PJ|PF|Patrimônio|Orçamento|Análises', 'sub-abas de Finanças: ... Patrimônio | Orçamento | Análises');
// 2) alerta na Visão geral
let vg = await page.evaluate(() => document.getElementById('finResumo').innerText);
check(/Orçamento: Sistemas estourou/.test(vg) && /Orçamento: Impostos chegou no limite/.test(vg) && /Passaram de 80% do limite: Estrutura/.test(vg), '"Precisa de atenção" na Visão geral avisa: Sistemas estourou, Impostos no limite, Estrutura passou de 80%');
await page.click('[data-mf-aba="orcamento"]'); await page.waitForTimeout(800);
let t = await txt();
// 3) números
check(/ORÇADO NO MÊS[\s\S]*R\$\s*9\.000,00[\s\S]*4 categorias com limite/i.test(t), 'orçado no mês: R$ 9.000 em 4 categorias (3.000 + 1.500 + 2.000 + 2.500; o limite de Estrutura veio do mês anterior)');
check(/GASTO ATÉ AGORA[\s\S]*R\$\s*8\.020,00[\s\S]*89%/i.test(t), 'gasto até agora: R$ 8.020 (2.480 + 1.500 + 1.150 + 2.890), 89% do orçado; os R$ 900 ainda a vencer não contam');
check(/ESTOURADAS\s*\n?\s*2/i.test(t) && /Sistemas e Impostos|Impostos e Sistemas/.test(t), 'estouradas: 2 (Sistemas e Impostos)');
check(/PASSARAM DE 80%\s*\n?\s*1/i.test(t), 'passaram de 80%: 1 (Estrutura)');
check(/Estourou em R\$\s*390,00/.test(t) && /Limite atingido/.test(t) && /Já passou de 80%: restam R\$\s*520,00/.test(t), 'mensagens: "Estourou em R$ 390", "Limite atingido" e "Já passou de 80%: restam R$ 520"');
check(/Com o que ainda vai vencer/.test(t) === false, 'Estrutura (passou de 80%) mostra só a mensagem de 80%, sem o aviso do que vai vencer');
// 4) cores/ordem: pior primeiro
const ordem = await page.evaluate(() => Array.from(document.querySelectorAll('#finOrcamento .orc-row .orc-nm')).map(e => e.innerText));
check(ordem.slice(0, 4).join('|') === 'Sistemas|Impostos|Estrutura|Pessoal', 'linhas com limite em ordem do mais perto/acima do limite: ' + ordem.join(', '));
check(/Dia a dia · Alimentação/.test(t) && /sem limite/.test(t) && /definir/.test(t), 'categoria sem limite (Dia a dia · Alimentação) aparece com "definir ›"');
// 5) abrir uma linha mostra os lançamentos
await page.evaluate(() => Array.from(document.querySelectorAll('#finOrcamento .orc-row')).find(d => /Sistemas/.test(d.innerText)).querySelector('summary').click()); await page.waitForTimeout(300);
check(/Cartão de crédito/.test(await page.evaluate(() => Array.from(document.querySelectorAll('#finOrcamento .orc-row')).find(d => /Sistemas/.test(d.innerText)).innerText)), 'tocar numa linha abre os lançamentos da categoria');
// 6) definir limite para a categoria sem limite: vale no mês e nos seguintes
await page.evaluate(() => Array.from(document.querySelectorAll('#finOrcamento .orc-row')).find(d => /Dia a dia · Alimentação/.test(d.innerText)).querySelector('summary').click()); await page.waitForTimeout(300);
await page.evaluate(() => { const d = Array.from(document.querySelectorAll('#finOrcamento .orc-row')).find(x => /Dia a dia · Alimentação/.test(x.innerText)); d.querySelector('.orc-ed input').value = '500'; d.querySelector('[data-orc-salvar]').click(); }); await page.waitForTimeout(1200);
t = await txt();
check(/Alimentação/.test(t) && /de R\$\s*500/.test(t) && /Já passou de 80%: restam R\$\s*80,00/.test(t), 'definir limite de R$ 500 em Alimentação: 420 de 500 (84%), restam R$ 80');
const lista = await (await api('GET', 'config')).json(); const orc = ((lista.docs || []).find(d => d.id === 'orcamento') || {}).data;
check(orc && orc.limites['Dia a dia · Alimentação'] && orc.limites['Dia a dia · Alimentação'][m0] === 500, 'o limite ficou guardado em config/orcamento a partir deste mês');
// 6b) editar um limite que já existe: o campo vem preenchido (2.500) e dá para salvar outro valor
await page.evaluate(() => { const d = Array.from(document.querySelectorAll('#finOrcamento .orc-row')).find(x => /Sistemas/.test(x.innerText)); d.open = true; const i = d.querySelector('.orc-ed input'); i.value = '3.000,00'; d.querySelector('[data-orc-salvar]').click(); }); await page.waitForTimeout(1200);
check(/de R\$\s*3\.000/.test(await txt()) && /Sistemas[\s\S]{0,80}96%/.test(await txt()), 'editar um limite existente (2.500 → 3.000,00): Sistemas passa a 96% e deixa de estar estourada');
// 7) tirar o limite
await page.evaluate(() => { const d = Array.from(document.querySelectorAll('#finOrcamento .orc-row')).find(x => /Dia a dia · Alimentação/.test(x.innerText)); d.open = true; d.querySelector('[data-orc-sem]').click(); }); await page.waitForTimeout(1000);
check(!/de R\$\s*500/.test(await txt()), 'tirar o limite devolve a categoria para "sem limite"');
// 8) categoria × mês
check(await page.evaluate(() => !!document.querySelector('#finOrcamento select[data-orc-cat]') && !!document.querySelector('#finOrcamento svg.an-svg')) && /Categoria × mês/.test(await txt()), 'tem o gráfico Categoria × mês com seletor de categoria');
await page.selectOption('#finOrcamento select[data-orc-cat]', 'Impostos'); await page.waitForTimeout(500);
check(await page.evaluate(() => document.querySelector('#finOrcamento select[data-orc-cat]').value) === 'Impostos', 'trocar a categoria do gráfico funciona');
check(/O orçamento nunca altera lançamentos/.test(await txt()), 'o "Como funciona" diz que o orçamento nunca altera lançamentos');
// 9) nada foi alterado nos lançamentos
const dsp = (await (await api('GET', 'despesas')).json()).docs.length;
check(dsp === 5, 'as despesas continuam as mesmas (5): o orçamento não mexe em lançamentos');
if (process.env.SHOT) { await page.screenshot({ path: process.env.SHOT + 'orcamento.png', fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500); await page.screenshot({ path: process.env.SHOT + 'orcamento-celular.png', fullPage: true }); }
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
