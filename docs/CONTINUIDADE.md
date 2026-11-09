# Horus — onde paramos

Atualize ao fim de cada sessão (arquivos alterados, o que foi feito, testes, próximo passo).

## Estado em 08/11/2026
- Ramo de trabalho: `claude/legal-financial-control-review-l0hqsr` (último commit de funcionalidade: revisão de processos importados, vinculação em lote).
- Entregue e em uso: publicações do DJEN (várias OABs, leitura ao abrir o app), cadastro de processo por número CNJ (DataJud), peças e prazos sugeridos (com aprendizado), análises de processos, relatórios para imprimir, importação de processos do Diário Oficial com vínculo automático de clientes e revisão.
- Testes: `test/*.test.mjs` (rodam com Playwright e servidores simulados; `extratos-arquivo` precisa de chave e é ignorado). Variável do Worker de teste: `IMPORTAR_AUTO=0`.
- Estrutura: Worker (`src/index.js`, `src/djen.js`, `src/datajud.js`, `src/pecas.js`), banco D1 com uma tabela `docs(colecao,id,dados,atualizado)`, módulos da tela em `cliente/*.js` injetados em `public/index.html` por `cliente/montar.py`.

## Fase 0: concluída em 08/11/2026
Relatório completo em `docs/FASE0-DIAGNOSTICO.md` (rotas, coleções, funcionalidades, mapa de honorários e totais, advogados participantes, bugs e riscos, testes, backup). Nada do app foi alterado; adicionado `test/backup-restauracao.test.mjs` e corrigido `test/pergunte.test.mjs`.
Resultados que importam: restauração sem atomicidade nem desfazer (rota `/api/restaurar` insegura e não usada pela tela); backups no mesmo banco; transferência PJ/PF em dois registros; limite de 1.000 registros (Agenda); sessão não revogável; `Recebido no mês` mistura honorários e renda da PJ; `config` mistura documentos do proprietário e gerais; DataJud não traz advogados, DJEN traz.
Para confirmar em produção: contagem de registros por coleção; `ALLOW_NO_AUTH` não definida; baixar um backup para conferência.

## Situação atual (09/11/2026): Fase 1 concluída
- **Fase 1 concluída** (itens 1 a 8, abaixo). O proprietário vai testar em produção e dar uma pausa antes da Fase 2.
- **Ao publicar** (uma vez): cada aparelho entra de novo (primeiro aparelho: senha antiga → “Crie o seu acesso” com e-mail e senha de 12+ caracteres); a migração da configuração (`configDono`) roda sozinha na primeira abertura; guardar a senha antiga (é a chave de emergência em `/recuperar`). Chave de retorno do login: variável `LOGIN_ANTIGO=1`.
- **Pendências do proprietário:** (1) cadastrar as 4 OABs em Publicações (hoje 2) para os advogados participantes saírem completos; (2) apagar o Worker abandonado `controle-de-iniciais` no painel do Cloudflare; (3) decidir sobre o banco vazio `controle-juridico-teste`; (4) enviar os arquivos oficiais dos logos dos bancos quando chegar a Fase 3; (5) conferir se a variável `ALLOW_NO_AUTH` não existe no Worker de produção (já informado que não existe).
- **Próximo:** Fase 2 (dashboards e sub-abas; base do Banco Central de Ícones, ver `docs/ICONES.md`), sempre com esboço em imagem e OK antes de implementar. Fases 5 a 7 (multiusuário) só depois da Fase 4 (homologação).
- **Testes:** `npm test` roda tudo (ver README).

