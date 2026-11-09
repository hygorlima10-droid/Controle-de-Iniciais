// Testa a importação de processos pelo Diário Oficial: busca por período (várias páginas, duas OABs), lista com "já cadastrado", "excluído antes" e "possivelmente encerrado",
// vínculo automático, revisão (vincular, escolher cliente, cliente novo, excluir), pergunta "vincular os próximos automaticamente?" e cadastro automático dos processos novos das publicações.
// O Diário Oficial é simulado na porta 8890 e responde por OAB (com páginas).
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --var DJEN_URL:http://127.0.0.1:8890/api/v1/comunicacao --var DJEN_ESPERA_MS:0 --var IMPORTAR_AUTO:0 --port 8812
import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const num = k => '63' + String(k).padStart(5, '0') + '-10.2026.8.09.0107', dig = n => n.replace(/\D/g, '');
let seq = 1000;
const it = (k, data, tipo, texto, dest) => ({ id: ++seq, data_disponibilizacao: data, siglaTribunal: 'TJGO', tipoComunicacao: 'Intimação', tipoDocumento: tipo, nomeOrgao: 'Morrinhos - 1ª Vara Cível', nomeClasse: 'PROCEDIMENTO COMUM', numero_processo: dig(num(k)), numeroprocessocommascara: num(k), link: '', texto, destinatarios: dest.map(([n, p]) => ({ nome: n, polo: p })), destinatarioadvogados: [] });
const T = (a, r, extra = '') => 'AUTOR: ' + a + '\nRÉU: ' + r + '\nVALOR DA CAUSA: R$ 12.000,00\nDECISÃO\n' + extra + 'Intime-se a parte para se manifestar.';
const COMPLEM = 'COOPERATIVA MISTA DOS PRODUTORES DE LEITE DE MORRINHOS', VINI = 'VINÍCIUS CÉSAR FERREIRA MESSIAS';
const itA = it(1, dia(-3), 'Decisão', T(COMPLEM, 'BANCO BETA S.A.'), [[COMPLEM, 'A']]);
const H = [itA,
  it(2, dia(-5), 'Decisão', T(VINI, 'BANCO GAMA S.A.'), [[VINI, 'A']]),
  it(3, dia(-6), 'Decisão', T('ZÉLIA APARECIDA DOS SANTOS', 'BANCO DELTA S.A.'), [['ZÉLIA APARECIDA DOS SANTOS', 'A']]),
  it(4, dia(-9), 'Sentença', T('JOSÉ ALVES', 'BANCO ÔMEGA S.A.', 'Julgo extinto o processo. Certifique-se o trânsito em julgado e arquivem-se os autos.\n'), [['JOSÉ ALVES', 'A']]),
  it(5, dia(-10), 'Decisão', T('LUIZ JÁ CADASTRADO', 'BANCO SIGMA S.A.'), [['LUIZ JÁ CADASTRADO', 'A']]),
  it(6, dia(-11), 'Decisão', T('MARTA EXCLUÍDA ANTES', 'BANCO TETA S.A.'), [['MARTA EXCLUÍDA ANTES', 'A']])];
