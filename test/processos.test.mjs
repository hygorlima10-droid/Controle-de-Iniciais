// Testa a aba Processos: lista única (processos cadastrados + Iniciais, Acordos e Alvarás pelo número), ficha,
// reconhecimento do número nos formulários, arquivar e reabrir, Arquivados, perfil do cliente e busca.
// Suba antes (banco novo):
//   npx wrangler d1 execute controle-juridico --local --persist-to /tmp/dev-data-pub --file schema.sql
//   npx wrangler dev --local --persist-to /tmp/dev-data-pub --var SENHA:senha-de-teste-123 --port 8812
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const hojeLocal = new Date().toLocaleDateString('sv-SE');
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.6' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const docs = async col => (await f('GET', '/api/db/' + col)).j.docs.map(d => ({ id: d.id, ...d.data }));
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov', 'prazosPub', 'agenda', 'processos']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
const N1 = '5368644-67.2026.8.09.0107', N2 = '5593217-64.2021.8.09.0107', N3 = '5118774-16.2026.8.09.0017';
await f('PUT', '/api/db/clientes/cl1', { nome: 'Maquele Viana Pacheco', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/cl2', { nome: 'Cooperativa Mista', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/casos/c1', { tipo: 'inicial', cliente: 'Maquele Viana Pacheco', nomeAcao: 'Declaratória', origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 3000, parcelas: [{ numero: 1, valor: 3000, data: dia(10), pago: false }], numeroProcesso: N1, clienteIds: ['cl1'], criadoEm: agora, atualizadoEm: agora });
await f('PUT', '/api/db/termosAcordo/a1', { partes: 'Cooperativa x Osmar', numeroProcesso: N2, origem: 'proprio', status: 'pendente', valorTotal: 4000, valorMeuHonorario: 1200, parcelas: [{ numero: 1, valor: 1200, data: dia(20), pago: false }], data: dia(20), clienteIds: ['cl2'], criadoEm: agora, atualizadoEm: agora });

const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const t = async s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const nCards = () => page.evaluate(() => document.querySelectorAll('#prLista .pr-card').length);
const cardDe = async num => page.evaluate(n => { const c = document.querySelector('[data-pr-card="' + n + '"]'); return c ? c.innerText : ''; }, num.replace(/\D/g, ''));
check(await page.evaluate(() => !!document.querySelector('#drawer [data-tab="processos"]')), 'o menu tem a aba Processos');
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(900);
check(/Processos/.test(await t('#tituloTela')) && /Processos em andamento/i.test(await t('#prResumo')), 'abre a aba com o resumo');
check(await nCards() === 2, 'a lista já traz os processos que existem como Inicial e Acordo (pelo número): ' + await nCards());
const c1 = await cardDe(N1), c2 = await cardDe(N2);
check(/Inicial/.test(c1) && /Maquele Viana Pacheco/.test(c1) && /a receber/.test(c1), 'a Inicial aparece como processo, com o cliente e o honorário a receber');
check(/Acordo/.test(c2) && /Cooperativa Mista|Cooperativa x Osmar/.test(c2), 'o Termo de acordo também');

// cadastrar processo "só para acompanhar"
await page.click('[data-pr="novo"]'); await page.waitForTimeout(400);
check(await page.evaluate(() => document.getElementById('overlayPr').classList.contains('show')), 'abre o cadastro de processo');
await page.click('[data-prf="salvar"]'); await page.waitForTimeout(200);
check(/Informe o número/.test(await t('#pr_erro')), 'exige o número');
await page.fill('#pr_numero', N3); await page.waitForTimeout(100);
check(/Número válido|dígito verificador/.test(await t('#pr_numinfo')), 'confere o número pelo padrão do CNJ: ' + await t('#pr_numinfo'));
await page.fill('#pr_partes', 'Cooperativa Agropecuária x Fulano'); await page.fill('#pr_orgao', 'TJGO · Bela Vista de Goiás'); await page.fill('#pr_classe', 'Execução de título extrajudicial');
await page.fill('#pr_cli', 'cooper'); await page.waitForTimeout(300); await page.click('#pr_sug [data-prf="cli-add"]'); await page.waitForTimeout(200);
check(/Cooperativa Mista/.test(await t('#pr_chips')), 'vincula o cliente pelo nome');
await page.selectOption('#pr_hon', 'quitados'); await page.fill('#pr_obs', 'Penhora via PrevJUD'); await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
let pd = await docs('processos');
check(pd.length === 1 && pd[0].numero === N3 && pd[0].honorarios === 'quitados' && pd[0].clienteIds.join() === 'cl2' && pd[0].arquivado === false, 'o processo é gravado com cliente, honorários e observação');
check(await nCards() === 3 && /Só processo/.test(await cardDe(N3)) && /honorários já quitados/.test(await cardDe(N3)), 'aparece na lista como "Só processo" com a etiqueta de honorários');
await page.click('[data-pr="novo"]'); await page.waitForTimeout(300); await page.fill('#pr_numero', N3); await page.click('[data-prf="salvar"]'); await page.waitForTimeout(300);
check(/já está cadastrado/.test(await t('#pr_erro')), 'não deixa cadastrar o mesmo número duas vezes');
await page.click('#prX');

// reconhecimento de nomes: nome completo da publicação x nome abreviado do cliente
const nv = await page.evaluate(() => { const n = window.__horusTeste.cliNivel, P = 'COOPERATIVA MISTA DOS PRODUTORES DE LEITE DE MORRINHOS - COMPLEM'; return { complem: n(P, 'Complem'), completo: n(P, 'Cooperativa Mista dos Produtores de Leite de Morrinhos'), igualCaixa: n('FULANO DE TAL', 'Fulano de Tal'), souza: n('MARIA SOUZA DA SILVA', 'Maria Souza'), curto: n('ANA PAULA LIMA', 'Ana'), outro: n('JOSE SANTOS', 'Maria'), comum: n('COOPERATIVA AGROPECUARIA DE PIRACANJUBA', 'Cooperativa Mista de Morrinhos'), ltda: n('CONSTRUTORA ALFA LTDA', 'Construtora Alfa') }; });
check(nv.complem === 2 && nv.completo === 2 && nv.igualCaixa === 3 && nv.souza === 2 && nv.ltda === 3, 'o nome abreviado (Complem) é reconhecido como parte do nome completo da publicação; nomes iguais, sem LTDA e sem maiúsculas, valem como iguais: ' + JSON.stringify(nv));
check(nv.curto === 0 && nv.outro === 0 && nv.comum === 0, 'nomes curtos demais ou diferentes não são confundidos');
// cadastrar um cliente novo de dentro do cadastro de processo (a janela do cliente tem de abrir por cima)
await page.click('[data-pr="novo"]'); await page.waitForTimeout(400);
await page.fill('#pr_numero', '5000333-02.2024.8.09.0107'); await page.fill('#pr_cli', 'Cliente Novo Teste'); await page.waitForTimeout(300);
await page.click('#pr_sug [data-prf="cli-new"]'); await page.waitForTimeout(500);
const topo = await page.evaluate(() => { const el = document.getElementById('cliNomeInput'), r = el.getBoundingClientRect(), x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { aberto: document.getElementById('overlayClienteEdit').classList.contains('show'), porCima: !!(x && x.closest('#overlayClienteEdit')), nome: el.value }; });
check(topo.aberto && topo.porCima && topo.nome === 'Cliente Novo Teste', 'o cadastro de cliente abre por cima do cadastro de processo, com o nome já preenchido');
await page.click('#cliSalvarBtn'); await page.waitForTimeout(1000);
check(/Cliente Novo Teste/.test(await t('#pr_chips')) && (await docs('clientes')).some(c => c.nome === 'Cliente Novo Teste'), 'ao salvar, o cliente é cadastrado e já fica vinculado ao processo');
await page.click('#prX'); await page.waitForTimeout(300);

// reconhecimento nos formulários de Acordo e Alvará
await page.evaluate(() => document.querySelector('#drawer [data-tab="acordos"]').click()); await page.waitForTimeout(500);
await page.click('#fabNew'); await page.waitForTimeout(300); await page.click('[data-novo-k="acordo"]'); await page.waitForTimeout(500);
await page.fill('#acordoProcessoInput', N3); await page.press('#acordoProcessoInput', 'Tab'); await page.waitForTimeout(300);
const sug = await t('#acordoProcessoSugestao');
check(/Processo/.test(sug) && /Cooperativa Agropecuária x Fulano/.test(sug), 'ao digitar o número no Termo de acordo, o app reconhece o processo cadastrado: ' + sug.replace(/\n/g, ' ').slice(0, 80));
await page.click('#acordoProcessoSugestao [data-usar-sugestao]'); await page.waitForTimeout(300);
const partesAc = await page.evaluate(() => document.getElementById('acordoPartesInput').value);
check(/Cooperativa/.test(partesAc) && /Cooperativa Mista/.test(await t('#pickAcordo')), '"Usar estes dados" preenche as partes e o cliente: [' + partesAc + '] chips=[' + (await t('#pickAcordo')).replace(/\n/g, ' ') + '] sug=[' + (await t('#acordoProcessoSugestao')).replace(/\n/g, ' ') + ']');
await page.click('#cancelBtnAcordo, #closeModalAcordo'); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#drawer [data-tab="alvaras"]').click()); await page.waitForTimeout(500);
await page.click('#fabNew'); await page.waitForTimeout(300); await page.click('[data-novo-k="alvara"]'); await page.waitForTimeout(500);
await page.fill('#alvaraProcessoInput', N1); await page.press('#alvaraProcessoInput', 'Tab'); await page.waitForTimeout(300);
check(/Inicial|Maquele/.test(await t('#alvaraProcessoSugestao')), 'no Alvará, o número de uma Inicial também é reconhecido');
await page.click('#cancelBtnAlvara, #closeModalAlvara'); await page.waitForTimeout(300);

// o acordo lançado com o número do processo cadastrado cai dentro da ficha dele
await f('PUT', '/api/db/termosAcordo/a2', { partes: 'Cooperativa Agropecuária x Fulano', numeroProcesso: N3, origem: 'proprio', status: 'pendente', valorTotal: 2000, valorMeuHonorario: 600, parcelas: [{ numero: 1, valor: 600, data: dia(15), pago: false }], data: dia(15), clienteIds: ['cl2'], criadoEm: agora, atualizadoEm: agora });
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(800);
check(await nCards() === 3, 'o acordo com o mesmo número não cria processo duplicado (3 processos)');
const c3 = await cardDe(N3);
check(/Só processo · Acordo|Acordo/.test(c3) && /a receber/.test(c3), 'o processo agora mostra o honorário do acordo vinculado');
await page.click('[data-pr="abrir"][data-n="' + N3.replace(/\D/g, '') + '"]'); await page.waitForTimeout(500);
const fi = await t('#prCorpo');
check(/Honorários/i.test(fi) && /Acordo · Termo de acordo/.test(fi) && /a receber/.test(fi) && (await page.evaluate(() => !!document.querySelector('[data-prf="link"]'))), 'a ficha tem o link direto para o honorário do acordo: ' + fi.replace(/\n/g, ' ').slice(0, 260));
check(await page.evaluate(() => ['Adicionar honorários (fixo, êxito…)', 'Adicionar termo de acordo', 'Adicionar alvará'].every(x => Array.from(document.querySelectorAll('[data-prf="novo-hon"]')).some(b => b.innerText.trim() === x))), 'e atalhos para lançar honorários (fixo/êxito, Termo de acordo, Alvará)');
check(/Prazos e audiências/i.test(fi) && /Linha do tempo/i.test(fi) && /Clientes vinculados/i.test(fi), 'a ficha mostra clientes, prazos e publicações');
await page.click('[data-prf="link"]'); await page.waitForTimeout(800);
check(await page.evaluate(() => document.body.getAttribute('data-tab')) === 'acordos', 'o link abre o termo de acordo');
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(600);

// Inicial (só derivada): salvar observação cria a ficha do processo
await page.click('[data-pr="abrir"][data-n="' + N1.replace(/\D/g, '') + '"]'); await page.waitForTimeout(400);
await page.fill('#pr_obs', 'Aguardando contestação'); await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1200);
pd = await docs('processos'); const d1 = pd.find(d => d.numero === N1);
check(d1 && d1.obs === 'Aguardando contestação' && d1.derivado === true && pd.length === 2, 'observação num processo que vem de Inicial cria a ficha dele (sem duplicar)');
check(await nCards() === 3, 'continua sem duplicar na lista');

