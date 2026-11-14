// Testes do que roda sozinho no Node (sem navegador): limpeza do texto, trecho, prazo sugerido e leitura paginada do DJEN.
//   node test/djen.test.mjs
import http from 'node:http';
import { htmlParaTexto, trechoDe, sugerirPrazo, sugerirAudiencia, motivoEncerra, lerCfg, lerDjen, relerSePreciso, extrairDados } from '../src/djen.js';
import { montarNotificacoes } from '../src/index.js';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

// audiência designada no texto
{
  const a1 = sugerirAudiencia('Designo audiência de conciliação para o dia 12/03/2027, às 14:30 horas, a ser realizada por videoconferência. Intimem-se.');
  check(a1 && a1.data === '2027-03-12' && a1.hora === '14:30' && a1.tipo === 'Conciliação' && a1.modalidade === 'online', 'audiência: data, hora, tipo e modalidade (online): ' + JSON.stringify(a1 && [a1.data, a1.hora, a1.tipo, a1.modalidade]));
  const a2 = sugerirAudiencia('Fica designada audiência de instrução e julgamento para o dia 15 de abril de 2027, às 09h00min, na sala de audiências do Fórum (presencial).');
  check(a2 && a2.data === '2027-04-15' && a2.hora === '09:00' && a2.tipo === 'Instrução e julgamento' && a2.modalidade === 'presencial', 'audiência: data por extenso, 09h00min e presencial');
  const a3 = sugerirAudiencia('Redesigno a audiência para 20/05/2027 às 13h30. Link: https://meet.google.com/abc-defg-hij para acesso.');
  check(a3 && a3.data === '2027-05-20' && a3.hora === '13:30' && /meet\.google\.com/.test(a3.link) && a3.modalidade === 'online', 'audiência: link da sala virtual reconhecido');
  const a4 = sugerirAudiencia('Cancelo a audiência anteriormente designada para 12/03/2027, às 14:00.');
  check(a4 === null, 'audiência cancelada não é sugerida');
  check(sugerirAudiencia('Intime-se a parte para se manifestar em 15 dias sobre o laudo. Prazo de 05 dias.') === null, 'texto sem audiência: nada');
  const a5 = sugerirAudiencia('Audiência de mediação designada para 31/02/2027 às 10:00.');
  check(a5 === null || a5.data !== '2027-02-31', 'data impossível não é aceita como está');
  const a6 = sugerirAudiencia('Designada audiência de justificação para o dia 10/12/2026.');
  check(a6 && a6.data === '2026-12-10' && a6.hora === '' && a6.tipo === 'Justificação', 'sem hora no texto: a hora fica em branco para você preencher');
}

