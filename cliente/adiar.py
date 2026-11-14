# Adiar parcela: escolha na Central, modo "só uma parcela" dentro do Renegociar e "Adiar atrasadas" do Murilo. Roda uma vez.
import re
R = '/home/user/Controle-de-Iniciais/'
s = open(R + 'public/index.html', encoding='utf-8').read()
if 'id="rnParcelaBox"' in s:
    print('já aplicado'); raise SystemExit
def rep(old, new, n=1):
    global s
    assert s.count(old) == n, (s.count(old), old[:90]); s = s.replace(old, new)

# 1) unidades guardam a data original (parcelas adiadas)
rep("data:p.data || null, pago:!!p.pago,", "data:p.data || null, dataOriginal:p.dataOriginal || null, pago:!!p.pago,", 3)
rep("data:c.avista.data || null, pago:!!c.avista.pago,", "data:c.avista.data || null, dataOriginal:c.avista.dataOriginal || null, pago:!!c.avista.pago,")
rep("data:a.data || null, pago:a.status === 'recebido',", "data:a.data || null, dataOriginal:a.dataOriginal || null, pago:a.status === 'recebido',")
rep("tipoItem:'pagamento', chave:u.chave, arquivado:!!u.arquivado,", "tipoItem:'pagamento', dataOriginal:u.dataOriginal || null, chave:u.chave, arquivado:!!u.arquivado,")

# 2) Central: etiqueta "Adiada" e escolha ao tocar
rep("var chipEst = atrasado ? ", "var adiTag = (it.dataOriginal && it.dataOriginal !== it.data) ? '<span class=\"est est-adiada\">Adiada</span>' : '';\n        var chipEst = adiTag + (atrasado ? ", 1)
i = s.index("var chipEst = adiTag + (atrasado ? "); j = s.index(";\n", i)
linha = s[i:j]
s = s[:i] + linha + ")" + s[j:]
rep("+', '+(atrasado ? 'atrasado desde ' : 'vence em ')+fmtData(it.data)+'</div>' +", "+', '+(atrasado ? 'atrasado desde ' : 'vence em ')+fmtData(it.data)+((it.dataOriginal && it.dataOriginal !== it.data) ? ' (era '+fmtData(it.dataOriginal)+')' : '')+'</div>' +")
rep("""        var unA = listarUnidades().filter(function(u){ return u.chave === ch; })[0];
        if (unA && restanteUn(unA) > 0.004){
          var preA""", """        var unA = listarUnidades().filter(function(u){ return u.chave === ch; })[0];
        if (unA && restanteUn(unA) > 0.004 && adPodeAdiar(unA)){ adAbrirEscolha(unA); return; }
        if (unA && restanteUn(unA) > 0.004){
          var preA""")

# 3) HTML do Renegociar: modo "só uma parcela"
rep("""    <div class="modal-body">
      <div class="cli-box" id="rnInfo"></div>""", """    <div class="modal-body">
      <div id="rnParcelaBox" style="display:none;">
        <div class="field">
          <label class="field-label" for="rnParcelaSel">Parcela</label>
          <select class="filter-select" id="rnParcelaSel" style="width:100%;"></select>
        </div>
        <div class="cli-box" id="rnParcelaInfo"></div>
        <div class="field">
          <label class="field-label" for="rnParcelaData">Nova data de vencimento</label>
          <input type="date" id="rnParcelaData">
        </div>
        <div class="field">
          <label class="field-label" for="rnParcelaObs">Motivo (opcional)</label>
          <input type="text" id="rnParcelaObs" placeholder="Ex.: Murilo viajando, volta dia 15" autocomplete="off">
        </div>
        <div class="cli-obs">Só esta parcela muda de data. O valor e as outras parcelas continuam com o vencimento original, a não ser que você adie cada uma.</div>
        <button type="button" class="btn-text" id="rnParaContrato" style="margin-top:6px;">Renegociar o contrato todo \\u2192</button>
      </div>
      <div id="rnContratoBox">
      <button type="button" class="btn-text" id="rnParaParcela" style="margin-bottom:6px;">\\u2190 Adiar só uma parcela</button>
      <div class="cli-box" id="rnInfo"></div>""")
rep("""      <div class="form-error" id="rnErro"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" id="rnCancelar">""", """      </div>
      <div class="form-error" id="rnErro"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" id="rnCancelar">""")
