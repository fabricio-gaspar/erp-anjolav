# Auditoria geral do sistema

**Data:** 2026-10-16  
**Escopo:** Site local do ERP, Supabase uomhckyqghkcnctbdwvp e site publicado usado nos testes anteriores.  
**Regra operacional:** nenhuma publicação, migração, restauração, exclusão ou concessão de privilégio foi executada nesta auditoria.

## Resultado executivo

| Área | Status | Evidência e conclusão |
|---|---|---|
| Clientes Industriais | **Corrigido localmente / dados indisponíveis** | A consulta em public.clientes retornou 0 registros totais, 0 no tenant AnjoLav e 0 classificados como industrial. A RLS atual está ativa e coerente; portanto a ausência não é causada por filtro de tela ou isolamento excessivo. A tela publicada mostrou estado vazio finito, sem loading infinito. |
| Administração SaaS | **Validado na versão publicada anterior** | Fabricio possui associação ativa ao tenant, funcionário ativo e registro ativo em platform_administrators. A rota é protegida por platformAdminOnly e a Edge Function valida o usuário e a tabela de administradores. A correção de CORS/autorização já existente não foi alterada nesta auditoria. |
| Relatório Mensal | **Validado** | O hook usa relações explícitas e a página diferencia loading, erro e ausência de dados, com retry. O teste de contrato existente passou. Os dados financeiros e operacionais atuais estão majoritariamente vazios; isso limita a validação de valores, não o carregamento da tela. |
| Demais módulos | **Inventariados; E2E individual pendente** | Rotas, hooks, funções, tabelas e controles de acesso foram catalogados. Não há evidência suficiente para afirmar que cada fluxo foi exercitado integralmente por navegador nesta sessão. |

## 1. P0 — Clientes Industriais

### Causa identificada

A causa imediata confirmada é **ausência de dados na tabela principal do banco atual**, e não uma falha de renderização:

- public.clientes: 0 registros totais.
- Tenant AnjoLav: 0 registros.
- Classificação industrial no tenant: 0 registros.
- A tela /industrial/clientes terminou em “Nenhum cliente encontrado”, sem permanecer em “Carregando clientes...”.
- A consulta do hook usa public.clientes, ordena por razao_social e aplica apenas a classificação da área ativa (src/hooks/useFilteredClientes.ts:14-22).

A causa histórica exata — se os registros nunca foram cadastrados ou se foram apagados anteriormente — **não pode ser provada pelo banco atual**. A tabela clientes não está incluída na lista de tabelas com trigger audit_mutation da migração de hardening (supabase/migrations/20260930120000_commercial_multitenancy_hardening.sql:1094-1100), e não existem eventos de auditoria para entity_table = 'clientes'. A tela também possui uma mutação de exclusão física no hook de clientes. Isso impede atribuir data, ator ou operação específica à perda sem backup, WAL/log de banco ou export autorizado.

Não foi encontrada evidência de que a migração de multitenancy tenha ocultado os dados: ela inclui clientes na lista de tabelas tenantizadas e atribui o tenant às linhas existentes (supabase/migrations/20260930120000_commercial_multitenancy_hardening.sql:124-160). A migração que cria a tabela principal é supabase/migrations/20260111135040_a4ff8ed0-c20b-41db-afb9-b67d72769b3f.sql:7-25.

### Autorização e RLS

O estado de produção consultado confirmou:

- RLS ativa em public.clientes.
- Quatro políticas atuais: tenant_select, tenant_insert, tenant_update e tenant_delete.
- As políticas restringem por private.current_tenant_id(), acesso de módulo e private.can_access_area(classificacao).
- Não há tabelas públicas sem RLS no levantamento executado.
- Fabricio tem associação ativa ao tenant, funcionário ativo e administrador de plataforma ativo.

Portanto, com uma linha existente e o contexto autorizado correto, a política atual deveria permitir a leitura correspondente. Não foi desabilitada RLS e nenhum privilégio foi ampliado.

### Correção local realizada

src/pages/Clientes.tsx:51-61, 216-223 agora consome error e refetch de useFilteredClientes. Se a consulta falhar, a interface exibe “Não foi possível carregar os clientes.” e o botão “Tentar novamente”; somente uma resposta bem-sucedida com zero linhas exibe “Nenhum cliente encontrado”. Assim, indisponibilidade de API/RLS/conexão não é apresentada como base vazia e não induz o usuário a cadastrar dados duplicados.