// prazo da Agenda ligado ao processo
await f('POST', '/api/db/agenda', { tipo: 'prazo', titulo: 'Réplica', processo: N1, cliente: 'Maquele Viana Pacheco', data: dia(3), situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], criadoEm: agora });
await page.reload(); await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(800);
check(/1 prazo aberto/.test(await cardDe(N1)) && /Réplica/.test(await t('#prLista')) === false, 'o cartão mostra o prazo aberto da Agenda');
await page.click('[data-pr="filtro"][data-v="prazo"]'); await page.waitForTimeout(300);
check(await nCards() === 1, 'filtro "Com prazo" mostra só quem tem prazo aberto');
await page.click('[data-pr="filtro"][data-v="andamento"]');
await page.fill('#prBusca', 'agropecu'); await page.waitForTimeout(400);
check(await nCards() === 1 && /Agropecu/.test(await t('#prLista')), 'busca por parte do nome');
await page.fill('#prBusca', '5593217'); await page.waitForTimeout(400);
check(await nCards() === 1, 'busca por parte do número');
await page.fill('#prBusca', ''); await page.waitForTimeout(300);

// arquivar
const num1 = N1.replace(/\D/g, '');
await page.click('[data-pr="arquivar"][data-n="' + num1 + '"]'); await page.waitForTimeout(500);
const am = await t('#praCorpo');
check(/Prazos abertos na Agenda\s*1/.test(am) && /Publicações não lidas/.test(am) && /Honorários ainda a receber/.test(am) && /Trânsito em julgado/.test(am), 'a janela de arquivar avisa do prazo aberto e dos honorários');
await page.click('input[name="pra_mot"][value="Acordo cumprido"]'); await page.click('#praOk'); await page.waitForTimeout(1500);
pd = await docs('processos'); const a1 = pd.find(d => d.numero === N1);
check(a1.arquivado === true && a1.motivoArquivo === 'Acordo cumprido' && a1.dataArquivo === hojeLocal, 'o processo é arquivado com motivo e data');
check((await docs('casos'))[0].arquivado === true, 'a Inicial ligada ao processo também é arquivada');
check(await nCards() === 2, 'sai de "Em andamento"');
await page.click('[data-pr="filtro"][data-v="todos"]'); await page.waitForTimeout(300);
check(await nCards() === 3 && /arquivado · Acordo cumprido/.test(await cardDe(N1)), '"Todos" mostra o arquivado, com o motivo');
await page.click('[data-pr="filtro"][data-v="andamento"]');
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(700);
await page.click('[data-ag="vista"][data-v="lista"]'); await page.waitForTimeout(300);
check(!/Réplica/.test(await t('#agWrap')), 'o prazo do processo arquivado sai da Agenda');
// Arquivados
await page.evaluate(() => document.querySelector('#drawer [data-tab="arquivados"]').click()); await page.waitForTimeout(700);
await page.click('#headArquivados [data-filtros-toggle]'); await page.waitForTimeout(200);
await page.selectOption('#filtroArqTipo', 'processo'); await page.waitForTimeout(400);
check(await page.evaluate(() => document.querySelectorAll('[data-arq-pr]').length) === 1 && /Acordo cumprido/.test(await t('#listArquivados')), 'em Arquivados, o filtro "Processos" mostra o processo e o motivo');
await page.click('[data-pr-reabrir]'); await page.waitForTimeout(1500);
pd = await docs('processos');
check(pd.find(d => d.numero === N1).arquivado === false && (await docs('casos'))[0].arquivado === false, 'Reabrir volta o processo e a Inicial');
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(700);
check(/Réplica/.test(await t('#agWrap')), 'e o prazo volta para a Agenda');

