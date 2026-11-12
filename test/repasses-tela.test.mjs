// Testa a divisão dos honorários e os repasses entre advogados na tela (Fase 5, etapa 5.6): a divisão no cadastro, "em que conta entrou",
// repasse a receber/a pagar, confirmação (entra na PJ só ao confirmar) e o aviso de recebimento desfeito.
// Servidor individual com banco semeado (grupo 'permissoes'):  node test/rodar.mjs repasses-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dono = api('dono'), ana = api('ana');
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
for (const col of ['repasses', 'receitasManuais', 'despesas']) for (const d of (await dono('GET', '/api/db/' + col)).j.docs) await dono('DELETE', '/api/db/' + col + '/' + d.id);
const A = [{ oab: '60456/GO', nome: 'Dono Teste' }, { oab: '11111/GO', nome: 'Ana Advogada' }];
const parc = (n) => ({ numero: n, valor: 500, data: hoje, pago: false });
await dono('PUT', '/api/db/casos/rp1', { tipo: 'inicial', origem: 'proprio', prioridade: 'normal', status: 'pendente', cliente: 'Cliente Repasse', nomeAcao: 'Ação de teste', numeroProcesso: '0000777-77.2024.8.09.0777', modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 1500, parcelas: [parc(1), parc(2), parc(3)], advogados: A, divisao: { partes: [{ oab: '60456/GO', nome: 'Dono Teste', pct: 70 }, { oab: '11111/GO', nome: 'Ana Advogada', pct: 30 }] }, criadoEm: new Date().toISOString() });
const br = await chromium.launch();
const nova = async (n, w = 1280) => { const ctx = await br.newContext({ viewport: { width: w, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[n], url: B }]); const page = await ctx.newPage(); page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) page.errs.push('console: ' + m.text()); }); await page.route(/fonts\./, (x) => x.abort()); await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } }); await page.goto(B + '/'); await page.waitForTimeout(3500); return page; };
const shot = async (pg, n) => { if (process.env.SHOT) await pg.screenshot({ path: process.env.SHOT + 'rp-' + n + '.png', fullPage: true }); };
const repasses = async () => (await dono('GET', '/api/db/repasses')).j.docs.map((d) => ({ id: d.id, ...d.data }));
const marcar = async (pg, n) => { await pg.evaluate((n) => { const c = window.__horusTeste; return c.marcarParcela('rp1', n, !window.__rpEstado || !window.__rpEstado[n]); }, n); await pg.evaluate((n) => { window.__rpEstado = window.__rpEstado || {}; window.__rpEstado[n] = !window.__rpEstado[n]; }, n); };

console.log('\n— a divisão no cadastro (proprietário)');
const pd = await nova('dono'); await pd.click('[data-tab="peticoes"]'); await pd.waitForTimeout(700);
await pd.evaluate(() => { const b = document.querySelector('#drawer [data-tab="peticoes"]'); b && b.click(); });
await pd.getByText('Lista', { exact: true }).first().click().catch(() => { }); await pd.waitForTimeout(500);
await pd.evaluate(() => window.__horusTeste.abrirEdicao('rp1')); await pd.waitForTimeout(700);
const temForm = await pd.locator('#rcDiv_casos').count();
let dv = temForm ? await pd.locator('#rcDiv_casos').innerText() : '';
check(/Dono Teste/.test(dv) && /Ana Advogada/.test(dv) && /Soma 100%/.test(dv), 'o cadastro mostra a divisão dos honorários entre os advogados do processo, somando 100% (' + dv.replace(/\n/g, ' ').slice(0, 90) + ')');
await shot(pd, 'divisao');
await pd.locator('.rc-pct').first().fill('60'); await pd.waitForTimeout(150);
check((await pd.locator('#rcs_casos').innerText()).includes('precisa fechar 100%'), 'divisão que não fecha 100% avisa na hora');
await pd.click('#saveBtn'); await pd.waitForTimeout(500);
check((await pd.locator('#formError').innerText()).includes('somar 100%'), 'e não deixa salvar');
await pd.evaluate(() => { const b = document.querySelector('#overlay'); b && b.classList.remove('show'); });
/* migração: o "advogado parceiro" antigo vira uma linha da divisão */
await dono('PUT', '/api/db/casos/rp0', { tipo: 'inicial', origem: 'proprio', prioridade: 'normal', status: 'pendente', cliente: 'Cliente Antigo', nomeAcao: 'Ação antiga', modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 1000, avista: { data: hoje, pago: false }, repasse: { ativo: true, parceiro: 'Dr. Fulano', modo: 'percentual', percentual: 30 }, criadoEm: new Date().toISOString() });
await pd.reload(); await pd.waitForTimeout(3500);
await pd.evaluate(() => window.__horusTeste.abrirEdicao('rp0')); await pd.waitForTimeout(800);
dv = await pd.locator('#rcDiv_casos').innerText(); await shot(pd, 'migracao');
check(/Dr\. Fulano/.test(dv) && /parceiro sem cadastro/.test(dv) && /Soma 100%/.test(dv) && (await pd.$$eval('.rc-pct', (l) => l.map((x) => x.value))).join() === '70,30', 'o "advogado parceiro" antigo (30%) aparece como linha da divisão, e o resto (70%) fica com o proprietário (' + (await pd.$$eval('.rc-pct', (l) => l.map((x) => x.value))).join() + ')');
await pd.close();

