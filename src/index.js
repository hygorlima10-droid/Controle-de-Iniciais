/* Servidor do Horus (Cloudflare Worker + banco D1).
   - Todo acesso (página e API) exige login do Cloudflare Access (só o seu e-mail).
   - A API imita o "banco" que o app já usava dentro do Claude. */

import { gerarChavesVapid, enviarPush } from './push.js';
import { djenRotas, lerDjen, relerSePreciso, pubsParaAvisar, marcarAvisadas } from './djen.js';
import { datajudRotas } from './datajud.js';
import { loteRotas } from './lote.js';
import { checarColecao, resolverColecao, ehProprietario } from './colecoes.js';
import { garantirMigracoes } from './migracao.js';
import { restauracaoRotas } from './restauracao.js';
import { paginasDeAcesso, autenticar, segurancaRotas, temProprietario } from './acesso.js';
import { auditoriaRotas, lixeiraRotas, limparSeguranca, stmtRegistro, stmtLixeira, registraColecao, vaiParaLixeira, tituloDe, mudancas } from './auditoria.js';

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

const PAGINA = (msg) => `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#18181b"><title>Horus</title>
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=2"><link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png?v=2"><link rel="shortcut icon" href="/favicon.ico?v=2"><link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2"><link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/tema.css?v=1">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased;
background:radial-gradient(760px 420px at 50% -8%,rgba(237,161,0,.18),transparent 62%),var(--bg)}
.lg{width:min(380px,100%);text-align:center}
.lg .marca{margin:0 auto;position:relative;z-index:1}
form{background:var(--surface);border-radius:var(--radius-lg);padding:60px 24px 24px;margin-top:-44px;box-shadow:var(--shadow);text-align:left}
h1{font-size:1.5rem;line-height:1.2;margin:0 0 6px;text-align:center;font-weight:700;letter-spacing:-.01em}
.sub{margin:0 0 22px;text-align:center;color:var(--ink-soft);font-size:.875rem}
.campo{position:relative}
input{width:100%;height:52px;padding:0 50px 0 16px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2);color:var(--ink);font:inherit;font-size:1rem;outline:none;transition:border-color .15s,box-shadow .15s}
input:focus{border-color:var(--c-gold);box-shadow:0 0 0 3px rgba(237,161,0,.22)}
.olho{position:absolute;right:6px;top:6px;width:40px;height:40px;border:0;background:none;color:var(--ink-soft);border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.olho svg{width:22px;height:22px}
.olho:hover{color:var(--ink)}
button.entrar{width:100%;height:52px;margin-top:14px;border:0;border-radius:14px;background:var(--gold-btn);color:var(--gold-ink);font:inherit;font-size:1rem;font-weight:700;cursor:pointer;box-shadow:0 10px 24px rgba(201,133,0,.32);transition:transform .1s,filter .15s}
button.entrar:active{transform:scale(.99)}
button.entrar[disabled]{filter:grayscale(.3) brightness(.95);cursor:wait}
.erro{margin-top:14px;padding:10px 12px;border-radius:12px;background:rgba(220,47,47,.1);color:var(--urgente);font-size:.8125rem;font-weight:600;text-align:center}
.rodape{margin-top:18px;color:var(--ink-soft);font-size:.75rem}
</style></head><body>
<main class="lg"><img class="marca" src="/icon-192.png?v=2" alt="Horus" width="88" height="88">
<form method="post" action="/login" id="f"><h1>Horus</h1><p class="sub">Digite a senha para entrar</p>
<div class="campo"><input type="password" name="senha" id="s" autocomplete="current-password" placeholder="Senha" aria-label="Senha" autofocus required>
<button type="button" class="olho" id="o" aria-label="Mostrar senha"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
<button type="submit" class="entrar" id="b">Entrar</button>${msg ? `<div class="erro" role="alert">${msg}</div>` : ''}</form>
<div class="rodape">Acesso restrito · seus dados ficam protegidos</div></main>
<script>
(function(){try{var t=localStorage.getItem('controlePeticoes.tema');if(t!=='light'&&t!=='dark'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)t='dark';document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){}})();
var s=document.getElementById('s'),o=document.getElementById('o');
o.addEventListener('click',function(){var v=s.type==='password';s.type=v?'text':'password';o.setAttribute('aria-label',v?'Ocultar senha':'Mostrar senha');s.focus()});
document.getElementById('f').addEventListener('submit',function(){var b=document.getElementById('b');b.disabled=true;b.textContent='Entrando…'});
</script></body></html>`;
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
      body: JSON.stringify({ model: b.modelo === 'quick' ? (env.MODELO_RAPIDO || 'claude-haiku-5-5') : (env.MODELO_LEITURA || 'claude-sonnet-5-5'), max_tokens: 2000, messages: [{ role: 'user', content }] }),
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


