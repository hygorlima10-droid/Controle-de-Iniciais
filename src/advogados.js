/* Advogados participantes: grava, em cada processo, Inicial, Acordo e Alvará, quais dos NOSSOS advogados (as OABs cadastradas em Publicações)
   aparecem nas publicações daquele processo. A fonte é o DJEN: cada publicação guarda `advs` (nome e OAB de quem foi intimado) e `oabs` (quais das
   nossas OABs a encontraram). Só acrescenta; nunca tira ninguém. Roda depois de cada leitura do DJEN e por /api/djen/advogados.
   Campo gravado:  advogados: [{ oab: '60456/GO', nome: 'Hygor Lima Andrade' }] */
import { registrar } from './auditoria.js';

const ALVOS = [['processos', 'numero'], ['casos', 'numeroProcesso'], ['termosAcordo', 'numeroProcesso'], ['alvaras', 'numeroProcesso']];
const digitos = (s) => String(s == null ? '' : s).replace(/\D/g, '');
export const chaveOab = (numero, uf) => digitos(numero).replace(/^0+/, '') + '/' + String(uf || '').toUpperCase().slice(0, 2);
const chaveDePub = (o) => { const [n, uf] = String(o || '').split('/'); return chaveOab(n, uf); };

/* quais advogados nossos aparecem em cada processo (a partir das publicações guardadas) */
export async function advogadosPorProcesso(env, cfg) {
  const nossos = new Map(), porId = new Map();
  for (const o of cfg.oabs || []) { const k = chaveOab(o.numero, o.uf); if (k.length > 3) { nossos.set(k, { oab: k, nome: String(o.nome || '').slice(0, 80) }); porId.set(o.id, k); } }
  const mapa = new Map();
  const poe = (proc, k) => { const adv = nossos.get(k); if (!adv || String(proc).length < 15) return; if (!mapa.has(proc)) mapa.set(proc, new Map()); mapa.get(proc).set(k, adv); };
  const porAdvs = await env.DB.prepare("SELECT DISTINCT json_extract(d.dados,'$.processo') AS p, json_extract(a.value,'$.o') AS o FROM docs d, json_each(d.dados,'$.advs') a WHERE d.colecao = '_pub' AND json_extract(d.dados,'$.processo') <> ''").all();
  for (const r of porAdvs.results) poe(String(r.p), chaveDePub(r.o));
  const porOabs = await env.DB.prepare("SELECT DISTINCT json_extract(d.dados,'$.processo') AS p, a.value AS id FROM docs d, json_each(d.dados,'$.oabs') a WHERE d.colecao = '_pub' AND json_extract(d.dados,'$.processo') <> ''").all();
  for (const r of porOabs.results) { const k = porId.get(r.id); if (k) poe(String(r.p), k); }
  return mapa;
}

/* completa os registros que ainda não têm os advogados conhecidos; devolve quantos registros mudaram */
export async function completarAdvogados(env, cfg) {
  const mapa = await advogadosPorProcesso(env, cfg);
  if (!mapa.size) return { registros: 0, processos: 0 };
  const agora = Date.now(), cmds = [], porColecao = {};
  for (const [col, campo] of ALVOS) {
    const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ?').bind(col).all();
    for (const r of results) {
      const d = JSON.parse(r.dados), achados = mapa.get(digitos(d[campo]));
      if (!achados) continue;
      const atuais = Array.isArray(d.advogados) ? d.advogados.filter((a) => a && a.oab) : [], tem = new Map(atuais.map((a) => [a.oab, a]));
      let mudou = false;
      for (const [k, adv] of achados) if (!tem.has(k)) { tem.set(k, { oab: adv.oab, nome: adv.nome }); mudou = true; }
      if (!mudou) continue;
      d.advogados = [...tem.values()].slice(0, 12);
      cmds.push(env.DB.prepare('UPDATE docs SET dados = ?, atualizado = ? WHERE colecao = ? AND id = ?').bind(JSON.stringify(d), agora, col, r.id));
      porColecao[col] = (porColecao[col] || 0) + 1;
    }
  }
  for (let i = 0; i < cmds.length; i += 50) await env.DB.batch(cmds.slice(i, i + 50));
  if (cmds.length) await registrar(env, { op: 'alterou', por: 'Sistema', modulo: 'Advogados', rotulo: 'Advogados', titulo: 'Advogados participantes completados em ' + cmds.length + (cmds.length === 1 ? ' registro' : ' registros') });
  return { registros: cmds.length, processos: mapa.size, porColecao };
}
