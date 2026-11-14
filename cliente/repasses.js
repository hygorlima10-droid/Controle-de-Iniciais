/* ============================================================
   DIVISÃO DOS HONORÁRIOS E REPASSES ENTRE ADVOGADOS (prefixo rc) — Fase 5, etapa 5.6
   - Divisão: quem cadastra a Inicial, o Acordo ou o Alvará define a parte de cada advogado do processo (em %); vale para os recebimentos daquele registro.
     Substitui o antigo "Repassar parte a advogado parceiro" (o que já estava cadastrado vira uma linha de parceiro, e o resto é do proprietário).
   - Ao marcar um recebimento, o app guarda a divisão daquele momento e em que conta o dinheiro entrou (`divisaoRec`). Quem está com o dinheiro repassa a parte
     dos outros: nasce um repasse (coleção `repasses`) para cada advogado cadastrado. Quem paga marca "já repassei"; quem recebe confirma.
   - No financeiro do proprietário só entra o que ele recebe de fato: parte dele quando o dinheiro entra na conta dele; quando entra na conta de outro advogado,
     a parte dele fica "a receber" e vira receita da PJ só quando ele confirma o repasse.
   - Cada pessoa vê os repasses em que paga ou recebe (card "Repasses" no Início); a divisão completa do registro é visível a quem está no processo.
   ============================================================ */
var rcS = { div: {}, lista: [], carregado: false, sync: false, timer: null, perguntando: null, base: {} };
var RC_TIPO = { casos: 'caso', termosAcordo: 'acordo', alvaras: 'alvara' }, RC_FORM = { casos: 'Caso', termosAcordo: 'Acordo', alvaras: 'Alvara' };
function rcSouDono(){ return !esS.eu || esS.eu.papel === 'proprietario'; }
function rcPapel(){ return esS.eu ? esS.eu.papel : 'proprietario'; }
function rcDonoChaves(){ return rcSouDono() ? esMinhasChaves() : []; }
function rcMinhaChave(){ var k = esMinhasChaves(); return k[0] || 'dono'; }
function rcMinhas(){ var k = esMinhasChaves(); return k.length ? k : ['dono']; }
function rcNomeChave(k){ return k === 'dono' ? (esS.eu && esS.eu.nome ? esS.eu.nome : 'Proprietário') : esNomeChave(k); }
function rcPct(v){ v = Number(String(v == null ? '' : v).replace(',', '.')); return isFinite(v) ? Math.max(0, Math.min(100, v)) : 0; }
function rcFmtPct(v){ return String(Math.round(v * 100) / 100).replace('.', ',') + '%'; }

