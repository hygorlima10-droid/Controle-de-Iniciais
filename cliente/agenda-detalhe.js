/* ============================================================
   AGENDA: DETALHES AO TOCAR, ATALHOS DE STATUS, COPIAR O NÚMERO E MENSAGENS DE WHATSAPP (prefixo agd)
   - tocar num compromisso abre uma folha com tudo dele: data, tipo, processo (número copiável), partes e clientes, responsáveis, local, observações
   - atalhos de situação com um toque: A fazer, Em andamento, Concluído (Realizada), Cancelado e Adiar
   - WhatsApp: mensagem pronta para o cliente ou para a equipe (editável antes de enviar)
   - filtros: busca, responsável, situação e período
   ============================================================ */
var agdKey = null, agdZap = { aba: 'cliente', cli: '', texto: '' }, agdExcluir = false;
var AGD_COPIA = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="3" width="12" height="15" rx="3.2"/><path d="M8 7.2H7.2A3.2 3.2 0 0 0 4 10.4v7.4A3.2 3.2 0 0 0 7.2 21h6.1a3.2 3.2 0 0 0 3.2-3.2V18"/></svg>';
var AGD_ZAP = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1.2-1.3-2.2-1.2-1 .7c-1-.4-1.9-1.3-2.3-2.3l.7-1-1.2-2.2z"/></svg>';
var AGD_EDIT = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/></svg>';
var AGD_LIXO = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
var AGD_SIT = [['afazer', 'A fazer'], ['elaboracao', 'Em andamento'], ['feito', 'Concluído'], ['cancelado', 'Cancelado']];

/* ---------- copiar ---------- */
function agdCopiar(texto, msg){
  var ok = function(){ toast(msg || 'Copiado.'); };
  function plano(){
    try{ var t = document.createElement('textarea'); t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); t.setSelectionRange(0, 99999); document.execCommand('copy'); document.body.removeChild(t); ok(); }catch(e){ toast('Não consegui copiar. Selecione e copie à mão.'); }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, plano); else plano();
}
function agdCopiarNumero(num){ agdCopiar(String(num || ''), 'Número do processo copiado.'); }

