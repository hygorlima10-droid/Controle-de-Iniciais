/* ============================================================
   CONSTRUÇÃO 7B e 7C: financiamento, medições, juros de obra, caixa próprio, checklist,
   comprovantes (anexos), avisos de pagamento na Central e conferência do extrato
   ============================================================ */
var ob7Abertos = {};
function ob7Cfg(){ return obraCfg(); }
function ob7Mes(iso){ return String(iso || '').slice(0, 7); }
function ob7UltimoDia(m){ var p = m.split('-'), d = new Date(Date.UTC(+p[0], +p[1], 0)); return d.toISOString().slice(0, 10); }
function ob7Meses(de, ate, max){ var out = [], m = de; while (m <= ate && out.length < (max || 48)){ out.push(m); m = deslocarMes(m, 1); } return out; }
function ob7Medicoes(){
  var l = (ob7Cfg().medicoes || []).slice().sort(function(a, b){ return String(a.data || '').localeCompare(String(b.data || '')); });
  l.forEach(function(m, i){ m.numero = i + 1; });
  return l;
}

/* ---------- juros de obra ---------- */
function ob7SaldoLiberadoAte(fimISO){
  var t = 0;
  obraMov.forEach(function(m){ if (m.tipo === 'liberacao' && String(m.data || '') <= fimISO) t += Number(m.valor) || 0; });
  ob7Medicoes().forEach(function(m){ if (m.status !== 'liberada' && m.data && m.data <= fimISO && !m.liberacaoId) t += Number(m.valor) || 0; });
  return r2(t);
}
function ob7Juros(){
  var cfg = ob7Cfg(), fin = cfg.financiamento, i = (Number(fin.taxaAnual) || 0) / 100 / 12, m0 = todayISO().slice(0, 7);
  if (!(i > 0) || !(fin.valor > 0)) return null;
  var datas = obraMov.filter(function(m){ return m.tipo === 'liberacao'; }).map(function(m){ return m.data; }).concat(ob7Medicoes().map(function(m){ return m.data; })).filter(Boolean).sort();
  if (!datas.length) return { rows: [], total: 0, mensal: i };
  var ini = ob7Mes(datas[0]), fimObra = fin.inicioObra ? deslocarMes(ob7Mes(fin.inicioObra), Math.max(1, fin.prazoObraMeses) - 1) : ob7Mes(datas[datas.length - 1]);
  var fim = fimObra > ob7Mes(datas[datas.length - 1]) ? fimObra : ob7Mes(datas[datas.length - 1]);
  var rows = ob7Meses(ini, fim, 48).map(function(m){
    var base = ob7SaldoLiberadoAte(ob7UltimoDia(deslocarMes(m, -1)));
    return { mes: m, base: base, juros: r2(base * i), situacao: m < m0 ? 'passado' : (m === m0 ? 'atual' : 'previsto'), lancado: !!(cfg.jurosLancados && cfg.jurosLancados[m]) };
  });
  return { rows: rows, total: r2(rows.reduce(function(t, x){ return t + x.juros; }, 0)), mensal: i };
}

/* ---------- caixa próprio necessário ---------- */
function ob7Caixa(){
  var cfg = ob7Cfg(), fin = cfg.financiamento, r = obraResumo(), m0 = todayISO().slice(0, 7);
  var meds = ob7Medicoes().filter(function(m){ return m.status !== 'liberada' && !m.liberacaoId && m.data; });
  var ultMed = meds.length ? ob7Mes(meds[meds.length - 1].data) : m0;
  var temCronograma = !!fin.inicioObra;
  var fimObra = temCronograma ? deslocarMes(ob7Mes(fin.inicioObra), Math.max(1, fin.prazoObraMeses) - 1) : m0;
  var ultPagar = obraMov.filter(function(m){ return m.tipo === 'gasto' && m.status === 'apagar'; }).map(function(m){ return ob7Mes(m.vencimento || m.data); }).sort().pop() || m0;
  var fim = [fimObra, ultMed, ultPagar, m0].sort().pop();
  var meses = ob7Meses(m0, fim, 36);
  var aPagar = {}, aPagarTotal = 0;
  obraMov.forEach(function(m){
    if (m.tipo !== 'gasto' || m.status !== 'apagar') return;
    var mm = ob7Mes(m.vencimento || m.data); if (mm < m0) mm = m0;
    aPagar[mm] = r2((aPagar[mm] || 0) + (Number(m.valor) || 0)); aPagarTotal += Number(m.valor) || 0;
  });
  var resto = Math.max(0, r2(r.faltaGastar - aPagarTotal)), mesesResto = temCronograma ? ob7Meses(m0, fimObra, 36).length : 0, porMes = mesesResto ? resto / mesesResto : 0;
  var jur = ob7Juros(), jurPorMes = {}; if (jur) jur.rows.forEach(function(x){ if (x.mes >= m0 && !x.lancado) jurPorMes[x.mes] = x.juros; });
  var lib = {}; meds.forEach(function(m){ var mm = ob7Mes(m.data); if (mm < m0) mm = m0; lib[mm] = r2((lib[mm] || 0) + (Number(m.valor) || 0)); });
  var saldo = r.saldo, rows = [], total = 0, pior = null;
  meses.forEach(function(m){
    var entra = lib[m] || 0, sai = r2((aPagar[m] || 0) + (m <= fimObra ? porMes : 0) + (jurPorMes[m] || 0));
    saldo = r2(saldo + entra - sai);
    var aportar = 0; if (saldo < 0){ aportar = r2(-saldo); saldo = 0; }
    total += aportar;
    var x = { mes: m, gastos: sai, liberacoes: entra, aportar: aportar };
    rows.push(x); if (aportar > 0 && (!pior || aportar > pior.aportar)) pior = x;
  });
  var sobra = 0; try{ var pj = anProjecao(6); sobra = pj.linhas.length ? r2((pj.linhas[pj.linhas.length - 1].saldoBase - pj.ini) / pj.linhas.length) : 0; }catch(e){}
  return { rows: rows, total: r2(total), pior: pior, sobra: sobra, saldoInicial: r.saldo, resto: resto, meses: meses.length, temCronograma: temCronograma, semDistribuir: temCronograma ? 0 : resto, aPagarTotal: r2(aPagarTotal) };
}

