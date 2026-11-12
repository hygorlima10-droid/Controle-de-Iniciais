/* Acesso individual do Horus: e-mail + senha, sessões guardadas no banco (cada uma pode ser encerrada), bloqueio por aparelho e avisos.
   Coleções reservadas: _usuarios (u1 = proprietário), _sessoes (id = sha256 do cookie), _sistema (contadores de tentativas).
   A senha antiga do Cloudflare (SENHA) vira "chave de emergência": só serve para criar o primeiro acesso e para recuperar a senha. */
import { pagina, htmlResp } from './paginas.js';
import { stmtRegistro } from './auditoria.js';

export const DIAS_SESSAO = 30, MAX_FALHAS = 5, BLOQUEIO_MS = 15 * 60e3, MIN_SENHA = 12, VOLTAS_PADRAO = 20000, VOLTAS_MAX = 100000, ATUALIZA_USO_MS = 10 * 60e3;
export const COL_USU = '_usuarios', COL_SES = '_sessoes', COL_SIS = '_sistema', COL_CONV = '_convites';
export const DIAS_CONVITE_HORAS = 48;
const enc = new TextEncoder();
export const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
export const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
export const sha256 = (txt) => crypto.subtle.digest('SHA-256', enc.encode(txt));
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);
export const igual = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
export const ipDe = (request) => request.headers.get('cf-connecting-ip') || 'sem-ip';
export const chaveIp = (pref, request) => pref + ipDe(request).replace(/[^A-Za-z0-9:._-]/g, '_').slice(0, 60);

/* ---------- senha: PBKDF2 + sal próprio + segredo do servidor ("pimenta") ---------- */
const voltasAtuais = (env) => Math.min(Math.max(parseInt(env.VOLTAS_SENHA, 10) || VOLTAS_PADRAO, 1000), VOLTAS_MAX);
async function hashSenha(env, senha, sal, voltas) {
  const pimenta = await crypto.subtle.importKey('raw', await sha256('pimenta-v1:' + env.SENHA), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const pre = await crypto.subtle.sign('HMAC', pimenta, enc.encode(senha));
  const base = await crypto.subtle.importKey('raw', pre, 'PBKDF2', false, ['deriveBits']);
  return b64u(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deB64u(sal), iterations: voltas }, base, 256));
}
const novoSal = () => b64u(crypto.getRandomValues(new Uint8Array(16)));
export async function credencial(env, senha) { const sal = novoSal(), voltas = voltasAtuais(env); return { sal, voltas, hash: await hashSenha(env, senha, sal, voltas) }; }
async function senhaDoUsuario(env, u, senha) { return igual(enc.encode(await hashSenha(env, senha, u.sal, u.voltas)), enc.encode(u.hash)); }
async function chaveEmergenciaConfere(env, digitada) {
  return igual(new Uint8Array(await sha256('senha:' + env.SENHA)), new Uint8Array(await sha256('senha:' + digitada)));
}
export const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120;

/* ---------- banco ---------- */
export const lerDoc = async (env, col, id) => { const r = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(col, id).first(); return r ? JSON.parse(r.dados) : null; };
export const stmtDoc = (env, col, id, dados) => env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(col, id, JSON.stringify(dados), Date.now());
export async function temProprietario(env) { return !!(await env.DB.prepare('SELECT 1 AS x FROM docs WHERE colecao = ? LIMIT 1').bind(COL_USU).first()); }
export async function acharPorEmail(env, email) {
  const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ?').bind(COL_USU).all();
  for (const r of results) { const d = JSON.parse(r.dados); if (d.ativo !== false && String(d.email || '').toLowerCase() === email) return { id: r.id, ...d }; }
  return null;
}
export async function proprietario(env) {
  const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ?').bind(COL_USU).all();
  for (const r of results) { const d = JSON.parse(r.dados); if (d.papel === 'proprietario') return { id: r.id, ...d }; }
  return null;
}
export async function lerTent(env, chave) { return (await lerDoc(env, COL_SIS, chave)) || { n: 0, ate: 0 }; }
export const gravarTent = (env, chave, v) => stmtDoc(env, COL_SIS, chave, v).run();
export const limparTent = (env, chave) => env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(COL_SIS, chave).run();
export const bloqueado = (t) => t.n >= MAX_FALHAS && t.ate > Date.now();
export const contaFalha = (t) => ({ n: (t.ate > Date.now() ? t.n : 0) + 1, ate: Date.now() + BLOQUEIO_MS });

