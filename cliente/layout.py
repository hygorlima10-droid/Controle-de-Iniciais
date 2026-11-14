# Reorganiza o Início: faixa de ações no topo, sem botões flutuantes de câmera/Recebi, ícones novos, folha "Novo". Roda uma vez.
import re
R = '/home/user/Controle-de-Iniciais/'
s = open(R + 'public/index.html', encoding='utf-8').read()
if 'id="inicioAcoes"' in s:
    print('layout já aplicado'); raise SystemExit
def rep(old, new, n=1):
    global s
    assert s.count(old) == n, (s.count(old), old[:80]); s = s.replace(old, new)

# ícones novos no sprite
ico = '''<symbol id="ic-undo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></symbol>
<symbol id="ic-cam" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.5" r="3.6"/></symbol>
<symbol id="ic-ask" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 01-12.3 7.6L3.5 20.5l1.4-4.9A8.5 8.5 0 1121 11.5z"/><path d="M12 7.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></symbol>
<symbol id="ic-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="ic-out" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></symbol>
<symbol id="ic-receipt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></symbol>
<symbol id="ic-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.1"/></symbol>
'''
i = s.index('<symbol id="ic-dl"'); j = s.index('</symbol>', i) + len('</symbol>')
s = s[:j] + '\n' + ico + s[j:]

# faixa de ações no topo + remoção da fileira do fim e dos botões flutuantes
m = re.search(r'\n      <div class="ini-atalhos">\s*<div class="atalhos" id="inicioAtalhos">.*?</div>\s*</div>', s, flags=re.S)
assert m; s = s[:m.start()] + s[m.end():]
rep('      <div class="ini-card ini-hero">', '''      <div class="ini-acoes" id="inicioAcoes">
        <button type="button" class="acao acao-ouro" id="acRecebi"><svg><use href="#ic-coin"/></svg><span>Recebi R$</span></button>
        <button type="button" class="acao" id="inicioLerDoc" style="display:none;"><svg><use href="#ic-cam"/></svg><span>Foto/PDF</span></button>
        <button type="button" class="acao" id="inicioPergunte" style="display:none;"><svg><use href="#ic-ask"/></svg><span>Pergunte</span></button>
        <button type="button" class="acao" id="inicioNovo"><svg><use href="#ic-plus"/></svg><span>Novo</span></button>
      </div>
      <div class="ini-card ini-hero">''')
s = re.sub(r'<button type="button" class="fab-camera" id="fabLerDoc".*?</button>\n', '', s, flags=re.S)
s = re.sub(r'<button type="button" class="fab-recebi" id="fabRecebi">.*?</button>\n', '', s, flags=re.S)
rep("  qs('fabRecebi').addEventListener('click', function(){ abrirRecebi(); });\n", "")
a = s.index("  qs('inicioAtalhos').addEventListener('click', function(ev){"); b = s.index("  });\n", a) + len("  });\n")
s = s[:a] + s[b:]
rep("    qs('fabLerDoc').classList.toggle('ok', !!ldSample);\n", "")
rep("qs('fabLerDoc').addEventListener('click', function(){ ldAbrir(); });\n", "")
s = re.sub(r'\n  \.fab-recebi\{display:none;\}', '', s); s = re.sub(r'\n  \.fab-camera\{display:none;\}', '', s)
s = re.sub(r'\n    body\[data-tab="inicio"\] \.fab-(recebi|camera)[^\n]*', '', s)
s = re.sub(r'\n    body\[data-tab="inicio"\]\{padding-bottom:\d+px;\}', '', s)

# grade do Início
s = s.replace('grid-template-areas:"busca" "hero" "kpi" "atencao" "extratos" "divisao" "atalhos";', 'grid-template-areas:"busca" "acoes" "hero" "kpi" "atencao" "extratos" "divisao";')
s = s.replace('grid-template-areas:"busca busca" "hero atencao" "kpi atencao" "extratos atencao" "divisao atencao" "atalhos atencao";', 'grid-template-areas:"busca busca" "acoes acoes" "hero atencao" "kpi atencao" "extratos atencao" "divisao atencao";')
assert '"acoes"' in s and '"acoes acoes"' in s

# estilos novos
css = '''
  /* ---- faixa de ações do Início, folha "Novo", alertas na Central ---- */
  .ini-acoes{grid-area:acoes;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:8px;}
  .ini-acoes .acao{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:64px;padding:9px 4px;border-radius:18px;border:1px solid var(--border);background:var(--surface);color:var(--ink);font-weight:600;font-size:0.76rem;cursor:pointer;font-family:inherit;}
  .ini-acoes .acao svg{width:23px;height:23px;}
  .ini-acoes .acao.acao-ouro{background:var(--gold-btn);color:var(--gold-ink);border-color:transparent;}
  @media (min-width:1000px){ .ini-acoes{max-width:520px;} }
  .novo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}
  .novo-it{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:84px;border-radius:18px;border:1px solid var(--border);background:var(--surface-2);color:var(--ink);font-weight:600;font-size:0.84rem;cursor:pointer;font-family:inherit;padding:10px 4px;}
  .novo-it svg{width:26px;height:26px;}
  .novo-it.novo-1{background:var(--gold-btn);color:var(--gold-ink);border-color:transparent;}
  #atencaoSection .up-data svg{width:24px;height:24px;}
  #atencaoSection .up-data.up-d-aviso{background:rgba(201,133,0,0.16);color:var(--tutela);}
  #atencaoSection .up-data.up-d-info{background:rgba(29,127,191,0.14);color:var(--info);}
  #atencaoSection .up-data.up-d-atraso svg{color:var(--urgente);}
  .pa-ask{display:inline-flex;vertical-align:middle;align-items:center;justify-content:center;width:26px;height:26px;margin-left:6px;border-radius:50%;border:1px solid var(--border);background:var(--surface);color:var(--accent);cursor:pointer;padding:0;}
  .pa-ask svg{width:15px;height:15px;}
'''
rep("  .overlay.show{display:flex;}", "  .overlay.show{display:flex;}" + css)
# botão + menor (celular)
s = re.sub(r'\.fab\{bottom:calc\(96px \+ env\(safe-area-inset-bottom\)\);right:18px;\}', '.fab{bottom:calc(88px + env(safe-area-inset-bottom));right:16px;width:46px;height:46px;}', s)
# ícones do menu
rep('<svg><use href="#ic-file"/></svg><span class="lab">Ler foto ou PDF</span>', '<svg><use href="#ic-cam"/></svg><span class="lab">Ler foto ou PDF</span>')
rep('<svg><use href="#ic-user"/></svg><span class="lab">Sair</span>', '<svg><use href="#ic-out"/></svg><span class="lab">Sair</span>')
# botão + : abre a folha "Novo" (menos no Financeiro, que tem o menu próprio de lançamentos)
rep("    if (activeTab === 'acordos') abrirNovoAcordo();\n    else if (activeTab === 'alvaras') abrirNovoAlvara();\n    else if (activeTab === 'clientes') abrirClienteEdit({});\n    else abrirNovo();\n  });", "    paAbrirNovo();\n  });")
s = s.replace('<button class="fab" id="fabNew" title="Nova petição">', '<button class="fab" id="fabNew" title="Novo">')
open(R + 'public/index.html', 'w', encoding='utf-8').write(s)
print('layout aplicado')
