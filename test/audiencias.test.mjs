// Testa: audiência com tipo, local e link na Agenda; audiência encontrada no texto de uma publicação vira item da Agenda;
// marcar prazo como protocolado com a data do protocolo. O Diário Oficial é simulado na porta 8890.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var DJEN_URL:http://127.0.0.1:8890/api/v1/comunicacao --port 8812
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
async function situacao(v){ await page.click('[data-ag="flt"]'); await page.click('[data-agf="sit"][data-v="' + v + '"]'); await page.click('[data-agf="ver"]'); await page.waitForTimeout(300); }
async function abrirEditor(sel){ await page.click(sel + ' .agc-t'); await page.waitForTimeout(350); await page.click('[data-agd="editar"]'); await page.waitForTimeout(350); }

let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const br_ = iso => iso.slice(8) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
const DATA_AUD = dia(20), N = '5399001-24.2026.8.09.0107';
// DJEN de mentira: uma intimação com audiência designada
const itens = [{ id: 910001, data_disponibilizacao: hoje, siglaTribunal: 'TJGO', tipoComunicacao: 'Intimação', tipoDocumento: 'Decisão', nomeOrgao: 'Morrinhos - 1ª Vara Cível', nomeClasse: 'PROCEDIMENTO COMUM', numero_processo: N.replace(/\D/g, ''), numeroprocessocommascara: N, link: 'https://exemplo.test/p/1',
  texto: 'Poder Judiciário\nAutos n.: ' + N + '\nPolo Ativo: Zenaide Prado Teste\nPolo Passivo: Cooperativa Mista\nDECISÃO\nDesigno audiência de conciliação para o dia ' + br_(DATA_AUD) + ', às 14:30 horas, por videoconferência, no link https://meet.google.com/abc-defg-hij. Intimem-se.',
  destinatarios: [{ nome: 'Zenaide Prado Teste', polo: 'A' }], destinatarioadvogados: [] }];
const fake = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', count: itens.length, items: itens })); }).listen(8890);
await new Promise(ok => fake.on('listening', ok));
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.31' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const ag = async () => (await f('GET', '/api/db/agenda')).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'clientes', 'config', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('PUT', '/api/db/clientes/cl1', { nome: 'Zenaide Prado Teste', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/casos/c1', { tipo: 'inicial', cliente: 'Zenaide Prado Teste', nomeAcao: 'Declaratória', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 3000, avista: { data: dia(30), pago: false }, numeroProcesso: N, clienteIds: ['cl1'], criadoEm: agora, atualizadoEm: agora });
await f('POST', '/api/djen/buscar', {});

const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const v = async id => page.evaluate(i => document.getElementById(i).value, id);
await page.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await page.waitForTimeout(1500);

// 1) a publicação mostra a audiência encontrada
const cartao = await page.evaluate(() => Array.from(document.querySelectorAll('.pb-card')).filter(c => /Zenaide/.test(c.innerText)).map(c => c.innerText).join('\n'));
check(/audiência/.test(cartao) && new RegExp(DATA_AUD.slice(8) + '/' + DATA_AUD.slice(5, 7)).test(cartao) && /14:30/.test(cartao), 'o cartão da publicação mostra a audiência encontrada (data e hora)');
check(await page.evaluate(() => !!document.querySelector('.pb-card [data-pb="aud"]')), 'e oferece “Criar audiência”');
await page.click('.pb-card:has-text("Zenaide") [data-pb="aud"]'); await page.waitForTimeout(500);
check(await page.evaluate(() => document.getElementById('overlayAg').classList.contains('show')), 'abre o editor da Agenda');
check(await v('age_data') === DATA_AUD && await v('age_hora') === '14:30' && await v('age_audtipo') === 'Conciliação' && await v('age_mod') === 'online' && /meet\.google\.com/.test(await v('age_link')), 'já vem preenchido: data, hora, tipo, modalidade online e link');
check(/Zenaide/.test(await v('age_cli')) && (await v('age_proc')).replace(/\D/g, '') === N.replace(/\D/g, ''), 'com o cliente e o processo');
await page.fill('#age_local', 'Sala virtual do TJGO'); await page.click('[data-age="salvar"]'); await page.waitForTimeout(1200);
const aud = (await ag()).filter(d => d.tipo === 'audiencia')[0];
check(aud && aud.data === DATA_AUD && aud.hora === '14:30' && aud.audTipo === 'Conciliação' && aud.modalidade === 'online' && aud.local === 'Sala virtual do TJGO' && /meet\.google/.test(aud.link) && aud.audPubId === '910001', 'a audiência é gravada com tipo, modalidade, local, link e a publicação de origem');
check(!(await page.evaluate(() => Array.from(document.querySelectorAll('.pb-card')).some(c => /Zenaide/.test(c.innerText) && !!c.querySelector('[data-pb="aud"]')))) && /na Agenda/.test(await t('#pbListaBox')), 'depois de criada, a publicação mostra “na Agenda” e some o botão (não duplica)');
check(!(await f('GET', '/api/db/agenda')).j.docs.some(d => d.data.pubId === '910001'), 'a audiência não vira “prazo confirmado” da publicação');

