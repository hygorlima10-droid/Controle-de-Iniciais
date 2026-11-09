/* ============================================================
   FINANCEIRO E CONSTRUÇÃO (prefixo mf) — Fase 2, etapa 2.4 (só o proprietário enxerga estas telas)
   - Financeiro: sub-abas Visão geral (novo painel) | Divisão do mês | PJ | PF | Patrimônio | Análises
   - Construção: sub-abas Resumo (novo) | Etapas | Gastos | Dinheiro da obra
   - NENHUMA fórmula nova: computePatrimonio, computeDivisao (via comMes), anRecebidoMes, anDespesasMes,
     anPatrimonioEm, anProjecao, ctColetar e obraResumo. Projeção aparece tracejada e nunca é somada ao dinheiro disponível.
   ============================================================ */
var mfS = { sel: {}, obra: null };
var MF_ABAS = [['resumo', 'Visão geral'], ['geral', 'Divisão do mês'], ['pj', 'PJ'], ['pf', 'PF'], ['patrimonio', 'Patrimônio'], ['analises', 'Análises']];
/* chamada no começo de setActiveTab: na primeira vez decide em que sub-aba o Financeiro abre (lê o armazenamento direto, porque roda antes do resto carregar) */
function mfInit(){
  if (mfInit.ok) return; mfInit.ok = 1;
  try{ var o = JSON.parse(localStorage.getItem('horus.subaba.v1') || '{}'), s0 = o && o.sub && o.sub.financeiro; finTab = ['geral', 'pj', 'pf', 'patrimonio'].indexOf(s0) >= 0 ? s0 : 'resumo'; }catch(e){ finTab = 'resumo'; }
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
    '.mf-aviso{font-size:var(--t1);color:var(--ink-soft);margin:0 2px 10px}';
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
  var hAt = at.slice(0, 6).map(function(x){ return '<button type="button" class="md-at" data-md-ir="' + x.ir + '">' + mdIc(x.ic, x.cor) + '<span class="tx"><b' + (x.longo ? ' style="white-space:normal;font-weight:600"' : '') + '>' + escapeHtml(x.t) + '</b><span>' + escapeHtml(x.s) + '</span></span>' + (x.v ? '<span class="vl' + (x.neg ? ' neg' : '') + '">' + x.v + '</span>' : '') + '</button>'; }).join('') || '<div class="md-vazio">Nada vencido, nada vencendo em 7 dias e nada pendente no plano.</div>';
  g += mdCard('Precisa de atenção' + (at.length ? ' · ' + at.length : ''), '<div class="md-ats">' + hAt + '</div>' + (at.length > 6 ? '<div class="md-foot">e mais ' + (at.length - 6) + '.</div>' : ''));
  return h + '<div class="md-grid">' + g + '</div>';
}

