/* ============================================================
   O APLICATIVO POR PAPEL (prefixo pp) — Fase 5, etapa 5.7.
   O app marca a página (<html>) com o papel de quem entrou (public/shim.js): "so-central" (não é o proprietário), "papel-advogado",
   "papel-estagiario" e "sem-totais" (sem a permissão "Ver totais"). Aqui fica o que depende disso:
   - Finanças, Análises, Construção, Extratos, Recebi R$, Fechamento, Relatório do Murilo, Backup e Exportar SOMEM para quem não é o proprietário
     (e as telas não abrem nem pela barra, nem por atalho, nem pelo endereço);
   - Cobrança de clientes: só o advogado, e só com os clientes dos processos em que ele está (o servidor já entrega só esses registros);
   - Central de atenção e avisos do sistema: o que é financeiro ou do proprietário (relatório do Murilo, obra, despesas, backup) não aparece;
   - totais e indicadores de honorários somem de quem não tem "Ver totais";
   - barra de baixo do celular: "Finanças" dá lugar a "Agenda";
   - "Configurações" vira "Minha conta" (senha e aparelhos).
   O servidor continua sendo quem decide o que cada pessoa pode ler e gravar; isto aqui só tira da tela o que a pessoa não pode usar.
   ============================================================ */
var PP_TELAS_DONO = { financeiro: 1, analises: 1, obra: 1, extratos: 1 };
function ppPapel(){ return window.__papel || 'proprietario'; }
function ppDono(){ return ppPapel() === 'proprietario'; }
function ppVerTotais(){ if (ppDono()) return true; var e = window.__horusEu; return !!(e && e.permissoes && e.permissoes.verTotais); }
/* cobrar clientes: o proprietário e o advogado (só os clientes dos processos dele, que são os que o servidor entrega); o estagiário não cobra */
/* registrar ou desfazer recebimento: o estagiário não (o servidor também recusa); some o botão e os quadradinhos de "pago" ficam só para ver */
function ppPodeReceber(){ return ppPapel() !== 'estagiario'; }
function ppPodeCobrar(){ var p = ppPapel(); return p === 'proprietario' || p === 'advogado'; }
function ppTelaPermitida(tab){ return ppDono() || !PP_TELAS_DONO[tab]; }
/* a aba de quem pediu: devolve uma aba que a pessoa pode abrir (usada ao trocar de aba) */
/* espera o servidor dizer quem é a pessoa; resolve true só para o proprietário (quem não é nunca pede o que é do proprietário) */
function ppDonoP(){
  var e = window.__horusEu;
  if (e && e.pronto) return Promise.resolve(e.papel === 'proprietario');
  return new Promise(function(res){ window.addEventListener('horus-eu', function(){ res(window.__horusEu.papel === 'proprietario'); }, { once: true }); });
}
function ppAbaValida(tab){ return ppTelaPermitida(tab) ? tab : 'inicio'; }
/* itens da Central de atenção que a pessoa pode ver */
function ppItemAtencaoOk(x){
  if (ppDono()) return true;
  var o = x.origem;
  if (o === 'despesa' || o === 'relatorio' || o === 'obra' || o === 'murilo') return false;
  var dinheiro = (o === 'upcoming' && !x.ehPrazo) || o === 'promessa';
  if (dinheiro) return ppPapel() === 'advogado';
  return true;
}

