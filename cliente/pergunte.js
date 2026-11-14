/* ============================================================
   PERGUNTE AO APP + ajustes de uso (alertas, metas com plano, busca ampliada, atalhos dinâmicos, desfazer)
   ============================================================ */
var paSamplePromise = null;
function paSample(){
  if (!paSamplePromise) paSamplePromise = Promise.resolve().then(function(){ return window.claude && window.claude.use ? window.claude.use('sample') : null; }).catch(function(){ return null; });
  return paSamplePromise;
}
function paNum(v){ return r2(Number(v) || 0); }
function paDocOrigem(u){ return u.origem === 'proprio' ? 'própria' : 'Murilo'; }

/* ---------- fatos: tudo calculado pelo app, em números prontos ---------- */
function paFatos(){
  var hoje = todayISO(), m0 = hoje.slice(0, 7);
  var un = listarUnidades();
  var receber = [], porCliente = {}, porOrigem = { Murilo: 0, 'própria': 0 }, vencido = 0, obraPendente = 0, recebidoMes = 0;
  un.forEach(function(u){
    var doc = anDocDaUnidade(u);
    var rest = restanteMeu(u);
    if (!(doc && doc.atipica)) recebidoMes += recebidoMesMeu(u, m0);
    if (rest <= 0.004) return;
    if (doc && doc.atipica){ obraPendente += rest; return; }
    var atras = !!(u.data && u.data < hoje);
    receber.push({ cliente: u.cliente, origem: paDocOrigem(u), tipo: u.label, vence: u.data || 'sem data', valor: paNum(rest), atrasado: atras, processo: u.processo || '', arquivado: !!u.arquivado });
    var k = u.cliente; porCliente[k] = paNum((porCliente[k] || 0) + rest);
    porOrigem[paDocOrigem(u)] = paNum(porOrigem[paDocOrigem(u)] + rest);
    if (atras) vencido += rest;
  });
  receber.sort(function(a, b){ return String(a.vence).localeCompare(String(b.vence)); });
  var pat = computePatrimonio(), res = computeReservaInfo(), cfg = getConfig();
  var fixas = { PF: [], PJ: [] };
  ['pf', 'pj'].forEach(function(col){
    despesas.forEach(function(d){
      if (d.coluna !== col || d.tipo !== 'fixa' || d.ativa === false || !despesaAplicaAoMes(d, m0)) return;
      var e = valorEstimadoFixa(d, m0);
      fixas[col.toUpperCase()].push({ nome: d.nome, valor: paNum(e.valor), dia: d.diaVencimento || null });
    });
  });
  var proj = anProjecao(6);
  var obra = null;
  try{ if (obraCfg().criada){ var o = obraResumo(); obra = { saldoConta: o.saldo, jaPago: o.pago, aPagar: o.aPagar, faltaGastar: o.faltaGastar, orcamento: o.orcamento }; } }catch(e){}
  return {
    hoje: hoje, mesAtual: m0,
    saldos: { PF: paNum(pat.saldoPf), PJ: paNum(pat.saldoPj), repasseAPagarAParceiros: paNum(pat.repasseAPagar) },
    patrimonio: { total: paNum(pat.total), metas: pat.metas.map(function(x){ return { nome: x.meta.nome, tipo: x.meta.tipo, valorAtual: paNum(x.valor), alvo: metaAlvo(x.meta), prazo: x.meta.prazo || null }; }) },
    reserva: { meses: res.meses, alvo: paNum(res.alvo), atual: paNum(res.atual), falta: paNum(res.falta) },
    margemEPorLabore: { proLaborePct: cfg.proLaborePct },
    recebidoNoMes: paNum(recebidoMes),
    aReceber: { totalSeusHonorarios: paNum(receber.reduce(function(t, x){ return t + x.valor; }, 0)), vencido: paNum(vencido), porOrigem: porOrigem, porCliente: porCliente, obraPendente: paNum(obraPendente) },
    parcelasEAlvaras: receber.slice(0, 70),
    despesasFixasDoMes: fixas,
    projecaoMensal: proj.linhas.map(function(l){ return { mes: l.m, parcelasPrevistas: l.parc, receitasFixas: l.fixas, alvarasPrevistos: l.alvaras, atrasadosQueEntrariam: l.atrasados, despesas: l.desp, diaADia: l.dia, saldoSemAlvaras: l.saldoBase, saldoComAlvaras: l.saldoAlv }; }),
    caixaHojeParaProjecao: proj.ini, semDataPrevista: proj.semData,
    obra: obra
  };
}

