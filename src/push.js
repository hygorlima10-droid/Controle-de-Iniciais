/* Notificações push (Web Push, RFC 8030/8291/8292) para o app instalado na tela de início.
   Só usa WebCrypto, sem bibliotecas. As chaves VAPID são geradas na primeira vez e ficam no banco (área reservada). */
const enc = new TextEncoder();
export const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const deB64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(s).length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const concat = (...as) => { const n = as.reduce((t, a) => t + a.length, 0), o = new Uint8Array(n); let i = 0; for (const a of as) { o.set(a, i); i += a.length; } return o; };

export async function gerarChavesVapid() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  return { publica: b64u(pub), privada: jwk.d };
}
async function importarPrivadaVapid(v) {
  const pub = deB64u(v.publica);
  return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: v.privada, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}
export async function jwtVapid(vapid, endpoint, assunto) {
  const aud = new URL(endpoint).origin, exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const cab = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))), corpo = b64u(enc.encode(JSON.stringify({ aud, exp, sub: assunto })));
  const ass = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await importarPrivadaVapid(vapid), enc.encode(cab + '.' + corpo));
  return cab + '.' + corpo + '.' + b64u(ass);
}
async function hkdf(sal, ikm, info, tam) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, k, tam * 8));
}
/* aes128gcm (RFC 8291): devolve o corpo da requisição */
export async function cifrar(carga, p256dh, auth) {
  const uaPub = deB64u(p256dh), authSecret = deB64u(auth);
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const uaChave = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const segredo = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaChave }, par.privateKey, 256));
  const prk = await hkdf(authSecret, segredo, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(sal, prk, enc.encode('Content-Encoding: nonce\0'), 12);
  const chaveAes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const texto = concat(enc.encode(typeof carga === 'string' ? carga : JSON.stringify(carga)), new Uint8Array([2]));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, chaveAes, texto));
  const rs = new Uint8Array([0, 0, 0x10, 0]);   // 4096
  return concat(sal, rs, new Uint8Array([asPub.length]), asPub, cifrado);
}
/* envia uma notificação; devolve { ok, status, remover } (remover = a inscrição não vale mais) */
export async function enviarPush(vapid, assunto, inscricao, carga, ttl = 43200) {
  try {
    const corpo = await cifrar(carga, inscricao.keys.p256dh, inscricao.keys.auth);
    const jwt = await jwtVapid(vapid, inscricao.endpoint, assunto);
    const r = await fetch(inscricao.endpoint, { method: 'POST', headers: { 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(ttl), urgency: 'normal', authorization: `vapid t=${jwt}, k=${vapid.publica}` }, body: corpo });
    const ok = r.status >= 200 && r.status < 300;
    let motivo = ''; if (!ok) { try { motivo = String(await r.text()).replace(/\s+/g, ' ').slice(0, 160); } catch (e) {} }
    return { ok, status: r.status, remover: r.status === 404 || r.status === 410, motivo };
  } catch (e) { return { ok: false, status: 0, remover: false, erro: String(e && e.message || e) }; }
}
