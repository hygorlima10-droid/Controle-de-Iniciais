// Fase 5, etapa 5.9 (homologação por papel): varre todas as abas e sub-abas que cada papel enxerga — proprietário, advogada e estagiário —,
// no computador e no celular, com dados de verdade, procurando o que não pode acontecer: erro de script, pedido recusado pelo servidor, texto "undefined/NaN",
// rolagem para o lado, e VAZAMENTO (finanças, backup, cobrança e totais onde o papel não pode ver).
// Servidor individual com banco semeado (grupo 'permissoes'):  node test/rodar.mjs homologacao-papeis   (SHOT=/pasta/ guarda uma foto de cada tela)
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono');
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), dia = (n) => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
/* ---- dados de verdade: processos da Ana (com e sem divisão), um dividido com o proprietário, acordo, alvará, agenda e repasse ---- */
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
const adv = [{ oab: '11111/GO', nome: 'Ana Advogada' }];
const divisao = { partes: [{ oab: '60456/GO', nome: 'Dono Teste', pct: 70 }, { oab: '11111/GO', nome: 'Ana Advogada', pct: 30 }] };
const caso = (id, cliente, num, ps, extra = {}) => dono('PUT', '/api/db/casos/' + id, { tipo: 'inicial', cliente, nomeAcao: 'Cobrança', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: ps.reduce((t, p) => t + p.valor, 0), parcelas: ps.map((p, i) => ({ numero: i + 1, ...p })), numeroProcesso: num, advogados: adv, criadoEm: agora, ...extra });
await caso('hp1', 'Maria Homologa', '0000901-01.2024.8.09.0901', [{ valor: 1000, data: dia(-40), pago: true, dataRecebimento: dia(-40), recebidoEm: agora, divisaoRec: { recebeu: '11111/GO', partes: divisao.partes, por: 'Ana Advogada', porChave: '11111/GO', em: agora } }, { valor: 1000, data: dia(-10) }, { valor: 1000, data: dia(20) }], { divisao, advogados: [{ oab: '60456/GO', nome: 'Dono Teste' }, ...adv] });
await caso('hp2', 'José Homologa', '0000902-02.2024.8.09.0902', [{ valor: 2000, data: dia(-5) }, { valor: 2000, data: dia(25) }]);
await caso('hp3', 'Cooperativa Homologa', '0000903-03.2024.8.09.0903', [{ valor: 3000, data: dia(8) }], { status: 'protocolada' });
await dono('PUT', '/api/db/termosAcordo/hpa', { partes: 'Carlos x Banco', numeroProcesso: '0000901-01.2024.8.09.0901', origem: 'proprio', status: 'pendente', valorTotal: 2700, valorMeuHonorario: 2700, parcelas: [{ numero: 1, valor: 900, data: dia(-3), pago: false }, { numero: 2, valor: 900, data: dia(27), pago: false }], advogados: adv, criadoEm: agora });
await dono('PUT', '/api/db/alvaras/hpv', { numeroProcesso: '0000902-02.2024.8.09.0902', partes: 'Rita x INSS', origem: 'proprio', valorTotalHonorarios: 6000, valorMeuHonorario: 4000, status: 'pendente', fase: 'expedido', faseDesde: dia(-4), previsaoLevantamento: dia(12), advogados: adv, criadoEm: agora });
for (const [id, n, num] of [['hpr1', 'Maria Homologa x Banco', '0000901-01.2024.8.09.0901'], ['hpr2', 'José Homologa x INSS', '0000902-02.2024.8.09.0902']]) await dono('PUT', '/api/db/processos/' + id, { numero: num, partes: n, classe: 'Procedimento comum', honorarios: 'sem', arquivado: false, origem: 'manual', clienteIds: [], advogados: adv, criadoEm: agora });
await dono('PUT', '/api/db/clientes/hpcl1', { nome: 'Maria Homologa', pagador: 'cliente', criadoEm: agora });
await dono('PUT', '/api/db/agenda/hpg1', { tipo: 'prazo', titulo: 'Contestação Homologa', cliente: 'Maria Homologa', processo: '0000901-01.2024.8.09.0901', data: dia(3), trabalhar: dia(0), situacao: 'afazer', concluido: false, avisos: [], resp: ['u:u2'], criadoPor: 'u1', criadoEm: agora });
await dono('PUT', '/api/db/agenda/hpg2', { tipo: 'audiencia', titulo: 'Audiência Homologa', data: dia(5), hora: '14:00', situacao: 'afazer', concluido: false, avisos: [], compartilhada: true, criadoPor: 'u1', criadoEm: agora });
await dono('PUT', '/api/db/repasses/hprp1', { docTipo: 'caso', docId: 'hp1', chave: 'hp1|parcela|1', valor: 700, cliente: 'Maria Homologa', processo: '0000901-01.2024.8.09.0901', label: 'Parcela 1/3', de: { oab: '11111/GO', nome: 'Ana Advogada' }, para: { oab: '60456/GO', nome: 'Dono Teste' }, status: 'pendente', criadoEm: agora });

