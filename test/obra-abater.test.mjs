// Testa "Abater valor do contrato" (mão de obra): registra o pagamento e redistribui o restante em semanas até o término.
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
await api('PUT', 'config/obra', { nome: 'Casa', orcamentoTotal: 100000, criadoEm: agora, financiamento: { status: 'estimado', valor: 0 }, etapas: [{ id: 'e1', nome: 'Alvenaria', orcado: 20000, status: 'andamento', ordem: 1 }],
  contratos: [{ id: 'k1', nome: 'Pedreiro', fornecedor: '', valor: 5500, forma: 'semanal', semanal: 2750, fim: dia(14), etapaId: 'e1', criadoEm: agora }, { id: 'k2', nome: 'Eletricista', fornecedor: '', valor: 3000, forma: 'semanal', semanal: 500, fim: '', etapaId: 'e1', criadoEm: agora }] });
await api('PUT', 'obraMov/a1', { tipo: 'aporte', origem: 'pf', data: dia(-3), valor: 50000, criadoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { obra: 'tudo', financeiro: 'geral' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2800);
await page.evaluate(() => document.querySelector('[data-tab="obra"]').click()); await page.waitForTimeout(900);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
await page.click('[data-mo-toggle="k1"]'); await page.waitForTimeout(400);
check(await page.evaluate(() => !!document.querySelector('[data-mo-abater="k1"]')), 'o contrato tem o botão "Abater valor do contrato"');
await page.click('[data-mo-abater="k1"]'); await page.waitForTimeout(400);
check(await page.evaluate(() => document.getElementById('overlayObraForm').classList.contains('show')), 'abre a folha de abatimento');
await page.fill('#of_valor', '1500'); await page.waitForTimeout(300);
const prev = await t('#ab_previa');
check(/faltam R\$\s*4\.000,00/.test(prev) && /2 semanas/.test(prev) && /R\$\s*2\.000,00/.test(prev), 'prévia: faltam 4.000, 2 semanas, R$ 2.000 por semana: ' + prev.replace(/\n/g, ' '));
await page.click('#obraFormSalvar'); await page.waitForTimeout(1500);
const movs = (await (await api('GET', 'obraMov')).json()).docs.map(d => d.data).filter(m => m.contrato === 'k1');
check(movs.length === 1 && movs[0].valor === 1500 && movs[0].status === 'pago' && /abatimento/.test(movs[0].descricao), 'o abatimento vira pagamento de R$ 1.500 do contrato');
const k1 = (await get('config', 'obra')).contratos.find(k => k.id === 'k1');
check(k1.semanal === 2000 && k1.ajuste && k1.ajuste.de === 2750 && k1.ajuste.para === 2000 && k1.ajuste.abatido === 1500, 'o pagamento semanal foi redistribuído de 2.750 para 2.000');
await page.waitForTimeout(500);
check(/passou de R\$\s*2\.750,00 para\s*R\$\s*2\.000,00/.test(await t('[data-mo-item="k1"]')) && /Pagar R\$\s*2\.000/.test(await t('[data-mo-item="k1"]')), 'o contrato mostra o ajuste e o botão Pagar já com R$ 2.000');
// sem término: só dá para manter
await page.click('[data-mo-toggle="k2"]'); await page.waitForTimeout(400);
await page.click('[data-mo-abater="k2"]'); await page.waitForTimeout(400);
await page.fill('#of_valor', '400'); await page.waitForTimeout(300);
check(await page.evaluate(() => document.getElementById('of_modo').value) === 'manter', 'sem término previsto, a opção padrão é manter o semanal');
await page.selectOption('#of_modo', 'redistribuir'); await page.waitForTimeout(300);
check(/Sem término previsto/.test(await t('#ab_previa')), 'avisa que sem término não dá para dividir');
await page.click('#obraFormSalvar'); await page.waitForTimeout(700);
check(/Informe a data em "Editar contrato"|escolha manter/.test(await t('#obraFormErro') + await t('#obraFormCorpo')), 'recusa redistribuir sem término e explica');
await page.selectOption('#of_modo', 'manter'); await page.click('#obraFormSalvar'); await page.waitForTimeout(1500);
const k2 = (await get('config', 'obra')).contratos.find(k => k.id === 'k2');
check(k2.semanal === 500 && !k2.ajuste, 'mantendo, o semanal continua 500 e o pagamento de 400 foi registrado');
check((await (await api('GET', 'obraMov')).json()).docs.some(d => d.data.contrato === 'k2' && d.data.valor === 400), 'pagamento de 400 do eletricista registrado');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
