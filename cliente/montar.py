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
pr = open(R + 'cliente/processos.js', encoding='utf-8').read()
bloco_pr = '/*PR-INICIO*/\n' + pr + '\n/*PR-FIM*/\n'
if '/*PR-INICIO*/' in s:
    s = re.sub(r'/\*PR-INICIO\*/.*?/\*PR-FIM\*/\n', lambda m: bloco_pr, s, flags=re.S)
else:
    assert s.count('/*AG-FIM*/\n') == 1
    s = s.replace('/*AG-FIM*/\n', '/*AG-FIM*/\n' + bloco_pr)
rl = open(R + 'cliente/relatorios.js', encoding='utf-8').read()
bloco_rl = '/*RL-INICIO*/\n' + rl + '\n/*RL-FIM*/\n'
if '/*RL-INICIO*/' in s:
    s = re.sub(r'/\*RL-INICIO\*/.*?/\*RL-FIM\*/\n', lambda m: bloco_rl, s, flags=re.S)
else:
    assert s.count('/*PR-FIM*/\n') == 1
    s = s.replace('/*PR-FIM*/\n', '/*PR-FIM*/\n' + bloco_rl)
an = open(R + 'cliente/analises.js', encoding='utf-8').read()
bloco_an = '/*AN-INICIO*/\n' + an + '\n/*AN-FIM*/\n'
if '/*AN-INICIO*/' in s:
    s = re.sub(r'/\*AN-INICIO\*/.*?/\*AN-FIM\*/\n', lambda m: bloco_an, s, flags=re.S)
else:
    assert s.count('/*RL-FIM*/\n') == 1
    s = s.replace('/*RL-FIM*/\n', '/*RL-FIM*/\n' + bloco_an)
pcs = open(R + 'src/pecas.js', encoding='utf-8').read().replace('export var ', 'var ').replace('export function ', 'function ')
bloco_pc = '/*PC-INICIO*/\n' + pcs + '\n/*PC-FIM*/\n'
if '/*PC-INICIO*/' in s:
    s = re.sub(r'/\*PC-INICIO\*/.*?/\*PC-FIM\*/\n', lambda m: bloco_pc, s, flags=re.S)
else:
    assert s.count('/*RL-FIM*/\n') == 1
    s = s.replace('/*RL-FIM*/\n', '/*RL-FIM*/\n' + bloco_pc)
imp = open(R + 'cliente/importacao.js', encoding='utf-8').read()
bloco_im = '/*IM-INICIO*/\n' + imp + '\n/*IM-FIM*/\n'
if '/*IM-INICIO*/' in s:
    s = re.sub(r'/\*IM-INICIO\*/.*?/\*IM-FIM\*/\n', lambda m: bloco_im, s, flags=re.S)
else:
    assert s.count('/*PC-FIM*/\n') == 1
    s = s.replace('/*PC-FIM*/\n', '/*PC-FIM*/\n' + bloco_im)
bk = open(R + 'cliente/backup.js', encoding='utf-8').read()
bloco_bk = '/*BK-INICIO*/\n' + bk + '\n/*BK-FIM*/\n'
if '/*BK-INICIO*/' in s:
    s = re.sub(r'/\*BK-INICIO\*/.*?/\*BK-FIM\*/\n', lambda m: bloco_bk, s, flags=re.S)
else:
    assert s.count('/*IM-FIM*/\n') == 1
    s = s.replace('/*IM-FIM*/\n', '/*IM-FIM*/\n' + bloco_bk)
cf = open(R + 'cliente/configuracoes.js', encoding='utf-8').read()
bloco_cf = '/*CF-INICIO*/\n' + cf + '\n/*CF-FIM*/\n'
if '/*CF-INICIO*/' in s:
    s = re.sub(r'/\*CF-INICIO\*/.*?/\*CF-FIM\*/\n', lambda m: bloco_cf, s, flags=re.S)
else:
    assert s.count('/*BK-FIM*/\n') == 1
    s = s.replace('/*BK-FIM*/\n', '/*BK-FIM*/\n' + bloco_cf)
sg = open(R + 'cliente/seguranca.js', encoding='utf-8').read()
bloco_sg = '/*SG-INICIO*/\n' + sg + '\n/*SG-FIM*/\n'
if '/*SG-INICIO*/' in s:
    s = re.sub(r'/\*SG-INICIO\*/.*?/\*SG-FIM\*/\n', lambda m: bloco_sg, s, flags=re.S)
else:
    assert s.count('/*CF-FIM*/\n') == 1
    s = s.replace('/*CF-FIM*/\n', '/*CF-FIM*/\n' + bloco_sg)
us = open(R + 'cliente/usuarios.js', encoding='utf-8').read()
bloco_us = '/*US-INICIO*/\n' + us + '\n/*US-FIM*/\n'
if '/*US-INICIO*/' in s:
    s = re.sub(r'/\*US-INICIO\*/.*?/\*US-FIM\*/\n', lambda m: bloco_us, s, flags=re.S)
else:
    assert s.count('/*SG-FIM*/\n') == 1
    s = s.replace('/*SG-FIM*/\n', '/*SG-FIM*/\n' + bloco_us)
es = open(R + 'cliente/responsaveis.js', encoding='utf-8').read()
bloco_es = '/*ES-INICIO*/\n' + es + '\n/*ES-FIM*/\n'
if '/*ES-INICIO*/' in s:
    s = re.sub(r'/\*ES-INICIO\*/.*?/\*ES-FIM\*/\n', lambda m: bloco_es, s, flags=re.S)
else:
    assert s.count('/*US-FIM*/\n') == 1
    s = s.replace('/*US-FIM*/\n', '/*US-FIM*/\n' + bloco_es)
