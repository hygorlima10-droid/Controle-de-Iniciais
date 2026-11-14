/* ============================================================
   PUBLICAÇÕES DO DIÁRIO OFICIAL (DJEN) + PRAZOS PROCESSUAIS
   - o servidor lê, todo dia às 10h, as OABs cadastradas e guarda o trecho de cada publicação
   - aqui você vê, abre o texto completo, liga ao processo cadastrado e confirma o prazo
   - o prazo é sempre SUGERIDO (texto da publicação) e CONFIRMADO por você; a data usa o calendário do TJGO
   ============================================================ */
var pbS = { carregado: false, carregando: false, buscando: false, pubs: [], oabs: [], ultima: null, filtro: 'naolidas', f: { q: '', de: '', ate: '', oab: 'todas', adv: '', trib: '' }, fAberto: false, mAberto: false, mais: 1 };
var pbEdOabs = [], pbDetId = null, pbTextos = {};
function pbApi(url, metodo, corpo){
  return fetch(url, { method: metodo || 'GET', credentials: 'same-origin', cache: 'no-store', headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined, body: corpo !== undefined ? JSON.stringify(corpo) : undefined })
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) throw new Error((j.error && j.error.message) || ('Erro ' + r.status)); return j; }); });
}
function pbPad(n){ return (n < 10 ? '0' : '') + n; }
function pbSoma(iso, n){ return new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
function pbDow(iso){ return new Date(iso + 'T12:00:00Z').getUTCDay(); }
var PB_DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
function pbDiaSem(iso){ return PB_DIAS[pbDow(iso)]; }

/* ---------- calendário do TJGO: feriados no Tribunal (lista oficial 2026) e regra geral para outros anos ---------- */
var PB_FERIADOS_2026 = ['2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-07-26', '2026-09-07', '2026-10-12', '2026-10-24', '2026-10-28', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-08', '2026-12-25'];
var PB_FACULTATIVOS = { '2026-03-20': 'ponto facultativo (MotoGP)', '2026-04-20': 'ponto facultativo', '2026-06-05': 'ponto facultativo' };
var PB_FER_NOMES = { '01-01': 'Ano Novo', '02-16': 'Carnaval', '02-17': 'Carnaval', '02-18': 'Carnaval', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho', '07-26': 'Fundação de Goiás', '09-07': 'Independência', '10-12': 'N. Sra. Aparecida', '10-24': 'Aniversário de Goiânia', '10-28': 'Dia do Servidor Público', '11-02': 'Finados', '11-15': 'Proclamação da República', '11-20': 'Consciência Negra', '12-08': 'Dia da Justiça', '12-25': 'Natal' };
function pbPascoa(ano){
  var a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return ano + '-' + pbPad(mes) + '-' + pbPad(dia);
}
function pbFeriadosGeral(ano){
  var s = {}, p = pbPascoa(ano);
  ['01-01', '04-21', '05-01', '07-26', '09-07', '10-12', '10-24', '10-28', '11-02', '11-15', '11-20', '12-08', '12-25'].forEach(function(md){ s[ano + '-' + md] = 1; });
  [-48, -47, -46, -4, -3, -2, 60].forEach(function(n){ s[pbSoma(p, n)] = 1; });   /* Carnaval (seg a qua), Semana Santa (qua a sex) e Corpus Christi */
  return s;
}
var pbFerCache = {};
function pbFeriados(ano){
  if (!pbFerCache[ano]){ var s = {}; if (ano === 2026) PB_FERIADOS_2026.forEach(function(d){ s[d] = 1; }); else s = pbFeriadosGeral(ano); pbFerCache[ano] = s; }
  return pbFerCache[ano];
}
function pbRecesso(iso){ var md = iso.slice(5); return md >= '12-20' || md <= '01-20'; }   /* CPC art. 220: prazos suspensos de 20/12 a 20/01 */
function pbFeriado(iso){ return !!pbFeriados(Number(iso.slice(0, 4)))[iso] || (typeof dxTem === 'function' && dxTem(iso)); }   /* + dias sem expediente cadastrados em Configurações */
function pbNaoUtil(iso){ var w = pbDow(iso); return w === 0 || w === 6 || pbFeriado(iso) || pbRecesso(iso); }
function pbMotivoNaoUtil(iso){
  if (pbDow(iso) === 0 || pbDow(iso) === 6) return pbDiaSem(iso);
  if (pbRecesso(iso)) return 'recesso (prazos suspensos de 20/12 a 20/01)';
  if (typeof dxTem === 'function' && dxTem(iso)) return 'sem expediente (' + dxNome(iso) + ')';
  if (pbFeriado(iso)) return 'feriado' + (PB_FER_NOMES[iso.slice(5)] ? ' (' + PB_FER_NOMES[iso.slice(5)] + ')' : '');
  return '';
}
function pbProxUtil(iso){ var d = iso; do { d = pbSoma(d, 1); } while (pbNaoUtil(d)); return d; }
/* disponibilização → publicação (1º dia útil seguinte) → começa a contar no 1º dia útil seguinte à publicação */
function pbCalcular(disp, dias, tipo){
  dias = Math.max(1, parseInt(dias, 10) || 1);
  var corr = tipo === 'corridos', op = { modo: 'dje', data: disp, dias: dias, regime: corr ? 'custom' : 'cpc', unidade: corr ? 'corridos' : 'uteis', recesso: true, prorroga: true, excluiInicio: true, inicioUtil: true, sobre: 1, dobro: false, extras: [] };
  var r = pzCalcular(op), obs = [];   /* a contagem é do motor de cliente/prazos.js (a mesma da Calculadora de prazos) */
  for (var x = r.inicio; x <= r.vencimento; x = pbSoma(x, 1)) if (PB_FACULTATIVOS[x]) obs.push(fmtData(x) + ' foi ' + PB_FACULTATIVOS[x]);
  return { pub: r.publicacao, ini: r.inicio, venc: r.vencimento, obs: obs, op: op };
}

/* ---------- vínculo com os processos cadastrados ---------- */
function pbVinculo(proc){ return prVinculo(proc); }
function pbOabDe(id){ for (var i = 0; i < pbS.oabs.length; i++) if (pbS.oabs[i].id === id) return pbS.oabs[i]; return null; }
function pbPrimeiroNome(o){ return o ? String(o.nome || '').split(' ')[0] : ''; }
/* o que aparece: de OABs ativas; as de "só processos em conjunto" só mostram processo cadastrado ou que também vem pela sua OAB */
function pbVisiveis(){
  var meus = {};
  pbS.pubs.forEach(function(p){ if (p.processo && p.oabs.some(function(id){ var o = pbOabDe(id); return o && o.ativo && o.escopo === 'tudo'; })) meus[p.processo] = 1; });
  return pbS.pubs.filter(function(p){
    return p.oabs.some(function(id){
      var o = pbOabDe(id); if (!o || !o.ativo) return false;
      return o.escopo === 'tudo' || !!meus[p.processo] || !!pbVinculo(p.processo);
    });
  });
}
function pbNomeParte(p, v){
  if (v) return v.cliente;
  if (pbMembros(p).length > 1){ var ns = pbDestinatarios(p); return ns.slice(0, 2).join(', ') + (ns.length > 2 ? ' e mais ' + (ns.length - 2) : ''); }
  var a = (p.dest || []).filter(function(d){ return d.p === 'A'; })[0], r = (p.dest || []).filter(function(d){ return d.p === 'P'; })[0];
  if (a && r) return a.n + ' × ' + r.n;
  return (p.dest && p.dest[0] && p.dest[0].n) || p.classe || 'Publicação';
}
function pbClasse(c){ c = String(c || '').toLowerCase(); return c.charAt(0).toUpperCase() + c.slice(1); }
function pbClasseTipo(t){ t = String(t || ''); return /senten|decis|despacho|ac[oó]rd/i.test(t) ? 'dec' : (/intima|ordinat|certid|edital|cita/i.test(t) ? 'ato' : 'out'); }
function pbQuando(iso){
  var h = todayISO();
  if (iso === h) return 'Hoje · ' + fmtData(iso).slice(0, 5);
  if (iso === pbSoma(h, -1)) return 'Ontem · ' + fmtData(iso).slice(0, 5);
  return pbDiaSem(iso).split('-')[0].replace(/^./, function(c){ return c.toUpperCase(); }) + ' · ' + fmtData(iso).slice(0, 5);
}
function pbQuandoAtualizou(){
  if (!pbS.ultima) return 'ainda não leu';
  var d = new Date(pbS.ultima), hoje = new Date(), mesmoDia = d.toDateString() === hoje.toDateString();
  return (mesmoDia ? 'hoje' : fmtData(d.getFullYear() + '-' + pbPad(d.getMonth() + 1) + '-' + pbPad(d.getDate()))) + ' às ' + pbPad(d.getHours()) + ':' + pbPad(d.getMinutes());
}

/* ---------- carregar ---------- */
function pbCarregar(silencioso){
  if (!window.__SERVIDOR) return Promise.resolve();
  pbS.carregando = true;
  return Promise.all([pbApi('/api/djen/estado'), pbApi('/api/djen/lista?dias=90' + ((window.__horusEscopo && window.__horusEscopo.ativo && window.__horusEscopo.pub === 'minhas') ? '&escopo=meus' : ''))]).then(function(r){
    pbS.oabs = r[0].oabs || []; pbS.ultima = r[0].ultimaLeitura; pbS.pubs = r[1].pubs || []; pbAgrupaTodos(); pbS.carregado = true;
  }).catch(function(e){ pbS.erro = e.message; pbS.carregado = true; }).then(function(){
    pbS.carregando = false; pbAtualizarBadge(); if (!silencioso && activeTab === 'publicacoes') pbRender();
  });
}
/* Leitura ao abrir o app: a leitura automática do servidor às vezes é recusada pelo DJEN (o horário agendado roda num ponto qualquer do Cloudflare),
   mas a leitura disparada daqui, perto de você, funciona. Se há erro ou ainda não leu hoje, o app lê sozinho ao abrir (no máximo a cada 30 min).
   Para desligar: localStorage horus.leituraAuto = 0. */
function pbLeituraAutomatica(){
  try{ if (localStorage.getItem('horus.leituraAuto') === '0') return; }catch(e){}
  if (!window.__SERVIDOR || document.hidden || pbS.buscando || !pbS.carregado) return;
  var ativas = pbS.oabs.filter(function(o){ return o.ativo; }); if (!ativas.length) return;
  var hoje = todayISO(); if (!ativas.some(function(o){ return o.erro || o.ultima !== hoje; })) return;
  var ult = 0; try{ ult = Number(localStorage.getItem('horus.leituraAutoEm') || 0); }catch(e){}
  if (Date.now() - ult < 30 * 60 * 1000) return;
  try{ localStorage.setItem('horus.leituraAutoEm', String(Date.now())); }catch(e){}
  pbS.buscando = true;
  return pbApi('/api/djen/buscar', 'POST', {}).then(function(r){ if (r && r.novas) toast(r.novas + (r.novas === 1 ? ' publicação nova no Diário Oficial.' : ' publicações novas no Diário Oficial.')); }).catch(function(){}).then(function(){ pbS.buscando = false; return pbCarregar(); });
}
function pbAtualizarBadge(){
  var n = pbContaNaoLidas(), e = qs('menuNPub'); if (e) e.textContent = n > 0 ? String(n) : '';
}
function pbBuscarAgora(dias){
  if (pbS.buscando) return; pbS.buscando = true; pbRender();
  return pbApi('/api/djen/buscar', 'POST', dias ? { dias: dias } : {}).then(function(r){
    var erros = (r.porOab || []).filter(function(o){ return o.erro; });
    toast(erros.length ? ('Não consegui ler ' + erros.map(function(o){ return o.nome; }).join(', ') + ': ' + erros[0].erro) : (r.novas ? r.novas + (r.novas === 1 ? ' publicação nova.' : ' publicações novas.') : 'Nada novo no Diário Oficial.'));
  }).catch(function(e){ toast('Não consegui buscar: ' + e.message); }).then(function(){ pbS.buscando = false; return pbCarregar(); });
}

/* ---------- tela ---------- */
function pbMontarTela(){
  if (!qs('bodyPublicacoes') || qs('pbWrap').getAttribute('data-ok')) return;
  qs('pbWrap').setAttribute('data-ok', '1');
  qs('pbWrap').addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-pb]') : null; if (!b) return;
    var a = b.getAttribute('data-pb'), id = b.getAttribute('data-id');
    if (a === 'filtro'){ var fv = b.getAttribute('data-v'); mdLembrar('publicacoes', fv); if (fv === 'resumo') pbS.sub = 'resumo'; else { pbS.sub = 'lista'; pbS.filtro = fv; } pbS.mais = 1; pbRender(); }
    else if (a === 'buscar') pbBuscarAgora();
    else if (a === 'oabs') pbAbrirOabs();
    else if (a === 'mais'){ pbS.mais++; pbRenderLista(); }
    else if (a === 'painel'){ pbS.fAberto = !pbS.fAberto; pbRender(); }
    else if (a === 'menu'){ pbS.mAberto = !pbS.mAberto; pbRender(); }
    else if (a === 'limpar'){ pbS.f = { q: '', de: '', ate: '', oab: 'todas', adv: '', trib: '' }; pbS.mais = 1; pbRender(); }
    else if (a === 'abrir') pbAbrirDetalhe(id);
    else if (a === 'lida'){ var pl = pbPub(id); if (pl) pbMarcar(pbMembros(pl).map(function(x){ return x.id; }), { lida: !pbLidaG(pl) }); }
    else if (a === 'todas-lidas'){ pbS.mAberto = false; var ids = []; pbListaFiltrada().filter(function(p){ return !pbLidaG(p); }).forEach(function(p){ pbMembros(p).forEach(function(x){ ids.push(x.id); }); }); if (ids.length) pbMarcar(ids, { lida: true }); }
    else if (a === 'cadastrar') pbCadastrar(id);
    else if (a === 'reabrir-proc'){ var pp = pbPub(id), vv = pp && pbVinculo(pp.processo); if (vv) prReabrir(vv.id).then(function(){ pbRender(); }); }
    else if (a === 'ir') pbIrVinculo(id);
    else if (a === 'prazo') pbAbrirPrazoPub(id);
    else if (a === 'aud') pbCriarAudiencia(id);
    else if (a === 'aud-livre') pbCriarAudiencia(id, true);
    else if (a === 'tarefa') pbCriarTarefa(id);
    else if (a === 'rel'){ pbS.mAberto = false; pbRender(); rptPublicacoes(); }
    else if (a === 'pecas'){ pbS.mAberto = false; pbRender(); pbAbrirPecas(); }
  });
  var depois = null;
  function aplicar(e){
    var k = e.target && e.target.getAttribute ? e.target.getAttribute('data-pbf') : null; if (!k) return;
    pbS.f[k] = e.target.value; pbS.mais = 1; clearTimeout(depois);
    depois = setTimeout(function(){ pbRenderLista(); }, e.type === 'input' ? 250 : 0);
  }
  qs('pbWrap').addEventListener('input', aplicar); qs('pbWrap').addEventListener('change', aplicar);
}
/* Publicações idênticas (mesmo processo, data e texto) que só mudam o destinatário (vários autores que você representa) viram um cartão só */
function pbAgrupaTodos(){
  var m = {};
  pbS.pubs.forEach(function(p){ p._g = null; p._rep = null; });
  pbS.pubs.forEach(function(p){
    if (!p.processo){ p._g = [p]; p._rep = p; return; }
    var k = [p.processo, p.data, p.th || ((p.tipo || '') + '|' + (p.orgao || ''))].join('|');   /* mesmo processo, dia e texto = uma publicação (mesmo com tipos ou ids diferentes) */
    (m[k] = m[k] || []).push(p);
  });
  Object.keys(m).forEach(function(k){ var g = m[k]; g.forEach(function(x){ x._rep = g[0]; }); g[0]._g = g; });
}
function pbMembros(p){ var r = (p && p._rep) || p; return (r && r._g) || [p]; }
function pbLidaG(p){ return pbMembros(p).every(function(x){ return x.lida; }); }
function pbPrazoGrupo(p){ var m = pbMembros(p); for (var i = 0; i < m.length; i++){ var z = pbPrazoDaPub(m[i].id); if (z) return z; } return null; }
function pbSemPrazoG(p){ return pbMembros(p).every(function(x){ return x.semPrazo; }); }
function pbGrupos(l){ var vistos = {}, out = []; l.forEach(function(p){ var r = p._rep || p; if (!vistos[r.id]){ vistos[r.id] = 1; out.push(r); } }); return out; }
function pbContaNaoLidas(){ return pbGrupos(pbVisiveis()).filter(function(p){ return !pbLidaG(p); }).length; }
function pbDestinatarios(p){
  var nomes = [], vistos = {};
  pbMembros(p).forEach(function(x){ (x.dest || []).forEach(function(d){ var k = (d.n || '').toUpperCase(); if (k && !vistos[k]){ vistos[k] = 1; nomes.push(d.n); } }); });
  return nomes;
}
/* ---------- peça sugerida (src/pecas.js) ---------- */
var pbPeca = {};   /* por publicação: { i: índice escolhido, polo: lado informado, pc: sugestão refeita com o lado informado, dobro } */
var PB_INST = { primeiro: '1º grau', juizado: 'Juizado Especial', tribunal: 'Tribunal' };
function pbPecasBase(p){
  var st = pbPeca[p.id], t = pbTextos[p.id];
  if (st && st.pc) return st.pc;
  if (t && t.ok && t.pc) return t.pc;
  if (p.pc) return p.pc;
  try{ return sugerirPecas({ tipo: p.tipo, comunic: p.comunic, classe: p.classe, orgao: p.orgao, tribunal: p.tribunal, texto: p.trecho, dest: p.dest, diasTexto: p.sug }); }catch(e){ return null; }
}
function pbPecasDe(p){ var b = pbPecasBase(p); return b ? pbAplicaAprend(b) : b; }

