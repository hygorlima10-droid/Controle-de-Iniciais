// Testa a gravação em lote "tudo ou nada" (/api/lote) e a transferência PJ/PF pela tela (criar, falha de conexão no meio, excluir).
// Servidor com LOGIN_ANTIGO=1 (como os demais testes de tela).  BASE=http://127.0.0.1:8812 node test/transferencia-atomica.test.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.71' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { s: x.status, j: await x.json().catch(() => ({})) }; };
const lista = async col => ((await f('GET', '/api/db/' + col)).j.docs || []);
for (const col of ['despesas', 'receitasManuais']) for (const d of await lista(col)) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('POST', '/api/lixeira/esvaziar', {});

/* ---- servidor: /api/lote ---- */
r = await f('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'receitasManuais', id: 'lr1', dados: { descricao: 'A', valor: 1 } }, { acao: 'gravar', colecao: 'despesas', id: 'ld1', dados: { nome: 'B', valor: 1 } }] });
check(r.s === 200 && (await lista('receitasManuais')).some(d => d.id === 'lr1') && (await lista('despesas')).some(d => d.id === 'ld1'), 'lote grava os dois registros juntos');
r = await f('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'receitasManuais', id: 'lr2', dados: { descricao: 'C' } }, { acao: 'gravar', colecao: 'despesas', id: 'ld2', dados: [1, 2] }] });
check(r.s === 400 && !(await lista('receitasManuais')).some(d => d.id === 'lr2'), 'uma operação inválida recusa o lote inteiro: a outra não é gravada');
r = await f('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: '_usuarios', id: 'x', dados: { a: 1 } }] }); check(r.s === 404, 'coleção reservada do sistema é recusada');
r = await f('POST', '/api/lote', { ops: [{ acao: 'gravar', colecao: 'despesas', id: 'ld1', dados: { a: 1 } }, { acao: 'excluir', colecao: 'despesas', id: 'ld1' }] }); check(r.s === 400, 'o mesmo registro duas vezes no lote é recusado');
r = await f('POST', '/api/lote', { ops: [] }); check(r.s === 400, 'lote vazio é recusado');
r = await f('POST', '/api/lote', { ops: Array.from({ length: 26 }, (_, i) => ({ acao: 'excluir', colecao: 'despesas', id: 'z' + i })) }); check(r.s === 400, 'mais de 25 operações é recusado');
r = await fetch(B + '/api/lote', { method: 'POST', body: '{}' }); check(r.status === 401, 'sem sessão: 401');
r = await f('GET', '/api/lote'); check(r.s === 405, 'só aceita POST');
r = await f('POST', '/api/lote', { ops: [{ acao: 'excluir', colecao: 'receitasManuais', id: 'lr1' }, { acao: 'excluir', colecao: 'despesas', id: 'ld1' }] });
check(r.s === 200 && !(await lista('receitasManuais')).length && !(await lista('despesas')).length, 'lote exclui os dois juntos');
const lix = (await f('GET', '/api/lixeira')).j.itens || []; check(lix.some(i => i.titulo === 'A') && lix.some(i => i.titulo === 'B'), 'o que o lote exclui vai para a lixeira');
const aud = (await f('GET', '/api/auditoria?limite=50')).j.itens || []; check(aud.some(i => i.op === 'criou' && i.colecao === 'despesas') && aud.some(i => i.op === 'excluiu' && i.colecao === 'receitasManuais'), 'e entra no registro de ações');

/* ---- tela: transferência PJ → PF ---- */
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } });
const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('[data-tab="financeiro"][data-fin="pj"]').click()); await page.waitForTimeout(900);
const abrir = async () => { await page.click('.fp-transf'); await page.waitForTimeout(400); await page.fill('#transfValorInput', '350'); };
let chamadas = 0; await page.route(/\/api\/lote/, rt => { chamadas++; rt.continue(); });
/* 1) conexão cai: nada fica pela metade */
await page.route(/\/api\/lote/, rt => rt.abort(), { times: 1 });
await abrir(); await page.click('#saveBtnTransf'); await page.waitForTimeout(1200);
check(!(await lista('receitasManuais')).length && !(await lista('despesas')).length, 'conexão caiu no meio: nem a receita nem a despesa foram gravadas');
check(/Sem conexão|conex|salvar|erro/i.test(await page.evaluate(() => document.getElementById('formErrorTransf').textContent)) && await page.evaluate(() => document.getElementById('overlayTransf').classList.contains('show')), 'a tela avisa e mantém o formulário aberto');
/* 2) funciona */
await page.click('#saveBtnTransf'); await page.waitForTimeout(1500);
const rec = await lista('receitasManuais'), des = await lista('despesas');
check(rec.length === 1 && des.length === 1 && rec[0].data.transferenciaId && rec[0].data.transferenciaId === des[0].data.transferenciaId && rec[0].data.valor === 350 && des[0].data.valor === 350, 'transferência grava uma receita (PF) e uma despesa (PJ) ligadas pelo mesmo código');
check(rec[0].data.coluna === 'pf' && des[0].data.coluna === 'pj' && des[0].data.pago === true, 'receita na PF, despesa paga na PJ');
check(!(await page.evaluate(() => document.getElementById('overlayTransf').classList.contains('show'))), 'o formulário fecha');
/* 3) excluir apaga os dois numa só chamada */
await page.evaluate(() => document.querySelector('[data-tab="financeiro"][data-fin="pf"]').click()); await page.waitForTimeout(900);
const rid = rec[0].id; const antes = chamadas;
await page.click('[data-menu-toggle="' + rid + '"]'); await page.waitForTimeout(300);
await page.click('[data-excluir-receita="' + rid + '"]'); await page.waitForTimeout(300);
await page.click('[data-receita-excluir-sim="' + rid + '"]'); await page.waitForTimeout(1500);
check(!(await lista('receitasManuais')).length && !(await lista('despesas')).length, 'excluir a transferência apaga a receita e a despesa');
check(chamadas - antes === 1, 'as duas exclusões foram numa só chamada ao servidor (' + (chamadas - antes) + ')');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
