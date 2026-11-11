/* ============================================================
   AGENDA DE PRAZOS PROCESSUAIS, AUDIÊNCIAS E TAREFAS
   - separada da Central de atenção (que fica só com dinheiro)
   - junta o que você cadastra na Agenda, os prazos confirmados nas Publicações e os prazos que já existiam nas Iniciais
   - cartão "Prazos processuais" no Início e avisos no celular (5, 2 e 1 dia antes e no dia, configurável por item)
   ============================================================ */
var agDocs = [], agOk = false, agEditKey = null, agEditTipo = 'prazo';
var agS = { vista: 'semana', quadro: 'urgencia', filtro: 'tudo', ref: '', mes: '', sel: '', feitos: false };
var AG_PADRAO = [5, 2, 1, 0];
var AG_TIPOS = { prazo: 'Prazo', audiencia: 'Audiência', tarefa: 'Tarefa' };
var AG_MODAL = { presencial: 'Presencial', online: 'Online', hibrida: 'Híbrida' };
var AG_AUDS = ['Conciliação', 'Mediação', 'Instrução e julgamento', 'Justificação', 'Saneamento', 'Custódia', 'Admonitória', 'Outra'];
var agEditPre = null;
var AG_SITUACAO = { afazer: 'A fazer', elaboracao: 'Em andamento', feito: 'Concluído', cancelado: 'Cancelado' };
var AG_DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], AG_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function agHoje(){ return todayISO(); }
function agDias(iso){ return Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(agHoje() + 'T12:00:00Z')) / 86400000); }
function agMesCurto(iso){ return AG_MESES[Number(iso.slice(5, 7)) - 1].slice(0, 3).toUpperCase(); }
function agNomeFeriado(iso){
  var md = iso.slice(5);
  if (pbFeriado(iso)){
    if (PB_FER_NOMES[md]) return PB_FER_NOMES[md];
    var d = Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(pbPascoa(Number(iso.slice(0, 4))) + 'T12:00:00Z')) / 86400000);
    return ({ '-48': 'Carnaval', '-47': 'Carnaval', '-46': 'Carnaval', '-4': 'Semana Santa', '-3': 'Quinta-feira Santa', '-2': 'Sexta-feira Santa', '60': 'Corpus Christi' })[String(d)] || 'Feriado';
  }
  return '';
}
function agAntesUteis(iso, n){ var d = iso; while (n > 0){ d = pbSoma(d, -1); if (!pbNaoUtil(d)) n--; } return d; }

/* ---------- dados ---------- */
function agCarregar(){
  if (!window.__SERVIDOR) { agOk = true; agDepois(); return Promise.resolve(); }
  return pbApi('/api/db/prazosPub').catch(function(){ return { docs: [] }; }).then(function(old){   /* migra os prazos da primeira versão */
    var docs = old.docs || []; if (!docs.length) return null;
    return Promise.all(docs.map(function(d){
      var x = d.data || {};
      return pbApi('/api/db/agenda', 'POST', { tipo: 'prazo', titulo: x.descricao || 'Prazo', processo: x.processo || '', cliente: x.cliente || '', data: x.data, trabalhar: '', situacao: x.concluido ? 'feito' : 'afazer', concluido: !!x.concluido, pubId: x.pubId || '', dias: x.dias, contagem: x.contagem, disp: x.disp, inicio: x.inicio, manual: !!x.manual, tribunal: x.tribunal || '', avisos: AG_PADRAO.slice(), criadoEm: x.criadoEm || new Date().toISOString() })
        .then(function(){ return pbApi('/api/db/prazosPub/' + encodeURIComponent(d.id), 'DELETE'); });
    }));
  }).then(function(){ return (window.__horusListarTudo ? window.__horusListarTudo('agenda') : pbApi('/api/db/agenda')); }).then(function(r){
    agDocs = (r.docs || []).map(function(d){ var x = d.data || {}; x.id = d.id; return x; }); agOk = true; agDepois();
  }).catch(function(){ agOk = true; agDepois(); });
}
function agDepois(){
  try{ agRenderInicio(); }catch(e){ console.error('prazos no início', e); }
  agAtualizarBadge();
  if (activeTab === 'agenda') agRender();
  if (activeTab === 'publicacoes') pbRender();
  try{ if (qs('overlayPb') && qs('overlayPb').classList.contains('show')) pbDesenharDetalhe(); }catch(e){}   /* a leitura aberta mostra a audiência recém-criada */
  try{ ntAgendarEnvio(); }catch(e){}
  try{ agdAtualizar(); }catch(e){}
}
function pbPrazoDaPub(pubId){
  for (var i = 0; i < agDocs.length; i++) if (agDocs[i].pubId === pubId) return { id: agDocs[i].id, data: agDocs[i].data, concluido: !!agDocs[i].concluido, descricao: agDocs[i].titulo };
  return null;
}
function agCriar(doc){
  return pbApi('/api/db/agenda', 'POST', doc).then(function(j){ doc.id = j.id; agDocs.push(doc); agDepois(); return doc; });
}
function agItens(op){
  var l = [], quadro = !!(op && op.quadro);
  agDocs.forEach(function(d){
    l.push({ key: 'a:' + d.id, fonte: 'agenda', id: d.id, tipo: d.tipo || 'prazo', titulo: d.titulo || 'Prazo', cliente: d.cliente || '', processo: d.processo || '', data: d.data || '', hora: d.hora || '', trabalhar: d.trabalhar || '', situacao: d.cancelado ? 'cancelado' : (d.concluido ? 'feito' : (d.situacao || 'afazer')), concluido: !!d.concluido, cancelado: !!d.cancelado, pubId: d.pubId || d.audPubId || '', avisos: Array.isArray(d.avisos) ? d.avisos : AG_PADRAO.slice(), doc: d, cat: d.tipo || 'prazo', audTipo: d.audTipo || '', modalidade: d.modalidade || '', local: d.local || '', link: d.link || '', obs: d.obs || '', protocoladoEm: d.protocoladoEm || '', protocoloObs: d.protocoloObs || '' });
  });
  casos.forEach(function(c){   /* prazos que já existiam nas Iniciais */
    if (c.arquivado || !c.prazo || !c.prazo.data) return;
    l.push({ key: 'c:' + c.id, fonte: 'caso', id: c.id, tipo: 'prazo', titulo: c.prazo.descricao || 'Prazo processual', cliente: c.cliente || '', processo: c.numeroProcesso || '', data: c.prazo.data, hora: '', trabalhar: '', situacao: c.prazo.concluido ? 'feito' : 'afazer', concluido: !!c.prazo.concluido, pubId: '', avisos: AG_PADRAO.slice(), caso: c, cat: 'inicial', protocoladoEm: c.prazo.protocoladoEm || '', protocoloObs: c.prazo.protocoloObs || '', faseTxt: STATUS_LABEL[statusDe(c)] || '' });
  });
  if (quadro) alvaras.forEach(function(a){   /* previsão de levantamento dos alvarás: só aparece no Quadro */
    if (a.arquivado || !a.previsaoLevantamento) return;
    var f = faseDoAlvara(a), fim = f === 'depositado' || a.status === 'recebido';
    l.push({ key: 'v:' + a.id, fonte: 'alvara', id: a.id, tipo: 'prazo', titulo: 'Levantamento do alvará', cliente: a.partes || '', processo: a.numeroProcesso || '', data: a.previsaoLevantamento, hora: '', trabalhar: '', situacao: fim ? 'feito' : 'afazer', concluido: fim, pubId: '', avisos: [], alvara: a, cat: 'alvara', faseTxt: FASE_CURTA[f] || '' });
  });
  var arq = {}; try{ arq = prArquivadosSet(); }catch(e){}   /* processo arquivado: seus prazos saem da Agenda (voltam se reabrir) */
  return l.filter(function(i){ return /^\d{4}-\d{2}-\d{2}$/.test(i.data) && !(i.processo && arq[prNum(i.processo)]); });
}
function agOrdem(a, b){ return (a.data + (a.hora || '00:00')).localeCompare(b.data + (b.hora || '00:00')) || (a.tipo || '').localeCompare(b.tipo || ''); }
function agAbertos(){ return agItens().filter(function(i){ return !i.concluido; }).sort(agOrdem); }
function agChip(i){
  if (i.cancelado) return { t: 'Cancelado', c: 'neutro' };
  if (i.concluido) return { t: i.tipo === 'audiencia' ? 'Realizada' : 'Concluído', c: 'ok' };
  var d = agDias(i.data);
  if (d < 0) return { t: (i.tipo === 'audiencia' ? 'Passou' : 'Atrasado') + ' há ' + (-d) + (d === -1 ? ' dia' : ' dias'), c: 'atraso' };
  if (d === 0) return { t: 'Hoje' + (i.hora ? ' ' + i.hora : ''), c: 'atraso' };
  if (d === 1) return { t: 'Amanhã', c: 'breve' };
  return { t: 'Em ' + d + ' dias', c: d <= 3 ? 'breve' : 'ok' };
}
/* audiência que já passou e ninguém marcou como realizada: continua visível nas listas, mas não fica contando como pendência para sempre */
function agPassada(i){ return !i.concluido && i.tipo === 'audiencia' && i.data < agHoje(); }
function agAtualizarBadge(){
  var n = agAbertos().filter(function(i){ return i.data <= agHoje() && !agPassada(i); }).length, e = qs('menuNAgenda'); if (e) e.textContent = n > 0 ? String(n) : '';
}
function agPrazosResumo(hoje, lim){
  return agAbertos().filter(function(i){ return i.data >= hoje && i.data <= lim; }).map(function(i){ return { d: i.data, h: i.hora || '', n: i.cliente || 'Sem nome', l: i.titulo, t: i.tipo, a: i.avisos }; });
}