agi = open(R + 'cliente/agenda-importar.js', encoding='utf-8').read()
bloco_agi = '/*AGI-INICIO*/\n' + agi + '\n/*AGI-FIM*/\n'
if '/*AGI-INICIO*/' in s:
    s = re.sub(r'/\*AGI-INICIO\*/.*?/\*AGI-FIM\*/\n', lambda m: bloco_agi, s, flags=re.S)
else:
    assert s.count('/*ES-FIM*/\n') == 1
    s = s.replace('/*ES-FIM*/\n', '/*ES-FIM*/\n' + bloco_agi)
agd = open(R + 'cliente/agenda-detalhe.js', encoding='utf-8').read()
bloco_agd = '/*AGD-INICIO*/\n' + agd + '\n/*AGD-FIM*/\n'
if '/*AGD-INICIO*/' in s:
    s = re.sub(r'/\*AGD-INICIO\*/.*?/\*AGD-FIM\*/\n', lambda m: bloco_agd, s, flags=re.S)
else:
    assert s.count('/*AGI-FIM*/\n') == 1
    s = s.replace('/*AGI-FIM*/\n', '/*AGI-FIM*/\n' + bloco_agd)
ic_dados = open(R + 'cliente/icones-dados.js', encoding='utf-8').read(); ic_js = open(R + 'cliente/icones.js', encoding='utf-8').read()
bloco_ic = '/*IC-INICIO*/\n' + ic_dados + '\n' + ic_js + '\n/*IC-FIM*/\n'
if '/*IC-INICIO*/' in s:
    s = re.sub(r'/\*IC-INICIO\*/.*?/\*IC-FIM\*/\n', lambda m: bloco_ic, s, flags=re.S)
else:
    assert s.count('/*AGD-FIM*/\n') == 1
    s = s.replace('/*AGD-FIM*/\n', '/*AGD-FIM*/\n' + bloco_ic)
md_js = open(R + 'cliente/modulo.js', encoding='utf-8').read() + '\n' + open(R + 'cliente/modulo-juridico.js', encoding='utf-8').read() + '\n' + open(R + 'cliente/modulo-financeiro.js', encoding='utf-8').read() + '\n' + open(R + 'cliente/orcamento.js', encoding='utf-8').read() + '\n' + open(R + 'cliente/simulador.js', encoding='utf-8').read() + '\n' + open(R + 'cliente/futuro.js', encoding='utf-8').read() + '\n' + open(R + 'cliente/extratos-contas.js', encoding='utf-8').read() + '\n' + open(R + 'cliente/conflito.js', encoding='utf-8').read()
bloco_md = '/*MD-INICIO*/\n' + md_js + '\n/*MD-FIM*/\n'
if '/*MD-INICIO*/' in s:
    s = re.sub(r'/\*MD-INICIO\*/.*?/\*MD-FIM\*/\n', lambda m: bloco_md, s, flags=re.S)
else:
    assert s.count('/*IC-FIM*/\n') == 1
    s = s.replace('/*IC-FIM*/\n', '/*IC-FIM*/\n' + bloco_md)
def repm(marcador, old, new):
    if marcador in s: return
    rep(old, new)
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
repm('id="bodyPublicacoes"', '  <div id="bodyAnalises" style="display:none;">', '  <div id="bodyPublicacoes" style="display:none;">\n    <div class="ob-wrap" id="pbWrap"></div>\n  </div>\n\n  <div id="bodyAnalises" style="display:none;">')
rep('      <button type="button" class="dr-it" data-tab="clientes" title="Clientes">', '      <button type="button" class="dr-it" data-tab="publicacoes" title="Publicações do Diário Oficial"><svg><use href="#ic-news"/></svg><span class="lab">Publicações</span><span class="dr-n red" id="menuNPub"></span></button>\n      <button type="button" class="dr-it" data-tab="clientes" title="Clientes">')
rep('<symbol id="ic-bell" ', '<symbol id="ic-news" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h13v14a2 2 0 002 2H6a2 2 0 01-2-2z"/><path d="M17 9h3v10a2 2 0 01-2 2"/><path d="M7 9h7M7 13h7M7 17h4"/></symbol>\n<symbol id="ic-bell" ')
rep("    qs('bodyObra').style.display = (tab === 'obra') ? '' : 'none';\n", "    qs('bodyObra').style.display = (tab === 'obra') ? '' : 'none';\n    qs('bodyPublicacoes').style.display = (tab === 'publicacoes') ? '' : 'none';\n")
rep("qs('mesNav').style.display = (tab === 'analises' || tab === 'extratos' || tab === 'obra') ? 'none' : '';", "qs('mesNav').style.display = (tab === 'analises' || tab === 'extratos' || tab === 'obra' || tab === 'publicacoes') ? 'none' : '';")
rep("qs('fabNew').style.display = (tab === 'arquivados' || tab === 'inicio' || tab === 'extratos' || tab === 'analises' || tab === 'obra') ? 'none' : '';", "qs('fabNew').style.display = (tab === 'arquivados' || tab === 'inicio' || tab === 'extratos' || tab === 'analises' || tab === 'obra' || tab === 'publicacoes') ? 'none' : '';")
rep("    else if (tab === 'obra') renderObra();\n    else renderFinanceiro();", "    else if (tab === 'obra') renderObra();\n    else if (tab === 'publicacoes') pbRender();\n    else renderFinanceiro();")
rep("analises:'Análises', obra:'Construção', financeiro:'Financeiro' };", "analises:'Análises', obra:'Construção', publicacoes:'Publicações', financeiro:'Financeiro' };")
rep("    else if (activeTab === 'extratos') qs('subtitle').textContent = 'Leitura dos extratos do Drive · você confere antes de lançar';", "    else if (activeTab === 'extratos') qs('subtitle').textContent = 'Leitura dos extratos do Drive · você confere antes de lançar';\n    else if (activeTab === 'publicacoes') qs('subtitle').textContent = 'Diário Oficial (DJEN) · leitura automática todo dia às 10:00';")