for (let i = 0; i < 104; i++) H.push(it(7, dia(-20 - (i % 40)), 'Despacho', T('PEDRO MUITAS PUBLICAÇÕES', 'BANCO PI S.A.', 'Ato ' + i + '\n'), [['PEDRO MUITAS PUBLICAÇÕES', 'A']]));   // 104 publicações do mesmo processo: força a 2ª página
const M = [{ ...itA, id: 5000 }, it(8, dia(-4), 'Decisão', T(COMPLEM, 'BANCO LAMBDA S.A.'), [[COMPLEM, 'A']])];
const dados = { '60456': H, '49308': M }; let pedidos = 0;
const fake = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); pedidos++;
  const l = (dados[u.searchParams.get('numeroOab')] || []).filter(i => { const d = i.data_disponibilizacao; return (!u.searchParams.get('dataDisponibilizacaoInicio') || d >= u.searchParams.get('dataDisponibilizacaoInicio')) && (!u.searchParams.get('dataDisponibilizacaoFim') || d <= u.searchParams.get('dataDisponibilizacaoFim')); });
  const tam = Number(u.searchParams.get('itensPorPagina')) || 5, pg = Number(u.searchParams.get('pagina')) || 1;
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', count: l.length, items: l.slice((pg - 1) * tam, pg * tam) }));
}).listen(8890);
await new Promise(ok => fake.on('listening', ok));
const r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.43' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['processos', 'clientes', 'config', 'agenda', '_pub']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
const agora = new Date().toISOString();
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
await f('PUT', '/api/db/config/importacaoAuto', { ativo: false, desde: agora });
await f('PUT', '/api/db/config/processosIgnorados', { numeros: { [dig(num(6))]: agora } });
await f('PUT', '/api/db/clientes/cl1', { nome: 'Complem', apelidos: ['Cooperativa Mista dos Produtores de Leite de Morrinhos - Complem'], pagador: 'cliente', vinculoAuto: true, criadoEm: agora });
await f('PUT', '/api/db/clientes/cl2', { nome: 'Vinícius César Ferreira Messias', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/processos/ja5', { numero: num(5), partes: 'Luiz x Banco Sigma', orgao: 'TJGO', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
const est = (await f('GET', '/api/djen/estado')).j;
await f('PUT', '/api/djen/oabs', { oabs: est.oabs.filter(o => o.numero === '60456').concat([{ id: '', nome: 'Murilo Falone', numero: '49308', uf: 'GO', ativo: true, escopo: 'tudo', avisar: true }]) });
check((await f('GET', '/api/djen/estado')).j.importarAuto === false, 'o servidor de teste informa que o cadastro automático começa desligado (IMPORTAR_AUTO=0)');

const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } });   // não deixa a leitura ao abrir o app guardar publicações no meio do teste
const page = await ctx.newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(4000);
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(900);
const t = s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const visivel = s => page.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, s);

