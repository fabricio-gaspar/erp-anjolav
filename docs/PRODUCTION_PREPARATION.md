# Preparação do ambiente real

Este repositório agora inclui um contrato local de produção, um preflight que não revela secrets e um workflow manual para Edge Functions. Eles preparam a implantação; não substituem homologação nem aprovam o produto automaticamente.

## O que preencher localmente

No computador ou CI de release, crie três arquivos que permanecem fora do Git:

```powershell
Copy-Item frontend.production.env.example .env.production
Copy-Item supabase/production.env.example supabase/.env.production
Copy-Item ops/release-evidence.example.json ops/release-evidence.json
```

1. Em `.env.production`, preencha apenas a chave publicável do projeto Supabase. O `project_ref` e a URL já correspondem ao `supabase/config.toml` deste repositório.
2. Em `supabase/.env.production`, informe os valores reais de Asaas, Evolution e n8n. Mantenha `NFSE_ENABLED=false` até contratar e homologar o adaptador fiscal. Não copie `SUPABASE_URL`, `SUPABASE_ANON_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`: as Edge Functions hospedadas recebem essas variáveis da plataforma.
3. Cadastre em `ALLOWED_ORIGINS` somente a origem HTTPS final do ERP, sem caminho ou barra no fim. URL de preview não deve ser tratada como domínio de produção.
4. Configure o n8n para exigir o header `X-AnjoLav-Webhook-Token` e use nele o mesmo `N8N_WEBHOOK_TOKEN` de 32+ caracteres aleatórios. O dispatcher não envia ao n8n sem esse token.
5. Em `ops/release-evidence.json`, mantenha todos os gates como pendentes até executar e registrar o teste correspondente. O arquivo é ignorado pelo Git para que contenha evidências internas sem ir ao repositório.

Nunca use prefixo `VITE_` para tokens de Asaas, Evolution, n8n, service role, certificados ou qualquer outro secret.

## Verificação antes de publicar

```powershell
npm ci
npm run check
npm run preflight:production -- --frontend-env .env.production --functions-env supabase/.env.production --release-evidence ops/release-evidence.json
```

O preflight valida formato, destino do projeto, CORS, secrets obrigatórios, proteção contra segredo no frontend, commit limpo e gates de evidência. Ele não faz chamadas a Supabase, Asaas, Evolution, n8n, NFS-e ou e-mail; portanto não cobra, não envia mensagens e não muda dados.

Enquanto um gate estiver pendente, o resultado `BLOQUEADO` é esperado e correto. Não altere um gate para aprovado sem registrar uma evidência concreta do teste realizado.

## Supabase e secrets

Nesta máquina, a CLI do Supabase não está instalada; instale uma versão atual antes da primeira implantação. Depois, confirme primeiro o projeto correto:

```powershell
supabase login
supabase projects list
supabase link --project-ref uomhckyqghkcnctbdwvp
supabase migration list
```

Depois de conferir o `project_ref`, publique os secrets sem versionar o arquivo local:

```powershell
supabase secrets set --env-file supabase/.env.production
supabase secrets list
```

As variáveis gravadas ficam disponíveis imediatamente para as Edge Functions hospedadas; não é preciso reimplantar apenas para atualizar secrets. Consulte a documentação oficial de [secrets de Edge Functions](https://supabase.com/docs/guides/functions/secrets).

Não execute `supabase db push` antes de reativar, inspecionar e fazer backup do projeto próprio. Depois, aplique em staging a migration de hardening multiempresa e execute testes cruzados antes da produção.

## Publicação controlada

Após testar em staging, publique as funções manualmente:

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

Também existe o workflow manual [deploy-edge-functions-production.yml](../.github/workflows/deploy-edge-functions-production.yml). Antes de usá-lo, crie o GitHub Environment `production`, exija aprovação e armazene somente `SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_REF` nele. Digite `DEPLOY_PRODUCTION` ao disparar o workflow. Ele verifica o código e publica Edge Functions, mas não faz migrations, não define secrets e não publica o frontend automaticamente.

O procedimento oficial de autenticar, vincular e publicar funções está em [Deploy to Production](https://supabase.com/docs/guides/functions/deploy).

## O que você deve testar depois

Registre os resultados nos gates de `ops/release-evidence.json`:

- isolamento RLS entre usuário, área, unidade/tenant, cliente e portal;
- backup/PITR e restauração ensaiada;
- fluxos críticos de OS, produção, caixa, faturamento e portal;
- ledger `pdv_pagamentos`, idempotência de venda/recebimento e eventos Asaas persistidos antes da conciliação;
- PIX dinâmico no PDV: QR com valor, confirmação automática, cancelamento pendente, reabertura da tela e retry do webhook;
- dinheiro (troco), débito e crédito (NSU/autorização e parcelas), pagamento parcial, múltiplas formas na mesma OS e estorno;
- worker assíncrono e monitoramento dos eventos Asaas em estado `failed`, além do retry do provedor;
- NFS-e real, certificado e cancelamento;
- Evolution, n8n autenticado, e-mail transacional, autenticação e recuperação de senha;
- alertas, logs, rate limit, MFA, incidentes, LGPD, contrato, suporte e SLA.

Os últimos itens continuam bloqueadores de comercialização até que exista implementação, acesso aos provedores e evidência de homologação. Veja [Prontidão comercial](COMMERCIAL_READINESS.md) e [Checklist de go-live](GO_LIVE_CHECKLIST.md).
