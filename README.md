# AnjoLav ERP

ERP web para as operações industrial e residencial da AnjoLav, com painéis separados, portal do cliente, produção, ordens de serviço, estoque, caixa, financeiro e integrações externas.

> Estado em 11/11/2026: o projeto Supabase está ativo, e as migrations e funções da integração WA-AKG foram publicadas. A branch passa em TypeScript, 180 testes, lint sem erros, checagem das Edge Functions e build. O envio real de WhatsApp permanece desativado até configurar credenciais, conectar a sessão, assinar o webhook e realizar um teste autorizado. A prontidão comercial do ERP exige homologação dos demais fluxos; consulte [Prontidão comercial](docs/COMMERCIAL_READINESS.md) e [WA-AKG](docs/WA_AKG.md).

## Stack

- React 18, TypeScript e Vite
- Tailwind CSS e shadcn/ui
- TanStack Query
- Supabase Auth, Postgres, Storage e Edge Functions
- Asaas, WA-AKG e webhooks n8n

## Desenvolvimento local

Requisitos: Node.js 24 ou superior e npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preencha `.env.local` com os valores públicos do projeto Supabase. Secrets de provedores nunca devem usar o prefixo `VITE_` nem entrar no frontend; use o cofre de secrets das Edge Functions conforme `supabase/.env.example`.

## Verificação

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

O comando `npm run check` executa toda a sequência. A integração contínua repete essas verificações em pushes e pull requests.

Para uma publicação estática, as variáveis públicas `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY` precisam estar disponíveis no processo de build;
o Vite incorpora esses valores no bundle e não os lê depois da publicação.

## Painéis e acesso

- `/central/*`: administração e visão consolidada
- `/industrial/*`: operação industrial
- `/residencial/*`: loja e PDV
- `/portal/:codigo`: portal público com código criptograficamente forte

Rotas protegidas exigem sessão, área e permissão de módulo. A migration comercial acrescenta isolamento por tenant, módulo e área de negócio também no Postgres; a proteção só passa a valer no ambiente real depois da aplicação e dos testes de RLS.

## Documentação operacional

- [Prontidão comercial](docs/COMMERCIAL_READINESS.md)
- [Segurança](docs/SECURITY.md)
- [Implantação](docs/DEPLOYMENT.md)
- [Preparação do ambiente real](docs/PRODUCTION_PREPARATION.md)
- [Checklist de go-live](docs/GO_LIVE_CHECKLIST.md)
- [Integração WhatsApp WA-AKG](docs/WA_AKG.md)

Repositório: [fabricio-gaspar/erp-anjolav](https://github.com/fabricio-gaspar/erp-anjolav)