# ---- Agenda, cartão de prazos no Início, "Iniciais" e menu lateral ----
repm('id="bodyAgenda"', '  <div id="bodyAnalises" style="display:none;">', '  <div id="bodyAgenda" style="display:none;">\n    <div class="ob-wrap" id="agWrap"></div>\n  </div>\n\n  <div id="bodyAnalises" style="display:none;">')
repm('data-tab="agenda"', '      <button type="button" class="dr-it" data-tab="publicacoes" title="Publicações do Diário Oficial">', '      <button type="button" class="dr-it" data-tab="agenda" title="Agenda de prazos"><svg><use href="#ic-agenda"/></svg><span class="lab">Agenda</span><span class="dr-n red" id="menuNAgenda"></span></button>\n      <button type="button" class="dr-it" data-tab="publicacoes" title="Publicações do Diário Oficial">')
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

# ---- aba Processos ----
repm('id="bodyProcessos"', '  <div id="bodyAnalises" style="display:none;">', '  <div id="bodyProcessos" style="display:none;">\n    <div class="ob-wrap" id="prWrap"></div>\n  </div>\n\n  <div id="bodyAnalises" style="display:none;">')
repm('data-tab="processos"', '      <button type="button" class="dr-it" data-tab="publicacoes" title="Publicações do Diário Oficial">', '      <button type="button" class="dr-it" data-tab="processos" title="Processos"><svg><use href="#ic-proc"/></svg><span class="lab">Processos</span></button>\n      <button type="button" class="dr-it" data-tab="publicacoes" title="Publicações do Diário Oficial">')
repm('id="ic-proc"', '<symbol id="ic-sync" ', '<symbol id="ic-proc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></symbol>\n<symbol id="ic-sync" ')
rep("    qs('bodyAgenda').style.display = (tab === 'agenda') ? '' : 'none';\n", "    qs('bodyAgenda').style.display = (tab === 'agenda') ? '' : 'none';\n    qs('bodyProcessos').style.display = (tab === 'processos') ? '' : 'none';\n")
s = s.replace("tab === 'publicacoes' || tab === 'agenda') ? 'none'", "tab === 'publicacoes' || tab === 'agenda' || tab === 'processos') ? 'none'")
rep("    else if (tab === 'agenda') agRender();\n", "    else if (tab === 'agenda') agRender();\n    else if (tab === 'processos') prRender();\n")
rep("agenda:'Agenda',", "agenda:'Agenda', processos:'Processos',")
rep("    else if (activeTab === 'agenda') qs('subtitle').textContent = 'Prazos, audiências e tarefas · feriados do TJGO';", "    else if (activeTab === 'agenda') qs('subtitle').textContent = 'Prazos, audiências e tarefas · feriados do TJGO';\n    else if (activeTab === 'processos') qs('subtitle').textContent = 'Todos os processos, com ou sem honorários';")
rep("cliente:'Cliente', despesa:'Despesa',", "cliente:'Cliente', processo:'Processo', publicacao:'Publicação', despesa:'Despesa',")
rep("var TIPO_DOC_LABEL = { caso:'Petição', acordo:'Acordo', alvara:'Alvará' };", "var TIPO_DOC_LABEL = { caso:'Inicial', acordo:'Acordo', alvara:'Alvará' };")
rep('          <option value="alvara">Alvarás</option>\n        </select>\n          <select class="filter-select" id="filtroArqSit">', '          <option value="alvara">Alvarás</option>\n          <option value="processo">Processos</option>\n        </select>\n          <select class="filter-select" id="filtroArqSit">')
rep("    return resultados;\n  }\n\n  function irParaRelacionado(tipo, id){\n    if (paBuscaExtra[tipo]){ paIrExtra(tipo, id); return; }", "    try{ resultados = resultados.concat(prRelacionados(num, tipoAtual, true)); }catch(e){ console.error('processos', e); }\n    return resultados;\n  }\n\n  function irParaRelacionado(tipo, id){\n    if (tipo === 'processo'){ prAbrir(id); return; }\n    if (paBuscaExtra[tipo]){ paIrExtra(tipo, id); return; }")
rep("    var matches = buscarRelacionados(numero, tipoAtual, idAtual);\n    var el = qs(sugestaoElId);", "    var matches = buscarRelacionados(numero, tipoAtual, idAtual);\n    if (!matches.length){ try{ matches = prRelacionados(normalizarProcesso(numero), tipoAtual, false); }catch(e){} }\n    var el = qs(sugestaoElId);")

