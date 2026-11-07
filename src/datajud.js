/* ============================================================
   DataJud (CNJ): dados da capa de um processo a partir do número CNJ
   - o número já diz o tribunal (J.TR): o app escolhe sozinho o endereço certo (um por tribunal)
   - traz: tribunal, grau, classe, assuntos, vara/órgão, data de ajuizamento, sigilo e último movimento
   - NÃO traz partes, valor da causa, honorários nem endereços (a API pública não tem)
   - a chave é a chave pública que o CNJ publica na wiki; pode mudar a qualquer momento (DATAJUD_KEY no Worker troca)
   - a API é lenta e instável (40 a 60 s, às vezes 429 ou 504): por isso a consulta é "se der, deu"
   ============================================================ */
export const DATAJUD = 'https://api-publica.datajud.cnj.jus.br';
export const DATAJUD_CHAVE = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
const TEMPO_MAX_MS = 58000;
const UF = ['ac', 'al', 'ap', 'am', 'ba', 'ce', 'dft', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'se', 'sp', 'to'];   // 01..27, na ordem do CNJ
const MIL_EST = { '13': 'tjmmg', '21': 'tjmrs', '26': 'tjmsp' };

/* alias do endpoint (api_publica_<alias>) e sigla, a partir dos 20 dígitos */
export function tribunalDoNumero(dig) {
  const n = String(dig || '').replace(/\D/g, '');
  if (n.length !== 20) return null;
  const j = n[13], tr = n.slice(14, 16), i = parseInt(tr, 10);
  let alias = '';
  if (j === '8' && i >= 1 && i <= 27) alias = 'tj' + UF[i - 1];
  else if (j === '4' && i >= 1 && i <= 6) alias = 'trf' + i;
  else if (j === '5') alias = i === 0 ? 'tst' : (i <= 24 ? 'trt' + i : '');
  else if (j === '6') alias = i === 0 ? 'tse' : (i <= 27 ? 'tre-' + UF[i - 1] : '');
  else if (j === '3' && i === 0) alias = 'stj';
  else if (j === '7' && i === 0) alias = 'stm';
  else if (j === '9') alias = MIL_EST[tr] || '';
  if (!alias) return null;
  return { alias, sigla: alias.toUpperCase() };
}

/* "20260930235807" -> "2026-09-30" (ignora datas no futuro, que existem por erro na base) */
export function dataDoDatajud(v, hoje) {
  const s = String(v || '');
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s);
  if (!m) return '';
  const iso = m[1] + '-' + m[2] + '-' + m[3];
  return iso > (hoje || new Date().toISOString().slice(0, 10)) ? '' : iso;
}

/* junta os resultados (o mesmo processo pode ter 1º grau, 2º grau, juizado) e devolve um resumo enxuto */
export function resumir(hits, hoje) {
  const docs = (hits || []).map((h) => h && h._source).filter(Boolean);
  if (!docs.length) return null;
  const ordem = { G1: 0, JE: 1, G2: 2, TR: 3 };
  docs.sort((a, b) => (ordem[a.grau] ?? 9) - (ordem[b.grau] ?? 9));
  const p = docs[0];
  const movs = [].concat(...docs.map((d) => (Array.isArray(d.movimentos) ? d.movimentos : []))).filter((m) => m && m.dataHora).sort((a, b) => String(b.dataHora).localeCompare(String(a.dataHora)));
  const ult = movs[0];
  const assuntos = [...new Set([].concat(...docs.map((d) => (Array.isArray(d.assuntos) ? d.assuntos : []))).map((a) => String(a && a.nome || '').trim()).filter(Boolean))];
  return {
    tribunal: String(p.tribunal || '').slice(0, 12),
    grau: String(p.grau || ''),
    graus: docs.map((d) => String(d.grau || '')).filter(Boolean),
    classe: String((p.classe && p.classe.nome) || '').slice(0, 120),
    assuntos: assuntos.slice(0, 5).map((a) => a.slice(0, 120)),
    orgao: String((p.orgaoJulgador && p.orgaoJulgador.nome) || '').slice(0, 140),
    ajuizamento: dataDoDatajud(p.dataAjuizamento, hoje),
    sigilo: Number(p.nivelSigilo) || 0,
    ultimoMovimento: ult ? { nome: String(ult.nome || '').slice(0, 120), data: String(ult.dataHora).slice(0, 10) } : null,
    atualizadoEm: String(p.dataHoraUltimaAtualizacao || '').slice(0, 10),
  };
}

export async function consultarDatajud(env, numero) {
  const dig = String(numero || '').replace(/\D/g, '');
  const t = tribunalDoNumero(dig);
  if (!t) return { ok: false, motivo: 'Este número não é do padrão CNJ de 20 dígitos (ou o tribunal não está no DataJud).' };
  const base = (env && env.DATAJUD_URL) || DATAJUD, chave = (env && env.DATAJUD_KEY) || DATAJUD_CHAVE;
  const corpo = { size: 5, _source: ['numeroProcesso', 'tribunal', 'grau', 'dataAjuizamento', 'classe', 'assuntos', 'orgaoJulgador', 'nivelSigilo', 'movimentos', 'dataHoraUltimaAtualizacao'], query: { term: { numeroProcesso: dig } } };
  let r;
  try {
    r = await fetch(base + '/api_publica_' + t.alias + '/_search', { method: 'POST', headers: { authorization: 'APIKey ' + chave, 'content-type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(Number((env && env.DATAJUD_TEMPO_MS) || TEMPO_MAX_MS)) });
  } catch (e) {
    const tempo = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return { ok: false, tribunal: t.sigla, motivo: tempo ? 'O DataJud demorou demais para responder (' + t.sigla + '). Ele costuma ficar lento; tente de novo daqui a pouco.' : 'Não consegui falar com o DataJud agora. Tente de novo daqui a pouco.' };
  }
  if (r.status === 401 || r.status === 403) return { ok: false, tribunal: t.sigla, motivo: 'O DataJud recusou a chave de acesso. O CNJ pode ter trocado a chave pública (ela fica na wiki do DataJud).' };
  if (r.status === 429 || r.status >= 500) return { ok: false, tribunal: t.sigla, motivo: 'O DataJud está sobrecarregado agora (' + r.status + '). Tente de novo daqui a pouco.' };
  const j = await r.json().catch(() => null);
  if (r.status !== 200 || !j) return { ok: false, tribunal: t.sigla, motivo: 'O DataJud respondeu ' + r.status + '.' };
  const hits = j.hits && Array.isArray(j.hits.hits) ? j.hits.hits : [];
  const falhas = j._shards && j._shards.failed ? j._shards.failed : 0;
  if (!hits.length) return { ok: true, achou: false, tribunal: t.sigla, parcial: falhas > 0 };
  return { ok: true, achou: true, tribunal: t.sigla, dados: resumir(hits), parcial: falhas > 0 };
}

export async function datajudRotas(request, env, partes) {
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (partes[1] === 'processo' && request.method === 'GET') {
    const n = (new URL(request.url).searchParams.get('numero') || '').replace(/\D/g, '');
    if (n.length !== 20) return json({ error: { code: 'invalid', message: 'Número de processo inválido (são 20 dígitos).' } }, 400);
    return json(await consultarDatajud(env, n));
  }
  return json({ error: { code: 'not_found', message: 'Rota não encontrada.' } }, 404);
}
