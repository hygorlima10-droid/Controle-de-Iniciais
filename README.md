# Horus — versão servidor

O mesmo app que rodava dentro do Claude, agora num servidor seu (Cloudflare), com banco de dados próprio e login.

## Como funciona (resumo)
- `public/index.html` — o app (igual ao oficial, versão etapa 28).
- `public/shim.js` — faz o app falar com o banco do servidor em vez do banco do Claude.
- `src/index.js` — o servidor: confere o login, guarda e entrega os dados.
- `schema.sql` — a tabela do banco.

## Segurança
- Login com **senha** própria. A senha fica num segredo do Cloudflare (`SENHA`, mínimo 12 caracteres), nunca no código. Se o segredo não existir, o servidor **bloqueia tudo**.
- Sessão por cookie assinado (HttpOnly, Secure, SameSite=Strict), válida por 30 dias. Trocar a `SENHA` desconecta todos os aparelhos.
- Depois de 5 senhas erradas seguidas, o IP fica bloqueado por 15 minutos.
- Pedidos vindos de outros sites são recusados; o botão **Sair** fica no menu do app.

## Colocar no ar (passo a passo, uma vez só)
1. **Banco:** Cloudflare → *D1* → criar `controle-juridico`; o *Database ID* vai em `wrangler.jsonc`. Rode o `schema.sql` no *Console* do banco.
2. **Publicar:** *Workers & Pages* → importar este repositório (branch de produção = a branch de trabalho). Deploy command: `npx wrangler deploy`.
3. **Senha:** no Worker → *Settings* → *Variables and secrets* → *Add* → tipo **Secret**, nome `SENHA`, valor = sua senha longa → *Deploy*.
4. Abra o endereço `…workers.dev`, digite a senha. Para trazer seus dados: *Backup* no app antigo e *Restaurar backup* no novo.

## Testar no computador
```
npm install
npm run banco:local
npx wrangler dev --local --persist-to .dev-data --var SENHA:senha-de-teste-123 --port 8788
node test/login.test.mjs   # testes do login
node test/e2e-local.mjs    # cadastra, recarrega e confere
```

## Leitura de foto/PDF
Crie o segredo `ANTHROPIC_API_KEY` (chave do Console do Claude) no Worker. Enquanto ele não existir, os botões de câmera ficam escondidos. Opcional: `MODELO_LEITURA` troca o modelo (padrão `claude-sonnet-5-5`). Limite de 200 leituras por dia.
Teste local: `node test/ler.test.mjs` (usa um Claude simulado).

## O que ainda não funciona aqui
- **Extratos pelo Google Drive**: substituídos por arquivo do próprio aparelho (abaixo).


<!-- publicação disparada em 2026-11-03T03:19:47Z -->

## Extratos por arquivo e pelo Compartilhar do iPhone
- Tela **Extratos → Escolher extratos**: PDF do Itaú (PF/PJ) ou do Sicoob, ou arquivo OFX. O app lê, mostra a fila de conferência e só lança o que você confirmar.
- **Compartilhar do iPhone:** o iPhone não deixa um app da tela de início aparecer na folha de compartilhamento, então usa-se um **Atalho** que envia o arquivo para `POST /api/enviar` com o cabeçalho `Authorization: Bearer <ENVIO_TOKEN>` (e, opcionalmente, `X-Nome` com o nome do arquivo). Segredo do Worker: `ENVIO_TOKEN` (mín. 24 caracteres). O token só permite enviar arquivos (limite ~600 KB), nunca ler dados. Os arquivos ficam na lista "Recebidos pelo Compartilhar" até você tocar em **Ler os recebidos**.
- Testes: `node test/extratos-arquivo.test.mjs` (veja o cabeçalho; PDFs reais ficam fora do repositório).