# ---- honorários do processo: casos com doProcesso ficam fora do quadro/lista de Iniciais, mas entram nas contas ----
rep("  function passaFiltro(c){\n    if (c.arquivado) return false;", "  function passaFiltro(c){\n    if (c.arquivado || c.doProcesso) return false;   /* honorários de processo ficam na aba Processos */")
rep("    if (!casos.some(function(c){ return !c.concluido && !c.arquivado; })){\n      el.innerHTML = '<div class=\"empty\"><strong>Nenhuma petição em andamento</strong>", "    if (!casos.some(function(c){ return !c.concluido && !c.arquivado && !c.doProcesso; })){\n      el.innerHTML = '<div class=\"empty\"><strong>Nenhuma petição em andamento</strong>")
rep("  function casoAtivos(){ return casos.filter(function(c){ return !c.concluido && !c.arquivado; }); }", "  function casoAtivos(){ return casos.filter(function(c){ return !c.concluido && !c.arquivado && !c.doProcesso; }); }")
rep("  function getExitoParado(){\n    var items = [];\n    casoAtivos().forEach(function(c){", "  function getExitoParado(){\n    var items = [];\n    casos.filter(function(c){ return !c.concluido && !c.arquivado; }).forEach(function(c){")
rep("  function computeStats(){\n    var total = 0, recebido = 0, pendente = 0, vencido = 0;", "  function computeStats(soIniciais){\n    var total = 0, recebido = 0, pendente = 0, vencido = 0;")
rep("casos.forEach(function(c){ if (!c.concluido && !c.arquivado) total += ((Number(c.valorHonorarios) || 0)", "casos.forEach(function(c){ if (!c.concluido && !c.arquivado && !(soIniciais && c.doProcesso)) total += ((Number(c.valorHonorarios) || 0)")
rep("    listarUnidades().forEach(function(u){\n      if (u.docTipo !== 'caso') return;\n      recebido += recebidoMesMeu(u, mesSelecionado);", "    listarUnidades().forEach(function(u){\n      if (u.docTipo !== 'caso') return;\n      if (soIniciais && u.grupo === 'processo') return;\n      recebido += recebidoMesMeu(u, mesSelecionado);")
rep("      var stats = computeStats();\n      qs('subtitle').textContent = stats.count", "      var stats = computeStats(true);\n      qs('subtitle').textContent = stats.count")
rep("    var s = computeStats();\n    rsResumo('stats',", "    var s = computeStats(true);\n    rsResumo('stats',")
rep("grupo: c.tipo === 'extrajudicial' ? 'extrajudicial' : 'inicial', clienteIds: c.clienteIds || [], arquivado: !!c.arquivado };\n      var fb", "grupo: c.doProcesso ? 'processo' : (c.tipo === 'extrajudicial' ? 'extrajudicial' : 'inicial'), clienteIds: c.clienteIds || [], arquivado: !!c.arquivado };\n      var fb")
rep("var REL_TIPO_TXT = { inicial:'Petição inicial', extrajudicial:'Procedimento extrajudicial', acordo:'Termo de acordo', alvara:'Alvará' };", "var REL_TIPO_TXT = { inicial:'Petição inicial', extrajudicial:'Procedimento extrajudicial', processo:'Honorários de processo', acordo:'Termo de acordo', alvara:'Alvará' };")
rep("function tipo(it){ return it.grupo === 'inicial' ? 'Petição inicial' : it.grupo === 'extrajudicial'", "function tipo(it){ return it.grupo === 'processo' ? 'Honorários de processo' : it.grupo === 'inicial' ? 'Petição inicial' : it.grupo === 'extrajudicial'")
rep("    if (casoAntAt && casoAntAt.atipica) dados.atipica = true;\n", "    if (casoAntAt && casoAntAt.atipica) dados.atipica = true;\n    if ((casoAntAt && casoAntAt.doProcesso) || prModoHon) dados.doProcesso = true;   /* honorários cadastrados pela ficha do processo */\n")
# ---- backup e restauração também levam os Processos e a Agenda ----
rep("['obraMov', 'lançamentos da obra']];", "['obraMov', 'lançamentos da obra'], ['processos', 'processos'], ['agenda', 'itens da agenda']];")
rep("      obraMov: obraMov,\n      config: config\n    };", "      obraMov: obraMov,\n      processos: prDocs,\n      agenda: agDocs,\n      config: config\n    };")
rep("[metasRef, metas, dados.metas], [extratosRef, extratos, dados.extratos], [obraMovRef, obraMov, dados.obraMov]\n      ].filter(", "[metasRef, metas, dados.metas], [extratosRef, extratos, dados.extratos], [obraMovRef, obraMov, dados.obraMov],\n        [pbRefColecao('processos'), prDocs, dados.processos], [pbRefColecao('agenda'), agDocs, dados.agenda]\n      ].filter(")
rep("      return cadeia.then(function(){ return restaurarConfig(dados.config); });", "      return cadeia.then(function(){ return restaurarConfig(dados.config); }).then(function(){ try{ prCarregar(); agCarregar(); }catch(e){} });")
rep("(dados.receitasManuais||[]).length + ' receitas manuais.';", "(dados.receitasManuais||[]).length + ' receitas manuais, ' + (dados.processos||[]).length + ' processos e ' + (dados.agenda||[]).length + ' itens da agenda.';")

rep("[db.collection('processos'), prDocs, dados.processos], [db.collection('agenda'), agDocs, dados.agenda]", "[pbRefColecao('processos'), prDocs, dados.processos], [pbRefColecao('agenda'), agDocs, dados.agenda]")   # db não existe fora do início do app
rep("['agenda', 'itens da agenda']];", "['agenda', 'itens da agenda'], ['pecasAprendidas', 'peças aprendidas']];")
rep("      agenda: agDocs,\n      config: config", "      agenda: agDocs,\n      pecasAprendidas: pbAprend,\n      config: config")
rep("[pbRefColecao('agenda'), agDocs, dados.agenda]\n      ].filter(", "[pbRefColecao('agenda'), agDocs, dados.agenda], [pbRefColecao('pecasAprendidas'), pbAprend, dados.pecasAprendidas]\n      ].filter(")
rep("try{ prCarregar(); agCarregar(); }catch(e){}", "try{ prCarregar(); agCarregar(); pbCarregarAprend(); }catch(e){}")
# ---- Inicial sem processo: caixa no cadastro (só aí) e gravação do campo semProcesso ----
rep("""        <div class="processo-sugestao" id="processoSugestao" style="display:none;"></div>
      </div>
""", """        <div class="processo-sugestao" id="processoSugestao" style="display:none;"></div>
      </div>

      <div class="field">
        <label class="ad-it" style="border:0;padding:0;"><input type="checkbox" id="semProcessoInput"><span class="ad-t">Esta inicial não tem processo (extrajudicial ou não ajuizada)</span></label>
      </div>
""")
rep("    if ((casoAntAt && casoAntAt.doProcesso) || prModoHon) dados.doProcesso = true;   /* honorários cadastrados pela ficha do processo */\n", "    if ((casoAntAt && casoAntAt.doProcesso) || prModoHon) dados.doProcesso = true;   /* honorários cadastrados pela ficha do processo */\n    if (!numeroProcesso && qs('semProcessoInput') && qs('semProcessoInput').checked) dados.semProcesso = true;   /* sai da lista de Iniciais a vincular */\n")
rep("  function irParaCaso(id){\n    var ccArq = casos.filter(function(x){ return x.id === id; })[0];\n", "  function irParaCaso(id){\n    var ccArq = casos.filter(function(x){ return x.id === id; })[0];\n    if (ccArq && ccArq.doProcesso){ prIrParaHonorario(ccArq); return; }\n")
rep("  function irParaRelacionado(tipo, id){\n    if (tipo === 'processo'){ prAbrir(id); return; }", "  function irParaRelacionado(tipo, id){\n    if (tipo === 'processo'){ prAbrir(id); return; }\n    if (tipo === 'peticao'){ var ddp = docDe('caso', id); if (ddp && ddp.doProcesso){ prIrParaHonorario(ddp); return; } }")
repm('id="ic-quadro"', '<symbol id="ic-proc" ', '<symbol id="ic-quadro" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/></symbol>\n<symbol id="ic-proc" ')

