// Testa o aplicativo por papel (Fase 5, etapa 5.7): Finanças e o que é do proprietário somem para advogado e estagiário (menu, barra, abas, atalhos, avisos),
// ninguém além do proprietário gera pedidos recusados, Cobrança só para o advogado (e só com os clientes dos processos dele), "Minha conta".
// Servidor individual com banco semeado (grupo 'permissoes'):  node test/rodar.mjs papel-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, m, pth, b) => { const x = await fetch(B + pth, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); return x.status; };
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), ontem = new Date(Date.now() - 27 * 3600e3).toISOString().slice(0, 10);
const caso = (cliente, num, oab) => ({ tipo: 'inicial', origem: 'proprio', prioridade: 'normal', status: 'pendente', cliente, nomeAcao: 'Ação', numeroProcesso: num, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 700, avista: { data: ontem, pago: false }, advogados: [{ oab, nome: 'X' }], criadoEm: new Date().toISOString() });
await api('dono', 'PUT', '/api/db/casos/pt1', caso('Cobranca da Ana', '0000901-11.2024.8.09.0901', '11111/GO'));
await api('dono', 'PUT', '/api/db/casos/pt2', caso('Cobranca do Bruno', '0000902-22.2024.8.09.0902', '22222/GO'));
const br = await chromium.launch();
async function abrir(quem, largura = 1280) {
  const ctx = await br.newContext({ viewport: { width: largura, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]);
  const page = await ctx.newPage(); page.recusados = []; page.erros = [];
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) page.recusados.push(r.status() + ' ' + r.url().replace(B, '')); });
  page.on('pageerror', (e) => page.erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) page.erros.push('console: ' + m.text()); });
  await page.route(/fonts\./, (x) => x.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await page.goto(B + '/'); await page.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.ppItemAtencaoOk && document.getElementById('mainTabs'), null, { timeout: 60000 }); await page.waitForTimeout(3000); return page;
}
const VAZA = ['Visão geral', 'Divisão do mês', 'Hygor (PJ)', 'Pessoa física', 'Patrimônio', 'Orçamento', 'Análises', 'Construção', 'Extratos do banco', 'Recebi R$', 'Fechamento do mês', 'Relatório do Murilo', 'Backup e restauração', 'Exportar lista'];
const visiveis = (p) => p.evaluate(() => [...document.querySelectorAll('#drawer .dr-it, #drawer .dr-grp')].filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));
for (const q of ['ana', 'caio']) {
  console.log('\n— ' + (q === 'ana' ? 'advogada (Ana)' : 'estagiário (Caio)'));
  const p = await abrir(q), v = await visiveis(p);
  check(!['Financeiro', ...VAZA].some((x) => v.some((t) => t.includes(x))), 'o menu não mostra Financeiro nem nada do proprietário: ' + v.join(' | '));
  check(v.some((t) => t.includes('Minha conta')), 'Configurações vira "Minha conta"');
  check(v.some((t) => t.includes('Cobrança')) === (q === 'ana'), q === 'ana' ? 'a advogada tem "Cobrança de clientes"' : 'o estagiário não tem "Cobrança de clientes"');
  check(!(await p.locator('#avisoSistema').isVisible()), 'sem aviso de backup/limites do sistema');
  for (const t of ['financeiro', 'analises', 'extratos', 'obra']) {
    await p.evaluate((t) => { const b = document.createElement('button'); b.setAttribute('data-tab', t); b.className = 'dr-it'; document.getElementById('mainTabs').appendChild(b); b.click(); b.remove(); }, t); await p.waitForTimeout(250);
    check((await p.locator('#tituloTela').innerText()) === 'Início', 'a tela "' + t + '" não abre (volta ao Início)');
  }
  const ok = await p.evaluate(() => { const f = window.__horusTeste.ppItemAtencaoOk; return ['despesa', 'relatorio', 'obra', 'murilo'].map((o) => f({ origem: o })).concat([f({ origem: 'upcoming', ehPrazo: true }), f({ origem: 'upcoming', ehPrazo: false }), f({ origem: 'promessa' }), f({ origem: 'parado' })]); });
  check(ok.slice(0, 4).every((x) => !x) && ok[4] && ok[7] && ok[5] === (q === 'ana') && ok[6] === (q === 'ana'), 'Central de atenção: sem relatório do Murilo, despesas, obra; prazos sim; parcelas e promessas só para a advogada: ' + ok.join(','));
  check(p.recusados.length === 0, 'nenhum pedido recusado pelo servidor' + (p.recusados.length ? ': ' + [...new Set(p.recusados)].join(' | ') : ''));
  check(p.erros.length === 0, 'sem erros de JavaScript' + (p.erros.length ? ': ' + p.erros.join(' | ') : ''));
  const totais = await p.evaluate(() => document.documentElement.classList.contains('sem-totais'));
  check(totais === (q === 'caio'), q === 'caio' ? 'estagiário sem "Ver totais": totais escondidos' : 'advogada com "Ver totais" (padrão): totais visíveis');
  await p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await p.waitForTimeout(500);
  const cf = await p.locator('#cfWrap').innerText();
  check(/Minha conta/.test(cf) && !/Usuários|Backup|Exportar|Lixeira|Registro|Extratos/.test(cf), 'a tela "Minha conta" só tem a conta da pessoa: ' + cf.replace(/\n/g, ' | ').slice(0, 120));
  await p.evaluate(() => document.querySelector('#cfWrap [data-cf="seguranca"]').click()); await p.waitForTimeout(900);
  const sg = await p.locator('#overlaySgSegC').innerText().catch((e) => 'ERRO ' + e.message.slice(0, 60));
  check(/sessões abertas/i.test(sg) && p.recusados.length === 0, 'senha e aparelhos funcionam para a própria pessoa: ' + sg.replace(/\n/g, ' ').slice(0, 80) + ' · ' + p.recusados.join(','));
  if (q === 'ana') {
    await p.keyboard.press('Escape'); await p.evaluate(() => { document.getElementById('overlaySgSeg').classList.remove('show'); document.querySelector('#drawer [data-tab="inicio"]').click(); }); await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById('abrirCobrancaMenuBtn').click()); await p.waitForTimeout(1200);
    const t = await p.locator('#overlayRelMurilo').innerText();
    check(await p.locator('#overlayRelMurilo').isVisible(), 'a Cobrança abre para a advogada');
    check(!(await p.locator('#relModoSeg').isVisible()), 'sem a opção "Murilo" na Cobrança');
    check(/Cobranca da Ana/.test(t) && !/Cobranca do Bruno/.test(t), 'só os clientes dos processos dela aparecem na Cobrança: ' + t.replace(/\n/g, ' ').slice(0, 160));
  }
  await p.context().close();
}
console.log('\n— barra de baixo no celular');
for (const q of ['ana', 'dono']) {
  const p = await abrir(q, 390), b = await p.evaluate(() => [...document.querySelectorAll('#btbar .bt-it')].filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));
  check(q === 'ana' ? (b.includes('Agenda') && !b.includes('Finanças')) : (b.includes('Finanças') && !b.includes('Agenda')), (q === 'ana' ? 'advogada' : 'proprietário') + ': ' + b.join(' · '));
  await p.context().close();
}
console.log('\n— proprietário não muda');
{
  const p = await abrir('dono'), v = await visiveis(p);
  const falta = ['Visão geral', 'Análises', 'Extratos do banco', 'Recebi R$', 'Cobrança de clientes', 'Configurações'].filter((x) => !v.some((t) => t.includes(x)));
  check(!falta.length, 'o menu do proprietário continua inteiro' + (falta.length ? ' (faltam: ' + falta.join(', ') + ' · há: ' + v.join(' | ') + ')' : ''));
  await p.evaluate(() => document.querySelector('#drawer [data-tab="financeiro"]').click()); await p.waitForTimeout(500);
  check(await p.locator('#bodyFinanceiro').isVisible(), 'o proprietário abre as Finanças');
  await p.context().close();
}
console.log('\n— totais e honorários por papel');
{
  const c = await abrir('caio'); await c.evaluate(() => document.querySelector('#drawer [data-tab="peticoes"]').click()); await c.waitForTimeout(900);
  const abas = await c.evaluate(() => [...document.querySelectorAll('#mdAbas-peticoes button')].map((b) => b.textContent.trim()));
  const sub = await c.locator('#subtitle').innerText();
  check(!abas.some((x) => /Resumo|Recebimentos/.test(x)) && abas.length >= 2, 'estagiário sem "Ver totais": Iniciais sem as sub-abas Resumo e Recebimentos: ' + abas.join(' · '));
  check(!/R\$/.test(sub), 'o subtítulo não soma honorários: "' + sub + '"');
  await c.context().close();
  const a = await abrir('ana'); await a.evaluate(() => document.querySelector('#drawer [data-tab="peticoes"]').click()); await a.waitForTimeout(900);
  const abasA = await a.evaluate(() => [...document.querySelectorAll('#mdAbas-peticoes button')].map((b) => b.textContent.trim()));
  check(abasA.some((x) => /Resumo/.test(x)) && abasA.some((x) => /Recebimentos/.test(x)), 'advogada com "Ver totais": Iniciais continua com Resumo e Recebimentos: ' + abasA.join(' · '));
  await a.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await a.waitForTimeout(800);
  const h = await a.evaluate(() => window.__horusTeste.ppHonorariosMeus());
  const cardTxt = await a.locator('#ppHon').innerText();
  check(h.aReceber >= 700 && /Honorários dos seus processos/.test(cardTxt) && /700,00|R\$/.test(cardTxt), 'o Início da advogada mostra "Honorários dos seus processos" só com a parte dela: a receber ' + h.aReceber + ' · ' + cardTxt.replace(/\n/g, ' ').slice(0, 120));
  check(!/Cobranca do Bruno/.test(JSON.stringify(h)) && h.aReceber < 1400, 'sem somar o processo do outro advogado (a receber ' + h.aReceber + ')');
  const por = await a.evaluate(() => window.__horusTeste.ppPor({ pago: true, divisaoRec: { por: 'Ana Advogada' } }) + '|' + window.__horusTeste.ppPor({ pago: false, divisaoRec: { por: 'Ana' } }));
  check(/recebida por Ana/.test(por.split('|')[0]) && por.split('|')[1] === '', 'o rótulo "recebida por Ana" aparece só em parcela paga com divisão');
  await api('dono', 'PUT', '/api/db/termosAcordo/hpx1', { partes: 'Acordo Recebido Rotulo', numeroProcesso: '0000955-05.2024.8.09.0955', origem: 'proprio', status: 'recebido', valorTotal: 900, valorMeuHonorario: 900, advogados: [{ oab: '11111/GO', nome: 'Ana Advogada' }], divisaoRec: { recebeu: '11111/GO', por: 'Ana Advogada', porChave: '11111/GO', partes: [], em: agora }, criadoEm: agora });
  await api('dono', 'PUT', '/api/db/alvaras/hpx2', { numeroProcesso: '0000956-06.2024.8.09.0956', partes: 'Alvara Recebido Rotulo', origem: 'proprio', valorTotalHonorarios: 1000, valorMeuHonorario: 800, status: 'recebido', advogados: [{ oab: '11111/GO', nome: 'Ana Advogada' }], divisaoRec: { recebeu: '11111/GO', por: 'Ana Advogada', porChave: '11111/GO', partes: [], em: agora }, criadoEm: agora });
  await api('dono', 'PUT', '/api/db/termosAcordo/hpx3', { partes: 'Acordo Parcelado Rotulo', numeroProcesso: '0000957-07.2024.8.09.0957', origem: 'proprio', status: 'pendente', valorTotal: 600, valorMeuHonorario: 600, parcelas: [{ numero: 1, valor: 300, data: '2026-10-01', pago: true, divisaoRec: { recebeu: '11111/GO', por: 'Ana Advogada', porChave: '11111/GO', partes: [], em: agora } }, { numero: 2, valor: 300, data: '2026-12-01', pago: false }], advogados: [{ oab: '11111/GO', nome: 'Ana Advogada' }], criadoEm: agora });
  await a.evaluate(() => Promise.all([window.__horusDb.recarregar('termosAcordo'), window.__horusDb.recarregar('alvaras')])); await a.waitForTimeout(500);
  const lista = (mod) => a.evaluate((m) => { const b = [...document.querySelectorAll('#mdAbas-' + m + ' button')].find((x) => /Lista/.test(x.innerText)); if (b) b.click(); }, mod);
  await a.evaluate(() => document.querySelector('#drawer [data-tab="acordos"]').click()); await a.waitForTimeout(700); await lista('acordos'); await a.waitForTimeout(700);
  const txAc = await a.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  check(/Acordo Recebido Rotulo.{0,200}recebida por Ana/i.test(txAc) || (txAc.match(/recebida por Ana/gi) || []).length >= 1, 'Acordos: o acordo recebido mostra "recebida por Ana"');
  await a.evaluate(() => document.querySelector('#drawer [data-tab="alvaras"]').click()); await a.waitForTimeout(700); await lista('alvaras'); await a.waitForTimeout(700);
  check(/recebida por Ana/i.test(await a.evaluate(() => document.body.innerText)), 'Alvarás: o alvará recebido mostra "recebida por Ana"');
  await a.evaluate(() => document.querySelector('#drawer [data-tab="acordos"]').click()); await a.waitForTimeout(700); await lista('acordos'); await a.waitForTimeout(500);
  await a.evaluate(() => { const c = document.querySelector('[data-acordo-toggle="hpx3"]'); if (c) c.click(); }); await a.waitForTimeout(700);
  check(/Parcela 1.{0,120}recebida por Ana/i.test(await a.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))), 'Acordos: a parcela paga de um acordo parcelado mostra "recebida por Ana"');
  for (const [col, id] of [['termosAcordo', 'hpx1'], ['alvaras', 'hpx2'], ['termosAcordo', 'hpx3']]) await api('dono', 'DELETE', '/api/db/' + col + '/' + id);
  await a.context().close();
  const d = await abrir('dono'); await d.evaluate(() => document.querySelector('#drawer [data-tab="peticoes"]').click()); await d.waitForTimeout(900);
  const abasD = await d.evaluate(() => [...document.querySelectorAll('#mdAbas-peticoes button')].map((b) => b.textContent.trim()));
  check(abasD.some((x) => /Resumo/.test(x)) && /R\$/.test(await d.locator('#subtitle').innerText()), 'proprietário: Resumo e totais como sempre');
  await d.context().close();
}
console.log('\n— Clientes por papel');
{
  const abasDe = (p) => p.evaluate(() => [...document.querySelectorAll('#mdAbas-clientes button')].map((b) => b.textContent.trim()));
  const c = await abrir('caio'); await c.evaluate(() => document.querySelector('#drawer [data-tab="clientes"]').click()); await c.waitForTimeout(1200);
  const abC = await abasDe(c), subC = await c.locator('#subtitle').innerText(), temCobrar = await c.evaluate(() => [...document.querySelectorAll('[data-cli-cobrar]')].some((e) => e.offsetParent !== null));
  const opts = await c.evaluate(() => [...document.querySelectorAll('#filtroClienteTipo option')].map((o) => o.value));
  check(abC.join('|') === 'Lista|Sem processos', 'estagiário: Clientes só com "Lista" e "Sem processos" (sem Resumo, A cobrar, Em atraso): ' + abC.join('|'));
  check(!/R\$|a receber/.test(subC), 'estagiário: o subtítulo não mostra o total a receber: "' + subC + '"');
  check(!temCobrar && !opts.includes('receber') && !opts.includes('atraso'), 'estagiário: sem botão "Cobrar" nem filtros de cobrança');
  check(/R\$/.test(await c.locator('#listClientes').innerText()), 'estagiário: continua vendo o valor de cada cliente');
  const rec = await c.evaluate(() => { const r = {}; for (const sel of ['button[data-baixa-doc]', 'button[data-pf="baixa"]', 'button[data-acordo-status]', 'button[data-alvara-status]']) { const e = document.createElement('button'); e.setAttribute(sel.match(/\[([a-z-]+)(=|\])/)[1], sel.includes('=') ? 'baixa' : 'x'); document.body.appendChild(e); r[sel] = getComputedStyle(e).display; e.remove(); } const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('data-parcela', 'x'); document.body.appendChild(i); r.chk = getComputedStyle(i).pointerEvents; i.remove(); r.pode = window.__horusTeste.ppPodeReceber(); return r; });
  check(Object.entries(rec).filter(([k]) => k.startsWith('button')).every(([, v]) => v === 'none') && rec.chk === 'none' && rec.pode === false, 'estagiário: sem "Registrar pagamento" / "Marcar como recebido" e os quadradinhos de pago só para ver: ' + JSON.stringify(rec));
  await c.context().close();
  const a = await abrir('ana'); await a.evaluate(() => document.querySelector('#drawer [data-tab="clientes"]').click()); await a.waitForTimeout(1200);
  const abA = await abasDe(a);
  check(abA.some((x) => /Resumo/.test(x)) && abA.some((x) => /A cobrar/.test(x)) && abA.some((x) => /Em atraso/.test(x)), 'advogada: Clientes continua com Resumo e abas de cobrança: ' + abA.join('|'));
  check(/a receber/.test(await a.locator('#subtitle').innerText()), 'advogada (Ver totais): o subtítulo mostra o total dos clientes dela');
  await a.context().close();
  const d = await abrir('dono'); await d.evaluate(() => document.querySelector('#drawer [data-tab="clientes"]').click()); await d.waitForTimeout(1200);
  check((await abasDe(d)).length === 5 && /a receber/.test(await d.locator('#subtitle').innerText()), 'proprietário: Clientes como sempre (5 abas e total no subtítulo)');
  await d.context().close();
}
console.log('\n— Início: botão + redondo');
for (const q of ['dono', 'ana']) {
  const p = await abrir(q); await p.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await p.waitForTimeout(600);
  const fab = await p.locator('#fabNew').isVisible(), box = await p.locator('#fabNew').boundingBox(), vp = p.viewportSize();
  check(fab && box && box.x > vp.width - 120 && box.y > vp.height - 120, (q === 'dono' ? 'proprietário' : 'advogada') + ': o "+" redondo aparece no canto inferior direito do Início');
  check((await p.locator('#inicioNovo').count()) === 0, 'sem o botão preto "+ Novo" no alto');
  check((await p.locator('#inicioAcoes').isVisible()) === (q === 'dono'), q === 'dono' ? 'os atalhos (Recebi R$…) continuam para o proprietário' : 'sem a fileira de atalhos para a advogada');
  await p.click('#fabNew'); await p.waitForTimeout(500);
  const novo = await p.locator('#novoGrid').innerText();
  check(/Inicial/.test(novo) && /Prazo/.test(novo) && (/Recebi R\$|Despesa|Extratos/.test(novo) === (q === 'dono')), 'a folha "Novo": ' + novo.replace(/\n/g, ' · '));
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + 'inicio-' + q + '.png' });
  await p.context().close();
}
for (const id of ['pt1', 'pt2']) await api('dono', 'DELETE', '/api/db/casos/' + id);
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
