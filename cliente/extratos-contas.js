
/* ============================================================
   EXTRATOS: CONTAS COM LOGO E RECONHECIMENTO EM 3 NÍVEIS (prefixo exc) — Fase 3, etapa 3.9
   - Cadastro de contas: cada conta ganha logo (ou selo com a inicial), apelido, tipo (PJ, PF ou dinheiro da obra) e o último saldo lido.
     Logos em public/icones/bancos/ (Itaú, C6, Caixa, Sicoob); banco sem logo continua com o selo. A conta da obra segue comparando o saldo com a aba Construção.
   - Reconhecimento de cada linha do extrato em 3 níveis: Exata (nome e valor batem, ou regra que você ensinou), Parecida (sugestão para confirmar)
     e Sem correspondência (você decide). O app SÓ SUGERE: nunca muda o texto do extrato e nada é lançado sem o seu Confirmar.
   - Regras aprendidas: quando você corrige a despesa, a cobrança ou a categoria de uma linha e confirma, o app guarda "palavras do favorecido → destino"
     (config extratos.regras). Em Configurações > "Extratos: regras que você ensinou" dá para ver, editar e apagar.
   ============================================================ */
var EXC_BANCOS = [['itau', 'Itaú', /ITA[UÚ]|UNIBANCO/, 'itau.svg'], ['c6', 'C6 Bank', /\bC6\b/, 'c6.png'], ['caixa', 'Caixa', /\bCAIXA\b|\bCEF\b/, 'caixa.png'], ['sicoob', 'Sicoob', /SICOOB/, 'sicoob.png']];
function excBanco(txt){
  var t = EX.norm(String(txt || ''));
  for (var i = 0; i < EXC_BANCOS.length; i++) if (EXC_BANCOS[i][2].test(t)) return { id: EXC_BANCOS[i][0], nome: EXC_BANCOS[i][1], arq: EXC_BANCOS[i][3] };
  return null;
}
function excLogo(chave, tam){
  var c = extCfg().contas[chave] || {}, b = excBanco((c.banco || '') + ' ' + (c.rotulo || '') + ' ' + chave); tam = tam || 40;
  if (b) return '<span class="exc-logo" style="width:' + tam + 'px;height:' + tam + 'px"><img src="/icones/bancos/' + b.arq + '" alt="' + escapeHtml(b.nome) + '" loading="lazy"></span>';
  var nome = String(c.rotulo || c.banco || chave), ini = EX.norm(nome).replace(/[^A-Z0-9]/g, '').slice(0, 1) || '?';
  return '<span class="exc-logo exc-selo" style="width:' + tam + 'px;height:' + tam + 'px;background:' + CT_PALETA[ctHash(EX.norm(nome)) % CT_PALETA.length] + '" aria-hidden="true">' + escapeHtml(ini) + '</span>';
}
function excTipoChip(c){ return c.obra ? '<span class="exc-chip obra">dinheiro da obra</span>' : '<span class="exc-chip">' + (c.coluna === 'pj' ? 'PJ' : 'PF') + '</span>'; }
function excAbrirContas(){
  var cfg = extCfg(), chaves = Object.keys(cfg.contas), cmp = null;
  try{ cmp = extObraComparacao(extPendentes()); }catch(e){}
  var cards = chaves.map(function(k){
    var c = cfg.contas[k], g = c.ultimoSaldo, sub;
    if (c.obra && cmp && cmp.app !== null){ var bate = Math.abs(cmp.dif) <= 0.10; sub = 'extrato ' + extMoeda(cmp.extrato) + ' · app ' + fmtMoeda(cmp.app) + ' · ' + (bate ? '<b class="exc-ok">bate</b>' : '<b class="exc-dif">difere ' + fmtMoeda(Math.abs(cmp.dif)) + '</b>'); }
    else sub = g ? 'saldo ' + extMoeda(g.valor) + ' · lido em ' + escapeHtml(extFmtQuando(g.emitido)) : 'ainda sem extrato';
    return '<div class="exc-conta">' + excLogo(k, 44) + '<div class="exc-tx"><input type="text" class="exc-apelido" data-ctaapelido="' + escapeHtml(k) + '" value="' + escapeHtml(c.rotulo || k) + '" maxlength="60" aria-label="Apelido da conta"><span class="saldo-data">' + sub + '</span></div>' + excTipoChip(c) +
      '<div class="exc-ctl">' + extSelectHtml('data-ctaconf="' + escapeHtml(k) + '"', [['pj', 'PJ (empresa)'], ['pf', 'PF (pessoa física)']], c.coluna) +
      '<label class="ext-saldo-lab"><input type="checkbox" data-ctaobra="' + escapeHtml(k) + '"' + (c.obra ? ' checked' : '') + '><span>É dinheiro da obra <small>(o saldo é comparado com a aba Construção)</small></span></label></div></div>';
  }).join('');
  extAbrirGen('Contas dos extratos',
    '<div class="exc-aviso"><b>Cadastro de contas.</b> Cada conta ganha logo (ou selo), apelido, tipo (PJ, PF ou dinheiro da obra) e o último saldo lido. A conta da obra continua comparando o saldo com a aba Construção.</div>' +
    (chaves.length ? '<div class="exc-lista">' + cards + '</div><div class="parcela-sum">Mudar aqui vale para as próximas leituras. Logos oficiais para Itaú, C6, Caixa e Sicoob; banco sem logo fica com o selo da inicial.</div>' : '<div class="parcela-sum">Nenhuma conta identificada ainda. Elas aparecem quando o primeiro extrato for lido.</div>'),
    '<button type="button" class="btn btn-primary" id="extGenCancelar">Fechar</button>', true);
  qs('extGenCancelar').addEventListener('click', extFecharGen);
  var corpo = qs('extCorpo');
  Array.prototype.forEach.call(corpo.querySelectorAll('[data-ctaobra]'), function(s){
    s.addEventListener('change', function(){
      var contas = Object.assign({}, extCfg().contas), k = s.getAttribute('data-ctaobra');
      contas[k] = Object.assign({}, contas[k], { obra: s.checked });
      persistExtCfg({ contas: contas }).then(function(){ renderExtratos(); try{ renderObra(); }catch(e){} excAbrirContas(); });
    });
  });
  Array.prototype.forEach.call(corpo.querySelectorAll('[data-ctaconf]'), function(s){
    s.addEventListener('change', function(){
      var contas = Object.assign({}, extCfg().contas), k = s.getAttribute('data-ctaconf');
      contas[k] = Object.assign({}, contas[k], { coluna: s.value, confirmada: true });
      persistExtCfg({ contas: contas }).then(function(){ excAbrirContas(); });
    });
  });
  Array.prototype.forEach.call(corpo.querySelectorAll('[data-ctaapelido]'), function(s){
    s.addEventListener('change', function(){
      var contas = Object.assign({}, extCfg().contas), k = s.getAttribute('data-ctaapelido'), v = s.value.trim();
      if (!v) { s.value = contas[k].rotulo || k; return; }
      contas[k] = Object.assign({}, contas[k], { rotulo: v });
      persistExtCfg({ contas: contas }).then(function(){ excAbrirContas(); renderExtratos(); });
    });
  });
}
/* ---- níveis de reconhecimento de uma linha ---- */
function excNivel(v){
  var m = v.motivo || '', a = v.act;
  if (v.regra) return { n: 'exata', txt: /^regra/.test(m) ? m : 'regra que você ensinou' + (a === 'dia' && v.sel && v.sel.cat ? ': ' + v.sel.cat : '') + (m ? ' · ' + m : '') };
  if (a === 'pend' || a === 'recNova' || a === 'despNova') return { n: 'sem', txt: m || (v.v > 0 ? 'decidir: escolha a cobrança ou lance como receita' : 'decidir: escolha a despesa, a categoria ou lance como despesa nova') };
  if (a === 'dia'){
    if (v.catAlterada || /tarifas|em lote/.test(m)) return { n: 'exata', txt: m || 'categoria escolhida por você' };
    var dc = v.cand && v.cand.despesas && v.cand.despesas[0];
    if (dc) return { n: 'parecida', txt: 'parece a despesa "' + dc.d.nome + '" (confirme: troque a ação da linha para a despesa)' };
    if (!v.sel || !v.sel.cat || v.sel.cat === 'Outros') return { n: 'sem', txt: 'decidir: escolha a categoria' };
    return { n: 'parecida', txt: 'categoria sugerida pelo texto do extrato: ' + v.sel.cat + ' (confirme)' };
  }
  if (/\(confirme\)|sugest/i.test(m) || a === 'pfpj') return { n: 'parecida', txt: m };
  return { n: 'exata', txt: m };
}
var EXC_NV_ROT = { exata: 'Exata', parecida: 'Parecida', sem: 'Sem correspondência' };
function excMotivoHtml(v){
  var n = excNivel(v);
  return '<div class="ext-motivo"><span class="exc-nv exc-nv-' + n.n + '">' + EXC_NV_ROT[n.n] + '</span>' + (n.txt ? ' ' + escapeHtml(n.txt) : '') + '</div>';
}
function excResumoNiveis(views){
  var c = { exata: 0, parecida: 0, sem: 0 };
  views.forEach(function(v){ c[excNivel(v).n]++; });
  return '<div class="exc-resumo"><span class="exc-nv exc-nv-exata">Exata ' + c.exata + '</span><span class="exc-nv exc-nv-parecida">Parecida ' + c.parecida + '</span><span class="exc-nv exc-nv-sem">Sem correspondência ' + c.sem + '</span>' +
    '<small>no momento da leitura · <b>3 níveis</b>: exata (nome e valor, ou regra que você ensinou), parecida (sugestão para confirmar) e sem correspondência. O app só sugere: nunca muda o texto do extrato e nada é lançado sem o seu Confirmar. Quando você corrige, ele guarda a regra (Configurações > Extratos: regras que você ensinou).</small></div>';
}
/* ---- regras que o app aprendeu ---- */
/* chave das regras de despesa e de cobrança: as primeiras palavras do NOME do favorecido (quando há); sem nome, as primeiras palavras do texto */
function excChave(l){
  var n = EX.norm(l.n || '').replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(Boolean).slice(0, 3).join(' ');
  return n ? 'F:' + n : extChaveRegra(l);
}
function excAcharDespesa(v, nome){
  var mes = v.d.slice(0, 7), achou = null, alvo = EX.norm(nome);
  comMes(mes, function(){ getDespesasParaMes(v.coluna).forEach(function(it){ if (!achou && !it.pago && !it.despesa.transferenciaId && EX.norm(it.despesa.nome) === alvo) achou = { d: it.despesa, mes: mes }; }); });
  return achou;
}
/* cobranças: uma regra "palavras → cliente" escolhe a cobrança desse cliente (a que tem o mesmo valor, se houver, ou a mais antiga) */
function excRegrasCobranca(fila, unidades, regras, decidir){
  var usadas = {};
  fila.forEach(function(f){
    var v = f.v; if (v.act !== 'pend') return;
    var rg = regras[excChave(v.l)]; if (!rg || typeof rg !== 'object' || rg.t !== 'cli') return;
    var abs = Math.abs(v.v) / 100, us = unidades.filter(function(u){ return !usadas[u.chave] && EX.norm(u.cliente) === EX.norm(rg.cliente); });
    if (!us.length) return;
    var u = us.filter(function(x){ return Math.abs(restanteUn(x) - abs) < 0.005 || Math.abs(x.valor - abs) < 0.005; })[0] || us.sort(function(a, b){ return String(a.data || '9999').localeCompare(String(b.data || '9999')); })[0];
    usadas[u.chave] = true; v.sel.unit = u.chave; v.regra = rg;
    decidir(v, 'rec', 'regra que você ensinou: ' + u.cliente + ' · ' + u.label);
  });
  return usadas;
}
function excAprender(feitos, regras){
  var mudou = false;
  feitos.forEach(function(v){
    var k = excChave(v.l); if (!k || !v.destAlterado) return;
    if (v.act === 'desp' && v.sel.desp){
      var id = String(v.sel.desp).split('|')[0], d = despesas.filter(function(x){ return x.id === id; })[0];
      if (d){ regras[k] = { t: 'desp', nome: d.nome }; mudou = true; }
    } else if (v.act === 'rec' && v.sel.unit){
      var u = listarUnidades().filter(function(x){ return x.chave === v.sel.unit; })[0];
      if (u){ regras[k] = { t: 'cli', cliente: u.cliente }; mudou = true; }
    }
  });
  return mudou;
}
function excDestinoRegra(r){
  if (typeof r === 'string') return { tipo: 'Categoria', txt: r, edita: 'cat' };
  if (r && r.t === 'cat') return { tipo: 'Categoria', txt: r.cat, edita: 'cat' };
  if (r && r.t === 'desp') return { tipo: 'Despesa', txt: r.nome, edita: 'texto' };
  if (r && r.t === 'cli') return { tipo: 'Cobrança de', txt: r.cliente, edita: 'texto' };
  return { tipo: 'Regra', txt: '', edita: '' };
}
function excAbrirRegras(){
  var cfg = extCfg(), ks = Object.keys(cfg.regras).sort(), oc = (typeof obraCfg === 'function') ? obraCfg() : null, ro = oc && oc.extrato ? oc.extrato.regras : {}, kso = Object.keys(ro || {}).sort();
  var linhas = ks.map(function(k){
    var d = excDestinoRegra(cfg.regras[k]), campo = d.edita === 'cat' ? extSelectHtml('data-exr-cat="' + escapeHtml(k) + '"', EXT_CATS.map(function(c){ return [c, c]; }), d.txt) : '<input type="text" class="ext-sel" data-exr-txt="' + escapeHtml(k) + '" value="' + escapeHtml(d.txt) + '" maxlength="80" aria-label="Destino da regra">';
    return '<div class="exc-regra"><span class="exc-palavras">' + escapeHtml(k.toLowerCase()) + '</span><span class="exc-seta">→</span><span class="exc-dest"><small>' + d.tipo + '</small>' + campo + '</span><button type="button" class="btn btn-ghost" data-exr-del="' + escapeHtml(k) + '">Apagar</button></div>';
  }).join('');
  var linhasObra = kso.map(function(k){
    var r = ro[k] || {}, rot = r.act === 'obraGasto' ? 'Gasto da obra' : (r.act === 'obraAporte' ? 'Aporte para a obra' : 'Devolução da obra');
    return '<div class="exc-regra"><span class="exc-palavras">' + escapeHtml(String(k).toLowerCase()) + '</span><span class="exc-seta">→</span><span class="exc-dest"><small>Construção</small>' + escapeHtml(rot) + (r.etapa ? ' · etapa' : '') + '</span><button type="button" class="btn btn-ghost" data-exr-delobra="' + escapeHtml(k) + '">Apagar</button></div>';
  }).join('');
  extAbrirGen('Extratos: regras que você ensinou',
    '<div class="exc-aviso">O app <b>só sugere</b>. Quando você corrige a despesa, a cobrança ou a categoria de uma linha e confirma, ele guarda a regra (palavras do favorecido → destino) e passa a reconhecer essa linha como <b>Exata</b> nas próximas leituras. Aqui você vê, edita e apaga as regras. Apagar uma regra não mexe em nenhum lançamento.</div>' +
    ((ks.length || kso.length) ? (linhas ? '<div class="exc-regras">' + linhas + '</div>' : '') + (linhasObra ? '<div class="plano-tit" style="margin-top:14px">Da obra</div><div class="exc-regras">' + linhasObra + '</div>' : '') : '<div class="financeiro-vazio">Nenhuma regra ainda. Quando você corrigir uma sugestão e confirmar a conferência, ela aparece aqui.</div>'),
    '<button type="button" class="btn btn-primary" id="extGenCancelar">Fechar</button>', true);
  qs('extGenCancelar').addEventListener('click', extFecharGen);
  var corpo = qs('extCorpo'), grava = function(r){ return persistExtCfg({ regras: r }).then(function(){ excAbrirRegras(); }); };
  Array.prototype.forEach.call(corpo.querySelectorAll('[data-exr-cat]'), function(s){ s.addEventListener('change', function(){ var r = Object.assign({}, extCfg().regras); r[s.getAttribute('data-exr-cat')] = s.value; grava(r); }); });
  Array.prototype.forEach.call(corpo.querySelectorAll('[data-exr-txt]'), function(s){
    s.addEventListener('change', function(){
      var k = s.getAttribute('data-exr-txt'), r = Object.assign({}, extCfg().regras), v = s.value.trim(); if (!v || !r[k]) return;
      r[k] = r[k].t === 'cli' ? { t: 'cli', cliente: v } : { t: 'desp', nome: v }; grava(r);
    });
  });
  Array.prototype.forEach.call(corpo.querySelectorAll('[data-exr-del]'), function(b){ b.addEventListener('click', function(){ var r = Object.assign({}, extCfg().regras); delete r[b.getAttribute('data-exr-del')]; grava(r); toast('Regra apagada.'); }); });
  Array.prototype.forEach.call(corpo.querySelectorAll('[data-exr-delobra]'), function(b){
    b.addEventListener('click', function(){
      var k = b.getAttribute('data-exr-delobra'), o = obraCfg(), r = Object.assign({}, o.extrato.regras); delete r[k];
      Promise.resolve(persistObraCfg({ extrato: Object.assign({}, o.extrato, { regras: r }) })).then(function(){ excAbrirRegras(); toast('Regra apagada.'); });
    });
  });
}
(function(){
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { excNivel: excNivel, excBanco: excBanco, excAbrirRegras: excAbrirRegras, excAprender: excAprender, excChave: excChave });
  var st = document.createElement('style'); st.id = 'excCss';
  st.textContent = '.exc-logo{display:inline-flex;align-items:center;justify-content:center;flex:none;border-radius:12px;background:#fff;border:1px solid var(--border);overflow:hidden;padding:4px;box-sizing:border-box}.exc-logo img{width:100%;height:100%;object-fit:contain;display:block}.exc-selo{color:#fff;font-weight:800;font-size:1.1rem;border:0}' +
    '.exc-aviso{background:rgba(23,137,90,.1);border-radius:14px;padding:12px 14px;margin-bottom:12px;font-size:var(--t3);line-height:1.45}' +
    '.exc-lista{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}.exc-conta{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 12px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:12px}.exc-tx{display:flex;flex-direction:column;gap:2px;min-width:0}' +
    '.exc-apelido{border:0;background:transparent;font:inherit;font-weight:700;font-size:var(--t4);color:var(--ink);padding:2px 0;min-width:0;width:100%;border-bottom:1px dashed transparent}.exc-apelido:focus{outline:0;border-bottom-color:var(--accent)}.exc-ctl{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;border-top:1px solid var(--border);padding-top:8px}' +
    '.exc-chip{font-size:var(--t1);font-weight:700;border-radius:99px;padding:3px 10px;background:var(--surface-2);color:var(--ink-soft)}.exc-chip.obra{background:rgba(201,133,0,.16);color:#9A6700}.exc-ok{color:#17895A}.exc-dif{color:var(--urgente)}' +
    '.exc-nv{display:inline-block;font-size:var(--t1);font-weight:800;border-radius:99px;padding:2px 9px;margin-right:4px}.exc-nv-exata{background:rgba(23,137,90,.14);color:#17895A}.exc-nv-parecida{background:rgba(201,133,0,.16);color:#9A6700}.exc-nv-sem{background:var(--surface-2);color:var(--ink-soft)}' +
    '.exc-resumo{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 10px}.exc-resumo small{flex:1 1 100%;color:var(--ink-soft);line-height:1.4;font-size:var(--t2)}' +
    '.exc-regras{display:flex;flex-direction:column;gap:8px}.exc-regra{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1.2fr) auto;gap:8px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:10px 12px}.exc-palavras{font-weight:700;overflow:hidden;text-overflow:ellipsis}.exc-seta{color:var(--ink-soft)}.exc-dest{display:flex;flex-direction:column;gap:2px;min-width:0}.exc-dest small{color:var(--ink-soft)}.exc-dest .ext-sel{width:100%}' +
    '@media(max-width:640px){.exc-regra{grid-template-columns:minmax(0,1fr) auto}.exc-seta{display:none}.exc-dest{grid-column:1/-1}}';
  document.head.appendChild(st);
})();