rep("""<button class="btn btn-ghost" id="relBaixaBtn" style="width:100%;margin-bottom:10px;">Dar baixa em pagamentos recebidos</button>""".replace('<button class','<button type="button" class'), """<button type="button" class="btn btn-ghost" id="relBaixaBtn" style="width:100%;margin-bottom:10px;">Dar baixa em pagamentos recebidos</button>
      <button type="button" class="btn btn-ghost" id="relAdiarBtn" style="width:100%;margin-bottom:10px;">Adiar atrasadas\\u2026</button>""")
rep("  function regenerarRelMurilo(){", "  function regenerarRelMurilo(){\n    var ba = qs('relAdiarBtn'); if (ba) ba.style.display = (relModo === 'murilo') ? '' : 'none';")

# 4) abrirReneg: abre no modo parcela
rep("""    qs('rnObs').value = ''; qs('rnErro').textContent = '';
    gerarLinhasReneg();
    qs('overlayReneg').classList.add('show');
  }""", """    qs('rnObs').value = ''; qs('rnErro').textContent = '';
    gerarLinhasReneg();
    adPreencherParcelas(un, chaveUn);
    rnModo('parcela');
    qs('overlayReneg').classList.add('show');
  }""")
rep("  function abrirReneg(tipo, id){", "  function abrirReneg(tipo, id, chaveUn){")

# 5) histórico mostra adiamentos
rep("    return l.map(function(r){\n      return '<div class=\"s\">Renegociado em ", "    return l.map(function(r){\n      if (r.tipo === 'adiamento') return '<div class=\"s\">' + (r.itens || []).map(function(i){ return escapeHtml(i.label) + ' adiada de ' + (i.de ? fmtData(i.de) : 'sem data') + ' para ' + fmtData(i.para); }).join(' · ') + (r.obs ? ' \\u2014 ' + escapeHtml(r.obs) : '') + ' (em ' + fmtData(r.data) + ')</div>';\n      return '<div class=\"s\">Renegociado em ")
rep("var l = (doc.renegociacoes || []).slice(-2);", "var l = (doc.renegociacoes || []).slice(-3);")

# 6) confirmar no modo parcela
rep("  qs('rnConfirmar').addEventListener('click', function(){\n    var t = totalReneg();", "  qs('rnConfirmar').addEventListener('click', function(){\n    if (rn.modo === 'parcela'){ adConfirmarParcela(); return; }\n    var t = totalReneg();")

# 7) estilo
rep("  .overlay.show{display:flex;}", "  .overlay.show{display:flex;}\n  .est.est-adiada{background:rgba(29,127,191,0.14);color:var(--info);}\n  .ad-lista{display:flex;flex-direction:column;}\n  .ad-it{display:flex;gap:10px;align-items:flex-start;padding:10px 2px;border-bottom:1px solid var(--border);cursor:pointer;}\n  .ad-it:last-child{border-bottom:0;}\n  .ad-it input{margin-top:3px;width:18px;height:18px;flex-shrink:0;accent-color:var(--accent);}\n  .ad-it .ad-t{flex:1;min-width:0;}\n  .ad-it .ad-t b{display:block;}\n  .ad-it .ad-v{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;}")