// texto e trecho
const t = htmlParaTexto('Poder Judici&aacute;rio\nTribunal de Justi&ccedil;a\nComarca de Morrinhos\nAutos n.:&nbsp;5593217-64.2021.8.09.0107\nDECIS&Atilde;O\nDEFIRO o pedido de busca no sistema PrevJUD. Prazo de 5 (cinco) dias.<br>Fim');
check(!/&\w+;/.test(t) && /Justiça/.test(t) && /DECISÃO/.test(t), 'entidades HTML viram letras acentuadas');
check(trechoDe(t).startsWith('DEFIRO o pedido'), 'o trecho pula o cabeçalho do tribunal: ' + trechoDe(t).slice(0, 40));
check(htmlParaTexto('<table><tr><td>RELATORA</td><td>:</td><td>MINISTRA A &amp; B</td></tr></table>').includes('MINISTRA A & B'), 'tabelas e &amp;');
check(!/<script/.test(htmlParaTexto('a<script>alert(1)</script>b')), 'remove script');
// prazo sugerido
const s1 = sugerirPrazo('Certifico que intimei a parte autora para recolher o sistema deferido, no prazo de quinze dias. O referido é verdade.');
check(s1 && s1.dias === 15 && s1.tipo === 'uteis', 'quinze dias por extenso');
const s2 = sugerirPrazo('concedo o prazo improrrogável de 15 (quinze) dias para juntada integral dos documentos');
check(s2 && s2.dias === 15, '15 (quinze) dias com "improrrogável"');
const s3 = sugerirPrazo('Prazo de 30 dias corridos para cumprimento voluntário da sentença proferida nos autos');
check(s3 && s3.dias === 30 && s3.tipo === 'corridos', 'dias corridos');
check(sugerirPrazo('Intime-se para manifestar em 10 (dez) dias úteis sobre o laudo apresentado nos autos').dias === 10, '"em 10 (dez) dias úteis"');
check(sugerirPrazo('Prazo de vinte e cinco dias para contestar a ação proposta pelo autor nos autos') .dias === 25, '"vinte e cinco"');
check(sugerirPrazo('Prazo de 48 horas para justificar a ausência dos presentes no ato da audiência designada') === null, 'horas não viram prazo em dias');
check(sugerirPrazo('ARQUIVOS DIGITAIS INDISPONÍVEIS (NÃO SÃO DO TIPO PÚBLICO)') === null, 'texto sem prazo');
// dados básicos do processo no texto (partes, natureza, valor da causa)
const tj = extrairDados(htmlParaTexto('Poder Judici&aacute;rio\nComarca de Morrinhos\nAutos n.:&nbsp;5593217-64.2021.8.09.0107\nNatureza:&nbsp;PROCESSO C&Iacute;VEL E DO TRABALHO -&gt; Processo de Conhecimento -&gt; Procedimento Comum C&iacute;vel\nPolo Ativo:&nbsp;Cooperativa Mista Dos Produtores De Leite De Morrinhos\nPolo Passivo:&nbsp;Osmar Junio Alves Gil\nDECIS&Atilde;O\nValor da causa: R$ 12.345,67'));
check(tj.ativo === 'Cooperativa Mista Dos Produtores De Leite De Morrinhos' && tj.passivo === 'Osmar Junio Alves Gil' && tj.natureza === 'Procedimento Comum Cível' && tj.valorCausa === 12345.67, 'TJGO: lê polo ativo, polo passivo, natureza e valor da causa: ' + JSON.stringify(tj));
const bv = extrairDados(htmlParaTexto('Rua 05, Qd. 06\nATO ORDINAT&Oacute;RIO\nA&ccedil;&atilde;o: PROCESSO C&Iacute;VEL E DO TRABALHO -&gt; Processo de Execu&ccedil;&atilde;o -&gt; Execu&ccedil;&atilde;o de T&iacute;tulo Extrajudicial\nProcesso n&ordm;: 5118774-16.2026.8.09.0017\nRequerente(s): Cooperativa Mista Dos Produtores\nRequerido(s): Beltrano de Tal; Ciclano Souza'));
check(bv.ativo === 'Cooperativa Mista Dos Produtores' && /Beltrano de Tal/.test(bv.passivo) && bv.natureza === 'Execução de Título Extrajudicial', 'Requerente(s) e Requerido(s) também valem: ' + JSON.stringify(bv));
const st = extrairDados(htmlParaTexto('<table><tr><td><b>AREsp 3307791/GO</b></td></tr><tr><td>RELATORA</td><td>:</td><td>MINISTRA MARIA ISABEL GALLOTTI</td></tr><tr><td>AGRAVANTE</td><td>:</td><td>TRANSPORTADORA NUNES FERNANDES LTDA</td></tr><tr><td>ADVOGADOS</td><td>:</td><td>MURILO FALONE ROCHA - GO049308</td></tr><tr><td>AGRAVADO</td><td>:</td><td>LÍDER VIATURAS E EQUIPAMENTOS INDUSTRIAIS LTDA</td></tr></table>'));
check(st.ativo === 'TRANSPORTADORA NUNES FERNANDES LTDA' && st.passivo === 'LÍDER VIATURAS E EQUIPAMENTOS INDUSTRIAIS LTDA', 'STJ: agravante e agravado: ' + JSON.stringify(st));
check(extrairDados('ARQUIVOS DIGITAIS INDISPONÍVEIS (NÃO SÃO DO TIPO PÚBLICO)').ativo === '' && extrairDados('Autos n.: 123\nAutor: ').passivo === '', 'texto sem partes não inventa nada');
// notificação
const n = montarNotificacoes({ itens: [], alertas: [] }, {}, { alertas: {} }, '2026-11-06', '2026-11', [{ tribunal: 'TJGO', tipo: 'Decisão', numero: '5368644-67.2026.8.09.0107' }, { tribunal: 'STJ', tipo: 'Ata', numero: '' }]);
check(n.length === 1 && /2 novas publicações/.test(n[0].titulo) && /TJGO · Decisão/.test(n[0].corpo), 'o resumo das 10h avisa as publicações novas');
check(montarNotificacoes({ itens: [], alertas: [] }, { esconder: true }, { alertas: {} }, '2026-11-06', '2026-11', [{ tipo: 'Decisão' }])[0].corpo === 'Abra o app para ver.', 'com "esconder", a notificação não mostra o conteúdo');
check(montarNotificacoes({ itens: [], alertas: [] }, {}, { alertas: {} }, '2026-11-06', '2026-11').length === 0, 'sem publicações nem vencimentos, não envia nada');

