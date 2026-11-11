// Testa usuários e convites por link (Fase 5, etapa 5.2): convite, página pública, senha própria, uso único, permissões, desativar, sessões.
// Mesmo banco semeado do teste 'permissoes' (test/semente-permissoes.sql). O test/rodar.mjs sobe o servidor:  node test/rodar.mjs usuarios
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const quem = (ck) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; const t = await x.text(); try { j = JSON.parse(t); } catch (e) { /* html */ } return { s: x.status, j, t }; };
const dono = quem('sessao=' + TOK.dono), ana = quem('sessao=' + TOK.ana);
const pagina = async (p) => { const x = await fetch(B + p, { redirect: 'manual' }); return { s: x.status, t: await x.text() }; };
const enviar = async (p, campos, ip = '9.9.9.1') => { const x = await fetch(B + p, { method: 'POST', redirect: 'manual', body: new URLSearchParams(campos), headers: { 'cf-connecting-ip': ip } }); return { s: x.status, t: await x.text(), ck: (x.headers.get('set-cookie') || '').split(';')[0], loc: x.headers.get('location') }; };
const tokenDe = (link) => link.split('/convite/')[1];

console.log('\n— criar o convite (só o proprietário)');
check((await ana('POST', '/api/usuarios', { nome: 'X', email: 'x@x.com', papel: 'estagiario' })).s === 403 && (await ana('GET', '/api/usuarios')).s === 403, 'advogado não cria convite nem vê a lista de usuários');
check((await dono('POST', '/api/usuarios', { nome: 'Fulano Adv', email: 'fulano@teste.local', papel: 'advogado', oabs: [] })).s === 400, 'advogado sem OAB é recusado');
check((await dono('POST', '/api/usuarios', { nome: 'Fulano Adv', email: 'fulano-sem-arroba', papel: 'advogado', oabs: ['33333/GO'] })).s === 400, 'e-mail inválido é recusado');
check((await dono('POST', '/api/usuarios', { nome: 'Fulano Adv', email: 'fulano@teste.local', papel: 'proprietario' })).s === 400, 'não se convida outro proprietário');
check((await dono('POST', '/api/usuarios', { nome: 'Outra Ana', email: 'ANA@teste.local', papel: 'estagiario' })).s === 409, 'e-mail que já tem acesso é recusado (sem diferenciar maiúsculas)');
const c1 = await dono('POST', '/api/usuarios', { nome: 'Fulano Adv', email: 'Fulano@teste.local', papel: 'advogado', oabs: ['33333/GO', { numero: '44.444', uf: 'sp' }, '33333/GO'] });
check(c1.s === 200 && /\/convite\/[A-Za-z0-9_-]{40,}$/.test(c1.j.link), 'convite de advogado gera o link (sem limite de OABs; repetidas somem)');
const lista = await dono('GET', '/api/usuarios');
check(lista.j.convites.length === 1 && lista.j.convites[0].oabs.join() === '33333/GO,44444/SP' && lista.j.convites[0].email === 'fulano@teste.local' && !JSON.stringify(lista.j).includes('link') , 'o convite pendente aparece com as OABs e sem o link (que só aparece na criação)');
check(!/"(hash|sal|voltas)"/.test(JSON.stringify(lista.j)) && lista.j.usuarios.length === 6, 'a lista de usuários nunca traz senha nem sal');

console.log('\n— página do convite');
const tk = tokenDe(c1.j.link), pg = await pagina('/convite/' + tk);
check(pg.s === 200 && pg.t.includes('fulano@teste.local') && pg.t.includes('Fulano Adv') && /name="email"[^>]*readonly/.test(pg.t), 'a página mostra nome e e-mail já definidos, somente leitura');
check((await pagina('/convite/' + 'a'.repeat(43))).s === 410 && (await pagina('/convite/curto')).s === 410, 'link inventado ou malformado: indisponível');
check((await enviar('/convite/' + tk, { senha: 'curta', senha2: 'curta' })).s === 400, 'senha curta é recusada');
check((await enviar('/convite/' + tk, { senha: 'senha-bem-longa-1', senha2: 'senha-bem-longa-2' })).s === 400, 'senhas diferentes são recusadas');
check((await enviar('/convite/' + tk, { email: 'outro@teste.local', nome: 'Outro Nome', senha: 'senha-bem-longa-1', senha2: 'senha-bem-longa-1' })).s === 303, 'senha válida cria o acesso (o e-mail e o nome enviados no formulário são ignorados)');
const lista2 = await dono('GET', '/api/usuarios'), novo = lista2.j.usuarios.find((u) => u.email === 'fulano@teste.local');
check(novo && novo.nome === 'Fulano Adv' && novo.papel === 'advogado' && novo.oabs.join() === '33333/GO,44444/SP' && !lista2.j.usuarios.some((u) => u.email === 'outro@teste.local'), 'o usuário nasceu com os dados do convite (não com o que veio no formulário)');
check(lista2.j.convites.length === 0, 'o convite usado some da lista de pendentes');
check((await pagina('/convite/' + tk)).s === 410 && (await enviar('/convite/' + tk, { senha: 'senha-bem-longa-1', senha2: 'senha-bem-longa-1' })).s === 410, 'o link só vale uma vez');

