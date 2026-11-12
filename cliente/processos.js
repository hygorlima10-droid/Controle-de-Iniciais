/* ============================================================
   PROCESSOS: cadastro dos processos (com ou sem honorários) em uma lista única
   - junta os processos cadastrados "só para acompanhar" com os que já existem como Inicial, Termo de acordo ou Alvará
   - o vínculo é pelo número do processo: ao lançar um acordo ou alvará com o número, ele já aparece na ficha do processo
   - ficha com clientes, honorários (links para Iniciais, Acordos e Alvarás), prazos da Agenda, publicações e observações
   - concluir e arquivar (e reabrir); aparece também em Arquivados e no perfil do cliente
   ============================================================ */
var prCorte = null;   /* dia da implantação do vínculo com Iniciais antigas (config/vinculoIniciais) */
var prDocs = [], prOk = false, prS = { filtro: 'andamento', busca: '', mais: 1, f: { cli: '', orgao: '' }, fAberto: false, tlTudo: false, sub: 'lista', mAberto: false }, prEd = null, prArqNum = null;
var PR_HON = { sem: 'Sem honorários', quitados: 'Honorários já quitados' };
var prModoHon = false, prProximoHon = false;   /* a janela de Inicial aberta para cadastrar os honorários de um processo */
var PR_MOTIVOS = ['Trânsito em julgado / extinto', 'Acordo cumprido', 'Desistência / renúncia ao mandato', 'Outro'];
var PR_COR = { so: '#7C5CD6', caso: '#B7791E', acordo: '#2A78D6', alvara: '#2A78D6' };
function prNum(s){ return normalizarProcesso(s); }
/* referência mínima a uma coleção (mesmo jeito das outras: doc(id).set/delete e add), usada pela restauração de backup */
function pbRefColecao(col){
  var base = '/api/db/' + col;
  return { doc: function(id){ return { set: function(d){ return pbApi(base + '/' + encodeURIComponent(id), 'PUT', d); }, delete: function(){ return pbApi(base + '/' + encodeURIComponent(id), 'DELETE'); } }; }, add: function(d){ return pbApi(base, 'POST', d); } };
}
function prCarregar(){
  if (!window.__SERVIDOR){ prOk = true; return Promise.resolve(); }
  return (window.__horusListarTudo ? window.__horusListarTudo('processos') : pbApi('/api/db/processos')).then(function(r){
    prDocs = (r.docs || []).map(function(d){ var x = d.data || {}; x.id = d.id; return x; }); prOk = true; prDepois();
  }).catch(function(){ prOk = true; prDepois(); });
}
function prDepois(){
  try{ if (activeTab === 'processos') prRender(); }catch(e){ console.error('processos', e); }
  try{ agDepois(); }catch(e){}
  try{ if (activeTab === 'publicacoes') pbRender(); }catch(e){}
  try{ if (qs('overlayPb') && qs('overlayPb').classList.contains('show')) pbDesenharDetalhe(); }catch(e){}   /* a leitura da publicação aberta mostra o processo recém-cadastrado */
  try{ if (qs('overlayClientePerfil') && qs('overlayClientePerfil').classList.contains('show')) renderPerfil(); }catch(e){}
  try{ if (activeTab === 'arquivados') renderArquivados(); }catch(e){}
}

