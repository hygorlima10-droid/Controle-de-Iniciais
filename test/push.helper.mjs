// Ajudante dos testes: finge ser o aparelho (gera as chaves da inscrição) e decifra o que o servidor envia.
import { webcrypto as crypto } from 'node:crypto';
export const b64u = (b) => Buffer.from(b).toString('base64url');
export const deB64u = (s) => new Uint8Array(Buffer.from(s, 'base64url'));
const enc = new TextEncoder();
const concat = (...as) => Buffer.concat(as.map((a) => Buffer.from(a)));
async function hkdf(sal, ikm, info, tam) { const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']); return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, k, tam * 8)); }
export async function novoAparelho() {
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
  return { par, pub, auth, p256dh: b64u(pub), authB64: b64u(auth) };
}
export async function decifrar(ap, corpo) {
  const b = new Uint8Array(corpo), sal = b.slice(0, 16), idlen = b[20], asPub = b.slice(21, 21 + idlen), cifrado = b.slice(21 + idlen);
  const asChave = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const segredo = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asChave }, ap.par.privateKey, 256));
  const prk = await hkdf(ap.auth, segredo, concat(enc.encode('WebPush: info\0'), ap.pub, asPub), 32);
  const cek = await hkdf(sal, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(sal, prk, enc.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  let txt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, cifrado));
  let fim = txt.length; while (fim > 0 && txt[fim - 1] === 0) fim--;
  if (txt[fim - 1] !== 2) throw new Error('preenchimento inválido');
  return JSON.parse(new TextDecoder().decode(txt.slice(0, fim - 1)));
}
export async function verificarJwt(jwt, publicaB64) {
  const [h, p, s] = jwt.split('.'), pub = deB64u(publicaB64);
  const k = await crypto.subtle.importKey('raw', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, deB64u(s), enc.encode(h + '.' + p));
  return { ok, cab: JSON.parse(Buffer.from(h, 'base64url')), corpo: JSON.parse(Buffer.from(p, 'base64url')) };
}
