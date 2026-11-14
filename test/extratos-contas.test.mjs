// Fase 3, etapa 3.9: Extratos: cadastro de contas com logo, reconhecimento em 3 níveis (Exata / Parecida / Sem correspondência)
// e as regras que o app aprendeu (ver, editar e apagar em Configurações).
// Use: node test/rodar.mjs extratos-contas
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hojeISO = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dia = n => new Date(Date.parse(hojeISO + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10), m0 = hojeISO.slice(0, 7);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.57' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
await api('PUT', 'config/backup', { ultimoEm: agora }); await api('PUT', 'config/importacaoAuto', { ativo: false, desde: agora });
const emitido = dia(-2) + 'T12:00:00.000Z';
await api('PUT', 'config/obra', { nome: 'Casa', criada: true, orcamentoTotal: 100000, criadoEm: agora, financiamento: { status: 'aprovado', valor: 50000 }, etapas: [], contratos: [], extrato: { palavras: '', regras: {} } });
await api('PUT', 'obraMov/a1', { tipo: 'aporte', origem: 'externo', data: dia(-30), valor: 11880, criadoEm: agora });
const C = (extra) => Object.assign({ confirmada: true, titular: {} }, extra);
await api('PUT', 'config/extratos', { pastaId: 'p', pastaNome: 'extratos', iniciado: true, dataCorte: dia(-60), configuradoEm: agora,
  contas: { 'itau-1': C({ coluna: 'pj', rotulo: 'Itaú · Hygor (PJ)', banco: 'Itaú', ultimoSaldo: { valor: 1420000, emitido } }), 'itau-2': C({ coluna: 'pf', rotulo: 'Itaú · Pessoa física', banco: 'Itaú', ultimoSaldo: { valor: 310000, emitido } }),
    'sicoob-1': C({ coluna: 'pf', rotulo: 'Sicoob · financiamento da obra', banco: 'Sicoob', obra: true, ultimoSaldo: { valor: 1188004, emitido } }), 'c6-1': C({ coluna: 'pf', rotulo: 'C6 Bank', banco: 'C6' }), 'nu-1': C({ coluna: 'pf', rotulo: 'Nubank', banco: 'Nubank' }) },
  regras: { 'F:IMOBILIARIA XPTO': { t: 'desp', nome: 'Aluguel do escritório' }, 'F:JOSE R SILVA': { t: 'cli', cliente: 'José R Silva' } } });
await api('PUT', 'despesas/al', { nome: 'Aluguel do escritório', coluna: 'pj', tipo: 'unica', valor: 1500, data: dia(-4).slice(0, 7) + '-28', mesReferencia: dia(-4).slice(0, 7), categoria: 'estrutura', pago: false, criadoEm: agora });
await api('PUT', 'despesas/ca', { nome: 'Uniclass cartão', coluna: 'pf', tipo: 'unica', valor: 1000, data: dia(-6).slice(0, 7) + '-28', mesReferencia: dia(-6).slice(0, 7), categoria: 'outros', pago: false, criadoEm: agora });
const caso = (id, cliente, v) => api('PUT', 'casos/' + id, { tipo: 'inicial', cliente, nomeAcao: 'Cobrança', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: v * 2, parcelas: [{ numero: 1, valor: v, data: dia(-1), pago: false }, { numero: 2, valor: v, data: dia(29), pago: false }], clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await caso('c1', 'Maria Souza', 1500); await caso('c2', 'José R Silva', 3000);
const L = (h, d, s, n, v) => ({ h, d, s, n, o: '', v });
const arq = (id, chave, tipoConta, lanc) => api('PUT', 'extratos/arq_' + id, { tipo: 'arquivo', fileId: id, titulo: id + '.pdf', lidoEm: agora, status: 'pendente', motivo: '', chave, banco: 'Itaú', tipoConta, ag: '', cc: '1', titular: {}, de: dia(-20), ate: dia(-1), emitido, saldoAtual: 1420000, saldoNovo: false, saldoFecha: true, nConf: 3, nDiverg: 0, nTotal: lanc.length, nRep: 0, nDescartadas: 0, corte: dia(-60), lanc });
await arq('pj', 'itau-1', 'pj', [L('h1', dia(-5), 'PIX RECEBIDO', 'MARIA SOUZA', 150000), L('h2', dia(-4), 'PIX ENVIADO', 'IMOBILIARIA XPTO', -150000), L('h3', dia(-3), 'TED RECEBIDA', 'JOSE R SILVA', 300000), L('h4', dia(-2), 'PIX RECEBIDO', 'DESCONHECIDO LTDA', 70000)]);
await arq('pf', 'itau-2', 'pf', [L('h5', dia(-6), 'COMPRA CARTAO UNICLASS', '', -189000), L('h6', dia(-5), 'SUPERMERCADO BOM PRECO', '', -8000)]);
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="extratos"]').click()); await page.waitForTimeout(1200);
const corpo = () => page.evaluate(() => document.getElementById('extCorpo').innerText);
// 1) cadastro de contas com logo
await page.click('#extContas'); await page.waitForTimeout(600);
let t = await corpo();
check(/Cadastro de contas/.test(t) && /Cada conta ganha logo/.test(t), 'a tela de contas explica o cadastro (logo, apelido, tipo e último saldo)');
const logos = await page.evaluate(async () => { const imgs = Array.from(document.querySelectorAll('#extCorpo .exc-logo img')); await Promise.all(imgs.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))); return imgs.map(i => i.getAttribute('src').split('/').pop() + ':' + (i.naturalWidth > 0)); });
check(logos.length === 4 && logos.sort().join('|') === 'c6.png:true|itau.svg:true|itau.svg:true|sicoob.png:true', 'logos de verdade para Itaú (2 contas), Sicoob e C6, todos carregam: ' + logos.join(', '));
check(await page.evaluate(() => { const s = document.querySelectorAll('#extCorpo .exc-selo'); return s.length === 1 && s[0].innerText.trim() === 'N'; }), 'banco sem logo (Nubank) fica com o selo da inicial');
check(await page.evaluate(() => Array.from(document.querySelectorAll('#extCorpo .exc-apelido')).map(i => i.value).includes('Itaú · Hygor (PJ)')), 'cada conta mostra o apelido (editável)');
check(/PJ/.test(t) && /PF/.test(t) && /dinheiro da obra/i.test(t) && /saldo R\$\s*14\.200,00/.test(t) && /ainda sem extrato/.test(t), 'tipo (PJ, PF, dinheiro da obra), último saldo lido e "ainda sem extrato"');
check(/extrato R\$\s*11\.880,04/.test(t) && /app R\$\s*11\.880,00/.test(t) && /bate/.test(t), 'conta da obra: extrato R$ 11.880,04 × app R$ 11.880,00 → "bate" (diferença de centavos)');
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'ext-contas.png' });
await page.fill('[data-ctaapelido="nu-1"]', 'Nubank da Hygor'); await page.press('[data-ctaapelido="nu-1"]', 'Tab'); await page.waitForTimeout(800);
const cfgC = await (await api('GET', 'config')).json(); const cx = ((cfgC.docs.find(d => d.id === 'extratos') || {}).data || {}).contas || {};
check(cx['nu-1'] && cx['nu-1'].rotulo === 'Nubank da Hygor', 'trocar o apelido da conta fica salvo');
await page.click('#extGenCancelar'); await page.waitForTimeout(300);
// 2) conferência com os 3 níveis
await page.click('#extConferir'); await page.waitForTimeout(1500);
t = await corpo();
const nivel = async (txt) => page.evaluate((x) => { const l = Array.from(document.querySelectorAll('#extLinhas [data-lin]')).find(e => e.innerText.includes(x)); const n = l && l.querySelector('.exc-nv'); return n ? n.innerText.trim() + ' | ' + l.querySelector('.ext-motivo').innerText : ''; }, txt);
const n1 = await nivel('MARIA SOUZA'), n2 = await nivel('IMOBILIARIA XPTO'), n3 = await nivel('JOSE R SILVA'), n4 = await nivel('DESCONHECIDO'), n5 = await nivel('UNICLASS'), n6 = await nivel('SUPERMERCADO');
check(/^Exata/.test(n1) && /combina com Maria Souza/.test(n1), 'PIX da Maria Souza (nome e valor batem com a parcela): Exata → ' + n1);
check(/^Exata/.test(n2) && /regra que você ensinou: "Aluguel do escritório"/.test(n2), 'PIX para a imobiliária (regra que você ensinou → despesa Aluguel do escritório): Exata → ' + n2);
check(/^Exata/.test(n3) && /regra que você ensinou: José R Silva/.test(n3), 'TED do José R Silva (regra → cobrança do cliente): Exata → ' + n3);
check(/^Parecida/.test(n5) && /confirme/.test(n5), 'compra no cartão Uniclass (despesa de nome parecido, valor diferente): Parecida (confirme) → ' + n5);
check(/^Parecida/.test(n6) && /categoria sugerida/.test(n6) && /Mercado/.test(n6), 'supermercado no PF: Parecida (categoria sugerida pelo texto: Mercado) → ' + n6);
check(/^Sem correspondência/.test(n4) && /decidir/.test(n4), 'PIX de quem não aparece em nada: Sem correspondência (decidir) → ' + n4);
check(/Exata 3/.test(t) && /Parecida 2/.test(t) && /Sem correspondência 1/.test(t) && /O app só sugere/.test(t), 'resumo dos 3 níveis no alto da conferência (3 exatas, 2 parecidas, 1 sem correspondência) e a frase "O app só sugere"');
check(await page.evaluate(() => !!document.querySelector('#extCorpo .ext-arq-top .exc-logo img')), 'a conferência mostra o logo do banco no cabeçalho de cada extrato');
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'ext-conferencia.png', fullPage: true });
await page.click('#extGenCancelar').catch(() => { }); await page.evaluate(() => document.getElementById('extFechar') && document.getElementById('extFechar').click()); await page.waitForTimeout(300);
// 3) aprender a regra
const ap = await page.evaluate(() => { const T = window.__horusTeste, r = {}; const m = T.excAprender([{ act: 'desp', destAlterado: true, l: { n: 'LOJA NOVA LTDA', s: 'PIX ENVIADO' }, sel: { desp: 'ca|x' } }, { act: 'rec', destAlterado: true, l: { n: 'CARLOS PEREIRA', s: 'PIX RECEBIDO' }, sel: { unit: '' } }, { act: 'dia', destAlterado: false, l: { n: 'X', s: 'Y' }, sel: {} }], r); return { m, r, chave: T.excChave({ n: 'Loja Nova Ltda', s: 'PIX ENVIADO' }) }; });
check(ap.m === true && ap.r['F:LOJA NOVA LTDA'] && ap.r['F:LOJA NOVA LTDA'].t === 'desp' && ap.r['F:LOJA NOVA LTDA'].nome === 'Uniclass cartão' && Object.keys(ap.r).length === 1 && ap.chave === 'F:LOJA NOVA LTDA', 'ao confirmar uma linha cujo destino você mudou, o app aprende "nome do favorecido → despesa" (só quando você mudou)');
// 4) regras em Configurações
await page.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await page.waitForTimeout(800);
check(await page.evaluate(() => /Extratos: regras que você ensinou/.test(document.getElementById('cfWrap').innerText)), 'Configurações tem a linha "Extratos: regras que você ensinou"');
await page.click('[data-cf="extregras"]'); await page.waitForTimeout(600); t = await corpo();
const vals = await page.evaluate(() => Array.from(document.querySelectorAll('#extCorpo [data-exr-txt]')).map(i => i.value));
check(/O app só sugere/.test(t) && /imobiliaria xpto/.test(t) && /jose r silva/.test(t) && vals.includes('Aluguel do escritório') && vals.includes('José R Silva'), 'a tela lista as regras (palavras → destino): imobiliária → Aluguel do escritório, José R Silva → cobrança');
await page.fill('[data-exr-txt="F:IMOBILIARIA XPTO"]', 'Aluguel da sala'); await page.press('[data-exr-txt="F:IMOBILIARIA XPTO"]', 'Tab'); await page.waitForTimeout(800);
let rg = ((await (await api('GET', 'config')).json()).docs.find(d => d.id === 'extratos').data || {}).regras;
check(rg['F:IMOBILIARIA XPTO'].nome === 'Aluguel da sala', 'editar o destino de uma regra fica salvo');
const nDesp = (await (await api('GET', 'despesas')).json()).docs.length;
await page.click('[data-exr-del="F:JOSE R SILVA"]'); await page.waitForTimeout(800);
rg = ((await (await api('GET', 'config')).json()).docs.find(d => d.id === 'extratos').data || {}).regras;
check(!rg['F:JOSE R SILVA'] && !!rg['F:IMOBILIARIA XPTO'] && (await (await api('GET', 'despesas')).json()).docs.length === nDesp && (await (await api('GET', 'casos')).json()).docs.length === 2, 'apagar uma regra tira só a regra: nenhum lançamento é alterado');
if (process.env.SHOT) { await page.screenshot({ path: process.env.SHOT + 'ext-regras.png' }); }
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