const iguais = [1, 2, 3].map(i => ({ id: String(i), processo: '57000001020268090107', data: '2026-11-06', tipo: 'Decisão', orgao: 'Vara', tribunal: 'TJGO', numero: '5700000-10.2026.8.09.0107' })).concat([{ id: '9', processo: '57000001020268090107', data: '2026-11-06', tipo: 'Ato ordinatório', orgao: 'Vara', tribunal: 'TJGO' }]);
const nIg = montarNotificacoes({ itens: [], alertas: [] }, {}, { alertas: {} }, '2026-11-06', '2026-11', iguais);
check(nIg.length === 1 && /^2 novas publicações/.test(nIg[0].titulo), 'o aviso das 10h conta publicações idênticas uma vez só: ' + nIg[0].titulo);
// leitura paginada: a fonte recusa tamanho 100 (400) e a outra "limita" a página em 5 sem avisar
const todos = Array.from({ length: 13 }, (_, i) => ({ id: 1000 + i }));
let modo = 'recusa', chamadas = 0;
const srv = http.createServer((req, res) => {
  chamadas++; const u = new URL(req.url, 'http://x'), tam = Number(u.searchParams.get('itensPorPagina')), pg = Number(u.searchParams.get('pagina'));
  const cap = modo === 'recusa' ? (tam > 5 ? 0 : 5) : 5;
  if (!cap) { res.writeHead(400); res.end('{"message":"tamanho inválido"}'); return; }
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ status: 'success', count: todos.length, items: todos.slice((pg - 1) * cap, pg * cap) }));
}).listen(0);
await new Promise(r => srv.once('listening', r));
const env = { DJEN_URL: 'http://127.0.0.1:' + srv.address().port + '/x', DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) } };
await lerCfg(env);   // só para confirmar que a leitura de config padrão funciona sem banco
for (const m of ['recusa', 'silencioso']) {
  modo = m; chamadas = 0;
  const gravados = [];
  const db = { prepare: (sql) => ({ bind: (...a) => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({}), sql, a }) }), batch: async (l) => { l.forEach(x => gravados.push(x.a)); } };
  const r = await lerDjen({ DJEN_URL: env.DJEN_URL, DB: db }, { orcamento: 30 });
  check(r.lidas === 13 && !r.porOab[0].erro && !r.porOab[0].parcial, 'lê as 13 publicações (' + m + ') em ' + chamadas + ' consultas');
}
srv.close();

