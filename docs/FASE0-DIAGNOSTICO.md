# Horus — Fase 0: diagnóstico (08/11/2026)

Só análise: nenhum comportamento do app foi alterado. Mudanças desta fase no repositório: este relatório, o teste `test/backup-restauracao.test.mjs` e a correção de uma expectativa velha em `test/pergunte.test.mjs`.
Versão analisada: commit `5940076` (ramo `claude/legal-financial-control-review-l0hqsr`). Tudo que vem de produção (quantidade real de registros, segredos configurados no Cloudflare) **não foi visto**: está marcado como “a confirmar”.

## 1. Resumo
- O servidor é simples e consistente: uma tabela de documentos, uma rota genérica de banco e rotas específicas (backup, DJEN, DataJud, notificações, leitura por IA). Hoje todo mundo que entra (uma senha só) pode tudo.
- **O que já está bom:** login com limite de tentativas, cookie `HttpOnly/Secure/SameSite=Strict`, checagem de origem nas gravações, coleções `_*` fora da API do banco, textos externos (DJEN) escapados na tela, backup semanal que restaura sem perda (teste novo), 43 arquivos de teste automático.
- **O que precisa de correção antes de abrir o app a outras pessoas** (seção 7): restauração sem atomicidade nem “desfazer” (e uma rota `/api/restaurar` insegura que a tela não usa), backups no mesmo banco, transferência PJ/PF em dois registros, sessão que não se encerra, limite de 1.000 registros (a Agenda pode estourar), `Recebido no mês` que mistura honorários com receita da PJ, `config` que mistura configurações do proprietário com as gerais.
- **Advogados participantes:** o DJEN traz; o DataJud **não** traz (seção 6).

## 2. Rotas (`/api/...`) e a política de acesso de hoje
Regra única hoje: precisa do cookie de sessão (exceto onde indicado). Quem tem a sessão acessa tudo.

| Rota | Métodos | O que faz | Sem sessão? | Para a fase de usuários |
|---|---|---|---|---|
| `/login`, `/sair`, ícones, `manifest`, `sw.js`, `tema.css` | GET/POST | entrada e arquivos públicos | sim (público) | login passa a ser individual |
| `/api/enviar` | POST | recebe arquivo do iPhone (Atalho), token `ENVIO_TOKEN` | sim, com token | só proprietário (extratos) |
| `/api/db/<coleção>[/<id>]` | GET lista (até 1.000), POST, PUT, DELETE | banco genérico, qualquer coleção sem `_` | não | **autorizar por coleção e por registro** |
| `/api/backup` | GET | despeja tudo (menos `_*`) | não | só proprietário |
| `/api/restaurar` | POST | grava um arquivo de backup | não | só proprietário; refazer (seção 7) |
| `/api/backups`, `/agora`, `/<dia>` | GET/POST | backups automáticos guardados no banco | não | só proprietário |
| `/api/ler` (+`/status`) | POST/GET | foto/PDF → Claude (chave `ANTHROPIC_API_KEY`), 200 por dia | não | só proprietário (ler extratos) ou por permissão |
| `/api/recebidos` | GET/DELETE | arquivos enviados pelo Atalho | não | só proprietário |
| `/api/anexos` | POST/GET/DELETE | anexos de notas | não | por permissão do módulo |
| `/api/notif/*` | chave, estado, inscrever, config, resumo, teste, agora | notificações push (VAPID) | não | **conteúdo do resumo tem valores e alertas financeiros**: filtrar por usuário |
| `/api/djen/*` | teste, estado, lista, buscar, **importar**, oabs, marcar, processo, texto | Diário Oficial | não | publicações por advogado/OAB |
| `/api/datajud/processo` | GET | consulta CNJ | não | por permissão |
| Agendados (cron), horário de Brasília | segunda 04h: backup; 10h: DJEN + resumo; 12h/14h/16h/18h: releitura só se a das 10h falhou | | | continuar sem sessão (servidor) |

