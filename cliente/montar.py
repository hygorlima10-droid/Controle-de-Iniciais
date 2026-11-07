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
ag = open(R + 'cliente/agenda.js', encoding='utf-8').read()
bloco_ag = '/*AG-INICIO*/\n' + ag + '\n/*AG-FIM*/\n'
if '/*AG-INICIO*/' in s:
    s = re.sub(r'/\*AG-INICIO\*/.*?/\*AG-FIM\*/\n', lambda m: bloco_ag, s, flags=re.S)
else:
    assert s.count('/*PB-FIM*/\n') == 1
    s = s.replace('/*PB-FIM*/\n', '/*PB-FIM*/\n' + bloco_ag)
def rep(old, new):
    # Os ajustes são feitos uma vez no index.html; depois outros ajustes mudam o mesmo trecho. Se o trecho antigo já não existe, o ajuste já foi aplicado.
    global s
    if new in s or s.count(old) == 0: return
    assert s.count(old) == 1, (s.count(old), old[:70]); s = s.replace(old, new)
rep("    alvaras.forEach(function(al){\n      var alvo = ((al.partes||'')+' '+(al.numeroProcesso||'')).toLowerCase();\n      if (alvo.indexOf(q) !== -1) resultados.push({ tipo:'alvara', id:al.id, titulo:al.partes||'Sem nome', sub:'Alvará' + (al.arquivado ? ' · arquivado' : '') });\n    });\n    return resultados;",
    "    alvaras.forEach(function(al){\n      var alvo = ((al.partes||'')+' '+(al.numeroProcesso||'')).toLowerCase();\n      if (alvo.indexOf(q) !== -1) resultados.push({ tipo:'alvara', id:al.id, titulo:al.partes||'Sem nome', sub:'Alvará' + (al.arquivado ? ' · arquivado' : '') });\n    });\n    try{ resultados = resultados.concat(paBuscarExtra(query.trim())); }catch(e){ console.error('busca', e); }\n    return resultados;")
rep("  function irParaRelacionado(tipo, id){\n    if (tipo === 'cliente')", "  function irParaRelacionado(tipo, id){\n    if (paBuscaExtra[tipo]){ paIrExtra(tipo, id); return; }\n    if (tipo === 'cliente')")
if "var TAB_LABEL = { peticao:'Inicial'" not in s:
    rep("var TAB_LABEL = { peticao:'Petição', acordo:'Termo de acordo', alvara:'Alvará', cliente:'Cliente' };", "var TAB_LABEL = { peticao:'Inicial', acordo:'Termo de acordo', alvara:'Alvará', cliente:'Cliente', despesa:'Despesa', receita:'Receita', meta:'Meta', obra:'Obra', extrato:'Extrato' };")
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

