/* ============================================================
   PUBLICAÇÕES DO DIÁRIO OFICIAL (DJEN) + PRAZOS PROCESSUAIS
   - o servidor lê, todo dia às 10h, as OABs cadastradas e guarda o trecho de cada publicação
   - aqui você vê, abre o texto completo, liga ao processo cadastrado e confirma o prazo
   - o prazo é sempre SUGERIDO (texto da publicação) e CONFIRMADO por você; a data usa o calendário do TJGO
   ============================================================ */
var pbS = { carregado: false, carregando: false, buscando: false, pubs: [], oabs: [], ultima: null, filtro: 'naolidas', oab: 'todas', mais: 1, abertos: false };
var pbPrazos = [], pbPrazosOk = false, pbEdOabs = [], pbDetId = null, pbTextos = {};
function pbApi(url, metodo, corpo){
  return fetch(url, { method: metodo || 'GET', credentials: 'same-origin', cache: 'no-store', headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined, body: corpo !== undefined ? JSON.stringify(corpo) : undefined })
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) throw new Error((j.error && j.error.message) || ('Erro ' + r.status)); return j; }); });
}
function pbPad(n){ return (n < 10 ? '0' : '') + n; }
function pbSoma(iso, n){ return new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
function pbDow(iso){ return new Date(iso + 'T12:00:00Z').getUTCDay(); }
var PB_DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
function pbDiaSem(iso){ return PB_DIAS[pbDow(iso)]; }

/* ---------- calendário do TJGO: feriados no Tribunal (lista oficial 2026) e regra geral para outros anos ---------- */
var PB_FERIADOS_2026 = ['2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-07-26', '2026-09-07', '2026-10-12', '2026-10-24', '2026-10-28', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-08', '2026-12-25'];
var PB_FACULTATIVOS = { '2026-03-20': 'ponto facultativo (MotoGP)', '2026-04-20': 'ponto facultativo', '2026-06-05': 'ponto facultativo' };
var PB_FER_NOMES = { '01-01': 'Ano Novo', '02-16': 'Carnaval', '02-17': 'Carnaval', '02-18': 'Carnaval', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho', '07-26': 'Fundação de Goiás', '09-07': 'Independência', '10-12': 'N. Sra. Aparecida', '10-24': 'Aniversário de Goiânia', '10-28': 'Dia do Servidor Público', '11-02': 'Finados', '11-15': 'Proclamação da República', '11-20': 'Consciência Negra', '12-08': 'Dia da Justiça', '12-25': 'Natal' };
function pbPascoa(ano){
  var a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return ano + '-' + pbPad(mes) + '-' + pbPad(dia);
}
function pbFeriadosGeral(ano){
  var s = {}, p = pbPascoa(ano);
  ['01-01', '04-21', '05-01', '07-26', '09-07', '10-12', '10-24', '10-28', '11-02', '11-15', '11-20', '12-08', '12-25'].forEach(function(md){ s[ano + '-' + md] = 1; });
  [-48, -47, -46, -4, -3, -2, 60].forEach(function(n){ s[pbSoma(p, n)] = 1; });   /* Carnaval (seg a qua), Semana Santa (qua a sex) e Corpus Christi */
  return s;
}
var pbFerCache = {};
function pbFeriados(ano){
  if (!pbFerCache[ano]){ var s = {}; if (ano === 2026) PB_FERIADOS_2026.forEach(function(d){ s[d] = 1; }); else s = pbFeriadosGeral(ano); pbFerCache[ano] = s; }
  return pbFerCache[ano];
}
function pbRecesso(iso){ var md = iso.slice(5); return md >= '12-20' || md <= '01-20'; }   /* CPC art. 220: prazos suspensos de 20/12 a 20/01 */
function pbFeriado(iso){ return !!pbFeriados(Number(iso.slice(0, 4)))[iso]; }
function pbNaoUtil(iso){ var w = pbDow(iso); return w === 0 || w === 6 || pbFeriado(iso) || pbRecesso(iso); }
function pbMotivoNaoUtil(iso){
  if (pbDow(iso) === 0 || pbDow(iso) === 6) return pbDiaSem(iso);
  if (pbRecesso(iso)) return 'recesso (prazos suspensos de 20/12 a 20/01)';
  if (pbFeriado(iso)) return 'feriado' + (PB_FER_NOMES[iso.slice(5)] ? ' (' + PB_FER_NOMES[iso.slice(5)] + ')' : '');
  return '';
}
function pbProxUtil(iso){ var d = iso; do { d = pbSoma(d, 1); } while (pbNaoUtil(d)); return d; }
/* disponibilização → publicação (1º dia útil seguinte) → começa a contar no 1º dia útil seguinte à publicação */
function pbCalcular(disp, dias, tipo){
  dias = Math.max(1, parseInt(dias, 10) || 1);
  var pub = pbProxUtil(disp), ini = pbProxUtil(pub), d = ini, n = 1, obs = [];
  if (tipo === 'corridos'){
    while (n < dias){ d = pbSoma(d, 1); if (!pbRecesso(d)) n++; }
    while (pbNaoUtil(d)) d = pbSoma(d, 1);   /* vence em dia sem expediente: passa para o próximo dia útil */
  } else {
    while (n < dias){ d = pbSoma(d, 1); if (!pbNaoUtil(d)) n++; }
  }
  for (var x = ini; x <= d; x = pbSoma(x, 1)) if (PB_FACULTATIVOS[x]) obs.push(fmtData(x) + ' foi ' + PB_FACULTATIVOS[x]);
  return { pub: pub, ini: ini, venc: d, obs: obs };
}

/* ---------- vínculo com os processos cadastrados ---------- */
function pbVinculo(proc){
  var num = normalizarProcesso(proc); if (!num) return null;
  var i, c;
  for (i = 0; i < casos.length; i++){ c = casos[i]; if (normalizarProcesso(c.numeroProcesso) === num) return { tipo: 'peticao', id: c.id, cliente: c.cliente || 'Sem nome', rotulo: 'Petição', arquivado: !!c.arquivado }; }
  for (i = 0; i < acordos.length; i++){ c = acordos[i]; if (normalizarProcesso(c.numeroProcesso) === num) return { tipo: 'acordo', id: c.id, cliente: c.partes || 'Sem nome', rotulo: 'Termo de acordo', arquivado: !!c.arquivado }; }
  for (i = 0; i < alvaras.length; i++){ c = alvaras[i]; if (normalizarProcesso(c.numeroProcesso) === num) return { tipo: 'alvara', id: c.id, cliente: c.partes || 'Sem nome', rotulo: 'Alvará', arquivado: !!c.arquivado }; }
  return null;
}
function pbOabDe(id){ for (var i = 0; i < pbS.oabs.length; i++) if (pbS.oabs[i].id === id) return pbS.oabs[i]; return null; }
function pbPrimeiroNome(o){ return o ? String(o.nome || '').split(' ')[0] : ''; }
function pbPrazoDaPub(pubId){ for (var i = 0; i < pbPrazos.length; i++) if (pbPrazos[i].pubId === pubId) return pbPrazos[i]; return null; }
/* o que aparece: de OABs ativas; as de "só processos em conjunto" só mostram processo cadastrado ou que também vem pela sua OAB */
function pbVisiveis(){
  var meus = {};
  pbS.pubs.forEach(function(p){ if (p.processo && p.oabs.some(function(id){ var o = pbOabDe(id); return o && o.ativo && o.escopo === 'tudo'; })) meus[p.processo] = 1; });
  return pbS.pubs.filter(function(p){
    if (pbS.oab !== 'todas' && p.oabs.indexOf(pbS.oab) < 0) return false;
    return p.oabs.some(function(id){
      var o = pbOabDe(id); if (!o || !o.ativo) return false;
      return o.escopo === 'tudo' || !!meus[p.processo] || !!pbVinculo(p.processo);
    });
  });
}
function pbNomeParte(p, v){
  if (v) return v.cliente;
  var a = (p.dest || []).filter(function(d){ return d.p === 'A'; })[0], r = (p.dest || []).filter(function(d){ return d.p === 'P'; })[0];
  if (a && r) return a.n + ' × ' + r.n;
  return (p.dest && p.dest[0] && p.dest[0].n) || p.classe || 'Publicação';
}
function pbClasse(c){ c = String(c || '').toLowerCase(); return c.charAt(0).toUpperCase() + c.slice(1); }
function pbClasseTipo(t){ t = String(t || ''); return /senten|decis|despacho|ac[oó]rd/i.test(t) ? 'dec' : (/intima|ordinat|certid|edital|cita/i.test(t) ? 'ato' : 'out'); }
function pbQuando(iso){
  var h = todayISO();
  if (iso === h) return 'Hoje · ' + fmtData(iso).slice(0, 5);
  if (iso === pbSoma(h, -1)) return 'Ontem · ' + fmtData(iso).slice(0, 5);
  return pbDiaSem(iso).split('-')[0].replace(/^./, function(c){ return c.toUpperCase(); }) + ' · ' + fmtData(iso).slice(0, 5);
}
function pbQuandoAtualizou(){
  if (!pbS.ultima) return 'ainda não leu';
  var d = new Date(pbS.ultima), hoje = new Date(), mesmoDia = d.toDateString() === hoje.toDateString();
  return (mesmoDia ? 'hoje' : fmtData(d.getFullYear() + '-' + pbPad(d.getMonth() + 1) + '-' + pbPad(d.getDate()))) + ' às ' + pbPad(d.getHours()) + ':' + pbPad(d.getMinutes());
}

/* ---------- carregar ---------- */
function pbCarregar(silencioso){
  if (!window.__SERVIDOR) return Promise.resolve();
  pbS.carregando = true;
  return Promise.all([pbApi('/api/djen/estado'), pbApi('/api/djen/lista?dias=90')]).then(function(r){
    pbS.oabs = r[0].oabs || []; pbS.ultima = r[0].ultimaLeitura; pbS.pubs = r[1].pubs || []; pbS.carregado = true;
  }).catch(function(e){ pbS.erro = e.message; pbS.carregado = true; }).then(function(){
    pbS.carregando = false; pbAtualizarBadge(); if (!silencioso && activeTab === 'publicacoes') pbRender();
  });
}
function pbCarregarPrazos(){
  if (!window.__SERVIDOR) return Promise.resolve();
  return pbApi('/api/db/prazosPub').then(function(r){
    pbPrazos = (r.docs || []).map(function(d){ var x = d.data || {}; x.id = d.id; return x; }); pbPrazosOk = true;
    try{ renderPainelAtencao(); }catch(e){}
    if (activeTab === 'publicacoes') pbRender();
  }).catch(function(){ pbPrazosOk = true; });
}
function pbAtualizarBadge(){
  var n = pbVisiveis().filter(function(p){ return !p.lida; }).length, e = qs('menuNPub'); if (e) e.textContent = n > 0 ? String(n) : '';
}
function pbBuscarAgora(dias){
  if (pbS.buscando) return; pbS.buscando = true; pbRender();
  return pbApi('/api/djen/buscar', 'POST', dias ? { dias: dias } : {}).then(function(r){
    var erros = (r.porOab || []).filter(function(o){ return o.erro; });
    toast(erros.length ? ('Não consegui ler ' + erros.map(function(o){ return o.nome; }).join(', ') + ': ' + erros[0].erro) : (r.novas ? r.novas + (r.novas === 1 ? ' publicação nova.' : ' publicações novas.') : 'Nada novo no Diário Oficial.'));
  }).catch(function(e){ toast('Não consegui buscar: ' + e.message); }).then(function(){ pbS.buscando = false; return pbCarregar(); });
}

/* ---------- tela ---------- */
function pbMontarTela(){
  if (!qs('bodyPublicacoes') || qs('pbWrap').getAttribute('data-ok')) return;
  qs('pbWrap').setAttribute('data-ok', '1');
  qs('pbWrap').addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-pb]') : null; if (!b) return;
    var a = b.getAttribute('data-pb'), id = b.getAttribute('data-id');
    if (a === 'filtro'){ pbS.filtro = b.getAttribute('data-v'); pbS.mais = 1; pbRender(); }
    else if (a === 'buscar') pbBuscarAgora();
    else if (a === 'oabs') pbAbrirOabs();
    else if (a === 'mais'){ pbS.mais++; pbRender(); }
    else if (a === 'abrir') pbAbrirDetalhe(id);
    else if (a === 'lida') pbMarcar([id], { lida: !(pbPub(id) || {}).lida });
    else if (a === 'todas-lidas'){ var ids = pbListaFiltrada().filter(function(p){ return !p.lida; }).map(function(p){ return p.id; }); if (ids.length) pbMarcar(ids, { lida: true }); }
    else if (a === 'cadastrar') pbCadastrar(id);
    else if (a === 'ir') pbIrVinculo(id);
    else if (a === 'prazo') pbAbrirPrazoPub(id);
    else if (a === 'prazos-toggle'){ pbS.abertos = !pbS.abertos; pbRender(); }
    else if (a === 'prazo-ver') pbAbrirPrazo(b.getAttribute('data-pid'));
  });
  qs('pbWrap').addEventListener('change', function(e){ if (e.target && e.target.id === 'pbOabSel'){ pbS.oab = e.target.value; pbS.mais = 1; pbRender(); } });
}
function pbPub(id){ for (var i = 0; i < pbS.pubs.length; i++) if (pbS.pubs[i].id === id) return pbS.pubs[i]; return null; }
function pbListaFiltrada(){
  var vis = pbVisiveis();
  if (pbS.filtro === 'naolidas') vis = vis.filter(function(p){ return !p.lida; });
  else if (pbS.filtro === 'meus') vis = vis.filter(function(p){ return !!pbVinculo(p.processo); });
  return vis;
}
function pbRender(){
  pbMontarTela();
  var w = qs('pbWrap'); if (!w) return;
  if (!window.__SERVIDOR){ w.innerHTML = '<div class="financeiro-vazio">As publicações do Diário Oficial funcionam no app hospedado no Cloudflare.</div>'; return; }
  if (!pbS.carregado){ w.innerHTML = '<div class="financeiro-vazio">Carregando publicações…</div>'; pbCarregar(); return; }
  var vis = pbVisiveis(), naoLidas = vis.filter(function(p){ return !p.lida; });
  var aDefinir = vis.filter(function(p){ return p.sug && !p.semPrazo && !pbPrazoDaPub(p.id) && !p.lida; }).length;
  var semProc = naoLidas.filter(function(p){ return !pbVinculo(p.processo); }).length;
  var prazosAbertos = pbPrazos.filter(function(x){ return !x.concluido; }).sort(function(a, b){ return (a.data || '').localeCompare(b.data || ''); });
  var h = '<div class="financeiro-bloco rs-hero pb-hero"><span class="fv-k">Publicações não lidas</span><div class="fv-big">' + naoLidas.length + '</div><div class="fv-pat-l"><span>' + rsChip('Atualizado ' + escapeHtml(pbQuandoAtualizou()), '') + '</span></div></div>' +
    '<div class="rs-tiles"><div class="fv-tile"><span class="fv-tl">' + fvIc('clip', '#B7791E') + 'Prazo a definir</span><b class="' + (aDefinir ? 'neg' : '') + '">' + aDefinir + '</b></div><div class="fv-tile"><span class="fv-tl">' + fvIc('doc', '#2A78D6') + 'Processo novo</span><b>' + semProc + '</b></div></div>';
  h += '<div class="pb-barra"><button type="button" class="btn btn-primary" data-pb="buscar"' + (pbS.buscando ? ' disabled' : '') + '>' + (pbS.buscando ? 'Buscando…' : 'Buscar agora') + '</button><button type="button" class="btn btn-ghost" data-pb="oabs">OABs monitoradas</button></div>';
  if (prazosAbertos.length){
    var hoje = todayISO();
    h += '<div class="ini-card pb-prazos"><button type="button" class="pb-prazos-top" data-pb="prazos-toggle"><span>' + fvIc('clip', '#D93B3B') + '<b>Prazos abertos</b> <span class="saldo-data" style="display:inline">(' + prazosAbertos.length + ')</span></span><span class="saldo-data">' + (pbS.abertos ? 'recolher' : 'ver') + '</span></button>';
    if (pbS.abertos) h += prazosAbertos.map(function(x){
      var atr = x.data < hoje, dd = Math.round((Date.parse(x.data + 'T12:00:00Z') - Date.parse(hoje + 'T12:00:00Z')) / 86400000);
      return '<div class="pb-prazo-lin" data-pb="prazo-ver" data-pid="' + escapeHtml(x.id) + '"><div class="up-data' + (atr ? ' up-d-atraso' : (x.data === hoje ? ' up-d-hoje' : '')) + '"><b>' + x.data.slice(8, 10) + '</b><span>' + MES_CURTO_AT[Number(x.data.slice(5, 7)) - 1] + '</span></div><div class="pb-prazo-tx"><b>' + escapeHtml(x.cliente || 'Sem nome') + '</b><span>' + escapeHtml(x.descricao || 'Prazo') + '</span></div><span class="est ' + (atr ? 'est-atraso' : (dd <= 3 ? 'est-breve' : 'est-ok')) + '">' + (atr ? 'Vencido' : (dd === 0 ? 'Hoje' : (dd === 1 ? 'Amanhã' : 'Em ' + dd + ' dias'))) + '</span></div>';
    }).join('');
    h += '</div>';
  }
  var ativos = pbS.oabs.filter(function(o){ return o.ativo; });
  h += '<div class="pb-filtros"><div class="segmented" id="pbSeg">' + [['naolidas', 'Não lidas'], ['meus', 'Meus processos'], ['todas', 'Todas']].map(function(f){ return '<button type="button" class="seg-btn' + (pbS.filtro === f[0] ? ' active' : '') + '" data-pb="filtro" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
    (pbS.oabs.length > 1 ? '<select id="pbOabSel" class="filter-select" aria-label="OAB"><option value="todas">Todas as OABs</option>' + pbS.oabs.map(function(o){ return '<option value="' + escapeHtml(o.id) + '"' + (pbS.oab === o.id ? ' selected' : '') + '>' + escapeHtml(o.nome) + ' · ' + escapeHtml(o.numero + '/' + o.uf) + '</option>'; }).join('') + '</select>' : '') + '</div>';
  if (pbS.erro) h += '<div class="aviso-sis"><span class="as-txt">Não consegui carregar: ' + escapeHtml(pbS.erro) + '</span></div>';
  if (!ativos.length) h += '<div class="financeiro-vazio">Nenhuma OAB ativa. Toque em “OABs monitoradas” para cadastrar.</div>';
  var lista = pbListaFiltrada(), limite = pbS.mais * 30, ultimoDia = '';
  if (!lista.length && ativos.length) h += '<div class="financeiro-vazio">' + (pbS.filtro === 'naolidas' ? 'Nenhuma publicação nova. Tudo lido.' : 'Nenhuma publicação nos últimos 90 dias para este filtro.') + '</div>';
  if (pbS.filtro === 'naolidas' && naoLidas.length > 1) h += '<div class="pb-todas"><button type="button" class="btn-text" data-pb="todas-lidas">Marcar todas como lidas</button></div>';
  lista.slice(0, limite).forEach(function(p){
    if (p.data !== ultimoDia){ ultimoDia = p.data; h += '<div class="pb-dia">' + escapeHtml(pbQuando(p.data)) + '</div>'; }
    h += pbCartao(p);
  });
  if (lista.length > limite) h += '<button type="button" class="btn btn-ghost" data-pb="mais" style="width:100%;justify-content:center;">Mostrar mais (' + (lista.length - limite) + ')</button>';
  w.innerHTML = h;
}
function pbCartao(p){
  var v = pbVinculo(p.processo), pz = pbPrazoDaPub(p.id), cls = pbClasseTipo(p.tipo), tags = '';
  tags += v ? '<button type="button" class="pb-tg ok" data-pb="ir" data-id="' + escapeHtml(p.id) + '">✓ ' + escapeHtml(v.rotulo.toLowerCase()) + ' cadastrada' + (v.arquivado ? ' (arquivada)' : '') + '</button>' : '<span class="pb-tg nv">+ processo novo</span>';
  if (pz) tags += '<span class="pb-tg pz">⏱ prazo ' + escapeHtml(fmtData(pz.data)) + (pz.concluido ? ' (cumprido)' : '') + '</span>';
  else if (p.sug && !p.semPrazo) tags += '<span class="pb-tg pz">⏱ sugerido: ' + p.sug.dias + (p.sug.tipo === 'corridos' ? ' dias corridos' : ' dias') + '</span>';
  p.oabs.forEach(function(id){ var o = pbOabDe(id); if (o) tags += '<span class="pb-tg">via OAB ' + escapeHtml(pbPrimeiroNome(o)) + '</span>'; });
  var btn = '';
  if (!pz && p.sug && !p.semPrazo) btn += '<button type="button" class="btn btn-primary pb-b" data-pb="prazo" data-id="' + escapeHtml(p.id) + '">Confirmar prazo</button>';
  else if (!pz && !p.semPrazo && cls !== 'out') btn += '<button type="button" class="btn btn-ghost pb-b" data-pb="prazo" data-id="' + escapeHtml(p.id) + '">Criar prazo</button>';
  if (!v) btn += '<button type="button" class="btn btn-ghost pb-b" data-pb="cadastrar" data-id="' + escapeHtml(p.id) + '">Cadastrar processo</button>';
  btn += '<button type="button" class="btn btn-ghost pb-b" data-pb="abrir" data-id="' + escapeHtml(p.id) + '">Ver texto</button><button type="button" class="btn-text pb-b" data-pb="lida" data-id="' + escapeHtml(p.id) + '">' + (p.lida ? 'Marcar não lida' : 'Lida') + '</button>';
  return '<div class="pb-card ' + cls + (p.lida ? ' lida' : '') + '"><div class="pb-l1"><span>' + (p.lida ? '' : '<i class="pb-dot"></i>') + escapeHtml((p.tribunal ? p.tribunal + ' · ' : '') + (p.orgao || '')) + '</span><span class="pb-tipo ' + cls + '">' + escapeHtml(p.tipo || 'Publicação') + '</span></div>' +
    '<div class="pb-cli">' + escapeHtml(pbNomeParte(p, v)) + '</div><div class="pb-proc">' + escapeHtml(p.numero || p.processo || '') + (p.classe ? ' · ' + escapeHtml(pbClasse(p.classe)) : '') + '</div>' +
    (p.trecho ? '<div class="pb-trecho">' + escapeHtml(p.trecho) + '</div>' : '') + '<div class="pb-tags">' + tags + '</div><div class="pb-acts">' + btn + '</div></div>';
}
function pbMarcar(ids, campos){
  ids.forEach(function(id){ var p = pbPub(id); if (p){ if (typeof campos.lida === 'boolean') p.lida = campos.lida; if (typeof campos.semPrazo === 'boolean') p.semPrazo = campos.semPrazo; } });
  pbAtualizarBadge(); if (activeTab === 'publicacoes') pbRender();
  var corpo = { ids: ids }; if (typeof campos.lida === 'boolean') corpo.lida = campos.lida; if (typeof campos.semPrazo === 'boolean') corpo.semPrazo = campos.semPrazo;
  return pbApi('/api/djen/marcar', 'POST', corpo).catch(function(e){ toast('Não consegui salvar: ' + e.message); });
}
function pbIrVinculo(id){ var p = pbPub(id), v = p && pbVinculo(p.processo); if (v) irParaRelacionado(v.tipo, v.id); }
function pbCadastrar(id){
  var p = pbPub(id); if (!p) return;
  if (activeTab !== 'peticoes') setActiveTab('peticoes');
  setTimeout(function(){
    abrirNovo(); qs('processoInput').value = p.numero || p.processo || ''; if (p.classe) qs('nomeAcaoInput').value = p.classe;
    var a = (p.dest || []).filter(function(d){ return d.p === 'A'; })[0]; if (a && a.n && qs('clienteInput')) qs('clienteInput').value = a.n;
  }, 40);
}

/* ---------- detalhe da publicação ---------- */
function pbMontarDetalhe(){
  if (qs('overlayPb')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayPb';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Publicação</h2><button class="icon-btn" id="pbFechar" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="pbCorpo"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#pbFechar'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-pbd]') : null; if (!b) return;
    var a = b.getAttribute('data-pbd');
    if (a === 'confirmar') pbSalvarPrazo(false);
    else if (a === 'naoe'){ pbMarcar([pbDetId], { semPrazo: true, lida: true }); d.classList.remove('show'); toast('Marcada como sem prazo.'); }
    else if (a === 'manual'){ var m = qs('pbManualBox'); m.style.display = m.style.display === 'none' ? '' : 'none'; }
    else if (a === 'copiar'){ var t = (pbTextos[pbDetId] || {}).texto || (pbPub(pbDetId) || {}).trecho || ''; try{ navigator.clipboard.writeText(t); toast('Texto copiado.'); }catch(x){ toast('Não consegui copiar.'); } }
  });
  d.addEventListener('input', function(e){ if (e.target && /^pbf_/.test(e.target.id)) pbAtualizarCalculo(); });
  d.addEventListener('change', function(e){ if (e.target && /^pbf_/.test(e.target.id)) pbAtualizarCalculo(); });
}
function pbAbrirPrazoPub(id){ pbAbrirDetalhe(id, true); }
function pbAbrirDetalhe(id, irParaPrazo){
  var p = pbPub(id); if (!p) return;
  pbMontarDetalhe(); pbDetId = id; pbDesenharDetalhe(); qs('overlayPb').classList.add('show');
  if (!p.lida) pbMarcar([id], { lida: true });
  if (!pbTextos[id]){
    pbApi('/api/djen/texto?id=' + encodeURIComponent(id)).then(function(r){ pbTextos[id] = r; }).catch(function(e){ pbTextos[id] = { ok: false, motivo: e.message }; }).then(function(){ if (pbDetId === id){ pbDesenharDetalhe(); if (irParaPrazo){ var f = qs('pbPrazoBox'); if (f && f.scrollIntoView) f.scrollIntoView(); } } });
  } else if (irParaPrazo) setTimeout(function(){ var f = qs('pbPrazoBox'); if (f && f.scrollIntoView) f.scrollIntoView(); }, 50);
}
function pbDesenharDetalhe(){
  var p = pbPub(pbDetId), c = qs('pbCorpo'); if (!p || !c) return;
  var v = pbVinculo(p.processo), t = pbTextos[p.id], pz = pbPrazoDaPub(p.id), sug = (t && t.ok && t.sug) || p.sug;
  var h = '<div class="pb-cab"><div class="pb-l1"><span>' + escapeHtml(fmtData(p.data) + ' · ' + (p.tribunal || '') + ' · ' + (p.orgao || '')) + '</span></div><div class="pb-cli">' + escapeHtml(pbNomeParte(p, v)) + '</div><div class="pb-proc">' + escapeHtml(p.numero || '') + (p.classe ? ' · ' + escapeHtml(pbClasse(p.classe)) : '') + '</div><div class="pb-tags"><span class="pb-tipo ' + pbClasseTipo(p.tipo) + '">' + escapeHtml(p.tipo || 'Publicação') + '</span>' + (v ? '<span class="pb-tg ok">✓ ' + escapeHtml(v.rotulo.toLowerCase()) + ': ' + escapeHtml(v.cliente) + '</span>' : '<span class="pb-tg nv">+ processo novo</span>') + '</div></div>';
  h += '<div class="pb-sec"><div class="pb-sec-t">Texto da publicação</div>';
  if (!t) h += '<div class="saldo-data">Buscando o texto completo no Diário Oficial…</div><div class="pb-texto">' + escapeHtml(p.trecho || '') + '</div>';
  else if (t.ok) h += '<div class="pb-texto">' + escapeHtml(t.texto) + '</div>';
  else h += '<div class="saldo-data">Não consegui buscar o texto completo (' + escapeHtml(t.motivo || 'erro') + '). Abaixo, o trecho guardado.</div><div class="pb-texto">' + escapeHtml(p.trecho || '') + '</div>';
  h += '<div class="pb-acts">' + (p.link ? '<a class="btn btn-ghost pb-b" href="' + escapeHtml(p.link) + '" target="_blank" rel="noopener noreferrer">Abrir original no tribunal ↗</a>' : '') + '<button type="button" class="btn btn-ghost pb-b" data-pbd="copiar">Copiar texto</button></div></div>';
  h += '<div class="pb-sec pb-ia" id="pbPrazoBox">';
  if (pz){
    h += '<div class="pb-sec-t">Prazo confirmado</div><div class="pb-prazo-ok"><b>' + escapeHtml(fmtData(pz.data)) + '</b> <span>(' + escapeHtml(pbDiaSem(pz.data)) + ')</span><div class="saldo-data">' + escapeHtml(pz.descricao || '') + (pz.concluido ? ' · cumprido' : '') + '</div></div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" id="pbVerPrazo">Abrir prazo</button></div>';
  } else {
    h += '<div class="pb-sec-t">' + (sug ? '✦ Prazo sugerido pelo texto' : 'Prazo desta publicação') + '</div>';
    if (sug) h += '<div class="pb-frase">“…' + escapeHtml(sug.frase) + '…”</div>'; else h += '<div class="saldo-data">Não achei um prazo no texto. Se houver, informe os dias abaixo.</div>';
    h += '<div class="field"><label class="field-label" for="pbf_desc">Descrição</label><input type="text" id="pbf_desc" maxlength="90" value="' + escapeHtml(sug ? 'Prazo de ' + sug.dias + ' dias — ' + (p.tipo || 'publicação') : (p.tipo || 'Prazo')) + '"></div>' +
      '<div class="pb-dois"><div class="field"><label class="field-label" for="pbf_dias">Dias</label><input type="number" id="pbf_dias" min="1" max="365" inputmode="numeric" value="' + (sug ? sug.dias : 15) + '"></div><div class="field"><label class="field-label" for="pbf_tipo">Contagem</label><select id="pbf_tipo" class="filter-select"><option value="uteis"' + (!sug || sug.tipo === 'uteis' ? ' selected' : '') + '>dias úteis</option><option value="corridos"' + (sug && sug.tipo === 'corridos' ? ' selected' : '') + '>dias corridos</option></select></div></div>' +
      '<div class="pb-calc" id="pbCalc"></div><button type="button" class="btn-text" data-pbd="manual">Corrigir a data manualmente</button><div class="field" id="pbManualBox" style="display:none;"><label class="field-label" for="pbf_manual">Data do vencimento (substitui o cálculo)</label><input type="date" id="pbf_manual"></div>' +
      '<div class="pb-aviso">O app só sugere. Confira a contagem (data da publicação, feriados, suspensões e o tipo de prazo) antes de confirmar. Nada entra na Central de atenção sem o seu OK.</div><div class="form-error" id="pbErro"></div>' +
      '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-pbd="confirmar">Confirmar prazo</button>' + (!p.semPrazo ? '<button type="button" class="btn btn-ghost pb-b" data-pbd="naoe">Não é prazo</button>' : '') + '</div>';
  }
  h += '</div>';
  c.innerHTML = h;
  var vp = qs('pbVerPrazo'); if (vp) vp.addEventListener('click', function(){ qs('overlayPb').classList.remove('show'); pbAbrirPrazo(pz.id); });
  if (!pz) pbAtualizarCalculo();
}
function pbAtualizarCalculo(){
  var p = pbPub(pbDetId), el = qs('pbCalc'); if (!p || !el) return;
  var dias = parseInt(qs('pbf_dias').value, 10), tipo = qs('pbf_tipo').value;
  if (!dias || dias < 1){ el.innerHTML = '<span class="saldo-data">Informe os dias.</span>'; return; }
  var r = pbCalcular(p.data, dias, tipo), fora = p.tribunal && p.tribunal !== 'TJGO';
  el.innerHTML = '<div class="pb-lin"><span>Disponibilizada</span><b>' + fmtData(p.data) + '</b></div><div class="pb-lin"><span>Considerada publicada</span><b>' + fmtData(r.pub) + '</b></div><div class="pb-lin"><span>Começa a contar</span><b>' + fmtData(r.ini) + '</b></div><div class="pb-lin pb-venc"><span>Vence em</span><b>' + fmtData(r.venc) + ' <small>(' + pbDiaSem(r.venc) + ')</small></b></div>' +
    (r.obs.length ? '<div class="pb-obs">Atenção: ' + escapeHtml(r.obs.join('; ')) + ' no período. Se o expediente foi suspenso, o prazo pode terminar depois.</div>' : '') +
    '<div class="saldo-data">Calendário: feriados do TJGO' + (Number(r.venc.slice(0, 4)) === 2026 ? ' 2026 (lista oficial)' : ' (regra geral; confira a lista do ano)') + '; recesso de 20/12 a 20/01 não conta.' + (fora ? ' Esta publicação é do ' + escapeHtml(p.tribunal) + ': confira o calendário desse tribunal.' : '') + '</div>';
}
function pbSalvarPrazo(){
  var p = pbPub(pbDetId); if (!p) return;
  var dias = parseInt(qs('pbf_dias').value, 10), tipo = qs('pbf_tipo').value, desc = qs('pbf_desc').value.trim(), manual = qs('pbf_manual').value, err = qs('pbErro');
  if (!dias || dias < 1){ err.textContent = 'Informe os dias do prazo.'; return; }
  if (!desc){ err.textContent = 'Escreva uma descrição.'; return; }
  var r = pbCalcular(p.data, dias, tipo), venc = manual || r.venc, v = pbVinculo(p.processo);
  var doc = { pubId: p.id, processo: p.numero || p.processo, cliente: pbNomeParte(p, v), descricao: desc, dias: dias, contagem: tipo, disp: p.data, inicio: r.ini, data: venc, manual: !!manual, tribunal: p.tribunal || '', concluido: false, criadoEm: new Date().toISOString() };
  pbApi('/api/db/prazosPub', 'POST', doc).then(function(j){
    doc.id = j.id; pbPrazos.push(doc); pbMarcar([p.id], { lida: true, semPrazo: false });
    qs('overlayPb').classList.remove('show'); toast('Prazo confirmado para ' + fmtData(venc) + '.');
    try{ renderPainelAtencao(); }catch(e){} if (activeTab === 'publicacoes') pbRender();
  }).catch(function(e){ err.textContent = 'Não consegui salvar: ' + e.message; });
}

