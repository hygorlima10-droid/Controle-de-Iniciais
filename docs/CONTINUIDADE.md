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

## Situação atual (08/11/2026, fim do dia)
- Fase 0 concluída e entregue. **Fase 1 aprovada pelo proprietário, mas ele pediu para esperar o aviso dele antes de começar.**
- Pendência do proprietário: conferir no painel do Cloudflare se existe a variável `ALLOW_NO_AUTH` (não pode existir em produção) e baixar um backup do app para conferência.
- Novo item aprovado como ideia: **Banco Central de Ícones** (ver `docs/ICONES.md`), implementação a partir da Fase 2 (base invisível primeiro); logos de bancos e reconhecimento de extratos na Fase 3.

## Fase 1: andamento (iniciada em 08/11/2026)
Ordem: 1 restauração segura (**feito**); 2 menu enxuto e aba Configurações (**feito**: `cliente/configuracoes.js`, teste `configuracoes`); 3 lixeira de 30 dias e registro de ações no ponto central do servidor (**feito**: `src/auditoria.js`, `cliente/seguranca.js`, testes `lixeira-auditoria` e `lixeira-tela`); **próximo: 4 login individual do proprietário, sessões encerráveis e bloqueio de login por origem (precisa de esboço antes)**; 5 transferência PJ/PF atômica; 6 separar “Recebido no mês” e o `config`; 7 gravar advogados participantes; 8 script único de testes no repositório. Rebaixados pelo que o conector mostrou: carregar em lotes (maior coleção real tem 259) e cópia fora do banco (Time Travel do D1: 7 dias no plano gratuito).
A conta Cloudflare é **gratuita** (informado pelo proprietário em 08/11): Time Travel 7 dias; limites diários do D1 aplicados (folga enorme).
Observação: `ler` e `pergunte` só passam com servidor de Claude simulado (portas na primeira linha de cada teste); `extratos-arquivo` precisa de `ENVIO_TOKEN`.

## Conector do Cloudflare (08/11/2026)
Autorizado para colher informações; ver `docs/CLOUDFLARE.md` (volume real do banco, Workers, limites, Time Travel). Efeito no plano: carregar em lotes sem urgência; cópia fora do banco rebaixada (Time Travel cobre); R2 não ativado.
Respondido em 08/11: o Worker `controle-de-iniciais` era só ambiente de teste abandonado (o proprietário autorizou apagar; o conector não tem a ação de apagar Worker, então é no painel: Workers e Pages > controle-de-iniciais > Settings > Delete). O banco `controle-juridico-teste` (vazio) parece ser dele; perguntar antes de apagar.

## Pendências de decisão
- Nenhuma aberta (decididas em 08/11: cobrança separada do relatório do Murilo; recebimentos e “marcar como paga” só do proprietário; honorários visíveis a advogados participantes e a estagiários por permissão).
- Próximo esboço antes de implementar: menu lateral enxuto + aba Configurações (lembretes/notificações, backup, exportar CSV, lixeira, registro de ações; depois Usuários e Perfis e permissões).
- Fase 0, item novo: verificar o que o DJEN e o DataJud trazem sobre **advogados do processo** (já sabemos que cada publicação guardada tem a lista `advs` com nome e OAB, vinda do DJEN; falta conferir o DataJud) e como completar os processos já cadastrados conforme chegam publicações novas.
- Lembrar na Fase 0: mapear onde marcar parcela como paga e “Recebi R$” aparecem (para travar só ao proprietário), e onde guardar “advogados participantes” em processos, iniciais, acordos e alvarás.