/* ---------- arquivos enviados pelo "Compartilhar" do iPhone (Atalho com token) ---------- */
/* ---------- backup semanal automático (guardado no próprio banco, em partes comprimidas) ---------- */
const GUARDAR_BACKUPS = 8, PARTE_B64 = 700 * 1024;
async function gzipB64(texto) {
  const cs = new Response(new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip')));
  return paraB64(await cs.arrayBuffer());
}
async function gunzipTexto(b64) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
export async function fazerBackup(env) {
  const { results } = await env.DB.prepare("SELECT colecao, id, dados FROM docs WHERE colecao NOT LIKE '\\_%' ESCAPE '\\' ORDER BY colecao, id").all();
  const docs = results.map((r) => ({ colecao: r.colecao, id: r.id, dados: JSON.parse(r.dados) }));
  const b64 = await gzipB64(JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), docs }));
  const dia = new Date().toISOString().slice(0, 10);
  const antigos = await env.DB.prepare("SELECT id FROM docs WHERE colecao = '_backups' AND id LIKE ?").bind(dia + '-%').all();
  for (const a of antigos.results) await env.DB.prepare("DELETE FROM docs WHERE colecao = '_backups' AND id = ?").bind(a.id).run();
  const total = Math.ceil(b64.length / PARTE_B64) || 1;
  for (let i = 0; i < total; i++) await gravar(env, '_backups', `${dia}-${String(i).padStart(2, '0')}`, { dia, parte: i, total, docs: docs.length, b64: b64.slice(i * PARTE_B64, (i + 1) * PARTE_B64) });
  const todos = await env.DB.prepare("SELECT DISTINCT substr(id,1,10) AS d FROM docs WHERE colecao = '_backups' ORDER BY d DESC").all();
  for (const x of todos.results.slice(GUARDAR_BACKUPS)) await env.DB.prepare("DELETE FROM docs WHERE colecao = '_backups' AND id LIKE ?").bind(x.d + '-%').run();
  return { dia, partes: total, docs: docs.length };
}
const VERSAO_BACKUP_APP = 1;
function backupNoFormatoDoApp(docs, exportadoEm) {
  const por = (c) => docs.filter((d) => d.colecao === c).map((d) => Object.assign({}, d.dados, { id: d.id }));
  const mapa = (c) => { const o = {}; docs.filter((d) => d.colecao === c).forEach((d) => { o[d.id] = d.dados; }); return o; };
  return { versao: VERSAO_BACKUP_APP, exportadoEm, casos: por('casos'), acordos: por('termosAcordo'), alvaras: por('alvaras'), clientes: por('clientes'), despesas: por('despesas'), receitasManuais: por('receitasManuais'), saldos: mapa('saldos'), metas: por('metas'), extratos: por('extratos'), obraMov: por('obraMov'), processos: por('processos'), agenda: por('agenda'), pecasAprendidas: por('pecasAprendidas'), config: mapa('config') };
}
async function backups(request, env, partes) {
  const dia = partes[1];
  if (!dia && request.method === 'GET') {
    const { results } = await env.DB.prepare("SELECT id, dados FROM docs WHERE colecao = '_backups' ORDER BY id DESC").all();
    const por = {};
    results.forEach((r) => { const d = JSON.parse(r.dados); (por[d.dia] = por[d.dia] || { dia: d.dia, docs: d.docs, partes: d.total }); });
    return json({ itens: Object.values(por) });
  }
  if (dia === 'agora' && request.method === 'POST') return json(await fazerBackup(env));
  if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) && request.method === 'GET') {
    const { results } = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = '_backups' AND id LIKE ? ORDER BY id").bind(dia + '-%').all();
    if (!results.length) return erro(404, 'not_found', 'Backup não encontrado.');
    const txt = await gunzipTexto(results.map((r) => JSON.parse(r.dados).b64).join(''));
    const j = JSON.parse(txt);
    return json(backupNoFormatoDoApp(j.docs, j.exportadoEm));
  }
  return erro(405, 'method', 'Método não permitido.');
}