/* ---------- a divisão do registro (e o que ela significa para o financeiro do proprietário) ---------- */
function rcDivisaoDe(doc, chave){
  if (doc && doc.divisao && Array.isArray(doc.divisao.partes) && doc.divisao.partes.length) return doc.divisao.partes.map(function(p){ return { oab: p.oab || '', nome: p.nome || '', pct: Number(p.pct) || 0 }; });
  var r = doc && doc.repasse && doc.repasse.ativo ? doc.repasse : null; if (!r) return [];
  var tipo = RC_TIPO[chave], base = tipo ? repBaseDoc(tipo, doc) : 0, p = r.modo === 'valor' ? (base > 0 ? (Number(r.valor) || 0) / base * 100 : 0) : (Number(r.percentual) || 0);
  p = Math.max(0, Math.min(100, p)); var dono = rcDonoChaves()[0] || rcMinhaChave();
  return [{ oab: dono, nome: rcNomeChave(dono), pct: Math.round((100 - p) * 100) / 100 }, { oab: '', nome: String(r.parceiro || 'Parceiro'), pct: Math.round(p * 100) / 100 }];
}
/* o "repasse" no formato antigo, calculado da divisão: serve às contas do proprietário (fator da parte dele); undefined = sem divisão (vale o formato antigo) */
function rcRepasseDeDivisao(doc){
  if (!doc || !doc.divisao || !Array.isArray(doc.divisao.partes) || doc.divisao.partes.length < 2 || !rcSouDono()) return undefined;
  var ks = rcDonoChaves(), minha = 0, outros = [];
  doc.divisao.partes.forEach(function(p){ if (p.oab && ks.indexOf(p.oab) >= 0) minha += Number(p.pct) || 0; else outros.push(p.nome || p.oab); });
  if (!outros.length) return null;
  return { ativo: true, parceiro: outros.join(', '), modo: 'percentual', percentual: Math.max(0, Math.min(100, 100 - minha)) };
}
function rcNo(u, doc){
  if (!doc) return null;
  switch (u.kind){
    case 'avista': return doc.avista;
    case 'parcela': case 'acordoParcela': return (doc.parcelas || []).filter(function(p){ return p.numero === u.numero; })[0];
    case 'exitoAvista': return doc.exito && doc.exito.avista;
    case 'exitoParcela': return doc.exito && (doc.exito.parcelas || []).filter(function(p){ return p.numero === u.numero; })[0];
    default: return doc;   // acordo único e alvará: o próprio registro
  }
}
function rcDocDe(u){ return (u.docTipo === 'caso' ? casos : (u.docTipo === 'acordo' ? acordos : alvaras)).filter(function(x){ return x.id === u.docId; })[0] || null; }
/* o pagamento já feito vale pela divisão e pela conta daquele momento */
function rcAjustarUnidade(u, doc){
  if (!rcSouDono()) return;
  var n = rcNo(u, doc), s = n && n.divisaoRec; if (!s) return;
  var ks = rcDonoChaves(), euRecebi = ks.indexOf(s.recebeu) >= 0, minha = 0, outros = [];
  (s.partes || []).forEach(function(p){ if (p.oab && ks.indexOf(p.oab) >= 0) minha += Number(p.pct) || 0; else outros.push(p.nome || p.oab); });
  if (euRecebi){ u.fator = Math.max(0, Math.min(1, minha / 100)); u.repasse = u.fator < 1; u.parceiro = outros.join(', '); }
  else { u.fator = 0; u.repasse = false; u.parceiro = ''; u.recebidoPorOutro = true; }   // o dinheiro está com outro advogado: só vira receita quando o repasse for confirmado
}
function rcCarimbarDivisao(n, doc, agora){
  var d = doc && doc.divisao; if (!d || !Array.isArray(d.partes) || d.partes.length < 2) return;
  var me = rcMinhaChave(), outros = d.partes.some(function(p){ return p.oab && p.oab !== me; });
  n.divisaoRec = { recebeu: me, partes: d.partes.map(function(p){ return { oab: p.oab || '', nome: p.nome || '', pct: Number(p.pct) || 0 }; }), por: rcNomeChave(me), porChave: me, em: agora, perguntar: outros };
}

