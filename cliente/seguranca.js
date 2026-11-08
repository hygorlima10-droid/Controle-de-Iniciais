/* ============================================================
   LIXEIRA E REGISTRO DE AÇÕES (prefixo sg) — telas de Configurações
   - Lixeira: tudo o que se exclui no app vai para cá por 30 dias; dá para restaurar (se o registro foi recriado, pergunta antes de substituir)
   - Registro de ações: quem fez o quê, quando, e o que mudou (antes e depois); o servidor registra, as telas não precisam lembrar
   ============================================================ */
var sgS = { lix: [], filtroLix: '', menuLix: false, confirma: '', reg: [], mais: null, filtroReg: '', ocupado: false };
var SG_CAMPOS = { partes: 'Partes', nome: 'Nome', cliente: 'Cliente', orgao: 'Vara / órgão', classe: 'Classe', valor: 'Valor', valorCausa: 'Valor da causa', status: 'Situação', arquivado: 'Arquivado', telefone: 'Telefone', email: 'E-mail', obs: 'Observações', numero: 'Número', numeroProcesso: 'Processo', titulo: 'Título', data: 'Data', clienteIds: 'Clientes vinculados', area: 'Área', assunto: 'Assunto', autor: 'Autor', reu: 'Réu', apelidos: 'Outros nomes', pagador: 'Pagador', vencimento: 'Vencimento', descricao: 'Descrição', categoria: 'Categoria', concluido: 'Concluído' };
function sgDataHora(iso){
  var d = new Date(iso); if (isNaN(d)) return ''; var p = function(n){ return (n < 10 ? '0' : '') + n; }, hoje = new Date(), ontem = new Date(Date.now() - 864e5);
  var hm = p(d.getHours()) + ':' + p(d.getMinutes()), dia = d.toDateString() === hoje.toDateString() ? 'hoje' : (d.toDateString() === ontem.toDateString() ? 'ontem' : p(d.getDate()) + '/' + p(d.getMonth() + 1));
  return dia + ' ' + hm;
}
function sgDiasPara(iso){ return Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 864e5)); }
function sgMontar(id, titulo){
  if (qs(id)) return qs(id);
  var d = document.createElement('div'); d.className = 'overlay'; d.id = id;
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>' + titulo + '</h2><button class="icon-btn" type="button" data-sg="fechar" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="' + id + 'C"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-sg]') : null; if (!b) return;
    sgClique(b.getAttribute('data-sg'), b.getAttribute('data-k'), d);
  });
  d.addEventListener('change', function(e){
    var t = e.target; if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-sgf') === 'lix'){ sgS.filtroLix = t.value; sgLixDesenhar(); }
    if (t.getAttribute('data-sgf') === 'reg'){ sgS.filtroReg = t.value; sgRegCarregar(true); }
  });
  return d;
}
function sgClique(a, k, ov){
  if (a === 'fechar') ov.classList.remove('show');
  else if (a === 'menu'){ sgS.menuLix = !sgS.menuLix; sgLixDesenhar(); }
  else if (a === 'esvaziar-pede'){ sgS.menuLix = false; sgS.confirma = '__tudo'; sgLixDesenhar(); }
  else if (a === 'cancela'){ sgS.confirma = ''; sgLixDesenhar(); }
  else if (a === 'esvaziar'){ sgApi('/api/lixeira/esvaziar', 'POST', {}).then(function(){ sgS.confirma = ''; toast('Lixeira esvaziada.'); sgLixCarregar(); }).catch(function(e){ toast('Não consegui esvaziar: ' + e.message); }); }
  else if (a === 'restaurar') sgRestaurar(k, false);
  else if (a === 'substituir') sgRestaurar(k, true);
  else if (a === 'mais-reg') sgRegCarregar(false);
}
function sgApi(url, metodo, corpo){
  return fetch(url, { method: metodo || 'GET', credentials: 'same-origin', cache: 'no-store', headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined, body: corpo !== undefined ? JSON.stringify(corpo) : undefined })
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok && r.status !== 409) throw new Error((j.error && j.error.message) || ('Erro ' + r.status)); j._status = r.status; return j; }); });
}

