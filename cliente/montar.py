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
open(R + 'public/index.html', 'w', encoding='utf-8').write(s)
print('montado')
