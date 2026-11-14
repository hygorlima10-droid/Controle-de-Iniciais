// Contagem de prazos (motor da Calculadora) e Dias sem expediente (Configurações): regimes, memória de cálculo, cadastro e ajuste automático das datas já lançadas.
// Use: node test/rodar.mjs prazos
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.62' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['agenda', 'processos', 'casos', 'clientes', 'diasSemExpediente']) { const j = await (await api('GET', '/api/db/' + col)).json(); for (const d of j.docs) await api('DELETE', '/api/db/' + col + '/' + d.id); }
await api('PUT', '/api/db/config/backup', { ultimoEm: agora });
const lerAg = async (id) => (await (await api('GET', '/api/db/agenda')).json()).docs.find(d => d.id === id).data;
const novo = async (o) => (await (await api('POST', '/api/db/agenda', Object.assign({ situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora }, o))).json()).id;
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 420, height: 900 }, timezoneId: 'America/Sao_Paulo' }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
const calc = (op) => page.evaluate((op) => { const r = window.__horusTeste.pzCalcular(op); return JSON.parse(JSON.stringify(r)); }, op);

console.log('\n— motor de contagem');
let c = await calc({ modo: 'dje', data: '2026-11-12', dias: 15, regime: 'cpc' });
check(c.publicacao === '2026-11-13' && c.inicio === '2026-11-16' && c.vencimento === '2026-12-07', 'CPC, disponibilização 12/11/2026, 15 dias úteis: publicação 13/11, começa a contar 16/11, vence 07/12/2026 (' + c.publicacao + ' · ' + c.inicio + ' · ' + c.vencimento + ')');
check(c.passos.some(p => p.iso === '2026-11-20' && p.t === 'pula' && /Consciência|feriado/i.test(p.motivo)) && c.passos.filter(p => p.t === 'conta' || p.t === 'venc').length === 15, 'a memória pula o feriado de 20/11 e conta exatamente 15 dias');
c = await calc({ modo: 'ciencia', data: '2026-11-14', dias: 5, regime: 'cpc' });
check(c.vencimento === '2026-11-24', 'ciência no sábado vale no 1º dia útil seguinte (16/11): 5 dias úteis vencem 24/11 (' + c.vencimento + ')');
c = await calc({ modo: 'inicio', data: '2026-11-16', dias: 5, regime: 'cpc' });
check(c.vencimento === '2026-11-24' && c.inicio === '2026-11-17', '"contar a partir de" 16/11 não conta o dia do começo: 5 dias úteis vencem 24/11 (' + c.vencimento + ')');
c = await calc({ modo: 'dje', data: '2026-11-12', dias: 15, regime: 'cpc', dobro: true });
check(c.total === 30 && c.vencimento > '2026-12-07', 'em dobro: 30 dias úteis (vence em ' + c.vencimento + ')');
c = await calc({ modo: 'dje', data: '2026-12-16', dias: 5, regime: 'cpc' });
check(c.inicio === '2026-12-18' && c.vencimento === '2027-01-26' && c.passos.some(p => p.t === 'pula' && /recesso/i.test(p.motivo)), 'CPC: começa a contar em 18/12, o recesso de 20/12 a 20/01 suspende e a contagem retoma em 21/01: vence 26/01/2027 (' + c.inicio + ' → ' + c.vencimento + ')');
c = await calc({ modo: 'dje', data: '2026-12-16', dias: 5, regime: 'clt' });
check(c.vencimento === '2027-01-26', 'CLT (arts. 775 e 775-A): também suspende no recesso (vence ' + c.vencimento + ')');
c = await calc({ modo: 'ciencia', data: '2026-11-13', dias: 5, regime: 'cpp' });
check(c.inicio === '2026-11-16' && c.vencimento === '2026-11-23' && c.passos.some(p => p.t === 'prorroga'), 'CPP: dias corridos; ciência na sexta começa na segunda (Súmula 310); vence 20/11 (feriado) e passa para 23/11 (' + c.inicio + ' → ' + c.vencimento + ')');
c = await calc({ modo: 'ciencia', data: '2026-11-16', dias: 10, regime: 'adm' });
check(c.vencimento === '2026-11-26' && !c.passos.some(p => p.t === 'prorroga'), 'processo administrativo (Lei 9.784/99): 10 dias contínuos a partir de 16/11 vencem 26/11');
c = await calc({ modo: 'ciencia', data: '2026-11-16', dias: 5, regime: 'custom', unidade: 'corridos', recesso: false, prorroga: true, excluiInicio: true });
check(c.vencimento === '2026-11-23' && c.regime.unidade === 'corridos', 'personalizado: dias corridos, prorrogando para o dia útil (vence sábado 21/11 → 23/11)');
c = await calc({ modo: 'dje', data: '2026-11-12', dias: 15, regime: 'cpc', extras: ['2026-11-17'] });
check(c.vencimento === '2026-12-09', 'dia sem expediente informado no cálculo empurra o vencimento (08/12 é feriado do TJGO, então vence 09/12; deu ' + c.vencimento + ')');
check((await calc({ modo: 'dje', data: '', dias: 5, regime: 'cpc' })).erro && (await calc({ modo: 'dje', data: '2026-11-12', dias: 0, regime: 'cpc' })).erro, 'dados faltando: devolve erro, sem calcular');
// confere com uma contagem independente (dias úteis, vários prazos)
const ok = await page.evaluate(() => {
  const H = window.__horusTeste; let bad = 0, n = 0;
  for (let k = 0; k < 40; k++) {
    const base = H.pbSoma('2026-03-02', k * 9), dias = 3 + (k % 12), r = H.pzCalcular({ modo: 'inicio', data: base, dias, regime: 'cpc' });
    let d = base, c = 0; while (c < dias) { d = H.pbSoma(d, 1); if (!H.pbNaoUtil(d)) c++; }
    n++; if (r.vencimento !== d) bad++;
  }
  return { bad, n };
});
check(ok.bad === 0, 'conferido com contagem independente em ' + ok.n + ' prazos (úteis, CPC): sem diferença');

