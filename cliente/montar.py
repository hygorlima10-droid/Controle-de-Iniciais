# Injeta cliente/pergunte.js dentro de public/index.html (entre marcadores) e liga os ganchos. Pode rodar de novo sem duplicar.
import re
R = '/home/user/Controle-de-Iniciais/'
s = open(R + 'public/index.html', encoding='utf-8').read()
mod = open(R + 'cliente/pergunte.js', encoding='utf-8').read()
bloco = '/*PA-INICIO*/\n' + mod + '\n/*PA-FIM*/\n'
if '/*PA-INICIO*/' in s:
    s = re.sub(r'/\*PA-INICIO\*/.*?/\*PA-FIM\*/\n', lambda m: bloco, s, flags=re.S)
else:
    assert s.count('function obraAbrirGasto(id, pagarId){') == 1
    s = s.replace('function obraAbrirGasto(id, pagarId){', bloco + 'function obraAbrirGasto(id, pagarId){')
nt = open(R + 'cliente/notificacoes.js', encoding='utf-8').read()
bloco_nt = '/*NT-INICIO*/\n' + nt + '\n/*NT-FIM*/\n'
if '/*NT-INICIO*/' in s:
    s = re.sub(r'/\*NT-INICIO\*/.*?/\*NT-FIM\*/\n', lambda m: bloco_nt, s, flags=re.S)
else:
    assert s.count('/*PA-FIM*/\n') == 1
    s = s.replace('/*PA-FIM*/\n', '/*PA-FIM*/\n' + bloco_nt)
ob = open(R + 'cliente/obra7.js', encoding='utf-8').read()
bloco_ob = '/*OB7-INICIO*/\n' + ob + '\n/*OB7-FIM*/\n'
if '/*OB7-INICIO*/' in s:
    s = re.sub(r'/\*OB7-INICIO\*/.*?/\*OB7-FIM\*/\n', lambda m: bloco_ob, s, flags=re.S)
else:
    assert s.count('/*NT-FIM*/\n') == 1
    s = s.replace('/*NT-FIM*/\n', '/*NT-FIM*/\n' + bloco_ob)
ct = open(R + 'cliente/categorias.js', encoding='utf-8').read()
bloco_ct = '/*CT-INICIO*/\n' + ct + '\n/*CT-FIM*/\n'
if '/*CT-INICIO*/' in s:
    s = re.sub(r'/\*CT-INICIO\*/.*?/\*CT-FIM\*/\n', lambda m: bloco_ct, s, flags=re.S)
else:
    assert s.count('/*OB7-FIM*/\n') == 1
    s = s.replace('/*OB7-FIM*/\n', '/*OB7-FIM*/\n' + bloco_ct)
pb = open(R + 'cliente/publicacoes.js', encoding='utf-8').read()
bloco_pb = '/*PB-INICIO*/\n' + pb + '\n/*PB-FIM*/\n'
if '/*PB-INICIO*/' in s:
    s = re.sub(r'/\*PB-INICIO\*/.*?/\*PB-FIM\*/\n', lambda m: bloco_pb, s, flags=re.S)
else:
    assert s.count('/*CT-FIM*/\n') == 1
    s = s.replace('/*CT-FIM*/\n', '/*CT-FIM*/\n' + bloco_pb)
def rep(old, new):
    global s
    if new in s: return
    assert s.count(old) == 1, (s.count(old), old[:70]); s = s.replace(old, new)
rep("    alvaras.forEach(function(al){\n      var alvo = ((al.partes||'')+' '+(al.numeroProcesso||'')).toLowerCase();\n      if (alvo.indexOf(q) !== -1) resultados.push({ tipo:'alvara', id:al.id, titulo:al.partes||'Sem nome', sub:'Alvará' + (al.arquivado ? ' · arquivado' : '') });\n    });\n    return resultados;",
    "    alvaras.forEach(function(al){\n      var alvo = ((al.partes||'')+' '+(al.numeroProcesso||'')).toLowerCase();\n      if (alvo.indexOf(q) !== -1) resultados.push({ tipo:'alvara', id:al.id, titulo:al.partes||'Sem nome', sub:'Alvará' + (al.arquivado ? ' · arquivado' : '') });\n    });\n    try{ resultados = resultados.concat(paBuscarExtra(query.trim())); }catch(e){ console.error('busca', e); }\n    return resultados;")