const MAX_B64 = 850 * 1024, MAX_RECEBIDOS = 40;
async function tokenConfere(env, request) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  if (!m || !env.ENVIO_TOKEN || String(env.ENVIO_TOKEN).length < 24) return false;
  const a = new Uint8Array(await sha256('token:' + env.ENVIO_TOKEN)), b = new Uint8Array(await sha256('token:' + m[1].trim()));
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
const paraB64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function enviar(request, env) {
  if (request.method !== 'POST') return erro(405, 'method', 'Use POST.');
  const ip = request.headers.get('cf-connecting-ip') || 'sem-ip', chave = 'tent-env-' + ip.replace(/[^A-Za-z0-9:._-]/g, '_').slice(0, 60), agora = Date.now();
  const t = await lerTent(env, chave);
  if (t.n >= MAX_FALHAS && t.ate > agora) return erro(429, 'rate_limited', 'Muitas tentativas. Aguarde 15 minutos.');
  if (!(await tokenConfere(env, request))) {
    await gravarTent(env, chave, { n: (t.ate > agora ? t.n : 0) + 1, ate: agora + BLOQUEIO_MS });
    return erro(401, 'not_granted', 'Token inválido.');
  }
  const ct = request.headers.get('content-type') || '';
  let nome = '', tipo = ct.split(';')[0].trim() || 'application/octet-stream', bytes;
  try { nome = decodeURIComponent(request.headers.get('x-nome') || ''); } catch (e) { nome = request.headers.get('x-nome') || ''; }
  if (/multipart\/form-data/i.test(ct)) {
    const f = await request.formData(); let arq = null;
    for (const v of f.values()) if (v && typeof v === 'object' && 'arrayBuffer' in v) { arq = v; break; }
    if (!arq) return erro(400, 'invalid', 'Nenhum arquivo no envio.');
    bytes = await arq.arrayBuffer(); nome = nome || arq.name || 'arquivo'; tipo = arq.type || tipo;
  } else bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return erro(400, 'invalid', 'Arquivo vazio.');
  const b64 = paraB64(bytes);
  if (b64.length > MAX_B64) return erro(413, 'quota_exceeded', 'Arquivo grande demais (limite de uns 600 KB). Use "Escolher extratos" dentro do app.');
  const { results } = await env.DB.prepare("SELECT COUNT(*) AS n FROM docs WHERE colecao = '_recebidos'").all();
  if (results[0].n >= MAX_RECEBIDOS) return erro(429, 'rate_limited', 'Há arquivos demais esperando no app. Abra Extratos e leia os recebidos.');
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  await gravar(env, '_recebidos', id, { nome: String(nome || 'arquivo').slice(0, 120), tipo, tam: bytes.byteLength, em: new Date().toISOString(), b64 });
  return json({ ok: true, id, nome: nome || 'arquivo', recebido: true });
}
async function recebidos(request, env, partes) {
  const id = partes[1];
  if (!id && request.method === 'GET') {
    const { results } = await env.DB.prepare("SELECT id, dados FROM docs WHERE colecao = '_recebidos' ORDER BY atualizado").all();
    return json({ itens: results.map((r) => { const d = JSON.parse(r.dados); return { id: r.id, nome: d.nome, tam: d.tam, em: d.em }; }) });
  }
  if (id && !NOME.test(id)) return erro(400, 'invalid', 'Identificador inválido.');
  if (id && request.method === 'GET') {
    const r = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = '_recebidos' AND id = ?").bind(id).first();
    if (!r) return erro(404, 'not_found', 'Arquivo não encontrado.');
    const d = JSON.parse(r.dados); return json({ nome: d.nome, tipo: d.tipo, b64: d.b64 });
  }
  if (id && request.method === 'DELETE') { await env.DB.prepare("DELETE FROM docs WHERE colecao = '_recebidos' AND id = ?").bind(id).run(); return json({ ok: true }); }
  return erro(405, 'method', 'Método não permitido.');
}

async function anexos(request, env, partes) {
  const id = partes[1];
  if (!id && request.method === 'POST') {
    const b = await request.json().catch(() => null);
    if (!b || typeof b.b64 !== 'string' || !/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(b.tipo || '')) return erro(400, 'invalid', 'Arquivo inválido.');
    if (b.b64.length > MAX_B64) return erro(413, 'quota_exceeded', 'Arquivo grande demais (limite de uns 600 KB).');
    const novo = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    await gravar(env, '_anexos', novo, { nome: String(b.nome || 'nota').slice(0, 80), tipo: b.tipo, b64: b.b64, em: new Date().toISOString() });
    return json({ ok: true, id: novo });
  }
  if (!id || !NOME.test(id)) return erro(400, 'invalid', 'Identificador inválido.');
  if (request.method === 'GET') {
    const r = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = '_anexos' AND id = ?").bind(id).first();
    if (!r) return erro(404, 'not_found', 'Comprovante não encontrado.');
    const d = JSON.parse(r.dados); return json({ nome: d.nome, tipo: d.tipo, b64: d.b64 });
  }
  if (request.method === 'DELETE') { await env.DB.prepare("DELETE FROM docs WHERE colecao = '_anexos' AND id = ?").bind(id).run(); return json({ ok: true }); }
  return erro(405, 'method', 'Método não permitido.');
}


