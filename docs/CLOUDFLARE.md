# Horus — o que sabemos do Cloudflare (conector, 08/11/2026)

## Regras de uso do conector (combinadas com o proprietário)
- Autorizado: **colher informações** (listar Workers, bancos, contagens e tamanhos, documentação) para orientar as fases.
- Só leitura por padrão. Nada de criar, alterar ou apagar recursos (Worker, banco, bucket, variáveis) **sem pedir antes**. Nas consultas ao banco de produção, ler **contagens, tamanhos e nomes de documentos**, não o conteúdo de clientes e processos.

## Conta
- **Workers:** `controle-juridico` (o app; última alteração em 08/11 21:19 UTC, igual ao último envio ao GitHub: o deploy automático funciona) e `controle-de-iniciais` (criado em 03/11, sem alteração desde então: provável cópia da primeira publicação; **pendente de decisão do proprietário** se ainda é usado; se não for, apagar para não deixar um segundo endereço público do app).
- **Bancos D1:** `controle-juridico` (produção, 650 KB, região ENAM/EWR = leste dos EUA, sem réplica de leitura) e `controle-juridico-teste` (vazio, 24 KB, criado em 03/11, provavelmente do Worker antigo).
- **R2:** **não ativado** na conta (precisa ativar no painel, o que costuma exigir forma de pagamento). Por isso a cópia fora do banco por R2 fica para depois.
- **Plano da conta: gratuito** (informado pelo proprietário em 08/11): Time Travel de 7 dias; limites diários do D1 em vigor (5 milhões de leituras e 100 mil escritas por dia).
- O Worker `controle-de-iniciais` e o banco `controle-juridico-teste` são do ambiente de teste abandonado; o proprietário autorizou apagar o Worker (no painel, pois o conector não apaga Workers).

## Banco de produção (contagens em 08/11/2026)
`_pub` 259 · processos 127 · clientes 51 · despesas 27 · casos (Iniciais) 24 · receitasManuais 16 · extratos 14 · config 10 · obraMov 9 · termosAcordo 6 · alvarás 4 · saldos 2 · metas 1 · agenda 0 · pecasAprendidas 0 · `_notif` 6 (2 aparelhos inscritos no push) · `_backups` 1 (de 08/11) · `_djen` 1 · `_sistema` 3. Maior registro: 40 KB (o backup comprimido); registros comuns, menos de 3 KB. Esquema: uma tabela `docs` com índice por coleção.
`config` tem: alertasDispensados, backup, extratos, importacaoAuto, obra, personalizacao, planejamento, processosIgnorados, relatorioMurilo, vinculoIniciais. **Só do proprietário (finanças/Construção):** extratos, obra, planejamento, relatorioMurilo, backup. **Gerais:** alertasDispensados, personalizacao, importacaoAuto, processosIgnorados, vinculoIniciais.
Sinais de segurança no banco: 3 falhas de token em `/api/enviar` em 03/11 (um único IP, provavelmente o teste do Atalho do iPhone) e 2 falhas de login no total (última em 07/11). Nada indica ataque.

## O que a documentação do Cloudflare diz (conferido hoje)
- **D1 Time Travel** (restaurar o banco a qualquer minuto): **30 dias no plano pago, 7 no gratuito**; sempre ligado, sem custo, sem precisar configurar. Restaura por `wrangler d1 time-travel` ou pela API; a restauração se desfaz voltando a um marcador anterior. Isso **cobre em boa parte** o risco de “backups no mesmo banco”.
- **Limites do D1:** banco até 500 MB (gratuito) ou 10 GB; `db.batch()` conta como **uma** consulta por execução do Worker (a troca da restauração segura cabe); resultado de consulta até 50 MB (vale desde 04/11/2026); plano gratuito: 5 milhões de linhas lidas e 100 mil escritas por dia (aplicado desde 01/09/2026). Com o volume atual, folga enorme.
- **Subrequisições por execução:** 50 externas no plano gratuito (10.000 no pago); a leitura do DJEN por página já respeita isso.
- **Jurisdição dos dados:** o banco existente roda nos EUA; o D1 permite criar bancos com jurisdição `us` (e outras) só na criação. Informação útil para a LGPD do escritório; não é urgente.

## Efeito no plano
- **Carregar coleções em lotes** (limite de 1.000 registros): **feito na Fase 3 (3.10)**; as listas são lidas em páginas até acabar.
- **Cópia fora do banco:** rebaixada. Com Time Travel (7/30 dias) + backups baixados pelo app + cópias de segurança automáticas, o risco é baixo. R2 só se o proprietário ativar.
- **Backup semanal:** o primeiro cron (segunda 04:00, horário de Brasília) ainda não rodou; conferir na segunda-feira que `_backups` ganhou o backup do dia.

## Limpeza feita em 11/11/2026 (início da Fase 4)
O proprietário apagou o Worker `controle-de-iniciais` no painel e autorizou apagar o banco vazio `controle-juridico-teste`; o banco foi apagado pelo conector (sem tabelas, só o Worker abandonado o usava) e o arquivo `wrangler.teste.jsonc` saiu do repositório. Hoje existe só o Worker `controle-juridico` e o banco `controle-juridico`.
