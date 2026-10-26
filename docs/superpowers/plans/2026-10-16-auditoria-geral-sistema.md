# Auditoria Geral do Sistema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auditar Clientes Industriais, módulos, fluxos, segurança, integrações e relatórios com evidências locais e read-only do Supabase, corrigindo somente falhas comprovadas e registrando tudo em `AUDITORIA_GERAL_SISTEMA.md`.

**Architecture:** A investigação em camadas separará interface/rotas, hooks/consultas, Edge Functions, banco/RLS e dados reais. A correção P0 será mínima e orientada por teste; nenhuma restauração, migração destrutiva, concessão de privilégio ou publicação será executada.

**Tech Stack:** React + TypeScript + Vite, TanStack Query, Supabase JS, Postgres/RLS, Supabase Edge Functions em TypeScript/Deno, Node test runner e Playwright/CUA quando aplicável.

**Spec:** `C:\Users\anjol\.codex\attachments\0f4d8128-87bf-4d29-8a7f-0c674141be87\Texto colado.txt`

## Global Constraints

- Priorizar P0: investigar e restaurar a visibilidade de Clientes Industriais sem criar ou sobrescrever dados.
- Consultas no Supabase inicialmente somente leitura; sem deploy, migração destrutiva, restauração de backup ou mudança de privilégios.
- Preservar RLS, RBAC, isolamento por empresa, empresa ativa e escopo de dados.
- Não declarar validado aquilo que não foi efetivamente testado; registrar contagens reais quando disponíveis.
- Produzir `AUDITORIA_GERAL_SISTEMA.md` com evidências, severidade, correções, testes e pendências.

## Review Focus

- Cliente existente oculto por `tenant_id`, `ativo`, classificação, paginação ou empresa ativa — validar consulta e contagens reais.
- Consulta de cliente com relacionamento ambíguo ou filtro divergente entre industrial/residencial — validar contra FKs e hooks.
- RLS permissiva ou política duplicada que permita vazamento entre empresas — comparar migration, políticas atuais e advisors.
- Indicador exibido como zero quando a fonte falhou — verificar estados de erro/vazio/loading e origem do total.
- Integração assíncrona sem timeout, retry ou estado terminal — conferir Edge Functions, hooks e logs sem disparar efeitos externos.

### Task 1: Baseline e evidência P0 de Clientes Industriais

**Files:**
- Read: `src/pages/Clientes.tsx`, `src/hooks/*Cliente*`, `src/components/clientes/*`, `src/App.tsx`
- Read: `supabase/migrations/*`, `src/integrations/supabase/types.ts`
- Create: `AUDITORIA_GERAL_SISTEMA.md`

- [ ] Registrar branch, HEAD, status e inventário inicial.
- [ ] Mapear rota, hook, tabelas, filtros, paginação e contexto de empresa.
- [ ] Consultar Supabase somente leitura para contagem total, contagem por tenant/status/classificação e vínculos do usuário Fabricio.
- [ ] Reproduzir a tela Clientes Industriais com evidência visual/DOM quando a sessão disponível permitir.
- [ ] Fixar a causa raiz, distinguindo dado excluído, dado arquivado, RLS, filtro ou falha de UI.

### Task 2: Auditoria de módulos, integrações e fluxos

**Files:**
- Read: `src/App.tsx`, `src/components/layout/*`, `src/hooks/*`, `src/pages/*`, `supabase/functions/*`, `supabase/migrations/*`
- Modify: somente arquivos necessários para correções comprovadas
- Test: testes focados existentes ou novos testes de regressão

- [ ] Inventariar áreas, rotas, telas, hooks, tabelas e Edge Functions.
- [ ] Mapear Cadastro → Classificação → Operação → Produção → Faturamento → Financeiro → Indicadores → Relatórios conforme implementado.
- [ ] Classificar cada módulo como Validado, Corrigido e validado, Com problema identificado ou Não validado.
- [ ] Auditar duplicidades, referências quebradas e dependências sem alterar a navegação por preferência.

### Task 3: Segurança, RBAC/RLS e relatórios

**Files:**
- Read: `supabase/functions/_shared/auth.ts`, `supabase/config.toml`, políticas/migrations, hooks de indicadores e relatórios
- Test: `npm test`, `npm run check:edge`, testes focados de autorização/consultas

- [ ] Conferir autenticação, empresa ativa, memberships, roles, claims e permissões do Full Master.
- [ ] Conferir RLS habilitada, políticas efetivas, funções SECURITY DEFINER e advisors de segurança/performance.
- [ ] Reconciliar indicadores e relatórios com tabelas de origem, filtros de empresa/período e estado de dado indisponível.
- [ ] Registrar achados sem normalizar avisos de segurança como sucesso.

### Task 4: Correções mínimas orientadas por testes

**Files:**
- Modify: somente os arquivos que a investigação apontar
- Test: regressão nova ou atualizada antes da implementação, depois suite completa

- [ ] Para cada falha corrigível, escrever teste RED que reproduza a causa.
- [ ] Implementar a menor correção compatível com a arquitetura e manter RLS/RBAC.
- [ ] Executar testes focados e suite completa; investigar qualquer falha nova antes de prosseguir.

### Task 5: Relatório final e verificação

**Files:**
- Modify: `AUDITORIA_GERAL_SISTEMA.md`
- Modify: plan/ledger somente como registro de execução

- [ ] Documentar contagens de clientes encontrados/exibidos, inventário, mapa de dependências, achados por severidade, correções, arquivos, testes e pendências.
- [ ] Incluir consultas, tabelas e caminhos verificáveis sem expor tokens, cookies ou dados sensíveis desnecessários.
- [ ] Confirmar `git diff --check`, typecheck, lint, build e testes relevantes.
- [ ] Registrar explicitamente limites de validação, inclusive ausência de sessão comum ou de dados reais quando aplicável.
