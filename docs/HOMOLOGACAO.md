# Fase 4: homologação da versão individual (início em 11/11/2026)

Objetivo: deixar a versão de uma pessoa só redonda antes de abrir o app a outros usuários (Fases 5 a 8).

## O que foi feito
- **Ambiente limpo** (11/11): Worker `controle-de-iniciais` apagado pelo proprietário; banco vazio `controle-juridico-teste` apagado pelo conector; `wrangler.teste.jsonc` removido. Só existe o Worker `controle-juridico` e o banco `controle-juridico`.
- **Produção conferida (só leitura):** contagem por coleção coerente; documentos `fechamentos`, `futuro` e os demais de `configDono` presentes; nenhuma coleção perto de qualquer limite (maior: processos, 184).
- **Varredura automática de todas as telas** (`test/homologacao.test.mjs` no computador, `test/homologacao-celular.test.mjs` no celular): abre cada aba e sub-abas (Início, Iniciais, Acordos, Alvarás, Agenda, Processos, Publicações, Clientes, Arquivados, as 6 telas de Finanças, Análises, Construção, Extratos, Configurações) com dados de verdade e procura: erro de script/console, requisição com erro, imagem quebrada, rolagem para o lado, e texto "undefined", "NaN", "[object", "Invalid Date", "R$ -0,00". Resultado: limpo nos dois tamanhos.
- **Revisão visual** das fotos de todas as telas (computador e celular). Corrigido: valores grandes cortados nos cartões do celular (ex.: "+ R$ 34.300,…" no Patrimônio do Último mês) — o tamanho do número agora encolhe um pouco em tela estreita.
- **Agenda:** cartão "Dia de trabalhar na peça" padronizado (apontado pelo proprietário em uso real).
- **Suíte completa** de testes rodada ao final (ver CONTINUIDADE).

## Observações para decidir (não são defeitos)
- Links de texto com "+" (ex.: "+ Nova despesa", "+ Etapa", "+ Gasto", "+ Lançar receita"). O proprietário pediu que o padrão "+ Algo" tracejado não seja mais usado nos botões novos (Simulador); esses links são antigos e continuam como estavam.
- O botão redondo "+" flutuante no celular fica por cima do canto direito do conteúdo ao rolar (links à direita podem ficar atrás dele até rolar mais).
- Título "Divisão do mês" aparece cortado ("Divisão d…") no cabeçalho do celular por causa do seletor de mês.
- O aviso de conflito de edição mostra só o horário, não qual aparelho alterou.

## Fora de escopo (decidido)
Relatório mensal em PDF, metas com data futura, backup completo com anexos e leitura do Diário, alertas de orçamento no resumo das 10h, "Folga da PJ" no Simulador.