## Fase 1: andamento (iniciada em 08/11/2026)
Ordem: 1 restauração segura (**feito**); 2 menu enxuto e aba Configurações (**feito**: `cliente/configuracoes.js`, teste `configuracoes`); 3 lixeira de 30 dias e registro de ações no ponto central do servidor (**feito**: `src/auditoria.js`, `cliente/seguranca.js`, testes `lixeira-auditoria` e `lixeira-tela`); 4 login individual do proprietário, sessões encerráveis e bloqueio por aparelho (**feito**: `src/acesso.js`, `src/paginas.js`, Configurações › Segurança em `cliente/seguranca.js`, testes `login-individual` e `login-tela`; `login` agora roda com `LOGIN_ANTIGO=1`); 5 transferência PJ/PF atômica (**feito**: `src/lote.js`, rota `/api/lote`, `window.__horusLote` em `public/shim.js`, patches em `cliente/montar.py`, teste `transferencia-atomica`); 6 separar “Recebido no mês” e o `config` (**feito**: `src/colecoes.js`, `src/migracao.js`, Início em `cliente/montar.py`, teste `config-separada` com banco semeado por `test/semente-config.sql`); 7 gravar advogados participantes (**feito**: `src/advogados.js`, campo `advogados` em processos, Iniciais, Acordos e Alvarás, teste `advogados-participantes`); 8 script único de testes no repositório (**feito**: `npm test` = `test/rodar.mjs`, grupos e portas descritos no próprio arquivo; semente em `test/semente-config.sql`). **Fase 1 concluída em 09/11/2026.** Rebaixados pelo que o conector mostrou: carregar em lotes (maior coleção real tem 259) e cópia fora do banco (Time Travel do D1: 7 dias no plano gratuito).
A conta Cloudflare é **gratuita** (informado pelo proprietário em 08/11): Time Travel 7 dias; limites diários do D1 aplicados (folga enorme).
Observação: `ler` e `pergunte` só passam com servidor de Claude simulado (portas na primeira linha de cada teste); `extratos-arquivo` precisa de `ENVIO_TOKEN`.

## Login individual: o que fazer ao publicar
- Depois do deploy, **cada aparelho entra de novo uma vez**: primeiro aparelho: senha antiga → "Crie o seu acesso" (e-mail hygorandrade17@hotmail.com e senha de 12+ caracteres); os demais: e-mail e senha novos. O atalho do iPhone (token `ENVIO_TOKEN`) e as notificações não mudam.
- Guarde a senha antiga (`SENHA`): é a chave de emergência em `/recuperar`. Se algo der errado, defina a variável `LOGIN_ANTIGO` = `1` no Worker para voltar ao acesso antigo.
- Testes do acesso individual rodam em servidor **sem** `LOGIN_ANTIGO` e com banco novo; todos os outros testes rodam com `--var LOGIN_ANTIGO:1`.

## Item 6 (Início só com honorários e configuração separada): o que muda e como voltar atrás
- **Início:** o total e a barra são **só honorários** (“Honorários recebidos no mês”); a renda lançada na PJ aparece num quadro tracejado “só você vê”, fora do total. O cartão “Outras receitas da PJ” saiu de “Ver por origem”.
- **Configuração:** `planejamento`, `obra`, `extratos`, `relatorioMurilo`, `alertasDispensados` e `backup` passaram de `config` para a coleção `configDono` (só proprietário). Fica em `config`: `personalizacao`, `modelosHonorario`, `vinculoIniciais`, `importacaoAuto`, `processosIgnorados`. A migração roda sozinha na primeira requisição depois da atualização (`src/migracao.js`, uma transação só, marca `_sistema/mig-config-dono-v1`).
- **Compatibilidade:** o endereço antigo `/api/db/config/<documento do proprietário>` continua valendo (o servidor leva para `configDono`) e a lista de `config` ainda traz esses documentos para o proprietário; assim um aparelho com o app já aberto não recria documentos nem perde dados. Backups feitos antes da separação restauram direto para `configDono`.
- **Tabela de coleções** (`src/colecoes.js`): coleção fora da tabela é recusada; coleções de finanças e `configDono` só abrem para o proprietário (a checagem de papel já está no servidor, vale quando existirem outros usuários).
- **Voltar atrás:** o original de cada documento ficou em `_sistema/cfg-antes-<nome>`. Para desfazer: copiar esses registros de volta para `config` (`INSERT ... SELECT 'config', substr(id,11), dados ...`), apagar de `configDono` e apagar a marca `mig-config-dono-v1` (ou usar o Time Travel de 7 dias do D1).

