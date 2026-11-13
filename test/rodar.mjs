#!/usr/bin/env node
// Roda os testes do Horus de uma vez só: sobe o servidor local certo para cada grupo, com banco novo, roda os testes e desliga.
//   node test/rodar.mjs                  todos os grupos
//   node test/rodar.mjs principal login  só esses grupos
//   node test/rodar.mjs financas-pj      só esse teste (o grupo certo é escolhido sozinho)
//   node test/rodar.mjs --lista          mostra grupos e testes
// Precisa de: Node, wrangler (npm install), Playwright instalado no computador (os testes de tela usam o Chromium).
// O Diário Oficial, o DataJud e o Claude são simulados pelos próprios testes (portas 8890, 8891, 9996 e 9998).
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..'), SENHA = 'senha-de-teste-123', LOGS = join(tmpdir(), 'horus-testes');
const BASE_ANTIGA = { SENHA, IMPORTAR_AUTO: '0', LOGIN_ANTIGO: '1', DJEN_URL: 'http://127.0.0.1:8890/api/v1/comunicacao', DJEN_ESPERA_MS: '0', DATAJUD_URL: 'http://127.0.0.1:8891' };

/* Cada grupo = um servidor (porta, variáveis) + a lista de testes. "porTeste": servidor e banco novos a cada teste. */
const GRUPOS = {
  unitarios: { sem_servidor: true, testes: ['datajud', 'djen', 'push', 'pecas'] },
  principal: { porta: 8812, vars: BASE_ANTIGA, testes: ['login', 'publicacoes', 'agenda', 'processos', 'vinculo-iniciais', 'protocolar-numero', 'abas-fixas', 'revisao-ligacoes', 'modulo-resumo', 'datajud-processos', 'analise-abas', 'audiencias', 'processos-tela', 'relatorios', 'pecas-tela', 'pecas-aprende', 'analises', 'relatorio-cliente', 'partes-unico', 'importar-djen', 'advogados-participantes', 'agenda-importar', 'agenda-detalhe', 'icones', 'restauracao-segura', 'restauracao-tela', 'configuracoes', 'lixeira-auditoria', 'lixeira-tela', 'transferencia-atomica', 'obra7', 'analises-ultimo', 'categorias', 'financas-geral', 'financas-pj', 'financas-pf', 'financas-patrimonio', 'metas-futuras', 'peticoes-layout', 'acordos-layout', 'alvaras-layout', 'obra-layout', 'clientes-arquivados-layout', 'obra-abater', 'adiar', 'modulo-juridico', 'modulo-financeiro', 'largura-kanban', 'logos-abertura', 'analises-semanas', 'analises-historico', 'orcamento', 'simulador', 'analises-futuro', 'obra-resumo', 'extratos-contas', 'conflito-paginas', 'agenda-trabalho', 'homologacao', 'homologacao-celular', 'titulos-celular'] },
  'diario-isolado': { porta: 8815, vars: BASE_ANTIGA, porTeste: true, testes: ['publicacoes-iguais', 'leitura-auto', 'agenda-publicacao'] },   // dependem do estado do Diário Oficial: banco novo a cada teste
  'acesso-individual': { porta: 8813, vars: { SENHA, IMPORTAR_AUTO: '0' }, porTeste: true, testes: ['login-individual', 'login-tela'] },
  permissoes: { porta: 8816, vars: { SENHA, IMPORTAR_AUTO: '0' }, semente: 'test/semente-permissoes.sql', testes: ['permissoes', 'publicacoes-acesso', 'responsaveis', 'agenda-resp', 'repasses', 'repasses-tela', 'papel-tela', 'avisos', 'avisos-tela', 'homologacao-papeis', 'homologacao-papeis-dono', 'usuarios', 'usuarios-tela', 'responsaveis-tela', 'agenda-pessoas'] },
  configuracao: { porta: 8814, vars: BASE_ANTIGA, semente: 'test/semente-config.sql', testes: ['config-separada'] },
  notificacoes: { porta: 8804, vars: { SENHA, IMPORTAR_AUTO: '0', LOGIN_ANTIGO: '1' }, args: ['--test-scheduled'], testes: ['notif'] },
  'claude-ler': { porta: 8790, vars: { ...BASE_ANTIGA, ANTHROPIC_API_KEY: 'chave-falsa', ANTHROPIC_URL: 'http://127.0.0.1:9998/v1/messages' }, testes: ['ler'] },
  'claude-pergunte': { porta: 8796, vars: { ...BASE_ANTIGA, ANTHROPIC_API_KEY: 'chave-falsa', ANTHROPIC_URL: 'http://127.0.0.1:9996/v1/messages' }, testes: ['pergunte'] },
  'envio-extratos': { porta: 8795, vars: { ...BASE_ANTIGA, ENVIO_TOKEN: 'token-de-teste-com-mais-de-24-caracteres' }, testes: ['extratos-arquivo'] },
};