/* ---------- cartão no Início ---------- */
function agRenderInicio(){
  var el = qs('inicioPrazos'); if (!el) return;
  var hoje = agHoje(), lim = pbSoma(hoje, 7), l = agAbertos().filter(function(i){ return i.data <= lim; });
  var atr = l.filter(function(i){ return i.data < hoje && i.tipo !== 'audiencia'; }).length;
  var sem = l.filter(function(i){ return i.data >= hoje && i.tipo !== 'audiencia'; }).length;
  var aud = l.filter(function(i){ return i.data >= hoje && i.tipo === 'audiencia'; }).length;
  l = l.filter(function(i){ return !(i.tipo === 'audiencia' && i.data < hoje); });
  var chips = (atr ? rsChip(atr + (atr === 1 ? ' atrasado' : ' atrasados'), 'neg') : '') + (sem ? rsChip(sem + (sem === 1 ? ' prazo' : ' prazos'), '') : '') + (aud ? rsChip(aud + (aud === 1 ? ' audiência' : ' audiências'), '') : '');
  var npub = 0; try{ if (pbS.carregado) npub = pbContaNaoLidas(); }catch(e){}
  var h = '<div class="ini-card ag-cartao"><div class="ag-cab"><span class="ag-tit">' + fvIc('scale', '#D93B3B') + '<b>Prazos processuais</b></span><span class="saldo-data">próximos 7 dias</span></div>' + (chips ? '<div class="ag-chips">' + chips + '</div>' : '');
  if (!l.length) h += '<div class="saldo-data" style="margin:8px 0;">Nenhum prazo nos próximos 7 dias.</div>';
  else h += l.slice(0, 5).map(function(i){ return agLinha(i); }).join('') + (l.length > 5 ? '<div class="saldo-data" style="margin-top:6px;">e mais ' + (l.length - 5) + '</div>' : '');
  h += '<div class="ag-rod"><button type="button" class="btn-text" data-ag-ir="agenda">Ver agenda completa ›</button>' + (npub ? '<button type="button" class="btn-text" data-ag-ir="publicacoes">● ' + npub + (npub === 1 ? ' publicação nova' : ' publicações novas') + ' ›</button>' : '') + '</div></div>';
  el.innerHTML = h;
}
function agLinha(i){
  var c = agChip(i), hoje = agHoje(), atr = !i.concluido && i.data < hoje;
  return '<div class="ag-lin" data-ag-abrir="' + escapeHtml(i.key) + '"><div class="ag-dt' + (atr ? ' atr' : (i.data === hoje ? ' hoje' : '')) + '"><b>' + i.data.slice(8, 10) + '</b><span>' + agMesCurto(i.data) + '</span></div><div class="ag-lin-tx"><b>' + escapeHtml((i.tipo === 'audiencia' ? 'Audiência' + (i.hora ? ' ' + i.hora : '') + ' · ' : i.titulo + (i.cliente ? ' · ' : '')) + (i.tipo === 'audiencia' ? (i.cliente || i.titulo) : (i.cliente || ''))) + '</b><span>' + escapeHtml(i.processo || (i.tipo === 'audiencia' ? i.titulo : '')) + '</span></div><span class="est est-' + c.c + '">' + escapeHtml(c.t) + '</span></div>';
}
(function(){
  var orig = renderPainelAtencao;
  renderPainelAtencao = function(){ var r = orig.apply(this, arguments); try{ agRenderInicio(); }catch(e){ console.error('prazos no início', e); } return r; };
  document.addEventListener('click', function(ev){
    var t = ev.target, a = t.closest ? t.closest('[data-ag-abrir]') : null;
    if (a){ agdAbrir(a.getAttribute('data-ag-abrir')); return; }
    var g = t.closest ? t.closest('[data-ag-ir]') : null;
    if (g) setActiveTab(g.getAttribute('data-ag-ir'));
  });
})();

