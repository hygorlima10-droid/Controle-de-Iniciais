/* Servidor do Controle Jurídico e Financeiro (Cloudflare Worker + banco D1).
   - Todo acesso (página e API) exige login com senha (segredo SENHA).
   - A API imita o "banco" que o app já usava dentro do Claude. */

import { configurado as pluggyOk, diagnostico as pluggyDiag, sincronizar as pluggySinc } from './pluggy.js';

const NOME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;   // nomes que começam com _ são reservados ao sistema
const MAX_DOC = 900 * 1024;        // bytes por registro
const MAX_LISTA = 1000;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);

/* ---------- login com senha ---------- */
const DIAS_SESSAO = 30, MAX_FALHAS = 5, BLOQUEIO_MS = 15 * 60e3;
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const sha256 = (txt) => crypto.subtle.digest('SHA-256', enc.encode(txt));
async function chaveSessao(env) { return crypto.subtle.importKey('raw', await sha256('sessao-v1:' + env.SENHA), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
export async function criarSessao(env) {
  const corpo = b64u(enc.encode(JSON.stringify({ exp: Date.now() + DIAS_SESSAO * 864e5 })));
  const ass = b64u(await crypto.subtle.sign('HMAC', await chaveSessao(env), enc.encode(corpo)));
  return corpo + '.' + ass;
}
async function sessaoValida(request, env) {
  const m = /(?:^|;\s*)sessao=([^;]+)/.exec(request.headers.get('cookie') || '');
  if (!m) return false;
  const [corpo, ass] = m[1].split('.');
  if (!corpo || !ass) return false;
  try {
    if (!(await crypto.subtle.verify('HMAC', await chaveSessao(env), deB64u(ass), enc.encode(corpo)))) return false;
    return JSON.parse(new TextDecoder().decode(deB64u(corpo))).exp > Date.now();
  } catch (e) { return false; }
}
async function senhaConfere(env, digitada) {   // comparação de tamanho fixo (não vaza a senha pelo tempo)
  const a = new Uint8Array(await sha256('senha:' + env.SENHA)), b = new Uint8Array(await sha256('senha:' + digitada));
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
async function lerTent(env, chave) {
  const r = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind('_sistema', chave).first();
  return r ? JSON.parse(r.dados) : { n: 0, ate: 0 };
}
const gravarTent = (env, chave, v) => gravar(env, '_sistema', chave, v);
const limparTent = (env, chave) => env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind('_sistema', chave).run();

const PAGINA = (msg) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrar</title><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f4f5;font:16px -apple-system,BlinkMacSystemFont,sans-serif;color:#18181b}
form{background:#fff;border-radius:20px;padding:28px 24px;width:min(360px,90vw);box-shadow:0 10px 30px rgba(0,0,0,.08)}h1{font-size:1.25rem;margin:0 0 4px}p{margin:0 0 18px;color:#71717a;font-size:.9rem}
input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #d4d4d8;border-radius:12px;font-size:1rem}button{width:100%;margin-top:14px;padding:13px;border:0;border-radius:12px;background:#27272a;color:#fff;font-size:1rem;font-weight:600}
.erro{color:#b91c1c;font-size:.88rem;margin-top:10px;min-height:1.2em}</style></head><body>
<form method="post" action="/login"><h1>Controle Jurídico e Financeiro</h1><p>Digite a senha para entrar.</p>
<input type="password" name="senha" autocomplete="current-password" autofocus required><button type="submit">Entrar</button><div class="erro">${msg || ''}</div></form></body></html>`;
const htmlResp = (corpo, status = 200, extra = {}) => new Response(corpo, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...extra } });

async function fazerLogin(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'sem-ip';
  const chaveIp = 'tent-' + ip.replace(/[^A-Za-z0-9:._-]/g, '_').slice(0, 60), chaveGeral = 'tent-geral';
  const agora = Date.now();
  const [tIp, tGeral] = await Promise.all([lerTent(env, chaveIp), lerTent(env, chaveGeral)]);
  if ((tIp.n >= MAX_FALHAS && tIp.ate > agora) || (tGeral.n >= MAX_FALHAS * 6 && tGeral.ate > agora)) return htmlResp(PAGINA('Muitas tentativas. Aguarde 15 minutos e tente de novo.'), 429);
  let senha = '';
  try { senha = String((await request.formData()).get('senha') || ''); } catch (e) {}
  if (senha && (await senhaConfere(env, senha))) {
    await Promise.all([limparTent(env, chaveIp)]);
    const cookie = `sessao=${await criarSessao(env)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${DIAS_SESSAO * 86400}`;
    return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': cookie, 'cache-control': 'no-store' } });
  }
  const novo = (t) => ({ n: (t.ate > agora ? t.n : 0) + 1, ate: agora + BLOQUEIO_MS });
  await Promise.all([gravarTent(env, chaveIp, novo(tIp)), gravarTent(env, chaveGeral, novo(tGeral))]);
  return htmlResp(PAGINA('Senha incorreta.'), 401);
}

const comSeguranca = (resp) => {
  const r = new Response(resp.body, resp);
  r.headers.set('x-content-type-options', 'nosniff'); r.headers.set('referrer-policy', 'no-referrer'); r.headers.set('x-frame-options', 'DENY');
  r.headers.set('strict-transport-security', 'max-age=31536000');
  return r;
};


/* ---------- leitura de documentos (foto/PDF) pelo Claude ---------- */
const TIPOS_IMG = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const LIMITE_DIA = 200;
async function ler(request, env, partes) {
  if (partes[1] === 'status') return json({ ok: !!env.ANTHROPIC_API_KEY });
  if (request.method !== 'POST') return erro(405, 'method', 'Método não permitido.');
  if (!env.ANTHROPIC_API_KEY) return erro(503, 'not_configured', 'A leitura de documentos ainda não foi configurada no servidor.');
  const b = await request.json().catch(() => null);
  if (!b || typeof b.prompt !== 'string' || !b.prompt || b.prompt.length > 60000) return erro(400, 'invalid', 'Pedido inválido.');
  const imgs = Array.isArray(b.imagens) ? b.imagens : [];
  if (imgs.length > 4 || imgs.some((i) => !i || !TIPOS_IMG.has(i.tipo) || typeof i.dados !== 'string' || i.dados.length > 7e6)) return erro(400, 'image_rejected', 'Imagem inválida ou grande demais.');
  const dia = 'uso-' + new Date().toISOString().slice(0, 10);
  const uso = await lerTent(env, dia);
  if (uso.n >= LIMITE_DIA) return erro(429, 'rate_limited', 'Limite diário de leituras atingido. Tente amanhã.');
  await gravarTent(env, dia, { n: uso.n + 1, ate: 0 });
  const content = imgs.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.tipo, data: i.dados } })).concat([{ type: 'text', text: b.prompt }]);
  let r;
  try {
    r = await fetch(env.ANTHROPIC_URL || 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.MODELO_LEITURA || 'claude-sonnet-5-5', max_tokens: 2000, messages: [{ role: 'user', content }] }),
    });
  } catch (e) { return erro(502, 'unavailable', 'Não consegui falar com o Claude agora. Tente de novo.'); }
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = String((corpo.error && corpo.error.message) || '');
    if (r.status === 401 || r.status === 403) return erro(502, 'chave_invalida', 'A chave do Claude no servidor foi recusada. Confira o segredo ANTHROPIC_API_KEY.');
    if (/credit balance|billing/i.test(msg)) return erro(402, 'sem_credito', 'Acabou o crédito da conta do Claude (Console). Adicione crédito e tente de novo.');
    if (r.status === 429 || r.status === 529) return erro(429, 'rate_limited', 'O Claude está ocupado. Tente de novo em instantes.');
    console.error('anthropic', r.status, msg);
    return erro(502, 'unavailable', 'O Claude não conseguiu ler agora. Tente de novo.');
  }
  const texto = (corpo.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return json({ text: texto });
}


async function openFinance(request, env, partes) {
  if (partes[1] === 'status') return json({ configurado: pluggyOk(env), temId: !!env.PLUGGY_CLIENT_ID, temSegredo: !!env.PLUGGY_CLIENT_SECRET, nomesParecidos: Object.keys(env).filter((k) => /pluggy/i.test(k) && k !== 'PLUGGY_BASE_URL').slice(0, 8) });
  if (!pluggyOk(env)) return erro(503, 'not_configured', 'O Open Finance ainda não foi configurado no servidor.');
  if (partes[1] === 'diagnostico') return json(await pluggyDiag(env));
  if (partes[1] === 'sincronizar') {
    const desde = new URL(request.url).searchParams.get('desde') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return erro(400, 'invalid', 'Informe a data inicial (AAAA-MM-DD).');
    try { return json(await pluggySinc(env, desde)); }
    catch (e) { return erro(502, 'unavailable', `A Pluggy não respondeu como esperado (${e.etapa || ''} ${e.status || ''} ${e.msg || ''}).`.replace(/\s+/g, ' ')); }
  }
  return erro(404, 'not_found', 'Não encontrado.');
}

/* ---------- API do banco ---------- */
async function api(request, env, partes) {
  // partes: ['db', colecao, id?]  |  ['backup']
  const metodo = request.method;
  if (partes[0] === 'backup' && metodo === 'GET') {
    const { results } = await env.DB.prepare("SELECT colecao, id, dados FROM docs WHERE colecao NOT LIKE '\\_%' ESCAPE '\\' ORDER BY colecao, id").all();
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
    return comSeguranca(await tratar(request, env));
  },
};
const ICONES = new Set(['/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest']);
async function tratar(request, env) {
  const url = new URL(request.url);
  const dev = env.ALLOW_NO_AUTH === '1';
  if (!dev && (!env.SENHA || String(env.SENHA).length < 12)) return new Response('Defina o segredo SENHA (mínimo 12 caracteres) no Cloudflare.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (ICONES.has(url.pathname)) return env.ASSETS.fetch(request);   // ícones e manifesto: públicos (o iPhone os busca sem sessão)
  if (url.pathname === '/login') {
    if (request.method === 'POST') return dev ? new Response(null, { status: 303, headers: { location: '/' } }) : fazerLogin(request, env);
    return htmlResp(PAGINA(''));
  }
  if (url.pathname === '/sair') return new Response(null, { status: 303, headers: { location: '/login', 'set-cookie': 'sessao=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' } });
  if (!dev && !(await sessaoValida(request, env))) {
    if (url.pathname.startsWith('/api/')) return erro(401, 'not_granted', 'Entre com a senha.');
    return new Response(null, { status: 303, headers: { location: '/login' } });
  }
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') {   // proteção extra contra pedidos vindos de outros sites
      const o = request.headers.get('origin');
      if (o && new URL(o).host !== url.host) return erro(403, 'forbidden', 'Origem não permitida.');
    }
    const partes = url.pathname.slice(5).split('/').filter(Boolean);
    try { return partes[0] === 'ler' ? await ler(request, env, partes) : partes[0] === 'of' ? await openFinance(request, env, partes) : await api(request, env, partes); }
    catch (e) { console.error(e); return erro(500, 'server', 'Erro no servidor.'); }
  }
  return env.ASSETS.fetch(request);
}
