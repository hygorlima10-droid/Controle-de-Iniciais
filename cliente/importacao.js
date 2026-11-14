/* ============================================================
   IMPORTAR PROCESSOS DO DIÁRIO OFICIAL (prefixo imp)
   - lê as publicações das OABs num período (página por página, pelo servidor), agrupa por processo e mostra o que ainda não está cadastrado
   - cadastra os escolhidos na hora, com o que o Diário Oficial traz (partes, vara, classe, valor da causa); o DataJud completa assunto e data depois
   - cliente: se o cliente está marcado como "vincular automaticamente", vincula direto; se há cliente parecido ou nenhum,
     cadastra sem vincular e deixa na REVISÃO (processos.js: filtro "Revisar"); ao confirmar um vínculo o app pergunta se os próximos podem ir direto
   - o mesmo vale para processo novo que aparecer nas publicações (config/importacaoAuto)
   - processo excluído na revisão vai para config/processosIgnorados e não é cadastrado de novo
   ============================================================ */
var impS = { fase: 'config', dias: 90, oabs: {}, ach: null, filtro: 'curso', sel: {}, mais: 1, res: null, erro: '', prog: '', cancel: false,
  cfg: { ativo: true, desde: '' }, cfgOk: false, ign: {}, cli: false, autoRodando: false, autoEm: 0, dj: { rodando: false, feitos: 0 } };
var IMP_PERIODOS = [[30, '30 dias'], [90, '90 dias'], [180, '6 meses'], [365, '12 meses']];

/* ---------- configuração guardada (config/importacaoAuto e config/processosIgnorados) ---------- */
function impCarregarCfg(){
  if (!window.__SERVIDOR) return Promise.resolve();
  return Promise.all([pbApi('/api/db/config'), pbApi('/api/djen/estado').catch(function(){ return {}; })]).then(function(r){
    var docs = r[0].docs || [], porId = {}; docs.forEach(function(d){ porId[d.id] = d.data || {}; });
    var padrao = r[1].importarAuto !== false;
    var c = porId.importacaoAuto;
    if (c && typeof c.ativo === 'boolean') impS.cfg = { ativo: c.ativo, desde: c.desde || '' };
    else { impS.cfg = { ativo: padrao, desde: new Date().toISOString() }; pbApi('/api/db/config/importacaoAuto', 'PUT', impS.cfg).catch(function(){}); }
    if (!impS.cfg.desde){ impS.cfg.desde = new Date().toISOString(); pbApi('/api/db/config/importacaoAuto', 'PUT', impS.cfg).catch(function(){}); }
    impS.ign = (porId.processosIgnorados && porId.processosIgnorados.numeros) || {};
    impS.cfgOk = true;
  }).catch(function(){ impS.cfgOk = false; });
}
function impGravarCfg(){ return pbApi('/api/db/config/importacaoAuto', 'PUT', { ativo: impS.cfg.ativo, desde: impS.cfg.desde }); }
function impGravarIgn(){ return pbApi('/api/db/config/processosIgnorados', 'PUT', { numeros: impS.ign }); }
function impIgnorar(num){ num = prNum(num); if (!num) return Promise.resolve(); impS.ign[num] = new Date().toISOString(); return impGravarIgn().catch(function(){}); }

/* ---------- reconhecer o cliente ---------- */
function impNomes(s){ return String(s || '').split(/;\s*/).map(function(x){ return x.trim(); }).filter(Boolean); }
function impJunta(l){ return l.slice(0, 3).join(', ') + (l.length > 3 ? ' e mais ' + (l.length - 3) : ''); }
function impPartesDe(g){
  var A = impNomes(g.ativo), P = impNomes(g.passivo);
  if (!A.length && !P.length) (g.dest || []).forEach(function(d){ (d.p === 'P' ? P : A).push(d.n); });
  var autor = impJunta(A), reu = impJunta(P);
  return { A: A, P: P, autor: autor.slice(0, 120), reu: reu.slice(0, 120), partes: ((A.length && P.length) ? autor + ' x ' + reu : impJunta(A.concat(P))).slice(0, 120) };
}
/* clientes cujo nome (ou outro nome) se parece com o de alguma parte; as partes intimadas vêm primeiro (costumam ser os clientes) */
function impCandidatos(g){
  var pt = impPartesDe(g), nomes = [], vistos = {};
  (g.dest || []).map(function(d){ return d.n; }).concat(pt.A, pt.P).forEach(function(n){ var k = normNome(n); if (n && !vistos[k]){ vistos[k] = 1; nomes.push(n); } });
  var por = {}, lista = [];
  nomes.forEach(function(n){ cliParecidos(n).forEach(function(m){ if (m.nivel < 2) return; var x = por[m.c.id]; if (!x){ x = por[m.c.id] = { c: m.c, nivel: m.nivel, nome: n }; lista.push(x); } else if (m.nivel > x.nivel){ x.nivel = m.nivel; x.nome = n; } }); });
  lista.sort(function(a, b){ return b.nivel - a.nivel; });
  return { lista: lista, nome: nomes[0] || '' };
}
/* o que fazer com o processo: vincular direto (cliente marcado como automático, sem dúvida) ou deixar na revisão */
function impDecidir(g){
  var c = impCandidatos(g), l = c.lista;
  if (l.length){
    var topo = l[0], empate = l.some(function(x){ return x !== topo && x.nivel >= topo.nivel; });
    if (topo.c.vinculoAuto === true && !empate) return { tipo: 'auto', cliente: topo.c, nome: topo.nome };
    return { tipo: 'revisar', motivo: 'cliente-parecido', sugestao: topo.c.id, nome: topo.nome };
  }
  return { tipo: 'revisar', motivo: 'sem-cliente', sugestao: '', nome: c.nome };
}
/* advogados nossos que participam: as OABs cadastradas que acharam o processo (g.oabs: { idDaOab: 1 }) */
function impAdvogadosDe(g){
  var out = [];
  Object.keys(g.oabs || {}).forEach(function(id){
    var o = (pbS.oabs || []).filter(function(x){ return x.id === id; })[0]; if (!o) return;
    var k = String(o.numero || '').replace(/\D/g, '').replace(/^0+/, '') + '/' + String(o.uf || '').toUpperCase().slice(0, 2);
    if (!out.some(function(a){ return a.oab === k; })) out.push({ oab: k, nome: String(o.nome || '').slice(0, 80) });
  });
  return out;
}
/* o documento do processo (a mesma forma do cadastro manual) */
function impMontarDoc(g, dec, origem){
  var pt = impPartesDe(g), agora = new Date().toISOString(), n = g.p;
  var d = { numero: g.numero || n, partes: pt.partes, autor: pt.autor, reu: pt.reu, orgao: [g.trib, g.orgao].filter(Boolean).join(' · ').slice(0, 120),
    classe: (typeof pbClasse === 'function' ? pbClasse(g.classe) : g.classe) || g.natureza || '', area: '', assunto: '', valorCausa: g.valor || 0, ajuizamento: '',
    clienteIds: dec.tipo === 'auto' ? [dec.cliente.id] : [], obs: '', honorarios: 'sem', arquivado: false, origem: 'diario', derivado: true, importadoEm: agora, criadoEm: agora,
    ultimaPublicacao: (g.ult && g.ult.data) || '', ultimaPubTipo: (g.ult && g.ult.tipo) || '', parteNome: dec.nome || '' };
  if (g.ult && g.ult.enc) d.possivelEncerrado = g.ult.enc;
  var adv = impAdvogadosDe(g); if (adv.length) d.advogados = adv;
  if (dec.tipo === 'auto'){ d.vinculoAuto = true; d.revisar = ''; }
  else { d.revisar = dec.motivo; d.sugestaoClienteId = dec.sugestao || ''; }
  if (String(n).length === 20) d.djPendente = true;
  return d;
}
function impIdDoc(num){ return 'd' + String(num).replace(/\D/g, '').slice(0, 30); }
/* grava um processo novo (sem sobrescrever o que já existir com o mesmo número) */
function impGravarProcesso(d){
  var id = impIdDoc(d.numero);
  return pbApi('/api/db/processos/' + id + '?soNovo=1', 'PUT', d).then(function(r){
    if (r && r.criado === false) return { existia: true };   /* outro aparelho acabou de criar: não mexe */
    var x = Object.assign({ id: id }, d); prDocs.push(x); return { existia: false, doc: x };
  });
}

