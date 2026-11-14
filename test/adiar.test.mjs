// Testa "adiar parcela": escolha na Central, modo "só uma parcela" no Renegociar e "Adiar atrasadas" do Murilo.
// Suba antes:  npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --port 8802
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const dia = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10), agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.7' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await api('GET', col)).json()).docs) await api('DELETE', col + '/' + d.id);
const caso = (id, cliente, origem, ps) => api('PUT', 'casos/' + id, { tipo: 'inicial', cliente, nomeAcao: 'Cobrança', origem, prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: ps.reduce((t, p) => t + p.valor, 0), parcelas: ps.map((p, i) => ({ numero: i + 1, valor: p.valor, data: p.data, pago: false })), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await caso('c1', 'Joana Murilo', 'murilo', [{ valor: 1000, data: dia(-40) }, { valor: 1000, data: dia(-10) }, { valor: 1000, data: dia(20) }]);
await caso('c2', 'Pedro Silva', 'murilo', [{ valor: 2000, data: dia(-5) }]);
await caso('c3', 'Ana Própria', 'proprio', [{ valor: 700, data: dia(-3) }]);
await api('PUT', 'termosAcordo/a1', { partes: 'Complem x Maurício', numeroProcesso: '1', origem: 'murilo', status: 'pendente', valorTotal: 9000, valorMeuHonorario: 2277.14, data: dia(-4), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await api('PUT', 'alvaras/v1', { numeroProcesso: '9', partes: 'Ciclano x Banco', origem: 'proprio', valorTotalHonorarios: 5000, valorMeuHonorario: 4000, status: 'pendente', fase: 'expedido', faseDesde: dia(-3), previsaoLevantamento: dia(-2), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await api('PUT', 'config/backup', { ultimoEm: agora });
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 420, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, r => r.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(2500);
const linha = nome => page.evaluate(n => { const els = Array.from(document.querySelectorAll('#atencaoLista [data-chave]')).filter(e => e.innerText.includes(n)); return els.length ? els.map(e => e.getAttribute('data-chave')) : []; }, nome);
const getDoc = async (col, id) => (await (await api('GET', col)).json()).docs.find(d => d.id === id).data;
const caso1 = () => getDoc('casos', 'c1');
const visivel = id => page.evaluate(i => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== 'none' && e.classList.contains('show'); }, id);
// 1) Central: toque na parcela atrasada
const chaves = await linha('Joana Murilo');
const chP2 = chaves.find(c => c.endsWith('|parcela|2'));
check(!!chP2, 'a Central lista a parcela 2 atrasada da Joana');
await page.click('#atencaoLista [data-chave="' + chP2 + '"]'); await page.waitForTimeout(400);
check(await visivel('overlayAdEscolha') && /Parcela 2/.test(await page.evaluate(() => document.getElementById('adEscTitulo').textContent)), 'tocar numa parcela atrasada abre a escolha (Marcar como recebido / Renegociar)');
await page.click('#adEscRecebi'); await page.waitForTimeout(500);
check(await visivel('overlayBaixa') || await page.evaluate(() => !!document.querySelector('#overlayBaixa.show, #baixaLista')), '"Marcar como recebido" abre o formulário de recebimento');
await page.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show')));
// 2) Renegociar -> só uma parcela
await page.click('#atencaoLista [data-chave="' + chP2 + '"]'); await page.waitForTimeout(300); await page.click('#adEscReneg'); await page.waitForTimeout(500);
check(await visivel('overlayReneg') && await page.evaluate(() => getComputedStyle(document.getElementById('rnParcelaBox')).display !== 'none' && getComputedStyle(document.getElementById('rnContratoBox')).display === 'none'), '"Renegociar" abre já no modo "só uma parcela"');
check(await page.evaluate(() => document.getElementById('rnParcelaSel').value) === chP2 && await page.evaluate(() => document.getElementById('rnConfirmar').textContent) === 'Adiar parcela', 'a parcela tocada vem selecionada e o botão é "Adiar parcela"');
check(await page.evaluate(() => document.querySelectorAll('#rnParcelaSel option').length) === 3, 'o seletor lista as 3 pendências abertas do contrato');
await page.click('#rnConfirmar'); await page.waitForTimeout(300);
check(/Escolha a nova data/.test(await page.evaluate(() => document.getElementById('rnErro').textContent)), 'sem data: pede a data');
await page.evaluate(d => { const e = document.getElementById('rnParcelaData'); e.value = d; e.dispatchEvent(new Event('input', { bubbles: true })); }, dia(-1)); await page.click('#rnConfirmar'); await page.waitForTimeout(300);
check(/hoje em diante/.test(await page.evaluate(() => document.getElementById('rnErro').textContent)), 'data no passado: recusa');
check(await page.evaluate(() => document.getElementById('rnParcelaData').min) === dia(0), 'o calendário não deixa escolher antes de hoje');
await page.click('#rnParaContrato'); await page.waitForTimeout(200);
check(await page.evaluate(() => getComputedStyle(document.getElementById('rnContratoBox')).display !== 'none' && document.getElementById('rnConfirmar').textContent === 'Renegociar'), '"Renegociar o contrato todo" mostra a renegociação completa de sempre');
await page.click('#rnParaParcela'); await page.waitForTimeout(200);
await page.fill('#rnParcelaObs', 'Murilo viajando');
await page.evaluate(d => { const e = document.getElementById('rnParcelaData'); e.value = d; e.dispatchEvent(new Event('input', { bubbles: true })); }, dia(5)); await page.click('#rnConfirmar'); await page.waitForTimeout(1200);
let c1 = await caso1();
check(c1.parcelas[1].data === dia(5) && c1.parcelas[1].dataOriginal === dia(-10), 'a parcela 2 passou para a data nova e guardou a original');
check(c1.parcelas[0].data === dia(-40) && c1.parcelas[2].data === dia(20) && c1.parcelas[1].valor === 1000 && c1.parcelas.every(p => !p.pago), 'as outras parcelas, os valores e os pagamentos ficaram como estavam');
check(c1.renegociacoes && c1.renegociacoes[0].tipo === 'adiamento' && c1.renegociacoes[0].obs === 'Murilo viajando' && c1.renegociacoes[0].itens[0].de === dia(-10) && c1.renegociacoes[0].itens[0].para === dia(5), 'o histórico registra o adiamento (de, para e motivo)');
await page.evaluate(() => { const m = document.getElementById('atencaoMais'); if (m && getComputedStyle(m).display !== 'none' && /Ver todos/.test(m.textContent)) m.click(); }); await page.waitForTimeout(400);
const linhaJ = await page.evaluate(() => Array.from(document.querySelectorAll('#atencaoLista [data-chave]')).map(e => e.innerText).filter(t => /Joana/.test(t) && /Parcela 2/.test(t)).join('|'));
check(/Adiada/.test(linhaJ) && /era/.test(linhaJ) && !/atrasado/i.test(linhaJ), 'na Central a parcela aparece com a etiqueta "Adiada" e a data original, fora do atraso');
// 3) Desfazer
await page.evaluate(() => document.getElementById('desfazerBtn').click()); await page.waitForTimeout(300); await page.evaluate(() => { const b = document.querySelector('#toast button'); b && b.click(); }); await page.waitForTimeout(900);
c1 = await caso1(); check(c1.parcelas[1].data === dia(-10), 'o Desfazer devolve a parcela à data anterior');
// 4) alvará: continua direto
const chA = (await linha('Ciclano'))[0];
if (chA) { await page.click('#atencaoLista [data-chave="' + chA + '"]'); await page.waitForTimeout(400); check(!(await visivel('overlayAdEscolha')), 'alvará atrasado continua abrindo direto o recebimento (sem a escolha)'); await page.evaluate(() => document.querySelectorAll('.overlay.show').forEach(o => o.classList.remove('show'))); }
// 5) Murilo
await page.evaluate(() => document.getElementById('abrirRelMuriloBtn').click()); await page.waitForTimeout(700);
check(await page.evaluate(() => getComputedStyle(document.getElementById('relAdiarBtn')).display !== 'none'), 'o botão "Adiar atrasadas…" aparece em Cobranças do Murilo');
await page.click('#relAdiarBtn'); await page.waitForTimeout(500);
const nomes = await page.evaluate(() => Array.from(document.querySelectorAll('#adMurLista .ad-it')).map(e => e.innerText.replace(/\n/g, ' ')));
check(nomes.length === 4 && nomes.some(n => /Joana Murilo.*Parcela 1/.test(n)) && nomes.some(n => /Joana Murilo.*Parcela 2/.test(n)) && nomes.some(n => /Pedro Silva/.test(n)) && nomes.some(n => /Complem/.test(n)) && !nomes.some(n => /Ana Própria|Ciclano|Parcela 3/.test(n)), 'lista só as atrasadas do Murilo (4), sem clientes próprios, alvará nem parcelas em dia');
check(await page.evaluate(() => document.querySelectorAll('#adMurLista input:checked').length) === 4 && /Adiar 4 parcelas/.test(await page.evaluate(() => document.getElementById('adMurConfirmar').textContent)), 'vêm todas marcadas e o botão mostra a contagem');
await page.evaluate(() => { const i = Array.from(document.querySelectorAll('#adMurLista .ad-it')).find(e => /Pedro/.test(e.innerText)).querySelector('input'); i.click(); }); await page.waitForTimeout(200);
check(/Adiar 3 parcelas/.test(await page.evaluate(() => document.getElementById('adMurConfirmar').textContent)), 'desmarcar uma atualiza a contagem (3)');
await page.click('#adMurConfirmar'); await page.waitForTimeout(300);
check(/Escolha a nova data/.test(await page.evaluate(() => document.getElementById('adMurErro').textContent)), 'sem data: pede a data');
await page.evaluate(d => { const e = document.getElementById('adMurData'); e.value = d; }, dia(12)); await page.fill('#adMurObs', 'Murilo viajando');
await page.click('#adMurConfirmar'); await page.waitForTimeout(1800);
c1 = await caso1(); const c2 = await getDoc('casos', 'c2'), a1 = await getDoc('termosAcordo', 'a1'), c3 = await getDoc('casos', 'c3');
check(c1.parcelas[0].data === dia(12) && c1.parcelas[1].data === dia(12) && c1.parcelas[2].data === dia(20), 'Joana: as duas atrasadas foram para a data nova e a parcela 3 ficou no dia dela');
check(c2.parcelas[0].data === dia(-5) && c3.parcelas[0].data === dia(-3), 'o que você desmarcou (Pedro) e o cliente próprio não mudaram');
check(a1.data === dia(12) && a1.dataOriginal === dia(-4) && a1.renegociacoes[0].tipo === 'adiamento', 'o termo de acordo também foi adiado, com histórico');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ' -> ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? falhas + ' FALHAS' : 'tudo ok'); process.exit(falhas ? 1 : 0);
