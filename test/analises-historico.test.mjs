// Fase 3, etapa 3.4: Análises > Histórico (recortes 6 meses / 12 meses / Ano / Tudo), fechamento automático dos meses,
// "mudou depois" + refazer, comparar dois meses, exportar e Último mês repaginado.
// Use: node test/rodar.mjs analises-historico
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date();
const mes = n => { const d = new Date(hoje.getFullYear(), hoje.getMonth() + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.52' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('DELETE', 'config/fechamentos'); await api('PUT', 'config/backup', { ultimoEm: agora }); await api('PUT', 'config/importacaoAuto', { ativo: false, desde: agora });
// recebimentos de 13 meses atrás até o mês passado (o do mês passado é o maior)
for (let n = -13; n <= -1; n++) await api('PUT', 'receitasManuais/r' + (-n), { nome: 'Honorários', coluna: 'pj', valor: n === -1 ? 10000 : n === -2 ? 6000 : 4000, mesReferencia: mes(n), data: mes(n) + '-03', recorrente: false, criadoEm: agora });
for (let n = -13; n <= -1; n++) await api('PUT', 'despesas/d' + (-n), { nome: 'Aluguel', coluna: 'pj', tipo: 'unica', valor: 3000, data: mes(n) + '-12', mesReferencia: mes(n), categoria: 'estrutura', pago: true, dataPagamento: mes(n) + '-12', criadoEm: agora });
await api('PUT', 'saldos/pj', { coluna: 'pj', saldoAtual: 20000, atualizadoEm: agora, historico: [{ valor: 5000, data: mes(-13) + '-05T12:00:00.000Z' }, { valor: 20000, data: agora }] });
await api('PUT', 'saldos/pf', { coluna: 'pf', saldoAtual: 1000, atualizadoEm: agora, historico: [{ valor: 1000, data: agora }] });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(7000);
const txt = () => page.evaluate(() => document.getElementById('anWrap').innerText);
const abrirHist = async () => { await page.evaluate(() => document.querySelector('[data-tab="analises"]').click()); await page.waitForTimeout(700); await page.evaluate(() => document.querySelector('[data-an-periodo="hist"]').click()); await page.waitForTimeout(600); };
const tabela = () => page.evaluate(() => (document.querySelector('#anWrap .an-fech') || {}).innerText || '');
const linhas = () => page.locator('#anWrap .an-fech tbody tr').count();
// 1) o fechamento acontece sozinho ao abrir o app
const lerFech = async () => { const j = await (await api('GET', 'config')).json(); const d = (j.docs || []).find(x => x.id === 'fechamentos'); return (d && d.data && d.data.meses) || {}; };
const meses = await lerFech();
check(Object.keys(meses).length === 13, 'abrir o app fechou sozinho os 13 meses com movimento (' + Object.keys(meses).length + ')');
const ult = meses[mes(-1)];
check(!!ult && ult.auto === true && !ult.retro && Math.abs(ult.recebido - 10000) < 0.01 && Math.abs(ult.pago - 3000) < 0.01 && ult.patrimonio !== null, 'o mês passado foi guardado com recebido 10.000, pago 3.000 e patrimônio: ' + JSON.stringify(ult));
check(!!meses[mes(-5)] && meses[mes(-5)].retro === true, 'os meses antigos entram como "calculado" (retroativos)');
await abrirHist();
let t = await txt();
check(new RegExp('foi fechado sozinho em').test(t) && /primeira vez que você abre no dia 1º/.test(t), 'o Histórico explica o fechamento automático e diz quando o último mês foi fechado');
check(await page.evaluate(() => Array.from(document.querySelectorAll('#anRecorteSeg button')).map(b => b.textContent).join('|')) === '6 meses|12 meses|Ano|Tudo', 'recortes: 6 meses | 12 meses | Ano | Tudo');
check(await linhas() === 5, 'recorte de 6 meses (inclui o mês atual): 5 meses fechados na tabela (' + await linhas() + ')');
await page.click('[data-an-recorte="12"]'); await page.waitForTimeout(500); check(await linhas() === 11, '12 meses: 11 meses fechados');
const doAno = []; for (let n = -1; n >= -13; n--) if (mes(n).slice(0, 4) === mes(0).slice(0, 4)) doAno.push(n);
await page.click('[data-an-recorte="ano"]'); await page.waitForTimeout(500); check(await linhas() === doAno.length, 'Ano: só os meses fechados deste ano (' + doAno.length + ')');
await page.click('[data-an-recorte="tudo"]'); await page.waitForTimeout(500); check(await linhas() === 13, 'Tudo: os 13 meses');
await page.click('[data-an-recorte="6"]'); await page.waitForTimeout(500);
t = await txt();
check(!/Quanto o caixa deve ficar|Projeção do caixa/i.test(t) && /Quanto entrou por mês/.test(t) && /Recebido x gasto/.test(t) && /Patrimônio ao fim de cada mês/.test(t), 'os gráficos de hoje continuam (entrou por mês, recebido x gasto, patrimônio)');
check(await page.evaluate(() => document.querySelectorAll('#anWrap .an-kpis4 .ct-ic').length) === 4, 'os 4 cartões do topo (recebido, gasto, sobra e melhor mês) têm ícone');
check(await page.evaluate(() => !!document.querySelector('#anWrap .an-lin-pat') && !!document.querySelector('#anWrap svg path[fill="url(#anGradPat)"]') && document.querySelectorAll('#anWrap .an-pat-pt').length === 6 && document.querySelectorAll('#anWrap .an-pat-pt.parcial').length === 1), 'patrimônio é uma linha com área e 6 pontos, o mês atual vazado (em andamento)');
const detAntes = await page.evaluate(() => document.querySelector('#anWrap .an-pat-det').innerText);
await page.locator('#anWrap rect[data-an-pat]').nth(2).click({ force: true }); await page.waitForTimeout(400);
const detDepois = await page.evaluate(() => document.querySelector('#anWrap .an-pat-det').innerText);
check(detAntes !== detDepois && /Total/.test(detDepois) && /Contas/.test(detDepois) && /Reserva/.test(detDepois), 'tocar num ponto da linha mostra o patrimônio daquele mês (contas, reserva, outras metas)');
check(await page.evaluate(() => { const g = document.querySelector('#anWrap .an-duas'); return !!g && /Patrimônio ao fim/.test(g.innerText) && /Recebido x gasto/.test(g.innerText); }), 'patrimônio e recebido × gasto ficam lado a lado, logo depois dos indicadores');
check(await page.evaluate(() => !!document.querySelector('[data-an-ir="anFechados"]')), 'o link "por mês ›" leva à tabela de meses fechados');
// 2) tabela: auto x calculado
check(await page.evaluate(() => { const l = Array.from(document.querySelectorAll('#anWrap .an-fech tbody tr')); return /auto/.test(l[0].innerText) && /calculado/.test(l[l.length - 1].innerText); }), 'o mês mais novo mostra "auto" e os antigos "calculado"');
check(!/mudou depois/.test(await tabela()), 'nada mudou depois do fechamento ainda');
// 3) comparar dois meses
check(/Comparar dois meses/.test(t) && /Patrimônio final/.test(t) && /Despesas pagas/.test(t) && /Resultado PJ/.test(t) && /Reserva/.test(t), 'Comparar dois meses tem patrimônio, recebido, despesas, resultado PJ/PF e reserva');
check(/Recebido[\s\S]{0,60}\+\s*R\$\s*4\.000,00/.test(await page.evaluate(() => document.querySelector('#anWrap .an-cmp-sel').parentElement.innerText)), 'por padrão compara os dois últimos meses: recebido 6.000 → 10.000 (+ R$ 4.000,00)');
await page.selectOption('[data-an-cmp="a"]', mes(-3)); await page.waitForTimeout(400);
check(/Recebido[\s\S]{0,60}\+\s*R\$\s*6\.000,00/.test(await page.evaluate(() => document.querySelector('#anWrap .an-cmp-sel').parentElement.innerText)), 'trocando o primeiro mês para 3 meses atrás (4.000), a diferença vira + R$ 6.000,00');
// 4) exportar
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-an-exportar]')]); const nome = dl.suggestedFilename(); const conteudo = require_text(await dl.createReadStream());
function require_text(stream) { return stream; }
const corpo = await new Promise(res => { let b = ''; conteudo.on('data', c => b += c); conteudo.on('end', () => res(b)); });
check(nome === 'meses-fechados.csv' && /Mês;Patrimônio;Recebido/.test(corpo) && corpo.split('\r\n').length === 6, 'exportar baixa meses-fechados.csv com o cabeçalho e os 5 meses do recorte');
// 5) "mudou depois" e refazer
await api('PUT', 'despesas/dnova', { nome: 'Gasto esquecido', coluna: 'pj', tipo: 'unica', valor: 1200, data: mes(-1) + '-20', mesReferencia: mes(-1), categoria: 'estrutura', pago: true, dataPagamento: mes(-1) + '-20', criadoEm: agora });
await page.reload(); await page.waitForTimeout(5000); await abrirHist(); t = await txt();
check(/mudou depois/.test(await tabela()) && await page.locator('[data-an-refazer]').count() === 1, 'lançamento novo num mês fechado: aparece "mudou depois" com o botão refazer (só nesse mês)');
await page.click('[data-an-refazer]'); await page.waitForTimeout(1200); t = await txt();
check(!/mudou depois/.test(await tabela()) && await page.evaluate(() => /refeito/.test(document.querySelector('#anWrap .an-fech tbody tr').innerText)), 'refazer atualiza o fechamento e marca como "refeito"');
const m2 = await lerFech();
check(m2[mes(-1)] && Math.abs(m2[mes(-1)].pago - 4200) < 0.01 && m2[mes(-1)].refeito === true, 'o fechamento refeito guardou as despesas pagas novas (4.200)');
// 6) Último mês repaginado
await page.evaluate(() => document.querySelector('[data-an-periodo="ult"]').click()); await page.waitForTimeout(600); t = await txt();
check(/RECEBI/i.test(t) && /GASTEI/i.test(t) && /PATRIMÔNIO/i.test(t) && /De onde veio/.test(t) && /Para onde o dinheiro foi/.test(t) && /vs\. média/.test(t), 'Último mês: indicadores com comparação, de onde veio e para onde foi');
check(await page.evaluate(() => !!document.querySelector('#anWrap .an-rosca svg') && document.querySelectorAll('#anWrap .an-duas').length === 2), 'gráfico de rosca e cartões lado a lado');
if (process.env.SHOT) { await page.screenshot({ path: process.env.SHOT + 'ultimo-novo.png', fullPage: true }); await page.evaluate(() => document.querySelector('[data-an-periodo="hist"]').click()); await page.waitForTimeout(600); await page.screenshot({ path: process.env.SHOT + 'historico-novo.png', fullPage: true }); }
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
