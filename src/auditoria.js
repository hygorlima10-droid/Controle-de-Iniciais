/* Registro de ações (rotas /api/auditoria) e a lixeira de 30 dias (rotas /api/lixeira).
   Tudo acontece no ponto central do servidor: qualquer criação, alteração ou exclusão feita por /api/db passa por aqui,
   então nenhuma tela precisa lembrar de registrar. As duas áreas (_auditoria e _lixeira) começam com "_": a API do banco não as enxerga. */

export const DIAS_LIXEIRA = 30, DIAS_REGISTRO = 365;
const COL_AUD = '_auditoria', COL_LIX = '_lixeira';
export const ROTULOS = { repasses: 'Repasse', casos: 'Inicial', termosAcordo: 'Acordo', alvaras: 'Alvará', clientes: 'Cliente', processos: 'Processo', agenda: 'Agenda', diasSemExpediente: 'Dia sem expediente', despesas: 'Despesa', receitasManuais: 'Receita', saldos: 'Saldo', metas: 'Meta', extratos: 'Extrato', obraMov: 'Lançamento da obra', pecasAprendidas: 'Peça aprendida', config: 'Configuração' };
const SEM_REGISTRO = new Set(['config', 'configDono']);        // configurações mudam sozinhas (data do último backup, vínculo…): só ruído
const SEM_LIXEIRA = new Set(['config', 'configDono']);
const IGNORAR = new Set(['atualizadoEm', 'proximaAgId', 'djTent', 'djPendente']);

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);
/* texto canônico (chaves em ordem) para comparar dois registros sem depender da ordem dos campos */
const ehObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
export const canon = (v) => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : ehObj(v) ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v));
const curto = (v, n = 90) => { const t = typeof v === 'string' ? v : JSON.stringify(v); return t === undefined ? '' : (t.length > n ? t.slice(0, n - 1) + '…' : t); };
const aleat = () => Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, '0')).join('');
const agoraId = () => new Date().toISOString().replace(/\D/g, '').slice(0, 17);

/* nome legível do registro (para a lixeira e o registro de ações) */
export function tituloDe(colecao, d) {
  d = d || {};
  const t = d.partes || d.titulo || d.nome || d.cliente || d.descricao || d.numero || d.numeroProcesso || d.rotulo || d.categoria || '';
  const extra = (colecao === 'casos' || colecao === 'termosAcordo' || colecao === 'alvaras') && d.numeroProcesso ? ' · ' + d.numeroProcesso : (colecao === 'processos' && d.numero && d.partes ? ' · ' + d.numero : '');
  return curto(String(t || 'sem nome') + extra, 110);
}
/* o que mudou, campo a campo (só o primeiro nível; listas e objetos aparecem como "alterado") */
export function mudancas(antes, depois) {
  const out = [], ks = new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]);
  for (const k of ks) {
    if (IGNORAR.has(k)) continue;
    const a = (antes || {})[k], d = (depois || {})[k];
    if (canon(a) === canon(d)) continue;
    const simples = (v) => v === undefined || v === null || ['string', 'number', 'boolean'].includes(typeof v);
    out.push(simples(a) && simples(d) ? { c: k, a: curto(a == null ? '' : a), d: curto(d == null ? '' : d) } : { c: k, a: Array.isArray(a) ? a.length + ' itens' : (a == null ? '' : 'antes'), d: Array.isArray(d) ? d.length + ' itens' : (d == null ? '' : 'depois'), lista: true });
    if (out.length >= 10) break;
  }
  return out;
}
/* quem fez: o nome da pessoa logada (no acesso antigo, de uma pessoa só, continua "Você") */
export const autorDe = (auth) => (auth && auth.usuario ? { por: auth.usuario.nome || 'Você', uid: auth.usuario.id } : { por: 'Você' });
/* número do processo (só dígitos) a que o registro pertence: é o que liga o histórico de um processo a tudo que foi feito nele */
export const procDe = (colecao, d) => { const n = String((d && (d.numeroProcesso || d.numero || d.processo)) || '').replace(/\D/g, ''); return n.length >= 15 ? n : ''; };
/* comando (sem executar) que grava uma linha do registro; "ev": { op, colecao, id, titulo, mud, por, uid, dados (o registro, para achar o processo), modulo } */
export function stmtRegistro(env, ev) {
  const dados = { em: new Date().toISOString(), por: ev.por || 'Você', op: ev.op, colecao: ev.colecao || '', rotulo: ev.rotulo || ROTULOS[ev.colecao] || ev.modulo || '', id: ev.id || '', titulo: ev.titulo || '' };
  if (ev.uid) dados.uid = ev.uid;
  const proc = ev.proc || (ev.dados ? procDe(ev.colecao, ev.dados) : ''); if (proc) dados.proc = proc;
  if (ev.mud && ev.mud.length) dados.mud = ev.mud;
  return env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?)').bind(COL_AUD, agoraId() + '-' + aleat(), JSON.stringify(dados), Date.now());
}
export const registrar = (env, ev) => stmtRegistro(env, ev).run().catch((e) => console.error('registro de ações', e));
export const registraColecao = (colecao) => !SEM_REGISTRO.has(colecao);

