# Plano de correções após a auditoria externa (13/11/2026, versão 00ec43a)

A auditoria externa foi funcional (não visual). Ela **não conseguiu rodar a suíte completa** (o servidor local não subiu no ambiente dela): os "89 testes passando" são do nosso lado. Cada achado abaixo foi conferido no código.

## Conferência dos achados

| Achado | Veredito | Resumo |
|---|---|---|
| F-01 estagiário vê tarefa pessoal de outra pessoa | **Confirmado** (e foi uma decisão que se contradiz) | `src/politica.js:75`: com `verAgendas` ligada (padrão) o servidor entrega **toda** a agenda ao estagiário, inclusive a tarefa pessoal de outra pessoa; só a tela "Escritório" esconde. A decisão de 11/11 diz "estagiário vê todas as agendas"; a de 12/11 (5.5) diz "tarefa pessoal de outra pessoa não aparece". |
| F-02 estagiário altera/exclui tarefa de outra pessoa | **Confirmado** | `src/politica.js:154-186`: a regra "tarefa de outro só quem criou altera" só vale para `advogado`. |
| F-03 movimento futuro da meta entra no valor atual | **Confirmado** | `metaValorAtual()` (`public/index.html:8728`) soma todos os movimentos, sem olhar a data. As séries por mês já filtram por data (`:14216`, `:23587`); só o valor "atual" não. |
| F-04 extrato: "já lançado" por valor + data | **Confirmado, com atenuante** | `extAcharMov()` (`:13274`) casa por valor, tipo e ±3 dias, **sem olhar o nome**. Atenuante: cada lançamento do app só "cobre" uma linha do extrato. O risco é uma compra diferente, de mesmo valor, em até 3 dias de um lançamento do app. |
| F-05 `config/obra` sem proteção de conflito | **Confirmado** | `persistObraCfg()` (`:15605`) grava o documento inteiro a partir da cópia local. `configDono` não está no conjunto de conflito (`src/index.js:23`). O app relê a cada 15 s, então a janela é curta, mas existe. |
| F-06 lote sem versão esperada | **Confirmado, risco baixo** | `src/lote.js` não confere a versão. Só é usado em transferência PJ/PF (criar e excluir o par). |
| "Estagiário sem totais: parcial" | **Já corrigido** | O resumo/cobrança de Clientes foi retirado do estagiário em 12/11. A frase em `docs/DECISOES.md` estava desatualizada (corrigida junto deste plano). |
| "Recebida por" em Acordos e Alvarás | **Limite conhecido** | Documentado; só aparece nas Iniciais. |
| Cobrança do advogado com valor cheio | **Decisão registrada** | Não é defeito. |
| Seletor universal de ícones | **Não é defeito** | A etapa 2.5 foi **cancelada pelo proprietário** em 09/11 (a base de ícones ficou pronta). |
| Calculadora de custos de obra com referências de Goiás | **Feita (14/11)** | SINAPI/IBGE + INCC automáticos; ver DECISOES.md. |
| Logos de bancos | **Pendente de arquivos** | Só há logo de Itaú, C6, Caixa e Sicoob (os que o proprietário enviou). |

## Correções, na ordem

### C1 · Agenda: privacidade e autoria (F-01 + F-02) — servidor e teste, sem mudança de tela
- **Arquivos:** `src/politica.js` (`podeVer`, `autorizarGravacao`, `autorizarExclusao`), `test/permissoes.test.mjs`, `test/agenda-resp.test.mjs`.
- **Comportamento esperado**
  1. Estagiário com `verAgendas` vê prazos, audiências, tarefas compartilhadas, tarefas de processo e as dele; **não vê tarefa pessoal de outra pessoa** (tarefa sem processo, não compartilhada, de quem não é ele nem o tem como responsável).
  2. A regra de autoria vale para todos os papéis: só altera ou exclui o criador, quem é responsável, ou (prazo/audiência/tarefa de um processo) quem participa do processo (o estagiário participa de todos). Excluir continua exigindo a permissão "excluir".
  3. **Concluir/reabrir** uma tarefa **compartilhada** passa a valer para qualquer pessoa que a vê (só os campos de conclusão: `concluido`, `cancelado`, `situacao`, `concluidoEm`, `concluidoPor`, `protocoladoEm`, `protocoloObs`); o resto continua só do criador/responsável.
