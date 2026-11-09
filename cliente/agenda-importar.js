/* ============================================================
   IMPORTAR COMPROMISSOS DA AGENDA POR ARQUIVO (prefixo agi)
   - lê o XML de "Agenda" do Control Jus (um ou vários arquivos), mostra tudo para conferir e só então grava
   - cada compromisso vira um item da Agenda com a data, a hora, o tipo, o título e as observações exatamente como vieram
   - o número do processo (campo "processo vinculado" ou escrito na observação) liga ao processo cadastrado; processo novo é cadastrado (e vai para Revisar se faltar cliente)
   - os participantes que são da equipe (Estagiários, Murilo, Hygor e as OABs cadastradas) viram "responsáveis"; os demais são as partes/clientes
   - importar de novo o mesmo arquivo não duplica (cada compromisso tem uma marca: data + título + processo)
   ============================================================ */
var agiS = { fase: 'escolher', arquivos: [], itens: [], nomes: {}, decisao: {}, cadProc: true, erro: '', ocupado: false, res: null };
var AGI_EQUIPE = ['Estagiários', 'Estagiarios', 'Estagiário', 'Hygor Lima Andrade', 'Murilo Falone Rocha'];
var AGI_NUM = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;

/* ---------- ler o XML ---------- */
function agiTxt(el, tag){ var x = el.getElementsByTagName(tag)[0]; return x ? String(x.textContent || '').trim() : ''; }
function agiDataHora(s){   /* "17/12/2026 15:30:00" → { data: '2026-12-17', hora: '15:30' } */
  var m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(String(s || '').trim()); if (!m) return { data: '', hora: '' };
  return { data: m[3] + '-' + m[2] + '-' + m[1], hora: m[4] ? m[4] + ':' + m[5] : '' };
}
function agiHoraDoTitulo(t){ var m = /(?:^|[^\d])([01]?\d|2[0-3])\s*(?::|h)\s*([0-5]\d)(?!\d)/i.exec(String(t || '')); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : ''; }
function agiLerXml(texto, nomeArquivo){
  var doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || !doc.documentElement || doc.documentElement.nodeName !== 'compromissos') throw new Error('“' + nomeArquivo + '” não parece uma agenda exportada do Control Jus (XML de compromissos).');
  var out = [], els = doc.getElementsByTagName('compromisso');
  for (var i = 0; i < els.length; i++){
    var c = els[i], ini = agiDataHora(agiTxt(c, 'dataHoraInicio')), fim = agiDataHora(agiTxt(c, 'dataHoraTermino')), titulo = agiTxt(c, 'titulo'), tipoTxt = agiTxt(c, 'tipo');
    if (!ini.data) continue;
    var procs = [], ps = c.getElementsByTagName('processo');
    for (var j = 0; j < ps.length; j++){ var t = agiTxt(ps[j], 'titulo'), id = agiTxt(ps[j], 'identificador'), org = agiTxt(ps[j], 'orgao'); if (t) procs.push({ numero: t, codigo: id, orgao: org }); }
    var obs = agiTxt(c, 'observacoes'), numObs = (AGI_NUM.exec(obs) || [])[0] || '';
    var parts = [], pe = c.getElementsByTagName('participante');
    for (var k = 0; k < pe.length; k++){ var nm = String(pe[k].textContent || '').replace(/\s+/g, ' ').trim(); if (nm) parts.push(nm); }
    var diaInteiro = /^s/i.test(agiTxt(c, 'diaInteiro')), horaTit = agiHoraDoTitulo(titulo), horaArq = diaInteiro ? '' : ini.hora;
    var tipo = /^prazo/i.test(tipoTxt) ? 'prazo' : (/^audi/i.test(tipoTxt) ? 'audiencia' : 'tarefa');
    out.push({
      titulo: titulo, tipo: tipo, tipoOriginal: tipoTxt, data: ini.data, dataFim: fim.data, diaInteiro: diaInteiro, horaArq: horaArq, horaTit: horaTit, horaFim: diaInteiro ? '' : fim.hora,
      horaEscolha: horaArq ? 'arquivo' : 'titulo', concluido: /^concl/i.test(agiTxt(c, 'status')), subtipo: agiTxt(c, 'subtipo'), prioridade: agiTxt(c, 'prioridade'), obs: obs,
      processo: procs.length ? procs[0].numero : numObs, processoDe: procs.length ? 'vinculado' : (numObs ? 'observacao' : ''), codigoProc: procs.length ? procs[0].codigo : '', orgao: procs.length ? procs[0].orgao : '',
      participantes: parts, arquivo: nomeArquivo
    });
  }
  return out;
}