## Pergunte ao app e ajustes de uso (branch `claude/pergunte-ao-app`)
- **Pergunte ao app** (`cliente/pergunte.js`, injetado no `public/index.html` por `python3 cliente/montar.py`): duas chamadas ao Claude. A 1ª (modelo rápido) entende a pergunta (consulta ou "e se"); o app calcula os fatos e, nos cenários, uma simulação determinística em cima da projeção de Análises; a 2ª chamada só explica com esses números.
- **Alertas** ("De olho" no Início), **metas com plano**, **fechamento comentado**, **busca ampliada**, **atalhos dinâmicos** e **Desfazer** (diário no `shim.js`, últimas 20 ações).
- **Backup semanal:** cron de segunda 07:00 UTC (`wrangler.jsonc` → `triggers.crons`) grava cópias comprimidas em `_backups` (últimas 8); `GET /api/backups`, `/api/backups/AAAA-MM-DD` (formato do app), `POST /api/backups/agora`.
- Testes: `node test/pergunte.test.mjs` (veja o cabeçalho).
- **Ao levar para a branch oficial:** não leve o `wrangler.jsonc` de teste; só acrescente o bloco `triggers.crons` ao do oficial.

## Layout do Início (faixa de ações, folha "Novo", alertas na Central)
- `cliente/layout.py` (rodado uma vez) moveu as ações para uma faixa no topo do Início (Recebi R$, Foto/PDF, Pergunte, Novo), removeu os botões flutuantes de câmera e Recebi R$ e a fileira de atalhos do fim, e criou os ícones novos (desfazer, câmera, pergunte, mais, sair, recibo, aviso).
- O botão **+** (fabNew) agora abre a folha **Novo** em todas as telas (no Financeiro continua o menu de lançamentos) e, no Início, só aparece depois que a faixa sai da tela.
- Os alertas ("De olho") viram linhas no topo da Central de atenção (`paInserirAlertas`, em `cliente/pergunte.js`).

- **Alertas dispensáveis:** cada alerta tem **Dispensar** (vale só no mês atual; gravado em `config/alertasDispensados` com a chave do mês) e a Central mostra "N alertas dispensados neste mês · mostrar de novo".
- **Início no desktop:** o grid usa a classe `sem-extr` quando não há extratos para conferir, e a última linha absorve a altura da Central de atenção, para os cartões ficarem juntos.

## Adiar parcela (dentro do Renegociar)
- `cliente/adiar.py` (rodado uma vez): ao tocar numa parcela atrasada na Central de atenção aparece a escolha **Marcar como recebido / Renegociar** (alvarás, êxitos e prazos seguem o fluxo antigo). O Renegociar abre no modo **só uma parcela** (seletor, data pelo calendário, motivo) e tem o link **Renegociar o contrato todo**.
- Adiar muda só o vencimento da parcela (`dataOriginal` e `adiadaEm` ficam gravados; histórico em `renegociacoes` com `tipo: "adiamento"`). As demais parcelas não mudam.
- Em **Cobranças e relatório do Murilo** há **Adiar atrasadas…**: lista só as atrasadas do Murilo, marcadas por padrão, para uma data só.
- Teste: `node test/adiar.test.mjs` (veja o cabeçalho).

## Notificações no iPhone (Web Push)
- Todo dia às **10:00 (Brasília)** o servidor (cron `0 13 * * *`, 13:00 UTC) envia uma notificação com **o que vence hoje** e, em notificações separadas, os **alertas novos do app** (cada alerta avisa uma vez por mês; atrasos de clientes não entram).
- O app (`cliente/notificacoes.js`) envia ao servidor, em segundo plano, uma lista com os vencimentos dos próximos 45 dias e os alertas atuais (`PUT /api/notif/resumo`); o servidor escolhe o que é de hoje. Preferências: incluir alertas, esconder nomes e valores.
- `src/push.js`: cifragem aes128gcm (RFC 8291) e assinatura VAPID (RFC 8292) só com WebCrypto. As chaves VAPID são geradas na primeira vez e ficam na área reservada do banco (`_notif`), fora dos backups.
- `public/sw.js`: service worker que mostra a notificação e abre o app ao tocar.
- Testes: `node test/push.test.mjs` (cifragem) e `node test/notif.test.mjs` (ponta a ponta; veja o cabeçalho).