/* ---------- a divisão nos cadastros (Inicial, Acordo, Alvará) ---------- */
function rcDivIniciar(chave, doc){
  var partes = rcDivisaoDe(doc, chave);
  rcS.div[chave] = { partes: partes };
  var sel = esS.resp[chave] || (esS.resp[chave] = []);
  partes.forEach(function(p){ if (p.oab && !sel.some(function(x){ return x.oab === p.oab; })) sel.push({ oab: p.oab, nome: p.nome }); });
  rcDivSync(chave); rcDivDesenhar(chave);
}
function rcDivSync(chave){
  var D = rcS.div[chave]; if (!D) return;
  var sel = (esS.resp[chave] || []).map(function(a){ return a.oab; }), manter = [];
  D.partes.forEach(function(p){ if (!p.oab || sel.indexOf(p.oab) >= 0) manter.push(p); });
  sel.forEach(function(k){ if (!manter.some(function(p){ return p.oab === k; })) manter.push({ oab: k, nome: esNomeChave(k), pct: 0 }); });
  D.partes = manter;
  var com = D.partes.filter(function(p){ return p.oab; }).length, sem = D.partes.filter(function(p){ return !p.oab; }).length;
  if (D.partes.length >= 2 && D.partes.every(function(p){ return !p.pct; })) { var n = D.partes.length; D.partes.forEach(function(p){ p.pct = Math.round(10000 / n) / 100; }); D.partes[0].pct = Math.round((100 - D.partes.slice(1).reduce(function(t, p){ return t + p.pct; }, 0)) * 100) / 100; }
}
function rcDivBase(chave){ try{ return repBaseForm(RC_FORM[chave]); }catch(e){ return 0; } }
function rcDivHtml(chave){
  var D = rcS.div[chave]; if (!D) return '';
  var base = rcDivBase(chave), n = D.partes.length;
  if (n < 2) return '<div class="saldo-data" style="margin-top:2px">Com mais de um advogado, aparece aqui a divisão dos honorários. <button type="button" class="es-lk" data-rcd="parceiro" data-c="' + chave + '">Dividir com parceiro sem cadastro</button></div>';
  var soma = D.partes.reduce(function(t, p){ return t + (Number(p.pct) || 0); }, 0), ok = Math.abs(soma - 100) < 0.05;
  var h = '<label class="field-label">Divisão dos honorários</label><div class="es-lista">' + D.partes.map(function(p, i){
    return '<div class="rc-lin"><span class="rc-nm"><b>' + escapeHtml(p.nome || p.oab) + '</b>' + (p.oab ? '<span class="saldo-data"> OAB ' + escapeHtml(p.oab) + '</span>' : '<span class="saldo-data"> parceiro sem cadastro</span>') + '</span>' +
      '<input type="text" inputmode="decimal" class="rc-pct" data-rcd="pct" data-c="' + chave + '" data-i="' + i + '" value="' + escapeHtml(String(p.pct || '').replace('.', ',')) + '" aria-label="Percentual de ' + escapeHtml(p.nome || p.oab) + '"><span>%</span>' +
      '<b class="rc-val" id="rcv_' + chave + '_' + i + '">' + (base > 0 ? fmtMoeda(Math.round(base * (Number(p.pct) || 0)) / 100) : '') + '</b>' + (p.oab ? '' : '<button type="button" class="es-x" data-rcd="tirar" data-c="' + chave + '" data-i="' + i + '" aria-label="Tirar">✕</button>') + '</div>';
  }).join('') + '</div><div class="saldo-data" id="rcs_' + chave + '" style="' + (ok ? '' : 'color:var(--urgente);font-weight:700') + '">' + (ok ? 'Soma 100%.' : 'Soma ' + rcFmtPct(soma) + ': precisa fechar 100%.') + ' Vale para os recebimentos deste registro: cada advogado fica com a sua parte.</div>' +
    '<div class="pb-acts" style="justify-content:flex-start;margin:2px 0"><button type="button" class="es-lk" data-rcd="igual" data-c="' + chave + '">Dividir igualmente</button><button type="button" class="es-lk" data-rcd="parceiro" data-c="' + chave + '">Adicionar parceiro sem cadastro</button></div>';
  return h;
}
function rcDivDesenhar(chave){ var el = qs('rcDiv_' + chave); if (el) el.innerHTML = rcDivHtml(chave); }
function rcDivAplicar(chave, dados, erroEl){
  var D = rcS.div[chave]; if (!D || !qs('rcDiv_' + chave)) return true;
  var ps = D.partes.filter(function(p){ return p.oab || p.nome; });
  if (ps.length < 2){ dados.divisao = null; return true; }
  var soma = ps.reduce(function(t, p){ return t + (Number(p.pct) || 0); }, 0);
  if (Math.abs(soma - 100) > 0.05){ if (erroEl) erroEl.textContent = 'A divisão dos honorários precisa somar 100% (hoje soma ' + rcFmtPct(soma) + ').'; return false; }
  dados.divisao = { partes: ps.map(function(p){ return { oab: p.oab || '', nome: p.nome || '', pct: Math.round((Number(p.pct) || 0) * 100) / 100 }; }) };
  dados.repasse = null;   // o formato antigo (um parceiro) foi absorvido pela divisão
  return true;
}
document.addEventListener('input', function(e){
  var t = e.target; if (!t || !t.getAttribute || t.getAttribute('data-rcd') !== 'pct') return;
  var c = t.getAttribute('data-c'), i = Number(t.getAttribute('data-i')), D = rcS.div[c]; if (!D || !D.partes[i]) return;
  D.partes[i].pct = rcPct(t.value);
  var soma = D.partes.reduce(function(s, p){ return s + (Number(p.pct) || 0); }, 0), ok = Math.abs(soma - 100) < 0.05, el = qs('rcs_' + c), base = rcDivBase(c);
  if (el){ el.style.cssText = ok ? '' : 'color:var(--urgente);font-weight:700'; el.textContent = (ok ? 'Soma 100%.' : 'Soma ' + rcFmtPct(soma) + ': precisa fechar 100%.') + ' Vale para os recebimentos deste registro: cada advogado fica com a sua parte.'; }
  D.partes.forEach(function(p, k){ var v = qs('rcv_' + c + '_' + k); if (v) v.textContent = base > 0 ? fmtMoeda(Math.round(base * (Number(p.pct) || 0)) / 100) : ''; });
});
document.addEventListener('click', function(e){
  var b = e.target.closest ? e.target.closest('[data-rcd]') : null; if (!b) return;
  var a = b.getAttribute('data-rcd'), c = b.getAttribute('data-c'), D = rcS.div[c]; if (!D) return;
  if (a === 'igual'){ var n = D.partes.length; D.partes.forEach(function(p){ p.pct = Math.round(10000 / n) / 100; }); D.partes[0].pct = Math.round((100 - D.partes.slice(1).reduce(function(t, p){ return t + p.pct; }, 0)) * 100) / 100; rcDivDesenhar(c); }
  else if (a === 'parceiro'){ var nome = window.prompt ? window.prompt('Nome do advogado parceiro (sem cadastro no app):') : ''; if (nome && nome.trim()){ D.partes.push({ oab: '', nome: nome.trim().slice(0, 60), pct: 0 }); rcDivDesenhar(c); } }
  else if (a === 'tirar'){ D.partes.splice(Number(b.getAttribute('data-i')), 1); rcDivDesenhar(c); }
});