/* ---------- equipe x partes ---------- */
function agiEquipeNomes(){
  var l = AGI_EQUIPE.slice(); (typeof pbS !== 'undefined' && pbS.oabs ? pbS.oabs : []).forEach(function(o){ if (o.nome) l.push(o.nome); }); return l;
}
function agiEhEquipe(nome){
  var a = cliTokens(nome); if (!a.length) return false;
  return agiEquipeNomes().some(function(e){
    var b = cliTokens(e); if (!b.length) return false;
    var sa = {}, sb = {}; a.forEach(function(t){ sa[t] = 1; }); b.forEach(function(t){ sb[t] = 1; });
    var ua = Object.keys(sa), ub = Object.keys(sb), comum = ua.filter(function(t){ return sb[t]; }).length;
    return comum === ub.length || comum === ua.length;   /* um nome contém o outro (ex.: "MURILO FALONE ROCHA" e "Murilo Falone") */
  });
}
function agiClassificar(it){
  var resp = [], partes = [], vistos = {};
  it.participantes.forEach(function(n){ var k = normNome(n); if (vistos[k]) return; vistos[k] = 1; (agiEhEquipe(n) ? resp : partes).push(n); });
  it.responsaveis = resp; it.partes = partes;
}

/* ---------- marca do compromisso (para não duplicar) ---------- */
function agiMarca(it){ return it.data + '|' + normNome(it.titulo) + '|' + (prNum(it.processo) || ''); }
function agiHash(s){ var h1 = 5381, h2 = 52711; for (var i = 0; i < s.length; i++){ var c = s.charCodeAt(i); h1 = ((h1 * 33) ^ c) >>> 0; h2 = ((h2 * 31) + c) >>> 0; } return h1.toString(36) + h2.toString(36); }
function agiId(it){ return 'x' + agiHash(agiMarca(it)); }
function agiJaExiste(it){
  var marca = agiMarca(it), id = agiId(it), num = prNum(it.processo), tn = normNome(it.titulo);
  for (var i = 0; i < agDocs.length; i++){
    var d = agDocs[i]; if (d.id === id || d.importKey === marca) return 'igual';
  }
  for (var j = 0; j < agDocs.length; j++){
    var d2 = agDocs[j]; if (d2.data !== it.data || (d2.tipo || 'prazo') !== it.tipo) continue;
    if (num && prNum(d2.processo) === num) return 'parecido';
    if (!num && normNome(d2.titulo) === tn) return 'parecido';
  }
  return '';
}

/* ---------- reconhecer cliente e processo ---------- */
function agiAudTipo(t){ var n = normNome(t); return /concilia/.test(n) ? 'Conciliação' : /media/.test(n) ? 'Mediação' : /instru/.test(n) ? 'Instrução e julgamento' : /justifica/.test(n) ? 'Justificação' : /saneamento/.test(n) ? 'Saneamento' : /custodia/.test(n) ? 'Custódia' : /admonit/.test(n) ? 'Admonitória' : 'Outra'; }
function agiNomeDoProcesso(it){ return prNum(it.processo); }
function agiPreparar(){
  var nomes = {};
  agiS.itens.forEach(function(it){
    agiClassificar(it);
    it.jaExiste = agiJaExiste(it);
    it.sel = it.jaExiste !== 'igual' && it.jaExiste !== 'parecido';
    it.num = agiNomeDoProcesso(it);
    var m = it.num ? prMapa().m[it.num] : null; it.procExiste = !!(m && (m.doc || (m.links && m.links.length)));
    it.partes.forEach(function(n){
      var k = normNome(n); if (!nomes[k]) nomes[k] = { nome: n, itens: 0, cand: null, nivel: 0, ligado: null };
      nomes[k].itens++;
    });
  });
  var chaves = Object.keys(nomes);
  chaves.forEach(function(k){
    var x = nomes[k], cs = cliParecidos(x.nome); x.cands = cs.slice(0, 4);
    if (cs.length){
      x.nivel = cs[0].nivel; x.cand = cs[0].c;
      var iguais = cs.filter(function(y){ return y.nivel === 3; }).length, mesmoNivel = cs.filter(function(y){ return y.nivel >= cs[0].nivel; }).length;
      x.seguro = cs[0].nivel === 3 && iguais === 1;                                          /* um só cliente com exatamente esse nome (ou apelido) */
      x.auto = !x.seguro && cs[0].nivel >= 2 && cs[0].c.vinculoAuto === true && mesmoNivel === 1;   /* abreviação do nome de um cliente marcado como "vincular sozinho" (mesma regra da importação do Diário Oficial) */
    }
    /* outros nomes deste mesmo arquivo que parecem ser a mesma pessoa */
    x.irmaos = chaves.filter(function(o){ return o !== k && cliNivel(x.nome, nomes[o].nome) >= 2; });
    var atual = agiS.decisao[k];
    if (!atual) agiS.decisao[k] = (x.seguro || x.auto) ? 'c:' + x.cand.id : (x.cand ? 'sem' : 'novo');   /* parecido, mas não igual: não liga nem cria sozinho; você escolhe */
  });
  agiS.nomes = nomes;
}