## Construção 7B e 7C (financiamento, juros, caixa próprio, comprovantes e avisos)

- **Editar a obra** ganhou taxa de juros ao ano, sistema (SAC/Price), prazo do financiamento, início e prazo da obra e recursos próprios exigidos.
- Na aba **Construção**: *Financiamento e medições* (cronograma de liberações, "Registrar liberação" cria o lançamento e marca a medição), *Juros de obra* (estimativa mensal sobre o saldo liberado, "Lançar" cria o gasto), *Caixa próprio necessário* (mês a mês, pior mês e comparação com a sobra das Análises), *Checklist da obra* (lista padrão opcional, prazos) e *Conferência do extrato e comprovantes*.
- **Comprovantes**: botão *Anexar* em cada gasto (até 4 fotos/PDFs, até ~600 KB cada). Ficam no servidor (`/api/anexos`, coleção reservada `_anexos`) e **não entram no backup**. *Ler a nota e preencher o gasto* usa a IA sobre a foto.
- **Central de atenção** e notificações das 10h: gastos a pagar (10 dias), medições (15 dias), itens do checklist e juros do mês, com "Marcar como pago/feito" e "Adiar".
- Teste: `test/obra7.test.mjs` (porta 8802).

## Análises: visão "Último mês"

Novo primeiro botão no seletor da aba Análises (Último mês · 6 meses · 12 meses · Próx. 3 meses); a aba abre já nele. Mostra o mês fechado mais recente (setas ‹ › para outros meses): recebi, gastei e sobrou, comparação com a média dos até 6 meses fechados anteriores, origem das receitas, gastos por categoria (toque para ver as despesas), "o que mais mudou", o quadro dos 4 cenários (mês, média 6 m, média 12 m, próximos 3 meses) e uma leitura rápida. Só leitura: não grava nada. Teste: `test/analises-ultimo.test.mjs`.

## Tipografia unificada

Uma só fonte (Inter, pesos 400/600/700) e 8 tamanhos de letra, definidos em `:root` como `--t1` a `--t8` (11, 12, 13, 14, 16, 20, 24 e 36 px). Todo `font-size` do app usa essas variáveis. Exceções de propósito: o "⋯" dos botões de mais opções, a letra da marca, os rótulos minúsculos dos gráficos (SVG) e os campos de data/texto de 16 px (evita o zoom automático do iPhone).

## Categorias com ícones, lançamentos por categoria e "Já lançados"

- **Análises → Para onde o dinheiro vai** (e o resumo do Último mês): todas as categorias na mesma lista (sem "Outras (n)"), cada uma com ícone e cor escolhidos pelo nome (`ctVisual` em `cliente/categorias.js`), rosca de participação e, ao tocar, a lista de lançamentos da categoria com lápis para editar.
- **Dia a dia**: a partir desta versão, cada linha confirmada de um extrato é guardada em `linhas` dentro do documento `diaadia` do mês (data, nome, valor, categoria). Meses confirmados antes só têm o total e a quantidade, e a tela avisa quanto veio sem detalhe.
- **Extratos → Já lançados**: por mês, com busca e filtros (Tudo, Despesas, Dia a dia, Receitas). O lápis abre a folha de edição: categoria e nome (o valor do extrato não muda). Trocar a categoria de uma linha do dia a dia move o valor entre as categorias do mês.
- Teste: `test/categorias.test.mjs`.

## Finanças · Visão geral (novo desenho)

Patrimônio com variação "vs. mês passado" (compara com o fim do mês anterior, quando há saldo informado), três indicadores (PJ, PF, Reserva) que abrem as abas respectivas, reserva com barra de progresso, divisão do mês em barra e linhas com ícones (o selo "Mês Forte/Normal/Apertado" abre o seletor de classificação; "Ajustar" continua no cabeçalho), cartão "Próxima ação" com a pendência principal e os botões secundários (aportar, não aportar, dispensar pró-labore) e, recolhido, "Entenda sua divisão mensal" com PJ, PF, reserva, tabela, cálculos e "marcar mês atípico". Teste: `test/financas-geral.test.mjs`.

