// Testa a importação de compromissos da Agenda por arquivo XML (Control Jus): leitura, conferência, tipos, status, horas (dia inteiro com hora no título e horário divergente),
// número do processo (vinculado ou na observação), equipe x partes, clientes (exato, parecido, novo), processos novos, duplicados e reimportação.
// Os arquivos são gerados aqui, com datas relativas a hoje e nomes fictícios.   Rode:  node test/rodar.mjs agenda-importar
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), agora = new Date().toISOString();
const dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const br_ = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
const cd = s => '<![CDATA[' + s + ']]>';
const comp = o => `    <compromisso>
      <titulo>${cd(o.titulo)}</titulo>
      <isAtividade>${cd('Não')}</isAtividade>
      <dataHoraInicio>${cd(br_(o.data) + ' ' + (o.ini || '00:00:00'))}</dataHoraInicio>
      <dataHoraTermino>${cd(br_(o.data) + ' ' + (o.fim || '23:59:00'))}</dataHoraTermino>
      <diaInteiro>${cd(o.ini ? 'Não' : 'Sim')}</diaInteiro>
      <tipo>${cd(o.tipo)}</tipo>
      <subtipo>${cd(o.subtipo || '')}</subtipo>
      <prioridade>${cd(o.prioridade || '')}</prioridade>
      <participantes>
${(o.part || []).map(p => '        <participante>' + cd(p) + '</participante>').join('\n')}
      </participantes>
      <status>${cd(o.status || 'Pendente')}</status>
      <publico>${cd('True')}</publico>
      <observacoes>${cd(o.obs || '')}</observacoes>
      <dataCadastro>${cd('01/11/2026 10:00:00')}</dataCadastro>
      <notificacoes>
      </notificacoes>
      <atividades>
      </atividades>
      <processosVinculados>
${o.proc ? `         <processo>
          <identificador>${cd('PROC-' + o.proc.cod)}</identificador>
          <titulo>${cd(o.proc.num)}</titulo>
          <orgao>${cd('TJ-GO')}</orgao>
          <ultimaMov>${cd('01/11/2026 00:00:00')}</ultimaMov>
          <reponsaveis>
          </reponsaveis>
        </processo>` : ''}
      </processosVinculados>
      <comentarios>
      </comentarios>
    </compromisso>`;
const xml = l => `<?xml version="1.0" encoding="UTF-8"?>\n\n<compromissos>\n${l.map(comp).join('\n')}\n</compromissos>\n`;
const N1 = '5392788-08.2026.8.09.0107', N2 = '5258795-97.2025.8.09.0107', N3 = '6064267-09.2026.8.09.0108', N4 = '5566967-18.2026.8.09.0107', N6 = '5896481-40.2026.8.09.0107', dig = n => n.replace(/\D/g, '');
const I1 = { titulo: 'Contestação ', tipo: 'Prazo', data: dia(5), part: ['Hygor Lima Andrade', 'Cliente Exato Silva'], proc: { cod: '466', num: N1 } };
const I2 = { titulo: 'manifestar', tipo: 'Prazo', data: dia(-2), status: 'Concluído', part: ['Estagiários', 'Hygor Lima Andrade', 'Maria Parecida Souza', 'Novo Cliente Ltda'], proc: { cod: '089', num: N2 } };
const I3 = { titulo: 'audiência 13:30', tipo: 'Audiência', data: dia(8), part: ['Estagiários', 'MURILO FALONE ROCHA', 'Novo Cliente Ltda'], obs: N3 + '\n' };
const I4 = { titulo: 'audiência  conciliação ' + br_(dia(9)) + ' 13:00)', tipo: 'Audiência', data: dia(9), ini: '12:45:00', fim: '16:00:00', part: ['Estagiários', 'Hygor Lima Andrade', 'Adineu Alves Da Silva'], proc: { cod: '475', num: N4 } };
const I5 = { titulo: 'Juntar planilha Eduardo Lopes TO', tipo: 'Andamento', data: dia(-1), status: 'Concluído', part: ['Hygor Lima Andrade', 'COOPERATIVA MISTA DOS PRODUTORES DE LEITE DE MORRINHOS'] };
const I6 = { titulo: 'Agravo de Instrumento ', tipo: 'Prazo', data: dia(3), prioridade: 'Alta', subtipo: 'Interposição de agravo de instrumento - CPC, art. 1.015', part: ['Hygor Lima Andrade', 'Cliente Exato Silva'], obs: 'Cliente pediu urgência. Ação nº 1.', proc: { cod: '488', num: N6 } };
const I7 = { titulo: 'emenda', tipo: 'Prazo', data: dia(4), part: ['Estagiários'] };
const I8 = { titulo: 'Perícia 14:00', tipo: 'Audiência', data: dia(20), part: ['Hygor Lima Andrade', 'Novo Cliente Ltda - Filial', 'COOPERATIVA AGROPECUARIA MISTA DE PIRACANJUBA'] };   // Filial: o mesmo cliente do compromisso 2, escrito de outro jeito; as duas cooperativas: Complem (compromisso 5) e Coapil
const dir = join(tmpdir(), 'horus-agenda-importar'); mkdirSync(dir, { recursive: true });
const A1 = join(dir, 'Agenda_1.xml'), A2 = join(dir, 'Agenda_2.xml'), PDF = join(dir, 'Agenda.pdf'), RUIM = join(dir, 'ruim.xml');
writeFileSync(A1, xml([I1, I2, I3, I4, I5, I6, I7])); writeFileSync(A2, xml([I1, I8])); writeFileSync(PDF, '%PDF-1.4 teste'); writeFileSync(RUIM, '<html><body>nao e agenda</body></html>');

