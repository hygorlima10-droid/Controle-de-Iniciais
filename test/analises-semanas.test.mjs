// Fase 3, etapa 3.3: Análises > Semanas (fluxo de caixa semanal): saldo semana a semana, aviso de saldo negativo,
// lista da semana, o que fica de fora (alvarás, atrasados, sem data) e as regras de "só previsão".
// Use: node test/rodar.mjs analises-semanas
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const dm = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const segunda = iso => { const d = new Date(iso + 'T12:00:00Z'); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10); };
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.51' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('PUT', 'config/backup', { ultimoEm: agora }); await api('PUT', 'config/importacaoAuto', { ativo: false, desde: agora });
await api('PUT', 'saldos/pj', { coluna: 'pj', saldoAtual: 3000, atualizadoEm: agora, historico: [{ valor: 3000, data: agora }] });
await api('PUT', 'saldos/pf', { coluna: 'pf', saldoAtual: 500, atualizadoEm: agora, historico: [{ valor: 500, data: agora }] });
const desp = (id, nome, v, d, extra = {}) => api('PUT', 'despesas/' + id, { nome, coluna: 'pj', tipo: 'unica', valor: v, data: d, mesReferencia: d.slice(0, 7), categoria: 'estrutura', pago: false, criadoEm: agora, ...extra });
await desp('d1', 'Contador', 2500, dia(0)); await desp('d2', 'Reforma do telhado', 6000, dia(16)); await desp('d3', 'Já paga', 999, dia(3), { pago: true, dataPagamento: dia(3) });
const ac = (id, partes, ps) => api('PUT', 'termosAcordo/' + id, { partes, numeroProcesso: '1', origem: 'proprio', status: 'pendente', valorTotal: ps.reduce((t, p) => t + p.valor, 0), valorMeuHonorario: ps.reduce((t, p) => t + p.valor, 0), parcelas: ps.map((p, i) => ({ numero: i + 1, valor: p.valor, data: p.data, pago: false })), data: ps[0].data, clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await ac('a1', 'Carlos Andrade x Banco', [{ valor: 900, data: dia(0) }, { valor: 800, data: dia(9) }]);
await api('PUT', 'alvaras/v1', { numeroProcesso: '9', partes: 'Ciclano x Banco', origem: 'proprio', valorTotalHonorarios: 4000, valorMeuHonorario: 4000, status: 'pendente', fase: 'expedido', faseDesde: dia(-3), previsaoLevantamento: dia(10), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
const txt = () => page.evaluate(() => document.getElementById('anWrap').innerText);
const abrir = async () => { await page.evaluate(() => document.querySelector('[data-tab="analises"]').click()); await page.waitForTimeout(800); await page.evaluate(() => document.querySelector('[data-an-periodo="sem"]').click()); await page.waitForTimeout(500); };
await page.evaluate(() => document.querySelector('[data-tab="analises"]').click()); await page.waitForTimeout(800);
check(await page.evaluate(() => Array.from(document.querySelectorAll('#anPeriodoSeg button')).some(b => b.textContent === 'Semanas')), 'o seletor de Análises ganhou o botão "Semanas"');
await abrir();
check(await page.evaluate(() => document.querySelector('#anPeriodoSeg .active').textContent) === 'Semanas', 'Semanas abre e fica marcada');
const semD2 = segunda(dia(16)); const esperado = 3500 + 900 + 800 - 2500 - 6000;
let t = await txt();
check(new RegExp('Atenção: a semana de ' + dm(semD2) + ' fecha com saldo previsto de −R\\$\\s*' + String(-esperado).replace(/(\d)(?=(\d{3})$)/, '$1.') + ',00').test(t), 'avisa que a semana de ' + dm(semD2) + ' fecha com saldo previsto de −R$ 3.300,00 (caixa 3.500 + parcelas 1.700 − despesas 8.500)');
check(/Reforma do telhado \(PJ\) \(R\$\s*6\.000,00, /.test(t), 'o aviso cita a maior saída que vem antes (Reforma do telhado)');
check((await page.locator('#anWrap svg .an-hit').count()) === 10 && (await page.locator('#anWrap .an-sem-ent').count()) > 0 && (await page.locator('#anWrap .an-sem-sai').count()) > 0 && (await page.locator('#anWrap .an-sem-linha').count()) === 1, 'gráfico com 10 semanas: barras de entrada, de saída e a linha do saldo');
check(await page.evaluate(() => !!document.querySelector('#anWrap .an-sem-sel')) && new RegExp('Semana de ' + dm(semD2) + ' · o que entra e sai').test(t), 'já abre com a semana do problema selecionada');
check(/Reforma do telhado[\s\S]*− R\$\s*6\.000,00/.test(t) && !/Já paga/.test(t), 'a lista da semana mostra a reforma e ignora a despesa já paga');
check(/Ficam de fora do saldo:[\s\S]*alvarás com data \(R\$\s*4\.000,00, 1\)/.test(t), 'o alvará de R$ 4.000 fica de fora do saldo e aparece em "O que a semana não conta"');
const sem0 = segunda(hoje); await page.locator('#anWrap svg .an-hit').nth(0).click({ force: true }); await page.waitForTimeout(400); t = await txt();
check(new RegExp('Semana de ' + dm(sem0) + ' · o que entra e sai').test(t) && /Carlos Andrade x Banco/.test(t) && /\+ R\$\s*900,00/.test(t) && /Contador/.test(t) && /esta semana inclui/.test(t), 'tocar na 1ª semana lista a parcela de R$ 900 e o Contador (R$ 2.500)');
await page.click('[data-an-sem-nav="1"]'); await page.waitForTimeout(300);
check(new RegExp('Semana de ' + dm(segunda(dia(7))) + ' · o que entra e sai').test(await txt()), 'a seta › passa para a semana seguinte');
await page.click('[data-an-sem-n="12"]'); await page.waitForTimeout(400);
check((await page.locator('#anWrap svg .an-hit').count()) === 12 && /12 semanas/.test(await txt()), '"12 semanas" estende o gráfico');
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'semanas-desktop.png', fullPage: true });
// celular: sem rolagem lateral e seletor legível
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no celular não rola para o lado');
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'semanas-celular.png', fullPage: true });
// sem a reforma: o saldo não fica negativo
await api('DELETE', 'despesas/d2'); await page.setViewportSize({ width: 1280, height: 900 }); await page.reload(); await page.waitForTimeout(3000); await abrir();
t = await txt();
check(/Nas próximas 10 semanas o saldo previsto não fica negativo/.test(t) && /ponto mais baixo/.test(t), 'sem a reforma: "o saldo previsto não fica negativo" com o ponto mais baixo');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