## Finanças · PJ (novo desenho)

Saldo atual em destaque, botão "Transferir R$ X para a PF" (valor sugerido = pró-labore que falta), "Movimentações do mês" (recebido e pago, o que já aconteceu), projeção em caixa tracejada (caixa de hoje − pendentes = vai sobrar ao final; nos outros meses, receitas − despesas = resultado), receitas e despesas com ícone de categoria, vencimento e status. "Marcar paga" fica visível; "Abater" e "Marcar pendente" ficam no menu ···. Vale também para as linhas da aba PF. Teste: `test/financas-pj.test.mjs`.

## Finanças · PF (novo desenho)

Saldo atual no topo (botões "Atualizar saldo", "Histórico" e "Lançamentos" alinhados na mesma linha, também na PJ), bloco "Como o mês fecha" (saldo − despesas pendentes = sem a transferência; + transferência prevista da PJ, como entrada futura = fechamento previsto, o mesmo número da Visão geral), despesas pendentes agrupadas em Fixas, Variáveis (valor variável) e Avulsas (únicas) com barra do quanto já foi pago, e receitas em uma linha discreta quando não há nenhuma. Teste: `test/financas-pf.test.mjs`.

## Finanças · Patrimônio (novo desenho)

Patrimônio líquido com "vs. mês passado", rosca com ícones (nas contas, reserva, outras metas e conta da obra; as partes somam o líquido), e as metas com ícone, barra de progresso e plano. "Aportar" fica visível; "Retirar", "Atualizar valor", Editar, Histórico e Excluir ficam no menu ···. Os títulos da tela de Finanças ficaram mais curtos ("Minha PF", "Patrimônio") para não serem cortados. Teste: `test/financas-patrimonio.test.mjs`.

## Abas de documentos: cabeçalho e cartões padronizados

`rsResumo` (cabeçalho: número principal, selo do recebido no mês e dois cartões com ícone) e cartões com ícone, selos coloridos e barra de parcelas. **Petições**: Kanban e Lista (o Kanban continua igual; só a casca mudou). Teste: `test/peticoes-layout.test.mjs`.
**Acordos** usa o mesmo cabeçalho (`rsResumo`) e cartões com ícone, selo da próxima parcela e barra de parcelas recebidas (`acordoChipsHtml`). O título da tela passou a ser "Acordos" (e "Extratos"), para não ser cortado. Teste: `test/acordos-layout.test.mjs`.
**Alvarás** (Kanban mantido): cabeçalho com "Previsão em 7 dias" (ou "Previsão vencida", em vermelho, quando há), colunas com ícone por fase e cartões com ícone, selo de previsão, tempo na fase e origem. Teste: `test/alvaras-layout.test.mjs`.
**Construção**: cabeçalho com o dinheiro na conta da obra como número principal (selos de gasto e a pagar, barra do orçamento e o aviso de quanto falta de dinheiro), cartões de orçamento e financiamento, cartão "Ações da obra" e ícones nas etapas, gastos, movimentos e nas seções recolhidas. Teste: `test/obra-layout.test.mjs`.
Em **Construção**, os botões de ação (Gasto, Aporte, Liberação, Devolver) seguem o modelo da faixa de ações do Início (ícone em cima, texto embaixo), e há ícones próprios por tipo de etapa (terraplanagem, fundação, alvenaria, cobertura, hidráulica, elétrica, pintura, pisos, esquadrias, acabamento, paisagismo…) e de mão de obra (pedreiro, eletricista, encanador, pintor, carpinteiro, gesseiro, azulejista, serralheiro, vidraceiro, jardineiro, engenheiro…), definidos por palavras no nome (`OB_REGRAS`).
**Clientes** e **Arquivados** usam o mesmo cabeçalho (número principal, selo e dois cartões com ícone), ícone nos cartões e selos coloridos (atraso, última cobrança, promessa, pendência). Teste: `test/clientes-arquivados-layout.test.mjs`.