## 3. Coleções (tabela `docs(colecao, id, dados, atualizado)`)
| Coleção | Conteúdo | Natureza | Observação |
|---|---|---|---|
| `casos` | Iniciais (e honorários do processo) | jurídico + **honorários** | parcelas pagas ficam no mesmo registro dos dados contratuais |
| `termosAcordo`, `alvaras` | Acordos e Alvarás | jurídico + **honorários** | idem |
| `clientes` | clientes, apelidos, vínculo automático | jurídico | |
| `processos` | processos (importados, manuais), revisão | jurídico | ids `d<número>` nos importados |
| `agenda` | prazos, audiências, tarefas | jurídico | **limite 1.000 pode estourar com o tempo** |
| `pecasAprendidas` | aprendizado de peças | jurídico | |
| `despesas`, `receitasManuais`, `saldos`, `metas` | finanças PJ/PF e patrimônio | **só do proprietário** | transferência = 1 despesa + 1 receita ligadas por `transferenciaId` |
| `extratos`, `obraMov` | extratos e Construção | **só do proprietário** | |
| `config` | 11 documentos de naturezas diferentes | **misturado** | só do proprietário: `planejamento`, `obra`, `extratos`, `relatorioMurilo`, `backup`; gerais: `personalizacao`, `modelosHonorario`, `alertasDispensados`, `vinculoIniciais`, `importacaoAuto`, `processosIgnorados` |
| `_pub`, `_djen` | publicações e OABs | sistema | **fora do backup** |
| `_backups`, `_anexos`, `_recebidos`, `_notif`, `_sistema` | backups, anexos, arquivos do iPhone, push, tentativas de login | sistema | `_anexos` fora do backup (adiado por decisão) |
Não existem hoje: usuários, sessões, auditoria, lixeira. Seguirão a convenção `_` (invisíveis para `/api/db`).

## 4. Funcionalidades a preservar (menu atual) e a quem pertencerão
- **Jurídico, para todos conforme permissão:** Início (parte jurídica), Iniciais, Termos de Acordo, Alvarás, Agenda, Processos (lista, análises, importação, revisão), Publicações, Clientes, Arquivados, Relatórios para imprimir, Pergunte ao app (filtrado), Cobrança de clientes (separada do relatório do Murilo).
- **Só do proprietário (some do menu e é bloqueado no servidor):** Divisão do mês, Hygor (PJ), Pessoa física, Patrimônio e metas, Análises e projeção, Construção, Extratos do banco, Ler foto ou PDF, Recebi R$, Fechamento do mês, Relatório do Murilo; marcar parcela como paga (por enquanto).
- **Vão para Configurações (só proprietário):** Lembretes do iPhone e notificações, Backup e restauração, Exportar lista (CSV), Lixeira, Registro de ações, depois Usuários, Perfis e permissões, OABs, regras operacionais.
- **Ficam no menu:** Sair, Tema, Discreto.

## 5. Onde aparecem honorários e totais (mapa para as permissões)
- **Início:** “Pendente”, “Vencido” e **“Recebido no mês”**. Este último soma honorários recebidos **e** `receitaManualPj` (renda lançada na PJ). Precisa ser separado: honorários = faturamento dos processos; renda da PJ = finanças do proprietário. Também mostram valores: “Ver por origem”, Relatório para o Murilo, Cobrar clientes próprios, Divisão do mês, Central de atenção (prazos e parcelas a receber; conferir se os alertas do Pergunte ao app incluem avisos financeiros), Recebi R$.
- **Iniciais, Acordos, Alvarás:** parcelas (valor, vencimento, pago), totais das telas, “a receber”, honorário principal. Funções-chave: `honorarioPrincipal`, `acordoDetalhePagamento`, `renderStatsAlvaras`, `exitoDetalheHtml`, `desfazerGrupoRecebi`.
- **Processos:** chips “a receber/quitado”, bloco “Honorários que vou receber” da ficha, relatório do processo.
- **Clientes:** perfil (`renderPerfil`: cobranças, valores por documento) e `exportarClientes`.
- **Arquivados:** valores por item.
- **Análises/relatórios:** análises financeiras (só proprietário). Os relatórios para imprimir (`rpt*`) também mostram honorários: a lista de Processos tem a coluna “a receber” e o relatório do cliente tem a opção “Incluir os honorários a receber”; precisam obedecer à permissão de honorários.
- **Exportações CSV:** `exportarPeticoes`, `exportarClientes`, `linhasCsvCobranca` trazem valores.
- **Notificações push:** o resumo diário carrega valores e alertas; com vários usuários precisa ser filtrado.
- **Pergunte ao app:** monta “fatos” no navegador com os dados que a tela carregou; se o servidor não entregar um dado, ele não entra.
- **Busca global, Discreto:** conferir ao implementar.