rep("  function irParaRelacionado(tipo, id){\n    if (tipo === 'cliente')", "  function irParaRelacionado(tipo, id){\n    if (paBuscaExtra[tipo]){ paIrExtra(tipo, id); return; }\n    if (tipo === 'cliente')")
rep("var TAB_LABEL = { peticao:'Petição', acordo:'Termo de acordo', alvara:'Alvará', cliente:'Cliente' };", "var TAB_LABEL = { peticao:'Petição', acordo:'Termo de acordo', alvara:'Alvará', cliente:'Cliente', despesa:'Despesa', receita:'Receita', meta:'Meta', obra:'Obra', extrato:'Extrato' };")
rep("    var resultados = buscarGlobal(q).slice(0, 10);", "    var resultados = buscarGlobal(q).slice(0, 14);")
rep("    if (!resultados.length){ box.innerHTML = '<div class=\"bg-vazio\">Nenhum resultado encontrado.</div>'; return; }",
    "    if (!resultados.length){ box.innerHTML = '<div class=\"bg-vazio\">Nenhum resultado encontrado.</div>' + (paTemSample() && q.trim().length >= 8 ? '<div class=\"bg-item\" data-pa-abrir=\"' + escapeHtml(q.trim()) + '\"><div class=\"bg-info\"><strong>Perguntar ao app</strong><span>' + escapeHtml(q.trim()) + '</span></div><span class=\"bg-tag\">IA</span></div>' : ''); return; }")
rep("else info += '<div class=\"saldo-data\">Prazo: ' + fmtData(m.prazo) + (falta > 0 ? ' · \\u2248 ' + fmtMoeda(falta / meses) + ' por mês' : '') + '</div>';",
    "else info += '<div class=\"saldo-data\">Prazo: ' + fmtData(m.prazo) + (falta > 0 ? ' · \\u2248 ' + fmtMoeda(falta / meses) + ' por mês' : '') + '</div>' + paMetaPlanoHtml(m, falta, meses);")

# ---- aba Publicações (Diário Oficial) ----
rep('  <div id="bodyAnalises" style="display:none;">', '  <div id="bodyPublicacoes" style="display:none;">\n    <div class="ob-wrap" id="pbWrap"></div>\n  </div>\n\n  <div id="bodyAnalises" style="display:none;">')
rep('      <button type="button" class="dr-it" data-tab="clientes" title="Clientes">', '      <button type="button" class="dr-it" data-tab="publicacoes" title="Publicações do Diário Oficial"><svg><use href="#ic-news"/></svg><span class="lab">Publicações</span><span class="dr-n red" id="menuNPub"></span></button>\n      <button type="button" class="dr-it" data-tab="clientes" title="Clientes">')
rep('<symbol id="ic-bell" ', '<symbol id="ic-news" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h13v14a2 2 0 002 2H6a2 2 0 01-2-2z"/><path d="M17 9h3v10a2 2 0 01-2 2"/><path d="M7 9h7M7 13h7M7 17h4"/></symbol>\n<symbol id="ic-bell" ')
rep("    qs('bodyObra').style.display = (tab === 'obra') ? '' : 'none';\n", "    qs('bodyObra').style.display = (tab === 'obra') ? '' : 'none';\n    qs('bodyPublicacoes').style.display = (tab === 'publicacoes') ? '' : 'none';\n")
rep("qs('mesNav').style.display = (tab === 'analises' || tab === 'extratos' || tab === 'obra') ? 'none' : '';", "qs('mesNav').style.display = (tab === 'analises' || tab === 'extratos' || tab === 'obra' || tab === 'publicacoes') ? 'none' : '';")
rep("qs('fabNew').style.display = (tab === 'arquivados' || tab === 'inicio' || tab === 'extratos' || tab === 'analises' || tab === 'obra') ? 'none' : '';", "qs('fabNew').style.display = (tab === 'arquivados' || tab === 'inicio' || tab === 'extratos' || tab === 'analises' || tab === 'obra' || tab === 'publicacoes') ? 'none' : '';")
rep("    else if (tab === 'obra') renderObra();\n    else renderFinanceiro();", "    else if (tab === 'obra') renderObra();\n    else if (tab === 'publicacoes') pbRender();\n    else renderFinanceiro();")
rep("analises:'Análises', obra:'Construção', financeiro:'Financeiro' };", "analises:'Análises', obra:'Construção', publicacoes:'Publicações', financeiro:'Financeiro' };")
rep("    else if (activeTab === 'extratos') qs('subtitle').textContent = 'Leitura dos extratos do Drive · você confere antes de lançar';", "    else if (activeTab === 'extratos') qs('subtitle').textContent = 'Leitura dos extratos do Drive · você confere antes de lançar';\n    else if (activeTab === 'publicacoes') qs('subtitle').textContent = 'Diário Oficial (DJEN) · leitura automática todo dia às 10:00';")
rep("    itens.sort(function(a,b){\n      if (a.ordem !== b.ordem) return a.ordem - b.ordem;", "    if (typeof pbAvisos === 'function'){\n      try{ pbAvisos().forEach(function(a){ itens.push({ origem: 'prazopub', ordem: 1, dataOrdenacao: a.d, atrasado: !!a.atraso, a: a }); }); }catch(e){ console.error('prazos das publicações', e); }\n    }\n    itens.sort(function(a,b){\n      if (a.ordem !== b.ordem) return a.ordem - b.ordem;")
rep("      if (x.origem === 'obra') return ob7LinhaAviso(x.a);", "      if (x.origem === 'obra') return ob7LinhaAviso(x.a);\n      if (x.origem === 'prazopub') return pbLinhaAviso(x.a);")
open(R + 'public/index.html', 'w', encoding='utf-8').write(s)
print('montado')
