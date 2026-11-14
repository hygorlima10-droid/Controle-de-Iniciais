/* ============================================================
   BACKUP E RESTAURAÇÃO SEGURA (prefixo bk)
   - ao escolher um arquivo de backup, o servidor CONFERE e mostra o que mudaria (novos, diferentes, que seriam removidos) sem gravar nada
   - ao confirmar, o servidor guarda uma cópia de segurança automática e troca tudo de uma vez (ou fica tudo do backup, ou tudo como estava)
   - "Cópias de segurança automáticas": voltar para uma delas (e o próprio "voltar" também guarda o estado de antes)
   Só vale com o servidor; sem servidor o app continua usando a restauração antiga (no navegador).
   ============================================================ */
var bkS = { copiaAberta: '', ocupado: false };
function bkApi(url, metodo, corpo){ return pbApi(url, metodo, corpo); }
function bkMsg(t){ var e = qs('backupProgresso'); if (e) e.textContent = t || ''; }
function bkErro(t){ var e = qs('formErrorBackup'); if (e) e.textContent = t || ''; }
function bkDataHora(iso){ var d = new Date(iso); if (isNaN(d)) return ''; var p = function(n){ return (n < 10 ? '0' : '') + n; }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

/* ---------- conferência do arquivo escolhido ---------- */
function bkConferir(dados){
  var box = qs('importarBackupConfirm'), res = qs('importarBackupResumo'); if (!box || !res) return;
  box.style.display = ''; res.textContent = 'Conferindo o arquivo com os dados de hoje…';
  var btn = qs('confirmarImportarBackup'); if (btn) btn.disabled = true;
  bkApi('/api/restaurar/conferir', 'POST', dados).then(function(r){
    if (!r.ok){ backupImportadoPendente = null; box.style.display = 'none'; bkErro((r.problemas || ['Arquivo inválido.']).join(' ')); return; }
    var muda = r.colecoes.filter(function(c){ return c.novos || c.diferentes || c.removidos; }), iguais = r.colecoes.filter(function(c){ return !(c.novos || c.diferentes || c.removidos) && (c.arquivo || c.banco); });
    var linhas = muda.map(function(c){
      return '<div class="plan-linha"><span>' + escapeHtml(c.nome) + '<br><small style="color:var(--ink-soft)">' + c.arquivo + ' no arquivo · ' + c.banco + ' hoje</small></span><span style="text-align:right;font-size:var(--t2);line-height:1.35">' +
        (c.novos ? '+' + c.novos + ' a trazer<br>' : '') + (c.diferentes ? c.diferentes + ' trocados<br>' : '') + (c.removidos ? '<b style="color:var(--danger)">−' + c.removidos + ' removidos</b>' : '') + '</span></div>';
    }).join('') + (iguais.length ? '<div class="saldo-data" style="margin-top:6px">Sem mudanças em: ' + iguais.map(function(c){ return escapeHtml(c.nome); }).join(', ') + '.</div>' : '') + (!muda.length ? '<div class="saldo-data">O arquivo é igual aos dados de hoje: nada vai mudar.</div>' : '');
    res.innerHTML = '<b>Arquivo válido' + (r.exportadoEm ? ' · de ' + escapeHtml(fmtData(String(r.exportadoEm).slice(0, 10))) : '') + '</b><div style="margin:6px 0">' + r.total + ' registros. Comparado com os dados de hoje: <b>' + r.novos + '</b> voltam, <b>' + r.diferentes + '</b> são trocados por versões do backup' +
      (r.removidos ? ' e <b style="color:var(--danger)">' + r.removidos + ' que existem hoje e não estão no arquivo serão removidos</b>' : '') + '.</div>' + linhas;
    var perigo = box.children[1]; if (perigo) perigo.textContent = 'Antes de trocar, o app guarda uma cópia de segurança automática dos dados de hoje, e a troca é feita de uma vez. Se algo não ficar certo, use “Voltar para esta cópia” na lista abaixo.';
    if (btn){ btn.disabled = false; btn.textContent = 'Restaurar com segurança'; }
  }).catch(function(e){ backupImportadoPendente = null; box.style.display = 'none'; bkErro('Não consegui conferir o arquivo: ' + e.message); });
}
function bkAplicar(dados){
  var btn = qs('confirmarImportarBackup'); if (bkS.ocupado) return; bkS.ocupado = true; if (btn) btn.disabled = true; bkErro('');
  bkMsg('Guardando a cópia de segurança e restaurando… não feche esta tela.');
  bkApi('/api/restaurar/aplicar', 'POST', { confirmar: true, arquivo: dados }).then(function(r){
    bkS.ocupado = false; backupImportadoPendente = null;
    bkMsg('Backup restaurado (' + r.restaurados + ' registros). Recarregando…');
    setTimeout(function(){ location.reload(); }, 1200);
  }).catch(function(e){
    bkS.ocupado = false; if (btn) btn.disabled = false; bkMsg('');
    bkErro('Não consegui restaurar: ' + e.message + '. Nada foi alterado: a troca é feita de uma vez ou não é feita.');
  });
}

/* ---------- cópias de segurança automáticas (voltar para uma delas) ---------- */
function bkCopiasRender(){
  var corpo = document.querySelector('#overlayBackup .modal-body'); if (!corpo || !window.__SERVIDOR) return;
  var box = qs('bkCopias');
  if (!box){ box = document.createElement('div'); box.id = 'bkCopias'; box.className = 'subgroup'; corpo.appendChild(box); box.addEventListener('click', bkClique); }
  bkApi('/api/restaurar/copias').then(function(j){
    var it = (j && j.copias) || [];
    box.innerHTML = '<div class="field-label" style="font-weight:700">Cópias de segurança automáticas</div><div class="saldo-data">Antes de cada restauração (e antes de cada “voltar”), o app guarda o estado daquele momento. Ficam as últimas 5.</div>' +
      (it.length ? it.map(function(x){
        var aberta = bkS.copiaAberta === x.id;
        return '<div class="plan-linha"><span>' + escapeHtml(bkDataHora(x.em)) + '<br><small style="color:var(--ink-soft)">' + escapeHtml(x.motivo || '') + ' · ' + x.docs + ' registros</small></span>' +
          (aberta ? '' : '<button type="button" class="btn-text" data-bk="voltar" data-id="' + escapeHtml(x.id) + '">Voltar para esta cópia</button>') + '</div>' +
          (aberta ? '<div style="padding:10px;border-radius:var(--radius-sm);background:var(--surface-2);margin:4px 0 8px"><div style="font-size:var(--t3);margin-bottom:8px">Isto troca os dados de hoje pelos desta cópia (' + escapeHtml(bkDataHora(x.em)) + '). Os dados de hoje também ficam guardados, então dá para voltar atrás.</div><div style="display:flex;gap:10px"><button type="button" class="btn btn-ghost" data-bk="cancelar" style="flex:1">Cancelar</button><button type="button" class="btn btn-primary" data-bk="confirmar" data-id="' + escapeHtml(x.id) + '" style="flex:1">Voltar para esta cópia</button></div></div>' : '');
      }).join('') : '<div class="saldo-data">Ainda não há cópias de segurança. Elas aparecem depois da primeira restauração.</div>');
  }).catch(function(){ box.innerHTML = ''; });
}
function bkClique(e){
  var b = e.target.closest ? e.target.closest('[data-bk]') : null; if (!b) return;
  var a = b.getAttribute('data-bk'), id = b.getAttribute('data-id');
  if (a === 'voltar'){ bkS.copiaAberta = id; bkCopiasRender(); }
  else if (a === 'cancelar'){ bkS.copiaAberta = ''; bkCopiasRender(); }
  else if (a === 'confirmar'){
    if (bkS.ocupado) return; bkS.ocupado = true; b.disabled = true; bkErro(''); bkMsg('Voltando para a cópia… não feche esta tela.');
    bkApi('/api/restaurar/desfazer', 'POST', { copia: id }).then(function(r){
      bkS.ocupado = false; bkS.copiaAberta = ''; bkMsg('Pronto (' + r.restaurados + ' registros). Recarregando…'); setTimeout(function(){ location.reload(); }, 1200);
    }).catch(function(err){ bkS.ocupado = false; b.disabled = false; bkMsg(''); bkErro('Não consegui voltar para a cópia: ' + err.message + '. Nada foi alterado.'); });
  }
}
(function(){
  var ov = qs('overlayBackup'); if (!ov || !window.__SERVIDOR) return;
  new MutationObserver(function(){ if (ov.classList.contains('show')) bkCopiasRender(); }).observe(ov, { attributes: true, attributeFilter: ['class'] });
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { bkRender: bkCopiasRender });
})();