// 1) menu ☰ e tela
await page.click('#prMenuBtn'); await page.waitForTimeout(300);
check(/Importar do Diário Oficial/.test(await t('#prMenu')), 'o menu ☰ de Processos tem “Importar do Diário Oficial”');
await page.click('[data-pr="imp"]'); await page.waitForTimeout(700);
check(await visivel('#overlayImp.show'), 'a janela de importação abre');
check((await page.$$('[data-impoab]:checked')).length === 2, 'as duas OABs vêm marcadas');
check(await page.evaluate(() => document.querySelector('[data-imp="dias"].active').getAttribute('data-v')) === '90', 'o período padrão é 90 dias');
check(/Cadastrar sozinho os processos novos/.test(await t('#impCorpo')) && /Nenhum cliente com vínculo automático|Complem/.test(await t('#impCorpo')), 'a tela mostra o cadastro automático e os clientes com vínculo automático');
// 2) buscar
const foto = async n => { if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/' + n + '.png' }); };
await foto('1-config'); const pubsAntes = (await f('GET', '/api/djen/lista?dias=90')).j.pubs.length;
await page.click('[data-imp="buscar"]'); await page.waitForSelector('[data-impck]', { timeout: 20000 }); await page.waitForTimeout(500); await foto('2-lista');
const lista = await t('#impCorpo');
check(/8 processos achados/.test(lista) && /1 já cadastrados/.test(lista) && /1 excluídos antes/.test(lista) && /6 novos/.test(lista) && /1 possivelmente encerrados/.test(lista), 'resumo: 8 achados (2 OABs, várias páginas, sem repetir), 1 já cadastrado, 1 excluído antes, 6 novos, 1 possivelmente encerrado: ' + lista.slice(0, 260).replace(/\n/g, ' '));
check(pedidos >= 3, 'a busca passou por mais de uma página no Diário Oficial (pedidos: ' + pedidos + ')');
const linha = k => page.evaluate(n => { const c = document.querySelector('[data-impck="' + n + '"]'); return c ? { marcado: c.checked, txt: c.closest('.imp-lin').innerText } : null; }, dig(num(k)));
const lA = await linha(1), lB = await linha(2), lC = await linha(3), lD = await linha(4), lG = await linha(7);
check(lA && lA.marcado && /vincula a Complem/.test(lA.txt), 'cliente automático (Complem, nome abreviado): marcado e “vincula a Complem”');
check(lB && lB.marcado && /revisar: Vinícius/.test(lB.txt), 'cliente com nome igual mas não automático: “revisar: Vinícius…”');
check(lC && lC.marcado && /revisar: sem cliente/.test(lC.txt), 'sem cliente parecido: “revisar: sem cliente”');
check(lD === null, 'o possivelmente encerrado não aparece na lista “em curso”');
check(!(await linha(5)) && !(await linha(6)), 'o já cadastrado e o excluído antes não aparecem');
check(lG && lG.marcado && /BANCO PI/.test(lG.txt), 'o processo com 104 publicações (2 páginas) aparece uma vez só');
check(/5 processos marcados/.test(await t('#impRodape')), 'o rodapé conta os marcados (em curso: 5): ' + (await t('#impRodape')).slice(0, 60));
await page.click('[data-imp="filtro"][data-v="enc"]'); await page.waitForTimeout(300);
const lD2 = await linha(4); check(lD2 && !lD2.marcado && /cita (extinção|arquivamento|trânsito)/.test(lD2.txt), 'na aba “Possivelmente encerrados” ele vem desmarcado, com o motivo: ' + (lD2 && lD2.txt.replace(/\n/g, ' ').slice(0, 120)));
await page.click('[data-imp="filtro"][data-v="curso"]'); await page.waitForTimeout(300);
// 3) importar
await page.click('[data-imp="importar"]'); await page.waitForTimeout(3000);
const fim = await t('#impCorpo');
check(/5 processos cadastrados/.test(fim) && /2 já vinculados sozinhos: Complem \(2\)/.test(fim) && /3 ficaram para revisar/.test(fim), 'resultado: 5 cadastrados, 2 já vinculados a Complem, 3 para revisar: ' + fim.replace(/\n/g, ' ').slice(0, 260));
const P = await docs('processos'), por = n => P.find(d => dig(d.numero) === dig(num(n)));
check(por(1) && por(1).clienteIds[0] === 'cl1' && !por(1).revisar && por(1).vinculoAuto === true && por(1).partes === COMPLEM + ' x BANCO BETA S.A.' && por(1).valorCausa === 12000 && por(1).origem === 'diario', 'Complem: cadastrado, vinculado, sem revisão, com partes e valor da causa');
check(por(8) && por(8).clienteIds[0] === 'cl1', 'o processo que só a OAB do Murilo recebe (Complem) também vem vinculado');
check(por(2) && por(2).revisar === 'cliente-parecido' && por(2).sugestaoClienteId === 'cl2' && !por(2).clienteIds.length, 'Vinícius: cadastrado sem vínculo, na revisão, com o cliente sugerido');
check(por(3) && por(3).revisar === 'sem-cliente' && por(3).parteNome.includes('ZÉLIA'), 'sem cliente parecido: cadastrado e na revisão');
check(por(7) && por(7).revisar === 'sem-cliente', 'o processo das 104 publicações foi cadastrado uma vez');
check(!por(4) && !P.some(d => dig(d.numero) === dig(num(6))), 'o encerrado (desmarcado) e o excluído antes não foram cadastrados');
check(P.find(d => d.id === 'ja5') && P.filter(d => dig(d.numero) === dig(num(5))).length === 1, 'o já cadastrado não foi alterado nem duplicado');
check((await f('GET', '/api/djen/lista?dias=90')).j.pubs.length === pubsAntes, 'a importação não despeja publicações na aba Publicações');
// 4) revisão
await foto('3-resultado');
await page.click('[data-imp="revisar"]'); await page.waitForTimeout(800); await foto('4-revisao');
check(/Mostrando só os 3 processos/.test(await t('#prAvisoVinc')) && (await page.$$('#prLista .pr-card')).length === 3, 'a lista abre só com os 3 da revisão, com um cartão explicando e “Voltar à lista completa”');
const cartao = k => page.evaluate(n => { const c = document.querySelector('#prLista [data-pr-card="' + n + '"]'); return c ? c.innerText : ''; }, dig(num(k)));
const cB = await cartao(2), cC = await cartao(3);
check(/Vincular a Vin/.test(cB) && /Escolher outro cliente/.test(cB) && /Cadastrar cliente novo/.test(cB) && /Excluir processo/.test(cB), 'cartão com cliente parecido: Vincular, Escolher outro cliente, Cadastrar cliente novo e Excluir processo');
check(!/Vincular a /.test(cC) && /Escolher outro cliente/.test(cC) && /Cadastrar cliente novo/.test(cC) && /Excluir processo/.test(cC) && !/Não é de cliente/.test(cC), 'cartão sem cliente parecido: sem “Vincular”, com Escolher, Cadastrar novo e Excluir');
check(await page.evaluate(() => Array.from(document.querySelectorAll('#prLista .pb-acts button')).every(b => b.closest('.pr-card'))), 'todos os botões da revisão ficam dentro dos cartões');
// vincular Vinícius → pergunta do automático
await page.click('#prLista [data-pr-card="' + dig(num(2)) + '"] [data-pr="rev-vinc"]'); await page.waitForTimeout(900);
check(await visivel('#overlayImpPerg.show') && /Vincular os próximos automaticamente/.test(await t('#overlayImpPerg')), 'ao confirmar o vínculo, o app pergunta se os próximos vão direto'); await foto('5-pergunta');
check(await page.evaluate(() => Array.from(document.querySelectorAll('#overlayImpPerg [data-impp]')).length === 2 && Array.from(document.querySelectorAll('#overlayImpPerg [data-impp]')).every(b => b.closest('.modal'))), 'a pergunta tem duas respostas (Sim / Não) dentro da janela');
let pB = (await docs('processos')).find(d => dig(d.numero) === dig(num(2)));
check(pB.clienteIds[0] === 'cl2' && !pB.revisar, 'o processo foi vinculado e saiu da revisão');
await page.click('[data-impp="0"]'); await page.waitForTimeout(700);
check((await docs('clientes')).find(c => c.id === 'cl2').vinculoAuto === true, 'responder Sim marca o cliente como vínculo automático');
check(/Mostrando só os 2 processos/.test(await t('#prAvisoVinc')), 'a revisão ficou com 2');
// cliente novo para o sem-cliente (Zélia)
await page.click('#prLista [data-pr-card="' + dig(num(3)) + '"] [data-pr="rev-novo"]'); await page.waitForTimeout(600);
check(await visivel('#overlayClienteEdit.show') && /Zélia/i.test(await page.inputValue('#cliNomeInput')), 'Cadastrar cliente novo abre o cadastro já com o nome da parte');
await page.click('#cliSalvarBtn'); await page.waitForTimeout(1200);
check(await visivel('#overlayImpPerg.show'), 'depois do cliente novo vinculado, pergunta de novo se os próximos vão direto');
await page.click('[data-impp="1"]'); await page.waitForTimeout(700);
const cliZ = (await docs('clientes')).find(c => /z[eé]lia/i.test(c.nome)), pC = (await docs('processos')).find(d => dig(d.numero) === dig(num(3)));
check(cliZ && cliZ.vinculoAuto === false && pC.clienteIds[0] === cliZ.id && !pC.revisar, 'Zélia: cliente criado, processo vinculado; responder Não deixa o cliente sempre indo para a revisão');
// escolher outro cliente abre a ficha no campo do cliente
await page.click('#prLista [data-pr-card="' + dig(num(7)) + '"] [data-pr="rev-esc"]'); await page.waitForTimeout(700);
check(await visivel('#overlayPr.show') && /falta o cliente/i.test(await t('#prCorpo')) && /Cliente parecido|Nenhum cliente parecido/.test(await t('#prCorpo')), 'Escolher outro cliente abre a ficha com o aviso da revisão');
await page.fill('#pr_cli', 'Complem'); await page.waitForTimeout(400);
await page.click('#pr_sug [data-prf="cli-add"]'); await page.waitForTimeout(300);
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
const p7 = (await docs('processos')).find(d => dig(d.numero) === dig(num(7)));
check(p7.clienteIds[0] === 'cl1' && !p7.revisar, 'escolhendo o cliente na ficha e salvando, o processo sai da revisão');
check(!(await visivel('#overlayImpPerg.show')), 'Complem já é automático: não pergunta de novo');
// excluir
await page.waitForTimeout(500);
const restantes = (await docs('processos')).filter(d => d.revisar);
check(restantes.length === 0, 'não restou processo na revisão');
await f('PUT', '/api/db/processos/xdel', { numero: num(9), partes: 'Fulano x Beltrano', orgao: 'TJGO', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'diario', revisar: 'sem-cliente', parteNome: 'FULANO', criadoEm: agora, importadoEm: agora });
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(800);
check(/1 processo espera a revisão/.test(await t('#prAvisoVinc')) && await visivel('[data-pr="rev-ir"]'), 'o aviso “Importados do Diário Oficial” com “Revisar agora” aparece no topo da lista');
await page.click('[data-pr="rev-ir"]'); await page.waitForTimeout(500);
await page.click('#prLista [data-pr-card="' + dig(num(9)) + '"] [data-pr="rev-del"]'); await page.waitForTimeout(500);
check(await visivel('#overlayImpPerg.show') && /Excluir este processo/.test(await t('#overlayImpPerg')), 'Excluir processo pede confirmação');
await page.click('[data-impp="0"]'); await page.waitForTimeout(1000);
const ign = ((await f('GET', '/api/db/config')).j.docs.find(d => d.id === 'processosIgnorados') || {}).data || {};
check(!(await docs('processos')).some(d => dig(d.numero) === dig(num(9))) && ign.numeros && ign.numeros[dig(num(9))], 'o processo foi excluído e ficou na lista de excluídos (não volta pela leitura automática)');
check(erros.length === 0, 'sem erros na página: ' + erros.join(' | '));

// 5) cadastro automático dos processos novos das publicações
await f('PUT', '/api/db/config/importacaoAuto', { ativo: true, desde: new Date(Date.now() - 60000).toISOString() });
const N1 = 11, N2 = 12, N3 = 13, N4 = 6;
dados['60456'] = [it(N1, dia(-1), 'Decisão', T(VINI, 'BANCO NOVO S.A.'), [[VINI, 'A']]), it(N2, dia(-1), 'Decisão', T('CARLOS DESCONHECIDO', 'BANCO NOVO 2 S.A.'), [['CARLOS DESCONHECIDO', 'A']]),
  it(N3, dia(-1), 'Sentença', T('ANA ENCERRADA', 'BANCO NOVO 3 S.A.', 'Julgo extinto o processo; arquivem-se.\n'), [['ANA ENCERRADA', 'A']]), it(N4, dia(-1), 'Decisão', T('MARTA EXCLUÍDA ANTES', 'BANCO TETA S.A.'), [['MARTA EXCLUÍDA ANTES', 'A']])];
dados['49308'] = [];
await f('POST', '/api/djen/buscar', { dias: 5 });
await page.reload(); await page.waitForTimeout(5000);
const P2 = await docs('processos'), p = n => P2.find(d => dig(d.numero) === dig(num(n)));
check(p(N1) && p(N1).clienteIds[0] === 'cl2' && p(N1).vinculoAuto === true && !p(N1).revisar, 'processo novo de cliente automático (Vinícius) é cadastrado já vinculado');
check(p(N2) && p(N2).revisar === 'sem-cliente' && !p(N2).clienteIds.length, 'processo novo sem cliente parecido é cadastrado e vai para a revisão');
check(!p(N3), 'publicação que diz “extinto / arquivem-se” não cadastra sozinho');
check(!p(N4), 'processo excluído antes não é cadastrado de novo');
const antes = (await docs('processos')).length; await page.reload(); await page.waitForTimeout(4000);
check((await docs('processos')).length === antes, 'abrir o app de novo não duplica o que já foi cadastrado');
// 5b) cliente cadastrado depois: a revisão se atualiza e dá para vincular a mesma parte de uma vez
const COAPIL = 'COOPERATIVA AGROPECUARIA MISTA DE PIRACANJUBA - COAPIL', FAZ = 'FAZENDA SÃO JOÃO LTDA', ZETA = 'LOJA ZETA COMÉRCIO LTDA';
const rev = (id, k, parte) => f('PUT', '/api/db/processos/' + id, { numero: num(k), partes: parte + ' x BANCO X', autor: parte, reu: 'BANCO X', orgao: 'TJGO', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'diario', revisar: 'sem-cliente', parteNome: parte, ultimaPublicacao: dia(-2), criadoEm: agora, importadoEm: agora });
await rev('g1', 21, COAPIL); await rev('g2', 22, COAPIL); await rev('g3', 23, COAPIL); await rev('h1', 24, FAZ); await rev('h2', 25, FAZ); await rev('z1', 26, ZETA); await rev('z2', 27, ZETA); await rev('k1', 28, 'AGRO BETA'); await rev('k2', 29, 'AGRO BETA');
await f('PUT', '/api/db/clientes/cl9', { nome: 'Coapil', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/cl10', { nome: 'Agro Beta', pagador: 'cliente', vinculoAuto: true, criadoEm: agora });
await page.reload(); await page.waitForTimeout(4500);
let Q = await docs('processos'), q = id => Q.find(d => d.id === id);
check(q('k1').clienteIds[0] === 'cl10' && q('k2').clienteIds[0] === 'cl10' && !q('k1').revisar, 'cliente automático cadastrado depois: os processos que já estavam na revisão são vinculados sozinhos');
check(['g1', 'g2', 'g3'].every(id => q(id).revisar === 'cliente-parecido' && q(id).sugestaoClienteId === 'cl9') && q('h1').revisar === 'sem-cliente', 'cliente comum cadastrado depois (Coapil): a revisão passa a sugerir o cliente nos 3 processos; os sem cliente continuam iguais');
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(600);
await page.click('[data-pr="rev-ir"]'); await page.waitForTimeout(600);
const grupos = await page.evaluate(() => Array.from(document.querySelectorAll('#prLista > .pb-card')).filter(c => /Mesma parte em/.test(c.innerText)).map(c => c.innerText));
check(grupos.length === 3 && /Mesma parte em 3 processos/.test(grupos[0]) && /Vincular os 3 a Coapil/.test(grupos[0]) && /Escolher outro cliente/.test(grupos[0]) && /Cadastrar cliente novo/.test(grupos[0]), 'a revisão mostra um cartão por parte repetida, com “Vincular os 3 a Coapil”, escolher outro cliente e cadastrar cliente novo: ' + grupos.length);
check(await page.evaluate(() => Array.from(document.querySelectorAll('#prLista > .pb-card:not(.pr-card) button')).every(b => b.closest('.pb-card'))), 'os botões do cartão da parte repetida ficam dentro do cartão');
await foto('7-grupos');
await page.click('#prLista > .pb-card:first-child [data-pr="rev-gvinc"]'); await page.waitForTimeout(1200);
Q = await docs('processos');
check(['g1', 'g2', 'g3'].every(id => q(id).clienteIds[0] === 'cl9' && !q(id).revisar), 'Vincular os 3: os três processos vão para o cliente de uma vez');
check(await visivel('#overlayImpPerg.show') && /próximos automaticamente/.test(await t('#overlayImpPerg')), 'depois do vínculo em lote, pergunta se os próximos vão direto');
await page.click('[data-impp="0"]'); await page.waitForTimeout(800);
check((await docs('clientes')).find(c => c.id === 'cl9').vinculoAuto === true, 'responder Sim liga o automático do Coapil');
// escolher outro cliente (lista com busca) para o grupo da Fazenda
await page.click('#prLista > .pb-card:first-child [data-pr="rev-gesc"]'); await page.waitForTimeout(600);
check(await visivel('#overlayImpCli.show') && /2 processos de/.test(await t('#impCInfo')), 'Escolher outro cliente abre a lista de clientes com busca');
await page.fill('#impCBusca', 'beta'); await page.waitForTimeout(300);
check((await page.$$('#impCLista [data-impc]')).length === 1, 'a busca filtra a lista de clientes');
await page.click('#impCLista [data-impc="cl10"]'); await page.waitForTimeout(1200);
Q = await docs('processos');
check(['h1', 'h2'].every(id => q(id).clienteIds[0] === 'cl10' && !q(id).revisar), 'os dois processos da Fazenda foram vinculados ao cliente escolhido');
// cadastrar cliente novo para o grupo da Loja Zeta
await page.click('#prLista > .pb-card:first-child [data-pr="rev-gnovo"]'); await page.waitForTimeout(600);
check(await visivel('#overlayClienteEdit.show') && /Loja Zeta/i.test(await page.inputValue('#cliNomeInput')), 'Cadastrar cliente novo, no grupo, abre o cadastro com o nome da parte');
await page.click('#cliSalvarBtn'); await page.waitForTimeout(1300);
Q = await docs('processos'); const cz = (await docs('clientes')).find(c => /loja zeta/i.test(c.nome));
check(cz && ['z1', 'z2'].every(id => q(id).clienteIds[0] === cz.id && !q(id).revisar), 'o cliente novo é criado e os dois processos da Loja Zeta vinculados a ele: ' + JSON.stringify([cz && cz.id, q('z1').clienteIds, q('z1').revisar, await t('#overlayImpPerg')]));
if (await visivel('#overlayImpPerg.show')) await page.click('[data-impp="1"]');
await page.waitForTimeout(500);

// 6) ligar/desligar na tela de importação e criação atômica
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(600);
await page.click('#prMenuBtn'); await page.click('[data-pr="imp"]'); await page.waitForTimeout(800); await foto('6-config-depois');
check(/Vinícius César Ferreira Messias/.test(await t('#impCorpo')) && /Complem/.test(await t('#impCorpo')), 'a tela de importação lista os clientes com vínculo automático (Complem e Vinícius)');
await page.click('[data-imp="cli-desliga"][data-v="cl2"]'); await page.waitForTimeout(700);
check((await docs('clientes')).find(c => c.id === 'cl2').vinculoAuto === false, 'Desligar tira o vínculo automático do cliente');
await page.click('[data-imp="auto-liga"]'); await page.waitForTimeout(700);
check(((await f('GET', '/api/db/config')).j.docs.find(d => d.id === 'importacaoAuto') || {}).data.ativo === false, 'o botão do cadastro automático desliga e grava');
const a1 = await f('PUT', '/api/db/processos/dteste1?soNovo=1', { numero: 'x', partes: 'um' }), a2 = await f('PUT', '/api/db/processos/dteste1?soNovo=1', { numero: 'x', partes: 'dois' });
check(a1.j.criado === true && a2.j.criado === false && (await docs('processos')).find(d => d.id === 'dteste1').partes === 'um', 'criar com o mesmo id duas vezes: a segunda não sobrescreve (evita duplicar entre aparelhos)');
const adv1 = ((await docs('processos')).find(d => d.numero === num(1)) || {}).advogados || [], adv8 = ((await docs('processos')).find(d => d.numero === num(8)) || {}).advogados || [];
check(adv1.map(x => x.oab).sort().join() === '49308/GO,60456/GO' && adv1.find(x => x.oab === '60456/GO').nome === 'Hygor Lima Andrade', 'processo achado pelas duas OABs já nasce com os dois advogados (60456/GO e 49308/GO)');
check(adv8.length === 1 && adv8[0].oab === '49308/GO', 'e o achado só pela OAB do Murilo nasce com ele (49308/GO)');
await br.close(); fake.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
