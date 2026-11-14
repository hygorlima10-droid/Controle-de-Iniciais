/* ============================================================
   PROCESSOS › ANÁLISES: gráficos sobre a atuação do escritório
   - quatro números de destaque, andamento, processos por área e por procedimento, resultado dos encerrados,
     processos novos por mês e carga de prazos nas próximas semanas
   - usa os campos Área (sugerida pelo tribunal e pela classe) e Resultado (ao arquivar) do processo
   - tem versão para imprimir (relatório)
   ============================================================ */
var PR_AREAS = ['Cível', 'Bancário / rural', 'Família e sucessões', 'Trabalhista', 'Consumidor', 'Previdenciário', 'Tributário / Fazenda', 'Criminal', 'Empresarial', 'Federal', 'Outras'];
var PR_RES = { procedente: 'Procedente', parcial: 'Parcialmente procedente', acordo: 'Acordo', improcedente: 'Improcedente', desistencia: 'Desistência', outro: 'Outro' };
var PR_RES_EXITO = { procedente: 1, parcial: 1, acordo: 1 };
var panS = { periodo: '12m', area: '' };

/* área: a que você escolheu, ou a sugerida pelo tribunal (Justiça do Trabalho, Federal) e pelas palavras da classe e do assunto */
function panAreaSug(r){
  var dig = String(r.num || '').replace(/\D/g, ''), j = dig.length === 20 ? dig.charAt(13) : '';
  if (j === '5') return 'Trabalhista';
  if (j === '4') return 'Federal';
  var d = r.doc || {}, ps = prPubsDe(r.num), txt = normNome([d.classe, d.assunto, d.partes, ps[0] ? ps[0].classe : '', r.links.map(function(l){ return l.tipo === 'caso' ? l.doc.nomeAcao : ''; }).join(' ')].join(' '));
  if (/alimentos|guarda|divorcio|uniao estavel|inventario|arrolamento|partilha|familia|visita|paternidade|interdicao|curatela/.test(txt)) return 'Família e sucessões';
  if (/previdenci|aposentadoria|beneficio|inss|auxilio|pensao por morte/.test(txt)) return 'Previdenciário';
  if (/execucao fiscal|tribut|imposto|icms|iptu|fazenda publica|taxa|contribuicao/.test(txt)) return 'Tributário / Fazenda';
  if (/acao penal|inquerito|criminal|habeas|queixa|crime/.test(txt)) return 'Criminal';
  if (/falencia|recuperacao judicial|sociedade|dissolucao|empresar/.test(txt)) return 'Empresarial';
  if (/cedula|cpr|rural|safra|credito rural|financiamento|bancari|banco|alongamento de divida|contrato bancario|cartao/.test(txt)) return 'Bancário / rural';
  if (/consumidor|negativacao|dano moral|plano de saude|vicio do produto|cdc/.test(txt)) return 'Consumidor';
  return 'Cível';
}
function panArea(r){ return (r.doc && r.doc.area) || panAreaSug(r); }
function panProced(r){
  var d = r.doc || {}, ps = prPubsDe(r.num), txt = normNome([d.classe, ps[0] ? ps[0].classe : '', r.links.map(function(l){ return l.tipo === 'caso' ? l.doc.nomeAcao : ''; }).join(' '), prOrgaoDe(r)].join(' '));
  if (/juizado/.test(txt)) return 'Juizado especial';
  if (/cumprimento de senten/.test(txt)) return 'Cumprimento de sentença';
  if (/execu/.test(txt)) return 'Execução';
  if (/apelacao|agravo|recurso|embargos de declaracao|mandado de seguranca/.test(txt)) return 'Recursos';
  if (/procedimento comum|conhecimento|cobranca|indeniza|declarat|obrigacao de fazer|\bacao\b/.test(txt)) return 'Procedimento comum';
  return txt.trim() ? 'Outros' : 'Sem classe informada';
}
function panIni(op){ var h = todayISO(); return op === 'ano' ? h.slice(0, 4) + '-01-01' : (op === 'tudo' ? '0000-01-01' : pbSoma(h, -365)); }
function panDe(r){ return String((r.doc && r.doc.criadoEm) || '').slice(0, 10) || r.links.map(function(l){ return String(l.doc.criadoEm || '').slice(0, 10); }).filter(Boolean).sort()[0] || ''; }

