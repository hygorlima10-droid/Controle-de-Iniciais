/* ============================================================
   Publicações do Diário de Justiça Eletrônico Nacional (DJEN/CNJ)
   - lê as publicações das OABs cadastradas (todo dia às 10h e no botão "Buscar agora")
   - guarda só o trecho; o texto completo é buscado quando você abre a publicação
   - sugere o prazo ("prazo de 15 dias") a partir do texto; quem confirma é você
   ============================================================ */
import { sugerirPecas } from './pecas.js';
export const DJEN = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
let BASE = DJEN;   // os testes apontam DJEN_URL para um servidor de mentira
const usar = (env) => { BASE = (env && env.DJEN_URL) || DJEN; };
const FUSO_MS = -3 * 3600e3, DIA = 864e5;
const hojeBR = () => new Date(Date.now() + FUSO_MS).toISOString().slice(0, 10);
const somarDiasISO = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * DIA).toISOString().slice(0, 10);
const COL_PUB = '_pub', COL_CFG = '_djen';
const MAX_DIAS_LISTA = 400, MAX_OABS = 10, ORCAMENTO_BUSCAS = 36;

/* ---------- texto das publicações ---------- */
const ENTIDADES = {};
('nbsp: |amp:&|lt:<|gt:>|quot:"|apos:\'|ordm:º|ordf:ª|sect:§|deg:°|ndash:–|mdash:—|ldquo:“|rdquo:”|lsquo:‘|rsquo:’|hellip:…|bull:•|middot:·|laquo:«|raquo:»|copy:©|reg:®|euro:€|' +
  'aacute:á|agrave:à|acirc:â|atilde:ã|auml:ä|eacute:é|egrave:è|ecirc:ê|euml:ë|iacute:í|igrave:ì|icirc:î|iuml:ï|oacute:ó|ograve:ò|ocirc:ô|otilde:õ|ouml:ö|uacute:ú|ugrave:ù|ucirc:û|uuml:ü|ccedil:ç|ntilde:ñ|' +
  'Aacute:Á|Agrave:À|Acirc:Â|Atilde:Ã|Auml:Ä|Eacute:É|Egrave:È|Ecirc:Ê|Euml:Ë|Iacute:Í|Igrave:Ì|Icirc:Î|Iuml:Ï|Oacute:Ó|Ograve:Ò|Ocirc:Ô|Otilde:Õ|Ouml:Ö|Uacute:Ú|Ugrave:Ù|Ucirc:Û|Uuml:Ü|Ccedil:Ç|Ntilde:Ñ').split('|').forEach((p) => { const i = p.indexOf(':'); ENTIDADES[p.slice(0, i)] = p.slice(i + 1); });
