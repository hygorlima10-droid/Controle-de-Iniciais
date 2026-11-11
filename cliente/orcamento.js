
/* ============================================================
   ORÇAMENTO POR CATEGORIA (prefixo orc) — Fase 3, etapa 3.5 (só o proprietário)
   - Limite mensal por categoria (as mesmas categorias da tela "Para onde o dinheiro foi": categorias das despesas e "Dia a dia · …").
   - O gasto vem dos mesmos lançamentos de hoje: despesas pagas (PJ e PF somadas, sem transferências) + dia a dia dos extratos.
     O que ainda vai vencer não conta como gasto; entra só como aviso ("com o que ainda vai vencer, passa do limite").
   - Alertas em 80% e 100%: aparecem aqui e em "Precisa de atenção" na Visão geral. O orçamento NUNCA altera lançamentos.
   - Guardado em config/orcamento: { limites: { 'Categoria': { 'AAAA-MM': valor | null } } }. O limite vale a partir do mês em que foi
     definido e continua nos meses seguintes até ser mudado (null = sem limite a partir dali).
   ============================================================ */
var orcS = { cat: null };
/* número digitado em português (aceita 2.500,00, 2500,5 e 2500.5) */
function orcNum(t){ var x = String(t == null ? '' : t).replace(/[^\d,.]/g, ''); if (!x) return 0; if (x.indexOf(',') >= 0) x = x.replace(/\./g, '').replace(',', '.'); var n = parseFloat(x); return isFinite(n) ? n : 0; }
function orcDados(){ var o = config.orcamento; return (o && o.limites && typeof o.limites === 'object') ? o.limites : {}; }
function orcLimite(cat, m){
  var h = orcDados()[cat]; if (!h) return null;
  var ks = Object.keys(h).filter(function(k){ return k <= m; }).sort(); if (!ks.length) return null;
  var v = Number(h[ks[ks.length - 1]]); return v > 0.004 ? r2(v) : null;
}
function orcSalvar(cat, m, valor){
  var l = JSON.parse(JSON.stringify(orcDados())); l[cat] = l[cat] || {}; l[cat][m] = valor > 0.004 ? r2(valor) : null;
  var dados = { limites: l }; config.orcamento = dados;
  if (storageMode === 'db' && configRef) return Promise.resolve(configRef.doc('orcamento').set(dados));
  saveLocalConfig(); return Promise.resolve();
}
/* gasto do mês por rótulo de categoria: pago (despesas pagas, parciais e dia a dia) e a pagar (despesas ainda abertas) */
function orcColeta(m){
  var out = {};
  comMes(m, function(){
    ['pj', 'pf'].forEach(function(col){
      getDespesasParaMes(col).forEach(function(it){
        if (it.despesa.transferenciaId) return;
        var v = valorDespesaItem(it); if (!(v > 0.004)) return;
        var rot = CATEGORIA_LABEL[catIdValida(it.despesa.categoria)] || 'Outros', x = out[rot] = out[rot] || { gasto: 0, aPagar: 0 };
        if (it.pago) x.gasto += v; else { var sp = it.somaParcial || 0; x.gasto += sp; x.aPagar += Math.max(0, v - sp); }
      });
    });
  });
  var dd = anDiaADiaMes(m).cats;
  Object.keys(dd).forEach(function(c){ if (dd[c] > 0.004) out['Dia a dia · ' + c] = { gasto: dd[c], aPagar: 0 }; });
  return out;
}
function orcLinhas(m){
  var col = orcColeta(m), cats = {};
  Object.keys(col).forEach(function(k){ cats[k] = 1; });
  Object.keys(orcDados()).forEach(function(k){ if (orcLimite(k, m)) cats[k] = 1; });
  return Object.keys(cats).map(function(k){
    var c = col[k] || { gasto: 0, aPagar: 0 }, lim = orcLimite(k, m), g = r2(c.gasto), ap = r2(c.aPagar);
    return { k: k, gasto: g, aPagar: ap, lim: lim, pct: lim ? g / lim * 100 : null, prev: r2(g + ap) };
  }).filter(function(x){ return x.lim || x.gasto > 0.004 || x.aPagar > 0.004; });
}
function orcEstourou(l){ return !!l.lim && l.gasto >= l.lim - 0.004; }
function orcPassou80(l){ return !!l.lim && !orcEstourou(l) && l.gasto >= l.lim * 0.8 - 0.004; }
function orcAlertas(m){
  var L = orcLinhas(m).filter(function(l){ return l.lim; });
  return { est: L.filter(orcEstourou).sort(function(a, b){ return b.pct - a.pct; }), aten: L.filter(orcPassou80).sort(function(a, b){ return b.pct - a.pct; }), total: L.length };
}
function orcNomes(l){ return l.slice(0, 2).map(function(x){ return x.k; }).join(' e ') + (l.length > 2 ? ' e outras' : ''); }
function orcMsg(l){
  if (!l.lim) return '';
  if (orcEstourou(l)){
    var ex = r2(l.gasto - l.lim);
    return '<span class="orc-msg ruim">' + (ex > 0.004 ? 'Estourou em ' + fmtMoeda(ex) : 'Limite atingido') + '</span>';
  }
  if (orcPassou80(l)) return '<span class="orc-msg aten">Já passou de 80%: restam ' + fmtMoeda(r2(l.lim - l.gasto)) + '</span>';
  if (l.aPagar > 0.004 && l.prev > l.lim + 0.004) return '<span class="orc-msg aten">Com o que ainda vai vencer (' + fmtMoeda(l.aPagar) + '), passa do limite: previsto ' + fmtMoeda(l.prev) + '</span>';
  return '';
}
function orcLinhaHtml(l, por, m){
  var cor = !l.lim ? 'var(--ink-soft)' : (orcEstourou(l) ? 'var(--urgente)' : (orcPassou80(l) ? '#D99A00' : 'var(--normal)')), pct = l.lim ? Math.round(l.pct) : null;
  var itens = por[l.k] ? ctLista(por[l.k]) : '<div class="saldo-data">Sem lançamentos neste mês.</div>';
  return '<details class="orc-row" data-ct-chave="' + escapeHtml(l.k) + '"' + (ctAbertos[l.k] ? ' open' : '') + '><summary>' +
    '<div class="orc-l1">' + ctIcone(l.k) + '<span class="orc-nm">' + escapeHtml(l.k) + '</span><span class="orc-v"><b>' + fmtMoeda(l.gasto) + '</b>' + (l.lim ? ' <small>de ' + fmtMoeda(l.lim).replace(',00', '') + '</small> <em class="orc-pct" style="color:' + cor + '">' + pct + '%</em>' : ' <small>sem limite</small> <em class="orc-def">definir ›</em>') + '</span></div>' +
    (l.lim ? '<div class="orc-bar"><i style="width:' + Math.min(100, l.pct).toFixed(1) + '%;background:' + cor + '"></i></div>' : '') + orcMsg(l) + '</summary>' +
    '<div class="ct-det"><div class="orc-ed"><label>Limite mensal (R$)</label><input type="text" inputmode="decimal" value="' + (l.lim ? String(l.lim).replace('.', ',') : '') + '" placeholder="ex.: 1500"><button type="button" class="btn btn-primary" data-orc-salvar="' + escapeHtml(l.k) + '">Salvar</button>' + (l.lim ? '<button type="button" class="btn btn-ghost" data-orc-sem="' + escapeHtml(l.k) + '">Tirar o limite</button>' : '') + '</div>' +
    '<div class="saldo-data">Vale a partir de ' + escapeHtml(mesLabel(m)) + ' e continua nos meses seguintes até você mudar.</div>' + itens + '</div></details>';
}
function orcRender(){
  var m = mesSelecionado, linhas = orcLinhas(m), com = linhas.filter(function(l){ return l.lim; }).sort(function(a, b){ return b.pct - a.pct; }), sem = linhas.filter(function(l){ return !l.lim; }).sort(function(a, b){ return b.gasto - a.gasto; });
  var por = ctColetar([m]), orcado = r2(com.reduce(function(t, l){ return t + l.lim; }, 0)), gasto = r2(com.reduce(function(t, l){ return t + l.gasto; }, 0));
  var est = com.filter(orcEstourou), aten = com.filter(orcPassou80), h = '';
  var kp = function(rot, ic, cor, v, cls, foot){ return '<div class="md-card md-kpi an-kpi-i"><div class="md-h"><span class="md-k">' + mdIc(ic, cor) + '<span>' + rot + '</span></span></div><b class="md-v' + (cls ? ' ' + cls : '') + '">' + v + '</b><div class="md-foot">' + foot + '</div></div>'; };
  h += '<div class="md-kpis an-kpis4">' +
    kp('Orçado no mês', 'clipboard-list', MD_COR.ouro, fmtMoeda(orcado), '', com.length + (com.length === 1 ? ' categoria com limite' : ' categorias com limite')) +
    kp('Gasto até agora', 'wallet', MD_COR.azul, fmtMoeda(gasto), '', orcado > 0 ? Math.round(gasto / orcado * 100) + '% do orçado' : 'defina limites abaixo') +
    kp('Estouradas', 'triangle-alert', MD_COR.verm, String(est.length), est.length ? 'neg' : '', est.length ? escapeHtml(orcNomes(est)) : 'nenhuma') +
    kp('Passaram de 80%', 'gauge', MD_COR.ouro, String(aten.length), '', aten.length ? escapeHtml(orcNomes(aten)) : 'nenhuma') + '</div>';
  var esq = '<section class="ini-card an-card"><div class="an-tit an-tit-acao"><h4>Limite × gasto · ' + escapeHtml(mesLabel(m)) + '</h4></div>' +
    '<div class="saldo-data">Toque numa categoria para ver os lançamentos e mudar o limite. O limite vale para os meses seguintes até você mudar.</div>' +
    (com.length ? com.map(function(l){ return orcLinhaHtml(l, por, m); }).join('') : '<div class="financeiro-vazio">Nenhum limite definido ainda. Toque em “definir” numa categoria abaixo.</div>') +
    (sem.length ? '<div class="plano-tit" style="margin-top:14px;">Sem limite definido</div>' + sem.map(function(l){ return orcLinhaHtml(l, por, m); }).join('') : '') + '</section>';
  /* categoria × mês */
  var cats = linhas.map(function(l){ return l.k; });
  if (!orcS.cat || cats.indexOf(orcS.cat) < 0) orcS.cat = com.length ? com[0].k : (cats[0] || null);
  var dir = '', nota = function(n, t){ return '<div class="an-sem-nota"><span>' + n + '</span><div>' + t + '</div></div>'; };
  dir += '<section class="ini-card an-card"><div class="an-tit"><h4>Como funciona</h4></div>' +
    nota(1, 'O gasto vem <b>dos mesmos lançamentos de hoje</b> (despesas pagas e dia a dia), por categoria, somando PJ e PF. O que ainda vai vencer só aparece como aviso.') +
    nota(2, 'Alertas em <b>80% e 100%</b>: aparecem aqui e em “Precisa de atenção”, na Visão geral.') +
    nota(3, '<b>O orçamento nunca altera lançamentos.</b> Estourar só avisa.') +
    nota(4, 'Tocar numa linha abre os lançamentos daquela categoria no mês.') + '</section>';
  if (orcS.cat){
    var ms = anMesesAte(6), S = [{ key: 'gasto', nome: 'Gasto', cor: 'var(--accent)' }, { key: 'lim', nome: 'Limite', cor: 'var(--an-ref, #8D8D95)' }];
    anTips = [];
    var itens = ms.map(function(x){ var c = orcColeta(x)[orcS.cat] || { gasto: 0 }; return { m: x, rotuloLongo: mesLabel(x), parcial: x === todayISO().slice(0, 7), v: { gasto: r2(c.gasto), lim: orcLimite(orcS.cat, x) || 0 } }; });
    dir += '<section class="ini-card an-card"><div class="an-tit an-tit-acao"><h4>Categoria × mês</h4><select class="orc-sel" data-orc-cat="1" aria-label="Escolher a categoria">' + cats.map(function(k){ return '<option value="' + escapeHtml(k) + '"' + (k === orcS.cat ? ' selected' : '') + '>' + escapeHtml(k) + '</option>'; }).join('') + '</select></div>' +
      anLegenda(S) + anBarras({ w: Math.max(280, Math.min(460, (qs('bodyFinanceiro').clientWidth || 360) - 60)), itens: itens, series: S, empilhado: false, rotulo: 'Gasto e limite de ' + orcS.cat + ' por mês' }) + '</section>';
  }
  h += '<div class="orc-grid">' + esq + '<div class="orc-dir">' + dir + '</div></div>';
  return h;
}
function orcAplicar(){
  var corpo = qs('bodyFinanceiro'); if (!corpo) return;
  var sec = document.getElementById('finOrcamento');
  if (!sec){ sec = document.createElement('div'); sec.id = 'finOrcamento'; sec.className = 'md-painel'; sec.setAttribute('data-mf', 'orc'); corpo.insertBefore(sec, qs('finGeral')); }
  sec.style.display = finTab === 'orcamento' ? '' : 'none';
  if (finTab !== 'orcamento' || activeTab !== 'financeiro'){ sec.innerHTML = ''; return; }
  try{ sec.innerHTML = orcRender(); }catch(e){ console.error('orçamento', e); sec.innerHTML = '<div class="empty"><strong>Não consegui montar o orçamento</strong>As outras sub-abas continuam funcionando.</div>'; }
}
function orcClique(ev){
  var t = ev.target, c = function(s){ return t.closest ? t.closest(s) : null; }, b;
  if ((b = c('[data-orc-salvar]'))){
    var inp = b.parentNode.querySelector('input'), v = orcNum(inp.value);
    if (!(v > 0)){ toast('Digite um limite maior que zero (ou use “Tirar o limite”).'); return; }
    var cat = b.getAttribute('data-orc-salvar');
    Promise.resolve(orcSalvar(cat, mesSelecionado, v)).then(function(){ renderFinanceiro(); toast('Limite de ' + cat + ' salvo.'); }).catch(function(e){ console.error('orçamento', e); toast('Não consegui salvar. Tente de novo.'); });
    return;
  }
  if ((b = c('[data-orc-sem]'))){
    var cat2 = b.getAttribute('data-orc-sem');
    Promise.resolve(orcSalvar(cat2, mesSelecionado, null)).then(function(){ renderFinanceiro(); toast('Limite de ' + cat2 + ' retirado a partir deste mês.'); }).catch(function(e){ console.error('orçamento', e); toast('Não consegui salvar. Tente de novo.'); });
  }
}
document.addEventListener('change', function(ev){
  var s = ev.target && ev.target.closest ? ev.target.closest('[data-orc-cat]') : null; if (!s) return;
  orcS.cat = s.value; orcAplicar();
});
(function(){
  var st = document.createElement('style'); st.id = 'orcCss';
  st.textContent = '.orc-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:12px;align-items:start}.orc-dir{display:flex;flex-direction:column;gap:12px}.orc-grid .an-card{margin:0}@media(max-width:999px){.orc-grid{grid-template-columns:minmax(0,1fr)}}' +
    '.orc-row{border-top:1px solid var(--border);padding:10px 0}.orc-row:first-of-type{border-top:0}.orc-row>summary{list-style:none;cursor:pointer;display:block}.orc-row>summary::-webkit-details-marker{display:none}' +
    '.orc-l1{display:flex;align-items:center;gap:10px}.orc-nm{flex:1;min-width:0;font-weight:600;font-size:var(--t4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.orc-v{white-space:nowrap;font-size:var(--t3)}.orc-v b{font-size:var(--t4)}.orc-v small{color:var(--ink-soft)}' +
    '.orc-pct{font-style:normal;font-weight:800;font-size:var(--t2);margin-left:4px}.orc-def{font-style:normal;color:var(--accent);font-weight:700;font-size:var(--t2)}' +
    '.orc-bar{height:8px;border-radius:99px;background:var(--surface-2);overflow:hidden;margin:8px 0 4px 46px}.orc-bar i{display:block;height:100%;border-radius:99px}' +
    '.orc-msg{display:block;margin-left:46px;font-size:var(--t2);font-weight:600}.orc-msg.ruim{color:var(--urgente)}.orc-msg.aten{color:#B7791E}' +
    '.orc-ed{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:6px 0}.orc-ed label{font-size:var(--t2);color:var(--ink-soft);font-weight:600;width:100%}.orc-ed input{height:40px;width:140px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);color:var(--ink);padding:0 12px;font:inherit}' +
    '.orc-sel{height:36px;max-width:60%;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);color:var(--ink);font:inherit;font-weight:600;padding:0 8px}';
  document.head.appendChild(st);
})();