/* ---------- notificações push: resumo do que vence hoje (10h, horário de Brasília) e alertas novos ---------- */
const FUSO_MS = -3 * 3600e3, MAX_NOTIF_ITENS = 4;
const hojeBR = () => new Date(Date.now() + FUSO_MS).toISOString().slice(0, 10);
const mesBR = () => hojeBR().slice(0, 7);
async function lerReservado(env, id, padrao) { const r = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = '_notif' AND id = ?").bind(id).first(); return r ? JSON.parse(r.dados) : padrao; }
const gravarReservado = (env, id, dados) => gravar(env, '_notif', id, dados);
async function vapid(env) {
  let v = await lerReservado(env, 'vapid', null);
  if (!v) { v = await gerarChavesVapid(); await gravarReservado(env, 'vapid', v); }
  return v;
}
async function inscricoes(env) {
  const { results } = await env.DB.prepare("SELECT id, dados FROM docs WHERE colecao = '_notif' AND id LIKE 'sub-%'").all();
  return results.map((r) => ({ id: r.id, ...JSON.parse(r.dados) }));
}
const hashCurto = async (s) => b64u(await sha256('sub:' + s)).slice(0, 24);
const moeda = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const diasEntre = (de, ate) => Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 864e5);
/* prazos que merecem aviso hoje: no dia e nos dias de antecedência escolhidos (padrão 5, 2 e 1 dia antes) */
export function prazosDoDia(prazos, hoje) {
  return (Array.isArray(prazos) ? prazos : []).map((p) => ({ ...p, dif: diasEntre(hoje, p.d) })).filter((p) => p.dif >= 0 && (Array.isArray(p.a) ? p.a : [5, 2, 1, 0]).includes(p.dif)).sort((x, y) => x.d.localeCompare(y.d) || (x.h || '').localeCompare(y.h || ''));
}
export function montarNotificacoes(resumo, config, enviados, hoje, mes, pubs = []) {
  { const vistos = new Set(); pubs = pubs.filter((p, i) => { const k = p.processo ? [p.processo, p.data, p.tipo || '', p.orgao || ''].join('|') : 'sem-' + i; if (vistos.has(k)) return false; vistos.add(k); return true; }); }   // várias publicações idênticas (um autor cada) contam uma vez
  const lista = [];
  const esconder = !!config.esconder;
  const itens = (resumo.itens || []).filter((i) => i.d === hoje);
  if (itens.length) {
    const linhas = itens.slice(0, MAX_NOTIF_ITENS).map((i) => `${i.n}${i.l ? ' · ' + i.l : ''}${i.v != null ? ' · ' + moeda(i.v) : ''}`);
    if (itens.length > MAX_NOTIF_ITENS) linhas.push(`e mais ${itens.length - MAX_NOTIF_ITENS}`);
    lista.push({ tag: 'hoje-' + hoje, titulo: itens.length === 1 ? '1 item vence hoje' : `${itens.length} itens vencem hoje`, corpo: esconder ? 'Abra o app para ver.' : linhas.join('\n'), url: '/' });
  }
  const prazos = prazosDoDia(resumo.prazos, hoje);
  if (prazos.length) {
    const nHoje = prazos.filter((p) => p.dif === 0).length, nBreve = prazos.length - nHoje;
    const partes = []; if (nHoje) partes.push(`${nHoje} ${nHoje === 1 ? 'vence' : 'vencem'} hoje`); if (nBreve) partes.push(`${nBreve} nos próximos dias`);
    const linhas = prazos.slice(0, MAX_NOTIF_ITENS).map((p) => `${p.l}${p.n ? ' · ' + p.n : ''}${p.h ? ' · ' + p.h : ''} (${p.dif === 0 ? 'HOJE' : p.dif === 1 ? 'amanhã' : 'em ' + p.dif + ' dias'})`);
    if (prazos.length > MAX_NOTIF_ITENS) linhas.push(`e mais ${prazos.length - MAX_NOTIF_ITENS}`);
    lista.push({ tag: 'prazos-' + hoje, titulo: 'Prazos: ' + partes.join(', '), corpo: esconder ? 'Abra o app para ver.' : linhas.join('\n'), url: '/' });
  }
  if (pubs.length) {
    const linhas = pubs.slice(0, MAX_NOTIF_ITENS).map((p) => `${p.tribunal ? p.tribunal + ' · ' : ''}${p.tipo || 'Publicação'}${p.numero ? ' · ' + p.numero : ''}`);
    if (pubs.length > MAX_NOTIF_ITENS) linhas.push(`e mais ${pubs.length - MAX_NOTIF_ITENS}`);
    lista.push({ tag: 'pub-' + hoje, titulo: pubs.length === 1 ? '1 nova publicação no Diário Oficial' : `${pubs.length} novas publicações no Diário Oficial`, corpo: esconder ? 'Abra o app para ver.' : linhas.join('\n'), url: '/' });
  }
  if (config.alertas !== false) {
    const vistos = enviados.alertas || {};
    (resumo.alertas || []).filter((a) => a.chave && vistos[a.chave] !== mes).slice(0, 3).forEach((a) => {
      lista.push({ tag: 'alerta-' + a.chave, chaveAlerta: a.chave, titulo: a.titulo, corpo: esconder ? 'Abra o app para ver.' : (a.detalhe || ''), url: '/' });
    });
  }
  return lista;
}
export async function enviarResumoDiario(env, opcoes = {}) {
  const resumo = await lerReservado(env, 'resumo', { itens: [], alertas: [] }), config = await lerReservado(env, 'config', {});
  const enviados = await lerReservado(env, 'enviados', { alertas: {} }), hoje = hojeBR(), mes = mesBR();
  enviados.alertas = enviados.alertas || {};
  if (!opcoes.forcar && enviados.dia === hoje) return { enviadas: 0, motivo: 'já enviado hoje' };
  const subs = await inscricoes(env);
  if (!subs.length) return { enviadas: 0, motivo: 'sem aparelhos inscritos' };
  const pubs = opcoes.teste ? [] : await pubsParaAvisar(env).catch(() => []);
  const lista = opcoes.teste ? [{ tag: 'teste', titulo: 'Notificação de teste', corpo: 'Se você está lendo isto, as notificações do Horus estão funcionando.', url: '/' }] : montarNotificacoes(resumo, config, enviados, hoje, mes, pubs);
  const v = await vapid(env);
  const origem = config.origem || env.APP_ORIGEM || 'https://controle-juridico.hygorlima10.workers.dev';
  const assuntos = [...new Set([env.PUSH_ASSUNTO, config.subOk, origem, 'mailto:contato@' + new URL(origem).hostname].filter(Boolean))];
  let subUsado = config.subOk || null;
  let enviadas = 0; const falhas = [];
  for (const n of lista) {
    for (const s of subs) {
      let r = null;
      for (const a of assuntos) {
        r = await enviarPush(v, a, s, { titulo: n.titulo, corpo: n.corpo, tag: n.tag, url: n.url });
        if (r.ok) { subUsado = a; break; }
        if (!(r.status === 403 && /BadJwtToken/i.test(r.motivo || ''))) break;   // só insiste com outro contato quando a recusa é do token
      }
      if (r.ok) enviadas++;
      else falhas.push({ status: r.status, motivo: r.motivo || r.erro || '' });
      if (!r.ok && r.remover) await env.DB.prepare("DELETE FROM docs WHERE colecao = '_notif' AND id = ?").bind(s.id).run();
    }
    if (n.chaveAlerta && !opcoes.teste) enviados.alertas[n.chaveAlerta] = mes;
  }
  if (subUsado && subUsado !== config.subOk && enviadas) await gravarReservado(env, 'config', { ...config, subOk: subUsado });
  if (!opcoes.teste) {
    Object.keys(enviados.alertas).forEach((k) => { if (enviados.alertas[k] < mes) delete enviados.alertas[k]; });   // guarda só o mês atual
    enviados.dia = hoje; await gravarReservado(env, 'enviados', enviados);
    if (pubs.length) await marcarAvisadas(env, pubs.map((p) => p.id)).catch((e) => console.error(e));
  }
  return { enviadas, notificacoes: lista.length, falhas: falhas.slice(0, 3) };
}
async function notif(request, env, partes) {
  const acao = partes[1], m = request.method;
  { const c0 = await lerReservado(env, 'config', { alertas: true, esconder: false }), o = new URL(request.url).origin;
    if (c0.origem !== o && acao !== 'config') await gravarReservado(env, 'config', { ...c0, origem: o }); }
  if (acao === 'chave' && m === 'GET') return json({ publica: (await vapid(env)).publica });
  if (acao === 'estado' && m === 'GET') {
    const config = await lerReservado(env, 'config', { alertas: true, esconder: false }), subs = await inscricoes(env), resumo = await lerReservado(env, 'resumo', null);
    return json({ aparelhos: subs.length, config: { alertas: config.alertas !== false, esconder: !!config.esconder }, resumoEm: resumo ? resumo.geradoEm : null, hora: '10:00' });
  }
  if (acao === 'inscrever' && m === 'POST') {
    const s = await request.json().catch(() => null);
    if (!s || !s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth || !/^https:\/\//.test(s.endpoint) && !/^http:\/\/127\.0\.0\.1/.test(s.endpoint)) return erro(400, 'invalid', 'Inscrição inválida.');
    await gravarReservado(env, 'sub-' + (await hashCurto(s.endpoint)), { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, em: new Date().toISOString() });
    return json({ ok: true });
  }
  if (acao === 'inscrever' && m === 'DELETE') {
    const s = await request.json().catch(() => null);
    if (s && s.endpoint) await env.DB.prepare("DELETE FROM docs WHERE colecao = '_notif' AND id = ?").bind('sub-' + (await hashCurto(s.endpoint))).run();
    return json({ ok: true });
  }
  if (acao === 'config' && m === 'PUT') {
    const c = await request.json().catch(() => null);
    if (!c || typeof c !== 'object') return erro(400, 'invalid', 'Configuração inválida.');
    const antigo = await lerReservado(env, 'config', {});
    await gravarReservado(env, 'config', { ...antigo, alertas: c.alertas !== false, esconder: !!c.esconder });
    return json({ ok: true });
  }
  if (acao === 'resumo' && m === 'PUT') {
    const txt = await request.text();
    if (txt.length > 200 * 1024) return erro(413, 'quota_exceeded', 'Resumo grande demais.');
    let r; try { r = JSON.parse(txt); } catch (e) { return erro(400, 'invalid', 'JSON inválido.'); }
    const limpa = (s) => String(s == null ? '' : s).slice(0, 140);
    const itens = (Array.isArray(r.itens) ? r.itens : []).slice(0, 300).filter((i) => i && /^\d{4}-\d{2}-\d{2}$/.test(i.d || '')).map((i) => ({ d: i.d, t: limpa(i.t), n: limpa(i.n), l: limpa(i.l), v: i.v == null ? null : Number(i.v) || 0 }));
    const alertas = (Array.isArray(r.alertas) ? r.alertas : []).slice(0, 10).filter((a) => a && a.chave).map((a) => ({ chave: limpa(a.chave), titulo: limpa(a.titulo), detalhe: limpa(a.detalhe) }));
    const prazos = (Array.isArray(r.prazos) ? r.prazos : []).slice(0, 200).filter((p) => p && /^\d{4}-\d{2}-\d{2}$/.test(p.d || '')).map((p) => ({ d: p.d, h: /^\d{2}:\d{2}$/.test(p.h || '') ? p.h : '', n: limpa(p.n), l: limpa(p.l), t: ['prazo', 'audiencia', 'tarefa'].includes(p.t) ? p.t : 'prazo', a: (Array.isArray(p.a) ? p.a : [5, 2, 1, 0]).map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 30).slice(0, 8) }));
    await gravarReservado(env, 'resumo', { geradoEm: new Date().toISOString(), itens, alertas, prazos });
    return json({ ok: true, itens: itens.length, alertas: alertas.length, prazos: prazos.length });
  }
  if (acao === 'teste' && m === 'POST') return json(await enviarResumoDiario(env, { teste: true, forcar: true }));
  if (acao === 'agora' && m === 'POST') return json(await enviarResumoDiario(env, { forcar: !!new URL(request.url).searchParams.get('forcar') }));
  return erro(404, 'not_found', 'Não encontrado.');
}