/* ---------- Lixeira ---------- */
function sgLixAbrir(){ sgMontar('overlaySgLix', 'Lixeira'); sgS.confirma = ''; sgS.menuLix = false; sgLixCarregar(); qs('overlaySgLix').classList.add('show'); }
function sgLixCarregar(){
  qs('overlaySgLixC').innerHTML = '<div class="saldo-data">Carregando…</div>';
  return sgApi('/api/lixeira').then(function(j){ sgS.lix = j.itens || []; sgLixDesenhar(); }).catch(function(e){ qs('overlaySgLixC').innerHTML = '<div class="form-error">Não consegui abrir a lixeira: ' + escapeHtml(e.message) + '</div>'; });
}
function sgLixDesenhar(){
  var el = qs('overlaySgLixC'); if (!el) return;
  var tipos = {}; sgS.lix.forEach(function(i){ tipos[i.rotulo] = (tipos[i.rotulo] || 0) + 1; });
  var lista = sgS.lix.filter(function(i){ return !sgS.filtroLix || i.rotulo === sgS.filtroLix; });
  var h = '<div class="pb-sec"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><div class="pb-sec-t">Lixeira</div><div class="pb-aviso">' + sgS.lix.length + (sgS.lix.length === 1 ? ' item' : ' itens') + '. Cada um some sozinho depois de 30 dias.</div></div>' +
    '<button type="button" class="btn btn-ghost pb-funil' + (sgS.menuLix ? ' ativo' : '') + '" data-sg="menu" aria-label="Mais opções" title="Mais opções"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div>' +
    (sgS.menuLix ? '<div class="pb-painel pb-menu"><button type="button" class="pb-mi" data-sg="esvaziar-pede"><span class="pb-mi-i">🗑</span>Esvaziar a lixeira<small>apaga tudo de uma vez, sem volta</small></button></div>' : '') +
    (sgS.confirma === '__tudo' ? '<div class="pb-aviso" style="margin-top:8px"><b>Apagar de vez os ' + sgS.lix.length + ' itens?</b> Depois disso não dá para restaurar.</div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-sg="cancela">Cancelar</button><button type="button" class="btn btn-primary pb-b" data-sg="esvaziar">Apagar de vez</button></div>' : '') + '</div>';
  if (Object.keys(tipos).length > 1) h += '<div class="field"><label class="field-label" for="sgFLix">Tipo</label><select id="sgFLix" class="filter-select" data-sgf="lix" style="width:100%"><option value="">Todos (' + sgS.lix.length + ')</option>' + Object.keys(tipos).sort().map(function(t){ return '<option value="' + escapeHtml(t) + '"' + (sgS.filtroLix === t ? ' selected' : '') + '>' + escapeHtml(t) + ' (' + tipos[t] + ')</option>'; }).join('') + '</select></div>';
  if (!lista.length) h += '<div class="financeiro-vazio">' + (sgS.lix.length ? 'Nada com esse filtro.' : 'A lixeira está vazia. O que você excluir no app aparece aqui por 30 dias.') + '</div>';
  h += lista.map(function(i){
    var conf = sgS.confirma === i.chave;
    return '<div class="pb-card" style="--pb-bar:#8A93AD"><div class="pb-l1"><span>' + escapeHtml(i.rotulo) + '</span><span class="pb-tipo">some em ' + sgDiasPara(i.expira) + ' dias</span></div><div class="pb-cli">' + escapeHtml(i.titulo) + '</div><div class="pb-proc">excluído por ' + escapeHtml(i.por || 'você').toLowerCase() + ' em ' + escapeHtml(sgDataHora(i.em)) + '</div>' +
      (conf ? '<div class="pb-aviso" style="margin-top:8px">Já existe um registro com este identificador (foi recriado depois de excluído). <b>Restaurar substitui o que existe agora.</b></div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-sg="cancela">Cancelar</button><button type="button" class="btn btn-primary pb-b" data-sg="substituir" data-k="' + escapeHtml(i.chave) + '">Restaurar e substituir</button></div>'
        : '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-sg="restaurar" data-k="' + escapeHtml(i.chave) + '">Restaurar</button></div>') + '</div>';
  }).join('');
  el.innerHTML = h;
}
function sgRestaurar(chave, substituir){
  if (sgS.ocupado) return; sgS.ocupado = true;
  sgApi('/api/lixeira/restaurar', 'POST', { chave: chave, substituir: !!substituir }).then(function(j){
    sgS.ocupado = false;
    if (j._status === 409){ sgS.confirma = chave; sgLixDesenhar(); return; }
    toast('Restaurado. Atualizando o app…'); setTimeout(function(){ location.reload(); }, 900);
  }).catch(function(e){ sgS.ocupado = false; toast('Não consegui restaurar: ' + e.message); sgLixCarregar(); });
}