// publicações guardadas antes de existir o campo "advogados": a próxima leitura refaz 30 dias uma única vez e completa
const mem = new Map();
const stm = (sql, args = []) => ({
  bind: (...a) => stm(sql, a), sql, args,
  first: async () => { const d = /SELECT dados FROM docs WHERE colecao = \? AND id = \?/.test(sql) ? mem.get(args[0] + '|' + args[1]) : null; return d ? { dados: d } : null; },
  all: async () => /id IN/.test(sql) ? { results: args.slice(1).filter(i => mem.has(args[0] + '|' + i)).map(i => ({ id: i, dados: mem.get(args[0] + '|' + i) })) } : { results: [] },
  run: async () => { if (/^INSERT/.test(sql)) mem.set(args[0] + '|' + args[1], args[2]); return {}; },
});
const db2 = { prepare: (sql) => stm(sql), batch: async (l) => { for (const x of l) await x.run(); } };
const hojeBR = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), somar = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const vistos = [];
const srv2 = http.createServer((req, res) => {
  const q = new URL(req.url, 'http://x').searchParams; vistos.push(q.get('dataDisponibilizacaoInicio'));
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ count: 1, items: [{ id: 900, data_disponibilizacao: hojeBR, siglaTribunal: 'TJGO', nomeOrgao: 'Vara', tipoDocumento: 'Decisão', numero_processo: '55932176420218090107', texto: 'DECISÃO\nDEFIRO.', destinatarios: [], destinatarioadvogados: [{ advogado: { nome: 'ALCIONE CELLA', numero_oab: '23852', uf_oab: 'SC' } }, { advogado: { nome: 'HYGOR LIMA ANDRADE', numero_oab: '60456', uf_oab: 'GO' } }] }] }));
}).listen(0);
await new Promise(r => srv2.once('listening', r));
const env2 = { DJEN_URL: 'http://127.0.0.1:' + srv2.address().port + '/x', DB: db2 };
mem.set('_djen|config', JSON.stringify({ oabs: [{ id: 'o1', nome: 'Hygor', numero: '60456', uf: 'GO', ativo: true, escopo: 'tudo', avisar: true, ultima: hojeBR }], ultimaLeitura: null }));
mem.set('_pub|900', JSON.stringify({ id: '900', data: hojeBR, oabs: ['o1'], lida: true, notificada: true, trecho: 'DEFIRO.' }));
await lerDjen(env2);
let pub900 = JSON.parse(mem.get('_pub|900')), cfg2 = JSON.parse(mem.get('_djen|config'));
check(vistos[0] === somar(hojeBR, -30), 'a primeira leitura depois da atualização volta 30 dias (pedido: ' + vistos[0] + ')');
check(pub900.advs && pub900.advs.length === 2 && pub900.advs[0].o === '23852/SC' && pub900.lida === true && pub900.notificada === true, 'a publicação antiga ganha os advogados sem perder "lida" nem virar aviso');
check(cfg2.advsOk === true, 'a atualização é registrada para não repetir');
await lerDjen(env2);
check(vistos[1] === somar(hojeBR, -2), 'as leituras seguintes voltam só 2 dias (pedido: ' + vistos[1] + ')');
srv2.close();

