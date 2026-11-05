/* ============================================================
   CATEGORIAS: ícones e cores, lançamentos dentro de cada categoria (Análises)
   e "Já lançados" (Extratos) para corrigir categoria e nome
   ============================================================ */
var CT_SVG = {
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 001 .8h8.9a1 1 0 001-.8L20 7H6"/>',
  fuel: '<path d="M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12M14 10h2a2 2 0 012 2v4a1.5 1.5 0 003 0V9l-3-3"/><path d="M7 7h4"/>',
  food: '<path d="M6 3v7a2 2 0 004 0V3M8 12v9M17 3c-2 1-3 4-3 7h3v11"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  build: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4"/>',
  pct: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  wallet: '<path d="M3 7a2 2 0 012-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="17" cy="13.5" r="1"/>',
  dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 016 0"/>',
  heart: '<path d="M20.8 5.6a5 5 0 00-7.1 0L12 7.3l-1.7-1.7a5 5 0 00-7.1 7.1L12 21l8.8-8.3a5 5 0 000-7.1z"/>',
  book: '<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-6a3 3 0 00-3 3"/><path d="M20 4v14h-7"/>',
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  car: '<path d="M5 16l1.5-6a2 2 0 011.9-1.5h7.2A2 2 0 0117.5 10L19 16"/><rect x="3" y="16" width="18" height="4" rx="1"/><circle cx="7.5" cy="18" r=".6"/><circle cx="16.5" cy="18" r=".6"/>',
  plane: '<path d="M2 16l20-8-6 14-3-6z"/><path d="M13 16l-3 5"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  pill: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="M9.2 7.2l5.6 5.6" transform="rotate(0)"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  arrows: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12l2 2 4-4"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  scale: '<path d="M12 3v18M5 21h14M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z"/>',
  hammer: '<path d="M14 6l4 4M3 21l9-9M10 8l5-5 6 6-5 5z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.5-1 1.5-2.5 1.5-2.5.5-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  shovel: '<path d="M15 3l6 6-3 3-6-6z"/><path d="M12 9l-7 7a2.5 2.5 0 003.5 3.5l7-7"/>',
  pillar: '<path d="M4 20h16M6 20V9M12 20V9M18 20V9M3 9h18l-9-5z"/>',
  brick: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 14.5h18M9 5v5M15 10v4.5M9 14.5V19"/>',
  roof: '<path d="M2 14L12 5l10 9H2z"/><path d="M6 14v6h12v-6"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  door: '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M15 12h.01"/>',
  window: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 4v16M4 12h16"/>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>',
  brush: '<rect x="4" y="3" width="14" height="5" rx="1"/><path d="M18 5h2v5h-8v4M12 14v7"/>',
  leaf: '<path d="M5 19c0-8 5-13 15-14 0 10-5 15-13 14zM5 19l7-7"/>',
  hardhat: '<path d="M4 15v-1a8 8 0 0116 0v1"/><path d="M2 15h20v3H2z"/><path d="M12 6v5M9 8l1.5 3M15 8l-1.5 3"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 00-5 5L3 18l3 3 6.5-6.5a4 4 0 005-5l-2.5 2.5-2-2z"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  truck: '<rect x="2" y="7" width="12" height="9"/><path d="M14 10h4l4 3v3h-8"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M12 8v13M5 13v8h14v-8M8 8a2.5 2.5 0 010-5c2.5 0 4 5 4 5s1.5-5 4-5a2.5 2.5 0 010 5"/>'
};
var CT_PALETA = ['#8B5CF6', '#DB2777', '#0D9488', '#EA580C', '#0284C7', '#16A34A', '#92400E', '#475569'];
/* ordem importa: a primeira regra que combina vale */
var CT_REGRAS = [
  [/distribui|lucro/, 'wallet', '#8B5CF6'],
  [/cartao|credito|fatura/, 'card', '#D93B3B'],
  [/mercado|supermerc|atacad|hortifruti/, 'cart', '#17895A'],
  [/combust|gasolina|etanol|posto/, 'fuel', '#2A78D6'],
  [/alimenta|restaur|lanch|padaria|comida|ifood|cafe/, 'food', '#C98500'],
  [/farmac|saude|medic|plano de saude|dentist|consulta/, 'heart', '#DB2777'],
  [/educa|curso|pos grad|facul|escola|livro/, 'book', '#0D9488'],
  [/telefone|internet|celular|operadora/, 'phone', '#4F46E5'],
  [/sistema|software|assinatura|tecnolog|nuvem|facebook|google|meta ads/, 'cpu', '#4F46E5'],
  [/imposto|tribut|darf|\bdas\b|iss\b|taxa|tarifa|juros|multa/, 'pct', '#C2410C'],
  [/estrutura|aluguel|escritor|condomin|coworking/, 'build', '#B7791E'],
  [/casa|moradia|energia|\bluz\b|agua|reforma|mobili/, 'home', '#0284C7'],
  [/transporte|uber|taxi|estacion|pedagio|onibus/, 'car', '#64748B'],
  [/viagem|lazer|passeio|ferias|hotel|cinema/, 'plane', '#EA580C'],
  [/beleza|cabelo|estetic|salao|barbear|unha/, 'spark', '#DB2777'],
  [/presente|doac|dizimo|igreja/, 'gift', '#16A34A'],
  [/pessoal|salario|pro.?labore|familia|filh/, 'user', '#0D9488'],
  [/banco|financ|emprest|parcel/, 'bank', '#475569']
];
function ctNorm(t){ return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function ctHash(t){ var h = 0, i; for (i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }
function ctVisual(rot){
  var cru = String(rot || ''), n = ctNorm(cru.replace(/^Dia a dia\s*·\s*/i, '')), dia = /^Dia a dia/i.test(cru);
  var i, cat = (typeof CATEGORIAS_LISTA !== 'undefined' ? CATEGORIAS_LISTA : []).filter(function(c){ return c.label === cru; })[0];
  if (/^(outros|outras|diversos|geral)$/.test(n)) return dia ? { ic: 'bag', cor: '#EA580C' } : { ic: 'dots', cor: '#8A93AD' };
  for (i = 0; i < CT_REGRAS.length; i++) if (CT_REGRAS[i][0].test(n)) return { ic: CT_REGRAS[i][1], cor: CT_REGRAS[i][2] };
  return { ic: 'tag', cor: (cat && cat.cor) || CT_PALETA[ctHash(n) % CT_PALETA.length] };
}
function ctIcone(rot, peq){
  var v = ctVisual(rot);
  return '<span class="ct-ic' + (peq ? ' sm' : '') + '" style="background:' + v.cor + '" aria-hidden="true"><svg viewBox="0 0 24 24">' + CT_SVG[v.ic] + '</svg></span>';
}
var CT_LAPIS = '<svg class="ct-lapis" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';

/* ---------- coleta dos lançamentos de cada categoria nos meses pedidos ---------- */
function ctLinhasDia(m){
  var out = {};
  extratos.forEach(function(d){
    if (d.tipo !== 'diaadia' || d.mes !== m || !Array.isArray(d.linhas)) return;
    d.linhas.forEach(function(l){ (out[l.c] = out[l.c] || []).push({ doc: d.id, id: l.id, d: l.d, t: l.t, v: l.v }); });
  });
  return out;
}
function ctColetar(meses){
  var por = {};
  meses.forEach(function(m){
    var D = anDespesasMes(m);
    (D.itens || []).forEach(function(it){
      var rot = CATEGORIA_LABEL[it.cat] || 'Outros', x = por[rot] = por[rot] || { v: 0, itens: [], sem: 0 };
      x.v = r2(x.v + it.valor); x.itens.push({ k: 'desp', id: it.id, t: it.nome, d: it.data, v: it.valor, fixa: it.fixa });
    });
    var L = ctLinhasDia(m);
    Object.keys(D.diaADiaCats).forEach(function(c){
      var rot = 'Dia a dia · ' + c, tot = D.diaADiaCats[c], x = por[rot] = por[rot] || { v: 0, itens: [], sem: 0 }, soma = 0;
      x.v = r2(x.v + tot);
      (L[c] || []).forEach(function(l){ soma += l.v; x.itens.push({ k: 'dd', doc: l.doc, id: l.id, t: l.t, d: l.d, v: l.v }); });
      if (tot - soma > 0.004) x.sem = r2(x.sem + tot - soma);
    });
  });
  return por;
}
var ctAbertos = {};
function ctDonut(lista, total){
  var r = 50, C = 2 * Math.PI * r, off = 0, segs = '';
  lista.forEach(function(x){
    var L = x.v / total * C, g = lista.length > 1 ? Math.min(2, L * 0.4) : 0;
    segs += '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + ctVisual(x.k).cor + '" stroke-width="20" stroke-dasharray="' + (L - g).toFixed(1) + ' ' + (C - L + g).toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" transform="rotate(-90 70 70)"/>';
    off += L;
  });
  return '<svg class="ct-donut" viewBox="0 0 140 140" role="img" aria-label="Participação de cada categoria no total">' + segs + '<text x="70" y="66" text-anchor="middle" class="ct-dt1">Total</text><text x="70" y="85" text-anchor="middle" class="ct-dt2">' + escapeHtml(fmtMoeda(total).replace(',00', '')) + '</text></svg>';
}
function ctLista(x){
  var itens = x.itens.slice().sort(function(a, b){ return String(b.d || '').localeCompare(String(a.d || '')); }), h = '';
  itens.slice(0, 40).forEach(function(i){
    h += '<div class="ct-l"><span class="ct-d">' + (i.d ? escapeHtml(String(i.d).slice(8, 10) + '/' + String(i.d).slice(5, 7)) : '') + '</span><span class="ct-t">' + escapeHtml(i.t || 'Sem nome') + '</span><span class="ct-v">' + fmtMoeda(i.v) + '</span>' +
      '<button type="button" class="ct-ed" data-ct-edit="' + i.k + '|' + escapeHtml(i.id) + '|' + escapeHtml(i.doc || '') + '" aria-label="Editar">' + CT_LAPIS + '</button></div>';
  });
  if (itens.length > 40) h += '<div class="saldo-data">e mais ' + (itens.length - 40) + ' lançamentos menores.</div>';
  if (x.sem > 0.004) h += '<div class="saldo-data ct-nota">' + fmtMoeda(x.sem) + ' vieram de extratos confirmados antes desta versão, que guardavam só o total. Os próximos aparecem um a um.</div>';
  if (!h) h = '<div class="saldo-data">Sem lançamentos para mostrar.</div>';
  return h;
}
/* base: { rótulo: média por mês } para as setas de comparação (opcional) */
function ctCardHtml(meses, base, setaFn){
  var por = ctColetar(meses), lista = Object.keys(por).map(function(k){ return { k: k, v: por[k].v }; }).filter(function(x){ return x.v > 0.004; }).sort(function(a, b){ return b.v - a.v; });
  var total = lista.reduce(function(t, x){ return t + x.v; }, 0);
  if (!lista.length) return { total: 0, html: '<div class="financeiro-vazio">Ainda não há despesas no período.</div>', lista: lista, por: por };
  var top3 = lista.slice(0, 3).reduce(function(t, x){ return t + x.v; }, 0);
  var h = '<div class="ct-topo">' + ctDonut(lista, total) + '<div class="ct-leg">Cada cor é uma categoria.<br>As 3 maiores somam <b>' + Math.round(top3 / total * 100) + '%</b> do total.</div></div><div class="ct-lista">';
  lista.forEach(function(x){
    var seta = (base && setaFn) ? setaFn(x.v, base[x.k] || 0) : '', cor = ctVisual(x.k).cor;
    h += '<details class="ct-row" data-ct-chave="' + escapeHtml(x.k) + '"' + (ctAbertos[x.k] ? ' open' : '') + '><summary>' + ctIcone(x.k) +
      '<span class="ct-nm">' + escapeHtml(x.k) + seta + '</span><span class="ct-vl">' + fmtMoeda(x.v) + '</span>' +
      '<span class="ct-br"><i style="width:' + Math.max(2, x.v / lista[0].v * 100).toFixed(0) + '%;background:' + cor + '"></i></span><span class="ct-pc">' + Math.round(x.v / total * 100) + '%</span></summary><div class="ct-det">' + ctLista(por[x.k]) + '</div></details>';
  });
  return { total: total, html: h + '</div>', lista: lista, por: por };
}

/* ---------- folha de edição (categoria e nome; o valor é o do extrato e não muda) ---------- */
var ctEd = null;
function ctMontarEd(){
  if (qs('overlayCtEd')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayCtEd';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="ctEdTit">Editar lançamento</h2><button class="icon-btn" id="ctEdX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<div class="modal-body"><div class="parcela-sum" id="ctEdInfo"></div><div class="field"><label class="field-label" for="ctEdCat">Categoria</label><select id="ctEdCat"></select></div>' +
    '<div class="field"><label class="field-label" for="ctEdNome">Nome</label><input type="text" id="ctEdNome" maxlength="80"></div><div class="saldo-data" id="ctEdHint"></div><div class="form-error" id="ctEdErro"></div>' +
    '<button type="button" class="btn btn-primary" id="ctEdSalvar" style="width:100%;justify-content:center;">Salvar</button><button type="button" class="btn btn-ghost" id="ctEdCancelar" style="width:100%;justify-content:center;">Cancelar</button></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){ if (e.target === d || (e.target.closest && e.target.closest('#ctEdX, #ctEdCancelar'))) d.classList.remove('show'); });
  qs('ctEdSalvar').addEventListener('click', ctSalvarEd);
}
function ctCatsDia(doc){
  var l = EXT_CATS.slice(); Object.keys((doc && doc.cats) || {}).forEach(function(c){ if (l.indexOf(c) < 0) l.push(c); }); return l;
}
function ctAbrirEd(ref){
  ctMontarEd(); var p = ref.split('|'), k = p[0], id = p[1], docId = p[2], info = '', nome = '', cats = [], atual = '', hint = '', val = 0;
  if (k === 'desp'){
    var d = despesas.filter(function(x){ return x.id === id; })[0]; if (!d) return;
    nome = d.nome || ''; atual = catIdValida(d.categoria); val = d.valorPadrao || d.valor || 0;
    cats = (CATEGORIAS_LISTA || []).map(function(c){ return [c.id, c.label]; });
    info = '<b>' + escapeHtml(nome) + '</b>' + (d.data ? ' · ' + fmtData(d.data) : '');
    if (d.tipo === 'fixa') hint = 'Despesa fixa: a mudança vale para todos os meses dela.';
  } else if (k === 'dd'){
    var doc = extDocPorId(docId), ln = doc && (doc.linhas || []).filter(function(x){ return x.id === id; })[0]; if (!ln) return;
    nome = ln.t || ''; atual = ln.c; val = ln.v; cats = ctCatsDia(doc).map(function(c){ return [c, 'Dia a dia · ' + c]; });
    info = '<b>' + escapeHtml(nome) + '</b> · ' + fmtData(ln.d) + ' · ' + fmtMoeda(ln.v);
  } else if (k === 'rec'){
    var r = receitasManuais.filter(function(x){ return x.id === id; })[0]; if (!r) return;
    nome = r.descricao || r.nome || ''; atual = ''; cats = []; info = '<b>' + escapeHtml(nome) + '</b> · ' + fmtMoeda(r.valor);
  } else return;
  ctEd = { k: k, id: id, docId: docId };
  qs('ctEdInfo').innerHTML = info + '<br><span class="saldo-data">O valor é o do extrato e não muda aqui.</span>';
  var sel = qs('ctEdCat'); sel.innerHTML = cats.map(function(c){ return '<option value="' + escapeHtml(c[0]) + '"' + (c[0] === atual ? ' selected' : '') + '>' + escapeHtml(c[1]) + '</option>'; }).join('');
  sel.parentNode.style.display = cats.length ? '' : 'none';
  qs('ctEdNome').value = nome; qs('ctEdHint').textContent = hint; qs('ctEdErro').textContent = '';
  qs('overlayCtEd').classList.add('show');
}
function ctSalvarEd(){
  var e = ctEd; if (!e) return; var nome = qs('ctEdNome').value.trim(), cat = qs('ctEdCat').value;
  if (!nome){ qs('ctEdErro').textContent = 'O nome não pode ficar vazio.'; return; }
  var p;
  if (e.k === 'desp'){
    var d = despesas.filter(function(x){ return x.id === e.id; })[0]; if (!d) return;
    p = persistPatchDespesa(d, { nome: nome, categoria: cat });
  } else if (e.k === 'dd'){
    var doc = extDocPorId(e.docId); if (!doc) return;
    var cats = JSON.parse(JSON.stringify(doc.cats || {})), linhas = JSON.parse(JSON.stringify(doc.linhas || [])), ln = linhas.filter(function(x){ return x.id === e.id; })[0]; if (!ln) return;
    if (ln.c !== cat){
      var o = cats[ln.c]; if (o){ o.v = r2(o.v - ln.v); o.n = Math.max(0, (o.n || 1) - 1); if (o.n <= 0 || o.v < 0.005) delete cats[ln.c]; }
      var nv = cats[cat] = cats[cat] || { v: 0, n: 0 }; nv.v = r2(nv.v + ln.v); nv.n++; ln.c = cat;
    }
    ln.t = nome;
    p = extGravar(doc.id, { tipo: 'diaadia', mes: doc.mes, conta: doc.conta, coluna: doc.coluna, cats: cats, linhas: linhas, atualizadoEm: new Date().toISOString() });
  } else if (e.k === 'rec'){
    var r = receitasManuais.filter(function(x){ return x.id === e.id; })[0]; if (!r) return;
    p = persistPatchReceita(r, { descricao: nome });
  }
  Promise.resolve(p).then(function(){ qs('overlayCtEd').classList.remove('show'); ctAtualizarTelas(); toast('Lançamento atualizado.'); }, function(){ qs('ctEdErro').textContent = 'Não consegui salvar. Tente de novo.'; });
}
function ctAtualizarTelas(){
  try{ if (activeTab === 'analises') renderAnalises(); }catch(x){}
  try{ if (activeTab === 'extratos') renderExtratos(); }catch(x){}
  try{ if (typeof renderFinanceiro === 'function') renderFinanceiro(); }catch(x){}
}

/* ---------- Extratos: "Já lançados" ---------- */
var ctJa = { mes: null, filtro: 'tudo', busca: '', aberto: false };
function ctJaItens(m){
  var out = [];
  extratos.forEach(function(d){
    if (d.tipo !== 'diaadia' || d.mes !== m || !Array.isArray(d.linhas)) return;
    d.linhas.forEach(function(l){ out.push({ k: 'dd', id: l.id, doc: d.id, t: l.t, d: l.d, v: l.v, rot: 'Dia a dia · ' + l.c, grupo: 'dia' }); });
  });
  despesas.forEach(function(x){
    if (!x.origemExtrato || x.tipo !== 'unica' || String(x.data || '').slice(0, 7) !== m) return;
    out.push({ k: 'desp', id: x.id, doc: '', t: x.nome, d: x.data, v: Number(x.valor) || 0, rot: CATEGORIA_LABEL[catIdValida(x.categoria)] || 'Outros', grupo: 'desp' });
  });
  receitasManuais.forEach(function(r){
    if (!r.origemExtrato || String(r.mesReferencia || r.data || '').slice(0, 7) !== m) return;
    out.push({ k: 'rec', id: r.id, doc: '', t: r.descricao || r.nome || 'Receita', d: r.data, v: Number(r.valor) || 0, rot: 'Receita', grupo: 'rec' });
  });
  return out.sort(function(a, b){ return String(b.d || '').localeCompare(String(a.d || '')); });
}
function ctJaMeses(){
  var s = {}; extratos.forEach(function(d){ if (d.tipo === 'diaadia' && Array.isArray(d.linhas) && d.linhas.length) s[d.mes] = 1; });
  despesas.forEach(function(x){ if (x.origemExtrato && x.data) s[String(x.data).slice(0, 7)] = 1; });
  receitasManuais.forEach(function(r){ if (r.origemExtrato) s[String(r.mesReferencia || r.data || '').slice(0, 7)] = 1; });
  return Object.keys(s).filter(Boolean).sort();
}
function ctJaLinhas(){
  var m = ctJa.mes, q = ctNorm(ctJa.busca), f = ctJa.filtro;
  var itens = ctJaItens(m).filter(function(i){ return (f === 'tudo' || i.grupo === f) && (!q || ctNorm(i.t + ' ' + i.rot).indexOf(q) >= 0); });
  if (!itens.length) return '<div class="financeiro-vazio">Nada neste filtro.</div>';
  return itens.slice(0, 120).map(function(i){
    return '<div class="ct-ja">' + ctIcone(i.rot === 'Receita' ? 'Distribuição' : i.rot) + '<div class="ct-ja-t"><b>' + escapeHtml(i.t || 'Sem nome') + '</b><span class="saldo-data">' + (i.d ? fmtData(i.d) : '') + ' · ' + escapeHtml(i.rot) + '</span></div><div class="ct-ja-v">' + fmtMoeda(i.v) + '</div>' +
      '<button type="button" class="ct-ed" data-ct-edit="' + i.k + '|' + escapeHtml(i.id) + '|' + escapeHtml(i.doc) + '" aria-label="Editar">' + CT_LAPIS + '</button></div>';
  }).join('') + (itens.length > 120 ? '<div class="saldo-data">Mostrando 120 de ' + itens.length + '. Use a busca.</div>' : '');
}
function ctJaHtml(){
  var meses = ctJaMeses();
  if (!meses.length) return '<details class="ini-card ct-jadet"' + (ctJa.aberto ? ' open' : '') + '><summary><b>Já lançados</b><span class="saldo-data">corrija categoria e nome</span></summary><div class="financeiro-vazio">Os lançamentos dos extratos que você confirmar a partir de agora aparecem aqui, um por um, para você corrigir categoria e nome.</div></details>';
  if (!ctJa.mes || meses.indexOf(ctJa.mes) < 0) ctJa.mes = meses[meses.length - 1];
  var i = meses.indexOf(ctJa.mes);
  var chips = [['tudo', 'Tudo'], ['desp', 'Despesas'], ['dia', 'Dia a dia'], ['rec', 'Receitas']].map(function(c){ return '<button type="button" class="seg-btn' + (ctJa.filtro === c[0] ? ' active' : '') + '" data-ctja-filtro="' + c[0] + '">' + c[1] + '</button>'; }).join('');
  return '<details class="ini-card ct-jadet"' + (ctJa.aberto ? ' open' : '') + '><summary><b>Já lançados</b><span class="saldo-data">corrija categoria e nome</span></summary>' +
    '<div class="an-ult-nav"><button type="button" class="icon-btn" data-ctja-mes="-1"' + (i <= 0 ? ' disabled' : '') + ' aria-label="Mês anterior">‹</button><b>' + escapeHtml(mesLabel(ctJa.mes)) + '</b><button type="button" class="icon-btn" data-ctja-mes="1"' + (i >= meses.length - 1 ? ' disabled' : '') + ' aria-label="Mês seguinte">›</button></div>' +
    '<input type="search" id="ctJaBusca" class="ct-busca" placeholder="Buscar por nome ou categoria" value="' + escapeHtml(ctJa.busca) + '"><div class="segmented ct-chips">' + chips + '</div><div id="ctJaLista">' + ctJaLinhas() + '</div></details>';
}
(function(){
  var orig = renderExtratos;
  renderExtratos = function(){
    var r = orig.apply(this, arguments);
    try{ var el = qs('extJa'); if (el && storageMode === 'db') el.innerHTML = ctJaHtml(); }catch(e){ console.error('já lançados', e); }
    return r;
  };
  var st = document.createElement('style');
  st.textContent =
    '.ct-ic{width:34px;height:34px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}.ct-ic svg{width:18px;height:18px;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.ct-ic.sm{width:26px;height:26px;border-radius:9px}.ct-ic.sm svg{width:14px;height:14px}' +
    '.ct-topo{display:flex;gap:12px;align-items:center;margin:4px 0 8px}.ct-donut{width:132px;height:132px;flex-shrink:0}.ct-dt1{font-size:var(--t1);fill:var(--ink-soft)}.ct-dt2{font-size:var(--t4);font-weight:700;fill:var(--ink)}.ct-leg{font-size:var(--t2);color:var(--ink-soft);line-height:1.5}.ct-leg b{color:var(--ink)}' +
    '.ct-row{border-bottom:1px solid var(--border)}.ct-row:last-child{border:0}.ct-row>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:34px minmax(0,1fr) auto;grid-template-areas:"i n v" "i b p";gap:3px 10px;align-items:center;padding:9px 0}.ct-row>summary::-webkit-details-marker{display:none}' +
    '.ct-row>summary .ct-ic{grid-area:i;grid-row:1/3}.ct-nm{grid-area:n;font-size:var(--t4);font-weight:600;line-height:1.25;min-width:0}.ct-vl{grid-area:v;font-size:var(--t4);font-weight:700;text-align:right;white-space:nowrap}.ct-br{grid-area:b;height:7px;border-radius:4px;background:var(--surface-2);overflow:hidden}.ct-br i{display:block;height:100%;border-radius:4px}.ct-pc{grid-area:p;font-size:var(--t1);color:var(--ink-soft);text-align:right}' +
    '.ct-det{margin:0 0 8px 44px;background:var(--bg);border-radius:12px;padding:4px 10px}.ct-l{display:grid;grid-template-columns:38px minmax(0,1fr) auto 28px;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:var(--t2)}.ct-l:last-of-type{border:0}.ct-d{color:var(--ink-soft)}.ct-t{font-weight:600;font-size:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ct-v{font-weight:600;white-space:nowrap}' +
    '.ct-ed{border:0;background:transparent;padding:3px;cursor:pointer;display:inline-flex}.ct-lapis{width:18px;height:18px;stroke:var(--accent);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.ct-nota{margin-top:6px}' +
    '.ct-jadet>summary{list-style:none;cursor:pointer;display:flex;flex-direction:column;gap:2px}.ct-jadet>summary::-webkit-details-marker{display:none}.ct-busca{width:100%;margin:6px 0;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--bg);font-size:var(--t4)}.ct-chips{margin:4px 0 8px}' +
    '.ct-ja{display:grid;grid-template-columns:34px minmax(0,1fr) auto 28px;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)}.ct-ja-t b{font-size:var(--t4);font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis}.ct-ja-v{font-size:var(--t4);font-weight:700;white-space:nowrap}';
  document.head.appendChild(st);
  document.addEventListener('toggle', function(e){
    var d = e.target; if (!d || !d.getAttribute) return;
    var c = d.getAttribute('data-ct-chave'); if (c !== null) ctAbertos[c] = d.open;
    if (d.classList && d.classList.contains('ct-jadet')) ctJa.aberto = d.open;
  }, true);
  document.addEventListener('click', function(ev){
    var ed = ev.target.closest ? ev.target.closest('[data-ct-edit]') : null;
    if (ed){ ev.preventDefault(); ev.stopPropagation(); ctAbrirEd(ed.getAttribute('data-ct-edit')); return; }
    var mm = ev.target.closest ? ev.target.closest('[data-ctja-mes]') : null;
    if (mm && !mm.disabled){ var ms = ctJaMeses(), i = ms.indexOf(ctJa.mes) + parseInt(mm.getAttribute('data-ctja-mes'), 10); if (i >= 0 && i < ms.length){ ctJa.mes = ms[i]; qs('extJa').innerHTML = ctJaHtml(); } return; }
    var ff = ev.target.closest ? ev.target.closest('[data-ctja-filtro]') : null;
    if (ff){ ctJa.filtro = ff.getAttribute('data-ctja-filtro'); qs('extJa').innerHTML = ctJaHtml(); return; }
  }, true);
  document.addEventListener('input', function(ev){
    if (ev.target && ev.target.id === 'ctJaBusca'){ ctJa.busca = ev.target.value; var l = qs('ctJaLista'); if (l) l.innerHTML = ctJaLinhas(); }
  });
})();
