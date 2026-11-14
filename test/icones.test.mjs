// Testa o Banco Central de Ícones (Fase 2, etapa 2.1): catálogo, desenhos do Lucide, resolvedor (ordem: salvo → regras antigas → catálogo → genérico), busca e compatibilidade
// com o que o app já mostrava. É uma base invisível: nenhuma tela usa os ícones novos ainda.   Rode:  node test/rodar.mjs icones
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const dados = readFileSync(new URL('../cliente/icones-dados.js', import.meta.url), 'utf8');
check(dados.length < 120000 && /ISC License/.test(dados) && /Lucide/.test(dados), 'o arquivo de dados é pequeno (' + Math.round(dados.length / 1024) + ' KB) e mantém o aviso de licença do Lucide (ISC)');
const br = await chromium.launch(); const page = await (await br.newContext({ viewport: { width: 390, height: 900 } })).newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const T = (fn, arg) => page.evaluate(fn, arg);
/* catálogo e desenhos */
const info = await T(() => { const fam = window.__horusTeste.icFamilias(), todos = fam.flatMap(f => f.itens), ids = todos.map(i => i.id);
  const semDesenho = todos.filter(i => !window.__horusTeste.icSvg(i.id).includes('<path') && !window.__horusTeste.icSvg(i.id).includes('<circle') && !window.__horusTeste.icSvg(i.id).includes('<rect') && !window.__horusTeste.icSvg(i.id).includes('<line')).length;
  const mal = todos.filter(i => { const d = new DOMParser().parseFromString(window.__horusTeste.icSvg(i.id), 'image/svg+xml'); return !!d.querySelector('parsererror'); }).length;
  return { n: todos.length, fam: fam.length, unicos: new Set(ids).size, semDesenho, mal, vazias: fam.filter(f => !f.itens.length).length, x: todos.filter(i => /\(x\)/.test(i.nome + i.id)).length, formato: ids.every(i => /^[a-z0-9_]+$/.test(i)) }; });
