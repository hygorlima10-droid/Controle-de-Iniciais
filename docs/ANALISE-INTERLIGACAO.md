# Análise: como as abas do jurídico se interligam (12/11/2026)

> **Situação em 12/11/2026:** os pontos 1, 2, 3, 4 e 6 da seção 4 foram corrigidos (ver `docs/DECISOES.md`, "Correções da análise de interligação"); o ponto 5 (Agenda) entra na etapa 5.5.

Análise feita à parte da Fase 5, a pedido do proprietário. **Nada foi alterado no app.** Base: leitura do código e contagens (sem nomes) nos dados reais de produção.

## 1. Como funciona hoje

A "cola" entre Iniciais, Acordos, Alvarás, Processos e Agenda é o **número do processo** (comparado sem pontos e traços), **não um vínculo gravado**. A ligação com o **cliente** é outra: cada registro guarda `clienteIds` (cadastro de clientes) e, em paralelo, um nome em texto (`cliente`/`partes`).

| Aba | Como se liga ao processo | Como se liga ao cliente |
|---|---|---|
| Processos | é o próprio cadastro (`processos`), mais uma linha "derivada" para todo número que aparece numa Inicial, Acordo ou Alvará | `clienteIds` do processo ∪ os dos atos com o mesmo número |
| Iniciais / Acordos / Alvarás | campo "Número do processo" digitado no formulário (opcional na Inicial) | seletor de clientes (`clienteIds`) + nome em texto |
| Publicações | pelo número da publicação; a ficha do processo mostra as dos últimos 90 dias | — (sugere "provável cliente" pelo nome das partes) |
| Agenda | campo de texto "Processo"; mostra "✓ processo cadastrado · cliente: X" e preenche o cliente | nome em texto |
| Clientes (perfil) | "Processos e atos": processos cadastrados + Iniciais, Acordos e Alvarás com aquele cliente | — |

A ficha do processo reúne: Iniciais/Acordos/Alvarás com o mesmo número (com os honorários de cada um), prazos/audiências/tarefas da Agenda, publicações e linha do tempo.

## 2. Respostas às perguntas

- **Inicial protocolada → número → processo?** Hoje só dá para digitar o número na própria Inicial (editar). Mover para "Protocolado" **não pergunta** o número. Ao digitar, o app reconhece se o número já está em outro cadastro e oferece "Usar estes dados". Mesmo sem processo cadastrado, o número já reúne tudo numa linha de Processos. A opção "Vincular a uma Inicial cadastrada", dentro de **Cadastrar processo**, é **transitória**: só mostra Iniciais cadastradas até o dia da implantação (o "corte"). Para Iniciais novas não existe o caminho pelo lado do processo.
- **Alvará é interligado?** Sim, pelo número (aparece na linha do processo, nos honorários e no perfil do cliente) e o formulário reconhece o número. Detalhes: a "previsão de levantamento" só aparece no Quadro da Agenda; o alvará não herda cliente nem advogado do processo.
- **Agenda duplica/conflita?** O processo é digitado em texto livre. **Não há aviso de duplicidade** ao salvar à mão (só a importação de arquivo e as publicações evitam repetir). **Conflito:** só avisa "duas audiências no mesmo dia a menos de 1 hora" (de qualquer processo); **prazo × audiência do mesmo processo não é verificado**.

## 3. Medição nos dados reais (produção)

- 194 números de processo distintos; 184 têm cadastro em Processos; **10 existem só dentro de Iniciais/Acordos/Alvarás**. Nenhum processo duplicado; todos os números têm 20 dígitos.
- Com número mas **sem processo cadastrado**: Iniciais 2 de 8, Acordos 4 de 6, Alvarás 4 de 5, Agenda 4 de 35.
- **Iniciais sem número:** 16 de 24 (6 arquivadas antigas; 10 abertas, que o app não consegue ligar a nada).
- Processos **sem cliente vinculado:** 33 de 184. Um Alvará está com cliente diferente do cliente do processo.
- Agenda: 0 grupos repetidos (mesmo processo, data e tipo); 0 casos de prazo e audiência no mesmo dia no mesmo processo; 1 par de audiências a menos de 1 h (já coberto pelo aviso). Sem prazos antigos guardados dentro de Iniciais.

## 4. Lacunas (em ordem do que mais importa) e sugestões

1. **Protocolar não pede o número** (Inicial nova fica sem ligação até alguém editar). *Sugestão:* ao mover para Protocolado, pedir o número e já vincular a um processo existente ou cadastrar um novo.
2. **Vincular Inicial ↔ processo só existe para Iniciais antigas.** *Sugestão:* tornar permanente (e permitir também para Acordo e Alvará).
3. **Advogados e clientes são por registro, não por processo.** O mesmo processo pode ter advogados diferentes na Inicial e no Processo; na Fase 5 isso afeta quem vê o quê (o advogado vê só os registros em que está marcado). *Sugestão:* os atos herdarem advogados e clientes do processo pelo número (ou o processo ser a fonte única).
4. **10 números sem cadastro de processo** (e 33 processos sem cliente). *Sugestão:* botão "Cadastrar processo" a partir do ato, e uma revisão como a de "sem advogado".
5. **Agenda:** trocar o campo de texto por seletor de processo; avisar duplicidade (mesmo processo, data e tipo/título); conflito prazo × audiência/qualquer evento do mesmo processo e conflito por pessoa (quando houver responsáveis, etapa 5.5).
6. **Divergência de cliente/partes** entre ato e processo: avisar.
