// Testes do que roda sozinho no Node: leitura dos dados do IBGE (SINAPI) e do Banco Central (INCC) e a busca/guarda no banco.
//   node test/indices.test.mjs
import http from 'node:http';
import { lerSinapi, lerIncc, buscarIndices, indicesAtuais, lerIndices } from '../src/indices.js';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const L = (v, c, m) => ({ D2C: String(v), D3C: m, V: String(c) });
const cab = { D2C: 'Variável (Código)' };

// SIDRA: uma linha por variável e mês
{
  const l = lerSinapi([cab, L(48, 2025.78, '202610'), L(2119, 1172.09, '202610'), L(2120, 853.69, '202610'), L(48, 2023.62, '202609'), L(2119, 1169.93, '202609'), L(2120, 853.69, '202609')]);
  check(l.length === 2 && l[0].mes === '2026-09' && l[1].mes === '2026-10' && l[1].total === 2025.78 && l[1].mat === 1172.09 && l[1].mo === 853.69, 'SINAPI: junta total, materiais e mão de obra por mês, em ordem');
  check(lerSinapi([cab, L(48, 2000, '202610'), L(2119, 1000, '202610')]).length === 0, 'SINAPI: mês incompleto (sem mão de obra) é descartado');
  check(lerSinapi([cab, L(48, 2000, '202610'), L(2119, 1500, '202610'), L(2120, 1500, '202610')]).length === 0, 'SINAPI: mês em que materiais + mão de obra não fecham com o total é descartado');
  check(lerSinapi([cab, L(48, '...', '202610'), L(48, 0, '202611'), L(7, 5, '202612'), L(48, 5, 'x')]).length === 0 && lerSinapi(null).length === 0 && lerSinapi('lixo').length === 0, 'SINAPI: valor vazio, zero, variável desconhecida ou lixo não entram');
}
// BCB
{
  const l = lerIncc([{ data: '01/10/2026', valor: '0.35' }, { data: '01/09/2026', valor: '0.25' }, { data: 'x', valor: '1' }, { data: '01/08/2026', valor: 'abc' }, { data: '01/07/2026', valor: '55' }]);
  check(l.length === 2 && l[0].mes === '2026-09' && l[1].mes === '2026-10' && l[1].pct === 0.35, 'INCC: lê mês e variação, em ordem; linha ruim ou variação absurda é ignorada');
  check(lerIncc({ erro: 1 }).length === 0, 'INCC: resposta que não é lista não derruba');
}
// busca e guarda: banco e fontes de mentira
{
  const docs = new Map();
  const env = { DB: { prepare(sql) { return { bind(...a) { return { async first() { const r = docs.get(a[0] + '|' + a[1]); return r ? { dados: r } : null; }, async run() { docs.set(a[0] + '|' + a[1], a[2]); return {}; } }; } }; } } };
  let modo = 'ok', pedidos = 0;
  const srv = http.createServer((q, r) => {
    pedidos++; if (modo === 'erro') { r.statusCode = 500; return r.end('x'); }
    r.setHeader('content-type', 'application/json');
    if (q.url.startsWith('/values/t/2296/n3/52/')) return r.end(JSON.stringify([cab, L(48, 2000, '202610'), L(2119, 1100, '202610'), L(2120, 900, '202610'), L(48, 1990, '202609'), L(2119, 1095, '202609'), L(2120, 895, '202609')]));
    if (q.url.includes('bcdata.sgs.192')) return r.end(JSON.stringify([{ data: '01/09/2026', valor: '0.2' }, { data: '01/10/2026', valor: '0.3' }]));
    r.statusCode = 404; r.end('{}');
  });
  await new Promise((ok) => srv.listen(8893, '127.0.0.1', ok));
  env.SIDRA_URL = 'http://127.0.0.1:8893'; env.BCB_URL = 'http://127.0.0.1:8893';
  let d = await buscarIndices(env);
  check(d.sinapi.length === 2 && d.incc.length === 2 && !d.falhou && !d.erros.sinapi && !d.erros.incc, 'busca: guarda SINAPI e INCC');
  check((await lerIndices(env)).sinapi[1].total === 2000, 'busca: o que foi buscado fica no banco');
  const n = pedidos; await indicesAtuais(env, false);
  check(pedidos === n, 'sem forçar, dados de hoje não são buscados de novo');
  await indicesAtuais(env, true);
  check(pedidos > n, 'forçando, busca de novo');
  modo = 'erro'; d = await buscarIndices(env);
  check(d.falhou && d.erros.sinapi && d.erros.incc && d.sinapi.length === 2 && d.incc.length === 2, 'fonte fora do ar: guarda o erro e MANTÉM os valores que já tinha');
  const m = pedidos; await indicesAtuais(env, false);
  check(pedidos === m, 'depois de uma falha, não fica tentando a cada abertura (espera ~1 hora)');
  srv.close();
}
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
