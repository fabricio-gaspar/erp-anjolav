# Commercial Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize AnjoLav ERP as a secure multi-tenant commercial SaaS, correct the observed production failures, and publish only a release that passes its defined technical and operational gates.

**Architecture:** Move finance calculations from unbounded browser queries to tenant-scoped database aggregates; centralize route metadata for navigation and authorization; extend the existing service-role Portal and payment boundaries rather than exposing new tables to browsers. Additive SQL migrations provide indexes, guarded RPCs, audit views, retry state, and SaaS lifecycle metadata while preserving tenant isolation and leaving external fiscal and billing activation fail-closed.

**Tech Stack:** React 18, TypeScript 5.8, Vite 6, TanStack Query 5, Tailwind/shadcn, Supabase Postgres/Auth/RLS/Edge Functions, Node 24 test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-15-commercial-readiness-design.md`

## Global Constraints

- Keep `tenant_id` and area authorization mandatory on every database read or write.
- Use additive, versioned migrations only; never reset, truncate, or rewrite existing operational data.
- Do not store service-role keys, provider tokens, passwords, certificates, or webhook secrets in frontend code, commits, test fixtures, or logs.
- Preserve NFS-e and SaaS recurring billing as explicitly disabled until a provider, commercial rules, and production credentials are independently homologated.
- Do not activate an Epson local bridge; browser printing remains the supported path until a separately authenticated local-agent design is approved.
- Run the smallest relevant test before and after every task, then run the full validation suite before release.
- Every publishable release must use the same Git SHA for frontend, migrations, and Edge Functions and must pass `npm run preflight:production` with real release evidence.

## Review Focus

- A non-Central employee must land in an authorized workspace and never be shown a route that later denies access; test this in Task 4.
- A tenant-scoped finance call with a long date range must return aggregates only and never leak another tenant’s values; test this in Task 2.
- A revoked or expired Portal code must not expose loyalty balance or history; test this in Task 6.
- A print window blocked by the browser or still spooling must not be treated as a successful silent print; test this in Task 5.
- A failed Asaas event must remain idempotent across retry attempts and not mark an invoice paid twice; test this in Task 8.

---

## File Structure

- `supabase/migrations/20261015110000_financial_dashboard_aggregates.sql` — tenant-aware financial aggregation RPC and measured hot-path indexes.
- `supabase/migrations/20261015113000_security_performance_hardening.sql` — RLS query-shape improvements, audit access helpers, and non-destructive database hardening.
- `supabase/migrations/20261015116000_webhook_retry.sql` — retry state for integration failures without changing existing events.
- `supabase/migrations/20261015119000_platform_administration.sql` — platform-admin, plan, and subscription metadata without automatic charging.
- `src/lib/appRoutes.ts` — single route metadata catalog including area, required module, admin requirement, label, and default target rules.
- `src/hooks/useAccessibleWorkspaces.ts` — cached allowed-area query and safe default workspace selection.
- `src/hooks/useFinanceiroAgregado.ts` — typed query wrapper around the financial aggregate RPC.
- `src/hooks/useAuditEvents.ts` — paginated, read-only audit-event query for tenant administrators.
- `src/hooks/usePortalData.ts` — Portal loyalty contract and safe bootstrap data types.
- `src/pages/Auditoria.tsx` — Central-only audit timeline page.
- `src/pages/AdministracaoSaas.tsx` — platform-admin-only SaaS lifecycle page, disabled for non-platform accounts.
- `src/components/financeiro/*` — focused dashboard cards and error/retry presentation.
- `src/components/portal/FidelidadeClienteCard.tsx` — Portal loyalty summary and recent history.
- `src/components/configuracoes/AdministracaoSaas.tsx` — tenant plan/status administration UI used by the SaaS page.
- `src/lib/safePrint.ts`, `src/hooks/usePrintOS.ts`, `src/components/configuracoes/ROLPreview.tsx`, `src/components/configuracoes/EtiquetaPreview.tsx` — one canonical browser-print lifecycle.
- `src/App.tsx`, `src/components/layout/AppSidebar.tsx`, `src/components/layout/AppHeader.tsx`, `src/hooks/useGlobalSearch.ts`, `src/lib/authorization.ts` — route catalog consumers and corrected navigation.
- `supabase/functions/portal-customer/index.ts` — scoped Portal loyalty bootstrap.
- `supabase/functions/asaas-webhook/index.ts`, `supabase/functions/retry-asaas-webhook/index.ts` — idempotent persistence and controlled retry of failed Asaas events.
- `supabase/functions/platform-administration/index.ts` — authenticated platform-admin API boundary, with no billing-provider calls.
- `test/financial-dashboard.test.ts`, `test/navigation.test.ts`, `test/audit-events.test.ts`, `test/portal-loyalty.test.ts`, `test/print-lifecycle.test.ts`, `test/webhook-retry.test.ts`, `test/saas-platform.test.ts` — regression contracts for the new behavior.
- `ops/production-controls.md`, `ops/release-evidence.example.json`, `.github/workflows/ci.yml` — operational controls, CI gates, and release evidence instructions.

## Task 1: Establish release contracts and baseline test coverage

**Files:**
- Create: `test/commercial-readiness-contract.test.ts`
- Modify: `test/production-preflight.test.mjs`
- Modify: `scripts/production-preflight.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `REQUIRED_RELEASE_GATES` from `scripts/production-preflight.mjs`.
- Produces: a release contract that rejects missing migration, Edge Function, E2E, performance, and deployment-provenance evidence.

- [ ] **Step 1: Write failing release-contract tests**

Add tests asserting that a release evidence file must contain `migrationVersion`, `edgeFunctionCommit`, `frontendCommit`, `e2eCriticalFlows`, and `performanceBudget`, and that all three commit values equal `releaseCommit`.

- [ ] **Step 2: Run the focused preflight tests to verify failure**

Run: `node --test test/production-preflight.test.mjs`

Expected: FAIL because the new release evidence fields are not yet required.

- [ ] **Step 3: Extend `validateEvidence` and `REQUIRED_RELEASE_GATES`**

In `scripts/production-preflight.mjs`, add the exact evidence fields from Step 1 and reject mismatched SHA values without printing secrets. Add a `releaseProvenance` gate to `REQUIRED_RELEASE_GATES`.

- [ ] **Step 4: Add static commercial-contract tests**

Create `test/commercial-readiness-contract.test.ts` that checks the route catalog, finance RPC migration, Portal loyalty contract, retry function, and SaaS migration are included in the release surface.

- [ ] **Step 5: Verify focused tests pass**

Run: `node --test test/production-preflight.test.mjs test/commercial-readiness-contract.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/production-preflight.mjs test/production-preflight.test.mjs test/commercial-readiness-contract.test.ts .github/workflows/ci.yml
git commit -m "test: strengthen commercial release contracts"
```

## Task 2: Move finance aggregation into a tenant-scoped database RPC

**Files:**
- Create: `supabase/migrations/20261015110000_financial_dashboard_aggregates.sql`
- Create: `src/hooks/useFinanceiroAgregado.ts`
- Modify: `src/hooks/useDashboardFinanceiro.ts`
- Modify: `src/pages/DashboardFinanceiro.tsx`
- Create: `test/financial-dashboard.test.ts`

**Interfaces:**
- Consumes: `private.current_tenant_id()`, `private.can_access_area(text)`, `faturas`, `contas_pagar`, and `caixa_movimentacoes`.
- Produces: `public.consultar_dashboard_financeiro(_inicio date, _fim date, _setor text) returns jsonb` and `useFinanceiroAgregado(periodo: { inicio: string; fim: string }, setor: SetorFinanceiro)`.

- [ ] **Step 1: Write failing migration and hook contract tests**

Create tests that require `consultar_dashboard_financeiro`, tenant/area guards, bounded date inputs, aggregate-only JSON keys, and no `select("*")` or unbounded finance query in `useDashboardFinanceiro.ts`.

- [ ] **Step 2: Run the focused test to verify failure**

Run: `node --test test/financial-dashboard.test.ts`

Expected: FAIL because the migration and hook do not exist.

- [ ] **Step 3: Implement the aggregate migration**

Create the migration with indexes selected for `(tenant_id, data_vencimento)`, `(tenant_id, status, data_vencimento)`, and `(tenant_id, created_at)` on the hot financial tables after checking existing indexes. Implement `consultar_dashboard_financeiro` as `SECURITY DEFINER` with `SET search_path = public, private, pg_temp`, explicit caller/tenant/area checks, a maximum 366-day interval, and a fixed JSON result containing totals, counts, aging buckets, and up to 20 overdue records.

- [ ] **Step 4: Implement `useFinanceiroAgregado` and refactor the page**

Use `supabase.rpc("consultar_dashboard_financeiro", { _inicio, _fim, _setor })`. Replace browser-side full-history reductions in `useDashboardFinanceiro.ts`; keep its exported presentation type compatible with `DashboardFinanceiro.tsx` or migrate the page in the same commit.

- [ ] **Step 5: Add independent widget error/retry UI**

Split the financial screen into cards that render a retry action and correlation-safe error message when the aggregate request fails; do not fail the whole page if a non-critical chart fails.

- [ ] **Step 6: Verify the task**

Run: `node --test test/financial-dashboard.test.ts && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261015110000_financial_dashboard_aggregates.sql src/hooks/useFinanceiroAgregado.ts src/hooks/useDashboardFinanceiro.ts src/pages/DashboardFinanceiro.tsx src/components/financeiro test/financial-dashboard.test.ts
git commit -m "fix: aggregate financial dashboard by tenant"
```

## Task 3: Reduce unnecessary frontend refetching and make loading observable

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/hooks/useDashboardFinanceiro.ts`
- Create: `src/lib/queryDefaults.ts`
- Modify: `test/financial-dashboard.test.ts`

**Interfaces:**
- Consumes: TanStack Query defaults and finance/dashboard query keys.
- Produces: `dashboardQueryDefaults` with bounded stale times, retry/backoff, and targeted invalidation behavior.

- [ ] **Step 1: Extend the financial test with query behavior assertions**

Assert that the global query client no longer uses `refetchOnMount: "always"` and that production dashboard queries do not poll full datasets every 30 seconds.

- [ ] **Step 2: Run the focused test to verify failure**

Run: `node --test test/financial-dashboard.test.ts`

Expected: FAIL against the current QueryClient configuration.

- [ ] **Step 3: Introduce shared query defaults**

Create `src/lib/queryDefaults.ts` with explicit stale time, retry count, exponential retry delay, and reconnect behavior. Import it from `src/App.tsx`; preserve immediate invalidation after mutations rather than relying on mount refetches.

- [ ] **Step 4: Bound dashboard polling and show freshness**

Replace unbounded polling in `Dashboard.tsx` with invalidation-driven refresh or a low-frequency, lightweight aggregate refresh. Add visible last-updated information only where it improves operator decisions.

- [ ] **Step 5: Verify the task**

Run: `node --test test/financial-dashboard.test.ts && npm run lint && npm run typecheck`

Expected: PASS with no new warnings.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/pages/Dashboard.tsx src/hooks/useDashboardFinanceiro.ts src/lib/queryDefaults.ts test/financial-dashboard.test.ts
git commit -m "perf: bound dashboard queries and refetching"
```

## Task 4: Centralize route metadata, area access, and the audit screen

**Files:**
- Create: `src/lib/appRoutes.ts`
- Create: `src/hooks/useAccessibleWorkspaces.ts`
- Create: `src/hooks/useAuditEvents.ts`
- Create: `src/pages/Auditoria.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/authorization.ts`
- Modify: `src/components/layout/AppSidebar.tsx`
- Modify: `src/components/layout/AppHeader.tsx`
- Modify: `src/hooks/useGlobalSearch.ts`
- Create: `test/navigation.test.ts`
- Create: `test/audit-events.test.ts`

**Interfaces:**
- Consumes: `has_area_access`, `has_role`, `audit_events`, `ModulePermissionKey`, and the active tenant session.
- Produces: `APP_ROUTES`, `getFirstAuthorizedWorkspace(areas)`, `useAccessibleWorkspaces()`, and `useAuditEvents({ cursor, limit })`.

- [ ] **Step 1: Write failing navigation and audit tests**

Cover: root redirect chooses Industrial or Residential when Central is unavailable; every sidebar route exists in `APP_ROUTES`; audit maps to `configuracoes` plus admin access; Central search does not force Residential records into Industrial; no duplicate Configurações item appears outside Central.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `node --test test/navigation.test.ts test/audit-events.test.ts`

Expected: FAIL because the route catalog, audit page, and area-aware defaults do not exist.

- [ ] **Step 3: Implement `appRoutes` and accessible-area resolution**

Create a typed route definition with `path`, `area`, `requiredModules`, `adminOnly`, `label`, and `navigationGroup`. `useAccessibleWorkspaces` must query all three workspace permissions once per session and expose the first allowed default in Central, Industrial, Residential order.

- [ ] **Step 4: Refactor router and navigation consumers**

Use the route catalog in `App.tsx`, `authorization.ts`, sidebar, header, user menu, and global search. Ensure a link is rendered only when both module and area requirements are satisfied. Rename Industrial labels to “Ordens de Serviço” and “Faturamento/Lançamentos”; preserve legacy redirects where they remain safe.

- [ ] **Step 5: Add the tenant-admin audit page**

Implement `Auditoria.tsx` with read-only pagination, date/entity/action filters, empty/error states, and no raw sensitive payload display. Protect `/central/auditoria` with Central area, `configuracoes` module, and `adminOnly`.

- [ ] **Step 6: Verify the task**

Run: `node --test test/navigation.test.ts test/audit-events.test.ts && npm run typecheck && npm run build`

Expected: PASS; a direct request to `/central/auditoria` no longer resolves to 404 for an authorized admin.

- [ ] **Step 7: Commit**

```bash
git add src/lib/appRoutes.ts src/hooks/useAccessibleWorkspaces.ts src/hooks/useAuditEvents.ts src/pages/Auditoria.tsx src/App.tsx src/lib/authorization.ts src/components/layout/AppSidebar.tsx src/components/layout/AppHeader.tsx src/hooks/useGlobalSearch.ts test/navigation.test.ts test/audit-events.test.ts
git commit -m "fix: align workspace navigation and audit access"
```

## Task 5: Unify ROL and label print lifecycle

**Files:**
- Modify: `src/lib/safePrint.ts`
- Modify: `src/hooks/usePrintOS.ts`
- Modify: `src/components/configuracoes/ROLPreview.tsx`
- Modify: `src/components/configuracoes/EtiquetaPreview.tsx`
- Modify: `src/services/printService.ts`
- Create: `test/print-lifecycle.test.ts`

**Interfaces:**
- Consumes: `openPrintDocument`, `reservePrintWindow`, `writePrintDocument`, and `triggerPrint`.
- Produces: `printDocumentWhenReady(printWindow: Window, options?: { autoClose?: false }): void`, used by all browser-print callers.

- [ ] **Step 1: Write failing print lifecycle tests**

Assert that no source path calls `printWindow.close()` immediately after `printWindow.print()`, blocked popups return failure, and all ROL/label paths call the shared helper.

- [ ] **Step 2: Run the focused test to verify failure**

Run: `node --test test/print-lifecycle.test.ts`

Expected: FAIL because preview and launch paths close the window immediately.

- [ ] **Step 3: Implement the shared lifecycle helper**

Add `printDocumentWhenReady` in `safePrint.ts`; it must focus and print after document readiness, never close automatically, and return a failure signal if no window exists. Keep the existing restrictive print-document CSP and HTML escaping.

- [ ] **Step 4: Migrate every print entry point**

Replace direct `print()` and `close()` timers in `usePrintOS`, `ROLPreview`, and `EtiquetaPreview`. Ensure `printService` continues to reserve the popup synchronously before asynchronous data loading.

- [ ] **Step 5: Verify the task**

Run: `node --test test/safe-print.test.ts test/print-lifecycle.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/safePrint.ts src/hooks/usePrintOS.ts src/components/configuracoes/ROLPreview.tsx src/components/configuracoes/EtiquetaPreview.tsx src/services/printService.ts test/print-lifecycle.test.ts
git commit -m "fix: preserve browser print jobs before window close"
```

## Task 6: Complete loyalty visibility in the Portal without weakening access control

**Files:**
- Create: `supabase/migrations/20261015111500_portal_loyalty_visibility.sql`
- Modify: `supabase/functions/portal-customer/index.ts`
- Modify: `src/integrations/supabase/types.ts`
- Modify: `src/components/configuracoes/ConfiguracoesFidelidade.tsx`
- Modify: `src/hooks/usePortalData.ts`
- Create: `src/components/portal/FidelidadeClienteCard.tsx`
- Modify: `src/pages/PortalCliente.tsx`
- Create: `test/portal-loyalty.test.ts`
- Modify: `test/pdv-payment.test.ts`

**Interfaces:**
- Consumes: `fidelidade_configuracoes.portal_exibir_fidelidade`, `fidelidade_lancamentos`, resolved `PortalContext`, and the existing ROL/POS loyalty rules.
- Produces: `PortalBootstrap.loyalty: { active: boolean; visible: boolean; balancePoints: number; balanceValue: number; minimumRedemptionPoints: number; recentEntries: LoyaltyEntry[] }`.

- [ ] **Step 1: Write failing Portal loyalty tests**

Assert that the additive migration creates the dedicated, default-false `portal_exibir_fidelidade` tenant setting without reusing the ROL-print flag; the Portal bootstrap scopes loyalty queries to `context.config.tenant_id` and `context.cliente.id`; inactive/hidden programs return no balance; history is capped at 10 sanitized entries; the frontend does not render the card when `visible` is false.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `node --test test/portal-loyalty.test.ts test/pdv-payment.test.ts`

Expected: FAIL because `PortalBootstrap.loyalty` is absent.

- [ ] **Step 3: Extend Portal bootstrap server response**

Add the additive, default-false Portal-visibility setting, update the generated local types, and expose it only in the tenant-administrator loyalty configuration UI. Then add scoped config and ledger reads to the existing Portal bootstrap `Promise.all`. Derive balance server-side only when `ativo && portal_exibir_fidelidade`, expose only description, points, type, and timestamp for the newest ten ledger entries, and never return ids or metadata from another client.

- [ ] **Step 4: Add typed UI and accessible empty states**

Extend `usePortalData.ts` types, render `FidelidadeClienteCard` after Portal statistics, and keep it absent when unavailable so the public Portal does not reveal whether the program is inactive or merely hidden. Add an explicit administrator-only configuration control with clear helper text.

- [ ] **Step 5: Verify the task**

Run: `node --test test/portal-loyalty.test.ts test/portal-code.test.ts test/pdv-payment.test.ts && npm run typecheck && npm run check:edge`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261015111500_portal_loyalty_visibility.sql supabase/functions/portal-customer/index.ts src/integrations/supabase/types.ts src/components/configuracoes/ConfiguracoesFidelidade.tsx src/hooks/usePortalData.ts src/components/portal/FidelidadeClienteCard.tsx src/pages/PortalCliente.tsx test/portal-loyalty.test.ts test/pdv-payment.test.ts
git commit -m "feat: show scoped loyalty details in customer portal"
```

## Task 7: Add database performance and security hardening without breaking intended RLS

**Files:**
- Create: `supabase/migrations/20261015113000_security_performance_hardening.sql`
- Modify: `test/multitenancy-migration.test.ts`
- Create: `test/security-hardening.test.ts`
- Create: `ops/production-controls.md`

**Interfaces:**
- Consumes: existing tenant helpers, policies, `audit_events`, and production readiness evidence.
- Produces: documented RLS helper query shapes, measured indexes, protected audit reads, and an operations runbook for Supabase-only settings.

- [ ] **Step 1: Write failing security hardening tests**

Require migration assertions for tenant/date hot-path indexes, `(select auth.uid())` use in targeted RLS policies, safe `search_path` for new functions, and a written disposition for GraphQL exposure, leaked-password protection, `SECURITY DEFINER`, backup/PITR, and rate limiting.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `node --test test/security-hardening.test.ts test/multitenancy-migration.test.ts`

Expected: FAIL because the new migration and operations controls are absent.

- [ ] **Step 3: Implement the additive hardening migration**

Add only indexes confirmed absent by catalog checks. Rewrite targeted policy expressions to wrap stable auth/context calls in `select` without changing tenant, area, or module semantics. Do not revoke execution from existing `SECURITY DEFINER` functions until their caller tests pass.

- [ ] **Step 4: Write the production controls runbook**

Document exact non-secret actions: enable leaked-password protection, decide/disable unused GraphQL exposure, review MFA/session settings, verify backup/PITR restore, configure host CSP/Permissions-Policy, and record no-policy `portal_rate_limits` as an intentional service-role-only table.

- [ ] **Step 5: Verify the task**

Run: `node --test test/security-hardening.test.ts test/multitenancy-migration.test.ts && npm run check:edge`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261015113000_security_performance_hardening.sql test/multitenancy-migration.test.ts test/security-hardening.test.ts ops/production-controls.md
git commit -m "security: harden tenant database access and operations"
```

## Task 8: Make Asaas webhook failures retryable and observable

**Files:**
- Create: `supabase/migrations/20261015116000_webhook_retry.sql`
- Modify: `supabase/functions/asaas-webhook/index.ts`
- Create: `supabase/functions/retry-asaas-webhook/index.ts`
- Create: `test/webhook-retry.test.ts`
- Modify: `test/pdv-payment.test.ts`

**Interfaces:**
- Consumes: `asaas_webhook_events`, deterministic event ids, `reconciliar_pagamento_pdv`, and `ASAAS_WEBHOOK_TOKEN`.
- Produces: `retry-asaas-webhook` action `{ eventId?: string; limit?: number }` for authorized service execution, and event state `pending|processing|processed|failed|dead_letter` with bounded attempts.

- [ ] **Step 1: Write failing retry/idempotency tests**

Cover duplicate event delivery, a transient reconciliation error, retry attempt increment, terminal dead-letter state, and exactly-once invoice/payment mutation after a successful retry.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `node --test test/webhook-retry.test.ts test/pdv-payment.test.ts`

Expected: FAIL because retry state and the function are absent.

- [ ] **Step 3: Extend webhook event state in the migration**

Add nullable `next_attempt_at`, `locked_at`, `last_error_code`, and `dead_lettered_at` fields plus a tenant/status/schedule index. Preserve existing processed events and cap attempts at five.

- [ ] **Step 4: Extract idempotent event processing and add retry function**

Move reusable event processing from `asaas-webhook` into a shared module. The retry function must authenticate a service/admin caller, claim events atomically, use exponential retry times, never call Asaas for an event that is already processed, and log only correlation ids/error codes.

- [ ] **Step 5: Verify the task**

Run: `node --test test/webhook-retry.test.ts test/pdv-payment.test.ts && npm run check:edge`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261015116000_webhook_retry.sql supabase/functions/asaas-webhook supabase/functions/retry-asaas-webhook test/webhook-retry.test.ts test/pdv-payment.test.ts
git commit -m "feat: retry failed Asaas webhooks safely"
```

## Task 9: Add safe SaaS platform administration without automatic billing

**Files:**
- Create: `supabase/migrations/20261015119000_platform_administration.sql`
- Create: `supabase/functions/platform-administration/index.ts`
- Create: `src/hooks/useAdministracaoSaas.ts`
- Create: `src/components/configuracoes/AdministracaoSaas.tsx`
- Create: `src/pages/AdministracaoSaas.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/appRoutes.ts`
- Create: `test/saas-platform.test.ts`

**Interfaces:**
- Consumes: `auth.users`, `tenants`, active tenant memberships, and audit events.
- Produces: `platform_administrators`, `saas_plan_catalog`, `tenant_service_subscriptions`, and a `platform-administration` Edge Function with actions `list_tenants`, `list_plans`, `upsert_plan`, and `set_subscription_status`.

- [ ] **Step 1: Write failing platform administration tests**

Assert that only a row in `platform_administrators` can use the function; tenant admins cannot elevate themselves; `trial`, `active`, `suspended`, and `cancelled` are accepted subscription states; no action calls Asaas or creates a financial charge.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `node --test test/saas-platform.test.ts`

Expected: FAIL because the table, function, route, and UI do not exist.

- [ ] **Step 3: Implement platform tables and least-privilege API**

Create tables with RLS enabled and no direct browser writes. Use a `private.is_platform_admin(_user_id uuid)` helper with safe `search_path`; grant mutations only through the Edge Function after verifying the authenticated caller is a platform admin. Do not seed an administrator from an unverified email or user id. Bootstrap the first platform administrator only through an audited service-role operation after the owner supplies the intended authenticated user id through a secure channel.

- [ ] **Step 4: Implement read-first SaaS administration UI**

Add a Central admin route that remains unavailable to ordinary tenant users. Show company status, plan limits, subscription state, and audit data; use confirmation dialogs for suspension/status changes. Do not show payment or provider fields.

- [ ] **Step 5: Verify the task**

Run: `node --test test/saas-platform.test.ts && npm run typecheck && npm run check:edge`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261015119000_platform_administration.sql supabase/functions/platform-administration src/hooks/useAdministracaoSaas.ts src/components/configuracoes/AdministracaoSaas.tsx src/pages/AdministracaoSaas.tsx src/App.tsx src/lib/appRoutes.ts test/saas-platform.test.ts
git commit -m "feat: add safe SaaS platform administration"
```

## Task 10: Add visual/performance regression coverage and CI quality gates

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `e2e/navigation.spec.ts`
- Create: `e2e/financeiro.spec.ts`
- Create: `e2e/responsive.spec.ts`
- Create: `scripts/check-performance-budget.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `test/commercial-readiness-contract.test.ts`

**Interfaces:**
- Consumes: the local Vite preview, route metadata, unauthenticated login page, and public Portal error states.
- Produces: `npm run test:e2e` and `npm run check:performance` that can run without production credentials.

- [ ] **Step 1: Write failing package/CI contract tests**

Assert that `package.json` exposes `test:e2e` and `check:performance`, CI invokes them after build, and the performance script rejects a production asset above its agreed gzip threshold.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `node --test test/commercial-readiness-contract.test.ts`

Expected: FAIL because the scripts and CI steps do not exist.

- [ ] **Step 3: Add Playwright as a development dependency and configure local test server**

Install only `@playwright/test` as a development dependency. Configure Chromium locally, define deterministic desktop and 390×844 mobile projects, and avoid fixtures containing credentials or real customer data.

- [ ] **Step 4: Implement smoke and visual-layout tests**

Test the login shell, not-found route, public Portal invalid-code state, route metadata redirects through mocked authorization data, and no horizontal overflow at mobile width. Add a finance error-state visual smoke test that never calls the live database.

- [ ] **Step 5: Implement build performance budget**

Parse Vite output manifest/build assets, enforce a documented gzip budget for the main entry and disallow new chunks over the threshold without an allowlist reason. Keep chart/map chunks measured separately.

- [ ] **Step 6: Verify the task**

Run: `npm run test:e2e && npm run check:performance && npm run check`

Expected: PASS locally and in CI.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json playwright.config.ts e2e scripts/check-performance-budget.mjs .github/workflows/ci.yml test/commercial-readiness-contract.test.ts
git commit -m "test: add visual and performance release gates"
```

## Task 11: Preserve fail-closed external integrations and prepare publish evidence

**Files:**
- Modify: `docs/GO_LIVE_CHECKLIST.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/SECURITY.md`
- Create: `ops/release-evidence.example.json`
- Modify: `.gitignore`
- Modify: `test/nfse-adapter.test.ts`
- Modify: `test/production-preflight.test.mjs`

**Interfaces:**
- Consumes: `NFSE_ENABLED`, production preflight evidence, deployed project reference, and Git SHA.
- Produces: a release-evidence template and documented checks that prevent declaring NFS-e, payment providers, email, WhatsApp, or printer bridges operational before independent verification.

- [ ] **Step 1: Write failing documentation/preflight tests**

Require the example evidence to cover migration, Edge Function, frontend, E2E, performance, backups, RLS, payment webhook retry, NFS-e state, and post-deploy smoke checks. Require NFS-e tests to assert a configured-but-missing adapter returns an explicit unavailable response.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `node --test test/nfse-adapter.test.ts test/production-preflight.test.mjs`

Expected: FAIL until the evidence template and expanded documentation exist.

- [ ] **Step 3: Update release documentation and evidence template**

Document the exact publish order: commit and push, CI, staging migration, staging function deploy, authenticated smoke tests, production migration, production function deploy, frontend publish, post-deploy verification, and monitoring window. Add `ops/release-evidence.json` to `.gitignore`; keep the example version safe to commit. Mark each external integration as unavailable until its owner supplies secure homologation evidence.

- [ ] **Step 4: Verify the task**

Run: `node --test test/nfse-adapter.test.ts test/production-preflight.test.mjs && npm run preflight:production -- --help`

Expected: PASS; the preflight help never reads or prints secrets.

- [ ] **Step 5: Commit**

```bash
git add .gitignore docs/GO_LIVE_CHECKLIST.md docs/DEPLOYMENT.md docs/SECURITY.md ops/release-evidence.example.json test/nfse-adapter.test.ts test/production-preflight.test.mjs
git commit -m "docs: gate commercial integrations and publication"
```

## Task 12: Integrate, verify, and publish the validated release

**Files:**
- Modify: `ops/release-evidence.json` (created from the example and intentionally gitignored if it identifies approvers or operational details)
- Verify: all files changed in Tasks 1–11

**Interfaces:**
- Consumes: the final Git SHA, real environment configuration held outside Git, migration history, CI results, and smoke-test evidence.
- Produces: a tagged/published release whose frontend, migrations, and Edge Functions correspond to the same commit.

- [ ] **Step 1: Run the full local verification suite**

Run: `npm run check && npm run test:e2e && npm run check:performance`

Expected: PASS with no new lint warnings and no uncommitted production code.

- [ ] **Step 2: Run migration and Edge Function checks in staging**

Apply migrations only to the configured staging project, deploy Edge Functions from the final SHA, and execute multi-tenant, financial, loyalty, Portal, and webhook retry smoke tests with non-production data.

- [ ] **Step 3: Complete the release evidence using real results**

Set `releaseCommit`, `migrationVersion`, `edgeFunctionCommit`, and `frontendCommit` to the exact final SHA. Record only evidence descriptions and result URLs/identifiers; never store credentials.

- [ ] **Step 4: Run production preflight without exposing configuration**

Run: `npm run preflight:production -- --frontend-env <secure-path> --functions-env <secure-path> --release-evidence ops/release-evidence.json`

Expected: `CONFIGURAÇÃO E EVIDÊNCIAS APROVADAS`.

- [ ] **Step 5: Publish in controlled order**

Deploy the migration, deploy all relevant Edge Functions from the same SHA, publish the frontend, then run authenticated smoke tests. Stop immediately if tenant isolation, finance aggregation, loyalty, payment reconciliation, or audit access differs from staging.

- [ ] **Step 6: Verify post-publication and commit release metadata**

Run the full smoke suite, monitor errors and query latency, update non-sensitive release documentation, and commit any safe release metadata.

```bash
git add docs ops
git commit -m "docs: record commercial release evidence"
```

## Self-Review

- **Spec coverage:** Tasks 2–3 cover finance/performance; Task 4 covers navigation, authorization, and audit; Task 5 covers browser printing; Task 6 covers loyalty and Portal; Tasks 7–8 cover RLS, security, and webhook recovery; Task 9 covers SaaS administration; Tasks 10–12 cover quality, external fail-closed posture, and controlled publication.
- **Step scan:** Every task begins with a failing contract/test, has one explicit implementation unit, verifies the narrow scope, and ends with a focused commit.
- **Type consistency:** `APP_ROUTES`, `useAccessibleWorkspaces`, `consultar_dashboard_financeiro`, `PortalBootstrap.loyalty`, and the platform-admin tables/functions are defined before the tasks that consume them.
- **Review Focus:** The five user-impacting boundary conditions in the Review Focus section each have an owning task and explicit test step.
- **Proportion:** The plan defines interfaces, test evidence, and boundaries rather than embedding implementation bodies; provider activation remains outside the code path until independently homologated.
