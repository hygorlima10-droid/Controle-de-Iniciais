/* ============================================================
   LIGAÇÃO ENTRE OS ATOS E O PROCESSO (prefixo lg) — correções da análise de interligação (12/11/2026)
   - ao protocolar uma Inicial (mover para "Protocolado"), o app pede o número do processo e liga a um processo já cadastrado ou cadastra um novo;
   - revisão de ligações (Processos): números sem processo cadastrado, processos sem cliente e divergência de cliente entre o ato e o processo.
   A "cola" continua sendo o número do processo; o cadastro do processo guarda cliente e advogados.
   ============================================================ */
var lgS = { c: null, num: '', cad: true, ocupado: false, erro: '', rev: null };
function lgPrecisaNumero(c){ return !!c && (c.tipo || 'inicial') === 'inicial' && !c.numeroProcesso && !c.semProcesso && !c.doProcesso; }
/* devolve true se abriu a pergunta (quem chamou não move a Inicial: o diálogo faz isso depois) */
function lgPedeNumero(c, status){
  if (status !== 'protocolado' || !lgPrecisaNumero(c)) return false;
  lgS.c = c; lgS.num = ''; lgS.cad = true; lgS.erro = ''; lgS.ocupado = false;
  var ov = sgMontar('overlayLgProt', 'Inicial protocolada');
  if (!ov.getAttribute('data-lg')){
    ov.setAttribute('data-lg', '1');
    ov.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-lgp]') : null; if (b) lgProtClique(b.getAttribute('data-lgp')); });
    ov.addEventListener('input', function(e){ if (e.target && e.target.id === 'lgNum'){ lgS.num = e.target.value; lgProtAviso(); } });
    ov.addEventListener('change', function(e){ if (e.target && e.target.id === 'lgCad') lgS.cad = e.target.checked; });
  }
  qs('overlayLgProtC').innerHTML = lgProtHtml(); ov.classList.add('show'); setTimeout(function(){ var i = qs('lgNum'); if (i) i.focus(); }, 60);
  return true;
}
function lgProtHtml(){
  var c = lgS.c;
  return '<div class="pb-sec"><div class="pb-sec-t">' + escapeHtml(c.cliente || 'Inicial') + (c.nomeAcao ? ' · ' + escapeHtml(c.nomeAcao) : '') + '</div><div class="pb-aviso">Informe o número do processo gerado no protocolo: é ele que liga esta Inicial ao processo, às publicações, à Agenda e aos honorários.</div></div>' +
    '<div class="field"><label class="field-label" for="lgNum">Número do processo</label><input type="text" id="lgNum" autocomplete="off" placeholder="0000000-00.0000.0.00.0000" value="' + escapeHtml(lgS.num) + '"><div class="saldo-data" id="lgAviso" style="margin-top:4px"></div></div>' +
    '<div id="lgCadBox"></div><div class="form-error" id="lgErro">' + escapeHtml(lgS.erro) + '</div>' +
    '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-lgp="ok">Salvar número e protocolar</button><button type="button" class="btn btn-ghost pb-b" data-lgp="sem">Protocolar sem o número agora</button><button type="button" class="btn btn-ghost pb-b" data-lgp="cancela">Cancelar</button></div>';
}
function lgProtAviso(){
  var el = qs('lgAviso'), box = qs('lgCadBox'); if (!el) return;
  var a = cnjAnalisar(lgS.num), n = prNum(lgS.num);
  if (!a){ el.textContent = ''; box.innerHTML = ''; return; }
  if (!a.completo){ el.textContent = 'Tem ' + a.digitos + ' dígitos; o padrão do CNJ tem 20. Se for protocolo ou número antigo, pode seguir.'; box.innerHTML = ''; return; }
  el.textContent = a.valido ? ('✓ Número válido' + (a.sigla ? ' · ' + a.sigla : '')) : 'O dígito verificador não confere: confira o número.';
  var r = prMapa().m[a.formatado ? prNum(a.formatado) : n];
  if (r && r.doc) box.innerHTML = '<div class="pb-aviso">✓ Este processo já está cadastrado (' + escapeHtml(prTitulo(r)) + '). A Inicial fica ligada a ele.</div>';
  else box.innerHTML = '<label class="ad-it" style="border:0;padding:4px 0"><input type="checkbox" id="lgCad"' + (lgS.cad ? ' checked' : '') + '><span class="ad-t">Cadastrar também o processo (com o cliente e os advogados desta Inicial)</span></label>';
}
function lgProtClique(a){
  var ov = qs('overlayLgProt'), c = lgS.c; if (!c) return;
  if (a === 'cancela'){ ov.classList.remove('show'); return; }
  if (lgS.ocupado) return;
  var patch = { status: 'protocolado', statusDesde: new Date().toISOString() };
  if (a === 'sem'){ ov.classList.remove('show'); persistPatch(c, patch); return; }
  var an = cnjAnalisar(lgS.num), numero = an && an.completo ? an.formatado : String(lgS.num || '').trim();
  if (!numero){ lgS.erro = 'Informe o número ou escolha “Protocolar sem o número agora”.'; qs('lgErro').textContent = lgS.erro; return; }
  patch.numeroProcesso = numero; lgS.ocupado = true;
  var r = prMapa().m[prNum(numero)], criar = !(r && r.doc) && lgS.cad && an && an.completo;
  Promise.resolve(persistPatch(c, patch)).then(function(){ return criar ? lgCriarProcesso(numero, c) : null; }).then(function(){
    lgS.ocupado = false; ov.classList.remove('show'); toast(criar ? 'Protocolada. Número salvo e processo cadastrado.' : 'Protocolada. Número salvo.');
  }).catch(function(e){ lgS.ocupado = false; toast('Não consegui salvar: ' + e.message); });
}
/* cadastra o processo a partir de um ato (Inicial, Acordo ou Alvará): leva cliente(s), partes e advogados */
function lgCriarProcesso(numero, ato, extra){
  var d = Object.assign({ numero: numero, partes: ato.partes || ato.cliente || '', orgao: '', classe: '', clienteIds: (ato.clienteIds || []).slice(), obs: '', honorarios: 'sem', origem: 'manual', derivado: true, arquivado: false, criadoEm: new Date().toISOString() }, extra || {});
  if (Array.isArray(ato.advogados) && ato.advogados.length) d.advogados = ato.advogados.slice();
  return pbApi('/api/db/processos', 'POST', d).then(function(j){ d.id = j.id; prDocs.push(d); try{ prDepois(); }catch(e){} return d; });
}