const br = await chromium.launch(), achados = [];
const VPS = [{ nome: 'computador', w: 1280, h: 900 }, { nome: 'celular', w: 390, h: 844 }];
const VAZA = /Saldo da PJ|Saldo da PF|Patrimônio|Hygor \(PJ\)|Pessoa física|Divisão do mês|Orçamento|Extratos do banco|Relatório (do|p\/) Murilo|Nenhum backup|Fazer backup|Backup e restauração|Exportar lista/;
const TELAS = [['inicio', 'inicio'], ['iniciais', 'peticoes'], ['acordos', 'acordos'], ['alvaras', 'alvaras'], ['agenda', 'agenda'], ['processos', 'processos'], ['publicacoes', 'publicacoes'], ['clientes', 'clientes'], ['arquivados', 'arquivados'], ['conta', 'configuracoes']];
for (const q of (globalThis.__PAPEIS || ['ana', 'caio'])) for (const vp of VPS) {
  console.log('\n— ' + { dono: 'proprietário', ana: 'advogada', caio: 'estagiário' }[q] + ' · ' + vp.nome);
  const ctx = await br.newContext({ viewport: { width: vp.w, height: vp.h } }); await ctx.addCookies([{ name: 'sessao', value: TOK[q], url: B }]);
  const page = await ctx.newPage(), erros = [], reqs = [];
  page.on('pageerror', (e) => erros.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
  page.on('response', (x) => { if (x.status() >= 400 && !/fonts\./.test(x.url())) reqs.push(x.status() + ' ' + x.url().replace(B, '')); });
  await page.route(/fonts\./, (x) => x.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await page.goto(B + '/'); await page.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && document.getElementById('mainTabs'), null, { timeout: 60000 }); await page.waitForTimeout(3500);
  const varrer = async (rot) => {
    const o = await page.evaluate(() => {
      const txt = document.body.innerText, ruim = []; const re = /undefined|NaN|\[object|Invalid Date|R\$\s*-0,00|\bnull\b/g; let m; while ((m = re.exec(txt)) && ruim.length < 3) ruim.push(txt.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, ' '));
      const visivel = [...document.querySelectorAll('.wrap, #drawer, #btbar, .topbar')].map((e) => e.innerText).join('\n');
      return { ruim, txt: visivel, lado: document.documentElement.scrollWidth > window.innerWidth + 1 ? document.documentElement.scrollWidth + '>' + window.innerWidth : '', btnPagar: [...document.querySelectorAll('[data-baixa-doc],[data-pf="baixa"],[data-acordo-status],[data-alvara-status],[data-cli-cobrar]')].filter((e) => e.offsetParent !== null).length };
    });
    const tag = q + ' · ' + vp.nome + ' · ' + rot;
    if (o.ruim.length) achados.push(tag + ': texto estranho → ' + o.ruim.join(' | '));
    if (o.lado) achados.push(tag + ': rola para o lado (' + o.lado + ')');
    if (q !== 'dono') { const m = VAZA.exec(o.txt); if (m) achados.push(tag + ': aparece "' + m[0] + '" (é do proprietário)'); }
    if (q === 'caio' && o.btnPagar) achados.push(tag + ': ' + o.btnPagar + ' botão(ões) de pagamento/cobrança visível(is) para o estagiário');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'hp-' + q + '-' + vp.nome + '-' + rot.replace(/[^a-z0-9]+/gi, '_') + '.png', fullPage: true });
  };
  for (const [rot, tab] of TELAS) {
    await page.evaluate((t) => document.querySelector('#drawer [data-tab="' + t + '"]').click(), tab); await page.waitForTimeout(700); await varrer(rot);
    if (rot === 'conta' || rot === 'inicio') continue;
    const n = await page.evaluate(() => [...document.querySelectorAll('.md-abas button')].filter((b) => b.getClientRects().length).length);
    for (let i = 0; i < Math.min(n, 8); i++) {
      const nome = await page.evaluate((i) => { const b = [...document.querySelectorAll('.md-abas button')].filter((b) => b.getClientRects().length)[i]; if (!b) return null; b.click(); return b.innerText.replace(/\s+/g, ' ').trim().slice(0, 24); }, i);
      if (nome === null) break; await page.waitForTimeout(550); await varrer(rot + ' › ' + nome);
    }
  }
  check(erros.length === 0, 'nenhum erro de script ou de console' + (erros.length ? ' → ' + erros.slice(0, 3).join(' | ') : ''));
  check(reqs.length === 0, 'nenhum pedido recusado pelo servidor' + (reqs.length ? ' → ' + [...new Set(reqs)].slice(0, 6).join(' | ') : ''));
  await ctx.close();
}
await br.close();
for (const id of ['hp1', 'hp2', 'hp3']) await dono('DELETE', '/api/db/casos/' + id);
await dono('DELETE', '/api/db/termosAcordo/hpa'); await dono('DELETE', '/api/db/alvaras/hpv'); await dono('DELETE', '/api/db/processos/hpr1'); await dono('DELETE', '/api/db/processos/hpr2'); await dono('DELETE', '/api/db/clientes/hpcl1');
await dono('DELETE', '/api/db/agenda/hpg1'); await dono('DELETE', '/api/db/agenda/hpg2'); await dono('DELETE', '/api/db/repasses/hprp1');
check(achados.length === 0, 'todas as telas de cada papel limpas (sem texto estranho, rolagem para o lado nem vazamento do que é do proprietário)' + (achados.length ? '\n     - ' + [...new Set(achados)].slice(0, 40).join('\n     - ') : ''));
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