/* ---------- desenho das seções ---------- */
var OB7_ICONES = { fin: ['bank', '#2A78D6'], jur: ['pct', '#C2410C'], cx: ['coin', '#17895A'], chk: ['clip', '#0D9488'], ext: ['list', '#8A93AD'] };
function ob7Sec(chave, titulo, resumo, corpo){
  var i = OB7_ICONES[chave] || ['list', '#8A93AD'];
  return '<details class="ini-card ob7-sec" data-ob7-sec="' + chave + '"' + (ob7Abertos[chave] ? ' open' : '') + '><summary>' + fvIc(i[0], i[1]) + '<span class="ob7-tx"><b>' + titulo + '</b><span class="fp-nota">' + resumo + '</span></span></summary><div class="ob7-corpo">' + corpo + '</div></details>';
}
function ob7HtmlFin(cfg, r){
  var fin = cfg.financiamento, liberado = r.liberado || 0, meds = ob7Medicoes(), prox = meds.filter(function(m){ return m.status !== 'liberada'; })[0];
  var pct = fin.valor > 0 ? Math.min(100, liberado / fin.valor * 100) : 0;
  var corpo = '';
  if (!(fin.valor > 0)) corpo += '<div class="financeiro-vazio">Informe o valor do financiamento em <b>Editar a obra</b> para acompanhar as liberações.</div>';
  else {
    corpo += '<div class="plan-linha"><span>Financiamento (' + (fin.status === 'aprovado' ? 'aprovado' : 'estimado') + (fin.banco ? ' · ' + escapeHtml(fin.banco) : '') + ')</span><strong>' + fmtMoeda(fin.valor) + '</strong></div>' +
      obBarra(liberado, 0, fin.valor) + '<div class="saldo-data">Liberado: <b>' + fmtMoeda(liberado) + '</b> (' + fmtPerc(pct) + ') · falta liberar ' + fmtMoeda(Math.max(0, r2(fin.valor - liberado))) + '</div>' +
      (fin.taxaAnual > 0 ? '<div class="plan-linha"><span>Taxa de juros</span><strong>' + String(fin.taxaAnual).replace('.', ',') + '% ao ano</strong></div>' : '<div class="saldo-data">Informe a taxa em Editar a obra para calcular os juros de obra.</div>') +
      '<div class="plan-linha"><span>Sistema · prazo</span><strong>' + (fin.sistema === 'price' ? 'Price' : 'SAC') + ' · ' + fin.prazoMeses + ' meses</strong></div>' +
      (fin.inicioObra ? '<div class="plan-linha"><span>Prazo da obra</span><strong>' + fin.prazoObraMeses + ' meses (até ' + escapeHtml(mesLabel(deslocarMes(ob7Mes(fin.inicioObra), Math.max(1, fin.prazoObraMeses) - 1))) + ')</strong></div>' : '') +
      (fin.contrapartida > 0 ? '<div class="plan-linha"><span>Recursos próprios exigidos</span><strong>' + fmtMoeda(fin.contrapartida) + '</strong></div><div class="plan-linha"><span>Já aportado por você</span><strong style="color:var(--success)">' + fmtMoeda(r2((r.aportes.pf || 0) + (r.aportes.pj || 0) + (r.aportes.externo || 0))) + '</strong></div>' : '');
  }
  corpo += '<div class="financeiro-secao-head" style="margin-top:12px;"><h4>Medições</h4><button type="button" class="btn-text" data-ob7="med-nova">Adicionar medição</button></div>';
  if (!meds.length) corpo += '<div class="financeiro-vazio">Nenhuma medição cadastrada. Cadastre o cronograma de liberações que o banco combinou.</div>';
  var hoje = todayISO();
  meds.forEach(function(m){
    var lib = m.status === 'liberada' || !!m.liberacaoId, etapas = (m.etapaIds || []).map(function(id){ return cfg.etapas.filter(function(e){ return e.id === id; })[0]; }).filter(Boolean);
    var faltam = etapas.filter(function(e){ return e.status !== 'concluida'; });
    corpo += '<div class="ob-gasto"><div class="ob-gasto-info"><b>' + m.numero + 'ª medição · ' + fmtData(m.data) + '</b><span class="saldo-data">' + escapeHtml(m.desc || '') + (etapas.length ? (m.desc ? ' · ' : '') + 'etapas: ' + etapas.map(function(e){ return escapeHtml(e.nome); }).join(', ') : '') + '</span>' +
      '<span class="est ' + (lib ? 'est-ok' : (m.data < hoje ? 'est-atraso' : 'est-breve')) + '">' + (lib ? 'Liberada' : (m.status === 'solicitada' ? 'Solicitada ao banco' : (m.data < hoje ? 'Prevista (atrasada)' : 'Prevista'))) + '</span>' +
      (!lib && faltam.length ? '<span class="saldo-data" style="color:var(--tutela)">Faltam concluir: ' + faltam.map(function(e){ return escapeHtml(e.nome); }).join(', ') + '</span>' : '') + '</div>' +
      '<div class="ob-gasto-val"><strong>' + fmtMoeda(m.valor) + '</strong><span>' + (lib ? '' : '<button type="button" class="btn-text acao-pagar" data-ob7="med-lib" data-id="' + escapeHtml(m.id) + '">Registrar liberação</button>') + '<button type="button" class="btn-text" data-ob7="med-edit" data-id="' + escapeHtml(m.id) + '">Editar</button><button type="button" class="btn-text acao-excluir" data-ob7="med-del" data-id="' + escapeHtml(m.id) + '">Excluir</button></span></div></div>';
  });
  var resumo = (fin.valor > 0 ? fmtPerc(pct) + ' liberado' : 'sem financiamento') + (prox ? ' · próxima: ' + fmtData(prox.data) : '');
  return ob7Sec('fin', 'Financiamento e medições', resumo, corpo);
}
function ob7HtmlJuros(cfg){
  var j = ob7Juros();
  if (!j) return ob7Sec('jur', 'Juros de obra', 'informe a taxa do financiamento', '<div class="financeiro-vazio">Para estimar os juros de obra, informe o <b>valor</b> e a <b>taxa de juros ao ano</b> do financiamento em <b>Editar a obra</b>.</div>');
  if (!j.rows.length) return ob7Sec('jur', 'Juros de obra', 'sem liberações ainda', '<div class="financeiro-vazio">Os juros de obra começam a contar depois da primeira liberação ou medição cadastrada.</div>');
  var atual = j.rows.filter(function(x){ return x.situacao === 'atual'; })[0];
  var corpo = '<div class="saldo-data">Estimativa: saldo liberado no mês anterior × ' + (j.mensal * 100).toFixed(3).replace('.', ',') + '% ao mês. Confira com o boleto do banco.</div>' +
    j.rows.map(function(x){
      return '<div class="plan-linha"><span>' + escapeHtml(mesLabel(x.mes)) + (x.situacao === 'previsto' ? ' <em>(previsto)</em>' : '') + (x.lancado ? ' <em>(lançado)</em>' : '') + '</span><strong>' + fmtMoeda(x.juros) + '</strong>' +
        (!x.lancado && x.juros > 0.004 && x.situacao !== 'previsto' ? '<button type="button" class="btn-text" data-ob7="jur-lancar" data-mes="' + x.mes + '">Lançar</button>' : '') + '</div>';
    }).join('') + '<div class="plan-linha"><span><b>Total estimado até o fim da obra</b></span><strong>' + fmtMoeda(j.total) + '</strong></div>';
  return ob7Sec('jur', 'Juros de obra', atual ? 'este mês: ' + fmtMoeda(atual.juros) : 'total ' + fmtMoeda(j.total), corpo);
}
function ob7HtmlCaixa(cfg){
  var c = ob7Caixa(), maxA = c.rows.reduce(function(t, x){ return Math.max(t, x.aportar); }, 0);
  var corpo = '<div class="saldo-data">Cruza o dinheiro da conta da obra com o que já está combinado: gastos “a pagar” (no mês do vencimento), juros e liberações previstas do banco.' + (c.temCronograma ? ' O que falta do orçamento é dividido igualmente entre o início e o fim da obra.' : ' O restante do orçamento ainda não é distribuído nos meses: informe o <b>início e o prazo da obra</b> em Editar a obra para incluir essa parte.') + '</div>' +
    '<div class="ob7-chart">' + c.rows.map(function(x){ var h = maxA > 0 ? Math.max(4, Math.round(x.aportar / maxA * 100)) : 4; return '<div class="ob7-col" title="' + escapeHtml(mesLabel(x.mes)) + ': aportar ' + fmtMoeda(x.aportar) + '"><i style="height:' + h + '%;background:' + (c.pior && c.pior.mes === x.mes ? 'var(--urgente)' : (x.aportar > 0 ? 'var(--ink)' : 'var(--border)')) + '"></i><small>' + escapeHtml(mesLabel(x.mes).slice(0, 3)) + '</small></div>'; }).join('') + '</div>' +
    '<div class="plan-linha"><span>Dinheiro hoje na conta da obra</span><strong>' + fmtMoeda(c.saldoInicial) + '</strong></div>' +
    '<div class="plan-linha"><span>Total que você ainda precisa colocar</span><strong>' + fmtMoeda(c.total) + '</strong></div>' +
    (!c.temCronograma && c.semDistribuir > 0 ? '<div class="plan-linha"><span>Orçamento ainda sem data (não entra na conta)</span><strong>' + fmtMoeda(c.semDistribuir) + '</strong></div>' : '') +
    (c.pior ? '<div class="plan-linha"><span>Mês mais pesado</span><strong style="color:var(--urgente)">' + escapeHtml(mesLabel(c.pior.mes)) + ': ' + fmtMoeda(c.pior.aportar) + '</strong></div>' : '<div class="saldo-data" style="color:var(--success)">Com o que há na conta da obra e as liberações previstas, não falta caixa nos próximos meses.</div>') +
    '<div class="plan-linha"><span>Sobra prevista na sua conta (Análises)</span><strong>' + fmtMoeda(c.sobra) + '/mês</strong></div>' +
    (c.pior && c.sobra < c.pior.aportar  ? '<div class="plan-alerta aviso">Em ' + escapeHtml(mesLabel(c.pior.mes)) + ' a obra pede ' + fmtMoeda(c.pior.aportar) + ' e o seu caixa livre prevê ' + fmtMoeda(c.sobra) + ' por mês. Não cobre sem usar a reserva ou um alvará.' + (paTemSample() ? ' <button type="button" class="btn-text" data-pa-abrir="Consigo aportar ' + Math.round(c.pior.aportar) + ' reais na obra em ' + escapeHtml(mesLabel(c.pior.mes)) + '?">Perguntar ao app</button>' : '') + '</div>' : '');
  return ob7Sec('cx', 'Caixa próprio necessário', c.pior ? 'pior mês: ' + mesLabel(c.pior.mes) + ' · ' + fmtMoeda(c.pior.aportar) : (c.total > 0 ? 'total ' + fmtMoeda(c.total) : 'sem falta de caixa'), corpo);
}
var OB7_PADRAO = [
  ['antes', 'Projeto aprovado na prefeitura'], ['antes', 'Alvará de construção'], ['antes', 'ART/RRT do responsável técnico'], ['antes', 'Matrícula do terreno atualizada'], ['antes', 'Contrato do financiamento assinado'],
  ['durante', 'Pedir a medição ao banco (a cada etapa concluída)'], ['durante', 'Guardar as notas fiscais do material e da mão de obra'], ['durante', 'Registro da obra no INSS (CEI/CNO)'],
  ['final', 'Vistoria final do banco'], ['final', 'Habite-se'], ['final', 'Averbação da construção na matrícula'], ['final', 'Ligação definitiva de água e luz']
];
var OB7_FASES = { antes: 'Antes da obra', durante: 'Durante', final: 'Ao final' };
function ob7HtmlChecklist(cfg){
  var l = cfg.checklist || [], feitos = l.filter(function(x){ return x.feito; }).length, hoje = todayISO();
  var corpo = '';
  if (!l.length) corpo += '<div class="financeiro-vazio">Nenhum item. Comece pela lista padrão de uma obra residencial e ajuste do seu jeito.</div><button type="button" class="btn btn-ghost" data-ob7="chk-padrao" style="width:100%;justify-content:center;margin-bottom:8px;">Adicionar a lista padrão</button>';
  else corpo += obBarra(feitos, 0, l.length);
  ['antes', 'durante', 'final'].forEach(function(f){
    var itens = l.filter(function(x){ return x.fase === f; }); if (!itens.length) return;
    corpo += '<div class="saldo-data" style="margin-top:8px;font-weight:700;">' + OB7_FASES[f] + '</div>';
    itens.forEach(function(x){
      corpo += '<div class="ad-it" style="cursor:default;"><input type="checkbox" data-ob7="chk-feito" data-id="' + escapeHtml(x.id) + '"' + (x.feito ? ' checked' : '') + '><span class="ad-t"><b' + (x.feito ? ' style="text-decoration:line-through;color:var(--ink-soft)"' : '') + '>' + escapeHtml(x.titulo) + '</b>' + (x.prazo ? '<span class="saldo-data" style="' + (!x.feito && x.prazo < hoje ? 'color:var(--urgente)' : '') + '">' + (x.feito ? 'feito' : 'prazo') + ' ' + fmtData(x.prazo) + '</span>' : '') + '</span>' +
        '<button type="button" class="btn-text" data-ob7="chk-edit" data-id="' + escapeHtml(x.id) + '">Editar</button></div>';
    });
  });
  corpo += '<div class="ob-acoes"><button type="button" class="btn btn-ghost" data-ob7="chk-novo">Adicionar item</button></div>';
  return ob7Sec('chk', 'Checklist da obra', l.length ? feitos + ' de ' + l.length + ' feitos' : 'documentos e marcos por fase', corpo);
}
function ob7HtmlExtrato(cfg){
  var n = 0, valor = 0;
  try{
    extPendentes().forEach(function(d){ (d.lanc || []).forEach(function(l){
      if (l.v >= 0) return; var s = extObraSugestao({ l: { s: l.s, n: l.n || '', o: l.o || '', d: l.d, v: l.v }, v: l.v });
      if (s){ n++; valor += Math.abs(l.v) / 100; }
    }); });
  }catch(e){}
  var corpo = n ? '<div class="plan-linha"><span>Linhas do extrato ainda não conferidas que parecem ser da obra</span><strong>' + n + ' (' + fmtMoeda(r2(valor)) + ')</strong></div><div class="saldo-data">Ao conferir os extratos, cada uma pode virar gasto ou aporte da obra com um toque.</div><div class="ob-acoes"><button type="button" class="btn btn-primary" data-ob7="ir-extratos">Conferir extratos</button></div>' :
    '<div class="financeiro-vazio">Nenhuma linha pendente do extrato parece ser da obra. Quando você trouxer extratos novos (Extratos do banco), o que for da obra aparece aqui.</div>';
  var semNota = obraMov.filter(function(m){ return m.tipo === 'gasto' && m.status !== 'apagar' && !(m.anexos && m.anexos.length); });
  corpo += '<div class="plan-linha"><span>Gastos pagos sem comprovante anexado</span><strong>' + semNota.length + '</strong></div>';
  return ob7Sec('ext', 'Conferência do extrato e comprovantes', n ? n + ' linha(s) do extrato' : semNota.length + ' gasto(s) sem comprovante', corpo);
}
function ob7Extras(){
  var el = qs('obraWrap'); if (!el || storageMode !== 'db') return;
  var cfg = ob7Cfg(); if (!cfg.criada) return;
  var r = obraResumo(), cards = el.querySelector('.ob-cards'); if (!cards) return;
  Array.prototype.forEach.call(el.querySelectorAll('[data-ob7-sec]'), function(e){ e.remove(); });
  cards.insertAdjacentHTML('afterend', ob7HtmlFin(cfg, r) + ob7HtmlJuros(cfg) + ob7HtmlCaixa(cfg));
  el.insertAdjacentHTML('beforeend', ob7HtmlChecklist(cfg) + ob7HtmlExtrato(cfg));
}
(function(){
  var orig = renderObra;
  renderObra = function(){ var r = orig.apply(this, arguments); try{ ob7Extras(); }catch(e){ console.error('obra 7', e); } return r; };
  var st = document.createElement('style');
  st.textContent = '.ini-card.ob7-sec{padding:0;margin-top:12px}.ob7-sec>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:12px 16px}.ob7-tx{display:flex;flex-direction:column;gap:1px;min-width:0;padding-right:18px}.ob7-sec>summary::after{top:50%;transform:translateY(-50%)}.ob7-sec>summary::-webkit-details-marker{display:none}.ob7-sec>summary::after{content:"▾";position:absolute;right:16px;color:var(--ink-soft)}.ob7-sec{position:relative}.ob7-sec[open]>summary::after{content:"▴"}.ob7-corpo{padding:0 16px 14px}' +
    '.ob7-chart{display:flex;align-items:flex-end;gap:6px;height:120px;margin:10px 0 6px;border-bottom:1px solid var(--border)}.ob7-col{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative}.ob7-col i{display:block;width:100%;border-radius:5px 5px 0 0}.ob7-col small{position:absolute;bottom:-17px;font-size:var(--t1);color:var(--ink-soft)}.ob7-chart{margin-bottom:22px}';
  document.head.appendChild(st);
  document.addEventListener('toggle', function(e){ var d = e.target; if (d && d.getAttribute && d.getAttribute('data-ob7-sec')) ob7Abertos[d.getAttribute('data-ob7-sec')] = d.open; }, true);
})();