/* ---------- tela da Agenda ---------- */
function agIniSemana(iso){ return pbSoma(iso, -((pbDow(iso) + 6) % 7)); }
function agTextoBusca(i){
  var d = i.doc || {}, partes = Array.isArray(d.partes) ? d.partes.join(' ') : '';
  return normNome([i.titulo, i.cliente, i.processo, partes, d.obs || '', d.subtipo || '', (Array.isArray(d.responsaveis) ? d.responsaveis.join(' ') : '')].join(' ')) + ' ' + String(i.processo || '').replace(/\D/g, '');
}
function agFiltrados(l){
  var sit = agS.sit || 'abertos', hoje = agHoje(), busca = normNome(agS.busca || ''), dig = String(agS.busca || '').replace(/\D/g, ''), ini = '', fim = '';
  if (agS.periodo === 'hoje'){ ini = hoje; fim = hoje; }
  else if (agS.periodo === 'semana'){ ini = agIniSemana(hoje); fim = pbSoma(ini, 6); }
  else if (agS.periodo === 'mes'){ ini = hoje.slice(0, 7) + '-01'; fim = hoje.slice(0, 7) + '-31'; }
  return l.filter(function(i){
    if (!(agS.filtro === 'tudo' || i.cat === agS.filtro)) return false;
    if (sit === 'abertos' && i.concluido) return false;
    if (sit === 'concluidos' && !(i.concluido && !i.cancelado)) return false;
    if (sit === 'cancelados' && !i.cancelado) return false;
    if (agS.resp && !((i.doc && Array.isArray(i.doc.responsaveis)) ? i.doc.responsaveis : []).some(function(n){ return n === agS.resp; })) return false;
    if (ini && !(i.data >= ini && i.data <= fim) && !(!i.concluido && i.data < hoje && i.tipo !== 'audiencia')) return false;   /* o que está atrasado aparece sempre */
    if (busca){ var t = agTextoBusca(i); if (t.indexOf(busca) < 0 && !(dig.length >= 4 && t.indexOf(dig) >= 0)) return false; }
    return true;
  });
}
function agMontarTela(){
  var w = qs('agWrap'); if (!w || w.getAttribute('data-ok')) return; w.setAttribute('data-ok', '1');
  w.addEventListener('input', function(e){ if (e.target && e.target.id === 'agBusca'){ agS.busca = e.target.value; var c = qs('agCorpo'); if (c) c.innerHTML = prComMemo(agCorpo); } });
  w.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-ag]') : null; if (!b) return;
    var a = b.getAttribute('data-ag'), v = b.getAttribute('data-v'), k = b.getAttribute('data-k');
    if (a === 'vista'){ agS.vista = v; mdLembrar('agenda', v); agRender(); }
    else if (a === 'filtro'){ agS.filtro = v; agRender(); }
    else if (a === 'novo') agAbrir(null);
    else if (a === 'rel') rptAgenda();
    else if (a === 'importar'){ agS.menu = false; agiAbrir(); }
    else if (a === 'flt') agdFiltrosAbrir();
    else if (a === 'menu'){ agS.menu = !agS.menu; agRender(); }
    else if (a === 'det') agdAbrir(k);
    else if (a === 'copiar') agdCopiarNumero(b.getAttribute('data-n'));
    else if (a === 'nav'){ var n = Number(v); if (agS.vista === 'mes'){ var d = new Date(agS.mes + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); agS.mes = d.toISOString().slice(0, 7); agS.sel = agS.mes + '-01'; } else { agS.ref = pbSoma(agS.ref, 7 * n); } agRender(); }
    else if (a === 'hoje'){ agS.ref = agHoje(); agS.mes = agHoje().slice(0, 7); agS.sel = agHoje(); agRender(); }
    else if (a === 'dia'){ agS.sel = v; if (agS.vista === 'mes' && v.slice(0, 7) !== agS.mes) agS.mes = v.slice(0, 7); agRender(); if (agS.vista === 'semana'){ var g = qs('agd-' + v); if (g && g.scrollIntoView) g.scrollIntoView({ block: 'start' }); } }
    else if (a === 'abrir') agAbrir(k);
    else if (a === 'concluir') agConcluir(k, true);
    else if (a === 'reabrir') agConcluir(k, false);
    else if (a === 'pub'){ var it = agItens().filter(function(x){ return x.key === k; })[0]; if (it && it.pubId){ setActiveTab('publicacoes'); setTimeout(function(){ pbAbrirDetalhe(it.pubId); }, 80); } }
    else if (a === 'acao'){ var it2 = agItens({ quadro: true }).filter(function(x){ return x.key === k; })[0]; if (it2) irParaRelacionado(it2.fonte === 'alvara' ? 'alvara' : 'peticao', it2.id); }
    else if (a === 'modo'){ agS.quadro = v; agRender(); }
    else if (a === 'feito-toggle'){ if (e.target.closest && e.target.closest('[data-agcard]')) return; agS.feitoAberto = !agS.feitoAberto; agRender(); }
    else if (a === 'adiar') agAdiar(k);
    else if (a === 'mover') agMover(k, v);
  });
  /* arrastar cartões do Quadro: por situação muda a situação; por urgência só dá para soltar em Concluído (a data não muda arrastando) */
  var dragKey = '', railFechada = null;
  function colDe(e){ return e.target && e.target.closest ? e.target.closest('[data-agcol]') : null; }
  w.addEventListener('dragstart', function(e){
    var c = e.target.closest ? e.target.closest('[data-agcard]') : null; if (!c) return;
    dragKey = c.getAttribute('data-agcard'); try{ e.dataTransfer.setData('text/plain', dragKey); e.dataTransfer.effectAllowed = 'move'; }catch(x){}
    c.classList.add('arrastado');
    railFechada = w.querySelector('.ag-col-feito.recolhida'); if (railFechada) railFechada.classList.remove('recolhida');   /* a trilha de Concluído abre para receber o cartão */
  });
  w.addEventListener('dragend', function(){
    dragKey = ''; Array.prototype.forEach.call(w.querySelectorAll('.arrastado,.drag-over'), function(x){ x.classList.remove('arrastado', 'drag-over'); });
    if (railFechada && !agS.feitoAberto) railFechada.classList.add('recolhida'); railFechada = null;
  });
  w.addEventListener('dragover', function(e){ var col = colDe(e); if (!col || !dragKey) return; if (agSoltar(dragKey, col.getAttribute('data-agcol'), true)){ e.preventDefault(); col.classList.add('drag-over'); } });
  w.addEventListener('dragleave', function(e){ var col = colDe(e); if (col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over'); });
  w.addEventListener('drop', function(e){ var col = colDe(e); if (!col || !dragKey) return; e.preventDefault(); var k2 = dragKey; dragKey = ''; col.classList.remove('drag-over'); railFechada = null; agSoltar(k2, col.getAttribute('data-agcol'), false); });
}
function agRender(){ return prComMemo(agRenderIn); }
function agRenderIn(){
  agMontarTela();
  var w = qs('agWrap'); if (!w) return;
  if (!agS.ref){ agS.ref = agHoje(); agS.mes = agHoje().slice(0, 7); agS.sel = agHoje(); }
  /* sub-abas padrão (Fase 2): Resumo, Semana, Mês, Lista e Quadro; a última usada fica lembrada */
  if (!agS.mdOk){ agS.mdOk = 1; if (agS.vista === 'semana') agS.vista = mdInicial('agenda', ['semana', 'mes', 'lista', 'quadro']); }
  var h = '<div id="agSeg">' + mdBarraHtml([['resumo', 'Resumo'], ['semana', 'Semana'], ['mes', 'Mês'], ['lista', 'Lista'], ['quadro', 'Quadro']], agS.vista, function(k){ return 'data-ag="vista" data-v="' + k + '"'; }) + '</div>' +
    '<div class="ini-acoes ag-acoes md-um"><button type="button" class="acao acao-ouro" data-ag="novo"><svg><use href="#ic-plus"/></svg><span>Novo compromisso</span></button></div>';
  if (agS.vista === 'resumo'){ w.innerHTML = h + '<div id="agCorpo">' + agCorpo() + '</div>'; return; }
  if (agS.vista !== 'quadro' && agS.filtro === 'alvara') agS.filtro = 'tudo';
  h += '<input type="search" id="agBusca" class="ag-busca" placeholder="Buscar compromisso, processo ou cliente" autocomplete="off" value="' + escapeHtml(agS.busca || '') + '" style="margin-top:8px">';
  var nf = agdFiltrosAtivos();
  h += '<div class="ag-filtros" style="margin-top:8px">' + [['tudo', 'Tudo'], ['prazo', 'Prazos'], ['audiencia', 'Audiências'], ['tarefa', 'Tarefas'], ['inicial', 'Iniciais']].concat(agS.vista === 'quadro' ? [['alvara', 'Alvarás']] : []).map(function(f){ return '<button type="button" class="ag-f' + (agS.filtro === f[0] ? ' on' : '') + '" data-ag="filtro" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') +
    '<button type="button" class="ag-f' + (nf ? ' tem' : '') + '" data-ag="flt">Filtros' + (nf ? ' · ' + nf : '') + '</button><button type="button" class="ag-f' + (agS.menu ? ' on' : '') + '" data-ag="menu" aria-label="Mais opções">⋯</button></div>';
  if (agS.menu) h += '<div class="ag-menu" style="margin-top:6px"><button type="button" class="ag-f" data-ag="rel">🖨 Relatório</button><button type="button" class="ag-f" data-ag="importar">📥 Importar do Control Jus</button></div>';
  h += '<div id="agCorpo">' + agCorpo() + '</div>';
  w.innerHTML = h;
}
function agCorpo(){
  if (agS.vista === 'resumo'){ try{ return mjPainel('agenda', mjAgenda()); }catch(e){ console.error('resumo da agenda', e); return '<div class="financeiro-vazio">Não consegui montar o resumo. As outras sub-abas continuam funcionando.</div>'; } }
  var todos = agS.vista === 'quadro' ? agItens({ quadro: true }).filter(function(i){ return agS.filtro === 'tudo' || i.cat === agS.filtro; }).sort(agOrdem) : agFiltrados(agItens()).sort(agOrdem), h = '';
  if (agS.vista === 'quadro') h += agVistaQuadro(todos);
  else if (agS.vista === 'semana') h += agVistaSemana(todos);
  else if (agS.vista === 'mes') h += agVistaMes(todos);
  else h += agVistaLista(todos);
  return h;
}
function agAbertosDoDia(l){ return (l || []).filter(function(i){ return !i.concluido; }); }
function agCarga(l){ var n = agAbertosDoDia(l).length; return n >= 4 ? ' n3' : (n >= 2 ? ' n2' : (n === 1 ? ' n1' : '')); }
function agBadge(l){ var n = agAbertosDoDia(l).length; return n ? '<em class="ag-n" title="' + n + (n === 1 ? ' compromisso' : ' compromissos') + '">' + n + '</em>' : ''; }
/* duas audiências no mesmo dia com menos de 1 hora de diferença: avisa */
function agConflitoHtml(l){
  var au = agAbertosDoDia(l).filter(function(i){ return i.tipo === 'audiencia' && /^\d{2}:\d{2}$/.test(i.hora || ''); }).sort(function(a, b){ return a.hora.localeCompare(b.hora); });
  var min = function(h){ return Number(h.slice(0, 2)) * 60 + Number(h.slice(3)); }, par = null;
  for (var x = 0; x + 1 < au.length && !par; x++) if (min(au[x + 1].hora) - min(au[x].hora) < 60) par = [au[x], au[x + 1]];
  return par ? '<div class="ag-conf">⚠ <span>Duas audiências em horários próximos: ' + escapeHtml(par[0].hora) + ' e ' + escapeHtml(par[1].hora) + '. Confira se dá tempo de ir de uma à outra.</span></div>' : '';
}
function agPorDia(l){ var m = {}; l.forEach(function(i){ (m[i.data] = m[i.data] || []).push(i); }); return m; }
function agPontos(l){
  var s = {}; l.forEach(function(i){ if (i.concluido) return; s[i.tipo === 'audiencia' ? 'au' : (i.tipo === 'tarefa' ? 'pe' : 'pr')] = 1; });
  return ['pr', 'au', 'pe'].filter(function(k){ return s[k]; }).map(function(k){ return '<s class="ag-p ' + k + '"></s>'; }).join('');
}
function agTrabalhos(l){   /* "trabalhar até" dos prazos: marcador dourado no dia */
  var m = {}; l.forEach(function(i){ if (!i.concluido && i.tipo === 'prazo' && i.trabalhar && i.trabalhar < i.data) (m[i.trabalhar] = m[i.trabalhar] || []).push(i); }); return m;
}
function agCabDia(iso){
  var f = agNomeFeriado(iso), rec = !f && pbRecesso(iso) && pbDow(iso) !== 0 && pbDow(iso) !== 6;
  var nome = PB_DIAS[pbDow(iso)]; nome = nome.charAt(0).toUpperCase() + nome.slice(1).split('-')[0];
  return '<div class="ag-dia' + (iso === agHoje() ? ' hoje' : '') + '" id="agd-' + iso + '">' + nome + ' · ' + fmtData(iso).slice(0, 5) + (iso === agHoje() ? ' · hoje' : '') + (f ? ' · ' + escapeHtml(f) + ' (sem expediente)' : '') + (rec ? ' · recesso: prazos suspensos' : '') + '</div>';
}
function agVistaSemana(todos){
  var ini = agIniSemana(agS.ref), dias = [], i;
  for (i = 0; i < 7; i++) dias.push(pbSoma(ini, i));
  var por = agPorDia(todos), trab = agTrabalhos(todos), hoje = agHoje();
  var h = '<div class="ag-nav"><button type="button" class="icon-btn" data-ag="nav" data-v="-1" aria-label="Semana anterior">‹</button><b>' + fmtData(dias[0]).slice(0, 5) + ' a ' + fmtData(dias[6]).slice(0, 5) + '</b><button type="button" class="icon-btn" data-ag="nav" data-v="1" aria-label="Próxima semana">›</button><button type="button" class="btn-text" data-ag="hoje">Hoje</button></div>';
  h += '<div class="ag-sem">' + dias.map(function(d){
    var dots = agPontos(por[d] || []) + (trab[d] ? '<s class="ag-p pe"></s>' : '') + (agNomeFeriado(d) ? '<s class="ag-p fe"></s>' : '');
    return '<button type="button" class="ag-d' + (d === agS.sel ? ' on' : '') + (d === hoje ? ' hoje' : '') + '" data-ag="dia" data-v="' + d + '"><span>' + AG_DOW[pbDow(d)] + '</span><b>' + d.slice(8, 10) + '</b>' + agBadge(por[d]) + '<i>' + dots + '</i></button>';
  }).join('') + '</div>';
  var atrasados = todos.filter(function(x){ return !x.concluido && x.data < hoje && x.tipo !== 'audiencia'; }), passadas = todos.filter(agPassada);
  var vazio = true;
  if (atrasados.length){ vazio = false; h += '<div class="ag-dia atr">Atrasado</div>' + atrasados.map(agCartao).join(''); }
  if (passadas.length){ vazio = false; h += '<div class="ag-dia atr">Audiências que passaram: foi realizada?</div>' + passadas.map(agCartao).join(''); }
  dias.forEach(function(d){
    var l = (por[d] || []).filter(function(x){ return !(x.data < hoje && !x.concluido); }), tr = trab[d] || [];
    if (!l.length && !tr.length && !agNomeFeriado(d)) return;
    vazio = false; h += agCabDia(d) + agConflitoHtml(l) + l.map(agCartao).join('') + tr.map(function(x){ return agCartaoTrabalho(x); }).join('');
  });
  if (vazio) h += '<div class="financeiro-vazio">Nada na agenda nesta semana.</div>';
  return h;
}
function agVistaMes(todos){
  var primeiro = agS.mes + '-01', ini = pbSoma(primeiro, -pbDow(primeiro)), por = agPorDia(todos), trab = agTrabalhos(todos), hoje = agHoje(), c = '', i, d;
  var mesTxt = AG_MESES[Number(agS.mes.slice(5, 7)) - 1];
  mesTxt = mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1) + ' ' + agS.mes.slice(0, 4);
  c += '<div class="ag-nav"><button type="button" class="icon-btn" data-ag="nav" data-v="-1" aria-label="Mês anterior">‹</button><b>' + mesTxt + '</b><button type="button" class="icon-btn" data-ag="nav" data-v="1" aria-label="Próximo mês">›</button><button type="button" class="btn-text" data-ag="hoje">Hoje</button></div>';
  c += '<div class="ag-mes">' + ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(function(x){ return '<div class="h">' + x + '</div>'; }).join('');
  for (i = 0; i < 42; i++){
    d = pbSoma(ini, i);
    var fora = d.slice(0, 7) !== agS.mes, fer = !!agNomeFeriado(d) || pbDow(d) === 0;
    c += '<button type="button" class="ag-c' + agCarga(por[d]) + (fora ? ' fora' : '') + (fer ? ' fer' : '') + (d === agS.sel ? ' on' : '') + (d === hoje ? ' hoje' : '') + '" data-ag="dia" data-v="' + d + '">' + Number(d.slice(8)) + agBadge(por[d]) + '<i>' + agPontos(por[d] || []) + (trab[d] ? '<s class="ag-p pe"></s>' : '') + (agNomeFeriado(d) ? '<s class="ag-p fe"></s>' : '') + '</i></button>';
  }
  c += '</div><div class="ag-leg"><span><s class="ag-p pr"></s>prazo</span><span><s class="ag-p pe"></s>tarefa / trabalhar até</span><span><s class="ag-p au"></s>audiência</span><span><s class="ag-p fe"></s>feriado (TJGO)</span></div>';
  var l = por[agS.sel] || [], tr = trab[agS.sel] || [];
  c += agCabDia(agS.sel) + agConflitoHtml(l) + (l.length || tr.length ? l.map(agCartao).join('') + tr.map(function(x){ return agCartaoTrabalho(x); }).join('') : '<div class="financeiro-vazio">Nada neste dia.</div>');
  return c;
}
function agVistaLista(todos){
  var hoje = agHoje(), h = '', atr = todos.filter(function(x){ return !x.concluido && x.data < hoje && x.tipo !== 'audiencia'; }), futuros = todos.filter(function(x){ return !x.concluido && !(x.data < hoje); }), feitos = todos.filter(function(x){ return x.concluido; }).sort(function(a, b){ return agOrdem(b, a); });
  if (atr.length) h += '<div class="ag-dia atr">Atrasado</div>' + atr.map(agCartao).join('');
  var pas = todos.filter(agPassada);
  if (pas.length) h += '<div class="ag-dia atr">Audiências que passaram: foi realizada?</div>' + pas.map(agCartao).join('');
  var ult = '';
  futuros.slice(0, 80).forEach(function(i){ if (i.data !== ult){ ult = i.data; h += agCabDia(i.data) + agConflitoHtml(futuros.filter(function(x){ return x.data === i.data; })); } h += agCartao(i); });
  if (futuros.length > 80) h += '<div class="saldo-data">Mostrando os 80 primeiros. Use o mês ou a semana para ver os demais.</div>';
  if ((agS.sit || 'abertos') !== 'abertos' && feitos.length) h += '<div class="ag-dia">Concluídos e cancelados</div>' + feitos.slice(0, 30).map(agCartao).join('');
  if (!atr.length && !pas.length && !futuros.length && !((agS.sit || 'abertos') !== 'abertos' && feitos.length)) h += '<div class="financeiro-vazio">Nada na agenda. Toque em “+ Novo” ou confirme prazos nas Publicações.</div>';
  return h;
}
function agTipoLinha(i){
  if (i.tipo === 'audiencia') return 'Audiência ' + fmtData(i.data).slice(0, 5) + (i.hora ? ' · ' + i.hora : '') + (i.audTipo ? ' · ' + i.audTipo : '');
  if (i.tipo === 'tarefa') return 'Fazer até ' + fmtData(i.data).slice(0, 5);
  return 'Prazo fatal ' + fmtData(i.data).slice(0, 5) + (!i.concluido && i.trabalhar && i.trabalhar < i.data ? ' · trabalhar até ' + fmtData(i.trabalhar).slice(0, 5) : '');
}
function agCartao(i){
  var c = agChip(i), cls = i.concluido ? 'ok' : (i.tipo === 'audiencia' ? 'au' : (i.tipo === 'tarefa' ? 'pe' : 'pr')), v = i.processo ? pbVinculo(i.processo) : null, k = escapeHtml(i.key), d = i.doc || {}, tags = '';
  if (i.situacao === 'elaboracao') tags += '<span class="pb-tg pz">Em andamento</span>';
  if (/alta/i.test(d.prioridade || '')) tags += '<span class="pb-tg pz">Prioridade alta</span>';
  if (i.tipo === 'audiencia' && i.modalidade) tags += '<span class="pb-tg">' + escapeHtml(AG_MODAL[i.modalidade] || i.modalidade) + '</span>';
  if (i.processo && !v) tags += '<span class="pb-tg">processo não cadastrado</span>';
  if (i.tipo === 'audiencia' && !i.concluido && /^https?:\/\//i.test(i.link || '')) tags += '<a class="pb-tg nv" data-ag="link" href="' + escapeHtml(i.link) + '" target="_blank" rel="noopener noreferrer">Entrar na sala ↗</a>';
  if (i.pubId) tags += '<span class="pb-tg nv">via publicação</span>';
  if (i.fonte === 'caso') tags += '<span class="pb-tg">da inicial</span>';
  if (i.concluido && !i.cancelado && i.tipo === 'prazo' && i.protocoladoEm) tags += '<span class="pb-tg ok">Protocolada em ' + escapeHtml(fmtData(i.protocoladoEm)) + '</span>';
  (Array.isArray(d.responsaveis) ? d.responsaveis : []).slice(0, 3).forEach(function(n){ tags += '<span class="agc-av" title="' + escapeHtml(n) + '">' + escapeHtml(agdSigla(n)) + '</span>'; });
  var ok = i.fonte === 'alvara' ? '' : '<button type="button" class="agc-ok' + (i.concluido ? ' on' : '') + '" data-ag="' + (i.concluido ? 'reabrir' : 'concluir') + '" data-k="' + k + '" aria-label="' + (i.concluido ? 'Reabrir' : (i.tipo === 'prazo' ? 'Marcar protocolada' : (i.tipo === 'audiencia' ? 'Marcar como realizada' : 'Concluir'))) + '" title="' + (i.concluido ? 'Reabrir' : (i.tipo === 'prazo' ? 'Marcar protocolada' : 'Concluir')) + '">✓</button>';
  return '<div class="agc ' + cls + '" data-ag="det" data-k="' + k + '"><div style="min-width:0"><div class="agc-top"><span>' + escapeHtml(i.tipo === 'prazo' ? 'Prazo fatal ' + fmtData(i.data).slice(0, 5) : agTipoLinha(i)) + '</span><span class="est est-' + c.c + '">' + escapeHtml(c.t) + '</span></div><div class="agc-t">' + escapeHtml(i.titulo) + '</div>' +
    (i.cliente ? '<div class="agc-s">' + escapeHtml(i.cliente) + '</div>' : '') +
    (i.tipo === 'audiencia' && i.local ? '<div class="agc-s">📍 ' + escapeHtml(i.local) + '</div>' : '') +
    (i.processo ? '<div class="agc-n"><span>' + escapeHtml(i.processo) + '</span><button type="button" class="agc-cp" data-ag="copiar" data-n="' + escapeHtml(i.processo) + '" aria-label="Copiar o número do processo" title="Copiar o número">' + AGD_COPIA + '</button></div>' : '') +
    '<div class="agc-tg">' + tags + '</div></div>' + ok + '</div>';
}
function agCartaoTrabalho(i){
  return '<div class="ag-it pe"><div class="pb-l1"><span>Dia de trabalhar na peça</span><span class="est est-breve">interno</span></div><div class="pb-cli">' + escapeHtml(i.titulo) + '</div><div class="pb-proc">Prazo fatal ' + fmtData(i.data).slice(0, 5) + (i.cliente ? ' · ' + escapeHtml(i.cliente) : '') + '</div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-ag="abrir" data-k="' + escapeHtml(i.key) + '">Abrir prazo</button></div></div>';
}

/* ---------- Quadro (Kanban geral: prazos, audiências, tarefas, prazos das Iniciais e previsões dos Alvarás) ---------- */
var AG_ICO = { prazo: ['scale', '#D93B3B'], audiencia: ['user', '#2A78D6'], tarefa: ['check', '#C98500'], inicial: ['doc', '#B7791E'], alvara: ['bank', '#2A78D6'] };
function agColunas(todos){
  var hoje = agHoje(), iniSem = agIniSemana(hoje), fimSem = pbSoma(iniSem, 6), fimProx = pbSoma(fimSem, 7), recente = pbSoma(hoje, -30), cols;
  if (agS.quadro === 'situacao'){
    cols = [{ k: 'afazer', t: 'A fazer', ic: 'list', l: [] }, { k: 'elaboracao', t: 'Em andamento', ic: 'doc', l: [] }, { k: 'acomp', t: 'Acompanhando', ic: 'user', l: [] }, { k: 'feito', t: 'Concluído', ic: 'check', l: [] }];
    todos.forEach(function(i){
      if (i.concluido){ if (i.data >= recente) cols[3].l.push(i); }
      else if (i.fonte !== 'agenda') cols[2].l.push(i);
      else if (i.situacao === 'elaboracao') cols[1].l.push(i);
      else cols[0].l.push(i);
    });
  } else {
    cols = [{ k: 'atrasado', t: 'Atrasado', ic: 'alert', l: [] }, { k: 'hoje', t: 'Hoje', ic: 'clip', l: [] }, { k: 'semana', t: 'Esta semana', ic: 'list', l: [] }, { k: 'proxima', t: 'Próxima semana', ic: 'list', l: [] }, { k: 'adiante', t: 'Mais adiante', ic: 'list', l: [] }, { k: 'feito', t: 'Concluídos', ic: 'check', l: [] }];
    todos.forEach(function(i){
      if (i.concluido){ if (i.data >= recente) cols[5].l.push(i); return; }
      if (i.data < hoje) cols[0].l.push(i);   /* inclui audiência que passou e ainda não foi marcada como realizada */
      else if (i.data === hoje) cols[1].l.push(i);
      else if (i.data <= fimSem) cols[2].l.push(i);
      else if (i.data <= fimProx) cols[3].l.push(i);
      else cols[4].l.push(i);
    });
  }
  cols.forEach(function(c){ c.l.sort(c.k === 'feito' ? function(a, b){ return agOrdem(b, a); } : agOrdem); });
  return cols;
}
function agCartaoQuadro(i){
  var c = agChip(i), ic = AG_ICO[i.cat] || AG_ICO.prazo, sit = agS.quadro === 'situacao', k = escapeHtml(i.key), tags = '', btn = '';
  tags += '<span class="est est-' + c.c + '">' + escapeHtml(c.t) + '</span>';
  if (i.fonte === 'caso') tags += '<span class="fv-chip">Inicial' + (i.faseTxt ? ' · ' + escapeHtml(i.faseTxt) : '') + '</span>';
  else if (i.fonte === 'alvara') tags += '<span class="fv-chip">Alvará' + (i.faseTxt ? ' · ' + escapeHtml(i.faseTxt) : '') + '</span>';
  else tags += '<span class="fv-chip">' + (i.tipo === 'audiencia' ? 'Audiência' : (i.tipo === 'tarefa' ? 'Tarefa' : AG_SITUACAO[i.situacao])) + '</span>';
  if (!i.concluido){
    if (i.fonte === 'alvara') btn += '<button type="button" class="btn btn-primary pb-b" data-ag="acao" data-k="' + k + '">Abrir alvará</button>';
    else if (sit && i.fonte === 'agenda' && i.tipo !== 'audiencia' && i.situacao === 'afazer') btn += '<button type="button" class="btn btn-primary pb-b" data-ag="mover" data-k="' + k + '" data-v="elaboracao">Avançar ›</button>';
    else btn += '<button type="button" class="btn btn-primary pb-b" data-ag="concluir" data-k="' + k + '">' + (i.tipo === 'prazo' ? 'Marcar protocolada' : (i.tipo === 'audiencia' ? 'Realizada' : 'Concluir')) + '</button>';
    if (sit && i.fonte === 'agenda' && i.tipo !== 'audiencia' && i.situacao === 'elaboracao') btn += '<button type="button" class="btn btn-ghost pb-b" data-ag="mover" data-k="' + k + '" data-v="afazer">‹ Voltar</button>';
    btn += '<button type="button" class="btn btn-ghost pb-b" data-ag="adiar" data-k="' + k + '">Adiar</button>';
    if (i.fonte === 'caso') btn += '<button type="button" class="btn-text pb-b" data-ag="acao" data-k="' + k + '">Abrir na aba Iniciais</button>';
    else if (i.fonte === 'agenda') btn += '<button type="button" class="btn-text pb-b" data-ag="abrir" data-k="' + k + '">Editar</button>';
  } else if (i.fonte !== 'alvara') btn += '<button type="button" class="btn btn-ghost pb-b" data-ag="reabrir" data-k="' + k + '">Reabrir</button>';
  return '<div class="kanban-card ag-kc ' + i.cat + (i.concluido ? ' ok' : '') + '" data-agcard="' + k + '" draggable="true"><div class="kc-top">' + fvIc(ic[0], ic[1]) + '<div class="kc-tit"><div class="kc-nome">' + escapeHtml(i.titulo) + '</div><div class="kc-sub">' + escapeHtml((i.cliente || '') + (i.cliente && i.processo ? ' · ' : '') + (i.processo || '')) + '</div></div></div>' +
    '<div class="kc-sub" style="margin-top:6px">' + escapeHtml(agTipoLinha(i)) + '</div>' + (i.tipo === 'audiencia' && i.local ? '<div class="kc-sub">📍 ' + escapeHtml(i.local) + '</div>' : '') + (i.concluido && i.tipo === 'prazo' && i.protocoladoEm ? '<div class="kc-sub">Protocolada em ' + escapeHtml(fmtData(i.protocoladoEm)) + '</div>' : '') + '<div class="kc-chips">' + tags + '</div><div class="kc-acoes">' + btn + (i.tipo === 'audiencia' && /^https?:\/\//i.test(i.link) ? '<a class="btn btn-ghost pb-b" href="' + escapeHtml(i.link) + '" target="_blank" rel="noopener noreferrer">Entrar na sala ↗</a>' : '') + '</div></div>';
}
/* solta um cartão do Quadro numa coluna: devolve se pode; com teste = true só confere, sem mudar nada */
function agSoltar(key, ck, teste){
  var i = agItens({ quadro: true }).filter(function(x){ return x.key === key; })[0]; if (!i) return false;
  var alvo = ck === 'feito' ? 'feito' : ((agS.quadro === 'situacao' && (ck === 'afazer' || ck === 'elaboracao')) ? ck : '');
  if (!alvo || i.fonte === 'alvara') return false;
  if (alvo !== 'feito' && (i.fonte !== 'agenda' || i.tipo === 'audiencia')) return false;   /* “Em andamento” não existe para audiência nem para prazo vindo das Iniciais */
  if (alvo === 'feito' ? (i.concluido && !i.cancelado) : (!i.concluido && i.situacao === alvo)) return false;   /* já está lá */
  if (teste) return true;
  agdSituacao(i, alvo); return true;
}
function agVistaQuadro(todos){
  var cols = agColunas(todos), h = '<div class="pb-seg-lin"><div class="segmented" id="agModo">' + [['urgencia', 'Por urgência'], ['situacao', 'Por situação']].map(function(f){ return '<button type="button" class="seg-btn' + (agS.quadro === f[0] ? ' active' : '') + '" data-ag="modo" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div></div>';
  h += '<div class="ag-dica">' + (agS.quadro === 'situacao' ? 'Arraste um cartão entre as colunas para mudar a situação (A fazer, Em andamento, Concluído).' : 'Arraste um cartão para Concluído para marcar como feito. Para mudar a data de um prazo, use “Adiar”.') + '</div>';
  h += '<div class="kanban-wrap ag-quadro">' + cols.map(function(c){
    var rail = agS.quadro !== 'situacao' && c.k === 'feito';
    return '<div class="kanban-col ag-col-' + c.k + (rail && !agS.feitoAberto ? ' recolhida' : '') + '" data-agcol="' + c.k + '"' + (rail ? ' data-ag="feito-toggle" title="' + (agS.feitoAberto ? 'Recolher' : 'Abrir') + ' a coluna Concluído"' : '') + '><div class="kanban-col-head"><h4>' + rsIconeColuna(c.t) + ' ' + escapeHtml(c.t) + ' <span class="fv-chip">' + c.l.length + '</span></h4></div>' +
      (c.l.length ? c.l.map(agCartaoQuadro).join('') : '<div class="kanban-vazio">Nada aqui.</div>') + '</div>';
  }).join('') + '</div>';
  if (!todos.length) h += '<div class="financeiro-vazio">Nada na agenda para este filtro.</div>';
  return h;
}
function agMover(key, destino){
  var i = agItens({ quadro: true }).filter(function(x){ return x.key === key; })[0]; if (!i) return;
  if (i.fonte === 'caso'){ if (destino === 'feito') agConcluir(key, true); return; }
  if (i.fonte !== 'agenda') return;
  var doc = Object.assign({}, i.doc, { situacao: destino, concluido: destino === 'feito', cancelado: false, concluidoEm: destino === 'feito' ? agHoje() : '' }); delete doc.id;
  pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'PUT', doc).then(function(){ Object.assign(i.doc, doc); agDepois(); }).catch(function(e){ toast('Não consegui salvar: ' + e.message); });
}
var agAdiarKey = null;
function agAdiar(key){
  var i = agItens({ quadro: true }).filter(function(x){ return x.key === key; })[0]; if (!i) return;
  if (!qs('overlayAgAdiar')){
    var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAgAdiar';
    d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Adiar</h2><button class="icon-btn" id="agaX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body"><div class="parcela-sum" id="agaInfo"></div><div class="field"><label class="field-label" for="aga_data">Nova data</label><input type="date" id="aga_data"></div><div class="form-error" id="aga_erro"></div><button type="button" class="btn btn-primary" id="agaOk" style="width:100%;justify-content:center;">Salvar nova data</button></div></div>';
    document.body.appendChild(d); adAbrirData(qs('aga_data'));
    d.addEventListener('click', function(e){ if (e.target === d || (e.target.closest && e.target.closest('#agaX'))) d.classList.remove('show'); });
    qs('agaOk').addEventListener('click', agAdiarSalvar);
  }
  agAdiarKey = key; qs('agaInfo').textContent = i.titulo + (i.cliente ? ' · ' + i.cliente : '') + ' — data atual ' + fmtData(i.data) + (i.fonte === 'caso' ? ' (prazo da inicial)' : (i.fonte === 'alvara' ? ' (previsão de levantamento)' : '')); qs('aga_data').value = pbSoma(i.data < agHoje() ? agHoje() : i.data, 1); qs('aga_erro').textContent = '';
  qs('overlayAgAdiar').classList.add('show');
}
function agAdiarSalvar(){
  var i = agItens({ quadro: true }).filter(function(x){ return x.key === agAdiarKey; })[0], nova = qs('aga_data').value; if (!i) return;
  if (!nova){ qs('aga_erro').textContent = 'Escolha a nova data.'; return; }
  function ok(msg){ qs('overlayAgAdiar').classList.remove('show'); toast(msg || 'Data alterada para ' + fmtData(nova) + '.'); setTimeout(agDepois, 350); }
  if (i.fonte === 'caso'){ persistPatch(i.caso, { prazo: Object.assign({}, i.caso.prazo, { data: nova, concluido: false }) }); ok(); return; }
  if (i.fonte === 'alvara'){ persistPatchAlvara(i.alvara, { previsaoLevantamento: nova }); ok(); return; }
  var doc = Object.assign({}, i.doc, { data: nova }); delete doc.id;
  if (i.tipo === 'prazo'){ var auto = agAntesUteis(nova, 2); doc.trabalhar = (auto >= agHoje() && auto < nova) ? auto : ''; }
  pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'PUT', doc).then(function(){ Object.assign(i.doc, doc); agDepois(); ok(); }).catch(function(e){ qs('aga_erro').textContent = 'Não consegui salvar: ' + e.message; });
}

/* ---------- criar, editar, concluir ---------- */
/* prazo concluído = peça protocolada: pergunta a data do protocolo (pode ser de outro dia) */
function agPerguntarProtocolo(key){
  var i = agItens().filter(function(x){ return x.key === key; })[0]; if (!i) return;
  if (!qs('overlayAgProt')){
    var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAgProt';
    d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Peça protocolada</h2><button class="icon-btn" id="agpX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body"><div class="parcela-sum" id="agpInfo"></div><div class="field"><label class="field-label" for="agp_data">Data do protocolo</label><input type="date" id="agp_data"></div><div class="field"><label class="field-label" for="agp_obs">Observação (opcional)</label><input type="text" id="agp_obs" maxlength="120" placeholder="Ex.: protocolo nº 123, juntado no evento 45"></div><div class="form-error" id="agp_erro"></div><button type="button" class="btn btn-primary" id="agpOk" style="width:100%;justify-content:center;">Confirmar protocolo</button></div></div>';
    document.body.appendChild(d); adAbrirData(qs('agp_data'));
    d.addEventListener('click', function(e){ if (e.target === d || (e.target.closest && e.target.closest('#agpX'))) d.classList.remove('show'); });
    qs('agpOk').addEventListener('click', function(){
      var data = qs('agp_data').value; if (!data){ qs('agp_erro').textContent = 'Escolha a data do protocolo.'; return; }
      if (data > agHoje()){ qs('agp_erro').textContent = 'A data do protocolo não pode ser no futuro.'; return; }
      qs('overlayAgProt').classList.remove('show'); agConcluir(qs('overlayAgProt').getAttribute('data-k'), true, { data: data, obs: qs('agp_obs').value.trim() });
    });
  }
  qs('overlayAgProt').setAttribute('data-k', key);
  qs('agpInfo').textContent = i.titulo + (i.cliente ? ' · ' + i.cliente : '') + ' — prazo fatal ' + fmtData(i.data);
  qs('agp_data').value = agHoje(); qs('agp_obs').value = ''; qs('agp_erro').textContent = '';
  qs('overlayAgProt').classList.add('show');
}
function agConcluir(key, feito, prot){
  var i = agItens().filter(function(x){ return x.key === key; })[0]; if (!i) return;
  if (feito && i.tipo === 'prazo' && !prot){ agPerguntarProtocolo(key); return; }
  var extra = (feito && prot) ? { protocoladoEm: prot.data, protocoloObs: prot.obs || '' } : { protocoladoEm: '', protocoloObs: '' };
  if (i.fonte === 'caso'){
    persistPatch(i.caso, { prazo: Object.assign({}, i.caso.prazo, { concluido: feito }, extra) });
    setTimeout(function(){ agDepois(); }, 400); toast(feito ? 'Prazo concluído.' : 'Prazo reaberto.'); return;
  }
  var doc = Object.assign({}, i.doc, { concluido: feito, cancelado: false, situacao: feito ? 'feito' : 'afazer', concluidoEm: feito ? agHoje() : '' }, i.tipo === 'prazo' ? extra : {}); delete doc.id;
  pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'PUT', doc).then(function(){ Object.assign(i.doc, doc); agDepois(); toast(feito ? (i.tipo === 'prazo' ? 'Prazo marcado como protocolado.' : 'Concluído.') : 'Reaberto.'); }).catch(function(e){ toast('Não consegui salvar: ' + e.message); });
}
function agMontarEd(){
  if (qs('overlayAg')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAg';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="agEdTit">Novo item da agenda</h2><button class="icon-btn" id="agEdX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="agEdCorpo"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#agEdX'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-age]') : null; if (!b) return;
    var a = b.getAttribute('data-age');
    if (a === 'tipo'){ agEditTipo = b.getAttribute('data-v'); agAjustarCampos(); Array.prototype.forEach.call(d.querySelectorAll('[data-age="tipo"]'), function(x){ x.classList.toggle('active', x === b); }); }
    else if (a === 'salvar') agSalvarEd();
    else if (a === 'excluir') agExcluirEd(b);
  });
  d.addEventListener('change', function(e){ if (e.target && e.target.id === 'age_sit') agAjustarCampos(); });
  d.addEventListener('input', function(e){
    if (e.target && e.target.id === 'age_sit') agAjustarCampos();
    if (e.target && e.target.id === 'age_proc'){
      var v = pbVinculo(e.target.value), dica = qs('age_dica'); if (dica) dica.textContent = v ? '✓ ' + v.cadastro + ' · cliente: ' + v.cliente : '';
      if (v && !qs('age_cli').value.trim()) qs('age_cli').value = v.cliente;
    }
  });
}
function agAjustarCampos(){
  var t = agEditTipo, rot = { prazo: 'Peça / o que fazer', audiencia: 'Assunto da audiência', tarefa: 'Tarefa' };
  qs('age_tit_l').textContent = rot[t]; qs('age_data_l').textContent = t === 'prazo' ? 'Prazo fatal' : (t === 'audiencia' ? 'Data da audiência' : 'Fazer até');
  qs('age_hora_box').style.display = t === 'audiencia' ? '' : 'none'; qs('age_trab_box').style.display = t === 'prazo' ? '' : 'none';
  qs('age_sit_box').style.display = t === 'audiencia' ? 'none' : '';
  qs('age_aud_box').style.display = t === 'audiencia' ? '' : 'none';
  qs('age_prot_box').style.display = (t === 'prazo' && qs('age_sit').value === 'feito') ? '' : 'none';
  qs('age_data').closest('.pb-dois').style.gridTemplateColumns = t === 'audiencia' ? '1fr 1fr' : '1fr';
}
function agPresetAvisos(a){ var s = JSON.stringify(a || AG_PADRAO); return s === '[1,0]' ? 'umdia' : (s === '[0]' ? 'dia' : (s === '[]' ? 'nenhum' : 'padrao')); }
function agAbrir(key, pre){
  agMontarEd();
  var i = key ? agItens().filter(function(x){ return x.key === key; })[0] : null; if (key && !i) return;
  var P = (!i && pre) ? pre : null; agEditPre = P;
  var V = function(k){ return i ? (i[k] || '') : (P ? (P[k] || '') : ''); };
  agEditKey = key || null; agEditTipo = i ? i.tipo : (P && P.tipo ? P.tipo : 'prazo');
  var caso = i && i.fonte === 'caso', sit = i ? i.situacao : 'afazer';
  var h = '<div class="segmented" id="age_seg"' + (i ? ' style="display:none"' : '') + '>' + ['prazo', 'audiencia', 'tarefa'].map(function(t){ return '<button type="button" class="seg-btn' + (agEditTipo === t ? ' active' : '') + '" data-age="tipo" data-v="' + t + '">' + AG_TIPOS[t] + '</button>'; }).join('') + '</div>';
  if (caso) h += '<div class="parcela-sum">Este prazo é da inicial <b>' + escapeHtml(i.cliente) + '</b>. Aqui você muda a data e a situação; o texto se edita na própria ação.</div>';
  h += '<div class="field"' + (caso ? ' style="display:none"' : '') + '><label class="field-label" id="age_tit_l" for="age_tit">Peça</label><input type="text" id="age_tit" maxlength="90" value="' + escapeHtml(V('titulo')) + '" placeholder="Ex.: Contestação"></div>' +
    '<div class="field"' + (caso ? ' style="display:none"' : '') + '><label class="field-label" for="age_proc">Processo (opcional)</label><input type="text" id="age_proc" maxlength="40" value="' + escapeHtml(V('processo')) + '" placeholder="0000000-00.0000.0.00.0000"><div class="saldo-data" id="age_dica"></div></div>' +
    '<div class="field"' + (caso ? ' style="display:none"' : '') + '><label class="field-label" for="age_cli">Cliente / partes</label><input type="text" id="age_cli" maxlength="90" value="' + escapeHtml(V('cliente')) + '"></div>' +
    '<div class="pb-dois"><div class="field"><label class="field-label" id="age_data_l" for="age_data">Prazo fatal</label><input type="date" id="age_data" value="' + escapeHtml(V('data')) + '"></div><div class="field" id="age_hora_box"><label class="field-label" for="age_hora">Hora</label><input type="time" id="age_hora" value="' + escapeHtml(V('hora')) + '"></div></div>' +
    '<div id="age_aud_box"><div class="pb-dois"><div class="field"><label class="field-label" for="age_audtipo">Tipo da audiência</label><select id="age_audtipo" class="filter-select" style="width:100%"><option value="">Não informado</option>' + AG_AUDS.map(function(t){ return '<option' + (V('audTipo') === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div><div class="field"><label class="field-label" for="age_mod">Modalidade</label><select id="age_mod" class="filter-select" style="width:100%"><option value="">Não informada</option>' + Object.keys(AG_MODAL).map(function(k){ return '<option value="' + k + '"' + (V('modalidade') === k ? ' selected' : '') + '>' + AG_MODAL[k] + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="field"><label class="field-label" for="age_local">Local</label><input type="text" id="age_local" maxlength="140" value="' + escapeHtml(V('local')) + '" placeholder="Ex.: Fórum de Morrinhos, sala 2"></div>' +
    '<div class="field"><label class="field-label" for="age_link">Link da sala virtual (opcional)</label><input type="text" inputmode="url" autocapitalize="off" id="age_link" maxlength="300" value="' + escapeHtml(V('link')) + '" placeholder="https://…"></div></div>' +
    '<div class="field"><label class="field-label" for="age_obs">Observações (opcional)</label><textarea id="age_obs" maxlength="1200" rows="3" style="width:100%">' + escapeHtml(V('obs')) + '</textarea></div>' +
    '<div class="field" id="age_trab_box"' + (caso ? ' style="display:none"' : '') + '><label class="field-label" for="age_trab">Trabalhar na peça até (opcional)</label><input type="date" id="age_trab" value="' + escapeHtml(i ? i.trabalhar : '') + '"><div class="saldo-data">Em branco, o app marca 2 dias úteis antes do prazo fatal.</div></div>' +
    '<div class="field" id="age_sit_box"><label class="field-label" for="age_sit">Situação</label><select id="age_sit" class="filter-select" style="width:100%"><option value="afazer"' + (sit === 'afazer' ? ' selected' : '') + '>A fazer</option>' + (caso ? '' : '<option value="elaboracao"' + (sit === 'elaboracao' ? ' selected' : '') + 'Em andamento</option>') + '<option value="feito"' + (sit === 'feito' ? ' selected' : '') + '>Concluído (protocolado)</option></select></div>' +
    '<div class="field" id="age_prot_box" style="display:none"><label class="field-label" for="age_protoc">Data do protocolo</label><input type="date" id="age_protoc" value="' + escapeHtml(V('protocoladoEm') || agHoje()) + '"></div>' +
    '<div class="field"' + (caso ? ' style="display:none"' : '') + '><label class="field-label" for="age_av">Avisar no celular</label><select id="age_av" class="filter-select" style="width:100%">' + [['padrao', '5, 2 e 1 dia antes + no dia'], ['umdia', '1 dia antes + no dia'], ['dia', 'só no dia'], ['nenhum', 'não avisar']].map(function(o){ return '<option value="' + o[0] + '"' + (agPresetAvisos(i ? i.avisos : null) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
    '<div class="form-error" id="age_erro"></div><button type="button" class="btn btn-primary" data-age="salvar" style="width:100%;justify-content:center;">Salvar na agenda</button>' +
    (i && !caso ? '<button type="button" class="btn-text" data-age="excluir" style="color:var(--urgente)">Excluir este item</button>' : '');
  qs('agEdCorpo').innerHTML = h; qs('agEdTit').textContent = i ? (caso ? 'Prazo da inicial' : 'Editar item') : 'Novo item da agenda';
  adAbrirData(qs('age_data')); adAbrirData(qs('age_trab')); adAbrirData(qs('age_protoc'));
  agAjustarCampos(); if (i && !caso) qs('age_proc').dispatchEvent(new Event('input', { bubbles: true }));
  qs('overlayAg').classList.add('show');
}
function agSalvarEd(){
  var t = agEditTipo, tit = qs('age_tit').value.trim(), data = qs('age_data').value, err = qs('age_erro');
  var i = agEditKey ? agItens().filter(function(x){ return x.key === agEditKey; })[0] : null, caso = i && i.fonte === 'caso';
  if (!caso && !tit){ err.textContent = 'Escreva o que precisa ser feito.'; return; }
  if (!data){ err.textContent = 'Escolha a data.'; return; }
  var sit = t === 'audiencia' ? (i && i.concluido ? 'feito' : 'afazer') : qs('age_sit').value;
  if (caso){
    persistPatch(i.caso, { prazo: Object.assign({}, i.caso.prazo, { data: data, concluido: sit === 'feito' }) });
    qs('overlayAg').classList.remove('show'); toast('Prazo atualizado.'); setTimeout(agDepois, 400); return;
  }
  var trab = t === 'prazo' ? qs('age_trab').value : '';
  if (t === 'prazo' && !trab){ var auto = agAntesUteis(data, 2); if (auto >= agHoje() && auto < data) trab = auto; }
  var av = { padrao: AG_PADRAO.slice(), umdia: [1, 0], dia: [0], nenhum: [] }[qs('age_av').value] || AG_PADRAO.slice();
  var link = t === 'audiencia' ? qs('age_link').value.trim() : '';
  if (link && !/^https?:\/\/\S+$/i.test(link)){ err.textContent = 'O link da sala virtual deve começar com https://'; return; }
  var base = i ? Object.assign({}, i.doc) : { criadoEm: new Date().toISOString(), pubId: '', audPubId: (agEditPre && agEditPre.audPubId) || '' }; delete base.id;
  var doc = Object.assign(base, { tipo: t, titulo: tit, processo: qs('age_proc').value.trim(), cliente: qs('age_cli').value.trim(), data: data, hora: t === 'audiencia' ? qs('age_hora').value : '', trabalhar: trab, situacao: sit, concluido: sit === 'feito', avisos: av,
    obs: qs('age_obs') ? qs('age_obs').value.trim() : (base.obs || ''), audTipo: t === 'audiencia' ? qs('age_audtipo').value : '', modalidade: t === 'audiencia' ? qs('age_mod').value : '', local: t === 'audiencia' ? qs('age_local').value.trim() : '', link: link });
  if (t === 'prazo'){ if (sit === 'feito'){ doc.protocoladoEm = qs('age_protoc').value || agHoje(); if (!doc.concluidoEm) doc.concluidoEm = agHoje(); } else { doc.protocoladoEm = ''; doc.protocoloObs = ''; } }
  var p = i ? pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'PUT', doc).then(function(){ doc.id = i.id; agDocs = agDocs.map(function(x){ return x.id === i.id ? doc : x; }); }) : agCriar(doc);
  p.then(function(){ qs('overlayAg').classList.remove('show'); toast('Salvo na agenda.'); agDepois(); }).catch(function(e){ err.textContent = 'Não consegui salvar: ' + e.message; });
}
function agExcluirEd(b){
  var i = agItens().filter(function(x){ return x.key === agEditKey; })[0]; if (!i) return;
  if (b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Toque de novo para excluir'; return; }
  pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'DELETE').then(function(){ agDocs = agDocs.filter(function(x){ return x.id !== i.id; }); qs('overlayAg').classList.remove('show'); toast('Item excluído.'); agDepois(); }).catch(function(e){ qs('age_erro').textContent = e.message; });
}

/* ---------- estilo e partida ---------- */
(function(){
  var st = document.createElement('style');
  st.textContent = '.ag-quadro{align-items:flex-start}@media(max-width:999px){.ag-quadro .kanban-col{min-width:250px}}@media(min-width:1000px){.ag-quadro .ag-col-feito.recolhida{flex:0 0 56px;min-width:56px;padding:12px 6px;cursor:pointer;align-items:center}.ag-quadro .ag-col-feito.recolhida .kanban-col-head h4{writing-mode:vertical-rl;transform:rotate(180deg);margin:0}.ag-quadro .ag-col-feito.recolhida .ag-kc,.ag-quadro .ag-col-feito.recolhida .kanban-vazio{display:none}}.ag-dica{font-size:var(--t2);color:var(--ink-soft);margin:0 2px 8px}.ag-kc[draggable=true]{cursor:grab}.ag-kc.arrastado{opacity:.45}.ag-kc.ok{opacity:.7}.ag-kc .kc-acoes{flex-wrap:wrap}.ag-col-atrasado .kanban-col-head h4{color:var(--urgente)}' +
    '.ag-dt{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 0;border-radius:12px;background:var(--surface-2);line-height:1.15}.ag-dt b{font-size:var(--t5)}.ag-dt span{font-size:var(--t1);font-weight:700;color:var(--ink-soft)}.ag-dt.atr{background:rgba(217,59,59,.12)}.ag-dt.atr b,.ag-dt.atr span{color:var(--urgente)}.ag-dt.hoje{background:rgba(183,121,30,.15)}.ag-dt.hoje b,.ag-dt.hoje span{color:var(--tutela)}' +
    '.ag-cartao{padding:14px 16px}.ag-cab{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.ag-tit{display:flex;align-items:center;gap:10px;font-size:var(--t4)}.ag-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}' +
    '.ag-lin{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--border);cursor:pointer}.ag-lin-tx{display:flex;flex-direction:column;min-width:0}.ag-lin-tx b{font-size:var(--t4);overflow-wrap:anywhere}.ag-lin-tx span{font-size:var(--t2);color:var(--ink-soft);overflow-wrap:anywhere}' +
    '.ag-rod{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:6px}.ag-filtros{display:flex;gap:6px;flex-wrap:wrap}' +
    '.ag-f{font-family:inherit;font-size:var(--t2);font-weight:600;padding:7px 12px;border-radius:99px;background:var(--surface);border:1px solid var(--border);color:var(--ink-soft);cursor:pointer}.ag-f.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}' +
    '.ag-nav{display:flex;align-items:center;justify-content:space-between;gap:8px}.ag-nav b{font-size:var(--t4)}' +
    '.ag-sem{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.ag-d{font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 0 5px;border-radius:12px;background:var(--surface);border:1px solid var(--border);color:var(--ink-soft);cursor:pointer}.ag-d span{font-size:var(--t1);text-transform:uppercase;font-weight:600}.ag-d b{font-size:var(--t5);color:var(--ink)}.ag-d.on{background:var(--ink);border-color:var(--ink);color:var(--bg)}.ag-d.on b{color:var(--bg)}.ag-d.hoje:not(.on){border-color:var(--accent)}' +
    '.ag-d i,.ag-c i{display:flex;gap:2px;justify-content:center;min-height:6px;font-style:normal}.ag-p{display:inline-block;width:5px;height:5px;border-radius:50%}.ag-p.pr{background:var(--urgente)}.ag-p.au{background:var(--info)}.ag-p.pe{background:var(--c-gold,#C98500)}.ag-p.fe{background:#9a9aa3}' +
    '.ag-d.on .ag-p.fe{background:#ddd}.ag-mes{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:10px}.ag-mes .h{text-align:center;font-size:var(--t1);font-weight:700;color:var(--ink-soft);padding:3px 0}' +
    '.ag-c{font-family:inherit;font-size:var(--t3);font-weight:600;padding:7px 0 4px;border-radius:10px;border:0;background:transparent;color:var(--ink);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px}.ag-c.fora{color:var(--ink-soft);opacity:.45}.ag-c.fer{color:var(--urgente)}.ag-c.on{background:var(--ink);color:var(--bg)}.ag-c.hoje:not(.on){box-shadow:inset 0 0 0 2px var(--accent)}' +
    '.ag-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:var(--t1);color:var(--ink-soft);font-weight:600}.ag-leg span{display:inline-flex;align-items:center;gap:5px}' +
    '.ag-dia{font-size:var(--t2);font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.5px;margin:6px 4px 0}.ag-dia.atr{color:var(--urgente)}.ag-dia.hoje{color:var(--accent)}' +
    '.ag-it{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:12px 14px 12px 17px;position:relative;overflow:hidden;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,.06))}.ag-it:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ag-c,#C4C4CB)}' +
    '.ag-it.pr{--ag-c:var(--urgente)}.ag-it.au{--ag-c:var(--info)}.ag-it.pe{--ag-c:var(--c-gold,#C98500)}.ag-it.ok{--ag-c:var(--success);opacity:.7}';
  document.head.appendChild(st);
  agCarregar();
})();