/* ---------- escolher e ler os arquivos ---------- */
function agiAbrir(){
  agiMontar();
  agiS = { fase: 'escolher', arquivos: [], itens: [], nomes: {}, decisao: {}, cadProc: true, erro: '', ocupado: false, res: null };
  agiDesenhar(); qs('overlayAgi').classList.add('show');
}
function agiMontar(){
  if (qs('overlayAgi')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayAgi';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Importar compromissos</h2><button class="icon-btn" type="button" data-agi="fechar" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="agiC"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-agi]') : null; if (!b) return;
    agiClique(b.getAttribute('data-agi'), b.getAttribute('data-k'));
  });
  d.addEventListener('change', function(e){
    var t = e.target; if (!t || !t.getAttribute) return;
    var a = t.getAttribute('data-agi');
    if (a === 'arquivos') agiLerArquivos(t.files);
    else if (a === 'sel'){ var it = agiS.itens[Number(t.getAttribute('data-k'))]; if (it) it.sel = t.checked; agiDesenhar(); }
    else if (a === 'decisao'){ agiS.decisao[t.getAttribute('data-k')] = t.value; agiDesenhar(); }
    else if (a === 'cadproc'){ agiS.cadProc = t.checked; agiDesenhar(); }
    else if (a === 'hora'){ var i2 = agiS.itens[Number(t.getAttribute('data-k'))]; if (i2) i2.horaEscolha = t.value; agiDesenhar(); }
  });
}
function agiClique(a, k){
  if (a === 'fechar') qs('overlayAgi').classList.remove('show');
  else if (a === 'escolher'){ var f = qs('agiArq'); if (f) f.click(); }
  else if (a === 'voltar'){ agiS.fase = 'escolher'; agiS.itens = []; agiS.arquivos = []; agiS.erro = ''; agiDesenhar(); }
  else if (a === 'importar') agiImportar();
  else if (a === 'agenda'){ qs('overlayAgi').classList.remove('show'); }
  else if (a === 'todos'){ agiS.itens.forEach(function(it){ if (it.jaExiste !== 'igual') it.sel = true; }); agiDesenhar(); }
  else if (a === 'nenhum'){ agiS.itens.forEach(function(it){ it.sel = false; }); agiDesenhar(); }
}
function agiLerArquivos(files){
  agiS.erro = ''; var lista = Array.prototype.slice.call(files || []); if (!lista.length) return;
  var ps = lista.map(function(f){
    if (/\.pdf$/i.test(f.name)) return Promise.reject(new Error('“' + f.name + '” é PDF. Por enquanto a importação lê só o XML (é mais exato). Exporte a agenda em XML no Control Jus.'));
    if (f.size > 3 * 1024 * 1024) return Promise.reject(new Error('“' + f.name + '” é grande demais para uma agenda (limite de 3 MB).'));
    return f.text().then(function(t){ return { nome: f.name, itens: agiLerXml(t, f.name) }; });
  });
  Promise.all(ps).then(function(r){
    var itens = [], vistos = {}, repetidos = 0;
    r.forEach(function(a){ a.itens.forEach(function(it){ var m = agiMarca(it); if (vistos[m]){ repetidos++; return; } vistos[m] = 1; itens.push(it); }); });
    if (!itens.length) throw new Error('Nenhum compromisso encontrado nos arquivos.');
    if (itens.length > 400) throw new Error('São ' + itens.length + ' compromissos; importe em partes (limite de 400 por vez).');
    itens.sort(function(a, b){ return a.data.localeCompare(b.data) || (a.horaArq || a.horaTit).localeCompare(b.horaArq || b.horaTit); });
    agiS.arquivos = r.map(function(a){ return { nome: a.nome, n: a.itens.length }; }); agiS.itens = itens; agiS.repetidos = repetidos; agiS.decisao = {};
    agiPreparar(); agiS.fase = 'conferir'; agiDesenhar();
  }).catch(function(e){ agiS.erro = e.message || String(e); agiDesenhar(); });
}

