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
- **Estagiários lançam dados em Iniciais, Acordos e Alvarás** (não bloquear essas abas). Fazem a **cobrança de inadimplentes**, então veem as parcelas e os valores devidos pelos clientes.
- **Dois mundos separados** (decisão de 08/11, 2ª versão): (1) **faturamento dos processos** (honorários: quanto cada processo rende), que é dado jurídico e **pode ser liberado a advogados e estagiários por permissão do proprietário**; (2) **finanças pessoais do proprietário** (PJ, PF, Patrimônio, reserva, saldos, projeções, Construção), que **nunca** aparecem para ninguém além dele.
- **Finanças e Construção não são opções de permissão**: são exclusivas do proprietário, as abas e ferramentas **nem aparecem** para os demais, e o servidor também bloqueia.
- **Ferramentas que são do proprietário** e não aparecem para advogados nem estagiários: Divisão do mês, Hygor (PJ), Pessoa física, Patrimônio e metas, Análises e projeção, Construção, Extratos do banco, Ler foto ou PDF, Recebi R$, Fechamento do mês pessoal e Relatório do Murilo. **A ferramenta de cobrança de clientes será separada do Relatório do Murilo** (decidido em 08/11): a cobrança fica disponível a quem cobra (estagiários, por permissão); o relatório do Murilo é só do proprietário.
- **Menu lateral enxuto**: tudo que é de administração vai para a nova aba **Configurações** (só do proprietário): Lembretes do iPhone e notificações, Backup e restauração (com restauração segura), Exportar lista (CSV), Lixeira, Registro de ações; depois Usuários, Perfis, OABs, etc. Permanecem no menu: abas jurídicas, grupo Financeiro (só dele), Sair, Tema e Discreto. A barra de baixo do estagiário não tem o botão Finanças.
- Custo conhecido: se a permissão de ver honorários puder ficar **desligada** para alguém, o servidor precisa esconder campos dentro de Iniciais, Acordos e Alvarás (e deixar o estagiário gravar sem apagar o que ele não vê). Desenhar isso com esboço na fase de usuários, depois do mapa da Fase 0.
- **Recebimentos: só o proprietário, por enquanto.** O “Recebi R$” e o **marcar parcela como paga** (dentro da Inicial, do Acordo e do Alvará) ficam só com o proprietário; estagiários e advogados **veem** as parcelas e a situação, mas não registram pagamento. Reavaliar conforme o uso. Consequência técnica: o servidor deve preservar os campos de pagamento quando outro usuário gravar o registro.
- **Honorários (faturamento dos processos)**: totais e indicadores de honorários podem ser vistos por advogados e estagiários. **Advogado**: vê o valor total dos honorários dos processos em que está cadastrado como participante (somos 4 advogados e nem todos atuam juntos em todos os processos); nos demais, não. **Estagiário**: o proprietário escolhe nas permissões. Exige guardar os advogados participantes em cada processo, Inicial, Acordo e Alvará (ainda não existe). **A informação de quais advogados participam do processo deve vir do DJEN e/ou do DataJud** (verificar na Fase 0 o que cada fonte traz); nos processos já cadastrados o sistema completa sozinho com o tempo, conforme chegam novas publicações. O proprietário poderá corrigir à mão.
- **Permissões ficam dentro de Configurações** (Usuários, Perfis e permissões, Agendas, OABs, Regras operacionais, Notificações, Segurança com Lixeira e Registro de ações, Backups, Exportar lista CSV, Lembretes do iPhone).
- Murilo: advogado, com os processos e honorários dos casos dele ou compartilhados; sem acesso geral ao financeiro.
- Login: e-mail e senha individuais; segundo fator só depois, sem SMS. **Implementado em 08/11 (Fase 1, item 4)** para o proprietário: e-mail hygorandrade17@hotmail.com; a senha antiga do Cloudflare (`SENHA`) virou chave de emergência (só recupera o acesso); sessões no banco, encerráveis; bloqueio de 5 erros por aparelho (sem trava geral); avisos no iPhone; PBKDF2 com 20 mil voltas no plano gratuito (limite de 10 ms de CPU por pedido), subindo por `VOLTAS_SENHA`; chave de retorno `LOGIN_ANTIGO=1`.
- Homologação em ambiente separado: **descartada** por ora.
- Anexos no backup e cópia fora do banco: **adiado** (o proprietário ainda não usa anexos). Rever quando começar a anexar.
- Horário da leitura automática do DJEN (10h) continua fixo.

## Regras de dados (já implementadas ou combinadas)
- Coleções que começam com `_` são reservadas ao sistema e não aparecem pela API `/api/db`; usuários, sessões, auditoria e lixeira serão coleções `_`.
- Backup do servidor guarda tudo que não começa com `_`.
- Importação de processos pelo DJEN: cliente automático vincula direto; demais vão para a revisão; processo excluído entra em `config/processosIgnorados` e não volta.