const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.97' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { s: x.status, j: await x.json().catch(() => ({})) }; };
const docs = async col => ((await f('GET', '/api/db/' + col)).j.docs || []).map(d => ({ id: d.id, ...d.data }));
for (const col of ['agenda', 'processos', 'clientes', 'casos', 'config']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
await f('PUT', '/api/db/config/backup', { ultimoEm: agora }); await f('PUT', '/api/db/config/importacaoAuto', { ativo: false, desde: agora }); await f('PUT', '/api/db/config/processosIgnorados', { numeros: {} }); await f('PUT', '/api/db/config/vinculoIniciais', { corte: hoje });
await f('PUT', '/api/db/clientes/cexato', { nome: 'Cliente Exato Silva', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/cparec', { nome: 'Maria Souza', pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/complem', { nome: 'Complem', apelidos: ['Cooperativa Mista dos Produtores de Leite de Morrinhos - Complem'], vinculoAuto: true, pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/clientes/coapil', { nome: 'Coapil', apelidos: ['COOPERATIVA AGROPECUARIA MISTA DE PIRACANJUBA - COAPIL'], pagador: 'cliente', criadoEm: agora });
await f('PUT', '/api/db/processos/d' + dig(N1), { numero: N1, partes: 'Cliente Exato Silva x Banco', clienteIds: ['cexato'], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
await f('PUT', '/api/db/agenda/pre1', { tipo: 'prazo', titulo: 'emenda', processo: '', data: dia(4), situacao: 'afazer', concluido: false, criadoEm: agora });   // parece o compromisso 7 (mesma data, tipo e título)
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'America/Sao_Paulo' });
await ctx.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } });
const page = await ctx.newPage(); await page.addInitScript(() => { try { if (!localStorage.getItem('horus.subaba.v1')) localStorage.setItem('horus.subaba.v1', JSON.stringify({ sub: { processos: 'lista', agenda: 'semana', publicacoes: 'naolidas', clientes: 'lista' }, per: 6 })); } catch (e) { /* sem armazenamento */ } }); const erros = []; page.on('pageerror', e => erros.push(e.message)); await page.route(/fonts\./, x => x.abort());
await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(4000);
const t = s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
await page.evaluate(() => document.querySelector('#drawer [data-tab="agenda"]').click()); await page.waitForTimeout(1000);

/* 1) onde fica e erros de arquivo */
await page.click('[data-ag="menu"]'); await page.waitForTimeout(200);
check(/Importar/.test(await t('.ag-menu')), 'a aba Agenda tem o botão "Importar" (no menu ⋯)');
await page.click('[data-ag="importar"]'); await page.waitForTimeout(500);
check(await page.evaluate(() => document.getElementById('overlayAgi').classList.contains('show')) && /Escolher arquivo XML/.test(await t('#agiC')), 'abre a tela de importação');
await page.setInputFiles('#agiArq', PDF); await page.waitForTimeout(500);
check(/PDF/.test(await t('#agiC')) && /só o XML/.test(await t('#agiC')), 'arquivo PDF: avisa que por enquanto só lê XML');
await page.setInputFiles('#agiArq', RUIM); await page.waitForTimeout(500);
check(/não parece uma agenda/.test(await t('#agiC')), 'arquivo que não é agenda: mensagem clara');
/* 2) ler dois arquivos (um compromisso repetido entre eles) */
await page.setInputFiles('#agiArq', [A1, A2]); await page.waitForTimeout(900);
let tx = await t('#agiC');
check(/8 compromissos encontrados/i.test(tx) && /1 repetido\(s\) entre os arquivos/.test(tx), 'lê os dois arquivos e junta o compromisso repetido: 8 compromissos (' + tx.slice(0, 120).replace(/\n/g, ' ') + ')');
check(/4 prazos, 3 audiências, 1 tarefas/.test(tx), 'conta os tipos (prazos, audiências, tarefas): ' + (tx.match(/\d+ prazos[^.]*\./) || [''])[0]);
const nomesCli = await page.evaluate(() => Array.from(document.querySelectorAll('#agiC .pb-card')).filter(c => c.querySelector('select[data-agi="decisao"]')).map(c => c.innerText.split('\n')[0]));
check(/Clientes e partes \(7\)/i.test(tx) && nomesCli.length === 7, 'as partes são 7 nomes (' + nomesCli.join(' | ') + ')');
check(!nomesCli.some(n => /Estagi|Hygor|Murilo/i.test(n)), 'a equipe (Estagiários, Hygor, MURILO FALONE ROCHA) não entra na lista de clientes');
check(/responsável: Estagiários/.test(tx) && /responsável: Hygor Lima Andrade/.test(tx) && /responsável: MURILO FALONE ROCHA/.test(tx), 'a equipe aparece como responsável de cada compromisso');
const sel = n => page.evaluate(n => { const s = Array.from(document.querySelectorAll('#agiC select[data-agi="decisao"]')).find(x => x.closest('.pb-card').innerText.startsWith(n)); return s ? { v: s.value, o: Array.from(s.options).map(x => x.text) } : null; }, n);
const sExato = await sel('Cliente Exato Silva'), sPar = await sel('Maria Parecida Souza'), sNovo = await sel('Novo Cliente Ltda'), sAdi = await sel('Adineu Alves Da Silva');
check(sExato && sExato.v === 'c:cexato' && /Cliente cadastrado: Cliente Exato Silva/.test(sExato.o[0]), 'nome igual a um cliente: já vem ligado ao cadastro');
check(sPar && sPar.v === 'sem' && /Ligar a: Maria Souza/.test(sPar.o[0]), 'nome parecido (Maria Parecida Souza x Maria Souza): não liga sozinho, oferece ligar');
const sMista = await sel('COOPERATIVA MISTA'), sAgro = await sel('COOPERATIVA AGROPECUARIA'), sFilial = await sel('Novo Cliente Ltda - Filial');
check(sMista && sMista.v === 'c:complem' && !sMista.o.some(x => /Coapil/.test(x)), 'cooperativa Complem (nome sem a sigla): liga sozinha ao Complem, que está marcado para vincular automaticamente, e o Coapil nem é oferecido');
check(sAgro && sAgro.v === 'sem' && sAgro.o.some(x => /Coapil/.test(x)) && !sAgro.o.some(x => /Complem/.test(x)), 'cooperativa Coapil (sem a sigla): só oferece o Coapil, nunca o Complem, e não liga sem você escolher');
check(sFilial && sFilial.v === 'novo' && sFilial.o.some(x => /Mesmo cliente que: Novo Cliente Ltda$/.test(x)) && /Parecido com outro nome deste arquivo/.test(await t('#agiC')), 'dois nomes parecidos no arquivo: não junta sozinho; avisa e oferece "Mesmo cliente que…"');
check(sNovo && sNovo.v === 'novo' && sAdi && sAdi.v === 'novo', 'nome que não existe (inclui o Adineu): vem para cadastrar como cliente novo');
check(/12:45/.test(tx) && /13:00/.test(tx) && /Horário diferente: o arquivo diz 12:45, o título diz 13:00/.test(tx), 'horário do arquivo (12:45) diferente do título (13:00): mostra o aviso para escolher');
check(/13:30/.test(tx), 'dia inteiro com a hora no título ("audiência 13:30"): reconhece 13:30');
check(/número lido da observação/.test(tx) && /Prioridade alta/.test(tx) && /era “Andamento”/.test(tx), 'número na observação, prioridade Alta e Andamento→Tarefa são reconhecidos');
check(/parece já estar na agenda/.test(tx), 'compromisso igual a um já existente (data, tipo e título): avisa');
const marcado = n => page.evaluate(n => { const c = Array.from(document.querySelectorAll('#agiC .pb-card')).find(x => x.innerText.trim().startsWith(n) && x.querySelector('input[data-agi="sel"]')); return c ? c.querySelector('input').checked : null; }, n);
check((await marcado('emenda')) === false && (await marcado('Contestação')) === true, 'o parecido vem desmarcado; os demais marcados');
/* 3) escolher: ligar o parecido à Maria Souza e importar */
await page.evaluate(() => { const s = Array.from(document.querySelectorAll('#agiC select[data-agi="decisao"]')).find(x => x.closest('.pb-card').innerText.startsWith('Maria Parecida Souza')); s.value = 'c:cparec'; s.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(300);
await page.evaluate(() => { const pick = (ini, v) => { const s = Array.from(document.querySelectorAll('#agiC select[data-agi="decisao"]')).find(x => x.closest('.pb-card').innerText.startsWith(ini)); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }; pick('COOPERATIVA AGROPECUARIA', 'c:coapil'); pick('Novo Cliente Ltda - Filial', 'm:novo cliente ltda'); });
await page.waitForTimeout(300);
await page.evaluate(() => Array.from(document.querySelectorAll('#agiC button')).find(b => /^Importar \d+/.test(b.innerText)).click()); await page.waitForTimeout(3500);
tx = await t('#agiC');
check(/Compromissos importados\s*7/.test(tx) && /Prazos · Audiências · Tarefas\s*3 · 3 · 1/.test(tx) && /Pendentes · Concluídos\s*5 · 2/.test(tx), 'resultado: 7 importados (3 prazos, 3 audiências, 1 tarefa; 5 pendentes e 2 concluídos): ' + tx.replace(/\n/g, ' ').slice(0, 260));
check(/Ligados a um processo\s*5/.test(tx) && /já cadastrados\s*1/.test(tx) && /cadastrados agora\s*4/.test(tx) && /Sem número de processo\s*2/.test(tx), 'processos: 5 compromissos ligados (1 já existia, 4 cadastrados agora), 2 sem número');
const ag = await docs('agenda'), por = tit => ag.find(d => d.titulo === tit);
check(ag.length === 8 && ag.filter(d => d.origem === 'controljus').length === 7, 'gravou 7 compromissos novos (mais o que já existia)');
const c1 = por('Contestação'), c2 = por('manifestar'), c3 = por('audiência 13:30'), c4 = ag.find(d => /conciliação/.test(d.titulo)), c5 = por('Juntar planilha Eduardo Lopes TO'), c6 = por('Agravo de Instrumento');
check(c1 && c1.data === dia(5) && c1.tipo === 'prazo' && c1.processo === N1 && c1.situacao === 'afazer' && c1.concluido === false && c1.cliente === 'Cliente Exato Silva' && JSON.stringify(c1.clienteIds) === '["cexato"]', 'prazo: data, tipo, processo, título como veio (só sem espaços nas pontas), cliente ligado');
check(c1.avisos.join() === '5,2,1,0' && c1.trabalhar, 'prazo pendente futuro: recebe os avisos padrão e a data de trabalho');
check(c2 && c2.concluido === true && c2.situacao === 'feito' && c2.protocoladoEm === dia(-2) && c2.avisos.length === 0 && c2.responsaveis.join() === 'Estagiários,Hygor Lima Andrade', 'prazo concluído: usa a data como conclusão, sem avisos; responsáveis guardados');
check(c2.clienteIds.includes('cparec') && c2.clienteIds.length === 2 && c2.partes.join() === 'Maria Parecida Souza,Novo Cliente Ltda', 'o parecido foi ligado à Maria Souza e o nome novo virou cliente (2 clientes ligados)');
check(c3 && c3.tipo === 'audiencia' && c3.hora === '13:30' && c3.processo === N3 && c3.audTipo === 'Outra' && c3.obs.trim() === N3, 'audiência de dia inteiro: hora 13:30 do título, número lido da observação');
check(c4 && c4.hora === '12:45' && c4.audTipo === 'Conciliação' && c4.processo === N4, 'audiência com horário no arquivo: 12:45 (arquivo) e tipo Conciliação pelo título; Adineu ligado como cliente novo');
check(c5 && c5.tipo === 'tarefa' && c5.concluido === true && !c5.processo, 'Andamento vira Tarefa concluída, sem processo');
check(c6 && c6.prioridade === 'Alta' && /Interposição/.test(c6.subtipo) && c6.obs === 'Cliente pediu urgência. Ação nº 1.' && c6.codigoControlJus === 'PROC-488', 'prioridade, subtipo, observação e código do Control Jus guardados');
const P = await docs('processos'), pp = n => P.find(d => dig(d.numero) === dig(n));
check(P.length === 5 && pp(N2) && pp(N3) && pp(N4) && pp(N6) && pp(N1).origem === 'manual', 'processo existente não foi alterado; 4 processos novos cadastrados');
check(pp(N2).origem === 'agenda' && pp(N2).clienteIds.length === 2 && !pp(N2).revisar, 'processo novo com clientes escolhidos: já vinculado, sem ir para Revisar');
check(pp(N3).clienteIds.length === 1 && pp(N4).clienteIds.length === 1, 'processos novos das audiências ligados aos clientes novos (Novo Cliente Ltda e Adineu)');
const C = await docs('clientes');
check(C.length === 6 && C.some(c => c.nome === 'Novo Cliente Ltda' && c.origem === 'agenda' && (c.apelidos || []).includes('Novo Cliente Ltda - Filial')) && C.some(c => c.nome === 'Adineu Alves da Silva'), 'clientes novos cadastrados com o nome tratado (Adineu Alves da Silva): ' + C.map(c => c.nome).join(' | '));
check(!C.some(c => /Estagi|Hygor|Murilo/i.test(c.nome)), 'equipe não virou cliente');
const c8 = ag.find(d => /Perícia/.test(d.titulo)); const novoId = (C.find(c => c.nome === 'Novo Cliente Ltda') || {}).id;
check(c8 && c8.hora === '14:00' && c8.clienteIds.length === 2 && c8.clienteIds.includes(novoId) && c8.clienteIds.includes('coapil') && !c8.clienteIds.includes('complem'), 'perícia: "Ltda - Filial" ligada ao mesmo cadastro do Novo Cliente Ltda (sem duplicar) e a cooperativa ligada ao Coapil, nunca ao Complem; hora 14:00 do título');
check(c5.clienteIds.join() === 'complem' && !c5.clienteIds.includes('coapil'), 'Andamento com a cooperativa Complem: ligado só ao Complem');
const cpl = C.find(c => c.id === 'complem'), cpa = C.find(c => c.id === 'coapil');
check((cpl.apelidos || []).some(a => /^Cooperativa Mista Dos Produtores De Leite De Morrinhos$/i.test(a)) && (cpa.apelidos || []).some(a => /^Cooperativa Agropecuaria Mista De Piracanjuba$/i.test(a)), 'o que foi confirmado vira apelido do cliente certo (Complem e Coapil), para reconhecer sozinho da próxima vez');
check(!(cpl.apelidos || []).some(a => /piracanjuba|coapil/i.test(a)) && !(cpa.apelidos || []).some(a => /morrinhos|complem/i.test(a)), 'nenhum apelido de uma cooperativa vazou para a outra');
/* 4) a agenda mostra os itens */
await page.click('#agiC [data-agi="agenda"]'); await page.waitForTimeout(600);
await page.evaluate(() => document.querySelector('[data-ag="vista"][data-v="lista"]').click()); await page.waitForTimeout(600);
const lista = await t('#agWrap');
check(/Contestação/.test(lista) && /Agravo de Instrumento/.test(lista) && /Prioridade alta/.test(lista), 'a Agenda (lista) mostra os compromissos importados e a prioridade alta');
/* 5) importar o mesmo arquivo de novo não duplica */
await page.click('[data-ag="menu"]'); await page.click('[data-ag="importar"]'); await page.waitForTimeout(400); await page.setInputFiles('#agiArq', [A1, A2]); await page.waitForTimeout(900);
tx = await t('#agiC');
check((tx.match(/já está na agenda · pula/g) || []).length === 7, 'reimportar: os 7 já importados aparecem como "já está na agenda · pula"');
check(!(await page.evaluate(() => Array.from(document.querySelectorAll('#agiC input[data-agi="sel"]')).some(c => c.checked && !c.disabled && c.closest('.pb-card').innerText.includes('pula')))), 'e ficam desmarcados e travados');
await page.evaluate(() => document.querySelector('#overlayAgi [data-agi="fechar"]').click());
check((await docs('agenda')).length === 8 && (await docs('processos')).length === 5 && (await docs('clientes')).length === 6, 'nada foi duplicado (agenda, processos e clientes iguais)');
/* 6) o editor guarda a observação */
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