/* ---------- telas ---------- */
function agiHoraFinal(it){ return it.horaEscolha === 'titulo' ? it.horaTit : (it.horaArq || it.horaTit); }
function agiTg(t, c){ return '<span class="pb-tg ' + (c || '') + '">' + escapeHtml(t) + '</span>'; }
function agiResumoSelecao(){
  var sel = agiS.itens.filter(function(i){ return i.sel; }); return { n: sel.length, novos: sel.filter(function(i){ return i.num && !i.procExiste; }).map(function(i){ return i.num; }).filter(function(n, p, a){ return a.indexOf(n) === p; }).length };
}
function agiDesenhar(){
  var el = qs('agiC'); if (!el) return;
  var h = '';
  if (agiS.fase === 'escolher'){
    h += '<div class="pb-aviso" style="margin:2px 4px 10px">Escolha o arquivo XML da agenda do Control Jus (pode escolher vários de uma vez). Nada é gravado agora: primeiro você confere tudo.</div>';
    h += '<input type="file" id="agiArq" data-agi="arquivos" accept=".xml,text/xml,application/xml" multiple style="display:none">';
    h += '<button type="button" class="btn btn-primary" data-agi="escolher" style="width:100%;justify-content:center;">Escolher arquivo XML</button>';
    if (agiS.erro) h += '<div class="form-error" style="margin-top:10px">' + escapeHtml(agiS.erro) + '</div>';
  } else if (agiS.fase === 'conferir'){
    var rs = agiResumoSelecao(), por = {}; agiS.itens.forEach(function(i){ por[i.tipo] = (por[i.tipo] || 0) + 1; });
    h += '<div class="pb-sec"><div class="pb-sec-t">' + agiS.itens.length + ' compromissos encontrados</div><div class="pb-aviso">' + agiS.arquivos.map(function(a){ return escapeHtml(a.nome) + ' (' + a.n + ')'; }).join(' · ') + '. ' + (por.prazo || 0) + ' prazos, ' + (por.audiencia || 0) + ' audiências, ' + (por.tarefa || 0) + ' tarefas.' + (agiS.repetidos ? ' ' + agiS.repetidos + ' repetido(s) entre os arquivos foram juntados.' : '') + '</div></div>';
    /* clientes */
    var ks = Object.keys(agiS.nomes).sort(function(a, b){ return agiS.nomes[a].nome.localeCompare(agiS.nomes[b].nome, 'pt-BR'); });
    if (ks.length){
      h += '<div class="pb-sec" style="margin-top:8px"><div class="pb-sec-t">Clientes e partes (' + ks.length + ')</div><div class="pb-aviso">Equipe (Estagiários, Hygor, Murilo…) fica como responsável e não entra aqui. Confira o que fazer com cada nome:</div></div>';
      h += ks.map(function(k){
        var x = agiS.nomes[k], v = agiS.decisao[k] || 'sem', ops = '';
        (x.cands || []).forEach(function(m){ ops += '<option value="c:' + escapeHtml(m.c.id) + '"' + (v === 'c:' + m.c.id ? ' selected' : '') + '>' + (m.nivel === 3 ? 'Cliente cadastrado: ' : 'Ligar a: ') + escapeHtml(m.c.nome) + (m.nivel === 3 ? '' : (m.nivel === 2 ? ' (nome mais curto ou mais longo)' : ' (parecido)')) + '</option>'; });
        ops += '<option value="novo"' + (v === 'novo' ? ' selected' : '') + '>Cadastrar como cliente novo</option>';
        (x.irmaos || []).forEach(function(o){ ops += '<option value="m:' + escapeHtml(o) + '"' + (v === 'm:' + o ? ' selected' : '') + '>Mesmo cliente que: ' + escapeHtml(agiS.nomes[o].nome) + '</option>'; });
        ops += '<option value="sem"' + (v === 'sem' ? ' selected' : '') + '>Sem cliente (só o texto)</option>';
        return '<div class="pb-card" style="--pb-bar:' + (x.seguro ? '#1BAF7A' : (x.cand ? '#C98500' : '#8A93AD') + ';padding:8px 11px') + '"><div class="pb-l1"><span>' + escapeHtml(x.nome) + '</span><span class="pb-tipo">' + x.itens + (x.itens === 1 ? ' compromisso' : ' compromissos') + '</span></div>' +
          '<select class="filter-select" data-agi="decisao" data-k="' + escapeHtml(k) + '" style="width:100%;margin-top:4px;padding:6px 8px;font-size:13px">' + ops + '</select>' + (x.cand && !x.seguro && !x.auto ? '<div class="pb-aviso" style="margin-top:4px">Nome parecido com um cliente cadastrado, mas não igual: confirme se é o mesmo antes de ligar.</div>' : '') + (x.auto ? '<div class="pb-aviso" style="margin-top:4px">Ligado sozinho: o cliente está marcado para vincular automaticamente.</div>' : '') + ((x.irmaos || []).length ? '<div class="pb-aviso" style="margin-top:4px">Parecido com outro nome deste arquivo (' + escapeHtml(agiS.nomes[x.irmaos[0]].nome) + '). Se for o mesmo cliente, escolha “Mesmo cliente que…”.</div>' : '') + '</div>';
      }).join('');
    }
    /* processos */
    h += '<div class="pb-sec" style="margin-top:10px"><div class="pb-sec-t">Processos</div></div><label class="ad-it" style="border:0;padding:4px 0;"><input type="checkbox" data-agi="cadproc"' + (agiS.cadProc ? ' checked' : '') + '><span class="ad-t">Cadastrar os processos que ainda não existem (' + rs.novos + ' novo' + (rs.novos === 1 ? '' : 's') + '; os sem cliente vão para Revisar)</span></label>';
    /* compromissos */
    h += '<div class="pb-sec" style="margin-top:10px"><div style="display:flex;justify-content:space-between;align-items:center"><div class="pb-sec-t">Compromissos</div><div><button type="button" class="btn btn-ghost" data-agi="todos">Marcar todos</button> <button type="button" class="btn btn-ghost" data-agi="nenhum">Nenhum</button></div></div></div>';
    var ultimo = '';
    agiS.itens.forEach(function(it, idx){
      if (it.data !== ultimo){ ultimo = it.data; h += '<div class="pb-sec-t" style="margin:10px 4px 2px">' + escapeHtml(fmtData(it.data)) + '</div>'; }
      h += agiCartao(it, idx);
    });
    h += '<div class="pb-acts" style="position:sticky;bottom:0;background:var(--surface);padding:8px 0"><button type="button" class="btn btn-ghost pb-b" data-agi="voltar">Voltar</button><button type="button" class="btn btn-primary pb-b" data-agi="importar"' + (rs.n && !agiS.ocupado ? '' : ' disabled') + '>' + (agiS.ocupado ? 'Importando…' : 'Importar ' + rs.n) + '</button></div>';
    if (agiS.erro) h += '<div class="form-error">' + escapeHtml(agiS.erro) + '</div>';
  } else {
    var r = agiS.res;
    h += '<div class="pb-sec"><div class="pb-sec-t">Importado</div></div><div class="pb-painel">' + [
      ['Compromissos importados', r.criados], ['Prazos · Audiências · Tarefas', r.prazos + ' · ' + r.audiencias + ' · ' + r.tarefas], ['Pendentes · Concluídos', r.pendentes + ' · ' + r.concluidos],
      ['Ligados a um processo', r.comProcesso], ['  · já cadastrados', r.procExistentes], ['  · cadastrados agora', r.procNovos], ['Sem número de processo', r.semProcesso],
      ['Clientes ligados a compromissos', r.clientesLigados], ['Clientes novos cadastrados', r.clientesNovos], ['Pulados (já estavam na agenda)', r.pulados], ['Falhas', r.falhas]
    ].map(function(x){ return '<div class="pb-lin"><span>' + escapeHtml(x[0]) + '</span><b>' + escapeHtml(String(x[1])) + '</b></div>'; }).join('') + '</div>';
    if (r.procNovosSemCliente) h += '<div class="pb-aviso" style="margin:8px 4px">' + r.procNovosSemCliente + ' processo' + (r.procNovosSemCliente === 1 ? '' : 's') + ' novo' + (r.procNovosSemCliente === 1 ? '' : 's') + ' ficou' + (r.procNovosSemCliente === 1 ? '' : 'ram') + ' sem cliente: veja em Processos › Revisar.</div>';
    h += '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-agi="agenda">Abrir a agenda</button></div>';
  }
  el.innerHTML = h;
}
function agiCartao(it, idx){
  var cor = it.tipo === 'audiencia' ? '#2A78D6' : (it.tipo === 'prazo' ? '#C98500' : '#8A93AD'), dup = it.jaExiste === 'igual', hf = agiHoraFinal(it);
  var tags = agiTg(AG_TIPOS[it.tipo], it.tipo === 'audiencia' ? 'nv' : '') + agiTg(it.concluido ? 'Concluído' : 'Pendente', it.concluido ? 'ok' : '');
  if (it.prioridade && /alta/i.test(it.prioridade)) tags += agiTg('Prioridade alta', 'pz');
  if (it.tipoOriginal && it.tipo === 'tarefa') tags += agiTg('era “' + it.tipoOriginal + '”');
  if (it.num) tags += it.procExiste ? agiTg('✓ processo já cadastrado', 'ok') : agiTg(agiS.cadProc ? '＋ processo novo' : 'processo não cadastrado', 'nv'); else tags += agiTg('sem processo');
  if (it.processoDe === 'observacao') tags += agiTg('número lido da observação');
  if (it.tipo === 'audiencia' && !hf) tags += agiTg('sem hora');
  it.responsaveis.forEach(function(n){ tags += agiTg('responsável: ' + n); });
  it.partes.forEach(function(n){
    var d = agiS.decisao[normNome(n)] || 'sem', x = agiS.nomes[normNome(n)] || {};
    tags += d.indexOf('c:') === 0 ? agiTg('✓ ' + ((clienteById(d.slice(2)) || {}).nome || n), 'ok') : (d.indexOf('m:') === 0 ? agiTg('＋ mesmo cliente que ' + ((agiS.nomes[d.slice(2)] || {}).nome || '?'), 'nv') : (d === 'novo' ? agiTg('＋ cliente novo: ' + n, 'nv') : agiTg(n + ' · sem cliente')));
  });
  if (dup) tags += agiTg('já está na agenda · pula');
  else if (it.jaExiste === 'parecido') tags += agiTg('parece já estar na agenda', 'pz');
  var horaLinha = '';
  if (it.tipo === 'audiencia' && it.horaArq && it.horaTit && it.horaArq !== it.horaTit)
    horaLinha = '<div class="pb-aviso" style="margin-top:4px">Horário diferente: o arquivo diz ' + it.horaArq + ', o título diz ' + it.horaTit + '. <select class="filter-select" data-agi="hora" data-k="' + idx + '"><option value="arquivo"' + (it.horaEscolha === 'arquivo' ? ' selected' : '') + '>usar ' + it.horaArq + ' (arquivo)</option><option value="titulo"' + (it.horaEscolha === 'titulo' ? ' selected' : '') + '>usar ' + it.horaTit + ' (título)</option></select></div>';
  return '<div class="pb-card" style="--pb-bar:' + cor + (dup ? ';opacity:.5' : '') + '"><div class="pb-l1"><label class="ad-it" style="border:0;padding:0"><input type="checkbox" data-agi="sel" data-k="' + idx + '"' + (it.sel ? ' checked' : '') + (dup ? ' disabled' : '') + '><span class="ad-t" style="font-weight:700">' + escapeHtml(it.titulo || '(sem título)') + '</span></label><span class="pb-tipo">' + (it.tipo === 'audiencia' && hf ? hf : (it.diaInteiro ? 'dia inteiro' : (it.horaArq || ''))) + '</span></div>' +
    (it.num ? '<div class="pb-proc">' + escapeHtml(it.processo) + '</div>' : '') + '<div>' + tags + '</div>' + horaLinha + '</div>';
}