## Importar compromissos da Agenda por arquivo (09/11/2026, antes da Fase 2)
- Pedido do proprietário: importar a agenda do Control Jus (novembro e dezembro) com datas e dados exatos, número de processo e partes, ligando a Clientes e Processos. Feito para o **XML** (mais exato que o PDF; o PDF traz a mais foro, vara, instância e quem criou, que o DataJud completa depois). `cliente/agenda-importar.js`, teste `agenda-importar` (arquivos XML gerados no próprio teste, com nomes fictícios).
- Regras decididas: “Andamento” vira Tarefa; processo novo é cadastrado; cliente parecido (não igual) pede escolha em vez de ligar sozinho; **a equipe (Estagiários, Hygor, Murilo) é tratada como responsável, não como parte** (o Control Jus lista usuários como participantes); os demais participantes são clientes/partes (ex.: Adineu Alves da Silva é cliente). Compromissos pendentes e futuros recebem os avisos padrão; concluídos e passados, não.
- **Reconhecimento de cliente (cuidado com cooperativas parecidas, ex.: Complem x Coapil):** liga sozinho só quando há **um único** cliente com exatamente aquele nome ou apelido, ou quando o cliente está marcado “vincular automaticamente” e o nome é uma forma mais curta/longa dele (mesma regra da importação do Diário Oficial). Em qualquer outra dúvida a tela mostra **todos os candidatos** (até 4) e não escolhe por você. Dois nomes parecidos no mesmo arquivo **não são juntados sozinhos**: aparece o aviso e a opção “Mesmo cliente que…”. O que você confirma vira apelido do cliente escolhido. Simulação com os nomes reais: Complem x Coapil dão nível 0 entre si (compartilham só “Cooperativa” e “Mista”).
- O compromisso guarda `obs`, `subtipo`, `prioridade`, `responsaveis`, `partes`, `clienteIds`, `codigoControlJus` e `importKey`; o editor da Agenda ganhou o campo Observações.

## Advogados participantes (item 7)
- Campo novo `advogados: [{ oab: '60456/GO', nome: '…' }]` em `processos`, `casos` (Iniciais), `termosAcordo` e `alvaras`. “Nossos advogados” = as OABs cadastradas em Publicações; entram os que aparecem na lista de advogados de alguma publicação do processo **ou** cujas OABs encontraram a publicação. Advogado de outra parte nunca entra. Só acrescenta; nunca remove.
- Quando roda: depois de cada leitura do DJEN com publicação nova, a cada 6 horas na leitura e em `POST /api/djen/advogados`. A importação de processos pelo Diário Oficial (manual e automática) já grava no nascimento. Processos antigos são completados com o tempo, como combinado.
- Ainda **sem tela**: serve de base para “advogado vê honorários só dos processos em que participa” (fase de usuários). O proprietário poderá corrigir à mão depois.
- Atenção para a fase de usuários: cadastre as 4 OABs em Publicações (hoje 2) para que todos os advogados nossos sejam reconhecidos.

## Conector do Cloudflare (08/11/2026)
Autorizado para colher informações; ver `docs/CLOUDFLARE.md` (volume real do banco, Workers, limites, Time Travel). Efeito no plano: carregar em lotes sem urgência; cópia fora do banco rebaixada (Time Travel cobre); R2 não ativado.
Respondido em 08/11: o Worker `controle-de-iniciais` era só ambiente de teste abandonado (o proprietário autorizou apagar; o conector não tem a ação de apagar Worker, então é no painel: Workers e Pages > controle-de-iniciais > Settings > Delete). O banco `controle-juridico-teste` (vazio) parece ser dele; perguntar antes de apagar.

## Pendências de decisão
- Nenhuma aberta (decididas em 08/11: cobrança separada do relatório do Murilo; recebimentos e “marcar como paga” só do proprietário; honorários visíveis a advogados participantes e a estagiários por permissão).
- Próximo esboço antes de implementar: menu lateral enxuto + aba Configurações (lembretes/notificações, backup, exportar CSV, lixeira, registro de ações; depois Usuários e Perfis e permissões).
- Fase 0, item novo: verificar o que o DJEN e o DataJud trazem sobre **advogados do processo** (já sabemos que cada publicação guardada tem a lista `advs` com nome e OAB, vinda do DJEN; falta conferir o DataJud) e como completar os processos já cadastrados conforme chegam publicações novas.
- Lembrar na Fase 0: mapear onde marcar parcela como paga e “Recebi R$” aparecem (para travar só ao proprietário), e onde guardar “advogados participantes” em processos, iniciais, acordos e alvarás.