const decodificar = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  return Object.prototype.hasOwnProperty.call(ENTIDADES, e) ? ENTIDADES[e] : m;
});
export function htmlParaTexto(h) {
  let t = String(h == null ? '' : h);
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|tr|div|li|h[1-6]|table)>/gi, '\n').replace(/<\/t[dh]>/gi, ' ').replace(/<[^>]*>/g, '');
  t = decodificar(t).replace(/ /g, ' ');
  return t.split('\n').map((l) => l.replace(/[ \t\f\v]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
const CABECALHO = /^(poder judici|tribunal de|comarca|estado de|justi[cç]a|\d+\s*[ªa°]?\s*vara|vara |juizado|autos n|natureza|polo |processo|av\.|avenida|\(este ato|ju[ií]zo|foro|secretaria|ata de|relator|agravante|agravado|advogado|requerente|requerido|autor|r[eé]u|exequente|executado)/i;
export function trechoDe(texto) {
  const linhas = String(texto || '').split('\n').map((l) => l.trim()).filter(Boolean);
  let i = 0;
  while (i < linhas.length - 1 && (CABECALHO.test(linhas[i]) || linhas[i].length < 4 || (linhas[i].length <= 32 && linhas[i] === linhas[i].toUpperCase() && /[A-ZÀ-Ý]/.test(linhas[i])))) i++;
  const t = linhas.slice(i).join(' ').replace(/\s+/g, ' ').trim();
  return (t || linhas.join(' ')).slice(0, 300);
}

/* ---------- dados básicos do processo que vêm no texto: partes, natureza e valor da causa ---------- */
const POLO_ATIVO = /^(?:polo\s+ativo|autor(?:es|a|as)?(?:\(a?s?\))?|requerente(?:s|\(s\))?|exequente(?:s|\(s\))?|impetrante|agravante|recorrente|apelante|embargante|reclamante|promovente|suscitante)\s*[:\-–]\s*(.+)$/i;
const POLO_PASSIVO = /^(?:polo\s+passivo|r[eé]us?|r[eé]\(s\)|requerido(?:s|\(s\))?|executado(?:s|\(s\))?|impetrado|agravado|recorrido|apelado|embargado|reclamado|promovido|suscitado)\s*[:\-–]\s*(.+)$/i;
const limpaNome = (n) => String(n || '').replace(/^\d+\s*[.)-]\s*/, '').replace(/\s*\((?:agravante|agravado|autor|r[eé]u|requerente|requerido|exequente|executado|apelante|apelado|recorrente|recorrido)[^)]*\)\s*$/i, '').replace(/\s+/g, ' ').trim().slice(0, 120);
export function extrairDados(texto) {
  const linhas = String(texto || '').split('\n').map((l) => l.trim()).filter(Boolean), at = [], pa = [];
  let natureza = '', assunto = '';
  for (const l of linhas.slice(0, 80)) {
    let m;
    if ((m = POLO_ATIVO.exec(l))) { const n = limpaNome(m[1]); if (n && at.length < 3 && !at.includes(n)) at.push(n); }
    else if ((m = POLO_PASSIVO.exec(l))) { const n = limpaNome(m[1]); if (n && pa.length < 3 && !pa.includes(n)) pa.push(n); }
    else if (!natureza && (m = /^(?:natureza|a[çc][ãa]o|classe judicial)\s*:\s*(.+)$/i.exec(l))) natureza = m[1].split(/\s*->\s*/).pop().replace(/\s+/g, ' ').trim().slice(0, 100);
    else if (!assunto && (m = /^assuntos?\s*:\s*(.+)$/i.exec(l))) assunto = m[1].replace(/\s+/g, ' ').trim().slice(0, 100);
  }
  const v = /valor\s+da\s+causa\s*[:\-]?\s*R?\$?\s*([\d.]+,\d{2})/i.exec(String(texto || ''));
  const out = { ativo: at.join('; '), passivo: pa.join('; '), natureza, assunto };
  if (v) out.valorCausa = Number(v[1].replace(/\./g, '').replace(',', '.')) || 0;
  return out;
}

/* ---------- prazo sugerido a partir do texto (você sempre confirma) ---------- */
const NUMEROS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, 'três': 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, noventa: 90 };
function numeroDe(s) {
  s = String(s || '').toLowerCase().trim();
  if (/^\d{1,3}$/.test(s)) return parseInt(s, 10);
  const m = /^([a-zçêã]+)(?:\s+e\s+([a-zçêã]+))?$/.exec(s);
  if (!m || !(m[1] in NUMEROS)) return 0;
  return NUMEROS[m[1]] + (m[2] ? (NUMEROS[m[2]] || 0) : 0);
}
const NUM_RE = '(\\d{1,3}|[a-zçêã]+(?:\\s+e\\s+[a-zçêã]+)?)';
const PRAZO_A = new RegExp('prazo\\s+(?:(?:comum|sucessivo|legal|improrrog[aá]vel|[uú]nico|final|derradeiro)\\s+)*(?:de|em|:)?\\s*' + NUM_RE + '\\s*(?:\\([^)]{1,30}\\)\\s*)?(dias?|horas?|m[eê]s(?:es)?)(?:\\s+(?:(?:dias\\s+)?([uú]teis|corridos)))?', 'gi');
const PRAZO_B = new RegExp('\\b(?:em|dentro\\s+d[eo]|no\\s+(?:r[ií]gido\\s+)?prazo\\s+de)\\s+' + NUM_RE + '\\s*(?:\\([^)]{1,30}\\)\\s*)?(dias?)(?:\\s+(?:([uú]teis|corridos)))?', 'gi');
export function sugerirPrazo(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ');
  if (t.length < 20) return null;
  for (const re of [PRAZO_A, PRAZO_B]) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(t))) {
      const n = numeroDe(m[1]), un = (m[2] || '').toLowerCase();
      if (!n || !/^dias?$/.test(un) || n > 120) continue;
      const frase = t.slice(Math.max(0, m.index - 70), Math.min(t.length, m.index + m[0].length + 70)).trim();
      return { dias: n, tipo: /corridos/i.test(m[3] || '') || /dias\s+corridos/i.test(m[0]) ? 'corridos' : 'uteis', frase };
    }
  }
  return null;
}