console.log('\n— a pessoa entra e vê o que o papel dela permite');
const lg = await enviar('/login', { email: 'fulano@teste.local', senha: 'senha-bem-longa-1' }, '9.9.9.2');
check(lg.s === 303 && lg.ck.startsWith('sessao='), 'entra com o e-mail e a senha que ela criou');
const fu = quem(lg.ck), eu = await fu('GET', '/api/eu');
check(eu.j.papel === 'advogado' && eu.j.oabs.join() === '33333/GO,44444/SP' && eu.j.permissoes.verTotais === true && eu.j.permissoes.excluir === false, 'papel, OABs e permissões (totais ligado, excluir desligado por padrão para advogado)');
check((await fu('GET', '/api/db/despesas')).s === 403 && (await fu('GET', '/api/usuarios')).s === 403, 'e continua sem finanças nem lista de usuários');
check((await dono('PUT', '/api/usuarios/' + novo.id, { permissoes: { excluir: true, verTotais: false } })).s === 200 && (await fu('GET', '/api/eu')).j.permissoes.excluir === true && (await fu('GET', '/api/eu')).j.permissoes.verTotais === false, 'o proprietário muda as permissões e vale na hora');
check((await dono('PUT', '/api/usuarios/' + novo.id, { oabs: [] })).s === 400, 'não deixa advogado sem OAB');
check((await dono('PUT', '/api/usuarios/' + novo.id, { oabs: ['33333/GO', '55555/RJ'] })).s === 200 && (await fu('GET', '/api/eu')).j.oabs.length === 2, 'acrescenta OAB (sem limite)');
check((await dono('PUT', '/api/usuarios/u1', { ativo: false })).s === 403 && (await dono('PUT', '/api/usuarios/u1', { papel: 'estagiario' })).s === 403, 'o proprietário não é alterado por esta tela');

console.log('\n— sessões, desativar e reativar');
const ss = await dono('GET', '/api/usuarios/' + novo.id + '/sessoes');
check(ss.j.sessoes.length === 2, 'o proprietário vê os aparelhos conectados da pessoa (o do convite e o do login)');
check((await dono('GET', '/api/seguranca/sessoes')).j.sessoes.length === 1, 'a tela Segurança do proprietário lista só as sessões dele (não as dos outros)');
check((await dono('DELETE', '/api/usuarios/' + novo.id + '/sessoes')).s === 200 && (await fu('GET', '/api/eu')).s === 401, 'encerrar as sessões derruba a pessoa na hora');
const lg2 = await enviar('/login', { email: 'fulano@teste.local', senha: 'senha-bem-longa-1' }, '9.9.9.3'), fu2 = quem(lg2.ck);
check((await fu2('GET', '/api/eu')).s === 200, 'ela entra de novo com a mesma senha');
check((await dono('PUT', '/api/usuarios/' + novo.id, { ativo: false })).s === 200 && (await fu2('GET', '/api/eu')).s === 401, 'desativar tira o acesso na hora');
check((await enviar('/login', { email: 'fulano@teste.local', senha: 'senha-bem-longa-1' }, '9.9.9.4')).s === 401, 'e desativada ela não consegue entrar');
check((await dono('PUT', '/api/usuarios/' + novo.id, { ativo: true })).s === 200 && (await enviar('/login', { email: 'fulano@teste.local', senha: 'senha-bem-longa-1' }, '9.9.9.5')).s === 303, 'reativada, volta a entrar com a senha de antes');
check((await dono('DELETE', '/api/usuarios/' + novo.id)).s === 404, 'não existe "excluir pessoa"');

console.log('\n— cancelar e gerar outro link');
const c2 = await dono('POST', '/api/usuarios', { nome: 'Júlia', email: 'julia@teste.local', papel: 'estagiario', permissoes: { verAgendas: false } });
const pend = (await dono('GET', '/api/usuarios')).j.convites.find((c) => c.email === 'julia@teste.local');
check(pend && pend.permissoes.verAgendas === false && pend.permissoes.verPublicacoes === true, 'estagiário: as permissões escolhidas no convite ficam guardadas (publicações liga por padrão)');
const c3 = await dono('POST', '/api/usuarios/convites/' + pend.id + '/novo-link');
check(c3.s === 200 && tokenDe(c3.j.link) !== tokenDe(c2.j.link) && (await pagina('/convite/' + tokenDe(c2.j.link))).s === 410 && (await pagina('/convite/' + tokenDe(c3.j.link))).s === 200, 'gerar outro link cancela o anterior');
const pend2 = (await dono('GET', '/api/usuarios')).j.convites[0];
check((await dono('DELETE', '/api/usuarios/convites/' + pend2.id)).s === 200 && (await pagina('/convite/' + tokenDe(c3.j.link))).s === 410 && (await dono('GET', '/api/usuarios')).j.convites.length === 0, 'cancelar o convite invalida o link');
const c4 = await dono('POST', '/api/usuarios', { nome: 'Júlia', email: 'julia@teste.local', papel: 'estagiario' }), c5 = await dono('POST', '/api/usuarios', { nome: 'Júlia R.', email: 'julia@teste.local', papel: 'estagiario' });
check((await pagina('/convite/' + tokenDe(c4.j.link))).s === 410 && (await pagina('/convite/' + tokenDe(c5.j.link))).s === 200 && (await dono('GET', '/api/usuarios')).j.convites.length === 1, 'convidar o mesmo e-mail de novo substitui o convite pendente');
const lc = await enviar('/convite/' + tokenDe(c5.j.link), { senha: 'outra-senha-longa-9', senha2: 'outra-senha-longa-9' }, '9.9.9.6');
const est = quem(lc.ck), ee = await est('GET', '/api/eu');
check(ee.j.papel === 'estagiario' && ee.j.permissoes.verPublicacoes === true && ee.j.permissoes.verAgendas === true && (await est('GET', '/api/djen/lista')).s === 200, 'o estagiário convidado entra e já enxerga as publicações');
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
