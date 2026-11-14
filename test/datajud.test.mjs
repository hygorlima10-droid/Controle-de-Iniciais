// Testa a consulta ao DataJud (sem navegador): tribunal pelo número, resumo dos dados e erros (lento, 429, chave recusada).
//   node test/datajud.test.mjs
import http from 'node:http';
import { tribunalDoNumero, dataDoDatajud, resumir, consultarDatajud } from '../src/datajud.js';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

check(tribunalDoNumero('59894499720268090169').alias === 'tjgo', 'o .8.09. é o TJGO');
check(tribunalDoNumero('00000000020264013400').alias === 'trf1' && tribunalDoNumero('00000000020265180001').alias === 'trt18', 'federal (4.01) e trabalho (5.18)');
check(tribunalDoNumero('00000000020268260100').alias === 'tjsp' && tribunalDoNumero('00000000020268070001').alias === 'tjdft' && tribunalDoNumero('00000000020268270001').alias === 'tjto', 'SP, DF e TO');
check(tribunalDoNumero('00000000020266090001').alias === 'tre-go' && tribunalDoNumero('00000000020263000001').alias === 'stj', 'eleitoral e STJ');
check(tribunalDoNumero('1234') === null && tribunalDoNumero('00000000020268990001') === null, 'número curto ou tribunal inexistente: sem endereço');
check(dataDoDatajud('20260930235807', '2026-11-07') === '2026-09-30' && dataDoDatajud('20270201000000', '2026-11-07') === '' && dataDoDatajud('', '2026-11-07') === '', 'data do DataJud vira AAAA-MM-DD e ignora data no futuro');

const hits = [
  { _source: { grau: 'G2', tribunal: 'TJGO', classe: { nome: 'Apelação' }, assuntos: [{ nome: 'Dano Moral' }], orgaoJulgador: { nome: '2ª Câmara Cível' }, movimentos: [{ nome: 'Recebimento', dataHora: '2026-10-20T10:00:00.000Z' }] } },
  { _source: { grau: 'G1', tribunal: 'TJGO', numeroProcesso: '1', dataAjuizamento: '20250310101010', nivelSigilo: 0, classe: { nome: 'Procedimento Comum Cível' }, assuntos: [{ nome: 'Indenização' }, { nome: 'Dano Moral' }], orgaoJulgador: { nome: '1ª Vara Cível de Morrinhos' }, dataHoraUltimaAtualizacao: '2026-10-11T17:55:33.431000Z', movimentos: [{ nome: 'Distribuição', dataHora: '2025-03-10T10:00:00.000Z' }, { nome: 'Citação', dataHora: '2025-04-01T10:00:00.000Z' }] } },
];
const r = resumir(hits, '2026-11-07');
check(r.grau === 'G1' && r.classe === 'Procedimento Comum Cível' && r.orgao === '1ª Vara Cível de Morrinhos', 'o resumo usa o 1º grau como principal');
check(r.ajuizamento === '2025-03-10' && r.assuntos.join('|') === 'Indenização|Dano Moral', 'data de ajuizamento e assuntos sem repetir');
check(r.ultimoMovimento.nome === 'Recebimento' && r.ultimoMovimento.data === '2026-10-20' && r.graus.join() === 'G1,G2', 'último movimento entre todos os graus');
check(resumir([], '2026-11-07') === null, 'sem resultado: nulo');

// servidor de mentira
let modo = 'ok', ultimo = null;
const srv = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => b += c); req.on('end', () => {
    ultimo = { url: req.url, auth: req.headers.authorization, corpo: b ? JSON.parse(b) : null };
    if (modo === 'lento') return; // nunca responde
    if (modo === '429') { res.writeHead(429, { 'content-type': 'application/json' }); return res.end('{"status":429}'); }
    if (modo === '401') { res.writeHead(401); return res.end('{}'); }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ hits: { hits: modo === 'vazio' ? [] : hits }, _shards: { failed: modo === 'parcial' ? 1 : 0 } }));
  });
}).listen(8891);
await new Promise((ok) => srv.on('listening', ok));
const env = { DATAJUD_URL: 'http://127.0.0.1:8891', DATAJUD_KEY: 'chave-teste', DATAJUD_TEMPO_MS: 800 };
let x = await consultarDatajud(env, '5989449-97.2026.8.09.0169');
check(x.ok && x.achou && x.tribunal === 'TJGO' && x.dados.classe === 'Procedimento Comum Cível', 'consulta pelo número formatado acha o processo');
check(ultimo.url === '/api_publica_tjgo/_search' && ultimo.auth === 'APIKey chave-teste' && ultimo.corpo.query.term.numeroProcesso === '59894499720268090169', 'usa o endereço do tribunal, a chave no formato APIKey e só os dígitos');
modo = 'vazio'; x = await consultarDatajud(env, '59894499720268090169');
check(x.ok && x.achou === false, 'processo que o DataJud ainda não tem: ok, mas não achou');
modo = 'parcial'; x = await consultarDatajud(env, '59894499720268090169');
check(x.ok && x.achou && x.parcial === true, 'resposta parcial (parte dos servidores falhou) é sinalizada');
modo = '429'; x = await consultarDatajud(env, '59894499720268090169');
check(!x.ok && /sobrecarregado/.test(x.motivo), 'erro 429: mensagem de sobrecarga');
modo = '401'; x = await consultarDatajud(env, '59894499720268090169');
check(!x.ok && /chave/.test(x.motivo), 'chave recusada: avisa que o CNJ pode ter trocado');
modo = 'lento'; const t0 = Date.now(); x = await consultarDatajud(env, '59894499720268090169');
check(!x.ok && /demorou/.test(x.motivo) && Date.now() - t0 < 3000, 'demora: desiste no tempo máximo e explica');
x = await consultarDatajud(env, '123');
check(!x.ok && /20 dígitos/.test(x.motivo), 'número fora do padrão: explica');
srv.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
