// Testa: criar audiência e criar tarefa na Agenda a partir de uma publicação, mesmo quando o app não reconheceu audiência nem prazo no texto.
// O Diário Oficial é simulado na porta 8890.   Rode:  node test/rodar.mjs agenda-publicacao
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const N = '6146013-93.2026.8.09.0108';
const itens = [{ id: 920001, data_disponibilizacao: hoje, siglaTribunal: 'TJGO', tipoComunicacao: 'Intimação', tipoDocumento: 'Outros', nomeOrgao: 'Morrinhos - Juizado Especial Cível', nomeClasse: 'PROCEDIMENTO DO JUIZADO ESPECIAL CÍVEL', numero_processo: N.replace(/\D/g, ''), numeroprocessocommascara: N, link: 'https://exemplo.test/p/2',
  texto: 'ARQUIVOS DIGITAIS INDISPONÍVEIS (NÃO SÃO DO TIPO PÚBLICO)', destinatarios: [{ nome: 'A CONSTRUTORA E MULT CASA MATERIAIS PARA CONSTRUCAO LTDA.', polo: 'A' }], destinatarioadvogados: [] }];
const fake = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', count: itens.length, items: itens })); }).listen(8890);
await new Promise(ok => fake.on('listening', ok));
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.99' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { s: x.status, j: await x.json().catch(() => ({})) }; };
const ag = async () => ((await f('GET', '/api/db/agenda')).j.docs || []).map(d => ({ id: d.id, ...d.data }));
for (const col of ['agenda', 'processos', 'clientes', 'casos', 'config', '_pub']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora }); await f('PUT', '/api/db/config/importacaoAuto', { ativo: false, desde: agora }); await f('PUT', '/api/db/config/processosIgnorados', { numeros: {} }); await f('PUT', '/api/db/config/vinculoIniciais', { corte: hoje });
await f('PUT', '/api/db/clientes/cl1', { nome: 'A Construtora e Mult Casa Materiais Para Construcao Ltda', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/processos/d' + N.replace(/\D/g, ''), { numero: N, partes: 'A Construtora x Banco', clienteIds: ['cl1'], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
await f('POST', '/api/djen/buscar', {});
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'America/Sao_Paulo' })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const v = async id => page.evaluate(i => document.getElementById(i).value, id);
await page.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await page.waitForTimeout(1500);
check(!(await page.evaluate(() => Array.from(document.querySelectorAll('.pb-card')).some(c => /CONSTRUTORA/i.test(c.innerText) && !!c.querySelector('[data-pb="aud"]')))), 'a publicação "Outros" não tem audiência reconhecida (sem o botão automático)');
await page.click('.pb-card:has-text("CONSTRUTORA") [data-pb="abrir"]'); await page.waitForTimeout(1200);
let tx = await t('#pbCorpo');
check(/agenda/i.test(tx) && await page.evaluate(() => !!document.querySelector('#pbCorpo [data-pbd="aud-livre"]') && !!document.querySelector('#pbCorpo [data-pbd="tarefa"]')), 'o detalhe da publicação oferece "Criar audiência" e "Criar tarefa" mesmo sem nada reconhecido');
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/pub-agenda.png' });
/* audiência livre */
await page.click('#pbCorpo [data-pbd="aud-livre"]'); await page.waitForTimeout(600);
check(await page.evaluate(() => document.getElementById('overlayAg').classList.contains('show')), 'abre o editor da Agenda');
check(/CONSTRUTORA/i.test(await v('age_cli')) && (await v('age_proc')) === N && (await v('age_data')) === '' && /Morrinhos/.test(await v('age_local')) && await page.evaluate(() => document.querySelector('#age_seg .active, #age_seg .seg-btn.active').innerText) === 'Audiência', 'vem com o processo, o cliente e o órgão; a data fica para você preencher; tipo Audiência');
await page.click('[data-age="salvar"]'); await page.waitForTimeout(300);
check(/Escolha a data/.test(await t('#age_erro')), 'sem a data, o editor pede');
await page.fill('#age_data', dia(10)); await page.fill('#age_hora', '09:30'); await page.selectOption('#age_audtipo', 'Instrução e julgamento'); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1200);
let a1 = (await ag()).find(d => d.tipo === 'audiencia');
check(a1 && a1.data === dia(10) && a1.hora === '09:30' && a1.processo === N && a1.audPubId === '920001' && !a1.pubId && a1.audTipo === 'Instrução e julgamento', 'audiência gravada, ligada à publicação de origem, sem virar "prazo confirmado"');
/* tarefa */
await page.evaluate(() => { const b = document.querySelector('#overlayPb'); if (b && !b.classList.contains('show')) b.classList.add('show'); });
await page.click('#pbCorpo [data-pbd="tarefa"]'); await page.waitForTimeout(600);
check(await page.evaluate(() => document.querySelector('#age_seg .seg-btn.active').innerText) === 'Tarefa' && /Providência — Outros/.test(await v('age_tit')) && (await v('age_proc')) === N, 'criar tarefa: tipo Tarefa, título sugerido "Providência — Outros" e o processo');
await page.fill('#age_tit', 'Juntar substabelecimento'); await page.fill('#age_data', dia(4)); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1200);
const tf = (await ag()).find(d => d.tipo === 'tarefa');
check(tf && tf.titulo === 'Juntar substabelecimento' && tf.data === dia(4) && tf.audPubId === '920001' && !tf.pubId && tf.processo === N && /CONSTRUTORA/i.test(tf.cliente), 'tarefa gravada com o processo, o cliente e a origem, sem vínculo de prazo');
const ppz = await page.evaluate(() => typeof pbPrazoGrupo); 
await page.evaluate(() => document.querySelector('#overlayPb').classList.remove('show')); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(900);
await page.click('[data-ag="vista"][data-v="lista"]'); await page.waitForTimeout(500);
tx = await t('#agCorpo');
check(/Juntar substabelecimento/.test(tx) && /Instrução e julgamento|audiência|Audiência/.test(tx) && /via publicação/.test(tx), 'a Agenda mostra os dois, marcados "via publicação"');
await page.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await page.waitForTimeout(1000);
check(!/prazo \d{2}\/\d{2}/.test(await page.evaluate(() => Array.from(document.querySelectorAll('.pb-card')).filter(c => /CONSTRUTORA/.test(c.innerText)).map(c => c.innerText).join(' '))), 'a publicação continua sem "prazo confirmado" (tarefa e audiência não contam como prazo)');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); fake.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
