// Testa as telas da etapa 5.8: "Avisos neste celular" (cada papel), "Avisos da equipe" do proprietário, Histórico do processo e filtros do Registro de ações.
// Servidor individual com banco semeado (grupo 'permissoes'):  node test/rodar.mjs avisos-tela
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { /* sem corpo */ } return { s: x.status, j }; };
const dono = api('dono'), ana = api('ana');
const num = '0000813-30.2024.8.09.0813';
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
await dono('PUT', '/api/db/casos/at1', { tipo: 'inicial', cliente: 'Cliente Tela Histórico', numeroProcesso: num, advogados: [{ oab: '11111/GO', nome: 'Ana' }], criadoEm: new Date().toISOString() });
await ana('PUT', '/api/db/casos/at1', { tipo: 'inicial', cliente: 'Cliente Tela Histórico', numeroProcesso: num, status: 'protocolada', advogados: [{ oab: '11111/GO', nome: 'Ana' }], criadoEm: new Date().toISOString() });
const br = await chromium.launch();
async function abrir(quem, largura = 1280) {
  const ctx = await br.newContext({ viewport: { width: largura, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]);
  const page = await ctx.newPage(); page.recusados = []; page.erros = [];
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) page.recusados.push(r.status() + ' ' + r.url().replace(B, '')); });
  page.on('pageerror', (e) => page.erros.push(e.message));
  await page.route(/fonts\./, (x) => x.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await page.goto(B + '/'); await page.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.prAbrir && document.getElementById('mainTabs'), null, { timeout: 60000 }); await page.waitForTimeout(2500); return page;
}
for (const q of ['ana', 'caio']) {
  console.log('\n— ' + (q === 'ana' ? 'advogada' : 'estagiário') + ': Minha conta → Avisos neste celular');
  const p = await abrir(q); await p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await p.waitForTimeout(500);
  check(/Avisos neste celular/.test(await p.locator('#cfWrap').innerText()), 'a página "Minha conta" traz a linha "Avisos neste celular"');
  await p.evaluate(() => document.querySelector('#cfWrap [data-cf="notif"]').click()); await p.waitForTimeout(1200);
  const titulo = await p.locator('#overlayLembretes .modal-head h2').innerText(), corpo = await p.locator('#ntCorpo').innerText();
  check(titulo === 'Avisos neste celular', 'o título é "Avisos neste celular"');
  check(/Resumo do dia/.test(corpo) && /Prazo ou audiência chegando/.test(corpo) && /Fui indicado como responsável/.test(corpo) && /Publicações novas/.test(corpo), 'as opções de cada pessoa aparecem');
  check(/Repasses/.test(corpo) === (q === 'ana'), q === 'ana' ? 'a advogada tem a opção "Repasses"' : 'o estagiário não tem "Repasses"');
  check(!/Avisos da equipe|Alguém aceitar um convite/.test(corpo) && !/Alertas do app/.test(corpo), 'sem as chaves da equipe nem alertas financeiros');
  await p.evaluate(() => { const i = document.querySelector('#ntCorpo [data-ntav="prazos"]'); i.click(); }); await p.waitForTimeout(900);
  const est = (await (q === 'ana' ? ana : api('caio'))('GET', '/api/notif/estado')).j;
  check(est.avisos.prazos === false && est.avisos.resumo === true, 'ao desligar uma opção, ela fica salva só para esta pessoa: ' + JSON.stringify(est.avisos));
  check(p.recusados.length === 0 && p.erros.length === 0, 'sem pedidos recusados nem erros de JavaScript' + (p.recusados.length ? ': ' + p.recusados.join(' | ') : '') + (p.erros.length ? ': ' + p.erros.join(' | ') : ''));
  await (q === 'ana' ? ana : api('caio'))('PUT', '/api/notif/config', { avisos: { prazos: true } });
  await p.context().close();
}
console.log('\n— proprietário: Avisos da equipe');
{
  const p = await abrir('dono'); await p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('#cfWrap [data-cf="notif"]').click()); await p.waitForTimeout(1200);
  const corpo = await p.locator('#ntCorpo').innerText();
  check(/Avisos da equipe/i.test(corpo) && /Alguém aceitar um convite/.test(corpo) && /Registro for excluído/.test(corpo) && /Resumo semanal/.test(corpo), 'o proprietário vê os 8 avisos da equipe');
  const n = await p.locator('#ntCorpo [data-nteq]').count(), lig = await p.evaluate(() => [...document.querySelectorAll('#ntCorpo [data-nteq]')].map((i) => i.getAttribute('data-nteq') + ':' + i.checked).join(','));
  check(n === 8 && /exclusao:true/.test(lig) && /pronta:true/.test(lig) && /honorarios:false/.test(lig) && /semanal:false/.test(lig), 'os padrões: exclusão e peça pronta ligadas; honorários e resumo semanal desligados (' + lig + ')');
  await p.evaluate(() => document.querySelector('#ntCorpo [data-nteq="semanal"]').click()); await p.waitForTimeout(900);
  check((await dono('GET', '/api/notif/estado')).j.equipe.semanal === true, 'ligar "Resumo semanal" fica salvo');
  await dono('PUT', '/api/notif/config', { equipe: { semanal: false } });
  await p.evaluate(() => { document.getElementById('overlayLembretes').classList.remove('show'); window.__horusTeste.sgRegAbrir(); }); await p.waitForTimeout(1500);
  const reg = await p.locator('#overlaySgRegC').innerText();
  check(/Pessoa/.test(reg) && /Período/.test(reg) && (await p.locator('#sgFPes option').count()) >= 3, 'o Registro de ações tem os filtros Pessoa e Período');
  await p.selectOption('#sgFPes', { label: 'Ana Advogada' }); await p.waitForTimeout(900);
  const linhas = await p.evaluate(() => [...document.querySelectorAll('#overlaySgRegC .pb-l1 > span:first-child')].map((e) => e.textContent));
  check(linhas.length >= 1 && linhas.every((x) => /Ana Advogada/.test(x)), 'filtrar por pessoa mostra só as ações dela (' + linhas.length + ')');
  await p.selectOption('#sgFPer', 'hoje'); await p.waitForTimeout(900);
  check((await p.locator('#overlaySgRegC .pb-card').count()) >= 1, 'filtrar por período "Hoje" ainda mostra as ações de hoje');
  await p.evaluate(() => document.getElementById('overlaySgReg').classList.remove('show'));
  console.log('\n— histórico do processo');
  await p.evaluate((n) => window.__horusTeste.prAbrir(n.replace(/\D/g, '')), num); await p.waitForTimeout(1200);
  check(/Histórico: quem fez o quê/.test(await p.locator('#prCorpo, #overlayProc').first().innerText().catch(() => '')) || (await p.getByText('Histórico: quem fez o quê').count()) > 0, 'a ficha do processo tem o botão do histórico');
  await p.getByText('Histórico: quem fez o quê').first().click(); await p.waitForTimeout(1000);
  const h = await p.locator('#prHistC').innerText();
  check(/Ana Advogada/.test(h) && /Dono Teste/.test(h) && /Cliente Tela Histórico/.test(h), 'o histórico mostra quem fez o quê: ' + h.replace(/\n/g, ' · ').slice(0, 140));
  check(p.erros.length === 0, 'sem erros de JavaScript' + (p.erros.length ? ': ' + p.erros.join(' | ') : ''));
  await p.context().close();
}
await dono('DELETE', '/api/db/casos/at1');
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo'); process.exit(falhas ? 1 : 0);
