/* ============================================================
   DIAS SEM EXPEDIENTE (prefixo dx) e CONTAGEM DE PRAZOS (prefixo pz).
   - O calendário do TJGO (feriados, recesso de 20/12 a 20/01) já vem no app (cliente/publicacoes.js). Aqui o proprietário cadastra o que é do juízo dele:
     feriado municipal, ponto facultativo, suspensão de prazos. O cadastro (coleção diasSemExpediente, uma data por documento) vale para todos os cálculos.
   - Ao cadastrar um dia depois de já haver prazos e tarefas lançados, as datas afetadas são adiadas sozinhas e o app mostra o que mudou (com "Desfazer tudo").
   - O motor de contagem (pzCalcular) serve à Calculadora de prazos e ao recálculo dos prazos criados por ela (o prazo guarda os parâmetros em `calculo`).
   ============================================================ */
var dxLista = [], dxOk = false;
var DX_TIPOS = { municipal: 'Feriado municipal', facultativo: 'Ponto facultativo', suspensao: 'Suspensão de prazos', outro: 'Outro' };
function dxTem(iso){ for (var i = 0; i < dxLista.length; i++) if (dxLista[i].data === iso) return true; return false; }
function dxNome(iso){ for (var i = 0; i < dxLista.length; i++) if (dxLista[i].data === iso) return dxLista[i].nome || DX_TIPOS[dxLista[i].tipo] || 'Sem expediente'; return ''; }
function dxCarregar(){
  if (!window.__SERVIDOR) { dxOk = true; return Promise.resolve(); }
  return pbApi('/api/db/diasSemExpediente').then(function(r){
    dxLista = (r.docs || []).map(function(d){ var x = d.data || {}; return { id: d.id, data: x.data || d.id, nome: x.nome || '', tipo: DX_TIPOS[x.tipo] ? x.tipo : 'outro' }; }).filter(function(x){ return /^\d{4}-\d{2}-\d{2}$/.test(x.data); }).sort(function(a, b){ return a.data.localeCompare(b.data); });
    dxOk = true; try{ pbFerCache = {}; }catch(e){}
    try{ agDepois(); }catch(e){}
  }).catch(function(){ dxOk = true; });
}
/* ---------- cálculo de datas ---------- */
function pzIso(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T12:00:00Z')); }
function pzSemExp(iso, rg, extras){
  var w = pbDow(iso); if (w === 0 || w === 6 || pbFeriado(iso)) return true;
  if (rg && rg.recesso && pbRecesso(iso)) return true;
  return !!extras && extras.indexOf(iso) >= 0;
}
function pzProx(iso, sem){ var d = pbSoma(iso, 1), n = 0; while (sem(d) && n++ < 400) d = pbSoma(d, 1); return d; }
function pzProxUtil(iso){ return pzProx(iso, function(d){ return pbNaoUtil(d); }); }
function pzAntesUteis(iso, n){ var d = iso, c = 0; while (n > 0 && c++ < 400){ d = pbSoma(d, -1); if (!pbNaoUtil(d)) n--; } return d; }
var PZ_REGIMES = {
  cpc: { nome: 'Processo civil (CPC)', unidade: 'uteis', recesso: true, prorroga: false, excluiInicio: true, inicioUtil: false, ref: 'CPC, arts. 219, 220 e 224' },
  jec: { nome: 'Juizados Especiais (Lei 9.099/95)', unidade: 'uteis', recesso: true, prorroga: false, excluiInicio: true, inicioUtil: false, ref: 'Lei 9.099/95, art. 12-A (dias úteis); CPC, art. 224' },
  clt: { nome: 'Processo do trabalho (CLT)', unidade: 'uteis', recesso: true, prorroga: false, excluiInicio: true, inicioUtil: false, ref: 'CLT, arts. 775 e 775-A' },
  cpp: { nome: 'Processo penal (CPP)', unidade: 'corridos', recesso: false, prorroga: true, excluiInicio: true, inicioUtil: true, ref: 'CPP, art. 798 e Súmula 310 do STF (prazo contínuo)' },
  adm: { nome: 'Processo administrativo (Lei 9.784/99)', unidade: 'corridos', recesso: false, prorroga: true, excluiInicio: true, inicioUtil: false, ref: 'Lei 9.784/99, art. 66 (prazo contínuo)' },
  custom: { nome: 'Personalizado', unidade: 'uteis', recesso: true, prorroga: false, excluiInicio: true, inicioUtil: false, ref: 'regras escolhidas por você' }
};
function pzRegime(op){
  var b = PZ_REGIMES[op.regime] || PZ_REGIMES.cpc, o = {};
  Object.keys(b).forEach(function(k){ o[k] = b[k]; });
  if (op.regime === 'custom' || op.sobre){ ['unidade', 'recesso', 'prorroga', 'excluiInicio', 'inicioUtil'].forEach(function(k){ if (op[k] !== undefined && op[k] !== null) o[k] = op[k]; }); }
  return o;
}
/* op = { modo: 'dje' | 'ciencia' | 'inicio', data, dias, regime, dobro, extras: [datas], (personalizado: unidade, recesso, prorroga, excluiInicio) }
   devolve { erro } ou { publicacao, inicio, vencimento, trabalhar, passos: [{ iso, t: 'disp'|'pub'|'pula'|'conta'|'prorroga'|'venc', n, motivo }], dias, total, regime } */
function pzCalcular(op){
  op = op || {}; var rg = pzRegime(op), extras = Array.isArray(op.extras) ? op.extras : [], dias = Math.round(Number(op.dias));
  if (!pzIso(op.data)) return { erro: 'Informe a data.' };
  if (!(dias > 0) || dias > 1000) return { erro: 'Informe o número de dias do prazo.' };
  var total = op.dobro ? dias * 2 : dias, uteis = rg.unidade === 'uteis', passos = [], sem = function(d){ return pzSemExp(d, rg, extras); };
  var motivo = function(d){ if (extras.indexOf(d) >= 0 && !pbNaoUtil(d)) return 'dia sem expediente informado no cálculo'; return pbMotivoNaoUtil(d) || (sem(d) ? 'sem expediente' : ''); };
  var out = { publicacao: '', passos: passos, dias: dias, total: total, regime: rg, op: op }, ref = op.data;
  if (op.modo === 'dje'){ out.publicacao = pzProx(op.data, sem); ref = out.publicacao; passos.push({ iso: op.data, t: 'disp' }); passos.push({ iso: out.publicacao, t: 'pub' }); }
  else if (op.modo === 'ciencia'){ if (sem(op.data)){ ref = pzProx(op.data, sem); passos.push({ iso: op.data, t: 'pula', motivo: 'ciência em dia sem expediente: vale o 1º dia útil seguinte' }); } passos.push({ iso: ref, t: 'pub' }); }
  else passos.push({ iso: ref, t: 'pub' });
  var first = rg.excluiInicio ? pbSoma(ref, 1) : ref;
  if (rg.inicioUtil){ while (sem(first)) { passos.push({ iso: first, t: 'pula', motivo: motivo(first) }); first = pbSoma(first, 1); } }
  var d = first, n = 0, guarda = 0;
  if (uteis){
    while (n < total && guarda++ < 5000){
      if (sem(d)) passos.push({ iso: d, t: 'pula', motivo: motivo(d) });
      else { n++; passos.push({ iso: d, t: n === total ? 'venc' : 'conta', n: n }); if (n === total) break; }
      d = pbSoma(d, 1);
    }
    out.vencimento = d;
  } else {
    var dd = first, cnt = 0, g3 = 0;
    while (cnt < total && g3++ < 5000){
      if (rg.recesso && pbRecesso(dd)) passos.push({ iso: dd, t: 'pula', motivo: pbMotivoNaoUtil(dd) || 'recesso' });
      else { cnt++; var semFim = pbDow(dd) === 0 || pbDow(dd) === 6 || pbFeriado(dd) || extras.indexOf(dd) >= 0; passos.push({ iso: dd, t: cnt === total ? 'venc' : 'conta', n: cnt, nota: semFim ? motivo(dd) : '' }); if (cnt === total) break; }
      dd = pbSoma(dd, 1);
    }
    var v = dd;
    if (rg.prorroga){
      var semProrroga = function(x){ var w = pbDow(x); return w === 0 || w === 6 || pbFeriado(x) || extras.indexOf(x) >= 0; }, g2 = 0;
      if (semProrroga(v)) passos[passos.length - 1].t = 'conta';
      while (semProrroga(v) && g2++ < 60){ passos.push({ iso: v, t: 'prorroga', motivo: motivo(v) }); v = pbSoma(v, 1); }
      if (g2){ passos.pop(); passos.push({ iso: v, t: 'venc', n: total, prorrogado: true }); }
    }
    out.vencimento = v;
  }
  var p1 = null; passos.forEach(function(p){ if (!p1 && (p.t === 'conta' || p.t === 'venc')) p1 = p; }); out.inicio = p1 ? p1.iso : first;   /* 1º dia que de fato conta */
  var tr = pzAntesUteis(out.vencimento, 2); out.trabalhar = (tr >= agHoje() && tr < out.vencimento) ? tr : '';
  return out;
}
/* ---------- cadastro (Configurações › Dias sem expediente) ---------- */
function dxMontar(){
  if (qs('overlayDx')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayDx';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Dias sem expediente</h2><button class="icon-btn" id="dxX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="dxC"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#dxX'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-dx]') : null; if (!b) return;
    var a = b.getAttribute('data-dx');
    if (a === 'add') dxAdicionarForm(); else if (a === 'sug') dxAdicionar(b.getAttribute('data-d'), b.getAttribute('data-n'), 'facultativo'); else if (a === 'rem') dxRemover(b.getAttribute('data-d'));
  });
}
function dxAbrir(){ dxMontar(); dxDesenhar(); qs('overlayDx').classList.add('show'); }
function dxDesenhar(){
  var el = qs('dxC'); if (!el) return;
  var sug = Object.keys(PB_FACULTATIVOS).filter(function(dt){ return !dxTem(dt); });
  var h = '<div class="parcela-sum">O app já considera os <b>feriados nacionais e do TJGO</b> (calendário anual) e o <b>recesso de 20/12 a 20/01</b>. Aqui você cadastra o que é do seu juízo. Cada dia entra em <b>todos os cálculos de prazo</b>, e os prazos e tarefas já lançados que caem nele são <b>adiados sozinhos</b> (o app mostra o que mudou e dá para desfazer).</div>' +
    '<div class="pb-sec-t" style="margin:8px 4px 4px">Novo dia</div><div class="pb-dois"><div class="field"><label class="field-label" for="dx_data">Data</label><input type="date" id="dx_data"></div><div class="field"><label class="field-label" for="dx_tipo">Tipo</label><select id="dx_tipo" class="filter-select" style="width:100%">' + Object.keys(DX_TIPOS).map(function(k){ return '<option value="' + k + '">' + DX_TIPOS[k] + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="field"><label class="field-label" for="dx_nome">Nome (opcional)</label><input type="text" id="dx_nome" maxlength="60" placeholder="Ex.: aniversário do município"></div><div class="form-error" id="dx_erro"></div>' +
    '<div class="pb-acts"><button type="button" class="btn btn-primary" data-dx="add">Adicionar</button></div>';
  if (sug.length) h += '<div class="pb-sec-t" style="margin:14px 4px 4px">Pontos facultativos do TJGO em 2026 <small style="text-transform:none;letter-spacing:0">(não contam como sem expediente, a não ser que você adicione)</small></div>' + sug.map(function(dt){ return '<div class="cli-linha" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 4px"><span>' + escapeHtml(fmtData(dt)) + ' · ' + escapeHtml(PB_FACULTATIVOS[dt]) + '</span><button type="button" class="btn btn-ghost pb-b" data-dx="sug" data-d="' + dt + '" data-n="' + escapeHtml(PB_FACULTATIVOS[dt]) + '">Adicionar</button></div>'; }).join('');
  h += '<div class="pb-sec-t" style="margin:14px 4px 4px">Cadastrados (' + dxLista.length + ')</div>' + (dxLista.length ? dxLista.map(function(x){ return '<div class="cli-linha" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 4px"><span><b>' + escapeHtml(fmtData(x.data)) + '</b> · ' + escapeHtml(AG_DOW[pbDow(x.data)]) + ' · ' + escapeHtml(x.nome || DX_TIPOS[x.tipo]) + (x.nome ? ' <small>(' + escapeHtml(DX_TIPOS[x.tipo]) + ')</small>' : '') + '</span><button type="button" class="btn-text" data-dx="rem" data-d="' + x.data + '" aria-label="Remover">Remover</button></div>'; }).join('') : '<div class="saldo-data">Nenhum cadastrado.</div>');
  el.innerHTML = h;
}
function dxAdicionarForm(){
  var data = qs('dx_data').value, tipo = qs('dx_tipo').value, nome = qs('dx_nome').value.trim();
  if (!pzIso(data)){ qs('dx_erro').textContent = 'Escolha a data.'; return; }
  dxAdicionar(data, nome, tipo);
}
function dxAdicionar(data, nome, tipo){
  var er = qs('dx_erro'); if (er) er.textContent = '';
  if (dxTem(data)){ if (er) er.textContent = 'Esta data já está cadastrada.'; return; }
  if (pbDow(data) === 0 || pbDow(data) === 6 || pbFeriado(data)){ if (er) er.textContent = 'Esta data já é dia sem expediente (' + (pbMotivoNaoUtil(data) || 'fim de semana') + ').'; return; }
  var doc = { data: data, nome: nome || '', tipo: DX_TIPOS[tipo] ? tipo : 'outro', criadoEm: new Date().toISOString() };
  pbApi('/api/db/diasSemExpediente/' + encodeURIComponent(data), 'PUT', doc).then(function(){
    dxLista.push({ id: data, data: data, nome: doc.nome, tipo: doc.tipo }); dxLista.sort(function(a, b){ return a.data.localeCompare(b.data); }); pbFerCache = {};
    dxDesenhar(); return dxAplicar(data);
  }).catch(function(e){ if (qs('dx_erro')) qs('dx_erro').textContent = 'Não consegui salvar: ' + ((e && e.message) || ''); });
}
function dxRemover(data){
  pbApi('/api/db/diasSemExpediente/' + encodeURIComponent(data), 'DELETE').then(function(){
    dxLista = dxLista.filter(function(x){ return x.data !== data; }); pbFerCache = {}; dxDesenhar(); try{ agDepois(); }catch(e){}
    toast('Dia removido. As datas que já tinham sido adiadas não voltam sozinhas.');
  }).catch(function(e){ toast('Não consegui remover: ' + ((e && e.message) || '')); });
}
/* ---------- ajuste automático das datas já lançadas ---------- */
var dxDesfazer = [];
function dxCopia(o){ return JSON.parse(JSON.stringify(o || {})); }
function dxAplicar(iso){
  var mud = [], hoje = agHoje(), tarefas = [];
  var fim = function(d){ return d.concluido || d.cancelado; };
  agDocs.forEach(function(d){
    if (fim(d)) return;
    var tipo = d.tipo || 'prazo', antes = dxCopia(d), novo = dxCopia(d), motivo = '';
    if (tipo === 'prazo'){
      var venceu = d.data;
      if (d.calculo){ var r = pzCalcular(d.calculo); if (r && !r.erro && r.vencimento && r.vencimento !== d.data){ novo.data = r.vencimento; motivo = 'prazo recalculado'; } }
      else if (d.data === iso){ novo.data = pzProxUtil(iso); motivo = 'prazo vencia no dia sem expediente'; }
      if (d.trabalhar && (d.trabalhar === iso || (novo.data !== venceu && d.trabalhar >= novo.data))){
        var t1 = pzProxUtil(d.trabalhar === iso ? iso : d.trabalhar); novo.trabalhar = t1 < novo.data ? t1 : (function(){ var a = pzAntesUteis(novo.data, 2); return (a >= hoje && a < novo.data) ? a : ''; })();
      }
    } else if (tipo === 'tarefa' && d.data === iso){ novo.data = pzProxUtil(iso); motivo = 'tarefa no dia sem expediente'; }
    else if (tipo === 'audiencia' && d.data === iso){ mud.push({ aviso: true, titulo: d.titulo || 'Audiência', de: d.data, para: '', motivo: 'audiência marcada neste dia: confira com o juízo (não foi alterada)' }); return; }
    if (novo.data !== antes.data || novo.trabalhar !== antes.trabalhar) mud.push({ col: 'agenda', id: d.id, doc: d, antes: antes, novo: novo, titulo: d.titulo || 'Prazo', cliente: d.cliente || '', de: antes.data, para: novo.data, motivo: motivo || 'dia de trabalhar ajustado' });
  });
  casos.forEach(function(c){
    if (c.arquivado || !c.prazo || !c.prazo.data || c.prazo.concluido || c.prazo.data !== iso) return;
    mud.push({ col: 'casos', id: c.id, caso: c, antes: dxCopia(c.prazo), novo: Object.assign({}, c.prazo, { data: pzProxUtil(iso) }), titulo: c.prazo.descricao || 'Prazo da inicial', cliente: c.cliente || '', de: c.prazo.data, para: pzProxUtil(iso), motivo: 'prazo da inicial vencia no dia sem expediente' });
  });
  var reais = mud.filter(function(m){ return !m.aviso; });
  return Promise.all(reais.map(function(m){
    if (m.col === 'agenda'){ var doc = dxCopia(m.novo); delete doc.id; return pbApi('/api/db/agenda/' + encodeURIComponent(m.id), 'PUT', doc).then(function(){ Object.assign(m.doc, doc); }); }
    persistPatch(m.caso, { prazo: m.novo }); return Promise.resolve();
  })).then(function(){ dxDesfazer = reais; try{ agDepois(); }catch(e){} if (mud.length) dxResumo(iso, mud); });
}
function dxResumo(iso, mud){
  if (!qs('overlayDxRes')){
    var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayDxRes';
    d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Datas ajustadas</h2><button class="icon-btn" id="dxrX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="dxrC"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function(e){
      if (e.target === d || (e.target.closest && e.target.closest('#dxrX'))){ d.classList.remove('show'); return; }
      if (e.target.closest && e.target.closest('[data-dxr="desfazer"]')) dxDesfazerTudo();
      if (e.target.closest && e.target.closest('[data-dxr="ok"]')) d.classList.remove('show');
    });
  }
  var nreal = mud.filter(function(m){ return !m.aviso; }).length;
  qs('dxrC').innerHTML = '<div class="parcela-sum">Por causa de <b>' + escapeHtml(fmtData(iso)) + '</b> (' + escapeHtml(dxNome(iso)) + '), ' + (nreal ? '<b>' + nreal + (nreal === 1 ? ' data foi adiada' : ' datas foram adiadas') + '</b>.' : 'nenhuma data precisou ser adiada.') + '</div>' +
    mud.map(function(m){ return '<div class="cli-linha" style="padding:7px 4px"><b>' + escapeHtml(m.titulo) + '</b>' + (m.cliente ? ' · ' + escapeHtml(m.cliente) : '') + '<div class="saldo-data" style="margin:2px 0 0">' + (m.aviso ? '⚠ ' : escapeHtml(fmtData(m.de)) + ' → <b>' + escapeHtml(fmtData(m.para)) + '</b> · ') + escapeHtml(m.motivo) + '</div></div>'; }).join('') +
    '<div class="pb-acts" style="margin-top:10px">' + (nreal ? '<button type="button" class="btn btn-ghost" data-dxr="desfazer">Desfazer tudo</button>' : '') + '<button type="button" class="btn btn-primary" data-dxr="ok">Ok</button></div>';
  qs('overlayDxRes').classList.add('show');
}
function dxDesfazerTudo(){
  var l = dxDesfazer; dxDesfazer = [];
  Promise.all(l.map(function(m){
    if (m.col === 'agenda'){ var doc = dxCopia(m.antes); delete doc.id; return pbApi('/api/db/agenda/' + encodeURIComponent(m.id), 'PUT', doc).then(function(){ Object.assign(m.doc, doc); }); }
    persistPatch(m.caso, { prazo: m.antes }); return Promise.resolve();
  })).then(function(){ qs('overlayDxRes').classList.remove('show'); try{ agDepois(); }catch(e){} toast('Datas voltaram ao que eram.'); });
}

