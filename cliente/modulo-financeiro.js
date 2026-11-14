/* ============================================================
   FINANCEIRO E CONSTRUÇÃO (prefixo mf) — Fase 2, etapa 2.4 (só o proprietário enxerga estas telas)
   - Financeiro: sub-abas Visão geral (novo painel) | Divisão do mês | PJ | PF | Patrimônio | Análises
   - Construção: sub-abas Resumo (novo) | Etapas | Gastos | Dinheiro da obra
   - NENHUMA fórmula nova: computePatrimonio, computeDivisao (via comMes), anRecebidoMes, anDespesasMes,
     anPatrimonioEm, anProjecao, ctColetar e obraResumo. Projeção aparece tracejada e nunca é somada ao dinheiro disponível.
   ============================================================ */
var mfS = { sel: {}, obra: null };
var MF_ABAS = [['resumo', 'Visão geral'], ['geral', 'Divisão do mês'], ['pj', 'PJ'], ['pf', 'PF'], ['patrimonio', 'Patrimônio'], ['orcamento', 'Orçamento'], ['analises', 'Análises']];
/* chamada no começo de setActiveTab: na primeira vez decide em que sub-aba o Financeiro abre (lê o armazenamento direto, porque roda antes do resto carregar) */
function mfInit(){
  if (mfInit.ok) return; mfInit.ok = 1;
  try{ var o = JSON.parse(localStorage.getItem('horus.subaba.v1') || '{}'), s0 = o && o.sub && o.sub.financeiro; finTab = ['geral', 'pj', 'pf', 'patrimonio', 'orcamento'].indexOf(s0) >= 0 ? s0 : 'resumo'; }catch(e){ finTab = 'resumo'; }
}
function mfLembrar(){ try{ mdLembrar('financeiro', finTab); }catch(e){} }
function mfIr(v){
  if (v === 'analises'){ setActiveTab('analises'); return; }
  finTab = v; try{ localStorage.setItem('controlePeticoes.finTab.v1', finTab); }catch(e){} mfLembrar();
  if (activeTab !== 'financeiro') setActiveTab('financeiro'); else { renderFinanceiro(); atualizarMenuAtivo(); atualizarTituloTela(); }
}
function mfCss(){
  mdCss(); if (document.getElementById('mfCss')) return;
  var st = document.createElement('style'); st.id = 'mfCss';
  st.textContent = '#bodyFinanceiro > .alvara-view-bar{display:none!important}' +
    '.mf-topo{display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;gap:10px;margin-bottom:10px}.mf-topo .mf-hero{grid-row:span 2}@media(max-width:999px){.mf-topo{grid-template-columns:repeat(2,minmax(0,1fr))}.mf-topo .mf-hero{grid-row:auto;grid-column:1/-1}}' +
    '.mf-hero{background:linear-gradient(160deg,rgba(201,133,0,.13),rgba(201,133,0,.03) 60%),var(--surface)}.mf-hero .md-k{color:var(--accent)}.mf-big{display:block;font-size:1.8rem;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin:2px 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.mf-bar{height:8px;border-radius:99px;background:var(--surface-2);overflow:hidden;margin-top:6px}.mf-bar i{display:block;height:100%;border-radius:99px;background:#17895A}' +
    '.mf-stk{display:flex;height:14px;border-radius:99px;overflow:hidden;background:var(--surface-2);margin:2px 0 8px}.mf-stk i{display:block;height:100%}' +
    '.mf-aviso{font-size:var(--t1);color:var(--ink-soft);margin:0 2px 10px}' +
    '.mf-mini{margin-bottom:10px;padding:11px 14px}.mf-mini-t{display:flex;justify-content:space-between;align-items:center;gap:8px}.mf-mini-v{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin-top:2px}.mf-med{font-size:1.45rem;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.mf-med.neg{color:var(--urgente,#D93B3B)}' +
    '.mf-chip{display:inline-block;border-radius:99px;padding:3px 10px;font-size:var(--t1);font-weight:700;background:var(--surface-2);color:var(--ink-soft)}.mf-chip.ok{background:rgba(23,137,90,.12);color:#17895A}.mf-chip.aviso{background:rgba(217,59,59,.12);color:#D93B3B}.mf-chipl{margin:2px 0 8px}' +
    '.mf-duas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px;align-items:start}@media(max-width:999px){.mf-duas{grid-template-columns:minmax(0,1fr)}}' +
    '.mf-cal{display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:var(--t2);border-top:1px solid var(--border)}.mf-cal b{font-variant-numeric:tabular-nums;white-space:nowrap}.mf-cal.tot{border-top:2px solid var(--accent);font-weight:800;margin-top:2px}.mf-cal.tot b{font-size:var(--t4)}' +
    '.md-kpis.mf-kp6{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:700px){.md-kpis.mf-kp6{grid-template-columns:repeat(2,minmax(0,1fr))}}';
  document.head.appendChild(st);
}
function mfBarra(atual){ return mdBarraHtml(MF_ABAS, atual, function(k){ return 'data-mf-aba="' + k + '"'; }); }
/* chamada no começo de aplicarFinTab() */
function mfAplicar(){
  mfCss();
  var head = qs('headFinanceiro'), corpo = qs('bodyFinanceiro'); if (!head || !corpo) return;
  var hb = mfBarra(finTab); if (head.getAttribute('data-h') !== finTab){ head.innerHTML = hb; head.setAttribute('data-h', finTab); }
  var sec = document.getElementById('finResumo');
  if (!sec){ sec = document.createElement('div'); sec.id = 'finResumo'; sec.className = 'md-painel'; sec.setAttribute('data-mf', 'fin'); corpo.insertBefore(sec, qs('finGeral')); }
  try{ orcAplicar(); }catch(e){ console.error('orçamento', e); }
  sec.style.display = finTab === 'resumo' ? '' : 'none';
  if (finTab !== 'resumo' || activeTab !== 'financeiro'){ sec.innerHTML = ''; return; }
  try{ sec.innerHTML = mfResumo(); }catch(e){ console.error('visão geral do financeiro', e); sec.innerHTML = '<div class="empty"><strong>Não consegui montar a visão geral</strong>As outras sub-abas continuam funcionando.</div>'; }
}
/* a barra de sub-abas também aparece na tela de Análises (que é uma tela à parte), para dar para voltar */
function mfBarraAnalises(){
  mfCss(); var b = qs('bodyAnalises'); if (!b) return;
  var el = document.getElementById('mfAbasAn'); if (!el){ el = document.createElement('div'); el.id = 'mfAbasAn'; el.className = 'an-wrap'; el.style.marginBottom = '0'; b.insertBefore(el, b.firstChild); }
  if (!el.firstChild) el.innerHTML = mfBarra('analises');
}
function mfMil(v){ if (discreto) return '•••'; v = Number(v) || 0; return Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : String(Math.round(v)); }
function mfReservaEm(fim){   /* o mesmo critério de anPatrimonioEm: soma dos movimentos das metas do tipo reserva até o dia */
  var t = 0; metas.forEach(function(mt){ if (mt.tipo !== 'reserva') return; (mt.movimentos || []).forEach(function(x){ if ((x.dia || '') <= fim) t += Number(x.valor) || 0; }); }); return r2(t);
}

