// Auditoria F-04: "já lançado" no reconhecimento de extratos exige mesma data OU nome parecido; uma compra diferente de mesmo valor em dias próximos fica pendente, com a nota.
// Grupo principal:  node test/rodar.mjs extratos-ja-lancado
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
const r = await page.evaluate(() => {
  const f = window.__horusTeste.extAcharMov, mk = (nome, data = '2026-11-10') => [{ data, valor: 25000, tipo: 'saida', usado: false, nome }], o = {};
  let v = {}; o.outraCompra = f(mk('Internet Vivo'), 25000, 'saida', '2026-11-12', { n: 'PADARIA DO ZE', s: 'COMPRA CARTAO' }, v); o.nota = v.parecida || '';
  o.nomeParecido = f(mk('Internet Vivo'), 25000, 'saida', '2026-11-12', { n: 'PIX ENVIADO VIVO FIBRA', s: '' }, {});
  o.mesmaData = f(mk('Internet Vivo'), 25000, 'saida', '2026-11-10', { n: 'PADARIA DO ZE', s: '' }, {});
  o.semLinha = f(mk('Internet Vivo'), 25000, 'saida', '2026-11-12');
  o.longe = f(mk('Internet Vivo'), 25000, 'saida', '2026-11-20', { n: 'PIX VIVO', s: '' }, {});
  o.tipoDiferente = f(mk('Internet Vivo'), 25000, 'entrada', '2026-11-10', { n: 'VIVO', s: '' }, {});
  const dois = [{ data: '2026-11-10', valor: 25000, tipo: 'saida', usado: false, nome: 'Internet Vivo' }, { data: '2026-11-11', valor: 25000, tipo: 'saida', usado: false, nome: 'Padaria' }];
  o.a = f(dois, 25000, 'saida', '2026-11-11', { n: 'PADARIA DO ZE', s: '' }, {}); o.b = f(dois, 25000, 'saida', '2026-11-12', { n: 'PIX VIVO', s: '' }, {}); o.c = f(dois, 25000, 'saida', '2026-11-11', { n: 'OUTRA', s: '' }, {});
  return o;
});
check(r.outraCompra === false && /parecida com um lançamento de mesmo valor em/.test(r.nota) && /Internet Vivo/.test(r.nota), 'compra diferente, mesmo valor, 2 dias depois: NÃO vira "já lançado" e a linha recebe a nota: ' + r.nota);
check(r.nomeParecido === true, 'mesmo valor, dias próximos e nome parecido (VIVO): continua sendo "já lançado"');
check(r.mesmaData === true, 'mesma data e mesmo valor: "já lançado", como antes');
check(r.semLinha === true, 'sem o texto da linha (usos antigos), vale só valor, tipo e data');
check(r.longe === false && r.tipoDiferente === false, 'mais de 3 dias ou entrada x saída nunca casa');
check(r.a === true && r.b === true && r.c === false, 'cada lançamento do app cobre uma linha só: duas linhas parecidas casam com dois lançamentos diferentes e a terceira fica pendente');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