/* ============================================================
   CALCULADORA DE PRAZOS (tela)
   Abre pela Agenda (botão "Calculadora de prazos"), pelo editor do prazo ("Calcular a partir da intimação") e por Publicações.
   Com `retorno`, o botão final devolve a data para quem chamou; sem `retorno`, cria o prazo na Agenda já com a data, o "trabalhar até" e os parâmetros (`calculo`),
   que permitem recalcular o prazo se um dia sem expediente for cadastrado depois.
   ============================================================ */
var pzS = null;
var PZ_MODOS = [['dje', 'Publicação no Diário (DJe)'], ['ciencia', 'Ciência direta ou eletrônica'], ['inicio', 'Contar a partir de…']];
var PZ_DATA_ROT = { dje: 'Data da disponibilização no DJe', ciencia: 'Data da ciência (intimação)', inicio: 'Dia do começo da contagem' };
function pzRegimeSalvo(){ try{ var r = localStorage.getItem('horus.pzRegime'); return PZ_REGIMES[r] ? r : 'cpc'; }catch(e){ return 'cpc'; } }
function pzMontar(){
  if (qs('overlayPz')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayPz';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Calculadora de prazos</h2><button class="icon-btn" id="pzX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="pzC"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#pzX'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-pz]') : null; if (!b) return;
    var a = b.getAttribute('data-pz');
    if (a === 'modo'){ pzS.op.modo = b.getAttribute('data-v'); pzDesenhar(); }
    else if (a === 'extra-add'){ var v = qs('pz_extra').value; if (pzIso(v) && pzS.op.extras.indexOf(v) < 0){ pzS.op.extras.push(v); pzS.op.extras.sort(); } pzDesenhar(); }
    else if (a === 'extra-rem'){ pzS.op.extras = pzS.op.extras.filter(function(x){ return x !== b.getAttribute('data-v'); }); pzDesenhar(); }
    else if (a === 'mem'){ pzS.mem = !pzS.mem; pzAtualizar(); }
    else if (a === 'usar') pzUsar();
    else if (a === 'criar') pzCriar();
  });
  d.addEventListener('input', function(e){ var t = e.target; if (!t || !t.id || t.id.indexOf('pz_') !== 0) return; if (t.id !== 'pz_extra') pzLer(); pzAtualizar(); });
  d.addEventListener('change', function(e){ var t = e.target; if (!t || !t.id || t.id.indexOf('pz_') !== 0) return; pzLer(); if (t.id === 'pz_regime'){ try{ localStorage.setItem('horus.pzRegime', pzS.op.regime); }catch(x){} pzDesenhar(); } else pzAtualizar(); });
}
function pzAbrir(o){
  o = o || {}; pzMontar();
  pzS = { retorno: o.retorno || null, mem: false, op: { modo: o.modo || 'dje', data: o.data || '', dias: o.dias || 15, regime: o.regime || pzRegimeSalvo(), dobro: !!o.dobro, extras: [], unidade: 'uteis', recesso: true, prorroga: false, excluiInicio: true } };
  var rg = PZ_REGIMES[pzS.op.regime]; ['unidade', 'recesso', 'prorroga', 'excluiInicio'].forEach(function(k){ pzS.op[k] = rg[k]; });
  pzDesenhar(); qs('overlayPz').classList.add('show');
}
function pzLer(){
  var op = pzS.op, g = function(id){ return qs(id); };
  if (g('pz_regime') && g('pz_regime').value !== op.regime){ op.regime = g('pz_regime').value; var rg = PZ_REGIMES[op.regime]; ['unidade', 'recesso', 'prorroga', 'excluiInicio'].forEach(function(k){ op[k] = rg[k]; }); }
  if (g('pz_data')) op.data = g('pz_data').value; if (g('pz_dias')) op.dias = g('pz_dias').value; if (g('pz_dobro')) op.dobro = g('pz_dobro').checked;
  if (op.regime === 'custom'){ if (g('pz_unid')) op.unidade = g('pz_unid').value; if (g('pz_rec')) op.recesso = g('pz_rec').checked; if (g('pz_pro')) op.prorroga = g('pz_pro').checked; if (g('pz_exc')) op.excluiInicio = g('pz_exc').checked; }
}
function pzDesenhar(){
  var el = qs('pzC'), op = pzS.op, rg = pzRegime(op), cust = op.regime === 'custom';
  var h = '<div class="field"><label class="field-label" for="pz_regime">Tipo de processo (regra de contagem)</label><select id="pz_regime" class="filter-select" style="width:100%">' + Object.keys(PZ_REGIMES).map(function(k){ return '<option value="' + k + '"' + (op.regime === k ? ' selected' : '') + '>' + PZ_REGIMES[k].nome + '</option>'; }).join('') + '</select><div class="saldo-data" style="margin:3px 2px 0" id="pz_ref"></div></div>' +
    '<div class="field"><label class="field-label">Como você ficou sabendo</label><div class="segmented" id="pzModo">' + PZ_MODOS.map(function(m){ return '<button type="button" class="seg-btn' + (op.modo === m[0] ? ' active' : '') + '" data-pz="modo" data-v="' + m[0] + '" style="flex:1;padding:8px 4px;line-height:1.2;font-size:var(--t2)">' + m[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="pb-dois"><div class="field"><label class="field-label" for="pz_data">' + PZ_DATA_ROT[op.modo] + '</label><input type="date" id="pz_data" value="' + escapeHtml(op.data) + '"></div><div class="field"><label class="field-label" for="pz_dias">Prazo (dias)</label><input type="number" id="pz_dias" min="1" max="365" inputmode="numeric" value="' + escapeHtml(String(op.dias)) + '"></div></div>';
  if (cust) h += '<div class="pb-sec" style="padding:8px 4px"><div class="field"><label class="field-label" for="pz_unid">Contagem</label><select id="pz_unid" class="filter-select" style="width:100%"><option value="uteis"' + (op.unidade === 'uteis' ? ' selected' : '') + '>dias úteis</option><option value="corridos"' + (op.unidade === 'corridos' ? ' selected' : '') + '>dias corridos (contínuos)</option></select></div>' +
    '<label class="ad-it" style="border:0;padding:3px 0"><input type="checkbox" id="pz_exc"' + (op.excluiInicio ? ' checked' : '') + '><span class="ad-t">Não contar o dia do começo</span></label>' +
    '<label class="ad-it" style="border:0;padding:3px 0"><input type="checkbox" id="pz_rec"' + (op.recesso ? ' checked' : '') + '><span class="ad-t">Suspender no recesso (20/12 a 20/01)</span></label>' +
    '<label class="ad-it" style="border:0;padding:3px 0"><input type="checkbox" id="pz_pro"' + (op.prorroga ? ' checked' : '') + '><span class="ad-t">Se vencer em dia sem expediente, passar para o próximo dia útil</span></label></div>';
  h += '<label class="ad-it" style="border:0;padding:6px 0"><input type="checkbox" id="pz_dobro"' + (op.dobro ? ' checked' : '') + '><span class="ad-t">Prazo em dobro <small class="saldo-data">(Fazenda Pública, Ministério Público, Defensoria, litisconsortes com advogados diferentes)</small></span></label>' +
    '<div class="field"><label class="field-label" for="pz_extra">Dia sem expediente só neste cálculo (opcional)</label><div style="display:flex;gap:8px"><input type="date" id="pz_extra" style="flex:1"><button type="button" class="btn btn-ghost pb-b" data-pz="extra-add">Adicionar</button></div>' + (op.extras.length ? '<div style="margin-top:6px">' + op.extras.map(function(x){ return '<span class="pb-tg" style="margin:2px 4px 2px 0">' + escapeHtml(fmtData(x)) + ' <button type="button" class="btn-text" data-pz="extra-rem" data-v="' + x + '" aria-label="Remover" style="padding:0 2px">✕</button></span>'; }).join('') + '</div>' : '') + '<div class="saldo-data" style="margin:3px 2px 0">Para feriado municipal ou suspensão que vale sempre, cadastre em Configurações › Dias sem expediente.</div></div>' +
    '<div id="pzRes"></div><div class="pb-aviso" style="margin:10px 4px">Conferência obrigatória: o app não conhece suspensões pontuais do tribunal (indisponibilidade do sistema, portarias). A memória de cálculo mostra cada dia para você conferir.</div>';
  el.innerHTML = h; pzAtualizar();
}
function pzResumoPulos(r){
  var fds = false, outros = [];
  r.passos.forEach(function(p){ if (p.t !== 'pula') return; var w = pbDow(p.iso); if ((w === 0 || w === 6) && !pbFeriado(p.iso)) fds = true; else outros.push(p); });
  var l = []; if (fds) l.push('sábados e domingos');
  var rec = outros.filter(function(p){ return /recesso/i.test(p.motivo || ''); }), fer = outros.filter(function(p){ return !/recesso/i.test(p.motivo || ''); });
  fer.forEach(function(p){ l.push(fmtData(p.iso).slice(0, 5) + (p.motivo ? ' ' + p.motivo : '')); });
  if (rec.length) l.push('recesso (' + fmtData(rec[0].iso).slice(0, 5) + ' a ' + fmtData(rec[rec.length - 1].iso).slice(0, 5) + ')');
  return l.join('; ');
}
function pzAtualizar(){
  var el = qs('pzRes'); if (!el || !pzS) return;
  var op = pzS.op, rg = pzRegime(op), r = pzCalcular(op), ref = qs('pz_ref');
  if (ref) ref.textContent = rg.ref + ' · ' + (rg.unidade === 'uteis' ? 'dias úteis' : 'dias corridos (contínuos)') + (rg.excluiInicio ? ' · o dia do começo não conta' : '');
  if (r.erro){ el.innerHTML = '<div class="saldo-data" style="margin:10px 4px">' + escapeHtml(r.erro) + '</div>'; return; }
  var dow = function(iso){ return AG_DOW[pbDow(iso)]; }, pulos = pzResumoPulos(r), pubPasso = r.passos.filter(function(p){ return p.t === 'pub'; })[0];
  var h = '<div class="pb-sec" style="margin-top:10px;border:1px solid var(--border);border-radius:16px;padding:12px"><div class="saldo-data" style="margin:0">Prazo fatal</div><div style="font-size:var(--t7,22px);font-weight:800;color:var(--urgente)">' + escapeHtml(PB_DIAS[pbDow(r.vencimento)] + ', ' + fmtData(r.vencimento)) + '</div><div class="saldo-data" style="margin:0 0 6px">' + r.total + (r.regime.unidade === 'uteis' ? ' dias úteis' : ' dias corridos') + (op.dobro ? ' (em dobro)' : '') + ' · conta a partir de ' + escapeHtml(dow(r.inicio) + ' ' + fmtData(r.inicio).slice(0, 5)) + '</div>';
  if (op.modo === 'dje') h += '<div class="pb-lin"><span>Publicação</span><b>' + escapeHtml(dow(r.publicacao) + ' ' + fmtData(r.publicacao)) + '</b></div>';
  else if (op.modo === 'ciencia' && pubPasso && pubPasso.iso !== op.data) h += '<div class="pb-lin"><span>Ciência considerada em</span><b>' + escapeHtml(dow(pubPasso.iso) + ' ' + fmtData(pubPasso.iso)) + '</b></div>';
  h += '<div class="pb-lin"><span>Começa a contar</span><b>' + escapeHtml(dow(r.inicio) + ' ' + fmtData(r.inicio)) + '</b></div>' + (pulos ? '<div class="pb-lin"><span>Pulou</span><b style="text-align:right">' + escapeHtml(pulos) + '</b></div>' : '') + '<div class="pb-lin"><span>Vence</span><b>' + escapeHtml(dow(r.vencimento) + ' ' + fmtData(r.vencimento)) + (r.passos.some(function(p){ return p.t === 'prorroga'; }) ? ' (prorrogado)' : '') + '</b></div>' +
    (r.trabalhar ? '<div class="pb-lin"><span>Trabalhar até</span><b>' + escapeHtml(dow(r.trabalhar) + ' ' + fmtData(r.trabalhar)) + '</b> <small class="saldo-data">2 dias úteis antes</small></div>' : '') +
    '<button type="button" class="btn-text" data-pz="mem" style="margin-top:6px">' + (pzS.mem ? '▾ Esconder' : '▸ Ver') + ' a memória de cálculo dia a dia</button>';
  if (pzS.mem) h += '<div style="margin-top:4px">' + r.passos.map(function(p){
    var rot = { disp: 'disponibilização (não conta)', pub: p.t === 'pub' ? 'publicação / ciência (não conta)' : '', pula: 'não conta: ' + (p.motivo || 'sem expediente'), conta: 'dia ' + p.n + (p.nota ? ' · ' + p.nota : ''), venc: 'dia ' + p.n + ' · VENCE' + (p.prorrogado ? ' (prorrogado)' : ''), prorroga: 'vence em dia sem expediente: ' + (p.motivo || '') }[p.t] || '';
    var cor = p.t === 'venc' ? 'color:var(--urgente);font-weight:800' : ((p.t === 'pula' || p.t === 'disp' || p.t === 'pub' || p.t === 'prorroga') ? 'color:var(--ink-soft)' + (p.t === 'pula' ? ';text-decoration:line-through' : '') : '');
    return '<div class="pb-lin" style="' + cor + '"><span>' + escapeHtml(fmtData(p.iso).slice(0, 5) + ' ' + dow(p.iso)) + '</span><b style="font-weight:600;text-align:right">' + escapeHtml(rot) + '</b></div>';
  }).join('') + '</div>';
  h += '</div><div class="pb-acts" style="margin-top:10px">' + (pzS.retorno ? '<button type="button" class="btn btn-primary" data-pz="usar">Usar esta data</button>' : '<button type="button" class="btn btn-primary" data-pz="criar">Criar prazo na Agenda</button>') + '</div>';
  el.innerHTML = h; pzS.res = r;
}
function pzParametros(op){ return { modo: op.modo, data: op.data, dias: Math.round(Number(op.dias)), regime: op.regime, dobro: !!op.dobro, extras: (op.extras || []).slice(), unidade: op.unidade, recesso: !!op.recesso, prorroga: !!op.prorroga, excluiInicio: !!op.excluiInicio, sobre: op.regime === 'custom' ? 1 : 0 }; }
function pzUsar(){
  var r = pzS.res; if (!r || r.erro) return; var cb = pzS.retorno, calc = pzParametros(pzS.op);
  qs('overlayPz').classList.remove('show'); if (cb) cb({ vencimento: r.vencimento, trabalhar: r.trabalhar, calculo: calc, resultado: r });
}
function pzCriar(){
  var r = pzS.res; if (!r || r.erro) return; var calc = pzParametros(pzS.op);
  qs('overlayPz').classList.remove('show'); agAbrir(null, { tipo: 'prazo', data: r.vencimento, trabalhar: r.trabalhar, calculo: calc });
}
/* texto curto de como o prazo foi contado (ficha do item) */
function pzTextoCalculo(c){
  if (!c) return ''; var rg = PZ_REGIMES[c.regime] || PZ_REGIMES.cpc, dias = Number(c.dias) * (c.dobro ? 2 : 1), un = (c.unidade || rg.unidade) === 'uteis' ? 'dias úteis' : 'dias corridos';
  return rg.nome + ' · ' + dias + ' ' + un + (c.dobro ? ' (em dobro)' : '') + ' a partir de ' + ({ dje: 'disponibilização no DJe em ', ciencia: 'ciência em ', inicio: 'início em ' }[c.modo] || '') + fmtData(c.data);
}

/* ao entrar, carrega o calendário do escritório */
(function(){ ppDonoP().then(function(){ dxCarregar(); }); })();
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { pzCalcular: pzCalcular, dxTem: dxTem, dxAplicar: dxAplicar, dxCarregar: dxCarregar, pbNaoUtil: pbNaoUtil, pbSoma: pbSoma, pbDow: pbDow, pzAbrir: pzAbrir }); })();
