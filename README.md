# Controle Jurídico e Financeiro — versão servidor

O mesmo app que rodava dentro do Claude, agora num servidor seu (Cloudflare), com banco de dados próprio e login.

## Como funciona (resumo)
- `public/index.html` — o app (igual ao oficial, versão etapa 28).
- `public/shim.js` — faz o app falar com o banco do servidor em vez do banco do Claude.
- `src/index.js` — o servidor: confere o login, guarda e entrega os dados.
- `schema.sql` — a tabela do banco.

## Segurança
Toda requisição (página e dados) passa pelo login do Cloudflare Access. Se o login não estiver configurado, o servidor **bloqueia tudo** (não abre por engano).

## Colocar no ar (passo a passo, uma vez só)
1. **Banco:** Cloudflare → *Storage & databases* → *D1* → *Create database* → nome `controle-juridico`. Copie o **Database ID** e coloque em `wrangler.jsonc` (campo `database_id`).
2. **Tabela:** na página do banco → *Console* → cole o conteúdo de `schema.sql` → *Execute*.
3. **Publicar:** *Workers & Pages* → *Create* → *Import a repository* → escolha `Controle-de-Iniciais` e a branch de trabalho. Deploy command: `npx wrangler deploy`.
4. **Login:** *Zero Trust* → *Access* → *Applications* → *Add* → *Self-hosted*. Domínio: o endereço `…workers.dev` do app. Política *Allow* só para o seu e-mail.
   Anote o **Application Audience (AUD) tag** e o **Team domain** (`algo.cloudflareaccess.com`).
5. No Worker → *Settings* → *Variables and secrets*: crie `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` e `EMAIL_PERMITIDO` (seu e-mail).
6. Abra o endereço, entre com o código enviado ao seu e-mail. Para trazer seus dados: no app antigo faça *Backup*; no novo use *Restaurar backup*.

## Testar no computador
```
npm install
npm run banco:local
npm run dev            # http://127.0.0.1:8787 (crie .dev.vars com ALLOW_NO_AUTH=1 para dispensar o login só aqui)
node test/e2e-local.mjs
npm run teste          # testes do login
```

## O que ainda não funciona aqui
- **Extratos pelo Google Drive** (dependiam da conexão do Claude): voltam numa próxima etapa, escolhendo o arquivo direto no aparelho.
- **Ler foto/recibo**: próxima etapa (usa a chave do Claude guardada no servidor).

<!-- publicação disparada em 2026-11-03T03:19:47Z -->
