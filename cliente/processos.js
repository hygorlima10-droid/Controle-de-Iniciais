/* ============================================================
   PROCESSOS: cadastro dos processos (com ou sem honorários) em uma lista única
   - junta os processos cadastrados "só para acompanhar" com os que já existem como Inicial, Termo de acordo ou Alvará
   - o vínculo é pelo número do processo: ao lançar um acordo ou alvará com o número, ele já aparece na ficha do processo
   - ficha com clientes, honorários (links para Iniciais, Acordos e Alvarás), prazos da Agenda, publicações e observações
   - concluir e arquivar (e reabrir); aparece também em Arquivados e no perfil do cliente
   ============================================================ */
var prDocs = [], prOk = false, prS = { filtro: 'andamento', busca: '', mais: 1 }, prEd = null, prArqNum = null;
var PR_HON = { sem: 'Sem honorários', quitados: 'Honorários já quitados' };
var prModoHon = false, prProximoHon = false;   /* a janela de Inicial aberta para cadastrar os honorários de um processo */
var PR_MOTIVOS = ['Trânsito em julgado / extinto', 'Acordo cumprido', 'Desistência / renúncia ao mandato', 'Outro'];
var PR_COR = { so: '#7C5CD6', caso: '#B7791E', acordo: '#2A78D6', alvara: '#2A78D6' };
function prNum(s){ return normalizarProcesso(s); }
function prCarregar(){
  if (!window.__SERVIDOR){ prOk = true; return Promise.resolve(); }
  return pbApi('/api/db/processos').then(function(r){
    prDocs = (r.docs || []).map(function(d){ var x = d.data || {}; x.id = d.id; return x; }); prOk = true; prDepois();
  }).catch(function(){ prOk = true; prDepois(); });
}
function prDepois(){
  try{ if (activeTab === 'processos') prRender(); }catch(e){ console.error('processos', e); }
  try{ agDepois(); }catch(e){}
  try{ if (activeTab === 'publicacoes') pbRender(); }catch(e){}
  try{ if (qs('overlayClientePerfil') && qs('overlayClientePerfil').classList.contains('show')) renderPerfil(); }catch(e){}
  try{ if (activeTab === 'arquivados') renderArquivados(); }catch(e){}
}

/* ---------- lista única: processos cadastrados + os que vêm das Iniciais, Acordos e Alvarás (pelo número) ---------- */
function prMapa(){
  var m = {}, ordem = [];
  function g(n, numero){ if (!m[n]){ m[n] = { num: n, numero: numero, doc: null, links: [] }; ordem.push(n); } return m[n]; }
  prDocs.forEach(function(d){ var n = prNum(d.numero); if (n) g(n, d.numero).doc = d; });
  casos.forEach(function(c){ var n = prNum(c.numeroProcesso); if (n) g(n, c.numeroProcesso).links.push({ tipo: 'caso', id: c.id, doc: c }); });
  acordos.forEach(function(a){ var n = prNum(a.numeroProcesso); if (n) g(n, a.numeroProcesso).links.push({ tipo: 'acordo', id: a.id, doc: a }); });
  alvaras.forEach(function(a){ var n = prNum(a.numeroProcesso); if (n) g(n, a.numeroProcesso).links.push({ tipo: 'alvara', id: a.id, doc: a }); });
  return { m: m, ordem: ordem };
}
function prClienteIds(r){
  var ids = [];
  function add(l){ idsValidos(l || []).forEach(function(i){ if (ids.indexOf(i) < 0) ids.push(i); }); }
  if (r.doc) add(r.doc.clienteIds);
  r.links.forEach(function(l){ add(l.doc.clienteIds); });
  return ids;
}
function prPartes(r){
  if (r.doc && r.doc.partes) return r.doc.partes;
  for (var i = 0; i < r.links.length; i++){ var l = r.links[i], t = l.tipo === 'caso' ? l.doc.cliente : l.doc.partes; if (t) return t; }
  return '';
}
function prTitulo(r){
  var nomes = prClienteIds(r).map(nomeCliente).filter(Boolean), p = prPartes(r);
  return p || nomes.join(', ') || 'Sem nome';
}
function prArquivado(r){ return !!(r.doc && r.doc.arquivado); }
var PR_LBL = { caso: 'Inicial', acordo: 'Acordo', alvara: 'Alvará' };
function prOrigens(r){
  var o = [], vistos = {};
  r.links.forEach(function(l){ if (l.tipo === 'caso' && l.doc.doProcesso) return; if (!vistos[l.tipo]){ vistos[l.tipo] = 1; o.push(l.tipo); } });
  if (!o.length) o.push('so');
  return o;
}
function prPrazosAbertos(r){ return agItens().filter(function(i){ return !i.concluido && i.processo && prNum(i.processo) === r.num; }); }
function prPubsDe(num){
  return (pbS.pubs || []).filter(function(p){ return (p.processo && prNum(p.processo) === num) || (p.numero && prNum(p.numero) === num); }).sort(function(a, b){ return b.data.localeCompare(a.data) || (b.id > a.id ? 1 : -1); });
}
function prHonChips(r, pm){
  var out = [];
  r.links.forEach(function(l){
    var p = pm[l.tipo + '|' + l.id], d = l.doc, rec = p && p.receber > 0.004, quit = p && p.valor > 0 && !rec;
    if (l.tipo === 'acordo' && d.semHonorarios){ out.push(['sem honorários (acordo)', 'ok']); return; }
    if (l.tipo === 'caso'){
      var t = honorarioPrincipal(d), cls = rec ? (p.atrasado > 0.004 ? 'neg' : 'pend') : (quit ? 'ok' : 'pend');
      out.push([t + (rec ? ' · a receber ' + fmtMoeda(p.receber) : (quit ? ' · quitado' : (d.modalidadeHonorario === 'sem_honorarios' ? '' : ' · a definir'))), d.modalidadeHonorario === 'sem_honorarios' ? 'ok' : cls]); return;
    }
    if (rec) out.push([PR_LBL[l.tipo].toLowerCase() + ': a receber ' + fmtMoeda(p.receber), p.atrasado > 0.004 ? 'neg' : 'pend']);
    else if (quit) out.push([PR_LBL[l.tipo].toLowerCase() + ': honorários quitados', 'ok']);
    else out.push([PR_LBL[l.tipo].toLowerCase() + ': honorários a definir', '']);
  });
  if (!r.links.length) out.push([PR_HON[(r.doc && PR_HON[r.doc.honorarios] ? r.doc.honorarios : 'sem')].toLowerCase(), 'ok']);
  return out;
}
function prReceberTotal(r, pm){ var t = 0; r.links.forEach(function(l){ var p = pm[l.tipo + '|' + l.id]; if (p) t += p.receber; }); return t; }
function prUltAtividade(r){
  var pubs = prPubsDe(r.num), d = pubs.length ? pubs[0].data : '';
  var c = r.doc && r.doc.criadoEm ? String(r.doc.criadoEm).slice(0, 10) : '';
  return d > c ? d : c;
}
function prParado(r, pm){
  if (prArquivado(r) || !pbS.carregado) return false;
  if (prPrazosAbertos(r).length || prReceberTotal(r, pm) > 0.004) return false;
  var u = prUltAtividade(r), lim = pbSoma(todayISO(), -60);
  return !u || u < lim;
}
function prVinculo(proc){
  var n = prNum(proc); if (!n) return null;
  var r = prMapa().m[n]; if (!r) return null;
  var reais = r.links.filter(function(l){ return !(l.tipo === 'caso' && l.doc.doProcesso); });
  var cad = (r.doc || !reais.length) ? 'processo cadastrado' : ({ caso: 'inicial cadastrada', acordo: 'acordo cadastrado', alvara: 'alvará cadastrado' })[reais[0].tipo];
  var nomes = prClienteIds(r).map(nomeCliente).filter(Boolean);
  return { tipo: 'processo', id: n, cliente: nomes.join(', ') || prPartes(r) || 'Sem nome', cadastro: cad, rotulo: (r.doc || !reais.length) ? 'Processo' : PR_LBL[reais[0].tipo], arquivado: prArquivado(r) };
}
/* usado pelos formulários de Inicial, Acordo e Alvará: reconhece o número e oferece os dados */
function prRelacionados(num, tipoAtual, jaTem){
  var r = prMapa().m[num], out = [];
  if (r && r.doc && tipoAtual !== 'processo'){
    var ids = prClienteIds(r), c0 = ids.length ? clienteById(ids[0]) : null;
    out.push({ tipo: 'processo', id: num, titulo: prTitulo(r), sub: 'Processo cadastrado', origem: c0 ? (c0.pagador === 'murilo' ? 'murilo' : 'proprio') : '', clienteIds: ids });
  }
  if (!jaTem && !out.length){
    var pubs = prPubsDe(num);
    if (pubs.length){
      var p = pubs[0], a = (p.dest || []).filter(function(d){ return d.p === 'A'; })[0], re = (p.dest || []).filter(function(d){ return d.p === 'P'; })[0];
      out.push({ tipo: 'publicacao', id: p.id, titulo: a && re ? a.n + ' x ' + re.n : pbNomeParte(p, null), sub: (p.tribunal || '') + ' · ' + (p.orgao || ''), origem: '', clienteIds: [] });
    }
  }
  return out;
}