# ---- cliente: "outros nomes" (como aparece nas publicações) ----
repm('id="cliApelidosInput"', '        <textarea id="cliObsInput" rows="3" placeholder="Ex.: prefere contato à tarde; combinado pagar todo dia 10…"></textarea>\n      </div>\n', '        <textarea id="cliObsInput" rows="3" placeholder="Ex.: prefere contato à tarde; combinado pagar todo dia 10…"></textarea>\n      </div>\n      <div class="field">\n        <label class="field-label" for="cliApelidosInput">Outros nomes (como aparece nas publicações)</label>\n        <input type="text" id="cliApelidosInput" maxlength="300" placeholder="Ex.: Cooperativa Mista dos Produtores de Leite de Morrinhos - Complem">\n        <div class="saldo-data">Separe por ponto e vírgula. O app usa para reconhecer o cliente nas publicações do Diário Oficial.</div>\n      </div>\n')
repm("cliApelidosInput').value", "    qs('cliObsInput').value = c ? (c.obs || '') : '';\n", "    qs('cliObsInput').value = c ? (c.obs || '') : '';\n    qs('cliApelidosInput').value = c ? (c.apelidos || []).join('; ') : '';\n")
repm("obj.apelidos = qs", "    obj.obs = qs('cliObsInput').value.trim();\n", "    obj.obs = qs('cliObsInput').value.trim();\n    obj.apelidos = qs('cliApelidosInput').value.split(';').map(function(x){ return x.trim(); }).filter(Boolean);\n")
# ---- cliente: vincular automaticamente os processos importados / novos das publicações ----
repm('id="cliVincAutoInput"', '      <label class="chip-toggle" id="cliArquivadoWrap" style="display:none;">', '      <label class="chip-toggle"><input type="checkbox" id="cliVincAutoInput"> Vincular automaticamente os processos novos deste cliente (importação e publicações), sem passar pela revisão</label>\n      <label class="chip-toggle" id="cliArquivadoWrap" style="display:none;">')
repm("cliVincAutoInput').checked", "    qs('cliArquivadoInput').checked = !!(c && c.arquivado);\n", "    qs('cliArquivadoInput').checked = !!(c && c.arquivado);\n    qs('cliVincAutoInput').checked = !!(c && c.vinculoAuto === true);\n")
repm("obj.vinculoAuto", "    if (atual) obj.arquivado = qs('cliArquivadoInput').checked;\n", "    if (atual) obj.arquivado = qs('cliArquivadoInput').checked;\n    if (qs('cliVincAutoInput').checked) obj.vinculoAuto = true; else if (obj.vinculoAuto === true) obj.vinculoAuto = false;\n")
# ---- backup: com o servidor, a restauração é conferida e trocada de uma vez pelo servidor (cliente/backup.js) ----
rep("        backupImportadoPendente = dados;\n        var resumo = (dados.exportadoEm", "        backupImportadoPendente = dados;\n        if (window.__SERVIDOR && typeof bkConferir === 'function'){ bkConferir(dados); return; }\n        var resumo = (dados.exportadoEm")
rep("    var dados = backupImportadoPendente;\n    var btn = qs('confirmarImportarBackup');\n    btn.disabled = true;", "    var dados = backupImportadoPendente;\n    if (window.__SERVIDOR && typeof bkAplicar === 'function'){ bkAplicar(dados); return; }\n    var btn = qs('confirmarImportarBackup');\n    btn.disabled = true;")
# ---- menu lateral enxuto e aba Configurações ----
MENU_NOVO = """      <button type="button" class="dr-it" id="abrirCobrancaMenuBtn" title="Cobrar clientes inadimplentes"><svg><use href="#ic-receipt"/></svg><span class="lab">Cobrança de clientes</span></button>
      <div class="dr-grp">Financeiro</div>
      <button type="button" class="dr-it" data-tab="financeiro" data-fin="geral" title="Divisão do mês"><svg><use href="#ic-pie"/></svg><span class="lab">Divisão do mês</span></button>
      <button type="button" class="dr-it" data-tab="financeiro" data-fin="pj" title="Hygor (PJ)"><svg><use href="#ic-brief"/></svg><span class="lab">Hygor (PJ)</span></button>
      <button type="button" class="dr-it" data-tab="financeiro" data-fin="pf" title="Pessoa física"><svg><use href="#ic-user"/></svg><span class="lab">Pessoa física</span></button>
      <button type="button" class="dr-it" data-tab="financeiro" data-fin="patrimonio" title="Patrimônio e metas"><svg><use href="#ic-trend"/></svg><span class="lab">Patrimônio e metas</span></button>
      <button type="button" class="dr-it" data-tab="analises" title="Análises e projeção"><svg><use href="#ic-chart"/></svg><span class="lab">Análises</span></button>
      <button type="button" class="dr-it" data-tab="obra" title="Construção da casa"><svg><use href="#ic-house"/></svg><span class="lab">Construção</span></button>
      <button type="button" class="dr-it" data-tab="extratos" title="Extratos do banco"><svg><use href="#ic-bank"/></svg><span class="lab">Extratos do banco</span><span class="dr-n red" id="menuNExtratos"></span></button>
      <button type="button" class="dr-it" id="abrirLerDocBtn" style="display:none;" title="Cadastrar por foto ou PDF"><svg><use href="#ic-cam"/></svg><span class="lab">Ler foto ou PDF</span></button>
      <button type="button" class="dr-it" id="abrirRecebiBtn" title="Recebi R$ (registrar recebimento)"><svg><use href="#ic-coin"/></svg><span class="lab">Recebi R$</span></button>
      <button type="button" class="dr-it" id="abrirFechamentoBtn" title="Fechamento do mês"><svg><use href="#ic-cal"/></svg><span class="lab">Fechamento do mês</span></button>
      <button type="button" class="dr-it" id="abrirRelMuriloBtn" title="Relatório do Murilo"><svg><use href="#ic-send"/></svg><span class="lab">Relatório do Murilo</span></button>
      <div class="dr-grp">Sistema</div>
      <button type="button" class="dr-it" data-tab="configuracoes" title="Configurações"><svg><use href="#ic-gear"/></svg><span class="lab">Configurações</span></button>
      <button type="button" class="dr-it" id="sairBtn" title="Sair (pede a senha de novo)" onclick="location.href='/sair'"><svg><use href="#ic-out"/></svg><span class="lab">Sair</span></button>
      <button type="button" class="dr-it" id="backupBtn" title="Backup e restauração"><svg><use href="#ic-dl"/></svg><span class="lab">Backup e restauração</span></button>
      <button type="button" class="dr-it" id="exportBtn" title="Exportar lista (CSV)"><svg><use href="#ic-table"/></svg><span class="lab">Exportar lista (CSV)</span></button>"""
