/* Política de acesso (Fase 5): o que cada papel pode ler e gravar. Tudo é decidido aqui, no servidor; a tela só esconde o que não serve.
   Papéis:
   - proprietario: tudo (o modo antigo, sem usuários, também é tratado como proprietário);
   - advogado:     só o que é dos processos em que está cadastrado (campo `advogados[].oab` do registro ∩ `oabs` do usuário);
   - estagiario:   enxerga o escritório inteiro (jurídico), lança e edita, mas não mexe em recebimento de honorários e só exclui com permissão.
   Finanças pessoais, configurações, backup, restauração, lixeira e registro de ações são só do proprietário.
   Regra de ouro: o que não está liberado aqui é recusado (negar por padrão). */
import { chaveOab } from './advogados.js';

export const PAPEIS = ['proprietario', 'advogado', 'estagiario'];
export const PERMISSOES = ['excluir', 'verTotais', 'verPublicacoes', 'verAgendas'];   // excluir: apagar registros; verTotais: totais e indicadores de honorários; verPublicacoes / verAgendas: o estagiário vê as publicações e as agendas de todo o escritório
const LIGADAS = { estagiario: new Set(['verPublicacoes', 'verAgendas']), advogado: new Set(['verTotais']) };   // ligadas por padrão (o proprietário desliga por pessoa): estagiário vê publicações e agendas; advogado vê os totais dos seus processos
const PARTICIPACAO = new Set(['casos', 'termosAcordo', 'alvaras', 'processos']);   // registros que têm `advogados`
const COM_PROCESSO = new Set(['prazosPub']);                                         // registros ligados a um processo pelo número
const LIVRES = new Set(['pecasAprendidas']);                                        // aprendizado de peças: do escritório todo
const CONFIG_LIVRE = new Set(['personalizacao', 'preferencias']);                    // documentos de config que cada pessoa pode ler e gravar
const CAMPOS_PAGTO = ['pago', 'status', 'dataRecebimento', 'recebidoEm', 'parciais'];

const digitos = (s) => String(s == null ? '' : s).replace(/\D/g, '');
export const normNome = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* usuário normalizado: papel válido, OABs em chave canônica ("60456/GO"), permissões com padrão desligado (o proprietário tem todas) */
export function normalizarUsuario(u) {
  u = u || {};
  const papel = PAPEIS.includes(u.papel) ? u.papel : 'estagiario';
  const oabs = [...new Set((Array.isArray(u.oabs) ? u.oabs : []).map((o) => (typeof o === 'string' ? chaveOab(o.split('/')[0], o.split('/')[1]) : o && chaveOab(o.numero, o.uf))).filter((k) => k && k.length > 3))];
  const perm = u.permissoes && typeof u.permissoes === 'object' ? u.permissoes : {};
  const permissoes = {}; for (const p of PERMISSOES) permissoes[p] = papel === 'proprietario' ? true : (LIGADAS[papel] && LIGADAS[papel].has(p) ? perm[p] !== false : perm[p] === true);
  return { id: u.id, nome: u.nome || '', papel, oabs, permissoes };
}
export const ehDono = (auth) => !auth || !auth.usuario || auth.usuario.papel === 'proprietario';
const usu = (auth) => normalizarUsuario(auth && auth.usuario);
export const podeExcluir = (auth) => ehDono(auth) || usu(auth).permissoes.excluir === true;