- **Testes novos:** estagiário não recebe a tarefa pessoal do dono; estagiário não altera nem exclui tarefa de advogado sem processo/responsabilidade; estagiário e advogado concluem tarefa compartilhada (e não mudam o título); responsável continua alterando; proprietário continua tudo. Ajusta a expectativa que hoje diz que o Caio vê `g1`.
- **Esforço/risco:** curto; risco baixo (testes cobrem papéis).

### C2 · Metas: valor atual × projetado (F-03)
- **Arquivos:** `public/index.html` (`metaValorAtual`, `computeReservaInfo`, validação de retirada, modal de movimento, lista de movimentos), `test/financas-*.test.mjs` (novo teste de meta).
- **Comportamento esperado:** `metaValorAtual(m)` soma só movimentos com `dia ≤ hoje`; nova `metaValorProjetado(m)` soma todos. Movimento futuro aparece na lista como **"previsto para dd/mm"** (texto, sem layout novo) e não entra no patrimônio atual, na reserva atual nem na validação de retirada; a série mensal do **mês atual** passa a ir até hoje.
- **Testes:** aporte futuro não muda o valor atual nem o patrimônio; retirada maior que o valor de hoje é recusada mesmo com aporte futuro; no dia do movimento ele passa a contar; histórico dos meses passados não muda.
- **Esforço/risco:** curto a médio (mexe em cálculo financeiro: só com teste antes e depois).

### C3 · Integridade entre aparelhos (F-05 + F-06) — servidor, sem tela
- **F-05:** `PUT /api/db/configDono/obra?mesclar=1` (e equivalente para `config`): o servidor junta **só as chaves enviadas** ao documento atual (`{...atual, ...patch}`) em vez de substituir o documento. O app passa a mandar só o que mudou em `persistObraCfg`. Duas pessoas/aparelhos mexendo em chaves diferentes (etapas × financiamento × checklist) deixam de se sobrescrever; na mesma chave, vale o último e o registro de ações mostra.
- **F-06:** `/api/lote` aceita `base` (versão lida) por operação; se o registro mudou depois e o conteúdo é diferente, a **operação inteira é recusada (409)** e o app avisa e recarrega. Continua atômico.
- **Arquivos:** `src/index.js`, `src/lote.js`, `public/shim.js`, `public/index.html` (`persistObraCfg`), testes `conflito-edicao` e novo.
- **Testes:** dois aparelhos alterando chaves diferentes de `obra` mantêm as duas; exclusão em lote de registro alterado em outro aparelho é recusada e nada é apagado; transferência continua atômica.
- **Esforço/risco:** médio; risco médio (grava configuração da obra): publicar depois de testar com cópia do banco.

### C4 · Extratos: "já lançado" mais rigoroso (F-04)
- **Arquivo:** `public/index.html` (`extMovsApp`, `extAcharMov` e as 5 chamadas), `test/extratos-arquivo.test.mjs` / novo.
- **Comportamento esperado:** o lançamento do app passa a levar o nome. Vira "já lançado" automático só se **a data é a mesma** ou **o nome tem palavras em comum** com o favorecido do extrato (ou há só um candidato e a linha não tem texto útil). Nos demais casos a linha continua **pendente**, com a nota "parecida com um lançamento de mesmo valor em dd/mm (nome): confirme se é o mesmo". Mantém o reconhecimento em três níveis.
- **Testes:** duas despesas de R$ 250 em dias próximos com nomes diferentes não se cobrem; mesmo nome e dias próximos ainda reconhece; mesma data reconhece; linha sem candidato segue como hoje.
- **Esforço/risco:** médio; risco baixo (só deixa de classificar sozinho o que era duvidoso).

### C5 · Pendências menores
- Corrigir `docs/DECISOES.md` (linha sobre o resumo por cliente do estagiário) — **feito junto deste plano**.
- "Recebida por X" também em Acordos e Alvarás (se o proprietário quiser).
- Calculadora de custos da obra (se mantida no escopo: exige base de preços de Goiás e esboço antes).
- Logos de bancos (precisa dos arquivos).

## Depois das correções
Rodar a suíte completa, subir o roteiro de homologação por papel de novo (Fase A/B) e só então abrir ao escritório. Itens que vale acrescentar aos testes: os 7 listados pela auditoria (estão cobertos em C1 a C4).
