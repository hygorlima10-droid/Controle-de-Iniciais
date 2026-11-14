/* ============================================================
   PEÇA PADRÃO DO MÓDULO (prefixo md) — Fase 2, etapa 2.2
   - sub-abas iguais em todos os módulos (a escolhida fica em destaque; o app lembra a última usada em cada módulo)
   - sub-aba "Resumo": indicadores clicáveis + gráficos + "precisa de atenção"; cada número abre a lista que o forma
   - sub-aba "Recebimentos": as parcelas (a receber, vencidas, recebidas no mês)
   - NENHUMA fórmula nova: os números vêm de computeStats/computeStatsAcordos/computeStatsAlvaras,
     listarUnidades, restanteMeu e recebidoMesMeu (os mesmos cálculos das telas de hoje)
   - os gráficos são SVG desenhados aqui (sem biblioteca externa; funcionam sem internet)
   - nesta etapa: Iniciais, Acordos e Alvarás; os demais módulos entram na 2.3 e 2.4
   ============================================================ */
var MD_DEF = {
  peticoes: { head: 'headPeticoes', body: 'bodyPeticoes', docTipo: 'caso', abas: [['resumo', 'Resumo'], ['quadro', 'Quadro'], ['lista', 'Lista'], ['receb', 'Recebimentos']] },
  acordos:  { head: 'headAcordos',  body: 'bodyAcordos',  docTipo: 'acordo', abas: [['resumo', 'Resumo'], ['lista', 'Lista'], ['receb', 'Recebimentos']] },
  alvaras:  { head: 'headAlvaras',  body: 'bodyAlvaras',  docTipo: 'alvara', abas: [['resumo', 'Resumo'], ['fases', 'Fases'], ['lista', 'Lista'], ['receb', 'Recebimentos']] }
};
var MD_COR = { ouro: '#C98500', verde: '#17895A', verm: '#D93B3B', azul: '#2A78D6', roxo: '#8B5CF6', cinza: '#8A93AD' };
var MD_CHAVE = 'horus.subaba.v1';
var mdS = { sub: {}, per: 6, rec: {}, sel: {}, expN: {}, lido: false };

/* ---------- memória da última sub-aba (por módulo, neste aparelho) ---------- */
function mdLer(){
  if (mdS.lido) return; mdS.lido = true;
  try{ var o = JSON.parse(localStorage.getItem(MD_CHAVE) || '{}'); if (o && typeof o === 'object'){ mdS.sub = o.sub || {}; if (o.per === 12 || o.per === 6) mdS.per = o.per; } }catch(e){}
}
function mdGravar(){ try{ localStorage.setItem(MD_CHAVE, JSON.stringify({ sub: mdS.sub, per: mdS.per })); }catch(e){} }
/* sub-abas do módulo: quem não tem "Ver totais" fica sem "Resumo" e "Recebimentos" (são os totais e gráficos de honorários) */
function mdAbasDe(mod){
  var d = MD_DEF[mod]; if (!d) return [];
  var sem = (typeof ppVerTotais === 'function') && !ppVerTotais();
  return sem ? d.abas.filter(function(a){ return a[0] !== 'resumo' && a[0] !== 'receb'; }) : d.abas;
}
function mdSubAtual(mod){
  mdLer();
  var d = MD_DEF[mod], s = mdS.sub[mod], abas = mdAbasDe(mod);
  return d && abas.some(function(a){ return a[0] === s; }) ? s : (abas[0] ? abas[0][0] : 'resumo');
}
/* troca a sub-aba; "lembrar" = foi o usuário que escolheu (fica gravado para a próxima vez) */
function mdIrSub(mod, sub, lembrar){
  mdLer(); mdS.sub[mod] = sub; if (lembrar !== false) mdGravar();
  mdRedesenhar(mod);
}
function mdRedesenhar(mod){
  if (mod === 'peticoes') render(); else if (mod === 'acordos') renderAcordos(); else if (mod === 'alvaras') renderAlvaras();
  else if (mod === 'processos') prRender(); else if (mod === 'publicacoes') pbRender(); else if (mod === 'agenda') agRender(); else if (mod === 'clientes') renderClientes();
}
/* para os módulos que montam a própria tela (Processos, Publicações, Agenda, Clientes): eles guardam a sub-aba no próprio estado
   e só usam a memória (mdInicial na primeira vez, mdLembrar quando o usuário troca) e o desenho da barra (mdBarraHtml) */
function mdInicial(mod, validos){ mdLer(); var s0 = mdS.sub[mod]; return validos.indexOf(s0) >= 0 ? s0 : 'resumo'; }
function mdLembrar(mod, sub){ mdLer(); mdS.sub[mod] = sub; mdGravar(); }
function mdBarraHtml(abas, atual, attrs){
  mdCss();
  return '<div class="md-abas" role="tablist" aria-label="Sub-abas">' + abas.map(function(a){ return '<button type="button" role="tab" ' + attrs(a[0]) + ' aria-selected="' + (a[0] === atual) + '" class="' + (a[0] === atual ? 'on' : '') + '">' + a[1] + (a[2] ? ' <b class="md-n">' + a[2] + '</b>' : '') + '</button>'; }).join('') + '</div>';
}