if 'id="abrirCobrancaMenuBtn"' not in s:
    i = s.index('      <div class="dr-grp">Financeiro</div>'); j = s.index('id="exportBtn"'); j = s.index('</button>', j) + len('</button>')
    s = s[:i] + MENU_NOVO + s[j:]
SAIR_L = '      <button type="button" class="dr-it" id="sairBtn" title="Sair (pede a senha de novo)" onclick="location.href=\'/sair\'"><svg><use href="#ic-out"/></svg><span class="lab">Sair</span></button>\n'
BK_L = '      <button type="button" class="dr-it" id="backupBtn" title="Backup e restauração"><svg><use href="#ic-dl"/></svg><span class="lab">Backup e restauração</span></button>\n'
EX_L = '      <button type="button" class="dr-it" id="exportBtn" title="Exportar lista (CSV)"><svg><use href="#ic-table"/></svg><span class="lab">Exportar lista (CSV)</span></button>\n'
rep(SAIR_L + BK_L + EX_L, BK_L + EX_L + SAIR_L)   # Sair por último; "Desfazer última ação" (que entra antes do botão de backup) fica logo depois de Configurações
repm('id="bodyConfig"', '  <div id="bodyAnalises" style="display:none;">', '  <div id="bodyConfig" style="display:none;">\n    <div class="ob-wrap" id="cfWrap"></div>\n  </div>\n\n  <div id="bodyAnalises" style="display:none;">')
rep('<symbol id="ic-sync" ', '<symbol id="ic-gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></symbol>\n<symbol id="ic-sync" ')
rep("    qs('bodyProcessos').style.display = (tab === 'processos') ? '' : 'none';\n", "    qs('bodyProcessos').style.display = (tab === 'processos') ? '' : 'none';\n    qs('bodyConfig').style.display = (tab === 'configuracoes') ? '' : 'none';\n")
s = s.replace("|| tab === 'processos') ? 'none'", "|| tab === 'processos' || tab === 'configuracoes') ? 'none'")
rep("    else if (tab === 'processos') prRender();\n", "    else if (tab === 'processos') prRender();\n    else if (tab === 'configuracoes') cfRender();\n")
rep("processos:'Processos', financeiro:'Financeiro' };", "processos:'Processos', configuracoes:'Configurações', financeiro:'Financeiro' };")
rep("    else if (activeTab === 'processos') qs('subtitle').textContent = 'Todos os processos, com ou sem honorários';", "    else if (activeTab === 'processos') qs('subtitle').textContent = 'Todos os processos, com ou sem honorários';\n    else if (activeTab === 'configuracoes') qs('subtitle').textContent = 'Notificações, backup e exportações';")
rep("h += secPerfil('atos', 'Atos e processos', docs.length, atos);", "h += secPerfil('atos', 'Processos e atos', docs.length, atos);")

