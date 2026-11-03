# Controle Jurídico e Financeiro — versão servidor

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
