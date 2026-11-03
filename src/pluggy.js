/* Open Finance via Pluggy (somente leitura). As chaves ficam nos segredos do Cloudflare:
   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e (opcional) PLUGGY_ITEM_IDS = ids das conexões, separados por vírgula. */

const cache = { chave: null, ate: 0 };
const base = (env) => (env.PLUGGY_BASE_URL || 'https://api.pluggy.ai').replace(/\/$/, '');
export const configurado = (env) => !!(env.PLUGGY_CLIENT_ID && env.PLUGGY_CLIENT_SECRET);
const cortar = (s, n = 200) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

async function apiKey(env, forcar = false) {
  if (!forcar && cache.chave && cache.ate > Date.now()) return cache.chave;
  const r = await fetch(base(env) + '/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.apiKey) throw { etapa: 'auth', status: r.status, msg: cortar(j.message || j.error || 'A Pluggy recusou as chaves.') };
  cache.chave = j.apiKey; cache.ate = Date.now() + 100 * 60e3;
  return cache.chave;
}
async function get(env, caminho, params) {
  const url = new URL(base(env) + caminho);
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v)); });
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const r = await fetch(url, { headers: { 'x-api-key': await apiKey(env, tentativa > 0), accept: 'application/json' } });
    if (r.status === 401 && tentativa === 0) continue;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw { etapa: caminho.split('/')[1], status: r.status, msg: cortar(j.message || j.error || '') };
    return j;
  }
}
const idsConfigurados = (env) => String(env.PLUGGY_ITEM_IDS || '').split(/[\s,;]+/).filter(Boolean);
async function listarItens(env) {
  const ids = idsConfigurados(env);
  if (ids.length) return { ids, origem: 'segredo' };
  const j = await get(env, '/items', {});
  const lista = (j.results || []).map((x) => x.id).filter(Boolean);
  return { ids: lista, origem: 'lista da Pluggy' };
}
const mascarar = (s) => { const t = String(s || '').replace(/\s/g, ''); return t.length <= 4 ? t : '…' + t.slice(-4); };
const dia = (iso) => String(iso || '').slice(0, 10);
const hojeISO = () => new Date().toISOString().slice(0, 10);
const somarDias = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function movimentos(env, contaId, de, ate) {
  const todos = [];
  for (let pagina = 1; pagina <= 12; pagina++) {
    const j = await get(env, '/transactions', { accountId: contaId, from: de, to: ate, pageSize: 500, page: pagina });
    (j.results || []).forEach((m) => todos.push(m));
    if (!j.totalPages || pagina >= j.totalPages) break;
  }
  return todos;
}

/* ---------- diagnóstico: o que a Pluggy devolve, sem expor segredos ---------- */
export async function diagnostico(env) {
  const out = { configurado: configurado(env), itens: [], avisos: [] };
  if (!out.configurado) { out.avisos.push('Faltam os segredos PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no Cloudflare.'); return out; }
  try { await apiKey(env, true); out.autenticou = true; } catch (e) { out.autenticou = false; out.erro = `Autenticação: ${e.status || ''} ${e.msg || ''}`.trim(); return out; }
  let lista;
  try { lista = await listarItens(env); out.origemItens = lista.origem; } catch (e) { out.avisos.push(`Não consegui listar as conexões (${e.status || '?'} ${e.msg || ''}). Informe os Item IDs no segredo PLUGGY_ITEM_IDS.`); return out; }
  if (!lista.ids.length) out.avisos.push('Nenhuma conexão encontrada. Informe os Item IDs no segredo PLUGGY_ITEM_IDS.');
  const de = somarDias(hojeISO(), -90), ate = hojeISO();
  for (const id of lista.ids) {
    const it = { id: String(id).slice(0, 8) + '…', contas: [] };
    try {
      const item = await get(env, '/items/' + id, {});
      it.conector = (item.connector && item.connector.name) || '?'; it.tipoConector = item.connector && item.connector.type; it.status = item.status; it.executionStatus = item.executionStatus; it.atualizadoEm = item.lastUpdatedAt || null;
      const contas = (await get(env, '/accounts', { itemId: id })).results || [];
      for (const c of contas) {
        const ct = { tipo: c.type, subtipo: c.subtype, nome: cortar(c.name, 40), numero: mascarar((c.bankData && c.bankData.transferNumber) || c.number), saldo: c.balance };
        try {
          const ms = await movimentos(env, c.id, de, ate);
          ct.movimentos90d = ms.length;
          const datas = ms.map((m) => dia(m.date)).sort();
          ct.primeira = datas[0] || null; ct.ultima = datas[datas.length - 1] || null;
        } catch (e) { ct.erro = `movimentos: ${e.status || ''} ${e.msg || ''}`.trim(); }
        it.contas.push(ct);
      }
    } catch (e) { it.erro = `${e.etapa || ''}: ${e.status || ''} ${e.msg || ''}`.trim(); }
    out.itens.push(it);
  }
  return out;
}