// DJEN respondendo 403/5xx: repete com pausa, continua se identificando como Horus, mostra o motivo e relê mais tarde
{
  let pedidos = 0, uas = [], modo403 = 'sempre';
  const srv3 = http.createServer((req, res) => {
    pedidos++; uas.push(req.headers['user-agent'] + '|' + (req.headers.origin || '') + '|' + (req.headers.referer || ''));
    if (modo403 === 'sempre' || (modo403 === 'uma' && pedidos === 1)) { res.writeHead(403, { 'content-type': 'text/html' }); res.end('<html><body><h1>Access denied</h1> bloqueado pelo firewall</body></html>'); return; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ count: 1, items: [{ id: 700, data_disponibilizacao: hojeBR, siglaTribunal: 'TJGO', nomeOrgao: 'Vara', tipoDocumento: 'Decisão', numero_processo: '55932176420218090107', texto: 'DECISÃO\nDEFIRO.', destinatarios: [], destinatarioadvogados: [] }] }));
  }).listen(0);
  await new Promise(r => srv3.once('listening', r));
  const url3 = 'http://127.0.0.1:' + srv3.address().port + '/x';
  mem.clear(); mem.set('_djen|config', JSON.stringify({ oabs: [{ id: 'o1', nome: 'Hygor', numero: '60456', uf: 'GO', ativo: true, escopo: 'tudo', avisar: true }], ultimaLeitura: null, advsOk: true }));
  const e3 = { DJEN_URL: url3, DB: db2, DJEN_ESPERA_MS: '0' };
  let r3 = await lerDjen(e3);
  check(pedidos === 3 && r3.porOab[0].erro.includes('403') && r3.porOab[0].erro.includes('Access denied') && /3 tentativas/.test(r3.porOab[0].erro), 'DJEN recusando (403): tenta 3 vezes e guarda o motivo, com o que o DJEN respondeu: ' + r3.porOab[0].erro);
  check(uas.every(u => u === 'Horus/1.0||'), 'o app continua se identificando como Horus em todas as tentativas (não finge ser navegador)');
  check(JSON.parse(mem.get('_djen|config')).oabs[0].erro.includes('403'), 'o erro fica guardado na OAB (aparece no aviso da tela)');
  pedidos = 0; modo403 = 'uma';
  r3 = await lerDjen(e3);
  check(pedidos >= 2 && !r3.porOab[0].erro && r3.novas === 1, 'um 403 passageiro é superado na segunda tentativa');
  // releitura das 12h/14h/16h/18h
  pedidos = 0; modo403 = 'nunca'; mem.set('_djen|config', JSON.stringify({ oabs: [{ id: 'o1', nome: 'Hygor', numero: '60456', uf: 'GO', ativo: true, escopo: 'tudo', avisar: true, ultima: hojeBR }], ultimaLeitura: null, advsOk: true }));
  check(await relerSePreciso(e3) === null && pedidos === 0, 'releitura: se a leitura das 10h deu certo, não consulta de novo');
  mem.set('_djen|config', JSON.stringify({ oabs: [{ id: 'o1', nome: 'Hygor', numero: '60456', uf: 'GO', ativo: true, escopo: 'tudo', avisar: true, ultima: somar(hojeBR, -1), erro: 'O DJEN respondeu 403' }], ultimaLeitura: null, advsOk: true }));
  const rr = await relerSePreciso(e3);
  check(rr && pedidos >= 1 && !rr.porOab[0].erro && JSON.parse(mem.get('_djen|config')).oabs[0].ultima === hojeBR, 'releitura: se a leitura das 10h falhou, lê de novo e marca como lida hoje');
  srv3.close();
}
// "possivelmente encerrado": o que a publicação diz sobre o fim do processo
{
  const m = (t) => motivoEncerra(t);
  check(m('Determino o arquivamento definitivo dos autos.') === 'arquivamento' && m('Cumpridas as formalidades, arquivem-se.') === 'arquivamento', 'encerrado: arquivamento / arquivem-se');
  check(m('Certifique-se o trânsito em julgado e dê-se baixa definitiva.') === 'baixa definitiva' || m('Certifique-se o trânsito em julgado.') === 'trânsito em julgado', 'encerrado: baixa definitiva e trânsito em julgado');
  check(m('Julgo extinto o processo, nos termos do art. 485.') === 'extinção' && m('Declaro extinta a execução.') === 'extinção', 'encerrado: extinção');
  check(m('ARQUIVOS DIGITAIS INDISPONÍVEIS (NÃO SÃO DO TIPO PÚBLICO)') === '' && m('Intime-se a parte para se manifestar em 15 dias sobre os cálculos.') === '', 'não confunde “arquivos” nem uma intimação comum com encerramento');
}
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
