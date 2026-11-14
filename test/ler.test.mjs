// Testa a leitura de documentos com um "Claude de mentira" (servidor simulado), pela API e pela tela.
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --var ANTHROPIC_API_KEY:chave-falsa --var ANTHROPIC_URL:http://127.0.0.1:9998/v1/messages --port 8790
import http from 'node:http'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8790', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
let modo = 'ok', ultimo = null;
const mock = http.createServer((q, s) => { let d = ''; q.on('data', c => d += c); q.on('end', () => {
  ultimo = { chave: q.headers['x-api-key'], corpo: JSON.parse(d) };
  if (modo === 'credito') { s.writeHead(400, { 'content-type': 'application/json' }); return s.end(JSON.stringify({ error: { message: 'Your credit balance is too low to access the Anthropic API' } })); }
  if (modo === 'chave') { s.writeHead(401, { 'content-type': 'application/json' }); return s.end(JSON.stringify({ error: { message: 'invalid x-api-key' } })); }
  s.writeHead(200, { 'content-type': 'application/json' });
  s.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ tipo: 'obra', descricao: 'Abastecimento', fornecedor: 'Posto Boa Viagem', valor: 245.9, numero_nota: '991', data: '2026-11-02', avisos: [] }) }] }));
}); }).listen(9998);
const post = (ck, corpo) => fetch(B + '/api/ler', { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }) }); const ck = r.headers.get('set-cookie').split(';')[0];
r = await fetch(B + '/api/ler/status', { headers: { cookie: ck } }); check((await r.json()).ok === true, 'status: leitura configurada');
r = await fetch(B + '/api/ler/status'); check(r.status === 401, 'status sem sessão: bloqueado');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
r = await post(ck, { prompt: 'leia', imagens: [{ tipo: 'image/png', dados: png }] }); let j = await r.json();
check(r.status === 200 && JSON.parse(j.text).valor === 245.9, 'lê a imagem e devolve o texto do Claude');
check(ultimo.chave === 'chave-falsa' && ultimo.corpo.messages[0].content[0].type === 'image' && ultimo.corpo.messages[0].content[0].source.media_type === 'image/png' && /^claude-/.test(ultimo.corpo.model), 'a chave do servidor e a imagem foram enviadas ao Claude');
r = await post(ck, { prompt: 'x', imagens: [{ tipo: 'application/pdf', dados: png }] }); check(r.status === 400, 'tipo de arquivo não permitido: recusa');
r = await post(ck, { prompt: 'x', imagens: Array(5).fill({ tipo: 'image/png', dados: png }) }); check(r.status === 400, 'mais de 4 imagens: recusa');
r = await post(ck, { imagens: [] }); check(r.status === 400, 'sem instrução: recusa');
r = await fetch(B + '/api/ler', { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json', origin: 'https://mau.com' }, body: '{}' }); check(r.status === 403, 'pedido de outro site: bloqueado');
r = await fetch(B + '/api/ler', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); check(r.status === 401, 'sem sessão: bloqueado');
modo = 'credito'; r = await post(ck, { prompt: 'x', imagens: [] }); j = await r.json(); check(r.status === 402 && j.error.code === 'sem_credito', 'sem crédito: mensagem clara');
modo = 'chave'; r = await post(ck, { prompt: 'x', imagens: [] }); j = await r.json(); check(j.error.code === 'chave_invalida', 'chave recusada: mensagem clara');
modo = 'ok';
// pela tela
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 400, height: 860 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(1800);
check(await page.evaluate(() => getComputedStyle(document.getElementById('inicioLerDoc')).display !== 'none' && !document.getElementById('fabLerDoc')), 'botão Foto/PDF aparece na faixa de ações do Início (sem botão flutuante)');
await page.click('#inicioLerDoc'); await page.waitForTimeout(300);
check(!(await page.evaluate(() => /não recebe fotos/.test(document.getElementById('ldCorpo').innerText))), 'aceita foto (sem aviso de "não recebe fotos")');
await page.setInputFiles('#ldArq', 'test/pixel.png'); await page.click('#ldPrim'); await page.waitForTimeout(1500);
check(await page.evaluate(() => document.getElementById('ldTitulo').textContent) === 'Conferir o que foi lido', 'tela de conferência aparece');
await page.click('#ldPrim'); await page.waitForTimeout(500);
check(await page.evaluate(() => { const e = document.getElementById('of_desc'); return !e; }), 'sem etapas de obra cadastradas: não abre formulário da obra (esperado neste banco de teste)');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ' -> ' + erros.join(' | ') : ''));
await br.close(); mock.close(); console.log(falhas ? falhas + ' FALHAS' : 'tudo ok'); process.exit(falhas ? 1 : 0);
