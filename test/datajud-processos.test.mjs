// Testa o cadastro de processo pelo número CNJ com os dados do DataJud (que é simulado por um servidor de mentira na porta 8891).
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var DATAJUD_URL:http://127.0.0.1:8891 --port 8812
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const cnj = (nnn, ano, j, tr, oooo) => { let r = 0; for (const ch of nnn + ano + j + tr + oooo + '00') r = (r * 10 + Number(ch)) % 97; const dd = ('0' + (98 - r)).slice(-2); return nnn + '-' + dd + '.' + ano + '.' + j + '.' + tr + '.' + oooo; };
const NA = cnj('5400100', '2026', '8', '09', '0107'), NB = cnj('5400200', '2026', '8', '09', '0107'), NC = cnj('5400300', '2026', '8', '09', '0107');
const dig = n => n.replace(/\D/g, '');
let modo = {}, chamadas = [];
const srv = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const num = b ? JSON.parse(b).query.term.numeroProcesso : '';
    chamadas.push({ url: req.url, num, auth: req.headers.authorization });
    const m = modo[num] || 'ok';
    if (m === '429') { res.writeHead(429); return res.end('{}'); }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ hits: { hits: m === 'vazio' ? [] : [{ _source: { grau: 'G1', tribunal: 'TJGO', dataAjuizamento: '20260930235807', classe: { nome: 'Procedimento Comum Cível' }, assuntos: [{ nome: 'Indenização por Dano Moral' }, { nome: 'Contratos Bancários' }], orgaoJulgador: { nome: '1ª Vara Cível de Morrinhos' }, movimentos: [{ nome: 'Distribuição', dataHora: '2026-09-30T12:00:00.000Z' }] } }] }, _shards: { failed: 0 } }));
  });
}).listen(8891);
await new Promise(ok => srv.on('listening', ok));
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.8' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['processos', 'casos', 'clientes', 'config']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: new Date().toISOString() });

// rota do Worker
const rr = await f('GET', '/api/datajud/processo?numero=' + dig(NA));
check(rr.s === 200 && rr.j.ok && rr.j.achou && rr.j.tribunal === 'TJGO' && rr.j.dados.ajuizamento === '2026-09-30', 'a rota do Worker devolve o resumo do DataJud');
check(chamadas.length === 1 && chamadas[0].url === '/api_publica_tjgo/_search' && /^APIKey /.test(chamadas[0].auth), 'e chamou o endereço do TJGO com a chave');
check((await f('GET', '/api/datajud/processo?numero=123')).s === 400, 'número fora do padrão: 400');
const semLogin = await fetch(B + '/api/datajud/processo?numero=' + dig(NA)); check(semLogin.status === 401 || semLogin.status === 302 || semLogin.status === 403, 'sem login a rota não responde (' + semLogin.status + ')');

const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const v = async id => page.evaluate(i => document.getElementById(i).value, id);
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(700);

// 1) número novo: o DataJud preenche vara, classe, assunto e data
await page.click('[data-pr="novo"]'); await page.waitForTimeout(400);
check(/DataJud/.test(await t('#prCorpo')), 'a janela de cadastro explica que busca no DataJud');
await page.fill('#pr_numero', NA); await page.keyboard.press('Tab'); await page.waitForTimeout(2500);
check(await v('pr_orgao') === 'TJGO · 1ª Vara Cível de Morrinhos', 'preenche tribunal e vara: ' + await v('pr_orgao'));
check(await v('pr_classe') === 'Procedimento Comum Cível' && await v('pr_assunto') === 'Indenização por Dano Moral; Contratos Bancários' && await v('pr_ajuiz') === '2026-09-30', 'preenche classe, assunto e data de ajuizamento');
check(/✓ Dados do DataJud/.test(await t('#pr_dj')) && /não informa partes/.test(await t('#pr_dj')), 'avisa que partes e valor não vêm do DataJud: ' + (await t('#pr_dj')).slice(0, 80));
check(await v('pr_partes') === '' && await v('pr_valor') === '', 'não inventa partes nem valor da causa');
await page.fill('#pr_partes', 'Maria x Banco'); await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
const p1 = (await docs('processos')).filter(p => p.numero === NA)[0];
check(p1 && p1.assunto === 'Indenização por Dano Moral; Contratos Bancários' && p1.ajuizamento === '2026-09-30' && p1.classe === 'Procedimento Comum Cível', 'o processo é gravado com assunto e data de ajuizamento');

// 2) o que você já digitou não é sobrescrito
await page.click('[data-pr="novo"]'); await page.waitForTimeout(400);
await page.fill('#pr_classe', 'Minha classe'); await page.fill('#pr_numero', NB); await page.keyboard.press('Tab'); await page.waitForTimeout(2500);
check(await v('pr_classe') === 'Minha classe' && await v('pr_assunto') !== '', 'campo já preenchido é mantido; os vazios são completados');
// 3) DataJud sobrecarregado: avisa e dá para tentar de novo
await page.click('#prX'); await page.waitForTimeout(300);
modo[dig(NC)] = '429';
await page.click('[data-pr="novo"]'); await page.waitForTimeout(400);
await page.fill('#pr_numero', NC); await page.keyboard.press('Tab'); await page.waitForTimeout(2500);
check(/sobrecarregado/.test(await t('#pr_dj')) && await v('pr_classe') === '', 'erro 429: explica e deixa preencher à mão');
modo[dig(NC)] = 'ok'; await page.click('[data-prf="buscar-dj"]'); await page.waitForTimeout(2500);
check(await v('pr_classe') === 'Procedimento Comum Cível', 'o botão “Buscar dados no DataJud” tenta de novo e funciona');
// 4) processo que o DataJud ainda não tem
await page.click('#prX'); await page.waitForTimeout(300);
const ND = cnj('5400400', '2026', '8', '09', '0107'); modo[dig(ND)] = 'vazio';
await page.click('[data-pr="novo"]'); await page.waitForTimeout(400);
await page.fill('#pr_numero', ND); await page.keyboard.press('Tab'); await page.waitForTimeout(2500);
check(/ainda não tem este processo/.test(await t('#pr_dj')), 'processo ainda fora do DataJud: avisa com calma');
// 5) dígito verificador errado não consulta
await page.click('#prX'); await page.waitForTimeout(300);
const antes = chamadas.length;
await page.click('[data-pr="novo"]'); await page.waitForTimeout(400);
await page.fill('#pr_numero', '5400500-00.2026.8.09.0107'); await page.keyboard.press('Tab'); await page.waitForTimeout(1200);
check(chamadas.length === antes && /dígito verificador/.test(await t('#pr_dj')), 'número com dígito errado: não consulta e avisa');
await page.click('#prX'); await page.waitForTimeout(300);
// 6) ficha do processo já cadastrado
await page.click('[data-pr="abrir"][data-n="' + dig(NA) + '"]'); await page.waitForTimeout(600);
check(await v('pr_ajuiz') === '2026-09-30' && /Buscar dados no DataJud/.test(await t('#prCorpo')), 'a ficha mostra a data de ajuizamento e o botão do DataJud');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
for (const col of ['processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await br.close(); srv.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
