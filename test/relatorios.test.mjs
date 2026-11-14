// Testa os relatórios para imprimir: Agenda, Publicações, lista de Processos e ficha do processo; e o modo de impressão (PDF).
// O Diário Oficial é simulado na porta 8890.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var DJEN_URL:http://127.0.0.1:8890/api/v1/comunicacao --port 8812
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const N1 = '5368644-67.2026.8.09.0107', N4 = '5200100-10.2025.8.09.0051';
const itens = [{ id: 920001, data_disponibilizacao: hoje, siglaTribunal: 'TJGO', tipoComunicacao: 'Intimação', tipoDocumento: 'Decisão', nomeOrgao: 'Morrinhos - 1ª Vara Cível', nomeClasse: 'PROCEDIMENTO COMUM', numero_processo: N1.replace(/\D/g, ''), numeroprocessocommascara: N1, link: 'https://exemplo.test/p/1',
  texto: 'Autos n.: ' + N1 + '\nPolo Ativo: Maquele Viana Pacheco\nPolo Passivo: Cooperativa Mista\nDECISÃO\nDefiro a perícia contábil. Intime-se a parte para, no prazo de 15 dias, apresentar quesitos.', destinatarios: [{ nome: 'Maquele Viana Pacheco', polo: 'A' }], destinatarioadvogados: [] }];
const fake = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', count: itens.length, items: itens })); }).listen(8890);
await new Promise(ok => fake.on('listening', ok));
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.33' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'config', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('PUT', '/api/db/clientes/cl1', { nome: 'Maquele Viana Pacheco', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/casos/c1', { tipo: 'inicial', cliente: 'Maquele Viana Pacheco', nomeAcao: 'Declaratória', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 3000, avista: { data: dia(15), pago: false }, numeroProcesso: N1, clienteIds: ['cl1'], criadoEm: agora, atualizadoEm: agora });
await f('POST', '/api/db/processos', { numero: N4, partes: 'Fulano x Beltrano', orgao: 'TJGO · Morrinhos 1ª Vara Cível', clienteIds: ['cl1'], honorarios: 'sem', arquivado: false, origem: 'manual', proxima: 'Pedir penhora', proximaData: dia(6), criadoEm: agora });
const A = (o) => f('POST', '/api/db/agenda', Object.assign({ situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora }, o));
await A({ tipo: 'prazo', titulo: 'Contestação', processo: N4, cliente: 'Fulano', data: dia(2) });
await A({ tipo: 'audiencia', titulo: 'Audiência de instrução', processo: N4, cliente: 'Fulano', data: dia(3), hora: '09:00', audTipo: 'Instrução e julgamento', modalidade: 'online', local: 'Sala virtual', link: 'https://meet.google.com/aaa-bbbb-ccc' });
await A({ tipo: 'tarefa', titulo: 'Preparar réplica', cliente: 'Maquele', data: dia(4) });
await A({ tipo: 'prazo', titulo: 'Recurso antigo', cliente: 'Beltrano', data: dia(-5) });
await A({ tipo: 'prazo', titulo: 'Embargos cumpridos', cliente: 'Fulano', data: dia(1), situacao: 'feito', concluido: true, protocoladoEm: dia(-1) });
await f('POST', '/api/djen/buscar', {});

const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message + ' ' + String(x.stack).split('\n').slice(0, 4).join(' | '))); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const SHOT = process.env.SHOT || ''; const foto = async n => { if (SHOT) await page.screenshot({ path: SHOT + n + '.png' }); };
const aberto = () => page.evaluate(() => document.getElementById('overlayRpt').classList.contains('show'));

