# Implantação

Este procedimento pressupõe dois ambientes separados: staging e produção. Nunca valide migrations, cobranças ou emissão fiscal diretamente em produção.

## 1. Pré-requisitos

- Node.js 24+, npm e Supabase CLI atual.
- Acesso de proprietário ao projeto Supabase correto.
- Projeto de staging com estrutura equivalente à produção e dados sanitizados.
- Domínios finais, SMTP, monitoramento e credenciais dos provedores.

## 2. Frontend

```powershell
npm ci
Copy-Item frontend.production.env.example .env.production
npm run check
```

Configure no host somente:

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

O host deve servir a SPA com fallback para `index.html`, HTTPS obrigatório, headers de segurança e domínio exato incluído em `ALLOWED_ORIGINS`. Não use segredo, service role ou chave de provedor em uma variável `VITE_*`.

## 3. Banco Supabase

O destino próprio do produto é `uomhckyqghkcnctbdwvp`. Na revisão de 30/09/2026 ele estava inativo; não confunda esse projeto com a referência antiga do ambiente ligado ao Lovable. Antes de alterar o banco:

```powershell
supabase login
supabase link --project-ref uomhckyqghkcnctbdwvp
supabase migration list
```

Compare o histórico local e remoto e faça backup. A migration `20260930120000_commercial_multitenancy_hardening.sql` é aditiva: cria tenants, faz backfill, acrescenta FKs compostas, substitui policies permissivas, cria auditoria e RPCs transacionais. Aplique-a primeiro em staging, valide contagens e rode os testes de isolamento antes de repetir em produção.

O plano mínimo do banco está em [Prontidão comercial](COMMERCIAL_READINESS.md) e [Segurança](SECURITY.md).

## 4. Secrets das Edge Functions

Crie um arquivo local não versionado a partir de `supabase/production.env.example`, substitua os placeholders e grave os valores no cofre do ambiente:

```powershell
Copy-Item supabase/production.env.example supabase/.env.production
supabase secrets set --env-file supabase/.env.production
supabase secrets list
```

Regras:

- `ALLOWED_ORIGINS` deve conter apenas domínios exatos.
- `ASAAS_ENVIRONMENT=production` somente após homologação e aprovação.
- `ASAAS_WEBHOOK_PUBLIC_URL` deve ser a URL HTTPS exata cadastrada no Asaas.
- `ENABLE_DESTRUCTIVE_DATA_ADMIN=false` em produção.
- Tokens de webhook devem ser aleatórios, exclusivos e rotacionáveis.
- Hosts Evolution e n8n devem estar nas allowlists e usar HTTPS válido.
- O n8n deve validar `X-AnjoLav-Webhook-Token`; o dispatcher exige `N8N_WEBHOOK_TOKEN` com 32+ caracteres e não enviará sem ele.
- `NFSE_ENABLED=false` deve permanecer até existir adaptador específico homologado para o município e provedor contratados.
- Não acrescente `SUPABASE_URL`, `SUPABASE_ANON_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` ao arquivo: são secrets padrão das Edge Functions hospedadas.

Rode o contrato local antes de alterar o ambiente:

```powershell
Copy-Item ops/release-evidence.example.json ops/release-evidence.json
npm run preflight:production -- --frontend-env .env.production --functions-env supabase/.env.production --release-evidence ops/release-evidence.json
```

O resultado só fica aprovado quando o commit estiver limpo e todas as evidências reais de release tiverem sido registradas. O preflight não acessa provedores externos nem substitui os testes de homologação.

## 5. Edge Functions

Após validar em staging, implante:

```powershell
supabase functions deploy sign-in
supabase functions deploy manage-employee
supabase functions deploy portal-customer
supabase functions deploy data-administration
supabase functions deploy create-asaas-charge
supabase functions deploy pdv-payment
supabase functions deploy asaas-webhook
supabase functions deploy whatsapp-evolution
supabase functions deploy webhook-dispatcher
supabase functions deploy nfse-adapter
```

`supabase/config.toml` mantém JWT obrigatório nas funções privadas e o desliga apenas nos endpoints que precisam ser públicos (`sign-in`, portal e webhook Asaas); esses endpoints possuem validação própria.

Antes de promover o Asaas, consulte a saúde da integração na área administrativa. “Configurado — entrega não homologada” confirma API key, URL, eventos, estado ativo e fila não interrompida no cadastro do provedor; ainda é obrigatório provocar um evento de teste em staging para confirmar que o token recebido corresponde ao secret e que o processamento chega ao estado final.

A migration `20260914201853_pdv_payment_flow.sql` cria o ledger do PDV, as rotinas transacionais e o inbox idempotente do webhook. Aplique-a antes de publicar `pdv-payment` e `asaas-webhook`. O receptor persiste o evento com ID único antes da conciliação e devolve erro para permitir retry do provedor quando o processamento falha; valide em staging o tempo de resposta, as tentativas e os eventos em estado `failed`. Antes de escala comercial, adicione um worker assíncrono monitorado para reprocessar automaticamente o inbox sem depender apenas do retry do provedor.

`nfse-adapter` deve ser publicado ainda com `NFSE_ENABLED=false`. O endpoint de saúde informa as pendências e as operações de emissão/consulta/cancelamento respondem `NFSE_NOT_READY`; ele não encaminha dados fiscais para URL genérica.

O faturamento ainda usa `mailto:` apenas para preparar uma mensagem manual, sem anexos e sem marcar a fatura como enviada. Antes do go-live, integre e homologue um provedor de e-mail transacional no backend, com autenticação de domínio, rastreio de entrega/bounce, retry e trilha de auditoria.

O workflow manual `.github/workflows/deploy-edge-functions-production.yml` também está preparado. Crie o Environment `production` no GitHub com aprovação obrigatória e os secrets `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF`; ele não executa migrations, não cadastra secrets e não publica o frontend automaticamente.

## 6. Ordem de promoção

1. Backup verificado do banco e configuração atual.
2. Migrations aditivas em staging.
3. Testes RLS, integrações e E2E em staging.
4. Edge Functions em staging.
5. Frontend em staging e UAT.
6. Janela de mudança aprovada, backup de produção e plano de rollback.
7. Migrations, functions e frontend em produção.
8. Smoke tests sem dados fictícios e observação reforçada.

## 7. Rollback

- Frontend: reimplantar o artefato anterior.
- Edge Functions: reimplantar a versão anterior conhecida.
- Banco: corrigir por uma nova migration; nunca reescrever uma migration aplicada.
- Integrações: desativar no provedor e manter processamento manual controlado.

Um rollback não substitui restauração. A restauração deve ser ensaiada antes do go-live.