/* ---------- audiência designada no texto (você sempre confirma antes de entrar na Agenda) ---------- */
const MESES_EXT = { janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const TIPOS_AUD = [[/concilia/i, 'Conciliação'], [/media[çc]/i, 'Mediação'], [/instru[çc][ãa]o/i, 'Instrução e julgamento'], [/justifica[çc]/i, 'Justificação'], [/saneamento/i, 'Saneamento'], [/cust[óo]dia/i, 'Custódia'], [/admonit/i, 'Admonitória'], [/preliminar/i, 'Preliminar']];
const DATA_NUM = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/, DATA_EXT = /(\d{1,2})\s*(?:º|°)?\s+de\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i;
const iso = (a, m, d) => { if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && a >= 2000 && a <= 2100)) return ''; const x = new Date(Date.UTC(a, m - 1, d)); return x.getUTCMonth() === m - 1 ? x.toISOString().slice(0, 10) : ''; };   // recusa 31/02 e afins
export function sugerirAudiencia(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ');
  if (t.length < 30) return null;
  const re = /audi[êe]ncias?/gi; let m;
  while ((m = re.exec(t))) {
    const antes = t.slice(Math.max(0, m.index - 60), m.index), janela = t.slice(m.index, m.index + 300);
    if (/(cancel|dispens|retir|prejudicad|desconvoc)\w*\s+(?:a\s+|da\s+|de\s+)?$/i.test(antes) || /^audi[êe]ncias?\s+(?:foi\s+|fica\s+|est[áa]\s+)?(?:cancelad|dispensad|prejudicad)/i.test(janela)) continue;
    let dt = '', pos = 0, d;
    if ((d = DATA_NUM.exec(janela))) { dt = iso(+d[3], +d[2], +d[1]); pos = d.index + d[0].length; }
    else if ((d = DATA_EXT.exec(janela))) { dt = iso(+d[3], MESES_EXT[d[2].toLowerCase()], +d[1]); pos = d.index + d[0].length; }
    if (!dt) continue;
    const depois = janela.slice(pos, pos + 60), h = /(?:[àa]s?\s+)?(\d{1,2})\s*(?:h|:|horas?)\s*(\d{2})?/i.exec(depois);
    let hora = '';
    if (h && +h[1] <= 23 && (!h[2] || +h[2] <= 59)) hora = String(+h[1]).padStart(2, '0') + ':' + (h[2] || '00');
    const bloco = t.slice(Math.max(0, m.index - 40), m.index + 300);
    const tipo = (TIPOS_AUD.find(([r]) => r.test(janela.slice(0, 80))) || [null, ''])[1];
    const link = (/https?:\/\/[^\s<>")]*(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com|videoconferencia|audiencia|sala-virtual|cnj\.jus\.br)[^\s<>")]*/i.exec(t) || [''])[0].slice(0, 300);
    const modalidade = link || /videoconfer|virtual|on-?line|telepresencial/i.test(bloco) ? 'online' : (/presencial/i.test(bloco) ? 'presencial' : '');
    return { data: dt, hora, tipo, modalidade, link, frase: t.slice(Math.max(0, m.index - 30), Math.min(t.length, m.index + pos + 40)).trim() };
  }
  return null;
}