console.log('\n— Ana marca o recebimento: o dinheiro entrou na conta dela');
const pa = await nova('ana'); await pa.click('[data-tab="peticoes"]'); await pa.waitForTimeout(600);
await pa.getByText('Lista', { exact: true }).first().click().catch(() => { }); await pa.waitForTimeout(500);
await marcar(pa, 1); await pa.waitForSelector('#overlayRcConta.show', { timeout: 6000 }); await shot(pa, 'conta');
let t = await pa.locator('#overlayRcContaC').innerText();
check(/Na conta de Ana Advogada \(você\)/.test(t) && /Dono Teste · 70%/.test(t) && /R\$\s*350,00/.test(t) && /Você repassa/.test(t), 'o app pergunta em que conta o dinheiro entrou e mostra a divisão e o que cabe a cada um');
await pa.click('[data-rcq="ok"]'); await pa.waitForTimeout(2500);
let rs = await repasses(), r1 = rs.find((r) => r.chave.endsWith('|parcela|1'));
const c1 = (await dono('GET', '/api/db/casos')).j.docs.find((d) => d.id === 'rp1').data;
check(c1.parcelas[0].divisaoRec && c1.parcelas[0].divisaoRec.recebeu === '11111/GO' && c1.parcelas[0].divisaoRec.perguntar === false, 'a parcela guarda a divisão e a conta daquele recebimento');
check(r1 && r1.de.oab === '11111/GO' && r1.para.oab === '60456/GO' && r1.valor === 350 && r1.status === 'pendente', 'nasce o repasse: Ana → proprietário, R$ 350,00 (70% de R$ 500,00), pendente');
await pa.click('[data-tab="inicio"]'); await pa.waitForTimeout(600);
t = await pa.locator('#rcInicio').innerText();
check(/Você deve repassar R\$\s*350,00 a Dono/.test(t) && /Já repassei/.test(t), 'no Início da Ana: "Você deve repassar R$ 350,00" com o botão "Já repassei"');
await shot(pa, 'ana-inicio');
await pa.click('[data-rcr="repassei"]'); await pa.waitForTimeout(1500);
check((await repasses()).find((r) => r.id === r1.id).status === 'feito' && (await pa.locator('#rcInicio').innerText()).includes('Aguardando'), '"Já repassei" marca como feito e fica "aguardando confirmar"');

console.log('\n— o proprietário recebe o aviso e confirma (só então entra na PJ)');
const po = await nova('dono'); await po.click('[data-tab="inicio"]'); await po.waitForTimeout(800);
t = await po.locator('#rcInicio').innerText(); await shot(po, 'dono-inicio');
check(/Ana diz que repassou R\$\s*350,00/.test(t) && /Confirmar que recebi/.test(t) && /Ainda não recebi/.test(t), 'Central: "Ana diz que repassou R$ 350,00" com "Confirmar que recebi" e "Ainda não recebi"');
check((await dono('GET', '/api/db/receitasManuais')).j.docs.length === 0, 'até confirmar, nada entrou na PJ');
await po.click('[data-rcr="confirmar"]'); await po.waitForTimeout(1500);
const rec = (await dono('GET', '/api/db/receitasManuais')).j.docs;
check((await repasses()).find((r) => r.id === r1.id).status === 'confirmado' && rec.length === 1 && rec[0].data.valor === 350 && rec[0].data.coluna === 'pj' && rec[0].data.repasseId === r1.id, 'ao confirmar, os R$ 350,00 entram na PJ (receita ligada ao repasse)');