/* ---------------- CONSTRUÇÃO ---------------- */
var MF_OBRA_ABAS = [['resumo', 'Resumo'], ['etapas', 'Etapas'], ['gastos', 'Gastos'], ['caixa', 'Dinheiro e financiamento']];
var MF_OB7 = { fin: 'caixa', jur: 'caixa', cx: 'caixa', chk: 'etapas', ext: 'gastos' };
/* roda depois de renderObra() (e dos quadros extras do obra7): separa a tela em sub-abas e monta o Resumo */
function mfObra(){
  var el = qs('obraWrap'); if (!el || storageMode !== 'db') return;
  var cfg = obraCfg(); if (!cfg.criada || !el.querySelector('.ob-cards')) return;
  var r = obraResumo();
  mfCss();
  if (mfS.obra == null) mfS.obra = mdInicial('obra', ['etapas', 'gastos', 'caixa', 'tudo']);   /* 'tudo' = a tela inteira de uma vez, como era antes das sub-abas (não aparece na barra; os testes antigos da obra usam) */
  var sub = mfS.obra, filhos = Array.prototype.slice.call(el.children);
  filhos.forEach(function(c){
    var h4 = c.querySelector(':scope > .financeiro-secao-head h4'), t = h4 ? h4.textContent : '', sec = 'etapas';
    if (c.classList.contains('ob-tiles')) sec = 'acoes'; else if (c.hasAttribute('data-ob7-sec')) sec = MF_OB7[c.getAttribute('data-ob7-sec')] || 'caixa'; else if (c.classList.contains('ob-cards')) sec = 'caixa'; else if (/^Gastos/.test(t)) sec = 'gastos'; else if (/^Dinheiro da obra/.test(t)) sec = 'caixa';
    c.style.display = (sec === 'acoes' || sec === sub || sub === 'tudo') ? '' : 'none';
  });
  var bar = document.createElement('div'); bar.id = 'obAbas'; bar.innerHTML = mdBarraHtml(MF_OBRA_ABAS, sub, function(k){ return 'data-mf-obra="' + k + '"'; });
  el.insertBefore(bar, el.firstChild);
  if (sub !== 'resumo') return;
  var p = document.createElement('div'); p.className = 'md-painel'; p.setAttribute('data-mf', 'obra');
  try{ p.innerHTML = mfObraResumo(r, cfg); }catch(e){ console.error('resumo da obra', e); p.innerHTML = '<div class="empty"><strong>Não consegui montar o resumo</strong>As outras sub-abas continuam funcionando.</div>'; }
  var tiles = el.querySelector(':scope > .ob-tiles'); if (tiles && tiles.nextSibling) el.insertBefore(p, tiles.nextSibling); else el.appendChild(p);
}
(function(){ var orig = renderObra; renderObra = function(){ var x = orig.apply(this, arguments); try{ mfObra(); }catch(e){ console.error('sub-abas da obra', e); } return x; }; })();
function mfObraResumo(r, cfg){
  var fin = cfg.financiamento || {}, perc = r.orcamento > 0 ? r.pago / r.orcamento * 100 : 0;
  var hero = '<div class="md-card mf-hero"><div class="md-h"><span class="md-k">' + mdIc('wallet', MD_COR.ouro) + '<span>Dinheiro na conta da obra</span></span><button type="button" class="md-link" data-md-ir="sub:caixa">ver entradas ›</button></div>' +
    '<b class="mf-big' + (r.saldo < -0.004 ? ' neg' : '') + '"' + (r.saldo < -0.004 ? ' style="color:var(--urgente,#D93B3B)"' : '') + '>' + fmtMoeda(r.saldo) + '</b>' + obBarra(r.pago, r.aPagar, r.orcamento) +
    '<div class="md-foot">Gasto ' + fmtMoeda(r.pago) + ' · ' + fmtPerc(perc) + ' do orçamento' + (r.aPagar > 0.004 ? ' · a pagar ' + fmtMoeda(r.aPagar) : '') + '</div>' +
    '<div class="md-foot">Aportes ' + fmtMoeda(r.aportado) + (r.liberado > 0.004 ? ' + liberações ' + fmtMoeda(r.liberado) : '') + (r.retirado > 0.004 ? ' − devolvido ' + fmtMoeda(r.retirado) : '') + ' − gastos pagos.' + (r.sobra > 0.004 && r.etapas.length ? ' Sobra acima do que falta gastar nas etapas: ' + fmtMoeda(r.sobra) + '.' : '') + '</div></div>';
  var nAPagar = obraMov.filter(function(m){ return m.tipo === 'gasto' && m.status === 'apagar'; }).length;
  var kp = [
    { ir: 'sub:etapas', ic: 'hard-hat', cor: MD_COR.ouro, rot: 'Orçamento', v: fmtMoeda(r.orcamento), foot: r.orcamento > 0 ? fmtPerc(r.detalhado / r.orcamento * 100) + ' detalhado em etapas' : 'sem orçamento definido' },
    { ir: 'gastos:pago', ic: 'receipt', cor: MD_COR.azul, rot: 'Já pago', v: fmtMoeda(r.pago), foot: fmtPerc(perc) + ' do orçamento' },
    { ir: 'gastos:apagar', ic: 'calendar-clock', cor: r.aPagar > 0.004 ? MD_COR.verm : MD_COR.cinza, rot: 'A pagar', v: fmtMoeda(r.aPagar), cls: r.aPagar > 0.004 ? 'neg' : '', foot: nAPagar ? nAPagar + (nAPagar === 1 ? ' gasto lançado e não pago' : ' gastos lançados e não pagos') : 'nenhum gasto em aberto' },
    { ir: 'sub:etapas', ic: 'hammer', cor: MD_COR.roxo, rot: 'Ainda a gastar nas etapas', v: fmtMoeda(r.faltaGastar), foot: 'orçado das etapas menos o que já foi pago' },
    { ir: 'sub:caixa', ic: 'landmark', cor: MD_COR.verde, rot: 'Financiamento', v: fin.valor > 0 ? fmtMoeda(fin.valor) : '—', foot: (fin.valor > 0 ? (fin.status === 'aprovado' ? 'aprovado' : 'estimado') + (fin.banco ? ' · ' + escapeHtml(fin.banco) : '') + ' · ' : '') + 'liberado ' + fmtMoeda(r.liberado) },
    { ir: 'sub:etapas', ic: 'layers', cor: MD_COR.cinza, rot: 'Falta detalhar', v: fmtMoeda(r.semDetalhar || 0), foot: 'do orçamento ainda sem etapa' }];
  var h = '<div class="mf-topo">' + hero + kp.map(mdKpi).join('') + '</div>';
  var ets = r.etapas.filter(function(x){ return x.orcado > 0.004 || x.pago > 0.004 || x.aPagar > 0.004; }).slice(0, 8), sel = mfS.sel.obra; if (sel != null && sel >= ets.length) sel = mfS.sel.obra = null;
  var curto = function(n){ n = String(n || ''); return n.length > (ets.length > 5 ? 5 : 8) ? n.slice(0, ets.length > 5 ? 4 : 7) + '.' : n; };
  var g = mdCard('Orçado × realizado por etapa', !ets.length ? '<div class="md-vazio">Nenhuma etapa com valor. Use “+ Etapa” na sub-aba Etapas.</div>' :
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