/* ---------- processo novo que aparece nas publicações: cadastra sozinho (se estiver ligado) ---------- */
function impTalvezAuto(){
  if (!window.__SERVIDOR || impS.autoRodando) return;
  if (!impS.cfgOk){ if (!impS.cfgCarregando){ impS.cfgCarregando = true; impCarregarCfg().then(function(){ impS.cfgCarregando = false; impTalvezAuto(); }); } return; }
  if (!impS.cfg.ativo || !impS.cli || !prOk || !pbS.carregado || document.hidden) return;
  if (Date.now() - impS.autoEm < 4000) return;
  impS.autoEm = Date.now();
  var mp = prMapa().m, por = {};
  (pbS.pubs || []).forEach(function(p){
    var n = prNum(p.processo || p.numero); if (!n || mp[n] || impS.ign[n]) return;
    if (String(p.em || '') < impS.cfg.desde) return;   /* só o que chegou depois de ligar o cadastro automático */
    var x = por[n]; if (!x || p.data >= x.data) por[n] = p;
  });
  var nums = Object.keys(por).slice(0, 40); if (!nums.length) return;
  impS.autoRodando = true;
  var novos = 0, rev = 0, aut = 0;
  nums.reduce(function(cad, n){
    return cad.then(function(){
      var p = por[n];
      if (p.enc) return;   /* a publicação diz que acabou: não cadastra sozinho (aparece em Publicações) */
      var g = { p: n, numero: p.numero || n, trib: p.tribunal || '', orgao: p.orgao || '', classe: p.classe || '', natureza: p.natureza || '', ativo: p.ativo || '', passivo: p.passivo || '', valor: p.valor || 0, dest: p.dest || [], ult: { data: p.data, tipo: p.tipo, enc: '' }, oabs: (p.oabs || []).reduce(function(m, id){ m[id] = 1; return m; }, {}) };
      var dec = impDecidir(g), d = impMontarDoc(g, dec, 'diario');
      return impGravarProcesso(d).then(function(r){ if (!r.existia){ novos++; if (dec.tipo === 'auto') aut++; else rev++; } });
    });
  }, Promise.resolve()).catch(function(e){ console.error('cadastro automático', e); }).then(function(){
    impS.autoRodando = false;
    if (novos){ toast(novos + (novos === 1 ? ' processo novo cadastrado' : ' processos novos cadastrados') + ' pelas publicações' + (aut ? ' (' + aut + ' já vinculado' + (aut === 1 ? '' : 's') + ')' : '') + (rev ? ' · ' + rev + ' para revisar' : '') + '.'); prDepois(); impFilaDatajud(); }
  });
}

/* ---------- DataJud completa assunto e data de ajuizamento, um processo de cada vez, enquanto o app está aberto ---------- */
function impFilaDatajud(){
  if (!window.__SERVIDOR || impS.dj.rodando || document.hidden) return;
  var pend = prDocs.filter(function(d){ return d.djPendente && !d.arquivado && (d.djTent || 0) < 3; });
  if (!pend.length) return;
  impS.dj.rodando = true;
  function prox(){
    if (document.hidden || impS.dj.feitos >= 80){ impS.dj.rodando = false; return; }
    var d = prDocs.filter(function(x){ return x.djPendente && !x.arquivado && (x.djTent || 0) < 3; })[0];
    if (!d){ impS.dj.rodando = false; return; }
    var n = prNum(d.numero);
    pbApi('/api/datajud/processo?numero=' + n).then(function(r){
      var campos = { djTent: (d.djTent || 0) + 1 };
      if (r && r.ok && r.achou){
        var x = r.dados || {};
        if (!d.assunto && x.assuntos && x.assuntos.length) campos.assunto = x.assuntos.slice(0, 3).join('; ');
        if (!d.ajuizamento && x.ajuizamento) campos.ajuizamento = x.ajuizamento;
        if (!d.classe && x.classe) campos.classe = x.classe;
        if (!d.orgao && (x.orgao || x.tribunal)) campos.orgao = [x.tribunal, x.orgao].filter(Boolean).join(' · ');
        campos.djPendente = false;
      } else if (r && r.ok && !r.parcial) campos.djPendente = false;   /* o DataJud ainda não tem o processo: não insiste */
      var nd = Object.assign({}, d, campos); delete nd.id;
      return pbApi('/api/db/processos/' + encodeURIComponent(d.id), 'PUT', nd).then(function(){ Object.assign(d, campos); });
    }).catch(function(){ d.djTent = (d.djTent || 0) + 1; }).then(function(){ impS.dj.feitos++; setTimeout(prox, 1500); });
  }
  prox();
}

