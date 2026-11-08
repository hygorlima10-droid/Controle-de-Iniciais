/* Restauração segura de backup (rotas /api/restaurar/...).
   1) conferir: lê o arquivo, valida e compara com o banco de hoje (nada é gravado);
   2) aplicar: guarda uma cópia de segurança automática, grava o arquivo numa área de espera e troca tudo de uma vez
      (uma única operação do banco: ou fica tudo do backup, ou fica tudo como estava);
   3) desfazer: volta para a cópia de segurança (que também fica guardada, então o próprio "desfazer" se desfaz).
   Só mexe nas coleções que o arquivo traz; o que não está no arquivo (ex.: backup antigo sem Processos) não é tocado. */

import { resolverColecao } from './colecoes.js';
import { canon, registrar } from './auditoria.js';

const NOME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const MAX_DOC = 900 * 1024, MAX_PROBLEMAS = 8, GUARDAR_COPIAS = 5, PARTE_B64 = 700 * 1024, LOTE = 90;
const COL_COPIAS = '_seguranca', COL_ESPERA = '_restaurar';

/* chave no arquivo do app → coleção no banco, forma (lista de registros com id, ou mapa id → registro) e nome para a tela */
export const COLECOES_APP = [
  ['casos', 'casos', 'lista', 'petições'], ['acordos', 'termosAcordo', 'lista', 'termos de acordo'], ['alvaras', 'alvaras', 'lista', 'alvarás'],
  ['clientes', 'clientes', 'lista', 'clientes'], ['despesas', 'despesas', 'lista', 'despesas'], ['receitasManuais', 'receitasManuais', 'lista', 'receitas'],
  ['saldos', 'saldos', 'mapa', 'saldos'], ['metas', 'metas', 'lista', 'metas'], ['extratos', 'extratos', 'lista', 'extratos do banco'],
  ['obraMov', 'obraMov', 'lista', 'lançamentos da obra'], ['processos', 'processos', 'lista', 'processos'], ['agenda', 'agenda', 'lista', 'itens da agenda'],
  ['pecasAprendidas', 'pecasAprendidas', 'lista', 'peças aprendidas'], ['config', 'config', 'mapa', 'configurações'], ['configDono', 'configDono', 'mapa', 'configurações do proprietário'],
];
const NOME_DA_COLECAO = Object.fromEntries(COLECOES_APP.map((c) => [c[1], c[3]]));

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);
const ehObjeto = (x) => x && typeof x === 'object' && !Array.isArray(x);
const paraB64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function gzipB64(texto) { return paraB64(await new Response(new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); }
async function gunzipTexto(b64) { const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); return new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }

/* lê o arquivo (formato do app ou formato bruto do servidor) e devolve os registros, as coleções que ele traz e os problemas encontrados */
export function lerArquivo(corpo) {
  const docs = new Map(), colecoes = new Set(), problemas = [];
  const prob = (m) => { if (problemas.length < MAX_PROBLEMAS) problemas.push(m); };
  if (!ehObjeto(corpo)) return { docs, colecoes, problemas: ['Este arquivo não parece um backup deste sistema.'] };
  if (corpo.versao !== undefined && Number(corpo.versao) !== 1) prob('Este backup foi gerado por uma versão diferente do sistema (versão ' + corpo.versao + '). Não é seguro restaurá-lo aqui.');
  const add = (col, id, dados, nome) => {
    if (!NOME.test(col)) { prob('Coleção inválida no arquivo: ' + String(col).slice(0, 40)); return; }
    if (col.startsWith('_')) { prob('O arquivo tem registros de uma área reservada do sistema (' + col + ').'); return; }
    if (!NOME.test(String(id))) { prob('A lista de ' + nome + ' tem um identificador inválido: ' + String(id).slice(0, 40)); return; }
    if (!ehObjeto(dados)) { prob('A lista de ' + nome + ' tem um registro inválido (' + String(id).slice(0, 30) + ').'); return; }
    const k = col + '|' + id;
    if (docs.has(k)) { prob('A lista de ' + nome + ' tem registros repetidos (' + String(id).slice(0, 30) + ').'); return; }
    if (JSON.stringify(dados).length > MAX_DOC) { prob('Um registro de ' + nome + ' é grande demais (' + String(id).slice(0, 30) + ').'); return; }
    docs.set(k, dados);
  };
  if (Array.isArray(corpo.docs)) {   // formato bruto do servidor
    for (const d of corpo.docs) { if (!ehObjeto(d)) { prob('O arquivo tem um item inválido.'); continue; } colecoes.add(String(d.colecao)); add(String(d.colecao), String(d.id), d.dados, String(d.colecao)); }
  } else {
    for (const [chave, col, forma, nome] of COLECOES_APP) {
      const v = corpo[chave]; if (v === undefined) continue;
      colecoes.add(col);
      if (forma === 'lista') {
        if (!Array.isArray(v)) { prob('A lista de ' + nome + ' está num formato inválido.'); continue; }
        for (const x of v) {
          if (!ehObjeto(x)) { prob('A lista de ' + nome + ' contém um item inválido.'); continue; }
          if (x.id === undefined || x.id === null || x.id === '') { prob('A lista de ' + nome + ' tem um registro sem identificador.'); continue; }
          const { id, ...resto } = x; add(col, String(id), resto, nome);
        }
      } else {
        if (!ehObjeto(v)) { prob('Os dados de ' + nome + ' estão num formato inválido.'); continue; }
        for (const [id, dados] of Object.entries(v)) add(col, id, dados, nome);
      }
    }
    if (!colecoes.size) prob('Este arquivo não contém nenhuma lista de dados do sistema.');
  }
  /* backups feitos antes da separação da configuração trazem os documentos do proprietário dentro de "config": vão para configDono */
  for (const k of [...docs.keys()]) {
    const [col, ...r] = k.split('|'), id = r.join('|'), novo = resolverColecao(col, id);
    if (novo === col) continue;
    const dados = docs.get(k); docs.delete(k);
    if (!docs.has(novo + '|' + id)) docs.set(novo + '|' + id, dados);
    colecoes.add(novo);
  }
  if (!docs.size && !problemas.length) prob('Este backup está vazio. Restaurá-lo apagaria os dados atuais, por isso foi bloqueado.');
  return { docs, colecoes, problemas };
}

