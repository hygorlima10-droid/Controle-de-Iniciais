// Testa os avisos no celular de cada pessoa e o rastro (Fase 5, etapa 5.8, servidor): aparelhos por pessoa, opções de cada um, "fui indicado",
// repasses para qualquer advogado, avisos da equipe para o proprietário (com chaves liga/desliga), histórico por processo e filtros do Registro.
// Banco semeado do grupo 'permissoes' + um "serviço de push" de mentira:  node test/rodar.mjs avisos
import http from 'node:http';
import { novoAparelho, decifrar } from './push.helper.mjs';
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', bruno: 'tok-adv-bruno-000000000000000000000003', caio: 'tok-est-caio-0000000000000000000000004', dani: 'tok-est-dani-0000000000000000000000005' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = quem('dono'), ana = quem('ana'), bruno = quem('bruno'), caio = quem('caio'), dani = quem('dani');
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
/* serviço de push de mentira: cada aparelho tem o seu endereço (/push/<nome>) */
const caixa = []; const srv = http.createServer((q, s) => { const p = []; q.on('data', (c) => p.push(c)); q.on('end', () => { caixa.push({ url: q.url, corpo: Buffer.concat(p) }); s.writeHead(201); s.end(''); }); }).listen(9994);
const aps = {}; for (const n of ['dono', 'ana', 'bruno', 'caio', 'dani']) aps[n] = await novoAparelho();
const lidas = async (nome) => { const o = []; for (const c of caixa.filter((x) => x.url === '/push/' + nome)) o.push(await decifrar(aps[nome], c.corpo)); return o; };
const limpar = () => { caixa.length = 0; };
const ins = (n, f) => f('POST', '/api/notif/inscrever', { endpoint: 'http://127.0.0.1:9994/push/' + n, keys: { p256dh: aps[n].p256dh, auth: aps[n].authB64 } });
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
for (const col of ['repasses', 'agenda']) for (const d of (await dono('GET', '/api/db/' + col)).j.docs) if (d.id.startsWith('av') || col === 'repasses') await dono('DELETE', '/api/db/' + col + '/' + d.id);

console.log('\n— cada pessoa cuida dos próprios aparelhos e opções');
let r = await ana('GET', '/api/notif/estado');
check(r.s === 200 && r.j.aparelhos === 0 && r.j.papel === 'advogado' && r.j.avisos.indicado === true && r.j.equipe === undefined, 'a advogada abre o próprio estado de avisos (tudo ligado por padrão, sem as chaves da equipe)');
check((await dono('GET', '/api/notif/estado')).j.equipe.exclusao === true && (await dono('GET', '/api/notif/estado')).j.equipe.honorarios === false, 'o proprietário vê as chaves da equipe (exclusão ligada, honorários desligada)');
for (const [n, f] of [['dono', dono], ['ana', ana], ['bruno', bruno], ['caio', caio], ['dani', dani]]) await ins(n, f);
check((await ana('GET', '/api/notif/estado')).j.aparelhos === 1 && (await caio('GET', '/api/notif/estado')).j.aparelhos === 1 && (await dono('GET', '/api/notif/estado')).j.aparelhos === 1, 'cada um enxerga só o seu aparelho');
await ana('DELETE', '/api/notif/inscrever', { endpoint: 'http://127.0.0.1:9994/push/dono' });
check((await dono('GET', '/api/notif/estado')).j.aparelhos === 1, 'ninguém tira o aparelho de outra pessoa');
limpar(); r = await ana('POST', '/api/notif/teste'); await esperar(300);
check(r.j.enviadas === 1 && (await lidas('ana')).length === 1 && (await lidas('dono')).length === 0 && (await lidas('caio')).length === 0, 'o aviso de teste da advogada vai só para o aparelho dela');
check((await ana('POST', '/api/notif/agora?forcar=1')).s === 404, 'enviar o resumo do proprietário "agora" é só dele');
r = await ana('PUT', '/api/notif/config', { avisos: { indicado: false, repasses: true, lixo: true }, equipe: { exclusao: false } });
let est = (await ana('GET', '/api/notif/estado')).j;
check(r.s === 200 && est.avisos.indicado === false && est.avisos.lixo === undefined && est.equipe === undefined, 'cada pessoa liga e desliga as próprias opções (opção inexistente e chaves de equipe são ignoradas)');
check((await dono('GET', '/api/notif/estado')).j.equipe.exclusao === true, 'a advogada não mexeu nas chaves da equipe do proprietário');
await ana('PUT', '/api/notif/config', { avisos: { indicado: true } });

