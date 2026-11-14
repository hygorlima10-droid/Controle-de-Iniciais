// Testa o registro dos advogados participantes: a partir das publicações do DJEN (advs e OABs que acharam o processo), os advogados NOSSOS
// (OABs cadastradas) são gravados em processos, Iniciais, Acordos e Alvarás; advogados de fora não entram; nada é tirado; a importação já grava.
// O Diário Oficial é simulado na porta 8890.   Rode:  node test/rodar.mjs advogados-participantes
import http from 'node:http';
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), dia = n => new Date(Date.parse(hoje + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const num = k => '71' + String(k).padStart(5, '0') + '-20.2026.8.09.0107', dig = n => n.replace(/\D/g, '');
let seq = 7000;
const adv = (nome, n, uf = 'GO') => ({ advogado: { nome, numero_oab: n, uf_oab: uf } });
const it = (k, advs) => ({ id: ++seq, data_disponibilizacao: dia(-2), siglaTribunal: 'TJGO', tipoComunicacao: 'Intimação', tipoDocumento: 'Decisão', nomeOrgao: 'Morrinhos - 1ª Vara Cível', nomeClasse: 'PROCEDIMENTO COMUM', numero_processo: dig(num(k)), numeroprocessocommascara: num(k), texto: 'AUTOR: FULANO ' + k + '\nRÉU: BANCO X\nVALOR DA CAUSA: R$ 5.000,00\nDECISÃO\nIntime-se.', link: '', destinatarios: [{ nome: 'FULANO ' + k, polo: 'A' }], destinatarioadvogados: advs });
const H = [it(1, [adv('HYGOR LIMA ANDRADE', '60456'), adv('ADVOGADO DE FORA', '99999')]), it(2, [adv('HYGOR LIMA ANDRADE', '060456'), adv('MURILO FALONE', '49308')]), it(5, [adv('ADVOGADO DE FORA', '88888')])];
const M = [it(2, [adv('HYGOR LIMA ANDRADE', '060456'), adv('MURILO FALONE', '49308')]), it(3, [])];   // processo 3: a publicação não traz advogados; só a OAB do Murilo a achou
const dados = { '60456': H, '49308': M };
const fake = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), l = dados[u.searchParams.get('numeroOab')] || [];
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', count: l.length, items: Number(u.searchParams.get('pagina') || 1) > 1 ? [] : l }));
}).listen(8890);
await new Promise(ok => fake.on('listening', ok));
const r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.91' } }); const ck = r.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const get = async (col, id) => ((await f('GET', '/api/db/' + col)).j.docs || []).find(d => d.id === id)?.data;
for (const col of ['processos', 'casos', 'termosAcordo', 'alvaras', 'clientes', 'agenda', '_pub']) for (const d of (await f('GET', '/api/db/' + col)).j.docs || []) await f('DELETE', '/api/db/' + col + '/' + d.id);
const agora = new Date().toISOString();
await f('PUT', '/api/db/config/backup', { ultimoEm: agora });
for (let k = 1; k <= 4; k++) await f('PUT', '/api/db/processos/p' + k, { numero: num(k), partes: 'Fulano ' + k + ' x Banco X', orgao: 'TJGO', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
await f('PUT', '/api/db/processos/p2', { numero: num(2), partes: 'Fulano 2 x Banco X', orgao: 'TJGO', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora, advogados: [{ oab: '11111/GO', nome: 'Já estava' }] });
await f('PUT', '/api/db/casos/c1', { tipo: 'inicial', cliente: 'Cliente A', nomeAcao: 'x', numeroProcesso: dig(num(2)), origem: 'proprio', status: 'pendente', valorHonorarios: 1000, parcelas: [], clienteIds: [], criadoEm: agora, atualizadoEm: agora });
await f('PUT', '/api/db/alvaras/a1', { partes: 'Fulano 1', numeroProcesso: num(1), valor: 500, fase: 'sem', criadoEm: agora, atualizadoEm: agora });
await f('PUT', '/api/db/termosAcordo/t1', { partes: 'Fulano 4', numeroProcesso: num(4), valor: 500, parcelas: [], criadoEm: agora, atualizadoEm: agora });
const est = (await f('GET', '/api/djen/estado')).j;
await f('PUT', '/api/djen/oabs', { oabs: est.oabs.filter(o => o.numero === '60456').concat([{ id: '', nome: 'Murilo Falone', numero: '49308', uf: 'GO', ativo: true, escopo: 'tudo', avisar: false }]) });
const b = await f('POST', '/api/djen/buscar', {}); check(b.s === 200, 'leitura do Diário Oficial (simulado) concluída');
const oab = x => (x && x.advogados || []).map(a => a.oab).sort().join(',');
/* a leitura já completa sozinha */
check(oab(await get('processos', 'p1')) === '60456/GO', 'processo 1: só o nosso advogado (o de fora não entra): ' + oab(await get('processos', 'p1')));
check(oab(await get('processos', 'p2')) === '11111/GO,49308/GO,60456/GO', 'processo 2: os dois nossos (OAB com zero à esquerda reconhecida) e o que já estava continua: ' + oab(await get('processos', 'p2')));
check(oab(await get('processos', 'p3')) === '49308/GO', 'processo 3: publicação sem lista de advogados, achada só pela OAB do Murilo → ele participa');
check(oab(await get('processos', 'p4')) === '' && !(await get('processos', 'p4')).advogados, 'processo 4 (sem publicações): não ganha advogados');
check(oab(await get('casos', 'c1')) === '49308/GO,60456/GO', 'Inicial com o número do processo 2: recebe os advogados');
check(oab(await get('alvaras', 'a1')) === '60456/GO', 'Alvará com o número do processo 1 (com máscara): recebe o advogado');
check(!(await get('termosAcordo', 't1')).advogados, 'Acordo de processo sem publicações: não muda');
const nome = (await get('processos', 'p1')).advogados[0].nome; check(nome === 'Hygor Lima Andrade', 'o nome gravado é o da OAB cadastrada: ' + nome);
/* idempotente e só acrescenta */
const antes = JSON.stringify(await get('processos', 'p2'));
const c2 = await f('POST', '/api/djen/advogados', {}); check(c2.s === 200 && c2.j.registros === 0 && JSON.stringify(await get('processos', 'p2')) === antes, 'rodar de novo não muda nada (registros alterados: ' + c2.j.registros + ')');
await f('PUT', '/api/db/processos/p5', { numero: num(5), partes: 'Fulano 5', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
const c3 = await f('POST', '/api/djen/advogados', {}); check(c3.j.registros === 1 && oab(await get('processos', 'p5')) === '60456/GO' && !oab(await get('processos', 'p5')).includes('88888'), 'processo cadastrado depois, achado pela OAB do Hygor (a lista da publicação só mostra outro advogado): ele entra e o de fora não');
/* um processo cadastrado depois ganha na próxima passada */
await f('PUT', '/api/db/processos/p6', { numero: num(3).replace(/\D/g, '').replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6'), partes: 'Fulano 3 (de novo)', clienteIds: [], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
const c4 = await f('POST', '/api/djen/advogados', {}); check(c4.j.registros === 1 && oab(await get('processos', 'p6')) === '49308/GO', 'processo cadastrado depois recebe os advogados na próxima passada');
/* registro de ações */
const aud = (await f('GET', '/api/auditoria?limite=30')).j.itens || []; check(aud.some(i => i.rotulo === 'Advogados' && /completados/.test(i.titulo)), 'a passada fica no registro de ações');
/* sem sessão */
const sem = await fetch(B + '/api/djen/advogados', { method: 'POST' }); check(sem.status === 401, 'sem sessão: 401');
fake.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
