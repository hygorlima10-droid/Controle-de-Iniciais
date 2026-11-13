// Construção › Calculadora de custos: estimativa (área × CUB do padrão + outros custos + margem), valores de referência por mês, evolução dos preços (CUB e SINAPI:
// materiais × mão de obra), aviso de valores desatualizados e lembrete na Central de atenção. Grupo principal:  node test/rodar.mjs obra-calculadora
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const mes = (n) => { const d = new Date(Date.parse(hoje.slice(0, 7) + '-15T12:00:00Z')); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.73' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('PUT', 'config/backup', { ultimoEm: agora }); await api('PUT', 'config/importacaoAuto', { ativo: false, desde: agora });
await api('PUT', 'config/obra', { nome: 'Casa', criada: true, orcamentoTotal: 450000, criadoEm: agora, financiamento: { status: 'estimado', valor: 300000, banco: 'Caixa' }, etapas: [{ id: 'e1', nome: 'Terraplanagem', orcado: 20000, status: 'andamento', ordem: 1 }] });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { obra: 'calc' }, per: 6 })); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="obra"]').click()); await page.waitForTimeout(1200);
const painel = () => page.evaluate(() => (document.querySelector('.md-painel[data-mf="obra-calc"]') || {}).innerText || '').then(s => s.replace(/\s+/g, ' '));
check(await page.evaluate(() => [...document.querySelectorAll('#obAbas button')].map(b => b.innerText.trim()).includes('Calculadora')), 'a Construção tem a sub-aba "Calculadora"');
let t = await painel();
check(/Registrar valores/.test(t) && /CUB de Goiás/.test(t), 'sem valores de referência, a tela explica o que registrar e oferece "Registrar valores"');
// registra dois meses pela janela
const registrar = async (m, b, n, a, tot, mat) => {
  await page.evaluate(() => { const bt = document.querySelector('[data-mfc="atualizar"]'); if (bt) bt.click(); }); await page.waitForTimeout(400);
  await page.fill('#mfRefMes', m); await page.dispatchEvent('#mfRefMes', 'change'); await page.fill('#mfRefB', b); await page.fill('#mfRefN', n); await page.fill('#mfRefA', a); await page.fill('#mfRefTot', tot); await page.fill('#mfRefMat', mat);
  await page.click('#mfRefSalvar'); await page.waitForTimeout(900);
};
await registrar(mes(-4), '2.300,00', '2.500,00', '3.100,00', '2.000,00', '1.000,00');
await registrar(mes(-3), '2.320,00', '2.550,00', '3.150,00', '2.040,00', '1.030,00');
t = await painel();
check(/Estimativa · referência de/.test(t) && /Evolução dos preços de referência/.test(t), 'com os valores registrados aparecem a estimativa e a evolução');
// estimativa: 100 m² × 2.550 = 255.000 + outros 20.000 = 275.000 + margem 10% = 27.500 → 302.500
await page.fill('#mfc_area', '100'); await page.dispatchEvent('#mfc_area', 'change'); await page.fill('#mfc_especial', '20000'); await page.dispatchEvent('#mfc_especial', 'change'); await page.waitForTimeout(900);
t = await painel();
check(/R\$\s*255\.000,00/.test(t) && /R\$\s*20\.000,00/.test(t) && /R\$\s*27\.500,00/.test(t) && /Total estimado R\$\s*302\.500,00/.test(t), 'estimativa: 100 m² × R$ 2.550 (R1-N) + R$ 20.000 + margem de 10% = R$ 302.500,00');
check(/Materiais ~50,\d%/.test(t) || /Materiais ~50/.test(t), 'a proporção materiais × mão de obra vem do SINAPI do último mês');
check(/custaria R\$\s*297\.000,00/.test(t), 'mostra quanto a mesma obra custaria no primeiro mês registrado (100 m² × 2.500 + 20.000 + 10% = R$ 297.000,00)');
// evolução: R1-N 2.500 → 2.550 = +2,0% no mês e desde o início
check(/No último mês \+2,0%/.test(t) && /Desde .* \+2,0%/.test(t), 'evolução do CUB: +2,0% no último mês e desde o primeiro registro');
check(/Materiais R\$\s*1\.030,00 \+3,0%/.test(t) && /Mão de obra R\$\s*1\.010,00 \+1,0%/.test(t), 'SINAPI: materiais +3,0% (1.000 → 1.030) e mão de obra +1,0% (1.000 → 1.010) no mês');
// valores desatualizados: o último mês é de 3 meses atrás
check(/Os valores são de/.test(t) && /atualize/i.test(t), 'aviso de valores desatualizados (o último é de 3 meses atrás)');
// persistência
const o = (await (await api('GET', 'config')).json()).docs.find(d => d.id === 'obra').data;
check(o.refs.length === 2 && o.calc.area === 100 && o.calc.especial === 20000 && o.nome === 'Casa' && o.financiamento.banco === 'Caixa', 'refs e escolhas ficam no config da obra, sem perder o resto do documento');
// padrão alto
await page.evaluate(() => document.querySelector('[data-mfc-padrao="a"]').click()); await page.waitForTimeout(900); t = await painel();
check(/R\$\s*315\.000,00/.test(t), 'trocar o padrão para Alto usa o CUB R1-A (100 m² × 3.150 = R$ 315.000,00)');
// validação da janela
await page.evaluate(() => document.querySelector('[data-mfc="atualizar"]').click()); await page.waitForTimeout(300);
await page.fill('#mfRefMes', mes(-1)); await page.dispatchEvent('#mfRefMes', 'change'); await page.fill('#mfRefB', ''); await page.fill('#mfRefN', ''); await page.fill('#mfRefA', ''); await page.click('#mfRefSalvar');
check(/ao menos um valor do CUB/.test(await page.locator('#mfRefErro').innerText()), 'a janela exige ao menos um valor do CUB');
await page.fill('#mfRefN', '2.600,00'); await page.fill('#mfRefTot', '2.000,00'); await page.fill('#mfRefMat', '2.100,00'); await page.click('#mfRefSalvar');
check(/menor que o custo médio/.test(await page.locator('#mfRefErro').innerText()), 'materiais maiores que o custo médio do m² são recusados');
await page.fill('#mfRefMat', ''); await page.fill('#mfRefTot', ''); await page.click('#mfRefSalvar'); await page.waitForTimeout(900);
t = await painel(); check(!/Os valores são de/.test(t), 'registrar o mês esperado tira o aviso de desatualizado');
// lembrete na Central de atenção (precisa ser dia >= 10 e a referência esperada ausente)
const dia = Number(hoje.slice(8, 10));
await api('PUT', 'config/obra?mesclar=1', { refs: [{ mes: mes(-4), cub: { b: 2300, n: 2500, a: 3100 }, sinapi: null, em: agora }] }).then(x => x.status);
await page.reload(); await page.waitForTimeout(3500);
const aviso = await page.evaluate(() => document.getElementById('atencaoLista') ? document.getElementById('atencaoLista').innerText : '');
check(dia < 10 || /atualizar custos de referência/i.test(aviso), dia < 10 ? '(antes do dia 10 não há lembrete: ok)' : 'a Central de atenção lembra de atualizar os custos de referência');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