/* ---------- prazo confirmado: Central de atenção, avisos de 10h e tela de ações ---------- */
function pbAvisos(){
  var hoje = todayISO(), lim = somarDias(hoje, 10);
  return pbPrazos.filter(function(x){ return !x.concluido && x.data && x.data <= lim; }).map(function(x){
    return { tipo: 'prazopub', id: x.id, d: x.data, titulo: 'Prazo · ' + (x.cliente || 'Sem nome'), detalhe: (x.descricao || 'Prazo') + ' · ' + (x.data < hoje ? 'venceu em ' : 'vence em ') + fmtData(x.data), atraso: x.data < hoje };
  }).sort(function(a, b){ return a.d.localeCompare(b.d); });
}
function pbLinhaAviso(a){
  var hoje = a.d === todayISO(), urgente = a.atraso || hoje;
  return '<div class="stall-chip pb-aviso' + (urgente ? '' : ' tipo-murilo') + '" data-pb-prazo="' + escapeHtml(a.id) + '"><div class="up-data' + (a.atraso ? ' up-d-atraso' : (hoje ? ' up-d-hoje' : '')) + '"><b>' + a.d.slice(8, 10) + '</b><span>' + MES_CURTO_AT[Number(a.d.slice(5, 7)) - 1].toUpperCase() + '</span></div>' +
    '<div class="up-top"><span>' + escapeHtml(a.titulo) + '</span></div><div class="up-when">' + escapeHtml(a.detalhe) + '</div></div>';
}
function pbItens(hoje, lim){
  return pbPrazos.filter(function(x){ return !x.concluido && x.data && x.data >= hoje && x.data <= lim; }).map(function(x){ return { d: x.data, t: 'prazo', n: x.cliente || 'Sem nome', l: 'Prazo: ' + (x.descricao || 'processual'), v: null }; });
}
function pbMontarPrazo(){
  if (qs('overlayPbPrazo')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayPbPrazo';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="pbpTit">Prazo</h2><button class="icon-btn" id="pbpX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body"><div class="parcela-sum" id="pbpInfo"></div>' +
    '<button type="button" class="btn btn-primary" id="pbpFeito" style="width:100%;justify-content:center;">Marcar como cumprido</button>' +
    '<div class="field"><label class="field-label" for="pbpData">Alterar a data do prazo</label><input type="date" id="pbpData"></div><button type="button" class="btn btn-ghost" id="pbpSalvarData" style="width:100%;justify-content:center;">Salvar nova data</button>' +
    '<button type="button" class="btn btn-ghost" id="pbpVer" style="width:100%;justify-content:center;">Ver a publicação</button><button type="button" class="btn-text" id="pbpExcluir" style="color:var(--urgente)">Excluir este prazo</button><div class="form-error" id="pbpErro"></div></div></div>';
  document.body.appendChild(d);
  adAbrirData(qs('pbpData'));
  d.addEventListener('click', function(e){ if (e.target === d || (e.target.closest && e.target.closest('#pbpX'))) d.classList.remove('show'); });
  qs('pbpFeito').addEventListener('click', function(){ pbAtualizarPrazo({ concluido: true, concluidoEm: todayISO() }, 'Prazo cumprido.'); });
  qs('pbpSalvarData').addEventListener('click', function(){ var n = qs('pbpData').value; if (!n){ qs('pbpErro').textContent = 'Escolha a nova data.'; return; } pbAtualizarPrazo({ data: n, manual: true }, 'Prazo alterado para ' + fmtData(n) + '.'); });
  qs('pbpVer').addEventListener('click', function(){ var x = pbPrazoAtual(); d.classList.remove('show'); if (x && x.pubId){ if (!pbPub(x.pubId)){ toast('A publicação está fora dos últimos 90 dias.'); return; } setActiveTab('publicacoes'); setTimeout(function(){ pbAbrirDetalhe(x.pubId); }, 60); } });
  qs('pbpExcluir').addEventListener('click', function(){
    var b = qs('pbpExcluir'), x = pbPrazoAtual(); if (!x) return;
    if (b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Toque de novo para excluir'; return; }
    pbApi('/api/db/prazosPub/' + encodeURIComponent(x.id), 'DELETE').then(function(){ pbPrazos = pbPrazos.filter(function(y){ return y.id !== x.id; }); d.classList.remove('show'); toast('Prazo excluído.'); try{ renderPainelAtencao(); }catch(e){} if (activeTab === 'publicacoes') pbRender(); }).catch(function(e){ qs('pbpErro').textContent = e.message; });
  });
}
var pbPrazoId = null;
function pbPrazoAtual(){ for (var i = 0; i < pbPrazos.length; i++) if (pbPrazos[i].id === pbPrazoId) return pbPrazos[i]; return null; }
function pbAbrirPrazo(id){
  pbMontarPrazo(); pbPrazoId = id; var x = pbPrazoAtual(); if (!x) return;
  qs('pbpTit').textContent = x.cliente || 'Prazo'; qs('pbpInfo').innerHTML = escapeHtml((x.descricao || 'Prazo') + ' · vence em ' + fmtData(x.data) + ' (' + pbDiaSem(x.data) + ')') + (x.processo ? '<br><span class="saldo-data">' + escapeHtml(x.processo) + '</span>' : '');
  qs('pbpData').value = ''; qs('pbpErro').textContent = ''; qs('pbpExcluir').removeAttribute('data-sure'); qs('pbpExcluir').textContent = 'Excluir este prazo';
  qs('pbpFeito').style.display = x.concluido ? 'none' : ''; qs('pbpVer').style.display = x.pubId ? '' : 'none';
  qs('overlayPbPrazo').classList.add('show');
}
function pbAtualizarPrazo(campos, msg){
  var x = pbPrazoAtual(); if (!x) return;
  var novo = Object.assign({}, x, campos); delete novo.id;
  pbApi('/api/db/prazosPub/' + encodeURIComponent(x.id), 'PUT', novo).then(function(){
    Object.assign(x, campos); qs('overlayPbPrazo').classList.remove('show'); toast(msg); try{ renderPainelAtencao(); }catch(e){} if (activeTab === 'publicacoes') pbRender();
  }).catch(function(e){ qs('pbpErro').textContent = 'Não consegui salvar: ' + e.message; });
}
document.addEventListener('click', function(ev){
  var el = ev.target.closest ? ev.target.closest('[data-pb-prazo]') : null; if (!el) return;
  pbAbrirPrazo(el.getAttribute('data-pb-prazo'));
});

/* ---------- OABs monitoradas ---------- */
function pbMontarOabs(){
  if (qs('overlayPbOab')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayPbOab';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>OABs monitoradas</h2><button class="icon-btn" id="pboX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="pboCorpo"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#pboX'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-pbo]') : null; if (!b) return;
    var a = b.getAttribute('data-pbo'), i = parseInt(b.getAttribute('data-i'), 10);
    pbLerOabs();
    if (a === 'remover'){ pbEdOabs.splice(i, 1); pbDesenharOabs(); }
    else if (a === 'novo'){
      var nome = qs('pbo_nome').value.trim(), num = qs('pbo_num').value.replace(/\D/g, ''), uf = qs('pbo_uf').value.trim().toUpperCase();
      if (!num || !/^[A-Z]{2}$/.test(uf)){ qs('pboErro').textContent = 'Informe o número da OAB e a UF (duas letras).'; return; }
      if (pbEdOabs.some(function(o){ return o.numero === num && o.uf === uf; })){ qs('pboErro').textContent = 'Esta OAB já está na lista.'; return; }
      pbEdOabs.push({ id: '', nome: nome || ('OAB ' + num + '/' + uf), numero: num, uf: uf, ativo: true, escopo: qs('pbo_esc').value, avisar: qs('pbo_av').checked }); pbDesenharOabs();
    }
    else if (a === 'salvar') pbSalvarOabs();
  });
}
function pbAbrirOabs(){ pbMontarOabs(); pbEdOabs = JSON.parse(JSON.stringify(pbS.oabs)); pbDesenharOabs(); qs('overlayPbOab').classList.add('show'); }
function pbLerOabs(){
  pbEdOabs.forEach(function(o, i){
    var a = qs('pbo_at' + i), e = qs('pbo_es' + i), v = qs('pbo_av' + i), n = qs('pbo_nm' + i);
    if (a) o.ativo = a.checked; if (e) o.escopo = e.value; if (v) o.avisar = v.checked; if (n) o.nome = n.value.trim() || o.nome;
  });
}
function pbDesenharOabs(){
  var c = qs('pboCorpo'); if (!c) return;
  var h = '<div class="parcela-sum">O app lê o Diário Oficial de <b>cada OAB abaixo</b> todo dia às <b>10:00</b>. Use para o seu número e para o de advogados com processos em conjunto (sócio, parceiro).</div>';
  h += pbEdOabs.map(function(o, i){
    return '<div class="pb-oab"><div class="pb-oab-top"><div class="field" style="flex:1"><label class="field-label" for="pbo_nm' + i + '">Nome</label><input type="text" id="pbo_nm' + i + '" maxlength="60" value="' + escapeHtml(o.nome) + '"></div><div class="pb-oab-n"><b>OAB ' + escapeHtml(o.numero + '/' + o.uf) + '</b>' + (o.principal ? '<span class="pb-tg ok">principal</span>' : '') + '</div></div>' +
      '<label class="ad-it" style="border:0;padding:4px 0;"><input type="checkbox" id="pbo_at' + i + '"' + (o.ativo ? ' checked' : '') + '><span class="ad-t">Ler esta OAB</span></label>' +
      '<div class="field"><label class="field-label" for="pbo_es' + i + '">Mostrar</label><select id="pbo_es' + i + '" class="filter-select"><option value="tudo"' + (o.escopo === 'tudo' ? ' selected' : '') + '>todas as publicações</option><option value="conjunto"' + (o.escopo === 'conjunto' ? ' selected' : '') + '>só processos em conjunto comigo</option></select></div>' +
      '<label class="ad-it" style="border:0;padding:4px 0;"><input type="checkbox" id="pbo_av' + i + '"' + (o.avisar ? ' checked' : '') + '><span class="ad-t">Avisar no celular quando chegar publicação nova</span></label>' +
      (o.erro ? '<div class="form-error">Última leitura falhou: ' + escapeHtml(o.erro) + '</div>' : '') + (!o.principal ? '<button type="button" class="btn-text" data-pbo="remover" data-i="' + i + '" style="color:var(--urgente)">Remover esta OAB</button>' : '') + '</div>';
  }).join('');
  h += '<div class="pb-oab pb-novo"><div class="pb-sec-t">+ Adicionar advogado</div><div class="field"><label class="field-label" for="pbo_nome">Nome (para você identificar)</label><input type="text" id="pbo_nome" maxlength="60" placeholder="Ex.: Murilo, sócio"></div>' +
    '<div class="pb-dois"><div class="field"><label class="field-label" for="pbo_num">Número da OAB</label><input type="text" id="pbo_num" inputmode="numeric" maxlength="7" placeholder="49308"></div><div class="field"><label class="field-label" for="pbo_uf">UF</label><input type="text" id="pbo_uf" maxlength="2" value="GO" style="text-transform:uppercase"></div></div>' +
    '<div class="field"><label class="field-label" for="pbo_esc">Mostrar</label><select id="pbo_esc" class="filter-select"><option value="conjunto">só processos em conjunto comigo</option><option value="tudo">todas as publicações</option></select></div>' +
    '<label class="ad-it" style="border:0;padding:4px 0;"><input type="checkbox" id="pbo_av" checked><span class="ad-t">Avisar no celular</span></label><button type="button" class="btn btn-ghost" data-pbo="novo" style="width:100%;justify-content:center;">Adicionar à lista</button></div>' +
    '<div class="form-error" id="pboErro"></div><button type="button" class="btn btn-primary" data-pbo="salvar" style="width:100%;justify-content:center;">Salvar e buscar agora</button>';
  c.innerHTML = h;
}
function pbSalvarOabs(){
  var b = document.querySelector('[data-pbo="salvar"]'); b.disabled = true; b.textContent = 'Salvando…';
  pbApi('/api/djen/oabs', 'PUT', { oabs: pbEdOabs }).then(function(r){
    pbS.oabs = r.oabs; qs('overlayPbOab').classList.remove('show'); toast('OABs salvas. Buscando no Diário Oficial…'); return pbBuscarAgora();
  }).catch(function(e){ qs('pboErro').textContent = e.message; b.disabled = false; b.textContent = 'Salvar e buscar agora'; });
}

