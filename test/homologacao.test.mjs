// Fase 4 (homologação da versão individual): varre TODAS as abas e sub-abas, no computador e no celular, com dados de verdade,
// e procura o que não pode acontecer: erro de script, requisição com erro, imagem quebrada, rolagem para o lado,
// texto "undefined", "NaN", "[object Object]", "Invalid Date" e valores com "R$ -0,00".
// Use: node test/rodar.mjs homologacao   (SHOT=/pasta/ guarda uma foto de cada tela)
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hojeD = new Date(Date.now() - 3 * 3600e3), hoje = hojeD.toISOString().slice(0, 10);
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const mes = n => { const d = new Date(hojeD.getFullYear(), hojeD.getMonth() + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.60' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov', 'agenda', 'processos']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('DELETE', 'config/fechamentos'); await api('DELETE', 'config/orcamento'); await api('DELETE', 'config/futuro'); await api('PUT', 'config/backup', { ultimoEm: agora }); await api('PUT', 'config/importacaoAuto', { ativo: false, desde: agora });
// ---- dados de verdade ----
for (const [i, n] of ['Maria Souza', 'José R Silva', 'Cooperativa Teste'].entries()) await api('PUT', 'clientes/cl' + i, { nome: n, pagador: 'cliente', criadoEm: agora });
const caso = (id, cliente, origem, ps, extra = {}) => api('PUT', 'casos/' + id, { tipo: 'inicial', cliente, nomeAcao: 'Cobrança', origem, prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: ps.reduce((t, p) => t + p.valor, 0), parcelas: ps.map((p, i) => ({ numero: i + 1, valor: p.valor, data: p.data, pago: !!p.pago, ...(p.pago ? { dataRecebimento: p.data } : {}) })), clienteIds: [], criadoEm: agora, atualizadoEm: agora, ...extra });
await caso('c1', 'Maria Souza', 'proprio', [{ valor: 1500, data: dia(-40), pago: true }, { valor: 1500, data: dia(-10) }, { valor: 1500, data: dia(20) }]);
await caso('c2', 'José R Silva', 'murilo', [{ valor: 2000, data: dia(-5) }, { valor: 2000, data: dia(25) }]);
await caso('c3', 'Cooperativa Teste', 'proprio', [{ valor: 3000, data: dia(8) }], { status: 'protocolada' });
await api('PUT', 'termosAcordo/a1', { partes: 'Carlos Andrade x Banco', numeroProcesso: '0001234-56.2025.8.09.0107', origem: 'proprio', status: 'pendente', valorTotal: 2700, valorMeuHonorario: 2700, parcelas: [{ numero: 1, valor: 900, data: dia(-3), pago: false }, { numero: 2, valor: 900, data: dia(27), pago: false }, { numero: 3, valor: 900, data: dia(57), pago: false }], data: dia(-3), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await api('PUT', 'alvaras/v1', { numeroProcesso: '5100133-44.2025.8.09.0107', partes: 'Rita x INSS', origem: 'proprio', valorTotalHonorarios: 6000, valorMeuHonorario: 4000, status: 'pendente', fase: 'expedido', faseDesde: dia(-4), previsaoLevantamento: dia(12), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await api('PUT', 'alvaras/v2', { numeroProcesso: '5100134-44.2025.8.09.0107', partes: 'Pedro x Banco', origem: 'murilo', valorTotalHonorarios: 3000, valorMeuHonorario: 1500, status: 'pendente', fase: 'sem', faseDesde: dia(-1), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
const P = (id, num, partes, extra = {}) => api('PUT', 'processos/' + id, { numero: num, partes, classe: 'Procedimento comum', honorarios: 'sem', arquivado: false, origem: 'manual', clienteIds: ['cl0'], criadoEm: agora, ...extra });
await P('p1', '0394419-34.2010.8.09.0107', 'Rogério x Banco'); await P('p2', '5100133-44.2025.8.09.0107', 'Rita x INSS', { honorarios: 'alvara' }); await P('p3', '0001234-56.2025.8.09.0107', 'Carlos x Banco'); await P('p4', '0000999-11.2024.8.09.0107', 'Antigo x Antigo', { arquivado: true, arquivadoEm: agora, resultado: 'procedente' });
const A = (id, o) => api('PUT', 'agenda/' + id, { situacao: 'afazer', concluido: false, avisos: [], criadoEm: agora, ...o });
await A('g1', { tipo: 'prazo', titulo: 'Contestação', cliente: 'Maria Souza', processo: '0394419-34.2010.8.09.0107', data: dia(3), trabalhar: dia(0) }); await A('g2', { tipo: 'prazo', titulo: 'Embargos', cliente: 'José R Silva', data: dia(-6) }); await A('g3', { tipo: 'audiencia', titulo: 'Audiência de instrução', cliente: 'Carlos', data: dia(5), hora: '09:30', modalidade: 'presencial', local: 'Fórum' }); await A('g4', { tipo: 'tarefa', titulo: 'Ligar para a cliente', data: dia(0) }); await A('g5', { tipo: 'prazo', titulo: 'Réplica', data: dia(-20), situacao: 'feito', concluido: true, protocoladoEm: dia(-22) }); await A('g6', { tipo: 'tarefa', titulo: 'Conferir cálculo', data: dia(11) });
for (let n = -7; n <= -1; n++) { await api('PUT', 'receitasManuais/r' + (-n), { nome: 'Honorários', coluna: 'pj', valor: 5000 + (-n) * 300, mesReferencia: mes(n), data: mes(n) + '-04', recorrente: false, criadoEm: agora }); await api('PUT', 'despesas/d' + (-n), { nome: 'Aluguel do escritório', coluna: 'pj', tipo: 'unica', valor: 2500, data: mes(n) + '-12', mesReferencia: mes(n), categoria: 'estrutura', pago: true, dataPagamento: mes(n) + '-12', criadoEm: agora }); await api('PUT', 'despesas/e' + (-n), { nome: 'Plano de saúde', coluna: 'pf', tipo: 'unica', valor: 800, data: mes(n) + '-20', mesReferencia: mes(n), categoria: 'outros', pago: true, dataPagamento: mes(n) + '-20', criadoEm: agora }); }
await api('PUT', 'despesas/f1', { nome: 'Contador', coluna: 'pj', tipo: 'fixa', valorPadrao: 600, diaVencimento: 25, categoria: 'estrutura', ativa: true, pagamentos: {}, criadoEm: '2026-01-01T00:00:00.000Z' });
await api('PUT', 'despesas/f2', { nome: 'Energia', coluna: 'pf', tipo: 'fixa', valorPadrao: null, diaVencimento: 27, categoria: 'outros', ativa: true, pagamentos: {}, criadoEm: '2026-01-01T00:00:00.000Z' });
await api('PUT', 'receitasManuais/rf', { nome: 'Consultoria mensal', coluna: 'pj', valorPadrao: 1200, recorrente: true, data: mes(-3) + '-01', recebimentos: {}, criadoEm: agora });
await api('PUT', 'saldos/pj', { coluna: 'pj', saldoAtual: 9000, atualizadoEm: agora, historico: [{ valor: 4000, data: mes(-6) + '-10T12:00:00.000Z' }, { valor: 9000, data: agora }] }); await api('PUT', 'saldos/pf', { coluna: 'pf', saldoAtual: 1500, atualizadoEm: agora, historico: [{ valor: 1500, data: agora }] });
await api('PUT', 'metas/m1', { tipo: 'reserva', coluna: 'pj', nome: 'Reserva de emergência', movimentos: [{ id: 'i1', tipo: 'inicial', valor: 4000, dia: dia(-60), data: agora }], criadoEm: agora }); await api('PUT', 'metas/m2', { tipo: 'comum', coluna: 'pf', nome: 'Viagem', valorAlvo: 6000, prazo: dia(150), movimentos: [{ id: 'i2', tipo: 'inicial', valor: 1200, dia: dia(-10), data: agora }], criadoEm: agora });
await api('PUT', 'config/obra', { nome: 'Casa', criada: true, orcamentoTotal: 450000, criadoEm: agora, financiamento: { status: 'estimado', valor: 300000, banco: 'Sicoob' }, etapas: [{ id: 'e1', nome: 'Terraplanagem', orcado: 22000, status: 'andamento', ordem: 1 }, { id: 'e2', nome: 'Fundação', orcado: 90000, status: 'a_fazer', ordem: 2 }], contratos: [], extrato: { palavras: '', regras: {} } });
await api('PUT', 'obraMov/a1', { tipo: 'aporte', origem: 'externo', data: dia(-30), valor: 30000, criadoEm: agora }); await api('PUT', 'obraMov/g1', { tipo: 'gasto', etapaId: 'e1', descricao: 'Máquina', valor: 12000, status: 'pago', data: dia(-5), dataPagamento: dia(-5), criadoEm: agora }); await api('PUT', 'obraMov/g2', { tipo: 'gasto', etapaId: 'e2', descricao: 'Ferragem', valor: 9000, status: 'apagar', data: dia(-1), vencimento: dia(6), criadoEm: agora });
await api('PUT', 'config/orcamento', { limites: { Estrutura: { [mes(-1)]: 3000 }, Outros: { [mes(0)]: 700 } } });
await api('PUT', 'config/extratos', { pastaId: 'p', pastaNome: 'extratos', iniciado: true, dataCorte: dia(-60), configuradoEm: agora, contas: { 'itau-1': { coluna: 'pj', rotulo: 'Itaú · PJ', banco: 'Itaú', confirmada: true, titular: {}, ultimoSaldo: { valor: 900000, emitido: agora } } }, regras: {} });
await api('PUT', 'extratos/arq_x', { tipo: 'arquivo', fileId: 'x', titulo: 'x.pdf', lidoEm: agora, status: 'pendente', motivo: '', chave: 'itau-1', banco: 'Itaú', tipoConta: 'pj', ag: '', cc: '1', titular: {}, de: dia(-20), ate: dia(-1), emitido: agora, saldoAtual: 900000, saldoNovo: false, saldoFecha: true, nConf: 1, nDiverg: 0, nTotal: 2, nRep: 0, nDescartadas: 0, corte: dia(-60), lanc: [{ h: 'h1', d: dia(-5), s: 'PIX RECEBIDO', n: 'MARIA SOUZA', o: '', v: 150000 }, { h: 'h2', d: dia(-4), s: 'COMPRA SUPERMERCADO', n: '', o: '', v: -8000 }] });
const br = await chromium.launch();
const achados = [];
const RUIM = /undefined|NaN|\[object|Invalid Date|R\$\s*-0,00|null\b/;
/* cada tela leva uns 2 minutos: o computador e o celular rodam em testes separados (homologacao-celular chama este arquivo com __VP = 'celular') */
const VPS = { computador: { nome: 'computador', w: 1280, h: 900 }, celular: { nome: 'celular', w: 390, h: 844 } };
for (const vp of [VPS[globalThis.__VP || 'computador']]) {
  const ctx = await br.newContext({ viewport: { width: vp.w, height: vp.h } }); const page = await ctx.newPage(); const erros = [], reqs = [];
  page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
  page.on('response', x => { if (x.status() >= 400 && !/fonts\.|\/api\/(ler|recebidos)/.test(x.url())) reqs.push(x.status() + ' ' + x.url().replace(B, '')); });
  await page.route(/fonts\./, x => x.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(5500);
  const varrer = async (rot) => {
    const o = await page.evaluate(() => {
      const txt = document.body.innerText, ruim = []; const re = /undefined|NaN|\[object|Invalid Date|R\$\s*-0,00|\bnull\b/g; let m; while ((m = re.exec(txt)) && ruim.length < 3) ruim.push(txt.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, ' '));
      const quebradas = Array.from(document.images).filter(i => i.getClientRects().length && i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src').slice(0, 60));
      return { ruim, quebradas, lado: document.documentElement.scrollWidth > window.innerWidth + 1 ? document.documentElement.scrollWidth + '>' + window.innerWidth : '' };
    });
    if (o.ruim.length) achados.push(vp.nome + ' · ' + rot + ': texto estranho → ' + o.ruim.join(' | '));
    if (o.quebradas.length) achados.push(vp.nome + ' · ' + rot + ': imagem quebrada → ' + o.quebradas.join(', '));
    if (o.lado) achados.push(vp.nome + ' · ' + rot + ': rola para o lado (' + o.lado + ')');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'h-' + vp.nome + '-' + rot.replace(/[^a-z0-9]+/gi, '_') + '.png', fullPage: true });
  };
  const abrir = async (sel) => { await page.evaluate(s => document.querySelector(s).click(), sel); await page.waitForTimeout(1100); };
  const telas = [['inicio', '[data-tab="inicio"]'], ['iniciais', '[data-tab="peticoes"]'], ['acordos', '[data-tab="acordos"]'], ['alvaras', '[data-tab="alvaras"]'], ['agenda', '[data-tab="agenda"]'], ['processos', '[data-tab="processos"]'], ['publicacoes', '[data-tab="publicacoes"]'], ['clientes', '[data-tab="clientes"]'], ['arquivados', '[data-tab="arquivados"]'],
    ['fin-visao', '[data-fin="resumo"]'], ['fin-divisao', '[data-fin="geral"]'], ['fin-pj', '[data-fin="pj"]'], ['fin-pf', '[data-fin="pf"]'], ['fin-patrimonio', '[data-fin="patrimonio"]'], ['fin-orcamento', '[data-fin="orcamento"]'], ['analises', '[data-tab="analises"]'], ['construcao', '[data-tab="obra"]'], ['extratos', '[data-tab="extratos"]'], ['configuracoes', '[data-tab="configuracoes"]']];
  for (const [rot, sel] of telas) {
    await abrir('#drawer ' + sel); await varrer(rot);
    // sub-abas (barra de abas do módulo e seletores de Análises)
    /* sub-abas: a barra do módulo; em Análises o seletor do período; na Construção as abas da obra; as sub-abas de Finanças já são visitadas pelo menu */
    const SUB = rot.startsWith('fin-') ? null : (rot === 'analises' ? '#anPeriodoSeg button' : (rot === 'construcao' ? '#obAbas button' : '.md-abas button'));
    if (!SUB) continue;
    const n = await page.evaluate((S) => Array.from(document.querySelectorAll(S)).filter(b => b.getClientRects().length).length, SUB);
    for (let i = 0; i < Math.min(n, 8); i++) {
      const nome = await page.evaluate(([S, i]) => { const b = Array.from(document.querySelectorAll(S)).filter(b => b.getClientRects().length)[i]; if (!b) return null; b.click(); return b.innerText.replace(/\s+/g, ' ').trim().slice(0, 24); }, [SUB, i]);
      if (nome === null) break; await page.waitForTimeout(900); await varrer(rot + ' › ' + nome);
    }
  }
  check(erros.length === 0, vp.nome + ': nenhum erro de script ou de console' + (erros.length ? ' → ' + erros.slice(0, 3).join(' | ') : ''));
  check(reqs.length === 0, vp.nome + ': nenhuma requisição com erro' + (reqs.length ? ' → ' + reqs.slice(0, 5).join(' | ') : ''));
  await ctx.close();
}
await br.close();
check(achados.length === 0, 'todas as abas e sub-abas limpas (sem texto estranho, imagem quebrada nem rolagem para o lado)' + (achados.length ? '\n     - ' + achados.slice(0, 40).join('\n     - ') : ''));
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