## 6. Advogados participantes: DJEN x DataJud
- **DataJud (testado com 2 processos reais do TJGO):** campos devolvidos: classe, assuntos, órgão julgador, data de ajuizamento, grau, sigilo, sistema, movimentos. **Não traz partes nem advogados.**
- **DJEN (testado com 700 publicações, 284 processos, 90 dias):** **todas** as publicações trazem a lista de advogados dos destinatários, com nome, número da OAB e UF. Em todos os 284 processos aparece a OAB 60456/GO (a pesquisada) e em **204 deles também a 49308/GO (Murilo)**. A lista tem de 1 a 5 (ou mais) OABs por processo (inclui advogados de outras partes).
- **Como usar:** “nossos advogados” = as OABs cadastradas em Publicações que aparecem na lista da publicação. Para isso é preciso cadastrar as 4 OABs (hoje há 2). Um advogado só aparece num processo depois da primeira publicação em que foi intimado.
- **Já guardado:** cada publicação tem `advs` (nome e OAB) e `oabs` (quais OABs monitoradas a viram). **Faltam duas coisas:** (1) a importação não grava no processo as OABs que o encontraram (o dado existe no momento da busca); (2) copiar para o processo, a cada publicação nova, os advogados nossos reconhecidos. **Feito em 09/11 (Fase 1, item 7):** `src/advogados.js` e importação gravam o campo `advogados`. Isso completa os processos antigos com o tempo, como combinado.

