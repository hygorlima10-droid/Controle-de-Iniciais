/* ============================================================
   AGENDA DE PRAZOS PROCESSUAIS, AUDIÊNCIAS E TAREFAS
   - separada da Central de atenção (que fica só com dinheiro)
   - junta o que você cadastra na Agenda, os prazos confirmados nas Publicações e os prazos que já existiam nas Iniciais
   - cartão "Prazos processuais" no Início e avisos no celular (5, 2 e 1 dia antes e no dia, configurável por item)
   ============================================================ */
var agDocs = [], agOk = false, agEditKey = null, agEditTipo = 'prazo';
var agS = { vista: 'semana', quadro: 'urgencia', filtro: 'tudo', ref: '', mes: '', sel: '', feitos: false, escopo: 'minha' };
try{ if (localStorage.getItem('horus.agendaEscopo') === 'escritorio') agS.escopo = 'escritorio'; }catch(e){}
var AG_PADRAO = [5, 2, 1, 0];
var AG_TIPOS = { prazo: 'Prazo', audiencia: 'Audiência', tarefa: 'Tarefa' };
var AG_MODAL = { presencial: 'Presencial', online: 'Online', hibrida: 'Híbrida' };
var AG_AUDS = ['Conciliação', 'Mediação', 'Instrução e julgamento', 'Justificação', 'Saneamento', 'Custódia', 'Admonitória', 'Outra'];
var agEditPre = null;
var AG_SITUACAO = { afazer: 'A fazer', elaboracao: 'Em andamento', pronta: 'Peça pronta', feito: 'Concluído', cancelado: 'Cancelado' };
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
/* dias úteis (sem sábado, domingo, feriado do TJGO e recesso) entre hoje e a data: positivo = faltam, negativo = passaram */
function agUteis(iso){ var h = agHoje(); if (iso === h) return 0; var sinal = iso > h ? 1 : -1, a = sinal > 0 ? h : iso, b = sinal > 0 ? iso : h, n = 0, d = a; while (d < b){ d = pbSoma(d, 1); if (!pbNaoUtil(d)) n++; } return n * sinal; }
function agUtilTxt(n){ return n + (n === 1 ? ' dia útil' : ' dias úteis'); }
function agProxUtil(iso){ var d = pbSoma(iso, 1); while (pbNaoUtil(d)) d = pbSoma(d, 1); return d; }
function agAbrevDia(iso){ return AG_DOW[pbDow(iso)] + ' ' + fmtData(iso).slice(0, 5); }
/* prazo aberto com "trabalhar até" antes do fatal: o cartão fica no dia de TRABALHAR (é quando se age); no dia fatal só uma linha fina de lembrete */
function agTemTrab(i){ return i.tipo === 'prazo' && !i.concluido && i.situacao !== 'pronta' && !!i.trabalhar && i.trabalhar < i.data; }   /* peça pronta: só falta protocolar, o cartão vai para o dia fatal */
function agDataAgir(i){ return agTemTrab(i) ? i.trabalhar : i.data; }
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
    l.push({ key: 'a:' + d.id, fonte: 'agenda', id: d.id, tipo: d.tipo || 'prazo', titulo: d.titulo || 'Prazo', cliente: d.cliente || '', processo: d.processo || '', data: d.data || '', hora: d.hora || '', trabalhar: d.trabalhar || '', situacao: d.cancelado ? 'cancelado' : (d.concluido ? 'feito' : (d.situacao || 'afazer')), concluido: !!d.concluido, cancelado: !!d.cancelado, pubId: d.pubId || d.audPubId || '', avisos: Array.isArray(d.avisos) ? d.avisos : AG_PADRAO.slice(), doc: d, cat: d.tipo || 'prazo', audTipo: d.audTipo || '', modalidade: d.modalidade || '', local: d.local || '', link: d.link || '', obs: d.obs || '', protocoladoEm: d.protocoladoEm || '', protocoloObs: d.protocoloObs || '', prontaEm: d.prontaEm || '', prontaPor: d.prontaPor || '' });
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
/* ---------- responsáveis e escopo (Fase 5, etapa 5.5) ----------
   `resp` do item guarda chaves de pessoas (OAB do advogado ou "u:<id>"). Item sem responsável gravado: vale o advogado do processo (o app sugere, e a revisão em lote grava). */