O teste regressivo foi adicionado em test/clientes-visibility.test.ts:9-17.

## 2. Administração SaaS

### Fluxo verificado

- Rota: src/lib/appRoutes.ts:100-105.
- Proteção de rota: src/App.tsx:179-186 e src/components/auth/ProtectedRoute.tsx:18-80.
- Edge Function: supabase/functions/platform-administration/index.ts:128.
- Autorização compartilhada: supabase/functions/_shared/auth.ts:14-45, 95-116.

O controle não depende de uma role customizada no JWT. O JWT confirma o usuário autenticado; o servidor valida empresa ativa, associação habilitada/ativa e a linha ativa em platform_administrators. No banco, o perfil auditado apresentou:

- tenant_memberships: 1 associação ativa ao tenant AnjoLav.
- funcionarios: 1 funcionário ativo para o usuário.
- platform_administrators: 1 registro ativo.
- raw_app_meta_data do usuário contém provedor de autenticação, sem claim de role; isso é compatível com o modelo de autorização no banco.

Não há falha compartilhada atual de autenticação/autorização entre Administração SaaS e Relatório Mensal. A Administração SaaS foi corrigida em alteração anterior e a versão publicada foi validada; nesta auditoria não houve novo deploy.

## 3. Relatório Mensal e indicadores

### Verificações

- A página usa const { data, error, isLoading, refetch } = useRelatorioMensal(...) (src/pages/RelatorioMensal.tsx:35).
- O estado error && !data encerra o loading e oferece retry (src/pages/RelatorioMensal.tsx:114-127).
- O teste existente cobre relações explícitas, erro e retry (test/central-administration-report.test.ts:9-19).
- Não foi identificado loop de renderização no código auditado.

### Estado dos dados

Os contadores read-only do tenant AnjoLav foram:

| Fonte | Total no tenant |
|---|---:|
| clientes | 0 |
| agendamentos | 0 |
| faturas | 0 |
| contas_pagar | 0 |
| historico_producao | 0 |
| ordens_servico | 0 |
| produtos | 0 |
| caixa_movimentacoes | 0 |
| caixas | 1 |
| funcionarios | 1 |
| tenant_memberships | 1 |

Os indicadores devem permanecer vazios/indisponíveis quando não houver fonte de dados; não foi inserido zero artificial nem alterado o contrato para mascarar ausência de dados.

## 4. Inventário de módulos e superfícies

### Rotas centrais

- /central — Dashboard.
- /central/financeiro — Dashboard Financeiro.
- /central/contas — Contas.
- /central/agenda-eventos — Agenda e eventos.
- /central/relatorios/quilometragem — Relatório de quilometragem.
- /central/relatorios/mensal — Relatório Mensal.
- /central/configuracoes — Configurações administrativas.
- /central/auditoria — Auditoria.
- /central/administracao-saas — Administração SaaS.

### Rotas industriais

- /industrial, /industrial/clientes, /industrial/produtos, /industrial/fornecedores, /industrial/agenda.
- /industrial/ordens, /industrial/producao, /industrial/lancamentos, /industrial/financeiro, /industrial/estoque.
- /industrial/relatorios/clientes, /industrial/relatorios/proximidade.

### Rotas residenciais

- /residencial, /residencial/caixa, /residencial/clientes, /residencial/agenda, /residencial/ordens.
- /residencial/producao, /residencial/financeiro, /residencial/produtos, /residencial/relatorios/caixa.

### Dependências principais

| Fluxo | Hooks/serviços e fontes principais |
|---|---|
| Clientes | useClientes, useFilteredClientes; clientes, enderecos_clientes, configuracoes_cliente, configuracoes_pagamento_cliente, precos_especiais. |
| Agenda | useAgendamentos, useFilteredAgendamentos, useEventosAgenda; agendamentos, eventos_agenda. |
| Produção/OS | useOrdensServico, useFluxoProducao, useHistoricoProducao; ordens_servico, itens_ordem_servico, historico_producao. |
| Faturamento | useFaturas, useLancamentos, useDadosFaturamento; faturas, lancamentos, lancamentos_fatura e clientes relacionados. |
| Financeiro | useContasPagar, useContasReceberUnificado, useRelatorioFinanceiro, useRelatorioMensal; contas_pagar, caixa_movimentacoes, caixas e views financeiras. |
| SaaS/Portal | platform-administration, portal-customer, manage-employee, sign-in, pdv-payment, integrações Asaas/WhatsApp/NFS-e. |

