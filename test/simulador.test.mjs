// Fase 3, etapa 3.6: Análises > Simulador ("e se"): receita extra, despesa, transferência PJ → PF e aporte na reserva;
// efeito no caixa livre e na reserva; nada é gravado nos lançamentos; guardar neste aparelho; ligação com o Pergunte ao app.
// Use: node test/rodar.mjs simulador
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3);
const mes = n => { const d = new Date(hoje.getFullYear(), hoje.getMonth() + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const NOMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const label = m => NOMES[parseInt(m.slice(5), 10) - 1] + ' de ' + m.slice(0, 4);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.54' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('PUT', 'config/backup', { ultimoEm: agora }); await api('PUT', 'config/importacaoAuto', { ativo: false, desde: agora });
await api('PUT', 'saldos/pj', { coluna: 'pj', saldoAtual: 5000, atualizadoEm: agora, historico: [{ valor: 5000, data: agora }] });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const txt = () => page.evaluate(() => document.getElementById('anWrap').innerText);
await page.evaluate(() => document.querySelector('[data-tab="analises"]').click()); await page.waitForTimeout(800);
check(await page.evaluate(() => Array.from(document.querySelectorAll('#anPeriodoSeg button')).map(b => b.textContent).join('|')) === 'Último mês|Histórico|Semanas|Simulador|Futuro', 'o seletor de Análises ganhou o botão "Simulador"');
await page.evaluate(() => document.querySelector('[data-an-periodo="sim"]').click()); await page.waitForTimeout(600);
let t = await txt();
check(/Aqui nada é gravado/.test(t) && /Nenhum evento ainda/.test(t) && /Caixa livre em[\s\S]*R\$\s*5\.000,00/i.test(t), 'abre vazio, explica que nada é gravado e mostra o caixa de hoje (R$ 5.000) sem evento');
const add = async (tipo, valor, m, rep, desc = '', n = '') => {
  await page.click('[data-sim="novo:' + tipo + '"]'); await page.waitForTimeout(200);
  await page.fill('#simV', String(valor)); await page.selectOption('#simM', m); if (rep !== 'uma') { await page.selectOption('#simR', rep); await page.waitForTimeout(250); if (n) await page.fill('#simN', String(n)); }
  if (desc) await page.fill('#simD', desc); await page.click('[data-sim="salvar"]'); await page.waitForTimeout(350);
};
await add('receita', 5000, mes(1), 'uma'); await add('aporte', 1000, mes(1), 'uma'); await add('transf', 2000, mes(1), 'uma'); await add('despesa', 1800, mes(2), 'mensal', 'Plano novo');
t = await txt();
check(/Receita extra/.test(t) && /Aporte na reserva/.test(t) && /Transferência PJ → PF/.test(t) && /Plano novo/.test(t) && /por mês · a partir de/.test(t), 'os 4 eventos aparecem na lista do cenário');
// caixa: mês0 5.000; mês1 +5.000 −1.000 (aporte) = 9.000; mês2 −1.800 = 7.200; ... mês5 = 1.800
check(new RegExp('Caixa livre em ' + '[a-zç]{3}/\\d\\d\\s*\\n?\\s*R\\$\\s*1\\.800,00', 'i').test(t) && /antes: R\$\s*5\.000,00/.test(t), 'caixa livre no fim dos 6 meses: R$ 1.800 (antes: R$ 5.000), a transferência não entra na conta');
check(/Reserva em[\s\S]{0,40}R\$\s*1\.000,00[\s\S]{0,40}antes: R\$\s*0,00/i.test(t), 'a reserva sobe R$ 1.000 pelo aporte (antes: R$ 0)');
check(/transferência PJ → PF não muda o caixa livre/.test(t) && /aporte na reserva sai do caixa livre/.test(t), 'notas explicam a transferência (não muda o caixa livre) e o aporte (sai do caixa e vai para a reserva)');
check(/não fica negativo em nenhum/.test(t) && !/fica negativo em [a-zç]+ de/.test(t), 'sem negativo: o aviso diz que o caixa não fica negativo');
check(await page.evaluate(() => !!document.querySelector('#anWrap svg.an-svg') && document.querySelectorAll('#anWrap svg path[stroke-dasharray]').length >= 1), 'gráfico com a linha tracejada (sem cenário) e a linha cheia (com cenário)');
// despesa grande -> negativo
await add('despesa', 10000, mes(2), 'uma', 'Imprevisto'); t = await txt();
check(new RegExp('Com este cenário o caixa livre fica negativo em ' + label(mes(2)) + ' \\(−R\\$\\s*2\\.800,00\\)').test(t) && /Sem o cenário o caixa não fica negativo/.test(t), 'despesa de R$ 10.000: avisa que o caixa fica negativo em ' + label(mes(2)) + ' (−R$ 2.800,00)');
// editar e excluir
await page.evaluate(() => Array.from(document.querySelectorAll('#anWrap .sim-ev')).find(e => /Imprevisto/.test(e.innerText)).querySelector('[data-sim^="editar"]').click()); await page.waitForTimeout(300);
check(await page.inputValue('#simV') === '10000' && /Editar: Despesa nova/.test(await txt()), 'editar abre o evento com os valores');
await page.click('[data-sim="excluir"]'); await page.waitForTimeout(400); t = await txt();
check(!/Imprevisto/.test(t) && /não fica negativo em nenhum/.test(t), 'excluir tira o evento e o aviso volta ao normal');
// parcelado
await add('despesa', 12000, mes(1), 'parcelas', 'Carro', 4); t = await txt();
check(/Carro/.test(t) && /em 4x de R\$\s*3\.000,00/.test(t), 'despesa parcelada: R$ 12.000 em 4x de R$ 3.000');
// nada gravado
const nd = (await (await api('GET', 'despesas')).json()).docs.length, nr = (await (await api('GET', 'receitasManuais')).json()).docs.length;
check(nd === 0 && nr === 0, 'o simulador não gravou nenhuma despesa nem receita');
// guardar neste aparelho
await page.click('[data-sim="guardar"]'); await page.waitForTimeout(300);
check(await page.evaluate(() => { try { const o = JSON.parse(localStorage.getItem('horus.simulador.v1')); return o.eventos.length === 5; } catch (e) { return false; } }), 'guardar neste aparelho salva os 5 eventos só no navegador');
await page.reload(); await page.waitForTimeout(3500); await page.evaluate(() => document.querySelector('[data-tab="analises"]').click()); await page.waitForTimeout(700); await page.evaluate(() => document.querySelector('[data-an-periodo="sim"]').click()); await page.waitForTimeout(500);
check(/Carro/.test(await txt()) && /Plano novo/.test(await txt()), 'depois de recarregar, o cenário guardado volta');
await page.click('[data-sim="limpar"]'); await page.waitForTimeout(300);
check(/Nenhum evento ainda/.test(await txt()) && await page.evaluate(() => localStorage.getItem('horus.simulador.v1') === null), 'limpar apaga o cenário (e o que estava guardado)');
// Pergunte ao app -> Simulador
const ev = await page.evaluate((m) => window.__horusTeste.simDeCenario({ descricao: 'carro novo', tipoEvento: 'gasto', valor: 60000, mes: m, parcelas: 12, entrada: 20000 }), mes(3));
check(ev.length === 2 && ev[0].rep === 'uma' && ev[0].valor === 20000 && ev[1].rep === 'parcelas' && ev[1].n === 12 && ev[1].valor === 40000 && ev[1].mes === mes(3), 'o "e se" do Pergunte (R$ 60 mil, entrada de 20 mil, 12x) vira 2 eventos: entrada à vista e 12 parcelas');
await page.evaluate((e) => window.__horusTeste.simAbrir(e), ev); await page.waitForTimeout(600); t = await txt();
check(/carro novo · entrada/.test(t) && /carro novo/.test(t) && /em 12x de R\$\s*3\.333,33/.test(t) && /fica negativo/.test(t), 'abrir no Simulador mostra o cenário já preenchido e o efeito no caixa');
if (process.env.SHOT) { await page.screenshot({ path: process.env.SHOT + 'simulador.png', fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500); await page.screenshot({ path: process.env.SHOT + 'simulador-celular.png', fullPage: true }); }
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