/* todos os números da tela, calculados de uma vez (a tela e o relatório usam o mesmo cálculo) */
function panDados(op){
  var hoje = todayISO(), ini = panIni(op.periodo), mp = prMapa(), pm = pendentesPorDoc(), todos = mp.ordem.map(function(n){ return mp.m[n]; });
  if (op.area) todos = todos.filter(function(r){ return panArea(r) === op.area; });
  var ativos = todos.filter(function(r){ return !prArquivado(r); }), arq = todos.filter(function(r){ return prArquivado(r) && String(r.doc.dataArquivo || r.doc.arquivadoEm || '').slice(0, 10) >= ini; });
  var D = { hoje: hoje, ini: ini, ativos: ativos.length, total: todos.length };
  D.novos30 = ativos.filter(function(r){ return panDe(r) >= pbSoma(hoje, -30); }).length;
  var com = 0, exito = 0, res = {}; arq.forEach(function(r){ var k = r.doc.resultado; if (PR_RES[k]){ com++; res[k] = (res[k] || 0) + 1; if (PR_RES_EXITO[k]) exito++; } });
  D.resComRes = com; D.resExito = exito; D.res = res; D.encerrados = arq.length;
  /* peças no prazo: prazos protocolados cujo prazo fatal cai no período */
  var nums = {}; ativos.concat(arq).forEach(function(r){ nums[r.num] = 1; });
  var prot = agItens().filter(function(i){ return i.tipo === 'prazo' && i.concluido && i.protocoladoEm && i.data >= ini && i.data <= hoje && (!op.area || (i.processo && nums[prNum(i.processo)])); });
  D.protTotal = prot.length; D.protNoPrazo = prot.filter(function(i){ return i.protocoladoEm <= i.data; }).length;
  var soma = 0, n = 0; prot.forEach(function(i){ if (i.protocoladoEm <= i.data){ soma += Math.round((Date.parse(i.data + 'T12:00:00Z') - Date.parse(i.protocoladoEm + 'T12:00:00Z')) / 86400000); n++; } });
  D.protMedia = n ? Math.round(soma / n * 10) / 10 : null; D.protFora = D.protTotal - D.protNoPrazo;
  var aReceber = 0, nRec = 0; ativos.forEach(function(r){ var v = prReceberTotal(r, pm); if (v > 0.004){ aReceber += v; nRec++; } });
  D.aReceber = aReceber; D.nReceber = nRec;
  /* andamento: cada processo cai em um só grupo */
  var a = { andamento: 0, prazo: 0, parado: 0, arquivado: arq.length };
  ativos.forEach(function(r){ if (prPrazosAbertos(r).length) a.prazo++; else if (prParado(r, pm)) a.parado++; else a.andamento++; });
  D.andamento = a;
  var porArea = {}, porProc = {}; ativos.forEach(function(r){ var x = panArea(r), y = panProced(r); porArea[x] = (porArea[x] || 0) + 1; porProc[y] = (porProc[y] || 0) + 1; });
  D.porArea = Object.keys(porArea).map(function(k){ return [k, porArea[k]]; }).sort(function(x, y){ return y[1] - x[1] || x[0].localeCompare(y[0], 'pt-BR'); });
  D.porProc = Object.keys(porProc).map(function(k){ return [k, porProc[k]]; }).sort(function(x, y){ return y[1] - x[1] || x[0].localeCompare(y[0], 'pt-BR'); });
  /* novos por mês (últimos 12 meses, pelo cadastro) e carga de prazos nas próximas 8 semanas */
  var meses = [], ym = hoje.slice(0, 7), i;
  for (i = 11; i >= 0; i--){ var d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 - i, 1)); meses.push({ k: d.toISOString().slice(0, 7), n: 0 }); }
  todos.forEach(function(r){ var c = panDe(r).slice(0, 7); meses.forEach(function(m){ if (m.k === c) m.n++; }); });
  D.meses = meses;
  var semIni = agIniSemana(hoje), sem = []; for (i = 0; i < 8; i++) sem.push({ ini: pbSoma(semIni, 7 * i), n: 0, aud: 0 });
  agItens().forEach(function(it){
    if (it.concluido || it.data < hoje || (op.area && !(it.processo && nums[prNum(it.processo)]))) return;
    sem.forEach(function(s){ if (it.data >= s.ini && it.data <= pbSoma(s.ini, 6)){ if (it.tipo === 'audiencia') s.aud++; else if (it.tipo === 'prazo') s.n++; } });
  });
  D.semanas = sem;
  D.semProcCliente = ativos.filter(function(r){ return !prClienteIds(r).length; }).length;
  return D;
}

