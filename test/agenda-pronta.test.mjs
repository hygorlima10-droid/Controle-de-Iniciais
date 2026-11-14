// Agenda: "Meu dia" (segunda sub-aba, depois do Resumo) e "Peça pronta" (etapa antes de protocolada; o prazo continua aberto até protocolar).
// Use: node test/rodar.mjs agenda-pronta
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const agora = new Date().toISOString(), hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.61' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const api = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
for (const col of ['agenda', 'processos', 'casos', 'clientes']) { const j = await (await api('GET', '/api/db/' + col)).json(); for (const d of j.docs) await api('DELETE', '/api/db/' + col + '/' + d.id); }
await api('PUT', '/api/db/config/backup', { ultimoEm: agora });
const ler = async (id) => (await (await api('GET', '/api/db/agenda')).json()).docs.find(d => d.id === id).data;
const novo = async (o) => (await (await api('POST', '/api/db/agenda', Object.assign({ situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora }, o))).json()).id;
const idP1 = await novo({ tipo: 'prazo', titulo: 'Prazo para marcar pronta', cliente: 'Cliente Um', data: dia(20), trabalhar: hoje });
await novo({ tipo: 'audiencia', titulo: 'Audiência de hoje', cliente: 'Cliente Dois', data: hoje, hora: '14:30', link: 'https://meet.google.com/abc-defg-hij', modalidade: 'online' });
await novo({ tipo: 'prazo', titulo: 'Vence hoje teste', cliente: 'Cliente Três', data: hoje });
const idP4 = await novo({ tipo: 'prazo', titulo: 'Trabalho atrasado teste', cliente: 'Cliente Quatro', data: dia(10), trabalhar: dia(-2) });
const idP5 = await novo({ tipo: 'prazo', titulo: 'Pronta para conferir', cliente: 'Cliente Cinco', data: dia(5), trabalhar: dia(-3), situacao: 'pronta', prontaEm: hoje, prontaPor: 'Murilo Estagiário' });
await novo({ tipo: 'tarefa', titulo: 'Tarefa de hoje', cliente: 'Cliente Seis', data: hoje });
await novo({ tipo: 'prazo', titulo: 'Prazo com trabalho amanhã', cliente: 'Cliente Sete', data: dia(8), trabalhar: dia(1) });
await novo({ tipo: 'tarefa', titulo: 'Já resolvido hoje', cliente: 'Cliente Oito', data: hoje, concluido: true, situacao: 'feito', concluidoEm: hoje });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 420, height: 900 }, timezoneId: 'America/Sao_Paulo' }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(1200);
const abas = await page.evaluate(() => Array.from(document.querySelectorAll('#agSeg [role=tab]')).map(b => b.innerText.trim()));
check(JSON.stringify(abas) === JSON.stringify(['Resumo', 'Meu dia', 'Semana', 'Mês', 'Lista', 'Quadro']), 'as sub-abas da Agenda: Resumo primeiro, Meu dia em segundo: ' + abas.join(' · '));
check(await page.evaluate(() => { const b = document.querySelector('#agSeg [role=tab][aria-selected=true]'); return !!b && /Resumo/.test(b.innerText); }), 'a Agenda abre no Resumo');
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="meudia"]').click()); await page.waitForTimeout(700);
const secoes = () => page.evaluate(() => { const o = {}; let at = ''; Array.from(document.querySelectorAll('#agCorpo > *')).forEach(e => { if (e.classList.contains('agm-sec')) { at = e.querySelector('span').innerText.trim(); o[at] = []; } else if (at && (e.classList.contains('agc') || e.classList.contains('agm-am'))) o[at].push(e.innerText.replace(/\s+/g, ' ')); }); return o; });
let sc = await secoes(); const tem = (sec, t) => Object.keys(sc).some(k => k.toLowerCase().startsWith(sec.toLowerCase()) && sc[k].some(x => x.includes(t)));
check(tem('Audiência hoje', 'Audiência de hoje') && /Entrar na sala/.test((sc[Object.keys(sc).find(k => /^Audiência hoje/i.test(k))] || [''])[0]), 'Meu dia: "Audiência hoje" com a audiência e o "Entrar na sala"');
check(tem('Vence hoje', 'Vence hoje teste'), 'Meu dia: "Vence hoje" traz o prazo fatal de hoje');
check(tem('Peça pronta', 'Pronta para conferir') && tem('Peça pronta', 'Murilo'), 'Meu dia: "Peça pronta · conferir e protocolar" traz a peça pronta, com quem marcou (Murilo)');
check(tem('Para trabalhar hoje', 'Prazo para marcar pronta') && tem('Para trabalhar hoje', 'Tarefa de hoje'), 'Meu dia: "Para trabalhar hoje" traz o prazo no dia de trabalhar e a tarefa de hoje');
check(tem('Atrasado', 'Trabalho atrasado teste') && /Trabalho atrasado/.test((sc[Object.keys(sc).find(k => /^Atrasado/i.test(k))] || []).join(' ')), 'Meu dia: "Atrasado" traz o trabalho que passou do dia');
check(tem('Amanhã', 'Prazo com trabalho amanhã'), 'Meu dia: prévia de amanhã');
check(!tem('Para trabalhar hoje', 'Pronta para conferir') && !tem('Atrasado', 'Pronta para conferir'), 'a peça pronta não aparece como "para trabalhar" nem "atrasado"');
check(await page.evaluate(() => /2 de 7 resolvidos hoje/.test(document.getElementById('agCorpo').innerText)), 'a barra mostra "2 de 7 resolvidos hoje" (uma tarefa concluída hoje e uma peça marcada pronta hoje)');
// marcar peça pronta pelo Meu dia
const clicarEm = (titulo, sel) => page.evaluate(([t, s]) => { const c = Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => e.querySelector('.agc-t') && e.querySelector('.agc-t').innerText === t); const b = c && c.querySelector(s); if (b) b.click(); return !!b; }, [titulo, sel]);
check(await clicarEm('Prazo para marcar pronta', '[data-ag="pronta"]'), 'o cartão do prazo tem o atalho "✓ Peça pronta"'); await page.waitForTimeout(900);
let d1 = await ler(idP1);
check(d1.situacao === 'pronta' && d1.prontaEm === hoje && d1.concluido === false && d1.data === dia(20), 'Peça pronta grava a situação e a data e NÃO encerra o prazo (continua aberto)');
sc = await secoes();
check(tem('Peça pronta', 'Prazo para marcar pronta') && !tem('Para trabalhar hoje', 'Prazo para marcar pronta') && await page.evaluate(() => /3 de 7 resolvidos hoje/.test(document.getElementById('agCorpo').innerText)), 'o prazo sai de "Para trabalhar hoje", vai para "Peça pronta" e a barra avança (3 de 7)');
// desfazer
check(await page.evaluate(() => { const b = document.querySelector('#toast button'); if (b) b.click(); return !!b; }), 'o aviso de peça pronta tem "Desfazer"'); await page.waitForTimeout(900);
d1 = await ler(idP1); check(d1.situacao === 'afazer' && !d1.prontaEm, '"Desfazer" volta o prazo ao que era');
await clicarEm('Prazo para marcar pronta', '[data-ag="pronta"]'); await page.waitForTimeout(900);
// Lista: cartão da peça pronta
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(700);
const cart = await page.evaluate(() => { const c = Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => e.querySelector('.agc-t') && e.querySelector('.agc-t').innerText === 'Prazo para marcar pronta'); return c ? { ok: !!c.querySelector('.agd2 .ok'), trab: !!c.querySelector('.agd2 .t'), fatal: !!c.querySelector('.agd2 .f'), btn: Array.from(c.querySelectorAll('.acx button')).map(b => b.innerText.trim()), txt: c.innerText.replace(/\s+/g, ' ') } : null; });
check(!!cart && cart.ok && cart.fatal && !cart.trab && /falta protocolar/i.test(cart.txt), 'na Lista a peça pronta mostra a caixa verde "Peça pronta ✓ … falta protocolar" e o prazo fatal (sem "Trabalhar até")');
check(!!cart && cart.btn.includes('Protocolar') && !cart.btn.some(b => /Peça pronta/.test(b)), 'o atalho vira "Protocolar"');
check(await page.evaluate((d) => { const l = Array.from(document.querySelectorAll('#agCorpo .ag-dia, #agCorpo .agc')); const i = l.findIndex(e => e.classList.contains('agc') && /Prazo para marcar pronta/.test(e.innerText)); const cab = l.slice(0, i).reverse().find(e => e.classList.contains('ag-dia')); return !!cab && cab.innerText.includes(d); }, dia(20).slice(8, 10) + '/' + dia(20).slice(5, 7)), 'a peça pronta passa a ficar no dia fatal');
// protocolar
await clicarEm('Prazo para marcar pronta', '[data-ag="concluir"].vd'); await page.waitForTimeout(600);
check(await page.evaluate(() => { const o = document.getElementById('overlayAgProt'); return !!o && o.classList.contains('show'); }), '"Protocolar" pergunta a data do protocolo');
await page.click('#agpOk'); await page.waitForTimeout(1000);
d1 = await ler(idP1); check(d1.concluido === true && d1.protocoladoEm === hoje && d1.situacao === 'feito', 'depois de protocolar o prazo é concluído com a data do protocolo');
// Quadro por situação
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="quadro"]').click()); await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-ag="modo"][data-v="situacao"]').click()); await page.waitForTimeout(600);
check(await page.evaluate(() => { const c = document.querySelector('[data-agcol="pronta"]'); return !!c && /Peça pronta/.test(c.querySelector('h4').innerText) && /Pronta para conferir/.test(c.innerText); }), 'no Quadro por situação existe a coluna "Peça pronta" com a peça pronta');
check(await page.evaluate(() => { const c = document.querySelector('[data-agcol="pronta"]'); return !!c && Array.from(c.querySelectorAll('button')).some(b => /Protocolar/.test(b.innerText)); }), 'e o cartão dela oferece "Protocolar"');
// ficha: botão de situação só em prazo
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(500);
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => e.querySelector('.agc-t').innerText === 'Tarefa de hoje').querySelector('.agc-t').click()); await page.waitForTimeout(500);
check(await page.evaluate(() => !document.querySelector('#agdC [data-agd="sit"][data-v="pronta"]') && !!document.querySelector('#agdC [data-agd="sit"][data-v="elaboracao"]')), 'na ficha da tarefa não há "Peça pronta" (só para prazo)');
await page.evaluate(() => document.querySelector('#overlayAgDet').classList.remove('show'));
await page.evaluate(() => Array.from(document.querySelectorAll('#agCorpo .agc')).find(e => e.querySelector('.agc-t').innerText === 'Trabalho atrasado teste').querySelector('.agc-t').click()); await page.waitForTimeout(500);
check(await page.evaluate(() => !!document.querySelector('#agdC [data-agd="sit"][data-v="pronta"]')), 'na ficha do prazo existe o botão de situação "Peça pronta"');
await page.click('#agdC [data-agd="sit"][data-v="pronta"]'); await page.waitForTimeout(900);
let d4 = await ler(idP4); check(d4.situacao === 'pronta' && d4.prontaEm === hoje, 'a ficha também marca a peça como pronta');
await page.click('#agdC [data-agd="sit"][data-v="afazer"]'); await page.waitForTimeout(900);
d4 = await ler(idP4); check(d4.situacao === 'afazer' && !d4.prontaEm && !d4.prontaPor, 'voltar para "A fazer" tira a marca de peça pronta');
// avisos no celular: peça pronta só avisa 1 dia antes e no dia
const av = await page.evaluate(([h, f]) => window.__horusTeste.agPrazosResumo(h, f).reduce((o, x) => { o[x.l] = x.a; return o; }, {}), [hoje, dia(30)]);
check(JSON.stringify(av['Pronta para conferir']) === '[1,0]', 'peça pronta: avisos no celular só de 1 dia antes e do dia (' + JSON.stringify(av['Pronta para conferir']) + ')');
check(JSON.stringify(av['Prazo com trabalho amanhã']) === '[5,2,1,0]', 'prazo sem peça pronta mantém 5, 2, 1 dia e no dia');
check(erros.length === 0, 'sem erros de script' + (erros.length ? ': ' + erros[0] : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTUDO CERTO'); process.exit(falhas ? 1 : 0);
