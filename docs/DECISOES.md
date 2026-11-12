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
- **Início (decidido em 09/11, revê o item 6):** o total “Recebido no mês” **volta a somar honorários + outras receitas da PJ**, sem o quadro tracejado; e os cards de total recebido, A receber, Vencido, “Ver por origem”, Divisão do mês e extratos aparecem **só para o proprietário**. Os demais usuários (advogados e estagiários) veem só a **Central de atenção** (o que vence, para as estagiárias cobrarem), os prazos e os valores dentro das abas de Iniciais, Acordos e Alvarás. O problema que motivou: elas verem o total que o proprietário ganhou no mês.
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

## Fase 2 encerrada (09/11/2026)
- Entregue: 2.1 base de ícones, 2.2 Iniciais/Acordos/Alvarás, 2.3 Processos/Agenda/Publicações/Clientes, 2.4 Financeiro e Construção.
- **Seletor de ícones (2.5) adiado:** o proprietário preferiu deixar o sistema escolher o ícone por enquanto.
- Em aberto, a critério do proprietário: indicador “Custo estimado final” da obra (precisa definir a conta); cartão de totais de volta nas listas, em versão compacta; sub-aba “OABs” em Publicações.

## Fase 3: decisões do proprietário (10/11/2026, a partir do esboço v2)
- **Escopo:** seletor de peça na publicação; Kanban e todas as abas com **uma largura só** no computador (limite de 1440 px, barra do topo incluída); Análises com **Último mês (repaginado), Histórico, Semanas, Simulador e Futuro** (sem “6 meses”, “12 meses” nem “Próx. 3 meses”; o conteúdo da antiga “Próx. 3 meses” — como cada mês termina, o que deve entrar/sair, dinheiro da obra a receber, principais entradas e saídas, a receber sem data — vai para **Futuro**, repaginado no padrão); **Orçamento por categoria** (80% e 100%); **Simulador**; **Futuro** (projeção 12/24/36 meses, estimativa); **Construção** (cartões “custo estimado final” e “recursos próprios”, cartão do dinheiro da obra menor; diferença de centavos conta como “bate”); **Contas dos extratos** com logos e reconhecimento em 3 níveis; **conflito de edição** e **fim do limite de 1.000 registros**.
- **Fora:** relatório mensal em PDF; metas com data futura; backup completo; melhorias pequenas.
- **Fechamento do mês:** automático; o app fecha na primeira abertura do dia 1º (ou depois), com os valores do último dia do mês.
- **Seletor de peça:** a escolha manual **entra no aprendizado** (mesmo mecanismo de hoje: escolher outra peça que não a sugerida).
- **Logos:** o proprietário **assume o uso**. Itaú, C6, Caixa e Sicoob (arquivos baixados/enviados) ficam em `public/icones/bancos/`.
- **Ordem:** 3.1 seletor de peça; 3.2 largura única + Kanban largo; 3.3 Semanas; 3.4 Análises reorganizadas (Histórico, fechamento automático, Último mês; sai “6/12 meses”); 3.5 Orçamento; 3.6 Simulador; 3.7 Futuro (aqui sai “Próx. 3 meses”, depois de o conteúdo estar no Futuro); 3.8 Construção; 3.9 Contas/logos/3 níveis; 3.10 conflito de edição + fim do limite.


## Regra de aparência: sem botões "+ Algo" tracejados (decidido em 11/11/2026)
O proprietário não gosta de botões com "+" no texto e borda tracejada (ficaram no Simulador e destoavam do resto do app). **Não usar mais esse padrão.** Para adicionar itens, usar botões no padrão do app: bloco com ícone colorido (`mdIc`) e nome em duas linhas, em grade (como "Adicionar ao cenário" no Simulador), ou `btn btn-primary` / `btn btn-ghost` com texto direto ("Adicionar receita"), sem o "+".