/* ---------- simulador "e se" (determinístico: o Claude só interpreta e explica) ---------- */
function paSimular(c){
  var m0 = todayISO().slice(0, 7);
  var valor = Math.abs(Number(c.valor) || 0), n = Math.max(1, Math.min(60, parseInt(c.parcelas, 10) || 1));
  var entrada = Math.max(0, Number(c.entrada) || 0);
  var mesIni = /^\d{4}-\d{2}$/.test(c.mes || '') && c.mes >= m0 ? c.mes : m0;
  var sinal = c.tipoEvento === 'entrada' ? 1 : -1;
  var desl = 0; for (var mm = m0; mm < mesIni; mm = deslocarMes(mm, 1)) desl++;
  var H = Math.min(24, Math.max(6, desl + n + 2));
  var proj = anProjecao(H);
  var restante = Math.max(0, valor - entrada), parc = n > 1 ? r2(restante / n) : restante;
  var delta = proj.linhas.map(function(l, i){
    var k = i - desl, v = 0;
    if (n === 1){ if (k === 0) v = valor; }
    else { if (k === 0) v += entrada; if (k >= 0 && k < n) v += parc; }
    return r2(sinal * v);
  });
  var acum = 0, linhas = proj.linhas.map(function(l, i){
    acum = r2(acum + delta[i]);
    return { mes: l.m, saldoSemAlvaras: l.saldoBase, saldoSemAlvarasComCenario: r2(l.saldoBase + acum), saldoComAlvaras: l.saldoAlv, saldoComAlvarasComCenario: r2(l.saldoAlv + acum), movimentoDoCenario: delta[i] };
  });
  var pior = linhas.reduce(function(a, l){ return !a || l.saldoSemAlvarasComCenario < a.saldoSemAlvarasComCenario ? l : a; }, null);
  var primeiroNeg = linhas.filter(function(l){ return l.saldoSemAlvarasComCenario < 0; })[0] || null;
  var primeiroNegSem = linhas.filter(function(l){ return l.saldoSemAlvaras < 0; })[0] || null;
  var res = computeReservaInfo();
  return {
    cenario: { descricao: c.descricao || '', tipo: sinal > 0 ? 'entrada extra' : 'gasto', valorTotal: r2(valor), mesDoPrimeiroPagamento: mesIni, parcelas: n, entrada: r2(entrada), valorDeCadaParcela: n > 1 ? parc : null },
    caixaHoje: proj.ini, reservaAtual: paNum(res.atual), reservaAlvo: paNum(res.alvo),
    linhas: linhas,
    piorMesSemAlvaras: pior ? { mes: pior.mes, saldo: pior.saldoSemAlvarasComCenario } : null,
    primeiroMesNegativoComCenario: primeiroNeg ? primeiroNeg.mes : null,
    primeiroMesNegativoSemCenario: primeiroNegSem ? primeiroNegSem.mes : null
  };
}

