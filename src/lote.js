/* Gravação em lote, tudo ou nada: POST /api/lote { ops: [ { acao: 'gravar', colecao, id, dados } | { acao: 'excluir', colecao, id } ] }.
   Serve para o que precisa ficar junto (ex.: transferência PJ/PF = uma despesa + uma receita): o D1 executa o lote numa transação só,
   então ou grava tudo, ou nada. Cada operação gera o mesmo registro de ações e a mesma lixeira que a API comum. */
import { stmtRegistro, stmtLixeira, registraColecao, vaiParaLixeira, tituloDe, mudancas } from './auditoria.js';

const MAX_OPS = 25;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);

export async function loteRotas(request, env, partes, auth, { stmtGravar, NOME, MAX_DOC }) {
  if (request.method !== 'POST') return erro(405, 'method', 'Use POST.');
  const txt = await request.text();
  if (txt.length > MAX_DOC * 4) return erro(413, 'quota_exceeded', 'Lote grande demais.');
  let corpo; try { corpo = JSON.parse(txt); } catch (e) { return erro(400, 'invalid', 'JSON inválido.'); }
  const ops = corpo && Array.isArray(corpo.ops) ? corpo.ops : null;
  if (!ops || !ops.length || ops.length > MAX_OPS) return erro(400, 'invalid', 'Envie de 1 a ' + MAX_OPS + ' operações.');
  const vistos = new Set();
  for (const o of ops) {
    if (!o || typeof o !== 'object' || !['gravar', 'excluir'].includes(o.acao) || !NOME.test(String(o.colecao || '')) || !NOME.test(String(o.id || ''))) return erro(400, 'invalid', 'Operação inválida.');
    if (vistos.has(o.colecao + '|' + o.id)) return erro(400, 'invalid', 'Registro repetido no lote.');
    vistos.add(o.colecao + '|' + o.id);
    if (o.acao === 'gravar') {
      if (!o.dados || typeof o.dados !== 'object' || Array.isArray(o.dados)) return erro(400, 'invalid', 'O registro precisa ser um objeto.');
      if (JSON.stringify(o.dados).length > MAX_DOC) return erro(413, 'quota_exceeded', 'Registro grande demais.');
    }
  }
  const cmds = [];
  for (const o of ops) {
    const antes = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(o.colecao, o.id).first(), antesObj = antes ? JSON.parse(antes.dados) : null;
    if (o.acao === 'gravar') {
      cmds.push(stmtGravar(env, o.colecao, o.id, o.dados));
      if (registraColecao(o.colecao)) {
        const mud = antesObj ? mudancas(antesObj, o.dados) : [];
        if (!antesObj) cmds.push(stmtRegistro(env, { op: 'criou', colecao: o.colecao, id: o.id, titulo: tituloDe(o.colecao, o.dados) }));
        else if (mud.length) cmds.push(stmtRegistro(env, { op: 'alterou', colecao: o.colecao, id: o.id, titulo: tituloDe(o.colecao, o.dados), mud }));
      }
    } else if (antes) {
      cmds.push(env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(o.colecao, o.id));
      if (vaiParaLixeira(o.colecao)) cmds.push(stmtLixeira(env, o.colecao, o.id, antes.dados));
      if (registraColecao(o.colecao)) cmds.push(stmtRegistro(env, { op: 'excluiu', colecao: o.colecao, id: o.id, titulo: tituloDe(o.colecao, antesObj) }));
    }
  }
  if (cmds.length) await env.DB.batch(cmds);
  return json({ ok: true, operacoes: ops.length });
}