/* ---------- dados do compromisso ---------- */
function agdItem(key){ return agItens({ quadro: true }).filter(function(x){ return x.key === key; })[0] || null; }
function agdPessoas(i){
  var d = i.doc || {}, ids = Array.isArray(d.clienteIds) ? d.clienteIds.slice() : [], r = i.processo ? prMapa().m[prNum(i.processo)] : null;
  if (r) prClienteIds(r).forEach(function(id){ if (ids.indexOf(id) < 0) ids.push(id); });
  return ids.map(function(id){ return clienteById(id); }).filter(Boolean);
}
function agdSigla(n){ var p = String(n || '').trim().split(/\s+/).filter(function(x){ return x.length > 2; }); return (p.length ? (p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')) : String(n || '?').charAt(0)).toUpperCase(); }
function agdQuando(i){
  var d = agDias(i.data);
  if (i.cancelado) return { t: 'Cancelado', c: 'neutro' };
  if (i.concluido) return { t: i.tipo === 'audiencia' ? 'Realizada' : 'Concluído', c: 'ok' };
  if (d < 0) return { t: (i.tipo === 'audiencia' ? 'Passou há ' : 'Atrasado há ') + (-d) + (d === -1 ? ' dia' : ' dias'), c: 'atraso' };
  if (d === 0) return { t: 'Hoje' + (i.hora ? ' às ' + i.hora : ''), c: 'atraso' };
  if (d === 1) return { t: 'Amanhã' + (i.hora ? ' às ' + i.hora : ''), c: 'breve' };
  return { t: 'Em ' + d + ' dias', c: d <= 3 ? 'breve' : 'ok' };
}
function agdDiaSemana(iso){ var n = PB_DIAS[pbDow(iso)] || ''; n = n.charAt(0).toUpperCase() + n.slice(1).split('-')[0]; return n; }
function agdUltimaPub(num){
  var l = []; try{ (pbS.pubs || []).forEach(function(p){ if (prNum(p.processo || p.numero) === num) l.push(p); }); }catch(e){}
  l.sort(function(a, b){ return String(b.data).localeCompare(String(a.data)); }); return l[0] || null;
}

/* ---------- folha de detalhes ---------- */
function agdMontar(){
  if (qs('overlayAgDet')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAgDet';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="agdTit">Compromisso</h2><button class="icon-btn" type="button" data-agd="fechar" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="agdC"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-agd]') : null; if (!b) return;
    agdClique(b.getAttribute('data-agd'), b.getAttribute('data-k'), b.getAttribute('data-v'));
  });
}
function agdAbrir(key){
  var i = agdItem(key); if (!i) return;
  agdMontar(); agdKey = key; agdExcluir = false; agdDesenhar(); qs('overlayAgDet').classList.add('show'); var c = qs('agdC'); if (c) c.scrollTop = 0;
}
function agdFechar(){ var o = qs('overlayAgDet'); if (o) o.classList.remove('show'); agdKey = null; }
function agdAtualizar(){ if (agdKey && qs('overlayAgDet') && qs('overlayAgDet').classList.contains('show')){ if (!agdItem(agdKey)) agdFechar(); else agdDesenhar(); } }
function agdBloco(titulo, corpo){ return '<div class="agd-bl"><div class="agd-k">' + escapeHtml(titulo) + '</div>' + corpo + '</div>'; }
function agdDesenhar(){
  var el = qs('agdC'), i = agdItem(agdKey); if (!el || !i) return;
  var d = i.doc || {}, q = agdQuando(i), k = escapeHtml(i.key), ag = i.fonte === 'agenda', cor = i.cancelado ? 'ok' : (i.concluido ? 'ok' : (i.tipo === 'audiencia' ? 'au' : (i.tipo === 'tarefa' ? 'pe' : 'pr')));
  var h = '<div class="agd-top"><div><div class="agd-data">' + escapeHtml(agdDiaSemana(i.data) + ' · ' + fmtData(i.data)) + '</div><span class="est est-' + q.c + '" style="margin-left:0">' + escapeHtml(q.t) + '</span></div>' +
    '<div class="agd-ic"><button type="button" class="agd-ib" data-agd="zap" aria-label="Mensagem de WhatsApp" title="WhatsApp">' + AGD_ZAP + '</button>' +
    (ag ? '<button type="button" class="agd-ib" data-agd="editar" aria-label="Editar" title="Editar">' + AGD_EDIT + '</button><button type="button" class="agd-ib' + (agdExcluir ? ' perigo' : '') + '" data-agd="excluir" aria-label="Excluir" title="Excluir">' + AGD_LIXO + '</button>' : '') + '</div></div>';
  h += '<h3 class="agd-t">' + escapeHtml(i.titulo) + '</h3>';
  if (agdExcluir) h += '<div class="pb-aviso agd-perigo">Excluir este compromisso? <button type="button" class="btn btn-ghost pb-b" data-agd="excluir-nao">Não</button> <button type="button" class="btn btn-primary pb-b" data-agd="excluir-sim">Sim, excluir</button></div>';
  var chips = '<span class="pb-tg ' + (i.tipo === 'audiencia' ? 'nv' : '') + '">' + escapeHtml(AG_TIPOS[i.tipo] || 'Prazo') + (i.tipo === 'audiencia' && i.audTipo ? ' · ' + escapeHtml(i.audTipo) : '') + '</span>';
  if (d.subtipo) chips += '<span class="pb-tg">' + escapeHtml(d.subtipo) + '</span>';
  if (i.tipo === 'audiencia' && i.hora) chips += '<span class="pb-tg">🕒 ' + escapeHtml(i.hora) + '</span>';
  if (i.tipo === 'audiencia' && i.modalidade) chips += '<span class="pb-tg">' + escapeHtml(AG_MODAL[i.modalidade] || i.modalidade) + '</span>';
  if (/alta/i.test(d.prioridade || '')) chips += '<span class="pb-tg pz">Prioridade alta</span>';
  if (i.fonte === 'caso') chips += '<span class="pb-tg">da inicial</span>';
  h += '<div class="agd-chips">' + chips + '</div>';
  /* situação: um toque */
  if (ag){
    var atual = i.cancelado ? 'cancelado' : (i.concluido ? 'feito' : (i.situacao === 'elaboracao' ? 'elaboracao' : 'afazer'));
    h += '<div class="agd-st" role="group" aria-label="Situação">' + AGD_SIT.map(function(s){ return '<button type="button" class="agd-sb ' + s[0] + (atual === s[0] ? ' on' : '') + '" data-agd="sit" data-v="' + s[0] + '" aria-pressed="' + (atual === s[0]) + '">' + (s[0] === 'feito' && i.tipo === 'audiencia' ? 'Realizada' : s[1]) + '</button>'; }).join('') + '</div>';
    h += '<div class="agd-acoes"><button type="button" class="btn btn-ghost pb-b" data-agd="adiar">Adiar…</button></div>';
  } else if (i.fonte === 'caso'){
    h += '<div class="agd-st">' + [['afazer', 'A fazer'], ['feito', 'Concluído']].map(function(s){ var on = (s[0] === 'feito') === !!i.concluido; return '<button type="button" class="agd-sb ' + s[0] + (on ? ' on' : '') + '" data-agd="sit" data-v="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div><div class="agd-acoes"><button type="button" class="btn btn-ghost pb-b" data-agd="adiar">Adiar…</button><button type="button" class="btn btn-ghost pb-b" data-agd="acao">Abrir a inicial</button></div>';
  } else if (i.fonte === 'alvara'){
    h += '<div class="agd-acoes"><button type="button" class="btn btn-ghost pb-b" data-agd="adiar">Adiar…</button><button type="button" class="btn btn-ghost pb-b" data-agd="acao">Abrir o alvará</button></div>';
  }
  /* processo */
  var num = i.processo ? prNum(i.processo) : '', r = num ? prMapa().m[num] : null, pdoc = r && r.doc ? r.doc : null;
  if (i.processo){
    var pc = '<div class="agd-num"><b>' + escapeHtml(i.processo) + '</b><button type="button" class="agd-cp" data-agd="copiar" data-v="' + escapeHtml(i.processo) + '" aria-label="Copiar o número do processo" title="Copiar o número">' + AGD_COPIA + '</button></div>';
    var info = [];
    if (pdoc){
      if (pdoc.orgao) info.push(escapeHtml(pdoc.orgao));
      if (pdoc.classe) info.push(escapeHtml(pdoc.classe));
      if (pdoc.valorCausa) info.push('causa ' + escapeHtml(fmtMoeda(pdoc.valorCausa)));
    }
    if (info.length) pc += '<div class="agd-sub">' + info.join(' · ') + '</div>';
    if (pdoc && pdoc.partes) pc += '<div class="agd-sub">Partes: ' + escapeHtml(pdoc.partes) + '</div>';
    var up = num ? agdUltimaPub(num) : null;
    if (up) pc += '<div class="agd-sub">Última publicação: ' + escapeHtml(fmtData(up.data)) + (up.tipo ? ' · ' + escapeHtml(up.tipo) : '') + '</div>';
    pc += r ? '<div class="agd-acoes"><button type="button" class="btn btn-ghost pb-b" data-agd="proc">Ver o processo</button></div>' : '<div class="agd-sub">Este processo ainda não está cadastrado.</div><div class="agd-acoes"><button type="button" class="btn btn-ghost pb-b" data-agd="proc-novo">Cadastrar o processo</button></div>';
    h += agdBloco('Processo', pc);
  }
  /* clientes e partes */
  var pes = agdPessoas(i), ligados = {}; pes.forEach(function(c){ ligados[normNome(c.nome)] = 1; });
  var pcl = pes.map(function(c){ return '<button type="button" class="agd-chp cli" data-agd="cliente" data-k="' + escapeHtml(c.id) + '">' + escapeHtml(c.nome) + ' ›</button>'; }).join('');
  (Array.isArray(d.partes) ? d.partes : []).forEach(function(n){ if (!pes.some(function(c){ return cliNivel(n, c.nome) >= 2; })) pcl += '<span class="agd-chp">' + escapeHtml(n) + '</span>'; });
  if (!pcl && i.cliente) pcl = '<span class="agd-chp">' + escapeHtml(i.cliente) + '</span>';
  if (pcl) h += agdBloco('Clientes e partes', '<div>' + pcl + '</div>');
  /* responsáveis */
  var resp = Array.isArray(d.responsaveis) ? d.responsaveis : [];
  if (resp.length) h += agdBloco('Responsáveis', '<div>' + resp.map(function(n){ return '<span class="agd-av" title="' + escapeHtml(n) + '">' + escapeHtml(agdSigla(n)) + '</span>'; }).join('') + '<span class="agd-sub" style="margin-left:4px">' + escapeHtml(resp.join(', ')) + '</span></div>');
  /* audiência */
  if (i.tipo === 'audiencia' && (i.local || i.link)){
    h += agdBloco('Onde', (i.local ? '<div>' + escapeHtml(i.local) + '</div>' : '') + (/^https?:\/\//i.test(i.link || '') ? '<div class="agd-acoes"><a class="btn btn-ghost pb-b" href="' + escapeHtml(i.link) + '" target="_blank" rel="noopener noreferrer">Entrar na sala virtual ↗</a></div>' : ''));
  }
  if (i.tipo === 'prazo' && i.trabalhar && i.trabalhar < i.data && !i.concluido) h += agdBloco('Trabalhar na peça até', '<div>' + escapeHtml(fmtData(i.trabalhar)) + '</div>');
  if (i.concluido && i.tipo === 'prazo' && i.protocoladoEm && !i.cancelado) h += agdBloco('Protocolo', '<div>Protocolada em ' + escapeHtml(fmtData(i.protocoladoEm)) + (i.protocoloObs ? ' · ' + escapeHtml(i.protocoloObs) : '') + '</div>');
  if (d.obs) h += agdBloco('Observações', '<div class="agd-obs">' + escapeHtml(d.obs) + '</div>');
  var rod = [];
  if (ag && !i.concluido) rod.push('Avisos: ' + ((i.avisos || []).length ? (i.avisos.map(function(n){ return n === 0 ? 'no dia' : n + ' dia' + (n === 1 ? '' : 's') + ' antes'; }).join(', ')) : 'nenhum'));
  if (d.origem === 'controljus') rod.push('Importado do Control Jus' + (d.codigoControlJus ? ' (' + escapeHtml(d.codigoControlJus) + ')' : ''));
  if (i.pubId) rod.push('Veio de uma publicação');
  if (rod.length) h += '<div class="agd-rod">' + rod.join(' · ') + (i.pubId ? ' <button type="button" class="btn-text" data-agd="pub">ver</button>' : '') + '</div>';
  el.innerHTML = h;
  var tit = qs('agdTit'); if (tit) tit.textContent = AG_TIPOS[i.tipo] || 'Compromisso';
}
function agdClique(a, k, v){
  var i = agdItem(agdKey);
  if (a === 'fechar') agdFechar();
  else if (a === 'copiar') agdCopiarNumero(v);
  else if (a === 'sit' && i) agdSituacao(i, v);
  else if (a === 'adiar' && i){ agAdiar(i.key); }
  else if (a === 'editar' && i){ agdFechar(); agAbrir(i.key); }
  else if (a === 'excluir'){ agdExcluir = !agdExcluir; agdDesenhar(); }
  else if (a === 'excluir-nao'){ agdExcluir = false; agdDesenhar(); }
  else if (a === 'excluir-sim' && i) agdExcluirItem(i);
  else if (a === 'zap' && i) agdZapAbrir(i);
  else if (a === 'cliente'){ agdFechar(); abrirPerfilCliente(k); }
  else if (a === 'proc' && i){ var n = prNum(i.processo); agdFechar(); prAbrir(n); }
  else if (a === 'proc-novo' && i){ agdFechar(); prAbrirNovo({ numero: i.processo }); }
  else if (a === 'acao' && i){ agdFechar(); irParaRelacionado(i.fonte === 'alvara' ? 'alvara' : 'peticao', i.id); }
  else if (a === 'pub' && i && i.pubId){ agdFechar(); setActiveTab('publicacoes'); setTimeout(function(){ pbAbrirDetalhe(i.pubId); }, 80); }
}
function agdExcluirItem(i){
  pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'DELETE').then(function(){ agDocs = agDocs.filter(function(x){ return x.id !== i.id; }); agdFechar(); toast('Compromisso excluído. Está na Lixeira por 30 dias.'); agDepois(); }).catch(function(e){ toast('Não consegui excluir: ' + e.message); });
}

/* ---------- atalhos de situação ---------- */
function agdSalvarDoc(i, patch, msg, desfazer){
  var antes = Object.assign({}, i.doc); delete antes.id;
  var doc = Object.assign({}, i.doc, patch); delete doc.id;
  return pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'PUT', doc).then(function(){
    Object.assign(i.doc, doc);
    agDepois(); agdAtualizar();
    if (desfazer) toast(msg, 'Desfazer', function(){ pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'PUT', antes).then(function(){ Object.keys(doc).forEach(function(c){ if (!(c in antes)) delete i.doc[c]; }); Object.assign(i.doc, antes); agDepois(); agdAtualizar(); }); });
    else toast(msg);
  }).catch(function(e){ toast('Não consegui salvar: ' + e.message); });
}
function agdSituacao(i, s){
  var abre = { situacao: s, concluido: false, cancelado: false, concluidoEm: '', protocoladoEm: '', protocoloObs: '' };
  if (i.fonte === 'caso'){ if (s === 'feito') agConcluir(i.key, true); else if (i.concluido) agConcluir(i.key, false); return; }
  if (i.fonte !== 'agenda') return;
  if (s === 'afazer' || s === 'elaboracao'){ if (i.situacao === s && !i.concluido) return; agdSalvarDoc(i, abre, s === 'afazer' ? 'Voltou para “A fazer”.' : 'Em andamento.', false); }
  else if (s === 'feito'){ if (i.concluido && !i.cancelado) return; if (i.cancelado) agdSalvarDoc(i, abre, '', false).then(function(){ agConcluir(i.key, true); }); else agConcluir(i.key, true); }
  else if (s === 'cancelado'){ if (i.cancelado) return; agdSalvarDoc(i, { situacao: 'cancelado', concluido: true, cancelado: true, concluidoEm: agHoje(), protocoladoEm: '', protocoloObs: '' }, 'Compromisso cancelado.', true); }
}

/* ---------- WhatsApp ---------- */
function agdPrimeiro(n){ var p = String(n || '').trim().split(/\s+/)[0] || ''; return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); }
function agdAssinatura(){
  var o = null; try{ (pbS.oabs || []).forEach(function(x){ if (x.principal && x.ativo !== false) o = x; }); if (!o) o = (pbS.oabs || [])[0]; }catch(e){}
  return o ? (o.nome || '') + ' · OAB/' + (o.uf || '') + ' ' + (o.numero || '') : '';
}
function agdMsgCliente(i, c){
  var d = i.doc || {}, ola = 'Olá' + (c ? ', ' + agdPrimeiro(c.nome) : '') + '! ', ass = agdAssinatura(), n = i.processo ? '\n⚖ Processo ' + i.processo : '';
  var dia = agdDiaSemana(i.data).toLowerCase() + ', ' + fmtData(i.data), t;
  if (i.tipo === 'audiencia'){
    t = ola + 'Lembrando da sua audiência' + (i.audTipo ? ' de ' + i.audTipo.toLowerCase() : '') + ':\n📅 ' + dia + (i.hora ? ' às ' + i.hora : '');
    if (i.modalidade === 'online' || /^https?:\/\//i.test(i.link || '')) t += '\n💻 Audiência online' + (/^https?:\/\//i.test(i.link || '') ? ' — sala: ' + i.link : '');
    else if (i.local) t += '\n📍 ' + i.local;
    t += n + '\nQualquer dúvida, é só chamar.';
  } else if (i.tipo === 'prazo'){
    t = ola + 'Passando para informar que estamos cuidando da providência no seu processo' + (i.processo ? ' ' + i.processo : '') + ': ' + i.titulo + '.\nAssim que tivermos novidades, aviso você.';
  } else t = ola + 'Sobre o seu caso' + (i.processo ? ' (processo ' + i.processo + ')' : '') + ': ' + i.titulo + '.\nQualquer dúvida, é só chamar.';
  return t + (ass ? '\n' + ass : '');
}
function agdMsgEquipe(i){
  var d = i.doc || {}, st = i.cancelado ? 'Cancelado' : (i.concluido ? (i.tipo === 'audiencia' ? 'Realizada' : 'Concluído') : (i.situacao === 'elaboracao' ? 'Em andamento' : 'A fazer')), pes = agdPessoas(i).map(function(c){ return c.nome; });
  if (!pes.length && i.cliente) pes = [i.cliente];
  var t = '📌 ' + (AG_TIPOS[i.tipo] || 'Prazo') + (i.audTipo ? ' (' + i.audTipo + ')' : '') + ': ' + i.titulo + '\n📅 ' + agdDiaSemana(i.data) + ', ' + fmtData(i.data) + (i.hora ? ' às ' + i.hora : '') + (i.tipo === 'prazo' && i.trabalhar && i.trabalhar < i.data ? '\n🛠 Trabalhar na peça até ' + fmtData(i.trabalhar) : '');
  if (i.processo) t += '\n⚖ Processo ' + i.processo;
  if (pes.length) t += '\n👥 ' + pes.join(', ');
  if (i.tipo === 'audiencia' && (i.local || i.link)) t += '\n📍 ' + (i.local || '') + (/^https?:\/\//i.test(i.link || '') ? (i.local ? ' — ' : '') + i.link : '');
  if (Array.isArray(d.responsaveis) && d.responsaveis.length) t += '\n👤 Responsáveis: ' + d.responsaveis.join(', ');
  if (/alta/i.test(d.prioridade || '')) t += '\n❗ Prioridade alta';
  if (d.obs) t += '\n📝 ' + String(d.obs).trim();
  return t + '\nSituação: ' + st;
}
function agdFone(c){ var f = String((c && c.telefone) || '').replace(/\D/g, ''); if (!f) return ''; if (f.length === 10 || f.length === 11) f = '55' + f; return f; }
function agdZapMontar(){
  if (qs('overlayAgZap')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAgZap';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Mensagem de WhatsApp</h2><button class="icon-btn" type="button" data-agz="fechar" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="agzC"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-agz]') : null; if (!b) return;
    var a = b.getAttribute('data-agz'), i = agdItem(agdKey);
    if (a === 'fechar') d.classList.remove('show');
    else if (a === 'aba'){ agdZap.aba = b.getAttribute('data-v'); agdZapTexto(i); agdZapDesenhar(i); }
    else if (a === 'copiar') agdCopiar(qs('agzTxt').value, 'Mensagem copiada.');
    else if (a === 'enviar'){
      var cli = agdZap.aba === 'cliente' ? clienteById(agdZap.cli) : null, fone = agdFone(cli), txt = qs('agzTxt').value;
      window.open('https://wa.me/' + fone + '?text=' + encodeURIComponent(txt), '_blank');
    }
  });
  d.addEventListener('change', function(e){ var t = e.target; if (t && t.id === 'agzCli'){ agdZap.cli = t.value; var i = agdItem(agdKey); agdZapTexto(i); agdZapDesenhar(i); } });
  d.addEventListener('input', function(e){ if (e.target && e.target.id === 'agzTxt') agdZap.texto = e.target.value; });
}
function agdZapTexto(i){ if (!i) return; var c = agdZap.aba === 'cliente' ? clienteById(agdZap.cli) : null; agdZap.texto = agdZap.aba === 'cliente' ? agdMsgCliente(i, c) : agdMsgEquipe(i); }
function agdZapAbrir(i){
  agdZapMontar(); var pes = agdPessoas(i); agdZap = { aba: 'cliente', cli: pes.length ? pes[0].id : '', texto: '' }; agdZapTexto(i); agdZapDesenhar(i); qs('overlayAgZap').classList.add('show');
}
function agdZapDesenhar(i){
  var el = qs('agzC'); if (!el || !i) return;
  var pes = agdPessoas(i), cli = agdZap.aba === 'cliente' ? clienteById(agdZap.cli) : null, fone = agdFone(cli);
  var h = '<div class="segmented agd-ab"><button type="button" class="seg-btn' + (agdZap.aba === 'cliente' ? ' active' : '') + '" data-agz="aba" data-v="cliente">Para o cliente</button><button type="button" class="seg-btn' + (agdZap.aba === 'equipe' ? ' active' : '') + '" data-agz="aba" data-v="equipe">Para a equipe</button></div>';
  if (agdZap.aba === 'cliente'){
    if (pes.length > 1) h += '<div class="field"><label class="field-label" for="agzCli">Cliente</label><select id="agzCli" class="filter-select" style="width:100%">' + pes.map(function(c){ return '<option value="' + escapeHtml(c.id) + '"' + (c.id === agdZap.cli ? ' selected' : '') + '>' + escapeHtml(c.nome) + '</option>'; }).join('') + '</select></div>';
    h += '<div class="pb-aviso" style="margin:2px 4px 8px">' + (cli ? (fone ? 'Vai para o WhatsApp de ' + escapeHtml(cli.nome) + ' (' + escapeHtml(cli.telefone) + ').' : escapeHtml(cli.nome) + ' não tem telefone no cadastro: você escolhe a conversa no WhatsApp.') : 'Nenhum cliente ligado a este compromisso: você escolhe a conversa no WhatsApp.') + '</div>';
  } else h += '<div class="pb-aviso" style="margin:2px 4px 8px">Resumo interno, com os detalhes do compromisso. Você escolhe a conversa ou o grupo no WhatsApp.</div>';
  h += '<div class="field"><label class="field-label" for="agzTxt">Mensagem (pode editar)</label><textarea id="agzTxt" rows="9" style="width:100%">' + escapeHtml(agdZap.texto) + '</textarea></div>';
  h += '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-agz="copiar">Copiar texto</button><button type="button" class="btn btn-primary pb-b" data-agz="enviar">Abrir o WhatsApp</button></div>';
  el.innerHTML = h;
}

/* ---------- filtros ---------- */
function agdResponsaveis(){ var m = {}; agDocs.forEach(function(d){ (Array.isArray(d.responsaveis) ? d.responsaveis : []).forEach(function(n){ m[n] = 1; }); }); return Object.keys(m).sort(function(a, b){ return a.localeCompare(b, 'pt-BR'); }); }
function agdFiltrosMontar(){
  if (qs('overlayAgFlt')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAgFlt';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Filtros</h2><button class="icon-btn" type="button" data-agf="fechar" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="agfC"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-agf]') : null; if (!b) return;
    var a = b.getAttribute('data-agf'), v = b.getAttribute('data-v');
    if (a === 'fechar' || a === 'ver') d.classList.remove('show');
    else if (a === 'resp'){ agS.resp = v; }
    else if (a === 'sit'){ agS.sit = v; }
    else if (a === 'per'){ agS.periodo = v; }
    else if (a === 'limpar'){ agS.resp = ''; agS.sit = 'abertos'; agS.periodo = ''; agS.busca = ''; }
    agRender(); agdFiltrosDesenhar();
  });
}
function agdFiltrosAbrir(){ agdFiltrosMontar(); agdFiltrosDesenhar(); qs('overlayAgFlt').classList.add('show'); }
function agdChipsF(grupo, opcoes, atual){ return '<div class="agd-fl">' + opcoes.map(function(o){ return '<button type="button" class="ag-f' + (atual === o[0] ? ' on' : '') + '" data-agf="' + grupo + '" data-v="' + escapeHtml(o[0]) + '">' + escapeHtml(o[1]) + '</button>'; }).join('') + '</div>'; }
function agdFiltrosDesenhar(){
  var el = qs('agfC'); if (!el) return;
  var resp = agdResponsaveis(), n = agFiltrados(agItens()).length;
  var h = '';
  h += '<div class="pb-sec"><div class="pb-sec-t">Responsável</div></div>' + (resp.length ? agdChipsF('resp', [['', 'Todos']].concat(resp.map(function(r){ return [r, r]; })), agS.resp || '') : '<div class="pb-aviso">Os responsáveis aparecem aqui quando os compromissos trazem esse dado (importação do Control Jus).</div>');
  h += '<div class="pb-sec" style="margin-top:10px"><div class="pb-sec-t">Situação</div></div>' + agdChipsF('sit', [['abertos', 'Em aberto'], ['concluidos', 'Concluídos'], ['cancelados', 'Cancelados'], ['todos', 'Todos']], agS.sit || 'abertos');
  h += '<div class="pb-sec" style="margin-top:10px"><div class="pb-sec-t">Período</div></div>' + agdChipsF('per', [['', 'Todo o período'], ['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês']], agS.periodo || '');
  h += '<div class="pb-acts" style="margin-top:14px"><button type="button" class="btn btn-ghost pb-b" data-agf="limpar">Limpar</button><button type="button" class="btn btn-primary pb-b" data-agf="ver">Ver ' + n + (n === 1 ? ' compromisso' : ' compromissos') + '</button></div>';
  el.innerHTML = h;
}
function agdFiltrosAtivos(){ return (agS.resp ? 1 : 0) + ((agS.sit || 'abertos') !== 'abertos' ? 1 : 0) + (agS.periodo ? 1 : 0); }