/* ---------- conversa com o Claude (duas chamadas: entender a pergunta, responder com os números) ---------- */
function paPromptEntender(pergunta){
  var hoje = todayISO();
  return 'Você é o assistente de um app financeiro de um advogado brasileiro. Classifique a pergunta e responda SOMENTE um JSON, sem texto fora dele.\n' +
    'Hoje é ' + hoje + '.\nTipos: "consulta" (quer saber números que já existem: quanto alguém deve, quanto vai receber, saldo, despesas, metas, obra), "cenario" (pergunta hipotética sobre gastar ou receber algo novo: "posso comprar...", "e se eu trocar de carro em...", "consigo pagar...") ou "fora" (nada a ver com as finanças do app).\n' +
    'Formato: {"tipo":"consulta|cenario|fora","cenario":null ou {"descricao":"o que é","tipoEvento":"gasto|entrada","valor":número em reais ou null se a pessoa não disse,"mes":"AAAA-MM do primeiro pagamento ou null","parcelas":número de parcelas (1 se à vista),"entrada":valor de entrada em reais (0 se não houver)}}\n' +
    'Datas: "em dezembro" = o próximo dezembro a partir de hoje; "mês que vem" = mês seguinte. Valores: "30 mil" = 30000.\nPergunta: """' + pergunta.slice(0, 600) + '"""';
}
function paPromptResponder(pergunta, fatos, sim, historico){
  var h = (historico || []).slice(-4).map(function(t){ return (t.q ? 'Pessoa: ' + t.q : '') + (t.a ? '\nApp: ' + t.a : ''); }).join('\n');
  return 'Você é o assistente do app "Horus" de um advogado (o dono do app). Responda em português do Brasil, em tom direto e amigável, curto (no máximo 8 linhas), usando SOMENTE os números do CONTEXTO abaixo. Não invente valores nem clientes. Se o dado não estiver no contexto, diga exatamente o que falta. Escreva valores como R$ 1.234,56. Pode usar **negrito** e listas curtas com "-".\n' +
    'Regras: "aReceber" são os honorários do advogado (já descontado repasse). "Murilo" é um parceiro que paga parte dos clientes. saldoSemAlvaras considera só parcelas e receitas fixas; saldoComAlvaras inclui os alvarás previstos (incertos, a data pode mudar).\n' +
    (sim ? 'Foi feita uma SIMULAÇÃO determinística do cenário (campo SIMULACAO). Explique: se cabe, em qual mês o caixa fica mais apertado, se algum mês fica negativo e o que isso significa; compare com a reserva; se não couber, sugira uma alternativa com números (por exemplo mais parcelas ou outro mês) — se quiser testar outra alternativa, diga qual e peça para a pessoa perguntar de novo. Deixe claro que é uma projeção, não garantia. Se o valor do cenário não foi informado, peça o valor.\n' : '') +
    (h ? 'CONVERSA RECENTE:\n' + h + '\n' : '') +
    'CONTEXTO (JSON):\n' + JSON.stringify(fatos) + '\n' + (sim ? 'SIMULACAO (JSON):\n' + JSON.stringify(sim) + '\n' : '') +
    'PERGUNTA: """' + pergunta.slice(0, 600) + '"""';
}
function paJson(txt){
  var t = String(txt || '').replace(/```json|```/g, ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try{ return JSON.parse(t.slice(a, b + 1)); }catch(e){ return null; }
}
var paHistorico = [], paCtrl = null, paOcupado = false;
function paMsgErro(e){
  var c = e && e.code;
  if (c === 'sem_credito') return 'Acabou o crédito da conta do Claude. Adicione crédito no Console e tente de novo.';
  if (c === 'rate_limited') return 'Muitas perguntas seguidas. Aguarde um instante.';
  if (c === 'cancelled') return '';
  return (e && e.message) ? e.message : 'Não consegui responder agora.';
}
function paRender(){
  var box = qs('paMsgs'); if (!box) return;
  box.innerHTML = paHistorico.map(function(t, ti){
    var a = t.a ? '<div class="pa-b pa-a">' + paTextoHtml(t.a) + (t.sim ? paTabelaSim(t.sim) + (t.cen ? '<div class="ob-acoes"><button type="button" class="btn btn-ghost" data-sim-pergunte="' + ti + '">Abrir no Simulador</button></div>' : '') : '') + '</div>' : (t.erro ? '<div class="pa-b pa-e">' + escapeHtml(t.erro) + '</div>' : '<div class="pa-b pa-a pa-pensando">Pensando…</div>');
    return '<div class="pa-b pa-q">' + escapeHtml(t.q) + '</div>' + a;
  }).join('');
  box.scrollTop = box.scrollHeight;
  var ch = qs('paChips'); if (ch) ch.style.display = paHistorico.length ? 'none' : '';
  qs('paEnviar').style.display = paOcupado ? 'none' : ''; qs('paParar').style.display = paOcupado ? '' : 'none';
}
function paTextoHtml(t){
  return escapeHtml(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n- /g, '\n• ').replace(/\n/g, '<br>');
}
function paTabelaSim(sim){
  var l = sim.linhas.slice(0, Math.min(sim.linhas.length, 8));
  return '<details class="pa-det"><summary>Ver a projeção mês a mês</summary><div class="pa-tab"><div class="pa-th"><span>Mês</span><span>Sem o cenário</span><span>Com o cenário</span></div>' +
    l.map(function(x){ return '<div class="pa-tr"><span>' + escapeHtml(mesLabel(x.mes)) + '</span><span>' + fmtMoeda(x.saldoSemAlvaras) + '</span><span' + (x.saldoSemAlvarasComCenario < 0 ? ' class="pa-neg"' : '') + '>' + fmtMoeda(x.saldoSemAlvarasComCenario) + '</span></div>'; }).join('') +
    '</div><div class="saldo-data">Saldos livres previstos (PF + PJ), só com parcelas e receitas fixas; alvarás ficam de fora.</div></details>';
}
function paPerguntar(pergunta){
  pergunta = String(pergunta || '').trim();
  if (!pergunta || paOcupado) return Promise.resolve();
  return paSample().then(function(sample){
    if (!sample){ paHistorico.push({ q: pergunta, erro: 'O assistente ainda não está ligado neste servidor (falta a chave do Claude).' }); paRender(); return; }
    var turno = { q: pergunta }; paHistorico.push(turno); paOcupado = true; paCtrl = new AbortController(); paRender();
    var opts = function(t){ return { modelTier: t, signal: paCtrl.signal }; };
    return Promise.resolve(sample(paPromptEntender(pergunta), opts('quick'))).then(function(r1){
      var cls = paJson(r1 && r1.text) || { tipo: 'consulta' };
      if (cls.tipo === 'fora'){ turno.a = 'Eu só consigo responder sobre as finanças e os processos que estão no app. Pergunte, por exemplo, "quanto o Murilo me deve?" ou "posso comprar um carro de R$ 60 mil em março?".'; return null; }
      var fatos = paFatos(), sim = null;
      if (cls.tipo === 'cenario' && cls.cenario && Number(cls.cenario.valor) > 0) sim = paSimular(cls.cenario);
      turno.sim = sim; turno.cen = sim ? cls.cenario : null;
      return Promise.resolve(sample(paPromptResponder(pergunta, fatos, sim, paHistorico.slice(0, -1)), opts('default'))).then(function(r2x){ turno.a = String((r2x && r2x.text) || '').trim() || 'Não consegui montar a resposta.'; });
    }).catch(function(e){ var m = paMsgErro(e); if (m) turno.erro = m; else paHistorico.pop(); }).then(function(){ paOcupado = false; paCtrl = null; paRender(); });
  });
}
function paAbrir(pergunta){
  qs('overlayPergunte').classList.add('show');
  paRender();
  paSample().then(function(s){ var aviso = qs('paAviso'); if (aviso) aviso.style.display = s ? 'none' : ''; });
  if (pergunta){ qs('paInput').value = ''; paPerguntar(pergunta); } else setTimeout(function(){ qs('paInput').focus(); }, 60);
}
function paFechar(){ if (paCtrl){ try{ paCtrl.abort(); }catch(e){} } qs('overlayPergunte').classList.remove('show'); }
var PA_SUGESTOES = ['Quanto o Murilo me deve?', 'Quanto vou receber nos próximos 3 meses?', 'Posso comprar uma geladeira de R$ 5 mil no mês que vem?', 'E se eu trocar de carro (R$ 80 mil, entrada de R$ 30 mil, 36 parcelas) em março?', 'Quais parcelas estão atrasadas?', 'Como está a obra?'];
function paMontarTela(){
  if (qs('overlayPergunte')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayPergunte';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Pergunte ao app</h2><button class="icon-btn" id="paFechar" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<div class="modal-body"><div class="saldo-data" id="paAviso" style="display:none;color:var(--danger)">O assistente precisa da chave do Claude no servidor (ANTHROPIC_API_KEY).</div>' +
    '<div class="pa-chips" id="paChips">' + PA_SUGESTOES.map(function(s){ return '<button type="button" class="pa-chip" data-pa-q="' + escapeHtml(s) + '">' + escapeHtml(s) + '</button>'; }).join('') + '</div>' +
    '<div class="pa-msgs" id="paMsgs"></div>' +
    '<div class="saldo-data">As respostas usam os números atuais do app. Para decisões importantes, confira os valores.</div></div>' +
    '<div class="modal-foot pa-foot"><input type="text" id="paInput" placeholder="Pergunte sobre seus números ou um “e se”…" autocomplete="off"><button class="btn btn-primary" id="paEnviar" type="button">Enviar</button><button class="btn btn-ghost" id="paParar" type="button" style="display:none">Parar</button></div></div>';
  document.body.appendChild(d);
  var st = document.createElement('style');
  st.textContent = '.pa-chips{display:flex;flex-wrap:wrap;gap:6px}.pa-chip{border:1px solid var(--border);background:var(--surface);color:var(--ink);border-radius:99px;padding:7px 12px;font-size:var(--t3);cursor:pointer;text-align:left}' +
    '.pa-msgs{display:flex;flex-direction:column;gap:8px;max-height:46vh;overflow-y:auto}.pa-b{border-radius:14px;padding:10px 13px;font-size:var(--t4);line-height:1.45;max-width:94%}.pa-q{align-self:flex-end;background:var(--accent);color:var(--accent-ink)}.pa-a{align-self:flex-start;background:var(--surface-2)}.pa-e{align-self:flex-start;background:var(--surface-2);color:var(--danger)}.pa-pensando{opacity:.7}' +
    '.pa-foot{gap:8px}.pa-foot input{flex:1;min-width:0;padding:11px 12px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--ink);font-size:var(--t5)}' +
    '.pa-det{margin-top:8px}.pa-det summary{cursor:pointer;font-size:var(--t3);color:var(--accent)}.pa-tab{margin-top:6px}.pa-th,.pa-tr{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:var(--t2);padding:3px 0;border-bottom:1px solid var(--border)}.pa-th{color:var(--ink-soft)}.pa-tr span:not(:first-child),.pa-th span:not(:first-child){text-align:right}.pa-neg{color:var(--danger);font-weight:700}';
  document.head.appendChild(st);
  qs('paFechar').addEventListener('click', paFechar);
  d.addEventListener('click', function(e){ if (e.target === d) paFechar(); var c = e.target.closest ? e.target.closest('[data-pa-q]') : null; if (c){ qs('paInput').value = ''; paPerguntar(c.getAttribute('data-pa-q')); } });
  qs('paEnviar').addEventListener('click', function(){ var v = qs('paInput').value; qs('paInput').value = ''; paPerguntar(v); });
  qs('paParar').addEventListener('click', function(){ if (paCtrl) paCtrl.abort(); });
  qs('paInput').addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); qs('paEnviar').click(); } });
}
paMontarTela();

