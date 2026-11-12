/* Advogados responsáveis (Fase 5, etapa 5.4):
   - GET  /api/equipe          (qualquer pessoa logada): a lista de advogados do escritório { oab, nome } para os seletores "Advogados responsáveis"
   - GET  /api/sem-advogado    (só o proprietário): registros (Inicial, Acordo, Alvará, Processo) sem advogado definido, com sugestão quando dá
   - POST /api/sem-advogado    (só o proprietário): { itens: [{ colecao, id }], advogados: [{ oab, nome }] } define os advogados nos itens escolhidos
   A sugestão vem de outros registros do mesmo processo ou do mesmo cliente que já têm advogado (nunca se inventa). */
import { COL_USU } from './acesso.js';
import { lerCfg } from './djen.js';
import { chaveOab } from './advogados.js';
import { stmtRegistro, tituloDe, ROTULOS } from './auditoria.js';
import { oabsDoRegistro, normNome, ehDono } from './politica.js';

const ALVOS = { casos: 'numeroProcesso', termosAcordo: 'numeroProcesso', alvaras: 'numeroProcesso', processos: 'numero' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);
const digitos = (s) => String(s == null ? '' : s).replace(/\D/g, '');
const nomeDe = (colecao, d) => String(colecao === 'processos' ? (d.partes || d.numero) : (d.cliente || d.numeroProcesso) || '').slice(0, 90);

/* advogados do escritório: as OABs monitoradas em Publicações + as OABs indicadas nos usuários (advogado e proprietário) */
export async function rosterAdvogados(env) {
  const mapa = new Map(), cfg = await lerCfg(env);
  for (const o of cfg.oabs || []) { const k = chaveOab(o.numero, o.uf); if (k.length > 3) mapa.set(k, { oab: k, nome: String(o.nome || '').slice(0, 80) || ('OAB ' + k) }); }
  const { results } = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ?').bind(COL_USU).all();
  for (const r of results) {
    const u = JSON.parse(r.dados); if (u.ativo === false || !['advogado', 'proprietario'].includes(u.papel)) continue;
    for (const o of u.oabs || []) if (!mapa.has(o)) mapa.set(o, { oab: o, nome: String(u.nome || '').slice(0, 80) });
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function equipeRotas(request, env) {
  if (request.method !== 'GET') return erro(405, 'method', 'Método não permitido.');
  return json({ advogados: await rosterAdvogados(env) });
}

async function carregarTudo(env) {
  const out = {};
  for (const col of Object.keys(ALVOS)) { const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ?').bind(col).all(); out[col] = results.map((r) => ({ id: r.id, d: JSON.parse(r.dados) })); }
  return out;
}
const unico = (listas) => { const alvo = listas[0]; return listas.every((l) => l.length === alvo.length && l.every((k) => alvo.includes(k))) ? alvo : null; };

export async function semAdvogadoRotas(request, env, partes, auth) {
  if (!ehDono(auth)) return erro(403, 'forbidden', 'Só o proprietário pode usar isto.');
  const tudo = await carregarTudo(env), roster = await rosterAdvogados(env), nomeDeOab = new Map(roster.map((r) => [r.oab, r.nome]));
  const m = request.method;
  if (m === 'GET') {
    const porProc = new Map(), porCli = new Map();
    for (const [col, campo] of Object.entries(ALVOS)) for (const { d } of tudo[col]) {
      const ks = oabsDoRegistro(d); if (!ks.length) continue;
      const num = digitos(d[campo]); if (num.length >= 15) porProc.set(num, [...new Set([...(porProc.get(num) || []), ...ks])]);
      const cli = normNome(d.cliente || ''); if (cli) { if (!porCli.has(cli)) porCli.set(cli, []); porCli.get(cli).push([...new Set(ks)].sort()); }
    }
    const itens = [];
    for (const [col, campo] of Object.entries(ALVOS)) for (const { id, d } of tudo[col]) {
      if (oabsDoRegistro(d).length || d.arquivado === true) continue;
      const num = digitos(d[campo]); let sug = null, motivo = '';
      if (num.length >= 15 && porProc.has(num)) { sug = porProc.get(num); motivo = 'outro registro deste processo'; }
      else { const cli = normNome(d.cliente || ''); if (cli && porCli.has(cli)) { sug = unico(porCli.get(cli)); if (sug) motivo = 'outros registros deste cliente'; } }
      itens.push({ colecao: col, id, rotulo: ROTULOS[col] || col, titulo: nomeDe(col, d), numero: String(d[campo] || ''), semNumero: num.length < 15, sugestao: sug ? sug.map((k) => ({ oab: k, nome: nomeDeOab.get(k) || k })) : [], motivo });
    }
    const contagem = {}; for (const i of itens) contagem[i.colecao] = (contagem[i.colecao] || 0) + 1;
    return json({ itens, contagem, advogados: roster });
  }
  if (m === 'POST') {
    const b = await request.json().catch(() => null) || {};
    if (!Array.isArray(b.itens) || !b.itens.length || b.itens.length > 200) return erro(400, 'invalid', 'Escolha de 1 a 200 registros.');
    const advs = [], vistos = new Set();
    for (const a of Array.isArray(b.advogados) ? b.advogados : []) {
      const k = typeof a === 'string' ? a : a && a.oab; if (!/^\d{3,8}\/[A-Z]{2}$/.test(String(k || '')) || vistos.has(k)) continue;
      vistos.add(k); advs.push({ oab: k, nome: nomeDeOab.get(k) || String((a && a.nome) || '').slice(0, 80) });
    }
    if (!advs.length) return erro(400, 'invalid', 'Escolha ao menos um advogado.');
    const agora = Date.now(), cmds = []; let n = 0;
    for (const it of b.itens) {
      if (!it || !ALVOS[it.colecao] || typeof it.id !== 'string') continue;
      const r = tudo[it.colecao].find((x) => x.id === it.id); if (!r) continue;
      const novo = { ...r.d, advogados: advs.slice(0, 12) };
      cmds.push(env.DB.prepare('UPDATE docs SET dados = ?, atualizado = ? WHERE colecao = ? AND id = ?').bind(JSON.stringify(novo), agora, it.colecao, it.id));
      cmds.push(stmtRegistro(env, { op: 'alterou', por: auth && auth.usuario ? auth.usuario.nome : 'Você', colecao: it.colecao, id: it.id, titulo: tituloDe(it.colecao, novo), mud: [{ c: 'advogados', a: oabsDoRegistro(r.d).length + ' itens', d: advs.map((a) => a.nome || a.oab).join(', ') }] }));
      n++;
    }
    for (let i = 0; i < cmds.length; i += 50) await env.DB.batch(cmds.slice(i, i + 50));
    return json({ ok: true, alterados: n });
  }
  return erro(405, 'method', 'Método não permitido.');
}