/* ---------- visual ---------- */
function mdCss(){
  if (document.getElementById('mdCss')) return;
  var st = document.createElement('style'); st.id = 'mdCss';
  st.textContent =
    '.md-abas{display:flex;gap:4px;overflow-x:auto;overflow-y:hidden;overscroll-behavior:contain;padding-bottom:1px;scrollbar-width:none;-webkit-overflow-scrolling:touch;border-bottom:1px solid var(--border);margin:0 0 12px}.md-abas::-webkit-scrollbar{display:none}' +
    '.md-abas button{flex:none;appearance:none;background:none;border:0;border-bottom:3px solid transparent;padding:10px 14px 9px;font:inherit;font-size:var(--t3);font-weight:700;color:var(--ink-soft);white-space:nowrap;cursor:pointer;margin-bottom:-1px;border-radius:8px 8px 0 0}' +
    '.md-abas button:hover{color:var(--ink)}.md-abas button.on{color:var(--ink);border-bottom-color:#C98500}' +
    '.md-abas button:focus-visible{outline:2px solid var(--accent-2);outline-offset:-2px}' +
    '.md-abas .md-n{display:inline-block;min-width:18px;padding:1px 6px;border-radius:99px;background:rgba(217,59,59,.14);color:var(--urgente,#D93B3B);font-size:11px;font-weight:800;text-align:center;margin-left:2px}' +
    '.ini-acoes.md-um{display:flex!important;justify-content:flex-end;margin:0 0 10px;gap:8px}.ini-acoes.md-um .acao{flex:none;flex-direction:row;align-items:center;gap:8px;padding:9px 16px;min-height:0;height:auto;width:auto;border-radius:12px;font-size:var(--t3)}.ini-acoes.md-um .acao svg{width:18px;height:18px;margin:0}' +
    '#segPeticaoView,#segAlvaraView{display:none!important}' +
    '[data-md] > .rs-wrap{display:none!important}' +
    '[data-md="resumo"] > .alvara-view-bar,[data-md="resumo"] > .filters,[data-md="receb"] > .alvara-view-bar,[data-md="receb"] > .filters,[data-md="lista"] > .alvara-view-bar{display:none!important}' +
    '[data-md="resumo"] > .kanban-wrap,[data-md="resumo"] > .list,[data-md="receb"] > .kanban-wrap,[data-md="receb"] > .list{display:none!important}' +
    '.md-painel:empty{display:none}' +
    '.md-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:10px}.md-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}' +
    '@media(max-width:999px){.md-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:699px){.md-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.md-grid{grid-template-columns:minmax(0,1fr)}}' +
    '.md-card{background:var(--surface);border-radius:18px;padding:13px 14px;box-shadow:0 1px 3px rgba(0,0,0,.06),0 8px 22px rgba(10,10,12,.04);min-width:0;text-align:left;color:var(--ink);font:inherit;border:0;display:block;width:100%}' +
    'button.md-card{cursor:pointer;transition:transform .12s,box-shadow .12s}button.md-card:hover{transform:translateY(-1px);box-shadow:0 2px 5px rgba(0,0,0,.08),0 12px 26px rgba(10,10,12,.07)}button.md-card:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px}' +
    '.md-h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:7px;min-height:26px}.md-k{display:flex;align-items:center;gap:7px;font-size:var(--t1);font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);line-height:1.25;min-width:0}' +
    '.md-seta{color:var(--accent);font-weight:800;flex:none}.md-link{appearance:none;background:none;border:0;padding:0;font:inherit;font-size:var(--t2);font-weight:700;color:var(--accent);white-space:nowrap;cursor:pointer}.md-link:hover{text-decoration:underline}' +
    '.md-v{display:block;font-size:clamp(1.02rem,4.6vw,1.28rem);font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.md-v.neg{color:var(--urgente,#D93B3B)}.md-v.ok{color:var(--success,#17895A)}' +
    '.md-foot{font-size:var(--t1);color:var(--ink-soft);margin-top:4px;line-height:1.35}.md-foot .fv-chip{font-size:var(--t1)}' +
    '.md-per{display:inline-flex;background:var(--surface-2);border-radius:10px;padding:3px;margin-bottom:6px}.md-per button{appearance:none;border:0;background:none;font:inherit;font-size:var(--t1);font-weight:700;padding:4px 10px;border-radius:8px;color:var(--ink-soft);cursor:pointer}.md-per button.on{background:var(--surface);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.1)}' +
    '.md-svg{display:block;width:100%;height:auto;overflow:visible}.md-svg .gr{stroke:var(--border)}.md-svg text{fill:var(--ink-soft);font-family:inherit}.md-svg .alvo{cursor:pointer}.md-svg .tipbg{fill:var(--ink)}.md-svg .tip1{fill:var(--surface);opacity:.75}.md-svg .tip2{fill:var(--surface);font-weight:800}' +
    '.md-leg{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;font-size:var(--t1);color:var(--ink-soft);margin-top:4px}.md-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}' +
    '.md-fase{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(40px,1fr) auto;gap:8px;align-items:center;width:100%;appearance:none;border:0;background:none;font:inherit;font-size:var(--t2);color:var(--ink);text-align:left;padding:7px 8px;margin:1px -8px;border-radius:10px;cursor:pointer;box-sizing:content-box}' +
    '.md-fase:hover{background:rgba(201,133,0,.10)}.md-fase span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.md-fase .tr{height:9px;border-radius:99px;background:var(--surface-2);overflow:hidden}.md-fase .tr i{display:block;height:100%;border-radius:99px}.md-fase b{font-variant-numeric:tabular-nums;text-align:right;min-width:18px}' +
    '.md-at{display:flex;align-items:center;gap:10px;width:100%;appearance:none;border:0;border-top:1px solid var(--border);background:none;font:inherit;color:var(--ink);text-align:left;padding:8px 0;cursor:pointer}.md-at:first-of-type{border-top:0}.md-at .tx{flex:1;min-width:0}.md-at .tx b{display:block;font-size:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.md-at .tx span{font-size:var(--t1);color:var(--ink-soft)}.md-at .vl{font-size:var(--t3);font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}.md-at .vl.neg{color:var(--urgente,#D93B3B)}' +
    '@media(min-width:1000px){.md-larga{grid-column:1/-1}.md-larga .md-ats{display:grid;grid-template-columns:1fr 1fr;column-gap:26px}.md-larga .md-at:nth-of-type(2){border-top:0}}' +
    '.md-vazio{font-size:var(--t2);color:var(--ink-soft);padding:14px 0;text-align:center}' +
    '.md-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:10px}.md-chips::-webkit-scrollbar{display:none}.md-chips button{flex:none;appearance:none;border:1px solid var(--border);background:var(--surface);color:var(--ink-soft);font:inherit;font-size:var(--t2);font-weight:700;padding:7px 12px;border-radius:99px;cursor:pointer;white-space:nowrap}.md-chips button.on{background:var(--ink);color:var(--surface);border-color:var(--ink)}.md-chips button b{font-weight:800;margin-left:4px}' +
    '.md-tot{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin:0 2px 8px;font-size:var(--t2);color:var(--ink-soft)}.md-tot b{font-size:var(--t5);color:var(--ink);font-variant-numeric:tabular-nums}' +
    '.md-lin{display:flex;align-items:center;gap:11px;width:100%;appearance:none;border:0;background:var(--surface);font:inherit;color:var(--ink);text-align:left;padding:10px 13px;border-radius:14px;margin-bottom:6px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.05)}.md-lin:hover{box-shadow:0 2px 8px rgba(0,0,0,.09)}' +
    '.md-dt{flex:none;width:42px;height:42px;border-radius:12px;background:var(--surface-2);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}.md-dt b{font-size:var(--t4);font-weight:800}.md-dt span{font-size:10px;text-transform:uppercase;color:var(--ink-soft);margin-top:2px}.md-dt.neg{background:rgba(217,59,59,.12);color:var(--urgente,#D93B3B)}.md-dt.neg span{color:inherit}.md-dt.ok{background:rgba(23,137,90,.13);color:var(--success,#17895A)}.md-dt.ok span{color:inherit}' +
    '.md-lin .tx{flex:1;min-width:0}.md-lin .tx b{display:block;font-size:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.md-lin .tx span{display:block;font-size:var(--t1);color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.md-lin .dr{text-align:right;flex:none}.md-lin .dr b{display:block;font-size:var(--t3);font-variant-numeric:tabular-nums}.md-lin .dr .fv-chip{font-size:10px;margin-top:3px}';
  document.head.appendChild(st);
}
function mdIc(lucide, cor){ return '<span class="ct-ic sm" style="background:' + cor + '" aria-hidden="true"><svg viewBox="0 0 24 24">' + icMiolo(lucide) + '</svg></span>'; }
function mdMesCurto(ym){ var n = Number(String(ym).slice(5, 7)) - 1, s = MES_CURTO_AT[n] || ''; return s.charAt(0).toUpperCase() + s.slice(1); }
function mdMesAno(ym){ return mdMesCurto(ym) + '/' + String(ym).slice(2, 4); }
function mdMeses(n){ var out = []; for (var k = n - 1; k >= 0; k--) out.push(deslocarMes(mesSelecionado, -k)); return out; }
function mdCompacto(v){
  if (discreto) return '•••';
  v = Number(v) || 0;
  if (Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
}

/* ---------- gráficos (SVG) ---------- */
/* barras em pares; por padrão cada grupo é um mês. Opções: sel (grupo em destaque, com balão), ca/cb (cores), ra/rb (rótulos do balão),
   fmt (formato dos números: sem ele é dinheiro e o gráfico some no modo discreto), rot(i)/tit(i) (rótulo curto e título de cada grupo, quando não é mês),
   proj (true = previsão: barras vazadas e tracejadas) */
function mdOculto(){ return '<div class="md-vazio">Gráfico oculto no modo discreto (o tamanho das barras mostraria os valores).</div>'; }
function mdBarras(meses, a, b, o){
  if (discreto && !o.fmt) return mdOculto();
  var w = 330, h = 168, px = 6, py = 46, W = w - px * 2, H = h - py - 22, n = meses.length, gw = W / n, bw = Math.min(16, gw * 0.3);
  var rot = o.rot || function(i){ return n > 6 ? mdMesCurto(meses[i]).charAt(0) : mdMesCurto(meses[i]); }, tit = o.tit || function(i){ return mdMesAno(meses[i]); };
  var max = Math.max.apply(null, a.concat(b).concat([0])) * 1.1 || 1, s = '<svg class="md-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + escapeHtml(o.titulo || '') + '">';
  for (var k = 0; k < 4; k++){ var yy = py + (H * k) / 3; s += '<line class="gr" x1="' + px + '" x2="' + (w - px) + '" y1="' + yy + '" y2="' + yy + '"/>'; }
  var barra = function(x, v, cor, dim){
    var hh = Math.max(v > 0 ? 2 : 0, (Math.max(v, 0) / max) * H);
    return '<rect x="' + x + '" y="' + (py + H - hh) + '" width="' + bw + '" height="' + hh + '" rx="3.5" ' + (o.proj ? 'fill="' + cor + '" fill-opacity=".14" stroke="' + cor + '" stroke-width="1.4" stroke-dasharray="4 3"' : 'fill="' + cor + '"') + ' opacity="' + dim + '"/>';
  };
  meses.forEach(function(m, i){
    var cx = px + i * gw + gw / 2, dim = (o.sel != null && o.sel !== i) ? 0.4 : 1;
    s += '<g class="alvo" data-md-mes="' + i + '"><rect x="' + (px + i * gw) + '" y="' + py + '" width="' + gw + '" height="' + (H + 20) + '" fill="transparent"/>' + barra(cx - bw - 1.5, a[i], o.ca, dim) + barra(cx + 1.5, b[i], o.cb, dim) +
      '<text x="' + cx + '" y="' + (h - 6) + '" text-anchor="middle" font-size="' + (n > 6 ? 9 : 10.5) + '"' + (o.sel === i ? ' font-weight="800" style="fill:var(--ink)"' : '') + '>' + escapeHtml(rot(i)) + '</text></g>';
  });
  if (o.sel != null && meses[o.sel] != null){
    var c2 = px + o.sel * gw + gw / 2, tx = Math.min(Math.max(c2, 96), w - 96);
    s += '<rect class="tipbg" x="' + (tx - 94) + '" y="1" width="188" height="38" rx="10"/><text class="tip1" x="' + tx + '" y="16" text-anchor="middle" font-size="10">' + escapeHtml(tit(o.sel) + ' · ' + o.ra + ' ' + (o.fmt || mdCompacto)(a[o.sel])) + '</text><text class="tip2" x="' + tx + '" y="31" text-anchor="middle" font-size="11.5">' + escapeHtml(o.rb + ' ' + (o.fmt || fmtMoeda)(b[o.sel])) + '</text>';
  }
  return s + '</svg>';
}
/* linha com área. Opções: fmt (rótulo de cada ponto; com dinheiro:true o gráfico some no modo discreto), alvo (linha tracejada de meta), id */
function mdLinha(meses, serie, cor, o){
  if (discreto && o.dinheiro) return mdOculto();
  var w = 330, h = 150, px = 20, py = 30, W = w - px * 2, H = h - py - 22, n = serie.length;
  var max = Math.max.apply(null, serie.concat([o.alvo || 0, 1])) * 1.15, min = Math.min.apply(null, serie.concat([0])); if (min < 0) min *= 1.15;
  function X(i){ return px + (n > 1 ? (i * W) / (n - 1) : W / 2); } function Y(v){ return py + H - ((v - min) / (max - min || 1)) * H; }
  var pts = serie.map(function(v, i){ return X(i) + ',' + Y(v); }).join(' '), id = 'mdg' + cor.slice(1) + (o.id || ''), fmt = o.fmt || function(v){ return String(v); };
  var s = '<svg class="md-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + escapeHtml(o.titulo || '') + '"><defs><linearGradient id="' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + cor + '" stop-opacity=".26"/><stop offset="1" stop-color="' + cor + '" stop-opacity="0"/></linearGradient></defs>';
  for (var k = 0; k < 4; k++){ var yy = py + (H * k) / 3; s += '<line class="gr" x1="' + px + '" x2="' + (w - px) + '" y1="' + yy + '" y2="' + yy + '"/>'; }
  if (o.alvo > 0) s += '<line x1="' + px + '" x2="' + (w - px) + '" y1="' + Y(o.alvo) + '" y2="' + Y(o.alvo) + '" stroke="#C98500" stroke-width="1.5" stroke-dasharray="3 4"/><text x="' + (w - px) + '" y="' + (Y(o.alvo) - 4) + '" text-anchor="end" font-size="9.5" font-weight="700" style="fill:#C98500">alvo</text>';
  s += '<polygon points="' + X(0) + ',' + Y(min) + ' ' + pts + ' ' + X(n - 1) + ',' + Y(min) + '" fill="url(#' + id + ')"/><polyline points="' + pts + '" fill="none" stroke="' + cor + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
  serie.forEach(function(v, i){
    s += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="3.4" fill="' + cor + '"/><text x="' + X(i) + '" y="' + (Y(v) - 8) + '" text-anchor="' + (i === 0 && n > 1 ? 'start' : (i === n - 1 && n > 1 ? 'end' : 'middle')) + '" font-size="' + (o.fmt ? 9.5 : 10.5) + '" font-weight="700" style="fill:var(--ink)">' + escapeHtml(fmt(v)) + '</text>' +
      '<text x="' + X(i) + '" y="' + (h - 6) + '" text-anchor="middle" font-size="' + (n > 6 ? 9 : 10.5) + '">' + (n > 6 ? mdMesCurto(meses[i]).charAt(0) : mdMesCurto(meses[i])) + '</text>';
  });
  return s + '</svg>';
}
/* rosca: fatias [rótulo, valor, cor] */
function mdRosca(fatias, centro, sub){
  var tot = fatias.reduce(function(t, x){ return t + x[1]; }, 0), r = 52, c = 2 * Math.PI * r, off = 0;
  var s = '<svg viewBox="0 0 140 140" width="128" height="128" style="flex:none" role="img" aria-label="' + escapeHtml(sub) + '"><circle cx="70" cy="70" r="' + r + '" fill="none" style="stroke:var(--surface-2)" stroke-width="19"/>';
  if (tot > 0) fatias.forEach(function(x){ var len = (x[1] / tot) * c; if (len > 0.5) s += '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + x[2] + '" stroke-width="19" stroke-dasharray="' + Math.max(len - 2, 0.5) + ' ' + c + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 70 70)"/>'; off += len; });
  return s + '<text x="70" y="68" text-anchor="middle" font-size="14" font-weight="800" style="fill:var(--ink)">' + escapeHtml(centro) + '</text><text x="70" y="83" text-anchor="middle" font-size="9" style="fill:var(--ink-soft)">' + escapeHtml(sub) + '</text></svg>';
}

/* ---------- dados (sempre das funções de cálculo que o app já usa) ---------- */
function mdUnidades(mod){
  var dt = MD_DEF[mod].docTipo;
  return listarUnidades().filter(function(u){ return u.docTipo === dt && !(mod === 'peticoes' && u.grupo === 'processo') && !ehObraUn(u); });
}
function mdListas(mod){
  var hoje = todayISO(), us = mdUnidades(mod), aberto = [], vencido = [], recebido = [];
  us.forEach(function(u){
    var r = restanteMeu(u);
    if (r > 0.004){ var it = { u: u, v: r, data: u.data || '', atraso: !!(u.data && u.data < hoje) }; aberto.push(it); if (it.atraso) vencido.push(it); }
    var rm = recebidoMesMeu(u, mesSelecionado);
    if (rm > 0.004) recebido.push({ u: u, v: rm, data: (recebimentosUn(u).filter(function(x){ return String(x.data).slice(0, 7) === mesSelecionado; }).map(function(x){ return x.data; }).sort().pop()) || '', rec: true });
  });
  function ord(a, b){ return (a.data || '9999').localeCompare(b.data || '9999'); }
  aberto.sort(ord); vencido.sort(ord); recebido.sort(function(a, b){ return ord(b, a); });
  return { aberto: aberto, vencido: vencido, recebido: recebido };
}
function mdSoma(l){ return r2(l.reduce(function(t, x){ return t + x.v; }, 0)); }
function mdSeries(mod, meses){
  var us = mdUnidades(mod), rec = [], prev = [], novos = [], contr = [];
  var docs = mod === 'peticoes' ? casos.filter(function(c){ return !c.doProcesso; }) : (mod === 'acordos' ? acordos : alvaras);
  meses.forEach(function(m){
    var r = 0, p = 0, n = 0, ct = 0;
    us.forEach(function(u){ r += recebidoMesMeu(u, m); if (u.data && String(u.data).slice(0, 7) === m) p += meuValor(u, u.valor); });
    docs.forEach(function(d){
      if (String(d.criadoEm || '').slice(0, 7) !== m) return;
      n++;
      if (mod === 'peticoes') ct += ((Number(d.valorHonorarios) || 0) + (Number(d.exito && d.exito.valor) || 0)) * fatorDoc('caso', d);
    });
    rec.push(r2(r)); prev.push(r2(p)); novos.push(n); contr.push(r2(ct));
  });
  return { rec: rec, prev: prev, novos: novos, contr: contr };
}

/* ---------- peças ---------- */
function mdKpi(o){
  return '<button type="button" class="md-card md-kpi" data-md-ir="' + o.ir + '"><div class="md-h"><span class="md-k">' + mdIc(o.ic, o.cor) + '<span>' + o.rot + '</span></span><span class="md-seta" aria-hidden="true">›</span></div>' +
    '<b class="md-v' + (o.cls ? ' ' + o.cls : '') + '">' + o.v + '</b>' + (o.foot ? '<div class="md-foot">' + o.foot + '</div>' : '') + '</button>';
}
function mdCard(rot, corpo, acao){
  return '<div class="md-card"><div class="md-h"><span class="md-k">' + rot + '</span>' + (acao ? '<button type="button" class="md-link" data-md-ir="' + acao[0] + '">' + acao[1] + ' ›</button>' : '') + '</div>' + corpo + '</div>';
}
function mdPer(){ return '<div class="md-per" role="group" aria-label="Período do gráfico"><button type="button" data-md-per="6" class="' + (mdS.per === 6 ? 'on' : '') + '">6 meses</button><button type="button" data-md-per="12" class="' + (mdS.per === 12 ? 'on' : '') + '">12 meses</button></div>'; }
function mdLeg(itens){ return '<div class="md-leg">' + itens.map(function(x){ return '<span><i style="background:' + x[0] + '"></i>' + x[1] + '</span>'; }).join('') + '</div>'; }
function mdFases(itens, vazio){
  var max = Math.max.apply(null, itens.map(function(x){ return x.n; }).concat([1]));
  if (!itens.some(function(x){ return x.n > 0; })) return '<div class="md-vazio">' + vazio + '</div>';
  return itens.map(function(x){ return '<button type="button" class="md-fase" data-md-fase="' + escapeHtml(x.k) + '"><span>' + escapeHtml(x.rot) + '</span><span class="tr"><i style="width:' + Math.round(x.n / max * 100) + '%;background:' + x.cor + '"></i></span><b>' + x.n + '</b></button>'; }).join('') +
    '<div class="md-foot">Toque numa fase para abrir a lista só com ela.</div>';
}
function mdDiasTxt(iso){
  var d = Math.round((new Date(iso + 'T12:00:00') - new Date(todayISO() + 'T12:00:00')) / 86400000);
  if (d < 0) return 'atrasada há ' + (-d) + (d === -1 ? ' dia' : ' dias');
  if (d === 0) return 'vence hoje';
  return 'vence em ' + d + (d === 1 ? ' dia' : ' dias');
}
function mdAtencao(mod, L){
  var hoje = todayISO(), lim = somarDias(hoje, 7), itens = [];
  L.vencido.forEach(function(x){ itens.push({ x: x, cor: MD_COR.verm, ic: 'triangle-alert', neg: true }); });
  L.aberto.forEach(function(x){ if (!x.atraso && x.data && x.data <= lim) itens.push({ x: x, cor: MD_COR.ouro, ic: 'calendar-clock' }); });
  var h = itens.slice(0, 4).map(function(it){
    var u = it.x.u;
    return '<button type="button" class="md-at" data-md-doc="' + escapeHtml(u.docId) + '">' + mdIc(it.ic, it.cor) + '<span class="tx"><b>' + escapeHtml(u.cliente) + '</b><span>' + escapeHtml(u.label + ' · ' + mdDiasTxt(it.x.data)) + '</span></span><span class="vl' + (it.neg ? ' neg' : '') + '">' + fmtMoeda(it.x.v) + '</span></button>';
  }).join('');
  if (mod === 'peticoes'){
    getStalledCases().slice(0, Math.max(0, 4 - Math.min(itens.length, 4)) || (itens.length ? 0 : 3)).forEach(function(p){
      h += '<button type="button" class="md-at" data-md-doc="' + escapeHtml(p.casoId) + '">' + mdIc('file-clock', MD_COR.cinza) + '<span class="tx"><b>' + escapeHtml(p.cliente || 'Sem nome') + '</b><span>' + escapeHtml('parado em “' + (STATUS_LABEL[p.status] || p.status) + '” há ' + p.dias + ' dias') + '</span></span></button>';
    });
  }
  if (!h) h = '<div class="md-vazio">Nada vencido nem vencendo nos próximos 7 dias.</div>';
  var n = itens.length;
  var card = mdCard('Precisa de atenção' + (n ? ' · ' + n : ''), '<div class="md-ats">' + h + '</div>', n > 4 ? ['receb:' + (L.vencido.length ? 'vencido' : 'aberto'), 'ver todas'] : null);
  return mod === 'peticoes' ? card.replace('class="md-card"', 'class="md-card md-larga"') : card;
}

/* ---------- sub-aba Resumo ---------- */
function mdResumo(mod){
  var L = mdListas(mod), meses = mdMeses(mdS.per), S = mdSeries(mod, meses), sel = mdS.sel[mod], h = '', kp = [], g = [];
  if (sel != null && sel >= meses.length) sel = mdS.sel[mod] = null;
  var chipRec = function(v){ return v > 0.004 ? '<span class="fv-chip ok">▲ ' + fmtMoeda(v) + ' em ' + escapeHtml(mdMesAno(mesSelecionado)) + '</span>' : 'nada recebido em ' + escapeHtml(mdMesAno(mesSelecionado)); };
  var arq = function(dt){ var t = 0; listarUnidades().forEach(function(u){ if (u.docTipo === dt && u.arquivado) t += restanteMeu(u); }); return t > 0.004 ? ' · inclui ' + fmtMoeda(t) + ' de arquivados' : ''; };
  if (mod === 'peticoes'){
    var s = computeStats(true), aguard = casoAtivos().filter(function(c){ return statusDe(c) !== 'protocolado'; }).length;
    kp = [{ ir: 'receb:aberto', ic: 'hand-coins', cor: MD_COR.ouro, rot: 'Pendente a receber', v: fmtMoeda(s.pendente), foot: chipRec(s.recebido) + arq('caso') },
      { ir: 'lista', ic: 'file-signature', cor: MD_COR.azul, rot: 'Honorários contratados', v: fmtMoeda(s.total), foot: s.count + (s.count === 1 ? ' caso ativo' : ' casos ativos') },
      { ir: 'receb:vencido', ic: 'triangle-alert', cor: s.vencido > 0.004 ? MD_COR.verm : MD_COR.cinza, rot: 'Vencido', v: fmtMoeda(s.vencido), cls: s.vencido > 0.004 ? 'neg' : '', foot: L.vencido.length ? L.vencido.length + (L.vencido.length === 1 ? ' parcela em atraso' : ' parcelas em atraso') : 'nenhuma parcela em atraso' },
      { ir: 'quadro', ic: 'send', cor: MD_COR.roxo, rot: 'Aguardando protocolo', v: String(aguard), foot: aguard === 1 ? 'caso ainda não protocolado' : 'casos ainda não protocolados' }];
    var ativos = casoAtivos(), cores = [MD_COR.cinza, MD_COR.ouro, MD_COR.azul, MD_COR.verde, MD_COR.roxo, MD_COR.verm];
    g.push(mdCard('Casos por fase', mdFases(STATUS_ORDEM.map(function(k, i){ return { k: k, rot: STATUS_LABEL[k] || k, n: ativos.filter(function(c){ var st = statusDe(c); return (STATUS_ORDEM.indexOf(st) < 0 ? STATUS_ORDEM[0] : st) === k; }).length, cor: cores[i % cores.length] }; }), 'Nenhum caso em andamento.'), ['quadro', 'abrir o quadro']));
    g.push(mdCard('Contratado × recebido', mdPer() + mdBarras(meses, S.contr, S.rec, { sel: sel, ca: MD_COR.ouro, cb: MD_COR.verde, ra: 'contratado', rb: 'recebido', titulo: 'Contratado e recebido por mês' }) + mdLeg([[MD_COR.ouro, 'Contratado no mês'], [MD_COR.verde, 'Recebido no mês']]) + mdDicaMes(sel, meses), ['receb:recebido', 'ver recebimentos']));
    g.push(mdCard('Iniciais cadastradas por mês', mdLinha(meses, S.novos, MD_COR.azul, { id: 'p', titulo: 'Iniciais cadastradas por mês' }) + '<div class="md-foot">' + S.novos.reduce(function(t, x){ return t + x; }, 0) + ' em ' + meses.length + ' meses (inclui concluídas e arquivadas).</div>', ['lista', 'ver a lista']));
  } else if (mod === 'acordos'){
    var sa = computeStatsAcordos();
    kp = [{ ir: 'receb:aberto', ic: 'hand-coins', cor: MD_COR.ouro, rot: 'Pendente a receber', v: fmtMoeda(sa.pendente), foot: chipRec(sa.recebido) + arq('acordo') },
      { ir: 'lista', ic: 'handshake', cor: MD_COR.azul, rot: 'Meus honorários', v: fmtMoeda(sa.total), foot: sa.count + (sa.count === 1 ? ' termo de acordo ativo' : ' termos de acordo ativos') },
      { ir: 'receb:vencido', ic: 'triangle-alert', cor: sa.vencido > 0.004 ? MD_COR.verm : MD_COR.cinza, rot: 'Vencido', v: fmtMoeda(sa.vencido), cls: sa.vencido > 0.004 ? 'neg' : '', foot: L.vencido.length ? L.vencido.length + (L.vencido.length === 1 ? ' parcela em atraso' : ' parcelas em atraso') : 'nenhuma parcela em atraso' },
      { ir: 'receb:recebido', ic: 'check-circle', cor: MD_COR.verde, rot: 'Recebido no mês', v: fmtMoeda(sa.recebido), cls: sa.recebido > 0.004 ? 'ok' : '', foot: L.recebido.length + (L.recebido.length === 1 ? ' recebimento em ' : ' recebimentos em ') + escapeHtml(mdMesAno(mesSelecionado)) }];
    g.push(mdCard('Previsto × recebido', mdPer() + mdBarras(meses, S.prev, S.rec, { sel: sel, ca: MD_COR.ouro, cb: MD_COR.verde, ra: 'previsto', rb: 'recebido', titulo: 'Previsto e recebido por mês' }) + mdLeg([[MD_COR.ouro, 'Vence no mês'], [MD_COR.verde, 'Recebido no mês']]) + mdDicaMes(sel, meses), ['receb:recebido', 'ver recebimentos']));
    g.push(mdSituacao(mod, L));
  } else {
    var sv = computeStatsAlvaras(), prox = L.aberto.filter(function(x){ return !x.atraso && x.data && x.data <= somarDias(todayISO(), 7); }).length;
    kp = [{ ir: 'receb:aberto', ic: 'hand-coins', cor: MD_COR.ouro, rot: 'Pendente a receber', v: fmtMoeda(sv.pendente), foot: chipRec(sv.recebido) + arq('alvara') },
      { ir: 'lista', ic: 'landmark', cor: MD_COR.azul, rot: 'Meus honorários', v: fmtMoeda(sv.total), foot: sv.count + (sv.count === 1 ? ' alvará ativo' : ' alvarás ativos') },
      { ir: 'receb:vencido', ic: 'triangle-alert', cor: sv.atrasado > 0.004 ? MD_COR.verm : MD_COR.cinza, rot: 'Previsão vencida', v: fmtMoeda(sv.atrasado), cls: sv.atrasado > 0.004 ? 'neg' : '', foot: L.vencido.length ? L.vencido.length + (L.vencido.length === 1 ? ' alvará passou da previsão' : ' alvarás passaram da previsão') : 'nenhuma previsão vencida' },
      { ir: 'receb:aberto', ic: 'calendar-clock', cor: MD_COR.roxo, rot: 'Previsão em 7 dias', v: fmtMoeda(sv.prox7), foot: prox + (prox === 1 ? ' alvará previsto' : ' alvarás previstos') }];
    var av = alvaras.filter(function(a){ return !a.arquivado; }), cf = { sem: MD_COR.cinza, protocolada: MD_COR.ouro, aguardando: MD_COR.roxo, expedido: MD_COR.azul, banco: MD_COR.azul, depositado: MD_COR.verde };
    g.push(mdCard('Alvarás por fase', mdFases(['sem'].concat(FASES_ALVARA).filter(function(k, i, l){ return l.indexOf(k) === i; }).map(function(k){ return { k: k, rot: FASE_CURTA[k] || FASE_LABEL[k] || k, n: av.filter(function(a){ return faseDoAlvara(a) === k; }).length, cor: cf[k] || MD_COR.cinza }; }).filter(function(x){ return x.n > 0 || x.k !== 'sem'; }), 'Nenhum alvará cadastrado.'), ['fases', 'abrir as fases']));
    g.push(mdCard('Previsto × recebido', mdPer() + mdBarras(meses, S.prev, S.rec, { sel: sel, ca: MD_COR.ouro, cb: MD_COR.verde, ra: 'previsto', rb: 'recebido', titulo: 'Previsto e recebido por mês' }) + mdLeg([[MD_COR.ouro, 'Previsão no mês'], [MD_COR.verde, 'Recebido no mês']]) + mdDicaMes(sel, meses), ['receb:recebido', 'ver recebimentos']));
  }
  g.push(mdAtencao(mod, L));
  h += '<div class="md-kpis">' + kp.map(mdKpi).join('') + '</div><div class="md-grid">' + g.join('') + '</div>';
  return h;
}
function mdDicaMes(sel, meses){
  return '<div class="md-foot">' + (sel != null && meses[sel] ? 'Toque de novo em <b>' + escapeHtml(mdMesAno(meses[sel])) + '</b> para abrir os recebimentos desse mês.' : 'Toque num mês para ver os valores.') + '</div>';
}
function mdSituacao(mod, L){
  if (discreto) return mdCard('Situação das parcelas', mdOculto());
  var us = mdUnidades(mod), rec = 0;
  us.forEach(function(u){ rec += Math.max(0, meuValor(u, u.valor) - restanteMeu(u)); });
  var venc = mdSoma(L.vencido), aVencer = r2(mdSoma(L.aberto) - venc), tot = r2(rec + venc + aVencer);
  var fat = [['Já recebido', r2(rec), MD_COR.verde, 'receb:recebido'], ['A vencer', aVencer, MD_COR.ouro, 'receb:aberto'], ['Vencido', venc, MD_COR.verm, 'receb:vencido']];
  var corpo = '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:center">' + mdRosca(fat, tot > 0 ? Math.round(rec / tot * 100) + '%' : '–', 'já recebido') + '<div style="flex:1;min-width:170px">' +
    fat.map(function(x){ return '<button type="button" class="md-fase" style="grid-template-columns:minmax(0,1fr) auto" data-md-ir="' + x[3] + '"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + x[2] + ';margin-right:7px"></i>' + x[0] + '</span><b>' + fmtMoeda(x[1]) + '</b></button>'; }).join('') + '</div></div>';
  return mdCard('Situação das parcelas', corpo + '<div class="md-foot">Soma de todos os termos de acordo, incluindo os arquivados que ainda têm valor a receber.</div>');
}

/* ---------- sub-aba Recebimentos ---------- */
function mdReceb(mod){
  var L = mdListas(mod), f = mdS.rec[mod] || 'aberto', lista = L[f] || L.aberto, hoje = todayISO();
  var chips = [['aberto', 'A receber', L.aberto.length], ['vencido', 'Vencidas', L.vencido.length], ['recebido', 'Recebidas em ' + mdMesAno(mesSelecionado), L.recebido.length]];
  var h = '<div class="md-chips" role="group" aria-label="Filtro dos recebimentos">' + chips.map(function(c){ return '<button type="button" data-md-rec="' + c[0] + '" class="' + (f === c[0] ? 'on' : '') + '">' + escapeHtml(c[1]) + '<b>' + c[2] + '</b></button>'; }).join('') + '</div>';
  h += '<div class="md-tot"><span>' + lista.length + (lista.length === 1 ? ' lançamento' : ' lançamentos') + (f === 'recebido' ? ' · troque o mês no topo da tela' : '') + '</span><b>' + fmtMoeda(mdSoma(lista)) + '</b></div>';
  if (!lista.length) return h + '<div class="empty"><strong>' + (f === 'recebido' ? 'Nenhum recebimento neste mês' : (f === 'vencido' ? 'Nada vencido' : 'Nada a receber')) + '</strong>' + (f === 'vencido' ? 'Nenhuma parcela em atraso.' : 'Quando houver, aparece aqui.') + '</div>';
  return h + lista.map(function(x){
    var u = x.u, d = x.data, ok = /^\d{4}-\d{2}-\d{2}$/.test(d), tom = x.rec ? ' ok' : (x.atraso ? ' neg' : '');
    var chip = x.rec ? '<span class="fv-chip ok">recebido</span>' : (ok ? '<span class="fv-chip' + (x.atraso ? ' neg' : (d <= somarDias(hoje, 7) ? ' pend' : '')) + '">' + escapeHtml(mdDiasTxt(d)) + '</span>' : '<span class="fv-chip">sem data</span>');
    return '<button type="button" class="md-lin" data-md-doc="' + escapeHtml(u.docId) + '"><span class="md-dt' + tom + '"><b>' + (ok ? d.slice(8, 10) : '•') + '</b><span>' + (ok ? MES_CURTO_AT[Number(d.slice(5, 7)) - 1] : '') + '</span></span>' +
      '<span class="tx"><b>' + escapeHtml(u.cliente) + '</b><span>' + escapeHtml(u.label + (u.acao && u.docTipo === 'caso' ? ' · ' + u.acao : '') + (u.arquivado ? ' · arquivado' : '') + (u.origem === 'murilo' ? ' · Murilo' : '')) + '</span></span>' +
      '<span class="dr"><b>' + fmtMoeda(x.v) + '</b>' + chip + '</span></button>';
  }).join('');
}

/* ---------- montagem: chamada no começo de render(), renderAcordos() e renderAlvaras() ---------- */
function mdAplicar(mod){
  var d = MD_DEF[mod]; if (!d) return;
  var head = qs(d.head), body = qs(d.body); if (!head || !body) return;
  mdCss();
  var sub = mdSubAtual(mod);
  /* quando outra tela manda abrir um item (busca, Central de atenção, perfil do cliente), ele precisa aparecer: vai para a Lista */
  var conj = mod === 'peticoes' ? expandedIds : (mod === 'acordos' ? expandedAcordoIds : expandedAlvaraIds), n = conj.size;
  if (mdS.expN[mod] != null && n > mdS.expN[mod] && (sub === 'resumo' || sub === 'receb')) sub = mdS.sub[mod] = 'lista';
  mdS.expN[mod] = n;
  if (mod === 'peticoes' && (sub === 'quadro' || sub === 'lista')) peticaoView = sub;
  if (mod === 'alvaras' && (sub === 'fases' || sub === 'lista')) alvaraView = sub;
  head.setAttribute('data-md', sub); body.setAttribute('data-md', sub);
  var bar = document.getElementById('mdAbas-' + mod);
  if (!bar){
    bar = document.createElement('div'); bar.id = 'mdAbas-' + mod; bar.className = 'md-abas'; bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'Sub-abas');
    head.insertBefore(bar, head.firstChild);
    bar.addEventListener('click', function(ev){ var b = ev.target.closest ? ev.target.closest('[data-md-aba]') : null; if (b) mdIrSub(mod, b.getAttribute('data-md-aba')); });
  }
  bar.innerHTML = mdAbasDe(mod).map(function(a){ return '<button type="button" role="tab" data-md-aba="' + a[0] + '" aria-selected="' + (a[0] === sub) + '" class="' + (a[0] === sub ? 'on' : '') + '">' + a[1] + '</button>'; }).join('');
  var on = bar.querySelector('.on'); if (on && bar.scrollWidth > bar.clientWidth){ try{ bar.scrollLeft = Math.max(0, on.offsetLeft - 24); }catch(e){} }
  var p = document.getElementById('mdPainel-' + mod);
  if (!p){
    p = document.createElement('div'); p.id = 'mdPainel-' + mod; p.className = 'md-painel';
    body.insertBefore(p, body.firstChild);
    p.addEventListener('click', function(ev){ mdClique(mod, ev); });
  }
  if (activeTab !== mod || (sub !== 'resumo' && sub !== 'receb')){ p.innerHTML = ''; return; }
  try{ p.innerHTML = sub === 'resumo' ? mdResumo(mod) : mdReceb(mod); }
  catch(e){ console.error('resumo do módulo', e); p.innerHTML = '<div class="empty"><strong>Não consegui montar esta tela</strong>As outras sub-abas continuam funcionando.</div>'; }
}
function mdClique(mod, ev){
  var t = ev.target, c = function(sel){ return t.closest ? t.closest(sel) : null; }, b;
  if ((b = c('[data-md-per]'))){ mdS.per = Number(b.getAttribute('data-md-per')) === 12 ? 12 : 6; mdS.sel[mod] = null; mdGravar(); mdRedesenhar(mod); return; }
  if ((b = c('[data-md-mes]'))){
    var i = Number(b.getAttribute('data-md-mes')), meses = mdMeses(mdS.per);
    if (mdS.sel[mod] === i){
      /* segundo toque: abre os recebimentos daquele mês (o mês do topo da tela passa a ser ele) */
      mdS.sel[mod] = null; mdS.rec[mod] = 'recebido'; mdS.sub[mod] = 'receb'; mdGravar();
      if (meses[i] && meses[i] !== mesSelecionado){ mesSelecionado = meses[i]; render(); renderAcordos(); renderAlvaras(); renderFinanceiro(); }
      else mdRedesenhar(mod);
    } else { mdS.sel[mod] = i; mdRedesenhar(mod); }
    return;
  }
  if ((b = c('[data-md-rec]'))){ mdS.rec[mod] = b.getAttribute('data-md-rec'); mdRedesenhar(mod); return; }
  if ((b = c('[data-md-fase]'))){
    var k = b.getAttribute('data-md-fase');
    if (mod === 'peticoes'){ filters.status = k; var fs = qs('filtroStatus'); if (fs) fs.value = k; }
    else if (mod === 'alvaras'){ filtersAlvara.fase = k; var fa = qs('filtroAlvaraFase'); if (fa) fa.value = k; }
    mdIrSub(mod, 'lista'); return;
  }
  if ((b = c('[data-md-doc]'))){ irParaRelacionado(mod === 'peticoes' ? 'peticao' : (mod === 'acordos' ? 'acordo' : 'alvara'), b.getAttribute('data-md-doc')); return; }
  if ((b = c('[data-md-ir]'))){
    var p = b.getAttribute('data-md-ir').split(':');
    if (p[0] === 'receb' && p[1]) mdS.rec[mod] = p[1];
    mdIrSub(mod, p[0]); return;
  }
}
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { mdS: mdS, mdIrSub: mdIrSub, mdSubAtual: mdSubAtual, mdListas: mdListas, mdSeries: mdSeries, mdMeses: mdMeses }); })();

/* sub-abas: quando a barra rola na horizontal (celular), a sub-aba ativa fica à vista: a barra é refeita a cada tela e voltaria ao começo */
(function(){
  var agendado = false;
  function ajustar(){
    agendado = false;
    Array.prototype.forEach.call(document.querySelectorAll('.md-abas:not([data-mdaj])'), function(b){
      if (!b.getClientRects().length) return;   // escondida (outra aba): tenta de novo quando aparecer
      b.setAttribute('data-mdaj', '1');
      var on = b.querySelector('button.on'); if (!on || b.scrollWidth <= b.clientWidth + 1) return;
      b.scrollLeft = Math.max(0, on.offsetLeft - Math.round((b.clientWidth - on.offsetWidth) / 2));
    });
  }
  function pedir(){ if (!agendado){ agendado = true; (window.requestAnimationFrame || setTimeout)(ajustar); } }
  try{ new MutationObserver(pedir).observe(document.body, { childList: true, subtree: true }); }catch(e){}
  pedir();
})();
