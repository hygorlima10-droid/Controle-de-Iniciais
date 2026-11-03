/* Servidor do Controle Jurídico e Financeiro (Cloudflare Worker + banco D1).
   - Todo acesso (página e API) exige login do Cloudflare Access (só o seu e-mail).
   - A API imita o "banco" que o app já usava dentro do Claude. */

const NOME = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_DOC = 900 * 1024;        // bytes por registro
const MAX_LISTA = 1000;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);

/* ---------- login (Cloudflare Access) ---------- */
let jwksCache = { em: 0, chaves: null };
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
async function chavesAccess(env) {
  if (jwksCache.chaves && Date.now() - jwksCache.em < 3600e3) return jwksCache.chaves;
  const r = await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error('certs');
  jwksCache = { em: Date.now(), chaves: (await r.json()).keys || [] };
  return jwksCache.chaves;
}
export async function verificarLogin(request, env) {
  if (env.ALLOW_NO_AUTH === '1') return { ok: true, email: 'dev@local' };      // só para testar no computador
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { ok: false, status: 503, msg: 'Login ainda não configurado (ACCESS_TEAM_DOMAIN e ACCESS_AUD).' };
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return { ok: false, status: 401, msg: 'Entre pelo login.' };
  try {
    const [h, p, s] = token.split('.');
    const cab = JSON.parse(new TextDecoder().decode(b64u(h)));
    const pay = JSON.parse(new TextDecoder().decode(b64u(p)));
    if (cab.alg !== 'RS256') throw new Error('alg');
    const jwk = (await chavesAccess(env)).find((k) => k.kid === cab.kid);
    if (!jwk) throw new Error('kid');
    const chave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const certo = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', chave, b64u(s), new TextEncoder().encode(h + '.' + p));
    const aud = Array.isArray(pay.aud) ? pay.aud : [pay.aud];
    if (!certo || !aud.includes(env.ACCESS_AUD) || pay.iss !== 'https://' + env.ACCESS_TEAM_DOMAIN || pay.exp * 1000 < Date.now()) throw new Error('invalido');
    if (env.EMAIL_PERMITIDO && String(pay.email || '').toLowerCase() !== env.EMAIL_PERMITIDO.toLowerCase()) return { ok: false, status: 403, msg: 'Este e-mail não tem acesso.' };
    return { ok: true, email: pay.email };
  } catch (e) {
    return { ok: false, status: 401, msg: 'Login inválido.' };
  }
}

/* ---------- API do banco ---------- */
async function api(request, env, partes) {
  // partes: ['db', colecao, id?]  |  ['backup']
  const metodo = request.method;
  if (partes[0] === 'backup' && metodo === 'GET') {
    const { results } = await env.DB.prepare('SELECT colecao, id, dados FROM docs ORDER BY colecao, id').all();
    return json({ versao: 1, exportadoEm: new Date().toISOString(), docs: results.map((r) => ({ colecao: r.colecao, id: r.id, dados: JSON.parse(r.dados) })) });
  }
  if (partes[0] === 'restaurar' && metodo === 'POST') {
    const corpo = await request.json().catch(() => null);
    if (!corpo || !Array.isArray(corpo.docs)) return erro(400, 'invalid', 'Arquivo de backup inválido.');
    const stmts = [];
    const agora = Date.now();
    for (const d of corpo.docs) {
      if (!NOME.test(d.colecao || '') || !NOME.test(d.id || '') || typeof d.dados !== 'object' || d.dados === null) continue;
      stmts.push(env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(d.colecao, d.id, JSON.stringify(d.dados), agora));
    }
    for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
    return json({ ok: true, importados: stmts.length });
  }
  if (partes[0] !== 'db' || !partes[1] || !NOME.test(partes[1])) return erro(404, 'not_found', 'Não encontrado.');
  const colecao = partes[1], id = partes[2];
  if (id !== undefined && !NOME.test(id)) return erro(400, 'invalid', 'Identificador inválido.');

  if (!id && metodo === 'GET') {
    const lim = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('limit') || '1000', 10) || 1000, 1), MAX_LISTA);
    const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ? ORDER BY id LIMIT ?').bind(colecao, lim).all();
    return json({ docs: results.map((r) => ({ id: r.id, data: JSON.parse(r.dados) })) });
  }
  if (!id && metodo === 'POST') {
    const dados = await lerDoc(request); if (dados instanceof Response) return dados;
    const novo = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    await gravar(env, colecao, novo, dados);
    return json({ id: novo });
  }
  if (id && metodo === 'PUT') {
    const dados = await lerDoc(request); if (dados instanceof Response) return dados;
    await gravar(env, colecao, id, dados);
    return json({ ok: true });
  }
  if (id && metodo === 'DELETE') {
    await env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(colecao, id).run();
    return json({ ok: true });
  }
  return erro(405, 'method', 'Método não permitido.');
}
async function lerDoc(request) {
  const txt = await request.text();
  if (txt.length > MAX_DOC) return erro(413, 'quota_exceeded', 'Registro grande demais.');
  let dados; try { dados = JSON.parse(txt); } catch (e) { return erro(400, 'invalid', 'JSON inválido.'); }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return erro(400, 'invalid', 'O registro precisa ser um objeto.');
  return dados;
}
const gravar = (env, colecao, id, dados) =>
  env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(colecao, id, JSON.stringify(dados), Date.now()).run();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const login = await verificarLogin(request, env);
    if (!login.ok) return new Response(login.msg, { status: login.status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (url.pathname.startsWith('/api/')) {
      try { return await api(request, env, url.pathname.slice(5).split('/').filter(Boolean)); }
      catch (e) { console.error(e); return erro(500, 'server', 'Erro no servidor.'); }
    }
    return env.ASSETS.fetch(request);
  },
};
