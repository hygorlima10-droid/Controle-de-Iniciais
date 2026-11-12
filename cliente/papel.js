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
(function(){
  var st = document.createElement('style');
  var fin = ['[data-tab="financeiro"]', '[data-tab="analises"]', '[data-tab="obra"]', '[data-tab="extratos"]', '#drGrpFin', '#abrirRecebiBtn', '#abrirFechamentoBtn', '#abrirRelMuriloBtn', '#abrirRelMuriloBtn2', '#backupBtn', '#exportBtn', '#abrirLerDocBtn', '#avisoSistema', '#finFabMenu', '#bodyFinanceiro', '#bodyAnalises', '#bodyExtratos', '#bodyObra', '#inicioAbrirDivisao', '#inicioAbrirExtratos', '#relModoSeg'];
  st.textContent = fin.map(function(s){ return '.so-central ' + s; }).join(',') + '{display:none!important}' +
    '.papel-estagiario #abrirCobrancaMenuBtn,.papel-estagiario #abrirCobrancaProprioBtn{display:none!important}' +
    '.sem-totais .ini-hero,.sem-totais .ini-kpi,.sem-totais #rsPainel,.sem-totais .rs-wrap,.sem-totais #stats{display:none!important}' +
    '.bt-so{display:none!important}.so-central .bt-so{display:flex!important}';
  document.head.appendChild(st);
  /* quando o servidor responde quem é a pessoa: sai de uma tela que não é dela e ajusta os rótulos */
  function aplicar(){
    if (ppDono()) return;
    try{ if (typeof activeTab !== 'undefined' && !ppTelaPermitida(activeTab)) setActiveTab('inicio'); }catch(e){}
    var cf = document.querySelector('#drawer [data-tab="configuracoes"] .lab'); if (cf) cf.textContent = 'Minha conta';
    try{ if (typeof TITULOS_TELA !== 'undefined') TITULOS_TELA.configuracoes = 'Minha conta'; if (typeof atualizarTituloTela === 'function') atualizarTituloTela(); }catch(e){}
    try{ if (typeof renderPainelAtencao === 'function') renderPainelAtencao(); }catch(e){}
    try{ var m = document.getElementById('relModoSeg'); if (m && typeof relModo !== 'undefined') relModo = 'proprio'; }catch(e){}
  }
  window.addEventListener('horus-eu', aplicar);
  if (window.__horusEu && window.__horusEu.pronto) aplicar();
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { ppItemAtencaoOk: ppItemAtencaoOk, ppTelaPermitida: ppTelaPermitida });
})();