/* ---------- API do banco ---------- */
async function api(request, env, partes, auth) {
  // partes: ['db', colecao, id?]  |  ['backup']
  const metodo = request.method;
  if (partes[0] === 'backup' && metodo === 'GET') {
    const { results } = await env.DB.prepare("SELECT colecao, id, dados FROM docs WHERE colecao NOT LIKE '\\_%' ESCAPE '\\' ORDER BY colecao, id").all();
    return json({ versao: 1, exportadoEm: new Date().toISOString(), docs: results.map((r) => ({ colecao: r.colecao, id: r.id, dados: JSON.parse(r.dados) })) });
  }
  if (partes[0] !== 'db' || !partes[1] || !NOME.test(partes[1])) return erro(404, 'not_found', 'Não encontrado.');
  const id = partes[2];
  if (id !== undefined && !NOME.test(id)) return erro(400, 'invalid', 'Identificador inválido.');
  const colecao = resolverColecao(partes[1], id);   // config/<documento do proprietário> vai para configDono (compatível com o app já aberto)
  const recusa = checarColecao(colecao, auth); if (recusa) return recusa;

  if (!id && metodo === 'GET') {
    const lim = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('limit') || '1000', 10) || 1000, 1), MAX_LISTA);
    let { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ? ORDER BY id LIMIT ?').bind(colecao, lim).all();
    if (colecao === 'config' && ehProprietario(auth)) {   // o proprietário (e o app já aberto antes da separação) continua vendo os seus documentos na lista de config
      const dono = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ? ORDER BY id').bind('configDono').all();
      results = [...results, ...dono.results].sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, lim);
    }
    return json({ docs: results.map((r) => ({ id: r.id, data: JSON.parse(r.dados) })) });
  }
  if (!id && metodo === 'POST') {
    const dados = await lerDoc(request); if (dados instanceof Response) return dados;
    const novo = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    if (registraColecao(colecao)) await env.DB.batch([stmtGravar(env, colecao, novo, dados), stmtRegistro(env, { op: 'criou', colecao, id: novo, titulo: tituloDe(colecao, dados) })]);
    else await gravar(env, colecao, novo, dados);
    return json({ id: novo });
  }
  if (id && metodo === 'PUT') {
    const dados = await lerDoc(request); if (dados instanceof Response) return dados;
    if (new URL(request.url).searchParams.get('soNovo') === '1') {
      /* só cria: se já existe um registro com esse id (outro aparelho acabou de criar), não mexe nele e avisa */
      const r = await env.DB.prepare('INSERT OR IGNORE INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?)').bind(colecao, id, JSON.stringify(dados), Date.now()).run();
      const criado = !!(r && r.meta && r.meta.changes > 0);
      if (criado && registraColecao(colecao)) await stmtRegistro(env, { op: 'criou', colecao, id, titulo: tituloDe(colecao, dados) }).run();
      return json({ ok: true, criado });
    }
    if (!registraColecao(colecao)) { await gravar(env, colecao, id, dados); return json({ ok: true }); }
    const antes = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(colecao, id).first();
    const antesObj = antes ? JSON.parse(antes.dados) : null, mud = antesObj ? mudancas(antesObj, dados) : [];
    if (antesObj && !mud.length) { await gravar(env, colecao, id, dados); return json({ ok: true }); }   // nada mudou de verdade (só campos de controle): grava, mas não há o que registrar
    await env.DB.batch([stmtGravar(env, colecao, id, dados), stmtRegistro(env, antesObj ? { op: 'alterou', colecao, id, titulo: tituloDe(colecao, dados), mud } : { op: 'criou', colecao, id, titulo: tituloDe(colecao, dados) })]);
    return json({ ok: true });
  }
  if (id && metodo === 'DELETE') {
    const antes = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(colecao, id).first();
    const cmds = [env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(colecao, id)];
    if (antes && vaiParaLixeira(colecao)) cmds.push(stmtLixeira(env, colecao, id, antes.dados));   // a exclusão vira cópia na lixeira (30 dias) na mesma operação
    if (antes && registraColecao(colecao)) cmds.push(stmtRegistro(env, { op: 'excluiu', colecao, id, titulo: tituloDe(colecao, JSON.parse(antes.dados)) }));
    await env.DB.batch(cmds);
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
const stmtGravar = (env, colecao, id, dados) =>
  env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(colecao, id, JSON.stringify(dados), Date.now());
const gravar = (env, colecao, id, dados) => stmtGravar(env, colecao, id, dados).run();

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(event.cron === '0 13 * * *' ? (async () => { try { await lerDjen(env); } catch (e) { console.error('leitura do DJEN', e); } try { await limparSeguranca(env); } catch (e) { console.error('limpeza', e); } await enviarResumoDiario(env); })() : (event.cron === '0 15,17,19,21 * * *' ? relerSePreciso(env).catch((e) => console.error('releitura do DJEN', e)) : fazerBackup(env)));
  },
  async fetch(request, env, ctx) {
    return comSeguranca(await tratar(request, env, ctx));
  },
};
const ICONES = new Set(['/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/favicon-32.png', '/favicon-48.png', '/favicon.ico', '/tema.css', '/manifest.webmanifest', '/sw.js']);

