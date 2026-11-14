/* ============================================================
   NOTIFICAÇÕES NO IPHONE (Web Push): resumo do que vence hoje, às 10h, e alertas novos do app
   ============================================================ */
var ntEstado = { carregado: false, aparelhos: 0, config: { alertas: true, esconder: false }, avisos: {}, equipe: null, papel: 'proprietario', resumoEm: null, neste: false, msg: '' };
/* o que cada pessoa pode ligar e desligar (5.8): as opções do próprio celular e, para o proprietário, os avisos sobre a equipe */
var NT_AVISOS = [
  ['resumo', 'Resumo do dia · 10:00', 'o que vence hoje e nos próximos dias, só o que é seu'],
  ['prazos', 'Prazo ou audiência chegando', 'na véspera e na manhã do dia'],
  ['indicado', 'Fui indicado como responsável', 'quando alguém me coloca num prazo, tarefa ou registro'],
  ['publicacoes', 'Publicações novas', 'quando chega publicação no Diário Oficial'],
  ['repasses', 'Repasses', 'quando alguém diz que repassou, ou há repasse a receber']
];
var NT_EQUIPE = [
  ['convite', 'Alguém aceitar um convite', 'e criar o acesso'],
  ['aparelho', 'Entrar em aparelho novo', 'qualquer pessoa da equipe'],
  ['recebeu', 'Outro advogado receber honorários', 'e o meu repasse ficar a receber'],
  ['desfeito', 'Um recebimento for desfeito', 'por outra pessoa'],
  ['exclusao', 'Registro for excluído', 'por quem não é o proprietário'],
  ['honorarios', 'Alterarem honorários ou divisão', 'valor, parcelas, percentual'],
  ['pronta', 'Alguém marcar “Peça pronta”', 'para eu conferir e protocolar'],
  ['semanal', 'Resumo semanal do que a equipe fez', 'segunda-feira, 08:00']
];
function ntSuportado(){ return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window); }
function ntB64ParaBytes(s){ var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function ntJson(url, metodo, corpo){
  return fetch(url, { method: metodo || 'GET', credentials: 'same-origin', cache: 'no-store', headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined, body: corpo !== undefined ? JSON.stringify(corpo) : undefined })
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) throw new Error((j.error && j.error.message) || ('Erro ' + r.status)); return j; }); });
}
function ntCarregar(){
  return ntJson('/api/notif/estado').then(function(j){
    ntEstado.aparelhos = j.aparelhos; ntEstado.config = j.config; ntEstado.resumoEm = j.resumoEm; ntEstado.carregado = true; ntEstado.avisos = j.avisos || {}; ntEstado.equipe = j.equipe || null; ntEstado.papel = j.papel || 'proprietario';
    if (!ntSuportado()) { ntEstado.neste = false; return; }
    return navigator.serviceWorker.getRegistration('/').then(function(reg){ return reg ? reg.pushManager.getSubscription() : null; }).then(function(s){ ntEstado.neste = !!s && Notification.permission === 'granted'; });
  }).catch(function(){ ntEstado.carregado = true; });
}
/* o que vence nos próximos dias + os alertas atuais: o servidor escolhe o que é de hoje às 10h */
function ntResumo(){
  var hoje = todayISO(), lim = somarDias(hoje, 45), itens = [];
  var papelNt = (typeof ppPapel === 'function') ? ppPapel() : 'proprietario';
  if (papelNt !== 'estagiario') listarUnidades().forEach(function(u){
    var d = anDocDaUnidade(u);
    if (restanteUn(u) <= 0.004 || !u.data || u.data < hoje || u.data > lim || u.arquivado || (d && d.atipica)) return;
    itens.push({ d: u.data, t: u.docTipo === 'alvara' ? 'alvara' : 'pagamento', n: u.cliente, l: u.labelAlerta || u.label, v: r2(restanteMeu(u)) });
  });
  var m0 = hoje.slice(0, 7);
  if (papelNt === 'proprietario') [m0, deslocarMes(m0, 1)].forEach(function(m){
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
  try{ if (papelNt === 'proprietario' && typeof ob7Itens === 'function') ob7Itens(hoje, lim).forEach(function(i){ itens.push(i); }); }catch(e){}
  var alertas = []; /* atrasos de clientes você confere no app: só chegam alertas de caixa, reserva, despesas e alvarás */
  try{ if (papelNt === 'proprietario') alertas = paAlertas().filter(function(a){ return String(a.chave).indexOf('cliente|') !== 0; }).map(function(a){ return { chave: a.chave, titulo: a.titulo, detalhe: a.detalhe }; }); }catch(e){}
  var prazos = []; /* prazos processuais, audiências e tarefas da Agenda: aviso separado do dinheiro */
  try{ prazos = agPrazosResumo(hoje, somarDias(hoje, 10)); }catch(e){ console.error('prazos', e); }
  return { itens: itens, alertas: alertas, prazos: prazos };
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
    if (p !== 'granted') throw new Error('Permissão negada. Para liberar: Ajustes do iPhone → Notificações → Horus.');
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
  var c = { esconder: qs('ntEsconder').checked, avisos: {} };
  if (qs('ntAlertas')) c.alertas = qs('ntAlertas').checked;
  Array.prototype.forEach.call(document.querySelectorAll('#ntCorpo [data-ntav]'), function(i){ c.avisos[i.getAttribute('data-ntav')] = i.checked; });
  if (ntEstado.equipe){ c.equipe = {}; Array.prototype.forEach.call(document.querySelectorAll('#ntCorpo [data-nteq]'), function(i){ c.equipe[i.getAttribute('data-nteq')] = i.checked; }); }
  return ntJson('/api/notif/config', 'PUT', c).then(function(){ Object.assign(ntEstado.avisos, c.avisos); if (c.equipe) Object.assign(ntEstado.equipe, c.equipe); return c; }).then(function(){ ntEstado.config = { alertas: c.alertas !== undefined ? c.alertas : ntEstado.config.alertas, esconder: c.esconder }; ntEstado.msg = 'Preferências salvas.'; ntDesenhar(); }).catch(function(e){ ntEstado.msg = e.message; ntDesenhar(); });
}
function ntTeste(){
  ntEstado.msg = 'Enviando…'; ntDesenhar();
  return ntJson('/api/notif/teste', 'POST').then(function(r){
    if (r.enviadas) ntEstado.msg = 'Enviada. Ela deve chegar em alguns segundos.';
    else if (r.falhas && r.falhas.length) ntEstado.msg = 'O serviço de notificações da Apple recusou o envio (código ' + (r.falhas[0].status || 'sem resposta') + (r.falhas[0].motivo ? ': ' + r.falhas[0].motivo : '') + '). Toque em Desativar e depois em Ativar de novo e repita o teste. Se continuar, mande esta mensagem para o Claude.';
    else ntEstado.msg = 'Nenhum aparelho recebeu. Ative as notificações neste aparelho primeiro.';
    return ntCarregar();
  }).catch(function(e){ ntEstado.msg = e.message; }).then(ntDesenhar);
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
  d.addEventListener('change', function(e){ if (e.target && (e.target.id === 'ntAlertas' || e.target.id === 'ntEsconder' || (e.target.getAttribute && (e.target.getAttribute('data-ntav') || e.target.getAttribute('data-nteq'))))) ntSalvarConfig(); });
}
function ntSwitch(attr, k, ligado, titulo, sub){
  return '<label class="nt-op"><span class="nt-tx"><b>' + titulo + '</b><small>' + sub + '</small></span><input type="checkbox" class="nt-sw" ' + attr + '="' + k + '"' + (ligado ? ' checked' : '') + '></label>';
}
function ntDesenhar(){
  var c = qs('ntCorpo'); if (!c) return;
  var neste = ntEstado.neste, dono = ntEstado.papel === 'proprietario', av = ntEstado.avisos || {}, eq = ntEstado.equipe || {};
  var intro = dono
    ? 'Todo dia às <b>10:00</b> chega uma notificação com o que <b>vence hoje</b>. Os atrasos você confere no app. Os alertas do app também avisam, uma vez por mês cada um, sem repetir. Prazos processuais e audiências avisam nos dias de antecedência escolhidos em cada um.'
    : 'Todo dia às <b>10:00</b> chega o resumo do que <b>é seu</b>: prazos, audiências e tarefas em que você é responsável' + (ntEstado.papel === 'advogado' ? ' e as publicações das suas OABs' : '') + '. Cada pessoa liga os avisos no próprio celular.';
  c.innerHTML = '<div class="parcela-sum">' + intro + '</div>' +
    '<div class="cli-box"><div class="cli-linha"><span class="l">Neste aparelho</span><b style="color:' + (neste ? 'var(--success)' : 'var(--ink-soft)') + '">' + (neste ? 'Ativados' : 'Desativados') + '</b></div><div class="cli-linha"><span class="l">Seus aparelhos com avisos</span><span>' + ntEstado.aparelhos + '</span></div>' +
    (ntEstado.resumoEm ? '<div class="cli-linha"><span class="l">Lista de vencimentos atualizada em</span><span>' + escapeHtml(extFmtQuando(ntEstado.resumoEm)) + '</span></div>' : '') + '</div>' +
    (neste ? '<button type="button" class="btn btn-ghost" data-nt="desativar" style="width:100%;justify-content:center;">Desativar neste aparelho</button>' : '<button type="button" class="btn btn-primary" data-nt="ativar" style="width:100%;justify-content:center;">Ativar avisos neste aparelho</button>') +
    '<div class="pb-sec-t" style="margin:14px 4px 4px">O que receber neste celular</div><div class="nt-lista">' +
    NT_AVISOS.filter(function(x){ return !(x[0] === 'repasses' && ntEstado.papel === 'estagiario'); }).map(function(x){ return ntSwitch('data-ntav', x[0], av[x[0]] !== false, x[1], (dono && x[0] === 'resumo') ? 'o que vence hoje e nos próximos dias' : x[2]); }).join('') +
    (dono ? '<label class="nt-op"><span class="nt-tx"><b>Alertas do app</b><small>caixa previsto, reserva, despesas e alvarás</small></span><input type="checkbox" class="nt-sw" id="ntAlertas"' + (ntEstado.config.alertas ? ' checked' : '') + '></label>' : '') +
    '<label class="nt-op"><span class="nt-tx"><b>Esconder nomes e valores</b><small>a notificação só diz quantos itens vencem</small></span><input type="checkbox" class="nt-sw" id="ntEsconder"' + (ntEstado.config.esconder ? ' checked' : '') + '></label></div>' +
    (dono && ntEstado.equipe ? '<div class="pb-sec-t" style="margin:14px 4px 4px">Avisos da equipe · me avise quando…</div><div class="nt-lista">' + NT_EQUIPE.map(function(x){ return ntSwitch('data-nteq', x[0], eq[x[0]] === true, x[1], x[2]); }).join('') + '</div>' : '') +
    '<button type="button" class="btn btn-ghost" data-nt="teste" style="width:100%;justify-content:center;margin-top:12px">Enviar um aviso de teste</button>' +
    (ntEstado.msg ? '<div class="saldo-data" role="status">' + escapeHtml(ntEstado.msg) + '</div>' : '') +
    (!ntSuportado() ? '<div class="aviso-sis"><span class="as-txt">Para receber no iPhone: abra o app pelo ícone na tela de início (não pelo Safari) e use o iOS 16.4 ou mais novo.</span></div>' : '');
  var h = document.querySelector('#overlayLembretes .modal-head h2'); if (h) h.textContent = dono ? 'Lembretes no iPhone' : 'Avisos neste celular';
}
(function(){
  var st = document.createElement('style');
  st.textContent = '.nt-lista{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:2px 12px}.nt-op{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--border);cursor:pointer}.nt-op:first-child{border-top:0}' +
    '.nt-tx{display:flex;flex-direction:column;gap:2px;min-width:0}.nt-tx small{font-size:var(--t2);color:var(--ink-soft);font-weight:400}.nt-sw{appearance:none;-webkit-appearance:none;flex:none;width:42px;height:25px;border-radius:99px;background:var(--border);position:relative;cursor:pointer;transition:background .15s;border:0}' +
    '.nt-sw::after{content:"";position:absolute;left:3px;top:3px;width:19px;height:19px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .15s}.nt-sw:checked{background:#17895A}.nt-sw:checked::after{transform:translateX(17px)}';
  document.head.appendChild(st);
})();
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