/* ---------- onde abrir ---------- */
(function(){
  var dr = qs('abrirRecebiBtn');
  if (dr && dr.parentNode){ var it = document.createElement('button'); it.type = 'button'; it.className = 'dr-it'; it.id = 'abrirPergunteBtn'; it.style.display = 'none'; it.title = 'Pergunte ao app'; it.innerHTML = '<svg><use href="#ic-ask"/></svg><span class="lab">Pergunte ao app</span>'; dr.parentNode.insertBefore(it, dr); }
  paSample().then(function(s){ ['inicioPergunte', 'abrirPergunteBtn'].forEach(function(id){ var e = qs(id); if (e) e.style.display = s ? '' : 'none'; }); });
  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target.closest('#inicioPergunte, #abrirPergunteBtn, [data-pa-abrir]') : null;
    if (!t) return;
    if (t.id === 'abrirPergunteBtn' && typeof fecharMenu === 'function') fecharMenu();
    paUsar('pergunte');
    paAbrir(t.getAttribute('data-pa-abrir') || '');
  });
})();

/* ---------- alertas que pensam (calculados pelo app, sem IA) — aparecem como linhas da Central de atenção ---------- */
function paAlertas(){
  var a = [], hoje = todayISO(), m0 = hoje.slice(0, 7);
  var proj; try{ proj = anProjecao(4); }catch(e){ return a; }
  var neg = proj.linhas.filter(function(l){ return l.saldoBase < 0; })[0];
  if (neg) a.push({ chave: 'caixa|' + neg.m, nivel: 'alto', titulo: 'Caixa previsto negativo em ' + mesLabel(neg.m), detalhe: 'Só com parcelas e receitas fixas, sem contar alvarás.', valor: neg.saldoBase, q: 'O que posso fazer para o caixa não ficar negativo em ' + mesLabel(neg.m) + '?' });
  var un = listarUnidades().filter(function(u){ var d = anDocDaUnidade(u); return !(d && d.atipica) && !u.arquivado && restanteMeu(u) > 0.004 && u.data && u.data < hoje; });
  var porCli = {};
  un.forEach(function(u){ var k = u.cliente; (porCli[k] = porCli[k] || { n: 0, v: 0, antiga: u.data }).n++; porCli[k].v += restanteMeu(u); if (u.data < porCli[k].antiga) porCli[k].antiga = u.data; });
  Object.keys(porCli).filter(function(k){ return porCli[k].n >= 2; }).sort(function(x, y){ return porCli[y].v - porCli[x].v; }).slice(0, 2).forEach(function(k){
    a.push({ chave: 'cliente|' + k, nivel: 'medio', titulo: k + ': ' + porCli[k].n + ' parcelas vencidas', detalhe: 'A mais antiga venceu em ' + fmtData(porCli[k].antiga) + '.', valor: r2(porCli[k].v), q: 'Resuma o que ' + k + ' me deve' });
  });
  var res = computeReservaInfo();
  if (res.existe && res.alvo > 0 && res.atual < res.alvo * 0.5) a.push({ chave: 'reserva', nivel: 'medio', titulo: 'Reserva de emergência em ' + Math.round(res.atual / res.alvo * 100) + '% do alvo', detalhe: fmtMoeda(res.atual) + ' de ' + fmtMoeda(res.alvo) + '.', valor: r2(res.alvo - res.atual), q: 'Como posso completar a reserva de emergência?' });
  despesas.forEach(function(d){
    if (d.tipo !== 'fixa' || d.ativa === false || !d.pagamentos) return;
    var ms = Object.keys(d.pagamentos).filter(function(k){ return k < m0 && d.pagamentos[k] && d.pagamentos[k].valor > 0; }).sort().slice(-4);
    var atualReg = d.pagamentos[m0] && d.pagamentos[m0].valor;
    if (ms.length >= 3 && atualReg > 0){ var med = ms.reduce(function(t, k){ return t + d.pagamentos[k].valor; }, 0) / ms.length; if (atualReg > med * 1.25 && atualReg - med > 30) a.push({ chave: 'despesa|' + d.id, nivel: 'baixo', titulo: d.nome + ' veio mais cara', detalhe: Math.round((atualReg / med - 1) * 100) + '% acima da média recente (' + fmtMoeda(med) + ').', valor: r2(atualReg), q: '' }); }
  });
  var prox = listarUnidades().filter(function(u){ return u.docTipo === 'alvara' && !u.pago && u.data && u.data >= hoje && u.data <= somarDias(hoje, 10) && restanteMeu(u) > 0.004; });
  if (prox.length) a.push({ chave: 'alvara|' + prox[0].docId, nivel: 'baixo', titulo: 'Alvará previsto: ' + prox[0].cliente, detalhe: 'Previsão para ' + fmtData(prox[0].data) + '.', valor: r2(restanteMeu(prox[0])), q: '' });
  var ordem = { alto: 0, medio: 1, baixo: 2 }, disp = paDispGet();
  a.sort(function(x, y){ return ordem[x.nivel] - ordem[y.nivel]; });
  var visiveis = a.filter(function(x){ return disp.indexOf(x.chave) < 0; });
  visiveis.dispensados = a.length - visiveis.length;
  var saida = visiveis.slice(0, 3); saida.dispensados = visiveis.dispensados; return saida;
}
/* alertas dispensados: valem só no mês atual; no mês seguinte o alerta volta se ainda fizer sentido */
function paDispGet(){ var c = config.alertasDispensados || {}; var l = c[todayISO().slice(0, 7)]; return Array.isArray(l) ? l : []; }
function paDispSet(lista){
  var dados = {}; dados[todayISO().slice(0, 7)] = lista;
  config.alertasDispensados = dados;
  paAlertasCache.t = 0;
  if (storageMode === 'db' && configRef) return Promise.resolve(configRef.doc('alertasDispensados').set(dados));
  saveLocalConfig(); return Promise.resolve();
}
var paAlertasCache = { t: 0, v: [] };
function paAlertasRapido(){ var agora = Date.now(); if (agora - paAlertasCache.t > 1500){ try{ paAlertasCache = { t: agora, v: paAlertas() }; }catch(e){ console.error('alertas', e); paAlertasCache = { t: agora, v: [] }; } } return paAlertasCache.v; }
document.addEventListener('click', function(ev){
  var d = ev.target.closest ? ev.target.closest('[data-pa-disp], [data-pa-restaurar]') : null; if (!d) return;
  ev.stopPropagation();
  var atual = paDispGet().slice();
  if (d.hasAttribute('data-pa-restaurar')){ paDispSet([]).then(function(){ renderPainelAtencao(); }); return; }
  var ch = d.getAttribute('data-pa-disp'); if (atual.indexOf(ch) < 0) atual.push(ch);
  paDispSet(atual).then(function(){
    renderPainelAtencao();
    toast('Alerta dispensado até o fim do mês.', 'Desfazer', function(){ paDispSet(paDispGet().filter(function(x){ return x !== ch; })).then(function(){ renderPainelAtencao(); }); });
  });
});
var paSampleOk = false; paSample().then(function(s){ paSampleOk = !!s; paAlertasCache.t = 0; try{ renderPainelAtencao(); }catch(e){} });
function paTemSample(){ return paSampleOk; }
function paLinhaAlerta(a){
  var tom = a.nivel === 'alto' ? 'up-d-atraso' : (a.nivel === 'medio' ? 'up-d-aviso' : 'up-d-info');
  return '<div class="stall-chip pa-linha" data-pa-alerta="1"><div class="up-data ' + tom + '"><svg><use href="#ic-warn"/></svg></div>' +
    '<div class="up-top"><span>' + escapeHtml(a.titulo) + '</span>' + (a.valor !== null && a.valor !== undefined ? '<span>' + fmtMoeda(a.valor) + '</span>' : '') + '</div>' +
    '<div class="up-when">' + escapeHtml(a.detalhe) + (a.q && paTemSample() ? ' <button type="button" class="pa-ask" data-pa-abrir="' + escapeHtml(a.q) + '" title="Perguntar ao app" aria-label="Perguntar ao app"><svg><use href="#ic-ask"/></svg></button>' : '') + ' <button type="button" class="pa-disp" data-pa-disp="' + escapeHtml(a.chave) + '" title="Dispensar este alerta neste mês">Dispensar</button></div></div>';
}
function paInserirAlertas(){
  var lista = qs('atencaoLista'), sec = qs('atencaoSection'); if (!lista || !sec) return;
  Array.prototype.forEach.call(lista.querySelectorAll('[data-pa-alerta], [data-pa-rest]'), function(e){ e.remove(); });
  var a = paAlertasRapido(), nd = a.dispensados || 0;
  Array.prototype.forEach.call(lista.querySelectorAll('[data-pa-rest]'), function(e){ e.remove(); });
  if (!a.length && !(nd && sec.style.display !== 'none')) return;
  sec.style.display = ''; var vz = qs('atencaoVazio'); if (vz) vz.style.display = 'none';
  lista.insertAdjacentHTML('afterbegin', a.map(paLinhaAlerta).join('') + (nd ? '<div class="pa-rest" data-pa-rest="1"><button type="button" class="btn-text" data-pa-restaurar="1">' + nd + ' alerta' + (nd > 1 ? 's' : '') + ' dispensado' + (nd > 1 ? 's' : '') + ' neste mês · mostrar de novo</button></div>' : ''));
  var bd = qs('atencaoBadge'); if (bd){ var tot = (parseInt(bd.getAttribute('data-itens') || bd.textContent, 10) || 0) + a.length; bd.textContent = tot; try{ atualizarContagensMenu(tot); }catch(e){} var mais = qs('atencaoMais'); if (mais && tot > 5){ mais.style.display = ''; if (!/Mostrar menos/.test(mais.textContent)) mais.textContent = 'Ver todos (' + tot + ')'; } }
}

