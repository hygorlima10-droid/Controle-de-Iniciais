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