/* ---------- aba ---------- */
function prMontarTela(){
  var w = qs('prWrap'); if (!w || w.getAttribute('data-ok')) return; w.setAttribute('data-ok', '1');
  w.innerHTML = '<div class="rs-wrap" id="prResumo"></div><div class="ini-acoes"><button type="button" class="acao acao-ouro" data-pr="novo"><svg><use href="#ic-plus"/></svg><span>Novo processo</span></button></div>' +
    '<div class="field" style="margin:0"><input type="text" id="prBusca" placeholder="Buscar por cliente, partes ou número…" autocomplete="off"></div>' +
    '<div class="pb-seg-lin"><div class="segmented" id="prSeg"></div></div><div id="prLista" class="pb-lista"></div>';
  w.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-pr]') : null; if (!b) return;
    var a = b.getAttribute('data-pr'), n = b.getAttribute('data-n');
    if (a === 'novo') prAbrirNovo(null);
    else if (a === 'filtro'){ prS.filtro = b.getAttribute('data-v'); prS.mais = 1; prRender(); }
    else if (a === 'abrir') prAbrir(n);
    else if (a === 'arquivar') prAbrirArquivar(n);
    else if (a === 'reabrir') prReabrir(n);
    else if (a === 'mais'){ prS.mais++; prRenderLista(); }
  });
  qs('prBusca').addEventListener('input', function(){ prS.busca = this.value; prS.mais = 1; prRenderLista(); });
}
function prRender(){
  prMontarTela(); var w = qs('prWrap'); if (!w) return;
  var mp = prMapa(), pm = pendentesPorDoc(), linhas = mp.ordem.map(function(n){ return mp.m[n]; });
  var ativos = linhas.filter(function(r){ return !prArquivado(r); });
  var comPrazo = ativos.filter(function(r){ return prPrazosAbertos(r).length > 0; }).length, parados = ativos.filter(function(r){ return prParado(r, pm); }).length;
  rsResumo('prResumo', { rot: 'Processos em andamento', valor: String(ativos.length), chip: rsChip(linhas.length + (linhas.length === 1 ? ' processo no total' : ' processos no total'), ''),
    tiles: [{ k: 'alert', cor: comPrazo ? '#D93B3B' : '#8A93AD', rot: 'Com prazo aberto', v: String(comPrazo), cls: comPrazo ? 'neg' : '' }, { k: 'clip', cor: '#B7791E', rot: 'Sem andamento há 60 dias', v: String(parados) }] });
  qs('prSeg').innerHTML = [['andamento', 'Em andamento'], ['prazo', 'Com prazo'], ['todos', 'Todos']].map(function(f){ return '<button type="button" class="seg-btn' + (prS.filtro === f[0] ? ' active' : '') + '" data-pr="filtro" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('');
  prRenderLista();
}
function prRenderLista(){
  var box = qs('prLista'); if (!box) return;
  var mp = prMapa(), pm = pendentesPorDoc(), q = normNome(prS.busca), hoje = todayISO();
  var linhas = mp.ordem.map(function(n){ return mp.m[n]; }).filter(function(r){
    var arq = prArquivado(r);
    if (prS.filtro === 'andamento' && arq) return false;
    if (prS.filtro === 'prazo' && (arq || !prPrazosAbertos(r).length)) return false;
    if (q){
      var alvo = normNome([r.numero, prTitulo(r), prClienteIds(r).map(nomeCliente).join(' '), (r.doc && (r.doc.orgao + ' ' + r.doc.classe)) || ''].join(' '));
      if (alvo.indexOf(q) < 0 && (q.replace(/\D/g, '').length < 4 || r.num.indexOf(q.replace(/\D/g, '')) < 0)) return false;
    }
    return true;
  });
  var info = {}; linhas.forEach(function(r){ var pz = prPrazosAbertos(r); info[r.num] = { pz: pz, prox: pz.length ? pz[0].data : '9999', ult: prUltAtividade(r) }; });
  linhas.sort(function(a, b){ return info[a.num].prox.localeCompare(info[b.num].prox) || info[b.num].ult.localeCompare(info[a.num].ult) || prTitulo(a).localeCompare(prTitulo(b), 'pt-BR'); });
  if (!linhas.length){ box.innerHTML = '<div class="financeiro-vazio">' + (prS.busca ? 'Nenhum processo com essa busca.' : (prS.filtro === 'andamento' ? 'Nenhum processo em andamento. Toque em “Novo processo” ou cadastre pela aba Publicações.' : 'Nada aqui.')) + '</div>'; return; }
  var lim = prS.mais * 30;
  box.innerHTML = linhas.slice(0, lim).map(function(r){
    var i = info[r.num], origens = prOrigens(r), arq = prArquivado(r), pubs = prPubsDe(r.num), tags = '';
    var orgao = r.doc ? [r.doc.orgao, r.doc.classe].filter(Boolean).join(' · ') : (pubs[0] ? [pubs[0].tribunal, pubs[0].orgao].filter(Boolean).join(' · ') : '');
    if (i.pz.length) tags += '<span class="pb-tg" style="background:rgba(217,59,59,.12);color:var(--urgente)">' + i.pz.length + (i.pz.length === 1 ? ' prazo aberto' : ' prazos abertos') + '</span>';
    if (pubs.length) tags += '<span class="pb-tg">última publicação ' + fmtData(pubs[0].data).slice(0, 5) + '</span>';
    prHonChips(r, pm).forEach(function(c){ tags += '<span class="pb-tg ' + (c[1] === 'ok' ? 'ok' : (c[1] === 'neg' ? '' : (c[1] === 'pend' ? 'nv' : ''))) + '"' + (c[1] === 'neg' ? ' style="background:rgba(217,59,59,.12);color:var(--urgente)"' : '') + '>' + escapeHtml(c[0]) + '</span>'; });
    if (prParado(r, pm)) tags += '<span class="pb-tg pz">sem andamento há 60 dias · arquivar?</span>';
    if (arq) tags += '<span class="pb-tg">arquivado' + (r.doc.motivoArquivo ? ' · ' + escapeHtml(r.doc.motivoArquivo) : '') + '</span>';
    var emb = origens.map(function(o){ return o === 'so' ? 'Só processo' : PR_LBL[o]; }).join(' · ');
    return '<div class="pb-card pr-card' + (arq ? ' lida' : '') + '" style="--pb-bar:' + PR_COR[origens[0]] + '" data-pr-card="' + escapeHtml(r.num) + '"><div class="pb-l1"><span>' + escapeHtml(orgao || 'Processo') + '</span><span class="pb-tipo">' + escapeHtml(emb) + '</span></div>' +
      '<div class="pb-cli">' + escapeHtml(prTitulo(r)) + '</div><div class="pb-proc">' + escapeHtml(r.numero) + '</div><div class="pb-tags">' + tags + '</div>' +
      '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-pr="abrir" data-n="' + escapeHtml(r.num) + '">Abrir</button>' + (arq ? '<button type="button" class="btn btn-ghost pb-b" data-pr="reabrir" data-n="' + escapeHtml(r.num) + '">Reabrir</button>' : '<button type="button" class="btn btn-ghost pb-b" data-pr="arquivar" data-n="' + escapeHtml(r.num) + '">Concluir e arquivar</button>') + '</div></div>';
  }).join('') + (linhas.length > lim ? '<button type="button" class="btn btn-ghost" data-pr="mais" style="width:100%;justify-content:center;">Mostrar mais (' + (linhas.length - lim) + ')</button>' : '');
}

/* ---------- ficha e cadastro ---------- */
function prMontarFicha(){
  if (qs('overlayPr')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayPr';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="prTit">Processo</h2><button class="icon-btn" id="prX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="prCorpo"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#prX'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-prf]') : null; if (!b) return;
    var a = b.getAttribute('data-prf'), v = b.getAttribute('data-v');
    if (a === 'cli-rm'){ prEd.ids = prEd.ids.filter(function(x){ return x !== v; }); prChips(); }
    else if (a === 'cli-add'){ if (prEd.ids.indexOf(v) < 0) prEd.ids.push(v); qs('pr_cli').value = ''; prSug(); prChips(); }
    else if (a === 'sug-add'){ var nm = prEd.pre.nomes[Number(b.getAttribute('data-i'))]; if (prEd.ids.indexOf(v) < 0) prEd.ids.push(v); prAprenderApelido(v, nm); prChips(); toast('Vinculado. Da próxima vez “' + cliTitulo(nm).slice(0, 40) + '” já é reconhecido.'); }
    else if (a === 'sug-new'){ var nm2 = prEd.pre.nomes[Number(b.getAttribute('data-i'))]; abrirClienteEdit({ nome: cliTitulo(nm2), pagador: 'cliente', aoSalvar: function(c){ if (prEd.ids.indexOf(c.id) < 0) prEd.ids.push(c.id); prChips(); } }); }
    else if (a === 'cli-new'){
      var nome = qs('pr_cli').value.trim(); qs('pr_cli').value = ''; prSug();
      abrirClienteEdit({ nome: nome, pagador: 'cliente', aoSalvar: function(c){ if (prEd.ids.indexOf(c.id) < 0) prEd.ids.push(c.id); prChips(); } });
    }
    else if (a === 'salvar') prSalvar();
    else if (a === 'arquivar'){ var n = prEd.num; d.classList.remove('show'); prAbrirArquivar(n); }
    else if (a === 'reabrir'){ prReabrir(prEd.num); d.classList.remove('show'); }
    else if (a === 'excluir') prExcluir(b);
    else if (a === 'link'){ d.classList.remove('show'); var p = v.split('|'), dc = p[0] === 'peticao' ? docDe('caso', p[1]) : null; if (dc && dc.doProcesso) abrirEdicao(dc.id); else irParaRelacionado(p[0], p[1]); }   /* honorários do processo editam na própria janela */
    else if (a === 'novo-hon') prNovoHonorario(v);
    else if (a === 'prazo-novo'){ var nn = prEd.num; d.classList.remove('show'); agAbrir(null); var r = prMapa().m[nn]; qs('age_proc').value = r ? r.numero : ''; qs('age_proc').dispatchEvent(new Event('input', { bubbles: true })); }
    else if (a === 'prazo-abrir'){ d.classList.remove('show'); agAbrir(v); }
    else if (a === 'pub'){ d.classList.remove('show'); setActiveTab('publicacoes'); setTimeout(function(){ pbAbrirDetalhe(v); }, 80); }
    else if (a === 'pubs-todas'){ d.classList.remove('show'); pbS.f = { q: v, de: '', ate: '', oab: 'todas', adv: '', trib: '' }; pbS.filtro = 'todas'; pbS.fAberto = true; setActiveTab('publicacoes'); }
    else if (a === 'cliente'){ d.classList.remove('show'); abrirPerfilCliente(v); }
  });
  d.addEventListener('input', function(e){ if (e.target && e.target.id === 'pr_cli') prSug(); if (e.target && e.target.id === 'pr_numero') prInfoNumero(); });
  d.addEventListener('focusin', function(e){ if (e.target && e.target.id === 'pr_cli') prSug(); });
}
function prInfoNumero(){
  var el = qs('pr_numinfo'), a = cnjAnalisar(qs('pr_numero').value); if (!el) return;
  el.className = 'saldo-data'; el.textContent = '';
  if (!a) return;
  if (!a.completo){ el.textContent = a.soNumeros ? 'Tem ' + a.digitos + ' dígitos; o padrão do CNJ tem 20.' : ''; return; }
  if (a.valido){ el.style.color = 'var(--success)'; el.textContent = '✓ Número válido' + (a.sigla ? ' · ' + a.sigla : '') + (a.justica ? ' · ' + a.justica : '') + ' · ano ' + a.ano; }
  else { el.style.color = 'var(--urgente)'; el.textContent = 'O dígito verificador não confere (o certo seria ' + a.dvCerto + ').'; }
}
function prChips(){
  var el = qs('pr_chips'); if (!el) return;
  prRefazPartesPub();
  el.innerHTML = prEd.ids.map(function(id){ return '<span class="cli-chip">' + escapeHtml(nomeCliente(id)) + '<button type="button" data-prf="cli-rm" data-v="' + escapeHtml(id) + '" title="Remover">×</button></span>'; }).join('');
}
function prSug(){
  var inp = qs('pr_cli'), sug = qs('pr_sug'); if (!inp || !sug) return;
  var q = inp.value.trim(), nq = normNome(q);
  var lista = clientes.filter(function(c){ return !c.arquivado && prEd.ids.indexOf(c.id) < 0 && (!nq || normNome(c.nome).indexOf(nq) >= 0); }).sort(function(a, b){ return a.nome.localeCompare(b.nome, 'pt-BR'); }).slice(0, 6);
  var h = lista.map(function(c){ return '<div class="cli-sug-item" data-prf="cli-add" data-v="' + escapeHtml(c.id) + '"><b>' + escapeHtml(c.nome) + '</b></div>'; }).join('');
  if (q && !clientes.some(function(c){ return normNome(c.nome) === nq; })) h += '<div class="cli-sug-item novo" data-prf="cli-new" data-v="1">+ Cadastrar “' + escapeHtml(q) + '”</div>';
  sug.innerHTML = h; sug.style.display = h ? '' : 'none';
}
function prAbrir(num){
  var r = prMapa().m[num]; if (!r){ toast('Processo não encontrado.'); return; }
  prEd = { num: num, novo: false, ids: prClienteIds(r).slice() }; prMontarFicha(); prDesenhar(); qs('overlayPr').classList.add('show'); qs('prCorpo').scrollTop = 0;
}
function prAbrirNovo(pre){
  prEd = { num: '', novo: true, ids: (pre && pre.ids) ? pre.ids.slice() : [], pre: pre || {} }; prMontarFicha(); prDesenhar(); qs('overlayPr').classList.add('show'); qs('prCorpo').scrollTop = 0;
}
function prDesenhar(){
  var novo = prEd.novo, r = novo ? null : prMapa().m[prEd.num], doc = r ? r.doc : null, pre = prEd.pre || {};
  if (!novo && !r) return;
  var pm = pendentesPorDoc(), arq = r && prArquivado(r);
  qs('prTit').textContent = novo ? 'Cadastrar processo' : 'Processo';
  var h = '';
  if (novo) h += '<div class="parcela-sum">Para processos que já existem e você só quer acompanhar (publicações, prazos). Honorários a receber ficam em Iniciais, Termos de Acordo ou Alvarás.</div>';
  h += '<div class="field"><label class="field-label" for="pr_numero">Número do processo</label><input type="text" id="pr_numero" maxlength="40" value="' + escapeHtml(novo ? (pre.numero || '') : r.numero) + '"' + (novo ? ' placeholder="0000000-00.0000.0.00.0000"' : ' readonly') + '><div class="saldo-data" id="pr_numinfo"></div></div>' +
    '<div class="field"><label class="field-label" for="pr_partes">Partes / descrição</label><input type="text" id="pr_partes" maxlength="120" value="' + escapeHtml(novo ? (pre.partes || '') : (doc ? (doc.partes || '') : prPartes(r))) + '" placeholder="Ex.: Fulano de Tal x Banco Exemplo"></div>' +
    '<div class="field"><label class="field-label" for="pr_orgao">Tribunal / órgão</label><input type="text" id="pr_orgao" maxlength="120" value="' + escapeHtml(novo ? (pre.orgao || '') : (doc ? (doc.orgao || '') : '')) + '" placeholder="Ex.: TJGO · Morrinhos 1ª Vara Cível"></div>' +
    '<div class="field"><label class="field-label" for="pr_classe">Classe / assunto</label><input type="text" id="pr_classe" maxlength="120" value="' + escapeHtml(novo ? (pre.classe || '') : (doc ? (doc.classe || '') : '')) + '" placeholder="Ex.: Cumprimento de sentença"></div>' +
    '<div class="field"><label class="field-label">Clientes vinculados</label><div class="cli-picker"><div class="cli-chips" id="pr_chips"></div><input type="text" id="pr_cli" class="cli-pick-input" placeholder="Buscar ou cadastrar cliente…" autocomplete="off"><div class="cli-sug" id="pr_sug" style="display:none;"></div></div></div>' + (novo && pre.nomes && pre.nomes.length ? '<div id="pr_partesPub"></div>' : '');
  if (!novo){
    h += '<div class="pb-sec"><div class="pb-sec-t">Honorários que vou receber</div>';
    if (r.links.length){
      h += r.links.map(function(l){
        var p = pm[l.tipo + '|' + l.id], d = l.doc, rec = p && p.receber > 0.004, quit = p && p.valor > 0 && !rec;
        var txt, nome;
        if (l.tipo === 'caso'){ nome = d.doProcesso ? 'Honorários do processo' : 'Inicial · ' + (d.nomeAcao || 'Inicial'); txt = honorarioPrincipal(d) + (rec ? ' · a receber ' + fmtMoeda(p.receber) : (quit ? ' · quitado ✓' : (d.modalidadeHonorario === 'sem_honorarios' ? '' : ' · a definir'))); }
        else { nome = PR_LBL[l.tipo] + ' · ' + (l.tipo === 'acordo' ? 'Termo de acordo' : 'Alvará'); txt = (l.tipo === 'acordo' && d.semHonorarios) ? 'sem honorários' : (rec ? 'a receber ' + fmtMoeda(p.receber) : (quit ? 'quitado ✓' : 'a definir')); }
        return '<div class="pb-lin"><span><b style="color:var(--ink)">' + escapeHtml(nome) + '</b><br><span class="saldo-data">' + escapeHtml(txt) + (d.arquivado ? ' · arquivado' : '') + '</span></span><button type="button" class="btn btn-ghost pb-b" data-prf="link" data-v="' + (l.tipo === 'caso' ? 'peticao' : l.tipo) + '|' + escapeHtml(l.id) + '">' + (l.tipo === 'caso' && d.doProcesso ? 'Editar' : 'Abrir') + ' ›</button></div>';
      }).join('');
    } else {
      h += '<div class="field"><label class="field-label" for="pr_hon">Situação</label><select id="pr_hon" class="filter-select" style="width:100%">' + ['sem', 'quitados'].map(function(k){ return '<option value="' + k + '"' + (((doc && doc.honorarios) || 'sem') === k ? ' selected' : '') + '>' + PR_HON[k] + '</option>'; }).join('') + '<option value="receber">Tenho honorários a receber (fixo, êxito…)</option></select></div>';
    }
    h += '<div class="field"><label class="field-label" for="pr_honobs">Observação sobre o contrato (opcional)</label><input type="text" id="pr_honobs" maxlength="160" value="' + escapeHtml((doc && doc.honObs) || '') + '" placeholder="Ex.: contrato assinado em 10/03/2024"></div>' +
      '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-prf="novo-hon" data-v="caso">+ Honorários (fixo, êxito…)</button><button type="button" class="btn btn-ghost pb-b" data-prf="novo-hon" data-v="acordo">+ Termo de acordo</button><button type="button" class="btn btn-ghost pb-b" data-prf="novo-hon" data-v="alvara">+ Alvará</button></div></div>';
    var pz = prPrazosAbertos(r);
    h += '<div class="pb-sec"><div class="pb-sec-t">Prazos e audiências (Agenda)</div>' + (pz.length ? pz.map(function(i){ var c = agChip(i); return '<div class="pb-lin"><span><b style="color:var(--ink)">' + escapeHtml(i.titulo) + '</b><br><span class="saldo-data">' + escapeHtml(agTipoLinha(i)) + '</span></span><button type="button" class="btn btn-ghost pb-b" data-prf="prazo-abrir" data-v="' + escapeHtml(i.key) + '">' + escapeHtml(c.t) + ' ›</button></div>'; }).join('') : '<div class="saldo-data">Nenhum prazo aberto.</div>') +
      '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-prf="prazo-novo">+ Novo prazo deste processo</button></div></div>';
    var pubs = prPubsDe(r.num).slice(0, 5);
    h += '<div class="pb-sec"><div class="pb-sec-t">Últimas publicações</div>' + (pubs.length ? pubs.map(function(p){ return '<div class="pb-lin"><span><b style="color:var(--ink)">' + escapeHtml(fmtData(p.data).slice(0, 5) + ' · ' + (p.tipo || 'Publicação')) + '</b><br><span class="saldo-data">' + escapeHtml((p.trecho || '').slice(0, 90)) + '</span></span><button type="button" class="btn-text pb-b" data-prf="pub" data-v="' + escapeHtml(p.id) + '">ver ›</button></div>'; }).join('') + '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-prf="pubs-todas" data-v="' + escapeHtml(r.num) + '">Ver todas deste processo</button></div>' : '<div class="saldo-data">Nenhuma publicação nos últimos 90 dias.</div>') + '</div>';
  }
  h += '<div class="field"><label class="field-label" for="pr_obs">Observações</label><textarea id="pr_obs" rows="3" maxlength="600" placeholder="Anotações sobre o processo">' + escapeHtml(novo ? '' : ((doc && doc.obs) || '')) + '</textarea></div>';
  if (novo) h += '<div class="field"><label class="field-label" for="pr_hon">Honorários</label><select id="pr_hon" class="filter-select" style="width:100%">' + ['sem', 'quitados'].map(function(k){ return '<option value="' + k + '">' + PR_HON[k] + '</option>'; }).join('') + '<option value="receber">Tenho honorários a receber (fixo, êxito…)</option></select><div class="saldo-data">Ao escolher a última opção, depois de salvar abre o cadastro dos honorários.</div></div>';
  h += '<div class="form-error" id="pr_erro"></div><button type="button" class="btn btn-primary" data-prf="salvar" style="width:100%;justify-content:center;">' + (novo ? 'Cadastrar processo' : 'Salvar') + '</button>';
  if (!novo) h += (arq ? '<button type="button" class="btn btn-ghost" data-prf="reabrir" style="width:100%;justify-content:center;">Reabrir processo</button>' : '<button type="button" class="btn btn-ghost" data-prf="arquivar" style="width:100%;justify-content:center;">Concluir e arquivar</button>') + (doc && !r.links.length ? '<button type="button" class="btn-text" data-prf="excluir" style="color:var(--urgente)">Excluir este processo</button>' : '');
  qs('prCorpo').innerHTML = h; prChips(); prInfoNumero();
}
function prSalvar(){
  var novo = prEd.novo, err = qs('pr_erro'), numero = qs('pr_numero').value.trim();
  if (!numero){ err.textContent = 'Informe o número do processo.'; return; }
  var a = cnjAnalisar(numero); if (a && a.completo) numero = a.formatado;
  var n = prNum(numero), mp = prMapa(), ex = mp.m[n];
  if (novo && ex && ex.doc){ err.textContent = 'Este processo já está cadastrado.'; return; }
  var campos = { numero: numero, partes: qs('pr_partes').value.trim(), orgao: qs('pr_orgao').value.trim(), classe: qs('pr_classe').value.trim(), clienteIds: prEd.ids.slice(), obs: qs('pr_obs').value.trim() };
  var hon = qs('pr_hon'), querHon = hon && hon.value === 'receber'; if (hon) campos.honorarios = querHon ? ((ex && ex.doc && PR_HON[ex.doc.honorarios]) ? ex.doc.honorarios : 'sem') : hon.value;
  var ho = qs('pr_honobs'); if (ho) campos.honObs = ho.value.trim();
  var doc = ex && ex.doc, p;
  if (doc){ var novoDoc = Object.assign({}, doc, campos); delete novoDoc.id; p = pbApi('/api/db/processos/' + encodeURIComponent(doc.id), 'PUT', novoDoc).then(function(){ Object.assign(doc, campos); }); }
  else {
    var d = Object.assign({ honorarios: 'sem', arquivado: false, origem: (prEd.pre && prEd.pre.origem) || 'manual', criadoEm: new Date().toISOString() }, campos);
    if (!novo) d.derivado = true;
    p = pbApi('/api/db/processos', 'POST', d).then(function(j){ d.id = j.id; prDocs.push(d); });
  }
  p.then(function(){ qs('overlayPr').classList.remove('show'); toast(novo ? 'Processo cadastrado.' : 'Salvo.'); prDepois(); if (querHon){ prEd = { num: n, novo: false, ids: [] }; setTimeout(function(){ prNovoHonorario('caso'); }, 80); } }).catch(function(e){ err.textContent = 'Não consegui salvar: ' + e.message; });
}
function prExcluir(b){
  var r = prMapa().m[prEd.num]; if (!r || !r.doc) return;
  if (b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Toque de novo para excluir'; return; }
  pbApi('/api/db/processos/' + encodeURIComponent(r.doc.id), 'DELETE').then(function(){ prDocs = prDocs.filter(function(x){ return x.id !== r.doc.id; }); qs('overlayPr').classList.remove('show'); toast('Processo excluído.'); prDepois(); }).catch(function(e){ qs('pr_erro').textContent = e.message; });
}
function prNovoHonorario(tipo){
  var r = prMapa().m[prEd.num]; if (!r) return;
  var numero = r.numero, doc = r.doc, ids = prClienteIds(r);
  qs('overlayPr').classList.remove('show');
  if (tipo === 'caso'){
    prProximoHon = true; abrirNovo();   /* a janela abre por cima da aba atual: ao fechar, a pessoa continua em Processos */
    qs('processoInput').value = numero; qs('clienteInput').value = prTitulo(r);
    pickerDefinir('caso', ids);
    var c0 = ids.length ? clienteById(ids[0]) : null; if (c0){ formState.origem = c0.pagador === 'murilo' ? 'murilo' : 'proprio'; setSegValue('segOrigem', formState.origem); }
    if (doc && doc.classe) qs('nomeAcaoInput').value = doc.classe;
  }
  else if (tipo === 'acordo'){ abrirNovoAcordo(); qs('acordoProcessoInput').value = numero; qs('acordoProcessoInput').dispatchEvent(new Event('blur')); }
  else { abrirNovoAlvara(); qs('alvaraProcessoInput').value = numero; qs('alvaraProcessoInput').dispatchEvent(new Event('blur')); }
}
/* a janela de Inicial serve também para os honorários de um processo: título próprio e sem a escolha de tipo */
function prAplicaModoHon(){
  var seg = qs('segTipo'), fld = seg && seg.closest ? seg.closest('.field') : null;
  if (prModoHon){ qs('modalTitle').textContent = qs('modalTitle').textContent.indexOf('Editar') === 0 ? 'Editar honorários do processo' : 'Honorários do processo'; if (fld) fld.style.display = 'none'; }
  else if (fld) fld.style.display = '';
}
function prIrParaHonorario(c){
  var n = prNum(c.numeroProcesso);
  if (n && prMapa().m[n]){ setActiveTab('processos'); setTimeout(function(){ prAbrir(n); }, 40); }
  else abrirEdicao(c.id);
}
(function(){
  var oN = abrirNovo, oE = abrirEdicao;
  abrirNovo = function(){ prModoHon = !!prProximoHon; prProximoHon = false; var r = oN.apply(this, arguments); prAplicaModoHon(); return r; };
  abrirEdicao = function(id){ var c = casos.filter(function(x){ return x.id === id; })[0]; prModoHon = !!(c && c.doProcesso); var r = oE.apply(this, arguments); prAplicaModoHon(); return r; };
  /* quando a janela de Inicial fecha (salvar, cancelar ou X): volta ao normal e atualiza a aba Processos */
  var ov = qs('overlay'), aberto = false;
  if (ov && window.MutationObserver) new MutationObserver(function(){
    var agora = ov.classList.contains('show');
    if (aberto && !agora){ prModoHon = false; prAplicaModoHon(); try{ prDepois(); }catch(e){} }
    aberto = agora;
  }).observe(ov, { attributes: true, attributeFilter: ['class'] });
  var oRP = renderPainelAtencao;
  renderPainelAtencao = function(){ var r = oRP.apply(this, arguments); try{ if (activeTab === 'processos') prRender(); }catch(e){} return r; };
})();

/* ---------- arquivar e reabrir ---------- */
function prMontarArq(){
  if (qs('overlayPrArq')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayPrArq';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Concluir e arquivar</h2><button class="icon-btn" id="praX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="praCorpo"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#praX'))){ d.classList.remove('show'); return; }
    if (e.target.closest && e.target.closest('#praOk')) prConfirmarArq();
  });
}
function prAbrirArquivar(num){
  var r = prMapa().m[num]; if (!r) return;
  prMontarArq(); prArqNum = num;
  var pm = pendentesPorDoc(), pz = prPrazosAbertos(r).length, nl = prPubsDe(num).filter(function(p){ return !p.lida; }).length, rec = prReceberTotal(r, pm);
  var h = '<div class="parcela-sum"><b>' + escapeHtml(prTitulo(r)) + '</b><br>' + escapeHtml(r.numero) + '</div>' +
    '<div class="pb-sec"><div class="pb-sec-t">Antes de arquivar</div><div class="pb-lin"><span>Prazos abertos na Agenda</span><b style="color:' + (pz ? 'var(--urgente)' : 'var(--ink)') + '">' + pz + '</b></div><div class="pb-lin"><span>Publicações não lidas</span><b>' + nl + '</b></div><div class="pb-lin"><span>Honorários ainda a receber</span><b>' + fmtMoeda(rec) + '</b></div></div>' +
    (pz ? '<div class="form-error">Há prazo aberto. Enquanto o processo estiver arquivado, ele some da Agenda e dos avisos.</div>' : '') +
    (rec > 0.004 ? '<div class="saldo-data">Os honorários a receber continuam na Central de atenção mesmo com o processo arquivado.</div>' : '') +
    '<div class="field"><label class="field-label">Motivo</label>' + PR_MOTIVOS.map(function(m, i){ return '<label class="ad-it" style="border:0;padding:6px 0;"><input type="radio" name="pra_mot" value="' + escapeHtml(m) + '"' + (i === 0 ? ' checked' : '') + '><span class="ad-t">' + escapeHtml(m) + '</span></label>'; }).join('') + '</div>' +
    '<div class="field"><label class="field-label" for="pra_data">Data</label><input type="date" id="pra_data" value="' + todayISO() + '"></div>' +
    '<div class="saldo-data">Se chegar publicação nova deste processo, o app avisa e você pode reabrir.</div><div class="form-error" id="pra_erro"></div><button type="button" class="btn btn-primary" id="praOk" style="width:100%;justify-content:center;">Arquivar processo</button>';
  qs('praCorpo').innerHTML = h; adAbrirData(qs('pra_data')); qs('overlayPrArq').classList.add('show');
}
function prConfirmarArq(){
  var r = prMapa().m[prArqNum]; if (!r) return;
  var mot = (document.querySelector('input[name="pra_mot"]:checked') || {}).value || '', data = qs('pra_data').value || todayISO(), agora = new Date().toISOString();
  var campos = { arquivado: true, arquivadoEm: agora, dataArquivo: data, motivoArquivo: mot }, p;
  if (r.doc){ var nd = Object.assign({}, r.doc, campos); delete nd.id; p = pbApi('/api/db/processos/' + encodeURIComponent(r.doc.id), 'PUT', nd).then(function(){ Object.assign(r.doc, campos); }); }
  else {
    var d = Object.assign({ numero: r.numero, partes: '', orgao: '', classe: '', clienteIds: [], obs: '', honorarios: 'sem', origem: 'manual', derivado: true, criadoEm: agora }, campos);
    p = pbApi('/api/db/processos', 'POST', d).then(function(j){ d.id = j.id; prDocs.push(d); });
  }
  p.then(function(){
    return Promise.all(r.links.filter(function(l){ return !l.doc.arquivado; }).map(function(l){ return persistPatchDoc(l.tipo, l.doc, { arquivado: true, arquivadoEm: agora }); }));
  }).then(function(){
    qs('overlayPrArq').classList.remove('show'); toast('Processo arquivado.', 'Desfazer', function(){ prReabrir(r.num); }); prDepois();
  }).catch(function(e){ qs('pra_erro').textContent = 'Não consegui arquivar: ' + e.message; });
}
function prReabrir(num){
  var r = prMapa().m[num]; if (!r || !r.doc) return Promise.resolve();
  var campos = { arquivado: false, arquivadoEm: null, dataArquivo: '', motivoArquivo: '' }, nd = Object.assign({}, r.doc, campos); delete nd.id;
  return pbApi('/api/db/processos/' + encodeURIComponent(r.doc.id), 'PUT', nd).then(function(){
    Object.assign(r.doc, campos);
    return Promise.all(r.links.filter(function(l){ return l.doc.arquivado; }).map(function(l){ return persistPatchDoc(l.tipo, l.doc, { arquivado: false, arquivadoEm: null }); }));
  }).then(function(){ toast('Processo reaberto.'); prDepois(); }).catch(function(e){ toast('Não consegui reabrir: ' + e.message); });
}
function prArquivadosSet(){ var s = {}; prDocs.forEach(function(d){ if (d.arquivado){ var n = prNum(d.numero); if (n) s[n] = 1; } }); return s; }

