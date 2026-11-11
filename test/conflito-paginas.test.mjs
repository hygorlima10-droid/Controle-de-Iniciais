// Fase 3, etapa 3.10: (1) fim do limite de 1.000 registros por coleção (páginas "depois do id X" + leitura até o fim);
// (2) conflito de edição: o servidor não grava por cima do que outro aparelho mudou; o app pergunta.
// Use: node test/rodar.mjs conflito-paginas
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), m0 = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.58' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
const lerLista = async (col, q = '') => (await api('GET', col + q)).json();
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) { let j; do { j = await lerLista(col); for (const d of j.docs) await api('DELETE', col + '/' + d.id); } while (j.mais); }
await api('PUT', 'config/backup', { ultimoEm: agora }); await api('PUT', 'config/importacaoAuto', { ativo: false, desde: agora });
// ---- 1) lista maior que 1.000 registros ----
const N = 1250, mk = i => ({ nome: 'Despesa ' + i, coluna: 'pj', tipo: 'unica', valor: 10 + i, data: m0 + '-15', mesReferencia: m0, categoria: 'outros', pago: false, criadoEm: agora });
for (let i = 0; i < N; i += 50) await Promise.all(Array.from({ length: Math.min(50, N - i) }, (_, k) => api('PUT', 'despesas/d' + String(i + k).padStart(5, '0'), mk(i + k))));
const p1 = await lerLista('despesas'), p2 = await lerLista('despesas', '?after=' + encodeURIComponent(p1.docs[p1.docs.length - 1].id));
check(p1.docs.length === 1000 && p1.mais === true && p1.n === N && p2.docs.length === N - 1000 && p2.mais === false, 'a lista vem em páginas: 1ª com 1.000 (mais = sim) e a 2ª com o resto (' + p2.docs.length + ', mais = não); total ' + p1.n);
check(new Set([...p1.docs, ...p2.docs].map(d => d.id)).size === N && p2.docs[0].id > p1.docs[p1.docs.length - 1].id, 'nenhum registro some nem se repete entre as páginas (' + N + ' ids únicos)');
const rs = await (await api('GET', 'despesas?resumo=1')).json();
check(rs.n === N && rs.t > 0 && rs.t === p1.t, 'a "ficha" da coleção (quantidade e última alteração) bate: ' + rs.n + ' registros');
check(typeof p1.docs[0].v === 'number' && p1.docs[0].v > 0, 'cada registro da lista traz a sua versão (carimbo de tempo)');
// ---- 2) conflito no servidor ----
await api('PUT', 'despesas/x1', { nome: 'Aluguel', coluna: 'pj', tipo: 'unica', valor: 100, data: m0 + '-10', mesReferencia: m0, categoria: 'estrutura', pago: false, criadoEm: agora });
const v0 = (await lerLista('despesas', '?after=x0&limit=1')).docs[0]; // x1 é o primeiro depois de "x0"
check(v0.id === 'x1' && v0.v > 0, 'consigo ler a versão do registro x1');
await new Promise(res => setTimeout(res, 15));
let pr = await api('PUT', 'despesas/x1?base=' + v0.v, { ...v0.data, valor: 150 }); const v1 = (await pr.json()).v;
check(pr.status === 200 && v1 > v0.v, 'gravar com a versão que se leu funciona e devolve a nova versão');
pr = await api('PUT', 'despesas/x1?base=' + v0.v, { ...v0.data, valor: 120 }); let jj = await pr.json();
check(pr.status === 409 && jj.error.code === 'conflict' && jj.atual.data.valor === 150 && jj.atual.v === v1, 'gravar com uma versão velha (alguém já mudou para 150) é recusado com 409 e devolve a versão do servidor');
check((await (await api('GET', 'despesas?after=x0&limit=1')).json()).docs[0].data.valor === 150, 'o registro continua como o outro aparelho deixou (150): nada foi sobrescrito');
pr = await api('PUT', 'despesas/x1?base=' + v0.v, { ...v0.data, valor: 150 });
check(pr.status === 200, 'versão velha com o MESMO conteúdo não é conflito');
pr = await api('PUT', 'despesas/x1?base=' + v0.v + '&forcar=1', { ...v0.data, valor: 120 });
check(pr.status === 200 && (await (await api('GET', 'despesas?after=x0&limit=1')).json()).docs[0].data.valor === 120, '"Manter a minha" (forcar=1) grava por cima');
await api('PUT', 'config/backup', { ultimoEm: 'a' }); pr = await api('PUT', 'config/backup?base=1', { ultimoEm: 'b' });
check(pr.status === 200, 'documentos de configuração não perguntam (só os registros de trabalho)');
// ---- 3) no app ----
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(6000);
const tot = await page.evaluate(() => ({ n: window.__horusDb.total('despesas'), ok: window.__horusDb.completo(), carga: !!document.getElementById('cargaMais') }));
check(tot.n === N + 1 && tot.ok && !tot.carga, 'o app carregou as ' + (N + 1) + ' despesas (mais de 1.000), sem teto e sem ficar preso em "carregando mais…" (' + tot.n + ')');
check(!/chegou ao limite|Vale planejar o espaço/.test(await page.evaluate(() => document.body.innerText)), 'não aparece mais o aviso de "limite de 1.000 registros"');
// edição em outro aparelho enquanto esta tela tem a versão antiga
await api('PUT', 'despesas/x1', { nome: 'Aluguel', coluna: 'pj', tipo: 'unica', valor: 200, data: m0 + '-12', mesReferencia: m0, categoria: 'estrutura', pago: false, criadoEm: agora });
const salvar = (v) => page.evaluate(async (v) => { const db = await window.claude.use('db'); let ok = true; try { await db.collection('despesas').doc('x1').set({ nome: 'Aluguel', coluna: 'pj', tipo: 'unica', valor: v, data: new Date().toISOString().slice(0, 7) + '-10', mesReferencia: new Date().toISOString().slice(0, 7), categoria: 'estrutura', pago: false, criadoEm: '2026-01-01T00:00:00.000Z' }); } catch (e) { ok = false; } return ok; }, v);
let pSalvar = salvar(130); await page.waitForSelector('.cfl-ov', { timeout: 6000 });
let tmodal = await page.evaluate(() => document.querySelector('.cfl-ov').innerText);
check(/Este registro foi alterado em outro aparelho/.test(tmodal) && /Despesa · Aluguel/.test(tmodal) && /enquanto você editava/.test(tmodal) && /Valor\s+R\$\s*130,00\s+R\$\s*200,00/.test(tmodal.replace(/\n/g, ' ')) && /Usar a do outro aparelho/.test(tmodal) && /Manter a minha/.test(tmodal), 'o app mostra o conflito: Valor — sua versão R$ 130,00 × no servidor R$ 200,00 — e os dois botões');
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'conflito.png' });
await page.click('[data-cfl="outra"]'); check(await pSalvar, '"Usar a do outro aparelho": a gravação termina sem erro');
await page.waitForTimeout(500);
check((await (await api('GET', 'despesas?after=x0&limit=1')).json()).docs[0].data.valor === 200 && await page.evaluate(() => !document.querySelector('.cfl-ov')), 'e o servidor fica com a do outro aparelho (R$ 200)');
await api('PUT', 'despesas/x1', { nome: 'Aluguel', coluna: 'pj', tipo: 'unica', valor: 250, data: m0 + '-12', mesReferencia: m0, categoria: 'estrutura', pago: false, criadoEm: agora });
pSalvar = salvar(140); await page.waitForSelector('.cfl-ov', { timeout: 6000 }); await page.click('[data-cfl="minha"]'); check(await pSalvar, '"Manter a minha": a gravação termina sem erro'); await page.waitForTimeout(500);
check((await (await api('GET', 'despesas?after=x0&limit=1')).json()).docs[0].data.valor === 140, 'e o servidor fica com a minha (R$ 140)');
// duas edições seguidas do mesmo registro neste aparelho não são conflito
const seg = await page.evaluate(async () => { const db = await window.claude.use('db'), d = db.collection('despesas').doc('x1'), mk = v => ({ nome: 'Aluguel', coluna: 'pj', tipo: 'unica', valor: v, data: '2026-01-10', mesReferencia: '2026-01', categoria: 'estrutura', pago: false, criadoEm: '2026-01-01T00:00:00.000Z' }); await Promise.all([d.set(mk(301)), d.set(mk(302)), d.set(mk(303))]); return !document.querySelector('.cfl-ov'); });
check(seg && (await (await api('GET', 'despesas?after=x0&limit=1')).json()).docs[0].data.valor === 303, 'três gravações seguidas do mesmo registro neste aparelho não geram falso conflito (ficou 303)');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