/* comando que copia o registro apagado para a lixeira */
export function stmtLixeira(env, colecao, id, dadosTexto) {
  const agora = Date.now(), d = JSON.parse(dadosTexto);
  const reg = { colecao, id, dados: d, rotulo: ROTULOS[colecao] || colecao, titulo: tituloDe(colecao, d), em: new Date(agora).toISOString(), expira: new Date(agora + DIAS_LIXEIRA * 864e5).toISOString(), por: 'Você' };
  return env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?)').bind(COL_LIX, `${colecao}|${id}|${agoraId()}`, JSON.stringify(reg), agora);
}
export const vaiParaLixeira = (colecao) => !SEM_LIXEIRA.has(colecao);

/* limpeza diária: a lixeira some depois de 30 dias; o registro de ações guarda 1 ano */
export async function limparSeguranca(env) {
  const agora = Date.now();
  await env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND atualizado < ?').bind(COL_LIX, agora - DIAS_LIXEIRA * 864e5).run();
  await env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND atualizado < ?').bind(COL_AUD, agora - DIAS_REGISTRO * 864e5).run();
  await env.DB.prepare("DELETE FROM docs WHERE colecao = '_convites' AND json_extract(dados, '$.expira') < ?").bind(agora).run();   // convites vencidos
}

export async function auditoriaRotas(request, env) {
  if (request.method !== 'GET') return erro(405, 'method', 'Método não permitido.');
  const u = new URL(request.url), antes = (u.searchParams.get('antes') || '').slice(0, 40), lim = Math.min(Math.max(parseInt(u.searchParams.get('limite') || '60', 10) || 60, 1), 200), col = u.searchParams.get('colecao') || '';
  const por = (u.searchParams.get('por') || '').slice(0, 80), de = (u.searchParams.get('de') || '').replace(/\D/g, '').slice(0, 8), ate = (u.searchParams.get('ate') || '').replace(/\D/g, '').slice(0, 8);
  const filtros = ['colecao = ?'], bind = [COL_AUD];
  if (antes) { filtros.push('id < ?'); bind.push(antes); }
  if (col === 'acesso') filtros.push("json_extract(dados, '$.rotulo') = 'Acesso'");
  else if (col) { filtros.push("json_extract(dados, '$.colecao') = ?"); bind.push(col); }
  if (por) { filtros.push("json_extract(dados, '$.por') = ?"); bind.push(por); }
  if (de.length === 8) { filtros.push('id >= ?'); bind.push(de); }                       // o código do registro começa por AAAAMMDDhhmmss…
  if (ate.length === 8) { filtros.push('id < ?'); bind.push(String(Number(ate) + 1)); }   // até o fim do dia (AAAAMMDD+1 é o dia seguinte; comparação textual funciona para datas válidas)
  const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE ' + filtros.join(' AND ') + ' ORDER BY id DESC LIMIT ?').bind(...bind, lim + 1).all();
  const itens = results.slice(0, lim).map((r) => ({ chave: r.id, ...JSON.parse(r.dados) }));
  const { results: pes } = await env.DB.prepare("SELECT DISTINCT json_extract(dados, '$.por') AS p FROM docs WHERE colecao = ? AND id >= ? LIMIT 50").bind(COL_AUD, new Date(Date.now() - 90 * 864e5).toISOString().replace(/\D/g, '').slice(0, 8)).all();
  return json({ itens, mais: results.length > lim ? itens[itens.length - 1].chave : null, pessoas: pes.map((r) => r.p).filter((x) => x && x !== 'desconhecido').sort() });
}