/* ---------- revisão de ligações (Processos): sem processo cadastrado · sem cliente · divergências ---------- */
var LG_PR = { caso: 'Inicial', acordo: 'Acordo', alvara: 'Alvará' };
function lgUnirAdvogados(links, doc){
  var vistos = {}, out = [];
  (doc ? [doc] : []).concat(links.map(function(l){ return l.doc; })).forEach(function(d){ (Array.isArray(d.advogados) ? d.advogados : []).forEach(function(a){ if (a && a.oab && !vistos[a.oab]){ vistos[a.oab] = 1; out.push({ oab: a.oab, nome: a.nome || '' }); } }); });
  return out;
}
function lgRevCalcular(){
  var mp = prMapa(), sem = [], semCli = [], dif = [], nums = {};
  mp.ordem.forEach(function(n){
    var r = mp.m[n]; nums[n] = 1;
    var abertos = r.links.filter(function(l){ return !l.doc.arquivado; });
    if (!r.doc && abertos.length) sem.push({ num: n, numero: r.numero, titulo: prTitulo(r), atos: abertos.map(function(l){ return LG_PR[l.tipo]; }).filter(function(x, i, a){ return a.indexOf(x) === i; }).join(', '), origem: 'ato' });
    if (r.doc && !r.doc.arquivado){
      var meus = idsValidos(r.doc.clienteIds);
      if (!meus.length){
        var ids = []; r.links.forEach(function(l){ idsValidos(l.doc.clienteIds).forEach(function(i){ if (ids.indexOf(i) < 0) ids.push(i); }); });
        var sug = null, motivo = '';
        if (ids.length){ sug = ids; motivo = 'cliente dos atos deste processo'; }
        else { var dv = prDividePartes(r.doc.partes), nomes = dv ? [dv.autor, dv.reu] : [r.doc.partes || '']; var pv = cliProvaveis(nomes.filter(Boolean)); if (pv.length){ sug = [pv[0].id]; motivo = 'nome parecido com as partes'; } }
        semCli.push({ num: n, id: r.doc.id, numero: r.numero, titulo: prTitulo(r), sug: sug, motivo: motivo });
      } else {
        r.links.forEach(function(l){
          var dos = idsValidos(l.doc.clienteIds);
          if (dos.length && !dos.some(function(i){ return meus.indexOf(i) >= 0; }) && !l.doc.arquivado) dif.push({ num: n, numero: r.numero, tipo: l.tipo, id: l.id, doc: l.doc, proc: r.doc, titulo: l.doc.cliente || l.doc.partes || 'Sem nome', doAto: dos.map(nomeCliente).join(', '), doProc: meus.map(nomeCliente).join(', ') });
        });
      }
    }
  });
  try{ agItens().forEach(function(i){   /* números que só aparecem na Agenda */
    var n = i.processo ? prNum(i.processo) : ''; if (!n || nums[n] || i.concluido || n.length < 15) return;
    nums[n] = 1; sem.push({ num: n, numero: i.processo, titulo: i.cliente || 'Sem nome', atos: 'Agenda', origem: 'agenda' });
  }); }catch(e){}
  return { sem: sem, semCli: semCli, dif: dif };
}
function lgBannerHtml(){
  try{
    var papel = esS && esS.eu ? esS.eu.papel : '';
    if (papel === 'advogado') return '';
    var r = lgRevCalcular(), n = r.sem.length + r.semCli.length + r.dif.length; if (!n) return '';
    var p = []; if (r.sem.length) p.push('<b>' + r.sem.length + '</b> sem processo cadastrado'); if (r.semCli.length) p.push('<b>' + r.semCli.length + '</b> sem cliente'); if (r.dif.length) p.push('<b>' + r.dif.length + '</b> com cliente diferente');
    return '<div class="saldo-data" style="margin:0 0 8px">Ligações a revisar: ' + p.join(' · ') + '. <button type="button" class="es-lk" data-lgr="abrir">Revisar</button></div>';
  }catch(e){ console.error('ligações', e); return ''; }
}
function lgAbrirRev(aba){
  var ov = sgMontar('overlayLgRev', 'Revisão de ligações');
  if (!ov.getAttribute('data-lg')){
    ov.setAttribute('data-lg', '1');
    ov.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-lgr]') : null; if (b) lgRevClique(b.getAttribute('data-lgr'), b.getAttribute('data-k'), b); });
    ov.addEventListener('change', function(e){ var t = e.target; if (t && t.getAttribute && t.getAttribute('data-lgr') === 'marca'){ var k = t.getAttribute('data-k'); if (t.checked) lgS.rev.sel[k] = 1; else delete lgS.rev.sel[k]; lgRevDesenhar(); } });
  }
  lgS.rev = { aba: aba || 'sem', sel: {}, ocupado: false };
  ov.classList.add('show'); lgRevDesenhar();
}
function lgRevDesenhar(){
  var el = qs('overlayLgRevC'), R = lgS.rev; if (!el || !R) return;
  var d = lgRevCalcular(), abas = [['sem', 'Sem processo', d.sem.length], ['semcli', 'Sem cliente', d.semCli.length], ['dif', 'Cliente diferente', d.dif.length]];
  var h = '<div class="es-abas">' + abas.map(function(a){ return '<button type="button" class="es-aba' + (R.aba === a[0] ? ' on' : '') + '" data-lgr="aba" data-k="' + a[0] + '">' + a[1] + ' ' + a[2] + '</button>'; }).join('') + '</div>';
  var n = Object.keys(R.sel).length;
  if (R.aba === 'sem'){
    h += '<div class="pb-aviso">Estes números aparecem em Iniciais, Acordos, Alvarás ou na Agenda, mas o processo não está cadastrado. Cadastrar leva o cliente, as partes e os advogados dos atos.</div>';
    h += d.sem.length ? d.sem.map(function(x){ return '<label class="ad-it es-it"><input type="checkbox" data-lgr="marca" data-k="' + escapeHtml(x.num) + '"' + (R.sel[x.num] ? ' checked' : '') + '><span class="ad-t"><b>' + escapeHtml(x.titulo) + '</b><br><span class="saldo-data">' + escapeHtml(x.numero) + ' · em: ' + escapeHtml(x.atos) + '</span></span></label>'; }).join('') : '<div class="saldo-data" style="padding:10px 4px">Todos os números têm processo cadastrado. 🎉</div>';
    if (d.sem.length) h += '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-lgr="todos">Marcar todos</button><button type="button" class="btn btn-primary pb-b" data-lgr="cadastrar"' + (R.ocupado || !n ? ' disabled' : '') + '>Cadastrar' + (n ? ' ' + n + (n === 1 ? ' processo' : ' processos') : '') + '</button></div>';
  } else if (R.aba === 'semcli'){
    h += '<div class="pb-aviso">Processos sem cliente não aparecem no perfil de ninguém. A sugestão vem dos atos do mesmo número ou do nome das partes; sem sugestão, abra o processo e escolha o cliente.</div>';
    h += d.semCli.length ? d.semCli.map(function(x){
      var sug = x.sug ? '<span class="pb-tg ok" style="margin-left:6px">sugestão: ' + escapeHtml(x.sug.map(nomeCliente).join(', ')) + '</span>' : '';
      return '<label class="ad-it es-it"><input type="checkbox" data-lgr="marca" data-k="' + escapeHtml(x.num) + '"' + (R.sel[x.num] ? ' checked' : '') + (x.sug ? '' : ' disabled') + '><span class="ad-t"><b>' + escapeHtml(x.titulo) + '</b>' + sug + '<br><span class="saldo-data">' + escapeHtml(x.numero) + (x.motivo ? ' · ' + escapeHtml(x.motivo) : '') + '</span></span><button type="button" class="es-lk" data-lgr="abrir-proc" data-k="' + escapeHtml(x.num) + '">Abrir</button></label>';
    }).join('') : '<div class="saldo-data" style="padding:10px 4px">Todos os processos têm cliente. 🎉</div>';
    if (d.semCli.some(function(x){ return x.sug; })) h += '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-lgr="todos">Marcar os que têm sugestão</button><button type="button" class="btn btn-primary pb-b" data-lgr="vincular"' + (R.ocupado || !n ? ' disabled' : '') + '>Vincular o cliente sugerido' + (n ? ' (' + n + ')' : '') + '</button></div>';
  } else {
    h += '<div class="pb-aviso">O cliente do ato é diferente do cliente do processo de mesmo número. Confira qual está certo.</div>';
    h += d.dif.length ? d.dif.map(function(x, i){ return '<div class="pb-card" style="--pb-bar:#C98500;margin:6px 0"><div class="pb-l1"><span><b>' + escapeHtml(x.titulo) + '</b></span><span class="pb-tg">' + LG_PR[x.tipo] + '</span></div><div class="pb-proc">' + escapeHtml(x.numero) + '</div><div class="pb-proc">Cliente no ' + LG_PR[x.tipo].toLowerCase() + ': <b>' + escapeHtml(x.doAto) + '</b><br>Cliente no processo: <b>' + escapeHtml(x.doProc) + '</b></div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-lgr="ajusta-ato" data-k="' + i + '">Usar o do processo no ' + LG_PR[x.tipo].toLowerCase() + '</button><button type="button" class="btn btn-ghost pb-b" data-lgr="ajusta-proc" data-k="' + i + '">Usar o do ' + LG_PR[x.tipo].toLowerCase() + ' no processo</button></div></div>'; }).join('') : '<div class="saldo-data" style="padding:10px 4px">Nenhuma divergência. 🎉</div>';
  }
  el.innerHTML = h;
}
function lgRevFim(msg){ lgS.rev.ocupado = false; lgS.rev.sel = {}; if (msg) toast(msg); try{ prDepois(); }catch(e){} lgRevDesenhar(); }
function lgRevClique(a, k){
  var R = lgS.rev; if (!R && a !== 'abrir') return;
  if (a === 'abrir'){ lgAbrirRev('sem'); return; }
  if (a === 'aba'){ R.aba = k; R.sel = {}; lgRevDesenhar(); return; }
  var d = lgRevCalcular();
  if (a === 'todos'){ (R.aba === 'sem' ? d.sem : d.semCli.filter(function(x){ return x.sug; })).forEach(function(x){ R.sel[x.num] = 1; }); lgRevDesenhar(); return; }
  if (a === 'abrir-proc'){ qs('overlayLgRev').classList.remove('show'); prAbrir(k); return; }
  if (R.ocupado) return;
  if (a === 'cadastrar'){
    var mp = prMapa(), lista = d.sem.filter(function(x){ return R.sel[x.num]; }); R.ocupado = true; lgRevDesenhar();
    lista.reduce(function(p, x){ return p.then(function(){
      var r = mp.m[x.num];
      if (r){ var atos = r.links.filter(function(l){ return !l.doc.arquivado; }); return lgCriarProcesso(r.numero, { partes: prPartes(r), cliente: prPartes(r), clienteIds: prClienteIds(r), advogados: lgUnirAdvogados(atos, null) }); }
      return lgCriarProcesso(x.numero, { partes: x.titulo, clienteIds: [] });
    }); }, Promise.resolve()).then(function(){ lgRevFim(lista.length + (lista.length === 1 ? ' processo cadastrado.' : ' processos cadastrados.')); }).catch(function(e){ lgRevFim(); toast('Não consegui cadastrar: ' + e.message); });
  } else if (a === 'vincular'){
    var lst = d.semCli.filter(function(x){ return R.sel[x.num] && x.sug; }); R.ocupado = true; lgRevDesenhar();
    lst.reduce(function(p, x){ return p.then(function(){
      var doc = prDocs.filter(function(y){ return y.id === x.id; })[0]; if (!doc) return null;
      var novo = Object.assign({}, doc, { clienteIds: x.sug.slice() }); delete novo.id;
      return pbApi('/api/db/processos/' + encodeURIComponent(doc.id), 'PUT', novo).then(function(){ doc.clienteIds = x.sug.slice(); });
    }); }, Promise.resolve()).then(function(){ lgRevFim(lst.length + (lst.length === 1 ? ' processo vinculado a um cliente.' : ' processos vinculados a clientes.')); }).catch(function(e){ lgRevFim(); toast('Não consegui vincular: ' + e.message); });
  } else if (a === 'ajusta-ato' || a === 'ajusta-proc'){
    var x = d.dif[Number(k)]; if (!x) return; R.ocupado = true;
    var p;
    if (a === 'ajusta-ato') p = Promise.resolve(persistPatchDoc(x.tipo, x.doc, { clienteIds: idsValidos(x.proc.clienteIds).slice() }));
    else { var novo = Object.assign({}, x.proc, { clienteIds: idsValidos(x.doc.clienteIds).slice() }); delete novo.id; p = pbApi('/api/db/processos/' + encodeURIComponent(x.proc.id), 'PUT', novo).then(function(){ x.proc.clienteIds = novo.clienteIds; }); }
    p.then(function(){ lgRevFim('Ajustado.'); }).catch(function(e){ lgRevFim(); toast('Não consegui ajustar: ' + e.message); });
  }
}
document.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-lgr="abrir"]') : null; if (b && !(e.target.closest('#overlayLgRev'))) lgAbrirRev('sem'); });
setTimeout(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { lgRevCalcular: lgRevCalcular, lgBannerHtml: lgBannerHtml, lgPedeNumero: lgPedeNumero }); }, 0);
