/* Migrações de dados que rodam sozinhas, uma vez, na primeira requisição depois da atualização. Cada uma é uma única operação "tudo ou nada"
   (o D1 executa o lote numa transação) e só roda de novo se a marca não existir. */
import { CONFIG_DONO } from './colecoes.js';
const MARCA_CONFIG = 'mig-config-dono-v1';
let feita = false;   // por isolate: evita consultar a marca em toda requisição
export async function garantirMigracoes(env) {
  if (feita) return;
  const marca = await env.DB.prepare("SELECT 1 AS x FROM docs WHERE colecao = '_sistema' AND id = ?").bind(MARCA_CONFIG).first();
  if (marca) { feita = true; return; }
  const ids = [...CONFIG_DONO], ph = ids.map(() => '?').join(',');
  const agora = Date.now();
  /* 1) copia para a coleção do proprietário; 2) guarda o original num cofre (_sistema, cfg-antes-<nome>) para poder voltar atrás;
     3) tira da coleção comum; 4) grava a marca. Tudo numa transação só. */
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO docs (colecao,id,dados,atualizado) SELECT 'configDono', id, dados, atualizado FROM docs WHERE colecao = 'config' AND id IN (${ph})`).bind(...ids),
    env.DB.prepare(`INSERT OR IGNORE INTO docs (colecao,id,dados,atualizado) SELECT '_sistema', 'cfg-antes-' || id, dados, atualizado FROM docs WHERE colecao = 'config' AND id IN (${ph})`).bind(...ids),
    env.DB.prepare(`DELETE FROM docs WHERE colecao = 'config' AND id IN (${ph})`).bind(...ids),
    env.DB.prepare("INSERT OR IGNORE INTO docs (colecao,id,dados,atualizado) VALUES ('_sistema', ?, ?, ?)").bind(MARCA_CONFIG, JSON.stringify({ em: new Date(agora).toISOString(), movidos: ids }), agora),
  ]);
  feita = true;
}