console.log('\n— dias sem expediente: cadastro e ajuste das datas');
const D = '2027-09-02';
const idManual = await novo({ tipo: 'prazo', titulo: 'Prazo manual no dia', cliente: 'Cliente A', data: D, trabalhar: '2027-09-01' });
const idTrab = await novo({ tipo: 'prazo', titulo: 'Trabalhar no dia', cliente: 'Cliente B', data: '2027-09-10', trabalhar: D });
const idTar = await novo({ tipo: 'tarefa', titulo: 'Tarefa no dia', cliente: 'Cliente C', data: D });
const idAud = await novo({ tipo: 'audiencia', titulo: 'Audiência no dia', cliente: 'Cliente D', data: D, hora: '14:00' });
const idCalc = await novo({ tipo: 'prazo', titulo: 'Prazo calculado', cliente: 'Cliente E', data: '2027-09-10', calculo: { modo: 'dje', data: '2027-08-25', dias: 10, regime: 'cpc' } });
const idFeito = await novo({ tipo: 'prazo', titulo: 'Prazo já protocolado', cliente: 'Cliente F', data: D, concluido: true, situacao: 'feito' });
await page.reload(); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await page.waitForTimeout(600);
check(await page.evaluate(() => !!document.querySelector('#cfWrap [data-cf="dias"]')), 'Configurações tem a linha "Dias sem expediente"');
await page.evaluate(() => document.querySelector('#cfWrap [data-cf="dias"]').click()); await page.waitForTimeout(500);
check(await page.evaluate(() => /feriados nacionais e do TJGO/i.test(document.getElementById('dxC').innerText) && /Pontos facultativos do TJGO em 2026/i.test(document.getElementById('dxC').innerText)), 'a tela explica o que já vale e sugere os pontos facultativos do TJGO');
// data inválida
await page.evaluate(() => { document.getElementById('dx_data').value = '2027-09-04'; document.querySelector('[data-dx="add"]').click(); }); await page.waitForTimeout(400);
check(await page.evaluate(() => /já é dia sem expediente/.test(document.getElementById('dx_erro').innerText)), 'um sábado é recusado (já é dia sem expediente)');
await page.evaluate((d) => { document.getElementById('dx_data').value = d; document.getElementById('dx_tipo').value = 'municipal'; document.getElementById('dx_nome').value = 'Aniversário do município'; document.querySelector('[data-dx="add"]').click(); }, D); await page.waitForTimeout(1800);
check(await page.evaluate((d) => window.__horusTeste.dxTem(d) && window.__horusTeste.pbNaoUtil(d), D), 'o dia cadastrado passa a ser dia sem expediente nos cálculos');
const res = await page.evaluate(() => { const o = document.getElementById('overlayDxRes'); return o && o.classList.contains('show') ? o.innerText.replace(/\s+/g, ' ') : ''; });
check(/4 datas foram adiadas/.test(res) && /Prazo manual no dia/.test(res) && /Trabalhar no dia/.test(res) && /Tarefa no dia/.test(res) && /Prazo calculado/.test(res), 'o resumo mostra as 4 datas adiadas: ' + res.slice(0, 200));
check(/Audiência no dia/.test(res) && /confira com o juízo/.test(res) && !/Prazo já protocolado/.test(res), 'a audiência só gera aviso (não é movida) e o prazo já protocolado fica de fora');
let a = await lerAg(idManual); check(a.data === '2027-09-03' && a.trabalhar === '2027-09-01', 'prazo manual que vencia no dia vai para o próximo dia útil (03/09), mantendo o dia de trabalhar');
a = await lerAg(idTrab); check(a.data === '2027-09-10' && a.trabalhar === '2027-09-03', 'dia de trabalhar que caía no dia vai para o próximo dia útil (03/09), antes do fatal');
a = await lerAg(idTar); check(a.data === '2027-09-03', 'tarefa do dia vai para o próximo dia útil');
a = await lerAg(idAud); check(a.data === D, 'a audiência não foi alterada');
a = await lerAg(idCalc); check(a.data === '2027-09-13', 'prazo calculado é recalculado com o novo dia (10/09 → 13/09)');
a = await lerAg(idFeito); check(a.data === D, 'prazo já protocolado não muda');
// desfazer tudo
await page.evaluate(() => document.querySelector('[data-dxr="desfazer"]').click()); await page.waitForTimeout(1500);
a = await lerAg(idManual); const b2 = await lerAg(idCalc), c2 = await lerAg(idTar);
check(a.data === D && b2.data === '2027-09-10' && c2.data === D, '"Desfazer tudo" devolve as datas ao que eram');
// remover o dia
await page.evaluate(() => document.querySelector('[data-dx="rem"]').click()); await page.waitForTimeout(1200);
check(await page.evaluate((d) => !window.__horusTeste.dxTem(d) && !window.__horusTeste.pbNaoUtil(d), D), 'remover o dia volta a contá-lo como útil');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