async function registrosAtuais(env, colecoes) {
  const nomes = [...colecoes]; const por = new Map();
  if (!nomes.length) return por;
  const { results } = await env.DB.prepare('SELECT colecao, id, dados FROM docs WHERE colecao IN (' + nomes.map(() => '?').join(',') + ')').bind(...nomes).all();
  for (const r of results) por.set(r.colecao + '|' + r.id, r.dados);
  return por;
}
/* o que a restauração faria, coleção por coleção */
function comparar(arquivo, atual) {
  const t = {};
  for (const c of arquivo.colecoes) t[c] = { colecao: c, nome: NOME_DA_COLECAO[c] || c, arquivo: 0, banco: 0, novos: 0, iguais: 0, diferentes: 0, removidos: 0 };
  for (const [k, dados] of arquivo.docs) {
    const x = t[k.slice(0, k.indexOf('|'))]; x.arquivo++;
    if (!atual.has(k)) x.novos++; else if (canon(JSON.parse(atual.get(k))) === canon(dados)) x.iguais++; else x.diferentes++;
  }
  for (const k of atual.keys()) { const x = t[k.slice(0, k.indexOf('|'))]; x.banco++; if (!arquivo.docs.has(k)) x.removidos++; }
  const lista = Object.values(t).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const soma = (f) => lista.reduce((s, x) => s + x[f], 0);
  return { colecoes: lista, total: arquivo.docs.size, novos: soma('novos'), iguais: soma('iguais'), diferentes: soma('diferentes'), removidos: soma('removidos') };
}

const carimbo = () => new Date().toISOString().replace(/\D/g, '').slice(0, 17);   // ano a milissegundo: duas cópias seguidas nunca têm o mesmo nome
const gravar = (env, colecao, id, dados) => env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(colecao, id, JSON.stringify(dados), Date.now());
/* cópia de segurança de tudo (menos as áreas reservadas do sistema), guardada no banco em partes comprimidas; ficam as últimas GUARDAR_COPIAS */
export async function copiaDeSeguranca(env, motivo) {
  const { results } = await env.DB.prepare("SELECT colecao, id, dados FROM docs WHERE colecao NOT LIKE '\\_%' ESCAPE '\\' ORDER BY colecao, id").all();
  const docs = results.map((r) => ({ colecao: r.colecao, id: r.id, dados: JSON.parse(r.dados) }));
  const b64 = await gzipB64(JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), docs }));
  const id = carimbo(), total = Math.ceil(b64.length / PARTE_B64) || 1, em = new Date().toISOString();
  const cmds = [];
  for (let i = 0; i < total; i++) cmds.push(gravar(env, COL_COPIAS, `${id}-${String(i).padStart(2, '0')}`, { id, em, motivo, docs: docs.length, parte: i, total, b64: b64.slice(i * PARTE_B64, (i + 1) * PARTE_B64) }));
  for (let i = 0; i < cmds.length; i += LOTE) await env.DB.batch(cmds.slice(i, i + LOTE));
  const todos = await env.DB.prepare('SELECT DISTINCT substr(id,1,17) AS d FROM docs WHERE colecao = ? ORDER BY d DESC').bind(COL_COPIAS).all();
  for (const x of todos.results.slice(GUARDAR_COPIAS)) await env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND id LIKE ?').bind(COL_COPIAS, x.d + '-%').run();
  return { id, em, docs: docs.length };
}
async function listarCopias(env) {
  const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ? ORDER BY id DESC').bind(COL_COPIAS).all();
  const por = new Map();
  for (const r of results) { const d = JSON.parse(r.dados); if (!por.has(d.id)) por.set(d.id, { id: d.id, em: d.em, motivo: d.motivo, docs: d.docs, partes: d.total }); }
  return [...por.values()];
}
async function lerCopia(env, id) {
  const { results } = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id LIKE ? ORDER BY id').bind(COL_COPIAS, id + '-%').all();
  if (!results.length) return null;
  const partes = results.map((r) => JSON.parse(r.dados)).sort((a, b) => a.parte - b.parte);
  if (partes.length !== partes[0].total) throw new Error('A cópia de segurança está incompleta.');
  return JSON.parse(await gunzipTexto(partes.map((p) => p.b64).join('')));
}

