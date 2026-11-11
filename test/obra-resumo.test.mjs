// Fase 3, etapa 3.8: Construção > Resumo: "Dinheiro na conta da obra" compacto + "Custo estimado final da obra" e
// "Recursos próprios necessários". Etapa estourada entra pelo que foi gasto, sem contar duas vezes.
// Use: node test/rodar.mjs obra-resumo
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hojeISO = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dia = n => new Date(Date.parse(hojeISO + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.56' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('PUT', 'config/backup', { ultimoEm: agora }); await api('PUT', 'config/importacaoAuto', { ativo: false, desde: agora });
await api('PUT', 'config/obra', { nome: 'Casa', criada: true, orcamentoTotal: 450000, criadoEm: agora, financiamento: { status: 'aprovado', valor: 300000, banco: 'Caixa' }, etapas: [{ id: 'e1', nome: 'Terraplanagem', orcado: 20000, status: 'andamento', ordem: 1 }, { id: 'e2', nome: 'Fundação', orcado: 100000, status: 'a_fazer', ordem: 2 }], contratos: [] });
await api('PUT', 'obraMov/a1', { tipo: 'aporte', origem: 'externo', data: dia(-30), valor: 30000, criadoEm: agora });
await api('PUT', 'obraMov/a2', { tipo: 'aporte', origem: 'pf', data: dia(-20), valor: 5000, criadoEm: agora });
await api('PUT', 'obraMov/g1', { tipo: 'gasto', etapaId: 'e1', descricao: 'Máquina', valor: 8000, status: 'pago', data: dia(-10), dataPagamento: dia(-10), criadoEm: agora });
await api('PUT', 'obraMov/g2', { tipo: 'gasto', etapaId: 'e1', descricao: 'Frete', valor: 3000, status: 'apagar', data: dia(-1), vencimento: dia(8), criadoEm: agora });
await api('PUT', 'obraMov/g3', { tipo: 'gasto', etapaId: 'e2', descricao: 'Ferragem estourada', valor: 120000, status: 'apagar', data: dia(-1), vencimento: dia(15), criadoEm: agora });
await api('PUT', 'obraMov/g4', { tipo: 'gasto', descricao: 'Taxa sem etapa', valor: 500, status: 'pago', data: dia(-8), dataPagamento: dia(-8), criadoEm: agora });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { obra: 'resumo' }, per: 6 })); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="obra"]').click()); await page.waitForTimeout(1500);
const painel = () => page.evaluate(() => (document.querySelector('.md-painel[data-mf="obra"]') || {}).innerText || '');
const norm = s => s.replace(/\s+/g, ' ');
let t = norm(await painel());
// 1) card compacto
const alt = await page.evaluate(() => { const e = document.querySelector('.mf-mini'); return e ? Math.round(e.getBoundingClientRect().height) : -1; });
check(alt > 0 && alt < 130 && /DINHEIRO NA CONTA DA OBRA/i.test(t) && /R\$ 26\.500,00/.test(t) && /entradas ›/.test(t), '"Dinheiro na conta da obra" virou um card compacto (' + alt + ' px) com R$ 26.500 (aportes 35.000 − pagos 8.500)');
// 2) custo estimado final
check(/Custo estimado final da obra/i.test(t) && /R\$ 470\.500,00/.test(t), 'custo estimado final: R$ 470.500');
check(/Já pago R\$ 8\.500/.test(t) && /\+ A pagar \(já lançado\) R\$ 123\.000/.test(t) && /Falta gastar nas etapas \(orçado − pago − a pagar\) R\$ 9\.000/.test(t) && /Falta detalhar \(orçamento sem etapa\) R\$ 330\.000/.test(t) && /= Custo estimado final R\$ 470\.500/.test(t), 'a conta: pago 8.500 + a pagar 123.000 + falta nas etapas 9.000 + sem etapa 330.000 (a Fundação estourou: entra pelo que foi lançado, 120.000, sem contar duas vezes)');
check(/\+ 4,6% sobre o orçamento de R\$ 450\.000,00/.test(t) && /Falta gastar ainda: R\$ 462\.000,00/.test(t), 'compara com o orçamento (+ 4,6%) e diz o que falta gastar ainda (470.500 − 8.500)');
// 3) recursos próprios
check(/Recursos próprios necessários/i.test(t) && /R\$ 170\.500,00/.test(t) && /custo estimado R\$ 470\.500,00 − financiamento R\$ 300\.000,00 \(aprovado\)/.test(t), 'recursos próprios necessários: R$ 170.500 = custo 470.500 − financiamento 300.000 (aprovado)');
check(/Já aportado \(PF, PJ e outras origens\) R\$ 35\.000/.test(t) && /Falta colocar R\$ 135\.500/.test(t), 'já aportado 35.000; falta colocar 135.500');
// 4) os 6 indicadores de sempre e a ordem
check(await page.evaluate(() => { const l = Array.from(document.querySelectorAll('.md-painel[data-mf="obra"] .mf-kp6 .md-kpi')).map(e => e.innerText.split('\n')[0].trim().toUpperCase()); return l.join('|') === 'ORÇAMENTO|JÁ PAGO|A PAGAR|AINDA A GASTAR NAS ETAPAS|FINANCIAMENTO|FALTA DETALHAR'; }), 'os 6 indicadores de sempre continuam (orçamento, já pago, a pagar, ainda a gastar, financiamento, falta detalhar)');
check(await page.evaluate(() => { const p = document.querySelector('.md-painel[data-mf="obra"]'), a = p.querySelector('.mf-mini'), b = p.querySelector('.mf-duas'), c = p.querySelector('.mf-kp6'); return !!a && !!b && !!c && (a.compareDocumentPosition(b) & 4) && (b.compareDocumentPosition(c) & 4); }), 'ordem: card compacto, depois os dois cartões novos, depois os indicadores');
check(await page.evaluate(() => { const a = document.querySelector('.mf-custo').getBoundingClientRect(), b = document.querySelector('.mf-proprios').getBoundingClientRect(); return Math.abs(a.top - b.top) < 40 && a.right <= b.left + 2; }), 'no computador os dois cartões novos ficam lado a lado');
// 5) nada foi gravado
const nm = (await (await api('GET', 'obraMov')).json()).docs.length;
check(nm === 6, 'o resumo não gravou nada: continuam 6 movimentos na obra');
if (process.env.SHOT) { await page.screenshot({ path: process.env.SHOT + 'obra-resumo.png', fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500); check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular não rola para o lado'); await page.screenshot({ path: process.env.SHOT + 'obra-resumo-celular.png', fullPage: true }); }
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
