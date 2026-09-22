# AnjoLav ERP

ERP web para as operações industrial e residencial da AnjoLav, com painéis separados, portal do cliente, produção, ordens de serviço, estoque, caixa, financeiro e integrações externas.

> Estado atual: endurecimento técnico em andamento. O código local passa em typecheck, 25 testes, lint e build de produção, mas o sistema **ainda não está aprovado para comercialização**. RLS/tenancy no banco, tratamento de dados pessoais históricos, transações, fila do webhook Asaas, homologação NFS-e, pagamentos, WhatsApp, e-mail transacional e testes integrados ainda exigem banco, ambiente e credenciais reais. Consulte [Prontidão comercial](docs/COMMERCIAL_READINESS.md).

## Stack

- React 18, TypeScript e Vite
- Tailwind CSS e shadcn/ui
- TanStack Query
- Supabase Auth, Postgres, Storage e Edge Functions
- Asaas, Evolution API e webhooks n8n

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

## Painéis e acesso

- `/central/*`: administração e visão consolidada
- `/industrial/*`: operação industrial
- `/residencial/*`: loja e PDV
- `/portal/:codigo`: portal público com código criptograficamente forte

Rotas protegidas exigem sessão, área e permissão de módulo. Isso é defesa de aplicação; o isolamento definitivo também precisa existir nas policies RLS do Postgres.

## Documentação operacional

- [Prontidão comercial](docs/COMMERCIAL_READINESS.md)
- [Segurança](docs/SECURITY.md)
- [Implantação](docs/DEPLOYMENT.md)
- [Preparação do ambiente real](docs/PRODUCTION_PREPARATION.md)
- [Checklist de go-live](docs/GO_LIVE_CHECKLIST.md)

Repositório: [fabricio-gaspar/erp-anjolav](https://github.com/fabricio-gaspar/erp-anjolav)
