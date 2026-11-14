// Testa Construção 7B/7C: financiamento, medições, juros, caixa próprio, checklist, anexos, avisos na Central.
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --port 8802
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const dia = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10), agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.8' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const H = { cookie: ck, 'content-type': 'application/json', origin: B };
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
// servidor: anexos
const pixel = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64').toString('base64');
let a = await fetch(B + '/api/anexos', { method: 'POST', headers: H, body: JSON.stringify({ nome: 'n.jpg', tipo: 'image/jpeg', b64: pixel }) }); const aj = await a.json();
check(a.status === 200 && aj.id, 'POST /api/anexos grava o comprovante');
check((await (await fetch(B + '/api/anexos/' + aj.id, { headers: H })).json()).b64 === pixel, 'GET devolve o mesmo conteúdo');
check((await fetch(B + '/api/anexos', { method: 'POST', headers: H, body: JSON.stringify({ nome: 'x', tipo: 'text/html', b64: 'AA==' }) })).status === 400, 'tipo não permitido é recusado');
check((await fetch(B + '/api/anexos/' + aj.id, { headers: { 'content-type': 'application/json' } })).status === 401, 'sem login: 401');
check((await fetch(B + '/api/db/_anexos', { headers: H })).status >= 400, 'a coleção _anexos não é acessível pelo /api/db');
check((await fetch(B + '/api/anexos/' + aj.id, { method: 'DELETE', headers: H })).status === 200 && (await fetch(B + '/api/anexos/' + aj.id, { headers: H })).status === 404, 'DELETE remove o comprovante');
// dados da obra
await api('PUT', 'config/backup', { ultimoEm: agora });
await api('PUT', 'config/obra', { nome: 'Casa', orcamentoTotal: 400000, criadoEm: agora,
  financiamento: { status: 'aprovado', valor: 300000, banco: 'Caixa', taxaAnual: 12, sistema: 'sac', prazoMeses: 360, inicioObra: dia(-60).slice(0, 8) + '01', prazoObraMeses: 10, contrapartida: 100000 },
  etapas: [{ id: 'e1', nome: 'Fundação', orcado: 100000, status: 'concluida', ordem: 1 }, { id: 'e2', nome: 'Alvenaria', orcado: 150000, status: 'andamento', ordem: 2 }, { id: 'e3', nome: 'Acabamento', orcado: 150000, status: 'a_fazer', ordem: 3 }],
  medicoes: [{ id: 'm1', data: dia(-30), valor: 60000, desc: 'Fundação', etapaIds: ['e1'], status: 'liberada', liberacaoId: 'l1' }, { id: 'm2', data: dia(6), valor: 90000, desc: 'Alvenaria', etapaIds: ['e2'], status: 'prevista', liberacaoId: null }, { id: 'm3', data: dia(70), valor: 90000, etapaIds: ['e3'], status: 'prevista', liberacaoId: null }],
  checklist: [{ id: 'k1', fase: 'antes', titulo: 'Alvará de construção', prazo: dia(-2), feito: false }, { id: 'k2', fase: 'final', titulo: 'Habite-se', prazo: null, feito: false }] });
