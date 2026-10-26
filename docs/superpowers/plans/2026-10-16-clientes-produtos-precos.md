# Clientes, Produtos e Preços por Cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o fluxo de preços por cliente, adicionar modo de tabela padrão/personalizada, abrir clientes pelo nome e persistir a classificação de porte dos produtos.

**Architecture:** Reutilizar `produtos.preco` como fonte padrão e `precos_especiais` como override personalizado. A configuração do modo será um campo validado em `clientes`; a correção de consulta usará a FK simples nomeada para evitar ambiguidade causada pelas FKs compostas de tenancy. A UI continuará usando React Query, `useClientes`, `useProdutos` e os componentes existentes.

**Tech Stack:** React 18, TypeScript, React Query, Supabase/Postgres/RLS, Radix UI, Node test runner e Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-clientes-produtos-precos.md`

## Global Constraints

- Não excluir preços, clientes ou produtos existentes.
- Manter `tenant_id`, RLS, RBAC e isolamento por empresa/área.
- Não duplicar tabela de produtos, tabela de preços ou serviço de persistência.
- Usar `porte` nullable para não inventar classificação de registros antigos.
- Exibir falhas de consulta/gravação com mensagem e possibilidade de tentar novamente.
- Não fazer deploy durante a implementação local; publicar somente após validação e autorização já concedida para esta sequência.

## Review Focus

- Preço existente oculto por relação Supabase ambígua: o hook deve retornar a linha e a UI deve exibir o erro quando a consulta falhar; coberto na Task 2.
- Conflito de preço já existente: adicionar o mesmo produto deve atualizar a linha única, não criar duplicata; coberto na Task 2.
- Cliente sem preço personalizado: modo padrão deve mostrar preço real de `produtos.preco`; coberto na Task 3.
- Produto antigo sem porte: o formulário deve permitir seleção sem forçar uma classificação falsa; coberto na Task 4.
- Usuário fora do escopo: filtros e mutações devem continuar rejeitando áreas/tenants incompatíveis; coberto na Task 2 e na validação E2E da Task 5.

---

### Task 1: Migration and Type Contracts

**Files:**
- Create: `supabase/migrations/20261016120000_client_pricing_and_product_size.sql`
- Modify: `src/integrations/supabase/types.ts: produto and cliente Row/Insert/Update definitions`
- Modify: `src/hooks/useClientes.ts: Cliente interface and ClienteInsert/Update`
- Modify: `src/hooks/useProdutos.ts: Produto interface and insert/update types`
- Create: `test/client-products-contract.test.ts`

**Interfaces:**
- Produces `clientes.tabela_preco_tipo: "padrao" | "personalizada"` with default `padrao`.
- Produces `produtos.porte: "pequeno" | "medio" | "grande" | null`.
- Keeps existing product/client row contracts compatible with `select("*")`.

- [ ] **Step 1: Write the failing contract tests**

  Add assertions that the migration adds `tabela_preco_tipo` with the two allowed values and default, adds nullable `porte` with the three allowed values, and that the TypeScript contracts expose both fields.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run `node --test test/client-products-contract.test.ts`.
  Expected: FAIL because the migration, fields and type properties do not exist yet.

- [ ] **Step 3: Implement the migration**

  Create `20261016120000_client_pricing_and_product_size.sql` with idempotent `ADD COLUMN IF NOT EXISTS` statements, a check constraint for each field, default `padrao` for existing/new clients, and a backfill that changes only clients with an existing row in `precos_especiais` to `personalizada`. Do not change RLS or remove rows.

- [ ] **Step 4: Update TypeScript contracts**

  Add the union/nullability to `src/integrations/supabase/types.ts`, `Cliente`, `Produto`, `ProdutoInsert` and `ProdutoUpdate`. Keep existing `tenant_id` omission behavior in application interfaces unless generated types already expose it.

- [ ] **Step 5: Run the focused test and verify it passes**

  Run `node --test test/client-products-contract.test.ts`.
  Expected: PASS.

- [ ] **Step 6: Commit the schema contract**

  Run `git add supabase/migrations/20261016120000_client_pricing_and_product_size.sql src/integrations/supabase/types.ts src/hooks/useClientes.ts src/hooks/useProdutos.ts test/client-products-contract.test.ts` and commit with `feat: add client price modes and product size contract`.

### Task 2: Price Hook and Persistence Reliability

**Files:**
- Modify: `src/hooks/useProdutos.ts: usePrecosEspeciais`
- Create or modify: `test/client-price-hook.test.ts`

**Interfaces:**
- `usePrecosEspeciais(clienteId)` returns `precos`, `isLoading`, `isError`, `error`, `upsertPrecoEspecial`, `deletePrecoEspecial` and `copyPrecosEspeciais`.
- `upsertPrecoEspecial` writes by the existing unique key `(cliente_id, produto_id)` using Supabase `upsert` and preserves the existing payload shape.

- [ ] **Step 1: Write failing hook contract tests**

  Assert that the source uses `produto:produtos!fk_precos_especiais_produto(...)`, returns query error state, uses `onConflict: "cliente_id,produto_id"`, and does not silently discard the initial lookup error.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run `node --test test/client-price-hook.test.ts`.
  Expected: FAIL because the hook currently embeds an ambiguous relation, does not expose query errors and performs a read-then-write flow.

- [ ] **Step 3: Fix the relation and error state**

  Change the embedded product relation to the named simple FK `fk_precos_especiais_produto`. Return `isError` and `error` from the query. Keep the query enabled only for a valid client ID.

- [ ] **Step 4: Replace the mutation with an atomic upsert**

  Implement `supabase.from("precos_especiais").upsert(preco, { onConflict: "cliente_id,produto_id" }).select().single()`. Preserve tenant assignment through the database default/trigger and preserve existing RLS checks. Map duplicate/RLS/connection failures to clear Portuguese toast messages without hiding the original error from the mutation.

- [ ] **Step 5: Run the focused test and verify it passes**

  Run `node --test test/client-price-hook.test.ts`.
  Expected: PASS.

- [ ] **Step 6: Commit the persistence fix**

  Run `git add src/hooks/useProdutos.ts test/client-price-hook.test.ts` and commit with `fix: persist client prices through tenant-safe upsert`.

### Task 3: Standard and Personalized Client Price UI

**Files:**
- Modify: `src/components/clientes/ClienteTabelaPrecos.tsx`
- Modify: `src/hooks/useClientes.ts: update invalidation/error handling if required by the mode selector`
- Modify: `test/residential-panel.test.ts`

**Interfaces:**
- `ClienteTabelaPrecos` uses `clienteAtual.tabela_preco_tipo` and the existing `updateCliente` mutation.
- Standard mode renders compatible active products with `preco` and no special-price writes.
- Personalized mode retains add/edit/import/remove actions over `precos_especiais`.

- [ ] **Step 1: Add failing UI contract tests**

  Assert the component contains the `padrao`/`personalizada` mode controls, renders the standard product price source, exposes a retry/error state from `usePrecosEspeciais`, and retains the product-cadastro route for the plus button.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run `node --test test/residential-panel.test.ts`.
  Expected: FAIL for the new table mode and error-state assertions.

- [ ] **Step 3: Implement the mode selector and persistence**

  Add a controlled selector tied to `clienteAtual.tabela_preco_tipo`; call `updateCliente.mutate({ id: clienteId, tabela_preco_tipo: value })`; invalidate the client query through the existing mutation and show the saving state.

- [ ] **Step 4: Implement the two table views**

  In `padrao`, derive rows from active compatible products and show `produto.preco`. In `personalizada`, use `precosLocais`, keep the existing controls, show a clear empty state, and include “Tentar novamente” when the price query errors. Do not make standard mode create special rows implicitly.

- [ ] **Step 5: Run the focused test and verify it passes**

  Run `node --test test/residential-panel.test.ts`.
  Expected: PASS.

- [ ] **Step 6: Commit the price UI**

  Run `git add src/components/clientes/ClienteTabelaPrecos.tsx src/hooks/useClientes.ts test/residential-panel.test.ts` and commit with `feat: support standard and personalized client pricing`.

### Task 4: Client Navigation and Product Size Field

**Files:**
- Modify: `src/pages/Clientes.tsx: client name cell`
- Modify: `src/components/produtos/ProdutoForm.tsx: ProdutoFormData and form field`
- Modify: `src/pages/Produtos.tsx: defaults, submit, edit, duplicate and CSV export`
- Modify: `src/components/produtos/ProdutoCard.tsx: product metadata`
- Modify: `test/residential-panel.test.ts`

**Interfaces:**
- The client name control calls the existing `handleEditCliente(cliente.id)` and does not create a new route.
- `ProdutoFormData.porte` is a string with empty value allowed for legacy/unspecified products.
- Product create/update payloads include `porte: formData.porte || null`.

- [ ] **Step 1: Add failing UI contract tests**

  Assert the client name is an interactive accessible control wired to `handleEditCliente`, the product form includes `Pequeno`, `Médio` and `Grande`, and create/edit/duplicate/export paths include `porte`.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run `node --test test/residential-panel.test.ts`.
  Expected: FAIL for the new navigation and product-size assertions.

- [ ] **Step 3: Make the client name clickable**

  Replace the plain name span with a keyboard-accessible button styled as a link/name, preserving the existing layout and calling `handleEditCliente` on activation. Keep the action menu unchanged.

- [ ] **Step 4: Add the porte field to the product form**

  Add `porte` to `ProdutoFormData`, defaults, edit and duplicate state, submit payload and CSV headers/rows. Use a Radix `Select` with values `pequeno`, `medio`, `grande`; show `Não informado` only as the empty/legacy state. Display the selected label in `ProdutoCard` without changing delete/edit behavior.

- [ ] **Step 5: Run the focused test and verify it passes**

  Run `node --test test/residential-panel.test.ts`.
  Expected: PASS.

- [ ] **Step 6: Commit navigation and product classification**

  Run `git add src/pages/Clientes.tsx src/components/produtos/ProdutoForm.tsx src/pages/Produtos.tsx src/components/produtos/ProdutoCard.tsx test/residential-panel.test.ts` and commit with `feat: link clients and classify products by size`.

### Task 5: Full Verification and Browser E2E

**Files:**
- Create: `e2e/client-products.spec.ts`
- Modify: `e2e/support.ts` only if the existing Supabase route fixtures need the new column/requests.

**Interfaces:**
- E2E fixtures provide one residential client, one active compatible product, an empty personalized price list, and successful client/product/price mutations without bypassing UI authorization checks.

- [ ] **Step 1: Write the failing E2E scenarios**

  Add scenarios for: opening a client by clicking its name; switching between standard and personalized prices; saving an override and seeing it in the personalized table; selecting a product porte and saving; and an error response that shows retryable feedback instead of an empty success state.

- [ ] **Step 2: Run the focused E2E suite and verify it fails**

  Run `npm run test:e2e -- e2e/client-products.spec.ts`.
  Expected: FAIL until the UI and fixtures are implemented.

- [ ] **Step 3: Complete fixture wiring without production writes**

  Extend only the local route fixtures needed for the new columns and Supabase requests. Do not add fake production data or relax RLS in the application.

- [ ] **Step 4: Run the focused E2E suite and verify it passes**

  Run `npm run test:e2e -- e2e/client-products.spec.ts`.
  Expected: PASS in desktop and mobile projects.

- [ ] **Step 5: Run the repository checks**

  Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run check:edge`, and `npm run build`.
  Expected: all commands exit successfully.

- [ ] **Step 6: Inspect the diff and commit verification artifacts**

  Run `git diff --check`, `git status --short`, and review the changed-file list. Commit the E2E test and any fixture-only changes with `test: cover client pricing and product classification flows`.

## Self-review

- Spec coverage: schema fields and backfill are Task 1; ambiguous relation and atomic persistence are Task 2; price modes are Task 3; client navigation and porte are Task 4; required validation is Task 5.
- Type consistency: `Cliente.tabela_preco_tipo` is consumed by Task 3; `Produto.porte` is produced by Task 1 and consumed by Task 4; `usePrecosEspeciais` error fields are consumed by Task 3.
- Security: no task changes RLS policy definitions; all writes remain through existing Supabase mutations and server-side tenant checks.
- Regression coverage: existing residential-panel assertions remain, industrial behavior is not routed through a new component, and the E2E matrix includes desktop/mobile.
- Proportion: the plan uses five independent reviewable tasks and no new dependency or duplicate domain model.
