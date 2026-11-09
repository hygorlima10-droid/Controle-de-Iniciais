#!/usr/bin/env python3
"""Gera cliente/icones-dados.js (catálogo de ícones + desenhos do Lucide) a partir de docs/ICONES.md.
Uso:  python3 cliente/gerar_icones.py <pasta do pacote lucide-static extraído>      (ex.: npm pack lucide-static@1.70.0 && tar xzf lucide-static-1.70.0.tgz; usar a pasta "package")
Só os ícones usados no catálogo entram no arquivo (~50 KB). Lucide é ISC License (uso livre, inclusive comercial)."""
import json, re, sys, os, unicodedata
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LUC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/lucide/package'
doc = open(os.path.join(RAIZ, 'docs/ICONES.md'), encoding='utf-8').read()
sec = doc[doc.index('## 3. Catálogo'):doc.index('## 4. Seletor')]

def slug(s):
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '_', s).strip('_')

# ícones que não existem no Lucide: o substituto escolhido (docs/ICONES.md, seção 2)
SUBST = {'tooth': 'smile', 'oil': 'droplet', 'roof': 'house', 'cabinet': 'archive', 'pipe': 'workflow', 'sink': 'bath', 'bottle-water': 'cup-soda'}
SUBST_NOME = {('Telhado', 'roof'): 'warehouse', ('Pias', 'sink'): 'droplets', ('Sifões', 'pipe'): 'cylinder'}
CORES = {'Moradia': '#8A93AD', 'Alimentação': '#EA580C', 'Transporte': '#D93B3B', 'Saúde': '#D93B3B', 'Educação': '#8B5CF6', 'Lazer e pessoais': '#EA580C', 'Obrigações financeiras': '#D93B3B',
         'Escritório': '#2A78D6', 'Receitas': '#17895A', 'Etapas da obra': '#C2410C', 'Materiais (estrutura)': '#8A7355', 'Materiais (cobertura/acabamento)': '#8A7355', 'Materiais (elétrica)': '#8A7355',
         'Materiais (hidráulica)': '#8A7355', 'Materiais (esquadrias/marcenaria)': '#8A7355', 'Mão de obra e equipamentos': '#C2410C', 'Financeiro da obra': '#C2410C', 'Movimentações de extrato': '#2A78D6',
         'Importação': '#2A78D6', 'Patrimônio': '#0F766E', 'Processos': '#2A78D6', 'Publicações e prazos': '#8B5CF6', 'Clientes e partes': '#2A78D6', 'Peças e documentos': '#2A78D6',
         'Agenda e tarefas': '#38A3D8', 'Dashboards': '#C98500', 'Estados universais': '#8A93AD'}
# palavras que o proprietário usa e o catálogo não traz (busca)
SIN = {'Combustível': ['abastecimento', 'posto', 'gasolina', 'etanol', 'diesel'], 'Supermercado': ['mercado', 'compras do mês'], 'Farmácia': ['drogaria', 'remédio'], 'Energia': ['luz', 'conta de luz', 'eletricidade'],
       'Água': ['saneamento', 'conta de água'], 'Telefone': ['celular', 'telefonia'], 'Restaurante': ['almoço', 'jantar'], 'Consulta': ['médico'], 'Impostos': ['tributos', 'darf', 'das'], 'Honorários de iniciais': ['honorário', 'inicial'],
       'Anuidade OAB': ['oab', 'ordem dos advogados'], 'Custas': ['taxas judiciais', 'emolumentos'], 'Pedágio': ['sem parar'], 'Streaming': ['netflix', 'tv'], 'Música': ['spotify'], 'Cartão': ['crédito', 'débito', 'fatura']}
NOME_FIX = {'Nova': 'Publicação nova', 'lida': 'Publicação lida', 'não lida': 'Publicação não lida', 'PF': 'Pessoa física', 'PJ': 'Pessoa jurídica'}

def svg_interno(nome):
    p = os.path.join(LUC, 'icons', nome + '.svg')
    if not os.path.exists(p): raise SystemExit('Lucide não tem o ícone: ' + nome)
    t = open(p, encoding='utf-8').read()
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    inner = t[t.index('>', t.index('<svg')) + 1:t.rindex('</svg>')]
    inner = re.sub(r'\s+', ' ', inner).strip().replace(' />', '/>').replace('" />', '"/>')
    return inner

catalogo, vistos, usados, famílias = [], set(), set(), []
for linha in sec.split('\n'):
    m = re.match(r'\*\*(.+?):\*\*\s*(.+)$', linha)
    if not m: continue
    fam, resto = m.group(1).strip(), m.group(2).strip()
    if fam.startswith('Instituições') or fam.startswith('Reconhecimento'): continue   # logos e regras de extrato: Fase 3
    base = ''
    for it in [x.strip() for x in resto.rstrip('.').split(' | ')]:
        if '=' not in it: continue
        nome, ic = it.rsplit('=', 1); nome, ic = nome.strip(), ic.strip()
        faltava = ic.endswith('(x)'); ic = ic.replace('(x)', '').strip()
        nome = NOME_FIX.get(nome, nome)
        if nome[:1].islower() and base: nome = base + ' ' + nome
        elif nome[:1].isupper() and nome not in NOME_FIX.values(): base = nome.split(' ')[0].split('/')[0]
        principal, *alts = [x.strip() for x in nome.split('/')]
        luc = SUBST_NOME.get((principal, ic)) or (SUBST.get(ic) if faltava or not os.path.exists(os.path.join(LUC, 'icons', ic + '.svg')) else ic)
        if not luc: raise SystemExit('sem substituto para ' + ic)
        chave = slug(principal) + '|' + luc
        if chave in vistos: continue
        vistos.add(chave)
        cid = slug(fam) + '_' + slug(principal)
        n = 2
        while any(c[0] == cid for c in catalogo): cid = slug(fam) + '_' + slug(principal) + '_' + str(n); n += 1
        sin = [x for x in alts] + SIN.get(principal, [])
        if fam not in famílias: famílias.append(fam)
        catalogo.append([cid, principal, famílias.index(fam), luc, sin])
        usados.add(luc)
usados.add('circle-help') if os.path.exists(os.path.join(LUC, 'icons', 'circle-help.svg')) else usados.add('circle-question-mark')
desenhos = {n: svg_interno(n) for n in sorted(usados)}
out = ['/* GERADO por cliente/gerar_icones.py (não edite à mão). Catálogo do Banco Central de Ícones e desenhos do Lucide (ISC License, https://lucide.dev: uso livre, inclusive comercial).',
       '   IC_FAMILIAS: [nome, cor sugerida]; IC_CATALOGO: [id, nome, índice da família, ícone Lucide, sinônimos]; IC_LUCIDE: nome do ícone → miolo do SVG (24x24, traço). Só se grava o id no lançamento, nunca o SVG. */',
       'var IC_LUCIDE = ' + json.dumps(desenhos, ensure_ascii=False, separators=(',', ':')) + ';',
       'var IC_FAMILIAS = ' + json.dumps([[f, CORES.get(f, '#8A93AD')] for f in famílias], ensure_ascii=False, separators=(',', ':')) + ';',
       'var IC_CATALOGO = ' + json.dumps(catalogo, ensure_ascii=False, separators=(',', ':')) + ';', '']
open(os.path.join(RAIZ, 'cliente/icones-dados.js'), 'w', encoding='utf-8').write('\n'.join(out))
print(len(catalogo), 'ícones no catálogo;', len(desenhos), 'desenhos;', sum(len(v) for v in desenhos.values()), 'bytes de SVG')
