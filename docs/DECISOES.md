# Horus — decisões já tomadas

Registro curto para não repetir conversa. Atualize quando algo for decidido. Fonte do plano: `Plano_Tecnico_Horus_2.0` (08/11/2026), com os ajustes abaixo, que **valem mais que o plano**.

## Princípios
- Um só aplicativo e um só banco. Não reconstruir; preservar dados, cálculos e funcionalidades.
- Etapas pequenas, cada uma com esboço em imagem, **ok do proprietário antes de implementar**, testes e README.
- Nenhuma conta de outra pessoa no ambiente de produção até a homologação da versão individual (fase de multiusuário é a última).
- Sem pedido do proprietário: não criar PR, não gastar com serviços pagos, não mexer em cálculos financeiros sem teste.

## Ordem das fases (ajustada)
0. Auditoria e inventário (sem mudar o sistema).
1. Correções e base de segurança da versão individual: restauração segura, lixeira de 30 dias e registro de ações no ponto central do servidor, login individual do proprietário com sessões que se podem encerrar, tabela única de política de rotas. Transferência PJ/PF atômica (pequena; recomendada). Paginação = carregar em lotes até completar (os cálculos rodam no navegador).
2. Reorganização visual: dashboards por módulo e sub-abas (reaproveitando os cálculos atuais, sem fórmulas paralelas).
3. Novos recursos financeiros e operacionais.
4. Homologação geral da versão individual.
5. Usuários, autenticação e permissões. 6. Configurações, perfis, agendas, OABs por advogado. 7. Segurança multiusuário. 8. Segurança avançada.

## Decisões do proprietário
- **Estagiários lançam dados em Acordos e Alvarás** (não bloquear essas abas). Fazem a **cobrança de inadimplentes**, então veem as parcelas e valores devidos pelos clientes.
- O que o estagiário **não** vê (proposta a confirmar com o esboço de 08/11): Finanças (PJ, PF, Patrimônio, reserva, saldos), Construção, backups, configurações, usuários, e qualquer total, indicador, análise, relatório ou exportação de faturamento/recebimentos.
- **Finanças e Construção não são opções de permissão**: são exclusivas do proprietário, e **as abas nem aparecem** para os demais usuários (e o servidor também bloqueia).
- Murilo: advogado, com os processos e honorários dos casos dele ou compartilhados; sem acesso geral ao financeiro.
- Login: e-mail e senha individuais; segundo fator só depois, sem SMS.
- Homologação em ambiente separado: **descartada** por ora.
- Anexos no backup e cópia fora do banco: **adiado** (o proprietário ainda não usa anexos). Rever quando começar a anexar.
- Horário da leitura automática do DJEN (10h) continua fixo.

## Regras de dados (já implementadas ou combinadas)
- Coleções que começam com `_` são reservadas ao sistema e não aparecem pela API `/api/db`; usuários, sessões, auditoria e lixeira serão coleções `_`.
- Backup do servidor guarda tudo que não começa com `_`.
- Importação de processos pelo DJEN: cliente automático vincula direto; demais vão para a revisão; processo excluído entra em `config/processosIgnorados` e não volta.