# 8) JS novo
js = r'''
/* ---------- adiar parcela (só o vencimento de uma parcela; as outras não mudam) ---------- */
function adPodeAdiar(u){
  if (!u || ['avista', 'parcela', 'acordoParcela', 'acordo'].indexOf(u.kind) < 0) return false;
  return podeRenegociar(u.docTipo, u.docId);
}
function adAbrirData(el){ el.addEventListener('click', function(){ try{ if (el.showPicker) el.showPicker(); }catch(e){} }); }
function adMontarEscolha(){
  if (qs('overlayAdEscolha')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAdEscolha';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="adEscTitulo">Parcela</h2><button class="icon-btn" id="adEscFechar" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<div class="modal-body"><div class="parcela-sum" id="adEscInfo"></div>' +
    '<button type="button" class="btn btn-primary" id="adEscRecebi" style="width:100%;justify-content:center;">Marcar como recebido</button>' +
    '<button type="button" class="btn btn-ghost" id="adEscReneg" style="width:100%;justify-content:center;">Renegociar</button></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){ if (e.target === d || (e.target.closest && e.target.closest('#adEscFechar'))) d.classList.remove('show'); });
}
var adUn = null;
function adAbrirEscolha(u){
  adMontarEscolha(); adUn = u;
  var hoje = todayISO();
  qs('adEscTitulo').textContent = u.cliente + ' \u00B7 ' + u.label;
  qs('adEscInfo').textContent = fmtMoeda(restanteUn(u)) + ' \u00B7 ' + (u.data ? (u.data < hoje ? 'venceu em ' + fmtData(u.data) + ' (' + diasEntreISO(u.data, hoje) + ' dia' + (diasEntreISO(u.data, hoje) > 1 ? 's' : '') + ' de atraso)' : 'vence em ' + fmtData(u.data)) : 'sem data');
  qs('overlayAdEscolha').classList.add('show');
}
document.addEventListener('click', function(ev){
  var b = ev.target.closest ? ev.target.closest('#adEscRecebi, #adEscReneg') : null; if (!b || !adUn) return;
  var u = adUn; qs('overlayAdEscolha').classList.remove('show');
  if (b.id === 'adEscRecebi'){ var pre = {}; pre[u.chave] = true; abrirBaixa({ titulo: 'Recebi \u2014 ' + u.cliente, unidades: [u], preselecionar: pre }); }
  else abrirReneg(u.docTipo, u.docId, u.chave);
});
function rnModo(m){
  rn.modo = m;
  qs('rnParcelaBox').style.display = m === 'parcela' ? '' : 'none';
  qs('rnContratoBox').style.display = m === 'parcela' ? 'none' : '';
  qs('rnConfirmar').textContent = m === 'parcela' ? 'Adiar parcela' : 'Renegociar';
  qs('rnErro').textContent = '';
}
function adRotuloUn(u){
  var hoje = todayISO();
  return u.label + ' \u00B7 ' + fmtMoeda(restanteUn(u)) + ' \u00B7 ' + (u.data ? (u.data < hoje ? 'venceu em ' : 'vence em ') + fmtData(u.data) : 'sem data');
}
function adPreencherParcelas(un, chaveUn){
  rn.unidades = un;
  var hoje = todayISO(), sel = qs('rnParcelaSel');
  var padrao = chaveUn && un.some(function(u){ return u.chave === chaveUn; }) ? chaveUn : ((un.filter(function(u){ return u.data && u.data < hoje; })[0] || un[0]).chave);
  sel.innerHTML = un.map(function(u){ return '<option value="' + escapeHtml(u.chave) + '"' + (u.chave === padrao ? ' selected' : '') + '>' + escapeHtml(adRotuloUn(u)) + '</option>'; }).join('');
  qs('rnParcelaObs').value = '';
  qs('rnParcelaData').min = hoje;
  adAtualizarParcela();
}
function adAtualizarParcela(){
  var u = (rn.unidades || []).filter(function(x){ return x.chave === qs('rnParcelaSel').value; })[0]; if (!u) return;
  var hoje = todayISO(), atraso = u.data && u.data < hoje ? diasEntreISO(u.data, hoje) : 0;
  qs('rnParcelaInfo').innerHTML = '<div class="cli-linha"><span class="l">Valor em aberto</span><b>' + fmtMoeda(restanteUn(u)) + '</b></div>' +
    '<div class="cli-linha"><span class="l">Vencimento atual</span><b>' + (u.data ? fmtData(u.data) : 'sem data') + '</b></div>' +
    (atraso ? '<div class="cli-linha"><span class="l">Atraso</span><b style="color:var(--urgente);">' + atraso + ' dia' + (atraso > 1 ? 's' : '') + '</b></div>' : '') +
    (u.dataOriginal && u.dataOriginal !== u.data ? '<div class="cli-linha"><span class="l">Data original</span><span>' + fmtData(u.dataOriginal) + '</span></div>' : '');
  qs('rnParcelaData').value = '';
}
qs('rnParcelaSel').addEventListener('change', adAtualizarParcela);
qs('rnParaContrato').addEventListener('click', function(){ rnModo('contrato'); });
qs('rnParaParcela').addEventListener('click', function(){ rnModo('parcela'); });
adAbrirData(qs('rnParcelaData'));
function adConfirmarParcela(){
  var chave = qs('rnParcelaSel').value, nova = qs('rnParcelaData').value, hoje = todayISO();
  var u = (rn.unidades || []).filter(function(x){ return x.chave === chave; })[0];
  var erro = '';
  if (!u) erro = 'Escolha a parcela.';
  else if (!nova) erro = 'Escolha a nova data de vencimento.';
  else if (nova < hoje) erro = 'A nova data precisa ser de hoje em diante.';
  else if (nova === u.data) erro = 'Essa já é a data de vencimento da parcela.';
  if (erro){ qs('rnErro').textContent = erro; return; }
  qs('rnConfirmar').disabled = true;
  aplicarAdiamento(rn.tipo, rn.id, [chave], nova, qs('rnParcelaObs').value.trim()).then(function(){
    qs('rnConfirmar').disabled = false; fecharReneg();
    toast('Parcela adiada para ' + fmtData(nova) + '.');
  }).catch(function(err){ console.error('erro ao adiar', err); qs('rnConfirmar').disabled = false; qs('rnErro').textContent = msgErroSalvar(err); });
}
function aplicarAdiamento(tipo, id, chaves, nova, motivo){
  var doc = docRenegociar(tipo, id); if (!doc) return Promise.resolve();
  var cl = JSON.parse(JSON.stringify(doc)), hoje = todayISO(), itens = [];
  unidadesRenegociaveis(tipo, id).filter(function(u){ return chaves.indexOf(u.chave) >= 0; }).forEach(function(u){
    var alvo = null;
    if (tipo === 'caso'){
      if (u.kind === 'avista') alvo = cl.avista;
      else if (u.kind === 'parcela') alvo = (cl.parcelas || []).filter(function(p){ return p.numero === u.numero; })[0];
    } else {
      if (u.kind === 'acordoParcela') alvo = (cl.parcelas || []).filter(function(p){ return p.numero === u.numero; })[0];
      else if (u.kind === 'acordo') alvo = cl;
    }
    if (!alvo) return;
    var de = alvo.data || null;
    alvo.dataOriginal = alvo.dataOriginal || de; alvo.data = nova; alvo.adiadaEm = hoje;
    itens.push({ label: u.label, de: de, para: nova, valor: r2(restanteUn(u)) });
  });
  if (!itens.length) return Promise.resolve();
  var hist = (cl.renegociacoes || []).concat([{ tipo: 'adiamento', data: hoje, itens: itens, obs: motivo || '', criadoEm: new Date().toISOString() }]);
  var patch = { renegociacoes: hist };
  if (tipo === 'caso'){
    if (cl.parcelas) patch.parcelas = cl.parcelas;
    if (cl.avista) patch.avista = cl.avista;
    return persistPatch(doc, patch);
  }
  if (cl.parcelas && cl.parcelas.length) patch.parcelas = cl.parcelas; else { patch.data = cl.data; patch.dataOriginal = cl.dataOriginal; patch.adiadaEm = cl.adiadaEm; }
  var der = acordoDerivado(cl);
  return persistPatchAcordo(doc, Object.assign(patch, der));
}

/* ---------- Murilo: adiar as atrasadas que você escolher, para a data que combinar ---------- */
function adAtrasadasMurilo(){
  var hoje = todayISO();
  return listarUnidades().filter(function(u){
    var d = anDocDaUnidade(u);
    return u.origem === 'murilo' && !u.arquivado && !(d && d.atipica) && restanteUn(u) > 0.004 && u.data && u.data < hoje && adPodeAdiar(u);
  }).sort(function(a, b){ return a.data.localeCompare(b.data); });
}
var adLista = [];
function adMontarMurilo(){
  if (qs('overlayAdMurilo')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAdMurilo'; d.style.zIndex = '260';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Adiar atrasadas do Murilo</h2><button class="icon-btn" id="adMurFechar" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<div class="modal-body"><div class="parcela-sum">Só as parcelas que já venceram. Desmarque as que não quiser adiar.</div><div class="ad-lista" id="adMurLista"></div>' +
    '<div class="field"><label class="field-label" for="adMurData">Nova data de vencimento (para as marcadas)</label><input type="date" id="adMurData"></div>' +
    '<div class="field"><label class="field-label" for="adMurObs">Motivo (opcional)</label><input type="text" id="adMurObs" placeholder="Ex.: Murilo viajando" autocomplete="off"></div>' +
    '<div class="cli-obs">Só as marcadas mudam de data. Nada acontece sozinho: apenas quando você tocar em Adiar.</div><div class="form-error" id="adMurErro"></div></div>' +
    '<div class="modal-foot"><button class="btn btn-ghost" id="adMurCancelar" type="button">Cancelar</button><button class="btn btn-primary" id="adMurConfirmar" type="button">Adiar</button></div></div>';
  document.body.appendChild(d);
  adAbrirData(qs('adMurData'));
  d.addEventListener('click', function(e){ if (e.target === d || (e.target.closest && e.target.closest('#adMurFechar, #adMurCancelar'))) d.classList.remove('show'); });
  qs('adMurLista').addEventListener('change', adContarMurilo);
  qs('adMurConfirmar').addEventListener('click', adConfirmarMurilo);
}
function adContarMurilo(){
  var n = qs('adMurLista').querySelectorAll('input:checked').length;
  qs('adMurConfirmar').textContent = n ? 'Adiar ' + n + ' parcela' + (n > 1 ? 's' : '') : 'Adiar';
}
function adAbrirMurilo(){
  adMontarMurilo(); adLista = adAtrasadasMurilo();
  qs('adMurErro').textContent = ''; qs('adMurData').min = todayISO(); qs('adMurData').value = ''; qs('adMurObs').value = '';
  qs('adMurLista').innerHTML = adLista.length ? adLista.map(function(u, i){
    return '<label class="ad-it"><input type="checkbox" data-ad-i="' + i + '" checked><span class="ad-t"><b>' + escapeHtml(u.cliente) + ' \u00B7 ' + escapeHtml(u.label) + '</b><span class="lbl" style="color:var(--urgente);">venceu em ' + fmtData(u.data) + '</span></span><span class="ad-v">' + fmtMoeda(restanteUn(u)) + '</span></label>';
  }).join('') : '<div class="financeiro-vazio">Não há parcelas do Murilo em atraso.</div>';
  qs('adMurConfirmar').style.display = adLista.length ? '' : 'none';
  adContarMurilo();
  qs('overlayAdMurilo').classList.add('show');
}
function adConfirmarMurilo(){
  var marcadas = Array.prototype.map.call(qs('adMurLista').querySelectorAll('input:checked'), function(i){ return adLista[Number(i.getAttribute('data-ad-i'))]; });
  var nova = qs('adMurData').value, erro = '';
  if (!marcadas.length) erro = 'Marque ao menos uma parcela.';
  else if (!nova) erro = 'Escolha a nova data de vencimento.';
  else if (nova < todayISO()) erro = 'A nova data precisa ser de hoje em diante.';
  if (erro){ qs('adMurErro').textContent = erro; return; }
  var grupos = {};
  marcadas.forEach(function(u){ var k = u.docTipo + '|' + u.docId; (grupos[k] = grupos[k] || { tipo: u.docTipo, id: u.docId, chaves: [] }).chaves.push(u.chave); });
  var motivo = qs('adMurObs').value.trim(), cadeia = Promise.resolve();
  qs('adMurConfirmar').disabled = true;
  Object.keys(grupos).forEach(function(k){ cadeia = cadeia.then(function(){ return aplicarAdiamento(grupos[k].tipo, grupos[k].id, grupos[k].chaves, nova, motivo); }); });
  cadeia.then(function(){
    qs('adMurConfirmar').disabled = false; qs('overlayAdMurilo').classList.remove('show');
    toast(marcadas.length + ' parcela' + (marcadas.length > 1 ? 's adiadas' : ' adiada') + ' para ' + fmtData(nova) + '.');
    try{ regenerarRelMurilo(); }catch(e){}
  }).catch(function(err){ console.error('erro ao adiar', err); qs('adMurConfirmar').disabled = false; qs('adMurErro').textContent = msgErroSalvar(err); });
}
qs('relAdiarBtn').addEventListener('click', adAbrirMurilo);
'''
rep("function obraAbrirGasto(id, pagarId){", js + "\nfunction obraAbrirGasto(id, pagarId){")
open(R + 'public/index.html', 'w', encoding='utf-8').write(s)
print('adiar aplicado')
