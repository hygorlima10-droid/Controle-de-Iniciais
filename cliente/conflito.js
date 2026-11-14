
/* ============================================================
   CONFLITO DE EDIÇÃO E CARGA SEM TETO (prefixo cfl) — Fase 3, etapa 3.10
   - Se você salva um registro que OUTRO aparelho alterou enquanto você editava, o servidor não grava por cima: o app mostra o que mudou
     (sua versão × a do servidor) e pergunta: "Usar a do outro aparelho" ou "Manter a minha". Só vale para os registros de trabalho
     (petições, acordos, alvarás, clientes, despesas, receitas, metas e lançamentos da obra); configurações automáticas não perguntam.
   - As listas não têm mais o teto de 1.000 registros: o servidor entrega páginas e o app lê até o fim; enquanto isso aparece
     "Carregando mais registros…". A conta do fechamento de mês só roda depois que tudo terminou de carregar.
   ============================================================ */
var CFL_COL = { casos: 'Petição', termosAcordo: 'Acordo', alvaras: 'Alvará', clientes: 'Cliente', despesas: 'Despesa', receitasManuais: 'Receita', metas: 'Meta', obraMov: 'Lançamento da obra' };
var CFL_ROT = { valor: 'Valor', valorHonorarios: 'Valor dos honorários', valorMeuHonorario: 'Meu honorário', valorTotal: 'Valor total', valorPadrao: 'Valor padrão', vencimento: 'Vencimento', data: 'Data', dataPagamento: 'Pago em', nome: 'Nome', cliente: 'Cliente', partes: 'Partes', descricao: 'Descrição', status: 'Situação', pago: 'Pago', parcelas: 'Parcelas', coluna: 'Conta (PJ/PF)', categoria: 'Categoria', diaVencimento: 'Dia do vencimento', observacoes: 'Observações', tipo: 'Tipo', origem: 'Origem', previsaoLevantamento: 'Previsão do levantamento', etapaId: 'Etapa', numeroProcesso: 'Nº do processo', fase: 'Fase', valorAlvo: 'Valor alvo', prazo: 'Prazo' };
var CFL_IGN = { atualizadoEm: 1, criadoEm: 1, statusDesde: 1, faseDesde: 1, ordem: 1 };
var cflFila = Promise.resolve();
function cflValor(k, v){
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'number') return /valor|honor|total|saldo|preco/i.test(k) ? fmtMoeda(v) : String(v);
  if (Array.isArray(v)) return v.length + (v.length === 1 ? ' item' : ' itens') + ' (alterado)';
  if (typeof v === 'object') return 'alterado';
  var t = String(v); if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return fmtData(t); return t.length > 70 ? t.slice(0, 67) + '…' : t;
}
function cflDiffs(a, b){
  var ks = {}; Object.keys(a || {}).concat(Object.keys(b || {})).forEach(function(k){ ks[k] = 1; });
  return Object.keys(ks).filter(function(k){ return !CFL_IGN[k] && JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k]); });
}
function cflMostrar(info){
  return new Promise(function(res){
    var dif = cflDiffs(info.minha, info.servidor);
    if (!dif.length){ res('minha'); return; }
    var nome = String((info.servidor && (info.servidor.cliente || info.servidor.nome || info.servidor.partes || info.servidor.descricao)) || (info.minha && (info.minha.cliente || info.minha.nome || info.minha.partes)) || '').slice(0, 60);
    var hora = new Date(info.quando), hh = String(hora.getHours()).padStart(2, '0') + ':' + String(hora.getMinutes()).padStart(2, '0');
    var d = document.createElement('div'); d.className = 'overlay show cfl-ov'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = '<div class="modal cfl-modal"><div class="modal-head"><h2>Este registro foi alterado em outro aparelho</h2></div><div class="modal-body">' +
      '<div class="saldo-data">' + escapeHtml(CFL_COL[info.colecao] || 'Registro') + (nome ? ' · ' + escapeHtml(nome) : '') + ' · alterado às ' + hh + ' enquanto você editava.</div>' +
      '<div class="an-tab-rolar cfl-tab"><table><thead><tr><th></th><th class="n">Sua versão</th><th class="n">No servidor</th></tr></thead><tbody>' +
      dif.slice(0, 8).map(function(k){ return '<tr><th scope="row">' + escapeHtml(CFL_ROT[k] || k) + '</th><td class="n">' + escapeHtml(cflValor(k, (info.minha || {})[k])) + '</td><td class="n cfl-srv">' + escapeHtml(cflValor(k, (info.servidor || {})[k])) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (dif.length > 8 ? '<div class="saldo-data">e mais ' + (dif.length - 8) + ' campo(s) diferentes.</div>' : '') +
      '<div class="saldo-data">Nada foi gravado ainda. Escolha qual versão vale.</div></div>' +
      '<div class="modal-foot"><button type="button" class="btn btn-primary" data-cfl="outra">Usar a do outro aparelho</button><button type="button" class="btn btn-ghost" data-cfl="minha">Manter a minha</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function(ev){
      var b = ev.target.closest ? ev.target.closest('[data-cfl]') : null; if (!b) return;
      var esc = b.getAttribute('data-cfl'); d.remove(); res(esc);
    });
  });
}
window.__horusConflito = function(info){
  var p = cflFila.then(function(){ return cflMostrar(info); });
  cflFila = p.then(function(){}, function(){});
  return p;
};
/* aviso de carga em páginas */
(function(){
  var estado = {};
  window.addEventListener('horus-carga', function(ev){
    var d = ev.detail || {}; estado[d.nome] = d;
    var el = document.getElementById('cargaMais'), falta = Object.keys(estado).filter(function(k){ return !estado[k].completo; });
    if (!falta.length){ if (el) el.remove(); return; }
    if (!el){ el = document.createElement('div'); el.id = 'cargaMais'; el.className = 'cfl-carga'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    var rot = { casos: 'petições', termosAcordo: 'acordos', alvaras: 'alvarás', clientes: 'clientes', despesas: 'despesas', receitasManuais: 'receitas', metas: 'metas', extratos: 'extratos', obraMov: 'obra', agenda: 'agenda', processos: 'processos' };
    el.textContent = 'Carregando mais registros… (' + falta.map(function(k){ return (rot[k] || k) + ': ' + fmtInt(estado[k].lidos); }).join(' · ') + ')';
  });
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { cflDiffs: cflDiffs });
  var st = document.createElement('style'); st.id = 'cflCss';
  st.textContent = '.cfl-ov{z-index:9000}.cfl-modal{max-width:560px}.cfl-tab th,.cfl-tab td{padding:7px 8px;font-size:var(--t3)}.cfl-srv{font-weight:700}.cfl-modal .modal-foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}' +
    '.cfl-carga{position:fixed;left:50%;bottom:calc(86px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:8000;background:var(--ink);color:var(--bg);border-radius:99px;padding:8px 16px;font-size:var(--t2);font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:92vw;text-align:center}';
  document.head.appendChild(st);
})();