check(info.n >= 400 && info.fam >= 25 && info.vazias === 0, 'o catálogo traz ' + info.n + ' ícones em ' + info.fam + ' famílias, nenhuma vazia');
check(info.unicos === info.n && info.formato, 'os identificadores são únicos e estáveis (só letras minúsculas, números e _)');
check(info.semDesenho === 0 && info.mal === 0, 'todo ícone tem desenho e o SVG é válido (sem trechos quebrados)');
check(info.x === 0, 'nenhum nome marcado como indisponível ficou no catálogo (os 7 sem desenho no Lucide têm substituto)');
/* resolvedor */
const r1 = await T(() => { const t = window.__horusTeste, a = t.icResolver({ rotulo: 'Qualquer coisa', icone: 'transporte_combustivel' }); return { origem: a.origem, id: a.id, nome: a.nome, temMiolo: a.miolo.length > 20, cor: a.cor }; });
check(r1.origem === 'salvo' && r1.id === 'transporte_combustivel' && r1.nome === 'Combustível' && r1.temMiolo, 'ícone gravado no lançamento (identificador) vence qualquer regra');
const r2 = await T(() => { const t = window.__horusTeste, a = t.icResolver({ rotulo: 'Posto Shell' }), v = window.__horusTeste.ctVisual('Posto Shell'); return { origem: a.origem, igual: a.miolo === window.__horusTeste.CT_SVG[v.ic] && a.cor === v.cor }; });
check(r2.origem === 'regra-antiga' && r2.igual, 'sem ícone gravado, as regras antigas continuam valendo (mesmo desenho e mesma cor de hoje)');
const r3 = await T(() => { const t = window.__horusTeste, a = t.icResolver({ rotulo: 'Pet shop' }); return { origem: a.origem, id: a.id }; });
check(r3.origem === 'catalogo' && r3.id === 'lazer_e_pessoais_pet_shop', 'nome que as regras antigas não conhecem, mas igual ao do catálogo: usa o catálogo');
const r4 = await T(() => { const t = window.__horusTeste, a = t.icResolver({ rotulo: 'Coisa Totalmente Desconhecida 123' }), v = window.__horusTeste.ctVisual('Coisa Totalmente Desconhecida 123'); return { origem: a.origem, igual: a.miolo === window.__horusTeste.CT_SVG[v.ic] && a.cor === v.cor }; });
check(r4.origem === 'padrao' && r4.igual, 'nome desconhecido: o mesmo ícone padrão que o app já mostrava (nada muda para o usuário)');
const r5 = await T(() => { const t = window.__horusTeste, a = t.icResolver({ rotulo: 'Qualquer', icone: 'id_que_nao_existe' }), b = t.icSvg('id_que_nao_existe'); return { origem: a.origem, svg: /<svg/.test(b) && b.length > 100 }; });
check(r5.origem !== 'salvo' && r5.svg, 'ícone gravado que não existe mais cai em outro (sem quebrar a tela) e o SVG genérico é devolvido');
const r6 = await T(() => { const t = window.__horusTeste; t.icAlias['id_antigo_x'] = 'transporte_combustivel'; const a = t.icResolver({ icone: 'id_antigo_x' }); delete t.icAlias['id_antigo_x']; return a.id; });
check(r6 === 'transporte_combustivel', 'um identificador antigo pode apontar para o novo (aliases), sem renomear o que já foi gravado');
const r7 = await T(() => { const t = window.__horusTeste; const a = t.icResolver({ icone: 'transporte_combustivel', cor: '#123456' }), svg = t.icSvg('transporte_combustivel', { tamanho: 32, cor: '#abc' }), bol = t.icBolinha(a, true); return { cor: a.cor, svg: /width="32"/.test(svg) && /stroke="#abc"/.test(svg), bol: /class="ct-ic sm"/.test(bol) && /background:#123456/.test(bol) }; });
check(r7.cor === '#123456' && r7.svg && r7.bol, 'a cor pode ser escolhida (ícone ≠ categoria); o SVG aceita tamanho e cor; a bolinha tem a mesma forma das telas atuais');
/* busca */
const b1 = await T(() => window.__horusTeste.icBuscar('abastecimento').slice(0, 3).map(i => i.nome));
check(b1[0] === 'Combustível', 'busca por sinônimo: "abastecimento" acha Combustível (' + b1.join(', ') + ')');
const b2 = await T(() => ({ a: window.__horusTeste.icBuscar('ENERGIA').map(i => i.id), b: window.__horusTeste.icBuscar('energia').map(i => i.id), c: window.__horusTeste.icBuscar('farmacia')[0].nome, d: window.__horusTeste.icBuscar('luz')[0].nome }));
check(JSON.stringify(b2.a) === JSON.stringify(b2.b) && b2.b.length >= 1 && b2.c === 'Farmácia' && b2.d === 'Energia', 'a busca ignora maiúsculas e acentos ("farmacia" acha Farmácia; "luz" acha Energia)');
const b3 = await T(() => ({ vazio: window.__horusTeste.icBuscar('').length, nada: window.__horusTeste.icBuscar('xyzqwk').length, lim: window.__horusTeste.icBuscar('a', 5).length }));
check(b3.vazio === 0 && b3.nada === 0 && b3.lim <= 5, 'busca vazia ou sem resultado devolve lista vazia e respeita o limite');
const b4 = await T(() => window.__horusTeste.icBuscar('processo').slice(0, 4).map(i => i.familia));
check(b4.length === 4 && b4.every(f => f === 'Processos'), 'busca por família/nome: "processo" traz os ícones de Processos');
/* a base é invisível: as telas continuam com os ícones de sempre */
const tela = await T(() => { const a = window.__horusTeste.ctIcone('Posto Shell', true), b = window.__horusTeste.fvIc('check', '#17895A'); return { a: /<svg viewBox="0 0 24 24">/.test(a), b: /ct-ic sm/.test(b) }; });
check(tela.a && tela.b, 'ctIcone e fvIc (os ícones das telas de hoje) continuam como eram');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