/* grava os registros numa área de espera e troca tudo de uma vez. tudo=true troca todas as coleções (usado ao desfazer). */
async function trocar(env, docs, colecoes, tudo) {
  const agora = Date.now();
  await env.DB.prepare('DELETE FROM docs WHERE colecao = ?').bind(COL_ESPERA).run();
  try {
    const cmds = [];
    for (const [k, dados] of docs) cmds.push(env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?)').bind(COL_ESPERA, k, JSON.stringify(dados), agora));
    for (let i = 0; i < cmds.length; i += LOTE) await env.DB.batch(cmds.slice(i, i + LOTE));
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM docs WHERE colecao = ?').bind(COL_ESPERA).first();
    if (n.n !== docs.size) throw new Error('A gravação na área de espera ficou incompleta (' + n.n + ' de ' + docs.size + ').');
  } catch (e) { await env.DB.prepare('DELETE FROM docs WHERE colecao = ?').bind(COL_ESPERA).run().catch(() => {}); throw e; }
  const nomes = [...colecoes];
  const apaga = tudo ? env.DB.prepare("DELETE FROM docs WHERE colecao NOT LIKE '\\_%' ESCAPE '\\'") : env.DB.prepare('DELETE FROM docs WHERE colecao IN (' + nomes.map(() => '?').join(',') + ')').bind(...nomes);
  await env.DB.batch([   // uma única operação: se qualquer parte falhar, nada muda
    apaga,
    env.DB.prepare("INSERT INTO docs (colecao,id,dados,atualizado) SELECT substr(id,1,instr(id,'|')-1), substr(id,instr(id,'|')+1), dados, ? FROM docs WHERE colecao = ?").bind(agora, COL_ESPERA),
    env.DB.prepare('DELETE FROM docs WHERE colecao = ?').bind(COL_ESPERA),
  ]);
}

export async function restauracaoRotas(request, env, partes) {
  const acao = partes[1], m = request.method;
  if (acao === 'copias' && m === 'GET') return json({ copias: await listarCopias(env) });
  if (m !== 'POST') return erro(405, 'method', 'Método não permitido.');
  const corpo = await request.json().catch(() => null);
  if (acao === 'conferir' || acao === 'aplicar') {
    if (acao === 'aplicar' && !(corpo && corpo.confirmar === true)) return erro(400, 'invalid', 'Falta a confirmação.');
    const arquivo = lerArquivo(acao === 'aplicar' ? corpo.arquivo : corpo);
    if (arquivo.problemas.length) return json({ ok: false, problemas: arquivo.problemas }, acao === 'aplicar' ? 400 : 200);
    const atual = await registrosAtuais(env, arquivo.colecoes), cmp = comparar(arquivo, atual);
    if (acao === 'conferir') return json({ ok: true, ...cmp, exportadoEm: (corpo && corpo.exportadoEm) || null });
    const copia = await copiaDeSeguranca(env, 'antes de restaurar um backup');
    await trocar(env, arquivo.docs, arquivo.colecoes, false);
    await registrar(env, { op: 'restaurou', modulo: 'Backup', titulo: 'Backup restaurado: ' + cmp.total + ' registros (' + cmp.removidos + ' removidos); cópia de segurança ' + copia.id });
    return json({ ok: true, restaurados: cmp.total, removidos: cmp.removidos, copia: copia.id });
  }
  if (acao === 'desfazer') {
    const copias = await listarCopias(env), alvo = (corpo && corpo.copia) || (copias[0] && copias[0].id);
    if (!alvo || !/^\d{17}$/.test(alvo)) return erro(404, 'not_found', 'Não há cópia de segurança para voltar.');
    const bruto = await lerCopia(env, alvo); if (!bruto) return erro(404, 'not_found', 'Cópia de segurança não encontrada.');
    const arquivo = lerArquivo(bruto);
    if (arquivo.problemas.length) return json({ ok: false, problemas: arquivo.problemas }, 400);
    const nova = await copiaDeSeguranca(env, 'antes de desfazer a restauração');
    await trocar(env, arquivo.docs, arquivo.colecoes, true);
    await registrar(env, { op: 'restaurou', modulo: 'Backup', titulo: 'Voltou para a cópia de segurança ' + alvo + ' (' + arquivo.docs.size + ' registros)' });
    return json({ ok: true, restaurados: arquivo.docs.size, copia: nova.id });
  }
  return erro(404, 'not_found', 'Não encontrado.');
}
