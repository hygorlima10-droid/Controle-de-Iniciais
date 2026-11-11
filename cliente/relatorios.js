/* ============================================================
   RELATÓRIOS PARA IMPRIMIR (ou salvar em PDF)
   - Agenda: compromissos de um período (prazos, audiências, tarefas)
   - Publicações: o que chegou no Diário Oficial num período, com prazos
   - Processos: a lista (com próxima providência, prazos e honorários a receber) e a ficha de um processo com a linha do tempo
   - a janela monta a folha na tela; "Imprimir" usa o próprio navegador (no celular: Compartilhar > Imprimir > Salvar PDF)
   ============================================================ */
var rptCfg = null;
function rptE(t){ return escapeHtml(String(t == null ? '' : t)); }
function rptMontar(){
  if (qs('overlayRpt')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayRpt';
  d.innerHTML = '<div class="modal rpt-modal"><div class="modal-head rpt-barra"><h2 id="rptTit">Relatório</h2><button class="icon-btn" id="rptX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body"><div class="rpt-barra" id="rptOps"></div><div class="rpt-barra"><button type="button" class="btn btn-primary" id="rptImp" style="width:100%;justify-content:center;">Imprimir / salvar em PDF</button></div><div id="rptFolha" class="rpt-folha"></div></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#rptX'))) rptFechar();
    else if (e.target.closest && e.target.closest('#rptImp')) window.print();
  });
  var gera = function(e){ if (e.target && e.target.getAttribute && e.target.getAttribute('data-rptop')) rptGerar(); };
  d.addEventListener('change', gera);
  window.addEventListener('afterprint', function(){ /* a folha continua na tela depois de imprimir */ });
}
function rptLer(){
  var op = {}; if (!rptCfg) return op;
  (rptCfg.opcoes || []).forEach(function(o){ var el = qs('rptop_' + o.id); op[o.id] = el ? (o.tipo === 'check' ? el.checked : el.value) : o.padrao; });
  return op;
}
function rptAbrir(cfg){
  rptMontar(); rptCfg = cfg; qs('rptTit').textContent = cfg.titulo;
  qs('rptOps').innerHTML = (cfg.opcoes || []).map(function(o){
    if (o.tipo === 'check') return '<label class="ad-it" style="border:0;padding:4px 0;"><input type="checkbox" id="rptop_' + o.id + '" data-rptop="1"' + (o.padrao ? ' checked' : '') + '><span class="ad-t">' + rptE(o.rot) + '</span></label>';
    if (o.tipo === 'date') return '<div class="field"><label class="field-label" for="rptop_' + o.id + '">' + rptE(o.rot) + '</label><input type="date" id="rptop_' + o.id + '" data-rptop="1" value="' + rptE(o.padrao || '') + '"></div>';
    return '<div class="field"><label class="field-label" for="rptop_' + o.id + '">' + rptE(o.rot) + '</label><select id="rptop_' + o.id + '" class="filter-select" data-rptop="1" style="width:100%">' + o.valores.map(function(v){ return '<option value="' + rptE(v[0]) + '"' + (v[0] === o.padrao ? ' selected' : '') + '>' + rptE(v[1]) + '</option>'; }).join('') + '</select></div>';
  }).join('');
  rptGerar();
  qs('overlayRpt').classList.add('show'); document.body.classList.add('rpt-aberto'); qs('overlayRpt').scrollTop = 0;
}
function rptFechar(){ var d = qs('overlayRpt'); if (d) d.classList.remove('show'); document.body.classList.remove('rpt-aberto'); }
function rptGerar(){
  var r = rptCfg.gerar(rptLer()), agora = new Date();
  var carimbo = fmtData(todayISO()) + ' às ' + String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
  qs('rptFolha').innerHTML = '<div class="rpt-cab"><div class="rpt-marca"><img src="/logo/logo-white.png?v=1" alt="" width="34" height="34">Horus</div><h1>' + rptE(rptCfg.titulo) + '</h1>' + (r.sub ? '<div class="rpt-sub">' + rptE(r.sub) + '</div>' : '') + '<div class="rpt-sub">Gerado em ' + rptE(carimbo) + '. Conferir sempre com o processo.</div></div>' + r.html;
}
function rptTabela(cols, linhas){
  if (!linhas.length) return '<div class="rpt-vazio">Nada para mostrar.</div>';
  return '<table class="rpt-tab"><thead><tr>' + cols.map(function(c){ return '<th>' + rptE(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + linhas.map(function(l){ return '<tr>' + l.map(function(c){ return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
}
function rptDiaTit(iso){ var nome = PB_DIAS[pbDow(iso)]; nome = nome.charAt(0).toUpperCase() + nome.slice(1); var f = agNomeFeriado(iso); return nome + ' · ' + fmtData(iso) + (f ? ' · ' + f + ' (sem expediente)' : ''); }

/* ---------- Agenda ---------- */
function rptAgenda(){
  rptAbrir({ titulo: 'Relatório da Agenda', opcoes: [
    { id: 'periodo', rot: 'Período', padrao: 'semana', valores: [['semana', 'Esta semana'], ['proxsem', 'Próxima semana'], ['mes', 'Este mês'], ['30', 'Próximos 30 dias'], ['atrasados', 'Atrasados e audiências a confirmar'], ['tudo', 'Tudo em aberto']] },
    { id: 'feitos', rot: 'Incluir os já concluídos', tipo: 'check', padrao: false }], gerar: rptAgendaGerar });
}
function rptAgendaGerar(op){
  var hoje = agHoje(), ini = hoje, fim = hoje, nome = '';
  if (op.periodo === 'semana'){ ini = agIniSemana(hoje); fim = pbSoma(ini, 6); nome = 'Esta semana'; }
  else if (op.periodo === 'proxsem'){ ini = pbSoma(agIniSemana(hoje), 7); fim = pbSoma(ini, 6); nome = 'Próxima semana'; }
  else if (op.periodo === 'mes'){ ini = hoje.slice(0, 7) + '-01'; fim = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).toISOString().slice(0, 10); nome = 'Este mês'; }
  else if (op.periodo === '30'){ ini = hoje; fim = pbSoma(hoje, 30); nome = 'Próximos 30 dias'; }
  else if (op.periodo === 'atrasados'){ ini = '0000-01-01'; fim = pbSoma(hoje, -1); nome = 'Atrasados e audiências a confirmar'; }
  else { ini = '0000-01-01'; fim = '9999-12-31'; nome = 'Tudo em aberto'; }
  var l = agItens({ quadro: true }).filter(function(i){ return i.data >= ini && i.data <= fim && (op.feitos || !i.concluido); }).sort(agOrdem);
  var n = { prazo: 0, audiencia: 0, tarefa: 0 }; l.forEach(function(i){ if (n[i.tipo] != null && i.fonte !== 'alvara') n[i.tipo]++; });
  var sub = nome + (op.periodo !== 'atrasados' && op.periodo !== 'tudo' ? ' (' + fmtData(ini) + ' a ' + fmtData(fim) + ')' : '') + ' · ' + n.prazo + (n.prazo === 1 ? ' prazo' : ' prazos') + ', ' + n.audiencia + (n.audiencia === 1 ? ' audiência' : ' audiências') + ', ' + n.tarefa + (n.tarefa === 1 ? ' tarefa' : ' tarefas');
  var html = '', dias = {}, ordem = [];
  l.forEach(function(i){ if (!dias[i.data]){ dias[i.data] = []; ordem.push(i.data); } dias[i.data].push(i); });
  ordem.forEach(function(d){
    html += '<h2 class="rpt-dia">' + rptE(rptDiaTit(d)) + '</h2>' + rptTabela(['Hora', 'Tipo', 'O quê', 'Cliente · processo', 'Situação'], dias[d].map(function(i){
      var tipo = i.fonte === 'alvara' ? 'Alvará' : (i.fonte === 'caso' ? 'Prazo (inicial)' : AG_TIPOS[i.tipo] || 'Prazo'), det = [];
      if (i.tipo === 'audiencia'){ if (i.audTipo) det.push(i.audTipo); if (i.modalidade) det.push(AG_MODAL[i.modalidade] || i.modalidade); if (i.local) det.push('Local: ' + i.local); if (i.link) det.push('Link: ' + i.link); }
      else if (i.tipo === 'prazo' && !i.concluido && i.trabalhar && i.trabalhar < i.data) det.push('trabalhar na peça até ' + fmtData(i.trabalhar));
      if (i.concluido && i.tipo === 'prazo' && i.protocoladoEm) det.push('protocolada em ' + fmtData(i.protocoladoEm) + (i.protocoloObs ? ' (' + i.protocoloObs + ')' : ''));
      var sit = i.concluido ? (i.tipo === 'audiencia' ? 'Realizada' : 'Concluído') : (i.tipo === 'audiencia' && i.data < hoje ? 'Passou: confirmar' : agChip(i).t);
      return [rptE(i.hora || '—'), rptE(tipo), '<b>' + rptE(i.titulo) + '</b>' + (det.length ? '<br><span class="rpt-peq">' + rptE(det.join(' · ')) + '</span>' : ''), rptE([i.cliente, i.processo].filter(Boolean).join(' · ')), rptE(sit)];
    }));
  });
  if (!l.length) html = '<div class="rpt-vazio">Nenhum compromisso neste período.</div>';
  return { sub: sub, html: html };
}

/* ---------- Publicações ---------- */
function rptPublicacoes(){
  rptAbrir({ titulo: 'Relatório de publicações', opcoes: [
    { id: 'periodo', rot: 'Período', padrao: '7', valores: [['hoje', 'Hoje'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['filtros', 'O que está na tela (com os filtros atuais)']] },
    { id: 'naolidas', rot: 'Só as não lidas', tipo: 'check', padrao: false }], gerar: rptPublicacoesGerar });
}
function rptPublicacoesGerar(op){
  var hoje = todayISO(), l, nome;
  if (op.periodo === 'filtros'){ l = pbListaFiltrada(); nome = 'Filtros atuais da tela'; }
  else { var dias = op.periodo === 'hoje' ? 0 : (op.periodo === '30' ? 29 : 6), de = pbSoma(hoje, -dias); l = pbGrupos(pbVisiveis()).filter(function(p){ return p.data >= de; }); nome = op.periodo === 'hoje' ? 'Hoje' : 'Últimos ' + (dias + 1) + ' dias (' + fmtData(de) + ' a ' + fmtData(hoje) + ')'; }
  if (op.naolidas) l = l.filter(function(p){ return !pbLidaG(p); });
  l = l.slice().sort(function(a, b){ return b.data.localeCompare(a.data) || (b.id > a.id ? 1 : -1); });
  var nl = l.filter(function(p){ return !pbLidaG(p); }).length;
  var html = '', ult = '';
  l.forEach(function(p){
    if (p.data !== ult){ ult = p.data; html += '<h2 class="rpt-dia">' + rptE(rptDiaTit(p.data)) + '</h2>'; }
    var v = pbVinculo(p.processo), pz = pbPrazoGrupo(p), au = pbAudDe(p), mem = pbMembros(p);
    var prazo = pz ? 'Prazo confirmado: ' + fmtData(pz.data) + (pz.descricao ? ' (' + pz.descricao + ')' : '') + (pz.concluido ? ' · cumprido' : '') : (p.sug && !pbSemPrazoG(p) ? 'Prazo sugerido (não confirmado): ' + p.sug.dias + (p.sug.tipo === 'corridos' ? ' dias corridos' : ' dias úteis') : '');
    html += '<div class="rpt-it"><div class="rpt-l1"><b>' + rptE((p.tribunal ? p.tribunal + ' · ' : '') + (p.orgao || '')) + '</b> · ' + rptE(p.tipo || 'Publicação') + ' · ' + (pbLidaG(p) ? 'lida' : '<b>não lida</b>') + '</div>' +
      '<div><b>' + rptE(pbNomeParte(p, v)) + '</b></div><div class="rpt-peq">' + rptE((p.numero || p.processo || '') + (p.classe ? ' · ' + pbClasse(p.classe) : '') + ' · ' + (v ? v.cadastro : 'processo não cadastrado') + (mem.length > 1 ? ' · ' + mem.length + ' publicações idênticas reunidas' : '')) + '</div>' +
      (p.trecho ? '<div class="rpt-trecho">' + rptE(p.trecho) + '</div>' : '') + (prazo ? '<div><b>' + rptE(prazo) + '</b></div>' : '') + (au ? '<div><b>Audiência no texto: ' + rptE(fmtData(au.data) + (au.hora ? ' às ' + au.hora : '') + (au.tipo ? ' · ' + au.tipo : '')) + '</b></div>' : '') + '</div>';
  });
  if (!l.length) html = '<div class="rpt-vazio">Nenhuma publicação neste período.</div>';
  return { sub: nome + ' · ' + l.length + (l.length === 1 ? ' publicação' : ' publicações') + ' (' + nl + ' não lidas)', html: html };
}

/* ---------- Processos ---------- */
function rptProcessos(){
  rptAbrir({ titulo: 'Relatório de processos', opcoes: [
    { id: 'quais', rot: 'Quais processos', padrao: prS.filtro, valores: [['andamento', 'Em andamento'], ['prazo', 'Só com prazo aberto'], ['todos', 'Todos (inclui arquivados)']] }], gerar: rptProcessosGerar });
}
function rptProcessosGerar(op){
  var linhas = prFiltrar(op.quais), pm = pendentesPorDoc(), hoje = todayISO();
  linhas.sort(function(a, b){ var pa = prPrazosAbertos(a), pb2 = prPrazosAbertos(b); return (pa.length ? pa[0].data : '9999').localeCompare(pb2.length ? pb2[0].data : '9999') || prTitulo(a).localeCompare(prTitulo(b), 'pt-BR'); });
  var filtros = [prS.f.cli === '__sem' ? 'sem cliente vinculado' : (prS.f.cli ? 'cliente ' + nomeCliente(prS.f.cli) : ''), prS.f.orgao ? prS.f.orgao : '', prS.busca ? 'busca “' + prS.busca + '”' : ''].filter(Boolean);
  var rows = linhas.map(function(r){
    var pz = prPrazosAbertos(r), px = prProximaInfo(r), pubs = prPubsDe(r.num), rec = prReceberTotal(r, pm);
    return ['<b>' + rptE(prTitulo(r)) + '</b><br><span class="rpt-peq">' + rptE(r.numero) + (prArquivado(r) ? ' · arquivado' : '') + '</span>', rptE(prClienteIds(r).map(nomeCliente).join(', ') || 'sem cliente vinculado'), rptE(prOrgaoDe(r)),
      px ? rptE(px.txt + (px.data ? ' · até ' + fmtData(px.data) : '') + (px.feito ? ' (concluída)' : '')) : '—',
      pz.length ? pz.slice(0, 4).map(function(i){ return rptE(fmtData(i.data).slice(0, 5) + ' ' + i.titulo); }).join('<br>') : '—',
      pubs[0] ? rptE(fmtData(pubs[0].data) + ' · ' + (pubs[0].tipo || 'Publicação')) : '—', rec > 0.004 ? rptE(fmtMoeda(rec)) : '—'];
  });
  return { sub: (op.quais === 'andamento' ? 'Em andamento' : (op.quais === 'prazo' ? 'Com prazo aberto' : 'Todos')) + (filtros.length ? ' · ' + filtros.join(' · ') : '') + ' · ' + linhas.length + (linhas.length === 1 ? ' processo' : ' processos'), html: rptTabela(['Processo', 'Cliente', 'Vara / órgão', 'Próxima providência', 'Prazos abertos', 'Última publicação', 'Honorários a receber'], rows) };
}
function rptProcesso(num){
  var r = prMapa().m[num]; if (!r) return;
  rptAbrir({ titulo: 'Relatório do processo', opcoes: [], gerar: function(){
    var d = r.doc || {}, pm = pendentesPorDoc(), px = prProximaInfo(r), hoje = todayISO();
    var dados = [['Número', r.numero], ['Partes', prTitulo(r)], ['Clientes', prClienteIds(r).map(nomeCliente).join(', ') || 'sem cliente vinculado'], ['Vara / órgão', prOrgaoDe(r)], ['Classe', d.classe], ['Assunto', d.assunto], ['Ajuizado em', d.ajuizamento ? fmtData(d.ajuizamento) : ''], ['Valor da causa', d.valorCausa ? fmtMoeda(d.valorCausa) : ''], ['Réu / parte contrária', prReu(r)],
      ['Situação', prArquivado(r) ? 'Arquivado' + (d.motivoArquivo ? ' · ' + d.motivoArquivo : '') : 'Em andamento'], ['Próxima providência', px ? px.txt + (px.data ? ' · até ' + fmtData(px.data) : '') + (px.feito ? ' (concluída)' : '') : ''], ['Honorários', prHonChips(r, pm).map(function(c){ return c[0]; }).join('; ')], ['Observações', d.obs]].filter(function(x){ return x[1]; });
    var ev = prEventos(r), fut = ev.filter(function(e){ return prEhFuturo(e, hoje); }).sort(function(a, b){ return a.data.localeCompare(b.data); }), pas = ev.filter(function(e){ return !prEhFuturo(e, hoje); }).sort(function(a, b){ return b.data.localeCompare(a.data); });
    function tb(l){ return rptTabela(['Data', 'Tipo', 'O quê', 'Situação'], l.map(function(e){ return [rptE(fmtData(e.data)), rptE(PR_TL[e.tipo][0]), rptE(e.titulo) + (e.sub ? '<br><span class="rpt-peq">' + rptE(e.sub) + '</span>' : ''), rptE(e.estado.split('|')[0])]; })); }
    return { sub: r.numero, html: '<table class="rpt-tab rpt-dados"><tbody>' + dados.map(function(x){ return '<tr><th>' + rptE(x[0]) + '</th><td>' + rptE(x[1]) + '</td></tr>'; }).join('') + '</tbody></table>' + (fut.length ? '<h2 class="rpt-dia">Próximos</h2>' + tb(fut) : '') + '<h2 class="rpt-dia">Anteriores</h2>' + (pas.length ? tb(pas) : '<div class="rpt-vazio">Nada anterior registrado.</div>') + '<div class="rpt-peq">Publicações: dos últimos 90 dias.</div>' };
  } });
}

/* ---------- Cliente: processos em andamento e arquivados, com partes, vara, últimos andamentos e próximos passos ---------- */
function rptProcessosCliente(cid){
  var cli = clienteById(cid); if (!cli) return;
  rptAbrir({ titulo: 'Relatório de processos: ' + cli.nome, opcoes: [
    { id: 'periodo', rot: 'Período', padrao: '12m', valores: [['12m', 'Últimos 12 meses'], ['ano', 'Este ano'], ['tudo', 'Tudo'], ['custom', 'Escolher as datas abaixo']] },
    { id: 'de', rot: 'De (só vale em “Escolher as datas”)', tipo: 'date', padrao: '' }, { id: 'ate', rot: 'Até', tipo: 'date', padrao: '' },
    { id: 'quais', rot: 'Quais processos', padrao: 'todos', valores: [['todos', 'Em andamento e arquivados'], ['andamento', 'Só em andamento'], ['arquivados', 'Só arquivados']] },
    { id: 'pubs', rot: 'Mostrar o trecho das publicações nos andamentos', tipo: 'check', padrao: true },
    { id: 'hon', rot: 'Incluir os honorários a receber', tipo: 'check', padrao: false }], gerar: function(op){ return rptProcessosClienteGerar(cid, op); } });
}
function rptProcessosClienteGerar(cid, op){
  var cli = clienteById(cid), hoje = todayISO(), ini, fim = hoje, nome;
  if (op.periodo === 'ano'){ ini = hoje.slice(0, 4) + '-01-01'; nome = 'Este ano'; }
  else if (op.periodo === 'tudo'){ ini = '0000-01-01'; fim = '9999-12-31'; nome = 'Todo o período'; }
  else if (op.periodo === 'custom'){ ini = op.de || '0000-01-01'; fim = op.ate || hoje; nome = (op.de ? fmtData(op.de) : 'início') + ' a ' + (op.ate ? fmtData(op.ate) : fmtData(hoje)); }
  else { ini = pbSoma(hoje, -365); nome = 'Últimos 12 meses'; }
  var mp = prMapa(), pm = pendentesPorDoc(), todos = mp.ordem.map(function(n){ return mp.m[n]; }).filter(function(r){ return prClienteIds(r).indexOf(cid) >= 0; });
  var and = todos.filter(function(r){ return !prArquivado(r) && (!panDe(r) || panDe(r) <= fim); });
  var arq = todos.filter(function(r){ var d = prArquivado(r) ? String(r.doc.dataArquivo || r.doc.arquivadoEm || '').slice(0, 10) : ''; return d && d >= ini && d <= fim; });
  if (op.quais === 'andamento') arq = []; else if (op.quais === 'arquivados') and = [];
  and.sort(function(a, b){ var pa = prPrazosAbertos(a), pb2 = prPrazosAbertos(b); return (pa.length ? pa[0].data : '9999').localeCompare(pb2.length ? pb2[0].data : '9999') || prTitulo(a).localeCompare(prTitulo(b), 'pt-BR'); });
  arq.sort(function(a, b){ return String(b.doc.dataArquivo || '').localeCompare(String(a.doc.dataArquivo || '')); });
  var exito = 0, comRes = 0; arq.forEach(function(r){ if (PR_RES[r.doc.resultado]){ comRes++; if (PR_RES_EXITO[r.doc.resultado]) exito++; } });
  function bloco(r){
    var d = r.doc || {}, arqv = prArquivado(r), ev = prEventos(r), px = prProximaInfo(r);
    var passados = ev.filter(function(e){ return !prEhFuturo(e, hoje) && e.data >= ini && e.data <= fim && !/^Cadastrado no Horus/.test(e.titulo); }).sort(function(a, b){ return b.data.localeCompare(a.data); });
    var foraDoPeriodo = false;
    if (!passados.length){ passados = ev.filter(function(e){ return !prEhFuturo(e, hoje) && !/^Cadastrado no Horus/.test(e.titulo); }).sort(function(a, b){ return b.data.localeCompare(a.data); }).slice(0, 1); foraDoPeriodo = passados.length > 0; }
    passados = passados.slice(0, 5);
    var passos = [];
    if (!arqv){
      if (px && !px.feito) passos.push(['Providência', px.txt + (px.data ? ' (até ' + fmtData(px.data) + ')' : ''), '']);
      prPrazosAbertos(r).forEach(function(i){ passos.push([i.tipo === 'audiencia' ? 'Audiência' : 'Prazo', i.titulo + (i.hora ? ' às ' + i.hora : ''), fmtData(i.data) + (i.data < hoje && i.tipo !== 'audiencia' ? ' (ATRASADO)' : '')]); });
    }
    var linhas = [['Partes', prTitulo(r)], ['Vara / órgão', prOrgaoDe(r)], ['Classe e assunto', [d.classe, d.assunto].filter(Boolean).join(' · ')], ['Área', panArea(r)], ['Ajuizado em', d.ajuizamento ? fmtData(d.ajuizamento) : ''], ['Valor da causa', d.valorCausa ? fmtMoeda(d.valorCausa) : ''], ['Réu / parte contrária', prReu(r)]];
    if (arqv) linhas.push(['Situação', 'Arquivado em ' + fmtData(String(d.dataArquivo || d.arquivadoEm || '').slice(0, 10)) + (d.motivoArquivo ? ' · ' + d.motivoArquivo : '') + (PR_RES[d.resultado] ? ' · Resultado: ' + PR_RES[d.resultado] : '')]);
    else linhas.push(['Situação', 'Em andamento']);
    if (op.hon) linhas.push(['Honorários', prHonChips(r, pm).map(function(c){ return c[0]; }).join('; ')]);
    var h = '<div class="rpt-it"><div class="rpt-l1"><b>' + rptE(r.numero) + '</b> · ' + (arqv ? 'arquivado' : 'em andamento') + '</div><table class="rpt-tab rpt-dados"><tbody>' + linhas.filter(function(x){ return x[1]; }).map(function(x){ return '<tr><th>' + rptE(x[0]) + '</th><td>' + rptE(x[1]) + '</td></tr>'; }).join('') + '</tbody></table>';
    h += '<div class="rpt-peq" style="margin-top:6px"><b>Últimos andamentos' + (foraDoPeriodo ? ' (nenhum no período; mostrando o último conhecido)' : '') + '</b></div>' + (passados.length ? '<ul class="rpt-ul">' + passados.map(function(e){ return '<li>' + rptE(fmtData(e.data) + ' · ' + PR_TL[e.tipo][0] + ': ' + e.titulo) + (e.estado ? ' <span class="rpt-peq">(' + rptE(e.estado.split('|')[0]) + ')</span>' : '') + ((op.pubs || e.tipo !== 'pub') && e.sub ? '<br><span class="rpt-peq">' + rptE(e.sub) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<div class="rpt-peq">Sem andamentos registrados.</div>');
    if (!arqv) h += '<div class="rpt-peq" style="margin-top:6px"><b>Próximos passos</b></div>' + (passos.length ? '<ul class="rpt-ul">' + passos.map(function(x){ return '<li>' + rptE(x[0] + ': ' + x[1] + (x[2] ? ' · ' + x[2] : '')) + '</li>'; }).join('') + '</ul>' : '<div class="rpt-peq">Sem prazos ou providências em aberto.</div>');
    return h + '</div>';
  }
  var resumo = rptTabela(['Em andamento', 'Arquivados no período', 'Resultado dos arquivados'], [[rptE(String(and.length)), rptE(String(arq.length)), rptE(comRes ? exito + ' com êxito e ' + (comRes - exito) + ' sem êxito' + (arq.length > comRes ? ' (' + (arq.length - comRes) + ' sem resultado informado)' : '') : 'sem resultado informado')]]);
  var html = resumo;
  if (and.length) html += '<h2 class="rpt-dia">Em andamento (' + and.length + ')</h2>' + and.map(bloco).join('');
  if (arq.length) html += '<h2 class="rpt-dia">Arquivados no período (' + arq.length + ')</h2>' + arq.map(bloco).join('');
  if (!and.length && !arq.length) html += '<div class="rpt-vazio">Nenhum processo deste cliente neste período.</div>';
  return { sub: cli.nome + ' · ' + nome + ' · ' + (and.length + arq.length) + (and.length + arq.length === 1 ? ' processo' : ' processos'), html: html };
}

/* ---------- estilo: na tela e na impressão ---------- */
(function(){
  var st = document.createElement('style');
  st.textContent = '.rpt-ul{margin:3px 0 0 18px;padding:0;font-size:12px}.rpt-ul li{margin:2px 0}#overlayRpt{z-index:400}.rpt-modal{max-width:920px;width:100%}.rpt-folha{background:#fff;color:#111;border-radius:12px;padding:18px 16px;font-size:13px;line-height:1.4;overflow-x:auto}.rpt-cab{border-bottom:2px solid #111;margin-bottom:10px;padding-bottom:6px}.rpt-marca{font-weight:800;letter-spacing:.08em;font-size:12px;display:flex;align-items:center;gap:8px}.rpt-marca img{display:block;width:34px;height:34px;object-fit:contain}.rpt-folha h1{font-size:20px;margin:2px 0}.rpt-sub{font-size:12px;color:#444}' +
    '.rpt-dia{font-size:14px;margin:14px 0 4px;padding-bottom:2px;border-bottom:1px solid #999;color:#111}.rpt-tab{width:100%;min-width:620px;border-collapse:collapse;font-size:12px}.rpt-tab td:first-child,.rpt-tab thead th:first-child{white-space:nowrap}.rpt-dados{min-width:0}.rpt-dados td:first-child{white-space:normal}.rpt-tab th,.rpt-tab td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.rpt-tab thead th{background:#eee}.rpt-dados th{width:30%;background:#f3f3f3}.rpt-peq{font-size:11px;color:#444}.rpt-vazio{padding:14px 0;color:#555}' +
    '.rpt-it{border:1px solid #bbb;border-radius:6px;padding:6px 8px;margin:6px 0;page-break-inside:avoid}.rpt-l1{font-size:12px;color:#222}.rpt-trecho{font-size:12px;margin-top:2px}' +
    '@media print{body.rpt-aberto{background:#fff!important}body.rpt-aberto>*:not(#overlayRpt){display:none!important}body.rpt-aberto #overlayRpt{position:static!important;display:block!important;background:#fff!important;padding:0!important;overflow:visible!important}body.rpt-aberto #overlayRpt .modal{box-shadow:none!important;max-width:none!important;width:auto!important;max-height:none!important;padding:0!important;background:#fff!important;border:0!important}body.rpt-aberto #overlayRpt .modal-body{padding:0!important}body.rpt-aberto .rpt-barra{display:none!important}.rpt-folha{padding:0!important;border-radius:0;overflow:visible!important}.rpt-tab tr{page-break-inside:avoid}.rpt-dia{page-break-after:avoid}@page{size:A4;margin:14mm}}';
  document.head.appendChild(st);
})();