/* ---------- metas com plano ---------- */
function paMetaPlanoHtml(m, falta, meses){
  if (!(falta > 0) || !meses) return '';
  var precisa = r2(falta / meses), proj;
  try{ proj = anProjecao(Math.min(6, Math.max(2, meses))); }catch(e){ return ''; }
  var l = proj.linhas, tam = l.length;
  var sobraMedia = tam ? r2((l[tam - 1].saldoBase - proj.ini) / tam) : 0;
  var cabe = sobraMedia >= precisa;
  return '<div class="saldo-data">Plano: guarde <b>' + fmtMoeda(precisa) + '</b> por mês até ' + escapeHtml(fmtData(m.prazo)) + '. Pelo seu fluxo previsto (parcelas e receitas fixas menos despesas), sobram em média <b>' + fmtMoeda(sobraMedia) + '</b> por mês: ' + (cabe ? 'cabe no seu fluxo.' : (sobraMedia > 0 ? 'fica apertado; considere um prazo maior ou aportes maiores quando entrar um alvará.' : 'não sobra caixa; só com alvarás ou receitas novas.')) + '</div>';
}

/* ---------- fechamento comentado ---------- */
(function(){
  var corpo = qs('fechamentoTexto'); if (!corpo || !corpo.parentNode) return;
  var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn-ghost'; btn.id = 'comentarFechamentoBtn'; btn.textContent = 'Comentar o mês'; btn.style.display = 'none';
  var out = document.createElement('div'); out.id = 'fechamentoComentario'; out.className = 'pa-b pa-a'; out.style.display = 'none'; out.style.maxWidth = '100%';
  corpo.parentNode.appendChild(btn); corpo.parentNode.appendChild(out);
  paSample().then(function(s){ if (s) btn.style.display = ''; });
  btn.addEventListener('click', function(){
    paSample().then(function(sample){
      if (!sample) return;
      btn.disabled = true; out.style.display = ''; out.textContent = 'Analisando o mês…';
      var mes = mesSelecionado, texto = gerarFechamentoTexto(), prev = '';
      try{ var guard = mesSelecionado; mesSelecionado = deslocarMes(mes, -1); prev = gerarFechamentoTexto(); mesSelecionado = guard; }catch(e){ mesSelecionado = mes; }
      var prompt = 'Você é o assistente de um advogado brasileiro. Abaixo estão o fechamento do mês ' + mesLabel(mes) + ' e o do mês anterior. Escreva, em português, um comentário curto (máximo 8 linhas): o que foi bem, o que merece atenção, a principal diferença para o mês anterior e uma sugestão prática. Use SOMENTE os números dos textos; não invente. Valores como R$ 1.234,56.\nFECHAMENTO ATUAL:\n' + texto.slice(0, 9000) + '\nFECHAMENTO DO MÊS ANTERIOR:\n' + prev.slice(0, 9000);
      Promise.resolve(sample(prompt, { modelTier: 'default' })).then(function(r){ out.innerHTML = paTextoHtml(String((r && r.text) || '').trim() || 'Sem comentário.'); }, function(e){ out.textContent = paMsgErro(e) || 'Não consegui comentar agora.'; }).then(function(){ btn.disabled = false; });
    });
  });
})();