/* Histórico de um processo (GET /api/historico/<número>): o que foi feito nos registros daquele número, por quem e quando.
   Quem pode: o proprietário e o estagiário (que vê todo o jurídico) sempre; o advogado, se participa do processo. Só aparece o que foi gravado depois da 5.8. */
export async function historicoRotas(request, env, partes, auth, esc) {
  if (request.method !== 'GET') return erro(405, 'method', 'Método não permitido.');
  const num = String(partes[1] || '').replace(/\D/g, '');
  if (num.length < 15) return erro(400, 'invalid', 'Número de processo inválido.');
  if (auth && auth.usuario && auth.usuario.papel === 'advogado' && !(esc && esc.processos && esc.processos.has(num))) return erro(403, 'forbidden', 'Você não participa deste processo.');
  const lim = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('limite') || '100', 10) || 100, 1), 300);
  const { results } = await env.DB.prepare("SELECT id, dados FROM docs WHERE colecao = ? AND json_extract(dados, '$.proc') = ? ORDER BY id DESC LIMIT ?").bind(COL_AUD, num, lim).all();
  return json({ itens: results.map((r) => { const d = JSON.parse(r.dados); return { chave: r.id, em: d.em, por: d.por, op: d.op, rotulo: d.rotulo, titulo: d.titulo, mud: d.mud || [] }; }) });
}

export async function lixeiraRotas(request, env, partes) {
  const acao = partes[1], m = request.method;
  if (!acao && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ? AND atualizado >= ? ORDER BY id DESC LIMIT 500').bind(COL_LIX, Date.now() - DIAS_LIXEIRA * 864e5).all();
    return json({ itens: results.map((r) => { const d = JSON.parse(r.dados); return { chave: r.id, colecao: d.colecao, id: d.id, rotulo: d.rotulo, titulo: d.titulo, em: d.em, expira: d.expira, por: d.por }; }) });
  }
  if (m !== 'POST') return erro(405, 'method', 'Método não permitido.');
  const corpo = await request.json().catch(() => null) || {};
  if (acao === 'esvaziar') {
    const r = await env.DB.prepare('DELETE FROM docs WHERE colecao = ?').bind(COL_LIX).run();
    await registrar(env, { op: 'esvaziou', modulo: 'Lixeira', titulo: 'Lixeira esvaziada' });
    return json({ ok: true, removidos: (r.meta && r.meta.changes) || 0 });
  }
  if (acao === 'restaurar') {
    const chave = String(corpo.chave || ''), item = await env.DB.prepare('SELECT dados, atualizado FROM docs WHERE colecao = ? AND id = ?').bind(COL_LIX, chave).first();
    if (!item || item.atualizado < Date.now() - DIAS_LIXEIRA * 864e5) return erro(404, 'not_found', 'Este item não está mais na lixeira (passou de ' + DIAS_LIXEIRA + ' dias ou já foi restaurado).');
    const d = JSON.parse(item.dados), atual = await env.DB.prepare('SELECT 1 AS x FROM docs WHERE colecao = ? AND id = ?').bind(d.colecao, d.id).first();
    if (atual && corpo.substituir !== true) return json({ ok: false, existe: true, mensagem: 'Já existe um registro com este identificador (foi recriado depois de excluído). Restaurar substitui o que existe agora.' }, 409);
    const cmds = [
      env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(d.colecao, d.id, JSON.stringify(d.dados), Date.now()),
      env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id = ?').bind(COL_LIX, chave),
      stmtRegistro(env, { op: 'restaurou', colecao: d.colecao, id: d.id, titulo: d.titulo }),
    ];
    if (d.colecao === 'processos' && d.dados && d.dados.numero) {   // um processo excluído na revisão entra na lista de ignorados: ao restaurar, sai dela
      const ig = await env.DB.prepare("SELECT dados FROM docs WHERE colecao = 'config' AND id = 'processosIgnorados'").first();
      if (ig) { const x = JSON.parse(ig.dados), n = String(d.dados.numero).replace(/\D/g, ''); if (x.numeros && x.numeros[n]) { delete x.numeros[n]; cmds.push(env.DB.prepare("UPDATE docs SET dados = ?, atualizado = ? WHERE colecao = 'config' AND id = 'processosIgnorados'").bind(JSON.stringify(x), Date.now())); } }
    }
    await env.DB.batch(cmds);
    return json({ ok: true, colecao: d.colecao, id: d.id, substituiu: !!atual });
  }
  return erro(404, 'not_found', 'Não encontrado.');
}