if (process.argv.includes('--lista')) { for (const [g, c] of Object.entries(GRUPOS)) console.log(g + ': ' + c.testes.join(', ')); process.exit(0); }
const pedidos = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const escolhidos = pedidos.length ? Object.entries(GRUPOS).map(([g, c]) => [g, { ...c, testes: pedidos.includes(g) ? c.testes : c.testes.filter((t) => pedidos.includes(t)) }]).filter(([, c]) => c.testes.length) : Object.entries(GRUPOS);
if (pedidos.length && !escolhidos.length) { console.error('Nada encontrado para: ' + pedidos.join(', ') + '  (use --lista)'); process.exit(2); }

mkdirSync(LOGS, { recursive: true });
const sh = (c) => { try { execSync(c, { cwd: RAIZ, stdio: 'ignore' }); } catch (e) { /* ignora */ } };
const parar = () => { sh("pkill -f 'wrangler dev --local'"); sh('pkill -x workerd'); };
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
let servidor = null;
async function subir(nome, g, sufixo) {
  parar(); await espera(1500);
  const dir = join(tmpdir(), 'horus-dados-' + nome + sufixo); rmSync(dir, { recursive: true, force: true });
  const d1 = (extra) => execSync('npx wrangler d1 execute controle-juridico --local --persist-to ' + dir + ' ' + extra, { cwd: RAIZ, stdio: 'ignore' });
  d1('--file schema.sql'); if (g.semente) d1('--file ' + g.semente);
  const args = ['wrangler', 'dev', '--local', '--persist-to', dir, '--port', String(g.porta), ...(g.args || [])];
  for (const [k, v] of Object.entries(g.vars)) args.push('--var', k + ':' + v);
  const log = join(LOGS, 'servidor-' + nome + '.log'); writeFileSync(log, '');
  servidor = spawn('npx', args, { cwd: RAIZ, detached: true, stdio: ['ignore', 'ignore', 'ignore'] });
  for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + g.porta + '/login', { redirect: 'manual', signal: AbortSignal.timeout(2000) }); if (r) return dir; } catch (e) { /* ainda subindo */ } await espera(1000); }
  throw new Error('o servidor do grupo ' + nome + ' não subiu');
}
const desligar = () => { try { if (servidor) process.kill(-servidor.pid); } catch (e) { /* já saiu */ } servidor = null; parar(); };
const rodarTeste = (t, env) => new Promise((ok) => {
  const arq = existsSync(join(RAIZ, 'test', t + '.test.mjs')) ? t + '.test.mjs' : t + '.mjs', saida = [];
  const p = spawn('node', ['test/' + arq], { cwd: RAIZ, env: { ...process.env, ...env } }), corte = setTimeout(() => { p.kill('SIGKILL'); saida.push('FALHA tempo esgotado (200 s)'); }, 200000);
  p.stdout.on('data', (b) => saida.push(String(b))); p.stderr.on('data', (b) => saida.push(String(b)));
  p.on('close', (cod) => { clearTimeout(corte); const txt = saida.join(''); writeFileSync(join(LOGS, t + '.txt'), txt); ok({ t, ok: cod === 0, txt }); });
});

const resultado = [], t0 = Date.now();
process.on('SIGINT', () => { desligar(); process.exit(130); });
try {
  for (const [nome, g] of escolhidos) {
    console.log('\n== grupo ' + nome + (g.sem_servidor ? '' : ' (porta ' + g.porta + ')'));
    let dir = '';
    if (!g.sem_servidor && !g.porTeste) dir = await subir(nome, g, '');
    for (const t of g.testes) {
      if (g.porTeste) dir = await subir(nome, g, '-' + t);
      const env = g.sem_servidor ? {} : { BASE: 'http://127.0.0.1:' + g.porta, DADOS: dir };
      const r = await rodarTeste(t, env); resultado.push({ grupo: nome, ...r });
      console.log((r.ok ? '  ok     ' : '  FALHOU ') + t);
      if (!r.ok) console.log(r.txt.split('\n').filter((l) => /FALHA|rror/.test(l)).slice(0, 8).map((l) => '           ' + l.trim()).join('\n'));
      if (g.porTeste) desligar();
    }
    if (!g.sem_servidor && !g.porTeste) desligar();
  }
} finally { desligar(); }
const ruins = resultado.filter((r) => !r.ok);
console.log('\n' + (resultado.length - ruins.length) + ' de ' + resultado.length + ' testes passaram em ' + Math.round((Date.now() - t0) / 1000) + ' s. Logs completos em ' + LOGS);
if (ruins.length) console.log('Falharam: ' + ruins.map((r) => r.t).join(', '));
process.exit(ruins.length ? 1 : 0);