/* ---------- DJEN ---------- */
const mascara = (n) => (/^\d{20}$/.test(n) ? n.slice(0, 7) + '-' + n.slice(7, 9) + '.' + n.slice(9, 13) + '.' + n.slice(13, 14) + '.' + n.slice(14, 16) + '.' + n.slice(16) : n);
async function consultar(params) {
  const url = BASE + '?' + params.toString(), t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Horus/1.0' }, signal: AbortSignal.timeout(20000) });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) { /* resposta que não é JSON */ }
    return { status: r.status, json: j, ms: Date.now() - t0 };
  } catch (e) { return { status: 0, erro: String((e && e.message) || e), ms: Date.now() - t0 }; }
}
/* tenta 100 por página e, se a fonte recusar, cai para 5 */
async function consultarFlex(p) {
  p.set('itensPorPagina', '100'); let r = await consultar(p);
  if (r.status === 400 || r.status === 422) { p.set('itensPorPagina', '5'); r = await consultar(p); }
  return r;
}
function paramsOab(o, ini, fim, pagina, tam) {
  const p = new URLSearchParams({ numeroOab: String(o.numero), ufOab: String(o.uf).toUpperCase(), dataDisponibilizacaoInicio: ini, dataDisponibilizacaoFim: fim, itensPorPagina: String(tam), pagina: String(pagina) });
  return p;
}
/* todas as publicações de uma OAB num período (pagina sozinho; para se acabar o orçamento de consultas) */
export async function buscarOab(o, ini, fim, orc) {
  const itens = []; let tam = 100, pagina = 1, total = null, parcial = false;
  for (;;) {
    if (orc.n <= 0) { parcial = true; break; }
    orc.n--;
    let r = await consultar(paramsOab(o, ini, fim, pagina, tam));
    if (pagina === 1 && tam === 100 && (r.status === 400 || r.status === 422) && orc.n > 0) { tam = 5; orc.n--; r = await consultar(paramsOab(o, ini, fim, pagina, tam)); }
    if (r.status !== 200 || !r.json) return { itens, erro: r.erro || ('O DJEN respondeu ' + r.status), parcial: true };
    const lote = Array.isArray(r.json.items) ? r.json.items : [];
    total = Number(r.json.count) || 0;
    itens.push(...lote);
    if (!lote.length || itens.length >= total) break;
    if (pagina === 1 && lote.length < tam) tam = lote.length;   // a fonte limitou o tamanho da página: segue no tamanho dela
    pagina++;
    if (pagina > 40) { parcial = true; break; }
  }
  return { itens, total, parcial };
}
/* peça sugerida (src/pecas.js): natureza do ato, regras do CPC, Juizado e prazo do texto */
const pcDe = (d, texto, sug) => { if (/ata de distribui/i.test(d.tipo || '')) return null; try { return sugerirPecas({ tipo: d.tipo, comunic: d.comunic, classe: d.classe, orgao: d.orgao, tribunal: d.tribunal, texto, dest: d.dest, diasTexto: sug }); } catch (e) { return null; } };
function paraDoc(i, o) {
  const texto = htmlParaTexto(i.texto), processo = String(i.numero_processo || '').replace(/\D/g, '');
  const dest = (Array.isArray(i.destinatarios) ? i.destinatarios : []).slice(0, 4).map((d) => ({ n: String(d.nome || '').replace(/^\d+\.\s*/, '').slice(0, 90), p: d.polo === 'A' ? 'A' : (d.polo === 'P' ? 'P' : '') }));
  const advs = (Array.isArray(i.destinatarioadvogados) ? i.destinatarioadvogados : []).map((x) => x && x.advogado).filter((a) => a && a.nome).slice(0, 8).map((a) => ({ n: String(a.nome).slice(0, 70), o: String(a.numero_oab || '').replace(/\D/g, '') + '/' + String(a.uf_oab || '').toUpperCase().slice(0, 2) }));
  const tipo = String(i.tipoDocumento || i.tipoComunicacao || '').slice(0, 60);
  const doc = {
    id: String(i.id), comunic: String(i.tipoComunicacao || '').slice(0, 30), data: String(i.data_disponibilizacao || '').slice(0, 10), tribunal: String(i.siglaTribunal || '').slice(0, 12), orgao: String(i.nomeOrgao || '').slice(0, 100),
    tipo, classe: String(i.nomeClasse || '').slice(0, 80), processo, numero: String(i.numeroprocessocommascara || mascara(processo)).slice(0, 40), trecho: trechoDe(texto),
    link: /^https:\/\//.test(i.link || '') ? String(i.link).slice(0, 300) : '', dest, advs, ...(({ ativo, passivo, natureza }) => ({ ativo, passivo, natureza }))(extrairDados(texto)), sug: /ata de distribui/i.test(tipo) ? null : sugerirPrazo(texto), aud: /ata de distribui/i.test(tipo) ? null : sugerirAudiencia(texto),
    oabs: [o.id], lida: false, notificada: true, em: new Date().toISOString(),
  };
  doc.pc = pcDe(doc, texto, doc.sug);
  return doc;
}

