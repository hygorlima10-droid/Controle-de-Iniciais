/* ============================================================
   CONFIGURAÇÕES (prefixo cf): aba nova que concentra o que é de administração.
   Cada linha abre a tela que já existe (notificações, backup, exportar CSV); os botões originais continuam no menu, escondidos,
   e é neles que a linha clica, então nada do que já funcionava foi mexido. Lixeira e Registro de ações abrem as telas de cliente/seguranca.js;
   Usuários e Perfis e permissões já têm o lugar marcado para a fase de usuários.
   ============================================================ */
var CF_LINHAS = [
  { id: 'notif', ic: '🔔', t: 'Notificações e lembretes do iPhone', s: 'avisos de prazos, publicações e compromissos', go: function(){ if (typeof ntAbrir === 'function') ntAbrir(); } },
  { id: 'backup', ic: '💾', t: 'Backup e restauração', s: 'cópias, restaurar com segurança, voltar', go: function(){ var b = qs('backupBtn'); if (b) b.click(); } },
  { id: 'csv', ic: '📤', t: 'Exportar lista (CSV)', s: 'Iniciais, acordos, alvarás, clientes', go: function(){ var b = qs('exportBtn'); if (b) b.click(); } },
  { id: 'seguranca', ic: '🔒', t: 'Segurança', s: 'sessões abertas, trocar a senha, avisos de acesso', go: function(){ sgSegAbrir(); } },
  { id: 'lixeira', ic: '🗑', t: 'Lixeira', s: 'restaurar o que foi excluído (30 dias)', go: function(){ sgLixAbrir(); } },
  { id: 'registro', ic: '🧾', t: 'Registro de ações', s: 'quem fez o quê, quando', go: function(){ sgRegAbrir(); } },
];
var CF_FUTURAS = [
  { ic: '👥', t: 'Usuários', s: 'cadastrar, ativar, encerrar sessões' },
  { ic: '🔐', t: 'Perfis e permissões', s: 'quem vê e faz o quê, por módulo e por pessoa' },
  { ic: '⚖️', t: 'OABs e publicações', s: 'OAB de cada advogado' },
  { ic: '🗓', t: 'Agendas e regras operacionais', s: 'compartilhar, feriados, listas' },
];
function cfLinha(l, fut){
  var tag = l.breve ? '<span class="cf-tag">em breve</span>' : (fut ? '<span class="cf-tag">depois</span>' : '<span class="cf-seta">›</span>');
  return '<button type="button" class="pb-mi cf-it' + ((l.breve || fut) ? ' cf-off' : '') + '"' + ((l.breve || fut) ? ' disabled' : ' data-cf="' + l.id + '"') + '><span class="pb-mi-i">' + l.ic + '</span><span class="cf-tx">' + escapeHtml(l.t) + '<small>' + escapeHtml(l.s) + '</small></span>' + tag + '</button>';
}
function cfRender(){
  var w = qs('cfWrap'); if (!w) return;
  if (!w.getAttribute('data-ok')){
    w.setAttribute('data-ok', '1');
    w.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('[data-cf]') : null; if (!b) return;
      var l = CF_LINHAS.filter(function(x){ return x.id === b.getAttribute('data-cf'); })[0]; if (l && l.go) l.go();
    });
  }
  w.innerHTML = '<div class="pb-painel pb-menu">' + CF_LINHAS.map(function(l){ return cfLinha(l, false); }).join('') + '</div>' +
    '<div class="pb-sec-t" style="margin:16px 4px 6px">Reservado para a fase de usuários</div>' +
    '<div class="pb-painel pb-menu">' + CF_FUTURAS.map(function(l){ return cfLinha(l, true); }).join('') + '</div>' +
    '<div class="pb-aviso" style="margin:10px 4px">Cada linha abre a tela que já existia, só que agora por aqui. “Perfis e permissões” já tem o seu lugar marcado.</div>';
}
(function(){
  var st = document.createElement('style');
  st.textContent = '.cf-it{grid-template-columns:30px minmax(0,1fr) auto!important}.cf-tx{display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left}.cf-tx small{font-size:var(--t2);color:var(--ink-soft);font-weight:400}' +
    '.cf-seta{color:var(--ink-soft);font-size:var(--t5)}.cf-tag{font-size:var(--t1);font-weight:700;background:var(--surface-2);color:var(--ink-soft);border-radius:8px;padding:2px 8px}.cf-off{opacity:.55;cursor:default}';
  document.head.appendChild(st);
  /* "Cobrança de clientes" do menu: a mesma tela de cobrança de antes, direto no modo de clientes próprios (o Relatório do Murilo tem o seu próprio item no grupo Financeiro) */
  var cb = qs('abrirCobrancaMenuBtn');
  if (cb) cb.addEventListener('click', function(){ if (typeof fecharMenu === 'function') fecharMenu(); abrirRelMurilo(mesSelecionado, 'proprio'); });
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { cfRender: cfRender });
})();