// honorários do processo: êxito (%) e fixo, cadastrados pela ficha e fora do quadro de Iniciais
const N4 = '5000999-77.2024.8.09.0107', num4 = N4.replace(/\D/g, '');
await f('POST', '/api/db/processos', { numero: N4, partes: 'Silva x Banco Alfa', orgao: 'TJGO · Morrinhos', classe: 'Cumprimento de sentença', clienteIds: ['cl1'], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
await page.reload(); await page.waitForTimeout(3500);
const pendTxt = async () => (await page.evaluate(() => document.getElementById('resumoPendente').textContent)).replace(/[^\d,]/g, '').replace(',', '.');
const totAntes = Number(await pendTxt());
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(800);
await page.click('[data-pr="abrir"][data-n="' + num4 + '"]'); await page.waitForTimeout(500);
check(!/outra aba/i.test(await t('#prCorpo')) && /Honorários que vou receber/i.test(await t('#prCorpo')) && await page.evaluate(() => !!document.querySelector('[data-prf="novo-hon"][data-v="caso"]')), 'a ficha tem "Honorários que vou receber" e não tem mais "controlados em outra aba"');
await page.click('[data-prf="novo-hon"][data-v="caso"]'); await page.waitForTimeout(800);
const frm = await page.evaluate(() => ({ aberto: document.getElementById('overlay').classList.contains('show'), titulo: document.getElementById('modalTitle').textContent, tipoOculto: getComputedStyle(document.getElementById('segTipo').closest('.field')).display === 'none', proc: document.getElementById('processoInput').value, cli: document.getElementById('clienteInput').value, chips: document.querySelector('#pickCaso .cli-chips').innerText }));
check(frm.aberto && frm.titulo === 'Honorários do processo' && frm.tipoOculto && frm.proc === N4 && /Silva/.test(frm.cli) && /Maquele/.test(frm.chips), 'abre o cadastro de honorários já com o processo, as partes e o cliente: ' + JSON.stringify(frm));
await page.click('#segModalidade [data-value="exito"]'); await page.fill('#percentualInput', '30'); await page.click('#saveBtn'); await page.waitForTimeout(1500);
let hs = (await docs('casos')).filter(c => c.doProcesso);
check(hs.length === 1 && hs[0].modalidadeHonorario === 'exito' && hs[0].percentualExito === 30 && hs[0].numeroProcesso === N4 && hs[0].clienteIds.join() === 'cl1', 'os honorários de êxito (30%) são gravados ligados ao processo');
check(/30% de êxito/.test(await cardDe(N4)), 'o cartão do processo mostra "30% de êxito": ' + (await cardDe(N4)).replace(/\n/g, ' | ').slice(0, 160));
await page.click('[data-pr="abrir"][data-n="' + num4 + '"]'); await page.waitForTimeout(500);
await page.click('[data-prf="novo-hon"][data-v="caso"]'); await page.waitForTimeout(800);
await page.click('#segModalidade [data-value="fixo"]'); await page.fill('#valorInput', '3000'); await page.click('#segPagamento [data-value="avista"]'); await page.fill('#dataAvistaInput', dia(20)); await page.click('#saveBtn'); await page.waitForTimeout(1500);
hs = (await docs('casos')).filter(c => c.doProcesso);
check(hs.length === 2 && hs.some(h => h.modalidadeHonorario === 'fixo' && h.valorHonorarios === 3000 && h.formaPagamento === 'avista'), 'também grava honorário fixo à vista (R$ 3.000)');
check(/a receber/.test(await cardDe(N4)), 'e o cartão mostra o que falta receber');
await page.evaluate(() => document.querySelector('#drawer [data-tab="peticoes"]').click()); await page.waitForTimeout(700);
check(!/Silva/.test(await t('#kanbanPeticoes')) && !/Silva/.test(await t('#list')), 'os honorários de processo NÃO aparecem no quadro nem na lista de Iniciais');
check(!/R\$\s*3\.000,00.*3\.000,00.*3\.000,00/s.test(await t('#stats')), 'e não entram no cabeçalho de Iniciais');
await page.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await page.waitForTimeout(800);
const totDepois = Number(await pendTxt());
check(Math.abs(totDepois - totAntes - 3000) < 0.01, 'mas entram no "A receber" geral do Início (de ' + totAntes + ' para ' + totDepois + ')');
await page.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await page.waitForTimeout(700);
await page.click('[data-pr="abrir"][data-n="' + num4 + '"]'); await page.waitForTimeout(500);
check(/Honorários do processo/.test(await t('#prCorpo')) && (await page.evaluate(() => Array.from(document.querySelectorAll('[data-prf="link"]')).filter(b => /Editar/.test(b.innerText)).length)) === 2, 'a ficha lista os dois honorários do processo, com "Editar"');
await page.click('[data-prf="link"]'); await page.waitForTimeout(800);
check(/Editar honorários do processo/.test(await t('#modalTitle')) && await page.evaluate(() => document.getElementById('overlay').classList.contains('show')), 'Editar abre os honorários em modo próprio');
await page.click('#closeModal'); await page.waitForTimeout(500);
check(await page.evaluate(() => getComputedStyle(document.getElementById('segTipo').closest('.field')).display !== 'none'), 'ao fechar, a janela de Inicial volta ao normal');
// escolher "tenho honorários a receber" no cadastro do processo abre o cadastro dos honorários depois de salvar
await page.click('[data-pr="novo"]'); await page.waitForTimeout(400);
await page.fill('#pr_numero', '5111222-33.2025.8.09.0107'); await page.fill('#pr_partes', 'Novo x Processo'); await page.selectOption('#pr_hon', 'receber'); await page.click('[data-prf="salvar"]'); await page.waitForTimeout(1500);
check(await page.evaluate(() => document.getElementById('overlay').classList.contains('show') && document.getElementById('modalTitle').textContent === 'Honorários do processo' && document.getElementById('processoInput').value === '5111222-33.2025.8.09.0107'), 'escolhendo "tenho honorários a receber", depois de salvar o processo abre o cadastro dos honorários');
await page.click('#closeModal'); await page.waitForTimeout(400);

// perfil do cliente
await page.evaluate(() => document.querySelector('#drawer [data-tab="clientes"]').click()); await page.waitForTimeout(700);
await page.click('[data-cli-perfil], .cli-card, [data-perfil]').catch(() => {});
const ab = await page.evaluate(() => { const el = Array.from(document.querySelectorAll('#bodyClientes *')).find(e => /^Cooperativa Mista$/.test((e.textContent || '').trim()) && e.children.length === 0); if (el) el.click(); return !!el; });
await page.waitForTimeout(700);
check(ab && /Processos e atos \(\d+\)/.test(await t('#perfilBody')) && !/Atos e processos/.test(await t('#perfilBody')), 'o perfil do cliente tem uma seção só: "Processos e atos"');
check(await page.evaluate(() => !document.querySelector('#perfilBody details[data-sec="processos"]') && document.querySelectorAll('#perfilBody details[data-sec="atos"]').length === 1), 'não existe mais uma seção separada de "Processos"');
await page.evaluate(() => { const d = document.querySelector('#perfilBody details[data-sec="atos"]'); if (d) d.open = true; });
const sec = await t('#perfilBody details[data-sec="atos"]');
check(/Cooperativa Agropecuária x Fulano/.test(sec) && /Processo/.test(sec) && /Termo de acordo|Acordo/.test(sec), 'a seção junta os processos do cliente e os atos (acordos, iniciais, alvarás) com os honorários');
await page.click('#closePerfil'); await page.waitForTimeout(300);
// busca global
await page.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await page.waitForTimeout(500);
await page.fill('#buscaGlobalInput', 'Agropecuária'); await page.waitForTimeout(500);
check(/Processo/.test(await t('#buscaGlobalResultados')), 'a busca do Início acha o processo');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