## Fase 3 concluída (11/11/2026)
Etapas 3.1 a 3.10 entregues na ordem aprovada. O que ficou de fora de propósito: relatório mensal em PDF, metas com data futura, backup completo com anexos e leitura do Diário, melhorias pequenas, alertas de orçamento no resumo das 10h, "Folga da PJ" no Simulador e a identificação do aparelho no aviso de conflito.

## Fase 5: usuários, autenticação e permissões — decisões do proprietário (11/11/2026)
Um único aplicativo e um único banco; cada pessoa vê "o seu aplicativo".
- **Papéis:** proprietário (1), advogado (Murilo e os outros, mesma regra para todos) e estagiário. Sem limite de usuários no início.
- **Convite por link** (vale 48 h, uso único; a pessoa cria a própria senha; o proprietário nunca sabe a senha de ninguém).
- **Finanças pessoais** (PJ, PF, Patrimônio, Orçamento, Análises, Construção, Extratos, ler foto/PDF, Relatório do Murilo, Início completo, configurações, backup, lixeira, registro de ações) são **só do proprietário** (a tela esconde e o servidor recusa).
- **Advogado vê por participação:** Iniciais, Acordos, Alvarás, processos, honorários, parcelas em atraso, cobrança e prazos **dos processos em que está cadastrado** (`advogados[].oab` do registro ∩ OABs do usuário). Um processo pode ter um ou mais advogados do escritório; todos veem. **Clientes:** só os ligados aos seus processos. Honorários aparecem como o total do processo.
- **Publicações** filtradas pelas OABs de cada pessoa (o proprietário também, com opção de ver todas).
- **Estagiário vê o escritório inteiro** (trabalha para todos, não tem processos próprios): lança e edita Iniciais, Acordos e Alvarás e faz cobrança; **não marca recebimento**; totais e indicadores de honorários só se o proprietário ligar; **excluir registros é permissão separada, desligada por padrão** (vale também para advogado).
- **Recebimento:** cada advogado marca o recebimento dos honorários dos processos de que participa. Se o proprietário também está no processo, recebe um **alerta na Central de atenção** (etapa 5.6). A cobrança de honorários também fica disponível para os advogados (nos seus processos).
- **Agenda:** o proprietário abre em "Minha agenda" (padrão), com "Escritório" ao lado. Tarefas podem ser **compartilhadas** (para ver quem está mais carregado); prazos e audiências de processos ficam sempre no Escritório. Nas listas do proprietário: "Meus | Escritório".
- **Processos sem advogado definido:** o proprietário ganha uma revisão na aba Processos (como a revisão da importação pelo Diário) para definir os "Advogados responsáveis". Enquanto não há advogado, o registro só aparece para o proprietário e para o estagiário (hoje: 17 de 24 Iniciais, 2 de 6 Acordos, 2 de 5 Alvarás e 4 de 184 processos).
- **Etapas:** 5.1 regras no servidor · 5.2 usuários e convites · 5.3 visibilidade por participação e Publicações por OAB · 5.4 "Meus | Escritório" e advogados responsáveis · 5.5 agenda minha/escritório e tarefas compartilhadas · 5.6 honorários, cobrança e recebimento por participação (+ alerta) · 5.7 aplicativo por papel · 5.8 rastro e avisos · 5.9 homologação por papel e por pessoa.