/* ---------- reconhecer o cliente pelo nome que vem na publicação (nome completo x abreviação) ---------- */
var CLI_STOP = { de: 1, da: 1, do: 1, dos: 1, das: 1, e: 1, a: 1, o: 1, ltda: 1, me: 1, epp: 1, sa: 1, eireli: 1, s: 1, em: 1, para: 1 };
function cliTokens(s){ return normNome(s).split(' ').filter(function(t){ return t && !CLI_STOP[t]; }); }
/* 3 = mesmo nome (ou apelido igual); 2 = um nome é abreviação do outro; 1 = muito parecido; 0 = outro nome */
function cliNivel(nomePub, nomeCli){
  var a = cliTokens(nomePub), b = cliTokens(nomeCli); if (!a.length || !b.length) return 0;
  var sa = {}, sb = {}; a.forEach(function(t){ sa[t] = 1; }); b.forEach(function(t){ sb[t] = 1; });
  var ua = Object.keys(sa), ub = Object.keys(sb), comum = ua.filter(function(t){ return sb[t]; }).length, menor = Math.min(ua.length, ub.length);
  if (comum === ua.length && comum === ub.length) return 3;
  if (comum === ub.length) return (ub.length >= 2 || ub[0].length >= 4) ? 2 : 0;
  if (comum === ua.length) return (ua.length >= 2 || ua[0].length >= 4) ? 2 : 0;
  return (comum >= 2 && comum / menor >= 0.6) ? 1 : 0;
}
function cliParecidos(nomePub){
  var out = [];
  clientes.forEach(function(c){
    if (c.arquivado) return;
    var n = cliNivel(nomePub, c.nome); (c.apelidos || []).forEach(function(ap){ var x = cliNivel(nomePub, ap); if (x > n) n = x; });
    if (n > 0) out.push({ c: c, nivel: n });
  });
  out.sort(function(x, y){ return y.nivel - x.nivel || cliTokens(y.c.nome).length - cliTokens(x.c.nome).length || x.c.nome.localeCompare(y.c.nome, 'pt-BR'); });
  return out;
}
function cliProvaveis(nomes){
  var vistos = {}, out = [];
  nomes.forEach(function(n){ cliParecidos(n).forEach(function(m){ if (m.nivel >= 2 && !vistos[m.c.id]){ vistos[m.c.id] = 1; out.push(m.c); } }); });
  return out;
}
function cliTitulo(s){
  return String(s || '').toLowerCase().replace(/(^|[\s\-\/\(])([a-zà-ú])/g, function(m, a, b){ return a + b.toUpperCase(); }).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, function(x){ return x.toLowerCase(); });
}
function prAprenderApelido(clienteId, nomePub){
  var c = clienteById(clienteId); if (!c) return;
  var obj = JSON.parse(JSON.stringify(c)), ap = obj.apelidos || [];
  if (normNome(nomePub) === normNome(obj.nome) || ap.some(function(x){ return normNome(x) === normNome(nomePub); })) return;
  ap.push(cliTitulo(nomePub)); obj.apelidos = ap; persistClienteSet(obj);
}
function prPartesPubHtml(){
  var nomes = (prEd.pre && prEd.pre.nomes) || []; if (!nomes.length) return '';
  var h = '<div class="pb-sec"><div class="pb-sec-t">Partes que aparecem na publicação</div><div class="saldo-data">Vincule cada parte ao cliente certo, ou cadastre as que ainda não são clientes.</div>';
  nomes.forEach(function(n, i){
    var ms = cliParecidos(n), ligado = ms.filter(function(m){ return prEd.ids.indexOf(m.c.id) >= 0; })[0];
    h += '<div class="pb-lin" style="flex-direction:column;align-items:stretch;gap:6px"><b style="color:var(--ink)">' + escapeHtml(n) + '</b>';
    if (ligado) h += '<span class="pb-tg ok" style="align-self:flex-start">✓ cliente: ' + escapeHtml(ligado.c.nome) + '</span>';
    else {
      h += '<div class="pb-acts" style="margin:0">' + ms.filter(function(m){ return m.nivel >= 1 && prEd.ids.indexOf(m.c.id) < 0; }).slice(0, 2).map(function(m){ return '<button type="button" class="btn btn-primary pb-b" data-prf="sug-add" data-i="' + i + '" data-v="' + escapeHtml(m.c.id) + '">É o cliente ' + escapeHtml(m.c.nome) + '</button>'; }).join('') +
        '<button type="button" class="btn btn-ghost pb-b" data-prf="sug-new" data-i="' + i + '">+ Cadastrar como cliente</button></div>';
    }
    h += '</div>';
  });
  return h + '</div>';
}
function prRefazPartesPub(){ var el = qs('pr_partesPub'); if (el) el.innerHTML = prPartesPubHtml(); }

