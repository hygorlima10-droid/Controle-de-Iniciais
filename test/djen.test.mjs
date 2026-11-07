// Testes do que roda sozinho no Node (sem navegador): limpeza do texto, trecho, prazo sugerido e leitura paginada do DJEN.
//   node test/djen.test.mjs
import http from 'node:http';
import { htmlParaTexto, trechoDe, sugerirPrazo, lerCfg, lerDjen } from '../src/djen.js';
import { montarNotificacoes } from '../src/index.js';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

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
// notificação
const n = montarNotificacoes({ itens: [], alertas: [] }, {}, { alertas: {} }, '2026-11-06', '2026-11', [{ tribunal: 'TJGO', tipo: 'Decisão', numero: '5368644-67.2026.8.09.0107' }, { tribunal: 'STJ', tipo: 'Ata', numero: '' }]);
check(n.length === 1 && /2 novas publicações/.test(n[0].titulo) && /TJGO · Decisão/.test(n[0].corpo), 'o resumo das 10h avisa as publicações novas');
check(montarNotificacoes({ itens: [], alertas: [] }, { esconder: true }, { alertas: {} }, '2026-11-06', '2026-11', [{ tipo: 'Decisão' }])[0].corpo === 'Abra o app para ver.', 'com "esconder", a notificação não mostra o conteúdo');
check(montarNotificacoes({ itens: [], alertas: [] }, {}, { alertas: {} }, '2026-11-06', '2026-11').length === 0, 'sem publicações nem vencimentos, não envia nada');

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
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