/* ---------- configuração (OABs) e banco ---------- */
const gravar = (env, colecao, id, dados) => env.DB.prepare('INSERT INTO docs (colecao,id,dados,atualizado) VALUES (?,?,?,?) ON CONFLICT(colecao,id) DO UPDATE SET dados=excluded.dados, atualizado=excluded.atualizado').bind(colecao, id, JSON.stringify(dados), Date.now());
const PADRAO = () => ({ oabs: [{ id: 'o1', nome: 'Hygor Lima Andrade', numero: '60456', uf: 'GO', ativo: true, escopo: 'tudo', avisar: true, principal: true }], ultimaLeitura: null });
export async function lerCfg(env) {
  const r = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(COL_CFG, 'config').first();
  return r ? JSON.parse(r.dados) : PADRAO();
}
const gravarCfg = (env, cfg) => gravar(env, COL_CFG, 'config', cfg).run();
const em100 = (a) => { const l = []; for (let i = 0; i < a.length; i += 90) l.push(a.slice(i, i + 90)); return l; };

/* lê as OABs ativas e guarda o que for novo; devolve um resumo */
export async function lerDjen(env, opcoes = {}) {
  usar(env);
  const t0 = Date.now(), cfg = await lerCfg(env), hoje = hojeBR(), orc = { n: opcoes.orcamento || ORCAMENTO_BUSCAS };
  const resumo = { novas: 0, lidas: 0, porOab: [], ms: 0 };
  for (const o of cfg.oabs) {
    if (!o.ativo) continue;
    const primeira = !o.ultima, completar = !cfg.advsOk;   // uma vez só: refaz os últimos 30 dias para guardar também os advogados de cada publicação
    const ini = opcoes.dias ? somarDiasISO(hoje, -opcoes.dias) : (o.ultima && !completar ? somarDiasISO(o.ultima, -2) : somarDiasISO(hoje, -30));
    const r = await buscarOab(o, ini, hoje, orc);
    let novas = 0;
    if (r.itens.length) {
      const docs = new Map();
      for (const i of r.itens) if (i && i.id != null && !docs.has(String(i.id))) docs.set(String(i.id), paraDoc(i, o));
      const ids = [...docs.keys()], existentes = new Map();
      for (const lote of em100(ids)) {
        const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ? AND id IN (' + lote.map(() => '?').join(',') + ')').bind(COL_PUB, ...lote).all();
        results.forEach((x) => existentes.set(x.id, JSON.parse(x.dados)));
      }
      const gravacoes = [], recente = somarDiasISO(hoje, -4);
      for (const [id, d] of docs) {
        const ex = existentes.get(id);
        if (ex) {
          let mudou = false;
          if (!ex.oabs.includes(o.id)) { ex.oabs.push(o.id); mudou = true; }
          if (!ex.advs && d.advs.length) { ex.advs = d.advs; mudou = true; }
          if (mudou) gravacoes.push(gravar(env, COL_PUB, id, ex));
          continue;
        }
        d.notificada = !(o.avisar && !primeira && d.data >= recente);   // a primeira leitura de uma OAB (histórico) não vira aviso
        gravacoes.push(gravar(env, COL_PUB, id, d)); novas++;
      }
      for (let k = 0; k < gravacoes.length; k += 50) await env.DB.batch(gravacoes.slice(k, k + 50));
    }
    o.erro = r.erro || '';
    if (!r.erro && !r.parcial) o.ultima = hoje;
    o.ultimaTentativa = new Date().toISOString();
    resumo.novas += novas; resumo.lidas += r.itens.length;
    resumo.porOab.push({ id: o.id, nome: o.nome, lidas: r.itens.length, novas, erro: o.erro, parcial: !!r.parcial });
  }
  cfg.ultimaLeitura = new Date().toISOString();
  if (!cfg.advsOk && resumo.porOab.every((x) => !x.erro && !x.parcial)) cfg.advsOk = true;
  await gravarCfg(env, cfg);
  await env.DB.prepare('DELETE FROM docs WHERE colecao = ? AND atualizado < ?').bind(COL_PUB, Date.now() - 400 * DIA).run();
  resumo.ms = Date.now() - t0;
  return resumo;
}

