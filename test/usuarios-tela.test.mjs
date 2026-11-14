// Testa a tela Configurações › Usuários (Fase 5, etapa 5.2): lista, convidar, link, ficha (permissões, OABs, aparelhos, desativar).
// Servidor individual com o banco semeado (grupo 'permissoes'):  node test/rodar.mjs usuarios-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK_DONO = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
await ctx.addCookies([{ name: 'sessao', value: TOK_DONO, url: B }]);
const page = await ctx.newPage(), erros = [];
page.on('pageerror', (e) => erros.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
await page.route(/fonts\./, (x) => x.abort());
await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await page.goto(B + '/'); await page.waitForTimeout(3500);
const shot = async (n) => { if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + 'us-' + n + '.png', fullPage: true }); };
const C = () => page.locator('#overlayUsuariosC');
const txt = async () => (await C().textContent());

await page.click('[data-tab="configuracoes"]'); await page.waitForTimeout(500);
check(await page.locator('[data-cf="usuarios"]').count() === 1 && !(await page.locator('#cfWrap').innerText()).includes('Perfis e permissões'), 'Configurações tem a linha "Usuários" (e não está mais em "reservado")');
await page.click('[data-cf="usuarios"]'); await page.waitForSelector('#overlayUsuarios.show .pb-card'); 
let t = await txt(); await shot('lista');
check(t.includes('Dono Teste') && t.includes('(você)') && t.includes('Ana Advogada') && t.includes('OAB 11111/GO') && t.includes('Caio Estagiario') && t.includes('estagiário'), 'lista as pessoas com papel e OAB');
check(!(await page.locator('[data-us="abrir"][data-k="u1"]').count()), 'o proprietário não tem botão Abrir (não é alterado por aqui)');

/* convidar */
await page.click('[data-us="convidar"]'); await page.waitForSelector('#usNome');
await page.click('[data-us="gerar"]'); check((await txt()).includes('Informe o nome'), 'valida o nome');
await page.fill('#usNome', 'Júlia Ribeiro'); await page.fill('#usEmail', 'julia-tela@teste.local');
t = await txt(); check(t.includes('Ver as publicações de todo o escritório') && t.includes('Ver as agendas de todo o escritório') && t.includes('Excluir registros') && !t.includes('De quem é a OAB'), 'estagiário: quatro interruptores e sem OAB');
check(await page.locator('[data-usp="verPublicacoes"]').isChecked() && await page.locator('[data-usp="verAgendas"]').isChecked() && !(await page.locator('[data-usp="verTotais"]').isChecked()) && !(await page.locator('[data-usp="excluir"]').isChecked()), 'padrões do estagiário: publicações e agendas ligadas; totais e excluir desligados');
await shot('convidar-estagiario');
await page.click('[data-us="papel"][data-k="advogado"]'); await page.waitForTimeout(150);
t = await txt(); check(t.includes('De quem é a OAB') && !t.includes('Ver as publicações de todo o escritório') && t.includes('Ver totais') && await page.locator('[data-usp="verTotais"]').isChecked() && !(await page.locator('[data-usp="excluir"]').isChecked()), 'advogado: escolhe OAB; interruptores de totais (ligado) e excluir (desligado)');
check(await page.locator('#usNome').inputValue() === 'Júlia Ribeiro', 'trocar o papel não apaga o que foi digitado');
await page.click('[data-us="gerar"]'); check((await txt()).includes('ao menos uma OAB'), 'advogado sem OAB: avisa');
await page.fill('[data-usf="outraNum"]', '33.333'); await page.fill('[data-usf="outraUf"]', 'go'); await page.click('[data-us="novo-outra-oab"]');
await page.fill('[data-usf="outraNum"]', '44444'); await page.fill('[data-usf="outraUf"]', 'SP'); await page.click('[data-us="novo-outra-oab"]');
check(await page.locator('[data-uso="33333/GO"]').isChecked() && await page.locator('[data-uso="44444/SP"]').isChecked(), 'acrescenta OABs que não estavam cadastradas (sem limite)');
await shot('convidar-advogado');
await page.click('[data-usp="excluir"]'); await page.click('[data-us="gerar"]'); await page.waitForSelector('#usLink');
const link = await page.inputValue('#usLink'); await shot('link');
check(/\/convite\/[A-Za-z0-9_-]{40,}$/.test(link) && (await txt()).includes('48 horas') && (await page.locator('a[href^="https://wa.me/"]').count()) === 1, 'mostra o link, o aviso de 48 h e o botão do WhatsApp');
await page.click('[data-us="copiar"]'); await page.waitForTimeout(300);
check((await txt()).includes('Link copiado') && (await page.evaluate(() => navigator.clipboard.readText())) === link, 'copiar o link');