// Agenda
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(700);
await page.click('[data-ag="menu"]'); await page.click('[data-ag="rel"]'); await page.waitForTimeout(400);
check(await aberto(), 'a Agenda tem o botão “Relatório” e ele abre a folha');
check(await page.evaluate(() => { const i = document.querySelector('#rptFolha .rpt-marca img'); return !!i && /logo-white\.png/.test(i.src); }), 'o cabeçalho do relatório leva o logo de fundo branco');
await page.selectOption('#rptop_periodo', '30'); await page.waitForTimeout(300);
let fo = await t('#rptFolha');
await foto('r-agenda');
check(/Relatório da Agenda/.test(fo) && /Contestação/.test(fo) && /Audiência de instrução/.test(fo) && /Preparar réplica/.test(fo), 'o relatório dos próximos 30 dias traz prazo, audiência e tarefa');
check(/Instrução e julgamento/.test(fo) && /Sala virtual/.test(fo) && /meet\.google\.com/.test(fo) && /09:00/.test(fo), 'a audiência sai com tipo, local, link e hora');
check(!/Recurso antigo/.test(fo) && !/Embargos cumpridos/.test(fo), 'sem os atrasados e sem os concluídos');
check(/1 prazo, 1 audiência, 1 tarefa/.test(fo), 'o resumo conta prazos, audiências e tarefas: ' + (fo.match(/\d+ prazos?, \d+ audiências?, \d+ tarefas?/) || [''])[0]);
await page.check('#rptop_feitos'); await page.waitForTimeout(300);
fo = await t('#rptFolha'); check(/Embargos cumpridos/.test(fo) && /protocolada em/i.test(fo), 'incluindo concluídos, aparece o protocolado com a data');
await page.selectOption('#rptop_periodo', 'atrasados'); await page.waitForTimeout(300);
fo = await t('#rptFolha'); check(/Recurso antigo/.test(fo) && !/Contestação/.test(fo), '“Atrasados” mostra só o que já venceu');
// impressão
await page.emulateMedia({ media: 'print' });
const vis = await page.evaluate(() => { const vis = e => !!e && e.getClientRects().length > 0; return { folha: vis(document.getElementById('rptFolha')), menu: vis(document.getElementById('drawer')), agenda: vis(document.getElementById('bodyAgenda')), barra: vis(document.querySelector('#overlayRpt .rpt-barra')) }; });
check(vis.folha && !vis.menu && !vis.agenda && !vis.barra, 'na impressão só a folha aparece (sem menu, sem a tela atrás e sem os botões): ' + JSON.stringify(vis));
const pdf = await page.pdf({ format: 'A4' }); fs.writeFileSync('/tmp/rel-teste.pdf', pdf);
check(pdf.length > 4000 && pdf.slice(0, 4).toString() === '%PDF', 'gera um PDF: ' + pdf.length + ' bytes');
{ const { execFileSync } = await import('node:child_process'); let txt = ''; try { txt = execFileSync('pdftotext', ['/tmp/rel-teste.pdf', '-'], { encoding: 'utf8' }); } catch (e) { txt = ''; }
  if (txt) check(/Relatório da Agenda/.test(txt) && /Recurso antigo/.test(txt) && !/Central de atenção/i.test(txt) && !/Início/.test(txt.replace(/Início de/g, '')), 'o texto do PDF é só o relatório (sem o menu nem a tela do app)'); }
await page.emulateMedia({ media: 'screen' });
await page.click('#rptX'); await page.waitForTimeout(300);
check(!(await aberto()) && !(await page.evaluate(() => document.body.classList.contains('rpt-aberto'))), 'fechar tira a folha e libera a tela');