/* ---------- aprendizado (Fase 2): o app guarda o seu jeito de escolher a peça e passa a sugerir o que você mais usa ---------- */
var pbAprend = [], PB_MIN_USOS = 2, PB_MAX_TROCAS = 3, PB_SIM = 0.6;
function pbCarregarAprend(){
  if (!window.__SERVIDOR) return Promise.resolve();
  return pbApi('/api/db/pecasAprendidas').then(function(r){ pbAprend = (r.docs || []).map(function(d){ var x = d.data || {}; x.id = d.id; return x; }); }).catch(function(){}).then(function(){ try{ if (activeTab === 'publicacoes') pbRender(); }catch(e){} });
}
function pbRegraOver(rid){ for (var i = 0; i < pbAprend.length; i++) if (pbAprend[i].tipo === 'regra' && pbAprend[i].rid === rid) return pbAprend[i]; return null; }
function pbAplicaAprend(pc){
  if (!pc || !pbAprend.length) return pc;
  var out = JSON.parse(JSON.stringify(pc)), cand = [];
  out.itens = out.itens.filter(function(it){ var o = pbRegraOver(it.rid); if (o && o.desativada) return false; if (o && o.dias && it.dias && it.origemPrazo === 'lei'){ it.dias = o.dias; } return true; });
  pbAprend.forEach(function(e){ if (e.tipo === 'regra' || e.ativa === false || (e.usos || 0) < PB_MIN_USOS) return; var s = pcJaccard(pc.feats || [], e.feats || []); if (s >= PB_SIM) cand.push({ e: e, s: s }); });
  cand.sort(function(a, b){ return (b.e.usos * b.s) - (a.e.usos * a.s); });
  if (cand.length){
    var e = cand[0].e, dias = e.dias, origem = 'lei';
    if (e.dias && (e.kind || 'manif') === 'manif' && pc.diasTexto && pc.diasTexto !== e.dias){ dias = pc.diasTexto; origem = 'texto'; }
    out.itens = out.itens.filter(function(it){ return it.peca !== e.peca; });
    out.itens.forEach(function(it){ it.principal = false; });
    out.itens.unshift({ rid: 'aprendida', lid: e.id, peca: e.peca, dias: dias, contagem: e.contagem || 'uteis', base: e.base || 'aprendida com você', kind: e.kind || 'manif', nota: 'você usou ' + e.usos + (e.usos === 1 ? ' vez' : ' vezes'), origem: 'aprendida', usos: e.usos, origemPrazo: origem, principal: true });
  }
  return out;
}
function pbGravarAprend(e){
  var corpo = Object.assign({}, e); delete corpo.id;
  if (e.id) return pbApi('/api/db/pecasAprendidas/' + encodeURIComponent(e.id), 'PUT', corpo);
  return pbApi('/api/db/pecasAprendidas', 'POST', corpo).then(function(j){ e.id = j.id; pbAprend.push(e); });
}
/* chamado quando você confirma um prazo: reforça o que o app sugeriu e aprende o que você escolheu de diferente */
function pbRegistrarEscolha(p, pcMostrado, psel, desc, diasBase, contagem){
  return Promise.resolve(pbRegistrarEscolha0(p, pcMostrado, psel, desc, diasBase, contagem)).catch(function(){}).then(function(){ try{ if (activeTab === 'publicacoes') pbRender(); }catch(e){} });   /* os cartões passam a mostrar o que acabou de ser aprendido */
}
function pbRegistrarEscolha0(p, pcMostrado, psel, desc, diasBase, contagem){
  var feats = pcMostrado && pcMostrado.feats; if (!feats || !feats.length || !desc) return;
  var principal = null; pcMostrado.itens.forEach(function(it){ if (it.principal) principal = it; });
  var escolhida = psel && psel.peca === desc ? psel.peca : desc, kind = psel && psel.peca === desc ? (psel.kind || 'manif') : 'manif';
  var igual = principal && principal.peca === escolhida && (!principal.dias || principal.dias === diasBase);
  var ps = [];
  if (principal && principal.origem === 'aprendida'){
    var le = pbAprend.filter(function(x){ return x.id === principal.lid; })[0];
    if (le){ if (igual){ le.usos = (le.usos || 0) + 1; le.trocas = 0; le.ultimaEm = todayISO(); } else { le.trocas = (le.trocas || 0) + 1; if (le.trocas >= PB_MAX_TROCAS) le.ativa = false; } ps.push(pbGravarAprend(le)); }
  }
  if (igual && principal && principal.origem !== 'aprendida') return Promise.all(ps);   /* aceitou a regra da lei: nada novo a aprender */
  if (igual) return Promise.all(ps);
  var cur = pbAprend.filter(function(x){ return x.tipo !== 'regra' && x.peca === escolhida && pcJaccard(feats, x.feats || []) >= 0.75; })[0];
  if (cur){
    var inter = feats.filter(function(f){ return (cur.feats || []).indexOf(f) >= 0; });
    cur.usos = (cur.usos || 0) + 1; cur.ultimaEm = todayISO(); cur.dias = diasBase || cur.dias; cur.contagem = contagem; cur.ativa = true; cur.trocas = 0; if (inter.length >= 4) cur.feats = inter;
    ps.push(pbGravarAprend(cur));
  } else {
    var nat = PC_NATUREZA[pcMostrado.natureza] || 'Ato', kws = feats.filter(function(f){ return /^[kv]:/.test(f); }).map(function(f){ return f.slice(2); }).slice(0, 3);
    ps.push(pbGravarAprend({ tipo: 'peca', ato: nat + (pcMostrado.polo ? ' (cliente ' + (pcMostrado.polo === 'A' ? 'autor' : 'réu') + ')' : '') + (kws.length ? ' · ' + kws.join(', ') : ''), feats: feats, peca: escolhida, dias: diasBase || null, contagem: contagem, base: psel && psel.peca === desc ? psel.base : '', kind: kind, usos: 1, trocas: 0, ativa: true, criadoEm: new Date().toISOString(), ultimaEm: todayISO() }));
  }
  return Promise.all(ps).catch(function(){});
}
/* ---------- tela "Peças e prazos" ---------- */
function pbMontarPecas(){
  if (qs('overlayPcs')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayPcs';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Peças e prazos</h2><button class="icon-btn" id="pcsX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="pcsCorpo"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#pcsX'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-pcs]') : null; if (!b) return;
    var a = b.getAttribute('data-pcs'), id = b.getAttribute('data-id'), ent = pbAprend.filter(function(x){ return x.id === id; })[0];
    if (a === 'toggle' && ent){ ent.ativa = ent.ativa === false; ent.trocas = 0; pbGravarAprend(ent).then(pbDesenharPecas); }
    else if (a === 'apagar' && ent){ if (b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Toque de novo para apagar'; return; } pbApi('/api/db/pecasAprendidas/' + encodeURIComponent(ent.id), 'DELETE').then(function(){ pbAprend = pbAprend.filter(function(x){ return x.id !== id; }); pbDesenharPecas(); pbRender(); }); }
    else if (a === 'regra'){ var rid = b.getAttribute('data-rid'), o = pbRegraOver(rid); if (o){ o.desativada = !o.desativada; pbGravarAprend(o).then(pbDesenharPecas); } else pbGravarAprend({ tipo: 'regra', rid: rid, desativada: true, criadoEm: new Date().toISOString() }).then(pbDesenharPecas); }
    else if (a === 'dias' && ent){ var v = parseInt((qs('pcs_dias_' + id) || {}).value, 10); if (v >= 1 && v <= 365){ ent.dias = v; pbGravarAprend(ent).then(function(){ toast('Prazo atualizado.'); pbDesenharPecas(); }); } }
    else if (a === 'zerar'){ if (b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Toque de novo para apagar tudo'; return; } var todos = pbAprend.filter(function(x){ return x.tipo !== 'regra'; }); Promise.all(todos.map(function(x){ return pbApi('/api/db/pecasAprendidas/' + encodeURIComponent(x.id), 'DELETE'); })).then(function(){ pbAprend = pbAprend.filter(function(x){ return x.tipo === 'regra'; }); pbDesenharPecas(); pbRender(); toast('O que o app aprendeu foi apagado.'); }); }
  });
}
function pbAbrirPecas(){ pbMontarPecas(); pbDesenharPecas(); qs('overlayPcs').classList.add('show'); }
function pbDesenharPecas(){
  var c = qs('pcsCorpo'); if (!c) return;
  var ap = pbAprend.filter(function(x){ return x.tipo !== 'regra'; }).sort(function(a, b){ return (b.usos || 0) - (a.usos || 0); });
  var h = '<div class="parcela-sum">O app já sugere a peça pelas regras do CPC. Aqui ele guarda o <b>seu</b> jeito: quando você escolhe a mesma peça duas vezes para o mesmo tipo de ato, passa a sugeri-la como “aprendida”. Se você trocar a sugestão ' + PB_MAX_TROCAS + ' vezes seguidas, ela é desativada.</div>';
  h += '<div class="pb-sec"><div class="pb-sec-t">Aprendido com você (' + ap.length + ')</div>' + (ap.length ? ap.map(function(e){
    var ativa = e.ativa !== false && (e.usos || 0) >= PB_MIN_USOS, est = e.ativa === false ? 'desativada' : ((e.usos || 0) >= PB_MIN_USOS ? 'ativa' : 'aprendendo (' + (e.usos || 0) + '/' + PB_MIN_USOS + ')');
    return '<div class="pb-oab"><div><b style="color:var(--ink)">' + escapeHtml(e.ato) + ' → ' + escapeHtml(e.peca) + '</b><br><span class="saldo-data">' + (e.dias ? e.dias + ' dias ' + (e.contagem === 'corridos' ? 'corridos' : 'úteis') + ' · ' : '') + 'usada ' + (e.usos || 0) + (e.usos === 1 ? ' vez' : ' vezes') + ' · ' + est + '</span></div>' +
      '<div class="pb-dois"><div class="field"><label class="field-label" for="pcs_dias_' + escapeHtml(e.id) + '">Prazo (dias)</label><input type="number" id="pcs_dias_' + escapeHtml(e.id) + '" min="1" max="365" value="' + (e.dias || '') + '"></div><div class="pb-acts" style="align-self:end;margin:0"><button type="button" class="btn btn-ghost pb-b" data-pcs="dias" data-id="' + escapeHtml(e.id) + '">Salvar prazo</button></div></div>' +
      '<div class="pb-acts" style="margin:0"><button type="button" class="btn btn-ghost pb-b" data-pcs="toggle" data-id="' + escapeHtml(e.id) + '">' + (e.ativa === false ? 'Ativar' : 'Desativar') + '</button><button type="button" class="btn-text pb-b" style="color:var(--urgente)" data-pcs="apagar" data-id="' + escapeHtml(e.id) + '">Apagar</button></div></div>';
  }).join('') + '<div class="pb-acts"><button type="button" class="btn-text pb-b" style="color:var(--urgente)" data-pcs="zerar">Desfazer tudo o que aprendeu</button></div>' : '<div class="saldo-data">Ainda nada. Confirme prazos escolhendo a peça e o app começa a aprender.</div>') + '</div>';
  var vistos = {}, regras = [];
  PC_REGRAS.forEach(function(r){ if (vistos[r.id]) return; vistos[r.id] = 1; regras.push(r); });
  h += '<div class="pb-sec"><div class="pb-sec-t">Regras do sistema (' + regras.length + ')</div><div class="saldo-data">Desative as que você não quer ver sugeridas.</div>' + regras.map(function(r){
    var o = pbRegraOver(r.id), it = r.itens[0];
    return '<div class="pb-lin"><span><b style="color:var(--ink)">' + escapeHtml(it.peca) + '</b><br><span class="saldo-data">' + escapeHtml((typeof it.dias === 'number' ? it.dias + ' dias · ' : (it.dias === 'texto' ? 'prazo do texto · ' : '')) + it.base) + ' · ' + escapeHtml(r.id) + '</span></span><button type="button" class="btn btn-ghost pb-b" data-pcs="regra" data-rid="' + escapeHtml(r.id) + '">' + (o && o.desativada ? 'Ativar' : 'Desativar') + '</button></div>';
  }).join('') + '</div>';
  c.innerHTML = h;
  try{ if (activeTab === 'publicacoes') pbRender(); }catch(e){}   /* os cartões atrás já refletem a mudança */
}

function pbPecaPrincipal(pc){ if (!pc) return null; for (var i = 0; i < pc.itens.length; i++) if (pc.itens[i].principal) return pc.itens[i]; return null; }
/* ---------- seletor ▾ do campo "Descrição": todas as peças cadastradas (Fase 3, etapa 3.1) ----------
   Serve para quando a peça sugerida não é a do andamento do processo: escolher aqui preenche descrição, dias, contagem e
   recalcula o vencimento (mesma conta de sempre). A sugestão de cima não muda. Ao confirmar, a escolha entra no aprendizado. */
var PB_CAT_EXEC = { 'exec-extra': 1, 'cumpr-pagar': 1, 'exeq-bens': 1, 'penhora-exec': 1, 'penhora-exeq': 1, 'leilao': 1, 'calculos': 1, 'impug-cumpr-rejeitada': 1 };
var PB_CAT_GRUPOS = ['Manifestações e defesas', 'Recursos', 'Execução e cumprimento', 'Aprendidas com você'];
var pbCat = { id: '', itens: [] };
function pbCatLista(p, pc){
  var t = pbTextos[p.id], sug = (t && t.ok && t.sug) || p.sug, vistos = {}, itens = [];
  PC_REGRAS.forEach(function(rg){ (rg.itens || []).forEach(function(it){
    if (it.kind === 'registro' || !(it.dias || it.dias === 'texto') || vistos[it.peca]) return;
    vistos[it.peca] = 1;
    var x = { rid: 'catalogo', peca: it.peca, base: it.base, kind: it.kind || 'manif', nota: '', dias: it.dias, contagem: 'uteis', origemPrazo: 'lei', principal: false, grupo: it.kind === 'recurso' ? 'Recursos' : (PB_CAT_EXEC[rg.id] ? 'Execução e cumprimento' : 'Manifestações e defesas') };
    if (x.dias === 'texto'){ x.dias = sug && sug.dias ? sug.dias : (it.padrao || 5); x.origemPrazo = sug && sug.dias ? 'texto' : 'supletivo'; if (sug && sug.tipo === 'corridos') x.contagem = 'corridos'; }
    itens.push(x);
  }); });
  if (pc && pc.instancia === 'juizado'){ try{ itens = pcJuizado(itens).filter(function(x){ return x.dias; }); }catch(e){} }
  itens.sort(function(a, b){ return a.peca.localeCompare(b.peca, 'pt-BR'); });
  pbAprend.forEach(function(e){ if (e.tipo === 'regra' || e.ativa === false || !e.peca) return; itens.push({ rid: 'catalogo', peca: e.peca, base: e.base || 'aprendida com você', kind: e.kind || 'manif', nota: 'você usou ' + (e.usos || 1) + ((e.usos || 1) === 1 ? ' vez' : ' vezes'), dias: e.dias || 5, contagem: e.contagem || 'uteis', origemPrazo: 'aprendida', principal: false, grupo: 'Aprendidas com você' }); });
  itens.forEach(function(x, k){ x._k = k; });
  return itens;
}
function pbCatHtml(filtro){
  var q = pcNorm(filtro || ''), h = '';
  PB_CAT_GRUPOS.forEach(function(g){
    var l = pbCat.itens.filter(function(x){ return x.grupo === g && (!q || pcNorm(x.peca + ' ' + x.base).indexOf(q) >= 0); });
    if (!l.length) return;
    h += '<div class="pb-cat-g">' + escapeHtml(g) + '</div>' + l.map(function(x){ return '<button type="button" class="pb-cat-i" data-pbd="cat" data-k="' + x._k + '"><span>' + escapeHtml(x.peca) + '</span><small>' + x.dias + ' dias ' + (x.contagem === 'corridos' ? 'corridos' : 'úteis') + ' · ' + escapeHtml(x.base) + '</small></button>'; }).join('');
  });
  return h || '<div class="saldo-data" style="padding:10px 12px">Nenhuma peça com esse nome.</div>';
}
function pbCatAbrir(){
  var p = pbPub(pbDetId), box = qs('pbCatBox'), bt = qs('pbCatBtn'); if (!p || !box) return;
  if (!box.hidden){ box.hidden = true; if (bt) bt.setAttribute('aria-expanded', 'false'); return; }
  pbCat = { id: p.id, itens: pbCatLista(p, pbPecasDe(p)) };
  box.innerHTML = '<input type="text" id="pbCatBusca" class="pb-cat-busca" placeholder="Digite para filtrar as peças…" autocomplete="off"><div class="pb-cat-lista" id="pbCatLista">' + pbCatHtml('') + '</div>';
  box.hidden = false; if (bt) bt.setAttribute('aria-expanded', 'true');
  var b = qs('pbCatBusca'); if (b) b.focus();
}
function pbCatEscolher(k){
  var it = pbCat.itens[k]; if (!it || pbCat.id !== pbDetId) return;
  var st = pbPeca[pbDetId] = pbPeca[pbDetId] || {}; st.cat = JSON.parse(JSON.stringify(it)); pbDesenharDetalhe();
  var bx = qs('pbPrazoBox'); if (bx && bx.scrollIntoView) bx.scrollIntoView();
}
document.addEventListener('input', function(ev){ var t = ev.target; if (t && t.id === 'pbCatBusca'){ var l = qs('pbCatLista'); if (l) l.innerHTML = pbCatHtml(t.value); } });
function pbPecaIdx(p, pc){
  var st = pbPeca[p.id]; if (st && st.cat) return -1;   /* peça escolhida na lista completa: nenhuma das sugeridas fica marcada */
  if (st && typeof st.i === 'number' && pc.itens[st.i]) return st.i;
  for (var i = 0; i < pc.itens.length; i++) if (pc.itens[i].principal) return i;
  return -1;
}
function pbPecaSel(p){ var st0 = pbPeca[p.id]; if (st0 && st0.cat) return st0.cat; var pc = pbPecasDe(p); if (!pc) return null; var i = pbPecaIdx(p, pc); return i >= 0 ? pc.itens[i] : null; }
function pbPecaPoloSet(id, polo){
  var p = pbPub(id); if (!p) return; var t = pbTextos[id], st = pbPeca[id] = pbPeca[id] || {};
  st.polo = polo; st.i = null; st.cat = null; st.pc = sugerirPecas({ tipo: p.tipo, comunic: p.comunic, classe: p.classe, orgao: p.orgao, tribunal: p.tribunal, texto: (t && t.ok && t.texto) ? t.texto : p.trecho, dest: [{ n: 'Cliente', p: polo }], diasTexto: (t && t.ok && t.sug) || p.sug });
  pbDesenharDetalhe();
}
function pbPecaHtml(p, pc){
  var idx = pbPecaIdx(p, pc);
  var h = '<div class="pb-sec pb-ia"><div class="pb-sec-t">✦ Peça sugerida</div><div class="saldo-data">' + escapeHtml((PC_NATUREZA[pc.natureza] || 'Ato') + ' · ' + (PB_INST[pc.instancia] || '') + (pc.polo ? ' · seu cliente é o ' + (pc.polo === 'A' ? 'autor' : 'réu') : '')) + '</div>';
  if (!pc.polo) h += '<div class="field" style="margin:4px 0"><label class="field-label" for="pbf_polo">Seu cliente neste processo é…</label><select id="pbf_polo" class="filter-select" style="width:100%"><option value="">Não sei (mostrar tudo)</option><option value="A">Autor / exequente</option><option value="P">Réu / executado</option></select></div>';
  if (!pc.itens.length) return h + '<div class="saldo-data">Não encontrei peça para este ato. Use o prazo manual abaixo, se houver.</div></div>';
  h += pc.itens.map(function(it, i){
    var det = (it.dias ? it.dias + ' dias ' + (it.contagem === 'corridos' ? 'corridos' : 'úteis') + (it.origemPrazo === 'texto' ? ' (do texto)' : (it.origemPrazo === 'supletivo' ? ' (supletivo)' : '')) : 'sem prazo imediato') + ' · ' + it.base;
    return '<button type="button" class="pb-pc' + (i === idx ? ' on' : '') + '" data-pbd="peca" data-i="' + i + '"><b>' + escapeHtml(it.peca) + '</b><span>' + (it.origem === 'aprendida' ? '<b style="color:var(--info)">aprendida</b> · ' : '') + escapeHtml(det) + (it.nota ? ' · ' + escapeHtml(it.nota) : '') + '</span></button>';
  }).join('');
  (pc.avisos || []).forEach(function(a){ h += '<div class="saldo-data">' + escapeHtml(a) + '</div>'; });
  var sel = idx >= 0 ? pc.itens[idx] : null;
  if (sel && !sel.dias) h += '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-pbd="registrar">Registrar no processo</button></div>';
  return h + '<div class="pb-aviso">O app só sugere. Escolha a peça, ajuste os dias abaixo se precisar e confirme.</div></div>';
}
/* audiência encontrada no texto da publicação (só se for futura) e se já está na Agenda */
function pbAudDe(p){
  var t = pbTextos[p.id], a = (t && t.ok && t.aud) || null;
  if (!a) pbMembros(p).forEach(function(x){ if (!a && x.aud) a = x.aud; });
  return a && a.data >= todayISO() ? a : null;
}
function pbAudNaAgenda(p, a){
  var ids = pbMembros(p).map(function(x){ return x.id; }), num = String(p.processo || '');
  return agDocs.some(function(d){ return d.tipo === 'audiencia' && ((d.audPubId && ids.indexOf(d.audPubId) >= 0) || (num && d.data === a.data && prNum(d.processo) === num && (!a.hora || !d.hora || d.hora === a.hora))); });
}
/* audiência ou tarefa da Agenda a partir de uma publicação, mesmo quando o app não reconheceu nada no texto: abre o editor já com o processo, o cliente e o órgão; data e hora você informa */
function pbCriarAudienciaLivre(p){
  var v = pbVinculo(p.processo);
  agAbrir(null, { tipo: 'audiencia', titulo: 'Audiência', processo: p.numero || p.processo, cliente: pbNomeParte(p, v), data: '', hora: '', audTipo: '', modalidade: '', local: [p.tribunal, p.orgao].filter(Boolean).join(' · '), link: '', audPubId: p.id });
}
function pbCriarTarefa(id){
  var p = pbPub(id); if (!p) return; var v = pbVinculo(p.processo);
  agAbrir(null, { tipo: 'tarefa', titulo: 'Providência' + (p.tipo ? ' — ' + p.tipo : ''), processo: p.numero || p.processo, cliente: pbNomeParte(p, v), data: '', audPubId: p.id });   /* audPubId só guarda a origem (aparece "via publicação"); não confirma prazo da publicação */
}
function pbCriarAudiencia(id, livre){
  var p = pbPub(id), a = p && pbAudDe(p); if (!p) return;
  if (!a){ if (livre) pbCriarAudienciaLivre(p); return; }
  var v = pbVinculo(p.processo), presencial = a.modalidade !== 'online';
  agAbrir(null, { tipo: 'audiencia', titulo: 'Audiência' + (a.tipo ? ' de ' + a.tipo.toLowerCase() : ''), processo: p.numero || p.processo, cliente: pbNomeParte(p, v), data: a.data, hora: a.hora, audTipo: a.tipo, modalidade: a.modalidade, local: presencial ? [p.tribunal, p.orgao].filter(Boolean).join(' · ') : '', link: a.link, audPubId: p.id });
}
function pbPub(id){ for (var i = 0; i < pbS.pubs.length; i++) if (pbS.pubs[i].id === id) return pbS.pubs[i]; return null; }
function pbSemAcento(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function pbFiltrosAtivos(){ var f = pbS.f; return (f.q.trim() ? 1 : 0) + (f.de ? 1 : 0) + (f.ate ? 1 : 0) + (f.oab !== 'todas' ? 1 : 0) + (f.adv.trim() ? 1 : 0) + (f.trib ? 1 : 0); }
function pbPassaFiltros(p){
  var f = pbS.f;
  if (f.de && p.data < f.de) return false;
  if (f.ate && p.data > f.ate) return false;
  if (f.oab !== 'todas' && p.oabs.indexOf(f.oab) < 0) return false;
  if (f.trib && p.tribunal !== f.trib) return false;
  if (f.adv.trim()){
    var a = pbSemAcento(f.adv.trim()), achou = (p.advs || []).some(function(x){ return pbSemAcento(x.n + ' ' + x.o).indexOf(a) >= 0 || x.o.replace(/\D/g, '').indexOf(a.replace(/\D/g, '') || '@@') >= 0; });
    if (!achou) return false;
  }
  if (f.q.trim()){
    var q = pbSemAcento(f.q.trim()), v = pbVinculo(p.processo), alvo = pbSemAcento([v ? v.cliente : '', pbNomeParte(p, null), (p.dest || []).map(function(d){ return d.n; }).join(' '), p.processo, p.numero, p.orgao, p.classe].join(' '));
    if (alvo.indexOf(q) < 0 && (q.replace(/\D/g, '').length < 4 || String(p.processo).indexOf(q.replace(/\D/g, '')) < 0)) return false;
  }
  return true;
}
function pbListaFiltrada(){
  var vis = pbGrupos(pbVisiveis().filter(pbPassaFiltros));
  if (pbS.filtro === 'naolidas') vis = vis.filter(function(p){ return !pbLidaG(p); });
  else if (pbS.filtro === 'meus') vis = vis.filter(function(p){ return !!pbVinculo(p.processo); });
  return vis;
}
function pbRender(){
  pbMontarTela();
  var w = qs('pbWrap'); if (!w) return;
  if (!window.__SERVIDOR){ w.innerHTML = '<div class="financeiro-vazio">As publicações do Diário Oficial funcionam no app hospedado no Cloudflare.</div>'; return; }
  if (!pbS.carregado){ w.innerHTML = '<div class="financeiro-vazio">Carregando publicações…</div>'; pbCarregar(); return; }
  pbAgrupaTodos();
  var vis = pbGrupos(pbVisiveis()), naoLidas = vis.filter(function(p){ return !pbLidaG(p); });
  var aDefinir = vis.filter(function(p){ return p.sug && !pbSemPrazoG(p) && !pbPrazoGrupo(p) && !pbLidaG(p); }).length;
  var semProc = naoLidas.filter(function(p){ return !pbVinculo(p.processo); }).length;
  /* sub-abas padrão (Fase 2): Resumo, Não lidas, Meus processos e Todas; a última usada fica lembrada */
  if (!pbS.mdOk){ pbS.mdOk = 1; var s0 = mdInicial('publicacoes', ['naolidas', 'meus', 'todas']); if (s0 === 'resumo') pbS.sub = 'resumo'; else { pbS.sub = 'lista'; pbS.filtro = s0; } }
  var res = pbS.sub === 'resumo';
  var h = '<div id="pbSeg">' + mdBarraHtml([['resumo', 'Resumo'], ['naolidas', 'Não lidas', naoLidas.length || ''], ['meus', 'Meus processos'], ['todas', 'Todas']], res ? 'resumo' : pbS.filtro, function(k){ return 'data-pb="filtro" data-v="' + k + '"'; }) + '</div>';
  h += '<div class="ini-acoes pb-barra"><button type="button" class="acao acao-ouro" data-pb="buscar"' + (pbS.buscando ? ' disabled' : '') + '><svg><use href="#ic-sync"/></svg><span>' + (pbS.buscando ? 'Buscando…' : 'Buscar agora') + '</span></button><button type="button" class="acao" data-pb="oabs"><svg><use href="#ic-users"/></svg><span>OABs monitoradas</span></button></div>';
  var n = pbFiltrosAtivos();
  if (res){
    if (pbS.erro) h += '<div class="aviso-sis"><span class="as-txt">Não consegui carregar: ' + escapeHtml(pbS.erro) + '</span></div>';
    h += pbAvisoLeitura();
    try{ h += mjPainel('publicacoes', mjPublicacoes()); }catch(e){ console.error('resumo de publicações', e); h += '<div class="financeiro-vazio">Não consegui montar o resumo. As outras sub-abas continuam funcionando.</div>'; }
    w.innerHTML = h; return;
  }
  h += '<div class="pb-filtros"><div class="pb-seg-lin"><span class="saldo-data" style="flex:1;align-self:center">' + naoLidas.length + (naoLidas.length === 1 ? ' não lida' : ' não lidas') + (aDefinir ? ' · ' + aDefinir + ' com prazo a definir' : '') + ' · atualizado ' + escapeHtml(pbQuandoAtualizou()) + '</span>' +
    '<button type="button" class="btn btn-ghost pb-funil' + (n ? ' ativo' : '') + '" data-pb="painel" aria-label="Filtros" aria-expanded="' + (pbS.fAberto ? 'true' : 'false') + '" title="Filtros"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>' + (n ? '<i class="pb-n">' + n + '</i>' : '') + '</button>' +
    '<button type="button" class="btn btn-ghost pb-funil' + (pbS.mAberto ? ' ativo' : '') + '" data-pb="menu" aria-label="Mais opções" aria-expanded="' + (pbS.mAberto ? 'true' : 'false') + '" title="Mais opções"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div>';
  if (pbS.fAberto) h += pbPainelHtml();
  if (pbS.mAberto) h += pbMenuHtml(vis);
  h += '</div>';
  if (pbS.erro) h += '<div class="aviso-sis"><span class="as-txt">Não consegui carregar: ' + escapeHtml(pbS.erro) + '</span></div>';
  h += pbAvisoLeitura();
  if (!pbS.oabs.some(function(o){ return o.ativo; })) h += '<div class="financeiro-vazio">Nenhuma OAB ativa. Toque em “OABs monitoradas” para cadastrar.</div>';
  h += '<div id="pbListaBox" class="pb-lista">' + pbListaHtml() + '</div>';
  w.innerHTML = h;
}
/* a leitura automática das 10h falhar em silêncio custa um prazo: avisa quando passou de 1 dia ou quando uma OAB deu erro */
function pbAvisoLeitura(){
  var ativas = pbS.oabs.filter(function(o){ return o.ativo; }); if (!ativas.length) return '';
  var comErro = ativas.filter(function(o){ return o.erro; }), parada = !pbS.ultima || (Date.now() - Date.parse(pbS.ultima)) > 30 * 3600e3, msg = '';
  if (comErro.length) msg = 'A última leitura falhou para ' + comErro.map(function(o){ return o.nome; }).join(', ') + ' (' + comErro[0].erro + '). Pode haver publicação que você ainda não viu.';
  else if (parada) msg = pbS.ultima ? 'A leitura automática não roda desde ' + pbQuandoAtualizou() + '. Pode haver publicação que você ainda não viu.' : 'A leitura automática do Diário Oficial ainda não rodou.';
  if (comErro.length && /\b(403|429|5\d\d)\b/.test(comErro[0].erro)) msg += ' A leitura feita daqui do app costuma funcionar: o app tenta sozinho ao ser aberto, e o servidor tenta de novo de 2 em 2 horas, até as 18h.';
  return msg ? '<div class="aviso-sis" id="pbAvisoLeitura"><span class="as-txt">' + escapeHtml(msg) + ' Toque em “Buscar agora”.</span></div>' : '';
}
/* menu "☰": o que não é de uso toda hora (peças e prazos, relatório, marcar tudo como lido) */
function pbMenuHtml(vis){
  var nl = pbListaFiltrada().filter(function(p){ return !pbLidaG(p); }).length, n = pbFiltrosAtivos();
  return '<div class="pb-painel pb-menu"><button type="button" class="pb-mi" data-pb="pecas"><span class="pb-mi-i">✦</span>Peças e prazos<small>regras e o que o app aprendeu</small></button>' +
    '<button type="button" class="pb-mi" data-pb="rel"><span class="pb-mi-i">🖨</span>Relatório das publicações<small>imprimir ou salvar em PDF</small></button>' +
    '<button type="button" class="pb-mi" data-pb="todas-lidas"' + (nl ? '' : ' disabled') + '><span class="pb-mi-i">✓</span>Marcar ' + (n ? 'as ' + nl + ' deste filtro' : (nl ? 'todas (' + nl + ')' : 'todas')) + ' como lidas<small>' + (nl ? 'só as que aparecem na lista' : 'não há publicações não lidas') + '</small></button></div>';
}
function pbPainelHtml(){
  var f = pbS.f, trib = {}, i;
  pbVisiveis().forEach(function(p){ if (p.tribunal) trib[p.tribunal] = 1; });
  var tribs = Object.keys(trib).sort();
  return '<div class="pb-painel"><div class="field"><label class="field-label" for="pbf_q">Cliente, partes ou processo</label><input type="text" id="pbf_q" data-pbf="q" value="' + escapeHtml(f.q) + '" placeholder="Ex.: Cooperativa, 5368644…" autocomplete="off"></div>' +
    '<div class="pb-dois"><div class="field"><label class="field-label" for="pbf_de">Data de</label><input type="date" id="pbf_de" data-pbf="de" value="' + escapeHtml(f.de) + '"></div><div class="field"><label class="field-label" for="pbf_ate">Data até</label><input type="date" id="pbf_ate" data-pbf="ate" value="' + escapeHtml(f.ate) + '"></div></div>' +
    '<div class="field"><label class="field-label" for="pbOabSel">OAB monitorada</label><select id="pbOabSel" class="filter-select" data-pbf="oab" style="width:100%"><option value="todas">Todas as OABs</option>' + pbS.oabs.map(function(o){ return '<option value="' + escapeHtml(o.id) + '"' + (f.oab === o.id ? ' selected' : '') + '>' + escapeHtml(o.nome) + ' · ' + escapeHtml(o.numero + '/' + o.uf) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label class="field-label" for="pbf_adv">Advogado (nome ou nº da OAB)</label><input type="text" id="pbf_adv" data-pbf="adv" value="' + escapeHtml(f.adv) + '" placeholder="Ex.: Murilo, 49308" autocomplete="off"><div class="saldo-data">Procura entre os advogados citados na publicação (inclusive da parte contrária).</div></div>' +
    '<div class="field"><label class="field-label" for="pbf_trib">Tribunal</label><select id="pbf_trib" class="filter-select" data-pbf="trib" style="width:100%"><option value="">Todos</option>' + tribs.map(function(t){ return '<option value="' + escapeHtml(t) + '"' + (f.trib === t ? ' selected' : '') + '>' + escapeHtml(t) + '</option>'; }).join('') + '</select></div>' +
    '<div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" data-pb="limpar">Limpar filtros</button><button type="button" class="btn btn-primary pb-b" data-pb="painel">Fechar</button></div><div class="saldo-data">Mostra as publicações dos últimos 90 dias.</div></div>';
}
function pbListaHtml(){
  var lista = pbListaFiltrada(), limite = pbS.mais * 30, ultimoDia = '', h = '', n = pbFiltrosAtivos();
  var naoLidas = lista.filter(function(p){ return !pbLidaG(p); });
  if (n) h += '<div class="saldo-data pb-resfiltro">' + lista.length + (lista.length === 1 ? ' publicação' : ' publicações') + ' com os filtros escolhidos. <button type="button" class="btn-text" data-pb="limpar">Limpar</button></div>';
  if (!lista.length && pbS.oabs.some(function(o){ return o.ativo; })) h += '<div class="financeiro-vazio">' + (n ? 'Nenhuma publicação com esses filtros.' : (pbS.filtro === 'naolidas' ? 'Nenhuma publicação nova. Tudo lido.' : 'Nenhuma publicação nos últimos 90 dias para este filtro.')) + '</div>';
  lista.slice(0, limite).forEach(function(p){
    if (p.data !== ultimoDia){ ultimoDia = p.data; h += '<div class="pb-dia">' + escapeHtml(pbQuando(p.data)) + '</div>'; }
    h += pbCartao(p);
  });
  if (lista.length > limite) h += '<button type="button" class="btn btn-ghost" data-pb="mais" style="width:100%;justify-content:center;">Mostrar mais (' + (lista.length - limite) + ')</button>';
  return h;
}
function pbRenderLista(){
  var box = qs('pbListaBox'); if (!box) { pbRender(); return; }
  box.innerHTML = pbListaHtml();
  var n = pbFiltrosAtivos(), fb = document.querySelector('.pb-funil'); if (fb){ fb.classList.toggle('ativo', n > 0); var i = fb.querySelector('.pb-n'); if (n){ if (!i){ i = document.createElement('i'); i.className = 'pb-n'; fb.appendChild(i); } i.textContent = n; } else if (i) i.remove(); }
}
function pbCartao(p){
  var v = pbVinculo(p.processo), pz = pbPrazoGrupo(p), cls = pbClasseTipo(p.tipo), tags = '', mem = pbMembros(p), lida = pbLidaG(p), semPz = pbSemPrazoG(p);
  if (mem.length > 1) tags += '<span class="pb-tg nv">' + mem.length + ' publicações idênticas reunidas</span>';
  tags += v ? '<button type="button" class="pb-tg ok" data-pb="ir" data-id="' + escapeHtml(p.id) + '">✓ ' + escapeHtml(v.cadastro) + (v.arquivado ? ' (arquivado)' : '') + '</button>' : '<span class="pb-tg nv">Processo novo</span>';
  if (!v){ var prov = cliProvaveis(pbDestinatarios(p)); if (prov.length) tags += '<span class="pb-tg ok">provável cliente: ' + escapeHtml(prov.slice(0, 2).map(function(c){ return c.nome; }).join(', ')) + '</span>'; }
  if (pz) tags += '<span class="pb-tg pz">⏱ prazo ' + escapeHtml(fmtData(pz.data)) + (pz.concluido ? ' (cumprido)' : '') + '</span>';
  else if (!semPz && pbPecaPrincipal(pbPecasDe(p))) { var pp = pbPecaPrincipal(pbPecasDe(p)); tags += '<span class="pb-tg pz">✦ ' + escapeHtml(pp.peca.slice(0, 44)) + (pp.dias ? ' · ' + pp.dias + ' dias' : '') + '</span>'; }
  else if (p.sug && !semPz) tags += '<span class="pb-tg pz">⏱ sugerido: ' + p.sug.dias + (p.sug.tipo === 'corridos' ? ' dias corridos' : ' dias') + '</span>';
  var aud = pbAudDe(p), audOk = aud && pbAudNaAgenda(p, aud);
  if (aud) tags += '<span class="pb-tg ' + (audOk ? 'ok' : 'pz') + '">🗓 audiência ' + escapeHtml(fmtData(aud.data).slice(0, 5) + (aud.hora ? ' ' + aud.hora : '')) + (audOk ? ' · na Agenda' : '') + '</span>';
  p.oabs.forEach(function(id){ var o = pbOabDe(id); if (o) tags += '<span class="pb-tg">via OAB ' + escapeHtml(pbPrimeiroNome(o)) + '</span>'; });
  var btn = '';
  if (aud && !audOk) btn += '<button type="button" class="btn btn-primary pb-b" data-pb="aud" data-id="' + escapeHtml(p.id) + '">Criar audiência</button>';
  var ppr = pbPecaPrincipal(pbPecasDe(p));
  if (!pz && ppr && ppr.dias && !semPz) btn += '<button type="button" class="btn btn-primary pb-b" data-pb="prazo" data-id="' + escapeHtml(p.id) + '">Confirmar: ' + escapeHtml(ppr.peca.split(' (')[0].slice(0, 22)) + '</button>';
  else if (!pz && p.sug && !semPz) btn += '<button type="button" class="btn btn-primary pb-b" data-pb="prazo" data-id="' + escapeHtml(p.id) + '">Confirmar prazo</button>';
  else if (!pz && !semPz && cls !== 'out') btn += '<button type="button" class="btn btn-ghost pb-b" data-pb="prazo" data-id="' + escapeHtml(p.id) + '">Criar prazo</button>';
  if (v && v.arquivado) btn += '<button type="button" class="btn btn-ghost pb-b" data-pb="reabrir-proc" data-id="' + escapeHtml(p.id) + '">Reabrir processo</button>';
  if (!v) btn += '<button type="button" class="btn btn-ghost pb-b" data-pb="cadastrar" data-id="' + escapeHtml(p.id) + '">Cadastrar processo</button>';
  btn += '<button type="button" class="btn btn-ghost pb-b" data-pb="abrir" data-id="' + escapeHtml(p.id) + '">Ver texto</button><button type="button" class="btn btn-ghost pb-b" data-pb="lida" data-id="' + escapeHtml(p.id) + '">' + (lida ? 'Marcar como não lida' : 'Marcar como lida') + '</button>';
  return '<div class="pb-card ' + cls + (lida ? ' lida' : '') + '"><div class="pb-l1"><span>' + (lida ? '' : '<i class="pb-dot"></i>') + escapeHtml((p.tribunal ? p.tribunal + ' · ' : '') + (p.orgao || '')) + '</span><span class="pb-tipo ' + cls + '">' + escapeHtml(p.tipo || 'Publicação') + '</span></div>' +
    '<div class="pb-cli">' + escapeHtml(pbNomeParte(p, v)) + '</div><div class="pb-proc">' + escapeHtml(p.numero || p.processo || '') + (p.classe ? ' · ' + escapeHtml(pbClasse(p.classe)) : '') + '</div>' + (mem.length > 1 ? pbDestHtml(p) : '') +
    (p.trecho ? '<div class="pb-trecho">' + escapeHtml(p.trecho) + '</div>' : '') + '<div class="pb-tags">' + tags + '</div><div class="pb-acts">' + btn + '</div></div>';
}
function pbDestHtml(p){
  var ns = pbDestinatarios(p); if (ns.length < 2) return '';
  return '<div class="saldo-data" style="margin-bottom:6px">Para: ' + escapeHtml(ns.slice(0, 5).join(', ')) + (ns.length > 5 ? ' e mais ' + (ns.length - 5) : '') + '</div>';
}
function pbMarcar(ids, campos){
  ids.forEach(function(id){ var p = pbPub(id); if (p){ if (typeof campos.lida === 'boolean') p.lida = campos.lida; if (typeof campos.semPrazo === 'boolean') p.semPrazo = campos.semPrazo; } });
  pbAtualizarBadge(); if (activeTab === 'publicacoes') pbRender();
  var corpo = { ids: ids }; if (typeof campos.lida === 'boolean') corpo.lida = campos.lida; if (typeof campos.semPrazo === 'boolean') corpo.semPrazo = campos.semPrazo;
  return pbApi('/api/djen/marcar', 'POST', corpo).catch(function(e){ toast('Não consegui salvar: ' + e.message); });
}
function pbIrVinculo(id){ var p = pbPub(id), v = p && pbVinculo(p.processo); if (v) prAbrir(v.id); }
function pbCadastrar(id){ prEscolherCadastro(id); }

/* ---------- detalhe da publicação ---------- */
function pbMontarDetalhe(){
  if (qs('overlayPb')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayPb';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Publicação</h2><button class="icon-btn" id="pbFechar" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="pbCorpo"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#pbFechar'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-pbd]') : null; if (!b) return;
    var a = b.getAttribute('data-pbd');
    if (a === 'confirmar') pbSalvarPrazo(false);
    else if (a === 'naoe'){ pbMarcar(pbMembros(pbPub(pbDetId)).map(function(x){ return x.id; }), { semPrazo: true, lida: true }); d.classList.remove('show'); toast('Marcada como sem prazo.'); }
    else if (a === 'manual'){ var m = qs('pbManualBox'); m.style.display = m.style.display === 'none' ? '' : 'none'; }
    else if (a === 'aud') pbCriarAudiencia(pbDetId);
    else if (a === 'aud-livre') pbCriarAudiencia(pbDetId, true);
    else if (a === 'tarefa') pbCriarTarefa(pbDetId);
    else if (a === 'peca'){ var st = pbPeca[pbDetId] = pbPeca[pbDetId] || {}; st.cat = null; st.i = parseInt(b.getAttribute('data-i'), 10); pbDesenharDetalhe(); var bx = qs('pbPrazoBox'); if (bx && bx.scrollIntoView) bx.scrollIntoView(); }
    else if (a === 'catalogo') pbCatAbrir();
    else if (a === 'cat') pbCatEscolher(parseInt(b.getAttribute('data-k'), 10));
    else if (a === 'registrar'){ var ps = pbPub(pbDetId), sl = ps && pbPecaSel(ps); if (sl) prRegistrar(ps, sl.peca + (sl.base ? ' (' + sl.base + ')' : '')); }
    else if (a === 'cadastrar') pbCadastrar(pbDetId);   /* a leitura continua aberta por baixo: depois de cadastrar, dá para marcar prazo ou lida */
    else if (a === 'irproc'){ var pi = pbPub(pbDetId), vi = pi && pbVinculo(pi.processo); if (vi) prAbrir(vi.id); }
    else if (a === 'reabrirproc'){ var pr2 = pbPub(pbDetId), vr = pr2 && pbVinculo(pr2.processo); if (vr) prReabrir(vr.id).then(function(){ pbDesenharDetalhe(); }); }
    else if (a === 'naolida'){ var pn = pbPub(pbDetId); if (pn) pbMarcar(pbMembros(pn).map(function(x){ return x.id; }), { lida: false }); d.classList.remove('show'); toast('Continua em “Não lidas”.'); }
    else if (a === 'copiar'){ var t = (pbTextos[pbDetId] || {}).texto || (pbPub(pbDetId) || {}).trecho || ''; try{ navigator.clipboard.writeText(t); toast('Texto copiado.'); }catch(x){ toast('Não consegui copiar.'); } }
  });
  d.addEventListener('input', function(e){ if (e.target && /^pbf_/.test(e.target.id)) pbAtualizarCalculo(); });
  d.addEventListener('change', function(e){
    if (e.target && e.target.id === 'pbf_polo' && e.target.value){ pbPecaPoloSet(pbDetId, e.target.value); return; }
    if (e.target && e.target.id === 'pbf_dobro'){ var s0 = pbPeca[pbDetId] = pbPeca[pbDetId] || {}; s0.dobro = e.target.value; }
    if (e.target && /^pbf_/.test(e.target.id)) pbAtualizarCalculo();
  });
}
function pbAbrirPrazoPub(id){ pbAbrirDetalhe(id, true); }
function pbAbrirDetalhe(id, irParaPrazo){
  var p = pbPub(id); if (!p) return;
  pbMontarDetalhe(); pbDetId = id; pbDesenharDetalhe(); qs('overlayPb').classList.add('show');
  if (!pbLidaG(p)) pbMarcar(pbMembros(p).map(function(x){ return x.id; }), { lida: true });
  if (!pbTextos[id]){
    pbApi('/api/djen/texto?id=' + encodeURIComponent(id)).then(function(r){ pbTextos[id] = r; }).catch(function(e){ pbTextos[id] = { ok: false, motivo: e.message }; }).then(function(){ if (pbDetId === id){ pbDesenharDetalhe(); if (irParaPrazo){ var f = qs('pbPrazoBox'); if (f && f.scrollIntoView) f.scrollIntoView(); } } });
  } else if (irParaPrazo) setTimeout(function(){ var f = qs('pbPrazoBox'); if (f && f.scrollIntoView) f.scrollIntoView(); }, 50);
}
function pbDesenharDetalhe(){
  var p = pbPub(pbDetId), c = qs('pbCorpo'); if (!p || !c) return;
  var v = pbVinculo(p.processo), t = pbTextos[p.id], pz = pbPrazoGrupo(p), sug = (t && t.ok && t.sug) || p.sug, mem = pbMembros(p);
  var pc = pz ? null : pbPecasDe(p), stp = pbPeca[p.id] || {}, pcSel = pz ? null : (pc ? pbPecaSel(p) : (stp.cat || null)), usaPc = !!(pcSel && pcSel.dias);
  var h = '<div class="pb-cab"><div class="pb-l1"><span>' + escapeHtml(fmtData(p.data) + ' · ' + (p.tribunal || '') + ' · ' + (p.orgao || '')) + '</span></div><div class="pb-cli">' + escapeHtml(pbNomeParte(p, v)) + '</div><div class="pb-proc">' + escapeHtml(p.numero || '') + (p.classe ? ' · ' + escapeHtml(pbClasse(p.classe)) : '') + '</div><div class="pb-tags"><span class="pb-tipo ' + pbClasseTipo(p.tipo) + '">' + escapeHtml(p.tipo || 'Publicação') + '</span>' + (v ? '<span class="pb-tg ok">✓ ' + escapeHtml(v.cadastro) + ': ' + escapeHtml(v.cliente) + '</span>' : '<span class="pb-tg nv">Processo novo</span>') + '</div></div>';
  if (mem.length > 1) h += '<div class="pb-sec"><div class="pb-sec-t">' + mem.length + ' publicações idênticas reunidas</div><div class="saldo-data">Mesmo processo, dia e texto; só muda o destinatário ou a OAB que a encontrou. Elas são marcadas como lidas juntas.</div><div class="txt">' + escapeHtml(pbDestinatarios(p).join(', ')) + '</div></div>';
  h += '<div class="pb-sec"><div class="pb-sec-t">Texto da publicação</div>';
  if (!t) h += '<div class="saldo-data">Buscando o texto completo no Diário Oficial…</div><div class="pb-texto">' + escapeHtml(p.trecho || '') + '</div>';
  else if (t.ok) h += '<div class="pb-texto">' + escapeHtml(t.texto) + '</div>';
  else h += '<div class="saldo-data">Não consegui buscar o texto completo (' + escapeHtml(t.motivo || 'erro') + '). Abaixo, o trecho guardado.</div><div class="pb-texto">' + escapeHtml(p.trecho || '') + '</div>';
  h += '<div class="pb-acts">' + (p.link ? '<a class="btn btn-ghost pb-b" href="' + escapeHtml(p.link) + '" target="_blank" rel="noopener noreferrer">Abrir original no tribunal ↗</a>' : '') + '<button type="button" class="btn btn-ghost pb-b" data-pbd="copiar">Copiar texto</button></div>' +
    '<div class="pb-acts">' + (!v ? '<button type="button" class="btn btn-primary pb-b" data-pbd="cadastrar">Cadastrar processo</button>' : '<button type="button" class="btn btn-ghost pb-b" data-pbd="irproc">Abrir o processo</button>' + (v.arquivado ? '<button type="button" class="btn btn-primary pb-b" data-pbd="reabrirproc">Reabrir processo</button>' : '')) + '<button type="button" class="btn btn-ghost pb-b" data-pbd="naolida">Manter como não lida</button></div></div>';
  { var au0 = pbAudDe(p); h += '<div class="pb-sec"><div class="pb-sec-t">Agenda</div><div class="saldo-data">Cadastre a partir desta publicação, mesmo que o app não tenha reconhecido nada no texto.</div><div class="pb-acts">' + (au0 ? '' : '<button type="button" class="btn btn-ghost pb-b" data-pbd="aud-livre">Criar audiência</button>') + '<button type="button" class="btn btn-ghost pb-b" data-pbd="tarefa">Criar tarefa</button></div></div>'; }
  h += '<div class="pb-sec pb-ia" id="pbPrazoBox">';
  if (pz){
    h += '<div class="pb-sec-t">Prazo confirmado</div><div class="pb-prazo-ok"><b>' + escapeHtml(fmtData(pz.data)) + '</b> <span>(' + escapeHtml(pbDiaSem(pz.data)) + ')</span><div class="saldo-data">' + escapeHtml(pz.descricao || '') + (pz.concluido ? ' · cumprido' : '') + '</div></div><div class="pb-acts"><button type="button" class="btn btn-ghost pb-b" id="pbVerPrazo">Abrir prazo</button></div>';
  } else {
    if (pc) h += pbPecaHtml(p, pc);
    h += '<div class="pb-sec-t">' + (usaPc ? 'Prazo da peça escolhida' : (sug ? '✦ Prazo sugerido pelo texto' : 'Prazo desta publicação')) + '</div>';
    if (sug) h += '<div class="pb-frase">“…' + escapeHtml(sug.frase) + '…”</div>'; else h += '<div class="saldo-data">Não achei um prazo no texto. Se houver, informe os dias abaixo.</div>';
    h += '<div class="field"><label class="field-label" for="pbf_desc">Descrição</label><div class="pb-combo"><input type="text" id="pbf_desc" maxlength="90" value="' + escapeHtml(usaPc ? pcSel.peca : (sug ? 'Prazo de ' + sug.dias + ' dias — ' + (p.tipo || 'publicação') : (p.tipo || 'Prazo'))) + '"><button type="button" class="pb-combo-b" id="pbCatBtn" data-pbd="catalogo" aria-label="Escolher uma peça cadastrada" aria-expanded="false" title="Escolher uma peça cadastrada">▾</button></div><div class="pb-cat" id="pbCatBox" hidden></div></div>' +
      '<div class="pb-dois"><div class="field"><label class="field-label" for="pbf_dias">Dias</label><input type="number" id="pbf_dias" min="1" max="365" inputmode="numeric" value="' + (usaPc ? pcSel.dias : (sug ? sug.dias : 15)) + '"></div><div class="field"><label class="field-label" for="pbf_tipo">Contagem</label><select id="pbf_tipo" class="filter-select"><option value="uteis"' + ((usaPc ? pcSel.contagem === 'uteis' : (!sug || sug.tipo === 'uteis')) ? ' selected' : '') + '>dias úteis</option><option value="corridos"' + ((usaPc ? pcSel.contagem === 'corridos' : (sug && sug.tipo === 'corridos')) ? ' selected' : '') + '>dias corridos</option></select></div></div>' +
      ((pc && pc.instancia === 'juizado') ? '' : '<div class="field"><label class="field-label" for="pbf_dobro">Prazo em dobro?</label><select id="pbf_dobro" class="filter-select" style="width:100%"><option value="">Não</option><option value="fazenda"' + (((typeof stp.dobro === 'string') ? stp.dobro : (pc ? pc.dobro : '')) === 'fazenda' ? ' selected' : '') + '>Sim: Fazenda Pública, Ministério Público ou Defensoria (CPC 180, 183 e 186)</option><option value="litis"' + (stp.dobro === 'litis' ? ' selected' : '') + '>Sim: litisconsortes com advogados de escritórios diferentes (CPC 229; não vale em processo eletrônico, §2º)</option></select></div>') +
      '<div class="pb-calc" id="pbCalc"></div><button type="button" class="btn-text" data-pbd="manual">Corrigir a data manualmente</button><div class="field" id="pbManualBox" style="display:none;"><label class="field-label" for="pbf_manual">Data do vencimento (substitui o cálculo)</label><input type="date" id="pbf_manual"></div>' +
      '<div class="field" id="esResp_agendapub"></div>' +
      '<div class="pb-aviso">O app só sugere. Confira a contagem (data da publicação, feriados, suspensões e o tipo de prazo) antes de confirmar. Nada entra na Central de atenção sem o seu OK.</div><div class="form-error" id="pbErro"></div>' +
      '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-pbd="confirmar">Confirmar prazo</button>' + (!p.semPrazo ? '<button type="button" class="btn btn-ghost pb-b" data-pbd="naoe">Não é prazo</button>' : '') + '</div>';
  }
  h += '</div>';
  var au = pbAudDe(p);
  if (au){
    var naAg = pbAudNaAgenda(p, au);
    h += '<div class="pb-sec pb-ia"><div class="pb-sec-t">🗓 Audiência no texto</div><div class="pb-frase">“…' + escapeHtml(au.frase) + '…”</div><div class="pb-lin"><span>Data e hora</span><b>' + escapeHtml(fmtData(au.data) + (au.hora ? ' às ' + au.hora : ' (hora não encontrada)')) + '</b></div>' + (au.tipo ? '<div class="pb-lin"><span>Tipo</span><b>' + escapeHtml(au.tipo) + '</b></div>' : '') + (au.modalidade ? '<div class="pb-lin"><span>Modalidade</span><b>' + escapeHtml(au.modalidade === 'online' ? 'Online' : 'Presencial') + '</b></div>' : '') + (au.link ? '<div class="pb-lin"><span>Link</span><b style="overflow-wrap:anywhere">' + escapeHtml(au.link) + '</b></div>' : '') +
      (naAg ? '<div class="saldo-data">✓ Esta audiência já está na Agenda.</div>' : '<div class="pb-acts"><button type="button" class="btn btn-primary pb-b" data-pbd="aud">Criar audiência na Agenda</button></div><div class="pb-aviso">O app só sugere. Confira data, hora e local no texto antes de salvar.</div>') + '</div>';
  }
  c.innerHTML = h;
  try{ if (qs('esResp_agendapub')){ if (esS.respPubId !== p.id){ var sg = agChavesProcesso(p.numero || p.processo), me = esMinhasChaves(); esRespIniciarAg('agendapub', sg.length ? sg : (me.length ? [me[0]] : []), sg.length ? 'proc' : 'eu'); esS.respPubId = p.id; } else esRespDesenhar('agendapub'); } }catch(e){ console.error('responsáveis do prazo', e); }
  var vp = qs('pbVerPrazo'); if (vp) vp.addEventListener('click', function(){ qs('overlayPb').classList.remove('show'); agAbrir('a:' + pz.id); });
  if (!pz) pbAtualizarCalculo();
}
function pbMult(){ var d = qs('pbf_dobro'); return d && d.value ? 2 : 1; }
function pbAtualizarCalculo(){
  var p = pbPub(pbDetId), el = qs('pbCalc'); if (!p || !el) return;
  var dias = parseInt(qs('pbf_dias').value, 10), tipo = qs('pbf_tipo').value;
  if (!dias || dias < 1){ el.innerHTML = '<span class="saldo-data">Informe os dias.</span>'; return; }
  var mult = pbMult(), r = pbCalcular(p.data, dias * mult, tipo), fora = p.tribunal && p.tribunal !== 'TJGO';
  el.innerHTML = (mult > 1 ? '<div class="pb-lin"><span>Prazo em dobro</span><b>' + dias + ' × 2 = ' + dias * 2 + ' dias</b></div>' : '') + '<div class="pb-lin"><span>Disponibilizada</span><b>' + fmtData(p.data) + '</b></div><div class="pb-lin"><span>Considerada publicada</span><b>' + fmtData(r.pub) + '</b></div><div class="pb-lin"><span>Começa a contar</span><b>' + fmtData(r.ini) + '</b></div><div class="pb-lin pb-venc"><span>Vence em</span><b>' + fmtData(r.venc) + ' <small>(' + pbDiaSem(r.venc) + ')</small></b></div>' +
    (r.obs.length ? '<div class="pb-obs">Atenção: ' + escapeHtml(r.obs.join('; ')) + ' no período. Se o expediente foi suspenso, o prazo pode terminar depois.</div>' : '') +
    '<div class="saldo-data">Calendário: feriados do TJGO' + (Number(r.venc.slice(0, 4)) === 2026 ? ' 2026 (lista oficial)' : ' (regra geral; confira a lista do ano)') + '; recesso de 20/12 a 20/01 não conta.' + (fora ? ' Esta publicação é do ' + escapeHtml(p.tribunal) + ': confira o calendário desse tribunal.' : '') + '</div>';
}
function pbSalvarPrazo(){
  var p = pbPub(pbDetId); if (!p) return;
  var dias = parseInt(qs('pbf_dias').value, 10), tipo = qs('pbf_tipo').value, desc = qs('pbf_desc').value.trim(), manual = qs('pbf_manual').value, err = qs('pbErro');
  if (!dias || dias < 1){ err.textContent = 'Informe os dias do prazo.'; return; }
  if (!desc){ err.textContent = 'Escreva uma descrição.'; return; }
  var mult = pbMult(), r = pbCalcular(p.data, dias * mult, tipo), venc = manual || r.venc, v = pbVinculo(p.processo), trab = '', psel = pbPecaSel(p), pcz = pbPecasDe(p);
  var auto = agAntesUteis(venc, 2); if (auto >= todayISO() && auto < venc) trab = auto;
  var pcMostrado = pbPecasDe(p);
  agCriar({ tipo: 'prazo', titulo: desc, processo: p.numero || p.processo, cliente: pbNomeParte(p, v), data: venc, hora: '', trabalhar: trab, situacao: 'afazer', concluido: false, avisos: [5, 2, 1, 0], resp: esRespChaves('agendapub'), pubId: p.id, calculo: manual ? undefined : r.op, dias: dias * mult, diasBase: dias, dobro: mult > 1 ? qs('pbf_dobro').value : '', contagem: tipo, disp: p.data, inicio: r.ini, manual: !!manual, tribunal: p.tribunal || '',
    peca: psel ? psel.peca : '', pecaId: psel ? psel.rid : '', pecaBase: psel ? psel.base : '', pecaOrigem: psel && psel.peca === desc ? (psel.rid === 'catalogo' ? 'escolhida' : 'sugerida') : (psel ? 'ajustada' : 'manual'), natureza: pcz ? pcz.natureza : '', criadoEm: new Date().toISOString() }).then(function(){
    pbMarcar(pbMembros(p).map(function(x){ return x.id; }), { lida: true, semPrazo: false });
    try{ pbRegistrarEscolha(p, pcMostrado, psel, desc, dias, tipo); }catch(e){ console.error('aprendizado', e); }
    qs('overlayPb').classList.remove('show'); toast('Prazo confirmado para ' + fmtData(venc) + '. Está na Agenda.');
  }).catch(function(e){ err.textContent = 'Não consegui salvar: ' + e.message; });
}

/* ---------- OABs monitoradas ---------- */
function pbMontarOabs(){
  if (qs('overlayPbOab')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayPbOab';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>OABs monitoradas</h2><button class="icon-btn" id="pboX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="pboCorpo"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#pboX'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-pbo]') : null; if (!b) return;
    var a = b.getAttribute('data-pbo'), i = parseInt(b.getAttribute('data-i'), 10);
    pbLerOabs();
    if (a === 'remover'){ pbEdOabs.splice(i, 1); pbDesenharOabs(); }
    else if (a === 'novo'){
      var nome = qs('pbo_nome').value.trim(), num = qs('pbo_num').value.replace(/\D/g, ''), uf = qs('pbo_uf').value.trim().toUpperCase();
      if (!num || !/^[A-Z]{2}$/.test(uf)){ qs('pboErro').textContent = 'Informe o número da OAB e a UF (duas letras).'; return; }
      if (pbEdOabs.some(function(o){ return o.numero === num && o.uf === uf; })){ qs('pboErro').textContent = 'Esta OAB já está na lista.'; return; }
      pbEdOabs.push({ id: '', nome: nome || ('OAB ' + num + '/' + uf), numero: num, uf: uf, ativo: true, escopo: qs('pbo_esc').value, avisar: qs('pbo_av').checked }); pbDesenharOabs();
    }
    else if (a === 'salvar') pbSalvarOabs();
  });
}
function pbAbrirOabs(){ pbMontarOabs(); pbEdOabs = JSON.parse(JSON.stringify(pbS.oabs)); pbDesenharOabs(); qs('overlayPbOab').classList.add('show'); }
function pbLerOabs(){
  pbEdOabs.forEach(function(o, i){
    var a = qs('pbo_at' + i), e = qs('pbo_es' + i), v = qs('pbo_av' + i), n = qs('pbo_nm' + i);
    if (a) o.ativo = a.checked; if (e) o.escopo = e.value; if (v) o.avisar = v.checked; if (n) o.nome = n.value.trim() || o.nome;
  });
}
function pbDesenharOabs(){
  var c = qs('pboCorpo'); if (!c) return;
  var h = '<div class="parcela-sum">O app lê o Diário Oficial de <b>cada OAB abaixo</b> todo dia às <b>10:00</b>. Use para o seu número e para o de advogados com processos em conjunto (sócio, parceiro).</div>';
  h += pbEdOabs.map(function(o, i){
    return '<div class="pb-oab"><div class="pb-oab-top"><div class="field" style="flex:1"><label class="field-label" for="pbo_nm' + i + '">Nome</label><input type="text" id="pbo_nm' + i + '" maxlength="60" value="' + escapeHtml(o.nome) + '"></div><div class="pb-oab-n"><b>OAB ' + escapeHtml(o.numero + '/' + o.uf) + '</b>' + (o.principal ? '<span class="pb-tg ok">principal</span>' : '') + '</div></div>' +
      '<label class="ad-it" style="border:0;padding:4px 0;"><input type="checkbox" id="pbo_at' + i + '"' + (o.ativo ? ' checked' : '') + '><span class="ad-t">Ler esta OAB</span></label>' +
      '<div class="field"><label class="field-label" for="pbo_es' + i + '">Mostrar</label><select id="pbo_es' + i + '" class="filter-select"><option value="tudo"' + (o.escopo === 'tudo' ? ' selected' : '') + '>todas as publicações</option><option value="conjunto"' + (o.escopo === 'conjunto' ? ' selected' : '') + '>só processos em conjunto comigo</option></select></div>' +
      '<label class="ad-it" style="border:0;padding:4px 0;"><input type="checkbox" id="pbo_av' + i + '"' + (o.avisar ? ' checked' : '') + '><span class="ad-t">Avisar no celular quando chegar publicação nova</span></label>' +
      (o.erro ? '<div class="form-error">Última leitura falhou: ' + escapeHtml(o.erro) + '</div>' : '') + (!o.principal ? '<button type="button" class="btn-text" data-pbo="remover" data-i="' + i + '" style="color:var(--urgente)">Remover esta OAB</button>' : '') + '</div>';
  }).join('');
  h += '<div class="pb-oab pb-novo"><div class="pb-sec-t">Adicionar advogado</div><div class="field"><label class="field-label" for="pbo_nome">Nome (para você identificar)</label><input type="text" id="pbo_nome" maxlength="60" placeholder="Ex.: Murilo, sócio"></div>' +
    '<div class="pb-dois"><div class="field"><label class="field-label" for="pbo_num">Número da OAB</label><input type="text" id="pbo_num" inputmode="numeric" maxlength="7" placeholder="49308"></div><div class="field"><label class="field-label" for="pbo_uf">UF</label><input type="text" id="pbo_uf" maxlength="2" value="GO" style="text-transform:uppercase"></div></div>' +
    '<div class="field"><label class="field-label" for="pbo_esc">Mostrar</label><select id="pbo_esc" class="filter-select"><option value="conjunto">só processos em conjunto comigo</option><option value="tudo">todas as publicações</option></select></div>' +
    '<label class="ad-it" style="border:0;padding:4px 0;"><input type="checkbox" id="pbo_av" checked><span class="ad-t">Avisar no celular</span></label><button type="button" class="btn btn-ghost" data-pbo="novo" style="width:100%;justify-content:center;">Adicionar à lista</button></div>' +
    '<div class="form-error" id="pboErro"></div><button type="button" class="btn btn-primary" data-pbo="salvar" style="width:100%;justify-content:center;">Salvar e buscar agora</button>';
  c.innerHTML = h;
}
function pbSalvarOabs(){
  var b = document.querySelector('[data-pbo="salvar"]'); b.disabled = true; b.textContent = 'Salvando…';
  pbApi('/api/djen/oabs', 'PUT', { oabs: pbEdOabs }).then(function(r){
    pbS.oabs = r.oabs; qs('overlayPbOab').classList.remove('show'); toast('OABs salvas. Buscando no Diário Oficial…'); return pbBuscarAgora();
  }).catch(function(e){ qs('pboErro').textContent = e.message; b.disabled = false; b.textContent = 'Salvar e buscar agora'; });
}

/* a tela é desenhada várias vezes olhando o mapa de processos: monta uma vez por desenho */
(function(){
  var o1 = pbRender, o2 = pbRenderLista;
  pbRender = function(){ var a = arguments; return prComMemo(function(){ return o1.apply(null, a); }); };
  pbRenderLista = function(){ var a = arguments; return prComMemo(function(){ return o2.apply(null, a); }); };
})();

/* só para os testes automáticos alcançarem o cálculo de prazos */
window.__horusTeste = { abrirEdicao: function(id){ abrirEdicao(id); }, marcarParcela: function(id, num, pago){ var c = casos.filter(function(x){ return x.id === id; })[0]; return persistPatch(c, { parcelas: c.parcelas.map(function(p){ return p.numero === num ? Object.assign({}, p, { pago: !!pago, dataRecebimento: pago ? todayISO() : null }) : p; }) }); }, mudarStatusCaso: function(id, st){ return mudarStatusCaso(id, st); }, cliNivel: function(a, b){ return cliNivel(a, b); }, agItens: function(){ return agItens(); }, agNomeFeriado: function(d){ return agNomeFeriado(d); }, pbCalcular: pbCalcular, pbFeriadosGeral: pbFeriadosGeral, pbPascoa: pbPascoa, pbNaoUtil: pbNaoUtil, feriados2026: PB_FERIADOS_2026, ntResumo: function(){ return ntResumo(); }, fmtData: function(d){ return fmtData(d); }, prAbrirNovo: function(pre){ return prAbrirNovo(pre); }, pbRender: function(){ return pbRender(); }, prMapa: function(){ return prMapa(); }, prRenderLista: function(){ return prRenderLista(); }, agRender: function(){ return agRender(); }, prIniciaisPend: function(arq){ return prIniciaisPend(!!arq).map(function(c){ return c.id; }); } };

/* ---------- estilo e partida ---------- */
(function(){
  var st = document.createElement('style');
  st.textContent = '.pb-hero{margin-top:0}.pb-filtros{display:flex;flex-direction:column;gap:8px}.pb-filtros select,.pb-oab select,.pb-sec select{width:100%}.pb-lista{display:flex;flex-direction:column;gap:14px}' +
    '.pb-seg-lin{display:flex;gap:8px;align-items:center}.pb-seg-lin .segmented{flex:1;min-width:0;flex-wrap:nowrap}.pb-seg-lin .seg-btn{flex:1;justify-content:center;white-space:nowrap;padding-left:6px;padding-right:6px}.pb-funil{position:relative;width:46px;height:46px;padding:0;justify-content:center;flex:none}.pb-funil.ativo{border-color:var(--accent);color:var(--accent)}.pb-n{position:absolute;top:-6px;right:-6px;background:var(--urgente);color:#fff;font-style:normal;font-size:var(--t1);font-weight:700;min-width:18px;height:18px;border-radius:99px;display:grid;place-items:center;padding:0 5px}' +
    '.pb-painel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:12px}.pb-resfiltro{padding:0 4px}' +
    '.pb-dia{font-size:var(--t2);font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.5px;margin:6px 4px 0}.pb-todas{text-align:right}' +
    '.pb-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:12px 14px 12px 17px;position:relative;overflow:hidden;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,.06))}' +
    '.pb-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--pb-bar,#C4C4CB)}.pb-card.dec{--pb-bar:var(--urgente)}.pb-card.ato{--pb-bar:var(--tutela)}.pb-card.lida{opacity:.62}' +
    '.pb-l1{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:var(--t2);color:var(--ink-soft);font-weight:600}.pb-l1>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.pb-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--info);margin-right:6px}' +
    '.pb-tipo{font-weight:700;font-size:var(--t1);padding:2px 9px;border-radius:99px;background:var(--surface-2);color:var(--ink-soft);white-space:nowrap}.pb-tipo.dec{background:rgba(217,59,59,.12);color:var(--urgente)}.pb-tipo.ato{background:rgba(183,121,30,.14);color:var(--tutela)}' +
    '.pb-cli{font-size:var(--t5);font-weight:700;margin:6px 0 1px;overflow-wrap:anywhere}.pb-proc{font-size:var(--t2);color:var(--ink-soft);margin-bottom:6px;overflow-wrap:anywhere}.pb-trecho{font-size:var(--t3);line-height:1.4;color:var(--ink)}' +
    '.pb-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.pb-tg{font-size:var(--t1);font-weight:600;padding:3px 9px;border-radius:99px;background:var(--surface-2);color:var(--ink-soft);border:0;font-family:inherit}.pb-tg.ok{background:rgba(23,137,90,.13);color:var(--success)}.pb-tg.nv{background:rgba(42,120,214,.13);color:var(--info)}.pb-tg.pz{background:rgba(183,121,30,.14);color:var(--tutela)}' +
    '.pb-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.pb-b{font-size:var(--t3);padding:8px 12px;min-height:0}' +
    '.pb-prazos{padding:0}.pb-prazos-top{width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;background:none;border:0;padding:12px 16px;cursor:pointer;color:var(--ink);font-family:inherit;font-size:var(--t4)}.pb-prazos-top>span:first-child{display:flex;align-items:center;gap:10px}' +
    '.pb-prazo-lin{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 16px;border-top:1px solid var(--border);cursor:pointer}.pb-prazo-tx{display:flex;flex-direction:column;min-width:0}.pb-prazo-tx b{font-size:var(--t4)}.pb-prazo-tx span{font-size:var(--t2);color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.pb-sec{background:var(--surface-2);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}.pb-sec-t{font-size:var(--t2);font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft)}.pb-ia{background:rgba(237,161,0,.10);border:1px solid rgba(201,133,0,.35)}.pb-ia .pb-sec-t{color:var(--accent)}' +
    '.pb-texto{white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--t3);line-height:1.5;max-height:42vh;overflow-y:auto;background:var(--surface);border-radius:10px;padding:10px 12px}.pb-frase{font-size:var(--t3);line-height:1.45;font-style:italic}' +
    '.pb-mi{display:grid;grid-template-columns:30px minmax(0,1fr);column-gap:8px;align-items:center;width:100%;text-align:left;background:transparent;border:0;border-top:1px solid var(--border);padding:11px 2px;font-family:inherit;font-size:var(--t4);font-weight:600;color:var(--ink);cursor:pointer}.pb-mi:first-child{border-top:0}.pb-mi small{grid-column:2;font-weight:400;font-size:var(--t2);color:var(--ink-soft)}.pb-mi-i{grid-row:1/3;font-size:20px;text-align:center}.pb-mi:disabled{opacity:.5;cursor:default}.pb-menu{padding-top:4px;padding-bottom:4px}.pb-seg-lin .seg-btn{font-size:var(--t3)}.pb-pc{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;font-family:inherit;font-size:var(--t3);background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:9px 11px;color:var(--ink);cursor:pointer}.pb-pc span{font-size:var(--t2);color:var(--ink-soft)}.pb-pc.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);background:rgba(237,161,0,.10)}' +
    '.pb-dois{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.pb-dois .field{min-width:0}.pb-dois input{width:100%;min-width:0;box-sizing:border-box}.pb-calc{display:flex;flex-direction:column}.pb-lin{display:flex;justify-content:space-between;gap:10px;font-size:var(--t3);padding:6px 0;border-top:1px solid var(--border);color:var(--ink-soft)}.pb-lin b{color:var(--ink)}.pb-lin.pb-venc{font-size:var(--t4)}.pb-lin.pb-venc b{color:var(--urgente)}' +
    '.pb-combo{display:flex;gap:6px;align-items:stretch}.pb-combo input{flex:1;min-width:0}.pb-combo-b{flex:none;width:46px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--ink-soft);font-size:16px;font-weight:800;cursor:pointer}.pb-combo-b:hover{color:var(--ink)}.pb-combo-b[aria-expanded=true]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}' +
    '.pb-cat{background:var(--surface);border:1px solid var(--border);border-radius:14px;margin-top:6px;overflow:hidden}.pb-cat[hidden]{display:none}.pb-cat-busca{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid var(--border);padding:10px 12px;font:inherit;font-size:var(--t3);background:transparent;color:var(--ink)}.pb-cat-lista{max-height:320px;overflow-y:auto;padding:4px 4px 6px}.pb-cat-g{font-size:var(--t1);font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-soft);padding:8px 10px 2px}.pb-cat-i{display:flex;justify-content:space-between;gap:10px;align-items:baseline;width:100%;text-align:left;background:none;border:0;border-radius:10px;padding:8px 10px;font:inherit;font-size:var(--t3);color:var(--ink);cursor:pointer}.pb-cat-i small{color:var(--ink-soft);font-size:var(--t1);text-align:right}.pb-cat-i:hover{background:var(--surface-2)}' +
    '.pb-obs{font-size:var(--t2);color:var(--tutela);line-height:1.4;margin-top:6px}.pb-aviso{font-size:var(--t2);color:var(--ink-soft);line-height:1.4}.pb-prazo-ok b{font-size:var(--t7)}' +
    '.pb-oab{background:var(--surface-2);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}.pb-oab-top{display:flex;gap:10px;align-items:flex-end}.pb-oab-n{display:flex;flex-direction:column;align-items:flex-end;gap:4px;padding-bottom:6px;font-size:var(--t3)}';
  document.head.appendChild(st);
  if (window.__SERVIDOR){
    pbCarregar(true).then(pbLeituraAutomatica); pbCarregarAprend();
    document.addEventListener('visibilitychange', function(){ if (!document.hidden){ pbCarregar(true).then(pbLeituraAutomatica); } });
  }
})();