/* ---------- busca global ampliada ---------- */
var paBuscaExtra = { despesa: 'Despesa', receita: 'Receita', meta: 'Meta', obra: 'Obra', extrato: 'Extrato' };
function paBuscarExtra(q){
  var nq = normNome(q), dq = q.replace(/[^\d,.]/g, '');
  var num = null; if (/^\s*r?\$?\s*[\d.]+(,\d{1,2})?\s*$/i.test(q)){ var x = String(q).replace(/[^\d,.]/g, ''); if (x.indexOf(',') >= 0) x = x.replace(/\./g, '').replace(',', '.'); num = parseFloat(x); if (!isFinite(num)) num = null; }
  var out = [];
  function ach(txt){ return nq && normNome(txt).indexOf(nq) !== -1; }
  function igual(v){ return num !== null && Math.abs(Number(v) - num) < 0.005; }
  despesas.forEach(function(d){ if (ach(d.nome) || igual(d.valorPadrao) || igual(d.valor)) out.push({ tipo: 'despesa', id: d.id, titulo: d.nome, sub: (d.coluna === 'pj' ? 'PJ' : 'PF') + ' · ' + (d.tipo === 'fixa' ? 'fixa' : 'única') + (d.valorPadrao ? ' · ' + fmtMoeda(d.valorPadrao) : '') }); });
  receitasManuais.forEach(function(r){ if (ach(r.descricao) || igual(r.valor)) out.push({ tipo: 'receita', id: r.id, titulo: r.descricao || 'Receita', sub: (r.coluna === 'pj' ? 'PJ' : 'PF') + (r.valor ? ' · ' + fmtMoeda(r.valor) : '') }); });
  metas.forEach(function(m){ if (ach(m.nome)) out.push({ tipo: 'meta', id: m.id, titulo: m.nome, sub: m.tipo === 'reserva' ? 'Reserva de emergência' : 'Meta' }); });
  try{ obraMovTodos().forEach(function(m){ if (m.tipo !== 'gasto') return; if (ach((m.descricao || '') + ' ' + (m.fornecedor || '') + ' ' + (m.nf || '')) || igual(m.valor)) out.push({ tipo: 'obra', id: m.id, titulo: m.descricao || 'Gasto da obra', sub: (m.fornecedor || '') + ' · ' + fmtMoeda(m.valor) }); }); }catch(e){}
  extratos.forEach(function(d){ if (d.tipo !== 'arquivo' || d.status !== 'pendente') return; (d.lanc || []).forEach(function(l){ if (ach(l.s + ' ' + (l.n || '')) || igual(Math.abs(l.v) / 100)) out.push({ tipo: 'extrato', id: d.id, titulo: l.s, sub: fmtData(l.d) + ' · ' + fmtMoeda(l.v / 100) }); }); });
  /* valores nos documentos (honorários, parcelas) */
  if (num !== null){
    listarUnidades().forEach(function(u){ if (igual(u.valor)) out.push({ tipo: u.docTipo === 'caso' ? 'peticao' : u.docTipo, id: u.docId, titulo: u.cliente, sub: u.label + ' · ' + fmtMoeda(u.valor) }); });
  }
  return out;
}
function paIrExtra(tipo, id){
  if (tipo === 'despesa' || tipo === 'receita') setActiveTab('financeiro');
  else if (tipo === 'meta') setActiveTab('financeiro');
  else if (tipo === 'obra') setActiveTab('obra');
  else if (tipo === 'extrato') setActiveTab('extratos');
}
(function(){
  var inp = qs('buscaGlobalInput'); if (inp) inp.placeholder = (window.__papel && window.__papel !== 'proprietario') ? 'Buscar em tudo: clientes, processos, publicações…' : 'Buscar em tudo: clientes, processos, despesas, obra, valores…';
})();