/* Tabela única de rotas da API: cada raiz declara quem pode usar ("sessao" = qualquer acesso logado; "proprietario" = só o proprietário).
   Raiz que não está aqui é recusada; /api/enviar é a única pública (tem token próprio). */
const ROTAS = {
  ler: ['proprietario', (r, e, p) => ler(r, e, p)], recebidos: ['proprietario', (r, e, p) => recebidos(r, e, p)], anexos: ['proprietario', (r, e, p) => anexos(r, e, p)],
  notif: ['sessao', (r, e, p) => notif(r, e, p)], djen: ['sessao', (r, e, p) => djenRotas(r, e, p)], datajud: ['sessao', (r, e, p) => datajudRotas(r, e, p)],
  db: ['sessao', (r, e, p, au) => api(r, e, p, au)],
  lote: ['sessao', (r, e, p, au) => loteRotas(r, e, p, au, { stmtGravar, NOME, MAX_DOC, checarColecao, resolverColecao })],
  backup: ['proprietario', (r, e, p, au) => api(r, e, p, au)], backups: ['proprietario', (r, e, p) => backups(r, e, p)], restaurar: ['proprietario', (r, e, p) => restauracaoRotas(r, e, p)],
  lixeira: ['proprietario', (r, e, p) => lixeiraRotas(r, e, p)], auditoria: ['proprietario', (r, e, p) => auditoriaRotas(r, e, p)],
  seguranca: ['proprietario', (r, e, p, a) => segurancaRotas(r, e, p, a)],
  eu: ['sessao', (r, e, p, a) => json({ papel: a && a.usuario ? a.usuario.papel : 'proprietario' })],   // quem está usando (a tela esconde o que é só do proprietário)
};
export const RAIZES_API = Object.keys(ROTAS);