/* ---------- Registro de ações ---------- */
var SG_OP = { criou: ['criou', 'ok'], alterou: ['alterou', 'nv'], excluiu: ['excluiu', ''], restaurou: ['restaurou', 'ok'], leitura: ['leitura', ''], esvaziou: ['esvaziou', ''] };
function sgRegAbrir(){ sgMontar('overlaySgReg', 'Registro de ações'); sgS.filtroReg = ''; sgRegCarregar(true); qs('overlaySgReg').classList.add('show'); }
function sgRegCarregar(reinicia){
  if (reinicia){ sgS.reg = []; sgS.mais = null; qs('overlaySgRegC').innerHTML = '<div class="saldo-data">Carregando…</div>'; }
  var q = '/api/auditoria?limite=40' + (!reinicia && sgS.mais ? '&antes=' + encodeURIComponent(sgS.mais) : '') + (sgS.filtroReg ? '&colecao=' + encodeURIComponent(sgS.filtroReg) : '');
  return sgApi(q).then(function(j){ sgS.reg = sgS.reg.concat(j.itens || []); sgS.mais = j.mais; sgRegDesenhar(); }).catch(function(e){ qs('overlaySgRegC').innerHTML = '<div class="form-error">Não consegui abrir o registro: ' + escapeHtml(e.message) + '</div>'; });
}
function sgValor(v){ return v === '' || v == null ? '(vazio)' : String(v); }
function sgRegDesenhar(){
  var el = qs('overlaySgRegC'); if (!el) return;
  var tipos = [['', 'Tudo'], ['processos', 'Processos'], ['clientes', 'Clientes'], ['casos', 'Iniciais'], ['termosAcordo', 'Acordos'], ['alvaras', 'Alvarás'], ['agenda', 'Agenda'], ['despesas', 'Despesas'], ['receitasManuais', 'Receitas'], ['metas', 'Metas'], ['obraMov', 'Obra']];
  var h = '<div class="field"><label class="field-label" for="sgFReg">Tipo</label><select id="sgFReg" class="filter-select" data-sgf="reg" style="width:100%">' + tipos.map(function(t){ return '<option value="' + t[0] + '"' + (sgS.filtroReg === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></div>';
  if (!sgS.reg.length) h += '<div class="financeiro-vazio">Nenhuma ação registrada ainda.</div>';
  h += sgS.reg.map(function(x){
    var op = SG_OP[x.op] || [x.op, ''], mud = (x.mud || []).slice(0, 6).map(function(m){
      return '<div class="pb-lin"><span><b style="color:var(--ink)">' + escapeHtml(SG_CAMPOS[m.c] || m.c) + '</b><br><span class="saldo-data">' + (m.lista ? escapeHtml(sgValor(m.a)) + ' → ' + escapeHtml(sgValor(m.d)) : '<s>' + escapeHtml(sgValor(m.a)) + '</s> → <b style="color:var(--ink)">' + escapeHtml(sgValor(m.d)) + '</b>') + '</span></span></div>';
    }).join('');
    return '<div class="pb-card" style="--pb-bar:#8A93AD"><div class="pb-l1"><span>' + escapeHtml(sgDataHora(x.em)) + ' · ' + escapeHtml(x.por || '') + '</span><span class="pb-tg ' + op[1] + '">' + escapeHtml(op[0]) + '</span></div><div class="pb-cli">' + escapeHtml((x.rotulo ? x.rotulo + ' · ' : '') + (x.titulo || '')) + '</div>' + mud + '</div>';
  }).join('');
  if (sgS.mais) h += '<button type="button" class="btn btn-ghost" data-sg="mais-reg" style="width:100%;justify-content:center;">Mostrar mais</button>';
  h += '<div class="pb-aviso" style="margin:8px 4px">O servidor guarda quem fez, quando e o que mudou. Ninguém consegue apagar nem editar este registro pelo app. Fica guardado por 1 ano.</div>';
  el.innerHTML = h;
}
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { sgLixAbrir: sgLixAbrir, sgRegAbrir: sgRegAbrir }); })();
