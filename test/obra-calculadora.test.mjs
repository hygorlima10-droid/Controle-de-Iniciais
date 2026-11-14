// Construção › Calculadora de custos: valores OFICIAIS (SINAPI/IBGE de Goiás e INCC) buscados sozinhos pelo servidor; o proprietário só informa área, fator do padrão,
// outros custos e margem. Estimativa, evolução (materiais × mão de obra, INCC), falha da fonte e aviso de atualização parada.
// A fonte oficial é simulada (porta 8892). Grupo principal:  node test/rodar.mjs obra-calculadora
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const mes = (n) => { const d = new Date(Date.parse(hoje.slice(0, 7) + '-15T12:00:00Z')); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
// 14 meses até o mês passado: total sobe R$ 10/mês a partir de 2.000 (último = 2.130), materiais 55% e mão de obra o resto; INCC 0,5% ao mês
const N = 14, SER = Array.from({ length: N }, (_, k) => { const total = 2000 + 10 * k, mat = Math.round(total * 55) / 100; return { mes: mes(k - N), total, mat, mo: Math.round((total - mat) * 100) / 100 }; });
let pedidos = 0, fora = false;
const L = (v, c, m) => ({ D2C: String(v), D3C: m.replace('-', ''), V: String(c) });
const fonte = http.createServer((q, r) => {
  pedidos++; if (fora) { r.statusCode = 503; return r.end('fora'); }
  r.setHeader('content-type', 'application/json');
  if (q.url.startsWith('/values/t/2296/n3/52/')) return r.end(JSON.stringify([{ D2C: 'Variável (Código)' }].concat(SER.flatMap(x => [L(48, x.total, x.mes), L(2119, x.mat, x.mes), L(2120, x.mo, x.mes)]))));
  if (q.url.includes('bcdata.sgs.192')) return r.end(JSON.stringify(SER.map(x => ({ data: '01/' + x.mes.slice(5) + '/' + x.mes.slice(0, 4), valor: '0.50' }))));
  r.statusCode = 404; r.end('{}');
});
await new Promise((ok) => fonte.listen(8892, '127.0.0.1', ok));
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.73' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('PUT', 'config/backup', { ultimoEm: agora }); await api('PUT', 'config/importacaoAuto', { ativo: false, desde: agora });
await api('PUT', 'config/obra', { nome: 'Casa', criada: true, orcamentoTotal: 450000, criadoEm: agora, financiamento: { status: 'estimado', valor: 300000, banco: 'Caixa' }, etapas: [{ id: 'e1', nome: 'Terraplanagem', orcado: 20000, status: 'andamento', ordem: 1 }] });
// a rota: só leitura, e guarda no banco
r = await fetch(B + '/api/indices?atualizar=1', { headers: { cookie: ck } }); let d = await r.json();
check(r.status === 200 && d.sinapi.length === N && d.incc.length === N && d.sinapi[N - 1].total === 2130, '/api/indices busca no IBGE e no Banco Central e devolve ' + N + ' meses');
check((await fetch(B + '/api/indices', { method: 'POST', headers: { cookie: ck, 'content-type': 'application/json' }, body: '{}' })).status === 405, '/api/indices não aceita gravação');
check((await fetch(B + '/api/indices')).status === 401, '/api/indices exige entrar no sistema');
const n0 = pedidos; await (await fetch(B + '/api/indices', { headers: { cookie: ck } })).json();
check(pedidos === n0, 'abrir de novo no mesmo dia não busca outra vez (usa o que está guardado)');
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { obra: 'calc' }, per: 6 })); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="obra"]').click()); await page.waitForTimeout(1500);
const painel = () => page.evaluate(() => (document.querySelector('.md-painel[data-mf="obra-calc"]') || {}).innerText || '').then(s => s.replace(/\s+/g, ' '));
const num = (t, rx) => { const m = rx.exec(t); return m ? Number(m[1].replace('−', '-').replace('+', '').replace(/\./g, '').replace(',', '.')) : null; };
check(await page.evaluate(() => [...document.querySelectorAll('#obAbas button')].map(b => b.innerText.trim()).includes('Calculadora')), 'a Construção tem a sub-aba "Calculadora"');
let t = await painel();
check(/Valores oficiais já carregados/.test(t) && /Último mês/.test(t) && /não digita nada/.test(t), 'a calculadora já abre com os valores oficiais carregados, sem pedir nada para digitar');
check(await page.evaluate(() => !document.querySelector('[data-mfc="atualizar"],#mfRefMes,[data-mfc-padrao]')), 'não existe mais formulário de valores de referência nem escolha de CUB');
check(!/Estimativa de hoje.*R\$\s*\d/.test(t) || /Informe a área/.test(t), 'sem a área, a estimativa pede a área');
// seus dados: 100 m² × 2.130 × 1,10 = 234.300 + 20.000 = 254.300 + 10% = 25.430 → 279.730
await page.fill('#mfc_area', '100'); await page.dispatchEvent('#mfc_area', 'input'); await page.fill('#mfc_fator', '1,10'); await page.dispatchEvent('#mfc_fator', 'input'); await page.fill('#mfc_outros', '20000'); await page.dispatchEvent('#mfc_outros', 'input'); await page.waitForTimeout(300);
t = await painel();
check(/R\$\s*234\.300,00/.test(t) && /R\$\s*20\.000,00/.test(t) && /R\$\s*25\.430,00/.test(t) && /Total estimado R\$\s*279\.730,00/.test(t), 'estimativa ao vivo: 100 m² × R$ 2.130 × 1,10 + R$ 20.000 + margem de 10% = R$ 279.730,00');
check(/Materiais 55(,0)?% · mão de obra 45(,0)?%/.test(t), 'proporção materiais × mão de obra vem do último mês do SINAPI (55% / 45%)');
await page.dispatchEvent('#mfc_outros', 'change'); await page.waitForTimeout(1200);
t = await painel();
check(/Total estimado R\$\s*279\.730,00/.test(t) && await page.inputValue('#mfc_area') === '100' && /^1,1/.test(await page.inputValue('#mfc_fator')), 'ao sair do campo, a escolha é guardada e a tela continua igual');
const o = (await (await api('GET', 'config')).json()).docs.find(x => x.id === 'obra').data;
check(o.calc && o.calc.area === 100 && o.calc.fator === 1.1 && o.calc.outros === 20000 && o.calc.margem === 10 && o.nome === 'Casa' && o.financiamento.banco === 'Caixa' && !o.refs, 'área, fator, outros custos e margem ficam no config da obra, sem perder o resto do documento');
// evolução: total 2.130 contra 1 ano atrás (13 meses de dados → índice N-13 = 2.010) = +5,97%; mês: 2.120 → 2.130 = +0,47%
const v12 = num(t, /Em 12 meses ([+−-][\d,]+)%/), vm = num(t, /No último mês ([+−-][\d,]+)%/);
check(v12 !== null && Math.abs(v12 - (2130 / 2010 - 1) * 100) < 0.06, 'evolução em 12 meses do custo do m²: ' + v12 + '% (esperado ≈ 5,97%)');
check(vm !== null && Math.abs(vm - (2130 / 2120 - 1) * 100) < 0.06, 'evolução no último mês: ' + vm + '% (esperado ≈ 0,47%)');
const vmat = num(t, /Materiais · em 12 meses ([+−-][\d,]+)%/), vmo = num(t, /Mão de obra · em 12 meses ([+−-][\d,]+)%/);
check(vmat !== null && vmo !== null && Math.abs(vmat - (2130 / 2010 - 1) * 100) < 0.1 && Math.abs(vmo - (2130 / 2010 - 1) * 100) < 0.1, 'materiais e mão de obra mostrados separadamente (' + vmat + '% e ' + vmo + '%)');
const inc = num(t, /Acumulado em 12 meses ([+−-][\d,]+)%/);
check(inc !== null && Math.abs(inc - (Math.pow(1.005, 12) - 1) * 100) < 0.06 && /INCC/.test(t), 'INCC: acumulado em 12 meses ≈ 6,17% (0,5% ao mês): ' + inc + '%');
// sua estimativa um ano atrás: 100 × 2.010 × 1,1 = 221.100 + 20.000 = 241.100 + 10% = 265.210
check(/um ano atrás: R\$\s*265\.210,00/.test(t) && /hoje R\$\s*279\.730,00/.test(t), 'compara a sua estimativa de um ano atrás (R$ 265.210,00) com a de hoje (R$ 279.730,00)');
check(!/parece parada/.test(t), 'dados em dia: sem aviso de atualização parada');
// fonte fora do ar: o app segue com o que já tinha
fora = true; r = await fetch(B + '/api/indices?atualizar=1', { headers: { cookie: ck } }); d = await r.json();
check(d.falhou === true && d.sinapi.length === N && d.erros.sinapi, 'fonte fora do ar: guarda o erro e mantém os ' + N + ' meses que já tinha');
await page.evaluate(() => document.querySelector('[data-mfc="recarregar"]') && 0); fora = false;
// atualização parada (dados de 5 meses atrás): aviso na calculadora e na Central de atenção
await page.waitForTimeout(1800); await page.evaluate((s) => window.__horusTeste.mfDefinir({ sinapi: s, incc: [] }), SER.slice(0, N - 4).map((x, i) => ({ ...x, mes: mes(-5 - (N - 5 - i)) })));
await page.evaluate(() => { window.__horusTeste.mfS.obra = 'calc'; document.querySelector('#obAbas [data-mf-obra="calc"]').click(); }); await page.waitForTimeout(500); t = await painel();
check(/atualização automática parece parada/i.test(t) && /Atualizar agora/.test(t), 'dados com mais de 2 meses de atraso: avisa que a atualização automática parece parada');
await page.waitForTimeout(400);
const aviso = await page.evaluate(() => document.getElementById('atencaoLista') ? document.getElementById('atencaoLista').innerText : '');
check(/valores de referência sem atualizar/i.test(aviso), 'a Central de atenção avisa que os valores de referência não estão atualizando');
await page.click('[data-mfc="recarregar"]'); await page.waitForFunction(() => !/parece parada/.test((document.querySelector('.md-painel[data-mf="obra-calc"]') || {}).innerText || ''), null, { timeout: 8000 }).catch(() => { }); t = await painel();
check(!/parece parada/.test(t) && /Valores oficiais já carregados/.test(t), '"Atualizar agora" busca de novo e o aviso some');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); fonte.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
