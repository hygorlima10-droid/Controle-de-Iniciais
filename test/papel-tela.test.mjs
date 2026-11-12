// Testa o aplicativo por papel (Fase 5, etapa 5.7): Finanças e o que é do proprietário somem para advogado e estagiário (menu, barra, abas, atalhos, avisos),
// ninguém além do proprietário gera pedidos recusados, Cobrança só para o advogado (e só com os clientes dos processos dele), "Minha conta".
// Servidor individual com banco semeado (grupo 'permissoes'):  node test/rodar.mjs papel-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (n, m, pth, b) => { const x = await fetch(B + pth, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); return x.status; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), ontem = new Date(Date.now() - 27 * 3600e3).toISOString().slice(0, 10);
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