/* ---------- folha "Novo" (cadastros e ações), ordenada pelo que você mais usa ---------- */
var PA_USO_KEY = 'controle.atalhos.uso.v1';
function paUsoLer(){ try{ return JSON.parse(localStorage.getItem(PA_USO_KEY) || '{}') || {}; }catch(e){ return {}; } }
function paUsar(k){ var u = paUsoLer(); u[k] = (u[k] || 0) + 1; try{ localStorage.setItem(PA_USO_KEY, JSON.stringify(u)); }catch(e){} }
var PA_NOVO = [
  { k: 'recebi', t: 'Recebi R$', i: 'ic-coin', f: function(){ abrirRecebi(); }, dono: true },
  { k: 'peticao', t: 'Inicial', i: 'ic-file', f: function(){ abrirNovo(); } },
  { k: 'acordo', t: 'Acordo', i: 'ic-clip', f: function(){ abrirNovoAcordo(); } },
  { k: 'alvara', t: 'Alvará', i: 'ic-stamp', f: function(){ abrirNovoAlvara(); } },
  { k: 'processo', t: 'Processo', i: 'ic-proc', f: function(){ prAbrirNovo(null); } },
  { k: 'prazo', t: 'Prazo', i: 'ic-agenda', f: function(){ agAbrir(null); } },
  { k: 'despesa', t: 'Despesa', i: 'ic-receipt', f: function(){ abrirNovaDespesa('pj'); }, dono: true },
  { k: 'cliente', t: 'Cliente', i: 'ic-users', f: function(){ abrirClienteEdit({}); } },
  { k: 'foto', t: 'Foto ou PDF', i: 'ic-cam', f: function(){ ldAbrir(); }, ia: true },
  { k: 'extratos', t: 'Extratos', i: 'ic-bank', f: function(){ setActiveTab('extratos'); }, dono: true },
  { k: 'pergunte', t: 'Pergunte', i: 'ic-ask', f: function(){ paAbrir(''); }, ia: true }
];
function paNovoHtml(){
  var uso = paUsoLer(), tab = (typeof activeTab !== 'undefined') ? activeTab : '';
  var primeiro = { peticoes: 'peticao', acordos: 'acordo', alvaras: 'alvara', clientes: 'cliente' }[tab] || '';
  var itens = PA_NOVO.filter(function(x){ return (!x.ia || paTemSample()) && (!x.dono || ppDono()); }).map(function(x, i){ return { x: x, i: i, n: x.k === primeiro ? 1e9 : (uso[x.k] || 0) }; });
  itens.sort(function(a, b){ return b.n - a.n || a.i - b.i; });
  return itens.map(function(o, i){ return '<button type="button" class="novo-it' + (i === 0 ? ' novo-1' : '') + '" data-novo-k="' + o.x.k + '"><svg><use href="#' + o.x.i + '"/></svg><span>' + escapeHtml(o.x.t) + '</span></button>'; }).join('');
}
function paAbrirNovo(){
  var ov = qs('overlayNovo');
  if (!ov){
    ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'overlayNovo';
    ov.innerHTML = '<div class="modal"><div class="modal-head"><h2>Novo</h2><button class="icon-btn" id="novoFechar" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body"><div class="novo-grid" id="novoGrid"></div></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){
      if (e.target === ov || (e.target.closest && e.target.closest('#novoFechar'))){ ov.classList.remove('show'); return; }
      var b = e.target.closest ? e.target.closest('[data-novo-k]') : null; if (!b) return;
      var k = b.getAttribute('data-novo-k'), it = PA_NOVO.filter(function(x){ return x.k === k; })[0];
      ov.classList.remove('show'); paUsar(k); if (it) setTimeout(function(){ it.f(); }, 60);
    });
  }
  qs('novoGrid').innerHTML = paNovoHtml();
  ov.classList.add('show');
}
document.addEventListener('click', function(ev){
  var t = ev.target.closest ? ev.target.closest('#inicioNovo, #acRecebi, #inicioLerDoc') : null;
  if (!t) return;
  if (t.id === 'inicioNovo') paAbrirNovo();
  else if (t.id === 'acRecebi'){ paUsar('recebi'); abrirRecebi(); }
  else if (t.id === 'inicioLerDoc') paUsar('foto');
});
/* o botão + redondo (canto inferior direito) fica sempre visível no Início, como nas outras telas */