/* ---------- ações: medições, juros, checklist ---------- */
function ob7SalvarLista(chave, lista){ var p = {}; p[chave] = lista; return persistObraCfg(p).then(function(){ renderObra(); }); }
function ob7AbrirMedicao(id){
  var cfg = ob7Cfg(), m = id ? (cfg.medicoes || []).filter(function(x){ return x.id === id; })[0] : null;
  var etapas = obraEtapasVisiveis(cfg);
  var html = obCampo('Data prevista da liberação', obInput('data', 'date', m ? m.data : '')) +
    obCampo('Valor previsto (R$)', obInput('valor', 'number', m ? m.valor : '', 'min="0" step="0.01" inputmode="decimal"')) +
    obCampo('Descrição (opcional)', obInput('desc', 'text', m ? (m.desc || '') : '', 'placeholder="Ex.: Fundação e alvenaria"')) +
    (etapas.length ? obCampo('Etapas que precisam estar concluídas', '<div id="of_etapas">' + etapas.map(function(e){ return '<label class="ad-it" style="border:0;padding:3px 0;"><input type="checkbox" value="' + escapeHtml(e.id) + '"' + (m && (m.etapaIds || []).indexOf(e.id) >= 0 ? ' checked' : '') + '><span class="ad-t">' + escapeHtml(e.nome) + '</span></label>'; }).join('') + '</div>') : '') +
    obCampo('Situação', obSelect('st', [['prevista', 'Prevista'], ['solicitada', 'Já pedi ao banco']], m && m.status === 'solicitada' ? 'solicitada' : 'prevista'));
  obraAbrirForm(m ? 'Editar medição' : 'Nova medição', html, function(){
    var data = obFid('data').value, valor = r2(obNum('valor'));
    if (!data) return 'Informe a data prevista.'; if (!(valor > 0)) return 'Informe o valor previsto.';
    var ids = Array.prototype.map.call(qs('of_etapas') ? qs('of_etapas').querySelectorAll('input:checked') : [], function(i){ return i.value; });
    var item = Object.assign({}, m || { id: uid(), liberacaoId: null }, { data: data, valor: valor, desc: obFid('desc').value.trim(), etapaIds: ids, status: obFid('st').value });
    var lista = (cfg.medicoes || []).filter(function(x){ return !m || x.id !== m.id; }).concat([item]);
    return ob7SalvarLista('medicoes', lista);
  });
}
function ob7Liberar(id){
  var cfg = ob7Cfg(), m = ob7Medicoes().filter(function(x){ return x.id === id; })[0]; if (!m) return;
  if (cfg.financiamento.status !== 'aprovado'){ toast('O financiamento ainda está como estimado. Em "Editar a obra", marque como aprovado para registrar liberações.'); return; }
  var html = obCampo('Valor liberado (R$)', obInput('valor', 'number', m.valor, 'min="0" step="0.01" inputmode="decimal"'), 'Dinheiro que o banco liberou para a conta da obra. Não é receita.') +
    obCampo('Data da liberação', obInput('data', 'date', todayISO())) + obCampo('Observação', obInput('obs', 'text', m.numero + 'ª medição'));
  obraAbrirForm('Registrar liberação — ' + m.numero + 'ª medição', html, function(){
    var valor = r2(obNum('valor')), data = obFid('data').value;
    if (!(valor > 0)) return 'Informe o valor liberado.'; if (!data) return 'Informe a data.';
    var lid = uid();
    return obraGravar(lid, { tipo: 'liberacao', data: data, valor: valor, obs: obFid('obs').value.trim(), medicaoId: m.id, criadoEm: new Date().toISOString() }).then(function(){
      return ob7SalvarLista('medicoes', (cfg.medicoes || []).map(function(x){ return x.id === m.id ? Object.assign({}, x, { status: 'liberada', liberacaoId: lid, liberadaEm: data }) : x; }));
    });
  }, 'Registrar');
}
function ob7ExcluirMedicao(id){
  var cfg = ob7Cfg(); obraAbrirForm('Excluir medição', '<div class="parcela-sum">Excluir esta medição do cronograma? Uma liberação já registrada não é apagada.</div>', function(){ return ob7SalvarLista('medicoes', (cfg.medicoes || []).filter(function(x){ return x.id !== id; })); }, 'Excluir', true);
}
function ob7EtapaJuros(valorTotal){
  var cfg = ob7Cfg(), e = cfg.etapas.filter(function(x){ return x.nome === 'Juros de obra'; })[0];
  if (e) return Promise.resolve(e.id);
  var novo = { id: uid(), nome: 'Juros de obra', orcado: r2(valorTotal), status: 'andamento', ordem: cfg.etapas.length + 1 };
  return persistObraCfg({ etapas: cfg.etapas.concat([novo]) }).then(function(){ return novo.id; });
}
function ob7LancarJuros(mes){
  var j = ob7Juros(); if (!j) return; var x = j.rows.filter(function(r){ return r.mes === mes; })[0]; if (!x) return;
  ob7EtapaJuros(j.total).then(function(etapaId){
    obraAbrirGasto();
    ldSet('of_desc', 'Juros de obra — ' + mesLabel(mes)); ldSet('of_valor', x.juros); ldSet('of_etapa', etapaId); ldSet('of_forn', ob7Cfg().financiamento.banco || '');
    var s = qs('of_etapa'); if (s) s.value = etapaId;
    var aviso = qs('of_aviso'); if (aviso) aviso.textContent = 'Valor estimado: ajuste para o valor do boleto antes de salvar.';
    qs('obraFormSalvar').setAttribute('data-ob7-juros', mes);
  });
}
document.addEventListener('click', function(ev){
  var b = ev.target.closest ? ev.target.closest('#obraFormSalvar') : null; if (!b || !b.getAttribute('data-ob7-juros')) return;
  var mes = b.getAttribute('data-ob7-juros'); b.removeAttribute('data-ob7-juros');
  setTimeout(function(){ if (!qs('overlayObraForm').classList.contains('show')){ var m = Object.assign({}, ob7Cfg().jurosLancados || {}); m[mes] = true; persistObraCfg({ jurosLancados: m }).then(function(){ renderObra(); }); } }, 600);
}, true);
function ob7AbrirItem(id){
  var cfg = ob7Cfg(), x = id ? (cfg.checklist || []).filter(function(i){ return i.id === id; })[0] : null;
  var html = obCampo('Item', obInput('t', 'text', x ? x.titulo : '', 'placeholder="Ex.: Habite-se"')) +
    obCampo('Fase', obSelect('fase', [['antes', 'Antes da obra'], ['durante', 'Durante'], ['final', 'Ao final']], x ? x.fase : 'durante')) +
    obCampo('Prazo (opcional)', obInput('prazo', 'date', x ? (x.prazo || '') : ''), 'Itens com prazo avisam na Central de atenção.');
  obraAbrirForm(x ? 'Editar item' : 'Novo item', html, function(){
    var t = obFid('t').value.trim(); if (!t) return 'Escreva o item.';
    var item = Object.assign({}, x || { id: uid(), feito: false }, { titulo: t, fase: obFid('fase').value, prazo: obFid('prazo').value || null });
    var lista = (cfg.checklist || []).filter(function(i){ return !x || i.id !== x.id; }).concat([item]);
    return ob7SalvarLista('checklist', lista);
  });
  if (x){ var bx = document.createElement('button'); bx.type = 'button'; bx.className = 'btn-text acao-excluir'; bx.textContent = 'Excluir este item'; bx.addEventListener('click', function(){ obraFecharForm(); ob7SalvarLista('checklist', (cfg.checklist || []).filter(function(i){ return i.id !== x.id; })); }); qs('obraFormCorpo').appendChild(bx); }
}
document.addEventListener('click', function(ev){
  var t = ev.target.closest ? ev.target.closest('[data-ob7]') : null; if (!t || t.tagName === 'INPUT') return;
  var a = t.getAttribute('data-ob7'), id = t.getAttribute('data-id');
  if (a === 'med-nova') ob7AbrirMedicao(); else if (a === 'med-edit') ob7AbrirMedicao(id); else if (a === 'med-lib') ob7Liberar(id); else if (a === 'med-del') ob7ExcluirMedicao(id);
  else if (a === 'jur-lancar') ob7LancarJuros(t.getAttribute('data-mes'));
  else if (a === 'chk-novo') ob7AbrirItem(); else if (a === 'chk-edit') ob7AbrirItem(id);
  else if (a === 'chk-padrao'){ var cfg = ob7Cfg(); ob7SalvarLista('checklist', OB7_PADRAO.map(function(p){ return { id: uid(), fase: p[0], titulo: p[1], prazo: null, feito: false }; })); }
  else if (a === 'ir-extratos') setActiveTab('extratos');
  else if (a === 'anexos') ob7AbrirAnexos(id);
});
document.addEventListener('change', function(ev){
  var t = ev.target; if (!t || t.getAttribute('data-ob7') !== 'chk-feito') return;
  var cfg = ob7Cfg(), id = t.getAttribute('data-id');
  ob7SalvarLista('checklist', (cfg.checklist || []).map(function(i){ return i.id === id ? Object.assign({}, i, { feito: t.checked, feitoEm: t.checked ? todayISO() : null }) : i; }));
});