console.log('\n— recebimento desfeito');
await marcar(pa, 3); await pa.waitForSelector('#overlayRcConta.show', { timeout: 6000 }); await pa.click('[data-rcq="ok"]'); await pa.waitForTimeout(2500);
const r3 = (await repasses()).find((r) => r.chave.endsWith('|parcela|3')); check(r3 && r3.status === 'pendente', '(parcela 3 marcada: repasse pendente)');
await marcar(pa, 3); await pa.waitForTimeout(3000);
check((await repasses()).find((r) => r.id === r3.id).status === 'cancelado', 'desmarcar o recebimento cancela o repasse');
await po.reload(); await po.waitForTimeout(3500); await po.click('[data-tab="inicio"]'); await po.waitForTimeout(700);
t = await po.locator('#rcInicio').innerText();
check(/Recebimento desfeito por Ana/.test(t) && !/Ana recebeu honorários/.test(t), 'o proprietário vê "Recebimento desfeito por Ana" na Central');
check(!(await pa.locator('#rcInicio').innerText().catch(() => '')).includes('desfeito'), 'e quem desfez não recebe aviso do próprio ato');
await po.click('[data-rcr="dispensar"]'); await po.waitForTimeout(800); check(!(await po.locator('#rcInicio').innerText()).includes('desfeito'), '"Dispensar" tira o aviso');

console.log('\n— o dinheiro entrou na conta do proprietário');
await marcar(pa, 2); await pa.waitForSelector('#overlayRcConta.show', { timeout: 6000 });
await pa.check('input[data-rcq="conta"][value="60456/GO"]'); await pa.waitForTimeout(150);
t = await pa.locator('#overlayRcContaC').innerText(); check(/Sua parte: R\$\s*150,00, que Dono Teste repassa a você/.test(t), 'o resumo diz: "Sua parte R$ 150,00, que o proprietário repassa a você" → ' + t.replace(/\n/g, ' | ').slice(-260));
await pa.click('[data-rcq="ok"]'); await pa.waitForTimeout(2500);
const r2 = (await repasses()).find((r) => r.chave.endsWith('|parcela|2') && r.status !== 'cancelado');
check(r2 && r2.de.oab === '60456/GO' && r2.para.oab === '11111/GO' && r2.valor === 150, 'nasce o repasse inverso: proprietário → Ana, R$ 150,00 (30%)');
await pa.reload(); await pa.waitForTimeout(3500); await pa.click('[data-tab="inicio"]'); await pa.waitForTimeout(700);
check(/Dono recebeu honorários/.test(await pa.locator('#rcInicio').innerText()), 'a Ana vê "O proprietário recebeu honorários · seu repasse R$ 150,00 a receber"');
console.log('\n— o que conta no financeiro do proprietário');
await po.reload(); await po.waitForTimeout(3500);
const un = await po.evaluate(() => window.__horusTeste.rcUnidades('rp1')), u1 = un.find((u) => u.chave.endsWith('|parcela|1')), u2 = un.find((u) => u.chave.endsWith('|parcela|2')), u3 = un.find((u) => u.chave.endsWith('|parcela|3'));
check(u1.pago && u1.outro && u1.fator === 0 && u1.meu === 0 && !u1.repasse, 'recebimento na conta da Ana: nada entra na conta do proprietário (a receber dela, até confirmar o repasse)');
check(u2.pago && !u2.outro && Math.abs(u2.fator - 0.7) < 1e-9 && u2.repasse && u2.parceiro === 'Ana Advogada' && u2.meu === 350, 'recebimento na conta do proprietário: entra só a parte dele (70% = R$ 350,00) e o resto fica como repasse a pagar à Ana');
check(!u3.pago && Math.abs(u3.fator - 0.7) < 1e-9 && u3.meu === 350, 'o que ainda não foi recebido projeta a parte dele pela divisão (70%)');
for (const p of [pa, po]) { const e = p.errs.filter((x) => !/Só o proprietário pode abrir isto/.test(x)); check(e.length === 0, 'sem erros de JavaScript' + (e.length ? ': ' + e.join(' | ') : '')); }   // (o app do advogado ainda tenta abrir as finanças do proprietário: isso é a etapa 5.7)
// limpa o que este teste criou, para não contaminar os testes seguintes (o banco é compartilhado)
for (const col of ['repasses', 'receitasManuais', 'despesas']) for (const d of (await dono('GET', '/api/db/' + col)).j.docs) await dono('DELETE', '/api/db/' + col + '/' + d.id);
for (const id of ['rp0', 'rp1']) await dono('DELETE', '/api/db/casos/' + id);
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
