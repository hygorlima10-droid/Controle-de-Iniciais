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
    if (t.getAttribute('data-sgf') === 'pes'){ sgS.filtroPes = t.value; sgRegCarregar(true); }
    if (t.getAttribute('data-sgf') === 'per'){ sgS.filtroPer = t.value; sgRegCarregar(true); }
    if (t.getAttribute('data-sgf') === 'alertas') sgSegAlertas(t.checked);
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
  else if (a === 'seg-encerrar') sgSegEncerrar(k);
  else if (a === 'seg-outras-pede'){ sgS.segConfirma = true; sgSegDesenhar(); }
  else if (a === 'seg-cancela'){ sgS.segConfirma = false; sgSegDesenhar(); }
  else if (a === 'seg-outras') sgSegEncerrar('');
  else if (a === 'seg-senha') sgSegSenha();
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
var SG_OP = { criou: ['criou', 'ok'], alterou: ['alterou', 'nv'], excluiu: ['excluiu', ''], restaurou: ['restaurou', 'ok'], leitura: ['leitura', ''], esvaziou: ['esvaziou', ''], entrou: ['entrou', 'ok'], saiu: ['saiu', ''], falhou: ['falhou', 'pz'], encerrou: ['encerrou', 'nv'] };
function sgRegAbrir(){ sgMontar('overlaySgReg', 'Registro de ações'); sgS.filtroReg = ''; sgS.filtroPes = ''; sgS.filtroPer = ''; sgRegCarregar(true); qs('overlaySgReg').classList.add('show'); }
/* período do filtro do Registro → de/ate (AAAAMMDD, horário de Brasília) */
function sgPeriodoQuery(p){
  if (!p) return '';
  var f = function(d){ return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }, hoje = new Date(), ini = new Date(Date.now() - (p === 'hoje' ? 0 : Number(p)) * 864e5);
  return '&de=' + f(ini) + '&ate=' + f(hoje);
}
function sgRegCarregar(reinicia){
  if (reinicia){ sgS.reg = []; sgS.mais = null; qs('overlaySgRegC').innerHTML = '<div class="saldo-data">Carregando…</div>'; }
  var q = '/api/auditoria?limite=40' + (!reinicia && sgS.mais ? '&antes=' + encodeURIComponent(sgS.mais) : '') + (sgS.filtroReg ? '&colecao=' + encodeURIComponent(sgS.filtroReg) : '') + (sgS.filtroPes ? '&por=' + encodeURIComponent(sgS.filtroPes) : '') + sgPeriodoQuery(sgS.filtroPer);
  return sgApi(q).then(function(j){ sgS.reg = sgS.reg.concat(j.itens || []); sgS.mais = j.mais; if (j.pessoas) sgS.pessoas = j.pessoas; sgRegDesenhar(); }).catch(function(e){ qs('overlaySgRegC').innerHTML = '<div class="form-error">Não consegui abrir o registro: ' + escapeHtml(e.message) + '</div>'; });
}
function sgValor(v){ return v === '' || v == null ? '(vazio)' : String(v); }
function sgRegDesenhar(){
  var el = qs('overlaySgRegC'); if (!el) return;
  var tipos = [['', 'Tudo'], ['processos', 'Processos'], ['clientes', 'Clientes'], ['casos', 'Iniciais'], ['termosAcordo', 'Acordos'], ['alvaras', 'Alvarás'], ['agenda', 'Agenda'], ['despesas', 'Despesas'], ['receitasManuais', 'Receitas'], ['metas', 'Metas'], ['obraMov', 'Obra'], ['acesso', 'Acessos']];
  var pessoas = sgS.pessoas || [], periodos = [['', 'Todo o período'], ['hoje', 'Hoje'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias']];
  var h = '<div class="field"><label class="field-label" for="sgFPes">Pessoa</label><select id="sgFPes" class="filter-select" data-sgf="pes" style="width:100%"><option value="">Todas</option>' + pessoas.map(function(n){ return '<option value="' + escapeHtml(n) + '"' + (sgS.filtroPes === n ? ' selected' : '') + '>' + escapeHtml(n) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label class="field-label" for="sgFPer">Período</label><select id="sgFPer" class="filter-select" data-sgf="per" style="width:100%">' + periodos.map(function(x){ return '<option value="' + x[0] + '"' + ((sgS.filtroPer || '') === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label class="field-label" for="sgFReg">Tipo</label><select id="sgFReg" class="filter-select" data-sgf="reg" style="width:100%">' + tipos.map(function(t){ return '<option value="' + t[0] + '"' + (sgS.filtroReg === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></div>';
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
/* ---------- Segurança: sessões abertas, trocar a senha, avisos ---------- */
function sgSegAbrir(){ sgMontar('overlaySgSeg', 'Segurança'); sgS.segConfirma = false; sgS.segMsg = ''; sgSegCarregar(); qs('overlaySgSeg').classList.add('show'); }
function sgSegCarregar(){
  qs('overlaySgSegC').innerHTML = '<div class="saldo-data">Carregando…</div>';
  return sgApi('/api/seguranca/sessoes').then(function(j){ sgS.seg = j; sgSegDesenhar(); }).catch(function(e){
    qs('overlaySgSegC').innerHTML = '<div class="pb-aviso">' + (/individual|404/.test(e.message) ? 'Esta tela fica disponível quando o acesso individual (e-mail e senha) está ativo.' : 'Não consegui abrir: ' + escapeHtml(e.message)) + '</div>';
  });
}
function sgSegIcone(rotulo){ return /iPhone|iPad|Android/.test(rotulo || '') ? '📱' : '💻'; }
function sgSegDesenhar(){
  var el = qs('overlaySgSegC'), j = sgS.seg; if (!el || !j) return;
  var h = '<div class="pb-sec"><div class="pb-sec-t">Sessões abertas</div><div class="pb-aviso">Cada aparelho em que você entrou. Encerrar faz o aparelho perder o acesso na hora.</div></div>';
  h += j.sessoes.map(function(s){
    return '<div class="pb-card" style="--pb-bar:#8A93AD" data-sess="' + escapeHtml(s.id) + '"><div class="pb-l1"><span>' + sgSegIcone(s.rotulo) + ' ' + escapeHtml(s.rotulo) + '</span>' + (s.atual ? '<span class="pb-tg ok">este aparelho</span>' : '') + '</div>' +
      '<div class="pb-proc">' + (s.lugar ? escapeHtml(s.lugar) + ' · ' : '') + 'último uso ' + escapeHtml(sgDataHora(s.ultimo)) + '</div>' +
      (s.atual ? '' : '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-sg="seg-encerrar" data-k="' + escapeHtml(s.id) + '">Encerrar</button></div>') + '</div>';
  }).join('');
  var outras = j.sessoes.filter(function(s){ return !s.atual; }).length;
  if (outras) h += sgS.segConfirma ? '<div class="pb-aviso" style="margin:6px 4px"><b>Encerrar as ' + outras + ' outras sessões?</b> Cada aparelho terá de entrar de novo.</div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-sg="seg-cancela">Cancelar</button><button type="button" class="btn btn-primary pb-b" data-sg="seg-outras">Encerrar todas as outras</button></div>'
    : '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-sg="seg-outras-pede">Encerrar todas as outras</button></div>';
  h += '<div class="pb-sec" style="margin-top:14px"><div class="pb-sec-t">Alterar a senha</div></div>' +
    '<div class="field"><label class="field-label" for="sgSegAtual">Senha atual</label><input type="password" id="sgSegAtual" autocomplete="current-password"></div>' +
    '<div class="field"><label class="field-label" for="sgSegNova">Nova senha (mínimo 12 caracteres)</label><input type="password" id="sgSegNova" autocomplete="new-password"></div>' +
    '<div class="field"><label class="field-label" for="sgSegNova2">Repita a nova senha</label><input type="password" id="sgSegNova2" autocomplete="new-password"></div>' +
    (sgS.segMsg ? '<div class="' + (sgS.segOk ? 'pb-aviso' : 'form-error') + '" id="sgSegMsg">' + escapeHtml(sgS.segMsg) + '</div>' : '') +
    '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-sg="seg-senha">Salvar nova senha</button></div><div class="pb-aviso" style="margin:6px 4px">Ao trocar, as outras sessões são encerradas.</div>' +
    '<div class="field" style="margin-top:14px"><label class="ad-it" style="border:0;padding:4px 0;"><input type="checkbox" data-sgf="alertas" id="sgSegAlertas"' + (j.usuario.alertas ? ' checked' : '') + '><span class="ad-t">Avisar no iPhone: senha errada repetida ou entrada em aparelho novo</span></label></div>' +
    '<div class="pb-aviso" style="margin:6px 4px">Conectado como ' + escapeHtml(j.usuario.nome) + ' (' + escapeHtml(j.usuario.email) + '). <a href="/sair" style="font-weight:700;color:inherit">Sair deste aparelho</a></div>';
  el.innerHTML = h;
}
function sgSegEncerrar(id){
  if (sgS.ocupado) return; sgS.ocupado = true;
  sgApi(id ? '/api/seguranca/sessoes/' + encodeURIComponent(id) : '/api/seguranca/sessoes/encerrar-outras', id ? 'DELETE' : 'POST', id ? undefined : {}).then(function(){
    sgS.ocupado = false; sgS.segConfirma = false; toast(id ? 'Sessão encerrada.' : 'As outras sessões foram encerradas.'); sgSegCarregar();
  }).catch(function(e){ sgS.ocupado = false; toast('Não consegui encerrar: ' + e.message); });
}
function sgSegSenha(){
  var a = qs('sgSegAtual').value, n = qs('sgSegNova').value, n2 = qs('sgSegNova2').value;
  var fim = function(ok, msg){ sgS.segOk = ok; sgS.segMsg = msg; sgSegDesenhar(); };
  if (!a || !n) return fim(false, 'Preencha a senha atual e a nova.');
  if (n !== n2) return fim(false, 'As duas senhas novas não são iguais.');
  if (n.length < 12) return fim(false, 'A senha nova precisa ter pelo menos 12 caracteres.');
  if (sgS.ocupado) return; sgS.ocupado = true;
  sgApi('/api/seguranca/senha', 'PUT', { atual: a, nova: n }).then(function(){ sgS.ocupado = false; fim(true, 'Senha trocada. As outras sessões foram encerradas.'); sgSegCarregar().then(function(){ sgS.segMsg = ''; }); })
    .catch(function(e){ sgS.ocupado = false; fim(false, e.message); });
}
function sgSegAlertas(ativo){ sgApi('/api/seguranca/alertas', 'PUT', { ativo: !!ativo }).then(function(){ toast(ativo ? 'Avisos ligados.' : 'Avisos desligados.'); }).catch(function(e){ toast('Não consegui salvar: ' + e.message); }); }
/* quem está usando: o que é só do proprietário some da tela dos demais (nesta fase só existe o proprietário; a regra já fica pronta para os outros perfis).
   No Início, quem não é o proprietário vê só a Central de atenção (o que vence, para cobrar) e os prazos: sem o total recebido, o a receber, o vencido, a divisão do mês, os extratos e as ferramentas Recebi R$, Foto/PDF e Pergunte. */
(function(){
  var st = document.createElement('style');
  st.textContent = '.so-central .ini-hero,.so-central .ini-kpi,.so-central #toggleOrigemResumo,.so-central #resumoOrigem,.so-central #acRecebi,.so-central #inicioLerDoc,.so-central #inicioPergunte,.so-central .ini-divisao,.so-central .ini-extratos{display:none!important}';
  document.head.appendChild(st);
  if (window.__SERVIDOR) fetch('/api/eu', { credentials: 'same-origin', cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
    window.__papel = (j && j.papel) || 'proprietario';
    document.documentElement.classList.toggle('so-central', window.__papel !== 'proprietario');
  }).catch(function(){});
})();
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { sgLixAbrir: sgLixAbrir, sgRegAbrir: sgRegAbrir, sgSegAbrir: sgSegAbrir }); })();