/* ---------- cadastrar pela publicação ---------- */
function prPreDaPub(p){
  var nomes = pbDestinatarios(p), mem = pbMembros(p), ids = [];
  var A = [], P = [];
  mem.forEach(function(x){ (x.dest || []).forEach(function(d){ var n = d.n; if (!n) return; var arr = d.p === 'P' ? P : A; if (arr.indexOf(n) < 0) arr.push(n); }); });
  function junta(l){ return l.slice(0, 3).join(', ') + (l.length > 3 ? ' e mais ' + (l.length - 3) : ''); }
  var partes = (A.length && P.length) ? junta(A) + ' x ' + junta(P) : junta(A.concat(P));
  nomes.forEach(function(n){ var m = cliParecidos(n).filter(function(x){ return x.nivel === 3; })[0]; if (m && ids.indexOf(m.c.id) < 0) ids.push(m.c.id); });
  return { numero: p.numero || p.processo, partes: partes || pbNomeParte(p, null), orgao: [p.tribunal, p.orgao].filter(Boolean).join(' · '), classe: pbClasse(p.classe), ids: ids, nomes: nomes, origem: 'publicacao' };
}
function prEscolherCadastro(pubId){
  var p = pbPub(pubId); if (!p) return;
  if (!qs('overlayPrEsc')){
    var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayPrEsc';
    d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Cadastrar processo</h2><button class="icon-btn" id="preX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="preCorpo"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function(e){
      if (e.target === d || (e.target.closest && e.target.closest('#preX'))){ d.classList.remove('show'); return; }
      var b = e.target.closest ? e.target.closest('[data-pre]') : null; if (!b) return;
      var a = b.getAttribute('data-pre'), pub = pbPub(d.getAttribute('data-pub')); d.classList.remove('show'); if (!pub) return;
      if (a === 'processo') prAbrirNovo(prPreDaPub(pub));
      else {
        if (activeTab !== 'peticoes') setActiveTab('peticoes');
        setTimeout(function(){
          abrirNovo(); qs('processoInput').value = pub.numero || pub.processo || ''; if (pub.classe) qs('nomeAcaoInput').value = pbClasse(pub.classe);
          var au = (pub.dest || []).filter(function(x){ return x.p === 'A'; })[0]; if (au && au.n && qs('clienteInput')) qs('clienteInput').value = au.n;
          var pre = prPreDaPub(pub); if (pre.ids.length){ pickerDefinir('caso', pre.ids); var c0 = clienteById(pre.ids[0]); if (c0){ formState.origem = c0.pagador === 'murilo' ? 'murilo' : 'proprio'; setSegValue('segOrigem', formState.origem); } }
        }, 40);
      }
    });
  }
  var d2 = qs('overlayPrEsc'); d2.setAttribute('data-pub', pubId);
  qs('preCorpo').innerHTML = '<div class="parcela-sum"><b>' + escapeHtml(p.numero || p.processo) + '</b><br>' + escapeHtml([p.tribunal, p.orgao, pbClasse(p.classe)].filter(Boolean).join(' · ')) + '</div>' +
    '<button type="button" class="btn btn-primary" data-pre="processo" style="width:100%;justify-content:center;flex-direction:column;gap:4px;padding:14px"><b>Processo já em andamento</b><span style="font-weight:400;font-size:var(--t2)">Só acompanhar publicações e prazos. Sem honorários ou já quitados.</span></button>' +
    '<button type="button" class="btn btn-ghost" data-pre="inicial" style="width:100%;justify-content:center;flex-direction:column;gap:4px;padding:14px"><b>Nova inicial</b><span style="font-weight:400;font-size:var(--t2)">Ação nova com honorários a receber (parcelas, êxito, repasse).</span></button>';
  d2.classList.add('show');
}