/* publicações novas que ainda não viraram notificação (o resumo das 10h manda e marca) */
export async function pubsParaAvisar(env) {
  const { results } = await env.DB.prepare("SELECT id, dados FROM docs WHERE colecao = ? AND json_extract(dados, '$.notificada') = 0 LIMIT 200").bind(COL_PUB).all();
  return results.map((r) => ({ id: r.id, ...JSON.parse(r.dados) }));
}
export async function marcarAvisadas(env, ids) {
  const cmds = [];
  for (const id of ids) { const r = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(COL_PUB, id).first(); if (r) { const d = JSON.parse(r.dados); d.notificada = true; cmds.push(gravar(env, COL_PUB, id, d)); } }
  for (let k = 0; k < cmds.length; k += 50) await env.DB.batch(cmds.slice(k, k + 50));
}

/* ---------- rotas /api/djen/... ---------- */
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const erro = (status, code, message) => json({ error: { code, message } }, status);
async function djenTeste(request) {
  const u = new URL(request.url), hoje = hojeBR();
  const oab = (u.searchParams.get('oab') || '60456').replace(/\D/g, ''), uf = (u.searchParams.get('uf') || 'GO').toUpperCase().slice(0, 2);
  const medir = async (p) => { const r = await consultar(p), j = r.json; return { status: r.status, ms: r.ms, erro: r.erro, total: j && j.count, itens: j && Array.isArray(j.items) ? j.items.length : undefined }; };
  const base = (n) => paramsOab({ numero: oab, uf }, somarDiasISO(hoje, -n), hoje, 1, 5);
  const grande = paramsOab({ numero: oab, uf }, somarDiasISO(hoje, -3), hoje, 1, 100);
  return json({ ok: true, executado_em: new Date().toISOString(), oab: oab + '/' + uf, tres_dias_tam5: await medir(base(3)), tres_dias_tam100: await medir(grande), trinta_dias: await medir(base(30)) });
}
export async function djenRotas(request, env, partes) {
  usar(env);
  const acao = partes[1], m = request.method, u = new URL(request.url);
  if (acao === 'teste' && m === 'GET') return djenTeste(request);
  if (acao === 'estado' && m === 'GET') {
    const cfg = await lerCfg(env);
    const t = await env.DB.prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN json_extract(dados, '$.lida') = 0 THEN 1 ELSE 0 END) AS nl FROM docs WHERE colecao = ?").bind(COL_PUB).first();
    const av = await env.DB.prepare("SELECT COUNT(*) AS n FROM docs WHERE colecao = ? AND json_extract(dados, '$.notificada') = 0").bind(COL_PUB).first();
    return json({ oabs: cfg.oabs, ultimaLeitura: cfg.ultimaLeitura || null, total: t.n || 0, naoLidas: t.nl || 0, aAvisar: av.n || 0, hora: '10:00' });
  }
  if (acao === 'lista' && m === 'GET') {
    const dias = Math.min(Math.max(parseInt(u.searchParams.get('dias') || '60', 10) || 60, 1), MAX_DIAS_LISTA);
    const { results } = await env.DB.prepare("SELECT id, dados FROM docs WHERE colecao = ? AND json_extract(dados, '$.data') >= ? ORDER BY json_extract(dados, '$.data') DESC, id DESC LIMIT 1500").bind(COL_PUB, somarDiasISO(hojeBR(), -dias)).all();
    return json({ pubs: results.map((r) => JSON.parse(r.dados)) });
  }
  if (acao === 'buscar' && m === 'POST') {
    const b = await request.json().catch(() => ({}));
    const dias = Math.min(Math.max(parseInt(b && b.dias, 10) || 0, 0), 120) || undefined;
    return json({ ok: true, ...(await lerDjen(env, { dias })) });
  }
  if (acao === 'oabs' && m === 'PUT') {
    const b = await request.json().catch(() => null);
    if (!b || !Array.isArray(b.oabs) || b.oabs.length > MAX_OABS) return erro(400, 'invalid', 'Lista de OABs inválida.');
    const cfg = await lerCfg(env), antigas = new Map(cfg.oabs.map((o) => [o.id, o])), vistos = new Set(), novas = [];
    for (const x of b.oabs) {
      const numero = String((x && x.numero) || '').replace(/\D/g, '').slice(0, 7), uf = String((x && x.uf) || '').toUpperCase();
      if (!numero || !/^[A-Z]{2}$/.test(uf)) return erro(400, 'invalid', 'Informe o número da OAB e a UF.');
      let id = /^[A-Za-z0-9]{2,20}$/.test((x && x.id) || '') ? x.id : 'o' + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      if (vistos.has(id)) id = 'o' + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      vistos.add(id);
      const ant = antigas.get(id), mesma = ant && ant.numero === numero && ant.uf === uf;
      novas.push({ id, nome: String(x.nome || '').trim().slice(0, 60) || ('OAB ' + numero + '/' + uf), numero, uf, ativo: x.ativo !== false, escopo: x.escopo === 'conjunto' ? 'conjunto' : 'tudo', avisar: x.avisar !== false, principal: !!(ant ? ant.principal : x.principal), ultima: mesma ? ant.ultima : undefined, erro: mesma ? (ant.erro || '') : '' });
    }
    if (!novas.some((o) => o.principal) && novas.length) novas[0].principal = true;
    cfg.oabs = novas; await gravarCfg(env, cfg);
    return json({ ok: true, oabs: novas });
  }
  if (acao === 'marcar' && m === 'POST') {
    const b = await request.json().catch(() => null);
    if (!b || !Array.isArray(b.ids) || b.ids.length > 300) return erro(400, 'invalid', 'Pedido inválido.');
    const ids = b.ids.map(String).filter((id) => /^\d{1,20}$/.test(id)), cmds = [];
    for (const lote of em100(ids)) {
      const { results } = await env.DB.prepare('SELECT id, dados FROM docs WHERE colecao = ? AND id IN (' + lote.map(() => '?').join(',') + ')').bind(COL_PUB, ...lote).all();
      for (const r of results) { const d = JSON.parse(r.dados); if (typeof b.lida === 'boolean') d.lida = b.lida; if (typeof b.semPrazo === 'boolean') d.semPrazo = b.semPrazo; cmds.push(gravar(env, COL_PUB, r.id, d)); }
    }
    for (let k = 0; k < cmds.length; k += 50) await env.DB.batch(cmds.slice(k, k + 50));
    return json({ ok: true, alteradas: cmds.length });
  }
  if (acao === 'processo' && m === 'GET') {
    const n = (u.searchParams.get('numero') || '').replace(/\D/g, '');
    if (n.length < 15 || n.length > 25) return erro(400, 'invalid', 'Número de processo inválido.');
    const res = await consultarFlex(new URLSearchParams({ numeroProcesso: n, pagina: '1' }));
    if (res.status !== 200 || !res.json) return json({ ok: false, motivo: res.erro || ('O Diário Oficial respondeu ' + res.status) });
    const itens = (Array.isArray(res.json.items) ? res.json.items : []).slice().sort((a, b) => String(b.data_disponibilizacao).localeCompare(String(a.data_disponibilizacao)));
    if (!itens.length) return json({ ok: true, achou: false });
    const d = { ativo: '', passivo: '', natureza: '', assunto: '' }, ult = itens[0];
    for (const i of itens) { const x = extrairDados(htmlParaTexto(i.texto)); for (const k of ['ativo', 'passivo', 'natureza', 'assunto']) if (!d[k] && x[k]) d[k] = x[k]; if (d.valorCausa == null && x.valorCausa) d.valorCausa = x.valorCausa; }
    return json({ ok: true, achou: true, dados: { ...d, tribunal: String(ult.siglaTribunal || '').slice(0, 12), orgao: String(ult.nomeOrgao || '').slice(0, 100), classe: String(ult.nomeClasse || '').slice(0, 80), ultimaPublicacao: String(ult.data_disponibilizacao || '').slice(0, 10), comunicacoes: itens.length } });
  }
  if (acao === 'texto' && m === 'GET') {
    const id = u.searchParams.get('id') || '';
    if (!/^\d{1,20}$/.test(id)) return erro(400, 'invalid', 'Identificador inválido.');
    const r = await env.DB.prepare('SELECT dados FROM docs WHERE colecao = ? AND id = ?').bind(COL_PUB, id).first();
    if (!r) return erro(404, 'not_found', 'Publicação não encontrada.');
    const d = JSON.parse(r.dados);
    const p = new URLSearchParams({ dataDisponibilizacaoInicio: d.data, dataDisponibilizacaoFim: d.data, itensPorPagina: '100', pagina: '1' });
    if (d.processo) p.set('numeroProcesso', d.processo);
    else { const cfg = await lerCfg(env), o = cfg.oabs.find((x) => d.oabs.includes(x.id)) || cfg.oabs[0]; p.set('numeroOab', o.numero); p.set('ufOab', o.uf); }
    const res = await consultarFlex(p);
    const item = res.json && Array.isArray(res.json.items) ? res.json.items.find((i) => String(i.id) === id) : null;
    if (!item) return json({ ok: false, trecho: d.trecho, link: d.link, motivo: res.erro || (res.status !== 200 ? 'O Diário Oficial respondeu ' + res.status : 'O tribunal não mostra mais esta publicação.') });
    const texto = htmlParaTexto(item.texto);
    const sugT = sugerirPrazo(texto);
    return json({ ok: true, texto, link: d.link || item.link || '', sug: sugT, aud: sugerirAudiencia(texto), pc: pcDe(d, texto, sugT) });
  }
  return erro(404, 'not_found', 'Não encontrado.');
}
