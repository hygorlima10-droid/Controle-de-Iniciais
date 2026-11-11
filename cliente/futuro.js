
/* ============================================================
   FUTURO (prefixo fut) — Fase 3, etapa 3.7 (Análises > Futuro; só o proprietário)
   - Projeção patrimonial de 12, 24 ou 36 meses, em três cenários (conservador, intermediário, otimista). É ESTIMATIVA, não dinheiro:
     aparece tracejada e com o selo "estimativa", e nunca é somada ao dinheiro disponível.
   - Modelo simples e explicado na tela: a parte parada (contas + dinheiro da obra) fica como está; a parte que rende (reserva + outras metas)
     rende X% ao mês e recebe a poupança do mês. Poupança automática = média do resultado (recebido − gasto) dos últimos meses FECHADOS
     (Histórico): conservador 50%, intermediário 100%, otimista 150%. Rendimento padrão: 0,4%, 0,7% e 1,0% ao mês.
   - As premissas (poupança e rendimento de cada cenário) podem ser editadas; ficam em config/futuro (nada muda em lançamentos).
   - Abaixo, o conteúdo da antiga "Próx. 3 meses" (caixa dos próximos 3 meses), repaginado.
   ============================================================ */
var anFutN = 24;
var FUT_CEN = [['otim', 'Otimista', '#17895A'], ['inter', 'Intermediário', '#C98500'], ['cons', 'Conservador', '#2A78D6']];
var FUT_RENDE = { cons: 0.4, inter: 0.7, otim: 1.0 }, FUT_MULT = { cons: 0.5, inter: 1, otim: 1.5 };
function futDados(){ var c = config.futuro; return (c && typeof c === 'object') ? c : {}; }
function futBase(){ var m = anMediaMeses(anMesesFechados(anMesesAte(7))); return m ? { n: m.n, sobra: r2(m.sobra) } : { n: 0, sobra: 0 }; }
function futPremissas(){
  var d = futDados(), b = futBase(), out = { base: b };
  FUT_CEN.forEach(function(c){
    var k = c[0], u = d[k] || {}, vazio = function(v){ return v === null || v === undefined || v === ''; };
    var auto = b.sobra > 0 ? r2(b.sobra * FUT_MULT[k]) : r2(b.sobra);
    out[k] = { auto: auto, poupa: vazio(u.poupa) ? auto : Number(u.poupa), rende: vazio(u.rende) ? FUT_RENDE[k] : Number(u.rende), poupaEditada: !vazio(u.poupa), rendeEditado: !vazio(u.rende) };
  });
  return out;
}
/* de onde parte a projeção: patrimônio de hoje dividido no que fica parado e no que rende */
function futPartida(){
  var hoje = todayISO(), P = anPatrimonioEm(hoje.slice(0, 7)); if (!P) return null;
  var obra = r2(obraSaldoEm(hoje)), metas = Math.max(0, r2(P.outras - obra));
  return { total: P.total, parado: r2(P.contas + obra), aplicado: r2(P.reserva + metas) };
}
function futSerie(B, pr, meses){
  var arr = [B.total], ap = B.aplicado;
  for (var i = 1; i <= meses; i++){ ap = ap * (1 + pr.rende / 100) + pr.poupa; arr.push(r2(B.parado + ap)); }
  return arr;
}
function futHistorico(){
  var m0 = todayISO().slice(0, 7), pri = anPrimeiroMes(), ini = deslocarMes(m0, -11), out = [];
  for (var m = ini < pri ? pri : ini; m <= m0; m = deslocarMes(m, 1)){ var P = anPatrimonioEm(m); if (P) out.push({ m: m, v: P.total }); }
  return out;
}
function futGrafico(w, hist, S, meses){
  var H = 252, L = 46, R = 64, T = 16, Bt = 28, pw = w - L - R, ph = H - T - Bt, nh = Math.max(0, hist.length - 1), tot = nh + meses, i;
  var todos = hist.map(function(x){ return x.v; }).concat(S.cons, S.otim, S.inter), esc = anEscala(Math.min.apply(null, todos), Math.max.apply(null, todos));
  var X = function(k){ return L + pw * k / tot; }, Y = function(v){ return T + ph - (v - esc.lo) / (esc.hi - esc.lo) * ph; };
  var s = '<svg class="an-svg" viewBox="0 0 ' + w + ' ' + H + '" width="100%" role="img" aria-label="Projeção do patrimônio em três cenários (estimativa)">';
  esc.ticks.forEach(function(t){ s += '<line class="an-grid" x1="' + L + '" x2="' + (w - R) + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/><text class="an-eixo" x="' + (L - 6) + '" y="' + (Y(t) + 3.5) + '" text-anchor="end">' + anFmtEixo(t) + '</text>'; });
  var pts = function(arr){ return arr.map(function(v, t){ return X(nh + t) + ',' + Y(v); }).join(' '); };
  s += '<polygon points="' + pts(S.otim) + ' ' + S.cons.slice().reverse().map(function(v, t){ return X(nh + meses - t) + ',' + Y(v); }).join(' ') + '" style="fill:var(--accent);fill-opacity:.12"/>';
  if (hist.length > 1) s += '<polyline points="' + hist.map(function(x, k){ return X(k) + ',' + Y(x.v); }).join(' ') + '" fill="none" style="stroke:var(--ink)" stroke-width="2.6" stroke-linejoin="round"/>';
  FUT_CEN.forEach(function(c){
    var arr = S[c[0]];
    s += '<polyline points="' + pts(arr) + '" fill="none" stroke="' + c[2] + '" stroke-width="2.4" stroke-dasharray="6 5" stroke-linecap="round"/><circle cx="' + X(tot) + '" cy="' + Y(arr[meses]) + '" r="4.2" style="fill:var(--surface)" stroke="' + c[2] + '" stroke-width="2"/>';
  });
  /* rótulos do fim das linhas, sem se atropelarem */
  var fins = FUT_CEN.map(function(c){ return { c: c, y: Y(S[c[0]][meses]) + 3.5, v: S[c[0]][meses] }; }).sort(function(a, b){ return a.y - b.y; });
  for (i = 1; i < fins.length; i++) if (fins[i].y - fins[i - 1].y < 12) fins[i].y = fins[i - 1].y + 12;
  fins.forEach(function(f){ s += '<text class="an-val" x="' + (X(tot) + 9) + '" y="' + f.y + '" fill="' + f.c[2] + '">' + anFmtEixo(f.v) + '</text>'; });
  s += '<line x1="' + X(nh) + '" x2="' + X(nh) + '" y1="' + T + '" y2="' + (T + ph) + '" style="stroke:var(--ink-soft)" stroke-dasharray="3 4"/><text class="an-eixo" x="' + (X(nh) + 4) + '" y="' + (T + 10) + '" font-weight="700">hoje</text>';
  s += '<rect x="' + (L + 4) + '" y="' + (T + 16) + '" width="74" height="19" rx="9.5" style="fill:var(--surface);stroke:var(--accent)"/><text x="' + (L + 41) + '" y="' + (T + 29) + '" text-anchor="middle" font-size="9.5" font-weight="800" style="fill:var(--accent)">ESTIMATIVA</text>';
  var rot = [[0, hist.length ? mesCurto(hist[0].m) : 'hoje'], [nh, 'hoje'], [nh + Math.round(meses / 2), '+' + Math.round(meses / 2) + ' m'], [tot, '+' + meses + ' m']];
  rot.forEach(function(r, k){ s += '<text class="an-eixo" x="' + X(r[0]) + '" y="' + (H - 8) + '" text-anchor="' + (k === 3 ? 'end' : (k === 0 ? 'start' : 'middle')) + '">' + escapeHtml(r[1]) + '</text>'; });
  for (i = 0; i <= tot; i++){
    var tip;
    if (i < nh) tip = '<b>' + escapeHtml(mesCurto(hist[i].m)) + '</b> (realizado)<br>Patrimônio: <b>' + fmtMoeda(hist[i].v) + '</b>';
    else { var k = i - nh; tip = '<b>' + (k === 0 ? 'Hoje' : 'Daqui a ' + k + (k === 1 ? ' mês' : ' meses')) + '</b> <em>(estimativa)</em>' + FUT_CEN.map(function(c){ return '<br><i style="background:' + c[2] + '"></i>' + c[1] + ': <b>' + fmtMoeda(S[c[0]][k]) + '</b>'; }).join(''); }
    s += '<rect class="an-hit" x="' + (X(i) - pw / tot / 2) + '" y="' + T + '" width="' + (pw / tot) + '" height="' + (ph + Bt) + '" data-tip="' + anTip(tip) + '"/>';
  }
  return s + '</svg>';
}
function futSalvar(dados){
  config.futuro = dados;
  if (storageMode === 'db' && configRef) return Promise.resolve(configRef.doc('futuro').set(dados));
  saveLocalConfig(); return Promise.resolve();
}
function renderAnaliseFuturo(el){
  var w = Math.max(280, Math.floor((el.clientWidth || 360) - 30)), h = '', B = futPartida(), nota = function(n, t){ return '<div class="an-sem-nota"><span>' + n + '</span><div>' + t + '</div></div>'; };
  h += '<div class="an-topo"><div class="segmented" id="anPeriodoSeg" role="group" aria-label="Período">' + anSegBotoes() + '</div></div>';
  h += '<div class="an-sem-aviso aviso-est"><b>Isto é uma estimativa, não dinheiro.</b><span>Parte do patrimônio de hoje e dos meses fechados e aplica as premissas abaixo. Tudo que é projetado aparece tracejado e com o selo “estimativa”. Nada aqui altera lançamentos nem entra no dinheiro disponível.</span></div>';
  if (!B){
    h += anCard('Projeção patrimonial', '', '<div class="financeiro-vazio">Informe o saldo das contas (em Patrimônio) para projetar o patrimônio.</div>');
  } else {
    var P = futPremissas(), S = {}, meses = anFutN;
    FUT_CEN.forEach(function(c){ S[c[0]] = futSerie(B, P[c[0]], 36); });
    var corte = function(arr, n){ return arr.slice(0, n + 1); }, Sn = { cons: corte(S.cons, meses), inter: corte(S.inter, meses), otim: corte(S.otim, meses) };
    h += '<section class="ini-card an-card"><div class="an-tit an-tit-acao"><div class="md-per" role="group" aria-label="Horizonte">' + [12, 24, 36].map(function(n){ return '<button type="button" data-an-fut-n="' + n + '" class="' + (meses === n ? 'on' : '') + '">' + n + ' meses</button>'; }).join('') + '</div><button type="button" class="an-sem-mais" data-an-ir="anFutPrem">premissas ›</button></div>' +
      '<div class="saldo-data">Patrimônio de hoje: <b>' + fmtMoeda(B.total) + '</b> (parado: ' + fmtMoeda(B.parado) + ' · rende: ' + fmtMoeda(B.aplicado) + '). A linha escura é o que já aconteceu; as tracejadas são estimativas.</div>' +
      futGrafico(w, futHistorico(), Sn, meses) +
      '<div class="an-leg"><span><i style="background:var(--ink)"></i>Realizado</span>' + FUT_CEN.map(function(c){ return '<span><i style="background:' + c[2] + '"></i>' + c[1] + '</span>'; }).join('') + '</div>' +
      anTabela(['Em', 'Conservador', 'Intermediário', 'Otimista'], [12, 24, 36].map(function(n){ return [n + ' meses', fmtMoeda(S.cons[n]), fmtMoeda(S.inter[n]), fmtMoeda(S.otim[n])]; })) + '</section>';
    h += '<div class="md-kpis fut-cen">' + FUT_CEN.slice().reverse().map(function(c){
      var k = c[0], p = P[k];
      return '<div class="md-card md-kpi an-kpi-i"><div class="md-h"><span class="md-k" style="color:' + c[2] + '"><span>' + c[1] + ' · estimativa</span></span></div>' +
        [12, 24, 36].map(function(n){ return '<div class="md-foot">em ' + n + ' meses</div><b class="md-v">' + fmtMoeda(Math.round(S[k][n])).replace(',00', '') + '</b>'; }).join('') +
        '<div class="md-foot" style="margin-top:6px">poupa ' + fmtMoeda(p.poupa).replace(',00', '') + '/mês · rende ' + String(p.rende).replace('.', ',') + '% ao mês</div></div>';
    }).join('') + '</div>';
    var linha = function(c){
      var k = c[0], p = P[k];
      return '<tr><th scope="row" style="color:' + c[2] + '">' + c[1] + '</th><td><input type="text" inputmode="decimal" id="futP_' + k + '" value="' + (p.poupaEditada ? String(p.poupa).replace('.', ',') : '') + '" placeholder="automático: ' + fmtMoeda(p.auto).replace(',00', '') + '"></td><td><input type="text" inputmode="decimal" id="futR_' + k + '" value="' + (p.rendeEditado ? String(p.rende).replace('.', ',') : '') + '" placeholder="padrão: ' + String(FUT_RENDE[k]).replace('.', ',') + '"></td></tr>';
    };
    h += '<section class="ini-card an-card" id="anFutPrem"><div class="an-tit"><h4>Premissas (você pode editar cada uma)</h4></div>' +
      '<div class="an-tab-rolar fut-prem"><table><thead><tr><th></th><th>Poupa por mês (R$)</th><th>Rende ao mês (%)</th></tr></thead><tbody>' + FUT_CEN.slice().reverse().map(linha).join('') + '</tbody></table></div>' +
      '<div class="sim-acoes"><button type="button" class="btn btn-primary" data-fut="salvar">Salvar premissas</button><button type="button" class="btn btn-ghost" data-fut="auto">Voltar ao automático</button></div>' +
      nota(1, '<b>Quanto poupa por mês</b>: o automático parte da média do resultado (recebido − gasto) dos últimos ' + (P.base.n || 0) + ' meses <b>fechados</b> (' + fmtMoeda(P.base.sobra) + ' por mês, vem do Histórico): 50% no conservador, 100% no intermediário e 150% no otimista.' + (P.base.n === 0 ? ' Ainda não há mês fechado: a poupança automática é zero até haver histórico (você pode digitar um valor).' : '')) +
      nota(2, '<b>Rendimento</b>: % ao mês sobre a reserva e as outras metas (hoje ' + fmtMoeda(B.aplicado) + '), que também recebem a poupança do mês. O que está nas contas e na obra não rende nesta conta.') +
      nota(3, '<b>Obra</b>: o dinheiro da obra entra no patrimônio como já entra hoje; a projeção não inventa gastos nem financiamento novos.') + '</section>';
  }
  h += anHtmlProximos3(w);
  el.innerHTML = h + '<div id="anTip" class="an-tip" role="status" style="display:none;"></div>';
  anTipEl = qs('anTip');
}
document.addEventListener('click', function(ev){
  var n = ev.target.closest ? ev.target.closest('#anWrap [data-an-fut-n]') : null;
  if (n){ anFutN = parseInt(n.getAttribute('data-an-fut-n'), 10) || 24; renderAnalises(); return; }
  var b = ev.target.closest ? ev.target.closest('#anWrap [data-fut]') : null; if (!b) return;
  if (b.getAttribute('data-fut') === 'auto'){ futSalvar({}).then(function(){ renderAnalises(); toast('Premissas voltaram ao automático.'); }); return; }
  var d = {}, ruim = false;
  FUT_CEN.forEach(function(c){
    var k = c[0], p = String((document.getElementById('futP_' + k) || {}).value || '').trim(), r = String((document.getElementById('futR_' + k) || {}).value || '').trim();
    var pn = p === '' ? null : orcNum(p) * (/^\s*-/.test(p) ? -1 : 1), rn = r === '' ? null : orcNum(r);
    if (rn !== null && (rn < 0 || rn > 5)) ruim = true;
    d[k] = { poupa: pn, rende: rn };
  });
  if (ruim){ toast('O rendimento ao mês precisa estar entre 0 e 5%.'); return; }
  futSalvar(d).then(function(){ renderAnalises(); toast('Premissas salvas.'); }).catch(function(e){ console.error('futuro', e); toast('Não consegui salvar. Tente de novo.'); });
});
(function(){
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { futSerie: futSerie, futPremissas: futPremissas, futPartida: futPartida });
  var st = document.createElement('style'); st.id = 'futCss';
  st.textContent = '.aviso-est{background:rgba(201,133,0,.12)!important;color:var(--ink)!important}.aviso-est b{color:#9A6700}' +
    '.fut-cen{grid-template-columns:repeat(3,minmax(0,1fr))!important}.fut-cen .md-card{cursor:default}.fut-cen .md-v{margin-bottom:2px}@media(max-width:700px){.fut-cen{grid-template-columns:minmax(0,1fr)!important}}' +
    '.fut-prem th,.fut-prem td{padding:6px 8px;text-align:left}.fut-prem input{height:38px;width:100%;min-width:110px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);color:var(--ink);font:inherit;padding:0 10px}' +
    '.fut-sec{margin:22px 2px 10px}.fut-sec h3{margin:0 0 2px;font-size:var(--t5,1.1rem);font-weight:800}' +
    '.md-per{display:inline-flex;background:var(--surface-2);border-radius:10px;padding:3px}.md-per button{border:0;background:none;border-radius:8px;padding:6px 12px;font:inherit;font-size:var(--t2);font-weight:600;color:var(--ink-soft);cursor:pointer}.md-per button.on{background:var(--surface);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}';
  document.head.appendChild(st);
})();