/* ---------- perfil do cliente e Arquivados ---------- */
(function(){
  var origPerfil = renderPerfil;
  renderPerfil = function(){
    var r = origPerfil.apply(this, arguments);
    try{
      var body = qs('perfilBody'), id = perfilClienteId; if (!body || !id) return r;
      var mp = prMapa(), pm = pendentesPorDoc(), l = mp.ordem.map(function(n){ return mp.m[n]; }).filter(function(x){ return prClienteIds(x).indexOf(id) >= 0; });
      if (!l.length) return r;
      var corpo = l.map(function(x){
        var chips = prHonChips(x, pm).map(function(c){ return '<span class="pb-tg ' + (c[1] === 'ok' ? 'ok' : '') + '">' + escapeHtml(c[0]) + '</span>'; }).join(' '), pz = prPrazosAbertos(x).length;
        return '<div class="cli-item" data-pr-abrir="' + escapeHtml(x.num) + '" style="cursor:pointer"><div class="t"><span>' + escapeHtml(prTitulo(x)) + (prArquivado(x) ? ' <span class="badge arq">Arquivado</span>' : '') + '</span></div><div class="s">' + escapeHtml(x.numero) + (pz ? ' · ' + pz + (pz === 1 ? ' prazo aberto' : ' prazos abertos') : '') + '</div><div class="pb-tags" style="margin-top:4px">' + chips + '</div></div>';
      }).join('');
      body.insertAdjacentHTML('beforeend', secPerfil('processos', 'Processos', l.length, corpo));
    }catch(e){ console.error('processos no perfil', e); }
    return r;
  };
  var origArq = renderArquivados;
  renderArquivados = function(){
    var r = origArq.apply(this, arguments);
    try{
      var el = qs('listArquivados'), q = normNome(arqFiltro.busca), mp = prMapa();
      var l = mp.ordem.map(function(n){ return mp.m[n]; }).filter(function(x){ return prArquivado(x); }).filter(function(x){
        if (arqFiltro.sit === 'pendencia') return false;
        return !q || normNome([x.numero, prTitulo(x)].join(' ')).indexOf(q) >= 0;
      }).sort(function(a, b){ return String(b.doc.arquivadoEm || '').localeCompare(String(a.doc.arquivadoEm || '')); });
      var cards = l.map(function(x){
        return '<div class="card arq-card status-recebido" data-arq-pr="' + escapeHtml(x.num) + '"><div class="arq-top">' + fvIc('doc', '#7C5CD6') + '<span class="badge">Processo</span> <strong>' + escapeHtml(prTitulo(x)) + '</strong></div><div class="cli-sub">' + escapeHtml(x.numero) + (x.doc.orgao ? ' · ' + escapeHtml(x.doc.orgao) : '') + '</div><div class="cli-sub">Arquivado em ' + fmtData(String(x.doc.dataArquivo || x.doc.arquivadoEm || '').slice(0, 10)) + (x.doc.motivoArquivo ? ' · ' + escapeHtml(x.doc.motivoArquivo) : '') + '</div><div class="arq-acoes"><button type="button" data-pr-abrir="' + escapeHtml(x.num) + '">Abrir</button><button type="button" data-pr-reabrir="' + escapeHtml(x.num) + '">Reabrir</button></div></div>';
      }).join('');
      if (arqFiltro.tipo === 'processo') el.innerHTML = cards || '<div class="empty"><strong>Nenhum processo arquivado</strong>Use “Concluir e arquivar” na ficha do processo.</div>';
      else if (arqFiltro.tipo === 'todos' && cards){ if (el.querySelector('.empty')) el.innerHTML = cards; else el.insertAdjacentHTML('beforeend', cards); }
    }catch(e){ console.error('processos arquivados', e); }
    return r;
  };
  var origBusca = paBuscarExtra;
  paBuscarExtra = function(q){
    var out = origBusca.apply(this, arguments), nq = normNome(q), dq = q.replace(/\D/g, '');
    if (nq.length >= 2 || dq.length >= 4){
      prDocs.forEach(function(d){
        if (normNome([d.numero, d.partes, d.orgao, (d.clienteIds || []).map(nomeCliente).join(' ')].join(' ')).indexOf(nq) >= 0 || (dq.length >= 4 && prNum(d.numero).indexOf(dq) >= 0)) out.push({ tipo: 'processo', id: prNum(d.numero), titulo: d.partes || (d.clienteIds || []).map(nomeCliente).join(', ') || d.numero, sub: 'Processo · ' + d.numero + (d.arquivado ? ' · arquivado' : '') });
      });
    }
    return out;
  };
  document.addEventListener('click', function(ev){
    var t = ev.target, a = t.closest ? t.closest('[data-pr-abrir]') : null;
    if (a){ ev.stopPropagation(); prAbrir(a.getAttribute('data-pr-abrir')); return; }
    var re = t.closest ? t.closest('[data-pr-reabrir]') : null;
    if (re){ ev.stopPropagation(); prReabrir(re.getAttribute('data-pr-reabrir')); }
  }, true);
})();

/* ---------- partida ---------- */
(function(){
  var st = document.createElement('style');
  st.textContent = '.pr-card .pb-tipo{flex:none}';
  document.head.appendChild(st);
  prCarregar();
})();