/* ---------- comprovantes (fotos e PDFs das notas) ---------- */
var OB7_MAX_ANEXOS = 4, ob7Gasto = null;
function ob7ClipHtml(m){ var n = (m.anexos || []).length; return '<button type="button" class="btn-text" data-ob7="anexos" data-id="' + escapeHtml(m.id) + '" title="Comprovantes">' + (n ? '\uD83D\uDCCE ' + n : 'Anexar') + '</button>'; }
function ob7B64(blob){ return new Promise(function(res, rej){ var fr = new FileReader(); fr.onload = function(){ res(String(fr.result).split(',')[1]); }; fr.onerror = function(){ rej(new Error('Não consegui ler o arquivo.')); }; fr.readAsDataURL(blob); }); }
function ob7B64Blob(b64, tipo){ var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: tipo }); }
function ob7Api(url, metodo, corpo){
  return fetch(url, { method: metodo || 'GET', credentials: 'same-origin', cache: 'no-store', headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined, body: corpo !== undefined ? JSON.stringify(corpo) : undefined })
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) throw new Error((j.error && j.error.message) || ('Erro ' + r.status)); return j; }); });
}
function ob7MontarAnexos(){
  if (qs('overlayAnexos')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAnexos'; d.style.zIndex = '260';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="anTitulo">Comprovantes</h2><button class="icon-btn" id="anFechar" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="anCorpo"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#anFechar'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-an]') : null; if (!b) return;
    var a = b.getAttribute('data-an'), id = b.getAttribute('data-id');
    if (a === 'add'){ qs('anArq').click(); } else if (a === 'ver') ob7VerAnexo(id); else if (a === 'rem') ob7RemoverAnexo(id); else if (a === 'ler') ob7LerNota();
  });
  d.addEventListener('change', function(e){ if (e.target && e.target.id === 'anArq'){ var f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) ob7AdicionarAnexo(f); } });
}
function ob7DesenharAnexos(msg){
  var m = obraMov.filter(function(x){ return x.id === ob7Gasto; })[0]; if (!m){ qs('overlayAnexos').classList.remove('show'); return; }
  var l = m.anexos || [], temImg = l.some(function(a){ return /^image\//.test(a.tipo); });
  qs('anTitulo').textContent = 'Comprovantes — ' + (m.descricao || 'gasto');
  qs('anCorpo').innerHTML = '<div class="saldo-data">' + fmtMoeda(m.valor) + (m.nf ? ' · nota ' + escapeHtml(m.nf) : '') + ' · até ' + OB7_MAX_ANEXOS + ' arquivos. A foto é reduzida no aparelho antes de enviar; só você vê.</div>' +
    (l.length ? l.map(function(a){ return '<div class="plan-linha"><span>' + (/^image\//.test(a.tipo) ? '\uD83D\uDDBC\uFE0F ' : '\uD83D\uDCC4 ') + escapeHtml(a.nome) + '<em>' + Math.round(a.tam / 1024) + ' KB</em></span><span><button type="button" class="btn-text" data-an="ver" data-id="' + escapeHtml(a.id) + '">Ver</button><button type="button" class="btn-text acao-excluir" data-an="rem" data-id="' + escapeHtml(a.id) + '">Remover</button></span></div>'; }).join('') : '<div class="financeiro-vazio">Nenhum comprovante ainda.</div>') +
    '<input type="file" id="anArq" accept="image/*,application/pdf" style="display:none;">' +
    (l.length < OB7_MAX_ANEXOS ? '<button type="button" class="btn btn-primary" data-an="add" style="width:100%;justify-content:center;">Anexar foto ou PDF</button>' : '') +
    (temImg && paTemSample() ? '<button type="button" class="btn btn-ghost" data-an="ler" style="width:100%;justify-content:center;">Ler a nota e preencher o gasto</button>' : '') +
    (msg ? '<div class="saldo-data" role="status">' + escapeHtml(msg) + '</div>' : '');
}
function ob7AbrirAnexos(id){ ob7MontarAnexos(); ob7Gasto = id; ob7DesenharAnexos(''); qs('overlayAnexos').classList.add('show'); }
function ob7AdicionarAnexo(file){
  var m = obraMov.filter(function(x){ return x.id === ob7Gasto; })[0]; if (!m) return;
  if ((m.anexos || []).length >= OB7_MAX_ANEXOS){ ob7DesenharAnexos('Limite de ' + OB7_MAX_ANEXOS + ' arquivos por gasto.'); return; }
  ob7DesenharAnexos('Enviando…');
  var ehPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  var preparar = ehPdf ? Promise.resolve(file) : ldImagem(file, 1400);
  preparar.then(function(blob){
    var tipo = ehPdf ? 'application/pdf' : 'image/jpeg';
    if (blob.size > 600 * 1024) throw new Error(ehPdf ? 'PDF grande demais (limite de 600 KB). Tire uma foto da nota ou envie um PDF menor.' : 'Imagem grande demais mesmo depois de reduzida.');
    return ob7B64(blob).then(function(b64){ return ob7Api('/api/anexos', 'POST', { nome: (file.name || 'nota').slice(0, 80), tipo: tipo, b64: b64 }).then(function(j){ return { id: j.id, nome: (file.name || (ehPdf ? 'nota.pdf' : 'foto.jpg')).slice(0, 80), tipo: tipo, tam: blob.size }; }); });
  }).then(function(an){
    var atual = obraMov.filter(function(x){ return x.id === ob7Gasto; })[0];
    return obraGravar(ob7Gasto, Object.assign({}, atual, { anexos: (atual.anexos || []).concat([an]) }));
  }).then(function(){ ob7DesenharAnexos('Comprovante anexado.'); renderObra(); }).catch(function(e){ ob7DesenharAnexos((e && e.message) || 'Não consegui anexar.'); });
}
function ob7VerAnexo(id){
  var m = obraMov.filter(function(x){ return x.id === ob7Gasto; })[0], a = m && (m.anexos || []).filter(function(x){ return x.id === id; })[0]; if (!a) return;
  ob7Api('/api/anexos/' + encodeURIComponent(id)).then(function(j){ var url = URL.createObjectURL(ob7B64Blob(j.b64, j.tipo)); var w = window.open(url, '_blank'); if (!w) location.href = url; setTimeout(function(){ URL.revokeObjectURL(url); }, 60000); }).catch(function(e){ ob7DesenharAnexos(e.message); });
}
function ob7RemoverAnexo(id){
  var m = obraMov.filter(function(x){ return x.id === ob7Gasto; })[0]; if (!m) return;
  ob7Api('/api/anexos/' + encodeURIComponent(id), 'DELETE').catch(function(){}).then(function(){ return obraGravar(ob7Gasto, Object.assign({}, m, { anexos: (m.anexos || []).filter(function(x){ return x.id !== id; }) })); }).then(function(){ ob7DesenharAnexos('Comprovante removido.'); renderObra(); });
}
function ob7LerNota(){
  var m = obraMov.filter(function(x){ return x.id === ob7Gasto; })[0], a = m && (m.anexos || []).filter(function(x){ return /^image\//.test(x.tipo); })[0]; if (!a) return;
  paSample().then(function(sample){
    if (!sample) return; ob7DesenharAnexos('Lendo a nota…');
    return ob7Api('/api/anexos/' + encodeURIComponent(a.id)).then(function(j){ return sample(ldPrompt('obra'), { images: [ob7B64Blob(j.b64, j.tipo)], modelTier: 'default' }); }).then(function(r){
      var x = ldParse(typeof r === 'string' ? r : (r && r.text) || '');
      qs('overlayAnexos').classList.remove('show');
      obraAbrirGasto(m.id);
      if (x.fornecedor) ldSet('of_forn', x.fornecedor); if (x.valor != null) ldSet('of_valor', x.valor); if (x.numero_nota) ldSet('of_nf', x.numero_nota); if (x.data) ldSet('of_data', x.data);
      if (x.descricao && qs('of_desc') && !qs('of_desc').value) ldSet('of_desc', x.descricao);
      toast('Dados lidos da nota. Confira antes de salvar.');
    }).catch(function(e){ ob7DesenharAnexos((e && e.message) || 'Não consegui ler a nota.'); });
  });
}
(function(){
  var orig = obraApagar;
  obraApagar = function(id){
    var m = obraMov.filter(function(x){ return x.id === id; })[0];
    if (m && m.anexos) m.anexos.forEach(function(a){ ob7Api('/api/anexos/' + encodeURIComponent(a.id), 'DELETE').catch(function(){}); });
    return orig.apply(this, arguments);
  };
})();

/* ---------- avisos de pagamento da obra na Central de atenção ---------- */
function ob7Avisos(){
  var cfg = ob7Cfg(); if (!cfg.criada) return [];
  var hoje = todayISO(), lim = somarDias(hoje, 10), a = [];
  obraMov.forEach(function(m){
    if (m.tipo !== 'gasto' || m.status !== 'apagar') return;
    var d = m.vencimento || m.data; if (!d || d > lim) return;
    a.push({ tipo: 'gasto', id: m.id, d: d, titulo: 'Obra · ' + (m.descricao || 'gasto'), detalhe: (d < hoje ? 'Venceu em ' : 'Vence em ') + fmtData(d) + (m.fornecedor ? ' · ' + m.fornecedor : ''), valor: Number(m.valor) || 0, atraso: d < hoje });
  });
  (cfg.checklist || []).forEach(function(x){ if (!x.feito && x.prazo && x.prazo <= lim) a.push({ tipo: 'check', id: x.id, d: x.prazo, titulo: 'Obra · ' + x.titulo, detalhe: (x.prazo < hoje ? 'Prazo venceu em ' : 'Prazo em ') + fmtData(x.prazo), valor: null, atraso: x.prazo < hoje }); });
  ob7Medicoes().forEach(function(m){ if (m.status !== 'liberada' && !m.liberacaoId && m.data && m.data <= somarDias(hoje, 15)) a.push({ tipo: 'med', id: m.id, d: m.data, titulo: 'Obra · ' + m.numero + 'ª medição', detalhe: (m.data < hoje ? 'Prevista para ' : 'Liberação prevista em ') + fmtData(m.data) + (m.status === 'solicitada' ? ' · já pedida ao banco' : ' · peça ao banco'), valor: Number(m.valor) || 0, atraso: m.data < hoje }); });
  var j = null; try{ j = ob7Juros(); }catch(e){}
  if (j){ var at = j.rows.filter(function(x){ return x.situacao === 'atual' && !x.lancado && x.juros > 0.004; })[0]; if (at && todayISO().slice(8, 10) >= '05') a.push({ tipo: 'juros', id: at.mes, d: hoje, titulo: 'Obra · juros de ' + mesLabel(at.mes).toLowerCase(), detalhe: 'Estimado; confira com o boleto do banco', valor: at.juros, atraso: false }); }
  try{ var atr = mfAtrasado(); if (atr) a.push({ tipo: 'calc', id: 'refs', d: hoje, titulo: 'Obra · valores de referência sem atualizar', detalhe: 'A busca automática do IBGE parou em ' + mfMesCurto(atr.ultimo) + '.', valor: null, atraso: false }); }catch(e){}
  return a.sort(function(x, y){ return x.d.localeCompare(y.d); });
}
function ob7LinhaAviso(a){
  var dd = a.tipo === 'juros' ? '' : a.d.slice(8, 10), mm = a.tipo === 'juros' ? '' : MES_CURTO_AT[Number(a.d.slice(5, 7)) - 1].toUpperCase();
  var hoje = a.d === todayISO() && a.tipo !== 'juros', urgente = a.atraso || hoje;
  return '<div class="stall-chip ob7-aviso' + (urgente ? '' : ' tipo-murilo') + '" data-ob7-aviso="' + a.tipo + '|' + escapeHtml(a.id) + '"><div class="up-data' + (a.atraso ? ' up-d-atraso' : (hoje ? ' up-d-hoje' : '')) + '">' + (a.tipo === 'juros' ? '<svg><use href="#ic-coin"/></svg>' : '<b>' + dd + '</b><span>' + mm + '</span>') + '</div>' +
    '<div class="up-top"><span>' + escapeHtml(a.titulo) + '</span>' + (a.valor != null ? '<span>' + fmtMoeda(a.valor) + '</span>' : '') + '</div><div class="up-when">' + escapeHtml(a.detalhe) + '</div></div>';
}
function ob7MontarEscolha(){
  if (qs('overlayObAviso')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayObAviso';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="obAvTitulo">Obra</h2><button class="icon-btn" id="obAvFechar" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body"><div class="parcela-sum" id="obAvInfo"></div><button type="button" class="btn btn-primary" id="obAvFeito" style="width:100%;justify-content:center;"></button><div class="field" id="obAvAdiarBox"><label class="field-label" for="obAvData">Adiar para</label><input type="date" id="obAvData"></div><button type="button" class="btn btn-ghost" id="obAvAdiar" style="width:100%;justify-content:center;">Adiar</button><div class="form-error" id="obAvErro"></div></div></div>';
  document.body.appendChild(d);
  adAbrirData(qs('obAvData'));
  d.addEventListener('click', function(e){ if (e.target === d || (e.target.closest && e.target.closest('#obAvFechar'))) d.classList.remove('show'); });
  qs('obAvFeito').addEventListener('click', function(){
    var a = ob7AvisoAtual; d.classList.remove('show'); if (!a) return;
    if (a.tipo === 'gasto') obraAbrirGasto(null, a.id);
    else if (a.tipo === 'check') ob7SalvarLista('checklist', (ob7Cfg().checklist || []).map(function(i){ return i.id === a.id ? Object.assign({}, i, { feito: true, feitoEm: todayISO() }) : i; })).then(function(){ renderPainelAtencao(); });
    else if (a.tipo === 'med') ob7Liberar(a.id);
    else if (a.tipo === 'juros') setTimeout(function(){ ob7LancarJuros(a.id); }, 60);
  });
  qs('obAvAdiar').addEventListener('click', function(){
    var a = ob7AvisoAtual, nova = qs('obAvData').value; if (!a) return;
    if (!nova || nova < todayISO()){ qs('obAvErro').textContent = 'Escolha uma data de hoje em diante.'; return; }
    var cfg = ob7Cfg(), p;
    if (a.tipo === 'gasto'){ var m = obraMov.filter(function(x){ return x.id === a.id; })[0]; p = m ? obraGravar(m.id, Object.assign({}, m, { vencimento: nova })) : Promise.resolve(); }
    else if (a.tipo === 'check') p = ob7SalvarLista('checklist', (cfg.checklist || []).map(function(i){ return i.id === a.id ? Object.assign({}, i, { prazo: nova }) : i; }));
    else if (a.tipo === 'med') p = ob7SalvarLista('medicoes', (cfg.medicoes || []).map(function(i){ return i.id === a.id ? Object.assign({}, i, { data: nova }) : i; }));
    else p = Promise.resolve();
    p.then(function(){ d.classList.remove('show'); renderPainelAtencao(); toast('Adiado para ' + fmtData(nova) + '.'); });
  });
}
var ob7AvisoAtual = null;
document.addEventListener('click', function(ev){
  var el = ev.target.closest ? ev.target.closest('[data-ob7-aviso]') : null; if (!el) return;
  var p = el.getAttribute('data-ob7-aviso').split('|'), a = ob7Avisos().filter(function(x){ return x.tipo === p[0] && String(x.id) === p[1]; })[0]; if (!a) return;
  if (a.tipo === 'calc'){ try{ setActiveTab('obra'); mfS.obra = 'calc'; renderObra(); }catch(e){} return; }   /* lembrete mensal: abre a Calculadora */
  ob7MontarEscolha(); ob7AvisoAtual = a;
  qs('obAvTitulo').textContent = a.titulo; qs('obAvInfo').textContent = a.detalhe + (a.valor != null ? ' · ' + fmtMoeda(a.valor) : '');
  qs('obAvFeito').textContent = a.tipo === 'gasto' ? 'Marcar como pago' : (a.tipo === 'check' ? 'Marcar como feito' : (a.tipo === 'med' ? 'Registrar liberação' : 'Lançar o gasto'));
  var podeAdiar = a.tipo !== 'juros'; qs('obAvAdiarBox').style.display = podeAdiar ? '' : 'none'; qs('obAvAdiar').style.display = podeAdiar ? '' : 'none';
  qs('obAvData').min = todayISO(); qs('obAvData').value = ''; qs('obAvErro').textContent = '';
  qs('overlayObAviso').classList.add('show');
});
/* itens da obra para as notificações das 10h (o que vence hoje) */
function ob7Itens(hoje, lim){
  return ob7Avisos().filter(function(a){ return a.d >= hoje && a.d <= lim && a.tipo !== 'juros' && a.tipo !== 'calc'; }).map(function(a){ return { d: a.d, t: 'obra', n: a.titulo, l: '', v: a.valor }; });
}
