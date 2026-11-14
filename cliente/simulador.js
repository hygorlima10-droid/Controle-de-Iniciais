
/* ============================================================
   SIMULADOR FINANCEIRO (prefixo sim) — Fase 3, etapa 3.6 (Análises > Simulador; só o proprietário)
   - Você monta um "e se" com receita extra, despesa nova, transferência PJ → PF e aporte na reserva, e vê o efeito no caixa livre (PJ + PF).
   - Usa a MESMA projeção do caixa dos próximos meses (Futuro) (anProjecao: parcelas com data, despesas não pagas, dia a dia pela média; alvarás de fora).
   - NADA é gravado nos lançamentos. O cenário fica na memória da tela; "Guardar neste aparelho" salva só neste navegador (localStorage).
   - O "Pergunte ao app" liga aqui: a resposta de um "e se" tem o botão "Abrir no Simulador" (simDeCenario converte a pergunta em eventos).
   ============================================================ */
var SIM_CHAVE = 'horus.simulador.v1';
var SIM_TIPOS = { receita: ['Receita extra', 'trending-up', MD_COR.verde], despesa: ['Despesa nova', 'trending-down', MD_COR.verm], transf: ['Transferência PJ → PF', 'arrow-left-right', MD_COR.azul], aporte: ['Aporte na reserva', 'piggy-bank', MD_COR.verde] };
var simS = { eventos: [], ed: null, n: 6, seq: 1 };
(function(){ try{ var o = JSON.parse(localStorage.getItem(SIM_CHAVE) || 'null'); if (o && Array.isArray(o.eventos)){ simS.eventos = o.eventos; simS.seq = o.eventos.length + 1; } }catch(e){} })();
function simMeses(){ var m0 = todayISO().slice(0, 7), l = []; for (var i = 0; i < 12; i++) l.push(deslocarMes(m0, i)); return l; }
function simIdx(mes){ var m0 = todayISO().slice(0, 7), i = 0; if (!/^\d{4}-\d{2}$/.test(mes || '') || mes < m0) return 0; for (var m = m0; m < mes && i < 60; m = deslocarMes(m, 1)) i++; return i; }
function simDesc(e){
  var v = Number(e.valor) || 0, mes = mesCurto(e.mes);
  if (e.rep === 'mensal') return fmtMoeda(v) + ' por mês · a partir de ' + mes;
  if (e.rep === 'parcelas'){ var n = Math.max(2, parseInt(e.n, 10) || 2); return fmtMoeda(v) + ' em ' + n + 'x de ' + fmtMoeda(r2(v / n)) + ' · a partir de ' + mes; }
  return fmtMoeda(v) + ' · ' + mes;
}
/* efeito mês a mês: caixa livre e reserva, sem e com o cenário */
function simCalcular(eventos, H){
  var pr = anProjecao(H), n = pr.linhas.length, dCx = [], dRes = [], i, res = computeReservaInfo();
  for (i = 0; i < n; i++){ dCx.push(0); dRes.push(0); }
  eventos.forEach(function(e){
    var v = Number(e.valor) || 0; if (!(v > 0)) return;
    var i0 = simIdx(e.mes), sinal = e.tipo === 'receita' ? 1 : (e.tipo === 'despesa' || e.tipo === 'aporte' ? -1 : 0);
    for (var k = i0; k < n; k++){
      var j = k - i0, val = 0;
      if (e.rep === 'mensal') val = v;
      else if (e.rep === 'parcelas'){ var np = Math.max(2, parseInt(e.n, 10) || 2); if (j < np) val = v / np; }
      else if (j === 0) val = v;
      if (!val) continue;
      dCx[k] += sinal * val; if (e.tipo === 'aporte') dRes[k] += val;
    }
  });
  var cx = 0, rs = 0, linhas = pr.linhas.map(function(l, k){
    cx = r2(cx + dCx[k]); rs = r2(rs + dRes[k]);
    return { m: l.m, base: l.saldoBase, cen: r2(l.saldoBase + cx), resBase: r2(res.atual), resCen: r2(res.atual + rs) };
  });
  var menor = function(f){ return linhas.reduce(function(a, l){ return !a || f(l) < f(a) ? l : a; }, null); };
  return { ini: pr.ini, linhas: linhas, menorBase: menor(function(l){ return l.base; }), menorCen: menor(function(l){ return l.cen; }),
    negCen: linhas.filter(function(l){ return l.cen < -0.004; })[0] || null, negBase: linhas.filter(function(l){ return l.base < -0.004; })[0] || null };
}
/* do "e se" do Pergunte ao app para eventos do simulador */
function simDeCenario(c){
  var m0 = todayISO().slice(0, 7), valor = Math.abs(Number(c.valor) || 0), n = Math.max(1, Math.min(60, parseInt(c.parcelas, 10) || 1)), ent = Math.max(0, Number(c.entrada) || 0);
  var mes = /^\d{4}-\d{2}$/.test(c.mes || '') && c.mes >= m0 ? c.mes : m0, tipo = c.tipoEvento === 'entrada' ? 'receita' : 'despesa', d = String(c.descricao || '').slice(0, 60), out = [];
  if (ent > 0 && ent < valor) out.push({ tipo: tipo, valor: r2(ent), mes: mes, rep: 'uma', n: 1, desc: (d ? d + ' · ' : '') + 'entrada' });
  var resto = ent > 0 && ent < valor ? r2(valor - ent) : valor;
  if (n > 1) out.push({ tipo: tipo, valor: resto, mes: mes, rep: 'parcelas', n: n, desc: d });
  else out.push({ tipo: tipo, valor: resto, mes: mes, rep: 'uma', n: 1, desc: d });
  out.forEach(function(e, k){ e.id = 'p' + (k + 1); });
  return out;
}
function simAbrir(eventos){
  simS.eventos = eventos.slice(); simS.seq = eventos.length + 1; simS.ed = null; anPeriodo = 'sim';
  if (activeTab !== 'analises') setActiveTab('analises'); else renderAnalises();
}
function simPergunta(){
  var partes = simS.eventos.map(function(e){ var t = SIM_TIPOS[e.tipo][0].toLowerCase(); return t + (e.desc ? ' (' + e.desc + ')' : '') + ' de ' + simDesc(e); });
  return partes.length ? 'E se eu tivesse: ' + partes.join('; ') + '? O caixa aguenta? Em qual mês fica mais apertado?' : '';
}
function simForm(e){
  var meses = simMeses(), tipo = SIM_TIPOS[e.tipo], podeParc = e.tipo === 'receita' || e.tipo === 'despesa';
  return '<div class="sim-form"><div class="sim-ft"><b>' + (e.id ? 'Editar' : 'Novo') + ': ' + tipo[0] + '</b></div>' +
    '<label>Valor (R$)<input type="text" id="simV" inputmode="decimal" value="' + (e.valor ? String(e.valor).replace('.', ',') : '') + '" placeholder="ex.: 5000"></label>' +
    '<label>Mês<select id="simM">' + meses.map(function(m){ return '<option value="' + m + '"' + (m === e.mes ? ' selected' : '') + '>' + escapeHtml(mesCurto(m)) + '</option>'; }).join('') + '</select></label>' +
    '<label>Quando<select id="simR" data-sim-rep="1"><option value="uma"' + (e.rep === 'uma' ? ' selected' : '') + '>Uma vez só</option><option value="mensal"' + (e.rep === 'mensal' ? ' selected' : '') + '>Todo mês, a partir daí</option>' + (podeParc ? '<option value="parcelas"' + (e.rep === 'parcelas' ? ' selected' : '') + '>Parcelado (o valor é o total)</option>' : '') + '</select></label>' +
    (e.rep === 'parcelas' ? '<label>Parcelas<input type="number" id="simN" min="2" max="60" value="' + (e.n || 3) + '"></label>' : '') +
    '<label class="sim-desc">Descrição (opcional)<input type="text" id="simD" maxlength="60" value="' + escapeHtml(e.desc || '') + '" placeholder="ex.: carro novo"></label>' +
    '<div class="sim-bt"><button type="button" class="btn btn-primary" data-sim="salvar">Salvar</button>' + (e.id ? '<button type="button" class="btn btn-ghost" data-sim="excluir">Excluir</button>' : '') + '<button type="button" class="btn btn-ghost" data-sim="cancelar">Cancelar</button></div></div>';
}
function simLerForm(){
  var g = function(id){ var x = document.getElementById(id); return x ? x.value : ''; }, e = simS.ed; if (!e) return;
  e.valor = orcNum(g('simV')); e.mes = g('simM') || e.mes; e.rep = g('simR') || e.rep; e.n = parseInt(g('simN'), 10) || e.n || 3; e.desc = g('simD');
}
function renderAnaliseSimulador(el){
  var w = Math.max(280, Math.floor((el.clientWidth || 360) - 30)), wMeia = (el.clientWidth || 360) >= 760 ? Math.floor(((el.clientWidth || 360) - 12) * 0.58) - 34 : w, h = '';
  var H = simS.n, S = simCalcular(simS.eventos, H), L = S.linhas, fim = L[L.length - 1], tem = simS.eventos.length > 0;
  h += '<div class="an-topo"><div class="segmented" id="anPeriodoSeg" role="group" aria-label="Período">' + anSegBotoes() + '</div></div>';
  h += '<div class="an-sem-aviso ok"><b>Aqui nada é gravado.</b><span>Você monta um “e se” e vê o efeito no caixa livre (PJ + PF), com a mesma projeção do caixa dos próximos meses (a que está em Futuro). Sair da tela apaga o cenário, a não ser que você guarde neste aparelho.</span></div>';
  if (tem && S.negCen) h += '<div class="an-sem-aviso neg"><b>Com este cenário o caixa livre fica negativo em ' + escapeHtml(mesLabel(S.negCen.m)) + ' (−' + fmtMoeda(Math.abs(S.negCen.cen)) + ').</b><span>' + (S.negBase ? 'Sem o cenário ele já ficaria negativo em ' + escapeHtml(mesLabel(S.negBase.m)) + '.' : 'Sem o cenário o caixa não fica negativo.') + '</span></div>';
  else if (tem) h += '<div class="an-sem-aviso ok"><b>Com este cenário o caixa livre não fica negativo em nenhum dos próximos ' + H + ' meses.</b><span>O ponto mais baixo é ' + fmtMoeda(S.menorCen.cen) + ', em ' + escapeHtml(mesLabel(S.menorCen.m)) + '.</span></div>';
  /* cenário */
  var linhasEv = simS.eventos.map(function(e){
    var t = SIM_TIPOS[e.tipo];
    return '<div class="sim-ev">' + mdIc(t[1], t[2]) + '<span class="sim-tx"><b>' + escapeHtml(e.desc || t[0]) + '</b><span class="saldo-data">' + (e.desc ? escapeHtml(t[0]) + ' · ' : '') + escapeHtml(simDesc(e)) + '</span></span><button type="button" class="md-link" data-sim="editar:' + escapeHtml(e.id) + '">editar</button></div>';
  }).join('');
  var cen = '<section class="ini-card an-card"><div class="an-tit an-tit-acao"><h4>Cenário</h4>' + (tem ? '<button type="button" class="an-sem-mais" data-sim="limpar">limpar ›</button>' : '') + '</div>' +
    (tem ? linhasEv : '<div class="financeiro-vazio">Nenhum evento ainda. Adicione o que quer testar.</div>') +
    (simS.ed ? simForm(simS.ed) : '<div class="plano-tit sim-tit">Adicionar ao cenário</div><div class="sim-opcoes">' + [['receita', 'Receita extra', 'entra dinheiro'], ['despesa', 'Despesa nova', 'sai dinheiro'], ['transf', 'Transferência', 'da PJ para a PF'], ['aporte', 'Aporte', 'para a reserva']].map(function(o){ var t = SIM_TIPOS[o[0]]; return '<button type="button" class="sim-opc" data-sim="novo:' + o[0] + '">' + mdIc(t[1], t[2]) + '<span class="sim-opc-tx"><b>' + o[1] + '</b><span>' + o[2] + '</span></span></button>'; }).join('') + '</div>') +
    (tem && !simS.ed ? '<div class="sim-acoes"><button type="button" class="btn btn-ghost" data-sim="guardar">Guardar neste aparelho</button>' + (typeof paTemSample === 'function' && paTemSample() ? '<button type="button" class="btn btn-ghost" data-pa-abrir="' + escapeHtml(simPergunta()) + '">Perguntar ao app</button>' : '') + '</div>' : '') +
    '<div class="saldo-data an-nota">Quem usa o <b>Pergunte ao app</b> (“e se eu…”) pode abrir a resposta aqui, já preenchida: é o mesmo cálculo, só que com tela para ajustar.</div></section>';
  /* gráfico e indicadores */
  var pontos = L.map(function(l){ return { rot: anRotMes(l.m), v: { base: l.base, cen: l.cen }, tip: '<b>' + escapeHtml(mesCurto(l.m)) + '</b><br>Sem o cenário: <b>' + fmtMoeda(l.base) + '</b><br>Com o cenário: <b>' + fmtMoeda(l.cen) + '</b>' }; });
  var series = [{ key: 'base', nome: 'Sem o cenário', cor: 'var(--an-ref, #8D8D95)', tracejada: true }, { key: 'cen', nome: 'Com o cenário', cor: 'var(--accent)' }];
  var kp = function(rot, v, cls, foot){ return '<div class="md-card md-kpi an-kpi-i"><div class="md-h"><span class="md-k"><span>' + rot + '</span></span></div><b class="md-v' + (cls ? ' ' + cls : '') + '">' + v + '</b><div class="md-foot">' + foot + '</div></div>'; };
  var dir = '<section class="ini-card an-card"><div class="an-tit an-tit-acao"><h4>Caixa livre (PJ + PF) · hoje × cenário</h4><button type="button" class="an-sem-mais" data-sim="n:' + (H === 6 ? 12 : 6) + '">' + (H === 6 ? '12 meses ›' : '6 meses ›') + '</button></div>' +
    '<div class="saldo-data">Começa com o caixa de hoje: ' + fmtMoeda(S.ini) + '. Só parcelas com data e despesas não pagas; alvarás ficam de fora.</div>' +
    anLegenda(series.map(function(s){ return { nome: s.nome, cor: s.cor }; })) + anLinhas({ w: wMeia, pontos: pontos, series: series, rotulo: 'Caixa livre previsto, sem e com o cenário' }) +
    anTabela(['Mês', 'Sem o cenário', 'Com o cenário'], L.map(function(l){ return [escapeHtml(mesCurto(l.m)), fmtMoeda(l.base), fmtMoeda(l.cen)]; })) + '</section>' +
    '<div class="md-kpis sim-kpis">' + kp('Caixa livre em ' + escapeHtml(mesCurto(fim.m)), fmtMoeda(fim.cen), fim.cen < 0 ? 'neg' : '', 'antes: ' + fmtMoeda(fim.base)) +
    kp('Menor caixa no período', fmtMoeda(S.menorCen.cen), S.menorCen.cen < 0 ? 'neg' : '', escapeHtml(mesCurto(S.menorCen.m)) + ' · antes: ' + fmtMoeda(S.menorBase.base) + ' (' + escapeHtml(mesCurto(S.menorBase.m)) + ')') +
    kp('Reserva em ' + escapeHtml(mesCurto(fim.m)), fmtMoeda(fim.resCen), '', 'antes: ' + fmtMoeda(fim.resBase)) + '</div>';
  var tipos = {}; simS.eventos.forEach(function(e){ tipos[e.tipo] = 1; });
  var nota = (tipos.transf ? '<div class="an-sem-nota"><span>↔</span><div>A <b>transferência PJ → PF não muda o caixa livre</b> (o dinheiro só muda de bolso); ela reduz o caixa da PJ e aumenta o da PF.</div></div>' : '') +
    (tipos.aporte ? '<div class="an-sem-nota"><span>↗</span><div>O <b>aporte na reserva sai do caixa livre</b> e entra na reserva (por isso o caixa cai e a reserva sobe).</div></div>' : '');
  h += '<div class="sim-grid">' + cen + '<div class="sim-dir">' + dir + (nota ? '<section class="ini-card an-card">' + nota + '</section>' : '') + '</div></div>';
  el.innerHTML = h + '<div id="anTip" class="an-tip" role="status" style="display:none;"></div>';
  anTipEl = qs('anTip');
}
document.addEventListener('click', function(ev){
  var b = ev.target.closest ? ev.target.closest('#anWrap [data-sim]') : null; if (!b) return;
  var a = b.getAttribute('data-sim'), p = a.split(':'), k = p[0], v = p[1];
  if (k === 'novo'){ simS.ed = { id: null, tipo: v, valor: 0, mes: todayISO().slice(0, 7), rep: 'uma', n: 3, desc: '' }; }
  else if (k === 'editar'){ var e0 = simS.eventos.filter(function(x){ return x.id === v; })[0]; if (e0) simS.ed = JSON.parse(JSON.stringify(e0)); }
  else if (k === 'cancelar'){ simS.ed = null; }
  else if (k === 'salvar'){
    simLerForm(); var e = simS.ed;
    if (!(e.valor > 0)){ toast('Digite um valor maior que zero.'); return; }
    if (e.rep === 'parcelas' && !(e.n >= 2)){ toast('Informe pelo menos 2 parcelas.'); return; }
    if (e.id){ simS.eventos = simS.eventos.map(function(x){ return x.id === e.id ? e : x; }); }
    else { e.id = 's' + (simS.seq++); simS.eventos.push(e); }
    simS.ed = null;
  }
  else if (k === 'excluir'){ var id = simS.ed && simS.ed.id; simS.eventos = simS.eventos.filter(function(x){ return x.id !== id; }); simS.ed = null; }
  else if (k === 'limpar'){ simS.eventos = []; simS.ed = null; try{ localStorage.removeItem(SIM_CHAVE); }catch(e1){} }
  else if (k === 'guardar'){ try{ localStorage.setItem(SIM_CHAVE, JSON.stringify({ eventos: simS.eventos })); toast('Cenário guardado neste aparelho.'); }catch(e2){ toast('Não consegui guardar neste aparelho.'); } return; }
  else if (k === 'n'){ simS.n = v === '12' ? 12 : 6; }
  renderAnalises();
});
document.addEventListener('change', function(ev){
  var s = ev.target && ev.target.closest ? ev.target.closest('#anWrap [data-sim-rep]') : null; if (!s || !simS.ed) return;
  simLerForm(); renderAnalises();
});
/* Pergunte ao app: "Abrir no Simulador" na resposta de um "e se" */
document.addEventListener('click', function(ev){
  var b = ev.target.closest ? ev.target.closest('[data-sim-pergunte]') : null; if (!b) return;
  var t = paHistorico[parseInt(b.getAttribute('data-sim-pergunte'), 10)]; if (!t || !t.cen) return;
  paFechar(); simAbrir(simDeCenario(t.cen));
});
(function(){
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { simS: simS, simDeCenario: simDeCenario, simAbrir: simAbrir, simCalcular: simCalcular });
  var st = document.createElement('style'); st.id = 'simCss';
  st.textContent = '.sim-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr);gap:12px;align-items:start}.sim-dir{display:flex;flex-direction:column;gap:12px}.sim-grid .an-card{margin:0}@media(max-width:999px){.sim-grid{grid-template-columns:minmax(0,1fr)}}' +
    '.sim-ev{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border)}.sim-ev:first-of-type{border-top:0}.sim-tx{flex:1;min-width:0}.sim-tx b{display:block;font-size:var(--t4)}' +
    '.sim-bt{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}' +
    '.sim-tit{margin:16px 0 8px}.sim-opcoes{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sim-opc{display:flex;align-items:center;gap:10px;text-align:left;border:1px solid var(--border);background:var(--surface);color:var(--ink);border-radius:14px;padding:10px 12px;font:inherit;cursor:pointer;min-width:0;transition:background .12s,border-color .12s}.sim-opc:hover{background:var(--surface-2);border-color:var(--accent)}.sim-opc-tx{display:flex;flex-direction:column;min-width:0}.sim-opc-tx b{font-size:var(--t3);font-weight:700;line-height:1.25}.sim-opc-tx span{font-size:var(--t1);color:var(--ink-soft);line-height:1.3}' +
    '.sim-acoes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:14px 0 4px;padding-top:12px;border-top:1px solid var(--border)}.sim-acoes .btn{width:100%;justify-content:center}' +
    '.sim-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0;padding:12px;border-radius:14px;background:var(--surface-2)}.sim-ft{grid-column:1/-1}.sim-form label{display:flex;flex-direction:column;gap:4px;font-size:var(--t2);color:var(--ink-soft);font-weight:600}.sim-form input,.sim-form select{height:40px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--ink);font:inherit;padding:0 10px}.sim-desc,.sim-bt{grid-column:1/-1}' +
    '.md-kpis.sim-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.sim-kpis .md-card{cursor:default}@media(max-width:560px){.md-kpis.sim-kpis{grid-template-columns:minmax(0,1fr)}.sim-form{grid-template-columns:1fr}}';
  document.head.appendChild(st);
})();
