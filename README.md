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
- **Extratos pelo Google Drive** (dependiam da conexão do Claude): voltam numa próxima etapa, escolhendo o arquivo direto no aparelho.


<!-- publicação disparada em 2026-11-03T03:19:47Z -->