# ---- Agenda, cartão de prazos no Início, "Iniciais" e menu lateral ----
rep('  <div id="bodyAnalises" style="display:none;">', '  <div id="bodyAgenda" style="display:none;">\n    <div class="ob-wrap" id="agWrap"></div>\n  </div>\n\n  <div id="bodyAnalises" style="display:none;">')
rep('      <button type="button" class="dr-it" data-tab="publicacoes" title="Publicações do Diário Oficial">', '      <button type="button" class="dr-it" data-tab="agenda" title="Agenda de prazos"><svg><use href="#ic-agenda"/></svg><span class="lab">Agenda</span><span class="dr-n red" id="menuNAgenda"></span></button>\n      <button type="button" class="dr-it" data-tab="publicacoes" title="Publicações do Diário Oficial">')
rep('<symbol id="ic-news" ', '<symbol id="ic-agenda" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3M8 17h6"/></symbol>\n<symbol id="ic-news" ')
rep("    qs('bodyPublicacoes').style.display = (tab === 'publicacoes') ? '' : 'none';\n", "    qs('bodyPublicacoes').style.display = (tab === 'publicacoes') ? '' : 'none';\n    qs('bodyAgenda').style.display = (tab === 'agenda') ? '' : 'none';\n")
rep("qs('mesNav').style.display = (tab === 'analises' || tab === 'extratos' || tab === 'obra' || tab === 'publicacoes') ? 'none' : '';", "qs('mesNav').style.display = (tab === 'analises' || tab === 'extratos' || tab === 'obra' || tab === 'publicacoes' || tab === 'agenda') ? 'none' : '';")
rep("tab === 'analises' || tab === 'obra' || tab === 'publicacoes') ? 'none' : '';", "tab === 'analises' || tab === 'obra' || tab === 'publicacoes' || tab === 'agenda') ? 'none' : '';")
rep("    else if (tab === 'publicacoes') pbRender();\n", "    else if (tab === 'publicacoes') pbRender();\n    else if (tab === 'agenda') agRender();\n")
rep("obra:'Construção', publicacoes:'Publicações',", "obra:'Construção', publicacoes:'Publicações', agenda:'Agenda',")
rep("    else if (activeTab === 'publicacoes') qs('subtitle').textContent = 'Diário Oficial (DJEN) · leitura automática todo dia às 10:00';", "    else if (activeTab === 'publicacoes') qs('subtitle').textContent = 'Diário Oficial (DJEN) · leitura automática todo dia às 10:00';\n    else if (activeTab === 'agenda') qs('subtitle').textContent = 'Prazos, audiências e tarefas · feriados do TJGO';")
# cartão de prazos no Início (nova área do grid)
rep('      <div class="ini-atencao">\n  <section class="upcoming"', '      <div class="ini-prazos" id="inicioPrazos"></div>\n      <div class="ini-atencao">\n  <section class="upcoming"')
rep('.ini-grid.sem-extr{grid-template-areas:"busca" "acoes" "hero" "kpi" "atencao" "divisao";}', '.ini-grid.sem-extr{grid-template-areas:"busca" "acoes" "hero" "kpi" "prazos" "atencao" "divisao";}')
rep('.ini-grid.sem-extr{grid-template-areas:"busca busca" "acoes acoes" "hero atencao" "kpi atencao" "divisao atencao";grid-template-rows:auto auto auto auto minmax(0,1fr);}', '.ini-grid.sem-extr{grid-template-areas:"busca busca" "acoes acoes" "hero atencao" "kpi atencao" "prazos atencao" "divisao atencao";grid-template-rows:auto auto auto auto auto minmax(0,1fr);}')
rep('grid-template-areas:"busca" "acoes" "hero" "kpi" "atencao" "extratos" "divisao";padding-top:12px;}', 'grid-template-areas:"busca" "acoes" "hero" "kpi" "prazos" "atencao" "extratos" "divisao";padding-top:12px;}')
rep('grid-template-areas:"busca busca" "acoes acoes" "hero atencao" "kpi atencao" "extratos atencao" "divisao atencao";grid-template-rows:auto auto auto auto auto minmax(0,1fr);align-items:start;}', 'grid-template-areas:"busca busca" "acoes acoes" "hero atencao" "kpi atencao" "prazos atencao" "extratos atencao" "divisao atencao";grid-template-rows:auto auto auto auto auto auto minmax(0,1fr);align-items:start;}')
rep('  .ini-atencao{grid-area:atencao;}', '  .ini-atencao{grid-area:atencao;}\n  .ini-prazos{grid-area:prazos;}')
# nomes: Petições -> Iniciais
for a, b in [
  ('data-tab="peticoes" title="Petições"><svg><use href="#ic-file"/></svg><span class="lab">Petições</span>', 'data-tab="peticoes" title="Iniciais"><svg><use href="#ic-file"/></svg><span class="lab">Iniciais</span>'),
  ('data-tab="peticoes"><svg><use href="#ic-file"/></svg><span>Petições</span>', 'data-tab="peticoes"><svg><use href="#ic-file"/></svg><span>Iniciais</span>'),
  ('<option value="caso">Petições</option>', '<option value="caso">Iniciais</option>'),
  ('placeholder="Buscar em petições, acordos, alvarás e clientes…"', 'placeholder="Buscar em iniciais, acordos, alvarás e clientes…"'),
  ("peticoes:'Petições', acordos:'Acordos'", "peticoes:'Iniciais', acordos:'Acordos'"),
  ("toast('Abra Petições, Termos de Acordo,", "toast('Abra Iniciais, Termos de Acordo,"),
  ('(Petições, Termos de Acordo e Alvarás com previsão', '(Iniciais, Termos de Acordo e Alvarás com previsão'),
  ('entradas previstas em Petições, Termos de Acordo', 'entradas previstas em Iniciais, Termos de Acordo'),
  ("['  Petições', fmtMoeda(sp.recebido)]", "['  Iniciais', fmtMoeda(sp.recebido)]"),
  ("['  Petições', fmtMoeda(sp.pendente)]", "['  Iniciais', fmtMoeda(sp.pendente)]"),
  ("titulo: 'Colunas do quadro de Petições'", "titulo: 'Colunas do quadro de Iniciais'"),
  ("peticao:'Petição', acordo:'Termo de acordo'", "peticao:'Inicial', acordo:'Termo de acordo'"),
  ("Nova petição", "Nova inicial"), ("Editar petição", "Editar inicial"),
]:
    assert a in s or b in s, a[:60]
    s = s.replace(a, b)

# ---- ícones e botões no padrão da tela inicial (Publicações e Agenda) ----
rep('<symbol id="ic-agenda" ', '<symbol id="ic-sync" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 01-15.5 6.2M3 12A9 9 0 0118.5 5.8M18.5 2v4h-4M5.5 22v-4h4"/></symbol>\n<symbol id="ic-mes" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></symbol>\n<symbol id="ic-lista" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></symbol>\n<symbol id="ic-agenda" ')
rep('  .ini-acoes .acao.acao-ouro{background:var(--gold-btn);color:var(--gold-ink);border-color:transparent;}', '  .ini-acoes .acao.acao-ouro{background:var(--gold-btn);color:var(--gold-ink);border-color:transparent;}\n  .ini-acoes .acao.on{background:var(--ink);color:var(--bg);border-color:var(--ink);}\n  .ini-acoes .acao:disabled{opacity:.6;cursor:default;}')
open(R + 'public/index.html', 'w', encoding='utf-8').write(s)
print('montado')