/* ---------- estilos ---------- */
(function(){
  var st = document.createElement('style');
  st.textContent =
    '#overlayAgDet{z-index:160}#overlayAgZap,#overlayAgFlt{z-index:175}#agdC>*,#agzC>*,#agfC>*{flex-shrink:0}' +
    '.agd-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.agd-data{font-size:var(--t3);font-weight:700;color:var(--ink-soft);margin-bottom:5px}' +
    '.agd-ic{display:flex;gap:6px}.agd-ib{width:38px;height:38px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--ink);display:grid;place-items:center;cursor:pointer}.agd-ib.perigo{background:rgba(217,59,59,.12);border-color:rgba(217,59,59,.4);color:var(--urgente)}' +
    '.agd-t{font-size:1.25rem;line-height:1.25;margin:10px 0 6px;letter-spacing:-.01em;overflow-wrap:anywhere}.agd-perigo{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '.agd-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}' +
    '.agd-st{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.agd-sb{font-family:inherit;font-size:var(--t3);font-weight:700;padding:11px 10px;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink-soft);cursor:pointer}' +
    '.agd-sb.on.afazer{border-color:var(--ink);background:var(--ink);color:var(--bg)}.agd-sb.on.elaboracao{border-color:var(--c-gold,#C98500);background:rgba(201,133,0,.14);color:var(--tutela,#8a5a00)}.agd-sb.on.feito{border-color:var(--success);background:rgba(23,137,90,.14);color:var(--success)}.agd-sb.on.cancelado{border-color:var(--ink-soft);background:var(--surface-2,#eee);color:var(--ink-soft)}' +
    '.agd-acoes{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}' +
    '.agd-bl{border-top:1px solid var(--border);margin-top:14px;padding-top:12px}.agd-k{font-size:var(--t1);font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:6px}' +
    '.agd-num{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.agd-num b{font-size:var(--t5);letter-spacing:.01em;overflow-wrap:anywhere;user-select:all;-webkit-user-select:all}' +
    '.agd-cp{width:38px;height:38px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--ink);display:grid;place-items:center;cursor:pointer;flex:none}.agd-cp:active{background:var(--surface-2,#eee)}' +
    '.agd-sub{font-size:var(--t2);color:var(--ink-soft);margin-top:4px;overflow-wrap:anywhere}.agd-obs{white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--t3)}' +
    '.agd-chp{display:inline-block;font-family:inherit;font-size:var(--t2);font-weight:600;padding:5px 11px;border-radius:99px;background:var(--surface-2,#eee);color:var(--ink);margin:0 6px 6px 0;border:0}.agd-chp.cli{background:rgba(23,137,90,.14);color:var(--success);cursor:pointer}' +
    '.agd-av{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--ink);color:var(--bg);font-size:var(--t1);font-weight:800;margin-right:5px}.agd-rod{margin-top:14px;font-size:var(--t2);color:var(--ink-soft);border-top:1px solid var(--border);padding-top:10px}' +
    '.est-neutro{background:var(--surface-2,#eee);color:var(--ink-soft)}.agd-ab{margin-bottom:10px}.agd-fl{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}' +
    /* cartão compacto da lista */
    '.agc{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:11px 12px 11px 16px;position:relative;overflow:hidden;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,.06));cursor:pointer}' +
    '.agc:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ag-c,#C4C4CB)}.agc.pr{--ag-c:var(--urgente)}.agc.au{--ag-c:var(--info)}.agc.pe{--ag-c:var(--c-gold,#C98500)}.agc.ok{--ag-c:var(--success);opacity:.72}' +
    '.agc-top{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:var(--t1);font-weight:700;color:var(--ink-soft)}.agc-top .est{margin-left:0}' +
    '.agc-t{font-size:var(--t4);font-weight:700;line-height:1.25;margin-top:3px;overflow-wrap:anywhere}.agc-s{font-size:var(--t2);color:var(--ink-soft);margin-top:2px;overflow-wrap:anywhere}' +
    '.agc-n{display:flex;align-items:center;gap:4px;font-size:var(--t2);font-weight:700;color:var(--tutela,#8a5a00);margin-top:3px}.agc-cp{width:30px;height:30px;border-radius:10px;border:0;background:transparent;color:var(--ink-soft);display:grid;place-items:center;cursor:pointer;margin-left:-2px}.agc-cp:active{background:var(--surface-2,#eee)}' +
    '.agc-tg{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}.agc-tg:empty{display:none}.agc-ok{width:34px;height:34px;border-radius:50%;border:2px solid var(--border);background:transparent;color:transparent;display:grid;place-items:center;cursor:pointer;font-size:16px;font-weight:800;flex:none}.agc-ok.on{background:var(--success);border-color:var(--success);color:#fff}' +
    '.agc-av{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:50%;background:var(--ink);color:var(--bg);font-size:9px;font-weight:800;padding:0 3px}' +
    /* barra de busca e filtros */
    '.ag-busca{width:100%;height:44px;padding:0 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--ink);font:inherit;font-size:var(--t4);outline:none}.ag-busca:focus{border-color:var(--c-gold,#C98500)}' +
    '.ag-filtros{flex-wrap:nowrap!important;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px}.ag-filtros::-webkit-scrollbar{display:none}.ag-f{white-space:nowrap;flex:none}.ag-f.tem{border-color:var(--c-gold,#C98500);color:var(--tutela,#8a5a00)}' +
    '.ag-menu{display:flex;flex-wrap:wrap;gap:6px}' +
    /* calendário: contagem e carga */
    '.ag-n{font-style:normal;font-size:9px;font-weight:800;min-width:15px;height:15px;line-height:15px;border-radius:8px;background:var(--ink);color:var(--bg);text-align:center;padding:0 3px;position:absolute;right:3px;top:3px}.ag-c,.ag-d{position:relative}' +
    '.ag-c.n1{background:rgba(42,120,214,.10)}.ag-c.n2{background:rgba(201,133,0,.16)}.ag-c.n3{background:rgba(217,59,59,.16)}.ag-c.on{background:var(--ink)}.ag-c.on .ag-n{background:var(--bg);color:var(--ink)}' +
    '.ag-conf{display:flex;gap:8px;align-items:flex-start;background:rgba(217,59,59,.10);border:1px solid rgba(217,59,59,.3);color:var(--urgente);border-radius:12px;padding:8px 11px;font-size:var(--t2);font-weight:700;margin:6px 0}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { agdAbrir: agdAbrir });
})();
