// Testa pela tela: primeiro acesso (senha antiga → criar acesso), entrada por e-mail e senha, Configurações > Segurança e o registro.
// Servidor SEM LOGIN_ANTIGO e com banco novo (ver test/login-individual.test.mjs).  BASE=http://127.0.0.1:8813 node test/login-tela.test.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8813', CHAVE = 'senha-de-teste-123', EMAIL = 'dono@exemplo.com.br', S1 = 'senha-forte-numero-1', S2 = 'senha-forte-numero-2';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 390, height: 900 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
await ctx.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { /* sem armazenamento */ } });
const page = await ctx.newPage(); const erros = []; page.on('pageerror', x => erros.push(x.message)); await page.route(/fonts\./, x => x.abort());
const t = s => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
const vis = s => page.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, s);
const abrirSeg = async () => { await page.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await page.waitForTimeout(700); await page.click('#cfWrap [data-cf="seguranca"]'); await page.waitForTimeout(900); };

/* primeiro acesso */
await page.goto(B + '/'); await page.waitForTimeout(500);
check(/\/login$/.test(page.url()) && /Digite a senha/.test(await t('body')), 'sem sessão: abre a tela de entrada pedindo a senha atual');
await page.fill('input[name=senha]', CHAVE); await page.click('button[type=submit]'); await page.waitForTimeout(900);
check(/\/criar-acesso$/.test(page.url()) && /Crie o seu acesso/.test(await t('body')), 'a senha atual leva à tela "Crie o seu acesso"');
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/criar-acesso.png' });
await page.fill('input[name=nome]', 'Hygor Teste'); await page.fill('input[name=email]', EMAIL); await page.fill('input[name=senha]', 'curta'); await page.fill('input[name=senha2]', 'curta'); await page.click('button[type=submit]'); await page.waitForTimeout(700);
check(/pelo menos 12/.test(await t('body')) && /Crie o seu acesso/.test(await t('body')) && (await page.inputValue('input[name=email]')) === EMAIL, 'senha curta: mostra o erro e mantém nome e e-mail digitados');
await page.fill('input[name=senha]', S1); await page.fill('input[name=senha2]', S1); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
check(await vis('#drawer') || (await page.locator('#drawer').count()) > 0, 'acesso criado: o app abre');

/* Segurança */
await abrirSeg();
check(await vis('#overlaySgSeg.show'), 'Configurações > Segurança abre');
let tx = await t('#overlaySgSegC');
check(/sessões abertas/i.test(tx) && /iPhone · Safari/.test(tx) && /este aparelho/.test(tx) && /alterar a senha/i.test(tx) && new RegExp(EMAIL).test(tx), 'mostra a sessão deste aparelho, trocar senha e o e-mail: ' + tx.replace(/\n/g, ' ').slice(0, 160));
const outro = await fetch(B + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': '5.5.5.5', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0' }, body: 'email=' + encodeURIComponent(EMAIL) + '&senha=' + S1 });
check(outro.status === 303, 'um segundo aparelho entra por fora');
await page.evaluate(() => document.querySelector('#overlaySgSeg [data-sg="fechar"]').click()); await abrirSeg();
check((await page.locator('#overlaySgSegC .pb-card').count()) === 2 && /Windows · Edge/.test(await t('#overlaySgSegC')), 'a lista agora tem 2 sessões, com o Edge');
if (process.env.FOTOS) await page.screenshot({ path: process.env.FOTOS + '/seguranca.png' });
await page.click('#overlaySgSegC [data-sg="seg-encerrar"]'); await page.waitForTimeout(900);
check((await page.locator('#overlaySgSegC .pb-card').count()) === 1, 'Encerrar tira a outra sessão da lista');
const ck2 = (outro.headers.get('set-cookie') || '').split(';')[0]; const r2 = await fetch(B + '/api/db/casos', { headers: { cookie: ck2 } }); check(r2.status === 401, 'e o aparelho encerrado perde o acesso');
await page.click('#overlaySgSegC [data-sg="seg-senha"]'); await page.waitForTimeout(400);
check(/Preencha/.test(await t('#overlaySgSegC')), 'trocar senha sem preencher: avisa');
await page.fill('#sgSegAtual', 'errada-errada-12'); await page.fill('#sgSegNova', S2); await page.fill('#sgSegNova2', S2); await page.click('#overlaySgSegC [data-sg="seg-senha"]'); await page.waitForTimeout(900);
check(/não confere/.test(await t('#overlaySgSegC')), 'senha atual errada: mostra o erro');
await page.fill('#sgSegAtual', S1); await page.fill('#sgSegNova', S2); await page.fill('#sgSegNova2', S2); await page.click('#overlaySgSegC [data-sg="seg-senha"]'); await page.waitForTimeout(1200);
check(/Senha trocada/.test(await t('#overlaySgSegC')), 'senha trocada pela tela');
await page.uncheck('#sgSegAlertas'); await page.waitForTimeout(600);
const al = await page.evaluate(() => fetch('/api/seguranca/sessoes').then(r => r.json())); check(al.usuario.alertas === false, 'desligar os avisos fica salvo');

/* registro */
await page.evaluate(() => document.querySelector('#overlaySgSeg [data-sg="fechar"]').click());
await page.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await page.waitForTimeout(500); await page.click('#cfWrap [data-cf="registro"]'); await page.waitForTimeout(1000);
tx = await t('#overlaySgRegC'); check(/entrou/.test(tx) && /encerrou/.test(tx) && /alterou/.test(tx) && /Acesso/.test(tx), 'o Registro de ações mostra entrou, encerrou e alterou');

/* sair e entrar de novo por e-mail */
await page.goto(B + '/sair'); await page.waitForTimeout(700);
check(/\/login$/.test(page.url()) && (await page.locator('input[name=email]').count()) === 1, 'sair: volta para a entrada com e-mail e senha');
await page.fill('input[name=email]', EMAIL); await page.fill('input[name=senha]', S1); await page.click('button[type=submit]'); await page.waitForTimeout(900);
check(/E-mail ou senha incorretos/.test(await t('body')), 'a senha antiga (já trocada) é recusada na tela');
await page.fill('input[name=senha]', S2); await page.click('button[type=submit]'); await page.waitForTimeout(3000);
check((await page.locator('#drawer').count()) > 0 && !/\/login/.test(page.url()), 'e-mail e senha nova: entra no app');
check(erros.length === 0, 'sem erros de JavaScript na tela' + (erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''));
await br.close(); console.log(falhas ? falhas + ' FALHAS' : 'tudo ok'); process.exit(falhas ? 1 : 0);