## 7. Bugs, riscos e inconsistências confirmados
Gravidade: **A** alta (corrigir antes de qualquer compartilhamento), **M** média, **B** baixa.
1. **M — Restauração (corrigido em 08/11, ao começar a Fase 1).** Existem dois caminhos. (a) **O da tela** (Backup e restauração → Importar) **já confere o arquivo** (versão, listas, ids repetidos, limites, arquivo vazio), **exige baixar uma cópia dos dados atuais** antes e restaura em duas fases (grava tudo do backup e só depois remove as sobras). O que falta: não é atômico (feito registro a registro pelo navegador, lento; queda de conexão no meio deixa o banco misturado), a “cópia de segurança” é só um arquivo baixado (não há “desfazer” dentro do app) e não mostra o que vai mudar. (b) **A rota do servidor `/api/restaurar` é insegura** (não confere, grava em blocos de 50, não remove sobras, ignora inválidos em silêncio), mas **a tela não a usa**: é só superfície de risco, a remover ou substituir. No relatório original eu classifiquei o caminho (b) como se fosse o da tela; a gravidade real é **média**, não alta.
2. **A — Backups no mesmo banco** (últimos 8 dias): se o banco se perder, os backups vão junto. Não guardam `_pub` (lido/não lido), `_djen` (OABs e estado da leitura), `_notif` nem `_anexos`. Sugestão: cópia fora do banco (e verificar o recurso de restauração por ponto no tempo do próprio D1, a confirmar no plano contratado).
3. **M — Transferência PJ/PF em dois registros (corrigido em 08/11, Fase 1 item 5: gravação e exclusão em lote atômico, `/api/lote`)** (`despesas` + `receitasManuais` com `transferenciaId`); o estorno apaga os dois pelo navegador, um de cada vez. Falha de conexão no meio deixa os saldos desencontrados.
4. **M — Limite de 1.000 registros** na API e na tela. A coleção que mais cresce é a **Agenda** (cada prazo é um registro): ao passar de 1.000 itens, os mais novos ou antigos somem da tela sem aviso. **A confirmar** a contagem real em produção.
5. **M — Sem controle de versão**: cada gravação troca o registro inteiro; dois aparelhos editando o mesmo registro, o último vence sem aviso. (A importação nova usa criação atômica, `?soNovo=1`, e não sofre disso.)
6. **M — Sessão não revogável**: o cookie vale 30 dias e só se invalida trocando a `SENHA`. **Bloqueio geral de login**: 30 falhas somadas de qualquer origem trancam o login de todos (inclusive o seu) por 15 minutos; dá para repetir à vontade (negação de acesso por terceiros).
7. **M — Honorários e finanças misturados em dados e em totais (corrigido em 08/11, Fase 1 item 6: Início só com honorários; `config` dividido em `config` e `configDono`; tabela de coleções no servidor):** `Recebido no mês` (seção 5), parcelas pagas no mesmo registro do contrato, `config` com documentos de naturezas diferentes. Precisam ser separados antes de existirem perfis.
8. **M — Notificações push** levam valores/alertas financeiros no texto e valem para todos os aparelhos inscritos.
9. **B — Metas:** `metaValorAtual` soma **todos** os movimentos, sem olhar a data (`dia`). Um aporte lançado com data futura já entra no valor atual e no patrimônio. A confirmar se a tela permite data futura.
10. **B — Segurança de cabeçalhos:** sem `Content-Security-Policy`. O comentário do topo de `src/index.js` fala em Cloudflare Access, mas o login é por senha. `ALLOW_NO_AUTH=1` desliga todo o login: **confirmar no painel do Cloudflare que essa variável não existe em produção**.
11. **B — Testes:** os scripts que sobem o servidor e rodam a suíte **não estão no repositório** (estavam só na sessão de trabalho); `ler` e `pergunte` precisam de um servidor com Claude simulado e `extratos-arquivo` de um token. O teste `pergunte` estava **desatualizado** (esperava 9 atalhos em “Novo”, hoje são 11): corrigido nesta fase.

## 8. Testes e linha de base
43 arquivos em `test/`. Resultado nesta fase (ambiente local, dados simulados): **todos passam**, exceto `extratos-arquivo` (precisa de `ENVIO_TOKEN`, não executado). Novo: `backup-restauracao` (ida e volta de 42 registros em 14 coleções, íntegra). `pergunte` passou depois do ajuste. Pendência: colocar no repositório um script único que roda tudo com as variáveis certas.

## 9. Backup completo conferido?
- **Mecanismo:** conferido em teste. O backup do servidor e o backup automático cobrem as 14 coleções do app; a restauração devolve registros idênticos.
- **Produção:** não tenho acesso. Para conferir os **seus** dados reais, baixe um backup pelo app (Backup e restauração) e guarde o arquivo; se quiser, me envie para eu conferir contagens e consistência (só leio, não restauro).

## 10. Proposta para a Fase 1 (cada item com esboço e ok antes)
1. Restauração segura (conferir, cópia de segurança, aplicar de uma vez, desfazer).
2. Lixeira de 30 dias e registro de ações no ponto central do servidor.
3. Cópia de segurança fora do banco e backup incluindo `_djen`/`_pub`.
4. Transferência PJ/PF atômica.
5. Carregar coleções em lotes (resolve o limite de 1.000, começando pela Agenda) e mostrar em Configurações a contagem por coleção.
6. Menu enxuto e aba Configurações (esboço já previsto).
7. Login individual do proprietário, sessões encerráveis e bloqueio de login por origem; tabela única de política de rotas.
8. Separar “Recebido no mês” em honorários x renda da PJ; separar `config` em proprietário x geral.
9. Gravar OABs/advogados participantes no processo; script único de testes no repositório.
