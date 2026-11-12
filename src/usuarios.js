/* Usuários e convites (Fase 5, etapa 5.2): rotas /api/usuarios, só do proprietário.
   - convite: o proprietário informa nome, e-mail, papel (e as OABs, se for advogado); o servidor gera um link de 48 h e uso único
     (guarda só o resumo da chave, em _convites); a pessoa cria a própria senha na página /convite/<chave> (em acesso.js);
   - o proprietário nunca vê nem define a senha de ninguém; não há "excluir pessoa" (o histórico fica): só desativar/reativar. */
import { COL_USU, COL_SES, COL_CONV, hashConvite, emailJaTemAcesso, emailOk, stmtDoc, lerDoc } from './acesso.js';
import { stmtRegistro } from './auditoria.js';
import { chaveOab } from './advogados.js';
import { normalizarUsuario, PERMISSOES } from './politica.js';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const HORAS = 48, PAPEIS_CONVIDADO = ['advogado', 'estagiario'], ROTULO = { advogado: 'advogado', estagiario: 'estagiário', proprietario: 'proprietário' };
const SEM_SEGREDOS = (id, d) => ({ id, nome: d.nome || '', email: d.email || '', papel: d.papel, ativo: d.ativo !== false, criadoEm: d.criadoEm || '', convidadoPor: d.convidadoPor || '', ...(({ oabs, permissoes }) => ({ oabs, permissoes }))(normalizarUsuario({ ...d, id })) });

/* OABs digitadas ou escolhidas ("60456/GO" ou { numero, uf }) → chaves canônicas, sem repetir; sem limite de quantidade */
export function lerOabs(lista) {
  const out = [];
  for (const o of Array.isArray(lista) ? lista : []) {
    const k = typeof o === 'string' ? chaveOab(o.split('/')[0], o.split('/')[1]) : o ? chaveOab(o.numero, o.uf) : '';
    if (!/^\d{3,8}\/[A-Z]{2}$/.test(k)) return null;
    if (!out.includes(k)) out.push(k);
  }
  return out;
}
const lerPermissoes = (b) => { const o = {}; if (b && typeof b === 'object') for (const p of PERMISSOES) if (typeof b[p] === 'boolean') o[p] = b[p]; return o; };
const idCurto = (id) => id.slice(0, 16);

async function novoConvite(env, request, auth, dados) {
  const token = b64u(crypto.getRandomValues(new Uint8Array(32))), id = await hashConvite(token), agora = Date.now();
  const conv = { ...dados, por: auth.usuario.id, criado: agora, expira: agora + HORAS * 3600e3 };
  await stmtDoc(env, COL_CONV, id, conv).run();
  return { id: idCurto(id), link: new URL(request.url).origin + '/convite/' + token, expira: new Date(conv.expira).toISOString() };
}
const convitePorCurto = async (env, curto) => /^[0-9a-f]{16}$/.test(curto || '') ? env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ? AND id LIKE ?').bind(COL_CONV, curto + '%').first() : null;