/* ---------- lista única: processos cadastrados + os que vêm das Iniciais, Acordos e Alvarás (pelo número) ---------- */
var prMapaMemo = null;
function prMapa(){ return prMapaMemo || prMapaBuild(); }
/* durante uma tela sendo desenhada (código síncrono, sem mudar dados) o mapa é montado uma vez só em vez de uma vez por cartão */
function prComMemo(fn){ if (prMapaMemo) return fn(); prMapaMemo = prMapaBuild(); try{ return fn(); } finally { prMapaMemo = null; } }
function prMapaBuild(){
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
  if (r.doc && r.doc.origem === 'diario' && r.doc.ultimaPublicacao){ if (!d) d = r.doc.ultimaPublicacao; c = String(r.doc.ultimaPublicacao).slice(0, 10); }   /* importado: conta a última publicação, não o dia da importação */
  r.links.forEach(function(l){ [l.doc.criadoEm, l.doc.atualizadoEm].forEach(function(x){ x = String(x || '').slice(0, 10); if (x > c) c = x; }); });   /* processo que vem de Inicial, Acordo ou Alvará: conta o cadastro e as mudanças deles */
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
  w.innerHTML = '<div id="prSub"></div><div class="rs-wrap" id="prResumo" style="display:none"></div><div class="ini-acoes md-um"><button type="button" class="acao acao-ouro" data-pr="novo"><svg><use href="#ic-plus"/></svg><span>Novo processo</span></button></div><div id="prMdResumo"></div>' +
    '<div id="prAnalises" style="display:none"></div><div id="prListaBloco">' +
    '<div id="prAvisoVinc"></div><div class="field" style="margin:0"><input type="text" id="prBusca" placeholder="Buscar por cliente, partes ou número…" autocomplete="off"></div>' +
    '<div class="pb-seg-lin"><div class="segmented" id="prSeg"></div><button type="button" class="btn btn-ghost pb-funil" id="prFunil" data-pr="painel" aria-label="Filtros" title="Filtros"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg></button><button type="button" class="btn btn-ghost pb-funil" id="prMenuBtn" data-pr="menu" aria-label="Mais opções" title="Mais opções"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div><div id="prPainel"></div><div id="prMenu"></div><div id="prLista" class="pb-lista"></div></div>';
  w.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-pr]') : null; if (!b) return;
    var a = b.getAttribute('data-pr'), n = b.getAttribute('data-n');
    if (a === 'novo') prAbrirNovo(null);
    else if (a === 'filtro'){ prS.filtro = b.getAttribute('data-v'); prS.mais = 1; prRender(); }
    else if (a === 'abrir') prAbrir(n);
    else if (a === 'arquivar') prAbrirArquivar(n);
    else if (a === 'reabrir') prReabrir(n);
    else if (a === 'mais'){ prS.mais++; prRenderLista(); }
    else if (a === 'painel'){ prS.fAberto = !prS.fAberto; prPainel(); }
    else if (a === 'menu'){ prS.mAberto = !prS.mAberto; prMenuPainel(); }
    else if (a === 'rel'){ prS.mAberto = false; prMenuPainel(); rptProcessos(); }
    else if (a === 'imp'){ prS.mAberto = false; prMenuPainel(); impAbrir(); }
    else if (a === 'rev-ir'){ prS.sub = 'lista'; prS.filtro = 'revisar'; prS.mais = 1; prRender(); }
    else if (a === 'rev-gvinc') impGrupoVincular(n);
    else if (a === 'rev-gesc') impEscolherParaGrupo(n);
    else if (a === 'rev-gnovo') impGrupoNovo(n);
    else if (a === 'rev-vinc') impVincularSugerido(n);
    else if (a === 'rev-esc') impEscolherCliente(n);
    else if (a === 'rev-novo') impNovoCliente(n);
    else if (a === 'rev-del') impPerguntarExcluir(n);
    else if (a === 'sub'){ var sv = b.getAttribute('data-v'); mdLembrar('processos', sv); prS.mais = 1; if (sv === 'revisar'){ prS.sub = 'lista'; prS.filtro = 'revisar'; } else { prS.sub = sv; if (sv === 'lista' && prS.filtro === 'revisar') prS.filtro = 'andamento'; } prRender(); }
    else if (a === 'limpar'){ prS.f = { cli: '', orgao: '', esp: '' }; prS.mais = 1; prPainel(); prRenderLista(); }
  });
  w.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-pan]') : null; if (!b) return; var a = b.getAttribute('data-pan');
    if (a === 'periodo'){ panS.periodo = b.getAttribute('data-v'); panRender(); } else if (a === 'rel') panRelatorio();
  });
  w.addEventListener('change', function(e){ var k = e.target && e.target.getAttribute ? e.target.getAttribute('data-pan') : null; if (k === 'area'){ panS.area = e.target.value; panRender(); } });
  w.addEventListener('change', function(e){ var k = e.target && e.target.getAttribute ? e.target.getAttribute('data-prfil') : null; if (!k) return; prS.f[k] = e.target.value; prS.mais = 1; prRenderLista(); prFunilMarca(); });
  qs('prBusca').addEventListener('input', function(){ prS.busca = this.value; prS.mais = 1; prRenderLista(); });
}
function prLinhaReu(r){
  var reu = prReu(r); if (!reu || normNome(prTitulo(r)).indexOf(normNome(reu).slice(0, 12)) >= 0) return '';
  return '<div class="pb-proc">Réu: ' + escapeHtml(reu) + '</div>';
}
function prRender(){
  prMontarTela(); var w = qs('prWrap'); if (!w) return;
  /* sub-abas padrão (Fase 2): Resumo, Lista, Revisar (só quando há importados para conferir) e Análises; a última usada fica lembrada */
  if (!prS.mdOk){ prS.mdOk = 1; if (prS.sub === 'lista' && prS.filtro !== 'revisar'){ var s0 = mdInicial('processos', ['lista', 'revisar', 'analises']); if (s0 === 'revisar'){ prS.filtro = 'revisar'; } else prS.sub = s0; } }
  var nRev0 = impContaRev(); if (!nRev0 && prS.filtro === 'revisar') prS.filtro = 'andamento';
  var chave = prS.sub === 'lista' && prS.filtro === 'revisar' ? 'revisar' : prS.sub;
  qs('prSub').innerHTML = mdBarraHtml([['resumo', 'Resumo'], ['lista', 'Lista']].concat(nRev0 ? [['revisar', 'Revisar', nRev0]] : []).concat([['analises', 'Análises']]), chave, function(k){ return 'data-pr="sub" data-v="' + k + '"'; });
  var an = prS.sub === 'analises', res = prS.sub === 'resumo';
  qs('prAnalises').style.display = an ? '' : 'none'; qs('prListaBloco').style.display = (an || res) ? 'none' : ''; qs('prMdResumo').style.display = res ? '' : 'none'; var bn = w.querySelector('.ini-acoes'); if (bn) bn.style.display = an ? 'none' : '';
  if (an){ panRender(); return; }
  if (res){ try{ qs('prMdResumo').innerHTML = (typeof lgBannerHtml === 'function' ? lgBannerHtml() : '') + mjPainel('processos', mjProcessos()); }catch(e){ console.error('resumo de processos', e); qs('prMdResumo').innerHTML = '<div class="financeiro-vazio">Não consegui montar o resumo. As outras sub-abas continuam funcionando.</div>'; } return; }
  var mp = prMapa(), pm = pendentesPorDoc(), linhas = mp.ordem.map(function(n){ return mp.m[n]; });
  var ativos = linhas.filter(function(r){ return !prArquivado(r); });
  var comPrazo = ativos.filter(function(r){ return prPrazosAbertos(r).length > 0; }).length, parados = ativos.filter(function(r){ return prParado(r, pm); }).length;
  rsResumo('prResumo', { rot: 'Processos em andamento', valor: String(ativos.length), chip: rsChip(linhas.length + (linhas.length === 1 ? ' processo no total' : ' processos no total'), ''),
    tiles: [{ k: 'alert', cor: comPrazo ? '#D93B3B' : '#8A93AD', rot: 'Com prazo aberto', v: String(comPrazo), cls: comPrazo ? 'neg' : '' }, { k: 'clip', cor: '#B7791E', rot: 'Sem andamento há 60 dias', v: String(parados) }] });
  var nRev = impContaRev(); if (!nRev && prS.filtro === 'revisar') prS.filtro = 'andamento';
  qs('prSeg').innerHTML = [['andamento', 'Em andamento'], ['prazo', 'Com prazo'], ['todos', 'Todos']].map(function(f){ return '<button type="button" class="seg-btn' + (prS.filtro === f[0] ? ' active' : '') + '" data-pr="filtro" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('');
  prAvisoVinc(); prPainel(); prMenuPainel(); prRenderLista();
}
function prMenuPainel(){
  var el = qs('prMenu'), b = qs('prMenuBtn'); if (b) b.classList.toggle('ativo', !!prS.mAberto); if (!el) return;
  el.innerHTML = prS.mAberto ? '<div class="pb-painel pb-menu"><button type="button" class="pb-mi" data-pr="imp"><span class="pb-mi-i">⬇</span>Importar do Diário Oficial<small>traz os processos das suas OABs de uma vez</small></button><button type="button" class="pb-mi" data-pr="rel"><span class="pb-mi-i">🖨</span>Relatório da lista<small>imprimir ou salvar em PDF</small></button></div>' : '';
}
/* filtros: por cliente (ou sem cliente vinculado) e por vara/órgão */
function prOrgaoDe(r){
  if (r.doc && r.doc.orgao) return String(r.doc.orgao).trim();
  var ps = prPubsDe(r.num); return ps[0] ? [ps[0].tribunal, ps[0].orgao].filter(Boolean).join(' · ') : '';
}
function prFiltrosAtivos(){ return (prS.f.cli ? 1 : 0) + (prS.f.orgao ? 1 : 0) + (prS.f.esp ? 1 : 0); }
var PR_ESP = { semprov: 'sem próxima providência', parado: 'sem andamento há 60 dias' };
function prFunilMarca(){
  var b = qs('prFunil'); if (!b) return; var n = prFiltrosAtivos();
  b.classList.toggle('ativo', n > 0); var i = b.querySelector('.pb-n'); if (n){ if (!i){ i = document.createElement('i'); i.className = 'pb-n'; b.appendChild(i); } i.textContent = n; } else if (i) i.remove();
}
function prPainel(){
  var el = qs('prPainel'); if (!el) return; prFunilMarca();
  if (!prS.fAberto){ el.innerHTML = ''; return; }
  var mp = prMapa(), linhas = mp.ordem.map(function(n){ return mp.m[n]; }), cli = {}, orgaos = {}, sem = 0;
  linhas.forEach(function(r){ var ids = prClienteIds(r); if (!ids.length) sem++; ids.forEach(function(i){ cli[i] = 1; }); var o = prOrgaoDe(r); if (o) orgaos[o] = 1; });
  var nomes = Object.keys(cli).map(function(i){ return { id: i, n: nomeCliente(i) }; }).filter(function(x){ return x.n; }).sort(function(a, b){ return a.n.localeCompare(b.n, 'pt-BR'); });
  el.innerHTML = '<div class="pb-painel"><div class="field"><label class="field-label" for="prf_cli">Cliente</label><select id="prf_cli" class="filter-select" data-prfil="cli" style="width:100%"><option value="">Todos</option><option value="__sem"' + (prS.f.cli === '__sem' ? ' selected' : '') + '>Sem cliente vinculado (' + sem + ')</option>' + nomes.map(function(x){ return '<option value="' + escapeHtml(x.id) + '"' + (prS.f.cli === x.id ? ' selected' : '') + '>' + escapeHtml(x.n) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label class="field-label" for="prf_orgao">Vara / órgão</label><select id="prf_orgao" class="filter-select" data-prfil="orgao" style="width:100%"><option value="">Todas</option>' + Object.keys(orgaos).sort().map(function(o){ return '<option value="' + escapeHtml(o) + '"' + (prS.f.orgao === o ? ' selected' : '') + '>' + escapeHtml(o) + '</option>'; }).join('') + '</select></div>' +
    '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-pr="limpar">Limpar filtros</button><button type="button" class="btn btn-primary pb-b" data-pr="painel">Fechar</button></div></div>';
}
/* a lista que o filtro e a busca deixam (usada na tela e nos relatórios) */
function prFiltrar(filtro){
  var mp = prMapa(), q = normNome(prS.busca), pmEsp = prS.f.esp === 'parado' ? pendentesPorDoc() : null; filtro = filtro || prS.filtro;
  var E = window.__horusEscopo, so = !!(E && E.ativo && E.modo === 'meus');   /* "Meus": só os processos cadastrados com um dos meus advogados */
  return mp.ordem.map(function(n){ return mp.m[n]; }).filter(function(r){
    var arq = prArquivado(r);
    if (so && !(E.meuNum(r.num) || (r.doc && E.meuDoc(r.doc)))) return false;   /* "Meus": o processo é meu se eu estou nele ou em qualquer Inicial, Acordo ou Alvará do mesmo número */
    if (filtro === 'andamento' && arq) return false;
    if (filtro === 'prazo' && (arq || !prPrazosAbertos(r).length)) return false;
    if (filtro === 'revisar' && (arq || !(r.doc && r.doc.revisar))) return false;
    if (prS.f.cli === '__sem'){ if (prClienteIds(r).length) return false; }
    else if (prS.f.cli && prClienteIds(r).indexOf(prS.f.cli) < 0) return false;
    if (prS.f.orgao && prOrgaoDe(r) !== prS.f.orgao) return false;
    if (prS.f.esp === 'semprov' && (arq || !mjSemProv(r))) return false;
    if (prS.f.esp === 'parado' && (arq || !prParado(r, pmEsp))) return false;
    if (q){
      var alvo = normNome([r.numero, prTitulo(r), prClienteIds(r).map(nomeCliente).join(' '), (r.doc && (r.doc.orgao + ' ' + r.doc.classe + ' ' + (r.doc.autor || '') + ' ' + (r.doc.reu || ''))) || '', prReu(r)].join(' '));
      if (alvo.indexOf(q) < 0 && (q.replace(/\D/g, '').length < 4 || r.num.indexOf(q.replace(/\D/g, '')) < 0)) return false;
    }
    return true;
  });
}
/* cartão em revisão: vincular ao cliente sugerido, escolher outro, cadastrar um novo ou excluir o processo do sistema */
function prAcoesRevisao(r){
  var n = escapeHtml(r.num), sug = r.doc.sugestaoClienteId ? clienteById(r.doc.sugestaoClienteId) : null, b = function(a, cls, t){ return '<button type="button" class="btn ' + cls + ' pb-b" data-pr="' + a + '" data-n="' + n + '">' + t + '</button>'; };
  return '<div class="pb-aviso" style="margin-top:8px">' + (sug ? 'Cliente parecido: <b>' + escapeHtml(sug.nome) + '</b>' : 'Nenhum cliente parecido. Escolha um cliente ou cadastre um novo.') + '</div>' +
    '<div class="pb-acts">' + (sug ? b('rev-vinc', 'btn-primary', 'Vincular a ' + escapeHtml(sug.nome.length > 22 ? sug.nome.slice(0, 22) + '…' : sug.nome)) : '') + b('rev-esc', sug ? 'btn-ghost' : 'btn-primary', 'Escolher outro cliente') + b('rev-novo', 'btn-ghost', 'Cadastrar cliente novo') + '</div>' +
    '<div class="pb-acts">' + b('abrir', 'btn-ghost', 'Abrir') + b('rev-del', 'btn-ghost', 'Excluir processo') + '</div>';
}
function prRenderLista(){
  var box = qs('prLista'); if (!box) return;
  var pm = pendentesPorDoc(), linhas = prFiltrar();
  var info = {}; linhas.forEach(function(r){ var pz = prPrazosAbertos(r); info[r.num] = { pz: pz, prox: pz.length ? pz[0].data : '9999', ult: prUltAtividade(r) }; });
  linhas.sort(function(a, b){ return info[a.num].prox.localeCompare(info[b.num].prox) || info[b.num].ult.localeCompare(info[a.num].ult) || prTitulo(a).localeCompare(prTitulo(b), 'pt-BR'); });
  if (!linhas.length){ box.innerHTML = '<div class="financeiro-vazio">' + (prS.busca || prFiltrosAtivos() ? 'Nenhum processo com essa busca ou esses filtros.' : (prS.filtro === 'andamento' ? 'Nenhum processo em andamento. Toque em “Novo processo” ou cadastre pela aba Publicações.' : 'Nada aqui.')) + '</div>'; return; }
  var lim = prS.mais * 30;
  box.innerHTML = (prS.f.esp && PR_ESP[prS.f.esp] ? '<div class="saldo-data pb-resfiltro">Mostrando só os processos ' + PR_ESP[prS.f.esp] + ' (' + linhas.length + '). <button type="button" class="btn-text" data-pr="limpar">Limpar</button></div>' : '') + (prS.filtro === 'revisar' ? impGruposHtml() : '') + linhas.slice(0, lim).map(function(r){
    var i = info[r.num], origens = prOrigens(r), arq = prArquivado(r), pubs = prPubsDe(r.num), tags = '';
    var orgao = r.doc ? [r.doc.orgao, r.doc.classe].filter(Boolean).join(' · ') : (pubs[0] ? [pubs[0].tribunal, pubs[0].orgao].filter(Boolean).join(' · ') : '');
    if (i.pz.length) tags += '<span class="pb-tg" style="background:rgba(217,59,59,.12);color:var(--urgente)">' + i.pz.length + (i.pz.length === 1 ? ' prazo aberto' : ' prazos abertos') + '</span>';
    if (pubs.length) tags += '<span class="pb-tg">última publicação ' + fmtData(pubs[0].data).slice(0, 5) + '</span>';
    else if (r.doc && r.doc.ultimaPublicacao) tags += '<span class="pb-tg">última publicação ' + fmtData(r.doc.ultimaPublicacao).slice(0, 5) + '</span>';
    prHonChips(r, pm).forEach(function(c){ tags += '<span class="pb-tg ' + (c[1] === 'ok' ? 'ok' : (c[1] === 'neg' ? '' : (c[1] === 'pend' ? 'nv' : ''))) + '"' + (c[1] === 'neg' ? ' style="background:rgba(217,59,59,.12);color:var(--urgente)"' : '') + '>' + escapeHtml(c[0]) + '</span>'; });
    var px = prProximaInfo(r);
    if (px && !arq) tags += '<span class="pb-tg ' + (px.feito ? 'ok' : 'pz') + '">' + (px.feito ? '✓ ' : 'Próxima: ') + escapeHtml(px.txt.slice(0, 40)) + (px.data ? ' · ' + escapeHtml(fmtData(px.data).slice(0, 5)) : '') + '</span>';
    if (!prClienteIds(r).length) tags += '<span class="pb-tg nv">sem cliente vinculado</span>';
    if (r.doc && r.doc.origem === 'diario'){ tags += '<span class="pb-tg">importado do Diário Oficial</span>'; if (r.doc.vinculoAuto && !r.doc.revisar) tags += '<span class="pb-tg ok">vinculado automaticamente</span>'; if (r.doc.possivelEncerrado) tags += '<span class="pb-tg pz">⚠ cita ' + escapeHtml(r.doc.possivelEncerrado) + '</span>'; }
    if (prParado(r, pm)) tags += '<span class="pb-tg pz">sem andamento há 60 dias · arquivar?</span>';
    if (arq) tags += '<span class="pb-tg">arquivado' + (r.doc.motivoArquivo ? ' · ' + escapeHtml(r.doc.motivoArquivo) : '') + '</span>';
    var emb = origens.map(function(o){ return o === 'so' ? 'Só processo' : PR_LBL[o]; }).join(' · ');
    return '<div class="pb-card pr-card' + (arq ? ' lida' : '') + '" style="--pb-bar:' + PR_COR[origens[0]] + '" data-pr-card="' + escapeHtml(r.num) + '"><div class="pb-l1"><span>' + escapeHtml(orgao || 'Processo') + '</span><span class="pb-tipo">' + escapeHtml(emb) + '</span></div>' +
      '<div class="pb-cli">' + escapeHtml(prTitulo(r)) + '</div><div class="pb-proc">' + escapeHtml(r.numero) + '</div>' + prLinhaReu(r) + '<div class="pb-tags">' + tags + '</div>' +
      (r.doc && r.doc.revisar && !arq ? prAcoesRevisao(r) : '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-pr="abrir" data-n="' + escapeHtml(r.num) + '">Abrir</button>' + (arq ? '<button type="button" class="btn btn-ghost pb-b" data-pr="reabrir" data-n="' + escapeHtml(r.num) + '">Reabrir</button>' : '<button type="button" class="btn btn-ghost pb-b" data-pr="arquivar" data-n="' + escapeHtml(r.num) + '">Concluir e arquivar</button>') + '</div>') + '</div>';
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
    else if (a === 'rev-sug'){ if (prEd.ids.indexOf(v) < 0) prEd.ids.push(v); prChips(); toast('Cliente escolhido. Toque em Salvar para tirar da revisão.'); }
    else if (a === 'cli-add'){ if (prEd.ids.indexOf(v) < 0) prEd.ids.push(v); qs('pr_cli').value = ''; prSug(); prChips(); }
    else if (a === 'sug-add'){ var nm = prEd.pre.nomes[Number(b.getAttribute('data-i'))]; if (prEd.ids.indexOf(v) < 0) prEd.ids.push(v); prAprenderApelido(v, nm); prChips(); toast('Vinculado. Da próxima vez “' + cliTitulo(nm).slice(0, 40) + '” já é reconhecido.'); }
    else if (a === 'sug-new'){ var nm2 = prEd.pre.nomes[Number(b.getAttribute('data-i'))]; abrirClienteEdit({ nome: cliTitulo(nm2), pagador: 'cliente', aoSalvar: function(c){ if (prEd.ids.indexOf(c.id) < 0) prEd.ids.push(c.id); prChips(); } }); }
    else if (a === 'cli-new'){
      var nome = qs('pr_cli').value.trim(); qs('pr_cli').value = ''; prSug();
      abrirClienteEdit({ nome: nome, pagador: 'cliente', aoSalvar: function(c){ if (prEd.ids.indexOf(c.id) < 0) prEd.ids.push(c.id); prChips(); } });
    }
    else if (a === 'tl-tudo'){ prS.tlTudo = true; prDesenhar(); }
    else if (a === 'hist') prHistCarregar();
    else if (a === 'rel') rptProcesso(prEd.num);
    else if (a === 'vinc-abrir'){ prEd.vincAberto = true; prEd.vincAviso = null; prRefazVinc(); }
    else if (a === 'vinc-fechar'){ prEd.vincAberto = false; prEd.vincAviso = null; prRefazVinc(); }
    else if (a === 'vinc-esc') prVincEscolher(v, false);
    else if (a === 'vinc-seguir') prVincEscolher(v, true);
    else if (a === 'vinc-cancel'){ prEd.vincAviso = null; prRefazVinc(); }
    else if (a === 'vinc-rm'){ prEd.vinc = null; prEd.vincAviso = null; prRefazVinc(); }
    else if (a === 'salvar') prSalvar();
    else if (a === 'buscar-dados') prBuscarDados(true);
    else if (a === 'buscar-dj') prBuscarDatajud(true);
    else if (a === 'arquivar'){ var n = prEd.num; d.classList.remove('show'); prAbrirArquivar(n); }
    else if (a === 'reabrir'){ prReabrir(prEd.num); d.classList.remove('show'); }
    else if (a === 'excluir') prExcluir(b);
    else if (a === 'link'){ d.classList.remove('show'); var p = v.split('|'), dc = p[0] === 'peticao' ? docDe('caso', p[1]) : null; if (dc && dc.doProcesso) abrirEdicao(dc.id); else irParaRelacionado(p[0], p[1]); }   /* honorários do processo editam na própria janela */
    else if (a === 'novo-hon') prNovoHonorario(v);
    else if (a === 'prazo-novo'){ var nn = prEd.num; d.classList.remove('show'); agAbrir(null); var r = prMapa().m[nn]; qs('age_proc').value = r ? r.numero : ''; qs('age_proc').dispatchEvent(new Event('input', { bubbles: true })); }
    else if (a === 'prazo-abrir'){ d.classList.remove('show'); agAbrir(v); }
    else if (a === 'pub'){ d.classList.remove('show'); setActiveTab('publicacoes'); setTimeout(function(){ pbAbrirDetalhe(v); }, 80); }
    else if (a === 'pubs-todas'){ d.classList.remove('show'); pbS.f = { q: v, de: '', ate: '', oab: 'todas', adv: '', trib: '' }; pbS.filtro = 'todas'; pbS.sub = 'lista'; pbS.mdOk = 1; pbS.fAberto = true; setActiveTab('publicacoes'); }
    else if (a === 'cliente'){ d.classList.remove('show'); abrirPerfilCliente(v); }
  });
  d.addEventListener('input', function(e){ if (e.target && e.target.id === 'pr_cli') prSug(); if (e.target && e.target.id === 'pr_numero') prInfoNumero(); if (e.target && e.target.id === 'pr_vincq'){ prEd.vincQ = e.target.value; prRefazVincLista(); } });
  d.addEventListener('focusin', function(e){ if (e.target && e.target.id === 'pr_cli') prSug(); });
  d.addEventListener('focusout', function(e){ if (e.target && e.target.id === 'pr_numero' && prEd && prEd.novo){ prBuscarDados(); prBuscarDatajud(); } });
}
function prFmtValor(v){ return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function prParseValor(t){ var x = String(t || '').replace(/[^\d,.]/g, ''); if (!x) return null; if (x.indexOf(',') >= 0) x = x.replace(/\./g, '').replace(',', '.'); var n = parseFloat(x); return isFinite(n) && n > 0 ? n : null; }
/* última publicação conhecida com o réu (para processos que vêm de Inicial, Acordo ou Alvará) */
/* "Fulano x Banco" → autor e réu (separador: x, vs, versus, cercado de espaços); sem separador devolve null */
function prDividePartes(t){
  var m = /^(.+?)\s+(?:x|vs\.?|versus)\s+(.+)$/i.exec(String(t || '').trim());
  return m ? { autor: m[1].trim().slice(0, 120), reu: m[2].trim().slice(0, 120) } : null;
}
function prReu(r){ if (r.doc && r.doc.reu) return r.doc.reu; var dv = r.doc && prDividePartes(r.doc.partes); if (dv) return dv.reu; var ps = prPubsDe(r.num); for (var i = 0; i < ps.length; i++) if (ps[i].passivo) return ps[i].passivo; return ''; }
/* puxa do Diário Oficial réu, órgão, natureza e valor da causa e completa só o que estiver vazio */
function prBuscarDados(forcar){
  var el = qs('pr_numero'); if (!el || !window.__SERVIDOR) return;
  var n = el.value.replace(/\D/g, ''), st = qs('pr_dados');
  if (n.length < 15){ if (st) st.textContent = ''; return; }
  if (!forcar && prEd.buscado === n) return; prEd.buscado = n;
  if (st){ st.style.color = 'var(--ink-soft)'; st.textContent = 'Buscando os dados no Diário Oficial…'; }
  pbApi('/api/djen/processo?numero=' + n).then(function(r){
    if (!qs('pr_numero') || qs('pr_numero').value.replace(/\D/g, '') !== n) return;
    st = qs('pr_dados');
    if (!r.ok){ st.style.color = 'var(--ink-soft)'; st.textContent = 'Não consegui consultar o Diário Oficial agora (' + (r.motivo || 'erro') + '). Preencha à mão.'; return; }
    if (!r.achou){ st.style.color = 'var(--ink-soft)'; st.textContent = 'O Diário Oficial ainda não tem publicação com este número. Preencha à mão; o resto vem quando chegar a primeira.'; return; }
    var d = r.dados, vazio = function(id){ return !qs(id).value.trim(); }, pt = qs('pr_partes');
    if (vazio('pr_orgao')) qs('pr_orgao').value = [d.tribunal, d.orgao].filter(Boolean).join(' · ');
    if (vazio('pr_classe')) qs('pr_classe').value = d.natureza || (d.classe ? pbClasse(d.classe) : '');
    if (vazio('pr_autor') && d.ativo) qs('pr_autor').value = d.ativo;
    if (vazio('pr_reu') && d.passivo) qs('pr_reu').value = d.passivo;
    if (vazio('pr_valor') && d.valorCausa) qs('pr_valor').value = prFmtValor(d.valorCausa);
    if (d.ativo && d.passivo && (vazio('pr_partes') || pt.value === prEd.iniPartes)) pt.value = (d.ativo + ' x ' + d.passivo).slice(0, 120);
    st.style.color = 'var(--success)';
    st.textContent = '✓ Dados do Diário Oficial preenchidos (' + d.comunicacoes + (d.comunicacoes === 1 ? ' publicação' : ' publicações') + ', a última em ' + fmtData(d.ultimaPublicacao) + '). Confira.';
  }).catch(function(e){ var s2 = qs('pr_dados'); if (s2){ s2.style.color = 'var(--ink-soft)'; s2.textContent = 'Não consegui consultar o Diário Oficial agora. Preencha à mão.'; } });
}
/* DataJud (CNJ): vara, classe, assunto e data de ajuizamento. É lento (até 1 min) e às vezes falha: roda em segundo plano e só completa o que estiver vazio */
function prBuscarDatajud(forcar){
  var el = qs('pr_numero'); if (!el || !window.__SERVIDOR) return;
  var n = el.value.replace(/\D/g, ''), st = qs('pr_dj'); if (!st) return;
  if (n.length !== 20){ st.textContent = forcar ? 'O DataJud precisa do número completo do CNJ (20 dígitos).' : ''; st.style.color = 'var(--ink-soft)'; return; }
  var a = cnjAnalisar(el.value); if (a && a.completo && !a.valido){ st.style.color = 'var(--urgente)'; st.textContent = 'O dígito verificador do número não confere; não consultei o DataJud.'; return; }
  if (!forcar && prEd.buscadoDj === n) return; prEd.buscadoDj = n;
  st.style.color = 'var(--ink-soft)'; st.textContent = 'Consultando o DataJud… pode levar até 1 minuto; pode continuar preenchendo.';
  pbApi('/api/datajud/processo?numero=' + n).then(function(r){
    if (!qs('pr_numero') || qs('pr_numero').value.replace(/\D/g, '') !== n) return;
    st = qs('pr_dj');
    if (!r.ok){ st.style.color = 'var(--ink-soft)'; st.textContent = (r.motivo || 'Não consegui consultar o DataJud agora.') + ' Toque em “Buscar dados no DataJud” para tentar de novo.'; prEd.buscadoDj = ''; return; }
    if (!r.achou){ st.style.color = 'var(--ink-soft)'; st.textContent = 'O DataJud (' + (r.tribunal || '') + ') ainda não tem este processo' + (r.parcial ? ' (a resposta veio incompleta; tente de novo)' : '. Processo recém-protocolado costuma demorar semanas para aparecer') + '. Preencha à mão.'; if (r.parcial) prEd.buscadoDj = ''; return; }
    var d = r.dados, vazio = function(id){ return qs(id) && !qs(id).value.trim(); };
    if (vazio('pr_orgao') && (d.orgao || d.tribunal)) qs('pr_orgao').value = [d.tribunal, d.orgao].filter(Boolean).join(' · ');
    if (vazio('pr_classe') && d.classe) qs('pr_classe').value = d.classe;
    if (vazio('pr_assunto') && d.assuntos && d.assuntos.length) qs('pr_assunto').value = d.assuntos.slice(0, 3).join('; ');
    if (vazio('pr_ajuiz') && d.ajuizamento) qs('pr_ajuiz').value = d.ajuizamento;
    st.style.color = 'var(--success)';
    st.textContent = '✓ Dados do DataJud preenchidos (' + (d.tribunal || r.tribunal) + (d.grau ? ' · ' + d.grau : '') + (d.ultimoMovimento ? ' · último movimento: ' + d.ultimoMovimento.nome + ' em ' + fmtData(d.ultimoMovimento.data) : '') + ')' + (d.sigilo ? ' · ATENÇÃO: o processo tem nível de sigilo ' + d.sigilo : '') + '. O DataJud não informa partes, valor da causa nem honorários. Confira.';
  }).catch(function(){ var s2 = qs('pr_dj'); if (s2){ s2.style.color = 'var(--ink-soft)'; s2.textContent = 'Não consegui consultar o DataJud agora. Preencha à mão ou tente de novo.'; } prEd.buscadoDj = ''; });
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
  if (q && !clientes.some(function(c){ return normNome(c.nome) === nq; })) h += '<div class="cli-sug-item novo" data-prf="cli-new" data-v="1">Cadastrar “' + escapeHtml(q) + '”</div>';
  sug.innerHTML = h; sug.style.display = h ? '' : 'none';
}
/* ---------- próxima providência: texto (+ data opcional, que vira tarefa na Agenda) ---------- */
function prProximaInfo(r){
  var d = r.doc; if (!d || !d.proxima) return null;
  var ag = d.proximaAgId ? agDocs.filter(function(x){ return x.id === d.proximaAgId; })[0] : null;
  return { txt: d.proxima, data: d.proximaData || '', feito: !!(ag && ag.concluido), concluidoEm: ag && ag.concluidoEm ? ag.concluidoEm : '' };
}
function prSincProvidencia(o){
  var ant = o.antId ? agDocs.filter(function(d){ return d.id === o.antId; })[0] : null;
  if (!o.prox || !o.data){
    if (ant) return pbApi('/api/db/agenda/' + encodeURIComponent(ant.id), 'DELETE').then(function(){ agDocs = agDocs.filter(function(d){ return d.id !== ant.id; }); agDepois(); return ''; });
    return Promise.resolve('');
  }
  if (ant){
    var mudou = ant.titulo !== o.prox || ant.data !== o.data, nd = Object.assign({}, ant, { titulo: o.prox, processo: o.numero, cliente: o.cliente, data: o.data });
    if (ant.concluido && mudou){ nd.concluido = false; nd.situacao = 'afazer'; nd.concluidoEm = ''; }
    delete nd.id;
    return pbApi('/api/db/agenda/' + encodeURIComponent(ant.id), 'PUT', nd).then(function(){ Object.assign(ant, nd); agDepois(); return ant.id; });
  }
  return agCriar({ tipo: 'tarefa', titulo: o.prox, processo: o.numero, cliente: o.cliente, data: o.data, hora: '', trabalhar: '', situacao: 'afazer', concluido: false, avisos: AG_PADRAO.slice(), provProc: true, pubId: '', criadoEm: new Date().toISOString() }).then(function(d){ return d.id; });
}

/* ---------- linha do tempo do processo: publicações, prazos, audiências, honorários e marcos ---------- */
function prEventos(r){
  var hoje = todayISO(), ev = [], d = r.doc;
  function add(data, tipo, titulo, sub, estado, acao){ if (/^\d{4}-\d{2}-\d{2}$/.test(data || '')) ev.push({ data: data, tipo: tipo, titulo: titulo, sub: sub || '', estado: estado || '', acao: acao || '' }); }
  prPubsDe(r.num).forEach(function(p){ add(p.data, 'pub', p.tipo || 'Publicação', (p.trecho || '').slice(0, 110), '', 'pub|' + p.id); });
  agItens().filter(function(i){ return i.processo && prNum(i.processo) === r.num; }).forEach(function(i){
    var c = agChip(i), est = i.concluido ? (i.tipo === 'prazo' ? 'Protocolada' + (i.protocoladoEm ? ' em ' + fmtData(i.protocoladoEm) : '') : (i.tipo === 'audiencia' ? 'Realizada' : 'Concluída')) : c.t;
    add(i.data, i.tipo === 'audiencia' ? 'aud' : (i.tipo === 'tarefa' ? 'tar' : 'prazo'), i.titulo, (i.tipo === 'audiencia' ? [i.hora, i.audTipo, i.local].filter(Boolean).join(' · ') : ''), est + (i.concluido ? '|ok' : (c.c === 'atraso' ? '|neg' : '')), 'ag|' + i.key);
  });
  var un = []; try{ un = listarUnidades(); }catch(e){}
  un.forEach(function(u){
    var l = r.links.filter(function(x){ return x.tipo === u.docTipo && x.id === u.docId; })[0]; if (!l) return;
    var rest = restanteUn(u), pago = rest <= 0.004;
    add(pago ? (u.dataRec || u.data) : u.data, 'hon', (u.label || 'Honorário') + ' · ' + fmtMoeda(u.valor), PR_LBL[u.docTipo === 'caso' ? 'caso' : u.docTipo] || '', pago ? 'Recebido|ok' : (u.data && u.data < hoje ? 'Atrasado|neg' : 'A receber'), 'hon|' + (u.docTipo === 'caso' ? 'peticao' : u.docTipo) + '|' + u.docId);
  });
  if (d){
    if (d.ajuizamento) add(d.ajuizamento, 'marco', 'Processo ajuizado', '', '');
    add(String(d.criadoEm || '').slice(0, 10), 'marco', 'Cadastrado no Horus', '', '');
    var px = prProximaInfo(r); if (px && px.data) add(px.data, 'prox', 'Próxima providência: ' + px.txt, '', px.feito ? 'Concluída|ok' : '');
    (d.registros || []).forEach(function(g){ add(g.data, 'reg', g.texto, '', ''); });
    if (d.arquivado) add(String(d.dataArquivo || d.arquivadoEm || '').slice(0, 10), 'marco', 'Arquivado' + (d.motivoArquivo ? ' · ' + d.motivoArquivo : ''), '', '');
  }
  return ev;
}
/* "Próximos": o que ainda vai acontecer (hoje só conta para prazo, audiência, tarefa e providência; publicação e marcos de hoje já são passado) */
function prEhFuturo(e, hoje){ return e.data > hoje || (e.data === hoje && /^(prazo|aud|tar|prox)$/.test(e.tipo) && !/\|ok/.test(e.estado)); }
var PR_TL = { pub: ['Publicação', '#7C5CD6'], prazo: ['Prazo', '#D93B3B'], aud: ['Audiência', '#2A78D6'], tar: ['Tarefa', '#C98500'], hon: ['Honorário', '#17895A'], marco: ['Marco', '#8A93AD'], prox: ['Providência', '#C98500'], reg: ['Registro', '#8A93AD'] };
function prTimelineHtml(r){
  var hoje = todayISO(), ev = prEventos(r);
  var fut = ev.filter(function(e){ return prEhFuturo(e, hoje); }).sort(function(a, b){ return a.data.localeCompare(b.data); }), pas = ev.filter(function(e){ return !prEhFuturo(e, hoje); }).sort(function(a, b){ return b.data.localeCompare(a.data); });
  var lim = prS.tlTudo ? 9999 : 8;
  function linha(e){
    var t = PR_TL[e.tipo], est = e.estado.split('|'), a = e.acao.split('|'), btn = '';
    if (a[0] === 'pub') btn = '<button type="button" class="btn-text pb-b" data-prf="pub" data-v="' + escapeHtml(a[1]) + '">ver ›</button>';
    else if (a[0] === 'ag') btn = '<button type="button" class="btn-text pb-b" data-prf="prazo-abrir" data-v="' + escapeHtml(a.slice(1).join('|')) + '">abrir ›</button>';
    else if (a[0] === 'hon') btn = '<button type="button" class="btn-text pb-b" data-prf="link" data-v="' + escapeHtml(a[1] + '|' + a[2]) + '">abrir ›</button>';
    return '<div class="pr-tl-l"><span class="pr-tl-d">' + escapeHtml(fmtData(e.data).slice(0, 5)) + '<small>' + escapeHtml(e.data.slice(0, 4)) + '</small></span><span class="pr-tl-p" style="background:' + t[1] + '"></span><span class="pr-tl-t"><b>' + escapeHtml(t[0]) + ' · ' + escapeHtml(e.titulo) + '</b>' + (e.sub ? '<br><span class="saldo-data">' + escapeHtml(e.sub) + '</span>' : '') + (est[0] ? '<br><span class="pb-tg ' + (est[1] === 'ok' ? 'ok' : (est[1] === 'neg' ? '' : 'nv')) + '"' + (est[1] === 'neg' ? ' style="background:rgba(217,59,59,.12);color:var(--urgente)"' : '') + '>' + escapeHtml(est[0]) + '</span>' : '') + '</span>' + btn + '</div>';
  }
  var h = '<div class="pb-sec"><div class="pb-sec-t">Linha do tempo</div>';
  if (!ev.length) return h + '<div class="saldo-data">Ainda não há nada para mostrar.</div></div>';
  if (fut.length) h += '<div class="pr-tl-g">Próximos</div>' + fut.slice(0, lim).map(linha).join('');
  if (pas.length) h += '<div class="pr-tl-g">Anteriores</div>' + pas.slice(0, lim).map(linha).join('');
  if (!prS.tlTudo && (fut.length > lim || pas.length > lim)) h += '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-prf="tl-tudo">Mostrar tudo (' + ev.length + ')</button></div>';
  h += '<div class="saldo-data">Publicações: dos últimos 90 dias. Prazos e audiências de processo arquivado não aparecem.</div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-prf="pubs-todas" data-v="' + escapeHtml(r.num) + '">Ver todas as publicações deste processo</button></div></div>';
  return h;
}
/* histórico do processo: quem fez o quê em todos os registros daquele número (a partir da 5.8) */
function prHistCarregar(){
  var el = qs('prHistC'); if (!el) return; el.innerHTML = '<div class="saldo-data">Carregando…</div>';
  fetch('/api/historico/' + encodeURIComponent(prEd.num), { credentials: 'same-origin', cache: 'no-store' }).then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error((j.error && j.error.message) || 'Erro ' + r.status); return j; }); }).then(function(j){
    var its = j.itens || [];
    if (!its.length){ el.innerHTML = '<div class="saldo-data">Ainda não há ações registradas neste processo (o histórico começa a valer a partir de agora).</div>'; return; }
    el.innerHTML = '<div class="pb-sec">' + its.map(function(x){
      var op = (typeof SG_OP !== 'undefined' && SG_OP[x.op]) ? SG_OP[x.op][0] : x.op, mud = (x.mud || []).slice(0, 3).map(function(m){ return '<div class="saldo-data" style="margin:0">' + escapeHtml((typeof SG_CAMPOS !== 'undefined' && SG_CAMPOS[m.c]) || m.c) + ': ' + (m.lista ? escapeHtml(String(m.a)) + ' → ' + escapeHtml(String(m.d)) : escapeHtml(sgValor(m.a)) + ' → ' + escapeHtml(sgValor(m.d))) + '</div>'; }).join('');
      return '<div class="pr-tl-l" style="align-items:flex-start"><span class="pr-tl-d" style="min-width:64px"><small>' + escapeHtml(sgDataHora(x.em)) + '</small></span><span class="pr-t" style="flex:1"><b>' + escapeHtml(x.por || '') + '</b> ' + escapeHtml(op) + ' · ' + escapeHtml(x.rotulo || '') + (x.titulo ? ' — ' + escapeHtml(x.titulo) : '') + mud + '</span></div>';
    }).join('') + '</div>';
  }).catch(function(e){ el.innerHTML = '<div class="form-error">Não consegui abrir o histórico: ' + escapeHtml(e.message) + '</div>'; });
}
/* "Registrar no processo": anotação sem prazo (ex.: guardar a decisão para a futura preliminar de apelação) */
function prRegistrar(p, texto){
  var n = prNum(p.processo || p.numero), r = n ? prMapa().m[n] : null;
  if (!r){ toast('Cadastre o processo antes de registrar.'); return; }
  var reg = { em: new Date().toISOString(), data: todayISO(), texto: texto, pubId: p.id };
  var doc = r.doc, ps;
  if (doc){ var nd = Object.assign({}, doc, { registros: (doc.registros || []).concat([reg]) }); delete nd.id; ps = pbApi('/api/db/processos/' + encodeURIComponent(doc.id), 'PUT', nd).then(function(){ doc.registros = nd.registros; }); }
  else {
    var d = { numero: r.numero, partes: prTitulo(r), orgao: '', classe: '', clienteIds: prClienteIds(r), obs: '', honorarios: 'sem', origem: 'manual', derivado: true, arquivado: false, criadoEm: new Date().toISOString(), registros: [reg] };
    ps = pbApi('/api/db/processos', 'POST', d).then(function(j){ d.id = j.id; prDocs.push(d); });
  }
  ps.then(function(){ toast('Registrado no processo.'); prDepois(); }).catch(function(e){ toast('Não consegui registrar: ' + e.message); });
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
  if (doc && doc.revisar){
    var sg = doc.sugestaoClienteId ? clienteById(doc.sugestaoClienteId) : null;
    h += '<div class="pb-sec"><div class="pb-sec-t">Importado do Diário Oficial · falta o cliente</div><div class="pb-aviso">' + (sg ? 'Cliente parecido: <b>' + escapeHtml(sg.nome) + '</b>.' : 'Nenhum cliente parecido. Escolha um cliente abaixo ou cadastre um novo.') + ' Ao salvar com um cliente vinculado, o processo sai da revisão.</div>' +
      (sg ? '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-prf="rev-sug" data-v="' + escapeHtml(sg.id) + '">Vincular a ' + escapeHtml(sg.nome.length > 24 ? sg.nome.slice(0, 24) + '…' : sg.nome) + '</button></div>' : '') + '</div>';
  }
  if (novo) h += '<div class="parcela-sum">Digite o número do processo: o app busca sozinho no Diário Oficial (partes, valor da causa) e no DataJud do CNJ (vara, classe, assunto, data de ajuizamento). O que não vier você preenche. Honorários a receber ficam em Iniciais, Termos de Acordo ou Alvarás.</div><div id="pr_vinc"></div>';
  h += '<div class="field"><label class="field-label" for="pr_numero">Número do processo</label><input type="text" id="pr_numero" maxlength="40" value="' + escapeHtml(novo ? (pre.numero || '') : r.numero) + '"' + (novo ? ' placeholder="0000000-00.0000.0.00.0000"' : ' readonly') + '><div class="saldo-data" id="pr_numinfo"></div><div class="saldo-data" id="pr_dados"></div><div class="saldo-data" id="pr_dj"></div><div class="pb-acts" style="margin-top:4px">' + (novo ? '' : '<button type="button" class="btn-text" data-prf="buscar-dados">Buscar dados no Diário Oficial</button>') + '<button type="button" class="btn-text" data-prf="buscar-dj">Buscar dados no DataJud</button></div></div>' +
    '<div class="field"><label class="field-label" for="pr_partes">Partes (autor x réu)</label><input type="text" id="pr_partes" maxlength="120" value="' + escapeHtml(novo ? (pre.partes || '') : (doc ? (doc.partes || '') : prPartes(r))) + '" placeholder="Ex.: Fulano de Tal x Banco Exemplo">' +
    /* autor e réu não aparecem mais como campos: saem do texto das partes (antes do " x " e depois dele) ao salvar */
    '<input type="hidden" id="pr_autor" value="' + escapeHtml(novo ? (pre.autor || '') : (doc ? (doc.autor || '') : '')) + '"><input type="hidden" id="pr_reu" value="' + escapeHtml(novo ? (pre.reu || '') : (doc ? (doc.reu || prReu(r)) : prReu(r))) + '"></div>' +
    '<div class="field"><label class="field-label" for="pr_orgao">Tribunal / órgão</label><input type="text" id="pr_orgao" maxlength="120" value="' + escapeHtml(novo ? (pre.orgao || '') : (doc ? (doc.orgao || '') : '')) + '" placeholder="Ex.: TJGO · Morrinhos 1ª Vara Cível"></div>' +
    '<div class="field"><label class="field-label" for="pr_classe">Classe / assunto</label><input type="text" id="pr_classe" maxlength="120" value="' + escapeHtml(novo ? (pre.classe || '') : (doc ? (doc.classe || '') : '')) + '" placeholder="Ex.: Cumprimento de sentença"></div>' +
    '<div class="field"><label class="field-label" for="pr_area">Área</label><select id="pr_area" class="filter-select" style="width:100%"><option value="">Automática' + (r ? ' (' + panAreaSug(r) + ')' : '') + '</option>' + PR_AREAS.map(function(a){ return '<option' + ((novo ? '' : (doc && doc.area)) === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div>' +
    (arq ? '<div class="field"><label class="field-label" for="pr_res">Resultado do processo</label><select id="pr_res" class="filter-select" style="width:100%"><option value="">Não informado</option>' + Object.keys(PR_RES).map(function(k){ return '<option value="' + k + '"' + (doc && doc.resultado === k ? ' selected' : '') + '>' + PR_RES[k] + '</option>'; }).join('') + '</select></div>' : '') +
    '<div class="field"><label class="field-label" for="pr_assunto">Assunto</label><input type="text" id="pr_assunto" maxlength="160" value="' + escapeHtml(novo ? (pre.assunto || '') : (doc ? (doc.assunto || '') : '')) + '" placeholder="Ex.: Indenização por dano moral"></div>' +
    '<div class="field"><label class="field-label" for="pr_ajuiz">Data de ajuizamento (opcional)</label><input type="date" id="pr_ajuiz" value="' + escapeHtml(novo ? '' : (doc ? (doc.ajuizamento || '') : '')) + '"></div>' +
    '<div class="field"><label class="field-label" for="pr_valor">Valor da causa (opcional)</label><input type="text" id="pr_valor" inputmode="decimal" maxlength="20" value="' + escapeHtml(novo ? (pre.valorCausa ? prFmtValor(pre.valorCausa) : '') : (doc && doc.valorCausa ? prFmtValor(doc.valorCausa) : '')) + '" placeholder="Ex.: 40.000,00"></div>' +
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
      '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-prf="novo-hon" data-v="caso">Adicionar honorários (fixo, êxito…)</button><button type="button" class="btn btn-ghost pb-b" data-prf="novo-hon" data-v="acordo">Adicionar termo de acordo</button><button type="button" class="btn btn-ghost pb-b" data-prf="novo-hon" data-v="alvara">Adicionar alvará</button></div></div>';
    var pz = prPrazosAbertos(r);
    h += '<div class="pb-sec"><div class="pb-sec-t">Prazos e audiências (Agenda)</div>' + (pz.length ? pz.map(function(i){ var c = agChip(i); return '<div class="pb-lin"><span><b style="color:var(--ink)">' + escapeHtml(i.titulo) + '</b><br><span class="saldo-data">' + escapeHtml(agTipoLinha(i)) + '</span></span><button type="button" class="btn btn-ghost pb-b" data-prf="prazo-abrir" data-v="' + escapeHtml(i.key) + '">' + escapeHtml(c.t) + ' ›</button></div>'; }).join('') : '<div class="saldo-data">Nenhum prazo aberto.</div>') +
      '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-prf="prazo-novo">Novo prazo deste processo</button></div></div>';
    h += prTimelineHtml(r) + '<div class="pb-sec"><div class="pb-sec-t">Histórico</div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-prf="hist">Histórico: quem fez o quê</button></div><div id="prHistC"></div></div>' + '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-prf="rel">🖨 Relatório deste processo</button></div>';
  }
  var pxi = doc ? prProximaInfo(r) : null;
  h += '<div class="field"><label class="field-label" for="pr_prox">Próxima providência (opcional)</label><input type="text" id="pr_prox" maxlength="140" value="' + escapeHtml(doc ? (doc.proxima || '') : '') + '" placeholder="Ex.: Pedir penhora via SISBAJUD"></div>' +
    '<div class="field"><label class="field-label" for="pr_proxdata">Fazer até (a data coloca a tarefa na Agenda)</label><input type="date" id="pr_proxdata" value="' + escapeHtml(doc ? (doc.proximaData || '') : '') + '">' + (pxi && pxi.feito ? '<div class="saldo-data" style="color:var(--success)">✓ Concluída' + (pxi.concluidoEm ? ' em ' + escapeHtml(fmtData(pxi.concluidoEm)) : '') + '. Escreva a próxima ou limpe o campo.</div>' : '') + '</div>';
  h += '<div class="field"><label class="field-label" for="pr_obs">Observações</label><textarea id="pr_obs" rows="3" maxlength="600" placeholder="Anotações sobre o processo">' + escapeHtml(novo ? '' : ((doc && doc.obs) || '')) + '</textarea></div>';
  if (novo) h += '<div class="field"><label class="field-label" for="pr_hon">Honorários</label><select id="pr_hon" class="filter-select" style="width:100%">' + ['sem', 'quitados'].map(function(k){ return '<option value="' + k + '">' + PR_HON[k] + '</option>'; }).join('') + '<option value="receber">Tenho honorários a receber (fixo, êxito…)</option></select><div class="saldo-data">Ao escolher a última opção, depois de salvar abre o cadastro dos honorários.</div></div>';
  h += '<div class="field" id="esResp_processos"></div>';
  h += '<div class="form-error" id="pr_erro"></div><button type="button" class="btn btn-primary" data-prf="salvar" style="width:100%;justify-content:center;">' + (novo ? 'Cadastrar processo' : 'Salvar') + '</button>';
  if (!novo) h += (arq ? '<button type="button" class="btn btn-ghost" data-prf="reabrir" style="width:100%;justify-content:center;">Reabrir processo</button>' : '<button type="button" class="btn btn-ghost" data-prf="arquivar" style="width:100%;justify-content:center;">Concluir e arquivar</button>') + (doc && !r.links.length ? '<button type="button" class="btn-text" data-prf="excluir" style="color:var(--urgente)">Excluir este processo</button>' : '');
  qs('prCorpo').innerHTML = h; try{ esRespIniciar('processos', doc); }catch(e){} prChips(); prInfoNumero(); prRefazVinc(); try{ adAbrirData(qs('pr_ajuiz')); adAbrirData(qs('pr_proxdata')); }catch(e){}
  prEd.buscadoDj = '';
  if (novo){ prEd.iniPartes = qs('pr_partes').value; prEd.buscado = ''; if (qs('pr_numero').value.trim()){ prBuscarDados(); prBuscarDatajud(); } }
}
function prSalvar(){
  var novo = prEd.novo, err = qs('pr_erro'), numero = qs('pr_numero').value.trim();
  if (!numero){ err.textContent = 'Informe o número do processo.'; return; }
  var a = cnjAnalisar(numero); if (a && a.completo) numero = a.formatado;
  var n = prNum(numero), mp = prMapa(), ex = mp.m[n];
  if (novo && ex && ex.doc){ err.textContent = 'Este processo já está cadastrado.'; return; }
  var dv = prDividePartes(qs('pr_partes').value);
  var campos = { numero: numero, partes: qs('pr_partes').value.trim(), orgao: qs('pr_orgao').value.trim(), classe: qs('pr_classe').value.trim(), autor: dv ? dv.autor : qs('pr_autor').value.trim(), reu: dv ? dv.reu : qs('pr_reu').value.trim(), area: qs('pr_area').value, valorCausa: prParseValor(qs('pr_valor').value), assunto: qs('pr_assunto').value.trim(), ajuizamento: qs('pr_ajuiz').value || '', clienteIds: prEd.ids.slice(), obs: qs('pr_obs').value.trim() };
  if (qs('pr_res')){ campos.resultado = qs('pr_res').value; campos.resultadoEm = campos.resultado ? ((ex && ex.doc && ex.doc.resultadoEm) || new Date().toISOString()) : ''; }
  campos.proxima = qs('pr_prox').value.trim(); campos.proximaData = campos.proxima ? (qs('pr_proxdata').value || '') : '';
  var hon = qs('pr_hon'), querHon = hon && hon.value === 'receber'; if (hon) campos.honorarios = querHon ? ((ex && ex.doc && PR_HON[ex.doc.honorarios]) ? ex.doc.honorarios : 'sem') : hon.value;
  var ho = qs('pr_honobs'); if (ho) campos.honObs = ho.value.trim();
  if (!esRespAplicar('processos', campos, err)) return;
  var doc = ex && ex.doc, p, vincId = novo && prEd.vinc ? prEd.vinc : null, vincAnt = '';
  var pedirAuto = null;
  if (doc && doc.revisar && campos.clienteIds.length){ pedirAuto = { cli: campos.clienteIds[0], nome: doc.parteNome || '' }; campos.revisar = ''; campos.revisadoEm = new Date().toISOString(); campos.sugestaoClienteId = ''; }
  if (vincId){ var cv0 = casos.filter(function(x){ return x.id === vincId; })[0]; if (cv0) vincAnt = cv0.numeroProcesso || ''; else vincId = null; }
  var provP = prSincProvidencia({ prox: campos.proxima, data: campos.proximaData, antId: doc && doc.proximaAgId, numero: numero, cliente: campos.partes || campos.clienteIds.map(nomeCliente).join(', ') });
  if (doc){ p = provP.then(function(agId){ campos.proximaAgId = agId; var novoDoc = Object.assign({}, doc, campos); delete novoDoc.id; return pbApi('/api/db/processos/' + encodeURIComponent(doc.id), 'PUT', novoDoc).then(function(){ Object.assign(doc, campos); }); }); }
  else {
    p = provP.then(function(agId){
      campos.proximaAgId = agId;
      var d = Object.assign({ honorarios: 'sem', arquivado: false, origem: (prEd.pre && prEd.pre.origem) || 'manual', criadoEm: new Date().toISOString() }, campos);
      if (!novo) d.derivado = true;
      return pbApi('/api/db/processos', 'POST', d).then(function(j){ d.id = j.id; prDocs.push(d); });
    });
  }
  if (vincId && prNum(vincAnt) !== n) p = p.then(function(){ var cv = casos.filter(function(x){ return x.id === vincId; })[0]; return cv ? persistPatchDoc('caso', cv, { numeroProcesso: numero }) : null; });
  p.then(function(){
    qs('overlayPr').classList.remove('show');
    if (vincId) toast('Processo cadastrado e ligado à Inicial.', 'Desfazer', function(){ var cv = casos.filter(function(x){ return x.id === vincId; })[0]; if (cv) persistPatchDoc('caso', cv, { numeroProcesso: vincAnt }).then(function(){ prDepois(); }); });
    else toast(novo ? 'Processo cadastrado.' : 'Salvo.');
    if (pedirAuto){ try{ prAprenderApelido(pedirAuto.cli, pedirAuto.nome); }catch(e){} setTimeout(function(){ impPerguntarAuto(pedirAuto.cli, pedirAuto.nome); }, 250); }
    prDepois(); if (querHon){ prEd = { num: n, novo: false, ids: [] }; setTimeout(function(){ prNovoHonorario('caso'); }, 80); } }).catch(function(e){ err.textContent = 'Não consegui salvar: ' + e.message; });
}
function prExcluir(b){
  var r = prMapa().m[prEd.num]; if (!r || !r.doc) return;
  if (b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Toque de novo para excluir'; return; }
  (r.doc.proximaAgId ? prSincProvidencia({ prox: '', data: '', antId: r.doc.proximaAgId }) : Promise.resolve()).then(function(){ return pbApi('/api/db/processos/' + encodeURIComponent(r.doc.id), 'DELETE'); }).then(function(){ prDocs = prDocs.filter(function(x){ return x.id !== r.doc.id; }); try{ impIgnorar(r.num); }catch(e){} qs('overlayPr').classList.remove('show'); toast('Processo excluído.'); prDepois(); }).catch(function(e){ qs('pr_erro').textContent = e.message; });
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
function prSemProcessoMarcar(on, soSeTem){
  var ck = qs('semProcessoInput'), fl = ck && ck.closest ? ck.closest('.field') : null; if (!ck) return;
  var tem = !!(qs('processoInput') && qs('processoInput').value.trim());
  if (soSeTem){ if (tem) ck.checked = false; } else ck.checked = !!on;
  if (fl) fl.style.display = (tem || prModoHon) ? 'none' : '';
}
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
  abrirNovo = function(){ prModoHon = !!prProximoHon; prProximoHon = false; var r = oN.apply(this, arguments); prSemProcessoMarcar(false); prAplicaModoHon(); return r; };
  abrirEdicao = function(id){ var c = casos.filter(function(x){ return x.id === id; })[0]; prModoHon = !!(c && c.doProcesso); var r = oE.apply(this, arguments); prSemProcessoMarcar(!!(c && c.semProcesso && !prNum(c.numeroProcesso))); prAplicaModoHon(); return r; };
  var pin = qs('processoInput'); if (pin) pin.addEventListener('input', function(){ prSemProcessoMarcar(false, true); });
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
    '<div class="field"><label class="field-label" for="pra_res">Resultado (para as análises)</label><select id="pra_res" class="filter-select" style="width:100%"><option value="">Informar depois</option>' + Object.keys(PR_RES).map(function(k){ return '<option value="' + k + '">' + PR_RES[k] + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label class="field-label" for="pra_data">Data</label><input type="date" id="pra_data" value="' + todayISO() + '"></div>' +
    '<div class="saldo-data">Se chegar publicação nova deste processo, o app avisa e você pode reabrir.</div><div class="form-error" id="pra_erro"></div><button type="button" class="btn btn-primary" id="praOk" style="width:100%;justify-content:center;">Arquivar processo</button>';
  qs('praCorpo').innerHTML = h; adAbrirData(qs('pra_data')); qs('overlayPrArq').classList.add('show');
}
function prConfirmarArq(){
  var r = prMapa().m[prArqNum]; if (!r) return;
  var mot = (document.querySelector('input[name="pra_mot"]:checked') || {}).value || '', data = qs('pra_data').value || todayISO(), agora = new Date().toISOString();
  var campos = { arquivado: true, arquivadoEm: agora, dataArquivo: data, motivoArquivo: mot, resultado: qs('pra_res').value || '', resultadoEm: qs('pra_res').value ? agora : '' }, p;
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
  var campos = { arquivado: false, arquivadoEm: null, dataArquivo: '', motivoArquivo: '', resultado: '', resultadoEm: '' }, nd = Object.assign({}, r.doc, campos); delete nd.id;
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
        '<button type="button" class="btn btn-ghost pb-b" data-prf="sug-new" data-i="' + i + '">Cadastrar como cliente</button></div>';
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
  var rep0 = pbMembros(p).filter(function(x){ return x.ativo || x.passivo; })[0] || p;
  if (rep0.ativo && rep0.passivo) partes = (rep0.ativo + ' x ' + rep0.passivo).slice(0, 120);
  return { autor: rep0.ativo || '', reu: rep0.passivo || '', numero: p.numero || p.processo, partes: partes || pbNomeParte(p, null), orgao: [p.tribunal, p.orgao].filter(Boolean).join(' · '), classe: pbClasse(p.classe), ids: ids, nomes: nomes, origem: 'publicacao' };
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

/* ---------- vincular a uma Inicial já cadastrada (transitório) ----------
   Só Iniciais cadastradas até o dia da implantação e que ainda não têm processo cadastrado com o mesmo número.
   Vincular = gravar o número do processo na Inicial; daí a lista única junta os dois. Quando não sobrar nenhuma, a opção some. */
function prCarregarCorte(){
  if (!window.__SERVIDOR) return;
  pbApi('/api/db/config').then(function(r){
    var d = (r.docs || []).filter(function(x){ return x.id === 'vinculoIniciais'; })[0];
    if (d && d.data && d.data.corte) return d.data.corte;
    var c = new Date().toISOString();
    return pbApi('/api/db/config/vinculoIniciais', 'PUT', { corte: c }).then(function(){ return c; });
  }).then(function(c){ prCorte = c; prDepois(); }).catch(function(){});
}
/* Iniciais ainda sem processo cadastrado (com ou sem número). Permanente (antes só valia para as Iniciais anteriores à implantação).
   Arquivadas só entram na escolha ao cadastrar o processo, não no aviso. */
function prIniciaisPend(comArquivadas){
  var mp = prMapa().m;
  return casos.filter(function(c){
    if ((c.tipo || 'inicial') !== 'inicial' || c.doProcesso || c.semProcesso) return false;
    if (c.arquivado && !comArquivadas) return false;
    var n = prNum(c.numeroProcesso), r = n ? mp[n] : null;
    return !(r && r.doc);
  });
}
function prAvisoVinc(){
  var el = qs('prAvisoVinc'); if (!el) return;
  var n = prIniciaisPend(false).length, nr = impContaRev(), rev = '';
  if (nr && prS.filtro === 'revisar') rev = '<div class="pb-sec" style="margin:0 0 8px"><div class="pb-sec-t">Revisão dos importados</div><div class="pb-aviso">Mostrando só os <b>' + nr + '</b> ' + (nr === 1 ? 'processo' : 'processos') + ' que faltam vincular a um cliente: vincule, escolha outro cliente, cadastre um novo ou exclua o que não quiser no sistema.</div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-pr="filtro" data-v="andamento">Voltar à lista completa</button></div></div>';
  else if (nr) rev = '<div class="pb-sec" style="margin:0 0 8px"><div class="pb-sec-t">Importados do Diário Oficial</div><div class="pb-aviso"><b>' + nr + '</b> ' + (nr === 1 ? 'processo espera' : 'processos esperam') + ' a revisão do cliente.</div><div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-pr="rev-ir">Revisar agora</button></div></div>';
  el.innerHTML = rev + (n ? '<div class="saldo-data" style="margin:0 0 8px">' + n + (n === 1 ? ' Inicial ainda não está ligada a um processo cadastrado' : ' Iniciais ainda não estão ligadas a um processo cadastrado') + '. Ao cadastrar o processo, escolha “Vincular a uma Inicial cadastrada”. Se uma Inicial não tem processo, marque isso no cadastro dela.</div>' : '') + (typeof lgBannerHtml === 'function' ? lgBannerHtml() : '');
}
function prVincNivel(c){
  var pre = (prEd && prEd.pre) || {}, nomes = (pre.nomes || []).concat([pre.autor, pre.reu]).filter(Boolean);
  var meus = [c.cliente].concat((c.clienteIds || []).map(nomeCliente)).filter(Boolean), best = 0;
  (c.clienteIds || []).forEach(function(i){ if (prEd.ids.indexOf(i) >= 0) best = 3; });
  nomes.forEach(function(n){ meus.forEach(function(m){ var v = cliNivel(n, m); if (v > best) best = v; }); });
  return best;
}
function prVincLinha(c, nivel){
  var numAtual = qs('pr_numero') ? prNum(qs('pr_numero').value) : '', tem = prNum(c.numeroProcesso);
  if (prEd.vincAviso === c.id){
    var novoNum = qs('pr_numero') && qs('pr_numero').value.trim() ? qs('pr_numero').value.trim() : 'o número deste processo';
    return '<div class="pb-lin" style="display:block"><b style="color:var(--ink)">' + escapeHtml(c.cliente + ' · ' + (c.nomeAcao || 'Inicial')) + '</b><div class="form-error" style="display:block">Esta Inicial já tem o número ' + escapeHtml(c.numeroProcesso) + '. Se seguir, ele será trocado por ' + escapeHtml(novoNum) + '.</div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-prf="vinc-cancel">Cancelar</button><button type="button" class="btn btn-primary pb-b" data-prf="vinc-seguir" data-v="' + escapeHtml(c.id) + '">Seguir e trocar</button></div></div>';
  }
  var det = [honorarioPrincipal(c), 'cadastrada em ' + fmtData(String(c.criadoEm || '').slice(0, 10)), c.arquivado ? 'arquivada' : '', tem && tem !== numAtual ? 'já tem o nº ' + c.numeroProcesso : ''].filter(Boolean).join(' · ');
  return '<div class="pb-lin"><span><b style="color:var(--ink)">' + escapeHtml(c.cliente + ' · ' + (c.nomeAcao || 'Inicial')) + '</b>' + (nivel >= 2 ? ' <span class="pb-tg ok">provável</span>' : '') + '<br><span class="saldo-data">' + escapeHtml(det) + '</span></span><button type="button" class="btn btn-ghost pb-b" data-prf="vinc-esc" data-v="' + escapeHtml(c.id) + '">Vincular</button></div>';
}
function prRefazVincLista(){
  var box = qs('pr_vinclista'); if (!box || !prEd) return;
  var q = normNome(prEd.vincQ || ''), pend = prIniciaisPend(true).map(function(c){ return { c: c, nivel: prVincNivel(c) }; });
  var l = pend.filter(function(x){ return !q || normNome([x.c.cliente, x.c.nomeAcao, x.c.numeroProcesso, (x.c.clienteIds || []).map(nomeCliente).join(' ')].join(' ')).indexOf(q) >= 0; });
  l.sort(function(a, b){ return b.nivel - a.nivel || String(b.c.criadoEm || '').localeCompare(String(a.c.criadoEm || '')); });
  box.innerHTML = l.length ? l.slice(0, 30).map(function(x){ return prVincLinha(x.c, x.nivel); }).join('') + (l.length > 30 ? '<div class="saldo-data">Mostrando 30 de ' + l.length + '. Use a busca.</div>' : '') : '<div class="saldo-data">Nenhuma Inicial encontrada.</div>';
}
function prRefazVinc(){
  var el = qs('pr_vinc'); if (!el || !prEd || !prEd.novo) return;
  var esc = prEd.vinc ? casos.filter(function(x){ return x.id === prEd.vinc; })[0] : null, n = prIniciaisPend(true).length;
  if (esc){
    el.innerHTML = '<div class="pb-sec"><div class="pb-sec-t">Ligado à Inicial</div><div class="pb-lin"><span><b style="color:var(--ink)">' + escapeHtml(esc.cliente + ' · ' + (esc.nomeAcao || 'Inicial')) + '</b><br><span class="saldo-data">Ao cadastrar, o número do processo passa para essa Inicial e os honorários dela aparecem na ficha do processo.</span></span><button type="button" class="btn-text pb-b" data-prf="vinc-rm">Remover</button></div></div>';
  } else if (!n){ el.innerHTML = ''; }
  else if (!prEd.vincAberto){
    el.innerHTML = '<div class="pb-sec"><div class="pb-sec-t">Este processo já está cadastrado como Inicial?</div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-prf="vinc-abrir">Vincular a uma Inicial cadastrada (' + n + ')</button></div></div>';
  } else {
    el.innerHTML = '<div class="pb-sec"><div class="pb-sec-t">Escolha a Inicial deste processo</div><div class="field" style="margin:0 0 6px"><input type="text" id="pr_vincq" placeholder="Buscar por cliente ou ação…" autocomplete="off" value="' + escapeHtml(prEd.vincQ || '') + '"></div><div id="pr_vinclista"></div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-prf="vinc-fechar">Nenhuma dessas, cadastrar processo novo</button></div></div>';
    prRefazVincLista();
  }
}
function prVincEscolher(id, seguir){
  var c = casos.filter(function(x){ return x.id === id; })[0]; if (!c || !prEd) return;
  var tem = prNum(c.numeroProcesso), atual = qs('pr_numero') ? prNum(qs('pr_numero').value) : '';
  if (tem && tem !== atual && !seguir){ prEd.vincAviso = id; prRefazVincLista(); return; }
  prEd.vinc = id; prEd.vincAviso = null; prEd.vincAberto = false;
  idsValidos(c.clienteIds || []).forEach(function(i){ if (prEd.ids.indexOf(i) < 0) prEd.ids.push(i); });
  if (qs('pr_classe') && !qs('pr_classe').value.trim() && c.nomeAcao) qs('pr_classe').value = c.nomeAcao;
  if (qs('pr_partes') && !qs('pr_partes').value.trim() && c.cliente) qs('pr_partes').value = c.cliente;
  prChips(); prRefazVinc();
}

/* ---------- perfil do cliente e Arquivados ---------- */
(function(){
  var origPerfil = renderPerfil;
  /* no perfil do cliente, tudo fica numa seção só: "Processos e atos" (os processos cadastrados + as Iniciais, Acordos e Alvarás) */
  renderPerfil = function(){
    var r = origPerfil.apply(this, arguments);
    try{
      var body = qs('perfilBody'), id = perfilClienteId; if (!body || !id) return r;
      var ac = body.querySelector('.cli-acoes'); if (ac && !body.querySelector('[data-pr-relcli]')) ac.insertAdjacentHTML('afterend', '<div class="cli-acoes"><button type="button" class="btn btn-ghost" data-pr-relcli="' + escapeHtml(id) + '" style="width:100%;justify-content:center;">🖨 Relatório de processos deste cliente</button></div>');
      var mp = prMapa(), pm = pendentesPorDoc(), l = mp.ordem.map(function(n){ return mp.m[n]; }).filter(function(x){ return x.doc && prClienteIds(x).indexOf(id) >= 0; });
      var det = body.querySelector('details[data-sec="atos"]'); if (!det || !l.length) return r;
      var cont = det.querySelector('.cli-sec-body'), sp = det.querySelector('summary span');
      var itens = l.map(function(x){
        var chips = prHonChips(x, pm).map(function(c){ return '<span class="pb-tg ' + (c[1] === 'ok' ? 'ok' : '') + '">' + escapeHtml(c[0]) + '</span>'; }).join(' '), pz = prPrazosAbertos(x).length, reu = prReu(x), orgao = x.doc.orgao || '';
        return '<div class="cli-item"><div class="t"><span><span class="badge">Processo</span> ' + escapeHtml(prTitulo(x)) + (prArquivado(x) ? ' <span class="badge arq">Arquivado</span>' : '') + '</span></div>' +
          '<div class="s">' + escapeHtml([x.numero, orgao].filter(Boolean).join(' · ')) + '</div>' +
          (reu || pz ? '<div class="s">' + escapeHtml([reu ? 'Réu: ' + reu : '', pz ? pz + (pz === 1 ? ' prazo aberto' : ' prazos abertos') : ''].filter(Boolean).join(' · ')) + '</div>' : '') +
          '<div class="pb-tags" style="margin-top:4px">' + chips + '</div><div class="bt"><button type="button" data-pr-abrir="' + escapeHtml(x.num) + '">Abrir</button></div></div>';
      }).join('');
      var vazio = cont.querySelector(':scope > .s'); if (vazio && /Nenhum lançamento/.test(vazio.textContent)) vazio.remove();
      cont.insertAdjacentHTML('afterbegin', itens);
      var m = /\((\d+)\)/.exec(sp.textContent), n0 = m ? Number(m[1]) : 0;
      sp.textContent = 'Processos e atos (' + (n0 + l.length) + ')';
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
    var rc = t.closest ? t.closest('[data-pr-relcli]') : null;
    if (rc){ ev.stopPropagation(); rptProcessosCliente(rc.getAttribute('data-pr-relcli')); return; }
    var re = t.closest ? t.closest('[data-pr-reabrir]') : null;
    if (re){ ev.stopPropagation(); prReabrir(re.getAttribute('data-pr-reabrir')); }
  }, true);
})();

/* ---------- partida ---------- */
(function(){
  var r1 = prRender, r2 = prRenderLista;
  prRender = function(){ var a = arguments; return prComMemo(function(){ return r1.apply(null, a); }); };
  prRenderLista = function(){ var a = arguments; return prComMemo(function(){ return r2.apply(null, a); }); };
  var st = document.createElement('style');
  st.textContent = '.pr-card .pb-tipo{flex:none}.pr-tl-g{font-size:var(--t2);font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);margin-top:6px}.pr-tl-l{display:grid;grid-template-columns:44px 8px minmax(0,1fr) auto;gap:8px;align-items:start;padding:8px 0;border-top:1px solid var(--border);font-size:var(--t3)}.pr-tl-d{font-weight:700;color:var(--ink);line-height:1.1}.pr-tl-d small{display:block;font-weight:400;color:var(--ink-soft);font-size:var(--t1)}.pr-tl-p{width:8px;height:8px;border-radius:50%;margin-top:5px}.pr-tl-t{min-width:0;overflow-wrap:anywhere}.pr-tl-t b{color:var(--ink)}';
  document.head.appendChild(st);
  prCarregar(); prCarregarCorte();
})();

(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { prAbrir: prAbrir }); })();