Ícone da aba do navegador e dos favoritos: `public/favicon.ico`, `favicon-32.png` e `favicon-48.png` são públicos (sem login) e a página de login também declara o ícone, para o navegador achá-lo mesmo antes de entrar.

## Tema único e tela de login

- `public/tema.css` é a fonte única das cores (claro e escuro), raios e fonte do visual grafite e dourado. O app (`index.html`) e a tela de login usam o mesmo arquivo; para mudar o visual de tudo, mude lá. O arquivo é público (sem login), como os ícones.
- A tela de login (`PAGINA` em `src/index.js`) tem logo, botão dourado, campo de senha com "mostrar senha", mensagem de erro em destaque e segue o tema claro/escuro escolhido no app.
- O `index.html` não tem mais o trecho inicial herdado do Claude (`</head><body>` na primeira linha), que fazia o navegador ignorar os `<link>` de ícone e manifesto (por isso o globo na aba e nos favoritos depois do login). Agora todos os `<link>` ficam no `<head>`.

## Construção · Abater valor da mão de obra

No contrato de mão de obra, "Abater valor do contrato" registra um pagamento de qualquer valor (por exemplo, o pedreiro pediu R$ 1.500 nesta semana) e, se o contrato tem término previsto, divide o que falta em pagamentos semanais até essa data (`obraAbrirAbaterMO`): novo semanal = restante ÷ semanas até o término (arredondado para cima em centavos). O semanal anterior e o abatimento ficam registrados em `ajuste` no contrato. Sem término previsto, só é possível manter o semanal. O botão "Pagar" nunca sugere mais do que falta pagar. Teste: `test/obra-abater.test.mjs`.

## Publicações do Diário Oficial (DJEN) e prazos

- **Leitura:** todo dia às 10:00 (cron `0 13 * * *`, antes do resumo das notificações) o Worker consulta o Diário de Justiça Eletrônico Nacional (`comunicaapi.pje.jus.br`, API pública do CNJ, sem chave) para cada OAB cadastrada. Código em `src/djen.js`; as rotas ficam em `/api/djen/*` (exigem login): `estado`, `lista`, `buscar`, `oabs`, `marcar`, `texto` e `teste` (diagnóstico da conexão).
- **O que é guardado:** só o trecho (até 300 caracteres), tribunal, órgão, tipo, número do processo, partes e link, na coleção reservada `_pub` (mantida por 400 dias). O texto completo é buscado no Diário Oficial quando você abre a publicação. Cada publicação é guardada uma vez só (pelo número dela); se duas OABs foram intimadas no mesmo ato, o cartão mostra as duas.
- **OABs:** a sua (60456/GO) vem cadastrada. Em "OABs monitoradas" dá para adicionar outras (sócio, parceiro) e escolher, para cada uma, **todas as publicações** ou **só processos em conjunto comigo** (processo cadastrado no app ou que também vem pela OAB principal), ler ou pausar e se avisa no celular. A primeira leitura de uma OAB traz os últimos 30 dias sem gerar aviso.
- **Aviso no celular:** o resumo das 10:00 passa a incluir "N novas publicações" (respeita "Esconder nomes e valores").
- **Vínculo:** compara o número CNJ com Petições, Acordos e Alvarás; o que não está cadastrado aparece como "+ processo novo" com o botão "Cadastrar processo".
- **Prazos:** o texto é lido para sugerir "prazo de N dias" (dias úteis, ou corridos se o texto disser). Você confere, ajusta e confirma; o prazo confirmado fica em `prazosPub` (entra no backup), aparece na Central de atenção quando faltam até 10 dias e nas notificações das 10:00. A contagem (`pbCalcular`): disponibilização → publicação no 1º dia útil seguinte → começa a contar no 1º dia útil seguinte à publicação; dias úteis pulam fim de semana, feriados do TJGO (lista oficial 2026 e regra geral para outros anos: nacionais, estaduais de Goiás, Carnaval, Semana Santa e Corpus Christi) e o recesso de 20/12 a 20/01 (CPC art. 220). Pontos facultativos de 2026 não são pulados; o cálculo avisa quando caem no período. O app só sugere: a conferência final é do advogado. Em janeiro, atualizar `PB_FERIADOS_2026` e `PB_FACULTATIVOS` com a lista do novo ano.
- **Testes:** `node test/djen.test.mjs` (sem servidor) e `test/publicacoes.test.mjs` (Diário de mentira na porta 8890; as instruções de como subir o servidor estão no topo do arquivo).