### Etapa 5.1 (feita em 11/11/2026): regras no servidor (sem tela nova)
- `src/politica.js` decide tudo (negar por padrão). Usuário normalizado: `papel`, `oabs` (chave "60456/GO") e `permissoes` (`excluir`, `verTotais`; desligadas por padrão, o proprietário tem todas). Ainda **não há tela** para cadastrar OABs/permissões (etapa 5.2): enquanto isso só o proprietário existe.
- Leitura: coleções do proprietário (finanças, config, extratos…) → 403 para os outros; `config` só os documentos `personalizacao` e `preferencias`. Listas, "resumo" e paginação do advogado vêm **já filtradas no servidor** (ele nunca recebe o que não vê). Advogado: participação; clientes ligados aos seus processos (por `clienteIds` do processo ou pelo nome na Inicial/Acordo/Alvará) ou criados por ele; agenda = a própria + compartilhadas + as de processos em que participa. Estagiário: jurídico inteiro.
- Gravação: advogado só altera o que vê, o que ele cria já nasce com ele como advogado responsável, não pode se retirar do registro; tarefa/cliente novos recebem `criadoPor`; tarefa de outro só quem criou altera. Estagiário **não cria nem desfaz recebimento** (campos `pago`, `status`, `dataRecebimento`, `recebidoEm`, `parciais` do registro e das parcelas/êxito); o resto edita. Exclusão só com a permissão `excluir` (vale para advogado e estagiário). O lote (`/api/lote`) segue as mesmas regras.
- `/api/notif`, `/api/djen` e `/api/datajud` passam a ser só do proprietário até terem filtro próprio (etapa 5.3). `/api/eu` devolve papel, nome, OABs e permissões.
- Teste: `permissoes` (grupo novo, porta 8816, semente `test/semente-permissoes.sql` com 5 pessoas e sessões prontas).
- **Estagiário e publicações/agendas (decidido em 11/11/2026):** o estagiário também vê **todas as publicações e todas as agendas** do escritório, mas o proprietário pode **desligar por pessoa** as permissões `verPublicacoes` e `verAgendas` (ligadas por padrão para estagiário). Publicações: só leitura (estado, lista, processo, texto); não altera OABs, não busca nem marca como lida. Com `verAgendas` desligada ele vê só a própria, as compartilhadas e as de processos. O interruptor aparece na tela de usuários (etapa 5.2).

### Etapa 5.2 (feita em 12/11/2026): usuários e convites por link
- **Decisões do proprietário:** quem informa o **e-mail** é o proprietário (a pessoa só cria a senha; nome e e-mail ficam travados na página do convite); o interruptor **"Ver totais e indicadores de honorários"** existe para **advogado e estagiário** (advogado: ligado por padrão; estagiário: desligado); **"Excluir registros"** desligado por padrão nos dois; o advogado pode ser ligado a **quantas OABs** forem necessárias, cadastradas em Publicações **ou digitadas** (sem limite).
- **Servidor** (`src/usuarios.js`, rotas `/api/usuarios`, só do proprietário): lista pessoas e convites pendentes (nunca devolve senha/sal); cria convite (nome, e-mail, papel advogado/estagiário, OABs, permissões); gerar outro link / cancelar convite; ficha da pessoa (papel, OABs, permissões, desativar/reativar); aparelhos conectados da pessoa (encerrar um ou todos). Convidar o mesmo e-mail de novo substitui o convite pendente. **Não existe excluir pessoa.** O proprietário não é alterado por essa rota.
- **Convite:** guardado em `_convites` só pelo resumo (hash) da chave; vale 48 h e **uma vez** (a chave é "pega" antes de criar o usuário, então dois pedidos juntos não passam); depois de usado/vencido/cancelado a página dá "Convite indisponível". Senha mínima de 12 caracteres, bloqueio por tentativas como no login. Convites vencidos são apagados na limpeza diária. O proprietário recebe um aviso no iPhone quando o convite é aceito.
- **Página pública** `/convite/<chave>` (em `src/acesso.js`), com a mesma aparência do login. Quem aceita já entra logado.
- **Segurança por pessoa:** a tela Segurança do proprietário agora lista, encerra e troca senha **só das sessões dele** (antes mexia nas de todos).
- **Tela:** Configurações › Usuários (`cliente/usuarios.js`): lista, Convidar pessoa, link (copiar e WhatsApp), ficha com interruptores que gravam na hora. Padrão do app (sem botões com "+").
- Testes: `usuarios` (servidor) e `usuarios-tela` (tela), no grupo `permissoes` (porta 8816).