/* ---------- repasses: carregar, reconciliar com os recebimentos e agir ---------- */
function rcId(chave, oab, ts){ var s = chave + '|' + oab + '|' + ts, h1 = 5381, h2 = 52711; for (var i = 0; i < s.length; i++){ h1 = ((h1 * 33) ^ s.charCodeAt(i)) >>> 0; h2 = ((h2 * 31) + s.charCodeAt(i)) >>> 0; } return 'r' + h1.toString(36) + h2.toString(36); }
function rcCarregar(){
  if (!window.__SERVIDOR || (rcPapel() !== 'proprietario' && rcPapel() !== 'advogado')) return Promise.resolve();
  return pbApi('/api/db/repasses').then(function(j){ rcS.lista = (j.docs || []).map(function(d){ var x = d.data || {}; x.id = d.id; return x; }); rcS.carregado = true; rcDesenharInicio(); }).catch(function(){ rcS.carregado = true; });
}
function rcPut(r, mudancas){ var novo = Object.assign({}, r, mudancas); delete novo.id; return pbApi('/api/db/repasses/' + encodeURIComponent(r.id), 'PUT', novo).then(function(){ Object.assign(r, mudancas); return r; }); }
function rcAgendarSync(){ clearTimeout(rcS.timer); rcS.timer = setTimeout(function(){ try{ rcSincronizar(); }catch(e){ console.error('repasses', e); } }, 900); }
window.__aposGravar = function(nome){ if (nome === 'casos' || nome === 'termosAcordo' || nome === 'alvaras') rcAgendarSync(); };
/* a cada gravação: cada pagamento com divisão e conta registrada gera um repasse para cada advogado cadastrado que não está com o dinheiro; o que deixou de valer é cancelado */
function rcSincronizar(){
  var papel = rcPapel(); if (!rcS.carregado || rcS.sync || (papel !== 'proprietario' && papel !== 'advogado')) return;
  var desejados = {}, perguntar = null;
  listarUnidades().forEach(function(u){
    var doc = rcDocDe(u), n = doc && rcNo(u, doc), s = n && n.divisaoRec; if (!s || !u.pago) return;
    if (s.perguntar && s.porChave && rcMinhas().indexOf(s.porChave) >= 0 && !perguntar) perguntar = { u: u, doc: doc, n: n };
    (s.partes || []).forEach(function(p){
      if (!p.oab || p.oab === s.recebeu || !(Number(p.pct) > 0)) return;
      desejados[u.chave + '|' + p.oab] = { chave: u.chave, docTipo: u.docTipo, docId: u.docId, valor: Math.round(u.valor * p.pct) / 100, cliente: u.cliente, processo: u.processo || '', label: u.label,
        de: { oab: s.recebeu, nome: (s.partes.filter(function(x){ return x.oab === s.recebeu; })[0] || {}).nome || rcNomeChave(s.recebeu) }, para: { oab: p.oab, nome: p.nome || rcNomeChave(p.oab) }, ts: n.recebidoEm || s.em || '' };
    });
  });
  var ops = [];
  rcS.lista.forEach(function(r){
    if (r.status === 'cancelado') return;
    var k = r.chave + '|' + (r.para && r.para.oab), d = desejados[k], igual = d && Math.abs(d.valor - r.valor) < 0.006 && d.de.oab === r.de.oab;
    if (igual){ d.ok = true; return; }
    if (r.status === 'confirmado') return;   // já confirmado não se desfaz sozinho
    ops.push(function(){ return rcPut(r, { status: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: rcMinhaChave() }); });
  });
  Object.keys(desejados).forEach(function(k){
    var d = desejados[k]; if (d.ok) return;
    var id = rcId(d.chave, d.para.oab, d.ts), doc = { docTipo: d.docTipo, docId: d.docId, chave: d.chave, valor: d.valor, cliente: d.cliente, processo: d.processo, label: d.label, de: d.de, para: d.para, status: 'pendente', criadoEm: new Date().toISOString(), criadoPorNome: rcNomeChave(rcMinhaChave()) };
    ops.push(function(){ return pbApi('/api/db/repasses/' + id + '?soNovo=1', 'PUT', doc).then(function(j){ if (j && j.criado !== false){ doc.id = id; rcS.lista.push(doc); } }); });
  });
  if (!ops.length){ if (perguntar) rcPerguntar(perguntar); return; }
  rcS.sync = true;
  ops.reduce(function(p, f){ return p.then(f); }, Promise.resolve()).catch(function(e){ console.error('repasses', e); }).then(function(){ rcS.sync = false; return rcCarregar(); }).then(function(){ if (perguntar) rcPerguntar(perguntar); });
}