## 5. Segurança, RBAC, tenant e integrações

- Todas as tabelas públicas verificadas estão com RLS ativa.
- A política de clientes mantém tenant, módulo e área de negócio; não foi substituída por USING true.
- O papel de tenant de Fabricio é admin; o acesso Full Master da Administração SaaS é adicionalmente controlado por platform_administrators.
- Não foram alterados claims JWT, roles, memberships, políticas ou funções privilegiadas.
- Não foram encontrados vínculos do usuário com outro tenant que justificassem troca de empresa ativa.
- As Edge Functions foram inventariadas por dependências; platform-administration acessa catálogo de planos, assinaturas e tenants, enquanto sign-in e manage-employee dependem do contexto de associação.

### Advisories do Supabase

Os advisors foram consultados sem aplicar correções automáticas:

- Segurança: rls_enabled_no_policy INFO em 3 tabelas internas de serviço (portal_rate_limits, saas_plan_catalog, tenant_service_subscriptions), pg_graphql_authenticated_table_exposed WARN em 65 objetos, authenticated_security_definer_function_executable WARN em 12 funções e auth_leaked_password_protection WARN em 1 item.
- Performance: 126 FKs sem índice de cobertura, 4 ocorrências de init plan de RLS, 94 índices não utilizados e 17 grupos de políticas permissivas sobrepostas.

Esses achados são pendências de hardening/performance, não evidência de que tenham causado o desaparecimento dos clientes. Qualquer ajuste precisa de escopo próprio, revisão de impacto e migração aprovada.

## 6. Testes executados

### Local

- TDD focalizado: node --test test/clientes-visibility.test.ts — 1 passou. O teste foi executado antes da implementação e falhou; após a implementação passou.
- Suíte completa: npm test — 111 passaram, 0 falharam.
- TypeScript: npm run typecheck — passou.
- ESLint: npm run lint — passou com 0 erros e 170 warnings preexistentes.
- Edge Functions: npm run check:edge — 20 arquivos verificados.
- Build: npm run build — passou, bundle produzido localmente.

### Navegador/publicado

- Sessão autenticada de administrador Full Master: a tela Industrial Clientes foi observada em estado vazio finito, sem spinner persistente.
- Administração SaaS e Relatório Mensal já haviam sido exercitados na versão publicada que contém as correções anteriores: acesso permitido para o administrador e estados de erro/retry presentes.
- Não foi possível executar E2E com usuário comum nesta sessão porque não havia uma sessão/credencial comum disponível. Não foi fabricado esse resultado.

## 7. Arquivos modificados nesta auditoria

- src/pages/Clientes.tsx — trata falha de consulta e fornece retry.
- test/clientes-visibility.test.ts — regressão da distinção entre erro e lista vazia.
- AUDITORIA_GERAL_SISTEMA.md — este relatório.
- docs/superpowers/plans/2026-10-16-auditoria-geral-sistema.md — plano de auditoria.
- .superpowers/sdd/2026-10-16-auditoria-geral-sistema/progress.md — ledger interno de execução.

Não foram alterados arquivos de migração, dados de produção, políticas RLS, claims, roles, Edge Functions publicadas ou bundles publicados.

## 8. Pendências reais e riscos

1. **Recuperação dos clientes:** obter backup/export/WAL/log autorizado para saber se havia registros e restaurar somente dados comprovados. Nenhuma restauração foi feita.
2. **Auditoria de clientes:** aprovar migração para auditar INSERT/UPDATE/DELETE em clientes e avaliar arquivamento em vez de exclusão física. Não aplicada.
3. **E2E com usuário comum:** disponibilizar uma sessão de teste não privilegiada e repetir rotas permitidas, negadas, sem dados e com falha de conexão.
4. **Publicação da correção local:** o tratamento de erro de Clientes está apenas no checkout local; publicar exige autorização explícita separada. O bundle local foi apenas compilado.
5. **Advisories Supabase:** tratar warnings de GraphQL, funções SECURITY DEFINER, proteção contra senhas vazadas, índices e políticas sobrepostas em uma revisão de segurança/performance dedicada.

Até que uma fonte de recuperação seja apresentada, o sistema deve continuar informando ausência de dados em vez de recriar clientes ou preencher indicadores com zeros presumidos.
