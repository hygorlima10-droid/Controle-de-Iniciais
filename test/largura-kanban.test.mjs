// Fase 3, etapa 3.2: largura única (1440 px) em todas as abas e na barra do topo, no computador; Kanban em tela cheia; arrastar cartões na Agenda.
// Use: node test/rodar.mjs largura-kanban
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8802', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const dia = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10), agora = new Date().toISOString();
let r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.32' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
const doc = async (col, id) => (await (await f('GET', '/api/db/' + col)).json()).docs.find(d => d.id === id)?.data;
for (const col of ['casos', 'termosAcordo', 'alvaras', 'clientes', 'processos', 'agenda', 'despesas', 'receitasManuais', 'metas', 'saldos', 'config', 'extratos', 'obraMov']) for (const d of (await (await f('GET', '/api/db/' + col)).json()).docs) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora }); await f('PUT', '/api/db/config/importacaoAuto', { ativo: false, desde: agora }); await f('PUT', '/api/db/config/vinculoIniciais', { corte: dia(0) });
const ag = (id, o) => f('PUT', '/api/db/agenda/' + id, { concluido: false, avisos: [], criadoEm: agora, atualizadoEm: agora, situacao: 'afazer', ...o });
await ag('p1', { tipo: 'prazo', titulo: 'Contestação', cliente: 'Joana Teste', data: dia(3), responsaveis: [] });
await ag('p2', { tipo: 'prazo', titulo: 'Embargos', cliente: 'Carlos Teste', data: dia(-2) });
await ag('t1', { tipo: 'tarefa', titulo: 'Ligar para a cliente', cliente: 'Joana Teste', data: dia(0) });
await ag('t2', { tipo: 'tarefa', titulo: 'Conferir cálculo', cliente: 'Carlos Teste', data: dia(10) });
await ag('a1', { tipo: 'audiencia', titulo: 'Audiência de instrução', cliente: 'Carlos Teste', data: dia(5), hora: '09:30' });
await ag('c1', { tipo: 'tarefa', titulo: 'Tarefa antiga feita', cliente: 'X', data: dia(-3), concluido: true, situacao: 'feito', concluidoEm: dia(-3) });
const caso = (id, nome, status) => f('PUT', '/api/db/casos/' + id, { tipo: 'inicial', cliente: nome, nomeAcao: 'Cobrança', origem: 'proprio', prioridade: 'normal', status, statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 1000, avista: { data: dia(10), pago: false }, clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await caso('c1', 'Ana Quadro', 'pendente'); await caso('c2', 'Beto Quadro', 'aguardando_cliente');
await f('PUT', '/api/db/alvaras/v1', { partes: 'Rita × INSS', numeroProcesso: '5100133-44.2025.8.09.0107', origem: 'proprio', status: 'pendente', fase: 'expedido', faseDesde: dia(-5), valorMeuHonorario: 3200, previsaoLevantamento: dia(3), clienteIds: [], criadoEm: agora, atualizadoEm: agora });
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage(); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, rt => rt.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { peticoes: 'quadro', agenda: 'quadro', alvaras: 'fases', clientes: 'lista', processos: 'lista', publicacoes: 'naolidas', financeiro: 'geral', obra: 'tudo' }, per: 6 })); } catch (e) { /* sem armazenamento */ } });
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
const aba = async t => { await page.evaluate(t => document.querySelector('#drawer [data-tab="' + t + '"]').click(), t); await page.waitForTimeout(900); };
const larg = () => page.evaluate(() => ({ wrap: Math.round(document.querySelector('.wrap').getBoundingClientRect().width), topo: Math.round(document.querySelector('.tb-in').getBoundingClientRect().width), esq: Math.round(document.querySelector('.wrap').getBoundingClientRect().left), rolaPagina: document.documentElement.scrollWidth > window.innerWidth + 1 }));
// 1) largura única em todas as abas (1440 px de tela: sobra 1176 ao lado do menu de 264)
const abas = ['inicio', 'peticoes', 'acordos', 'alvaras', 'agenda', 'processos', 'publicacoes', 'clientes', 'arquivados', 'financeiro', 'analises', 'obra', 'extratos'], medidas = {};
for (const t of abas) { await aba(t); medidas[t] = await larg(); if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'larg-' + t + '.png' }); }
const ws = new Set(abas.map(t => medidas[t].wrap)), ts = new Set(abas.map(t => medidas[t].topo));
check(ws.size === 1 && ts.size === 1 && [...ws][0] === [...ts][0], 'as ' + abas.length + ' abas e a barra do topo têm a mesma largura (' + [...ws].join('/') + ' px de ' + [...ts].join('/') + ')');
check([...ws][0] >= 1150, 'a largura passou a usar a tela (antes ficava em 1080 px ou menos)');
check(abas.every(t => !medidas[t].rolaPagina), 'nenhuma aba rola a página para o lado');
// 2) monitor grande: o limite de 1440 vale para todas
await page.setViewportSize({ width: 1920, height: 900 }); await page.waitForTimeout(400);
const grande = {}; for (const t of ['agenda', 'obra', 'analises', 'clientes']) { await aba(t); grande[t] = await larg(); }
check(Object.values(grande).every(m => m.wrap === 1440 && m.topo === 1440), 'em tela de 1920 px o limite único é 1440 px (conteúdo e barra do topo), centralizado');
await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(400);
// 3) Kanban inteiro à vista
const cabe = s => page.evaluate(s => { const k = document.querySelector(s); if (!k) return null; const cs = Array.from(k.children).filter(c => c.offsetParent); const R = k.getBoundingClientRect(); return { rola: k.scrollWidth > k.clientWidth + 1, dentro: cs.every(c => c.getBoundingClientRect().right <= R.right + 1), n: cs.length, menor: Math.min(...cs.map(c => Math.round(c.getBoundingClientRect().width))) }; }, s);
await aba('agenda'); await page.waitForTimeout(500);
let kb = await cabe('.ag-quadro');
check(kb && !kb.rola && kb.dentro && kb.n === 6, 'Agenda → Quadro por urgência: as 6 colunas cabem na tela, sem rolar de lado');
check(await page.evaluate(() => { const c = document.querySelector('.ag-col-feito'); return c.classList.contains('recolhida') && c.getBoundingClientRect().width < 80; }), '“Concluído” começa como uma trilha estreita');
await page.evaluate(() => window.__horusTeste.mdIrSub('peticoes', 'quadro', false)); await aba('peticoes'); kb = await cabe('#kanbanPeticoes');
check(kb && !kb.rola && kb.dentro, 'Iniciais → Quadro: todas as colunas à vista (' + (kb && kb.n) + ' colunas, a menor com ' + (kb && kb.menor) + ' px)');
await aba('alvaras'); kb = await cabe('#kanbanAlvaras');
check(kb && !kb.rola && kb.dentro, 'Alvarás → Fases: todas as colunas à vista (' + (kb && kb.n) + ' colunas)');
// 4) arrastar na Agenda
await aba('agenda'); await page.waitForTimeout(400);
await page.click('#agModo [data-v="situacao"]'); await page.waitForTimeout(500);
check(/Arraste um cartão entre as colunas/.test(await page.evaluate(() => document.querySelector('.ag-dica').innerText)), 'a tela explica que dá para arrastar');
await page.locator('[data-agcard="a:t1"]').dragTo(page.locator('[data-agcol="elaboracao"]'), { sourcePosition: { x: 30, y: 14 }, targetPosition: { x: 40, y: 22 } }); await page.waitForTimeout(1200);
check((await doc('agenda', 't1')).situacao === 'elaboracao', 'arrastar “A fazer” → “Em andamento” muda a situação');
await page.locator('[data-agcard="a:t1"]').dragTo(page.locator('[data-agcol="afazer"]'), { sourcePosition: { x: 30, y: 14 }, targetPosition: { x: 40, y: 22 } }); await page.waitForTimeout(1200);
check((await doc('agenda', 't1')).situacao === 'afazer', 'e arrastar de volta devolve para “A fazer”');
await page.locator('[data-agcard="a:t2"]').dragTo(page.locator('[data-agcol="feito"]'), { sourcePosition: { x: 30, y: 14 }, targetPosition: { x: 40, y: 22 } }); await page.waitForTimeout(1500);
check((await doc('agenda', 't2')).concluido === true, 'arrastar para “Concluído” conclui o compromisso');
await page.locator('[data-agcard="a:t2"]').dragTo(page.locator('[data-agcol="afazer"]'), { sourcePosition: { x: 30, y: 14 }, targetPosition: { x: 40, y: 22 } }); await page.waitForTimeout(1500);
check((await doc('agenda', 't2')).concluido === false, 'arrastar o concluído para “A fazer” reabre');
await page.locator('[data-agcard="a:a1"]').dragTo(page.locator('[data-agcol="elaboracao"]'), { sourcePosition: { x: 30, y: 14 }, targetPosition: { x: 40, y: 22 } }); await page.waitForTimeout(800);
check((await doc('agenda', 'a1')).situacao === 'afazer', 'audiência não vai para “Em andamento” (não faz sentido)');
await page.click('#agModo [data-v="urgencia"]'); await page.waitForTimeout(500);
const dataAntes = (await doc('agenda', 'p1')).data;
await page.locator('[data-agcard="a:p1"]').dragTo(page.locator('[data-agcol="hoje"]'), { sourcePosition: { x: 30, y: 14 }, targetPosition: { x: 40, y: 22 } }); await page.waitForTimeout(800);
check((await doc('agenda', 'p1')).data === dataAntes && !(await doc('agenda', 'p1')).concluido, 'por urgência, arrastar para “Hoje” NÃO muda a data do prazo');
await page.locator('[data-agcard="a:p1"]').dragTo(page.locator('[data-agcol="feito"]'), { sourcePosition: { x: 30, y: 14 }, targetPosition: { x: 20, y: 22 } }); await page.waitForTimeout(800);
check(await page.evaluate(() => document.getElementById('overlayAgProt') && document.getElementById('overlayAgProt').classList.contains('show')), 'por urgência, soltar um prazo em “Concluído” abre a pergunta da data do protocolo (como o botão “Marcar protocolada”)');
await page.click('#agpOk'); await page.waitForTimeout(1500);
check((await doc('agenda', 'p1')).concluido === true, 'confirmada a data, o prazo fica concluído');
await page.click('.ag-col-feito .kanban-col-head'); await page.waitForTimeout(400);
check(await page.evaluate(() => !document.querySelector('.ag-col-feito').classList.contains('recolhida')), 'tocar na trilha abre a coluna “Concluído”');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