/* só para os testes automáticos alcançarem o cálculo de prazos */
window.__horusTeste = { pbCalcular: pbCalcular, pbFeriadosGeral: pbFeriadosGeral, pbPascoa: pbPascoa, pbNaoUtil: pbNaoUtil, feriados2026: PB_FERIADOS_2026, ntResumo: function(){ return ntResumo(); }, fmtData: function(d){ return fmtData(d); } };

/* ---------- estilo e partida ---------- */
(function(){
  var st = document.createElement('style');
  st.textContent = '.pb-hero{margin-top:0}.pb-barra{display:flex;gap:8px}.pb-barra .btn{flex:1;justify-content:center}.pb-filtros{display:flex;flex-direction:column;gap:8px}.pb-filtros select,.pb-oab select,.pb-sec select{width:100%}' +
    '.pb-dia{font-size:var(--t2);font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.5px;margin:6px 4px 0}.pb-todas{text-align:right}' +
    '.pb-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:12px 14px 12px 17px;position:relative;overflow:hidden;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,.06))}' +
    '.pb-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--pb-bar,#C4C4CB)}.pb-card.dec{--pb-bar:var(--urgente)}.pb-card.ato{--pb-bar:var(--tutela)}.pb-card.lida{opacity:.62}' +
    '.pb-l1{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:var(--t2);color:var(--ink-soft);font-weight:600}.pb-l1>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.pb-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--info);margin-right:6px}' +
    '.pb-tipo{font-weight:700;font-size:var(--t1);padding:2px 9px;border-radius:99px;background:var(--surface-2);color:var(--ink-soft);white-space:nowrap}.pb-tipo.dec{background:rgba(217,59,59,.12);color:var(--urgente)}.pb-tipo.ato{background:rgba(183,121,30,.14);color:var(--tutela)}' +
    '.pb-cli{font-size:var(--t5);font-weight:700;margin:6px 0 1px;overflow-wrap:anywhere}.pb-proc{font-size:var(--t2);color:var(--ink-soft);margin-bottom:6px;overflow-wrap:anywhere}.pb-trecho{font-size:var(--t3);line-height:1.4;color:var(--ink)}' +
    '.pb-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.pb-tg{font-size:var(--t1);font-weight:600;padding:3px 9px;border-radius:99px;background:var(--surface-2);color:var(--ink-soft);border:0;font-family:inherit}.pb-tg.ok{background:rgba(23,137,90,.13);color:var(--success)}.pb-tg.nv{background:rgba(42,120,214,.13);color:var(--info)}.pb-tg.pz{background:rgba(183,121,30,.14);color:var(--tutela)}' +
    '.pb-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.pb-b{font-size:var(--t3);padding:8px 12px;min-height:0}' +
    '.pb-prazos{padding:0}.pb-prazos-top{width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;background:none;border:0;padding:12px 16px;cursor:pointer;color:var(--ink);font-family:inherit;font-size:var(--t4)}.pb-prazos-top>span:first-child{display:flex;align-items:center;gap:10px}' +
    '.pb-prazo-lin{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 16px;border-top:1px solid var(--border);cursor:pointer}.pb-prazo-tx{display:flex;flex-direction:column;min-width:0}.pb-prazo-tx b{font-size:var(--t4)}.pb-prazo-tx span{font-size:var(--t2);color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.pb-sec{background:var(--surface-2);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}.pb-sec-t{font-size:var(--t2);font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft)}.pb-ia{background:rgba(237,161,0,.10);border:1px solid rgba(201,133,0,.35)}.pb-ia .pb-sec-t{color:var(--accent)}' +
    '.pb-texto{white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--t3);line-height:1.5;max-height:42vh;overflow-y:auto;background:var(--surface);border-radius:10px;padding:10px 12px}.pb-frase{font-size:var(--t3);line-height:1.45;font-style:italic}' +
    '.pb-dois{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pb-calc{display:flex;flex-direction:column}.pb-lin{display:flex;justify-content:space-between;gap:10px;font-size:var(--t3);padding:6px 0;border-top:1px solid var(--border);color:var(--ink-soft)}.pb-lin b{color:var(--ink)}.pb-lin.pb-venc{font-size:var(--t4)}.pb-lin.pb-venc b{color:var(--urgente)}' +
    '.pb-obs{font-size:var(--t2);color:var(--tutela);line-height:1.4;margin-top:6px}.pb-aviso{font-size:var(--t2);color:var(--ink-soft);line-height:1.4}.pb-prazo-ok b{font-size:var(--t7)}' +
    '.pb-oab{background:var(--surface-2);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}.pb-oab-top{display:flex;gap:10px;align-items:flex-end}.pb-oab-n{display:flex;flex-direction:column;align-items:flex-end;gap:4px;padding-bottom:6px;font-size:var(--t3)}';
  document.head.appendChild(st);
  if (window.__SERVIDOR){
    pbCarregarPrazos(); pbCarregar(true);
    document.addEventListener('visibilitychange', function(){ if (!document.hidden){ pbCarregar(true); } });
  }
})();