console.log('\n— "Você foi indicado"');
limpar(); await dono('PUT', '/api/db/agenda/av1', { tipo: 'prazo', titulo: 'Contestação de teste', data: '2026-12-01', criadoPor: 'u1', resp: ['u:u2'] }); await esperar(400);
let m = await lidas('ana');
check(m.length === 1 && m[0].titulo === 'Você foi indicado' && /Contestação de teste/.test(m[0].corpo), 'quem é colocado como responsável de um prazo recebe o aviso: ' + (m[0] ? m[0].corpo : '(nada)'));
check((await lidas('caio')).length === 0 && (await lidas('bruno')).length === 0 && (await lidas('dono')).length === 0, 'os outros não recebem (nem quem fez)');
limpar(); await dono('PUT', '/api/db/agenda/av1', { tipo: 'prazo', titulo: 'Contestação de teste (editado)', data: '2026-12-01', criadoPor: 'u1', resp: ['u:u2'] }); await esperar(300);
check((await lidas('ana')).length === 0, 'editar sem mudar os responsáveis não repete o aviso');
limpar(); await dono('PUT', '/api/db/agenda/av1', { tipo: 'prazo', titulo: 'Contestação de teste (editado)', data: '2026-12-01', criadoPor: 'u1', resp: ['u:u2', '22222/GO'] }); await esperar(400);
check((await lidas('bruno')).length === 1 && (await lidas('ana')).length === 0, 'quem entra depois (aqui, pela OAB do Bruno) recebe só o seu aviso');
await ana('PUT', '/api/notif/config', { avisos: { indicado: false } });
limpar(); await dono('PUT', '/api/db/agenda/av2', { tipo: 'tarefa', titulo: 'Outra', data: '2026-12-02', criadoPor: 'u1', resp: ['u:u2'] }); await esperar(300);
check((await lidas('ana')).length === 0, 'com "Fui indicado" desligado, a advogada não recebe');
await ana('PUT', '/api/notif/config', { avisos: { indicado: true } });
limpar(); await dono('PUT', '/api/db/casos/avc1', { tipo: 'inicial', cliente: 'Cliente Aviso', numeroProcesso: '0000808-80.2024.8.09.0808', advogados: [{ oab: '11111/GO', nome: 'Ana' }], criadoEm: new Date().toISOString() }); await esperar(400);
m = await lidas('ana'); check(m.length === 1 && /Inicial · Cliente Aviso/.test(m[0].corpo), 'ser colocada como advogada de uma Inicial também avisa: ' + (m[0] ? m[0].corpo : '(nada)'));

console.log('\n— repasses: avisa quem tem a receber (qualquer advogado)');
const D = { dono: { oab: '60456/GO', nome: 'Hygor Lima Andrade' }, ana: { oab: '11111/GO', nome: 'Ana Advogada' }, bruno: { oab: '22222/GO', nome: 'Bruno Advogado' } };
const rp = (de, para, o = {}) => Object.assign({ docTipo: 'caso', docId: 'c1', chave: 'caso|c1|p3', valor: 700, cliente: 'Cliente Um', processo: '0000001-11.2024.8.09.0001', label: 'Parcela 3/5', de: D[de], para: D[para], status: 'pendente', criadoEm: new Date().toISOString() }, o);
limpar(); await bruno('POST', '/api/db/repasses', rp('bruno', 'ana')); await esperar(400);
m = await lidas('ana'); check(m.length === 1 && /Bruno recebeu honorários/.test(m[0].titulo) && /700,00/.test(m[0].corpo), 'o Bruno recebeu e a Ana (que tem a receber) é avisada: ' + (m[0] ? m[0].titulo : '(nada)'));
limpar(); await ana('POST', '/api/db/repasses', rp('ana', 'dono', { chave: 'caso|c1|p9' })); await esperar(400);
m = await lidas('dono'); check(m.length === 1 && /Ana recebeu honorários/.test(m[0].titulo), 'quando é a Ana que recebeu, o proprietário continua avisado (chave "outro advogado recebeu")');
await dono('PUT', '/api/notif/config', { alertas: true, esconder: false, equipe: { recebeu: false } });
limpar(); await ana('POST', '/api/db/repasses', rp('ana', 'dono', { chave: 'caso|c1|p8' })); await esperar(300);
check((await lidas('dono')).length === 0, 'com a chave "outro advogado recebeu" desligada, o proprietário não recebe');
await dono('PUT', '/api/notif/config', { equipe: { recebeu: true } });