// Publicações
await page.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await page.waitForTimeout(1500);
check(await page.evaluate(() => !document.querySelector('.pb-menu') && !!document.querySelector('[data-pb="menu"]')), 'em Publicações os botões miúdos ficam escondidos atrás do botão ☰');
await page.click('[data-pb="menu"]'); await page.waitForTimeout(300);
if (SHOT) await page.screenshot({ path: SHOT + 'menu-pub.png' });
check(await page.evaluate(() => { const m = document.querySelector('.pb-menu'); return !!m && /Peças e prazos/.test(m.innerText) && /Relatório das publicações/.test(m.innerText) && /Marcar .* como lidas/.test(m.innerText); }), 'o menu ☰ tem Peças e prazos, Relatório das publicações e Marcar como lidas');
await page.click('[data-pb="rel"]'); await page.waitForTimeout(400);
check(await page.evaluate(() => !document.querySelector('.pb-menu')), 'ao escolher uma opção o menu se fecha');
fo = await t('#rptFolha');
await foto('r-pub');
check(/Relatório de publicações/.test(fo) && /Maquele Viana Pacheco/.test(fo) && /perícia contábil/.test(fo) && /não lida/.test(fo), 'o relatório de publicações traz partes, trecho e se foi lida');
check(/Prazo sugerido \(não confirmado\): 15 dias úteis/.test(fo), 'e o prazo sugerido, avisando que não foi confirmado');
check(/\d+ publicaç(ão|ões) \(\d+ não lidas\)/.test(fo), 'com o total e as não lidas no resumo');
await page.check('#rptop_naolidas'); await page.waitForTimeout(300); check(/Maquele/.test(await t('#rptFolha')), 'filtro “só as não lidas” funciona');
await page.click('#rptX'); await page.waitForTimeout(300);
await page.click('[data-pb="menu"]'); await page.waitForTimeout(300);
await page.click('[data-pb="todas-lidas"]'); await page.waitForTimeout(800);
check((await f('GET', '/api/djen/lista')).j.pubs.filter(p => p.id === '920001').every(p => p.lida === true), '“Marcar todas como lidas” pelo menu marca as publicações da lista como lidas');

// Processos: lista e ficha
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(900);
check(await page.evaluate(() => !!document.querySelector('[data-pr="menu"]') && !document.querySelector('[data-pr="rel"]')), 'em Processos o relatório da lista fica atrás do botão ☰');
await page.click('[data-pr="menu"]'); await page.waitForTimeout(300);
if (SHOT) await page.screenshot({ path: SHOT + 'menu-proc.png' });
await page.click('[data-pr="rel"]'); await page.waitForTimeout(400);
fo = await t('#rptFolha');
await foto('r-proc');
check(/Relatório de processos/.test(fo) && /Fulano x Beltrano/.test(fo) && /Pedir penhora/.test(fo) && /Contestação/.test(fo), 'o relatório da lista traz partes, próxima providência e prazos abertos');
check(/Morrinhos 1ª Vara Cível/.test(fo) && /Maquele Viana Pacheco/.test(fo) && /R\$\s?3\.000,00/.test(fo), 'e vara, cliente e honorários a receber');
check(/2 processos/.test(fo), 'com o total: ' + (fo.match(/\d+ processos?/) || [''])[0]);
await page.click('#rptX'); await page.waitForTimeout(300);
await page.click('[data-pr="abrir"][data-n="' + N4.replace(/\D/g, '') + '"]'); await page.waitForTimeout(600);
await page.click('[data-prf="rel"]'); await page.waitForTimeout(400);
fo = await t('#rptFolha');
await foto('r-ficha');
check(/Relatório do processo/.test(fo) && /Fulano x Beltrano/.test(fo) && /Próximos/.test(fo) && /Audiência de instrução/.test(fo) && /Pedir penhora/.test(fo), 'o relatório do processo traz os dados e a linha do tempo');
check(await page.evaluate(() => getComputedStyle(document.getElementById('overlayRpt')).zIndex) > await page.evaluate(() => getComputedStyle(document.getElementById('overlayPr')).zIndex), 'a folha abre por cima da ficha');
if (SHOT){ await page.click('#rptX'); await page.waitForTimeout(300); await page.evaluate(() => { document.getElementById('prCorpo').scrollTop = 900; }); await page.waitForTimeout(300); await foto('ficha-tl'); await page.click('#prX'); await page.waitForTimeout(300); await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(500); await page.click('[data-ag="vista"][data-v="lista"]'); await page.waitForTimeout(300); await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#agWrap .ag-it')).find(x => /Audiência de instrução/.test(x.innerText)); b.querySelector('[data-ag="abrir"]').click(); }); await page.waitForTimeout(500); await page.evaluate(() => { document.querySelector('#overlayAg').scrollTop = 0; }); await foto('ag-editor'); await page.click('#agEdX'); await page.waitForTimeout(300); await foto('ag-lista'); await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(500); await page.click('#prFunil'); await page.waitForTimeout(300); await foto('proc-filtros'); }
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
for (const col of ['casos', 'clientes', 'agenda', 'processos', 'config']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await br.close(); fake.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