/* o convite aparece pendente, com o que foi escolhido */
await page.click('[data-us="voltar"]'); await page.waitForSelector('[data-us="abrir-convite"]'); t = await txt();
check(t.includes('Convites pendentes (1)') && t.includes('julia-tela@teste.local') && t.includes('convite pendente'), 'o convite aparece como pendente');
const resp = await (await fetch(link)).text(); check(resp.includes('julia-tela@teste.local') && resp.includes('advogado'), 'o link abre a página do convite com os dados informados');
await page.click('[data-us="abrir-convite"]'); t = await txt(); check(t.includes('33333/GO') && t.includes('44444/SP') && t.includes('Gerar outro link') && t.includes('Cancelar convite'), 'a ficha do convite mostra as OABs e as ações');
await page.click('[data-us="cancelar-convite"]'); await page.waitForTimeout(500);
check(!(await txt()).includes('Convites pendentes') && (await fetch(link)).status === 410, 'cancelar o convite derruba o link');

/* ficha de uma pessoa */
await page.click('[data-us="abrir"][data-k="u4"]'); await page.waitForSelector('[data-usp="verPublicacoes"]'); await page.waitForTimeout(400);
t = await txt(); await shot('ficha');
check(t.includes('Caio Estagiario') && t.includes('Aparelhos conectados') && t.includes('Desativar acesso') && await page.locator('[data-usp="verAgendas"]').isChecked(), 'ficha do estagiário com permissões e aparelhos');
await page.click('[data-usp="verAgendas"]'); await page.waitForTimeout(600);
const apos = await (await fetch(B + '/api/usuarios/u4', { headers: { cookie: 'sessao=' + TOK_DONO } })).json();
check(apos.permissoes.verAgendas === false && apos.permissoes.verPublicacoes === true, 'desligar o interruptor grava no servidor');
await page.selectOption('[data-usf="papel-ficha"]', 'advogado'); await page.waitForTimeout(500);
check((await (await fetch(B + '/api/usuarios/u4', { headers: { cookie: 'sessao=' + TOK_DONO } })).json()).papel === 'estagiario', 'trocar para advogado sem OAB é recusado pelo servidor (papel não muda)');
await page.click('[data-us="abrir"][data-k="u4"]').catch(() => {});
await page.click('[data-us="voltar"]'); await page.waitForSelector('[data-us="abrir"][data-k="u2"]');
await page.click('[data-us="abrir"][data-k="u2"]'); await page.waitForSelector('[data-uso="11111/GO"]');
check(await page.locator('[data-uso="11111/GO"]').isChecked(), 'ficha do advogado mostra a OAB vinculada');
await page.fill('[data-usf="outraNum"]', '99999'); await page.fill('[data-usf="outraUf"]', 'MG'); await page.click('[data-us="ficha-outra-oab"]'); await page.waitForTimeout(600);
check((await (await fetch(B + '/api/usuarios/u2', { headers: { cookie: 'sessao=' + TOK_DONO } })).json()).oabs.join() === '11111/GO,99999/MG', 'acrescentar OAB na ficha grava (sem limite)');
await page.click('[data-us="desativar"]'); check((await txt()).includes('Confirmar: desativar agora'), 'desativar pede confirmação');
await page.click('[data-us="desativar-ok"]'); await page.waitForTimeout(800);
t = await txt(); check(t.includes('desativado') && t.includes('Reativar acesso'), 'desativado mostra "Reativar acesso"');
await page.click('[data-us="reativar"]'); await page.waitForTimeout(600); check((await txt()).includes('Desativar acesso'), 'reativar volta ao normal');
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