console.log('\n— avisos da equipe para o proprietário (cada um com a sua chave)');
await dono('PUT', '/api/db/casos/avc2', { tipo: 'inicial', cliente: 'Cliente Exclui', numeroProcesso: '0000809-90.2024.8.09.0809', advogados: [{ oab: '11111/GO', nome: 'Ana' }], criadoEm: new Date().toISOString() });
limpar(); r = await dani('DELETE', '/api/db/casos/avc2'); await esperar(400);
m = await lidas('dono'); check(r.s === 200 && m.length === 1 && /Registro excluído por Dani/.test(m[0].titulo) && /Cliente Exclui/.test(m[0].corpo), 'exclusão feita por outra pessoa avisa o proprietário: ' + (m[0] ? m[0].titulo : '(nada)'));
await dono('PUT', '/api/db/casos/avc3', { tipo: 'inicial', cliente: 'Cliente Exclui 2', numeroProcesso: '0000810-00.2024.8.09.0810', advogados: [{ oab: '11111/GO', nome: 'Ana' }], criadoEm: new Date().toISOString() });
await dono('PUT', '/api/notif/config', { equipe: { exclusao: false } });
limpar(); await dani('DELETE', '/api/db/casos/avc3'); await esperar(300); check((await lidas('dono')).length === 0, 'com a chave "excluído por outra pessoa" desligada, não avisa');
await dono('PUT', '/api/notif/config', { equipe: { exclusao: true } });
limpar(); await dono('DELETE', '/api/db/agenda/av2'); await esperar(300); check((await lidas('dono')).length === 0, 'o que o próprio proprietário exclui não gera aviso');
const parcela = (pago, valor = 100) => [{ numero: 1, valor, data: '2026-01-10', pago, ...(pago ? { dataRecebimento: '2026-01-10', recebidoEm: '2026-01-10T10:00:00Z' } : {}) }];
const caso = (pago, valor) => ({ tipo: 'inicial', cliente: 'Cliente Recebe', numeroProcesso: '0000811-10.2024.8.09.0811', formaPagamento: 'parcelado', valorHonorarios: 100, parcelas: parcela(pago, valor), advogados: [{ oab: '11111/GO', nome: 'Ana' }], criadoEm: new Date().toISOString() });
await dono('PUT', '/api/db/casos/avc4', caso(true));
limpar(); r = await ana('PUT', '/api/db/casos/avc4', caso(false)); await esperar(400);
m = await lidas('dono'); check(r.s === 200 && m.some((x) => /Recebimento desfeito por Ana/.test(x.titulo)), 'recebimento desfeito por outra pessoa avisa: ' + m.map((x) => x.titulo).join(' | '));
check(!m.some((x) => /Honorários alterados/.test(x.titulo)), 'a chave "alteraram honorários" vem desligada: não avisa');
await dono('PUT', '/api/db/casos/avc4', caso(false, 100));
await dono('PUT', '/api/notif/config', { equipe: { honorarios: true } });
limpar(); await ana('PUT', '/api/db/casos/avc4', caso(false, 250)); await esperar(400);
m = await lidas('dono'); check(m.some((x) => /Honorários alterados por Ana/.test(x.titulo)), 'com a chave ligada, alterar parcelas/valores avisa: ' + m.map((x) => x.titulo).join(' | '));
await dono('PUT', '/api/notif/config', { equipe: { honorarios: false } });

console.log('\n— opções do resumo diário (montarNotificacoes)');
const { montarNotificacoes } = await import('../src/index.js');
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), res = { itens: [{ d: hoje, t: 'pagamento', n: 'Fulano', l: 'P1', v: 10 }], alertas: [], prazos: [{ d: hoje, h: '', l: 'Prazo X', n: 'Cliente', t: 'prazo', a: [0] }] };
const tit = (prefs) => montarNotificacoes(res, {}, { alertas: {} }, hoje, hoje.slice(0, 7), [{ tribunal: 'TJGO', tipo: 'Decisão' }], prefs).map((x) => x.tag.split('-')[0]).join(',');
check(tit(undefined) === 'hoje,prazos,pub' && tit({ prazos: false }) === 'hoje,pub' && tit({ resumo: false, publicacoes: false }) === 'prazos', 'cada opção (resumo, prazos, publicações) liga e desliga o seu aviso');

