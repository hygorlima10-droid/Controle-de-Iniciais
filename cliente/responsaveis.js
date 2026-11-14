/* ============================================================
   ADVOGADOS RESPONSÁVEIS E ESCOPO "MEUS | ESCRITÓRIO" (prefixo es) — Fase 5, etapa 5.4
   - barra "Meus | Escritório" (só o proprietário) nas listas de Processos, Iniciais, Acordos, Alvarás, Clientes e Arquivados; nas Publicações, "Minhas | Todas";
   - campo "Advogados responsáveis" nos cadastros de Inicial, Acordo, Alvará e Processo: quem cadastra escolhe (o app não marca ninguém sozinho);
   - aviso e revisão de registros sem advogado definido (só o proprietário), com sugestão quando outro registro do mesmo processo ou cliente já tem advogado.
   O filtro em si está em public/shim.js (window.__horusEscopo); o servidor já entrega a cada pessoa só o que ela pode ver.
   ============================================================ */
var esS = { sugerido: {}, eu: null, equipe: [], equipeAg: [], sem: null, semEm: 0, resp: {}, abertoSel: '', rev: null, ocupado: false };
var ES_TABS = { processos: 1, peticoes: 1, acordos: 1, alvaras: 1, clientes: 1, arquivados: 1 };
function esEsc(){ return window.__horusEscopo || { modo: 'escritorio', pub: 'minhas', ativo: false, oabs: [] }; }
function esJson(url, metodo, corpo){
  return fetch(url, { method: metodo || 'GET', credentials: 'same-origin', cache: 'no-store', headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined, body: corpo !== undefined ? JSON.stringify(corpo) : undefined })
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) throw new Error((j.error && j.error.message) || ('Erro ' + r.status)); return j; }); });
}
function esIniciar(){
  if (!window.__SERVIDOR) return;
  Promise.all([esJson('/api/eu'), esJson('/api/equipe').catch(function(){ return { advogados: [] }; }), esJson('/api/djen/estado').catch(function(){ return { oabs: [] }; })]).then(function(r){
    esS.eu = r[0]; esS.equipe = r[1].advogados || [];
    esS.equipeAg = esS.equipe.concat((r[1].estagiarios || []).map(function(e){ return { oab: 'u:' + e.id, nome: e.nome + ' (estagiário)' }; }));   // quem pode ser responsável na Agenda: advogados (chave = OAB) e estagiários (chave = u:id)
    var E = esEsc(), dono = r[0].papel === 'proprietario';
    var oabs = (r[0].oabs || []).slice();
    if (!oabs.length && dono) (r[2].oabs || []).forEach(function(o){ if (o.principal && o.numero) oabs.push(String(o.numero).replace(/\D/g, '').replace(/^0+/, '') + '/' + String(o.uf).toUpperCase()); });
    E.oabs = oabs; E.ativo = dono;
    if (dono && !(r[0].oabs || []).length) esS.eu.oabs = oabs.slice();   // proprietário sem OAB indicada: vale a principal de Publicações (também na Agenda)
    if (dono && E.modo === 'meus' && typeof E.aplicar === 'function') E.aplicar();
    if (dono && E.pub === 'minhas' && typeof pbCarregar === 'function' && typeof pbS !== 'undefined' && pbS.carregado){   // proprietário abre em "Minhas" publicações: relê já com o filtro (o que carregou antes de saber quem é o usuário veio inteiro)
      pbCarregar(true).then(function(){ try{ if (activeTab === 'publicacoes') pbRender(); prDepois(); renderPainelAtencao(); }catch(e){} });
    }
    esBarra();
    try{ if (activeTab === 'agenda') agRender(); }catch(e){}
    try{ rcCarregar().then(function(){ rcSincronizar(); rcDesenharInicio(); }); }catch(e){}
  }).catch(function(){});
}
/* ---------- barra Meus | Escritório ---------- */
function esBarra(){
  var barra = qs('esBarra'), E = esEsc();
  if (!barra){
    var h = document.querySelector('header.topbar'); if (!h) return;
    barra = document.createElement('div'); barra.id = 'esBarra'; barra.style.display = 'none'; h.parentNode.insertBefore(barra, h.nextSibling);
    barra.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('[data-es]') : null; if (!b) return;
      var a = b.getAttribute('data-es'), k = b.getAttribute('data-k');
      if (a === 'modo') esMudarModo(k);
      else if (a === 'definir') esAbrirRev();
      else if (a === 'agrev') agAbrirRevResp();
    });
  }
  var pub = activeTab === 'publicacoes', age = activeTab === 'agenda';
  if (age ? !esS.eu : (!E.ativo || !(ES_TABS[activeTab] || pub))){ barra.style.display = 'none'; return; }   // a Agenda tem a barra para todas as pessoas; as demais listas, só para o proprietário
  var sel = age ? agS.escopo : (pub ? E.pub : E.modo), ops = age ? [['minha', 'Minha agenda'], ['escritorio', 'Escritório']] : (pub ? [['minhas', 'Minhas'], ['todas', 'Todas']] : [['meus', 'Meus'], ['escritorio', 'Escritório']]);
  var h2 = '<div class="es-seg">' + ops.map(function(o){ return '<button type="button" class="es-b' + (sel === o[0] ? ' on' : '') + '" data-es="modo" data-k="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
  var n = esS.sem ? esS.sem.itens.length : 0;
  if (age && esS.eu.papel === 'proprietario'){ var ns = agSemResp().length; if (ns) h2 += '<span class="es-aviso"><b>' + ns + (ns === 1 ? ' prazo ou audiência' : ' prazos e audiências') + '</b> sem responsável <button type="button" class="es-lk" data-es="agrev">Definir</button></span>'; }
  if (!pub && !age && n) h2 += '<span class="es-aviso"><b>' + n + (n === 1 ? ' registro' : ' registros') + '</b> sem advogado definido <button type="button" class="es-lk" data-es="definir">Definir</button></span>';
  barra.innerHTML = h2; barra.style.display = '';
  if (!pub && !age && (!esS.sem || Date.now() - esS.semEm > 60000)) esCarregarSem();
}
function esCarregarSem(){
  esS.semEm = Date.now();
  return esJson('/api/sem-advogado').then(function(j){ esS.sem = j; if (esEsc().ativo) esBarra(); }).catch(function(){});
}
function esMudarModo(k){
  var E = esEsc();
  if (activeTab === 'agenda'){ agS.escopo = k === 'escritorio' ? 'escritorio' : 'minha'; try { localStorage.setItem('horus.agendaEscopo', agS.escopo); } catch (e) {} esBarra(); agRender(); return; }
  if (activeTab === 'publicacoes'){
    E.pub = k === 'todas' ? 'todas' : 'minhas'; try { localStorage.setItem('horus.escopoPub', E.pub); } catch (e) {}
    pbS.carregado = false; esBarra(); pbRender(); return;
  }
  E.aplicar(k); esBarra();
}
window.addEventListener('horus-escopo', function(){ try { if (typeof prCarregar === 'function') prCarregar(); } catch (e) {} try { render(); } catch (e) {} });
/* ---------- seletor "Advogados responsáveis" ---------- */
var ES_TITULO = { casos: 'Inicial', termosAcordo: 'Acordo', alvaras: 'Alvará', processos: 'Processo' };
function esRespIniciar(chave, doc){
  if (esS.sugerido) delete esS.sugerido[chave];
  esS.resp[chave] = (doc && Array.isArray(doc.advogados) ? doc.advogados : []).filter(function(a){ return a && a.oab; }).map(function(a){ return { oab: a.oab, nome: a.nome || '' }; });
  esS.abertoSel = '';
  if (/^(casos|termosAcordo|alvaras)$/.test(chave) && typeof rcDivIniciar === 'function') rcDivIniciar(chave, doc);   // a divisão dos honorários acompanha os advogados escolhidos
  esRespDesenhar(chave);
}
function esLista(chave){ return String(chave || '').indexOf('agenda') === 0 ? esS.equipeAg : esS.equipe; }
function esNomeChave(k){ var q = esS.equipeAg.filter(function(x){ return x.oab === k; })[0]; return q ? q.nome.replace(/ \(estagiário\)$/, '') : (k.indexOf('u:') === 0 ? 'Usuário' : k); }
function esRespNome(a){
  var q = esS.equipeAg.filter(function(x){ return x.oab === a.oab; })[0] || esS.equipe.filter(function(x){ return x.oab === a.oab; })[0];
  return (q && q.nome) || a.nome || a.oab;
}
function esRespHtml(chave){
  var l = esS.resp[chave] || [], aberto = esS.abertoSel === chave;
  var ag = String(chave).indexOf('agenda') === 0, h = '<label class="field-label">' + (ag ? 'Responsáveis' + (esS.sugerido && esS.sugerido[chave] === 'proc' ? ' <span class="pb-tg ok" style="margin-left:4px">sugeridos pelo processo</span>' : '') : 'Advogados responsáveis') + '</label><div class="es-chips">' + (l.length ? l.map(function(a){
    return '<span class="es-chip" title="OAB ' + escapeHtml(a.oab) + '">' + escapeHtml(esRespNome(a).split(' ').slice(0, 2).join(' ')) + ' <button type="button" class="es-x" data-esr="tirar" data-c="' + chave + '" data-k="' + escapeHtml(a.oab) + '" aria-label="Tirar">✕</button></span>';
  }).join('') : '<span class="es-chip es-vazio">' + (ag ? 'ninguém escolhido' : 'sem advogado definido') + '</span>') +
    '<button type="button" class="es-lk" data-esr="abrir" data-c="' + chave + '">' + (aberto ? 'Fechar lista' : (ag ? 'Adicionar responsável' : 'Adicionar advogado')) + '</button></div>';
  if (aberto) h += '<div class="es-lista">' + (esLista(chave).length ? esLista(chave).map(function(a){
    var on = l.some(function(x){ return x.oab === a.oab; });
    return '<label class="ad-it" style="border:0;padding:4px 0"><input type="checkbox" data-esr="marcar" data-c="' + chave + '" data-k="' + escapeHtml(a.oab) + '"' + (on ? ' checked' : '') + '><span class="ad-t">' + escapeHtml(a.nome) + ' <span class="saldo-data">OAB ' + escapeHtml(a.oab) + '</span></span></label>';
  }).join('') : '<div class="saldo-data">Nenhum advogado cadastrado ainda (Configurações › Usuários e Publicações).</div>') + '</div>';
  h += '<div class="saldo-data">' + (ag ? 'Quem é responsável vê este item na própria agenda.' : 'Quem está marcado vê este registro no próprio app.') + '</div>';
  return h;
}
function esRespDesenhar(chave){ var el = qs('esResp_' + chave); if (el) el.innerHTML = esRespHtml(chave); if (/^(casos|termosAcordo|alvaras)$/.test(chave) && typeof rcDivSync === 'function'){ rcDivSync(chave); rcDivDesenhar(chave); } if (chave === 'agenda' && typeof agDicasConflito === 'function') agDicasConflito(); }
function esRespLer(chave){ return esS.resp[chave] ? esS.resp[chave].map(function(a){ return { oab: a.oab, nome: esRespNome(a) }; }) : null; }
/* aplica no registro antes de gravar; devolve false (e mostra o aviso) se quem não é proprietário não escolheu ninguém */
function esRespAplicar(chave, dados, erroEl){
  if (!qs('esResp_' + chave) || !esS.resp[chave]) return true;
  var l = esRespLer(chave), E = esEsc();
  if (!l.length && esS.eu && esS.eu.papel === 'advogado'){ if (erroEl) erroEl.textContent = 'Escolha os advogados responsáveis.'; return false; }
  dados.advogados = l; return true;
}
document.addEventListener('click', function(e){
  var b = e.target.closest ? e.target.closest('[data-esr]') : null; if (!b) return;
  var a = b.getAttribute('data-esr'), c = b.getAttribute('data-c'), k = b.getAttribute('data-k');
  if (a === 'abrir'){ esS.abertoSel = esS.abertoSel === c ? '' : c; esRespDesenhar(c); }
  else if (a === 'tirar'){ esS.resp[c] = (esS.resp[c] || []).filter(function(x){ return x.oab !== k; }); if (esS.sugerido) delete esS.sugerido[c]; esRespDesenhar(c); }
});
document.addEventListener('change', function(e){
  var t = e.target; if (!t || !t.getAttribute || t.getAttribute('data-esr') !== 'marcar') return;
  var c = t.getAttribute('data-c'), k = t.getAttribute('data-k'), l = esS.resp[c] || (esS.resp[c] = []), i = l.map(function(x){ return x.oab; }).indexOf(k);
  if (t.checked && i < 0){ var q = esLista(c).filter(function(x){ return x.oab === k; })[0]; l.push({ oab: k, nome: q ? q.nome : '' }); }
  if (!t.checked && i >= 0) l.splice(i, 1);
  if (esS.sugerido) delete esS.sugerido[c];
  esRespDesenhar(c);
});
/* ---------- responsáveis da Agenda (chaves: OAB do advogado ou u:<id>) ---------- */
function esRespIniciarAg(chave, chaves, sugerido){
  esS.resp[chave] = (chaves || []).map(function(k){ return { oab: k, nome: esNomeChave(k) }; });
  esS.sugerido[chave] = sugerido || false; esS.abertoSel = '';
  esRespDesenhar(chave);
}
function esRespChaves(chave){ return (esS.resp[chave] || []).map(function(a){ return a.oab; }); }
function esMinhasChaves(){ return esS.eu ? (esS.eu.oabs || []).concat(esS.eu.id ? ['u:' + esS.eu.id] : []) : []; }

/* ---------- revisão: registros sem advogado definido ---------- */
function esAbrirRev(){
  var ov = sgMontar('overlayEsRev', 'Sem advogado definido');
  if (!ov.getAttribute('data-es')){
    ov.setAttribute('data-es', '1');
    ov.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-esv]') : null; if (b) esRevClique(b.getAttribute('data-esv'), b.getAttribute('data-k'), b); });
    ov.addEventListener('change', function(e){
      var t = e.target; if (!t || !t.getAttribute) return;
      var v = t.getAttribute('data-esv');
      if (v === 'item'){ var k = t.getAttribute('data-k'); if (t.checked) esS.rev.sel[k] = 1; else delete esS.rev.sel[k]; esRevDesenhar(); }
      else if (v === 'adv'){ var o = t.getAttribute('data-k'); if (t.checked) esS.rev.advs[o] = 1; else delete esS.rev.advs[o]; esRevDesenhar(); }
    });
  }
  esS.rev = { filtro: 'todos', sel: {}, advs: {}, ocupado: false };
  ov.classList.add('show'); qs('overlayEsRevC').innerHTML = '<div class="saldo-data">Carregando…</div>';
  esCarregarSem().then(esRevDesenhar);
}
function esRevItens(){
  var f = esS.rev.filtro, l = esS.sem ? esS.sem.itens : [];
  return f === 'todos' ? l : l.filter(function(i){ return i.colecao === f; });
}
function esRevDesenhar(){
  var el = qs('overlayEsRevC'), j = esS.sem, R = esS.rev; if (!el || !j || !R) return;
  var c = j.contagem || {}, tot = j.itens.length;
  var abas = [['todos', 'Todos', tot], ['casos', 'Iniciais', c.casos || 0], ['termosAcordo', 'Acordos', c.termosAcordo || 0], ['alvaras', 'Alvarás', c.alvaras || 0], ['processos', 'Processos', c.processos || 0]];
  var h = '<div class="pb-sec"><div class="pb-sec-t">' + tot + (tot === 1 ? ' registro esperando você' : ' registros esperando você') + '</div><div class="pb-aviso">Enquanto não houver advogado, só você (e o estagiário) vê o registro. Marque os registros, escolha os advogados e aplique.</div></div>';
  h += '<div class="es-abas">' + abas.map(function(a){ return '<button type="button" class="es-aba' + (R.filtro === a[0] ? ' on' : '') + '" data-esv="filtro" data-k="' + a[0] + '">' + a[1] + ' ' + a[2] + '</button>'; }).join('') + '</div>';
  var itens = esRevItens();
  if (!itens.length) h += '<div class="saldo-data" style="padding:10px 4px">Nada pendente aqui. 🎉</div>';
  h += itens.map(function(i){
    var k = i.colecao + '|' + i.id, sug = i.sugestao && i.sugestao.length ? '<span class="pb-tg ok" style="margin-left:6px">sugestão: ' + escapeHtml(i.sugestao.map(function(a){ return a.nome.split(' ')[0]; }).join(', ')) + '</span>' : (i.semNumero ? '<span class="pb-tg nv" style="margin-left:6px">sem nº de processo</span>' : '');
    return '<label class="ad-it es-it"><input type="checkbox" data-esv="item" data-k="' + escapeHtml(k) + '"' + (R.sel[k] ? ' checked' : '') + '><span class="ad-t"><b>' + escapeHtml(i.titulo || 'Sem nome') + '</b>' + sug + '<br><span class="saldo-data">' + escapeHtml(i.rotulo) + (i.numero ? ' · ' + escapeHtml(i.numero) : '') + (i.motivo ? ' · ' + escapeHtml(i.motivo) : '') + '</span></span></label>';
  }).join('');
  var n = Object.keys(R.sel).length;
  h += '<div class="es-aplicar"><div class="saldo-data" style="margin:0 0 6px"><b>' + n + (n === 1 ? ' selecionado' : ' selecionados') + '</b> · definir advogados:</div>' +
    (j.advogados.length ? j.advogados.map(function(a){ return '<label class="ad-it" style="border:0;padding:3px 0"><input type="checkbox" data-esv="adv" data-k="' + escapeHtml(a.oab) + '"' + (R.advs[a.oab] ? ' checked' : '') + '><span class="ad-t">' + escapeHtml(a.nome) + ' <span class="saldo-data">OAB ' + escapeHtml(a.oab) + '</span></span></label>'; }).join('') : '<div class="saldo-data">Cadastre os advogados em Configurações › Usuários / Publicações.</div>') +
    '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-esv="sugestoes">Marcar os que têm sugestão</button><button type="button" class="btn btn-primary pb-b" data-esv="aplicar"' + (R.ocupado ? ' disabled' : '') + '>Aplicar' + (n ? ' nos ' + n + ' selecionados' : '') + '</button></div></div>';
  el.innerHTML = h;
}
function esRevClique(a, k){
  var R = esS.rev; if (!R) return;
  if (a === 'filtro'){ R.filtro = k; esRevDesenhar(); }
  else if (a === 'sugestoes'){ esRevItens().forEach(function(i){ if (i.sugestao && i.sugestao.length){ R.sel[i.colecao + '|' + i.id] = 1; i.sugestao.forEach(function(s){ R.advs[s.oab] = 1; }); } }); esRevDesenhar(); }
  else if (a === 'aplicar'){
    var itens = Object.keys(R.sel).map(function(x){ var p = x.split('|'); return { colecao: p[0], id: p.slice(1).join('|') }; }), advs = Object.keys(R.advs);
    if (!itens.length){ toast('Marque ao menos um registro.'); return; }
    if (!advs.length){ toast('Escolha ao menos um advogado.'); return; }
    if (R.ocupado) return; R.ocupado = true; esRevDesenhar();
    esJson('/api/sem-advogado', 'POST', { itens: itens, advogados: advs.map(function(o){ return { oab: o }; }) }).then(function(r){
      R.ocupado = false; R.sel = {}; toast(r.alterados + (r.alterados === 1 ? ' registro atualizado.' : ' registros atualizados.'));
      var forca = window.__horusDb && window.__horusDb.recarregar; try { ['casos', 'termosAcordo', 'alvaras'].forEach(function(n){ if (forca) forca(n); }); } catch (e) {}
      esS.semEm = 0; esCarregarSem().then(esRevDesenhar); try { if (typeof prCarregar === 'function') prCarregar(); } catch (e) {}
    }).catch(function(e){ R.ocupado = false; toast('Não consegui aplicar: ' + e.message); esRevDesenhar(); });
  }
}
(function(){
  setTimeout(function(){ try { esIniciar(); } catch (e) { console.error('responsáveis', e); } }, 400);
  var st = document.createElement('style');
  st.textContent = '#esBarra{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:8px 16px 0;max-width:1180px;margin:0 auto}.es-seg{display:inline-flex;background:var(--surface-2);border-radius:12px;padding:3px}' +
    '.es-b{border:0;background:none;padding:6px 14px;border-radius:9px;font:inherit;font-weight:700;font-size:var(--t2);color:var(--ink-soft);cursor:pointer}.es-b.on{background:#0e0e10;color:#fff}' +
    '.es-aviso{font-size:var(--t2);color:var(--ink-soft)}.es-lk{border:0;background:none;color:var(--accent,#C98500);font:inherit;font-weight:700;cursor:pointer;padding:2px 6px}' +
    '.es-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0}.es-chip{display:inline-flex;align-items:center;gap:4px;background:var(--surface-2);border-radius:99px;padding:4px 6px 4px 12px;font-size:var(--t2);font-weight:700}.es-vazio{padding:4px 12px;font-weight:600;color:var(--ink-soft)}' +
    '.es-x{border:0;background:none;color:var(--ink-soft);cursor:pointer;padding:0 6px;font-size:var(--t2)}.es-lista{background:var(--surface-2);border-radius:12px;padding:6px 12px;margin:6px 0}' +
    '.es-abas{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.es-aba{border:1px solid var(--border);background:var(--surface);border-radius:99px;padding:5px 12px;font:inherit;font-size:var(--t2);font-weight:700;color:var(--ink-soft);cursor:pointer}.es-aba.on{background:#0e0e10;color:#fff;border-color:#0e0e10}' +
    '.es-it{border-top:1px solid var(--border);padding:8px 0;align-items:flex-start}.es-aplicar{margin-top:10px;border:2px solid var(--accent,#C98500);border-radius:14px;padding:10px 12px}#overlayEsRevC>*{flex-shrink:0}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { esIniciar: esIniciar, esBarra: esBarra });
})();