/* ---------- janela de importação ---------- */
function impMontarJanela(){
  if (qs('overlayImp')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayImp';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="impTit">Importar do Diário Oficial</h2><button class="icon-btn" id="impX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="impCorpo"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#impX'))){ if (impS.fase === 'buscando') impS.cancel = true; d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-imp]') : null; if (!b) return;
    var a = b.getAttribute('data-imp'), v = b.getAttribute('data-v');
    if (a === 'dias'){ impS.dias = Number(v); impDesenhar(); }
    else if (a === 'buscar') impBuscar();
    else if (a === 'cancelar'){ impS.cancel = true; }
    else if (a === 'filtro'){ impS.filtro = v; impS.mais = 1; impDesenhar(); }
    else if (a === 'todos'){ impLinhas().filter(function(l){ return impS.filtro === 'todos' || (impS.filtro === 'enc' ? !!l.g.ult.enc : !l.g.ult.enc); }).forEach(function(l){ impS.sel[l.g.p] = true; }); impDesenhar(); }
    else if (a === 'nenhum'){ impS.sel = {}; impDesenhar(); }
    else if (a === 'mais'){ impS.mais++; impDesenhar(); }
    else if (a === 'importar') impImportar();
    else if (a === 'voltar'){ impS.fase = 'config'; impDesenhar(); }
    else if (a === 'revisar'){ d.classList.remove('show'); prS.sub = 'lista'; prS.filtro = 'revisar'; prS.mais = 1; try{ if (activeTab !== 'processos') setActiveTab('processos'); }catch(e2){} prDepois(); }
    else if (a === 'fechar') d.classList.remove('show');
    else if (a === 'auto-liga'){ impS.cfg.ativo = !impS.cfg.ativo; if (impS.cfg.ativo) impS.cfg.desde = new Date().toISOString(); impGravarCfg().catch(function(){}); impDesenhar(); if (impS.cfg.ativo) toast('Ligado: os processos novos que aparecerem nas publicações serão cadastrados sozinhos.'); }
    else if (a === 'cli-desliga'){ var c = clienteById(v); if (c){ var o = JSON.parse(JSON.stringify(c)); o.vinculoAuto = false; persistClienteSet(o).then(function(){ impDesenhar(); }); } }
    else if (a === 'esquecer'){ impS.ign = {}; impGravarIgn().then(function(){ toast('Lista de excluídos limpa.'); impDesenhar(); }); }
  });
  d.addEventListener('change', function(e){
    var t = e.target; if (!t || !t.getAttribute) return;
    var k = t.getAttribute('data-impck'), o = t.getAttribute('data-impoab');
    if (k){ if (t.checked) impS.sel[k] = true; else delete impS.sel[k]; impAtualizaRodape(); }
    if (o){ impS.oabs[o] = t.checked; }
  });
}
function impAbrir(){
  impMontarJanela();
  var oabs = (pbS.oabs || []).filter(function(o){ return o.ativo; });
  if (!Object.keys(impS.oabs).length) oabs.forEach(function(o){ impS.oabs[o.id] = true; });
  if (impS.fase !== 'buscando' && impS.fase !== 'importando') impS.fase = impS.ach ? impS.fase : 'config';
  impDesenhar(); qs('overlayImp').classList.add('show');
  impCarregarCfg().then(function(){ if (qs('overlayImp').classList.contains('show') && impS.fase === 'config') impDesenhar(); });
}
function impOabNome(id){ var o = (pbS.oabs || []).filter(function(x){ return x.id === id; })[0]; return o ? (o.nome || '').split(' ')[0] : id; }
function impDesenhar(){
  var el = qs('impCorpo'); if (!el) return;
  var h = '', tit = 'Importar do Diário Oficial';
  if (impS.fase === 'config') h = impHtmlConfig();
  else if (impS.fase === 'buscando'){ tit = 'Lendo o Diário Oficial'; h = '<div class="pb-sec"><div class="pb-sec-t">Buscando</div><div class="pb-aviso" id="impProg">' + escapeHtml(impS.prog || 'Começando…') + '</div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-imp="cancelar">Parar</button></div></div>'; }
  else if (impS.fase === 'lista'){ tit = 'Escolher o que importar'; h = impHtmlLista(); }
  else if (impS.fase === 'importando'){ tit = 'Importando'; h = '<div class="pb-sec"><div class="pb-sec-t">Cadastrando</div><div class="pb-aviso" id="impProg">' + escapeHtml(impS.prog || '') + '</div></div>'; }
  else if (impS.fase === 'fim'){ tit = 'Importação concluída'; h = impHtmlFim(); }
  qs('impTit').textContent = tit; el.innerHTML = h;
}
function impHtmlConfig(){
  var oabs = (pbS.oabs || []).filter(function(o){ return o.ativo; });
  var h = '<div class="parcela-sum">Lê as publicações das suas OABs no período, agrupa por processo e mostra o que ainda não está cadastrado. É grátis. Você escolhe o que importar antes de gravar qualquer coisa.</div>';
  if (impS.erro) h += '<div class="form-error">' + escapeHtml(impS.erro) + '</div>';
  h += '<div class="pb-sec"><div class="pb-sec-t">Quais OABs</div>' + (oabs.length ? oabs.map(function(o){ return '<label class="chip-toggle"><input type="checkbox" data-impoab="' + escapeHtml(o.id) + '"' + (impS.oabs[o.id] ? ' checked' : '') + '> ' + escapeHtml(o.nome) + ' · OAB ' + escapeHtml(o.numero) + '/' + escapeHtml(o.uf) + '</label>'; }).join('') : '<div class="pb-aviso">Nenhuma OAB ativa. Cadastre em Publicações.</div>') + '</div>';
  h += '<div class="pb-sec"><div class="pb-sec-t">Publicações de quando</div><div class="segmented" id="impPer">' + IMP_PERIODOS.map(function(p){ return '<button type="button" class="seg-btn' + (impS.dias === p[0] ? ' active' : '') + '" data-imp="dias" data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div><div class="pb-aviso">Quanto maior o período, mais processos antigos e já encerrados entram. 90 dias costuma ser a carteira ativa.</div>' +
    '<button type="button" class="btn btn-primary" data-imp="buscar" style="width:100%;justify-content:center;">Buscar no Diário Oficial</button></div>';
  var flag = clientes.filter(function(c){ return c.vinculoAuto === true && !c.arquivado; });
  h += '<div class="pb-sec"><div class="pb-sec-t">Cadastro e vínculo automáticos</div>' +
    '<label class="chip-toggle"><input type="checkbox" data-imp="auto-liga"' + (impS.cfg.ativo ? ' checked' : '') + '> Cadastrar sozinho os processos novos que aparecerem nas publicações</label>' +
    '<div class="pb-aviso">Os que não tiverem cliente automático vão para a revisão. Processos que você excluir não voltam.</div>' +
    (flag.length ? flag.map(function(c){ return '<div class="pb-lin"><span><b style="color:var(--ink)">' + escapeHtml(c.nome) + '</b><br><span class="saldo-data">vincula sozinho</span></span><button type="button" class="btn btn-ghost pb-b" data-imp="cli-desliga" data-v="' + escapeHtml(c.id) + '">Desligar</button></div>'; }).join('') : '<div class="pb-aviso">Nenhum cliente com vínculo automático ainda. Ele é oferecido na primeira revisão, ou liga na ficha do cliente.</div>') +
    (Object.keys(impS.ign).length ? '<div class="pb-lin"><span class="saldo-data">' + Object.keys(impS.ign).length + ' processo(s) excluído(s) ficam fora</span><button type="button" class="btn btn-ghost pb-b" data-imp="esquecer">Limpar lista</button></div>' : '') + '</div>';
  return h;
}
/* ---------- buscar ---------- */
function impBuscar(){
  var ids = Object.keys(impS.oabs).filter(function(k){ return impS.oabs[k]; });
  if (!ids.length){ impS.erro = 'Marque ao menos uma OAB.'; impDesenhar(); return; }
  impS.erro = ''; impS.cancel = false; impS.fase = 'buscando'; impS.ach = {}; impS.sel = {}; impS.falhas = [];
  var fim = todayISO(), ini = pbSoma(fim, -impS.dias); impDesenhar();
  function pagina(oab, pg, tam){
    if (impS.cancel) return Promise.resolve('parou');
    impS.prog = 'OAB ' + impOabNome(oab) + ' · página ' + pg + ' · ' + Object.keys(impS.ach).length + ' processos até agora'; var e = qs('impProg'); if (e) e.textContent = impS.prog;
    return pbApi('/api/djen/importar', 'POST', { oab: oab, ini: ini, fim: fim, pagina: pg, tam: tam }).then(function(r){
      if (!r.ok){ impS.falhas.push(impOabNome(oab) + ': ' + (r.motivo || 'erro')); return 'erro'; }
      (r.grupos || []).forEach(function(g){ impMesclar(g, oab); });
      return r.mais ? pagina(oab, pg + 1, r.tam) : 'ok';
    }).catch(function(e){ impS.falhas.push(impOabNome(oab) + ': ' + e.message); return 'erro'; });
  }
  ids.reduce(function(cad, o){ return cad.then(function(){ return pagina(o, 1, 100); }); }, Promise.resolve()).then(function(){
    if (impS.cancel){ impS.fase = 'config'; impS.ach = null; impDesenhar(); return; }
    if (impS.falhas.length && !Object.keys(impS.ach).length){ impS.fase = 'config'; impS.ach = null; impS.erro = 'Não consegui ler o Diário Oficial: ' + impS.falhas.join(' · ') + '. Tente de novo daqui a pouco.'; impDesenhar(); return; }
    impS.fase = 'lista'; impS.filtro = 'curso'; impS.mais = 1;
    impLinhas().forEach(function(l){ if (l.estado === 'novo' && !l.g.ult.enc) impS.sel[l.g.p] = true; });
    impDesenhar();
  });
}
function impMesclar(g, oab){
  var x = impS.ach[g.p];
  if (!x){ x = impS.ach[g.p] = { p: g.p, numero: g.numero, trib: g.trib, orgao: g.orgao, classe: g.classe, natureza: g.natureza, ativo: g.ativo, passivo: g.passivo, valor: g.valor, dest: (g.dest || []).slice(), n: g.n, ult: g.ult, oabs: {} }; }
  else {
    x.n += g.n;
    ['ativo', 'passivo', 'natureza'].forEach(function(k){ if (!x[k] && g[k]) x[k] = g[k]; });
    if (!x.valor && g.valor) x.valor = g.valor;
    (g.dest || []).forEach(function(d){ if (x.dest.length < 6 && !x.dest.some(function(y){ return y.n === d.n; })) x.dest.push(d); });
    if (g.ult && (!x.ult || g.ult.data >= x.ult.data)){ x.ult = g.ult; x.trib = g.trib; x.orgao = g.orgao; x.classe = g.classe; }
  }
  x.oabs[oab] = 1;
}
/* cada processo achado, com o estado dele agora (novo, já cadastrado, excluído antes) e o que o app faria */
function impLinhas(){
  var mp = prMapa().m, out = [];
  Object.keys(impS.ach || {}).forEach(function(n){
    var g = impS.ach[n], estado = mp[n] ? 'ja' : (impS.ign[n] ? 'ign' : 'novo');
    out.push({ g: g, estado: estado, dec: estado === 'novo' ? impDecidir(g) : null });
  });
  out.sort(function(a, b){ return String(b.g.ult.data).localeCompare(String(a.g.ult.data)); });
  return out;
}
function impResumoLinhas(ls){
  var novos = ls.filter(function(l){ return l.estado === 'novo'; });
  return { achados: ls.length, ja: ls.filter(function(l){ return l.estado === 'ja'; }).length, ign: ls.filter(function(l){ return l.estado === 'ign'; }).length, novos: novos.length, enc: novos.filter(function(l){ return l.g.ult.enc; }).length, curso: novos.filter(function(l){ return !l.g.ult.enc; }).length };
}
function impHtmlLista(){
  var ls = impLinhas(), r = impResumoLinhas(ls), novos = ls.filter(function(l){ return l.estado === 'novo'; });
  var vis = novos.filter(function(l){ return impS.filtro === 'todos' || (impS.filtro === 'enc' ? !!l.g.ult.enc : !l.g.ult.enc); });
  var h = '<div class="pb-sec"><div class="pb-sec-t">Resultado · últimos ' + impS.dias + ' dias</div><div class="pb-aviso"><b>' + r.achados + '</b> processos achados · <b>' + r.ja + '</b> já cadastrados' + (r.ign ? ' · <b>' + r.ign + '</b> excluídos antes' : '') + ' · <b>' + r.novos + '</b> novos (<b>' + r.enc + '</b> possivelmente encerrados)</div>' +
    (impS.falhas && impS.falhas.length ? '<div class="form-error">Atenção, parte da leitura falhou: ' + escapeHtml(impS.falhas.join(' · ')) + '</div>' : '') + '</div>';
  if (!novos.length) return h + '<div class="financeiro-vazio">Nenhum processo novo neste período.</div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-imp="voltar">Voltar</button></div>';
  h += '<div class="segmented">' + [['curso', 'Em curso (' + r.curso + ')'], ['enc', 'Possivelmente encerrados (' + r.enc + ')'], ['todos', 'Todos']].map(function(f){ return '<button type="button" class="seg-btn' + (impS.filtro === f[0] ? ' active' : '') + '" data-imp="filtro" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
  h += '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-imp="todos">Marcar todos desta lista</button><button type="button" class="btn btn-ghost pb-b" data-imp="nenhum">Tirar todos</button></div>';
  var lim = impS.mais * 60;
  h += '<div class="imp-lista">' + vis.slice(0, lim).map(impLinhaHtml).join('') + '</div>' + (vis.length > lim ? '<button type="button" class="btn btn-ghost" data-imp="mais" style="width:100%;justify-content:center;">Mostrar mais (' + (vis.length - lim) + ')</button>' : '');
  h += '<div class="pb-sec" id="impRodape"></div>';
  setTimeout(impAtualizaRodape, 0);
  return h;
}
function impLinhaHtml(l){
  var g = l.g, pt = impPartesDe(g), dec = l.dec, tags = '';
  tags += '<span class="pb-tg">última publicação ' + escapeHtml(fmtData(g.ult.data).slice(0, 5)) + (g.ult.tipo ? ' · ' + escapeHtml(g.ult.tipo) : '') + '</span>';
  Object.keys(g.oabs).forEach(function(o){ tags += '<span class="pb-tg">' + escapeHtml(impOabNome(o)) + '</span>'; });
  if (g.ult.enc) tags += '<span class="pb-tg pz">⚠ cita ' + escapeHtml(g.ult.enc) + '</span>';
  if (dec.tipo === 'auto') tags += '<span class="pb-tg ok">vincula a ' + escapeHtml(dec.cliente.nome.slice(0, 28)) + '</span>';
  else if (dec.motivo === 'cliente-parecido') tags += '<span class="pb-tg nv">revisar: ' + escapeHtml((clienteById(dec.sugestao) || {}).nome ? clienteById(dec.sugestao).nome.slice(0, 26) : 'cliente parecido') + '?</span>';
  else tags += '<span class="pb-tg nv">revisar: sem cliente</span>';
  return '<label class="imp-lin"><input type="checkbox" data-impck="' + escapeHtml(g.p) + '"' + (impS.sel[g.p] ? ' checked' : '') + '><span class="imp-tx"><b>' + escapeHtml(pt.partes || 'Sem nome das partes') + '</b><small>' + escapeHtml(g.numero) + '</small><small>' + escapeHtml([g.trib, g.orgao].filter(Boolean).join(' · ')) + '</small><span class="pb-tags">' + tags + '</span></span></label>';
}
function impAtualizaRodape(){
  var el = qs('impRodape'); if (!el) return;
  var n = Object.keys(impS.sel).length;
  el.innerHTML = '<div class="pb-sec-t">Importar</div><div class="pb-aviso">' + n + (n === 1 ? ' processo marcado' : ' processos marcados') + '. Grátis. As partes, a vara e o valor da causa vêm do Diário Oficial; o DataJud completa o resto depois, sozinho.</div><button type="button" class="btn btn-primary" data-imp="importar" style="width:100%;justify-content:center;"' + (n ? '' : ' disabled') + '>Importar ' + n + (n === 1 ? ' processo' : ' processos') + '</button><button type="button" class="btn btn-ghost pb-b" data-imp="voltar">Voltar</button>';
}
/* ---------- importar ---------- */
function impImportar(){
  var ls = impLinhas().filter(function(l){ return l.estado === 'novo' && impS.sel[l.g.p]; });
  if (!ls.length) return;
  impS.fase = 'importando'; impDesenhar();
  var res = { feitos: 0, auto: {}, nAuto: 0, rev: 0, semPartes: 0, falhas: 0, jaExistiam: 0 }, i = 0;
  function um(l){
    var dec = impDecidir(l.g), d = impMontarDoc(l.g, dec, 'diario');
    return impGravarProcesso(d).then(function(r){
      if (r.existia){ res.jaExistiam++; return; }
      res.feitos++;
      if (dec.tipo === 'auto'){ res.nAuto++; res.auto[dec.cliente.nome] = (res.auto[dec.cliente.nome] || 0) + 1; } else res.rev++;
      if (!d.partes) res.semPartes++;
    }).catch(function(){ res.falhas++; });
  }
  function lote(){
    var parte = ls.slice(i, i + 4); if (!parte.length) return Promise.resolve();
    return Promise.all(parte.map(um)).then(function(){ i += 4; impS.prog = Math.min(i, ls.length) + ' de ' + ls.length; var e = qs('impProg'); if (e) e.textContent = impS.prog; return lote(); });
  }
  lote().then(function(){
    impS.res = res; impS.fase = 'fim'; impS.ach = null; impS.sel = {}; impDesenhar(); prDepois(); impFilaDatajud();
  });
}
function impHtmlFim(){
  var r = impS.res || {}, h = '<div class="pb-sec"><div class="pb-sec-t">Resultado</div>' +
    '<div class="pb-aviso"><b>' + (r.feitos || 0) + '</b> processos cadastrados.</div>' +
    (r.nAuto ? '<div class="pb-aviso"><b>' + r.nAuto + '</b> já vinculados sozinhos: ' + Object.keys(r.auto).map(function(k){ return escapeHtml(k) + ' (' + r.auto[k] + ')'; }).join(', ') + '.</div>' : '') +
    '<div class="pb-aviso"><b>' + (r.rev || 0) + '</b> ficaram para revisar (vincular a um cliente).</div>' +
    (r.semPartes ? '<div class="pb-aviso"><b>' + r.semPartes + '</b> sem o nome das partes (o Diário Oficial não trouxe; segredo de justiça, por exemplo). Preencha na ficha.</div>' : '') +
    (r.jaExistiam ? '<div class="pb-aviso">' + r.jaExistiam + ' já existiam e não foram alterados.</div>' : '') +
    (r.falhas ? '<div class="form-error">' + r.falhas + ' não deram certo. Busque de novo para tentar outra vez.</div>' : '') + '</div>' +
    '<div class="pb-acts">' + (r.rev ? '<button type="button" class="btn btn-primary pb-b" data-imp="revisar">Revisar os importados</button>' : '') + '<button type="button" class="btn btn-ghost pb-b" data-imp="fechar">Fechar</button></div>';
  return h;
}

/* ---------- revisão: vincular, cliente novo, excluir ---------- */
function impContaRev(){ return prDocs.filter(function(d){ return d.revisar && !d.arquivado; }).length; }
function impDocPorNum(num){ var r = prMapa().m[num]; return r && r.doc ? r.doc : null; }
/* as gravações dos processos da revisão entram numa fila (uma de cada vez, cada uma montada em cima do que a anterior gravou), para um vínculo
   e uma reavaliação ao mesmo tempo não se atropelarem; "cond" confere o estado no momento de gravar */
var impFilaSalvar = Promise.resolve();
function impSalvarDoc(doc, campos, cond){
  var p = impFilaSalvar.then(function(){
    if (cond && !cond(doc)) return;
    var nd = Object.assign({}, doc, campos); delete nd.id;
    return pbApi('/api/db/processos/' + encodeURIComponent(doc.id), 'PUT', nd).then(function(){ Object.assign(doc, campos); });
  });
  impFilaSalvar = p.catch(function(){});
  return p;
}
/* vincula o processo ao cliente, tira da revisão e (na primeira vez) pergunta se os próximos podem ir direto */
function impVincular(num, clienteId, opc){
  var doc = impDocPorNum(num), c = clienteById(clienteId); if (!doc || !c) return Promise.resolve();
  var ids = (doc.clienteIds || []).slice(); if (ids.indexOf(clienteId) < 0) ids.push(clienteId);
  var nome = doc.parteNome || '';
  return impSalvarDoc(doc, { clienteIds: ids, revisar: '', revisadoEm: new Date().toISOString(), sugestaoClienteId: '' }).then(function(){
    if (nome && !(opc && opc.semApelido)) try{ prAprenderApelido(clienteId, nome); }catch(e){}
    toast('Processo vinculado a ' + c.nome + '.'); prDepois();
    impPerguntarAuto(clienteId, nome);
  }).catch(function(e){ toast('Não consegui vincular: ' + e.message); });
}
function impVincularSugerido(num){ var d = impDocPorNum(num); if (d && d.sugestaoClienteId) impVincular(num, d.sugestaoClienteId); }
function impNovoCliente(num){
  var d = impDocPorNum(num); if (!d) return;
  abrirClienteEdit({ nome: cliTitulo(d.parteNome || ''), pagador: 'cliente', aoSalvar: function(c){ impVincular(num, c.id, { semApelido: false }); } });
}
function impEscolherCliente(num){
  prAbrir(num); setTimeout(function(){ var i = qs('pr_cli'); if (i){ try{ i.scrollIntoView({ block: 'center' }); }catch(e){} i.focus(); } }, 120);
}
/* excluir o processo do sistema (e lembrar para a leitura automática não cadastrar de novo) */
function impPerguntarExcluir(num){
  var d = impDocPorNum(num); if (!d) return;
  impDialogo('Excluir este processo?', '<div class="parcela-sum">' + escapeHtml(d.partes || d.numero) + '<br>' + escapeHtml(d.numero) + '</div><div class="pb-aviso">O processo sai do sistema e a leitura automática não cadastra de novo. Se mudar de ideia, dá para limpar a lista de excluídos em Importar do Diário Oficial.</div>',
    [['Excluir processo', 'btn-primary', function(){ impExcluir(num); }], ['Cancelar', 'btn-ghost', null]]);
}
function impExcluir(num){
  var d = impDocPorNum(num); if (!d) return;
  (d.proximaAgId ? prSincProvidencia({ prox: '', data: '', antId: d.proximaAgId }) : Promise.resolve()).then(function(){ return pbApi('/api/db/processos/' + encodeURIComponent(d.id), 'DELETE'); })
    .then(function(){ prDocs = prDocs.filter(function(x){ return x.id !== d.id; }); return impIgnorar(num); }).then(function(){ toast('Processo excluído.'); prDepois(); })
    .catch(function(e){ toast('Não consegui excluir: ' + e.message); });
}
/* janelinha de pergunta (botões dentro do cartão) */
function impDialogo(titulo, corpo, botoes){
  if (!qs('overlayImpPerg')){
    var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayImpPerg';
    d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="impPTit"></h2><button class="icon-btn" id="impPX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="impPCorpo"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function(e){
      if (e.target === d || (e.target.closest && e.target.closest('#impPX'))){ d.classList.remove('show'); return; }
      var b = e.target.closest ? e.target.closest('[data-impp]') : null; if (!b) return;
      var f = impS.dlg && impS.dlg[Number(b.getAttribute('data-impp'))]; d.classList.remove('show'); if (f) f();
    });
  }
  impS.dlg = botoes.map(function(b){ return b[2]; });
  qs('impPTit').textContent = titulo;
  qs('impPCorpo').innerHTML = corpo + '<div class="pb-acts">' + botoes.map(function(b, i){ return '<button type="button" class="btn ' + b[1] + ' pb-b" data-impp="' + i + '">' + escapeHtml(b[0]) + '</button>'; }).join('') + '</div>';
  qs('overlayImpPerg').classList.add('show');
}
/* na revisão: outros processos da mesma parte (ou sugeridos ao mesmo cliente) */
function impOutrosDaParte(clienteId, nome){
  return prDocs.filter(function(d){
    if (!d.revisar || d.arquivado) return false;
    if (d.sugestaoClienteId === clienteId) return true;
    return !!(nome && d.parteNome && (normNome(d.parteNome) === normNome(nome) || cliNivel(nome, d.parteNome) === 3));
  });
}
/* depois de confirmar um vínculo: (1) uma vez por cliente, "os próximos já vão direto?"; (2) se há outros processos da mesma parte na revisão, "vincular todos?" */
function impPerguntarAuto(clienteId, nome){
  var c = clienteById(clienteId); if (!c) return;
  var outros = impOutrosDaParte(clienteId, nome), perguntarAuto = c.vinculoAuto !== true && c.vinculoAuto !== false;
  if (!perguntarAuto && !outros.length) return;
  if (!perguntarAuto){
    impDialogo('Vincular os outros também?',
      '<div class="parcela-sum">Há <b>' + outros.length + '</b> ' + (outros.length === 1 ? 'processo' : 'processos') + (nome ? ' de <b>' + escapeHtml(cliTitulo(nome)) + '</b>' : '') + ' na revisão. Vincular ' + (outros.length === 1 ? 'também ao' : 'todos ao') + ' cliente <b>' + escapeHtml(c.nome) + '</b>?</div>',
      [['Sim, vincular ' + (outros.length === 1 ? 'o outro' : 'os ' + outros.length), 'btn-primary', function(){ impVincularLote(outros.map(function(d){ return prNum(d.numero); }), clienteId, { semPerguntar: true }); }], ['Não, deixar na revisão', 'btn-ghost', null]]);
    return;
  }
  impDialogo('Vincular os próximos automaticamente?',
    '<div class="parcela-sum">Quando aparecer outro processo' + (nome ? ' de <b>' + escapeHtml(cliTitulo(nome)) + '</b>' : '') + ', o app já cadastra e vincula ao cliente <b>' + escapeHtml(c.nome) + '</b>, sem passar pela revisão.</div>' +
    '<div class="pb-aviso">Vale para a importação e para os processos novos das publicações. Dá para desligar depois na ficha do cliente.' + (outros.length ? ' Os <b>' + outros.length + '</b> ' + (outros.length === 1 ? 'processo que já está' : 'processos que já estão') + ' na revisão com esse nome também serão vinculados agora.' : '') + '</div>',
    [['Sim, vincular automaticamente', 'btn-primary', function(){ impMarcarAuto(clienteId, true); }], ['Não, sempre revisar', 'btn-ghost', function(){ impMarcarAuto(clienteId, false); }]]);
}
function impMarcarAuto(clienteId, sim){
  var c = clienteById(clienteId); if (!c) return;
  var o = JSON.parse(JSON.stringify(c)); o.vinculoAuto = !!sim;
  persistClienteSet(o).then(function(){
    if (!sim){ toast('Certo: os próximos deste cliente continuam indo para a revisão.'); impPerguntarAuto(clienteId, ''); return; }
    var n = impReavaliar(true);   /* os que já estavam na revisão com esse cliente vão agora */
    toast('Pronto: os próximos processos deste cliente já vão direto' + (n ? ' e ' + n + (n === 1 ? ' que estava' : ' que estavam') + ' na revisão ' + (n === 1 ? 'foi vinculado' : 'foram vinculados') : '') + '.');
  }).catch(function(e){ toast('Não consegui salvar: ' + e.message); });
}

/* ---------- mesma parte em vários processos: vincular todos de uma vez ---------- */
function impGrupos(){
  var gs = [];
  prDocs.filter(function(d){ return d.revisar && !d.arquivado && d.parteNome; }).forEach(function(d){
    var g = gs.filter(function(x){ return normNome(x.nome) === normNome(d.parteNome) || cliNivel(x.nome, d.parteNome) === 3; })[0];
    if (!g){ g = { nome: d.parteNome, docs: [] }; gs.push(g); }
    g.docs.push(d);
  });
  gs = gs.filter(function(g){ return g.docs.length >= 2; });
  gs.forEach(function(g){
    var cont = {}, melhor = '';
    g.docs.forEach(function(d){ if (d.sugestaoClienteId && clienteById(d.sugestaoClienteId)){ cont[d.sugestaoClienteId] = (cont[d.sugestaoClienteId] || 0) + 1; if (!melhor || cont[d.sugestaoClienteId] > cont[melhor]) melhor = d.sugestaoClienteId; } });
    g.sug = melhor; g.nums = g.docs.map(function(d){ return prNum(d.numero); });
  });
  gs.sort(function(a, b){ return b.docs.length - a.docs.length; });
  return gs;
}
/* cartões do topo da revisão: um por parte que aparece em 2 ou mais processos */
function impGruposHtml(){
  var gs = impGrupos(); prS.revGrupos = gs;
  return gs.map(function(g, i){
    var sug = g.sug ? clienteById(g.sug) : null, b = function(a, cls, t){ return '<button type="button" class="btn ' + cls + ' pb-b" data-pr="' + a + '" data-n="' + i + '">' + t + '</button>'; };
    return '<div class="pb-card" style="--pb-bar:#C98500"><div class="pb-l1"><span>Mesma parte em ' + g.docs.length + ' processos</span><span class="pb-tipo">vincular de uma vez</span></div>' +
      '<div class="pb-cli">' + escapeHtml(cliTitulo(g.nome)) + '</div>' +
      '<div class="pb-aviso" style="margin-top:6px">' + (sug ? 'Cliente parecido: <b>' + escapeHtml(sug.nome) + '</b>' : 'Nenhum cliente parecido ainda. Escolha um cliente ou cadastre um novo.') + '</div>' +
      '<div class="pb-acts">' + (sug ? b('rev-gvinc', 'btn-primary', 'Vincular os ' + g.docs.length + ' a ' + escapeHtml(sug.nome.length > 18 ? sug.nome.slice(0, 18) + '…' : sug.nome)) : '') + b('rev-gesc', sug ? 'btn-ghost' : 'btn-primary', 'Escolher outro cliente') + b('rev-gnovo', 'btn-ghost', 'Cadastrar cliente novo') + '</div></div>';
  }).join('');
}
function impVincularLote(nums, clienteId, opc){
  var c = clienteById(clienteId); if (!c) return Promise.resolve();
  var docs = nums.map(impDocPorNum).filter(function(d){ return d && d.revisar; }), nomes = {};
  if (!docs.length) return Promise.resolve();
  return Promise.all(docs.map(function(d){
    var ids = (d.clienteIds || []).slice(); if (ids.indexOf(clienteId) < 0) ids.push(clienteId);
    if (d.parteNome) nomes[d.parteNome] = 1;
    return impSalvarDoc(d, { clienteIds: ids, revisar: '', revisadoEm: new Date().toISOString(), sugestaoClienteId: '' });
  })).then(function(){
    Object.keys(nomes).forEach(function(n){ try{ prAprenderApelido(clienteId, n); }catch(e){} });
    toast(docs.length + (docs.length === 1 ? ' processo vinculado a ' : ' processos vinculados a ') + c.nome + '.'); prDepois();
    if (!(opc && opc.semPerguntar)) impPerguntarAuto(clienteId, docs[0].parteNome || '');
  }).catch(function(e){ toast('Não consegui vincular: ' + e.message); });
}
function impGrupoVincular(i){ var g = (prS.revGrupos || [])[Number(i)]; if (g && g.sug) impVincularLote(g.nums, g.sug); }
function impGrupoNovo(i){
  var g = (prS.revGrupos || [])[Number(i)]; if (!g) return;
  abrirClienteEdit({ nome: cliTitulo(g.nome), pagador: 'cliente', aoSalvar: function(c){ impVincularLote(g.nums, c.id); } });
}
/* escolher um cliente já cadastrado (lista com busca) */
function impEscolherParaGrupo(i){
  var g = (prS.revGrupos || [])[Number(i)]; if (!g) return;
  if (!qs('overlayImpCli')){
    var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayImpCli';
    d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="impCTit">Escolher cliente</h2><button class="icon-btn" id="impCX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body"><div class="pb-aviso" id="impCInfo"></div><div class="field"><input type="text" id="impCBusca" placeholder="Buscar cliente…" autocomplete="off"></div><div class="pb-sec" id="impCLista"></div></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function(e){
      if (e.target === d || (e.target.closest && e.target.closest('#impCX'))){ d.classList.remove('show'); return; }
      var b = e.target.closest ? e.target.closest('[data-impc]') : null; if (!b) return;
      d.classList.remove('show'); var f = impS.pick; if (f) f(b.getAttribute('data-impc'));
    });
    qs('impCBusca').addEventListener('input', impListaClientes);
  }
  impS.pick = function(id){ impVincularLote(g.nums, id); };
  qs('impCInfo').innerHTML = 'Vincular <b>' + g.docs.length + '</b> processos de <b>' + escapeHtml(cliTitulo(g.nome)) + '</b> a qual cliente?'; qs('impCBusca').value = '';
  impListaClientes(); qs('overlayImpCli').classList.add('show');
  setTimeout(function(){ try{ qs('impCBusca').focus(); }catch(e){} }, 50);
}
function impListaClientes(){
  var q = normNome(qs('impCBusca').value), l = clientes.filter(function(c){ return !c.arquivado && (!q || normNome(c.nome + ' ' + (c.apelidos || []).join(' ')).indexOf(q) >= 0); }).sort(function(a, b){ return a.nome.localeCompare(b.nome, 'pt-BR'); }).slice(0, 40);
  qs('impCLista').innerHTML = l.length ? l.map(function(c){ return '<button type="button" class="pb-mi" data-impc="' + escapeHtml(c.id) + '"><span class="pb-mi-i">👤</span>' + escapeHtml(c.nome) + '</button>'; }).join('') : '<div class="pb-aviso">Nenhum cliente com esse nome. Feche e use “Cadastrar cliente novo”.</div>';
}

/* ---------- clientes cadastrados depois: a revisão se atualiza sozinha ---------- */
/* reavalia os processos que estão na revisão com os clientes de agora: se o cliente é automático, vincula; se não, passa a sugerir o cliente.
   Devolve quantos foram vinculados direto (a gravação continua em segundo plano). */
function impReavaliar(forcar){
  if (!window.__SERVIDOR || impS.reavRodando || !impS.cli || !prOk) return 0;
  var sig = clientes.map(function(c){ return c.id + '|' + c.nome + '|' + (c.apelidos || []).join(',') + '|' + c.vinculoAuto + '|' + (c.arquivado ? 1 : 0); }).join(';');
  if (!forcar && sig === impS.reavSig) return 0;
  impS.reavSig = sig;
  var pend = prDocs.filter(function(d){ return d.revisar && !d.arquivado; }), jobs = [], nAuto = 0, nSug = 0;
  pend.forEach(function(d){
    var g = { dest: d.parteNome ? [{ n: d.parteNome, p: '' }] : [], ativo: d.autor || '', passivo: d.reu || '' };
    var dec = impDecidir(g);
    if (dec.tipo === 'auto'){ nAuto++; var ids = (d.clienteIds || []).slice(); if (ids.indexOf(dec.cliente.id) < 0) ids.push(dec.cliente.id); jobs.push([d, { clienteIds: ids, revisar: '', vinculoAuto: true, revisadoEm: new Date().toISOString(), sugestaoClienteId: '' }]); }
    else if (dec.motivo === 'cliente-parecido' && (d.revisar !== 'cliente-parecido' || d.sugestaoClienteId !== dec.sugestao)){ nSug++; jobs.push([d, { revisar: 'cliente-parecido', sugestaoClienteId: dec.sugestao }]); }
  });
  if (!jobs.length) return 0;
  impS.reavRodando = true;
  jobs.reduce(function(cad, j){ return cad.then(function(){ return impSalvarDoc(j[0], j[1], function(d){ return !!d.revisar; }); }); }, Promise.resolve()).catch(function(e){ console.error('revisão', e); }).then(function(){
    impS.reavRodando = false;
    toast((nAuto ? nAuto + (nAuto === 1 ? ' processo da revisão vinculado' : ' processos da revisão vinculados') + ' ao cliente automático' : '') + (nAuto && nSug ? ' · ' : '') + (nSug ? 'cliente reconhecido em ' + nSug + (nSug === 1 ? ' processo da revisão' : ' processos da revisão') : '') + '.');
    prDepois();
  });
  return nAuto;
}

/* ---------- estilo ---------- */
(function(){
  var st = document.createElement('style');
  st.textContent = '.imp-lista{display:flex;flex-direction:column;gap:8px}.imp-lin{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start;background:var(--surface-2);border-radius:14px;padding:11px 12px;cursor:pointer}' +
    '.imp-lin input{margin-top:3px;width:18px;height:18px}.imp-tx{display:flex;flex-direction:column;gap:2px;min-width:0}.imp-tx b{font-size:var(--t3);overflow-wrap:anywhere}.imp-tx small{font-size:var(--t2);color:var(--ink-soft);overflow-wrap:anywhere}';
  document.head.appendChild(st);
  /* a lista só pode cadastrar sozinho depois que os clientes chegaram do servidor */
  var rc0 = renderClientesTudo; renderClientesTudo = function(){ impS.cli = true; var r = rc0.apply(this, arguments); try{ impReavaliar(); impTalvezAuto(); }catch(e){} return r; };
  var ab0 = pbAtualizarBadge; pbAtualizarBadge = function(){ var r = ab0.apply(this, arguments); try{ impTalvezAuto(); }catch(e){} return r; };
  var pd0 = prDepois; prDepois = function(){ var r = pd0.apply(this, arguments); try{ impReavaliar(); impTalvezAuto(); impFilaDatajud(); }catch(e){} return r; };
  if (window.__SERVIDOR) impCarregarCfg();
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { impDecidir: impDecidir, impReavaliar: function(){ return impReavaliar(true); }, impTalvezAuto: function(){ impS.autoEm = 0; return impTalvezAuto(); }, impS: impS });
})();
