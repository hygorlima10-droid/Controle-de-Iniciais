/* Índices oficiais de custo da construção, buscados sozinhos (usados na Construção › Calculadora).
   - SINAPI (IBGE/Caixa), tabela 2296 do SIDRA: custo médio do m² em Goiás, com a parte de materiais e a de mão de obra, por mês.
   - INCC (FGV), série 192 do Banco Central: variação mensal do índice nacional de custo da construção.
   Guardado em docs('_indices', 'construcao'); atualizado pelo robô diário (cron) e, na hora, quando alguém abre a calculadora com os dados velhos.
   Cada fonte falha sozinha: se uma não responde, a outra segue e o que já estava guardado é mantido. Só o proprietário lê (a calculadora é dele). */
const COL = '_indices', ID = 'construcao';
const TTL_OK = 20 * 3600e3, TTL_ERRO = 3600e3, GUARDAR = 48;   // meses guardados de cada série
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const VARS = { 48: 'total', 2119: 'mat', 2120: 'mo' };

export async function lerIndices(env) {
  const r = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(COL, ID).first();
  return r ? JSON.parse(r.dados) : { sinapi: [], incc: [] };
}
const gravar = (env, d) => env.DB.prepare('INSERT INTO docs (colecao, id, dados, atualizado) VALUES (?, ?, ?, ?) ON CONFLICT(colecao, id) DO UPDATE SET dados = excluded.dados, atualizado = excluded.atualizado').bind(COL, ID, JSON.stringify(d), Date.now()).run();
const get = async (url) => { const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { accept: 'application/json' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };

/* SIDRA devolve uma linha por variável e mês: {D2C: variável, D3C: "202610", V: "2025.78"} */
export function lerSinapi(linhas) {
  const por = {};
  for (const l of Array.isArray(linhas) ? linhas.slice(1) : []) {
    const k = VARS[l && l.D2C], mes = String((l && l.D3C) || ''), v = Number(l && l.V);
    if (!k || !/^\d{6}$/.test(mes) || !(v > 0)) continue;
    (por[mes] = por[mes] || {})[k] = v;
  }
  return Object.keys(por).sort().map((m) => ({ mes: m.slice(0, 4) + '-' + m.slice(4), ...por[m] }))
    .filter((x) => x.total > 0 && x.mat > 0 && x.mo > 0 && Math.abs(x.mat + x.mo - x.total) <= x.total * 0.02);   // descarta linha incompleta ou incoerente
}
/* BCB devolve {data: "01/10/2026", valor: "0.35"} */
export function lerIncc(linhas) {
  const l = [];
  for (const x of Array.isArray(linhas) ? linhas : []) {
    const m = /^\d{2}\/(\d{2})\/(\d{4})$/.exec((x && x.data) || ''), v = Number(x && x.valor);
    if (m && isFinite(v) && v > -10 && v < 10) l.push({ mes: m[2] + '-' + m[1], pct: v });
  }
  return l.sort((a, b) => a.mes.localeCompare(b.mes));
}
const mesclar = (antes, novos) => { const m = new Map((antes || []).map((x) => [x.mes, x])); for (const x of novos) m.set(x.mes, x); return [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes)).slice(-GUARDAR); };

export async function buscarIndices(env) {
  const d = await lerIndices(env), agora = new Date().toISOString(), erros = {};
  const sidra = (env.SIDRA_URL || 'https://apisidra.ibge.gov.br').replace(/\/$/, ''), bcb = (env.BCB_URL || 'https://api.bcb.gov.br').replace(/\/$/, '');
  try {
    const l = lerSinapi(await get(sidra + '/values/t/2296/n3/52/v/48,2119,2120/p/last%20' + GUARDAR + '?formato=json'));
    if (!l.length) throw new Error('resposta sem dados');
    d.sinapi = mesclar(d.sinapi, l); d.sinapiEm = agora;
  } catch (e) { erros.sinapi = String((e && e.message) || e).slice(0, 120); }
  try {
    const l = lerIncc(await get(bcb + '/dados/serie/bcdata.sgs.192/dados/ultimos/20?formato=json'));
    if (!l.length) throw new Error('resposta sem dados');
    d.incc = mesclar(d.incc, l); d.inccEm = agora;
  } catch (e) { erros.incc = String((e && e.message) || e).slice(0, 120); }
  d.sinapi = d.sinapi || []; d.incc = d.incc || [];
  d.tentativaEm = agora; d.erros = erros; d.falhou = !!(erros.sinapi && erros.incc);
  await gravar(env, d);
  return d;
}

const precisa = (d) => { const t = Date.parse(d.tentativaEm || ''); if (!t) return true; return Date.now() - t > (d.erros && d.erros.sinapi ? TTL_ERRO : TTL_OK); };
export async function indicesAtuais(env, forcar) {
  const d = await lerIndices(env);
  if (forcar || precisa(d)) { try { return await buscarIndices(env); } catch (e) { console.error('índices', e); } }
  return d;
}
export async function indicesRotas(request, env, partes) {
  if (request.method !== 'GET') return json({ error: 'method', mensagem: 'Só leitura.' }, 405);
  const forcar = new URL(request.url).searchParams.get('atualizar') === '1';
  return json(await indicesAtuais(env, forcar));
}