/* ---------- gravar ---------- */
function agiDocDe(it, clienteIds, clienteTxt){
  var hf = it.tipo === 'audiencia' ? agiHoraFinal(it) : '', hoje = agHoje(), pend = !it.concluido;
  var trab = '';
  if (it.tipo === 'prazo' && pend){ var auto = agAntesUteis(it.data, 2); if (auto >= hoje && auto < it.data) trab = auto; }
  var doc = { tipo: it.tipo, titulo: it.titulo, processo: it.processo, cliente: clienteTxt, clienteIds: clienteIds, data: it.data, hora: hf, trabalhar: trab,
    situacao: it.concluido ? 'feito' : 'afazer', concluido: it.concluido, avisos: (pend && it.data >= hoje) ? AG_PADRAO.slice() : [],
    audTipo: it.tipo === 'audiencia' ? agiAudTipo(it.titulo) : '', modalidade: '', local: '', link: '', obs: it.obs || '', subtipo: it.subtipo || '', prioridade: it.prioridade || '',
    responsaveis: it.responsaveis.slice(), partes: it.partes.slice(), origem: 'controljus', codigoControlJus: it.codigoProc || '', importKey: agiMarca(it), importadoEm: new Date().toISOString(), criadoEm: new Date().toISOString(), pubId: '', audPubId: '' };
  if (it.tipo === 'prazo' && it.concluido){ doc.protocoladoEm = it.data; doc.concluidoEm = it.data; }
  if (it.tipo !== 'prazo' && it.concluido) doc.concluidoEm = it.data;
  return doc;
}
function agiGrupoProcesso(num, itens, orgao){
  var dest = [], vistos = {}; itens.forEach(function(it){ it.partes.forEach(function(n){ var k = normNome(n); if (!vistos[k]){ vistos[k] = 1; dest.push({ n: n, p: '' }); } }); });
  var nasc = itens.map(function(i){ return i.data; }).sort().pop();
  return { p: num, numero: itens[0].processo, trib: String(orgao || '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 12), orgao: '', classe: '', natureza: '', ativo: '', passivo: '', valor: 0, dest: dest, n: itens.length, ult: { data: nasc, tipo: '', enc: '' }, oabs: {} };
}
function agiImportar(){
  if (agiS.ocupado) return; agiS.ocupado = true; agiS.erro = ''; agiDesenhar();
  var sel = agiS.itens.filter(function(i){ return i.sel && i.jaExiste !== 'igual'; });
  var r = { criados: 0, prazos: 0, audiencias: 0, tarefas: 0, pendentes: 0, concluidos: 0, comProcesso: 0, procExistentes: 0, procNovos: 0, procNovosSemCliente: 0, semProcesso: 0, clientesLigados: 0, clientesNovos: 0, pulados: agiS.itens.filter(function(i){ return i.jaExiste === 'igual'; }).length, falhas: 0 };
  var idPorNome = {}, ligados = {};
  /* 1) clientes novos (uma vez por nome) */
  var usados = {}; sel.forEach(function(i){ i.partes.forEach(function(n){ var k = normNome(n); usados[k] = 1; var d = agiS.decisao[k] || ''; if (d.indexOf('m:') === 0) usados[d.slice(2)] = 1; }); });
  var novos = Object.keys(usados).filter(function(k){ return agiS.decisao[k] === 'novo' && agiS.nomes[k]; });
  var cad = novos.reduce(function(p, k){
    return p.then(function(){
      var c = novoClienteObj({ nome: cliTitulo(agiS.nomes[k].nome), pagador: 'cliente', origem: 'agenda' });
      return persistClienteSet(c).then(function(){ idPorNome[k] = c.id; r.clientesNovos++; });
    });
  }, Promise.resolve());
  function idDaDecisao(k, fundo){
    var d = agiS.decisao[k] || 'sem';
    if (d.indexOf('c:') === 0) return d.slice(2);
    if (d === 'novo') return idPorNome[k] || '';
    if (d.indexOf('m:') === 0 && !fundo){ var o = agiS.decisao[d.slice(2)] || 'sem'; return o.indexOf('m:') === 0 ? '' : idDaDecisao(d.slice(2), true); }   /* "mesmo cliente que" aponta para outro nome; sem voltar a apontar */
    return '';
  }
  function idsDe(it){
    var ids = [], txt = [];
    it.partes.forEach(function(n){
      var k = normNome(n), id = idDaDecisao(k);
      if (id){ if (ids.indexOf(id) < 0) ids.push(id); txt.push((clienteById(id) || {}).nome || n); } else txt.push(n);
    });
    return { ids: ids, txt: txt.slice(0, 3).join(', ') + (txt.length > 3 ? ' e mais ' + (txt.length - 3) : '') };
  }
  /* 2) processos novos (um por número) */
  cad = cad.then(function(){
    var porNum = {}; sel.forEach(function(it){ if (it.num && !it.procExiste){ (porNum[it.num] = porNum[it.num] || []).push(it); } });
    var nums = agiS.cadProc ? Object.keys(porNum) : [];
    return nums.reduce(function(p, n){
      return p.then(function(){
        var itens = porNum[n], g = agiGrupoProcesso(n, itens, itens[0].orgao), dec = impDecidir(g), d = impMontarDoc(g, dec, 'diario');
        var ids = []; itens.forEach(function(it){ idsDe(it).ids.forEach(function(i){ if (ids.indexOf(i) < 0) ids.push(i); }); });
        d.origem = 'agenda'; d.clienteIds = ids; d.vinculoAuto = false;
        if (ids.length){ d.revisar = ''; d.sugestaoClienteId = ''; } else { d.revisar = d.revisar || 'sem-cliente'; r.procNovosSemCliente++; }
        delete d.ultimaPublicacao; delete d.ultimaPubTipo;
        return impGravarProcesso(d).then(function(x){ if (x.existia) r.procExistentes++; else r.procNovos++; itens.forEach(function(it){ it.procExiste = true; it.procCriado = !x.existia; }); });
      });
    }, Promise.resolve());
  });
  /* 3) compromissos */
  cad.then(function(){
    return sel.reduce(function(p, it){
      return p.then(function(){
        var c = idsDe(it), doc = agiDocDe(it, c.ids, c.txt), id = agiId(it);
        return pbApi('/api/db/agenda/' + encodeURIComponent(id) + '?soNovo=1', 'PUT', doc).then(function(j){
          if (j && j.criado === false){ r.pulados++; return; }
          doc.id = id; agDocs.push(doc); r.criados++; r[it.tipo === 'prazo' ? 'prazos' : (it.tipo === 'audiencia' ? 'audiencias' : 'tarefas')]++;
          r[it.concluido ? 'concluidos' : 'pendentes']++;
          if (it.num){ r.comProcesso++; if (it.procExiste && !it.procCriado) r.procExistentes++; } else r.semProcesso++;
          r.clientesLigados += c.ids.length;
        }).catch(function(){ r.falhas++; });
      });
    }, Promise.resolve());
  }).then(function(){
    /* "já cadastrados" conta processos, não compromissos */
    var existentes = {}; sel.forEach(function(it){ if (it.num && it.procExiste && !it.procCriado) existentes[it.num] = 1; });
    r.procExistentes = Object.keys(existentes).length;
    /* o que você confirmou fica aprendido: o nome escrito assim no arquivo passa a ser reconhecido como apelido daquele cliente */
    Object.keys(usados).forEach(function(k){ var x = agiS.nomes[k], id = x ? idDaDecisao(k) : ''; if (id && clienteById(id) && cliNivel(x.nome, clienteById(id).nome) < 3){ try{ prAprenderApelido(id, x.nome); }catch(e){} } });
    agiS.res = r; agiS.fase = 'feito'; agiS.ocupado = false; agiDesenhar();
    try{ prDepois(); }catch(e){} try{ agDepois(); }catch(e){} try{ impFilaDatajud(); }catch(e){}
    toast(r.criados + (r.criados === 1 ? ' compromisso importado.' : ' compromissos importados.'));
  }).catch(function(e){ agiS.ocupado = false; agiS.erro = 'Não consegui terminar: ' + (e && e.message ? e.message : e); agiDesenhar(); });
}
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { agiAbrir: agiAbrir, agiLerXml: agiLerXml }); })();
