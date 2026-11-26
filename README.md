# AnjoLav ERP

ERP web para lavanderias com operação Doméstica e Industrial, painel
administrativo, PDV, produção, delivery, caixa, faturamento e integrações.

## Acesso

- [Painel Administrativo](https://anjolav-erp.fabriciogasparr.chatgpt.site/admin/visao-geral)
- [PDV Doméstico](https://anjolav-erp.fabriciogasparr.chatgpt.site/pdv/domestico)
- [PDV Industrial](https://anjolav-erp.fabriciogasparr.chatgpt.site/pdv/industrial)

Os painéis exigem autenticação, vínculo ativo com a empresa e permissões de
área e módulo. O projeto usa Supabase Auth, Postgres com RLS e Edge Functions.

## Desenvolvimento

Requer Node.js 24 ou superior. Copie `.env.example` para `.env.local` e
configure somente as chaves públicas do frontend. Segredos de provedores
pertencem ao ambiente das Edge Functions.

```bash
npm ci
npm run dev
```

## Verificação

```bash
npm run preflight:production
npx playwright install chromium
npm run test:e2e
```

O pré-voo executa verificações locais de contratos, MFA, Edge Functions,
TypeScript, testes, lint, desempenho estático e build. O teste E2E completo
exige ambiente de homologação e contas fictícias nas variáveis descritas em
`e2e/homologation-journey.spec.ts`. A aprovação comercial exige ainda
ensaios de dois tenants e perfis restritos, restauração de backup, impressão
física e integrações externas habilitadas.

## Publicação

O frontend é publicado no projeto Sites identificado em
`.openai/hosting.json`. Migrações e Edge Functions são aplicadas no projeto
Supabase correspondente e validadas antes do frontend. Nunca execute
migrações somente porque o build passou. O boleto e a NFS-e dependem de
configuração e homologação do provedor antes de habilitar.
