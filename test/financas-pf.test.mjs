// Testa a nova aba PF de Finanças e o alinhamento dos botões do saldo (PJ e PF).
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --port 8802
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const dia = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10), agora = new Date().toISOString();
const mes0 = dia(0).slice(0, 7), num = t => parseFloat(t.replace(/[^\d,-]/g, '').replace(',', '.')) * (/−|-/.test(t) ? (t.trim().startsWith('+') ? 1 : -1) : 1);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.1' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('PUT', 'config/backup', { ultimoEm: agora });
await api('PUT', 'saldos/pj', { coluna: 'pj', saldoAtual: 9000, atualizadoEm: agora, historico: [{ valor: 9000, data: agora }] });
await api('PUT', 'saldos/pf', { coluna: 'pf', saldoAtual: 100, atualizadoEm: agora, historico: [{ valor: 100, data: agora }] });
await api('PUT', 'despesas/f1', { nome: 'Plano de saúde', coluna: 'pf', tipo: 'fixa', valorPadrao: 800, diaVencimento: 27, categoria: 'outros', ativa: true, pagamentos: {}, criadoEm: '2026-01-01T00:00:00.000Z' });
await api('PUT', 'despesas/v1', { nome: 'Combustível', coluna: 'pf', tipo: 'fixa', valorPadrao: null, diaVencimento: 28, categoria: 'outros', ativa: true, pagamentos: {}, criadoEm: '2026-01-01T00:00:00.000Z' });
await api('PUT', 'despesas/u1', { nome: 'Pós-graduação', coluna: 'pf', tipo: 'unica', valor: 259.6, data: dia(3), mesReferencia: mes0, categoria: 'outros', pago: false, criadoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2800);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
for (const f of ['pj', 'pf']) {
  await page.evaluate(f => document.querySelector('[data-tab="financeiro"][data-fin="' + f + '"]').click(), f); await page.waitForTimeout(800);
  const c = await page.evaluate(f => Array.from(document.querySelectorAll('#colunaFinanceiro' + f[0].toUpperCase() + f[1] + ' .fp-acts > *')).map(e => { const b = e.getBoundingClientRect(); return Math.round(b.top + b.height / 2); }), f);
  check(c.length === 3 && Math.max(...c) - Math.min(...c) <= 2, f.toUpperCase() + ': "Atualizar saldo", "Histórico" e "Lançamentos" alinhados na mesma linha');
}
const tx = await t('#colunaFinanceiroPf');
check(/Como o mês fecha/.test(tx) && /Saldo atual/.test(tx) && /Despesas pendentes/.test(tx), 'PF: bloco "Como o mês fecha"');
check(/Sem a transferência/.test(tx) && /Transf\. prevista da PJ/.test(tx) && /entrada futura/.test(tx) && /Fechamento previsto/.test(tx), 'PF: transferência da PJ aparece como entrada futura, separada');
const bs = await page.evaluate(() => Array.from(document.querySelectorAll('#colunaFinanceiroPf .fp-eq b')).map(b => b.innerText));
const v = bs.map(x => { const neg = /^[−-]/.test(x.trim()); const n = parseFloat(x.replace(/[^\d,]/g, '').replace(',', '.')); return neg ? -n : n; });
check(bs.length === 5 && Math.abs(v[0] + v[1] - v[2]) < 0.01 && Math.abs(v[2] + v[3] - v[4]) < 0.01, 'PF: a conta fecha (saldo − pendentes = sem a transferência; + transferência = fechamento): ' + bs.join(' | '));
check(/FIXAS/i.test(tx) && /VARIÁVEIS/i.test(tx) && /AVULSAS/i.test(tx), 'PF: despesas separadas em Fixas, Variáveis e Avulsas');
check(await page.evaluate(() => !!document.querySelector('#colunaFinanceiroPf .fv-bar i')) && /Pago R\$/.test(tx), 'PF: barra de quanto das despesas já foi pago');
check(/Nenhuma receita neste mês/.test(tx) && await page.evaluate(() => !!document.querySelector('#colunaFinanceiroPf .fp-vazia')), 'PF: sem receitas, só uma linha discreta');
check(await page.evaluate(() => !!document.querySelector('#colunaFinanceiroPf [data-despesa-pagar]')), 'PF: "Marcar paga" visível');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