/* ---------- "em que conta o dinheiro entrou?" ---------- */
function rcPatchNo(u, doc, nova){
  switch (u.kind){
    case 'avista': return { avista: Object.assign({}, doc.avista, { divisaoRec: nova }) };
    case 'parcela': case 'acordoParcela': return { parcelas: doc.parcelas.map(function(p){ return p.numero === u.numero ? Object.assign({}, p, { divisaoRec: nova }) : p; }) };
    case 'exitoAvista': return { exito: Object.assign({}, doc.exito, { avista: Object.assign({}, doc.exito.avista, { divisaoRec: nova }) }) };
    case 'exitoParcela': return { exito: Object.assign({}, doc.exito, { parcelas: doc.exito.parcelas.map(function(p){ return p.numero === u.numero ? Object.assign({}, p, { divisaoRec: nova }) : p; }) }) };
    default: return { divisaoRec: nova };
  }
}
function rcPerguntar(q){
  if (rcS.perguntando) return; rcS.perguntando = q;
  var s = q.n.divisaoRec, ov = sgMontar('overlayRcConta', 'Onde o dinheiro entrou?');
  if (!ov.getAttribute('data-rc')){ ov.setAttribute('data-rc', '1');
    ov.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-rcq]') : null; if (b && b.getAttribute('data-rcq') !== 'conta') rcPerguntaClique(b.getAttribute('data-rcq')); });
    ov.addEventListener('change', function(e){ var t = e.target; if (t && t.getAttribute && t.getAttribute('data-rcq') === 'conta' && rcS.perguntando){ rcS.perguntando.sel = t.value; rcPerguntaDesenhar(); } });
    ov.addEventListener('click', function(e){ if (e.target === ov && rcS.perguntando) rcPerguntaClique('depois'); });
  }
  q.sel = s.recebeu; rcPerguntaDesenhar(); ov.classList.add('show');
}
function rcPerguntaDesenhar(){
  var q = rcS.perguntando, el = qs('overlayRcContaC'); if (!q || !el) return;
  var s = q.n.divisaoRec, sel = q.sel, valor = q.u.valor, h = '<div class="pb-sec"><div class="pb-sec-t">' + escapeHtml(q.u.cliente) + ' · ' + escapeHtml(q.u.label) + ' · ' + fmtMoeda(valor) + '</div><div class="pb-aviso">Marque em que conta o dinheiro entrou: quem está com ele repassa a parte dos outros advogados do processo.</div></div>';
  h += s.partes.filter(function(p){ return p.oab; }).map(function(p){ return '<label class="ad-it" style="border:0;padding:4px 0"><input type="radio" name="rcConta" data-rcq="conta" value="' + escapeHtml(p.oab) + '"' + (sel === p.oab ? ' checked' : '') + '><span class="ad-t">Na conta de ' + escapeHtml(p.nome || p.oab) + (rcMinhas().indexOf(p.oab) >= 0 ? ' (você)' : '') + '</span></label>'; }).join('');
  h += '<div class="pb-sec" style="margin-top:8px"><div class="pb-sec-t">Divisão deste registro</div></div>' + s.partes.map(function(p){ return '<div class="pb-lin"><span>' + escapeHtml(p.nome || p.oab) + ' · ' + rcFmtPct(p.pct) + '</span><b>' + fmtMoeda(Math.round(valor * p.pct) / 100) + '</b></div>'; }).join('');
  var minhas = rcMinhas(), euRecebi = minhas.indexOf(sel) >= 0, minha = s.partes.filter(function(p){ return minhas.indexOf(p.oab) >= 0; }).reduce(function(t, p){ return t + p.pct; }, 0), minhaParte = Math.round(valor * minha) / 100;
  h += '<div class="es-aplicar">' + (euRecebi ? 'Sua parte: <b>' + fmtMoeda(minhaParte) + '</b>. Você repassa <b>' + fmtMoeda(valor - minhaParte) + '</b> aos outros advogados' + (rcSouDono() ? '; só a sua parte entra na PJ' : '') + '.' : (minha > 0 ? 'Sua parte: <b>' + fmtMoeda(minhaParte) + '</b>, que <b>' + escapeHtml(rcNomeChave(sel)) + '</b> repassa a você' + (rcSouDono() ? '; entra na PJ quando você confirmar que recebeu.' : '.') : 'Você não está na divisão deste recebimento.')) + '</div>';
  h += '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-rcq="ok">Confirmar</button><button type="button" class="btn btn-ghost pb-b" data-rcq="depois">Deixar como está</button></div>';
  el.innerHTML = h;
}
function rcPerguntaClique(a){
  var q = rcS.perguntando; if (!q) return;
  var nova = Object.assign({}, q.n.divisaoRec, { perguntar: false }); if (a === 'ok') nova.recebeu = q.sel || nova.recebeu;
  qs('overlayRcConta').classList.remove('show'); rcS.perguntando = null;
  Promise.resolve(persistPatchDoc(q.u.docTipo, q.doc, rcPatchNo(q.u, q.doc, nova))).then(function(){ rcAgendarSync(); try{ renderTudo(); }catch(e){} });
}

