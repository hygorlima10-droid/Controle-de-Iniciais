// Testa o cadastro de processo com um campo só de partes ("Autor x Réu"): autor e réu saem do texto ao salvar.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString();
const N1 = '1010508-86.2004.8.26.0506', N2 = '5200100-10.2025.8.09.0051';
const r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.41' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['processos', 'config']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('POST', '/api/db/processos', { numero: N2, partes: 'Fulano de Tal x Banco Exemplo', orgao: 'TJGO', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });

const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(800);

// 1) novo: só o campo de partes é visível; autor e réu ficam escondidos
await page.click('[data-pr="novo"]'); await page.waitForTimeout(600);
const vis = id => page.evaluate(id => { const e = document.getElementById(id); return !!e && e.type !== 'hidden' && e.offsetParent !== null; }, id);
check(await vis('pr_partes') && !(await vis('pr_autor')) && !(await vis('pr_reu')), 'o cadastro mostra só o campo de partes (autor e réu não aparecem mais)');
check(/Partes \(autor x réu\)/.test(await page.evaluate(() => document.querySelector('label[for=pr_partes]').innerText)), 'o rótulo do campo explica o formato "autor x réu"');
await page.fill('#pr_numero', N1); await page.fill('#pr_partes', 'ASSOCIACAO DE ENSINO DE RIBEIRAO PRETO x ALLYSSON FREITAS DE MORAIS');
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
let d = (await docs('processos')).filter(x => x.numero === N1)[0];
check(d && d.autor === 'ASSOCIACAO DE ENSINO DE RIBEIRAO PRETO' && d.reu === 'ALLYSSON FREITAS DE MORAIS', 'ao salvar, autor e réu saem do texto das partes: ' + JSON.stringify(d && [d.autor, d.reu]));

// 2) editar: mudar as partes atualiza autor e réu (processo que já tinha só o texto)
let d2 = (await docs('processos')).filter(x => x.numero === N2)[0];
check(d2 && !d2.autor && !d2.reu, 'processo antigo só tinha o texto das partes (sem autor/réu gravados)');
await page.fill('#prBusca', '5200100'); await page.waitForTimeout(500);
await page.click('#prLista [data-pr="abrir"]'); await page.waitForTimeout(700);
check((await page.evaluate(() => document.getElementById('pr_partes').value)) === 'Fulano de Tal x Banco Exemplo', 'ao abrir o processo, as partes aparecem no campo');
await page.fill('#pr_partes', 'Fulano de Tal vs. Banco Novo S.A.');
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
d2 = (await docs('processos')).filter(x => x.numero === N2)[0];
check(d2 && d2.autor === 'Fulano de Tal' && d2.reu === 'Banco Novo S.A.', 'com "vs." também divide, e a edição atualiza autor e réu: ' + JSON.stringify(d2 && [d2.autor, d2.reu]));
check(erros.length === 0, 'sem erros na página: ' + erros.join(' | '));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