# Transferência PJ/PF atômica (Fase 1, item 5): despesa + receita gravadas e excluídas juntas, numa só transação do servidor (/api/lote)
rep("  function persistNovaReceita(data){\n    data.criadoEm = new Date().toISOString();",
"""  /* transferência PJ/PF = uma receita + uma despesa ligadas por transferenciaId: gravadas juntas, tudo ou nada (queda de conexão no meio não deixa só uma) */
  function persistNovaTransferencia(receita, despesa){
    if (storageMode !== 'db' || !window.__horusLote) return Promise.all([persistNovaReceita(receita), persistNovaDespesa(despesa)]);
    var agora = new Date().toISOString(); receita.criadoEm = agora; despesa.criadoEm = agora; despesa.atualizadoEm = agora;
    return window.__horusLote.gravar([
      { colecao: 'receitasManuais', id: window.__horusLote.novoId(), dados: receita },
      { colecao: 'despesas', id: window.__horusLote.novoId(), dados: despesa }
    ]);
  }
  function persistExcluiJunto(idsReceitas, idsDespesas){
    if (storageMode !== 'db' || !window.__horusLote) return Promise.all(idsReceitas.map(persistExcluiReceitaSimples).concat(idsDespesas.map(persistExcluiDespesaSimples)));
    receitasManuais = receitasManuais.filter(function(r){ return idsReceitas.indexOf(r.id) < 0; });
    despesas = despesas.filter(function(d){ return idsDespesas.indexOf(d.id) < 0; });
    renderFinanceiro();
    return window.__horusLote.gravar(idsReceitas.map(function(id){ return { colecao: 'receitasManuais', id: id, apagar: true }; }).concat(idsDespesas.map(function(id){ return { colecao: 'despesas', id: id, apagar: true }; })));
  }
  function persistNovaReceita(data){
    data.criadoEm = new Date().toISOString();""")
rep("""    var r = receitasManuais.find(function(x){ return x.id === id; });
    var promessas = [];
    if (r && r.transferenciaId){
      despesas.filter(function(d){ return d.transferenciaId === r.transferenciaId; }).forEach(function(d){ promessas.push(persistExcluiDespesaSimples(d.id)); });
    }
    promessas.push(persistExcluiReceitaSimples(id));
    return Promise.all(promessas);""",
"""    var r = receitasManuais.find(function(x){ return x.id === id; });
    var pares = (r && r.transferenciaId) ? despesas.filter(function(d){ return d.transferenciaId === r.transferenciaId; }).map(function(d){ return d.id; }) : [];
    return persistExcluiJunto([id], pares);""")
rep("""    var d = despesas.find(function(x){ return x.id === id; });
    var promessas = [];
    if (d && d.transferenciaId){
      receitasManuais.filter(function(r){ return r.transferenciaId === d.transferenciaId; }).forEach(function(r){ promessas.push(persistExcluiReceitaSimples(r.id)); });
    }
    promessas.push(persistExcluiDespesaSimples(id));
    return Promise.all(promessas);""",
"""    var d = despesas.find(function(x){ return x.id === id; });
    var pares = (d && d.transferenciaId) ? receitasManuais.filter(function(r){ return r.transferenciaId === d.transferenciaId; }).map(function(r){ return r.id; }) : [];
    return persistExcluiJunto(pares, [id]);""")
rep("    Promise.all([persistNovaReceita(receita), persistNovaDespesa(despesa)]).then(function(){\n      qs('saveBtnTransf').disabled = false;", "    persistNovaTransferencia(receita, despesa).then(function(){\n      qs('saveBtnTransf').disabled = false;")
rep("    return Promise.all([persistNovaReceita(receita), persistNovaDespesa(despesa)]);\n  }\n  function grupoRecebiDaLinha(o){", "    return persistNovaTransferencia(receita, despesa);\n  }\n  function grupoRecebiDaLinha(o){")
rep("  return Promise.all([persistNovaReceita(receita), persistNovaDespesa(despesa)]);\n}\nfunction extPagarDespesa(", "  return persistNovaTransferencia(receita, despesa);\n}\nfunction extPagarDespesa(")


# Item 6 (parte da configuração): a tela lê até 50 documentos de config; o Início voltou a somar honorários + outras receitas da PJ (decisão de 09/11)
rep("configRef.limit(10).onSnapshot(", "configRef.limit(50).onSnapshot(")

# Fase 2, etapa 2.2: peça padrão do módulo (sub-abas, Resumo com gráficos, Recebimentos) em Iniciais, Acordos e Alvarás
rep("  function render(){\n    renderStats();", "  function render(){\n    mdAplicar('peticoes');\n    renderStats();")
rep("  function renderAcordos(){\n    renderStatsAcordos();", "  function renderAcordos(){\n    mdAplicar('acordos');\n    renderStatsAcordos();")
rep("  function renderAlvaras(){\n    renderStatsAlvaras();", "  function renderAlvaras(){\n    mdAplicar('alvaras');\n    renderStatsAlvaras();")
rep("    peticaoView = 'lista';\n    if (activeTab !== 'peticoes') setActiveTab('peticoes');", "    peticaoView = 'lista'; mdS.sub.peticoes = 'lista';\n    if (activeTab !== 'peticoes') setActiveTab('peticoes');")

# Fase 2, etapa 2.3: Resumo e sub-abas em Clientes (Processos, Publicações e Agenda mudam nos próprios arquivos de cliente/)
rep("    var semCli = docsSemCliente().length;\n    qs('clientesAviso').innerHTML = semCli", "    mjClientes({ lista: lista, ativos: ativos, tot: tot });\n    var semCli = docsSemCliente().length;\n    qs('clientesAviso').innerHTML = semCli")
rep("  qs('filtroClienteTipo').addEventListener('change', function(){ clientesFiltro.tipo = this.value; renderClientes(); });", "  qs('filtroClienteTipo').addEventListener('change', function(){ clientesFiltro.tipo = this.value; mjS.cli = 'lista'; renderClientes(); });")