console.log('\n— rastro: autor real, histórico do processo e filtros');
const num = '0000812-20.2024.8.09.0812', dig = num.replace(/\D/g, '');
await dono('PUT', '/api/db/casos/avc5', { tipo: 'inicial', cliente: 'Cliente Histórico', numeroProcesso: num, advogados: [{ oab: '11111/GO', nome: 'Ana' }], criadoEm: new Date().toISOString() });
await ana('PUT', '/api/db/casos/avc5', { tipo: 'inicial', cliente: 'Cliente Histórico', numeroProcesso: num, status: 'protocolada', advogados: [{ oab: '11111/GO', nome: 'Ana' }], criadoEm: new Date().toISOString() });
await dono('PUT', '/api/db/agenda/av6', { tipo: 'prazo', titulo: 'Prazo do histórico', processo: num, data: '2026-12-05', criadoPor: 'u1', resp: ['u:u2'] });
r = await dono('GET', '/api/historico/' + dig); const por = r.j.itens.map((x) => x.por);
check(r.s === 200 && por.includes('Ana Advogada') && por.includes('Dono Teste') && r.j.itens.some((x) => x.rotulo === 'Agenda'), 'o histórico do processo mostra quem fez o quê (nomes reais) em todos os registros do número: ' + por.join(','));
check((await ana('GET', '/api/historico/' + dig)).j.itens.length === r.j.itens.length, 'a advogada que participa do processo vê o histórico');
check((await bruno('GET', '/api/historico/' + dig)).s === 403, 'o advogado que não participa não vê');
check((await caio('GET', '/api/historico/' + dig)).s === 200, 'o estagiário vê o histórico dos processos que enxerga');
check((await ana('GET', '/api/historico/123')).s === 400, 'número inválido é recusado');
check((await ana('GET', '/api/auditoria')).s === 403, 'o Registro geral continua só do proprietário');
r = await dono('GET', '/api/auditoria?por=' + encodeURIComponent('Ana Advogada')); check(r.s === 200 && r.j.itens.length >= 1 && r.j.itens.every((x) => x.por === 'Ana Advogada') && r.j.pessoas.includes('Ana Advogada'), 'o Registro filtra por pessoa e lista as pessoas: ' + r.j.pessoas.join(','));
const hojeD = new Date().toISOString().slice(0, 10).replace(/-/g, ''), ontemD = new Date(Date.now() - 864e5 * 2).toISOString().slice(0, 10).replace(/-/g, '');
r = await dono('GET', '/api/auditoria?de=' + hojeD + '&ate=' + hojeD); const r2 = await dono('GET', '/api/auditoria?de=19990101&ate=19990102');
check(r.j.itens.length >= 1 && r2.j.itens.length === 0, 'o Registro filtra por período (hoje tem ações; 1999 não)');
r = await dono('GET', '/api/auditoria?colecao=acesso'); check(r.s === 200 && r.j.itens.every((x) => x.rotulo === 'Acesso'), 'o filtro "Acessos" mostra só os eventos de acesso');

console.log('\n— peça pronta: o estagiário avisa que terminou a peça');
const pz = { tipo: 'prazo', titulo: 'Contestação para conferir', processo: num, data: '2026-12-09', trabalhar: '2026-12-07', situacao: 'afazer', criadoPor: 'u1', resp: ['u:u2'] };
await dono('PUT', '/api/db/agenda/av7', pz);
limpar(); r = await caio('PUT', '/api/db/agenda/av7', { ...pz, situacao: 'pronta', prontaEm: hoje, prontaPor: 'Caio Estagiário' }); await esperar(500);
let pr = await lidas('dono'), pa = await lidas('ana');
check(r.s === 200, 'o estagiário consegue marcar a peça como pronta no prazo do processo');
check(pr.some((x) => /Peça pronta por/.test(x.titulo) && /conferir e protocolar/.test(x.corpo)), 'o proprietário recebe "Peça pronta por…" no celular: ' + pr.map((x) => x.titulo).join(' | '));
check(pa.some((x) => /Peça pronta por/.test(x.titulo)), 'a advogada responsável pelo prazo também recebe');
check((await lidas('bruno')).length === 0 && (await lidas('dani')).length === 0, 'quem não é responsável nem proprietário não recebe');
limpar(); await caio('PUT', '/api/db/agenda/av7', { ...pz, situacao: 'pronta', prontaEm: hoje, prontaPor: 'Caio Estagiário', obs: 'só uma observação' }); await esperar(400);
check((await lidas('dono')).filter((x) => /Peça pronta por/.test(x.titulo)).length === 0, 'não repete o aviso se o prazo já estava com a peça pronta');
await caio('PUT', '/api/db/agenda/av7', pz); await dono('PUT', '/api/notif/config', { equipe: { pronta: false } });
limpar(); await caio('PUT', '/api/db/agenda/av7', { ...pz, situacao: 'pronta', prontaEm: hoje, prontaPor: 'Caio' }); await esperar(400);
check((await lidas('dono')).filter((x) => /Peça pronta por/.test(x.titulo)).length === 0, 'com a chave "Alguém marcar peça pronta" desligada, o proprietário não recebe');
await dono('PUT', '/api/notif/config', { equipe: { pronta: true } });

for (const col of ['casos', 'agenda']) for (const d of (await dono('GET', '/api/db/' + col)).j.docs) if (d.id.startsWith('av')) await dono('DELETE', '/api/db/' + col + '/' + d.id);
for (const d of (await dono('GET', '/api/db/repasses')).j.docs) await dono('DELETE', '/api/db/repasses/' + d.id);
srv.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