function agRespChaves(i){
  var d = i.doc || {};
  if (Array.isArray(d.resp) && d.resp.length) return d.resp.slice();
  var num = i.processo ? prNum(i.processo) : '', r = num ? prMapa().m[num] : null;
  if (r){ var ks = lgUnirAdvogados(r.links.filter(function(l){ return !l.doc.arquivado; }), r.doc).map(function(a){ return a.oab; }); if (ks.length) return ks; }
  if (!r && i.fonte === 'caso' && Array.isArray(d.advogados)) return d.advogados.map(function(a){ return a.oab; }).filter(Boolean);
  return [];
}
function agTemRespGravado(i){ return !!(i.doc && Array.isArray(i.doc.resp) && i.doc.resp.length); }
function agMinha(i){
  var eu = esS.eu; if (!eu) return true;
  var meus = esMinhasChaves(), d = i.doc || {}, rs = agRespChaves(i);
  if (rs.some(function(k){ return meus.indexOf(k) >= 0; })) return true;
  if (d.criadoPor && d.criadoPor === eu.id) return true;
  if (!d.criadoPor && eu.papel === 'proprietario' && !rs.length) return true;   // item antigo sem responsável: fica com o proprietário até a revisão
  if (!d.criadoPor && eu.papel === 'proprietario' && i.tipo === 'tarefa') return true;
  return false;
}
/* "Escritório": prazos e audiências de todos; tarefas só se compartilhadas, com responsáveis ou minhas (a tarefa pessoal de outra pessoa não aparece) */
function agEscritorioOk(i){ if (i.tipo !== 'tarefa') return true; var d = i.doc || {}; return d.compartilhada === true || agRespChaves(i).length > 0 || agMinha(i); }
function agEscopoLista(l){ if (!esS.eu) return l; return l.filter(agS.escopo === 'minha' ? agMinha : agEscritorioOk); }
function agRespAvatares(i, max){
  var ks = agRespChaves(i).slice(0, max || 3), cores = ['#C98500', '#2A78D6', '#17895A', '#8B5CF6', '#D93B3B'], h = '';
  ks.forEach(function(k, n){ var nm = esNomeChave(k); h += '<span class="agc-av" style="background:' + cores[n % cores.length] + ';color:#fff" title="' + escapeHtml(nm) + '">' + escapeHtml(agdSigla(nm)) + '</span>'; });
  return h;
}
function agOrdem(a, b){ return (a.data + (a.hora || '00:00')).localeCompare(b.data + (b.hora || '00:00')) || (a.tipo || '').localeCompare(b.tipo || ''); }
function agOrdemAgir(a, b){ return (agDataAgir(a) + (a.hora || '00:00')).localeCompare(agDataAgir(b) + (b.hora || '00:00')) || (a.tipo || '').localeCompare(b.tipo || '') || a.data.localeCompare(b.data); }
function agAbertos(){ return agItens().filter(function(i){ return !i.concluido; }).sort(agOrdem); }
function agChip(i){
  if (i.cancelado) return { t: 'Cancelado', c: 'neutro' };
  if (i.concluido) return { t: i.tipo === 'audiencia' ? 'Realizada' : 'Concluído', c: 'ok' };
  var d = agDias(i.data);
  if (i.tipo === 'prazo'){   /* prazo se conta em dias úteis */
    var u = agUteis(i.data);
    if (d < 0) return u < 0 ? { t: 'Venceu há ' + agUtilTxt(-u), c: 'atraso' } : { t: 'Atrasado há ' + (-d) + (d === -1 ? ' dia' : ' dias'), c: 'atraso' };
    if (d === 0) return { t: 'Hoje', c: 'atraso' };
    if (u >= 1) return { t: agUtilTxt(u), c: u <= 1 ? 'atraso' : (u <= 3 ? 'breve' : 'ok') };
  }
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
  return agAbertos().filter(function(i){ return i.data >= hoje && i.data <= lim; }).map(function(i){ return { d: i.data, h: i.hora || '', n: i.cliente || 'Sem nome', l: i.titulo, t: i.tipo, a: (i.situacao === 'pronta' ? i.avisos.filter(function(n){ return n <= 1; }) : i.avisos) }; });
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
    var ag0 = agDataAgir(i); if (ini && !(i.data >= ini && i.data <= fim) && !(ag0 >= ini && ag0 <= fim) && !(!i.concluido && ag0 < hoje && i.tipo !== 'audiencia')) return false;   /* o que está atrasado aparece sempre */
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
    else if (a === 'zap'){ var iz = agdItem(k); if (iz) agdZapAbrir(iz); }
    else if (a === 'pronta') agPronta(k);
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
  if (!agS.mdOk){ agS.mdOk = 1; if (agS.vista === 'semana') agS.vista = mdInicial('agenda', ['meudia', 'semana', 'mes', 'lista', 'quadro']); }
  var h = '<div id="agSeg">' + mdBarraHtml([['resumo', 'Resumo'], ['meudia', 'Meu dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['lista', 'Lista'], ['quadro', 'Quadro']], agS.vista, function(k){ return 'data-ag="vista" data-v="' + k + '"'; }) + '</div>' +
    '<div class="ini-acoes ag-acoes md-um"><button type="button" class="acao acao-ouro" data-ag="novo"><svg><use href="#ic-plus"/></svg><span>Novo compromisso</span></button></div>';
  if (agS.vista === 'resumo' || agS.vista === 'meudia'){ w.innerHTML = h + '<div id="agCorpo">' + agCorpo() + '</div>'; if (agS.vista === 'resumo') agCarregarCarga(); return; }
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
  if (agS.vista === 'meudia'){ try{ return agMeuDiaHtml(); }catch(e){ console.error('meu dia', e); return '<div class="financeiro-vazio">Não consegui montar o Meu dia. As outras sub-abas continuam funcionando.</div>'; } }
  var todos = agS.vista === 'quadro' ? agEscopoLista(agItens({ quadro: true })).filter(function(i){ return agS.filtro === 'tudo' || i.cat === agS.filtro; }).sort(agOrdem) : agFiltrados(agEscopoLista(agItens())).sort(agOrdemAgir), h = '';
  if (agS.vista === 'quadro') h += agVistaQuadro(todos);
  else if (agS.vista === 'semana') h += agVistaSemana(todos);
  else if (agS.vista === 'mes') h += agVistaMes(todos);
  else h += agVistaLista(todos);
  return h;
}
function agAbertosDoDia(l){ return (l || []).filter(function(i){ return !i.concluido; }); }
function agCarga(l){ var n = agAbertosDoDia(l).length; return n >= 4 ? ' n3' : (n >= 2 ? ' n2' : (n === 1 ? ' n1' : '')); }
function agBadge(l){ var n = agAbertosDoDia(l).length; return n ? '<em class="ag-n" title="' + n + (n === 1 ? ' compromisso' : ' compromissos') + '">' + n + '</em>' : ''; }
/* avisos do dia: audiências a menos de 1 hora uma da outra (por pessoa responsável) e prazo + audiência do mesmo processo no mesmo dia */
function agConflitoHtml(l){
  var ab = agAbertosDoDia(l), msgs = [], min = function(h){ return Number(h.slice(0, 2)) * 60 + Number(h.slice(3)); };
  var au = ab.filter(function(i){ return i.tipo === 'audiencia' && /^\d{2}:\d{2}$/.test(i.hora || ''); }).sort(function(a, b){ return a.hora.localeCompare(b.hora); }), generica = null;
  for (var x = 0; x < au.length; x++) for (var y = x + 1; y < au.length; y++){
    if (min(au[y].hora) - min(au[x].hora) >= 60) break;
    var cx = agRespChaves(au[x]), comuns = agRespChaves(au[y]).filter(function(k){ return cx.indexOf(k) >= 0; });
    if (comuns.length) msgs.push('<b>' + comuns.map(function(k){ return escapeHtml(esNomeChave(k)); }).join(' e ') + '</b> ' + (comuns.length > 1 ? 'têm' : 'tem') + ' duas audiências em horários próximos: ' + escapeHtml(au[x].hora) + ' e ' + escapeHtml(au[y].hora) + '. Confira se dá tempo de ir de uma à outra.');
    else if (!generica) generica = 'Duas audiências em horários próximos: ' + escapeHtml(au[x].hora) + ' e ' + escapeHtml(au[y].hora) + '. Confira se dá tempo de ir de uma à outra.';
  }
  if (generica && !msgs.length) msgs.push(generica);
  au.forEach(function(a){ if (!a.processo) return; var n = prNum(a.processo); var pz = ab.filter(function(p){ return p.tipo === 'prazo' && p.processo && prNum(p.processo) === n; })[0]; if (pz) msgs.push('O processo <b>' + escapeHtml(a.cliente || a.processo) + '</b> tem audiência (' + escapeHtml(a.hora) + ') e prazo (' + escapeHtml(pz.titulo) + ') no mesmo dia.'); });
  return msgs.slice(0, 3).map(function(m){ return '<div class="ag-conf">⚠ <span>' + m + '</span></div>'; }).join('');
}
function agPorDia(l){ var m = {}; l.forEach(function(i){ var k = agDataAgir(i); (m[k] = m[k] || []).push(i); }); return m; }
function agPontos(l){
  var s = {}; l.forEach(function(i){ if (i.concluido) return; s[i.tipo === 'audiencia' ? 'au' : (i.tipo === 'tarefa' ? 'pe' : 'pr')] = 1; });
  return ['pr', 'au', 'pe'].filter(function(k){ return s[k]; }).map(function(k){ return '<s class="ag-p ' + k + '"></s>'; }).join('');
}
/* dia fatal dos prazos que têm dia de trabalhar antes: só uma linha fina de lembrete (o cartão está no dia de trabalhar) */
function agFatais(l){ var m = {}, hoje = agHoje(); l.forEach(function(i){ if (agTemTrab(i) && i.data >= hoje) (m[i.data] = m[i.data] || []).push(i); }); return m; }
function agLinhaFatal(i){
  var d = agDias(i.data), q = d === 0 ? 'Vence hoje' : (d === 1 ? 'Vence amanhã' : 'Prazo fatal');
  return '<div class="ag-fina" data-ag="det" data-k="' + escapeHtml(i.key) + '">⚑ <span><b>' + q + ':</b> ' + escapeHtml(i.titulo) + (i.cliente ? ' · ' + escapeHtml(i.cliente) : '') + ' <i>(trabalhar até ' + escapeHtml(agAbrevDia(i.trabalhar)) + ')</i></span></div>';
}
function agCabDia(iso){
  var f = agNomeFeriado(iso), rec = !f && pbRecesso(iso) && pbDow(iso) !== 0 && pbDow(iso) !== 6;
  var nome = PB_DIAS[pbDow(iso)]; nome = nome.charAt(0).toUpperCase() + nome.slice(1).split('-')[0];
  return '<div class="ag-dia' + (iso === agHoje() ? ' hoje' : '') + '" id="agd-' + iso + '">' + nome + ' · ' + fmtData(iso).slice(0, 5) + (iso === agHoje() ? ' · hoje' : '') + (f ? ' · ' + escapeHtml(f) + ' (sem expediente)' : '') + (rec ? ' · recesso: prazos suspensos' : '') + '</div>';
}
function agVistaSemana(todos){
  var ini = agIniSemana(agS.ref), dias = [], i;
  for (i = 0; i < 7; i++) dias.push(pbSoma(ini, i));
  var por = agPorDia(todos), fat = agFatais(todos), hoje = agHoje();
  var h = '<div class="ag-nav"><button type="button" class="icon-btn" data-ag="nav" data-v="-1" aria-label="Semana anterior">‹</button><b>' + fmtData(dias[0]).slice(0, 5) + ' a ' + fmtData(dias[6]).slice(0, 5) + '</b><button type="button" class="icon-btn" data-ag="nav" data-v="1" aria-label="Próxima semana">›</button><button type="button" class="btn-text" data-ag="hoje">Hoje</button></div>';
  h += '<div class="ag-sem">' + dias.map(function(d){
    var dots = agPontos((por[d] || []).concat(fat[d] || [])) + (agNomeFeriado(d) ? '<s class="ag-p fe"></s>' : '');
    return '<button type="button" class="ag-d' + (d === agS.sel ? ' on' : '') + (d === hoje ? ' hoje' : '') + '" data-ag="dia" data-v="' + d + '"><span>' + AG_DOW[pbDow(d)] + '</span><b>' + d.slice(8, 10) + '</b>' + agBadge(por[d]) + '<i>' + dots + '</i></button>';
  }).join('') + '</div>';
  var atrasados = todos.filter(function(x){ return !x.concluido && agDataAgir(x) < hoje && x.tipo !== 'audiencia'; }), passadas = todos.filter(agPassada);
  var vazio = true;
  if (atrasados.length){ vazio = false; h += '<div class="ag-dia atr">Atrasado</div>' + atrasados.map(agCartao).join(''); }
  if (passadas.length){ vazio = false; h += '<div class="ag-dia atr">Audiências que passaram: foi realizada?</div>' + passadas.map(agCartao).join(''); }
  dias.forEach(function(d){
    var l = (por[d] || []).filter(function(x){ return !(agDataAgir(x) < hoje && !x.concluido); }), fl = fat[d] || [];
    if (!l.length && !fl.length && !agNomeFeriado(d)) return;
    vazio = false; h += agCabDia(d) + agConflitoHtml(l) + l.map(agCartao).join('') + fl.map(agLinhaFatal).join('');
  });
  if (vazio) h += '<div class="financeiro-vazio">Nada na agenda nesta semana.</div>';
  return h;
}
function agVistaMes(todos){
  var primeiro = agS.mes + '-01', ini = pbSoma(primeiro, -pbDow(primeiro)), por = agPorDia(todos), fat = agFatais(todos), hoje = agHoje(), c = '', i, d;
  var mesTxt = AG_MESES[Number(agS.mes.slice(5, 7)) - 1];
  mesTxt = mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1) + ' ' + agS.mes.slice(0, 4);
  c += '<div class="ag-nav"><button type="button" class="icon-btn" data-ag="nav" data-v="-1" aria-label="Mês anterior">‹</button><b>' + mesTxt + '</b><button type="button" class="icon-btn" data-ag="nav" data-v="1" aria-label="Próximo mês">›</button><button type="button" class="btn-text" data-ag="hoje">Hoje</button></div>';
  c += '<div class="ag-mes">' + ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(function(x){ return '<div class="h">' + x + '</div>'; }).join('');
  for (i = 0; i < 42; i++){
    d = pbSoma(ini, i);
    var fora = d.slice(0, 7) !== agS.mes, fer = !!agNomeFeriado(d) || pbDow(d) === 0;
    c += '<button type="button" class="ag-c' + agCarga(por[d]) + (fora ? ' fora' : '') + (fer ? ' fer' : '') + (d === agS.sel ? ' on' : '') + (d === hoje ? ' hoje' : '') + '" data-ag="dia" data-v="' + d + '">' + Number(d.slice(8)) + agBadge(por[d]) + '<i>' + agPontos((por[d] || []).concat(fat[d] || [])) + (agNomeFeriado(d) ? '<s class="ag-p fe"></s>' : '') + '</i></button>';
  }
  c += '</div><div class="ag-leg"><span><s class="ag-p pr"></s>prazo</span><span><s class="ag-p pe"></s>tarefa</span><span><s class="ag-p au"></s>audiência</span><span><s class="ag-p fe"></s>feriado (TJGO)</span></div>';
  var l = por[agS.sel] || [], fl = fat[agS.sel] || [];
  c += agCabDia(agS.sel) + agConflitoHtml(l) + (l.length || fl.length ? l.map(agCartao).join('') + fl.map(agLinhaFatal).join('') : '<div class="financeiro-vazio">Nada neste dia.</div>');
  return c;
}
function agVistaLista(todos){
  var hoje = agHoje(), h = '', atr = todos.filter(function(x){ return !x.concluido && agDataAgir(x) < hoje && x.tipo !== 'audiencia'; }), futuros = todos.filter(function(x){ return !x.concluido && !(agDataAgir(x) < hoje); }), feitos = todos.filter(function(x){ return x.concluido; }).sort(function(a, b){ return agOrdem(b, a); });
  if (atr.length) h += '<div class="ag-dia atr">Atrasado</div>' + atr.map(agCartao).join('');
  var pas = todos.filter(agPassada);
  if (pas.length) h += '<div class="ag-dia atr">Audiências que passaram: foi realizada?</div>' + pas.map(agCartao).join('');
  var ult = '';
  futuros.slice(0, 80).forEach(function(i){ var dg = agDataAgir(i); if (dg !== ult){ ult = dg; h += agCabDia(dg) + agConflitoHtml(futuros.filter(function(x){ return agDataAgir(x) === dg; })); } h += agCartao(i); });
  if (futuros.length > 80) h += '<div class="saldo-data">Mostrando os 80 primeiros. Use o mês ou a semana para ver os demais.</div>';
  if ((agS.sit || 'abertos') !== 'abertos' && feitos.length) h += '<div class="ag-dia">Concluídos e cancelados</div>' + feitos.slice(0, 30).map(agCartao).join('');
  if (!atr.length && !pas.length && !futuros.length && !((agS.sit || 'abertos') !== 'abertos' && feitos.length)) h += '<div class="financeiro-vazio">Nada na agenda. Toque em “Novo compromisso” ou confirme prazos nas Publicações.</div>';
  return h;
}
function agTipoLinha(i){
  if (i.tipo === 'audiencia') return 'Audiência ' + fmtData(i.data).slice(0, 5) + (i.hora ? ' · ' + i.hora : '') + (i.audTipo ? ' · ' + i.audTipo : '');
  if (i.tipo === 'tarefa') return 'Fazer até ' + fmtData(i.data).slice(0, 5);
  return 'Prazo fatal ' + fmtData(i.data).slice(0, 5) + (!i.concluido && i.trabalhar && i.trabalhar < i.data ? ' · trabalhar até ' + fmtData(i.trabalhar).slice(0, 5) : '');
}
/* caixas "Trabalhar até" e "Prazo fatal" do prazo aberto (um cartão só, com as duas datas) */
function agDatasPrazo(i){
  var d = agDias(i.data), u = agUteis(i.data), tem = agTemTrab(i);
  var fe = d < 0 ? 'atrasado' : (d === 0 ? 'hoje' : (d === 1 ? 'amanhã' : (u >= 1 ? 'em ' + agUtilTxt(u) : 'em ' + d + ' dias')));
  var h = '<div class="agd2">';
  if (i.situacao === 'pronta') h += '<div class="ok"><small>Peça pronta</small><b>✓ ' + escapeHtml(i.prontaEm ? agAbrevDia(i.prontaEm) : 'sim') + '</b><em>' + escapeHtml((i.prontaPor ? 'por ' + String(i.prontaPor).split(' ')[0] + ' · ' : '') + 'falta protocolar') + '</em></div>';
  if (tem){
    var dt = agDias(i.trabalhar), ut = agUteis(i.trabalhar), te = dt < 0 ? 'passou há ' + (ut < 0 ? agUtilTxt(-ut) : (-dt) + (dt === -1 ? ' dia' : ' dias')) : (dt === 0 ? 'hoje' : (dt === 1 ? 'amanhã' : (ut >= 1 ? 'em ' + agUtilTxt(ut) : 'em ' + dt + ' dias')));
    h += '<div class="t' + (dt < 0 ? ' at' : '') + '"><small>Trabalhar até</small><b>' + escapeHtml(agAbrevDia(i.trabalhar)) + '</b><em>' + escapeHtml(te) + '</em></div>';
  }
  return h + '<div class="f"' + (tem || i.situacao === 'pronta' ? '' : ' style="grid-column:1/3"') + '><small>Prazo fatal</small><b>' + escapeHtml(agAbrevDia(i.data)) + '</b><em>' + escapeHtml(fe) + '</em></div></div>';
}
/* atalhos do cartão: peça pronta / protocolar, adiar, editar, WhatsApp (e "Entrar na sala" nas audiências online) */
function agAcoesCartao(i){
  if (i.concluido) return '';
  var k = escapeHtml(i.key), b = '';
  if (i.tipo === 'audiencia' && /^https?:\/\//i.test(i.link || '')) b += '<a class="pri" data-ag="link" href="' + escapeHtml(i.link) + '" target="_blank" rel="noopener noreferrer">Entrar na sala ↗</a>';
  if (i.fonte === 'agenda' && i.tipo === 'prazo') b += i.situacao === 'pronta' ? '<button type="button" class="vd" data-ag="concluir" data-k="' + k + '">Protocolar</button>' : '<button type="button" class="vd" data-ag="pronta" data-k="' + k + '">✓ Peça pronta</button>';
  b += '<button type="button" data-ag="adiar" data-k="' + k + '">⏱ Adiar ▾</button>';
  b += i.fonte === 'agenda' ? '<button type="button" data-ag="abrir" data-k="' + k + '">✎ Editar</button>' : '<button type="button" data-ag="acao" data-k="' + k + '">✎ Abrir na Iniciais</button>';
  b += '<button type="button" data-ag="zap" data-k="' + k + '" aria-label="Mensagem de WhatsApp" title="WhatsApp">💬</button>';
  return '<div class="acx">' + b + '</div>';
}
function agBotaoOk(i){
  if (i.fonte === 'alvara') return '';
  var rot = i.concluido ? 'Reabrir' : (i.tipo === 'prazo' ? 'Marcar protocolada' : (i.tipo === 'audiencia' ? 'Marcar como realizada' : 'Concluir'));
  return '<button type="button" class="agc-ok' + (i.concluido ? ' on' : '') + '" data-ag="' + (i.concluido ? 'reabrir' : 'concluir') + '" data-k="' + escapeHtml(i.key) + '" aria-label="' + rot + '" title="' + rot + '">✓</button>';
}
/* "Peça pronta": o prazo segue aberto até ser protocolado; quem marcou fica registrado (o proprietário recebe o aviso no celular) */
function agPronta(key){
  var i = agdItem(key); if (!i || i.fonte !== 'agenda' || i.tipo !== 'prazo' || i.concluido) return;
  agdSalvarDoc(i, { situacao: 'pronta', prontaEm: agHoje(), prontaPor: esS.eu ? esS.eu.nome : '' }, 'Peça pronta. Falta protocolar.', true);
}
function agCartao(i){
  var c = agChip(i), cls = i.concluido ? 'ok' : (i.situacao === 'pronta' ? 'pronta' : (i.tipo === 'audiencia' ? 'au' : (i.tipo === 'tarefa' ? 'pe' : 'pr'))), k = escapeHtml(i.key), d = i.doc || {}, tags = '', aberto = !i.concluido && i.tipo === 'prazo';
  if (i.situacao === 'elaboracao') tags += '<span class="pb-tg pz">Em andamento</span>';
  if (i.situacao === 'pronta' && !i.concluido) tags += '<span class="pb-tg ok">Peça pronta</span>';
  if (/alta/i.test(d.prioridade || '')) tags += '<span class="pb-tg pz">Prioridade alta</span>';
  if (i.tipo === 'audiencia' && i.modalidade) tags += '<span class="pb-tg">' + escapeHtml(AG_MODAL[i.modalidade] || i.modalidade) + '</span>';
  if (i.pubId) tags += '<span class="pb-tg nv">via publicação</span>';
  if (i.fonte === 'caso') tags += '<span class="pb-tg">da inicial</span>';
  if (i.concluido && !i.cancelado && i.tipo === 'prazo' && i.protocoladoEm) tags += '<span class="pb-tg ok">Protocolada em ' + escapeHtml(fmtData(i.protocoladoEm)) + '</span>';
  if (i.tipo === 'tarefa' && d.compartilhada === true) tags += '<span class="pb-tg nv">compartilhada</span>';
  if (esS.eu && i.tipo !== 'tarefa' && i.fonte !== 'alvara' && !agRespChaves(i).length) tags += '<span class="pb-tg">sem responsável</span>';
  if (i.concluido && !i.cancelado && d.concluidoPor) tags += '<span class="pb-tg ok">por ' + escapeHtml(String(d.concluidoPor).split(' ')[0]) + '</span>';
  if (esS.eu) tags += agRespAvatares(i, 3);
  else (Array.isArray(d.responsaveis) ? d.responsaveis : []).slice(0, 3).forEach(function(n){ tags += '<span class="agc-av" title="' + escapeHtml(n) + '">' + escapeHtml(agdSigla(n)) + '</span>'; });
  var ok = agBotaoOk(i);
  return '<div class="agc ' + cls + '" data-ag="det" data-k="' + k + '"><div style="min-width:0"><div class="agc-top"><span>' + escapeHtml(aberto ? 'Prazo' : agTipoLinha(i)) + '</span><span class="est est-' + c.c + '">' + escapeHtml(c.t) + '</span></div><div class="agc-t">' + escapeHtml(i.titulo) + '</div>' +
    (i.cliente ? '<div class="agc-s">' + escapeHtml(i.cliente) + '</div>' : '') +
    (i.tipo === 'audiencia' && i.local ? '<div class="agc-s">📍 ' + escapeHtml(i.local) + '</div>' : '') +
    (i.processo ? '<div class="agc-n"><span>' + escapeHtml(i.processo) + '</span><button type="button" class="agc-cp" data-ag="copiar" data-n="' + escapeHtml(i.processo) + '" aria-label="Copiar o número do processo" title="Copiar o número">' + AGD_COPIA + '</button></div>' : '') +
    (aberto ? agDatasPrazo(i) : '') + '<div class="agc-tg">' + tags + '</div>' + agAcoesCartao(i) + '</div>' + ok + '</div>';
}

/* ---------- Meu dia: só o que pede ação hoje ---------- */
function agMiniSub(i){
  var p = [], hoje = agHoje();
  if (i.cliente) p.push(escapeHtml(i.cliente));
  if (i.tipo === 'prazo'){
    if (i.situacao === 'pronta') p.push('<b class="agm-ok">peça pronta ✓' + (i.prontaPor ? ' por ' + escapeHtml(String(i.prontaPor).split(' ')[0]) : '') + '</b>');
    else if (agTemTrab(i)) p.push('trabalhar até ' + (i.trabalhar < hoje ? '<b class="agm-at">' + escapeHtml(agAbrevDia(i.trabalhar)) + '</b>' : escapeHtml(agAbrevDia(i.trabalhar))));
    p.push(i.data === hoje ? 'prazo fatal hoje' : 'fatal ' + escapeHtml(agAbrevDia(i.data)));
  } else if (i.tipo === 'audiencia'){ if (i.modalidade) p.push(escapeHtml(AG_MODAL[i.modalidade] || i.modalidade).toLowerCase()); if (i.local) p.push('📍 ' + escapeHtml(i.local)); }
  else if (i.tipo === 'tarefa') p.push('tarefa');
  return p.join(' · ');
}
function agMini(i){
  var hoje = agHoje(), c = agChip(i), cls = i.concluido ? 'ok' : (i.situacao === 'pronta' ? 'pronta' : (i.tipo === 'audiencia' ? 'au' : (i.tipo === 'tarefa' ? 'pe' : 'pr')));
  if (agTemTrab(i) && i.trabalhar < hoje && i.data >= hoje) c = { t: 'Trabalho atrasado', c: 'atraso' };
  var lab = i.tipo === 'audiencia' ? 'Audiência' + (i.hora ? ' · ' + i.hora : '') : (i.tipo === 'tarefa' ? 'Tarefa' : 'Prazo');
  return '<div class="agc ' + cls + '" data-ag="det" data-k="' + escapeHtml(i.key) + '"><div style="min-width:0"><div class="agc-top"><span>' + escapeHtml(lab) + '</span><span class="est est-' + c.c + '">' + escapeHtml(c.t) + '</span></div><div class="agc-t">' + escapeHtml(i.titulo) + '</div><div class="agc-s">' + agMiniSub(i) + '</div>' + agAcoesCartao(i) + '</div>' + agBotaoOk(i) + '</div>';
}
function agMeuDiaHtml(){
  var hoje = agHoje(), am = pbSoma(hoje, 1), todos = agEscopoLista(agItens()), ab = todos.filter(function(i){ return !i.concluido; });
  var aud = ab.filter(function(i){ return i.tipo === 'audiencia' && i.data === hoje; }).sort(function(a, b){ return (a.hora || '').localeCompare(b.hora || ''); });
  var vence = ab.filter(function(i){ return i.tipo === 'prazo' && i.data === hoje; });
  var prontas = ab.filter(function(i){ return i.tipo === 'prazo' && i.situacao === 'pronta' && i.data > hoje; }).sort(agOrdem);
  var trab = ab.filter(function(i){ return i.tipo !== 'audiencia' && agDataAgir(i) === hoje && !(i.tipo === 'prazo' && i.data === hoje); }).sort(agOrdemAgir);
  var atr = ab.filter(function(i){ return i.tipo !== 'audiencia' && agDataAgir(i) < hoje; }).sort(agOrdemAgir);
  var amanha = ab.filter(function(i){ return (i.tipo === 'audiencia' ? i.data : agDataAgir(i)) === am; }).concat(ab.filter(function(i){ return agTemTrab(i) && i.data === am; })).sort(agOrdemAgir);
  var feitos = todos.filter(function(i){ var d = i.doc || {}; return (i.concluido && !i.cancelado && d.concluidoEm === hoje) || (i.situacao === 'pronta' && !i.concluido && i.prontaEm === hoje); }).length;
  var abertosHoje = aud.length + vence.length + trab.length + atr.length, total = feitos + abertosHoje;
  var chip = function(n, txt, cl){ return n ? '<span class="' + cl + '">' + n + ' ' + txt + '</span>' : ''; };
  var h = '<div class="agm-h"><b>' + escapeHtml(agdDiaSemana(hoje) + ', ' + fmtData(hoje).slice(0, 5)) + '</b><small>hoje</small></div>' +
    '<div class="agm-res">' + chip(aud.length, aud.length === 1 ? 'audiência' : 'audiências', 'a') + chip(vence.length, vence.length === 1 ? 'vence hoje' : 'vencem hoje', 'r') + chip(trab.length, 'para trabalhar', 'g') + chip(atr.length, atr.length === 1 ? 'atrasado' : 'atrasados', 'r') + chip(prontas.length, prontas.length === 1 ? 'peça pronta' : 'peças prontas', 'v') + '</div>';
  if (total) h += '<div class="agm-prog"><i style="width:' + Math.round(feitos / total * 100) + '%"></i></div><div class="saldo-data" style="margin:0 0 4px">' + feitos + ' de ' + total + ' resolvidos hoje</div>';
  var sec = function(cl, tit, l, nota){ return l.length ? '<div class="agm-sec ' + cl + '"><span>' + tit + '</span><small>' + (nota || l.length) + '</small></div>' + l.map(agMini).join('') : ''; };
  h += sec('a', 'Audiência hoje', aud) + sec('r', 'Vence hoje', vence, 'falta protocolar') + sec('v', 'Peça pronta · conferir e protocolar', prontas) + sec('g', 'Para trabalhar hoje', trab) + sec('r', 'Atrasado', atr);
  if (!abertosHoje && !prontas.length) h += '<div class="financeiro-vazio">Nada pedindo ação hoje.</div>';
  if (amanha.length) h += '<div class="agm-sec"><span>Amanhã · ' + escapeHtml(agdDiaSemana(am).toLowerCase() + ' ' + fmtData(am).slice(0, 5)) + '</span><small>' + amanha.length + '</small></div>' + amanha.slice(0, 6).map(function(i){ var f = i.tipo === 'prazo' && i.data === am && agTemTrab(i); return '<div class="agm-am" data-ag="det" data-k="' + escapeHtml(i.key) + '"><span>' + (f ? '⚑ Vence: ' : (i.tipo === 'prazo' ? 'Trabalhar: ' : (i.tipo === 'audiencia' ? 'Audiência' + (i.hora ? ' ' + escapeHtml(i.hora) : '') + ': ' : ''))) + escapeHtml(i.titulo) + '</span><span>' + escapeHtml(i.cliente || '') + '</span></div>'; }).join('') + (amanha.length > 6 ? '<div class="saldo-data">e mais ' + (amanha.length - 6) + '</div>' : '');
  return h;
}

/* ---------- Quadro (Kanban geral: prazos, audiências, tarefas, prazos das Iniciais e previsões dos Alvarás) ---------- */
var AG_ICO = { prazo: ['scale', '#D93B3B'], audiencia: ['user', '#2A78D6'], tarefa: ['check', '#C98500'], inicial: ['doc', '#B7791E'], alvara: ['bank', '#2A78D6'] };
function agColunas(todos){
  var hoje = agHoje(), iniSem = agIniSemana(hoje), fimSem = pbSoma(iniSem, 6), fimProx = pbSoma(fimSem, 7), recente = pbSoma(hoje, -30), cols;
  if (agS.quadro === 'situacao'){
    cols = [{ k: 'afazer', t: 'A fazer', ic: 'list', l: [] }, { k: 'elaboracao', t: 'Em andamento', ic: 'doc', l: [] }, { k: 'pronta', t: 'Peça pronta', ic: 'check', l: [] }, { k: 'acomp', t: 'Acompanhando', ic: 'user', l: [] }, { k: 'feito', t: 'Concluído', ic: 'check', l: [] }];
    todos.forEach(function(i){
      if (i.concluido){ if (i.data >= recente) cols[4].l.push(i); }
      else if (i.fonte !== 'agenda') cols[3].l.push(i);
      else if (i.situacao === 'pronta') cols[2].l.push(i);
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
    else if (i.fonte === 'agenda' && i.tipo === 'prazo' && i.situacao === 'pronta') btn += '<button type="button" class="btn btn-primary pb-b" data-ag="concluir" data-k="' + k + '">Protocolar</button>';
    else if (sit && i.fonte === 'agenda' && i.tipo === 'prazo' && i.situacao === 'elaboracao') btn += '<button type="button" class="btn btn-primary pb-b" data-ag="pronta" data-k="' + k + '">✓ Peça pronta</button><button type="button" class="btn btn-ghost pb-b" data-ag="concluir" data-k="' + k + '">Marcar protocolada</button>';
    else btn += '<button type="button" class="btn btn-primary pb-b" data-ag="concluir" data-k="' + k + '">' + (i.tipo === 'prazo' ? 'Marcar protocolada' : (i.tipo === 'audiencia' ? 'Realizada' : 'Concluir')) + '</button>';
    if (sit && i.fonte === 'agenda' && i.tipo !== 'audiencia' && (i.situacao === 'elaboracao' || i.situacao === 'pronta')) btn += '<button type="button" class="btn btn-ghost pb-b" data-ag="mover" data-k="' + k + '" data-v="' + (i.situacao === 'pronta' ? 'elaboracao' : 'afazer') + '">‹ Voltar</button>';
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
  var alvo = ck === 'feito' ? 'feito' : ((agS.quadro === 'situacao' && (ck === 'afazer' || ck === 'elaboracao' || ck === 'pronta')) ? ck : '');
  if (!alvo || i.fonte === 'alvara') return false;
  if (alvo !== 'feito' && (i.fonte !== 'agenda' || i.tipo === 'audiencia')) return false;
  if (alvo === 'pronta' && i.tipo !== 'prazo') return false;   /* “Peça pronta” só existe para prazo */   /* “Em andamento” não existe para audiência nem para prazo vindo das Iniciais */
  if (alvo === 'feito' ? (i.concluido && !i.cancelado) : (!i.concluido && i.situacao === alvo)) return false;   /* já está lá */
  if (teste) return true;
  agdSituacao(i, alvo); return true;
}
function agVistaQuadro(todos){
  var cols = agColunas(todos), h = '<div class="pb-seg-lin"><div class="segmented" id="agModo">' + [['urgencia', 'Por urgência'], ['situacao', 'Por situação']].map(function(f){ return '<button type="button" class="seg-btn' + (agS.quadro === f[0] ? ' active' : '') + '" data-ag="modo" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div></div>';
  h += '<div class="ag-dica">' + (agS.quadro === 'situacao' ? 'Arraste um cartão entre as colunas para mudar a situação (A fazer, Em andamento, Peça pronta, Concluído).' : 'Arraste um cartão para Concluído para marcar como feito. Para mudar a data de um prazo, use “Adiar”.') + '</div>';
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
  var doc = Object.assign({}, i.doc, { situacao: destino, concluido: destino === 'feito', cancelado: false, concluidoEm: destino === 'feito' ? agHoje() : '' }, destino === 'afazer' || destino === 'elaboracao' ? { prontaEm: '', prontaPor: '' } : {}); delete doc.id;
  pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'PUT', doc).then(function(){ Object.assign(i.doc, doc); agDepois(); }).catch(function(e){ toast('Não consegui salvar: ' + e.message); });
}
var agAdiarKey = null, agAdtKey = null;
/* "Adiar": prazo com dia de trabalhar pergunta o que adiar (o trabalho, sem mexer no fatal, ou o próprio prazo fatal); os demais itens só mudam de data */
function agAdiar(key){
  var i = agItens({ quadro: true }).filter(function(x){ return x.key === key; })[0]; if (!i) return;
  if (i.fonte === 'agenda' && agTemTrab(i)) agAdiarTrab(i); else agAdiarFatal(key);
}
function agAdiarTrab(i){
  if (!qs('overlayAgAdT')){
    var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAgAdT';
    d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Adiar</h2><button class="icon-btn" id="adtX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body"><div class="parcela-sum" id="adtInfo"></div>' +
      '<div class="pb-sec-t" style="margin:4px 4px 6px">Adiar o trabalho na peça <small style="text-transform:none;letter-spacing:0">(o prazo fatal não muda)</small></div>' +
      '<div class="pb-acts" style="flex-direction:column;align-items:stretch"><button type="button" class="btn btn-ghost" id="adtRapido"></button><button type="button" class="btn btn-ghost" id="adtOutroBtn">Escolher outro dia…</button></div>' +
      '<div class="field" id="adtOutro" style="display:none"><label class="field-label" for="adt_data">Novo dia de trabalhar (até o prazo fatal)</label><input type="date" id="adt_data"><div class="form-error" id="adt_erro"></div><div class="pb-acts"><button type="button" class="btn btn-primary" id="adtOk">Salvar</button></div></div>' +
      '<div class="pb-sec-t" style="margin:14px 4px 6px">Alterar o prazo fatal</div><button type="button" class="btn btn-ghost" id="adtFatal" style="width:100%">Mudar a data fatal… <small>(nova intimação ou dilação)</small></button></div></div>';
    document.body.appendChild(d); adAbrirData(qs('adt_data'));
    d.addEventListener('click', function(e){ if (e.target === d || (e.target.closest && e.target.closest('#adtX'))) d.classList.remove('show'); });
    qs('adtOutroBtn').addEventListener('click', function(){ qs('adtOutro').style.display = ''; });
    qs('adtRapido').addEventListener('click', function(){ agAdtSalvar(qs('adtRapido').getAttribute('data-d')); });
    qs('adtOk').addEventListener('click', function(){
      var v = qs('adt_data').value, it = agdItem(agAdtKey); if (!it) return;
      if (!v){ qs('adt_erro').textContent = 'Escolha o novo dia.'; return; }
      if (v < agHoje()){ qs('adt_erro').textContent = 'Escolha um dia a partir de hoje.'; return; }
      if (v > it.data){ qs('adt_erro').textContent = 'O dia de trabalhar não pode passar do prazo fatal (' + fmtData(it.data) + '). Para mudar o prazo, use “Mudar a data fatal”.'; return; }
      agAdtSalvar(v);
    });
    qs('adtFatal').addEventListener('click', function(){ qs('overlayAgAdT').classList.remove('show'); agAdiarFatal(agAdtKey); });
  }
  agAdtKey = i.key;
  var base = i.trabalhar > agHoje() ? i.trabalhar : agHoje(), rap = agProxUtil(base), ok = rap <= i.data, bt = qs('adtRapido');
  qs('adtInfo').textContent = i.titulo + (i.cliente ? ' · ' + i.cliente : '') + ' — trabalhar até ' + fmtData(i.trabalhar) + ' · prazo fatal ' + fmtData(i.data);
  bt.setAttribute('data-d', rap); bt.disabled = !ok;
  bt.innerHTML = ok ? (rap === pbSoma(agHoje(), 1) ? 'Amanhã' : 'Próximo dia útil') + ' <small>' + escapeHtml(agAbrevDia(rap)) + (rap === i.data ? ' · vence nesse dia' : '') + '</small>' : 'Próximo dia útil <small>passaria do prazo fatal</small>';
  qs('adtOutro').style.display = 'none'; qs('adt_erro').textContent = ''; qs('adt_data').value = ok ? rap : i.data;
  qs('overlayAgAdT').classList.add('show');
}
function agAdtSalvar(nd){
  var i = agdItem(agAdtKey); if (!i || !nd) return;
  qs('overlayAgAdT').classList.remove('show');
  agdSalvarDoc(i, { trabalhar: nd >= i.data ? '' : nd }, 'Trabalho adiado para ' + agAbrevDia(nd) + '.', true);
}
function agAdiarFatal(key){
  var i = agItens({ quadro: true }).filter(function(x){ return x.key === key; })[0]; if (!i) return;
  if (!qs('overlayAgAdiar')){
    var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAgAdiar';
    d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Adiar</h2><button class="icon-btn" id="agaX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body"><div class="parcela-sum" id="agaInfo"></div><div class="field"><label class="field-label" for="aga_data">Nova data</label><input type="date" id="aga_data"></div><div class="form-error" id="aga_erro"></div><button type="button" class="btn btn-primary" id="agaOk" style="width:100%;justify-content:center;">Salvar nova data</button></div></div>';
    document.body.appendChild(d); adAbrirData(qs('aga_data'));
    d.addEventListener('click', function(e){ if (e.target === d || (e.target.closest && e.target.closest('#agaX'))) d.classList.remove('show'); });
    qs('agaOk').addEventListener('click', agAdiarSalvar);
  }
  agAdiarKey = key; qs('overlayAgAdiar').querySelector('h2').textContent = i.tipo === 'prazo' && i.fonte !== 'alvara' ? 'Alterar o prazo fatal' : 'Adiar'; qs('agaInfo').textContent = i.titulo + (i.cliente ? ' · ' + i.cliente : '') + ' — data atual ' + fmtData(i.data) + (i.fonte === 'caso' ? ' (prazo da inicial)' : (i.fonte === 'alvara' ? ' (previsão de levantamento)' : '')); qs('aga_data').value = pbSoma(i.data < agHoje() ? agHoje() : i.data, 1); qs('aga_erro').textContent = '';
  qs('overlayAgAdiar').classList.add('show');
}
function agAdiarSalvar(){
  var i = agItens({ quadro: true }).filter(function(x){ return x.key === agAdiarKey; })[0], nova = qs('aga_data').value; if (!i) return;
  if (!nova){ qs('aga_erro').textContent = 'Escolha a nova data.'; return; }
  function ok(msg){ qs('overlayAgAdiar').classList.remove('show'); toast(msg || 'Data alterada para ' + fmtData(nova) + '.'); setTimeout(agDepois, 350); }
  if (i.fonte === 'caso'){ persistPatch(i.caso, { prazo: Object.assign({}, i.caso.prazo, { data: nova, concluido: false }) }); ok(); return; }
  if (i.fonte === 'alvara'){ persistPatchAlvara(i.alvara, { previsaoLevantamento: nova }); ok(); return; }
  var doc = Object.assign({}, i.doc, { data: nova }); delete doc.id;
  if (i.tipo === 'prazo'){ var tr0 = doc.trabalhar; if (!(tr0 && tr0 < nova)){ var auto = agAntesUteis(nova, 2); doc.trabalhar = (auto >= agHoje() && auto < nova) ? auto : ''; } }   /* o dia de trabalhar que a pessoa escolheu é mantido; só se recalcula quando deixa de fazer sentido */
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
  var doc = Object.assign({}, i.doc, { concluido: feito, cancelado: false, situacao: feito ? 'feito' : 'afazer', concluidoEm: feito ? agHoje() : '', concluidoPor: feito && esS.eu ? esS.eu.nome : '' }, feito ? {} : { prontaEm: '', prontaPor: '' }, i.tipo === 'prazo' ? extra : {}); delete doc.id;   /* um só "concluído" para todos os responsáveis; fica registrado quem concluiu */
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
    else if (a === 'dup-salvar'){ agEdDup = true; agSalvarEd(); }
    else if (a === 'dup-abrir'){ d.classList.remove('show'); agdAbrir(b.getAttribute('data-k')); }
    else if (a === 'sug'){ var inp = qs('age_proc'); inp.value = b.getAttribute('data-v'); inp.dispatchEvent(new Event('input', { bubbles: true })); var sg = qs('age_sug'); if (sg) sg.innerHTML = ''; }
    else if (a === 'excluir') agExcluirEd(b);
  });
  d.addEventListener('change', function(e){ if (e.target && e.target.id === 'age_sit') agAjustarCampos(); });
  d.addEventListener('input', function(e){
    setTimeout(agDicasConflito, 0);
    if (e.target && (e.target.id === 'age_sit' || e.target.id === 'age_vis')) agAjustarCampos();
    if (e.target && /^age_(tit|data|proc|hora)$/.test(e.target.id)){ agEdDup = false; var dd = qs('age_dup'); if (dd) dd.innerHTML = ''; }
    if (e.target && e.target.id === 'age_proc'){ agProcSugestoes(e.target.value); agSugerirRespSeLivre(); }
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
  var vis = qs('age_vis'), box = qs('age_vis_box'), er = qs('esResp_agenda');
  if (box){ box.style.display = t === 'tarefa' && !(agEditKey && agItens().filter(function(x){ return x.key === agEditKey; })[0].fonte === 'caso') ? '' : 'none'; if (er && !(agEditKey && agItens().filter(function(x){ return x.key === agEditKey; })[0].fonte === 'caso')) er.style.display = (t !== 'tarefa' || (vis && vis.value !== 'so_eu')) ? '' : 'none'; }
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
    '<div class="field"' + (caso ? ' style="display:none"' : '') + '><label class="field-label" for="age_proc">Processo (opcional)</label><input type="text" id="age_proc" maxlength="40" value="' + escapeHtml(V('processo')) + '" placeholder="0000000-00.0000.0.00.0000"><div class="saldo-data" id="age_dica"></div><div id="age_sug"></div></div>' +
    '<div class="field"' + (caso ? ' style="display:none"' : '') + '><label class="field-label" for="age_cli">Cliente / partes</label><input type="text" id="age_cli" maxlength="90" value="' + escapeHtml(V('cliente')) + '"></div>' +
    '<div class="field" id="age_vis_box"><label class="field-label" for="age_vis">Quem vê esta tarefa</label><select id="age_vis" class="filter-select" style="width:100%"><option value="so_eu">Só eu (tarefa pessoal)</option><option value="resp">Os responsáveis que eu escolher</option><option value="todos">Todo o escritório</option></select></div>' +
    '<div class="field" id="esResp_agenda"' + (caso ? ' style="display:none"' : '') + '></div>' +
    '<div class="pb-dois"><div class="field"><label class="field-label" id="age_data_l" for="age_data">Prazo fatal</label><input type="date" id="age_data" value="' + escapeHtml(V('data')) + '"></div><div class="field" id="age_hora_box"><label class="field-label" for="age_hora">Hora</label><input type="time" id="age_hora" value="' + escapeHtml(V('hora')) + '"></div></div>' +
    '<div class="saldo-data" id="age_dica2" style="margin:-4px 0 8px"></div>' +
    '<div id="age_aud_box"><div class="pb-dois"><div class="field"><label class="field-label" for="age_audtipo">Tipo da audiência</label><select id="age_audtipo" class="filter-select" style="width:100%"><option value="">Não informado</option>' + AG_AUDS.map(function(t){ return '<option' + (V('audTipo') === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div><div class="field"><label class="field-label" for="age_mod">Modalidade</label><select id="age_mod" class="filter-select" style="width:100%"><option value="">Não informada</option>' + Object.keys(AG_MODAL).map(function(k){ return '<option value="' + k + '"' + (V('modalidade') === k ? ' selected' : '') + '>' + AG_MODAL[k] + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="field"><label class="field-label" for="age_local">Local</label><input type="text" id="age_local" maxlength="140" value="' + escapeHtml(V('local')) + '" placeholder="Ex.: Fórum de Morrinhos, sala 2"></div>' +
    '<div class="field"><label class="field-label" for="age_link">Link da sala virtual (opcional)</label><input type="text" inputmode="url" autocapitalize="off" id="age_link" maxlength="300" value="' + escapeHtml(V('link')) + '" placeholder="https://…"></div></div>' +
    '<div class="field"><label class="field-label" for="age_obs">Observações (opcional)</label><textarea id="age_obs" maxlength="1200" rows="3" style="width:100%">' + escapeHtml(V('obs')) + '</textarea></div>' +
    '<div class="field" id="age_trab_box"' + (caso ? ' style="display:none"' : '') + '><label class="field-label" for="age_trab">Trabalhar na peça até (opcional)</label><input type="date" id="age_trab" value="' + escapeHtml(i ? i.trabalhar : '') + '"><div class="saldo-data">Em branco, o app marca 2 dias úteis antes do prazo fatal.</div></div>' +
    '<div class="field" id="age_sit_box"><label class="field-label" for="age_sit">Situação</label><select id="age_sit" class="filter-select" style="width:100%"><option value="afazer"' + (sit === 'afazer' ? ' selected' : '') + '>A fazer</option>' + (caso ? '' : '<option value="elaboracao"' + (sit === 'elaboracao' ? ' selected' : '') + 'Em andamento</option>') + '<option value="feito"' + (sit === 'feito' ? ' selected' : '') + '>Concluído (protocolado)</option></select></div>' +
    '<div class="field" id="age_prot_box" style="display:none"><label class="field-label" for="age_protoc">Data do protocolo</label><input type="date" id="age_protoc" value="' + escapeHtml(V('protocoladoEm') || agHoje()) + '"></div>' +
    '<div class="field"' + (caso ? ' style="display:none"' : '') + '><label class="field-label" for="age_av">Avisar no celular</label><select id="age_av" class="filter-select" style="width:100%">' + [['padrao', '5, 2 e 1 dia antes + no dia'], ['umdia', '1 dia antes + no dia'], ['dia', 'só no dia'], ['nenhum', 'não avisar']].map(function(o){ return '<option value="' + o[0] + '"' + (agPresetAvisos(i ? i.avisos : null) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
    '<div id="age_dup"></div><div class="form-error" id="age_erro"></div><button type="button" class="btn btn-primary" data-age="salvar" style="width:100%;justify-content:center;">Salvar na agenda</button>' +
    (i && !caso ? '<button type="button" class="btn-text" data-age="excluir" style="color:var(--urgente)">Excluir este item</button>' : '');
  qs('agEdCorpo').innerHTML = h; qs('agEdTit').textContent = i ? (caso ? 'Prazo da inicial' : 'Editar item') : 'Novo item da agenda';
  adAbrirData(qs('age_data')); adAbrirData(qs('age_trab')); adAbrirData(qs('age_protoc'));
  agEdInicializar(i, caso);
  agAjustarCampos(); if (i && !caso) qs('age_proc').dispatchEvent(new Event('input', { bubbles: true }));
  agDicasConflito();
  qs('overlayAg').classList.add('show');
}
var agEdDup = false;
function agChavesProcesso(proc){
  var num = proc ? prNum(proc) : '', r = num ? prMapa().m[num] : null;
  return r ? lgUnirAdvogados(r.links.filter(function(l){ return !l.doc.arquivado; }), r.doc).map(function(a){ return a.oab; }) : [];
}
function agSugerirResp(proc){ return agChavesProcesso(proc); }
/* o seletor de responsáveis começa com o que o processo sugere (advogados do cadastro); sem processo, com quem está cadastrando */
function agEdInicializar(i, caso){
  agEdDup = false;
  var d = i ? (i.doc || {}) : {}, P = agEditPre || {}, proc = i ? i.processo : (P.processo || ''), vis = qs('age_vis');
  if (vis) vis.value = i ? (d.compartilhada === true ? 'todos' : (Array.isArray(d.resp) && d.resp.length ? 'resp' : 'so_eu')) : (proc ? 'resp' : 'so_eu');
  var ks = i ? (Array.isArray(d.resp) ? d.resp.slice() : []) : [], sug = false;
  if (!i){ var s0 = agSugerirResp(proc); if (s0.length){ ks = s0; sug = 'proc'; } else { var me = esMinhasChaves(); if (me.length){ ks = [me[0]]; sug = 'eu'; } } }   // 'proc' = sugeridos pelo processo; 'eu' = quem cadastra (ambos trocam sozinhos quando se escolhe um processo)
  esRespIniciarAg('agenda', ks, sug);
}
function agSugerirRespSeLivre(){
  var l = esS.resp.agenda || []; if (l.length && !esS.sugerido.agenda) return;
  var s0 = agSugerirResp(qs('age_proc').value); if (s0.length) esRespIniciarAg('agenda', s0, 'proc');
}
function agProcSugestoes(txt){
  var el = qs('age_sug'); if (!el) return;
  var dig = String(txt || '').replace(/\D/g, ''), q = normNome(txt || ''), mp = prMapa(), exato = dig.length >= 15 && mp.m[dig];
  if (exato || (dig.length < 3 && q.length < 3)){ el.innerHTML = ''; return; }
  var l = mp.ordem.map(function(n){ return mp.m[n]; }).filter(function(r){ return !prArquivado(r) && ((dig.length >= 3 && r.num.indexOf(dig) >= 0) || (q.length >= 3 && normNome(prTitulo(r)).indexOf(q) >= 0)); }).slice(0, 5);
  el.innerHTML = l.length ? '<div class="es-lista" style="margin-top:4px">' + l.map(function(r){ return '<button type="button" class="es-lk" style="display:block;text-align:left;padding:5px 2px" data-age="sug" data-v="' + escapeHtml(r.numero) + '">' + escapeHtml(prTitulo(r)) + ' <span class="saldo-data">' + escapeHtml(r.numero) + '</span></button>'; }).join('') + '</div>' : '';
}
function agDuplicado(doc, i){
  var proc = prNum(doc.processo); if (!proc) return null; var tn = normNome(doc.titulo);
  return agItens().filter(function(x){ return x.key !== (i && i.key) && !x.cancelado && x.tipo === doc.tipo && x.data === doc.data && x.processo && prNum(x.processo) === proc; })
    .filter(function(x){ var t = normNome(x.titulo); return !tn || !t || t === tn || t.indexOf(tn) >= 0 || tn.indexOf(t) >= 0; })[0] || null;
}
/* avisos (sem bloquear): audiência e prazo do mesmo processo no mesmo dia; audiências próximas de uma pessoa responsável */
function agDicasConflito(){
  var el = qs('age_dica2'); if (!el) return;
  var t = agEditTipo, data = qs('age_data') ? qs('age_data').value : '', hora = qs('age_hora') ? qs('age_hora').value : '', proc = prNum(qs('age_proc') ? qs('age_proc').value : ''), out = [];
  if (!data){ el.innerHTML = ''; return; }
  var outros = agItens().filter(function(x){ return !x.concluido && !x.cancelado && x.key !== agEditKey && x.data === data; });
  if (proc) outros.filter(function(x){ return x.processo && prNum(x.processo) === proc; }).forEach(function(x){
    if (t === 'prazo' && x.tipo === 'audiencia') out.push('Este processo tem uma <b>audiência no mesmo dia</b>' + (x.hora ? ', às ' + escapeHtml(x.hora) : '') + '.');
    else if (t === 'audiencia' && x.tipo === 'prazo') out.push('Este processo tem um <b>prazo no mesmo dia</b>: ' + escapeHtml(x.titulo) + '.');
  });
  if (t === 'audiencia' && /^\d{2}:\d{2}$/.test(hora)){
    var ks = esRespChaves('agenda'); if (!ks.length) ks = agSugerirResp(qs('age_proc').value);
    var min = function(h){ return Number(h.slice(0, 2)) * 60 + Number(h.slice(3)); };
    ks.forEach(function(k){ outros.filter(function(x){ return x.tipo === 'audiencia' && /^\d{2}:\d{2}$/.test(x.hora || '') && Math.abs(min(x.hora) - min(hora)) < 60 && agRespChaves(x).indexOf(k) >= 0; }).forEach(function(x){ out.push('<b>' + escapeHtml(esNomeChave(k)) + '</b> já tem audiência às ' + escapeHtml(x.hora) + ' neste dia.'); }); });
  }
  el.innerHTML = out.map(function(x){ return '<div style="color:#8a5a00">⚠ ' + x + '</div>'; }).join('');
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
  /* responsáveis (quem vê e quem recebe os avisos) e visibilidade da tarefa */
  var ks = esRespChaves('agenda'), vis = t === 'tarefa' && qs('age_vis') ? qs('age_vis').value : 'resp';
  if (t === 'tarefa'){
    if (vis === 'resp' && !ks.length){ err.textContent = 'Escolha ao menos um responsável (ou deixe “Só eu”).'; return; }
    doc.compartilhada = vis === 'todos'; doc.resp = vis === 'so_eu' ? [] : ks;
  } else doc.resp = ks;   // prazo e audiência: se ficar sem ninguém, vale o advogado do processo
  if (!agEdDup){
    var dup = agDuplicado(doc, i);
    if (dup){
      qs('age_dup').innerHTML = '<div class="pb-aviso" style="margin:8px 0;border:1px solid rgba(201,133,0,.4)"><b>Já existe ' + (doc.tipo === 'audiencia' ? 'uma audiência igual' : (doc.tipo === 'prazo' ? 'um prazo igual' : 'uma tarefa igual')) + ' neste processo</b><div class="saldo-data" style="margin:3px 0 6px">“' + escapeHtml(dup.titulo) + '” · ' + escapeHtml(fmtData(dup.data)) + (dup.hora ? ' às ' + escapeHtml(dup.hora) : '') + '</div><button type="button" class="es-lk" data-age="dup-abrir" data-k="' + escapeHtml(dup.key) + '">Abrir o existente</button> · <button type="button" class="es-lk" style="color:var(--ink-soft)" data-age="dup-salvar">Salvar mesmo assim</button></div>';
      err.textContent = ''; return;
    }
  }
  var p = i ? pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'PUT', doc).then(function(){ doc.id = i.id; agDocs = agDocs.map(function(x){ return x.id === i.id ? doc : x; }); }) : agCriar(doc);
  p.then(function(){ qs('overlayAg').classList.remove('show'); toast('Salvo na agenda.'); agDepois(); }).catch(function(e){ err.textContent = 'Não consegui salvar: ' + e.message; });
}
function agExcluirEd(b){
  var i = agItens().filter(function(x){ return x.key === agEditKey; })[0]; if (!i) return;
  if (b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Toque de novo para excluir'; return; }
  pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'DELETE').then(function(){ agDocs = agDocs.filter(function(x){ return x.id !== i.id; }); qs('overlayAg').classList.remove('show'); toast('Item excluído.'); agDepois(); }).catch(function(e){ qs('age_erro').textContent = e.message; });
}

/* ---------- carga por pessoa (Resumo): todos veem, só contagens ---------- */
var agCarga2 = null;
function agCarregarCarga(){
  var box = qs('agCargaBox'); if (!box) return;
  if (agCarga2) agDesenharCarga(agCarga2);
  fetch('/api/agenda/carga?dias=7', { credentials: 'same-origin', cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){ if (!j) return; agCarga2 = j; agDesenharCarga(j); }).catch(function(){});
}
function agDesenharCarga(j){
  var box = qs('agCargaBox'); if (!box) return;
  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], cabec = '', i;
  for (i = 0; i < j.dias; i++) cabec += '<span style="flex:1;text-align:center">' + DIAS[new Date(Date.parse(j.inicio + 'T12:00:00Z') + i * 864e5).getUTCDay()] + '</span>';
  var max = j.pessoas.reduce(function(m, p){ return Math.max(m, p.total); }, 0), cores = ['#C98500', '#2A78D6', '#17895A', '#8B5CF6', '#D93B3B'];
  var cel = function(n){ return '<span style="flex:1;height:22px;border-radius:6px;background:' + (n === 0 ? 'var(--surface-2)' : n === 1 ? 'rgba(201,133,0,.28)' : n === 2 ? 'rgba(201,133,0,.55)' : '#C98500') + ';color:' + (n >= 2 ? '#fff' : 'var(--ink-soft)') + ';font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center">' + (n || '') + '</span>'; };
  var h = '<div style="display:grid;grid-template-columns:96px 1fr 30px;gap:8px;font-size:11px;color:var(--ink-soft);margin-bottom:2px"><span></span><span style="display:flex;gap:4px">' + cabec + '</span><span style="text-align:right">total</span></div>';
  h += j.pessoas.filter(function(p){ return p.total > 0 || esMinhasChaves().indexOf(p.chave) >= 0 || j.pessoas.length <= 6; }).slice(0, 10).map(function(p, n){
    var top = max > 0 && p.total === max;
    return '<div style="display:grid;grid-template-columns:96px 1fr 30px;gap:8px;align-items:center;padding:4px ' + (top ? '8px' : '0') + ';' + (top ? 'background:rgba(201,133,0,.1);border-radius:10px;margin:0 -8px' : '') + '"><span style="display:flex;gap:6px;align-items:center;font-size:var(--t2);font-weight:700;min-width:0"><span class="agc-av" style="background:' + cores[n % cores.length] + ';color:#fff;flex:none">' + escapeHtml(agdSigla(p.nome)) + '</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(p.nome.split(' ')[0]) + '</span></span><span style="display:flex;gap:4px">' + p.dias.map(cel).join('') + '</span><b style="text-align:right">' + p.total + '</b></div>';
  }).join('');
  var topo = j.pessoas[0];
  h += '<div class="md-foot">' + (topo && topo.total > 0 ? '<b>' + escapeHtml(topo.nome.split(' ')[0]) + '</b> é quem está mais carregado nos próximos ' + j.dias + ' dias: ' + topo.total + (topo.total === 1 ? ' item' : ' itens') + '. Prazos, audiências e tarefas em aberto; tarefa pessoal não entra.' : 'Nenhum compromisso em aberto com responsável nos próximos ' + j.dias + ' dias.') + '</div>';
  box.innerHTML = h;
}

/* ---------- revisão em lote: prazos e audiências sem responsável ---------- */
var agRevS = null;
function agSemResp(){ return agItens().filter(function(i){ return i.fonte === 'agenda' && !i.concluido && !i.cancelado && (i.tipo === 'prazo' || i.tipo === 'audiencia') && !agTemRespGravado(i); }); }
function agAbrirRevResp(){
  var ov = sgMontar('overlayAgRev', 'Sem responsável');
  if (!ov.getAttribute('data-ar')){
    ov.setAttribute('data-ar', '1');
    ov.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-arv]') : null; if (b) agRevClique(b.getAttribute('data-arv')); });
    ov.addEventListener('change', function(e){ var t = e.target; if (!t || !t.getAttribute) return; var a = t.getAttribute('data-arv'), k = t.getAttribute('data-k');
      if (a === 'item'){ if (t.checked) agRevS.sel[k] = 1; else delete agRevS.sel[k]; agRevDesenhar(); }
      else if (a === 'pessoa'){ if (t.checked) agRevS.pess[k] = 1; else delete agRevS.pess[k]; agRevDesenhar(); } });
  }
  agRevS = { sel: {}, pess: {}, ocupado: false }; ov.classList.add('show'); agRevDesenhar();
}
function agRevDesenhar(){
  var el = qs('overlayAgRevC'), R = agRevS; if (!el || !R) return;
  var itens = agSemResp().sort(agOrdem), n = Object.keys(R.sel).length, np = Object.keys(R.pess).length;
  var h = '<div class="pb-sec"><div class="pb-sec-t">' + itens.length + (itens.length === 1 ? ' prazo ou audiência sem responsável' : ' prazos e audiências sem responsável') + '</div><div class="pb-aviso">Enquanto não houver responsável, o item vale para os advogados do processo e para você. A sugestão vem do cadastro do processo. Marque os itens e aplique.</div></div>';
  if (!itens.length) h += '<div class="saldo-data" style="padding:10px 4px">Todos os prazos e audiências têm responsável. 🎉</div>';
  h += itens.map(function(i){
    var sug = agChavesProcesso(i.processo), tag = sug.length ? '<span class="pb-tg ok" style="margin-left:6px">sugestão: ' + escapeHtml(sug.map(function(k){ return esNomeChave(k).split(' ')[0]; }).join(', ')) + '</span>' : '<span class="pb-tg nv" style="margin-left:6px">' + (i.processo ? 'processo sem advogado' : 'sem processo') + '</span>';
    return '<label class="ad-it es-it"><input type="checkbox" data-arv="item" data-k="' + escapeHtml(i.key) + '"' + (R.sel[i.key] ? ' checked' : '') + '><span class="ad-t"><b>' + escapeHtml(i.titulo) + '</b>' + tag + '<br><span class="saldo-data">' + escapeHtml(AG_TIPOS[i.tipo] || i.tipo) + ' · ' + escapeHtml(fmtData(i.data)) + (i.hora ? ' às ' + escapeHtml(i.hora) : '') + (i.cliente ? ' · ' + escapeHtml(i.cliente) : '') + '</span></span></label>';
  }).join('');
  h += '<div class="es-aplicar"><div class="saldo-data" style="margin:0 0 6px"><b>' + n + (n === 1 ? ' selecionado' : ' selecionados') + '</b> · aplicar a sugestão do processo, ou escolher os responsáveis:</div>' +
    esS.equipeAg.map(function(a){ return '<label class="ad-it" style="border:0;padding:3px 0"><input type="checkbox" data-arv="pessoa" data-k="' + escapeHtml(a.oab) + '"' + (R.pess[a.oab] ? ' checked' : '') + '><span class="ad-t">' + escapeHtml(a.nome) + '</span></label>'; }).join('') +
    '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-arv="sugestoes">Marcar os que têm sugestão</button><button type="button" class="btn btn-primary pb-b" data-arv="aplicar"' + (R.ocupado || !n ? ' disabled' : '') + '>' + (np ? 'Aplicar os ' + np + ' escolhidos' : 'Aplicar a sugestão') + (n ? ' (' + n + ')' : '') + '</button></div></div>';
  el.innerHTML = h;
}
function agRevClique(a){
  var R = agRevS; if (!R) return;
  if (a === 'sugestoes'){ agSemResp().forEach(function(i){ if (agChavesProcesso(i.processo).length) R.sel[i.key] = 1; }); agRevDesenhar(); return; }
  if (a !== 'aplicar' || R.ocupado) return;
  var manual = Object.keys(R.pess), lista = agSemResp().filter(function(i){ return R.sel[i.key]; }), pulou = 0;
  R.ocupado = true; agRevDesenhar();
  lista.reduce(function(p, i){ return p.then(function(){
    var ks = manual.length ? manual : agChavesProcesso(i.processo); if (!ks.length){ pulou++; return null; }
    var doc = Object.assign({}, i.doc, { resp: ks }); delete doc.id;
    return pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'PUT', doc).then(function(){ i.doc.resp = ks; });
  }); }, Promise.resolve()).then(function(){
    R.ocupado = false; R.sel = {}; toast((lista.length - pulou) + ' definidos' + (pulou ? ' · ' + pulou + ' sem sugestão (escolha os responsáveis)' : '') + '.'); agDepois(); agRevDesenhar(); try{ esBarra(); }catch(e){}
  }).catch(function(e){ R.ocupado = false; agRevDesenhar(); toast('Não consegui salvar: ' + e.message); });
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
    '.agd2{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 2px}.agd2>div{border-radius:11px;padding:6px 9px;background:var(--surface-2,#f6f4ee);border-left:4px solid var(--c-gold,#C98500)}.agd2>div.f,.agd2>div.at{border-left-color:var(--urgente);background:rgba(217,59,59,.07)}.agd2 small{display:block;font-size:var(--t1);font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}.agd2 b{display:block;font-size:var(--t3)}.agd2 em{font-style:normal;font-size:var(--t1);font-weight:700;color:#8a5a00}.agd2 .f em,.agd2 .at em{color:var(--urgente)}' +
    '.acx{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}.acx button,.acx a{display:inline-flex;align-items:center;gap:5px;font-family:inherit;border:1px solid var(--border);background:var(--surface);border-radius:99px;padding:5px 11px;font-size:var(--t2);font-weight:700;color:var(--ink);cursor:pointer;text-decoration:none}.acx .pri{background:var(--ink);color:var(--bg);border-color:transparent}' +
    '.agc>.agc-ok{align-self:start;margin-top:22px}.ag-fina{display:flex;gap:8px;align-items:center;font-size:var(--t2);color:var(--ink-soft);padding:6px 10px;border-left:3px solid var(--urgente);background:rgba(217,59,59,.06);border-radius:8px;margin:5px 0;cursor:pointer}.ag-fina b{color:var(--ink)}' +
    '.agc.pronta{--ag-c:var(--success)}.acx .vd{background:var(--success);color:#fff;border-color:transparent}.agd2>div.ok{border-left-color:var(--success);background:rgba(23,137,90,.09)}.agd2 .ok em{color:var(--success)}' +
    '.agm-h{display:flex;justify-content:space-between;align-items:flex-end;gap:8px}.agm-h b{font-size:var(--t5,18px)}.agm-h small{font-size:var(--t2);color:var(--ink-soft)}.agm-res{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.agm-res span{border-radius:99px;padding:4px 10px;font-size:var(--t1);font-weight:800;background:var(--surface-2,#eceae4);color:var(--ink)}.agm-res .r{background:rgba(217,59,59,.12);color:var(--urgente)}.agm-res .a{background:rgba(42,120,214,.13);color:var(--info)}.agm-res .g{background:rgba(201,133,0,.16);color:#8a5a00}.agm-res .v{background:rgba(23,137,90,.14);color:var(--success)}' +
    '.agm-prog{height:8px;border-radius:99px;background:var(--surface-2,#eceae4);overflow:hidden;margin:2px 0 4px}.agm-prog i{display:block;height:100%;background:var(--success);border-radius:99px}.agm-sec{font-size:var(--t1);font-weight:800;letter-spacing:.07em;text-transform:uppercase;margin:14px 2px 5px;display:flex;justify-content:space-between;color:var(--ink-soft)}.agm-sec.r{color:var(--urgente)}.agm-sec.a{color:var(--info)}.agm-sec.g{color:#8a5a00}.agm-sec.v{color:var(--success)}.agm-sec small{font-weight:700;letter-spacing:0;text-transform:none;color:var(--ink-soft)}' +
    '.agm-am{display:flex;justify-content:space-between;gap:8px;font-size:var(--t2);padding:7px 10px;background:var(--surface-2,#f6f4ee);border-radius:10px;margin:4px 0;cursor:pointer}.agm-am span:last-child{color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.agm-ok{color:var(--success)}.agm-at{color:var(--urgente)}' +
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