/* ---------------- VISÃO GERAL DO FINANCEIRO ---------------- */
function mfResumo(){
  var hoje = todayISO(), mA = hoje.slice(0, 7), ehAtual = mesSelecionado === mA, pat = computePatrimonio(), d = null, pr = null;
  try{ d = comMes(mA, computeDivisao); }catch(e){ console.error('divisão', e); }
  try{ pr = anProjecao(6); }catch(e){ console.error('projeção', e); }
  var mesesHoje = anMesesAte(6), fimDe = function(m){ return m === mA ? hoje : anUltimoDia(m); };
  /* patrimônio: evolução pelos saldos informados */
  var evo = mesesHoje.map(function(m){ var x = anPatrimonioEm(m); return x ? { m: m, v: x.total } : null; }).filter(Boolean);
  var ant = anPatrimonioEm(deslocarMes(mA, -1)), delta = ant ? r2(pat.total - ant.total) : null;
  var hero = '<div class="md-card mf-hero"><div class="md-h"><span class="md-k">' + mdIc('landmark', MD_COR.ouro) + '<span>Patrimônio líquido</span></span><button type="button" class="md-link" data-md-ir="aba:patrimonio">ver composição ›</button></div>' +
    '<b class="mf-big">' + fmtMoeda(pat.total) + '</b>' + (delta !== null ? '<span class="fv-chip ' + (delta >= 0 ? 'ok' : 'neg') + '">' + (delta >= 0 ? '▲ ' : '▼ ') + fmtMoeda(Math.abs(delta)) + ' vs. fim de ' + escapeHtml(mdMesAno(deslocarMes(mA, -1))) + '</span>' : '') +
    (evo.length >= 2 ? mdLinha(evo.map(function(x){ return x.m; }), evo.map(function(x){ return x.v; }), MD_COR.ouro, { id: 'pat', fmt: mfMil, dinheiro: true, titulo: 'Evolução do patrimônio' }) : '<div class="md-foot" style="margin:10px 0">A evolução aparece quando houver saldo informado em mais de um mês.</div>') +
    '<div class="md-foot">PJ ' + fmtMoeda(pat.saldoPj) + ' · PF ' + fmtMoeda(pat.saldoPf) + ' · Metas ' + fmtMoeda(pat.totalMetas) + (Math.abs(pat.obraSaldo) > 0.004 ? ' · Obra ' + fmtMoeda(pat.obraSaldo) : '') + (pat.repasseAPagar > 0.004 ? ' · Repasses a pagar −' + fmtMoeda(pat.repasseAPagar) : '') + '</div></div>';
  var rec = anRecebidoMes(mesSelecionado), pago = comMes(mesSelecionado, function(){ return r2(computeDespesasResumoMes('pj').pago + computeDespesasResumoMes('pf').pago); });
  var kp = [
    { ir: 'aba:pj', ic: 'briefcase-business', cor: MD_COR.azul, rot: 'Saldo da PJ', v: fmtMoeda(pat.saldoPj), foot: escapeHtml(idadeSaldo('pj')) },
    { ir: 'aba:pf', ic: 'user-round', cor: MD_COR.azul, rot: 'Saldo da PF', v: fmtMoeda(pat.saldoPf), foot: escapeHtml(idadeSaldo('pf')) }];
  if (d && d.reservaMeta){
    var pc = d.res.alvo > 0 ? Math.min(100, d.res.atual / d.res.alvo * 100) : 0;
    kp.push({ ir: 'aba:patrimonio', ic: 'piggy-bank', cor: MD_COR.verde, rot: 'Reserva de emergência', v: d.res.alvo > 0 ? fmtPerc(pc) : fmtMoeda(d.res.atual), foot: (d.res.alvo > 0 ? fmtMoeda(d.res.atual) + ' de ' + fmtMoeda(d.res.alvo) : 'sem alvo definido') + '<div class="mf-bar"><i style="width:' + pc + '%"></i></div>' });
  } else kp.push({ ir: 'aba:geral', ic: 'piggy-bank', cor: MD_COR.cinza, rot: 'Reserva de emergência', v: '—', foot: 'ainda não há meta de reserva' });
  if (d){
    kp.push({ ir: 'aba:geral', ic: 'trending-up', cor: d.folgaPJ >= 0 ? MD_COR.verde : MD_COR.verm, rot: d.folgaPJ >= 0 ? 'Folga projetada da PJ' : 'Falta projetada na PJ', v: fmtMoeda(Math.abs(d.folgaPJ)), cls: d.folgaPJ >= 0 ? 'ok' : 'neg', foot: 'depois das despesas pendentes' + (d.margem > 0 ? ' e do caixa mínimo' : '') + ' · projeção, ainda não é dinheiro' });
    kp.push({ ir: 'aba:pf', ic: 'calendar-check', cor: d.pfFecha >= -0.005 ? MD_COR.ouro : MD_COR.verm, rot: d.pfFecha >= -0.005 ? 'Fechamento projetado da PF' : 'Falta projetada na PF', v: fmtMoeda(Math.abs(d.pfFecha)), cls: d.pfFecha >= -0.005 ? '' : 'neg', foot: d.faltaPF > 0.005 ? 'contando ' + fmtMoeda(d.faltaPF) + ' que ainda vem da PJ' : 'projeção do mês' });
  }
  kp.push({ ir: 'aba:pj', ic: 'circle-dollar-sign', cor: MD_COR.verde, rot: 'Recebido em ' + escapeHtml(mdMesAno(mesSelecionado)), v: fmtMoeda(rec.total), cls: rec.total > 0.004 ? 'ok' : '', foot: 'despesas pagas no mês: ' + fmtMoeda(pago) });
  var h = (ehAtual ? '' : '<div class="mf-aviso">Saldos, folga, fechamento e reserva são os de hoje. O recebido e os gráficos seguem o mês escolhido no topo (' + escapeHtml(mesLabel(mesSelecionado)) + ').</div>') +
    '<div class="mf-topo">' + hero + kp.map(mdKpi).join('') + '</div>';
  /* receitas × despesas */
  var meses = mdMeses(mdS.per), sR = meses.map(function(m){ return anRecebidoMes(m).total; }), sD = meses.map(function(m){ return anDespesasMes(m).total; }), sel = mfS.sel.fin;
  if (sel != null && sel >= meses.length) sel = mfS.sel.fin = null;
  var g = mdCard('Receitas × despesas', mdPer() + mdBarras(meses, sR, sD, { sel: sel, ca: MD_COR.verde, cb: MD_COR.verm, ra: 'recebido', rb: 'despesas', titulo: 'Receitas e despesas por mês' }) + mdLeg([[MD_COR.verde, 'Recebido'], [MD_COR.verm, 'Despesas do mês']]) +
    '<div class="md-foot">' + (sel != null ? 'Toque de novo em <b>' + escapeHtml(mdMesAno(meses[sel])) + '</b> para abrir os lançamentos desse mês.' : 'Toque num mês para ver os valores.') + '</div>', ['aba:analises', 'ver análises']);
  /* despesas por categoria (mês do topo) */
  var por = ctColetar([mesSelecionado]), cats = Object.keys(por).map(function(k){ return [k, por[k].v]; }).filter(function(x){ return x[1] > 0.004; }).sort(function(a, b){ return b[1] - a[1]; }), totC = cats.reduce(function(t, x){ return t + x[1]; }, 0);
  var fat = cats.slice(0, 5).map(function(x){ return [x[0], x[1], ctVisual(x[0]).cor]; }), resto = cats.slice(5).reduce(function(t, x){ return t + x[1]; }, 0); if (resto > 0.004) fat.push(['Outras categorias', r2(resto), MD_COR.cinza]);
  g += mdCard('Despesas por categoria · ' + escapeHtml(mdMesAno(mesSelecionado)), !fat.length ? '<div class="md-vazio">Nenhuma despesa neste mês.</div>' : (discreto ? mdOculto() :
    '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:center">' + mdRosca(fat, mdCompacto(totC), 'no mês') + '<div style="flex:1;min-width:170px">' + fat.map(function(x){ return '<button type="button" class="md-fase" style="grid-template-columns:minmax(0,1fr) auto" data-md-ir="aba:analises"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + x[2] + ';margin-right:7px"></i>' + escapeHtml(x[0]) + '</span><b>' + fmtPerc(x[1] / totC * 100) + '</b></button>'; }).join('') + '</div></div>') +
    '<div class="md-foot">Toque numa categoria para ver os lançamentos dela em Análises.</div>', ['aba:analises', 'ver lançamentos']);
  /* fluxo de caixa projetado */
  if (pr){
    var pm = pr.linhas.map(function(l){ return l.m; }), ent = pr.linhas.map(function(l){ return r2(l.parc + l.fixas); }), sai = pr.linhas.map(function(l){ return r2(l.desp + l.dia); }), sp = mfS.sel.proj;
    if (sp != null && sp >= pm.length) sp = mfS.sel.proj = null;
    g += mdCard('Fluxo de caixa projetado', mdBarras(pm, ent, sai, { sel: sp, proj: true, ca: MD_COR.verde, cb: MD_COR.verm, ra: 'entra', rb: 'sai', titulo: 'Entradas e saídas previstas' }).replace(/data-md-mes=/g, 'data-mf-proj=') + mdLeg([[MD_COR.verde, 'Entradas previstas'], [MD_COR.verm, 'Saídas previstas']]) +
      '<div class="md-foot">' + (sp != null ? 'Caixa livre previsto no fim de <b>' + escapeHtml(mdMesAno(pm[sp])) + '</b>: <b>' + fmtMoeda(pr.linhas[sp].saldoBase) + '</b> (sem contar alvarás e atrasados).' : 'Tracejado = previsão (parcelas com data, receitas fixas e despesas pendentes). Não conta como dinheiro disponível.') + '</div>', ['aba:analises', 'ver projeção']);
  }
  /* evolução da reserva */
  if (d && d.reservaMeta){
    var sRes = mesesHoje.map(function(m){ return mfReservaEm(fimDe(m)); });
    g += mdCard('Evolução da reserva', mdLinha(mesesHoje, sRes, MD_COR.verde, { id: 'res', fmt: mfMil, dinheiro: true, alvo: d.res.alvo, titulo: 'Evolução da reserva de emergência' }) +
      '<div class="md-foot">Guardado ' + fmtMoeda(d.res.atual) + (d.res.alvo > 0 ? ' · alvo ' + fmtMoeda(d.res.alvo) + (d.res.alvo - d.res.atual > 0.004 ? ' · faltam ' + fmtMoeda(d.res.alvo - d.res.atual) : ' · alvo atingido') : '') + '</div>', ['aba:patrimonio', 'ver aportes']);
  }
  /* distribuição do mês (a mesma conta da Divisão do mês) */
  if (d){
    var partes = [['PF · pró-labore', d.proPart, d.feitoPro, MD_COR.azul], ['PF · lucros', d.lucPart, d.feitoLuc, MD_COR.roxo], ['Reserva de emergência', d.metaRes, d.aportadoRes, MD_COR.verde], ['Caixa que fica na PJ', d.metaPJ, null, MD_COR.ouro]].filter(function(x){ return x[1] > 0.005; });
    var totP = partes.reduce(function(t, x){ return t + x[1]; }, 0), falta = [];
    if (d.faltaPF > 0.005) falta.push('transferir ' + fmtMoeda(d.faltaPF) + ' para a PF'); if (d.faltaRes > 0.005) falta.push('aportar ' + fmtMoeda(d.faltaRes) + ' na reserva');
    g += mdCard('Distribuição de ' + escapeHtml(mdMesAno(mA)) + ' (plano)', (totP > 0.005 ? (discreto ? '' : '<div class="mf-stk">' + partes.map(function(x){ return '<i style="width:' + (x[1] / totP * 100) + '%;background:' + x[3] + '" title="' + escapeHtml(x[0]) + '"></i>'; }).join('') + '</div>') +
      partes.map(function(x){ return '<button type="button" class="md-fase" style="grid-template-columns:minmax(0,1fr) auto" data-md-ir="aba:geral"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + x[3] + ';margin-right:7px"></i>' + escapeHtml(x[0]) + (x[2] !== null && x[2] > 0.005 ? ' <small style="color:var(--ink-soft)">· feito ' + fmtMoeda(x[2]) + '</small>' : '') + '</span><b>' + fmtMoeda(x[1]) + '</b></button>'; }).join('') : '<div class="md-vazio">Não há folga na PJ para distribuir neste mês.</div>') +
      '<div class="md-foot">' + (falta.length ? 'Falta ' + falta.join(' e ') + '.' : 'Nada pendente de movimentar no plano do mês.') + ' É plano, não dinheiro já separado.</div>', ['aba:geral', 'abrir divisão']);
  }
  /* precisa de atenção */
  var at = [], lim = somarDias(hoje, 7);
  if (pr){
    pr.eventos.saidas.filter(function(e){ return e.data && e.data <= lim; }).sort(function(a, b){ return a.data.localeCompare(b.data); }).forEach(function(e){
      var atr = e.data < hoje; at.push({ ic: atr ? 'triangle-alert' : 'calendar-clock', cor: atr ? MD_COR.verm : MD_COR.ouro, t: e.nome, s: mdDiasTxt(e.data), v: fmtMoeda(e.valor), ir: 'aba:' + (/\(PF\)$/.test(e.nome) ? 'pf' : 'pj'), neg: atr });
    });
    if (pr.linhas[0] && pr.linhas[0].atrasados > 0.004) at.push({ ic: 'hand-coins', cor: MD_COR.verm, t: 'Recebimentos de clientes em atraso', s: 'parcelas vencidas ainda não recebidas', v: fmtMoeda(pr.linhas[0].atrasados), ir: 'clientes', neg: true });
  }
  if (d){
    if (d.faltaPro > 0.005) at.push({ ic: 'arrow-left-right', cor: MD_COR.azul, t: 'Transferência para a PF', s: 'planejada, ainda não feita', v: fmtMoeda(d.faltaPro), ir: 'aba:geral' });
    if (d.faltaRes > 0.005) at.push({ ic: 'piggy-bank', cor: MD_COR.verde, t: 'Aporte na reserva', s: 'planejado, ainda não feito', v: fmtMoeda(d.faltaRes), ir: 'aba:geral' });
    d.alertas.filter(function(a){ return a.nivel === 'aviso'; }).forEach(function(a){ at.push({ ic: 'info', cor: MD_COR.ouro, t: a.texto, s: 'aviso da divisão do mês', v: '', ir: 'aba:geral', longo: true }); });
  }
  if (ehAtual){
    try{
      var oa = orcAlertas(mA);
      oa.est.forEach(function(l){ var ex = r2(l.gasto - l.lim); at.push({ ic: 'triangle-alert', cor: MD_COR.verm, t: 'Orçamento: ' + l.k + (ex > 0.004 ? ' estourou' : ' chegou no limite'), s: fmtMoeda(l.gasto) + ' de ' + fmtMoeda(l.lim) + ' (' + Math.round(l.pct) + '%)', v: ex > 0.004 ? fmtMoeda(ex) : '', ir: 'aba:orcamento', neg: true }); });
      if (oa.aten.length) at.push({ ic: 'gauge', cor: MD_COR.ouro, t: 'Passaram de 80% do limite: ' + orcNomes(oa.aten), s: 'orçamento do mês', v: '', ir: 'aba:orcamento', longo: true });
    }catch(e){ console.error('orçamento', e); }
  }
  var hAt = at.slice(0, 6).map(function(x){ return '<button type="button" class="md-at" data-md-ir="' + x.ir + '">' + mdIc(x.ic, x.cor) + '<span class="tx"><b' + (x.longo ? ' style="white-space:normal;font-weight:600"' : '') + '>' + escapeHtml(x.t) + '</b><span>' + escapeHtml(x.s) + '</span></span>' + (x.v ? '<span class="vl' + (x.neg ? ' neg' : '') + '">' + x.v + '</span>' : '') + '</button>'; }).join('') || '<div class="md-vazio">Nada vencido, nada vencendo em 7 dias e nada pendente no plano.</div>';
  g += mdCard('Precisa de atenção' + (at.length ? ' · ' + at.length : ''), '<div class="md-ats">' + hAt + '</div>' + (at.length > 6 ? '<div class="md-foot">e mais ' + (at.length - 6) + '.</div>' : ''));
  return h + '<div class="md-grid">' + g + '</div>';
}

/* ---------------- CONSTRUÇÃO ---------------- */
var MF_OBRA_ABAS = [['resumo', 'Resumo'], ['etapas', 'Etapas'], ['gastos', 'Gastos'], ['caixa', 'Dinheiro e financiamento'], ['calc', 'Calculadora']];
var MF_OB7 = { fin: 'caixa', jur: 'caixa', cx: 'caixa', chk: 'etapas', ext: 'gastos' };
/* roda depois de renderObra() (e dos quadros extras do obra7): separa a tela em sub-abas e monta o Resumo */
function mfObra(){
  var el = qs('obraWrap'); if (!el || storageMode !== 'db') return;
  var cfg = obraCfg(); if (!cfg.criada || !el.querySelector('.ob-cards')) return;
  var r = obraResumo();
  mfCss();
  if (mfS.obra == null) mfS.obra = mdInicial('obra', ['etapas', 'gastos', 'caixa', 'calc', 'tudo']);   /* 'tudo' = a tela inteira de uma vez, como era antes das sub-abas (não aparece na barra; os testes antigos da obra usam) */
  var sub = mfS.obra, filhos = Array.prototype.slice.call(el.children);
  filhos.forEach(function(c){
    var h4 = c.querySelector(':scope > .financeiro-secao-head h4'), t = h4 ? h4.textContent : '', sec = 'etapas';
    if (c.classList.contains('ob-tiles')) sec = 'acoes'; else if (c.hasAttribute('data-ob7-sec')) sec = MF_OB7[c.getAttribute('data-ob7-sec')] || 'caixa'; else if (c.classList.contains('ob-cards')) sec = 'caixa'; else if (/^Gastos/.test(t)) sec = 'gastos'; else if (/^Dinheiro da obra/.test(t)) sec = 'caixa';
    c.style.display = sub === 'calc' ? 'none' : ((sec === 'acoes' || sec === sub || sub === 'tudo') ? '' : 'none');
  });
  var bar = document.createElement('div'); bar.id = 'obAbas'; bar.innerHTML = mdBarraHtml(MF_OBRA_ABAS, sub, function(k){ return 'data-mf-obra="' + k + '"'; });
  el.insertBefore(bar, el.firstChild);
  if (sub === 'calc'){
    var pc = document.createElement('div'); pc.className = 'md-painel'; pc.setAttribute('data-mf', 'obra-calc');
    try{ pc.innerHTML = mfCalcHtml(); }catch(e){ console.error('calculadora da obra', e); pc.innerHTML = '<div class="empty"><strong>Não consegui montar a calculadora</strong>As outras sub-abas continuam funcionando.</div>'; }
    el.appendChild(pc); return;
  }
  if (sub !== 'resumo') return;
  var p = document.createElement('div'); p.className = 'md-painel'; p.setAttribute('data-mf', 'obra');
  try{ p.innerHTML = mfObraResumo(r, cfg); }catch(e){ console.error('resumo da obra', e); p.innerHTML = '<div class="empty"><strong>Não consegui montar o resumo</strong>As outras sub-abas continuam funcionando.</div>'; }
  var tiles = el.querySelector(':scope > .ob-tiles'); if (tiles && tiles.nextSibling) el.insertBefore(p, tiles.nextSibling); else el.appendChild(p);
}
/* a calculadora tem campos de digitar: se a tela for redesenhada (outra gravação, atualização dos dados) enquanto a pessoa digita, o que ela escreveu e o cursor ficam */
var mfSalvandoAte = 0;   /* ao guardar uma escolha da calculadora a gravação avisa a tela e ela se redesenharia no meio da digitação do campo seguinte: durante isso, não redesenha */
function mfGuardaCampos(){ var o = {}, ativo = document.activeElement, n = 0; Array.prototype.slice.call(document.querySelectorAll('[data-mfc-in]')).forEach(function(i){ o[i.id] = i.value; n++; }); return n ? { v: o, ativo: ativo && ativo.id && o[ativo.id] !== undefined ? ativo.id : '', pos: ativo && ativo.selectionStart != null ? ativo.selectionStart : null } : null; }
function mfRestauraCampos(g){ if (!g) return; Object.keys(g.v).forEach(function(id){ var i = document.getElementById(id); if (i) i.value = g.v[id]; }); if (g.ativo){ var a = document.getElementById(g.ativo); if (a){ a.focus(); try{ if (g.pos != null) a.setSelectionRange(g.pos, g.pos); }catch(e){} } } try{ mfCalcAoVivo(); }catch(e){} }
(function(){ var orig = renderObra; renderObra = function(){ if (Date.now() < mfSalvandoAte && mfS.obra === 'calc' && qs('mfc_area')) return; var g = mfGuardaCampos(), x = orig.apply(this, arguments); try{ mfObra(); mfRestauraCampos(g); }catch(e){ console.error('sub-abas da obra', e); } return x; }; })();
function mfObraResumo(r, cfg){
  var fin = cfg.financiamento || {}, perc = r.orcamento > 0 ? r.pago / r.orcamento * 100 : 0;
  /* "Dinheiro na conta da obra" em duas linhas (Fase 3.8): título e atalho; valor, situação do extrato e, se houver, a sobra */
  var cx = null; try{ cx = extObraComparacao(extPendentes()); }catch(e){}
  var chip = '', notaCx = '';
  if (cx){
    if (cx.app === null) notaCx = 'Extrato da conta da obra: <b>' + extMoeda(cx.extrato) + '</b> (de ' + extFmtQuando(cx.emitido) + ').';
    else {
      var dif = Math.abs(cx.dif), bate = dif <= 0.10;   /* diferença de centavos conta como "bate" */
      chip = '<span class="mf-chip ' + (bate ? 'ok' : 'aviso') + '">' + (bate ? 'extrato bate' : 'extrato difere ' + fmtMoeda(dif)) + '</span>';
      notaCx = 'Extrato da conta da obra: <b>' + extMoeda(cx.extrato) + '</b> (de ' + extFmtQuando(cx.emitido) + ')' + (bate ? (dif >= 0.005 ? ' · diferença de centavos' : '') : ' · ' + (cx.dif > 0 ? 'o extrato tem mais' : 'o app tem mais') + ' que a aba Construção');
    }
  }
  var hero = '<div class="md-card mf-mini"><div class="mf-mini-t"><span class="md-k">' + mdIc('wallet', MD_COR.ouro) + '<span>Dinheiro na conta da obra</span></span><button type="button" class="md-link" data-md-ir="sub:caixa">entradas ›</button></div>' +
    '<div class="mf-mini-v"><b class="mf-med' + (r.saldo < -0.004 ? ' neg' : '') + '">' + fmtMoeda(r.saldo) + '</b>' + chip + (notaCx ? '<span class="md-foot">' + notaCx + '</span>' : '') + '</div>' +
    (r.sobra > 0.004 && r.etapas.length ? '<div class="md-foot">Sobra acima do que falta gastar nas etapas: ' + fmtMoeda(r.sobra) + '.</div>' : '') + '</div>';
  /* custo estimado final: o que já foi pago + o que já foi lançado a pagar + o que ainda falta gastar nas etapas + o orçamento ainda sem etapa.
     Etapa que já estourou o orçado entra pelo que foi gasto (pago + a pagar), sem contar duas vezes. */
  var faltaEtapas = r2(r.etapas.reduce(function(t, x){ return t + Math.max(0, x.orcado - x.pago - x.aPagar); }, 0));
  var custo = r2(r.pago + r.aPagar + faltaEtapas + (r.semDetalhar || 0));
  var dCusto = r.orcamento > 0 ? (custo / r.orcamento - 1) * 100 : null;
  var chipCusto = dCusto === null ? '' : (Math.abs(dCusto) < 0.05 ? '<span class="mf-chip ok">igual ao orçamento</span>' : (dCusto > 0 ? '<span class="mf-chip aviso">+ ' + fmtPerc(dCusto) + ' sobre o orçamento de ' + fmtMoeda(r.orcamento) + '</span>' : '<span class="mf-chip ok">' + fmtPerc(-dCusto) + ' abaixo do orçamento de ' + fmtMoeda(r.orcamento) + '</span>'));
  var cal = function(rot, v, tot){ return '<div class="mf-cal' + (tot ? ' tot' : '') + '"><span>' + rot + '</span><b>' + fmtMoeda(v).replace(',00', '') + '</b></div>'; };
  var cCusto = '<div class="md-card mf-hero mf-custo"><div class="md-h"><span class="md-k">' + mdIc('hammer', MD_COR.ouro) + '<span>Custo estimado final da obra</span></span></div><b class="mf-big">' + fmtMoeda(custo) + '</b>' + (chipCusto ? '<div class="mf-chipl">' + chipCusto + '</div>' : '') +
    cal('Já pago', r.pago) + cal('+ A pagar (já lançado)', r.aPagar) + cal('+ Falta gastar nas etapas (orçado − pago − a pagar)', faltaEtapas) + cal('+ Falta detalhar (orçamento sem etapa)', r.semDetalhar || 0) + cal('= Custo estimado final', custo, true) +
    '<div class="md-foot">Falta gastar ainda: ' + fmtMoeda(Math.max(0, r2(custo - r.pago))) + '. Etapa que já estourou o orçado entra pelo que foi gasto, sem ser contada duas vezes. É estimativa: não altera o orçamento.</div></div>';
  var finV = fin.valor > 0 ? fin.valor : 0, proprios = Math.max(0, r2(custo - finV));
  var aportado = r2((r.aportes.pf || 0) + (r.aportes.pj || 0) + (r.aportes.externo || 0) + (r.aportes.terceiro || 0) - (r.retirado || 0)), falta = Math.max(0, r2(proprios - aportado));
  var cProprios = '<div class="md-card mf-proprios"><div class="md-h"><span class="md-k">' + mdIc('coins', MD_COR.verde) + '<span>Recursos próprios necessários</span></span></div><b class="mf-big">' + fmtMoeda(proprios) + '</b>' +
    '<div class="md-foot">' + (finV > 0 ? 'custo estimado ' + fmtMoeda(custo) + ' − financiamento ' + fmtMoeda(finV) + ' <em style="font-style:normal">(' + (fin.status === 'aprovado' ? 'aprovado' : 'estimado') + ')</em>' : 'sem financiamento informado: o custo estimado inteiro é recurso próprio') + '</div>' +
    cal('Já aportado (PF, PJ e outras origens)', aportado) + cal(falta > 0.004 ? 'Falta colocar' : 'Já cobre o que é necessário', falta, true) +
    '<div class="md-foot">Fica junto do cartão “Caixa próprio necessário” e da tabela de juros, na sub-aba Dinheiro e financiamento. Não cria saldo nem altera o orçamento.</div></div>';
  var nAPagar = obraMov.filter(function(m){ return m.tipo === 'gasto' && m.status === 'apagar'; }).length;
  var kp = [
    { ir: 'sub:etapas', ic: 'hard-hat', cor: MD_COR.ouro, rot: 'Orçamento', v: fmtMoeda(r.orcamento), foot: r.orcamento > 0 ? fmtPerc(r.detalhado / r.orcamento * 100) + ' detalhado em etapas' : 'sem orçamento definido' },
    { ir: 'gastos:pago', ic: 'receipt', cor: MD_COR.azul, rot: 'Já pago', v: fmtMoeda(r.pago), foot: fmtPerc(perc) + ' do orçamento' },
    { ir: 'gastos:apagar', ic: 'calendar-clock', cor: r.aPagar > 0.004 ? MD_COR.verm : MD_COR.cinza, rot: 'A pagar', v: fmtMoeda(r.aPagar), cls: r.aPagar > 0.004 ? 'neg' : '', foot: nAPagar ? nAPagar + (nAPagar === 1 ? ' gasto lançado e não pago' : ' gastos lançados e não pagos') : 'nenhum gasto em aberto' },
    { ir: 'sub:etapas', ic: 'hammer', cor: MD_COR.roxo, rot: 'Ainda a gastar nas etapas', v: fmtMoeda(r.faltaGastar), foot: 'orçado das etapas menos o que já foi pago' },
    { ir: 'sub:caixa', ic: 'landmark', cor: MD_COR.verde, rot: 'Financiamento', v: fin.valor > 0 ? fmtMoeda(fin.valor) : '—', foot: (fin.valor > 0 ? (fin.status === 'aprovado' ? 'aprovado' : 'estimado') + (fin.banco ? ' · ' + escapeHtml(fin.banco) : '') + ' · ' : '') + 'liberado ' + fmtMoeda(r.liberado) },
    { ir: 'sub:etapas', ic: 'layers', cor: MD_COR.cinza, rot: 'Falta detalhar', v: fmtMoeda(r.semDetalhar || 0), foot: 'do orçamento ainda sem etapa' }];
  var h = hero + '<div class="mf-duas">' + cCusto + cProprios + '</div><div class="md-kpis mf-kp6">' + kp.map(mdKpi).join('') + '</div>';
  var ets = r.etapas.filter(function(x){ return x.orcado > 0.004 || x.pago > 0.004 || x.aPagar > 0.004; }).slice(0, 8), sel = mfS.sel.obra; if (sel != null && sel >= ets.length) sel = mfS.sel.obra = null;
  var curto = function(n){ n = String(n || ''); return n.length > (ets.length > 5 ? 5 : 8) ? n.slice(0, ets.length > 5 ? 4 : 7) + '.' : n; };
  var g = mdCard('Orçado × realizado por etapa', !ets.length ? '<div class="md-vazio">Nenhuma etapa com valor. Use “Adicionar etapa” na sub-aba Etapas.</div>' :
    mdBarras(ets.map(function(x){ return x.e.id; }), ets.map(function(x){ return x.orcado; }), ets.map(function(x){ return r2(x.pago + x.aPagar); }), { sel: sel, ca: '#B9B7AE', cb: MD_COR.ouro, ra: 'orçado', rb: 'realizado', rot: function(i){ return curto(ets[i].e.nome); }, tit: function(i){ return String(ets[i].e.nome).slice(0, 16); }, titulo: 'Orçado e realizado por etapa' }) +
    mdLeg([['#B9B7AE', 'Orçado'], [MD_COR.ouro, 'Realizado (pago + a pagar)']]) + '<div class="md-foot">' + (sel != null ? 'Toque de novo em <b>' + escapeHtml(ets[sel].e.nome) + '</b> para ver os gastos dessa etapa.' : 'Toque numa etapa para ver os valores.') + '</div>', ['sub:etapas', 'abrir as etapas']);
  var fontes = [['Aportes da PF', r.aportes.pf, MD_COR.azul], ['Aportes da PJ', r.aportes.pj, MD_COR.ouro], ['Já estava na conta da obra', r.aportes.externo, MD_COR.cinza], ['Aportes de terceiros', r.aportes.terceiro, MD_COR.roxo], ['Liberações do financiamento', r.liberado, MD_COR.verde]].filter(function(x){ return x[1] > 0.004; });
  var totF = fontes.reduce(function(t, x){ return t + x[1]; }, 0);
  g += mdCard('De onde veio o dinheiro', !fontes.length ? '<div class="md-vazio">Nenhum aporte ou liberação ainda.</div>' : (discreto ? mdOculto() :
    '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:center">' + mdRosca(fontes, mdCompacto(totF), 'entrou na obra') + '<div style="flex:1;min-width:170px">' + fontes.map(function(x){ return '<button type="button" class="md-fase" style="grid-template-columns:minmax(0,1fr) auto" data-md-ir="sub:caixa"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + x[2] + ';margin-right:7px"></i>' + escapeHtml(x[0]) + '</span><b>' + fmtMoeda(x[1]) + '</b></button>'; }).join('') + '</div></div>'), ['sub:caixa', 'ver entradas']);
  var at = '';
  r.etapas.forEach(function(x){ if (x.orcado > 0 && (x.pago + x.aPagar) > x.orcado + 0.005) at += '<button type="button" class="md-at" data-md-ir="etapa:' + escapeHtml(x.e.id) + '">' + mdIc('triangle-alert', MD_COR.verm) + '<span class="tx"><b>' + escapeHtml(x.e.nome) + '</b><span>estourou o orçado da etapa</span></span><span class="vl neg">+ ' + fmtMoeda(x.pago + x.aPagar - x.orcado) + '</span></button>'; });
  if (r.aPagar > 0.004) at += '<button type="button" class="md-at" data-md-ir="gastos:apagar">' + mdIc('calendar-clock', MD_COR.ouro) + '<span class="tx"><b>Gastos lançados e não pagos</b><span>' + nAPagar + (nAPagar === 1 ? ' gasto' : ' gastos') + ' a pagar</span></span><span class="vl">' + fmtMoeda(r.aPagar) + '</span></button>';
  if (r.saldo < -0.004) at += '<button type="button" class="md-at" data-md-ir="sub:caixa">' + mdIc('wallet', MD_COR.verm) + '<span class="tx"><b>Conta da obra no negativo</b><span>os gastos pagos passaram do que entrou</span></span><span class="vl neg">' + fmtMoeda(r.saldo) + '</span></button>';
  g += mdCard('Precisa de atenção', '<div class="md-ats">' + (at || '<div class="md-vazio">Nenhuma etapa estourada e nenhum gasto em aberto.</div>') + '</div>');
  return h + '<div class="md-grid">' + g + '</div>';
}

/* ---------------- cliques ---------------- */
function mfClique(qual, ev){
  if (qual === 'orc'){ orcClique(ev); return; }
  var t = ev.target, c = function(s){ return t.closest ? t.closest(s) : null; }, b;
  if (qual === 'fin'){
    if ((b = c('[data-md-per]'))){ mdS.per = Number(b.getAttribute('data-md-per')) === 12 ? 12 : 6; mfS.sel.fin = null; mdGravar(); renderFinanceiro(); return; }
    if ((b = c('[data-mf-proj]'))){ var j = Number(b.getAttribute('data-mf-proj')); if (mfS.sel.proj === j){ mfS.sel.proj = null; setActiveTab('analises'); } else { mfS.sel.proj = j; renderFinanceiro(); } return; }
    if ((b = c('[data-md-mes]'))){
      var i = Number(b.getAttribute('data-md-mes')), meses = mdMeses(mdS.per);
      if (mfS.sel.fin === i){ mfS.sel.fin = null; if (meses[i]) mesSelecionado = meses[i]; finTab = 'pj'; render(); renderAcordos(); renderAlvaras(); renderFinanceiro(); atualizarMenuAtivo(); atualizarTituloTela(); }
      else { mfS.sel.fin = i; renderFinanceiro(); }
      return;
    }
    if ((b = c('[data-md-ir]'))){
      var ir = b.getAttribute('data-md-ir');
      if (ir === 'clientes'){ setActiveTab('clientes'); try{ mjCliIr('atraso', false); }catch(e){} return; }
      if (ir.indexOf('aba:') === 0){ var v = ir.slice(4); if (v === 'analises') setActiveTab('analises'); else { finTab = v; renderFinanceiro(); atualizarMenuAtivo(); atualizarTituloTela(); try{ window.scrollTo(0, 0); }catch(e){} } }
    }
    return;
  }
  /* obra */
  if ((b = c('[data-md-mes]'))){
    var k = Number(b.getAttribute('data-md-mes')), ets = obraResumo().etapas.filter(function(x){ return x.orcado > 0.004 || x.pago > 0.004 || x.aPagar > 0.004; }).slice(0, 8);
    if (mfS.sel.obra === k && ets[k]){ mfS.sel.obra = null; obraFiltro.etapa = ets[k].e.id; obraFiltro.situacao = ''; mfS.obra = 'gastos'; } else mfS.sel.obra = k;
    renderObra(); return;
  }
  if ((b = c('[data-md-ir]'))){
    var p = b.getAttribute('data-md-ir').split(':');
    if (p[0] === 'sub') mfS.obra = p[1];
    else if (p[0] === 'gastos'){ mfS.obra = 'gastos'; obraFiltro.etapa = ''; obraFiltro.situacao = p[1]; }
    else if (p[0] === 'etapa'){ mfS.obra = 'gastos'; obraFiltro.etapa = p[1]; obraFiltro.situacao = ''; }
    renderObra(); try{ window.scrollTo(0, 0); }catch(e){}
  }
}
document.addEventListener('click', function(ev){
  var t = ev.target, b = t.closest ? t.closest('[data-mf-aba]') : null;
  if (b){ mfIr(b.getAttribute('data-mf-aba')); return; }
  b = t.closest ? t.closest('[data-mf-obra]') : null;
  if (b){ mfS.obra = b.getAttribute('data-mf-obra'); mdLembrar('obra', mfS.obra); renderObra(); return; }
  var p = t.closest ? t.closest('.md-painel[data-mf]') : null; if (!p) return;
  try{ mfClique(p.getAttribute('data-mf'), ev); }catch(e){ console.error('painel', e); }
});
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { mfS: mfS, mfIr: mfIr }); })();
mfInit();

/* ---------------- CALCULADORA DE CUSTOS DA OBRA (Construção › Calculadora) ----------------
   Estimativa de referência com valores OFICIAIS que o próprio app busca sozinho (Worker: src/indices.js, /api/indices):
   - SINAPI (IBGE/Caixa): custo médio do m² em Goiás, com a parte de materiais e a de mão de obra, por mês;
   - INCC (FGV, via Banco Central): variação mensal do índice nacional de custo da construção.
   O proprietário só informa o que é dele (config.obra.calc): área, fator do padrão (SINAPI = casa de padrão popular → 1,00), outros custos e margem.
   Estimativa = área × custo do m² × fator + outros custos + margem. Serve para ACOMPANHAR se materiais e mão de obra estão subindo; não altera o orçamento da obra. */
var mfIdx = null, mfIdxEstado = '';   /* dados oficiais já buscados; '' | 'carregando' | 'erro' */
function mfNum(t){ var x = String(t == null ? '' : t).trim(); if (!x) return 0; if (x.indexOf(',') >= 0) x = x.replace(/\./g, '').replace(',', '.'); var n = Number(x); return isFinite(n) ? n : 0; }
function mfMesCurto(m){ return /^\d{4}-\d{2}$/.test(m || '') ? MES_CURTO_AT[Number(m.slice(5, 7)) - 1] + '/' + m.slice(0, 4) : '—'; }
function mfSinapi(){ return ((mfIdx && mfIdx.sinapi) || []).filter(function(r){ return r && /^\d{4}-\d{2}$/.test(r.mes || '') && Number(r.total) > 0 && Number(r.mat) > 0; }); }
function mfIncc(){ return ((mfIdx && mfIdx.incc) || []).filter(function(r){ return r && /^\d{4}-\d{2}$/.test(r.mes || '') && isFinite(Number(r.pct)); }); }
/* busca (o servidor atualiza sozinho se os dados estiverem velhos); forcar = botão "Atualizar agora" */
function mfIdxCarregar(forcar){
  if (mfIdxEstado === 'carregando') return Promise.resolve();
  mfIdxEstado = 'carregando';
  return fetch('/api/indices' + (forcar ? '?atualizar=1' : ''), { credentials: 'same-origin' }).then(function(r){ if (!r.ok) throw new Error('http'); return r.json(); })
    .then(function(d){ mfIdx = d; mfIdxEstado = (d && d.sinapi && d.sinapi.length) ? '' : 'erro'; })
    .catch(function(){ mfIdxEstado = mfIdx ? '' : 'erro'; })
    .then(function(){ try{ if (typeof activeTab !== 'undefined' && activeTab === 'obra' && mfS.obra === 'calc' && !(document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-mfc-in'))) renderObra(); if (typeof renderPainelAtencao === 'function') renderPainelAtencao(); }catch(e){} });
}
/* o IBGE publica o SINAPI em torno do dia 15 do mês seguinte; mais de 2 meses sem novidade é sinal de que a busca parou */
function mfAtrasado(){ var l = mfSinapi(), u = l[l.length - 1]; if (!u) return null; var lim = deslocarMes(todayISO().slice(0, 7), -3); return u.mes < lim ? { ultimo: u.mes } : null; }
function mfCalcCfg(){
  var c = obraCfg().calc || {}, outros = Number(c.outros) >= 0 && c.outros !== '' && c.outros != null ? Number(c.outros) : (Number(c.terreno) || 0) + (Number(c.especial) || 0) + (Number(c.mobiliario) || 0);
  return { area: Number(c.area) > 0 ? Number(c.area) : 0, fator: Number(c.fator) > 0 ? Number(c.fator) : 1, outros: outros > 0 ? outros : 0, margem: Number(c.margem) >= 0 && c.margem !== '' && c.margem != null ? Number(c.margem) : 10 };
}
/* ref = um mês do SINAPI ({total, mat, mo}) */
function mfCalcTotal(cc, ref){
  var m2 = ref ? Number(ref.total) || 0 : 0, basico = r2(cc.area * m2 * cc.fator), margemV = r2((basico + cc.outros) * cc.margem / 100);
  return { m2: m2, basico: basico, outros: cc.outros, margemV: margemV, total: r2(basico + cc.outros + margemV) };
}
function mfVar(a, b){ return a > 0 && b > 0 ? (b / a - 1) * 100 : null; }
function mfVarTxt(v){ return v === null ? '—' : (v >= 0 ? '+' : '−') + fmtPerc(Math.abs(v)); }
function mfVarCls(v){ return v === null ? '' : (v > 0.05 ? ' style="color:var(--urgente)"' : (v < -0.05 ? ' style="color:var(--success)"' : '')); }
/* INCC acumulado nos últimos n meses (composto), com os meses em sequência */
function mfInccAcum(n){ var l = mfIncc().slice(-n); if (l.length < n) return null; var f = 1; l.forEach(function(x){ f *= 1 + Number(x.pct) / 100; }); return (f - 1) * 100; }
function mfCalcHtml(){
  var l = mfSinapi(), ult = l[l.length - 1];
  if (!ult){
    if (mfIdxEstado === 'erro') return '<div class="md-card"><div class="md-h"><span class="md-k">Valores oficiais</span></div><div class="saldo-data" style="margin:6px 0 10px">Não consegui buscar agora os valores do IBGE (SINAPI). Costuma ser instabilidade do site deles; o app tenta de novo sozinho. Você pode tentar agora.</div><div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-mfc="recarregar">Tentar de novo</button></div></div>';
    if (!mfIdx && mfIdxEstado !== 'carregando') mfIdxCarregar();
    return '<div class="md-card"><div class="md-h"><span class="md-k">Valores oficiais</span></div><div class="saldo-data" style="margin:6px 0">Buscando os valores oficiais do IBGE (SINAPI)…</div></div>';
  }
  var cc = mfCalcCfg(), atr = mfAtrasado(), h = '';
  if (atr) h += '<div class="aviso-sis"><span class="as-txt"><b>A atualização automática parece parada.</b> O último valor do IBGE é de ' + mfMesCurto(atr.ultimo) + '.</span><span class="as-acoes"><button type="button" data-mfc="recarregar">Atualizar agora</button></span></div>';
  else h += '<div class="aviso-sis" style="background:var(--surface-2,#f3f1ea)"><span class="as-txt"><b>Valores oficiais já carregados</b> (SINAPI/IBGE, Goiás). Último mês: <b>' + mfMesCurto(ult.mes) + '</b>. O app se atualiza sozinho: você não digita nada deles.</span></div>';
  var f2 = function(v){ return v ? String(v).replace('.', ',') : ''; };
  var campo = function(rot, id, valor, un, dica){ return '<div class="field"><label class="field-label" for="' + id + '">' + rot + '</label><div style="display:flex;gap:8px;align-items:center"><input type="text" inputmode="decimal" id="' + id + '" data-mfc-in="1" value="' + escapeHtml(valor) + '" style="flex:1"><span class="saldo-data" style="margin:0;white-space:nowrap">' + un + '</span></div>' + (dica ? '<div class="saldo-data" style="margin:2px 2px 0">' + dica + '</div>' : '') + '</div>'; };
  h += '<div class="md-card"><div class="md-h"><span class="md-k">Seus dados</span></div>' +
    campo('Área construída', 'mfc_area', f2(cc.area), 'm²') +
    campo('Padrão do acabamento (fator)', 'mfc_fator', f2(cc.fator), '× o valor oficial', 'O SINAPI representa uma casa de padrão popular = 1,00. Para acabamento melhor, aumente (ex.: 1,15).') +
    campo('Terreno, fundação especial, muro, piscina…', 'mfc_outros', f2(cc.outros), 'R$', 'o custo do m² não inclui') +
    campo('Margem de segurança', 'mfc_margem', f2(cc.margem), '% sobre a obra', 'imprevistos de obra; você escolhe') + '</div>';
  var t = mfCalcTotal(cc, ult), mat = Number(ult.mat) / Number(ult.total);
  h += '<div class="md-card" id="mfcEst"><div class="md-h"><span class="md-k">Estimativa de hoje · ' + mfMesCurto(ult.mes) + '</span></div>' + mfEstHtml(cc, t, ult, mat) + '</div>';
  h += mdCard('Os preços estão subindo?', mfEvolucao(l, cc));
  h += '<div class="saldo-data" style="margin:6px 4px">É uma <b>referência</b> para acompanhar a alta dos preços, não um orçamento de engenharia. Fontes: IBGE/Caixa (SINAPI, custo médio do m² em Goiás) e FGV (INCC, via Banco Central). <a href="https://sidra.ibge.gov.br/home/sinapi/brasil" target="_blank" rel="noopener">Ver no IBGE</a></div>';
  return h;
}
/* "sua estimativa um ano atrás × hoje" (atualiza ao digitar) */
function mfCmpHtml(l, cc){
  var n = l.length; if (n < 2 || !(cc.area > 0)) return '';
  var base = n >= 13 ? l[n - 13] : l[0], tb = mfCalcTotal(cc, base), tu = mfCalcTotal(cc, l[n - 1]);
  return '<div class="saldo-data" style="margin-top:8px">Sua estimativa ' + (n >= 13 ? 'um ano atrás' : 'em ' + mfMesCurto(base.mes)) + ': <b>' + fmtMoeda(tb.total) + '</b> · hoje <b>' + fmtMoeda(tu.total) + '</b> (' + mfVarTxt(mfVar(tb.total, tu.total)) + ')</div>';
}
function mfEvolucao(l, cc){
  var n = l.length, u = l[n - 1], ult12 = l.slice(-12);
  if (n < 2) return '<div class="md-vazio">Ainda há um único mês de dados. A evolução aparece quando o IBGE publicar o próximo.</div>';
  var cal = function(rot, v){ return '<div class="mf-cal"><span>' + rot + '</span><b' + mfVarCls(v) + '>' + mfVarTxt(v) + '</b></div>'; };
  var base = n >= 13 ? l[n - 13] : l[0], rotBase = n >= 13 ? 'Em 12 meses' : 'Desde ' + mfMesCurto(l[0].mes), ant = l[n - 2];
  var mo = function(r){ return Number(r.total) - Number(r.mat); };
  var h = mdLinha(ult12.map(function(r){ return r.mes; }), ult12.map(function(r){ return Number(r.total); }), MD_COR.ouro, { id: 'calc', titulo: 'Custo do m² em Goiás (SINAPI)', fmt: function(v){ return Math.round(v).toLocaleString('pt-BR'); } }) +
    cal('No último mês', mfVar(Number(ant.total), Number(u.total))) + cal(rotBase, mfVar(Number(base.total), Number(u.total))) +
    cal('Materiais · ' + rotBase.toLowerCase(), mfVar(Number(base.mat), Number(u.mat))) + cal('Mão de obra · ' + rotBase.toLowerCase(), mfVar(mo(base), mo(u)));
  h += '<div id="mfcCmp">' + mfCmpHtml(l, cc) + '</div>';
  var i1 = mfIncc(), ac12 = mfInccAcum(12);
  if (i1.length){ var ui = i1[i1.length - 1]; h += '<div class="pb-sec-t" style="margin:10px 4px 2px">INCC (FGV, via Banco Central)</div><div class="mf-cal"><span>No último mês (' + mfMesCurto(ui.mes) + ')</span><b' + mfVarCls(Number(ui.pct)) + '>' + mfVarTxt(Number(ui.pct)) + '</b></div>' + (ac12 !== null ? '<div class="mf-cal"><span>Acumulado em 12 meses</span><b' + mfVarCls(ac12) + '>' + mfVarTxt(ac12) + '</b></div>' : ''); }
  return h;
}
function mfEstHtml(cc, t, ult, mat){
  var cal = function(rot, v, tot){ return '<div class="mf-cal' + (tot ? ' tot' : '') + '"><span>' + rot + '</span><b>' + fmtMoeda(v) + '</b></div>'; };
  if (!(cc.area > 0)) return '<div class="md-vazio">Informe a área construída para ver a estimativa.</div>';
  return cal('Custo básico · ' + String(cc.area).replace('.', ',') + ' m² × ' + fmtMoeda(t.m2) + '/m²' + (cc.fator !== 1 ? ' × ' + String(cc.fator).replace('.', ',') : ''), t.basico) + cal('Outros custos informados', t.outros) + cal('Margem de segurança (' + String(cc.margem).replace('.', ',') + '%)', t.margemV) + cal('Total estimado', t.total, true) +
    '<div class="div-barra" style="height:10px;margin:8px 0 2px"><i style="width:' + (mat * 100).toFixed(1) + '%;background:#C98500"></i><i style="width:' + ((1 - mat) * 100).toFixed(1) + '%;background:#2A78D6"></i></div><div class="saldo-data">Materiais ' + fmtPerc(mat * 100) + ' · mão de obra ' + fmtPerc((1 - mat) * 100) + ' (proporção do SINAPI/IBGE em Goiás, ' + mfMesCurto(ult.mes) + ')</div>';
}
function mfLeCampos(){
  var g = function(id){ return (qs(id) || {}).value; }, fator = mfNum(g('mfc_fator'));
  return { area: mfNum(g('mfc_area')) || 0, fator: fator > 0 ? fator : 1, outros: mfNum(g('mfc_outros')), margem: g('mfc_margem') === '' ? 0 : mfNum(g('mfc_margem')) };
}
/* atualiza só a estimativa enquanto digita (sem redesenhar a tela) */
function mfCalcAoVivo(){
  var l = mfSinapi(), ult = l[l.length - 1], el = qs('mfcEst'); if (!ult || !el) return;
  var cc = mfLeCampos();
  el.innerHTML = '<div class="md-h"><span class="md-k">Estimativa de hoje · ' + mfMesCurto(ult.mes) + '</span></div>' + mfEstHtml(cc, mfCalcTotal(cc, ult), ult, Number(ult.mat) / Number(ult.total));
  var cmp = qs('mfcCmp'); if (cmp) cmp.innerHTML = mfCmpHtml(l, cc);
}
function mfCalcSalvar(){ mfSalvandoAte = Date.now() + 1500; return Promise.resolve(persistObraCfg({ calc: mfLeCampos() })); }
document.addEventListener('click', function(ev){
  var b = ev.target.closest ? ev.target.closest('[data-mfc]') : null;
  if (b && b.getAttribute('data-mfc') === 'recarregar'){ mfIdxEstado = ''; mfIdxCarregar(true); }
});
document.addEventListener('input', function(ev){ if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-mfc-in')) mfCalcAoVivo(); });
document.addEventListener('change', function(ev){ if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-mfc-in')) mfCalcSalvar(); });   /* sem redesenhar: a estimativa já foi atualizada ao digitar e redesenhar tiraria o cursor do campo seguinte */
/* só o proprietário usa a calculadora: busca os valores oficiais ao abrir o app (o servidor atualiza se estiverem velhos) */
(function(){ ppDonoP().then(function(d){ if (d) mfIdxCarregar(); }); })();
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { mfCalcTotal: mfCalcTotal, mfAtrasado: mfAtrasado, mfIdxCarregar: mfIdxCarregar, mfDefinir: function(d){ mfIdx = d; mfIdxEstado = ''; try{ renderPainelAtencao(); }catch(e){} } }); })();