/* aviso curto no iPhone (entrada em aparelho novo, senha errada repetida…): usa as inscrições de notificação já cadastradas */
async function enviarAviso(env, aviso) {
  const subs = await inscricoes(env); if (!subs.length) return;
  const v = await vapid(env), config = await lerReservado(env, 'config', {}), origem = config.origem || env.APP_ORIGEM || 'https://controle-juridico.hygorlima10.workers.dev';
  const assuntos = [...new Set([env.PUSH_ASSUNTO, config.subOk, origem, 'mailto:contato@' + new URL(origem).hostname].filter(Boolean))];
  for (const s of subs) {
    for (const a of assuntos) {
      const r = await enviarPush(v, a, s, aviso);
      if (r.ok) break;
      if (r.remover) await env.DB.prepare("DELETE FROM docs WHERE colecao = '_notif' AND id = ?").bind(s.id).run();
      if (!(r.status === 403 && /BadJwtToken/i.test(r.motivo || ''))) break;
    }
  }
}
const MODO_ANTIGO = (env) => env.ALLOW_NO_AUTH === '1' || env.LOGIN_ANTIGO === '1';   // LOGIN_ANTIGO=1: volta ao acesso por uma senha só (chave de retorno)

async function tratar(request, env, ctx) {
  const url = new URL(request.url);
  const dev = env.ALLOW_NO_AUTH === '1', antigo = MODO_ANTIGO(env);
  if (!dev && (!env.SENHA || String(env.SENHA).length < 12)) return new Response('Defina o segredo SENHA (mínimo 12 caracteres) no Cloudflare.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (ICONES.has(url.pathname)) return env.ASSETS.fetch(request);   // ícones e manifesto: públicos (o iPhone os busca sem sessão)
  const deps = { legadoValido: (r) => sessaoValida(r, env), criarLegado: () => criarSessao(env), avisar: (e, aviso) => { try { ctx && ctx.waitUntil ? ctx.waitUntil(enviarAviso(e, aviso).catch((x) => console.error('aviso', x))) : enviarAviso(e, aviso).catch(() => {}); } catch (x) { console.error(x); } } };
  if (!antigo) { const pg = await paginasDeAcesso(request, env, deps); if (pg) return pg; }
  else {
    if (url.pathname === '/login') {
      if (request.method === 'POST') return dev ? new Response(null, { status: 303, headers: { location: '/' } }) : fazerLogin(request, env);
      return htmlResp(PAGINA(''));
    }
    if (url.pathname === '/sair') return new Response(null, { status: 303, headers: { location: '/login', 'set-cookie': 'sessao=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' } });
  }
  if (url.pathname === '/api/enviar') return enviar(request, env);   // autenticada por token próprio
  let auth = null;
  if (!antigo) {
    auth = await autenticar(request, env);
    if (!auth) {
      if (url.pathname.startsWith('/api/')) return erro(401, 'not_granted', 'Entre com o seu e-mail e a sua senha.');
      return new Response(null, { status: 303, headers: { location: (await deps.legadoValido(request)) && !(await temProprietario(env)) ? '/criar-acesso' : '/login' } });   // quem entrou com a senha antiga segue para criar o acesso individual
    }
  } else if (!dev && !(await sessaoValida(request, env))) {
    if (url.pathname.startsWith('/api/')) return erro(401, 'not_granted', 'Entre com a senha.');
    return new Response(null, { status: 303, headers: { location: '/login' } });
  }
  try { await garantirMigracoes(env); } catch (e) { console.error('migração', e); }
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') {   // proteção extra contra pedidos vindos de outros sites
      const o = request.headers.get('origin');
      if (o && new URL(o).host !== url.host) return erro(403, 'forbidden', 'Origem não permitida.');
    }
    const partes = url.pathname.slice(5).split('/').filter(Boolean), rota = ROTAS[partes[0]];
    if (!rota) return erro(404, 'not_found', 'Não encontrado.');
    if (rota[0] === 'proprietario' && auth && auth.usuario.papel !== 'proprietario') return erro(403, 'forbidden', 'Só o proprietário pode usar isto.');
    try { return await rota[1](request, env, partes, auth); }
    catch (e) { console.error(e); return erro(500, 'server', 'Erro no servidor.'); }
  }
  return env.ASSETS.fetch(request);
}