/* ---------- "Honorários dos seus processos" (advogado com "Ver totais"): a parte dele, pela divisão cadastrada em cada registro ---------- */
/* a fração que cabe a esta pessoa no registro: pela divisão; sem divisão e com um só advogado, tudo; sem divisão e com vários, não dá para saber (null) */
function ppFracaoMinha(doc){
  if (!doc) return null;
  var ks = esMinhasChaves(), partes = doc.divisao && Array.isArray(doc.divisao.partes) ? doc.divisao.partes : [];
  if (partes.length){ var s = 0, achou = false; partes.forEach(function(p){ if (p.oab && ks.indexOf(p.oab) >= 0){ s += Number(p.pct) || 0; achou = true; } }); return achou ? Math.max(0, Math.min(1, s / 100)) : null; }
  var adv = Array.isArray(doc.advogados) ? doc.advogados.length : 0;
  return adv <= 1 ? 1 : null;
}
function ppHonorariosMeus(){
  var mes = (typeof mesSelecionado !== 'undefined' && mesSelecionado) ? mesSelecionado : todayISO().slice(0, 7), aReceber = 0, recebido = 0, sem = {};
  listarUnidades().forEach(function(u){
    if (u.arquivado) return;
    var doc = rcDocDe(u), f = ppFracaoMinha(doc);
    if (f === null){ sem[u.docTipo + '|' + u.docId] = 1; return; }
    aReceber += restanteUn(u) * f; recebido += recebidoNoMesUn(u, mes) * f;
  });
  return { aReceber: aReceber, recebido: recebido, sem: Object.keys(sem).length, mes: mes };
}
function ppDesenharHon(){
  var el = document.getElementById('ppHon'); if (!el) return;
  if (ppPapel() !== 'advogado' || !ppVerTotais()){ el.innerHTML = ''; return; }
  var h = ppHonorariosMeus();
  el.innerHTML = '<div class="ini-card"><div class="lbl">Honorários dos seus processos</div><div class="hero-val" style="font-size:var(--t7,22px)">' + fmtMoeda(h.aReceber) + ' <span class="saldo-data" style="font-weight:600">sua parte a receber</span></div>' +
    '<div class="saldo-data">recebido em ' + mesLabel(h.mes) + ': ' + fmtMoeda(h.recebido) + ' · só os processos em que você está' + (h.sem ? ' · ' + h.sem + (h.sem === 1 ? ' registro sem divisão definida não entra' : ' registros sem divisão definida não entram') : '') + '</div></div>';
}
/* rótulo "recebida por X" nas parcelas pagas de processos com divisão */
function ppPor(n){
  var pago = n && (n.pago || n.status === 'recebido' || n.status === 'recebida');   /* parcela/à vista (pago) ou acordo e alvará inteiros (status recebido) */
  var s = pago && n.divisaoRec && n.divisaoRec.por ? String(n.divisaoRec.por).split(' ')[0] : '';
  return s ? ' <span class="pp-por">recebida por ' + escapeHtml(s) + '</span>' : '';
}
(function(){
  var st = document.createElement('style');
  var fin = ['[data-tab="financeiro"]', '[data-tab="analises"]', '[data-tab="obra"]', '[data-tab="extratos"]', '#drGrpFin', '#abrirRecebiBtn', '#abrirFechamentoBtn', '#abrirRelMuriloBtn', '#abrirRelMuriloBtn2', '#backupBtn', '#exportBtn', '#abrirLerDocBtn', '#avisoSistema', '#finFabMenu', '#bodyFinanceiro', '#bodyAnalises', '#bodyExtratos', '#bodyObra', '#inicioAbrirDivisao', '#inicioAbrirExtratos', '#relModoSeg'];
  st.textContent = fin.map(function(s){ return '.so-central ' + s; }).join(',') + '{display:none!important}' +
    '.papel-estagiario [data-baixa-doc],.papel-estagiario [data-pf="baixa"],.papel-estagiario [data-arq-act="baixa"],.papel-estagiario [data-acordo-status],.papel-estagiario [data-alvara-status],.papel-estagiario [data-receita-receber]{display:none!important}' +
    '.papel-estagiario input[data-avista],.papel-estagiario input[data-parcela],.papel-estagiario input[data-acordo-parcela],.papel-estagiario input[data-exavista],.papel-estagiario input[data-exparcela]{pointer-events:none;opacity:.55}' +
    '.papel-estagiario #abrirCobrancaMenuBtn,.papel-estagiario #abrirCobrancaProprioBtn,.papel-estagiario [data-cli-cobrar],.papel-estagiario [data-pf="cobrar"]{display:none!important}' +
    '.sem-totais .ini-hero,.sem-totais .ini-kpi,.sem-totais #rsPainel,.sem-totais .rs-wrap,.sem-totais #stats{display:none!important}' +
    '#inicioAcoes{display:flex;flex-wrap:wrap;gap:8px;max-width:none}#inicioAcoes .acao{flex:0 0 auto;min-width:104px;padding:9px 16px}' +
    '.so-central .ini-grid{row-gap:0}.so-central .ini-grid>*{margin-bottom:12px}.so-central #inicioAcoes{display:none!important}.bt-so{display:none!important}.so-central .bt-so{display:flex!important}';
  document.head.appendChild(st);
  /* quando o servidor responde quem é a pessoa: sai de uma tela que não é dela e ajusta os rótulos */
  function aplicar(){
    if (ppDono()) return;
    try{ if (typeof activeTab !== 'undefined' && !ppTelaPermitida(activeTab)) setActiveTab('inicio'); }catch(e){}
    var cf = document.querySelector('#drawer [data-tab="configuracoes"] .lab'); if (cf) cf.textContent = 'Minha conta';
    try{ if (typeof TITULOS_TELA !== 'undefined') TITULOS_TELA.configuracoes = 'Minha conta'; if (typeof atualizarTituloTela === 'function') atualizarTituloTela(); }catch(e){}
    try{ if (typeof renderPainelAtencao === 'function') renderPainelAtencao(); }catch(e){}
    try{ if (typeof MD_DEF !== 'undefined' && MD_DEF[activeTab]) mdRedesenhar(activeTab); }catch(e){}
    if (ppPapel() === 'estagiario'){ try{ var ft = document.getElementById('filtroClienteTipo'); if (ft) Array.prototype.slice.call(ft.options).forEach(function(o){ if (o.value === 'receber' || o.value === 'atraso') ft.removeChild(o); }); }catch(e){} }
    try{ var bg = document.getElementById('buscaGlobalInput'); if (bg) bg.placeholder = 'Buscar em tudo: clientes, processos, publicações…'; }catch(e){}
    try{ var m = document.getElementById('relModoSeg'); if (m && typeof relModo !== 'undefined') relModo = 'proprio'; }catch(e){}
  }
  window.addEventListener('horus-eu', function(){ aplicar(); try{ ppDesenharHon(); }catch(e){} });
  if (window.__horusEu && window.__horusEu.pronto) aplicar();
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { extAcharMov: (typeof extAcharMov === 'function' ? extAcharMov : null), ppPodeReceber: ppPodeReceber, ppPodeCobrar: ppPodeCobrar, ppPor: ppPor, ppHonorariosMeus: ppHonorariosMeus, ppDesenharHon: ppDesenharHon, ppItemAtencaoOk: ppItemAtencaoOk, ppTelaPermitida: ppTelaPermitida });
})();