## Agenda, cartão de prazos no Início e "Iniciais"

- **Central de atenção só com dinheiro.** Prazos processuais saíram dela: ganharam o cartão **"Prazos processuais · próximos 7 dias"** no Início (logo abaixo do resumo; atrasados, prazos da semana e audiências) e a aba **Agenda**.
- **Agenda** (`cliente/agenda.js`, coleção `agenda`, entra no backup): visões **Semana**, **Mês** e **Lista**, filtros (Tudo, Prazos, Audiências, Tarefas e Concluídos) e três tipos de item. **Prazo** (data fatal + "trabalhar até", que o app sugere 2 dias úteis antes), **Audiência** (data e hora) e **Tarefa**. Situação: a fazer, em elaboração, concluído (protocolado). O calendário marca prazo, tarefa/trabalhar até, audiência e feriado do TJGO; domingos e feriados em vermelho.
- **De onde vêm os itens:** os que você cadastra na Agenda; os prazos confirmados nas Publicações (ligados à publicação); e os prazos que já existiam nas Iniciais (campo `prazo` da ação, mostrados como "da inicial"; concluir ou mudar a data grava na própria ação). A coleção antiga `prazosPub` é migrada sozinha para a `agenda`.
- **Avisos no celular (10:00):** mensagem própria "Prazos: N vencem hoje, M nos próximos dias", separada de "publicações novas" e de "vencem hoje" (dinheiro). Cada item avisa no dia e nos dias de antecedência escolhidos (padrão 5, 2 e 1 dia antes; opções: 1 dia antes, só no dia, não avisar). O servidor guarda `prazos` no resumo (`/api/notif/resumo`); a regra está em `prazosDoDia` (`src/index.js`).
- **Nome:** a aba "Petições" agora é **Iniciais** (menu, barra de baixo, títulos, busca e relatórios). Os dados e o campo `casos` não mudaram.
- **Menu lateral no celular:** não rola mais de lado (o item arrastava o menu para a esquerda) e os nomes longos quebram de linha (`public/tema.css`).
- **Testes:** `test/agenda.test.mjs` (o topo do arquivo diz como subir o servidor).

### Publicações: filtros e advogados
- O botão com símbolo de funil, ao lado de "Não lidas / Meus processos / Todas", abre o painel de filtros: **cliente, partes ou processo** (texto), **data de/até**, **OAB monitorada**, **advogado** (nome ou número da OAB, inclusive o da parte contrária) e **tribunal**. O botão mostra quantos filtros estão ativos; "Limpar filtros" volta tudo. Os filtros valem sobre os últimos 90 dias.
- Cada publicação passa a guardar os advogados citados (`advs`, nome e OAB). Na primeira leitura depois desta atualização o servidor refaz os últimos 30 dias uma vez só (`advsOk` na configuração) para completar as publicações já guardadas, sem mexer em "lida" nem gerar avisos.
- O botão de ler passou a se chamar "Marcar como lida" (e "Marcar como não lida"), com o mesmo estilo dos outros botões do cartão.

### Nome "Iniciais" e botões no padrão do Início
- A aba que era "Petições" chama-se **Iniciais** (menu, barra de baixo, títulos, busca e relatórios; os formulários viram "Nova inicial" e "Editar inicial"). O nome curto mantém a barra de baixo em uma linha só.
- "Buscar agora" e "OABs monitoradas" (Publicações) e "Semana", "Mês", "Lista" e "Novo" (Agenda) usam os mesmos botões da tela inicial (`.ini-acoes .acao`: ícone em cima e texto embaixo; o principal em dourado e a visão escolhida em escuro).
