# Fase 4: homologação da versão individual (início em 11/11/2026)

Objetivo: deixar a versão de uma pessoa só redonda antes de abrir o app a outros usuários (Fases 5 a 8).

## O que foi feito
- **Ambiente limpo** (11/11): Worker `controle-de-iniciais` apagado pelo proprietário; banco vazio `controle-juridico-teste` apagado pelo conector; `wrangler.teste.jsonc` removido. Só existe o Worker `controle-juridico` e o banco `controle-juridico`.
- **Produção conferida (só leitura):** contagem por coleção coerente; documentos `fechamentos`, `futuro` e os demais de `configDono` presentes; nenhuma coleção perto de qualquer limite (maior: processos, 184).
- **Varredura automática de todas as telas** (`test/homologacao.test.mjs` no computador, `test/homologacao-celular.test.mjs` no celular): abre cada aba e sub-abas (Início, Iniciais, Acordos, Alvarás, Agenda, Processos, Publicações, Clientes, Arquivados, as 6 telas de Finanças, Análises, Construção, Extratos, Configurações) com dados de verdade e procura: erro de script/console, requisição com erro, imagem quebrada, rolagem para o lado, e texto "undefined", "NaN", "[object", "Invalid Date", "R$ -0,00". Resultado: limpo nos dois tamanhos.
- **Revisão visual** das fotos de todas as telas (computador e celular). Corrigido: valores grandes cortados nos cartões do celular (ex.: "+ R$ 34.300,…" no Patrimônio do Último mês) — o tamanho do número agora encolhe um pouco em tela estreita.
- **Agenda:** cartão "Dia de trabalhar na peça" padronizado (apontado pelo proprietário em uso real).
- **Suíte completa** de testes rodada ao final (ver CONTINUIDADE).

## Decisões do proprietário (11/11) e o que foi feito
- **Links com "+" padronizados:** todos os rótulos de texto com "+" viraram texto direto, no mesmo padrão dos demais botões (ex.: "+ Etapa" → "Adicionar etapa", "+ Gasto" → "Adicionar gasto", "+ Nova despesa" → "Nova despesa", "+ Lançar receita" → "Lançar receita", "+ Nova meta" → "Nova meta", "+ Contrato/Medição/Item" → "Adicionar …", "+ Alvará/Termo de acordo/Honorários" → "Adicionar …", "+ Cadastrar como cliente" → "Cadastrar como cliente", "+ processo novo" → "Processo novo"). Ficaram só os "+" que são **conta** (ex.: "+ A pagar (já lançado)" na soma do custo da obra) e o **botão redondo flutuante "+"** do celular e o ícone dos botões dourados "Novo compromisso"/"Novo processo", que o proprietário mandou manter.
- **Botão redondo flutuante:** mantido como está.
- **Título "Divisão do mês" cortado no celular:** corrigido (e conferido para todos os títulos em telas de 390 e 360 px, teste `titulos-celular`).
- Continua como observação: o aviso de conflito de edição mostra só o horário, não qual aparelho alterou.

## Fora de escopo (decidido)
Relatório mensal em PDF, metas com data futura, backup completo com anexos e leitura do Diário, alertas de orçamento no resumo das 10h, "Folga da PJ" no Simulador.

## Fase 5, etapa 5.9: homologação por papel e por pessoa (12/11/2026)
- **Varredura automática por papel** (`test/homologacao-papeis.test.mjs`: advogada e estagiário; `test/homologacao-papeis-dono.test.mjs`: proprietário no acesso individual; grupo `permissoes`): cada papel abre todas as abas e sub-abas que enxerga, no computador (1280 px) e no celular (390 px), com dados de verdade (processo dividido, parcela paga por outro advogado, acordo, alvará, agenda com responsável, repasse). Procura: erro de script, **pedido recusado pelo servidor**, texto "undefined/NaN/null", rolagem para o lado e **vazamento** (finanças, backup, relatório do Murilo, cobrança e botões de pagamento onde o papel não pode). Resultado: tudo limpo.
- **Achado e corrigido:** registro sem prioridade/origem/tipo mostrava "undefined" na lista de Iniciais (só acontece com dado incompleto; agora aparece "—" e prioridade normal).
- **Roteiro humano** (`docs/roteiro-teste-por-papel.html`, também em PDF): Fase A (proprietário com os dois usuários de teste: o que cada papel deve e não deve ver/fazer, avisos no iPhone, repasses), Fase B (pessoa de confiança por 3 a 7 dias, critérios para abrir), Fase C (abrir um papel por vez) e plano B (desativar pessoa, Lixeira, convite, aparelho, backup).
- **Usuários de teste em produção:** dois convites foram criados no banco (advogado com OAB fictícia 99901/GO e estagiário; e-mails `@horus-teste.example`); depois da homologação eles e seus acessos são removidos do banco.
- **Antes de publicar:** levar também `wrangler.jsonc` (cron semanal 08:00 de Brasília: backup + resumo da equipe).