/* ---------- desfazer a última ação ---------- */
function paDesfazerBotao(){
  var dr = qs('backupBtn'); if (!dr || qs('desfazerBtn')) return;
  var b = document.createElement('button'); b.type = 'button'; b.className = 'dr-it'; b.id = 'desfazerBtn'; b.title = 'Desfazer a última ação'; b.innerHTML = '<svg><use href="#ic-undo"/></svg><span class="lab" id="desfazerRotulo">Desfazer última ação</span>';
  dr.parentNode.insertBefore(b, dr);
  b.addEventListener('click', function(){
    if (typeof fecharMenu === 'function') fecharMenu();
    var j = window.__desfazer; if (!j || !j.ultimo()){ toast('Não há nada para desfazer.'); return; }
    var u = j.ultimo();
    toast('Desfazer: ' + u.rotulo + '?', 'Desfazer', function(){ j.desfazer().then(function(ok){ toast(ok ? 'Pronto, desfeito.' : 'Não consegui desfazer.'); }); });
  });
  var atualizar = function(){ var u = window.__desfazer && window.__desfazer.ultimo(); var r = qs('desfazerRotulo'); if (r) r.textContent = u ? 'Desfazer: ' + u.rotulo : 'Desfazer última ação'; };
  window.addEventListener('desfazer-mudou', atualizar); atualizar();
}
if (window.__desfazer) paDesfazerBotao();

/* ---------- gancho: depois de desenhar a Central de atenção, acrescenta os alertas ---------- */
var paAtraso = null;
(function(){
  var orig = renderPainelAtencao;
  renderPainelAtencao = function(){
    var bd = qs('atencaoBadge'); var r = orig.apply(this, arguments);
    if (bd) bd.setAttribute('data-itens', bd.textContent || '0');
    try{ paInserirAlertas(); }catch(e){ console.error('alertas', e); }
    clearTimeout(paAtraso); paAtraso = setTimeout(function(){ paAlertasCache.t = 0; try{ paInserirAlertas(); }catch(e){} }, 900);   /* garante o resultado final depois que os dados terminam de chegar */
    return r;
  };
  setTimeout(function(){ try{ renderPainelAtencao(); }catch(e){} }, 600);
})();

/* ---------- backups automáticos semanais (guardados no servidor) ---------- */
function paBackupsRender(){
  var corpo = document.querySelector('#overlayBackup .modal-body'); if (!corpo) return;
  var box = qs('paBackups');
  if (!box){ box = document.createElement('div'); box.id = 'paBackups'; box.className = 'subgroup'; corpo.appendChild(box); }
  fetch('/api/backups', { credentials: 'same-origin', cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(j){
    var it = (j && j.itens) || [];
    box.innerHTML = '<div class="field-label" style="font-weight:700">Backups automáticos do servidor</div><div class="saldo-data">O servidor guarda uma cópia toda segunda-feira (as últimas 8). Baixe uma para restaurar por "Restaurar backup".</div>' +
      (it.length ? it.map(function(x){ return '<div class="plan-linha"><span>' + escapeHtml(fmtData(x.dia)) + '<br><small style="color:var(--ink-soft)">' + x.docs + ' registros</small></span><button type="button" class="btn-text" data-pa-bk="' + escapeHtml(x.dia) + '">Baixar</button></div>'; }).join('') : '<div class="saldo-data">Ainda não há cópias automáticas.</div>') +
      '<div class="ext-acoes"><button type="button" class="btn btn-ghost" id="paBackupAgora">Fazer uma cópia agora</button></div><div class="saldo-data" id="paBackupMsg"></div>';
  }).catch(function(){ box.innerHTML = ''; });
}
(function(){
  var ov = qs('overlayBackup'); if (!ov || !window.__SERVIDOR) return;
  new MutationObserver(function(){ if (ov.classList.contains('show')) paBackupsRender(); }).observe(ov, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target.closest('[data-pa-bk], #paBackupAgora') : null; if (!t) return;
    var msg = function(x){ var m = qs('paBackupMsg'); if (m) m.textContent = x; };
    if (t.id === 'paBackupAgora'){ msg('Fazendo a cópia…'); fetch('/api/backups/agora', { method: 'POST', credentials: 'same-origin' }).then(function(r){ return r.json(); }).then(function(){ paBackupsRender(); }).catch(function(){ msg('Não consegui fazer a cópia agora.'); }); return; }
    var dia = t.getAttribute('data-pa-bk'); msg('Preparando o arquivo…');
    fetch('/api/backups/' + encodeURIComponent(dia), { credentials: 'same-origin', cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(bk){
      return salvarArquivo('backup-automatico-' + dia + '.json', JSON.stringify(bk, null, 2), 'application/json;charset=utf-8;');
    }).then(function(ok){ msg(ok ? 'Arquivo salvo.' : ''); }).catch(function(){ msg('Não consegui baixar essa cópia.'); });
  });
})();