// 2) na Agenda: local, tipo e entrar na sala
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(600);
await page.click('[data-ag="vista"][data-v="lista"]'); await page.waitForTimeout(400);
const cartaoAg = await t('#agWrap');
check(/Conciliação/.test(cartaoAg) && /Sala virtual do TJGO/.test(cartaoAg) && /Online/.test(cartaoAg), 'a Agenda mostra tipo, local e modalidade');
check(await page.evaluate(() => { const a = Array.from(document.querySelectorAll('#agWrap a')).find(x => /Entrar na sala/.test(x.textContent)); return !!a && /meet\.google\.com/.test(a.href) && a.target === '_blank' && /noopener/.test(a.rel); }), 'tem o botão “Entrar na sala” (abre em outra aba, com rel seguro)');

// 3) editor: link inválido é recusado
await abrirEditor('');
await page.fill('#age_link', 'javascript:alert(1)'); await page.click('[data-age="salvar"]'); await page.waitForTimeout(300);
check(/https:\/\//.test(await t('#age_erro')), 'link que não começa com http/https é recusado: ' + (await t('#age_erro')));
await page.fill('#age_link', ''); await page.click('#agEdX'); await page.waitForTimeout(300);

// 4) prazo: protocolo com data
await page.click('[data-ag="novo"]'); await page.waitForTimeout(300);
await page.fill('#age_tit', 'Contestação'); await page.fill('#age_data', dia(3)); await page.click('[data-age="salvar"]'); await page.waitForTimeout(900);
check((await ag()).some(d => d.titulo === 'Contestação' && d.tipo === 'prazo' && !d.audTipo && !d.local), 'novo prazo salvo sem os campos de audiência');
await page.click('.agc:has-text("Contestação") [data-ag="concluir"]'); await page.waitForTimeout(400);
await page.fill('#agp_data', dia(2)); await page.click('#agpOk'); await page.waitForTimeout(300);
check(/não pode ser no futuro/.test(await t('#agp_erro')), 'data de protocolo no futuro é recusada');
await page.fill('#agp_data', dia(-1)); await page.fill('#agp_obs', 'juntada no evento 12'); await page.click('#agpOk'); await page.waitForTimeout(1000);
const pz = (await ag()).filter(d => d.titulo === 'Contestação')[0];
check(pz.concluido && pz.protocoladoEm === dia(-1) && pz.protocoloObs === 'juntada no evento 12', 'o protocolo grava data e observação');
await situacao('todos');
check(new RegExp('Protocolada em ' + br_(dia(-1))).test(await t('#agWrap')), 'o cartão concluído mostra “Protocolada em dd/mm/aaaa”');
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#agWrap .agc')).find(x => /Contestação/.test(x.innerText)); b.querySelector('[data-ag="reabrir"]').click(); }); await page.waitForTimeout(900);
const pz2 = (await ag()).filter(d => d.titulo === 'Contestação')[0];
check(!pz2.concluido && !pz2.protocoladoEm, 'reabrir limpa a data do protocolo');
// 5) editor com situação “concluído” pede a data do protocolo
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#agWrap .agc')).find(x => /Contestação/.test(x.innerText)); b.click(); }); await page.waitForTimeout(350); await page.click('[data-agd="editar"]'); await page.waitForTimeout(400);
await page.selectOption('#age_sit', 'feito'); await page.waitForTimeout(200);
check(await page.evaluate(() => getComputedStyle(document.getElementById('age_prot_box')).display) !== 'none', 'no editor, marcar “Concluído” mostra o campo da data do protocolo');
await page.fill('#age_protoc', dia(-2)); await page.click('[data-age="salvar"]'); await page.waitForTimeout(900);
check((await ag()).filter(d => d.titulo === 'Contestação')[0].protocoladoEm === dia(-2), 'e grava a data informada');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
for (const col of ['casos', 'clientes', 'agenda', 'processos', 'config']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await br.close(); fake.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
