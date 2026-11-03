/* ============================================================
   NOTIFICAÇÕES NO IPHONE (Web Push): resumo do que vence hoje, às 10h, e alertas novos do app
   ============================================================ */
var ntEstado = { carregado: false, aparelhos: 0, config: { alertas: true, esconder: false }, resumoEm: null, neste: false, msg: '' };
function ntSuportado(){ return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window); }
function ntB64ParaBytes(s){ var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function ntJson(url, metodo, corpo){
  return fetch(url, { method: metodo || 'GET', credentials: 'same-origin', cache: 'no-store', headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined, body: corpo !== undefined ? JSON.stringify(corpo) : undefined })
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) throw new Error((j.error && j.error.message) || ('Erro ' + r.status)); return j; }); });
}
function ntCarregar(){
  return ntJson('/api/notif/estado').then(function(j){
    ntEstado.aparelhos = j.aparelhos; ntEstado.config = j.config; ntEstado.resumoEm = j.resumoEm; ntEstado.carregado = true;
    if (!ntSuportado()) { ntEstado.neste = false; return; }
    return navigator.serviceWorker.getRegistration('/').then(function(reg){ return reg ? reg.pushManager.getSubscription() : null; }).then(function(s){ ntEstado.neste = !!s && Notification.permission === 'granted'; });
  }).catch(function(){ ntEstado.carregado = true; });
}
/* o que vence nos próximos dias + os alertas atuais: o servidor escolhe o que é de hoje às 10h */
function ntResumo(){
  var hoje = todayISO(), lim = somarDias(hoje, 45), itens = [];
  listarUnidades().forEach(function(u){
    var d = anDocDaUnidade(u);
    if (restanteUn(u) <= 0.004 || !u.data || u.data < hoje || u.data > lim || u.arquivado || (d && d.atipica)) return;
    itens.push({ d: u.data, t: u.docTipo === 'alvara' ? 'alvara' : 'pagamento', n: u.cliente, l: u.labelAlerta || u.label, v: r2(restanteMeu(u)) });
  });
  casos.forEach(function(c){ if (!c.arquivado && c.prazo && c.prazo.data && !c.prazo.concluido && c.prazo.data >= hoje && c.prazo.data <= lim) itens.push({ d: c.prazo.data, t: 'prazo', n: c.cliente || 'Sem nome', l: 'Prazo: ' + (c.prazo.descricao || 'processual'), v: null }); });
  var m0 = hoje.slice(0, 7);
  [m0, deslocarMes(m0, 1)].forEach(function(m){
    comMes(m, function(){
      ['pj', 'pf'].forEach(function(col){
        getDespesasParaMes(col).forEach(function(it){
          if (it.pago || it.despesa.transferenciaId || !it.vencimento || it.vencimento < hoje || it.vencimento > lim) return;
          var v = (it.valor !== null && it.valor !== undefined) ? Math.max(0, r2(it.valor - (it.somaParcial || 0))) : null;
          itens.push({ d: it.vencimento, t: 'despesa', n: it.despesa.nome + ' (' + (col === 'pf' ? 'PF' : 'PJ') + ')', l: '', v: v });
        });
      });
      return 0;
    });
  });
  var alertas = []; /* atrasos de clientes você confere no app: só chegam alertas de caixa, reserva, despesas e alvarás */
  try{ alertas = paAlertas().filter(function(a){ return String(a.chave).indexOf('cliente|') !== 0; }).map(function(a){ return { chave: a.chave, titulo: a.titulo, detalhe: a.detalhe }; }); }catch(e){}
  return { itens: itens, alertas: alertas };
}
var ntAtraso = null, ntUltimo = '';
function ntAgendarEnvio(){
  if (!ntEstado.carregado || ntEstado.aparelhos < 1) return;
  clearTimeout(ntAtraso);
  ntAtraso = setTimeout(function(){
    var r; try{ r = ntResumo(); }catch(e){ console.error('resumo de notificações', e); return; }
    var chave = JSON.stringify(r); if (chave === ntUltimo) return; ntUltimo = chave;
    ntJson('/api/notif/resumo', 'PUT', r).catch(function(){ ntUltimo = ''; });
  }, 4000);
}
function ntAtivar(){
  if (!ntSuportado()){ ntEstado.msg = 'Este navegador não recebe notificações. No iPhone, abra o app pelo ícone na tela de início (não pelo Safari) e use o iOS 16.4 ou mais novo.'; ntDesenhar(); return Promise.resolve(); }
  ntEstado.msg = 'Aguardando a sua permissão…'; ntDesenhar();
  return Notification.requestPermission().then(function(p){
    if (p !== 'granted') throw new Error('Permissão negada. Para liberar: Ajustes do iPhone → Notificações → Controle.');
    return navigator.serviceWorker.register('/sw.js');
  }).then(function(){ return navigator.serviceWorker.ready; }).then(function(reg){
    return ntJson('/api/notif/chave').then(function(k){ return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: ntB64ParaBytes(k.publica) }); });
  }).then(function(sub){ return ntJson('/api/notif/inscrever', 'POST', sub.toJSON()); }).then(function(){
    ntEstado.msg = 'Notificações ativadas neste aparelho.'; return ntCarregar();
  }).then(function(){ ntUltimo = ''; ntAgendarEnvio(); }).catch(function(e){ ntEstado.msg = (e && e.message) || 'Não consegui ativar.'; }).then(ntDesenhar);
}
function ntDesativar(){
  return navigator.serviceWorker.getRegistration('/').then(function(reg){ return reg ? reg.pushManager.getSubscription() : null; }).then(function(s){
    if (!s) return null; var e = s.endpoint; return s.unsubscribe().then(function(){ return ntJson('/api/notif/inscrever', 'DELETE', { endpoint: e }); });
  }).then(function(){ ntEstado.msg = 'Notificações desativadas neste aparelho.'; return ntCarregar(); }).catch(function(e){ ntEstado.msg = (e && e.message) || 'Não consegui desativar.'; }).then(ntDesenhar);
}
function ntSalvarConfig(){
  var c = { alertas: qs('ntAlertas').checked, esconder: qs('ntEsconder').checked };
  return ntJson('/api/notif/config', 'PUT', c).then(function(){ ntEstado.config = c; ntEstado.msg = 'Preferências salvas.'; ntDesenhar(); }).catch(function(e){ ntEstado.msg = e.message; ntDesenhar(); });
}
function ntTeste(){
  ntEstado.msg = 'Enviando…'; ntDesenhar();
  return ntJson('/api/notif/teste', 'POST').then(function(r){ ntEstado.msg = r.enviadas ? 'Enviada. Ela deve chegar em alguns segundos.' : 'Nenhum aparelho recebeu. Ative as notificações neste aparelho primeiro.'; }).catch(function(e){ ntEstado.msg = e.message; }).then(ntDesenhar);
}
function ntMontar(){
  if (qs('overlayLembretes')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayLembretes';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Lembretes no iPhone</h2><button class="icon-btn" id="ntFechar" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="ntCorpo"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#ntFechar'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-nt]') : null; if (!b) return;
    var a = b.getAttribute('data-nt');
    if (a === 'ativar') ntAtivar(); else if (a === 'desativar') ntDesativar(); else if (a === 'teste') ntTeste();
  });
  d.addEventListener('change', function(e){ if (e.target && (e.target.id === 'ntAlertas' || e.target.id === 'ntEsconder')) ntSalvarConfig(); });
}
function ntDesenhar(){
  var c = qs('ntCorpo'); if (!c) return;
  var neste = ntEstado.neste;
  c.innerHTML = '<div class="parcela-sum">Todo dia às <b>10:00</b> chega uma notificação com o que <b>vence hoje</b>. Os atrasos você confere no app. Os alertas do app também avisam, uma vez por mês cada um, sem repetir.</div>' +
    '<div class="cli-box"><div class="cli-linha"><span class="l">Neste aparelho</span><b style="color:' + (neste ? 'var(--success)' : 'var(--ink-soft)') + '">' + (neste ? 'Ativadas' : 'Desativadas') + '</b></div><div class="cli-linha"><span class="l">Aparelhos recebendo</span><b>' + ntEstado.aparelhos + '</b></div>' +
    (ntEstado.resumoEm ? '<div class="cli-linha"><span class="l">Lista de vencimentos atualizada em</span><span>' + escapeHtml(extFmtQuando(ntEstado.resumoEm)) + '</span></div>' : '') + '</div>' +
    (neste ? '<button type="button" class="btn btn-ghost" data-nt="desativar" style="width:100%;justify-content:center;">Desativar neste aparelho</button>' : '<button type="button" class="btn btn-primary" data-nt="ativar" style="width:100%;justify-content:center;">Ativar notificações neste aparelho</button>') +
    '<div class="field"><label class="ad-it" style="border:0;padding:4px 0;"><input type="checkbox" id="ntAlertas"' + (ntEstado.config.alertas ? ' checked' : '') + '><span class="ad-t">Incluir os alertas do app (caixa previsto, reserva, despesas e alvarás)</span></label>' +
    '<label class="ad-it" style="border:0;padding:4px 0;"><input type="checkbox" id="ntEsconder"' + (ntEstado.config.esconder ? ' checked' : '') + '><span class="ad-t">Esconder nomes e valores (a notificação só diz quantos itens vencem)</span></label></div>' +
    '<button type="button" class="btn btn-ghost" data-nt="teste" style="width:100%;justify-content:center;">Enviar notificação de teste</button>' +
    (ntEstado.msg ? '<div class="saldo-data" role="status">' + escapeHtml(ntEstado.msg) + '</div>' : '') +
    (!ntSuportado() ? '<div class="aviso-sis"><span class="as-txt">Para receber no iPhone: abra o app pelo ícone na tela de início (não pelo Safari) e use o iOS 16.4 ou mais novo.</span></div>' : '');
}
function ntAbrir(){ ntMontar(); ntDesenhar(); qs('overlayLembretes').classList.add('show'); ntCarregar().then(ntDesenhar); }
(function(){
  var dr = qs('backupBtn'); if (!dr || qs('abrirLembretesBtn')) return;
  var b = document.createElement('button'); b.type = 'button'; b.className = 'dr-it'; b.id = 'abrirLembretesBtn'; b.title = 'Lembretes no iPhone';
  b.innerHTML = '<svg><use href="#ic-bell"/></svg><span class="lab">Lembretes no iPhone</span>'; dr.parentNode.insertBefore(b, dr);
  b.addEventListener('click', function(){ if (typeof fecharMenu === 'function') fecharMenu(); ntAbrir(); });
  if (window.__SERVIDOR){
    ntCarregar().then(ntAgendarEnvio);
    document.addEventListener('visibilitychange', function(){ if (!document.hidden){ ntCarregar().then(ntAgendarEnvio); } });
    var orig = renderPainelAtencao;
    renderPainelAtencao = function(){ var r = orig.apply(this, arguments); ntAgendarEnvio(); return r; };
  }
})();
