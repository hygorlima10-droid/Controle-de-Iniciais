// Fase 3, etapa 3.7: Análises > Futuro: projeção patrimonial (estimativa) em 3 cenários, premissas editáveis e o conteúdo
// da antiga "Próx. 3 meses" (caixa dos próximos 3 meses). A sub-aba "Próx. 3 meses" saiu.
// Use: node test/rodar.mjs analises-futuro
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3), hojeISO = hoje.toISOString().slice(0, 10);
const mes = n => { const d = new Date(hoje.getFullYear(), hoje.getMonth() + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const dia = n => new Date(Date.parse(hojeISO + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const moeda = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const serie = (aplicado, parado, poupa, rende, n) => { let ap = aplicado; for (let i = 1; i <= n; i++) ap = ap * (1 + rende / 100) + poupa; return Math.round((parado + ap) * 100) / 100; };
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.55' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('DELETE', 'config/futuro'); await api('PUT', 'config/backup', { ultimoEm: agora }); await api('PUT', 'config/importacaoAuto', { ativo: false, desde: agora });
for (let n = -7; n <= -1; n++) { await api('PUT', 'receitasManuais/r' + (-n), { nome: 'Honorários', coluna: 'pj', valor: 4000, mesReferencia: mes(n), data: mes(n) + '-03', recorrente: false, criadoEm: agora }); await api('PUT', 'despesas/d' + (-n), { nome: 'Aluguel', coluna: 'pj', tipo: 'unica', valor: 3000, data: mes(n) + '-12', mesReferencia: mes(n), categoria: 'estrutura', pago: true, dataPagamento: mes(n) + '-12', criadoEm: agora }); }
await api('PUT', 'saldos/pj', { coluna: 'pj', saldoAtual: 20000, atualizadoEm: agora, historico: [{ valor: 8000, data: mes(-6) + '-05T12:00:00.000Z' }, { valor: 20000, data: agora }] });
await api('PUT', 'saldos/pf', { coluna: 'pf', saldoAtual: 0, atualizadoEm: agora, historico: [{ valor: 0, data: agora }] });
await api('PUT', 'metas/m1', { tipo: 'reserva', coluna: 'pj', nome: 'Reserva', movimentos: [{ id: 'i1', tipo: 'inicial', valor: 5000, dia: dia(-60), data: agora }], criadoEm: agora });
await api('PUT', 'metas/m2', { tipo: 'comum', coluna: 'pf', nome: 'Viagem', valorAlvo: 6000, prazo: dia(150), movimentos: [{ id: 'i2', tipo: 'inicial', valor: 1000, dia: dia(-10), data: agora }], criadoEm: agora });
await api('PUT', 'termosAcordo/a1', { partes: 'Carlos x Banco', numeroProcesso: '1', origem: 'proprio', status: 'pendente', valorTotal: 900, valorMeuHonorario: 900, parcelas: [{ numero: 1, valor: 900, data: dia(20), pago: false }], data: dia(20), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const txt = () => page.evaluate(() => document.getElementById('anWrap').innerText);
await page.evaluate(() => document.querySelector('[data-tab="analises"]').click()); await page.waitForTimeout(800);
check(await page.evaluate(() => Array.from(document.querySelectorAll('#anPeriodoSeg button')).map(b => b.textContent).join('|')) === 'Último mês|Histórico|Semanas|Simulador|Futuro', 'seletor final de Análises: Último mês | Histórico | Semanas | Simulador | Futuro (sem "Próx. 3 meses")');
await page.evaluate(() => document.querySelector('[data-an-periodo="fut"]').click()); await page.waitForTimeout(700);
let t = await txt();
check(/Isto é uma estimativa, não dinheiro/.test(t) && /tracejado e com o selo/.test(t), 'aviso: "Isto é uma estimativa, não dinheiro"');
const par = await page.evaluate(() => window.__horusTeste.futPartida()); const P = await page.evaluate(() => window.__horusTeste.futPremissas());
check(par.total === 26000 && par.aplicado === 6000 && par.parado === 20000, 'ponto de partida: patrimônio R$ 26.000 = R$ 20.000 parados (contas) + R$ 6.000 que rendem (reserva 5.000 + meta 1.000)');
check(P.inter.poupa === 1000 && P.cons.poupa === 500 && P.otim.poupa === 1500 && P.inter.rende === 0.7 && P.cons.rende === 0.4 && P.otim.rende === 1, 'poupança automática = média do resultado dos meses fechados (1.000): conservador 500, intermediário 1.000, otimista 1.500; rendimentos 0,4 / 0,7 / 1,0');
const esperado = (k, n) => serie(6000, 20000, P[k].poupa, P[k].rende, n);
check(t.replace(/\s/g, ' ').includes(moeda(esperado('inter', 24)).replace(',00', '').replace(/\s/g, ' ')) || t.includes(esperado('inter', 24).toLocaleString('pt-BR', { maximumFractionDigits: 0 })), 'o intermediário em 24 meses bate com a conta (' + moeda(esperado('inter', 24)) + ')');
check(await page.evaluate(() => document.querySelectorAll('#anWrap svg polyline[stroke-dasharray]').length === 3 && /ESTIMATIVA/.test(document.querySelector('#anWrap svg.an-svg').innerHTML) && /hoje/.test(document.querySelector('#anWrap svg.an-svg').innerHTML)), 'gráfico: 3 linhas tracejadas (estimativa), selo ESTIMATIVA e a marca "hoje"');
check(/Conservador · estimativa/i.test(t) && /Intermediário · estimativa/i.test(t) && /Otimista · estimativa/i.test(t) && /poupa R\$\s*1\.000\/mês · rende 0,7% ao mês/.test(t), 'três cartões de cenário com valores em 12, 24 e 36 meses e as premissas de cada um');
// horizonte
await page.click('[data-an-fut-n="12"]'); await page.waitForTimeout(400);
check(await page.evaluate(() => /\+12 m/.test(document.querySelector('#anWrap svg.an-svg').innerHTML) && document.querySelector('[data-an-fut-n="12"]').classList.contains('on')), 'trocar para 12 meses muda o gráfico (+12 m)');
await page.click('[data-an-fut-n="36"]'); await page.waitForTimeout(400);
check(await page.evaluate(() => /\+36 m/.test(document.querySelector('#anWrap svg.an-svg').innerHTML)), '36 meses também funciona');
// premissas editáveis
await page.fill('#futP_inter', '2.000,00'); await page.fill('#futR_inter', '1'); await page.click('[data-fut="salvar"]'); await page.waitForTimeout(1200); t = await txt();
check(/poupa R\$\s*2\.000\/mês · rende 1% ao mês/.test(t), 'editar as premissas do intermediário (poupa 2.000, rende 1%) atualiza o cartão');
const lista = await (await api('GET', 'config')).json(); const doc = ((lista.docs || []).find(d => d.id === 'futuro') || {}).data;
check(doc && doc.inter && doc.inter.poupa === 2000 && doc.inter.rende === 1, 'as premissas ficam guardadas em config/futuro');
const P2 = await page.evaluate(() => window.__horusTeste.futPremissas());
check(P2.inter.poupa === 2000 && P2.cons.poupa === 500, 'só o cenário editado muda; os outros continuam no automático');
await page.fill('#futR_cons', '9'); await page.click('[data-fut="salvar"]'); await page.waitForTimeout(500);
check(/entre 0 e 5%/.test(await page.evaluate(() => (document.getElementById('toast') || document.body).innerText)), 'rendimento fora de 0 a 5% ao mês é recusado');
await page.click('[data-fut="auto"]'); await page.waitForTimeout(1000);
check((await page.evaluate(() => window.__horusTeste.futPremissas())).inter.poupa === 1000 && /poupa R\$\s*1\.000\/mês · rende 0,7% ao mês/.test(await txt()), '"Voltar ao automático" restaura as premissas');
// conteúdo da antiga Próx. 3 meses
t = await txt();
check(/Os próximos 3 meses · caixa/.test(t) && /Como cada mês termina/.test(t) && /O que deve entrar/.test(t) && /O que deve sair/.test(t) && /Principais entradas e saídas previstas/.test(t) && /Dinheiro da obra a receber/.test(t), 'abaixo vem o conteúdo da antiga "Próx. 3 meses", repaginado');
check(await page.evaluate(() => !!document.getElementById('pjEntra') && !!document.getElementById('pjSai') && !!document.getElementById('pjFim') && !!document.getElementById('pjFimAlv') && document.querySelectorAll('#anWrap .an-duas').length >= 3), 'indicadores (Deve entrar, Deve sair, Caixa no fim...) e cartões lado a lado');
check(!/\+ Marcar uma entrada/.test(t) && /Marcar uma entrada como dinheiro da obra/.test(t), 'o botão da obra ficou sem o "+"');
await page.click('#anObraPickerBtn'); await page.waitForTimeout(500);
check(/Escolha a entrada que é para a obra/.test(await txt()) && /Carlos x Banco/.test(await txt()), 'a escolha de "dinheiro da obra" continua funcionando dentro do Futuro');
if (process.env.SHOT) { await page.screenshot({ path: process.env.SHOT + 'futuro.png', fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500); check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular não rola para o lado'); await page.screenshot({ path: process.env.SHOT + 'futuro-celular.png', fullPage: true }); }
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