/* ---------- aparelho e lugar de cada sessão ---------- */
export function rotuloAparelho(ua) {
  ua = String(ua || '');
  const ap = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh|Mac OS/.test(ua) ? 'Mac' : /Linux|X11/.test(ua) ? 'Linux' : 'Aparelho';
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
  return ap + ' · ' + nav;
}
const ipParcial = (ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip.split('.').slice(0, 2).join('.') + '.x.x' : ip.includes(':') ? ip.split(':').slice(0, 2).join(':') + '::' : ip;
const lugarDe = (request) => { const cf = request.cf || {}; return [cf.city, cf.regionCode || cf.region].filter(Boolean).join(', ') || cf.country || ''; };
export const contexto = (request) => ({ rotulo: rotuloAparelho(request.headers.get('user-agent')), ip: ipParcial(ipDe(request)), lugar: lugarDe(request) });

/* ---------- sessões ---------- */
export const cookieSessao = (token) => `sessao=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${DIAS_SESSAO * 86400}`;
const COOKIE_LIMPO = 'sessao=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
const tokenDoPedido = (request) => { const m = /(?:^|;\s*)sessao=([A-Za-z0-9_-]{30,80})(?:;|$)/.exec(request.headers.get('cookie') || ''); return m ? m[1] : null; };
export async function criarSessaoBanco(env, request, usuario) {
  const token = b64u(crypto.getRandomValues(new Uint8Array(32))), id = hex(await sha256('sessao-v2:' + token)), agora = Date.now(), c = contexto(request);
  await stmtDoc(env, COL_SES, id, { usuario, criada: agora, ultimo: agora, expira: agora + DIAS_SESSAO * 864e5, rotulo: c.rotulo, ip: c.ip, lugar: c.lugar }).run();
  return token;
}
/* devolve { id, sessao, usuario } ou null; mantém "último uso" atualizado sem gravar a cada pedido */
export async function autenticar(request, env) {
  const token = tokenDoPedido(request); if (!token) return null;
  const id = hex(await sha256('sessao-v2:' + token));
  const r = await env.DB.prepare('SELECT s.dados AS s, u.dados AS u, u.id AS uid FROM docs s LEFT JOIN docs u ON u.colecao = ? AND u.id = json_extract(s.dados, \'$.usuario\') WHERE s.colecao = ? AND s.id = ?').bind(COL_USU, COL_SES, id).first();
  if (!r || !r.u) return null;
  const sessao = JSON.parse(r.s), usuario = { id: r.uid, ...JSON.parse(r.u) };
  if (sessao.expira <= Date.now() || usuario.ativo === false) return null;
  if (Date.now() - sessao.ultimo > ATUALIZA_USO_MS) { sessao.ultimo = Date.now(); await stmtDoc(env, COL_SES, id, sessao).run(); }
  return { id, sessao, usuario };
}
const encerrarTodas = (env, exceto) => env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id <> ?').bind(COL_SES, exceto || '').run();

/* ---------- avisos no iPhone ---------- */
export const avisoSeAtivo = (deps, env, u, aviso) => { if (u && u.alertas !== false && deps.avisar) deps.avisar(env, aviso); };

/* ---------- telas ---------- */
const FORMULARIO_LOGIN = (msg, email) => pagina({ acao: '/login', sub: 'Entre com o seu e-mail e a sua senha', campos: [{ name: 'email', type: 'email', label: 'E-mail', auto: 'username', valor: email }, { name: 'senha', senha: true, label: 'Senha', auto: 'current-password' }], msg, link: { href: '/recuperar', txt: 'Esqueci minha senha' } });
const FORMULARIO_LEGADO = (msg) => pagina({ acao: '/login', sub: 'Digite a senha para entrar', campos: [{ name: 'senha', senha: true, label: 'Senha', auto: 'current-password' }], msg });
const FORMULARIO_CRIAR = (msg, v = {}) => pagina({ acao: '/criar-acesso', titulo: 'Crie o seu acesso', sub: 'Você entrou com a senha atual do app. Agora crie o seu acesso individual, com e-mail e senha só seus.', botao: 'Criar acesso e entrar', ocupado: 'Criando…', campos: [{ name: 'nome', label: 'Nome', auto: 'name', valor: v.nome }, { name: 'email', type: 'email', label: 'E-mail', auto: 'username', valor: v.email }, { name: 'senha', senha: true, label: `Nova senha (mínimo ${MIN_SENHA} caracteres)`, auto: 'new-password' }, { name: 'senha2', senha: true, label: 'Repita a senha', auto: 'new-password' }], msg, nota: 'A senha antiga do app vira a <b>chave de emergência</b>: só serve para recuperar o acesso, nunca para entrar.' });
const FORMULARIO_RECUPERAR = (msg) => pagina({ acao: '/recuperar', titulo: 'Recuperar o acesso', sub: 'Digite a chave de emergência (a senha antiga do app, guardada no Cloudflare) e escolha uma senha nova.', botao: 'Redefinir a senha', ocupado: 'Redefinindo…', campos: [{ name: 'chave', senha: true, label: 'Chave de emergência', auto: 'off' }, { name: 'senha', senha: true, label: `Nova senha (mínimo ${MIN_SENHA} caracteres)`, auto: 'new-password' }, { name: 'senha2', senha: true, label: 'Repita a nova senha', auto: 'new-password' }], msg, nota: 'Ao redefinir, <b>todas as sessões abertas são encerradas</b> e você entra de novo.', link: { href: '/login', txt: 'Voltar para a entrada' } });
export const MSG_BLOQUEIO = 'Muitas tentativas. Aguarde 15 minutos e tente de novo.';
export const redirecionar = (para, cookie) => new Response(null, { status: 303, headers: { location: para, 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) } });
export const lerForm = async (request) => { try { const f = await request.formData(); const o = {}; for (const [k, v] of f.entries()) if (typeof v === 'string') o[k] = v; return o; } catch (e) { return {}; } };
export const checaNovaSenha = (senha, senha2) => (senha.length < MIN_SENHA ? `A senha precisa ter pelo menos ${MIN_SENHA} caracteres.` : senha !== senha2 ? 'As duas senhas não são iguais.' : '');