/* ---------- tela ---------- */
var AN_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function panBarra(rot, v, max, cor){ return '<div class="pan-bar" title="' + escapeHtml(rot + ': ' + v) + '"><span>' + escapeHtml(rot) + '</span><div class="pan-tr"><div class="pan-f" style="width:' + (max ? Math.max(2, Math.round(v * 100 / max)) : 0) + '%;background:' + cor + '"></div></div><b>' + v + '</b></div>'; }
function panCard(titulo, corpo, nota){ return '<div class="card pan-card"><div class="pb-sec-t">' + titulo + '</div>' + corpo + (nota ? '<div class="saldo-data">' + nota + '</div>' : '') + '</div>'; }
function panColunas(itens, rotulo){
  var mx = Math.max.apply(null, itens.map(function(x){ return x.n; }).concat([1]));
  return '<div class="pan-cols">' + itens.map(function(x){ return '<div class="pan-col" title="' + escapeHtml(rotulo(x) + ': ' + x.n) + '"><i>' + (x.n || '') + '</i><div style="height:' + Math.round(x.n * 64 / mx) + 'px"></div><span>' + escapeHtml(rotulo(x)) + '</span></div>'; }).join('') + '</div>';
}
function panHtml(D, op){
  var pct = function(a, b){ return b ? Math.round(a * 100 / b) + '%' : '—'; };
  var h = '<div class="pb-seg-lin"><div class="segmented" id="panPer">' + [['12m', 'Últimos 12 meses'], ['ano', 'Este ano'], ['tudo', 'Tudo']].map(function(f){ return '<button type="button" class="seg-btn' + (op.periodo === f[0] ? ' active' : '') + '" data-pan="periodo" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="field" style="margin:6px 0"><select id="pan_area" class="filter-select" data-pan="area" style="width:100%"><option value="">Todas as áreas</option>' + PR_AREAS.map(function(a){ return '<option' + (op.area === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div>';
  h += '<div class="pan-kpis"><div class="pan-kpi"><small>Processos em andamento</small><b>' + D.ativos + '</b><i>' + (D.novos30 ? '+' + D.novos30 + ' nos últimos 30 dias' : 'nenhum novo em 30 dias') + '</i></div>' +
    '<div class="pan-kpi"><small>Êxito nos encerrados</small><b>' + pct(D.resExito, D.resComRes) + '</b><i>' + D.resComRes + ' de ' + D.encerrados + ' com resultado</i></div>' +
    '<div class="pan-kpi"><small>Peças no prazo</small><b>' + pct(D.protNoPrazo, D.protTotal) + '</b><i>' + (D.protTotal ? (D.protMedia != null ? 'protocola ' + String(D.protMedia).replace('.', ',') + ' dia(s) antes do fatal' : 'nenhuma antes do fatal') : 'sem prazos protocolados no período') + '</i></div>' +
    '<div class="pan-kpi"><small>Honorários a receber</small><b style="font-size:' + (fmtMoeda(D.aReceber).length > 10 ? '19' : '24') + 'px;white-space:nowrap">' + fmtMoeda(D.aReceber) + '</b><i>' + D.nReceber + (D.nReceber === 1 ? ' processo' : ' processos') + '</i></div></div>';
  var a = D.andamento, tot = a.andamento + a.prazo + a.parado + a.arquivado || 1;
  var seg = [['Em andamento', a.andamento, 'var(--an1)'], ['Com prazo aberto', a.prazo, 'var(--an2)'], ['Parados há 60+ dias', a.parado, 'var(--an3)'], ['Arquivados no período', a.arquivado, 'var(--an0)']];
  h += panCard('Andamento dos processos', '<div class="pan-seg">' + seg.filter(function(x){ return x[1]; }).map(function(x){ return '<span style="width:' + Math.max(8, Math.round(x[1] * 100 / tot)) + '%;background:' + x[2] + (x[0] === 'Arquivados no período' ? ';color:#333' : '') + '" title="' + escapeHtml(x[0] + ': ' + x[1]) + '">' + x[1] + '</span>'; }).join('') + '</div><div class="pan-leg">' + seg.map(function(x){ return '<span><i style="background:' + x[2] + '"></i>' + x[0] + ' ' + x[1] + '</span>'; }).join('') + '</div>');
  var mxA = D.porArea.length ? D.porArea[0][1] : 1, mxP = D.porProc.length ? D.porProc[0][1] : 1;
  h += panCard('Processos por área', D.porArea.length ? D.porArea.map(function(x){ return panBarra(x[0], x[1], mxA, 'var(--an1)'); }).join('') : '<div class="saldo-data">Nenhum processo em andamento.</div>', 'A área é sugerida pelo tribunal e pela classe; corrija na ficha do processo.');
  h += panCard('Por procedimento', D.porProc.length ? D.porProc.map(function(x){ return panBarra(x[0], x[1], mxP, 'var(--an1)'); }).join('') : '<div class="saldo-data">Nenhum processo em andamento.</div>');
  var chaves = Object.keys(PR_RES), mxR = Math.max.apply(null, chaves.map(function(k){ return D.res[k] || 0; }).concat([1]));
  h += panCard('Resultado dos encerrados', D.resComRes ? chaves.filter(function(k){ return D.res[k]; }).map(function(k){ return panBarra(PR_RES[k], D.res[k], mxR, PR_RES_EXITO[k] ? 'var(--an1)' : 'var(--an0)'); }).join('') + '<div class="pan-leg"><span><i style="background:var(--an1)"></i>Êxito ' + D.resExito + ' (' + pct(D.resExito, D.resComRes) + ')</span><span><i style="background:var(--an0)"></i>Sem êxito ' + (D.resComRes - D.resExito) + '</span></div>' : '<div class="saldo-data">Nenhum processo arquivado com resultado neste período. Informe o resultado ao arquivar (ou na ficha do processo arquivado).</div>', D.encerrados > D.resComRes ? (D.encerrados - D.resComRes) + ' arquivado(s) sem resultado informado.' : '');
  h += panCard('Processos novos por mês (pelo cadastro)', panColunas(D.meses, function(m){ return AN_MES[Number(m.k.slice(5, 7)) - 1]; }));
  var aud = D.semanas.reduce(function(s, x){ return s + x.aud; }, 0);
  h += panCard('Carga de prazos nas próximas 8 semanas', panColunas(D.semanas, function(s){ return fmtData(s.ini).slice(0, 5); }), 'Prazos em aberto por semana (a semana começa na segunda)' + (aud ? '; mais ' + aud + (aud === 1 ? ' audiência' : ' audiências') + ' no período' : '') + '.');
  h += panCard('Quem pede atenção', '<div class="pb-lin"><span>Processos parados há mais de 60 dias</span><b>' + a.parado + '</b></div><div class="pb-lin"><span>Prazos protocolados fora do prazo</span><b>' + D.protFora + '</b></div><div class="pb-lin"><span>Processos sem cliente vinculado</span><b>' + D.semProcCliente + '</b></div>');
  h += '<button type="button" class="btn btn-ghost" data-pan="rel" style="width:100%;justify-content:center;margin-top:4px">🖨 Relatório das análises</button>';
  return h;
}
function panRender(){
  var el = qs('prAnalises'); if (!el) return;
  el.innerHTML = panHtml(panDados(panS), panS);
}
function panRelatorio(){
  rptAbrir({ titulo: 'Relatório das análises de processos', opcoes: [{ id: 'periodo', rot: 'Período', padrao: panS.periodo, valores: [['12m', 'Últimos 12 meses'], ['ano', 'Este ano'], ['tudo', 'Tudo']] }, { id: 'area', rot: 'Área', padrao: panS.area, valores: [['', 'Todas as áreas']].concat(PR_AREAS.map(function(a){ return [a, a]; })) }], gerar: function(op){
    var D = panDados(op), a = D.andamento, pct = function(x, y){ return y ? Math.round(x * 100 / y) + '%' : '—'; };
    var tab = function(cols, linhas){ return rptTabela(cols, linhas.map(function(l){ return l.map(function(c){ return rptE(c); }); })); };
    var html = '<h2 class="rpt-dia">Números de destaque</h2>' + tab(['Indicador', 'Valor', 'Detalhe'], [['Processos em andamento', String(D.ativos), D.novos30 + ' novos nos últimos 30 dias'], ['Êxito nos encerrados', pct(D.resExito, D.resComRes), D.resComRes + ' de ' + D.encerrados + ' com resultado'], ['Peças no prazo', pct(D.protNoPrazo, D.protTotal), D.protTotal + ' prazos protocolados' + (D.protMedia != null ? '; média de ' + String(D.protMedia).replace('.', ',') + ' dia(s) antes do fatal' : '')], ['Honorários a receber', fmtMoeda(D.aReceber), D.nReceber + ' processos']]);
    html += '<h2 class="rpt-dia">Andamento dos processos</h2>' + tab(['Situação', 'Processos'], [['Em andamento', String(a.andamento)], ['Com prazo aberto', String(a.prazo)], ['Parados há 60+ dias', String(a.parado)], ['Arquivados no período', String(a.arquivado)]]);
    html += '<h2 class="rpt-dia">Por área</h2>' + tab(['Área', 'Processos'], D.porArea.map(function(x){ return [x[0], String(x[1])]; }));
    html += '<h2 class="rpt-dia">Por procedimento</h2>' + tab(['Procedimento', 'Processos'], D.porProc.map(function(x){ return [x[0], String(x[1])]; }));
    html += '<h2 class="rpt-dia">Resultado dos encerrados</h2>' + tab(['Resultado', 'Processos'], Object.keys(PR_RES).filter(function(k){ return D.res[k]; }).map(function(k){ return [PR_RES[k] + (PR_RES_EXITO[k] ? ' (êxito)' : ''), String(D.res[k])]; }));
    html += '<h2 class="rpt-dia">Carga de prazos nas próximas 8 semanas</h2>' + tab(['Semana de', 'Prazos', 'Audiências'], D.semanas.map(function(s){ return [fmtData(s.ini), String(s.n), String(s.aud)]; }));
    html += '<h2 class="rpt-dia">Processos cadastrados por mês</h2>' + tab(['Mês', 'Processos'], D.meses.map(function(m){ return [AN_MES[Number(m.k.slice(5, 7)) - 1] + '/' + m.k.slice(0, 4), String(m.n)]; }));
    return { sub: (op.periodo === '12m' ? 'Últimos 12 meses' : (op.periodo === 'ano' ? 'Este ano' : 'Todo o período')) + (op.area ? ' · ' + op.area : ' · todas as áreas') + ' · ' + D.total + ' processos', html: html };
  } });
}
(function(){
  var st = document.createElement('style');
  st.textContent = ':root{--an1:#2a78d6;--an2:#eb6834;--an3:#1baf7a;--an0:#b9b8b2}:root[data-theme="dark"]{--an1:#3987e5;--an2:#d95926;--an3:#199e70;--an0:#6f6e69}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--an1:#3987e5;--an2:#d95926;--an3:#199e70;--an0:#6f6e69}}' +
    '.pan-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.pan-kpi{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:11px 13px}.pan-kpi small{display:block;color:var(--ink-soft);font-size:var(--t2)}.pan-kpi b{display:block;font-size:var(--t8,26px);line-height:1.15;overflow-wrap:anywhere}.pan-kpi i{display:block;font-style:normal;font-size:var(--t2);color:var(--ink-soft);margin-top:2px}' +
    '.pan-card{margin:8px 0}.pan-bar{display:grid;grid-template-columns:104px minmax(0,1fr) 34px;gap:8px;align-items:center;font-size:var(--t3);margin:7px 0}.pan-bar span{overflow-wrap:anywhere}.pan-tr{height:12px;background:var(--surface-2);border-radius:0 6px 6px 0;position:relative}.pan-f{position:absolute;left:0;top:0;bottom:0;border-radius:0 6px 6px 0}.pan-bar b{text-align:right}' +
    '.pan-seg{display:flex;height:28px;border-radius:8px;overflow:hidden;gap:2px;margin:8px 0 6px}.pan-seg span{display:grid;place-items:center;color:#fff;font-size:var(--t2);font-weight:800;min-width:0}.pan-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:var(--t2);color:var(--ink-soft);margin-top:6px}.pan-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}' +
    '.pan-cols{display:flex;gap:4px;align-items:flex-end;margin:10px 0 2px;min-height:96px}.pan-col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;font-size:var(--t1);color:var(--ink-soft)}.pan-col div{width:100%;max-width:18px;background:var(--an1);border-radius:4px 4px 0 0;min-height:2px}.pan-col i{font-style:normal;font-weight:700;color:var(--ink);min-height:12px}';
  document.head.appendChild(st);
})();