# Fase 2, etapa 2.4: Financeiro (Visão geral + sub-abas) e Construção (Resumo + sub-abas)
rep("  function aplicarFinTab(){\n    setSegValue('segFinTab', finTab);", "  function aplicarFinTab(){\n    mfAplicar();\n    setSegValue('segFinTab', finTab);")
s = re.sub(r"localStorage\.setItem\('controlePeticoes\.finTab\.v1', finTab\); \}catch\(e\)\{\}(?! mfLembrar\(\);)", "localStorage.setItem('controlePeticoes.finTab.v1', finTab); }catch(e){} mfLembrar();", s)
rep("  h += '</div>';\n  el.innerHTML = h;\n  mfObra(el, r, cfg);\n}\n(function(){\n  var wrap = qs('obraWrap');", "  h += '</div>';\n  el.innerHTML = h;\n}\n(function(){\n  var wrap = qs('obraWrap');")   # a Construção é separada em sub-abas por cliente/modulo-financeiro.js, que embrulha renderObra depois do obra7
rep("function renderAnalises(){\n  var el = qs('anWrap');\n  if (!el) return;", "function renderAnalises(){\n  mfBarraAnalises();\n  var el = qs('anWrap');\n  if (!el) return;")
rep('<button type="button" class="bt-it" data-tab="financeiro" data-fin="geral"><svg><use href="#ic-pie"/></svg><span>Finanças</span></button>', '<button type="button" class="bt-it" data-tab="financeiro"><svg><use href="#ic-pie"/></svg><span>Finanças</span></button>')
rep('      <button type="button" class="dr-it" data-tab="financeiro" data-fin="geral" title="Divisão do mês">', '      <button type="button" class="dr-it" data-tab="financeiro" data-fin="resumo" title="Visão geral das finanças"><svg><use href="#ic-chart"/></svg><span class="lab">Visão geral</span></button>\n      <button type="button" class="dr-it" data-tab="financeiro" data-fin="geral" title="Divisão do mês">')
rep("  var FIN_NOMES = { geral:'Finanças', pj:'Hygor (PJ)', pf:'Minha PF', patrimonio:'Patrimônio' };", "  var FIN_NOMES = { resumo:'Finanças', geral:'Divisão do mês', pj:'Hygor (PJ)', pf:'Minha PF', patrimonio:'Patrimônio' };")

# limpeza: um ajuste antigo repetia os desenhos ic-proc e ic-gear a cada montagem; fica só o primeiro de cada
for _id in ('ic-proc', 'ic-gear'):
    _ms = list(re.finditer(r'<symbol id="' + _id + r'"[^>]*>.*?</symbol>', s, flags=re.S))
    for _m in reversed(_ms[1:]): s = s[:_m.start()] + s[_m.end():]


rep('<div class="form-error" id="formError"></div>', '<div class="field" id="esResp_casos"></div>\n      <div class="form-error" id="formError"></div>')
rep('<div class="form-error" id="formErrorAcordo"></div>', '<div class="field" id="esResp_termosAcordo"></div>\n      <div class="form-error" id="formErrorAcordo"></div>')
rep('<div class="form-error" id="formErrorAlvara"></div>', '<div class="field" id="esResp_alvaras"></div>\n      <div class="form-error" id="formErrorAlvara"></div>')
rep("    qs('modalTitle').textContent = 'Nova inicial';\n", "    qs('modalTitle').textContent = 'Nova inicial';\n    esRespIniciar('casos', null);\n")
rep("    qs('modalTitle').textContent = 'Editar inicial';\n", "    qs('modalTitle').textContent = 'Editar inicial';\n    esRespIniciar('casos', c);\n")
rep("    qs('modalAcordoTitle').textContent = 'Novo termo de acordo';\n", "    qs('modalAcordoTitle').textContent = 'Novo termo de acordo';\n    esRespIniciar('termosAcordo', null);\n")
rep("    qs('modalAcordoTitle').textContent = 'Editar termo de acordo';\n", "    qs('modalAcordoTitle').textContent = 'Editar termo de acordo';\n    esRespIniciar('termosAcordo', a);\n")
rep("    qs('modalAlvaraTitle').textContent = 'Novo alvará';\n", "    qs('modalAlvaraTitle').textContent = 'Novo alvará';\n    esRespIniciar('alvaras', null);\n")
rep("    qs('modalAlvaraTitle').textContent = 'Editar alvará';\n", "    qs('modalAlvaraTitle').textContent = 'Editar alvará';\n    esRespIniciar('alvaras', a);\n")
rep("    qs('saveBtn').disabled = true;\n    var casoAntAt =", "    if (!esRespAplicar('casos', dados, qs('formError'))) return;\n    qs('saveBtn').disabled = true;\n    var casoAntAt =")
rep("    qs('saveBtnAcordo').disabled = true;\n    if (acordoAnterior && acordoAnterior.atipica)", "    if (!esRespAplicar('termosAcordo', dados, qs('formErrorAcordo'))) return;\n    qs('saveBtnAcordo').disabled = true;\n    if (acordoAnterior && acordoAnterior.atipica)")
rep("    qs('saveBtnAlvara').disabled = true;\n    if (alvaraAnterior && alvaraAnterior.atipica)", "    if (!esRespAplicar('alvaras', dados, qs('formErrorAlvara'))) return;\n    qs('saveBtnAlvara').disabled = true;\n    if (alvaraAnterior && alvaraAnterior.atipica)")
rep("    try{ window.scrollTo(0, 0); }catch(e){}\n    if (tab === 'inicio'){ renderResumoGeral();", "    try{ window.scrollTo(0, 0); }catch(e){}\n    try{ esBarra(); }catch(e){}\n    if (tab === 'inicio'){ renderResumoGeral();")
open(R + 'public/index.html', 'w', encoding='utf-8').write(s)
print('montado')

# ---------- Fase 5, etapa 5.4: advogados responsáveis e escopo "Meus | Escritório" (ganchos; cliente/responsaveis.js tem a lógica) ----------
