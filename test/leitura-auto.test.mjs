// Testa a leitura automática ao abrir o app (quando a do servidor falhou ou ainda não leu hoje) e seus limites.
// O Diário Oficial é simulado na porta 8890.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var DJEN_URL:http://127.0.0.1:8890/api/v1/comunicacao --var DJEN_ESPERA_MS:0 --port 8812
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
let modo = '403', pedidos = 0;
const item = { id: 960001, data_disponibilizacao: hoje, siglaTribunal: 'TJGO', tipoComunicacao: 'Intimação', tipoDocumento: 'Decisão', nomeOrgao: 'Vara', nomeClasse: 'PROCEDIMENTO COMUM', numero_processo: '59999990020268090107', numeroprocessocommascara: '5999999-00.2026.8.09.0107', link: '', texto: 'DECISÃO\nDefiro.', destinatarios: [{ nome: 'Fulano', polo: 'A' }], destinatarioadvogados: [] };
const fake = http.createServer((req, res) => {
  pedidos++;
  if (modo === '403') { res.writeHead(403, { 'content-type': 'text/html' }); res.end('<h1>Access denied</h1>'); return; }
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', count: 1, items: [item] }));
}).listen(8890);
await new Promise(ok => fake.on('listening', ok));
const r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.38' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
await f('PUT', '/api/db/config/backup', { ultimoEm: new Date().toISOString() });
const br = await chromium.launch();
async function abrir(opts = {}) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'America/Sao_Paulo' });   // o servidor conta o dia no horário de Brasília; o navegador do teste tem de contar igual (senão, entre 21h e 0h de Brasília o dia do navegador já é o seguinte)
  if (opts.semAuto) await ctx.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } });
  const page = await ctx.newPage(); await page.route(/fonts\./, x => x.abort());
  await page.goto(B + '/'); if (await page.$('input[name=senha]')) { await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); }
  await page.waitForTimeout(opts.espera || 5000); return { ctx, page };
}
const estado = async () => (await f('GET', '/api/djen/estado')).j;
// 1) desligado: não lê
let a = await abrir({ semAuto: true });
check(pedidos === 0, 'com a leitura automática desligada (horus.leituraAuto=0), abrir o app não consulta o DJEN');
await a.ctx.close();
// 2) DJEN recusando: abre o app, tenta e registra o erro
pedidos = 0; modo = '403';
a = await abrir();
check(pedidos >= 1, 'abrir o app sem leitura de hoje dispara uma leitura (pedidos ao DJEN: ' + pedidos + ')');
let e = await estado(); check(e.oabs[0].erro && /403/.test(e.oabs[0].erro), 'com o DJEN recusando, o erro fica registrado na OAB: ' + (e.oabs[0].erro || '').slice(0, 60));
// 3) limite de 30 minutos
const antes = pedidos; await a.page.reload(); await a.page.waitForTimeout(4000);
check(pedidos === antes, 'abrir de novo logo depois não repete (limite de 30 minutos)');
await a.ctx.close();
// 4) DJEN voltou: um aparelho novo lê, traz a publicação e limpa o erro
pedidos = 0; modo = 'ok';
a = await abrir();
check(pedidos >= 1, 'em outro aparelho, abrir o app lê de novo');
e = await estado(); check(!e.oabs[0].erro && e.oabs[0].ultima === hoje && e.total >= 1, 'a leitura deu certo: sem erro, "lida hoje" e a publicação nova guardada');
await a.ctx.close();
// 5) já leu hoje: não consulta
const antes5 = pedidos; const b2 = await abrir({ espera: 4500 });
check(pedidos === antes5, 'se já leu hoje e não há erro, abrir o app não consulta o DJEN');
await b2.ctx.close();
await br.close(); fake.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