/* ---------- card "Repasses" no Início ---------- */
function rcMeus(){ var ks = rcMinhas(); return rcS.lista.filter(function(r){ return r.status !== 'cancelado' || (r.para && ks.indexOf(r.para.oab) >= 0 && !(r.vistoPor && ks.some(function(k){ return r.vistoPor[k]; }))); }).filter(function(r){ return ks.indexOf(r.de && r.de.oab) >= 0 || ks.indexOf(r.para && r.para.oab) >= 0 || rcSouDono(); }); }
function rcDesenharInicio(){
  try{ ppDesenharHon(); }catch(e){}
  var el = qs('rcInicio'); if (!el) return;
  var ks = rcMinhas(), euPaga = function(r){ return ks.indexOf(r.de && r.de.oab) >= 0; }, euRecebo = function(r){ return ks.indexOf(r.para && r.para.oab) >= 0; }, visto = function(r){ return r.vistoPor && ks.some(function(k){ return r.vistoPor[k]; }); };
  var lin = [];
  rcS.lista.forEach(function(r){
    var onde = escapeHtml([r.cliente, r.label].filter(Boolean).join(' · ')), v = fmtMoeda(r.valor), de = escapeHtml(String(r.de.nome || '').split(' ')[0]), para = escapeHtml(String(r.para.nome || '').split(' ')[0]);
    if (euRecebo(r) && r.status === 'pendente' && !visto(r)) lin.push({ cor: '#17895A', t: de + ' recebeu honorários', s: onde + ' · seu repasse: <b>' + v + ' a receber</b>', acoes: [['dispensar', 'Dispensar']], r: r });
    else if (euRecebo(r) && r.status === 'feito') lin.push({ cor: '#C98500', t: de + ' diz que repassou ' + v, s: onde, acoes: [['confirmar', 'Confirmar que recebi'], ['nao', 'Ainda não recebi']], r: r });
    else if (euRecebo(r) && r.status === 'cancelado' && !visto(r) && !(r.canceladoPor && ks.indexOf(r.canceladoPor) >= 0)) lin.push({ cor: '#D93B3B', t: 'Recebimento desfeito por ' + de, s: onde + ' · ' + v, acoes: [['dispensar', 'Dispensar']], r: r });
    else if (euPaga(r) && r.status === 'pendente') lin.push({ cor: '#D93B3B', t: 'Você deve repassar ' + v + ' a ' + para, s: onde, acoes: [['repassei', 'Já repassei']], r: r });
    else if (euPaga(r) && r.status === 'feito') lin.push({ cor: '#8A93AD', t: 'Aguardando ' + para + ' confirmar ' + v, s: onde, acoes: [], r: r });
  });
  if (!lin.length){ el.innerHTML = ''; return; }
  el.innerHTML = '<div class="rc-card"><div class="pb-sec-t" style="margin:0 0 6px">Repasses</div>' + lin.map(function(x){ return '<div class="rc-it" style="border-left:4px solid ' + x.cor + '"><b>' + x.t + '</b><div class="saldo-data" style="margin:2px 0 4px">' + x.s + '</div>' + (x.acoes.length ? '<div>' + x.acoes.map(function(a){ return '<button type="button" class="es-lk" data-rcr="' + a[0] + '" data-id="' + escapeHtml(x.r.id) + '"' + (a[0] === 'nao' ? ' style="color:var(--urgente)"' : '') + '>' + a[1] + '</button>'; }).join(' · ') + '</div>' : '') + '</div>'; }).join('') + '</div>';
}
document.addEventListener('click', function(e){
  var b = e.target.closest ? e.target.closest('[data-rcr]') : null; if (!b) return;
  var a = b.getAttribute('data-rcr'), r = rcS.lista.filter(function(x){ return x.id === b.getAttribute('data-id'); })[0]; if (!r || rcS.sync) return;
  var ks = rcMinhas(), agora = new Date().toISOString(), fim = function(msg){ rcS.sync = false; if (msg) toast(msg); rcDesenharInicio(); try{ renderTudo(); }catch(x){} }, erro = function(x){ rcS.sync = false; toast('Não consegui salvar: ' + x.message); };
  rcS.sync = true;
  if (a === 'dispensar'){ var vp = Object.assign({}, r.vistoPor || {}); ks.forEach(function(k){ vp[k] = true; }); rcPut(r, { vistoPor: vp }).then(function(){ fim(); }).catch(erro); }
  else if (a === 'nao'){ rcPut(r, { status: 'pendente', feitoEm: '' }).then(function(){ fim('O aviso voltou para ' + String(r.de.nome).split(' ')[0] + '.'); }).catch(erro); }
  else if (a === 'confirmar'){
    var dono = rcSouDono() && ks.indexOf(r.para.oab) >= 0, data = todayISO();
    var passo = rcPut(r, { status: 'confirmado', confirmadoEm: agora });
    if (dono) passo = passo.then(function(){ return Promise.resolve(persistNovaReceita({ coluna: 'pj', descricao: 'Repasse de ' + r.de.nome + (r.cliente ? ' · ' + r.cliente : '') + (r.label ? ' · ' + r.label : ''), recorrente: false, valor: r.valor, data: data, mesReferencia: data.slice(0, 7), repasseId: r.id })); });
    passo.then(function(){ fim(dono ? 'Repasse confirmado: ' + fmtMoeda(r.valor) + ' entraram na PJ.' : 'Repasse confirmado.'); }).catch(erro);
  }
  else if (a === 'repassei'){
    var donoPaga = rcSouDono() && ks.indexOf(r.de.oab) >= 0, passo2 = rcPut(r, { status: 'feito', feitoEm: agora });
    if (donoPaga) passo2 = passo2.then(function(){ var dd = todayISO(); return Promise.resolve(persistNovaDespesa({ nome: 'Repasse — ' + r.para.nome + (r.cliente ? ' (' + r.cliente + ')' : ''), coluna: 'pj', tipo: 'unica', categoria: 'outros', observacoes: 'Repasse a advogado parceiro', valor: r.valor, data: dd, mesReferencia: dd.slice(0, 7), pago: true, dataPagamento: dd, pagoEm: agora, valorPadrao: null, diaVencimento: null, ativa: true, pausadaAPartirDeMes: null, pagamentos: {}, transferenciaId: 'rep-' + r.id, repasse: { chave: r.docTipo + '|' + r.docId, docTipo: r.docTipo, docId: r.docId, parceiro: r.para.nome, cliente: r.cliente || '' } })); });
    passo2.then(function(){ fim('Marcado. ' + String(r.para.nome).split(' ')[0] + ' vai confirmar.'); }).catch(erro);
  }
});
(function(){
  var st = document.createElement('style');
  st.textContent = '#repBoxCaso,#repBoxAcordo,#repBoxAlvara{display:none!important}.rc-lin{display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border)}.rc-lin:first-child{border-top:0}.rc-nm{flex:1;min-width:0}.rc-pct{width:64px!important;height:34px!important;text-align:right;padding:0 8px!important}.rc-val{min-width:84px;text-align:right;font-size:var(--t2)}' +
    '.rc-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:12px 14px;margin:0 0 12px}.rc-it{padding:6px 0 6px 10px;margin:4px 0}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { rcSincronizar: rcSincronizar, rcLista: function(){ return rcS.lista; }, rcUnidades: function(id){ return listarUnidades().filter(function(u){ return u.docId === id; }).map(function(u){ return { chave: u.chave, pago: u.pago, fator: u.fator, repasse: u.repasse, parceiro: u.parceiro, outro: !!u.recebidoPorOutro, meu: meuValor(u, u.valor) }; }); } });
})();