const erro = (status, code, message) => new Response(JSON.stringify({ error: { code, message } }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const NEGADO = (msg) => erro(403, 'forbidden', msg || 'Você não tem permissão para isto.');

/* ---------- participação ---------- */
export const oabsDoRegistro = (d) => (d && Array.isArray(d.advogados) ? d.advogados.map((a) => a && a.oab && chaveOab(String(a.oab).split('/')[0], String(a.oab).split('/')[1])).filter(Boolean) : []);
export const participa = (auth, d) => { if (ehDono(auth)) return true; const u = usu(auth); if (u.papel !== 'advogado') return false; const meus = new Set(u.oabs); return oabsDoRegistro(d).some((k) => meus.has(k)); };
export const semAdvogado = (d) => oabsDoRegistro(d).length === 0;

/* o que o advogado pode ver das coleções que dependem do vínculo com processos:
   números de processo e nomes/ids de clientes dos registros em que ele participa */
export async function escopoDoAdvogado(env, auth, ignorar) {   // ignorar = [colecao, id]: calcula como se esse registro não existisse (para saber se ele é o único elo com o processo)
  const u = usu(auth), meus = new Set(u.oabs), esc = { processos: new Set(), clienteIds: new Set(), clienteNomes: new Set() };
  if (!meus.size) return esc;
  /* o processo é a unidade: se o advogado está em qualquer registro de um processo (Inicial, Acordo, Alvará ou o próprio cadastro do processo),
     ele passa a ver todos os registros daquele número, e os clientes deles */
  const todos = [];
  for (const col of PARTICIPACAO) {
    const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ?').bind(col).all();
    for (const r of results) {
      if (ignorar && ignorar[0] === col && ignorar[1] === r.id) continue;
      const d = JSON.parse(r.dados); todos.push(d);
      if (!oabsDoRegistro(d).some((k) => meus.has(k))) continue;
      const num = digitos(d.numero || d.numeroProcesso); if (num.length >= 15) esc.processos.add(num);
    }
  }
  for (const d of todos) {
    if (!oabsDoRegistro(d).some((k) => meus.has(k)) && !esc.processos.has(digitos(d.numero || d.numeroProcesso))) continue;
    if (Array.isArray(d.clienteIds)) for (const i of d.clienteIds) esc.clienteIds.add(String(i));
    if (d.cliente) esc.clienteNomes.add(normNome(d.cliente));
  }
  return esc;
}

/* ---------- leitura: o registro pode ser visto por esta pessoa? ---------- */
export function podeVer(colecao, d, auth, esc) {
  if (ehDono(auth)) return true;
  const u = usu(auth);
  if (colecao === 'config') return false;                       // config só pelas rotas de documento liberado (ver checarDocConfig)
  if (colecao === 'diasSemExpediente') return true;                // o calendário do escritório (feriado municipal, ponto facultativo…): todos leem, só o proprietário muda
  if (colecao === 'repasses') return u.papel === 'advogado' && envolvidoNoRepasse(d, u);   // quem paga ou quem recebe (o proprietário vê todos)
  if (LIVRES.has(colecao)) return true;
  if (u.papel === 'estagiario') return colecao !== 'agenda' || u.permissoes.verAgendas || agendaVisivel(d, u, null) || !!(d && d.processo);   // o estagiário vê o escritório inteiro (jurídico); a agenda de todos, se a permissão estiver ligada
  if (u.papel !== 'advogado') return false;
  if (PARTICIPACAO.has(colecao)) return participa(auth, d) || (!!esc && esc.processos.has(digitos(d && (d.numero || d.numeroProcesso))));   // ou o processo dele (mesmo número) tem outro registro com ele
  if (COM_PROCESSO.has(colecao)) return !!esc && esc.processos.has(digitos(d && (d.processo || d.numero)));
  if (colecao === 'clientes') return !!d && (d.criadoPor === u.id || (!!esc && (esc.clienteIds.has(String(d.id || '')) || esc.clienteNomes.has(normNome(d.nome)))));
  if (colecao === 'agenda') return agendaVisivel(d, u, esc);
  return false;
}
/* agenda: a própria, as compartilhadas e as de processos em que participa (prazos e audiências do processo são sempre do escritório) */
/* ---------- repasses entre advogados (coleção `repasses`) ---------- */
export const envolvidoNoRepasse = (d, u) => { const ks = new Set(u.oabs); return !!d && ((d.de && ks.has(d.de.oab)) || (d.para && ks.has(d.para.oab))); };
const STATUS_REPASSE = ['pendente', 'feito', 'confirmado', 'cancelado'];
/* quem pode mudar o quê: quem paga marca "feito"; quem recebe confirma (ou devolve para "pendente"); qualquer envolvido ou o autor cancela */
function checarRepasse(antes, depois, u) {
  if (!depois || typeof depois !== 'object' || !depois.de || !depois.para || !(Number(depois.valor) > 0) || !STATUS_REPASSE.includes(depois.status)) return NEGADO('Repasse inválido.');
  if (!antes) return u.papel === 'advogado' ? null : NEGADO();   // criar: quem marca o recebimento (advogado)
  const pagador = new Set(u.oabs).has(antes.de && antes.de.oab), recebedor = new Set(u.oabs).has(antes.para && antes.para.oab), autor = antes.criadoPorId === u.id;
  if (!pagador && !recebedor && !autor) return erro(404, 'not_found', 'Registro não encontrado.');
  for (const k of ['valor', 'de', 'para', 'chave', 'docTipo', 'docId']) if (JSON.stringify(antes[k]) !== JSON.stringify(depois[k])) return NEGADO('O valor e as partes do repasse não mudam: cancele e refaça.');
  const a = antes.status, b = depois.status;
  if (a === b) return null;
  if (b === 'cancelado') return a === 'confirmado' ? NEGADO('Repasse já confirmado.') : null;
  if (a === 'pendente' && b === 'feito') return pagador ? null : NEGADO('Quem paga marca "já repassei".');
  if ((a === 'feito' || a === 'pendente') && b === 'confirmado') return recebedor ? null : NEGADO('Quem recebe confirma.');
  if (a === 'feito' && b === 'pendente') return recebedor ? null : NEGADO('Quem recebe devolve o aviso.');
  return NEGADO('Mudança de situação não permitida.');
}

/* responsável: `resp` guarda chaves de pessoas — a OAB do advogado ("60456/GO") ou "u:<id>" (estagiário e quem não tem OAB) */
export const ehResponsavel = (d, u) => Array.isArray(d && d.resp) && d.resp.some((k) => u.oabs.includes(k) || k === 'u:' + u.id);
function agendaVisivel(d, u, esc) {
  d = d || {};
  if (d.criadoPor && d.criadoPor === u.id) return true;
  if (d.compartilhada === true) return true;
  if (ehResponsavel(d, u)) return true;   // quem é responsável vê o item (prazo, audiência ou tarefa)
  return !!esc && !!d.processo && esc.processos.has(digitos(d.processo));
}

/* ---------- decisão por rota e coleção ---------- */
const COL_JURIDICAS = new Set(['repasses', 'casos', 'termosAcordo', 'alvaras', 'clientes', 'processos', 'agenda', 'pecasAprendidas', 'prazosPub', 'diasSemExpediente']);
/* coleção inteira: o papel pode abri-la? (a filtragem registro a registro vem depois) */
export function checarAcessoColecao(colecao, auth) {
  if (ehDono(auth)) return null;
  if (colecao === 'config') return null;   // cada documento é conferido em checarDocConfig
  return COL_JURIDICAS.has(colecao) ? null : NEGADO('Só o proprietário pode abrir isto.');
}
/* documento de config: só os liberados para todos */
export const checarDocConfig = (id, auth) => (ehDono(auth) || (id && CONFIG_LIVRE.has(id)) ? null : NEGADO('Só o proprietário pode abrir isto.'));

/* ---------- pagamento: só quem pode marcar recebimento mexe nestes campos ---------- */
function nosDePagamento(d) {
  const nos = [];
  const ver = (n, caminho) => { if (n && typeof n === 'object') { const f = {}; for (const c of CAMPOS_PAGTO) { const v = n[c]; if (v !== undefined && v !== null && v !== false && v !== '' && !(Array.isArray(v) && !v.length)) f[c] = v; } if (Object.keys(f).length) nos.push(caminho + JSON.stringify(f)); } };
  const varre = (o, base) => { ver(o, base); if (o && o.avista) ver(o.avista, base + '.avista'); if (o && Array.isArray(o.parcelas)) o.parcelas.forEach((p, i) => ver(p, base + '.parcelas' + i)); };
  varre(d || {}, 'raiz'); if (d && d.exito) varre(d.exito, 'raiz.exito');
  return nos.join('\n');
}
/* o estagiário não pode criar nem desmarcar recebimento: o que há de pagamento no registro tem de continuar igual */
export const mexeEmPagamento = (antes, depois) => nosDePagamento(antes) !== nosDePagamento(depois);

/* ---------- leitura de listas: só o que a pessoa pode ver ---------- */
/* linhas { id, dados (texto), atualizado } da coleção já filtradas para quem pede; o proprietário recebe tudo */
export async function linhasVisiveis(env, colecao, auth) {
  const { results } = await env.DB.prepare('SELECT id, dados, atualizado FROM docs WHERE colecao = ? ORDER BY id').bind(colecao).all();
  if (ehDono(auth)) return results;
  if (colecao === 'config') return results.filter((r) => CONFIG_LIVRE.has(r.id));
  const u = usu(auth), esc = u.papel === 'advogado' ? await escopoDoAdvogado(env, auth) : null;
  return results.filter((r) => { const d = JSON.parse(r.dados); if (colecao === 'clientes') d.id = r.id; return podeVer(colecao, d, auth, esc); });
}

/* ---------- gravação e exclusão ---------- */
/* Confere (e ajusta) a gravação de um registro. `antes` = registro atual (ou null se é novo), `depois` = o que se quer gravar.
   Devolve uma resposta de recusa, ou null se pode (e então `depois` já vem com os carimbos do servidor). */
/* carimbo de autor (agenda e clientes): quem criou, inclusive o proprietário; o autor não muda depois */
export function carimbarAutor(colecao, antes, depois, auth) {
  if (!auth || !auth.usuario || (colecao !== 'agenda' && colecao !== 'clientes')) return;
  if (!antes) { if (!(ehDono(auth) && depois.criadoPor)) depois.criadoPor = auth.usuario.id; }   // o proprietário pode informar o autor (importações); os demais, nunca
  else if (antes.criadoPor) depois.criadoPor = antes.criadoPor;
}
/* agenda: quem pode alterar um item que já existe (vale para advogado e estagiário). Pode: quem criou; quem é responsável; quem participa do processo do item
   (o estagiário vê todos os processos); e, numa tarefa COMPARTILHADA, qualquer pessoa que a vê pode concluir ou reabrir (só os campos de conclusão mudam). */
const CAMPOS_CONCLUSAO = ['concluido', 'cancelado', 'situacao', 'concluidoEm', 'concluidoPor', 'protocoladoEm', 'protocoloObs', 'prontaEm', 'prontaPor'];
const estavel = (v) => (Array.isArray(v) ? '[' + v.map(estavel).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v));
const semConclusao = (d) => { const o = { ...(d || {}) }; for (const k of CAMPOS_CONCLUSAO) delete o[k]; delete o.criadoPor; delete o.id; return estavel(o); };
const agendaDaPessoa = (antes, u, esc) => antes.criadoPor === u.id || ehResponsavel(antes, u) || (!!antes.processo && (u.papel === 'estagiario' || (!!esc && esc.processos.has(digitos(antes.processo)))));
const agendaAlteravel = (antes, depois, u, esc) => agendaDaPessoa(antes, u, esc) || (antes.compartilhada === true && !!depois && semConclusao(antes) === semConclusao(depois));
export async function autorizarGravacao(env, colecao, id, antes, depois, auth, esc) {
  if (ehDono(auth)) { carimbarAutor(colecao, antes, depois, auth); return null; }
  const u = usu(auth);
  if (colecao === 'config') return checarDocConfig(id, auth);
  if (colecao === 'diasSemExpediente') return NEGADO('Só o proprietário cadastra dias sem expediente.');
  if (colecao === 'repasses') { const r = checarRepasse(antes, depois, u); if (r) return r; if (!antes) depois.criadoPorId = u.id; return null; }
  esc = esc || (u.papel === 'advogado' ? await escopoDoAdvogado(env, auth) : null);
  if (antes) { const ant = { ...antes, id: antes.id || id }; if (!podeVer(colecao, ant, auth, esc)) return erro(404, 'not_found', 'Registro não encontrado.'); }
  if (LIVRES.has(colecao)) return null;
  if (colecao === 'agenda' && antes && !agendaAlteravel(antes, depois, u, esc)) return NEGADO('Só quem criou, quem é responsável ou quem está no processo pode alterar esta tarefa.');
  if (!antes && (colecao === 'agenda' || colecao === 'clientes')) depois.criadoPor = u.id;
  if (antes && antes.criadoPor && (colecao === 'agenda' || colecao === 'clientes')) depois.criadoPor = antes.criadoPor;   // o autor não muda
  if (u.papel === 'estagiario') {
    if (PARTICIPACAO.has(colecao) && mexeEmPagamento(antes || {}, depois)) return NEGADO('Estagiário não marca recebimento de honorários.');
    return null;
  }
  if (u.papel !== 'advogado') return NEGADO();
  if (PARTICIPACAO.has(colecao)) {
    if (!u.oabs.length) return NEGADO('Cadastre a sua OAB antes de lançar registros.');
    const doProcesso = (reg) => !!esc && esc.processos.has(digitos(reg.numero || reg.numeroProcesso));   // o registro herda os advogados do processo (mesmo número)
    if (!antes) { if (!oabsDoRegistro(depois).length && !doProcesso(depois)) return erro(400, 'invalid', 'Escolha os advogados responsáveis.'); }   // quem cadastra escolhe os responsáveis (o app sugere); o advogado não é incluído sozinho
    else if (!participa(auth, depois)) { const sem = await escopoDoAdvogado(env, auth, [colecao, id]); if (!sem.processos.has(digitos(depois.numero || depois.numeroProcesso))) return NEGADO('Você não pode se retirar deste registro.'); }   // sair só vale se outro registro do mesmo processo mantém o vínculo
  }
  return null;
}
export async function autorizarExclusao(env, colecao, id, antes, auth, esc) {
  if (ehDono(auth)) return null;
  const u = usu(auth);
  if (colecao === 'config' || colecao === 'repasses' || colecao === 'diasSemExpediente') return NEGADO();
  esc = esc || (u.papel === 'advogado' ? await escopoDoAdvogado(env, auth) : null);
  if (antes && !podeVer(colecao, { ...antes, id: antes.id || id }, auth, esc)) return erro(404, 'not_found', 'Registro não encontrado.');
  if (!podeExcluir(auth)) return NEGADO('Você não tem permissão para excluir registros.');
  if (colecao === 'agenda' && antes && !agendaDaPessoa(antes, u, esc)) return NEGADO('Só quem criou, quem é responsável ou quem está no processo pode excluir esta tarefa.');
  return null;
}

/* publicações (Diário Oficial): estagiário (com a permissão) e advogado só leem e marcam como lida/sem prazo; buscar, importar, OABs e
   completar advogados são do proprietário. O filtro por OAB está em djen.js (cada pessoa vê as publicações das próprias OABs). */
export function checarRotaDjen(partes, metodo, auth) {
  if (ehDono(auth)) return null;
  const u = usu(auth), a = partes[1], leitura = metodo === 'GET' && ['estado', 'lista', 'processo', 'texto'].includes(a), marcar = metodo === 'POST' && a === 'marcar';
  if (u.papel === 'estagiario' && u.permissoes.verPublicacoes && (leitura || marcar)) return null;
  if (u.papel === 'advogado' && (leitura || marcar)) return null;
  return NEGADO('Você não tem acesso às publicações.');
}