await api('PUT', 'obraMov/l1', { tipo: 'liberacao', data: dia(-30), valor: 60000, obs: '1ª medição', medicaoId: 'm1', criadoEm: agora });
await api('PUT', 'obraMov/a1', { tipo: 'aporte', origem: 'pf', data: dia(-45), valor: 50000, criadoEm: agora });
await api('PUT', 'obraMov/g1', { tipo: 'gasto', etapaId: 'e1', descricao: 'Concreto', fornecedor: 'Usina', valor: 30000, nf: '123', status: 'pago', data: dia(-20), dataPagamento: dia(-20), criadoEm: agora });
await api('PUT', 'obraMov/g2', { tipo: 'gasto', etapaId: 'e2', descricao: 'Tijolos', fornecedor: 'Olaria', valor: 12000, status: 'apagar', data: dia(-1), vencimento: dia(2), criadoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 420, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { obra: 'tudo', financeiro: 'geral' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2500);
const txt = sel => page.evaluate(s => Array.from(document.querySelectorAll(s)).map(e => e.innerText).join('\n'), sel);
const getDoc = async (col, id) => (await (await api('GET', col)).json()).docs.find(d => d.id === id)?.data;
// Central
const central = await txt('#atencaoLista');
check(/Obra · Tijolos/.test(central), 'a Central mostra o gasto da obra a pagar');
check(/Obra · 2ª medição/.test(central), 'a Central mostra a medição próxima');
check(/Obra · Alvará de construção/.test(central), 'a Central mostra o item do checklist atrasado');
await page.click('[data-ob7-aviso="gasto|g2"]'); await page.waitForTimeout(400);
check(await page.evaluate(() => document.getElementById('overlayObAviso').classList.contains('show') && /Marcar como pago/.test(document.getElementById('obAvFeito').textContent)), 'tocar no aviso abre "Marcar como pago / Adiar"');
await page.evaluate(d => { const e = document.getElementById('obAvData'); e.value = d; }, dia(9)); await page.click('#obAvAdiar'); await page.waitForTimeout(1000);
check((await getDoc('obraMov', 'g2')).vencimento === dia(9), 'Adiar muda o vencimento do gasto');
// aba Construção
await page.evaluate(() => document.querySelector('[data-tab="obra"]').click()); await page.waitForTimeout(800);
const obra = await txt('#obraWrap');
check(/Financiamento e medições/.test(obra) && /Juros de obra/.test(obra) && /Caixa próprio necessário/.test(obra) && /Checklist da obra/.test(obra), 'as seções novas aparecem na aba Construção');
await page.evaluate(() => document.querySelectorAll('[data-ob7-sec]').forEach(d => d.open = true)); await page.waitForTimeout(300);
const o2 = await txt('#obraWrap');
check(/20% liberado/.test(o2) || /20,0%/.test(o2) || /liberado/.test(o2), 'mostra o quanto do financiamento já foi liberado');
check(/12% ao ano/.test(o2) && /SAC/.test(o2), 'mostra taxa e sistema');
check(/1ª medição/.test(o2) && /2ª medição/.test(o2) && /Registrar liberação/.test(o2), 'lista as medições com o botão de liberação');
check(/Faltam concluir: Alvenaria/.test(o2), 'avisa etapa ligada à medição ainda não concluída');
check(/Estimativa: saldo liberado/.test(o2) && /Total estimado até o fim da obra/.test(o2), 'tabela de juros de obra');
check(/Mês mais pesado|não falta caixa/.test(o2), 'caixa próprio calcula o pior mês (ou diz que não falta)');
check(/1 de 2|0 de 2/.test(o2) && /Alvará de construção/.test(o2), 'checklist mostra os itens');
// juros -> lançar como gasto
const antes = (await (await api('GET', 'obraMov')).json()).docs.length;
await page.click('[data-ob7="jur-lancar"] >> nth=0'); await page.waitForTimeout(800);
check(await page.evaluate(() => document.getElementById('overlayObraForm').classList.contains('show') && /Juros de obra/.test(document.getElementById('of_desc').value)), '"Lançar" abre o gasto já preenchido com os juros');
await page.click('#obraFormSalvar'); await page.waitForTimeout(1500);
const depois = (await (await api('GET', 'obraMov')).json()).docs;
check(depois.length === antes + 1 && depois.some(d => /Juros de obra/.test(d.data.descricao || '')), 'o gasto de juros foi gravado');
check(Object.keys((await getDoc('config', 'obra')).jurosLancados || {}).length === 1, 'o mês fica marcado como lançado');
// registrar liberação
await page.evaluate(() => document.querySelectorAll('[data-ob7-sec]').forEach(d => d.open = true));
await page.click('[data-ob7="med-lib"][data-id="m2"]'); await page.waitForTimeout(500);
await page.click('#obraFormSalvar'); await page.waitForTimeout(1500);
const m2 = (await getDoc('config', 'obra')).medicoes.find(m => m.id === 'm2');
check(m2.status === 'liberada' && m2.liberacaoId && (await (await api('GET', 'obraMov')).json()).docs.some(d => d.data.medicaoId === 'm2' && d.data.tipo === 'liberacao' && d.data.valor === 90000), 'registrar liberação cria o lançamento e marca a medição');
// checklist
await page.evaluate(() => document.querySelectorAll('[data-ob7-sec]').forEach(d => d.open = true));
await page.click('[data-ob7="chk-feito"][data-id="k1"]'); await page.waitForTimeout(900);
check((await getDoc('config', 'obra')).checklist.find(i => i.id === 'k1').feito === true, 'marcar item do checklist grava');
// anexos pela interface
await page.evaluate(() => document.querySelector('[data-tab="obra"]').click()); await page.waitForTimeout(500);
const clip = page.locator('[data-ob7="anexos"][data-id="g1"]');
if (await clip.count()) {
  await clip.click(); await page.waitForTimeout(300);
  check(await page.evaluate(() => document.getElementById('overlayAnexos').classList.contains('show')), 'o botão Anexar abre a janela de comprovantes');
  await page.setInputFiles('#anArq', { name: 'nota.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 teste') }); await page.waitForTimeout(1500);
  const g1 = await getDoc('obraMov', 'g1');
  check(g1.anexos && g1.anexos.length === 1 && g1.anexos[0].tipo === 'application/pdf', 'o PDF anexado fica registrado no gasto');
  check((await fetch(B + '/api/anexos/' + g1.anexos[0].id, { headers: H })).status === 200, 'e está guardado no servidor');
  await page.evaluate(() => document.querySelector('#overlayAnexos [data-an=rem]').click()); await page.waitForTimeout(1200);
  check(!((await getDoc('obraMov', 'g1')).anexos || []).length, 'remover limpa o gasto');
} else check(false, 'botão Anexar presente no gasto');
// obra simples: só uma etapa, sem financiamento, sem cronograma -> nada inventado no caixa
await api('PUT', 'config/obra', { nome: 'Casa', orcamentoTotal: 450000, criadoEm: agora, financiamento: { status: 'estimado', valor: 0 }, etapas: [{ id: 'e1', nome: 'Terraplanagem', orcado: 22000, status: 'andamento', ordem: 1 }], medicoes: [], checklist: [] });
for (const d of (await (await api('GET', 'obraMov')).json()).docs) await api('DELETE', 'obraMov/' + d.id);
await api('PUT', 'obraMov/s1', { tipo: 'aporte', origem: 'pf', data: dia(-5), valor: 30000, criadoEm: agora });
await api('PUT', 'obraMov/s2', { tipo: 'gasto', etapaId: 'e1', descricao: 'Máquina', valor: 14870, status: 'pago', data: dia(-3), dataPagamento: dia(-3), criadoEm: agora });
await api('PUT', 'obraMov/s3', { tipo: 'gasto', etapaId: 'e1', descricao: 'Frete', valor: 500, status: 'apagar', data: dia(-1), vencimento: dia(9), criadoEm: agora });
await page.reload(); await page.waitForTimeout(2500);
const ce = await page.evaluate(() => { const e = document.querySelector('[data-ob7-aviso="gasto|s3"]'); return e ? { cls: e.className, data: e.querySelector('.up-data').className } : null; });
check(ce && /tipo-murilo/.test(ce.cls) && !/up-d-atraso|up-d-hoje/.test(ce.data), 'aviso a 9 dias do vencimento não fica em vermelho');
await api('PUT', 'obraMov/s3', { tipo: 'gasto', etapaId: 'e1', descricao: 'Frete', valor: 500, status: 'apagar', data: dia(-1), vencimento: dia(0), criadoEm: agora });
await page.reload(); await page.waitForTimeout(2500);
const ch = await page.evaluate(() => { const e = document.querySelector('[data-ob7-aviso="gasto|s3"]'); return e ? { cls: e.className, data: e.querySelector('.up-data').className } : null; });
check(ch && !/tipo-murilo/.test(ch.cls) && /up-d-hoje/.test(ch.data), 'vencendo hoje fica em vermelho/destaque');
await api('PUT', 'obraMov/s3', { tipo: 'gasto', etapaId: 'e1', descricao: 'Frete', valor: 500, status: 'apagar', data: dia(-1), vencimento: dia(-2), criadoEm: agora });
await page.reload(); await page.waitForTimeout(2500);
check(await page.evaluate(() => { const e = document.querySelector('[data-ob7-aviso="gasto|s3"]'); return !!e && !/tipo-murilo/.test(e.className) && /up-d-atraso/.test(e.querySelector('.up-data').className); }), 'atrasado fica em vermelho');
await page.evaluate(() => document.querySelector('[data-tab="obra"]').click()); await page.waitForTimeout(800);
await page.evaluate(() => document.querySelectorAll('[data-ob7-sec]').forEach(d => d.open = true));
const cx = await page.evaluate(() => document.querySelector('[data-ob7-sec="cx"]').innerText);
check(!/Mês mais pesado/.test(cx) && /início e o prazo da obra/.test(cx), 'sem cronograma, o caixa não inventa mês pesado e explica o que falta informar');
// ordem da Central: tudo por data de vencimento, obra misturada com o resto
await api('PUT', 'casos/co1', { tipo: 'inicial', cliente: 'Cliente Ordem', nomeAcao: 'Cobrança', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 2000, parcelas: [{ numero: 1, valor: 1000, data: dia(-5), pago: false }, { numero: 2, valor: 1000, data: dia(3), pago: false }], clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await api('PUT', 'obraMov/s4', { tipo: 'gasto', etapaId: 'e1', descricao: 'Areia', valor: 300, status: 'apagar', data: dia(-1), vencimento: dia(8), criadoEm: agora });
await page.reload(); await page.waitForTimeout(2800);
await page.evaluate(() => { const m = document.getElementById('atencaoMais'); if (m && /Ver todos/.test(m.textContent)) m.click(); }); await page.waitForTimeout(400);
const ordem = await page.evaluate(() => Array.from(document.querySelectorAll('#atencaoLista > *')).map(e => { const b = e.querySelector('.up-data b'); const s = e.querySelector('.up-data span'); return b && s ? b.textContent + '/' + s.textContent : null; }).filter(Boolean));
const ds = [dia(-5), dia(-2), dia(3), dia(8)].map(d => d.slice(8) + '/');
const pos = ds.map(d => ordem.findIndex(o => o.startsWith(d)));
check(pos.every(p => p >= 0) && pos.every((p, i) => i === 0 || p > pos[i - 1]), 'Central em ordem de vencimento, com os gastos da obra no meio dos outros itens (' + ordem.join(' ') + ')');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