/* ---------- sincronização: devolve as contas correntes já no formato dos extratos do app ---------- */
export async function sincronizar(env, desde) {
  const res = { contas: [], cartoes: [], erros: [] };
  const lista = await listarItens(env);
  const ate = hojeISO();
  for (const id of lista.ids) {
    let item;
    try { item = await get(env, '/items/' + id, {}); } catch (e) { res.erros.push(`Conexão ${String(id).slice(0, 8)}…: ${e.status || ''} ${e.msg || ''}`.trim()); continue; }
    const conector = (item.connector && item.connector.name) || 'Banco';
    const pj = (item.connector && item.connector.type) === 'BUSINESS_BANK';
    const nome = String(conector).toUpperCase();
    const banco = /ITA[ÚU]/.test(nome) ? 'Itaú' : /SICOOB/.test(nome) ? 'Sicoob' : conector;
    const chaveBanco = /ITA[ÚU]/.test(nome) ? 'itau' : /SICOOB/.test(nome) ? 'sicoob' : String(conector).toLowerCase().replace(/[^a-z0-9]+/g, '');
    let contas = [];
    try { contas = (await get(env, '/accounts', { itemId: id })).results || []; } catch (e) { res.erros.push(`${conector}: contas ${e.status || ''} ${e.msg || ''}`.trim()); continue; }
    for (const c of contas) {
      const credito = c.type === 'CREDIT';
      let ms = [];
      try { ms = await movimentos(env, c.id, desde, ate); } catch (e) { res.erros.push(`${conector} ${mascarar(c.number)}: movimentos ${e.status || ''} ${e.msg || ''}`.trim()); continue; }
      const linhas = ms.filter((m) => m.status !== 'PENDING').map((m) => {
        const debito = m.type === 'DEBIT' || (m.type === undefined && Number(m.amount) < 0);
        const contra = ((debito ? m.paymentData && m.paymentData.receiver : m.paymentData && m.paymentData.payer) || {});
        const doc = (contra.documentNumber && contra.documentNumber.value) || '';
        return { id: m.id, data: dia(m.date), desc: cortar(m.description || m.descriptionRaw, 140), nome: cortar(contra.name, 100), doc: String(doc), valor: (debito ? -1 : 1) * Math.round(Math.abs(Number(m.amount)) * 100) };
      }).sort((a, b) => a.data.localeCompare(b.data));
      if (credito) { res.cartoes.push({ itemId: id, contaId: c.id, banco, nome: cortar(c.name, 40), numero: mascarar(c.number), saldo: c.balance, limite: c.creditData && c.creditData.creditLimit, movimentos: linhas.length }); continue; }
      const tn = (c.bankData && c.bankData.transferNumber) || c.number || '';
      const partes = String(tn).split('/');
      const ag = partes.length > 1 ? partes[0].replace(/\D/g, '') : '', cc = (partes.length > 1 ? partes.slice(1).join('/') : tn).replace(/[^0-9A-Za-z-]/g, '');
      res.contas.push({
        chave: `${chaveBanco}-${ag || '?'}-${cc || '?'}`, banco, tipoConta: pj ? 'pj' : 'pf', ag, cc, itemId: id, contaId: c.id,
        titular: { nome: cortar(c.owner, 80), doc: String(c.taxNumber || '') }, saldoAtual: c.balance == null ? null : Math.round(Number(c.balance) * 100), emitido: new Date().toISOString().slice(0, 19),
        de: linhas.length ? linhas[0].data : desde, ate: linhas.length ? linhas[linhas.length - 1].data : ate, lanc: linhas,
      });
    }
  }
  return res;
}
