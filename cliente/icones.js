/* ============================================================
   BANCO CENTRAL DE ÍCONES (prefixo ic) — base técnica, sem efeito visual (Fase 2, etapa 2.1)
   - cliente/icones-dados.js traz o catálogo (IC_CATALOGO, IC_FAMILIAS) e os desenhos do Lucide (IC_LUCIDE)
   - o app grava só o IDENTIFICADOR do ícone (ex.: transporte_combustivel), nunca o SVG; ícone ≠ categoria
   - icResolver: ícone gravado → regras antigas de cliente/categorias.js (ctVisual) → nome igual ao do catálogo → genérico
     (quem não tem ícone gravado continua vendo exatamente o mesmo ícone de antes)
   - icBuscar: busca sem acento, com sinônimos e família (base do seletor universal da etapa 2.5)
   - ids nunca mudam; se um dia um id for substituído, o antigo entra em IC_ALIAS apontando para o novo
   ============================================================ */
var IC_ALIAS = {};
var IC_GENERICO = 'circle-help';
var IC_INDICE = null;
function icNorm(s){
  var t = String(s == null ? '' : s);
  try{ t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); }catch(e){}
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function icIndice(){
  if (IC_INDICE) return IC_INDICE;
  var porId = {}, porNome = {};
  IC_CATALOGO.forEach(function(c, i){
    var f = IC_FAMILIAS[c[2]] || ['', '#8A93AD'];
    var it = { id: c[0], nome: c[1], familia: f[0], icone: c[3], cor: f[1], sinonimos: c[4] || [], i: i, alvo: icNorm(c[1]), alvoSin: (c[4] || []).map(icNorm), alvoFam: icNorm(f[0]) };
    porId[c[0]] = it;
    if (!porNome[it.alvo]) porNome[it.alvo] = it;
    it.alvoSin.forEach(function(s){ if (s && !porNome[s]) porNome[s] = it; });
  });
  IC_INDICE = { porId: porId, porNome: porNome };
  return IC_INDICE;
}
function icPorId(id){
  if (!id) return null;
  var x = icIndice().porId; return x[id] || x[IC_ALIAS[id]] || null;
}
/* miolo do SVG (traço) de um ícone do Lucide; nome que não existe cai no genérico */
function icMiolo(nomeLucide){ return IC_LUCIDE[nomeLucide] || IC_LUCIDE[IC_GENERICO] || ''; }
/* SVG completo (24x24, traço); a cor vem do CSS (currentColor) quando não se informa */
function icSvg(id, opc){
  opc = opc || {}; var it = icPorId(id), tam = opc.tamanho || 20;
  return '<svg viewBox="0 0 24 24" width="' + tam + '" height="' + tam + '" fill="none" stroke="' + (opc.cor || 'currentColor') + '" stroke-width="' + (opc.espessura || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icMiolo(it ? it.icone : IC_GENERICO) + '</svg>';
}
/* o que a tela precisa para desenhar: { id, nome, cor, miolo, origem } — origem diz de onde veio ('salvo', 'regra-antiga', 'catalogo', 'padrao') */
function icResolver(o){
  o = o || {};
  var salvo = icPorId(o.icone);
  if (salvo) return { id: salvo.id, nome: salvo.nome, cor: o.cor || salvo.cor, miolo: icMiolo(salvo.icone), origem: 'salvo' };
  var v = null; try{ if (typeof ctVisual === 'function') v = ctVisual(o.rotulo); }catch(e){}
  var padraoAntigo = !v || v.ic === 'tag' || v.ic === 'dots' || v.ic === 'bag';   /* ctVisual devolve estes quando nenhuma regra antiga reconheceu o nome */
  if (v && !padraoAntigo && typeof CT_SVG !== 'undefined' && CT_SVG[v.ic]) return { id: '', nome: String(o.rotulo || ''), cor: v.cor, miolo: CT_SVG[v.ic], origem: 'regra-antiga' };
  var nome = icIndice().porNome[icNorm(o.rotulo)];
  if (nome) return { id: nome.id, nome: nome.nome, cor: nome.cor, miolo: icMiolo(nome.icone), origem: 'catalogo' };
  if (v && typeof CT_SVG !== 'undefined' && CT_SVG[v.ic]) return { id: '', nome: String(o.rotulo || ''), cor: v.cor, miolo: CT_SVG[v.ic], origem: 'padrao' };   /* o mesmo ícone que o app já mostrava */
  return { id: '', nome: String(o.rotulo || ''), cor: '#8A93AD', miolo: icMiolo(IC_GENERICO), origem: 'padrao' };
}
/* a "bolinha" colorida do app (a mesma forma de fvIc/ctIcone), para quando as telas passarem a usar o banco de ícones */
function icBolinha(res, peq){
  return '<span class="ct-ic' + (peq ? ' sm' : '') + '" style="background:' + res.cor + '" aria-hidden="true"><svg viewBox="0 0 24 24">' + res.miolo + '</svg></span>';
}
/* busca: sem acento, por nome, sinônimo e família; mais relevantes primeiro */
function icBuscar(texto, limite){
  var q = icNorm(texto), idx = icIndice(), out = [];
  if (!q) return [];
  var palavras = q.split(' ');
  IC_CATALOGO.forEach(function(c){
    var it = idx.porId[c[0]], pts = 0;
    if (it.alvo === q) pts = 100;
    else if (it.alvo.indexOf(q) === 0) pts = 80;
    else if (it.alvoSin.some(function(s){ return s === q; })) pts = 75;
    else if (it.alvo.indexOf(q) >= 0) pts = 60;
    else if (it.alvoSin.some(function(s){ return s.indexOf(q) >= 0; })) pts = 50;
    else if (palavras.every(function(p){ return it.alvo.indexOf(p) >= 0 || it.alvoFam.indexOf(p) >= 0 || it.alvoSin.some(function(s){ return s.indexOf(p) >= 0; }); })) pts = 30;
    if (pts) out.push({ it: it, pts: pts });
  });
  out.sort(function(a, b){ return b.pts - a.pts || a.it.nome.localeCompare(b.it.nome, 'pt-BR'); });
  return out.slice(0, limite || 40).map(function(x){ return x.it; });
}
function icFamilias(){
  return IC_FAMILIAS.map(function(f, i){ return { nome: f[0], cor: f[1], itens: IC_CATALOGO.filter(function(c){ return c[2] === i; }).map(function(c){ return icPorId(c[0]); }) }; });
}
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { icResolver: icResolver, icBuscar: icBuscar, icSvg: icSvg, icPorId: icPorId, icFamilias: icFamilias, icAlias: IC_ALIAS, icBolinha: icBolinha, ctVisual: ctVisual, CT_SVG: CT_SVG, ctIcone: ctIcone, fvIc: fvIc }); })();