/* ---------- rotas de página: /login, /criar-acesso, /recuperar, /sair ---------- */
export async function paginasDeAcesso(request, env, deps) {
  const url = new URL(request.url), p = url.pathname, post = request.method === 'POST';
  if (p.startsWith('/convite/')) return conviteRotas(request, env, deps, p.slice(9));
  if (p === '/sair') {
    const a = await autenticar(request, env);
    if (a) await env.DB.batch([env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(COL_SES, a.id), stmtRegistro(env, { op: 'saiu', rotulo: 'Acesso', titulo: a.sessao.rotulo + (a.sessao.lugar ? ' · ' + a.sessao.lugar : '') })]);
    return redirecionar('/login', COOKIE_LIMPO);
  }
  if (p === '/login') {
    const dono = await temProprietario(env);
    if (!post) {
      if (await autenticar(request, env)) return redirecionar('/');
      return htmlResp(dono ? FORMULARIO_LOGIN('') : FORMULARIO_LEGADO(''));
    }
    const chave = chaveIp('tent-', request), t = await lerTent(env, chave), f = await lerForm(request), senha = String(f.senha || '');
    if (bloqueado(t)) return htmlResp(dono ? FORMULARIO_LOGIN(MSG_BLOQUEIO, f.email) : FORMULARIO_LEGADO(MSG_BLOQUEIO), 429);
    if (!dono) {   // ainda sem acesso individual: a senha antiga abre só a tela de criar o acesso
      if (senha && (await chaveEmergenciaConfere(env, senha))) { await limparTent(env, chave); return redirecionar('/criar-acesso', 'sessao=' + (await deps.criarLegado()) + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600'); }
      await gravarTent(env, chave, contaFalha(t));
      return htmlResp(FORMULARIO_LEGADO('Senha incorreta.'), 401);
    }
    const email = String(f.email || '').trim().toLowerCase(), u = email ? await acharPorEmail(env, email) : null;
    const ok = u ? await senhaDoUsuario(env, u, senha) : (await hashSenha(env, senha, 'AAAAAAAAAAAAAAAAAAAAAA', voltasAtuais(env)), false);   // mesmo tempo com ou sem e-mail cadastrado
    if (ok) {
      const ctx = contexto(request), cmds = [];
      const lembrete = u.conhecidos || [], marca = ctx.rotulo + '|' + ctx.lugar, novoAparelho = !lembrete.includes(marca);
      const upd = { ...u }; delete upd.id;
      if (novoAparelho) upd.conhecidos = [...lembrete, marca].slice(-30);
      if (u.voltas < voltasAtuais(env)) Object.assign(upd, await credencial(env, senha));   // plano pago: sobe sozinho para mais voltas
      if (novoAparelho || upd.hash !== u.hash) await stmtDoc(env, COL_USU, u.id, upd).run();
      await limparTent(env, chave);
      const token = await criarSessaoBanco(env, request, u.id);
      await stmtRegistro(env, { op: 'entrou', rotulo: 'Acesso', titulo: ctx.rotulo + (ctx.lugar ? ' · ' + ctx.lugar : '') }).run();
      if (novoAparelho && lembrete.length) avisoSeAtivo(deps, env, u, { tag: 'acesso-novo', equipe: 'aparelho', titulo: u.papel === 'proprietario' ? 'Novo acesso ao Horus' : 'Novo acesso de ' + String(u.nome || '').split(' ')[0], corpo: ctx.rotulo + (ctx.lugar ? ' · ' + ctx.lugar : '') + '. Se não foi você, troque a senha em Configurações › Segurança.', url: '/' });
      return redirecionar('/', cookieSessao(token));
    }
    const novo = contaFalha(t); await gravarTent(env, chave, novo);
    if (novo.n <= MAX_FALHAS) await stmtRegistro(env, { op: 'falhou', por: 'desconhecido', rotulo: 'Acesso', titulo: 'Senha ou e-mail errados (' + novo.n + (novo.n > 1 ? ' tentativas' : ' tentativa') + ') · ' + ipParcial(ipDe(request)) + (lugarDe(request) ? ' · ' + lugarDe(request) : '') }).run();
    if (novo.n === 3 || novo.n === MAX_FALHAS) { const dono1 = await proprietario(env); avisoSeAtivo(deps, env, dono1, { tag: 'acesso-falha', titulo: 'Tentativas de entrada no Horus', corpo: novo.n + ' senhas erradas seguidas' + (lugarDe(request) ? ' vindas de ' + lugarDe(request) : '') + '. O aparelho foi bloqueado por 15 minutos.', url: '/' }); }
    return htmlResp(FORMULARIO_LOGIN('E-mail ou senha incorretos.', f.email), 401);
  }
  if (p === '/criar-acesso') {
    if (await temProprietario(env)) return redirecionar('/login');
    if (!(await deps.legadoValido(request))) return redirecionar('/login');
    if (!post) return htmlResp(FORMULARIO_CRIAR(''));
    const f = await lerForm(request), nome = String(f.nome || '').trim().slice(0, 80), email = String(f.email || '').trim().toLowerCase(), senha = String(f.senha || '');
    const v = { nome, email }, e = !nome ? 'Informe o seu nome.' : !emailOk(email) ? 'Informe um e-mail válido.' : checaNovaSenha(senha, String(f.senha2 || ''));
    if (e) return htmlResp(FORMULARIO_CRIAR(e, v), 400);
    const cred = await credencial(env, senha);
    const r = await env.DB.prepare('INSERT OR IGNORE INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?)').bind(COL_USU, 'u1', JSON.stringify({ nome, email, papel: 'proprietario', ativo: true, alertas: true, criadoEm: new Date().toISOString(), conhecidos: [], ...cred }), Date.now()).run();
    if (!(r && r.meta && r.meta.changes > 0)) return redirecionar('/login');
    const token = await criarSessaoBanco(env, request, 'u1'), ctx = contexto(request);
    await env.DB.batch([stmtRegistro(env, { op: 'criou', rotulo: 'Acesso', titulo: 'Acesso individual do proprietário criado' }), stmtRegistro(env, { op: 'entrou', rotulo: 'Acesso', titulo: ctx.rotulo + (ctx.lugar ? ' · ' + ctx.lugar : '') })]);
    return redirecionar('/', cookieSessao(token));
  }
  if (p === '/recuperar') {
    if (!(await temProprietario(env))) return redirecionar('/login');
    if (!post) return htmlResp(FORMULARIO_RECUPERAR(''));
    const chave = chaveIp('tent-rec-', request), t = await lerTent(env, chave);
    if (bloqueado(t)) return htmlResp(FORMULARIO_RECUPERAR(MSG_BLOQUEIO), 429);
    const f = await lerForm(request), senha = String(f.senha || '');
    if (!(await chaveEmergenciaConfere(env, String(f.chave || '')))) {
      const novo = contaFalha(t); await gravarTent(env, chave, novo);
      if (novo.n <= MAX_FALHAS) await stmtRegistro(env, { op: 'falhou', por: 'desconhecido', rotulo: 'Acesso', titulo: 'Chave de emergência errada na recuperação · ' + ipParcial(ipDe(request)) }).run();
      return htmlResp(FORMULARIO_RECUPERAR('Chave de emergência incorreta.'), 401);
    }
    const e = checaNovaSenha(senha, String(f.senha2 || '')); if (e) return htmlResp(FORMULARIO_RECUPERAR(e), 400);
    const u = await proprietario(env), cred = await credencial(env, senha), upd = { ...u, ...cred }; delete upd.id;
    await env.DB.prepare('DELETE FROM docs WHERE colecao = ?').bind(COL_SES).run();
    await stmtDoc(env, COL_USU, u.id, upd).run();
    await limparTent(env, chave);
    const token = await criarSessaoBanco(env, request, u.id), ctx = contexto(request);
    await env.DB.batch([stmtRegistro(env, { op: 'alterou', rotulo: 'Acesso', titulo: 'Senha redefinida pela chave de emergência; sessões encerradas' }), stmtRegistro(env, { op: 'entrou', rotulo: 'Acesso', titulo: ctx.rotulo + (ctx.lugar ? ' · ' + ctx.lugar : '') })]);
    avisoSeAtivo(deps, env, u, { tag: 'acesso-recuperado', titulo: 'Senha do Horus redefinida', corpo: 'Feito pela chave de emergência, ' + ctx.rotulo + (ctx.lugar ? ' · ' + ctx.lugar : '') + '. Se não foi você, avise já.', url: '/' });
    return redirecionar('/', cookieSessao(token));
  }
  return null;
}

/* ---------- API de segurança (só o proprietário): /api/seguranca/... ---------- */
export async function segurancaRotas(request, env, partes, auth) {
  if (!auth || !auth.usuario) return erro(404, 'not_found', 'Disponível só com o acesso individual.');
  const m = request.method, acao = partes[1], alvo = partes[2];
  const u = auth.usuario;
  if (acao === 'sessoes' && !alvo && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ?').bind(COL_SES).all();
    const lista = results.map((r) => ({ id: r.id.slice(0, 16), ...JSON.parse(r.dados), atual: r.id === auth.id })).filter((s) => s.expira > Date.now() && s.usuario === u.id).sort((a, b) => b.ultimo - a.ultimo)
      .map((s) => ({ id: s.id, rotulo: s.rotulo, lugar: s.lugar || '', ip: s.ip || '', criada: new Date(s.criada).toISOString(), ultimo: new Date(s.ultimo).toISOString(), atual: s.atual }));
    return json({ sessoes: lista, usuario: { nome: u.nome, email: u.email, alertas: u.alertas !== false } });
  }
  if (acao === 'sessoes' && alvo === 'encerrar-outras' && m === 'POST') {
    const antes = await env.DB.prepare("SELECT COUNT(*) AS n FROM docs WHERE colecao = ? AND id <> ? AND json_extract(dados, '$.usuario') = ?").bind(COL_SES, auth.id, u.id).first();
    await env.DB.batch([env.DB.prepare("DELETE FROM docs WHERE colecao = ? AND id <> ? AND json_extract(dados, '$.usuario') = ?").bind(COL_SES, auth.id, u.id), stmtRegistro(env, { op: 'encerrou', rotulo: 'Acesso', titulo: 'Todas as outras sessões encerradas (' + (antes ? antes.n : 0) + ')' })]);
    return json({ ok: true, encerradas: antes ? antes.n : 0 });
  }
  if (acao === 'sessoes' && alvo && m === 'DELETE') {
    if (!/^[0-9a-f]{16}$/.test(alvo)) return erro(400, 'invalid', 'Identificador inválido.');
    const r = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ? AND id LIKE ?').bind(COL_SES, alvo + '%').first();
    if (!r) return erro(404, 'not_found', 'Sessão não encontrada.');
    if (r.id === auth.id) return erro(400, 'invalid', 'Esta é a sessão atual; use Sair.');
    const s = JSON.parse(r.dados);
    await env.DB.batch([env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(COL_SES, r.id), stmtRegistro(env, { op: 'encerrou', rotulo: 'Acesso', titulo: 'Sessão de ' + s.rotulo + (s.lugar ? ' · ' + s.lugar : '') })]);
    return json({ ok: true });
  }
  if (acao === 'senha' && m === 'PUT') {
    const b = await request.json().catch(() => null) || {};
    const chave = 'tent-sen-' + auth.usuario.id, t = await lerTent(env, chave);
    if (bloqueado(t)) return erro(429, 'rate_limited', MSG_BLOQUEIO);
    if (!(await senhaDoUsuario(env, u, String(b.atual || '')))) { await gravarTent(env, chave, contaFalha(t)); return erro(401, 'not_granted', 'A senha atual não confere.'); }
    const e = checaNovaSenha(String(b.nova || ''), String(b.nova || '')); if (e) return erro(400, 'invalid', e);
    const upd = { ...u, ...(await credencial(env, String(b.nova))) }; delete upd.id;
    await env.DB.batch([stmtDoc(env, COL_USU, u.id, upd), env.DB.prepare("DELETE FROM docs WHERE colecao = ? AND id <> ? AND json_extract(dados, '$.usuario') = ?").bind(COL_SES, auth.id, u.id), stmtRegistro(env, { op: 'alterou', rotulo: 'Acesso', titulo: 'Senha de acesso trocada; outras sessões encerradas' })]);
    await limparTent(env, chave);
    return json({ ok: true });
  }
  if (acao === 'alertas' && m === 'PUT') {
    const b = await request.json().catch(() => null) || {};
    const upd = { ...u, alertas: b.ativo !== false }; delete upd.id;
    await stmtDoc(env, COL_USU, u.id, upd).run();
    return json({ ok: true, alertas: upd.alertas });
  }
  return erro(404, 'not_found', 'Não encontrado.');
}

/* ---------- convite por link: /convite/<chave> (página pública; a chave vale 48 h e uma só vez) ---------- */
export const hashConvite = async (token) => hex(await sha256('convite-v1:' + token));
const TOKEN_CONVITE = /^[A-Za-z0-9_-]{40,60}$/;
const PAPEL_ROTULO = { advogado: 'advogado', estagiario: 'estagiário' };
const FORMULARIO_CONVITE = (token, c, msg) => pagina({ acao: '/convite/' + token, titulo: 'Crie o seu acesso', sub: `Você foi convidado(a) para o Horus como ${PAPEL_ROTULO[c.papel] || 'usuário'}. Crie a sua senha para entrar.`, campos: [{ name: 'nome', label: 'Nome', valor: c.nome, ler: true }, { name: 'email', type: 'email', label: 'E-mail', valor: c.email, ler: true }, { name: 'senha', senha: true, label: `Senha (mínimo ${MIN_SENHA} caracteres)`, auto: 'new-password' }, { name: 'senha2', senha: true, label: 'Repita a senha', auto: 'new-password' }], botao: 'Criar meu acesso', ocupado: 'Criando…', msg, nota: 'Só você saberá esta senha. O link deixa de valer depois de usado.' });
const CONVITE_INVALIDO = () => htmlResp(pagina({ acao: '/login', titulo: 'Convite indisponível', sub: 'Este link já foi usado, venceu ou foi cancelado. Peça um novo link a quem convidou você.', campos: [], semBotao: true, link: { href: '/login', txt: 'Ir para a entrada' } }), 410);
export async function emailJaTemAcesso(env, email) {
  const { results } = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ?').bind(COL_USU).all();
  return results.some((r) => String(JSON.parse(r.dados).email || '').toLowerCase() === email);
}
async function conviteRotas(request, env, deps, token) {
  if (!(await temProprietario(env))) return redirecionar('/login');
  if (!TOKEN_CONVITE.test(token)) return CONVITE_INVALIDO();
  const id = await hashConvite(token), c = await lerDoc(env, COL_CONV, id);
  if (!c || c.expira <= Date.now()) return CONVITE_INVALIDO();
  if (request.method !== 'POST') return htmlResp(FORMULARIO_CONVITE(token, c, ''));
  const chave = chaveIp('tent-conv-', request), t = await lerTent(env, chave);
  if (bloqueado(t)) return htmlResp(FORMULARIO_CONVITE(token, c, MSG_BLOQUEIO), 429);
  const f = await lerForm(request), senha = String(f.senha || ''), e = checaNovaSenha(senha, String(f.senha2 || ''));
  if (e) { await gravarTent(env, chave, contaFalha(t)); return htmlResp(FORMULARIO_CONVITE(token, c, e), 400); }
  if (await emailJaTemAcesso(env, c.email)) return htmlResp(FORMULARIO_CONVITE(token, c, 'Este e-mail já tem acesso. Entre pela tela de login.'), 409);
  /* "pega" o convite antes de criar o usuário: se dois pedidos chegarem juntos, só um passa */
  const pegou = await env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(COL_CONV, id).run();
  if (!(pegou && pegou.meta && pegou.meta.changes > 0)) return CONVITE_INVALIDO();
  const uid = 'u' + hex(crypto.getRandomValues(new Uint8Array(5))), cred = await credencial(env, senha), ctx = contexto(request);
  const usuario = { nome: c.nome, email: c.email, papel: c.papel, ativo: true, alertas: true, oabs: c.oabs || [], permissoes: c.permissoes || {}, criadoEm: new Date().toISOString(), convidadoPor: c.por || '', conhecidos: [ctx.rotulo + '|' + ctx.lugar], ...cred };
  await stmtDoc(env, COL_USU, uid, usuario).run();
  await limparTent(env, chave);
  const sessao = await criarSessaoBanco(env, request, uid);
  await env.DB.batch([stmtRegistro(env, { op: 'criou', por: c.nome, rotulo: 'Acesso', titulo: 'Convite aceito: ' + c.nome + ' (' + (PAPEL_ROTULO[c.papel] || c.papel) + ')' }), stmtRegistro(env, { op: 'entrou', por: c.nome, rotulo: 'Acesso', titulo: ctx.rotulo + (ctx.lugar ? ' · ' + ctx.lugar : '') })]);
  avisoSeAtivo(deps, env, await proprietario(env), { tag: 'convite-aceito', equipe: 'convite', titulo: 'Convite aceito no Horus', corpo: c.nome + ' criou o acesso como ' + (PAPEL_ROTULO[c.papel] || c.papel) + '.', url: '/' });
  return redirecionar('/', cookieSessao(sessao));
}
