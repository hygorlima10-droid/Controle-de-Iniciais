/* Gravação em lote, tudo ou nada: POST /api/lote { ops: [ { acao: 'gravar', colecao, id, dados } | { acao: 'excluir', colecao, id } ] }.
   Serve para o que precisa ficar junto (ex.: transferência PJ/PF = uma despesa + uma receita): o D1 executa o lote numa transação só,
   então ou grava tudo, ou nada. Cada operação gera o mesmo registro de ações e a mesma lixeira que a API comum. */
import { stmtRegistro, stmtLixeira, registraColecao, vaiParaLixeira, tituloDe, mudancas, autorDe } from './auditoria.js';

const MAX_OPS = 25;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);

export async function loteRotas(request, env, partes, auth, { stmtGravar, NOME, MAX_DOC, checarColecao, resolverColecao, autorizarGravacao, autorizarExclusao, atividade, CONFLITO }) {
  if (request.method !== 'POST') return erro(405, 'method', 'Use POST.');
  const txt = await request.text();
  if (txt.length > MAX_DOC * 4) return erro(413, 'quota_exceeded', 'Lote grande demais.');
  let corpo; try { corpo = JSON.parse(txt); } catch (e) { return erro(400, 'invalid', 'JSON inválido.'); }
  const ops = corpo && Array.isArray(corpo.ops) ? corpo.ops : null;
  if (!ops || !ops.length || ops.length > MAX_OPS) return erro(400, 'invalid', 'Envie de 1 a ' + MAX_OPS + ' operações.');
  const vistos = new Set();
  for (const o of ops) {
    if (o && typeof o === 'object' && typeof o.colecao === 'string' && typeof o.id === 'string') { o.colecao = resolverColecao(o.colecao, o.id); const recusa = checarColecao(o.colecao, auth); if (recusa) return recusa; }
    if (!o || typeof o !== 'object' || !['gravar', 'excluir'].includes(o.acao) || !NOME.test(String(o.colecao || '')) || !NOME.test(String(o.id || ''))) return erro(400, 'invalid', 'Operação inválida.');
    if (vistos.has(o.colecao + '|' + o.id)) return erro(400, 'invalid', 'Registro repetido no lote.');
    vistos.add(o.colecao + '|' + o.id);
    if (o.acao === 'gravar') {
      if (!o.dados || typeof o.dados !== 'object' || Array.isArray(o.dados)) return erro(400, 'invalid', 'O registro precisa ser um objeto.');
      if (JSON.stringify(o.dados).length > MAX_DOC) return erro(413, 'quota_exceeded', 'Registro grande demais.');
    }
  }
  const cmds = [], feitos = [];
  for (const o of ops) {
    const antes = await env.DB.prepare('SELECT dados, atualizado FROM docs WHERE colecao = ? AND id = ?').bind(o.colecao, o.id).first(), antesObj = antes ? JSON.parse(antes.dados) : null;
    /* versão esperada (auditoria F-06): o app manda a versão que leu (`base`); se o registro mudou depois e o conteúdo é diferente, o lote inteiro é recusado e nada é gravado nem apagado */
    const base = parseInt(o.base, 10);
    if (CONFLITO && CONFLITO.has(o.colecao) && base > 0 && antes && antes.atualizado > base && (o.acao === 'excluir' || antes.dados !== JSON.stringify(o.dados))) return new Response(JSON.stringify({ error: { code: 'conflict', message: 'Um dos registros foi alterado em outro aparelho. Atualize a tela e tente de novo.' }, colecao: o.colecao, id: o.id }), { status: 409, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    const dono = !auth || !auth.usuario || auth.usuario.papel === 'proprietario';
    if (dono && o.acao === 'gravar' && auth && auth.usuario && (o.colecao === 'agenda' || o.colecao === 'clientes')) { if (!antesObj) { if (!o.dados.criadoPor) o.dados.criadoPor = auth.usuario.id; } else if (antesObj.criadoPor) o.dados.criadoPor = antesObj.criadoPor; }
    if (!dono) { const neg = o.acao === 'gravar' ? await autorizarGravacao(env, o.colecao, o.id, antesObj, o.dados, auth) : await autorizarExclusao(env, o.colecao, o.id, antesObj, auth); if (neg) return neg; }
    if (o.acao === 'gravar') {
      cmds.push(stmtGravar(env, o.colecao, o.id, o.dados));
      if (registraColecao(o.colecao)) {
        const mud = antesObj ? mudancas(antesObj, o.dados) : [];
        if (!antesObj) cmds.push(stmtRegistro(env, { op: 'criou', colecao: o.colecao, id: o.id, titulo: tituloDe(o.colecao, o.dados), dados: o.dados, ...autorDe(auth) }));
        else if (mud.length) cmds.push(stmtRegistro(env, { op: 'alterou', colecao: o.colecao, id: o.id, titulo: tituloDe(o.colecao, o.dados), mud, dados: o.dados, ...autorDe(auth) }));
        if (!antesObj || mud.length) feitos.push({ colecao: o.colecao, id: o.id, antes: antesObj, depois: o.dados, acao: antesObj ? 'alterou' : 'criou', auth });
      }
    } else if (antes) {
      cmds.push(env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(o.colecao, o.id));
      if (vaiParaLixeira(o.colecao)) cmds.push(stmtLixeira(env, o.colecao, o.id, antes.dados));
      if (registraColecao(o.colecao)) { cmds.push(stmtRegistro(env, { op: 'excluiu', colecao: o.colecao, id: o.id, titulo: tituloDe(o.colecao, antesObj), dados: antesObj, ...autorDe(auth) })); feitos.push({ colecao: o.colecao, id: o.id, antes: antesObj, depois: null, acao: 'excluiu', auth }); }
    }
  }
  if (cmds.length) await env.DB.batch(cmds);
  if (atividade) for (const f of feitos) await atividade(env, f);
  return json({ ok: true, operacoes: ops.length });
}