export async function usuariosRotas(request, env, partes, auth) {
  if (!auth || !auth.usuario) return erro(404, 'not_found', 'Disponível só com o acesso individual.');
  const m = request.method, a = partes[1], b2 = partes[2];

  if (!a && m === 'GET') {
    const [us, ss, cs] = await Promise.all([env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ? ORDER BY id').bind(COL_USU).all(), env.DB.prepare('SELECT dados FROM docs WHERE colecao = ?').bind(COL_SES).all(), env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ?').bind(COL_CONV).all()]);
    const ult = {}; for (const r of ss.results) { const s = JSON.parse(r.dados); if (s.expira > Date.now() && (!ult[s.usuario] || s.ultimo > ult[s.usuario].ultimo)) ult[s.usuario] = s; }
    const usuarios = us.results.map((r) => { const d = JSON.parse(r.dados), s = ult[r.id]; return { ...SEM_SEGREDOS(r.id, d), ultimoAcesso: s ? new Date(s.ultimo).toISOString() : null, aparelho: s ? s.rotulo : '', emUso: r.id === auth.usuario.id, sessoes: ss.results.filter((x) => JSON.parse(x.dados).usuario === r.id && JSON.parse(x.dados).expira > Date.now()).length }; });
    const convites = cs.results.map((r) => ({ id: idCurto(r.id), ...JSON.parse(r.dados) })).filter((c) => c.expira > Date.now()).map((c) => ({ id: c.id, nome: c.nome, email: c.email, papel: c.papel, oabs: c.oabs || [], permissoes: normalizarUsuario({ papel: c.papel, permissoes: c.permissoes }).permissoes, criado: new Date(c.criado).toISOString(), expira: new Date(c.expira).toISOString() }));
    return json({ usuarios, convites });
  }

  /* novo convite */
  if (!a && m === 'POST') {
    const b = await request.json().catch(() => null) || {}, nome = String(b.nome || '').trim().slice(0, 80), email = String(b.email || '').trim().toLowerCase();
    if (nome.length < 2) return erro(400, 'invalid', 'Informe o nome da pessoa.');
    if (!emailOk(email)) return erro(400, 'invalid', 'Informe um e-mail válido.');
    if (!PAPEIS_CONVIDADO.includes(b.papel)) return erro(400, 'invalid', 'Escolha o papel: advogado ou estagiário.');
    const oabs = b.papel === 'advogado' ? lerOabs(b.oabs) : [];
    if (oabs === null) return erro(400, 'invalid', 'Alguma OAB está em formato inválido (use número e UF, como 60456/GO).');
    if (b.papel === 'advogado' && !oabs.length) return erro(400, 'invalid', 'Para advogado, indique ao menos uma OAB.');
    if (await emailJaTemAcesso(env, email)) return erro(409, 'conflict', 'Este e-mail já tem acesso.');
    const antigos = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ?').bind(COL_CONV).all();   // um convite pendente por e-mail: o novo substitui o antigo
    const velhos = antigos.results.filter((r) => String(JSON.parse(r.dados).email || '') === email).map((r) => env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(COL_CONV, r.id));
    if (velhos.length) await env.DB.batch(velhos);
    const r = await novoConvite(env, request, auth, { nome, email, papel: b.papel, oabs, permissoes: lerPermissoes(b.permissoes) });
    await stmtRegistro(env, { op: 'criou', por: auth.usuario.nome, rotulo: 'Acesso', titulo: 'Convite para ' + nome + ' (' + ROTULO[b.papel] + ')' }).run();
    return json(r);
  }

  /* convites pendentes: gerar outro link / cancelar */
  if (a === 'convites' && b2) {
    const r = await convitePorCurto(env, b2); if (!r) return erro(404, 'not_found', 'Convite não encontrado.');
    const c = JSON.parse(r.dados);
    if (m === 'DELETE') { await env.DB.batch([env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(COL_CONV, r.id), stmtRegistro(env, { op: 'excluiu', por: auth.usuario.nome, rotulo: 'Acesso', titulo: 'Convite cancelado: ' + c.nome })]); return json({ ok: true }); }
    if (m === 'POST' && partes[3] === 'novo-link') {
      await env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(COL_CONV, r.id).run();
      const { por, criado, expira, ...dados } = c; return json(await novoConvite(env, request, auth, dados));
    }
    return erro(405, 'method', 'Método não permitido.');
  }

  /* uma pessoa */
  if (a && /^[A-Za-z0-9_-]{1,40}$/.test(a)) {
    const doc = await lerDoc(env, COL_USU, a); if (!doc) return erro(404, 'not_found', 'Pessoa não encontrada.');
    if (doc.papel === 'proprietario' && !(m === 'PUT' && !b2)) return erro(403, 'forbidden', 'O proprietário não é alterado por aqui.');
    if (b2 === 'sessoes') {
      const { results } = await env.DB.prepare("SELECT id, dados FROM docs WHERE colecao = ? AND json_extract(dados, '$.usuario') = ?").bind(COL_SES, a).all();
      const vivas = results.map((r) => ({ id: idCurto(r.id), ...JSON.parse(r.dados) })).filter((s) => s.expira > Date.now()).sort((x, y) => y.ultimo - x.ultimo);
      if (m === 'GET') return json({ sessoes: vivas.map((s) => ({ id: s.id, rotulo: s.rotulo, lugar: s.lugar || '', ultimo: new Date(s.ultimo).toISOString(), criada: new Date(s.criada).toISOString() })) });
      if (m === 'DELETE') {
        const alvo = partes[3];
        if (alvo && !/^[0-9a-f]{16}$/.test(alvo)) return erro(400, 'invalid', 'Identificador inválido.');
        await env.DB.batch([alvo ? env.DB.prepare("DELETE FROM docs WHERE colecao = ? AND id LIKE ? AND json_extract(dados, '$.usuario') = ?").bind(COL_SES, alvo + '%', a) : env.DB.prepare("DELETE FROM docs WHERE colecao = ? AND json_extract(dados, '$.usuario') = ?").bind(COL_SES, a), stmtRegistro(env, { op: 'encerrou', por: auth.usuario.nome, rotulo: 'Acesso', titulo: (alvo ? 'Uma sessão' : 'Todas as sessões') + ' de ' + doc.nome + ' encerrada(s)' })]);
        return json({ ok: true });
      }
      return erro(405, 'method', 'Método não permitido.');
    }
    if (m === 'GET' && !b2) return json(SEM_SEGREDOS(a, doc));
    if (m === 'PUT' && !b2) {
      const b = await request.json().catch(() => null) || {}, novo = { ...doc }, mud = [];
      if (doc.papel === 'proprietario' && Object.keys(b).some((k) => k !== 'oabs')) return erro(403, 'forbidden', 'Do proprietário só se indicam as OABs (para filtrar as publicações dele).');
      if (b.papel !== undefined) { if (!PAPEIS_CONVIDADO.includes(b.papel)) return erro(400, 'invalid', 'Papel inválido.'); if (b.papel !== doc.papel) { novo.papel = b.papel; mud.push('papel: ' + ROTULO[b.papel]); } }
      if (b.oabs !== undefined) { const o = lerOabs(b.oabs); if (o === null) return erro(400, 'invalid', 'Alguma OAB está em formato inválido.'); novo.oabs = o; mud.push('OABs'); }
      if (novo.papel === 'advogado' && !(novo.oabs || []).length) return erro(400, 'invalid', 'Para advogado, indique ao menos uma OAB.');
      if (b.permissoes !== undefined) { novo.permissoes = { ...(doc.permissoes || {}), ...lerPermissoes(b.permissoes) }; mud.push('permissões'); }
      if (typeof b.ativo === 'boolean' && b.ativo !== (doc.ativo !== false)) { novo.ativo = b.ativo; mud.push(b.ativo ? 'reativado' : 'desativado'); }
      const cmds = [stmtDoc(env, COL_USU, a, novo)];
      if (novo.ativo === false) cmds.push(env.DB.prepare("DELETE FROM docs WHERE colecao = ? AND json_extract(dados, '$.usuario') = ?").bind(COL_SES, a));   // desativar tira o acesso na hora
      if (mud.length) cmds.push(stmtRegistro(env, { op: 'alterou', por: auth.usuario.nome, rotulo: 'Acesso', titulo: doc.nome + ': ' + mud.join(', ') }));
      await env.DB.batch(cmds);
      return json(SEM_SEGREDOS(a, novo));
    }
  }
  return erro(404, 'not_found', 'Não encontrado.');
}
