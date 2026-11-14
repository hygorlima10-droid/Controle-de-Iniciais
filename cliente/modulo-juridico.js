/* ============================================================
   RESUMO DOS MÓDULOS JURÍDICOS (prefixo mj) — Fase 2, etapa 2.3
   Processos, Publicações, Agenda e Clientes: sub-aba "Resumo" com indicadores clicáveis, gráficos e "precisa de atenção".
   - usa as peças de cliente/modulo.js (mdKpi, mdCard, mdRosca, mdBarras, mdLinha, mdIc, mdBarraHtml)
   - nenhuma conta nova: os números vêm das mesmas funções que as listas já usam
     (prMapa/prPrazosAbertos/prParado/prProximaInfo, pbVisiveis/pbGrupos/pbLidaG/pbVinculo, agItens, resumoDeUnidades)
   - cada número abre a lista que o forma (data-md-ir="ação:valor"), tratado em mjClique
   ============================================================ */
var mjS = { sel: {}, cli: null, cliDados: null };
function mjPainel(mod, html){ return '<div class="md-painel" data-mj="' + mod + '">' + html + '</div>'; }
function mjN(n, um, varios){ return n + ' ' + (n === 1 ? um : varios); }
/* linha clicável com barra (rótulo, barra proporcional, número) */
function mjBarrasH(itens, vazio, dica){
  var max = Math.max.apply(null, itens.map(function(x){ return x.n; }).concat([1]));
  if (!itens.length) return '<div class="md-vazio">' + vazio + '</div>';
  return itens.map(function(x){
    return '<button type="button" class="md-fase"' + (x.ir ? ' data-md-ir="' + escapeHtml(x.ir) + '"' : ' disabled style="cursor:default"') + '><span title="' + escapeHtml(x.rot) + '">' + escapeHtml(x.rot) + '</span><span class="tr"><i style="width:' + Math.round(x.n / max * 100) + '%;background:' + x.cor + '"></i></span><b>' + (x.txt || x.n) + '</b></button>';
  }).join('') + (dica ? '<div class="md-foot">' + dica + '</div>' : '');
}
/* linha da área "precisa de atenção" */
function mjLin(ic, cor, titulo, sub, valor, ir, neg){
  return '<button type="button" class="md-at" data-md-ir="' + escapeHtml(ir) + '">' + mdIc(ic, cor) + '<span class="tx"><b>' + escapeHtml(titulo) + '</b><span>' + escapeHtml(sub) + '</span></span>' + (valor !== '' && valor != null ? '<span class="vl' + (neg ? ' neg' : '') + '">' + escapeHtml(String(valor)) + '</span>' : '') + '</button>';
}
function mjLegenda(fat, irs){
  return fat.map(function(x, i){ return '<button type="button" class="md-fase" style="grid-template-columns:minmax(0,1fr) auto' + (irs && irs[i] ? '" data-md-ir="' + escapeHtml(irs[i]) + '"' : ';cursor:default" disabled') + '><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + x[2] + ';margin-right:7px"></i>' + escapeHtml(x[0]) + '</span><b>' + x[1] + '</b></button>'; }).join('');
}
function mjRoscaCard(fat, centro, sub, irs){
  return '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:center">' + mdRosca(fat, centro, sub) + '<div style="flex:1;min-width:170px">' + mjLegenda(fat, irs) + '</div></div>';
}
function mjMeses6(){ var out = [], m = todayISO().slice(0, 7); for (var k = 5; k >= 0; k--) out.push(deslocarMes(m, -k)); return out; }

/* ---------------- PROCESSOS ---------------- */
function mjSemProv(r){ var px = prProximaInfo(r); return !px || px.feito; }
function mjProcessos(){
  var mp = prMapa(), pm = pendentesPorDoc(), linhas = mp.ordem.map(function(n){ return mp.m[n]; }), ativos = linhas.filter(function(r){ return !prArquivado(r); });
  var comPrazo = ativos.filter(function(r){ return prPrazosAbertos(r).length > 0; }).length, parados = ativos.filter(function(r){ return prParado(r, pm); }).length;
  var semProv = ativos.filter(mjSemProv).length, semCli = ativos.filter(function(r){ return !prClienteIds(r).length; }).length, nRev = impContaRev();
  var hoje = todayISO(), lim = somarDias(hoje, 7), pz7 = agItens().filter(function(i){ return !i.concluido && i.processo && i.data >= hoje && i.data <= lim; }).length;
  var kp = [
    { ir: 'lista:andamento', ic: 'scale', cor: MD_COR.azul, rot: 'Em andamento', v: String(ativos.length), foot: mjN(linhas.length, 'processo no total', 'processos no total') },
    { ir: 'lista:prazo', ic: 'alarm-clock', cor: comPrazo ? MD_COR.verm : MD_COR.cinza, rot: 'Com prazo aberto', v: String(comPrazo), cls: comPrazo ? 'neg' : '', foot: mjN(pz7, 'compromisso nos próximos 7 dias', 'compromissos nos próximos 7 dias') },
    { ir: 'esp:semprov', ic: 'clipboard-list', cor: MD_COR.ouro, rot: 'Sem próxima providência', v: String(semProv), foot: 'ninguém anotou o próximo passo' },
    { ir: 'esp:parado', ic: 'pause-circle', cor: MD_COR.roxo, rot: 'Sem andamento há 60 dias', v: String(parados), foot: parados ? 'veja se é caso de arquivar' : 'nenhum processo parado' }];
  /* por área do direito (a mesma classificação da sub-aba Análises) */
  var areas = {}; ativos.forEach(function(r){ var a = panArea(r) || 'Outras'; areas[a] = (areas[a] || 0) + 1; });
  var ord = Object.keys(areas).sort(function(a, b){ return areas[b] - areas[a]; }), cores = [MD_COR.azul, MD_COR.ouro, MD_COR.verde, MD_COR.roxo, MD_COR.cinza], fat = [];
  ord.slice(0, 4).forEach(function(a, i){ fat.push([a, areas[a], cores[i]]); });
  var resto = ord.slice(4).reduce(function(t, a){ return t + areas[a]; }, 0); if (resto) fat.push(['Outras áreas', resto, MD_COR.cinza]);
  var meses = mjMeses6(), novos = [], arqs = [];
  meses.forEach(function(m){
    novos.push(linhas.filter(function(r){ return panDe(r).slice(0, 7) === m; }).length);
    arqs.push(linhas.filter(function(r){ return prArquivado(r) && String(r.doc.dataArquivo || r.doc.arquivadoEm || '').slice(0, 7) === m; }).length);
  });
  var at = '';
  if (nRev) at += mjLin('scan-search', MD_COR.verm, 'Importados para revisar', 'vieram do Diário Oficial e esperam você conferir', nRev, 'revisar', true);
  if (semCli) at += mjLin('user-round-x', MD_COR.ouro, 'Sem cliente vinculado', 'processos que não aparecem no perfil de ninguém', semCli, 'cli:__sem');
  if (semProv) at += mjLin('clipboard-list', MD_COR.ouro, 'Sem próxima providência', 'anote o próximo passo para não esquecer', semProv, 'esp:semprov');
  if (pz7) at += mjLin('calendar-clock', MD_COR.azul, 'Prazos e audiências em 7 dias', 'abre a Agenda', pz7, 'agenda');
  if (parados) at += mjLin('pause-circle', MD_COR.roxo, 'Sem andamento há 60 dias', 'pode ser caso de arquivar', parados, 'esp:parado');
  if (!at) at = '<div class="md-vazio">Nada pendente nos processos.</div>';
  var fmtN = function(v){ return String(v); };
  return '<div class="md-kpis">' + kp.map(mdKpi).join('') + '</div><div class="md-grid">' +
    mdCard('Por área do direito', fat.length ? mjRoscaCard(fat, String(ativos.length), 'em andamento') : '<div class="md-vazio">Nenhum processo em andamento.</div>', ['analises', 'ver análises']) +
    mdCard('Novos × arquivados por mês', mdBarras(meses, novos, arqs, { sel: mjS.sel.processos, ca: MD_COR.azul, cb: MD_COR.cinza, ra: 'novos', rb: 'arquivados', fmt: fmtN, titulo: 'Processos novos e arquivados por mês' }) + mdLeg([[MD_COR.azul, 'Cadastrados'], [MD_COR.cinza, 'Arquivados']]) + '<div class="md-foot">Toque num mês para ver os números.</div>') +
    mdCard('Precisa de atenção', '<div class="md-ats">' + at + '</div>') + '</div>';
}

/* ---------------- PUBLICAÇÕES ---------------- */
function mjPublicacoes(){
  var vis = pbGrupos(pbVisiveis()), naoLidas = vis.filter(function(p){ return !pbLidaG(p); });
  var aDefinir = vis.filter(function(p){ return p.sug && !pbSemPrazoG(p) && !pbPrazoGrupo(p) && !pbLidaG(p); }).length;
  var semProc = naoLidas.filter(function(p){ return !pbVinculo(p.processo); }).length;
  var hoje = todayISO(), lim = somarDias(hoje, 7), pz7 = agItens().filter(function(i){ return !i.concluido && i.tipo === 'prazo' && i.data >= hoje && i.data <= lim; }).length;
  var kp = [
    { ir: 'filtro:naolidas', ic: 'newspaper', cor: naoLidas.length ? MD_COR.verm : MD_COR.cinza, rot: 'Não lidas', v: String(naoLidas.length), cls: naoLidas.length ? 'neg' : '', foot: 'atualizado ' + escapeHtml(pbQuandoAtualizou()) },
    { ir: 'filtro:naolidas', ic: 'file-clock', cor: MD_COR.ouro, rot: 'Prazo a definir', v: String(aDefinir), foot: 'o app sugeriu um prazo e espera você confirmar' },
    { ir: 'filtro:naolidas', ic: 'file-plus', cor: MD_COR.azul, rot: 'Processo novo', v: String(semProc), foot: 'não lidas de processo ainda não cadastrado' },
    { ir: 'agenda', ic: 'calendar-clock', cor: MD_COR.roxo, rot: 'Prazos em 7 dias', v: String(pz7), foot: 'abre a Agenda' }];
  var cores = [MD_COR.ouro, MD_COR.azul, MD_COR.verde, MD_COR.roxo, MD_COR.cinza];
  var porOab = pbS.oabs.filter(function(o){ return o.ativo; }).map(function(o, i){ return { rot: o.nome + ' · ' + o.numero + '/' + o.uf, n: vis.filter(function(p){ return (p.oabs || []).indexOf(o.id) >= 0; }).length, cor: cores[i % cores.length], ir: 'oab:' + o.id }; });
  var tr = {}; vis.forEach(function(p){ var t = p.tribunal || 'Sem tribunal'; tr[t] = (tr[t] || 0) + 1; });
  var porTrib = Object.keys(tr).sort(function(a, b){ return tr[b] - tr[a]; }).slice(0, 6).map(function(t){ return { rot: t, n: tr[t], cor: MD_COR.verde, ir: t === 'Sem tribunal' ? '' : 'trib:' + t }; });
  var vinc = vis.filter(function(p){ return !!pbVinculo(p.processo); }).length, sem = vis.length - vinc;
  return '<div class="md-kpis">' + kp.map(mdKpi).join('') + '</div><div class="md-grid">' +
    mdCard('Por OAB monitorada', mjBarrasH(porOab, 'Nenhuma OAB ativa.', 'Últimos 90 dias. Toque para ver só as dessa OAB.'), ['oabs', 'OABs']) +
    mdCard('Por tribunal', mjBarrasH(porTrib, 'Nenhuma publicação nos últimos 90 dias.', 'Toque para ver só as desse tribunal.')) +
    mdCard('Ligadas a processo cadastrado', vis.length ? mjRoscaCard([['De processos meus', vinc, MD_COR.verde], ['Sem processo cadastrado', sem, MD_COR.ouro]], Math.round(vinc / vis.length * 100) + '%', 'com processo', ['filtro:meus', 'filtro:todas']) + '<div class="md-foot">' + mjN(vis.length, 'publicação', 'publicações') + ' nos últimos 90 dias.</div>' : '<div class="md-vazio">Nenhuma publicação nos últimos 90 dias.</div>') + '</div>';
}

/* ---------------- AGENDA ---------------- */
function mjCarga(dias, por){
  var w = 330, h = 168, px = 6, py = 22, W = w - px * 2, H = h - py - 34, gw = W / dias.length, bw = Math.min(26, gw * 0.5), hoje = todayISO(), max = 1;
  var cont = dias.map(function(d){ var l = (por[d] || []).filter(function(i){ return !i.concluido; }), c = { pr: 0, au: 0, ta: 0 }; l.forEach(function(i){ c[i.tipo === 'audiencia' ? 'au' : (i.tipo === 'tarefa' ? 'ta' : 'pr')]++; }); c.t = l.length; if (c.t > max) max = c.t; return c; });
  var s = '<svg class="md-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Compromissos por dia">';
  for (var k = 0; k < 4; k++){ var yy = py + (H * k) / 3; s += '<line class="gr" x1="' + px + '" x2="' + (w - px) + '" y1="' + yy + '" y2="' + yy + '"/>'; }
  dias.forEach(function(d, i){
    var c = cont[i], cx = px + i * gw + gw / 2, y = py + H, ehHoje = d === hoje;
    s += '<g class="alvo" data-md-ir="dia:' + d + '"><rect x="' + (px + i * gw) + '" y="0" width="' + gw + '" height="' + h + '" fill="transparent"/>';
    [['pr', MD_COR.verm], ['au', MD_COR.azul], ['ta', MD_COR.ouro]].forEach(function(t){ var hh = (c[t[0]] / max) * H; if (hh > 0){ y -= hh; s += '<rect x="' + (cx - bw / 2) + '" y="' + y + '" width="' + bw + '" height="' + Math.max(hh - 1.5, 1) + '" rx="3.5" fill="' + t[1] + '"/>'; } });
    if (c.t) s += '<text x="' + cx + '" y="' + (y - 5) + '" text-anchor="middle" font-size="11" font-weight="800" style="fill:var(--ink)">' + c.t + '</text>';
    s += '<text x="' + cx + '" y="' + (h - 18) + '" text-anchor="middle" font-size="10.5"' + (ehHoje ? ' font-weight="800" style="fill:var(--ink)"' : '') + '>' + (ehHoje ? 'Hoje' : AG_DOW[pbDow(d)]) + '</text><text x="' + cx + '" y="' + (h - 5) + '" text-anchor="middle" font-size="9.5">' + d.slice(8, 10) + '/' + d.slice(5, 7) + '</text></g>';
  });
  return s + '</svg>';
}
function mjAgenda(){
  var hoje = todayISO(), lim = somarDias(hoje, 7), todos = agEscopoLista(agItens()), abertos = todos.filter(function(i){ return !i.concluido; }).sort(agOrdem);
  var deHoje = abertos.filter(function(i){ return i.data === hoje; }), em7 = abertos.filter(function(i){ return i.data >= hoje && i.data <= lim; });
  var pz = em7.filter(function(i){ return i.tipo === 'prazo'; }).length, au = em7.filter(function(i){ return i.tipo === 'audiencia'; }).length;
  var atr = abertos.filter(function(i){ return i.data < hoje && i.tipo !== 'audiencia'; }).length;
  var kp = [
    { ir: 'dia:' + hoje, ic: 'calendar-check', cor: MD_COR.azul, rot: 'Hoje', v: String(deHoje.length), foot: deHoje.length ? mjN(deHoje.length, 'compromisso aberto', 'compromissos abertos') : 'nada para hoje' },
    { ir: 'lista:prazo', ic: 'alarm-clock', cor: pz ? MD_COR.verm : MD_COR.cinza, rot: 'Prazos em 7 dias', v: String(pz), cls: pz ? 'neg' : '', foot: 'prazos processuais a vencer' },
    { ir: 'lista:audiencia', ic: 'gavel', cor: MD_COR.roxo, rot: 'Audiências em 7 dias', v: String(au), foot: au ? 'confira horário e local' : 'nenhuma audiência próxima' },
    { ir: 'lista:tudo', ic: 'triangle-alert', cor: atr ? MD_COR.verm : MD_COR.cinza, rot: 'Atrasados', v: String(atr), cls: atr ? 'neg' : '', foot: atr ? 'prazos e tarefas que já passaram' : 'nada atrasado' }];
  var dias = []; for (var k = 0; k < 7; k++) dias.push(somarDias(hoje, k));
  var por = agPorDia(todos);
  var resp = {}, semResp = 0, d30 = somarDias(hoje, 30);
  abertos.filter(function(i){ return i.data <= d30; }).forEach(function(i){ var l = (i.doc && Array.isArray(i.doc.responsaveis)) ? i.doc.responsaveis : []; if (!l.length) semResp++; l.forEach(function(n){ resp[n] = (resp[n] || 0) + 1; }); });
  var cores = [MD_COR.ouro, MD_COR.azul, MD_COR.verde, MD_COR.roxo, MD_COR.cinza];
  var porResp = Object.keys(resp).sort(function(a, b){ return resp[b] - resp[a]; }).slice(0, 6).map(function(n, i){ return { rot: n, n: resp[n], cor: cores[i % cores.length], ir: 'resp:' + n }; });
  if (semResp) porResp.push({ rot: 'Sem responsável', n: semResp, cor: MD_COR.cinza, ir: '' });
  var prox = abertos.filter(function(i){ return i.data >= hoje; }).slice(0, 4).map(function(i){
    var ic = i.tipo === 'audiencia' ? ['gavel', MD_COR.roxo] : (i.tipo === 'tarefa' ? ['clipboard-check', MD_COR.ouro] : ['alarm-clock', MD_COR.verm]);
    return mjLin(ic[0], ic[1], i.titulo, [i.cliente, mdDiasTxt(i.data).replace('vence ', '') + (i.hora ? ' · ' + i.hora : '')].filter(Boolean).join(' · '), fmtData(i.data).slice(0, 5), 'item:' + i.key);
  }).join('') || '<div class="md-vazio">Nenhum compromisso em aberto.</div>';
  return '<div class="md-kpis">' + kp.map(mdKpi).join('') + '</div><div class="md-grid">' +
    mdCard('Carga dos próximos 7 dias', mjCarga(dias, por) + mdLeg([[MD_COR.verm, 'Prazos'], [MD_COR.azul, 'Audiências'], [MD_COR.ouro, 'Tarefas']]) + '<div class="md-foot">Toque num dia para abrir a semana nele.</div>', ['vista:semana', 'abrir a semana']) +
    mdCard('Carga por pessoa · próximos 7 dias', '<div id="agCargaBox"><div class="saldo-data">Carregando…</div></div>') +
    mdCard('Por responsável', mjBarrasH(porResp, 'Nenhum compromisso com responsável nos próximos 30 dias.', 'Em aberto até 30 dias à frente. Toque para ver só os dessa pessoa.')) +
    mdCard('Próximos compromissos', '<div class="md-ats">' + prox + '</div>', ['lista:tudo', 'ver a lista']) + '</div>';
}

/* ---------------- CLIENTES ---------------- */
var MJ_CLI_ABAS = [['resumo', 'Resumo'], ['lista', 'Lista'], ['cobrar', 'A cobrar'], ['atraso', 'Em atraso'], ['sem', 'Sem processos']];
var MJ_CLI_TIPO = { lista: 'ativos', cobrar: 'receber', atraso: 'atraso', sem: 'sem' };
/* sub-abas de Clientes por papel: sem "Ver totais" (ou estagiário) não há Resumo (totais, maiores valores, para cobrar); estagiário também não tem "A cobrar" nem "Em atraso" (não cobra) */
function mjCliAbas(){
  var est = (typeof ppPapel === 'function') && ppPapel() === 'estagiario', sem = (typeof ppVerTotais === 'function') && !ppVerTotais();
  return MJ_CLI_ABAS.filter(function(a){ return !((sem || est) && a[0] === 'resumo') && !(est && (a[0] === 'cobrar' || a[0] === 'atraso')); });
}
function mjCliTem(k){ return mjCliAbas().some(function(a){ return a[0] === k; }); }
function mjCliChave(){
  if (mjS.cli === 'resumo') return 'resumo';
  var t = clientesFiltro.tipo; return t === 'receber' ? 'cobrar' : (t === 'atraso' ? 'atraso' : (t === 'sem' ? 'sem' : 'lista'));
}
function mjCliIr(k, lembrar){
  if (!mjCliTem(k)) k = 'lista';
  if (lembrar) mdLembrar('clientes', k);
  if (k === 'resumo') mjS.cli = 'resumo';
  else { mjS.cli = 'lista'; clientesFiltro.tipo = MJ_CLI_TIPO[k] || 'ativos'; var sel = qs('filtroClienteTipo'); if (sel) sel.value = clientesFiltro.tipo; }
  renderClientes();
}
/* chamada de dentro de renderClientes(), com os dados que ela já calculou */
function mjClientes(D){
  var head = qs('headClientes'), body = qs('bodyClientes'); if (!head || !body) return;
  mdCss();
  if (mjS.cli == null){
    var s0 = mdInicial('clientes', ['lista', 'cobrar', 'atraso', 'sem']);
    if (!mjCliTem(s0)) s0 = 'lista';
    if (s0 === 'resumo') mjS.cli = 'resumo'; else { mjS.cli = 'lista'; clientesFiltro.tipo = MJ_CLI_TIPO[s0]; var sel = qs('filtroClienteTipo'); if (sel) sel.value = clientesFiltro.tipo; }
  }
  if (mjS.cli === 'resumo' && !mjCliTem('resumo')) mjS.cli = 'lista';
  if (!mjCliTem(mjCliChave())){ mjS.cli = 'lista'; clientesFiltro.tipo = 'ativos'; }
  var chave = mjCliChave(), sub = chave === 'resumo' ? 'resumo' : 'lista';
  head.setAttribute('data-md', sub); body.setAttribute('data-md', sub);
  var bar = document.getElementById('mdAbas-clientes');
  if (!bar){
    bar = document.createElement('div'); bar.id = 'mdAbas-clientes'; head.insertBefore(bar, head.firstChild);
    bar.addEventListener('click', function(ev){ var b = ev.target.closest ? ev.target.closest('[data-mj-cli]') : null; if (b) mjCliIr(b.getAttribute('data-mj-cli'), true); });
  }
  var nAtr = D.lista.filter(function(x){ return !x.c.arquivado && x.r.atrasado > 0.004; }).length;
  bar.innerHTML = mdBarraHtml(mjCliAbas().map(function(a){ return a[0] === 'atraso' && nAtr ? [a[0], a[1], nAtr] : a; }), chave, function(k){ return 'data-mj-cli="' + k + '"'; });
  var p = document.getElementById('mdPainel-clientes');
  if (!p){ p = document.createElement('div'); p.id = 'mdPainel-clientes'; p.className = 'md-painel'; p.setAttribute('data-mj', 'clientes'); body.insertBefore(p, body.firstChild); }
  if (sub !== 'resumo' || activeTab !== 'clientes'){ p.innerHTML = ''; return; }
  try{ p.innerHTML = mjClientesHtml(D); }catch(e){ console.error('resumo de clientes', e); p.innerHTML = '<div class="empty"><strong>Não consegui montar esta tela</strong>As outras sub-abas continuam funcionando.</div>'; }
}
function mjClientesHtml(D){
  var at = D.ativos, tot = D.tot, cobrar = at.filter(function(x){ return x.r.receber > 0.004; }), atras = at.filter(function(x){ return x.r.atrasado > 0.004; }), sem = at.filter(function(x){ return !x.docs.length; });
  var mes = todayISO().slice(0, 7), novosMes = at.filter(function(x){ return String(x.c.criadoEm || '').slice(0, 7) === mes; }).length;
  var kp = [
    { ir: 'tipo:cobrar', ic: 'hand-coins', cor: MD_COR.ouro, rot: 'A receber dos clientes', v: fmtMoeda(tot.receber), foot: (tot.mes > 0.004 ? '<span class="fv-chip ok">▲ ' + fmtMoeda(tot.mes) + ' em ' + escapeHtml(mdMesAno(mesSelecionado)) + '</span>' : 'nada recebido em ' + escapeHtml(mdMesAno(mesSelecionado))) + (tot.repasse > 0.004 ? ' · valor cheio; ' + fmtMoeda(tot.repasse) + ' é repasse a parceiros' : '') },
    { ir: 'tipo:atraso', ic: 'triangle-alert', cor: tot.atrasado > 0.004 ? MD_COR.verm : MD_COR.cinza, rot: 'Em atraso', v: fmtMoeda(tot.atrasado), cls: tot.atrasado > 0.004 ? 'neg' : '', foot: atras.length ? mjN(atras.length, 'cliente com parcela vencida', 'clientes com parcela vencida') : 'nenhum cliente em atraso' },
    { ir: 'tipo:lista', ic: 'users', cor: MD_COR.azul, rot: 'Clientes ativos', v: String(at.length), foot: novosMes ? mjN(novosMes, 'cadastrado neste mês', 'cadastrados neste mês') : 'nenhum cadastro novo neste mês' },
    { ir: 'tipo:sem', ic: 'user-round-minus', cor: MD_COR.roxo, rot: 'Sem processos', v: String(sem.length), foot: 'cadastro sem inicial, acordo ou alvará' }];
  var maiores = cobrar.slice().sort(function(a, b){ return b.r.receber - a.r.receber; }).slice(0, 5).map(function(x){ return { rot: x.c.nome, n: x.r.receber, txt: fmtMoeda(x.r.receber), cor: x.r.atrasado > 0.004 ? MD_COR.verm : MD_COR.ouro, ir: 'perfil:' + x.c.id }; });
  var meses = mjMeses6(), novos = meses.map(function(m){ return D.lista.filter(function(x){ return String(x.c.criadoEm || '').slice(0, 7) === m; }).length; });
  var cob = atras.slice().sort(function(a, b){ return b.r.diasAtraso - a.r.diasAtraso; }).slice(0, 4).map(function(x){
    return mjLin('triangle-alert', MD_COR.verm, x.c.nome, 'atraso de ' + mjN(x.r.diasAtraso, 'dia', 'dias') + (x.prom ? ' · tem promessa de pagamento' : (x.ult ? ' · já cobrado' : ' · ainda não cobrado')), fmtMoeda(x.r.atrasado), 'perfil:' + x.c.id, true);
  }).join('') || '<div class="md-vazio">Nenhum cliente com parcela vencida.</div>';
  return '<div class="md-kpis">' + kp.map(mdKpi).join('') + '</div><div class="md-grid">' +
    mdCard('Maiores valores a receber', mjBarrasH(maiores, 'Nenhum cliente com valor a receber.', 'Em vermelho: tem parcela vencida. Toque para abrir o cliente.'), ['tipo:cobrar', 'ver todos']) +
    mdCard('Clientes cadastrados por mês', mdLinha(meses, novos, MD_COR.azul, { id: 'c', titulo: 'Clientes cadastrados por mês' }) + '<div class="md-foot">' + mjN(novos.reduce(function(t, x){ return t + x; }, 0), 'cadastro', 'cadastros') + ' em 6 meses.</div>', ['tipo:lista', 'ver a lista']) +
    mdCard('Para cobrar agora' + (atras.length ? ' · ' + atras.length : ''), '<div class="md-ats">' + cob + '</div>', atras.length > 4 ? ['tipo:atraso', 'ver todos'] : null) + '</div>';
}

/* ---------------- cliques dos quatro resumos ---------------- */
function mjClique(mod, ev){
  var t = ev.target, b = t.closest ? t.closest('[data-md-mes]') : null;
  if (b){ var i = Number(b.getAttribute('data-md-mes')); mjS.sel[mod] = mjS.sel[mod] === i ? null : i; mdRedesenhar(mod); return; }
  b = t.closest ? t.closest('[data-md-ir]') : null; if (!b) return;
  var ir = b.getAttribute('data-md-ir'), k = ir.indexOf(':'), a = k < 0 ? ir : ir.slice(0, k), v = k < 0 ? '' : ir.slice(k + 1);
  if (a === 'agenda'){ setActiveTab('agenda'); return; }
  if (mod === 'processos'){
    prS.mais = 1; prS.f = { cli: '', orgao: '', esp: '' };
    if (a === 'analises'){ prS.sub = 'analises'; }
    else if (a === 'revisar'){ prS.sub = 'lista'; prS.filtro = 'revisar'; }
    else { prS.sub = 'lista'; prS.filtro = a === 'lista' ? v : 'andamento'; if (a === 'esp') prS.f.esp = v; if (a === 'cli') prS.f.cli = v; }
    prRender();
  } else if (mod === 'publicacoes'){
    if (a === 'oabs'){ var bo = document.querySelector('#pbWrap [data-pb="oabs"]'); if (bo) bo.click(); return; }
    pbS.sub = 'lista'; pbS.mais = 1;
    if (a === 'filtro') pbS.filtro = v;
    else { pbS.filtro = 'todas'; pbS.f = { q: '', de: '', ate: '', oab: a === 'oab' ? v : 'todas', adv: '', trib: a === 'trib' ? v : '' }; }
    pbRender();
  } else if (mod === 'agenda'){
    if (a === 'item'){ agdAbrir(v); return; }
    if (a === 'dia'){ agS.vista = 'semana'; agS.ref = v; agS.sel = v; agS.mes = v.slice(0, 7); }
    else if (a === 'vista'){ agS.vista = v; }
    else if (a === 'lista'){ agS.vista = 'lista'; agS.filtro = v; agS.resp = ''; agS.sit = 'abertos'; agS.periodo = ''; }
    else if (a === 'resp'){ agS.vista = 'lista'; agS.filtro = 'tudo'; agS.resp = v; agS.sit = 'abertos'; }
    agRender();
  } else if (mod === 'clientes'){
    if (a === 'perfil'){ abrirPerfilCliente(v); return; }
    if (a === 'tipo') mjCliIr(v, false);
  }
}
document.addEventListener('click', function(ev){
  var p = ev.target.closest ? ev.target.closest('.md-painel[data-mj]') : null; if (!p) return;
  try{ mjClique(p.getAttribute('data-mj'), ev); }catch(e){ console.error('resumo', e); }
});
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { mjS: mjS, mjCliIr: mjCliIr }); })();
