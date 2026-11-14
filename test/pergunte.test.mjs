// Testa o "Pergunte ao app" e os ajustes de uso com um Claude simulado e dados de exemplo.
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --var ANTHROPIC_API_KEY:chave-falsa --var ANTHROPIC_URL:http://127.0.0.1:9996/v1/messages --port 8796
import http from 'node:http'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8796', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const prompts = []; let respostaCenario = { tipo: 'cenario', cenario: { descricao: 'geladeira', tipoEvento: 'gasto', valor: 5000, mes: null, parcelas: 1, entrada: 0 } };
const mock = http.createServer((q, s) => { let d = ''; q.on('data', c => d += c); q.on('end', () => {
  const corpo = JSON.parse(d), texto = corpo.messages[0].content.map(c => c.text || '').join(''); prompts.push({ modelo: corpo.model, texto });
  let out;
  if (/Classifique a pergunta/.test(texto)) out = /geladeira|carro|comprar/i.test(texto.split('Pergunta:')[1] || '') ? respostaCenario : (/dormir|futebol/i.test(texto) ? { tipo: 'fora', cenario: null } : { tipo: 'consulta', cenario: null });
  else if (/comentário curto/.test(texto)) out = 'Mês equilibrado. Atenção às parcelas vencidas.';
  else out = 'Resposta de teste com **R$ 1.000,00** e mais.';
  s.writeHead(200, { 'content-type': 'application/json' }); s.end(JSON.stringify({ content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out) }] }));
}); }).listen(9996);
const dia = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10), mes = n => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.2' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
const caso = (id, cliente, origem, parcelas) => api('PUT', 'casos/' + id, { tipo: 'inicial', cliente, nomeAcao: 'Cobrança', origem, prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: parcelas.reduce((t, p) => t + p.valor, 0), parcelas: parcelas.map((p, i) => ({ numero: i + 1, valor: p.valor, data: p.data, pago: !!p.pago })), clienteIds: [], criadoEm: agora, atualizadoEm: agora, numeroProcesso: '0001234-56.2026.8.26.0100' });
await caso('c1', 'Joana Murilo', 'murilo', [{ valor: 1000, data: dia(-40) }, { valor: 1000, data: dia(-10) }, { valor: 1000, data: dia(20) }]);
await caso('c2', 'Pedro Silva', 'murilo', [{ valor: 2000, data: dia(40), pago: false }]);
await caso('c3', 'Ana Própria', 'proprio', [{ valor: 700, data: dia(15) }, { valor: 700, data: dia(45) }]);
await api('PUT', 'alvaras/v1', { numeroProcesso: '999', partes: 'Ciclano x Banco', origem: 'proprio', valorTotalHonorarios: 9000, valorMeuHonorario: 8000, status: 'pendente', fase: 'expedido', faseDesde: dia(-3), previsaoLevantamento: dia(5), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await api('PUT', 'despesas/d1', { nome: 'Aluguel do escritório', coluna: 'pj', tipo: 'fixa', valorPadrao: 1500, diaVencimento: 10, categoria: 'estrutura', ativa: true, pagamentos: {}, criadoEm: '2026-01-01T00:00:00.000Z' });
await api('PUT', 'despesas/d2', { nome: 'Plano de saúde', coluna: 'pf', tipo: 'fixa', valorPadrao: 800, diaVencimento: 5, categoria: 'outros', ativa: true, pagamentos: {}, criadoEm: '2026-01-01T00:00:00.000Z' });
await api('PUT', 'saldos/pj', { coluna: 'pj', saldoAtual: 4000, atualizadoEm: agora, historico: [{ valor: 4000, data: agora }] });
await api('PUT', 'saldos/pf', { coluna: 'pf', saldoAtual: 1200, atualizadoEm: agora, historico: [{ valor: 1200, data: agora }] });
await api('PUT', 'metas/m1', { tipo: 'reserva', coluna: 'pj', nome: 'Reserva de emergência', movimentos: [{ id: 'i1', tipo: 'inicial', valor: 1000, dia: dia(-30), data: agora }], criadoEm: agora });
await api('PUT', 'metas/m2', { tipo: 'comum', coluna: 'pf', nome: 'Viagem', valorAlvo: 6000, prazo: dia(150), movimentos: [{ id: 'i2', tipo: 'inicial', valor: 1200, dia: dia(-10), data: agora }], criadoEm: agora });
await api('PUT', 'config/backup', { ultimoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 400, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2500);
const texto = sel => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', sel);
// --- alertas
await page.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]') && document.querySelector('#drawer [data-tab="inicio"]').click()); await page.waitForTimeout(1200);
const alertas = await texto('#atencaoLista');
check(await page.evaluate(() => document.querySelectorAll('#atencaoLista [data-pa-alerta]').length) >= 1 && /parcelas vencidas|negativo|Reserva/i.test(alertas) && !(await page.evaluate(() => document.getElementById('paAlertas'))), 'alertas aparecem como linhas da Central de atenção (sem cartão separado): ' + alertas.replace(/\n/g, ' | ').slice(0, 120));
check(await page.evaluate(() => { const l = document.getElementById('atencaoLista'); return l.firstElementChild && l.firstElementChild.hasAttribute('data-pa-alerta'); }), 'os alertas ficam no topo da Central');
// --- dispensar alertas
const temAlerta = ch => page.evaluate(c => !!document.querySelector('#atencaoLista [data-pa-disp="' + c + '"]'), ch);
check(await temAlerta('cliente|Joana Murilo'), 'alerta de cliente tem o botão Dispensar');
await page.click('[data-pa-disp="cliente|Joana Murilo"]'); await page.waitForTimeout(900);
check(!(await temAlerta('cliente|Joana Murilo')) && /dispensado neste mês/.test(await texto('#atencaoLista')), 'dispensar tira o alerta da lista e mostra o aviso "1 alerta dispensado neste mês"');
let cfgAl = await (await api('GET', 'config/alertasDispensados')).json().catch(() => null);
cfgAl = (await (await api('GET', 'config')).json()).docs.find(d => d.id === 'alertasDispensados');
check(cfgAl && JSON.stringify(cfgAl.data[mes(0)]) === JSON.stringify(['cliente|Joana Murilo']) && Object.keys(cfgAl.data).length === 1, 'a dispensa fica gravada no servidor só para o mês atual');
await page.reload(); await page.waitForTimeout(2500);
check(!(await temAlerta('cliente|Joana Murilo')), 'depois de recarregar o alerta continua dispensado');
check(await page.evaluate(() => document.querySelectorAll('#atencaoLista [data-pa-alerta]').length) >= 1, 'os outros alertas continuam aparecendo');
await page.click('[data-pa-restaurar]'); await page.waitForTimeout(900);
check(await temAlerta('cliente|Joana Murilo'), '"mostrar de novo" traz o alerta de volta');
await api('PUT', 'config/alertasDispensados', { [mes(-1)]: ['cliente|Joana Murilo'] });
await page.reload(); await page.waitForTimeout(2500);
check(await temAlerta('cliente|Joana Murilo'), 'dispensa de um mês anterior não vale para o mês atual (o alerta volta)');
// --- pergunte
check(await page.evaluate(() => { const ids = Array.from(document.getElementById('inicioAcoes').children).filter(b => getComputedStyle(b).display !== 'none').map(b => b.id); return ids.join() === 'acRecebi,inicioLerDoc,inicioPergunte'; }), 'faixa de ações no topo: Recebi R$, Foto/PDF, Pergunte (nessa ordem; o "+" é o botão redondo)');
await page.click('#inicioPergunte'); await page.waitForTimeout(300);
await page.fill('#paInput', 'Quanto o Murilo me deve?'); await page.click('#paEnviar'); await page.waitForTimeout(1800);
const p2 = prompts.filter(p => !/Classifique a pergunta/.test(p.texto)).pop(), fatos = JSON.parse(p2.texto.split('CONTEXTO (JSON):\n')[1].split('\nPERGUNTA')[0]);
check(prompts[0].modelo === 'claude-haiku-5-5' && /^claude-sonnet/.test(p2.modelo), 'a 1ª chamada usa o modelo rápido e a 2ª o completo');
check(fatos.aReceber.porOrigem.Murilo === 5000 && fatos.aReceber.porOrigem['própria'] === 9400 && fatos.aReceber.vencido === 2000, 'fatos corretos: Murilo 5.000 (3 parcelas de Joana + Pedro), próprio 9.400, vencido 2.000');
check(fatos.aReceber.porCliente['Joana Murilo'] === 3000 && fatos.saldos.PJ === 4000 && fatos.saldos.PF === 1200, 'fatos: por cliente e saldos');
check(fatos.projecaoMensal.length === 6 && fatos.despesasFixasDoMes.PJ[0].valor === 1500, 'fatos: projeção de 6 meses e despesas fixas');
check(/R\$ 1\.000,00/.test(await texto('#paMsgs')), 'a resposta aparece na tela com formatação');
// cenário
await page.fill('#paInput', 'Posso comprar uma geladeira de R$ 5 mil no mês que vem?'); await page.click('#paEnviar'); await page.waitForTimeout(1800);
const p3 = prompts.filter(p => !/Classifique a pergunta/.test(p.texto)).pop(); const sim = JSON.parse(p3.texto.split('SIMULACAO (JSON):\n')[1].split('\nPERGUNTA')[0]);
const mi = sim.linhas.findIndex(l => l.movimentoDoCenario !== 0);
check(sim.cenario.valorTotal === 5000 && sim.linhas[mi].movimentoDoCenario === -5000 && sim.linhas[mi].saldoSemAlvarasComCenario === Math.round((sim.linhas[mi].saldoSemAlvaras - 5000) * 100) / 100, 'simulação: gasto de 5.000 abate o saldo previsto do mês');
check(sim.linhas.slice(mi + 1).every(l => l.movimentoDoCenario === 0 && Math.abs(l.saldoSemAlvaras - l.saldoSemAlvarasComCenario - 5000) < 0.011), 'simulação: o efeito acumulado continua nos meses seguintes');
check(await page.evaluate(() => !!document.querySelector('#paMsgs .pa-det')), 'tabela "projeção mês a mês" disponível');
check(await page.evaluate(() => !!document.querySelector('#paMsgs [data-sim-pergunte]')), 'a resposta de um "e se" tem o botão "Abrir no Simulador"');
respostaCenario = { tipo: 'cenario', cenario: { descricao: 'carro', tipoEvento: 'gasto', valor: 80000, mes: mes(4), parcelas: 36, entrada: 30000 } };
await page.fill('#paInput', 'E se eu trocar de carro em março com 30 de entrada e 36 parcelas?'); await page.click('#paEnviar'); await page.waitForTimeout(1800);
const p4 = prompts.filter(p => !/Classifique a pergunta/.test(p.texto)).pop(); const sim2 = JSON.parse(p4.texto.split('SIMULACAO (JSON):\n')[1].split('\nPERGUNTA')[0]);
const pagos = sim2.linhas.filter(l => l.movimentoDoCenario !== 0);
check(sim2.cenario.parcelas === 36 && sim2.cenario.valorDeCadaParcela === Math.round(50000 / 36 * 100) / 100 && pagos[0].movimentoDoCenario === -(30000 + sim2.cenario.valorDeCadaParcela) && pagos[1].movimentoDoCenario === -sim2.cenario.valorDeCadaParcela, 'simulação parcelada: entrada de 30.000 + 1ª parcela no mês inicial e as demais depois');
check(sim2.primeiroMesNegativoComCenario !== null || sim2.piorMesSemAlvaras.saldo < 0, 'simulação aponta o mês em que o caixa fica negativo');
await page.fill('#paInput', 'Quero dormir cedo'); await page.click('#paEnviar'); await page.waitForTimeout(1500);
check(/só consigo responder sobre as finanças/.test(await texto('#paMsgs')), 'pergunta fora do assunto: responde sem gastar a 2ª chamada');
await page.evaluate(() => document.getElementById('overlayPergunte').classList.remove('show'));
// --- metas com plano
await page.evaluate(() => document.querySelector('#drawer [data-tab="financeiro"][data-fin="patrimonio"]').click()); await page.waitForTimeout(1200);
check(/Plano: guarde/.test(await texto('#bodyFinanceiro')), 'meta com prazo mostra o plano (quanto guardar por mês e se cabe no fluxo)');
// --- busca
await page.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await page.waitForTimeout(500);
await page.fill('#buscaGlobalInput', 'aluguel'); await page.waitForTimeout(400);
check(/Despesa/.test(await texto('#buscaGlobalResultados')) && /Aluguel do escritório/.test(await texto('#buscaGlobalResultados')), 'busca encontra despesas');
await page.fill('#buscaGlobalInput', '2.000,00'); await page.waitForTimeout(400);
check(/Pedro Silva/.test(await texto('#buscaGlobalResultados')), 'busca por valor encontra a parcela de R$ 2.000,00');
await page.fill('#buscaGlobalInput', 'quanto vou receber do alvará do Ciclano'); await page.waitForTimeout(400);
check(/Perguntar ao app/.test(await texto('#buscaGlobalResultados')), 'sem resultados, a busca oferece "Perguntar ao app"');
await page.fill('#buscaGlobalInput', '');
// --- folha Novo
await page.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
for (let i = 0; i < 3; i++) { await page.click('#fabNew'); await page.waitForTimeout(150); await page.click('[data-novo-k="despesa"]'); await page.waitForTimeout(250); await page.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'))); }
await page.click('#fabNew'); await page.waitForTimeout(200);
const tiles = await page.evaluate(() => Array.from(document.querySelectorAll('#novoGrid [data-novo-k]')).map(b => b.getAttribute('data-novo-k')));
check(tiles.length === 11 && tiles[0] === 'despesa', 'folha "Novo": 11 ações (com Processo e Prazo), a mais usada (Despesa) vem primeiro: ' + tiles.join());
await page.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
check(!(await page.evaluate(() => !!document.getElementById('inicioAtalhos') || !!document.getElementById('fabRecebi') || !!document.getElementById('fabLerDoc'))), 'não há mais fileira de atalhos no fim nem botões flutuantes de Recebi/câmera');
check(await page.evaluate(() => getComputedStyle(document.getElementById('fabNew')).display !== 'none' && document.getElementById('fabNew').getBoundingClientRect().width <= 60), 'no Início o botão + redondo está sempre visível (canto inferior direito)');
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(900);
await page.evaluate(() => document.querySelector('#drawer [data-tab="peticoes"]').click()); await page.waitForTimeout(500);
await page.click('#fabNew'); await page.waitForTimeout(200);
check(await page.evaluate(() => document.querySelector('#novoGrid [data-novo-k]').getAttribute('data-novo-k')) === 'peticao', 'em Petições, o + abre a folha "Novo" com Petição primeiro');
await page.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
await page.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await page.waitForTimeout(600);
// --- desfazer
await page.click('#fabNew'); await page.waitForTimeout(200); await page.click('[data-novo-k="despesa"]'); await page.waitForTimeout(300);
await page.fill('#despesaNomeInput', 'Despesa para desfazer'); await page.fill('#despesaValorInput', '10'); await page.evaluate(() => document.querySelector('#segDespesaTipo [data-value="unica"]').click()); await page.fill('#despesaDataInput', dia(3)); await page.click('#saveBtnDespesa'); await page.waitForTimeout(900);
let ds = await (await api('GET', 'despesas')).json(); check(ds.docs.some(d => d.data.nome === 'Despesa para desfazer'), 'despesa criada');
check(/Desfazer: criou despesa "Despesa para desfazer"/.test(await page.evaluate(() => document.getElementById('desfazerRotulo').textContent)), 'o menu mostra o que será desfeito');
await page.evaluate(() => document.getElementById('desfazerBtn').click()); await page.waitForTimeout(400);
await page.evaluate(() => { const b = document.querySelector('#toast button'); b && b.click(); }); await page.waitForTimeout(900);
ds = await (await api('GET', 'despesas')).json(); check(!ds.docs.some(d => d.data.nome === 'Despesa para desfazer'), 'desfazer remove a despesa criada');
await page.evaluate(() => window.claude.use('db').then(db => db.collection('despesas').doc('d1').set({ nome: 'Aluguel ALTERADO', coluna: 'pj', tipo: 'fixa', valorPadrao: 1, diaVencimento: 10, categoria: 'estrutura', ativa: true, pagamentos: {}, criadoEm: '2026-01-01T00:00:00.000Z' }))); await page.waitForTimeout(500);
await page.evaluate(() => document.getElementById('desfazerBtn').click()); await page.waitForTimeout(300); await page.evaluate(() => { const b = document.querySelector('#toast button'); b && b.click(); }); await page.waitForTimeout(900);
ds = await (await api('GET', 'despesas')).json(); check(ds.docs.find(d => d.id === 'd1').data.nome === 'Aluguel do escritório', 'desfazer restaura a versão anterior de um registro alterado');
// --- fechamento comentado
await page.evaluate(() => document.getElementById('abrirFechamentoBtn').click()); await page.waitForTimeout(400);
check(await page.evaluate(() => getComputedStyle(document.getElementById('comentarFechamentoBtn')).display !== 'none'), 'botão "Comentar o mês" no fechamento');
await page.evaluate(() => document.getElementById('comentarFechamentoBtn').click()); await page.waitForTimeout(1500);
check(/Mês equilibrado/.test(await texto('#fechamentoComentario')), 'o comentário do mês aparece');
await page.evaluate(() => document.getElementById('overlayFechamento').classList.remove('show'));
// --- backup semanal
r = await fetch(B + '/api/backups/agora', { method: 'POST', headers: { cookie: ck } }); let j = await r.json(); check(r.status === 200 && j.docs > 8, 'backup manual: guarda ' + j.docs + ' registros em ' + j.partes + ' parte(s)');
j = await (await fetch(B + '/api/backups', { headers: { cookie: ck } })).json(); check(j.itens.length === 1 && j.itens[0].dia === dia(0), 'lista de backups automáticos');
j = await (await fetch(B + '/api/backups/' + dia(0), { headers: { cookie: ck } })).json();
check(j.versao === 1 && j.casos.length === 3 && j.alvaras.length === 1 && j.despesas.length === 2 && j.saldos.pj.saldoAtual === 4000 && j.metas.length === 2 && j.casos.every(c => c.id), 'backup no formato do app (casos, alvarás, despesas, saldos, metas, com ids)');
await page.evaluate(() => document.getElementById('backupBtn').click()); await page.waitForTimeout(900);
check(/Backups automáticos do servidor/.test(await texto('#paBackups')) && /Baixar/.test(await texto('#paBackups')), 'tela de Backup lista as cópias automáticas');
r = await fetch(B + '/api/backups/agora', { method: 'POST' }); check(r.status === 401, 'backups exigem sessão');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ' -> ' + erros.join(' | ') : ''));
await br.close(); mock.close(); console.log(falhas ? falhas + ' FALHAS' : 'tudo ok'); process.exit(falhas ? 1 : 0);
