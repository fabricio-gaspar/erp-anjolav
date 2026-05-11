
# Auditoria & Plano de Ação — ERP AnjoLav

Auditoria do sistema (UX/UI, navegação, arquitetura, segurança e performance) com plano de execução em 3 ondas. **Onda 1 (Críticos)** é o que será aplicado automaticamente após sua aprovação. Ondas 2 e 3 ficam como roadmap para você priorizar depois.

---

## 🔍 Resumo da Auditoria

### ✅ O que está correto
- Stack moderna e consistente (React 18, Vite, Tailwind, Shadcn, React Query, Supabase).
- Design system bem definido em `index.css` com tokens HSL semânticos.
- `refetchOnMount: "always"` evita dessincronização entre telas.
- RLS habilitado em todas as tabelas; permissões granulares por módulo (`modulo_permissoes`) com bypass para `ADMINISTRADOR`.
- Login por username, edge function `manage-employee` para admin, separação clara de cargos.
- Dashboard adaptativo por permissão (cards são ocultados conforme acesso).
- Padrão de nomenclatura coerente (PDV Industrial vs PDV Loja, ID1 vs ID2).

### ⚠️ O que está errado / precisa ajuste

**Críticos (Onda 1 — vamos aplicar):**
1. **152 issues no linter do Supabase** — predominância de policies `USING (true)` em UPDATE/DELETE/INSERT. Risco de escalonamento de privilégio: qualquer usuário autenticado pode alterar/remover dados de outros.
2. **Links quebrados no Dashboard:** `onViewAll` aponta para `/faturamento` (rota antiga, redireciona) e `/contas-pagar` (rota inexistente, vai pra 404). Deve ir para `/lancamentos?tab=faturas` e `/contas?tab=pagar`.
3. **`NavGroup` ignora `defaultOpen`** — usa `useState(true)` fixo. Todos os grupos abrem sempre, perdendo memória de navegação.
4. **Sidebar com cores hardcoded** (`text-slate-600`, `bg-white`, `border-slate-200`) — viola a regra do design system (uso obrigatório de tokens semânticos). Quebra o tema escuro e a personalização por cor primária.
5. **Falta proteção HIBP** (vazamento de senha) na auth — recomendado pela documentação Lovable.

**Estruturais (Onda 2):**
6. **Sidebar muito longa** (Comercial, Operacional, Financeiro, Relatórios + soltos) — 14 itens sem hierarquia clara. Falta agrupamento "RH" (Equipe, Folha, Férias) e "Logística" separada de Operacional.
7. **Inconsistência de nomenclatura:** "Abrir Retirada" no menu mas a página chama "Ordens de Serviço". "Agenda Pessoal" solta no nível raiz.
8. **Dashboard com 7 seções verticais** sem hierarquia visual — usuário precisa rolar muito. Ideal: tabs ou layout em grid mais denso.
9. **AppHeader sem breadcrumb nem busca global** — comum em ERPs grandes (Omie, Bling, Tiny).
10. **Sem indicador de notificações** no header (apesar de ter sino em `lucide-react` importado).

**Polish (Onda 3):**
11. Sem estado vazio padronizado nas listas (clientes, produtos, OS).
12. Sem skeleton loaders consistentes — alguns lugares usam `Loader2` spinner, outros nada.
13. Sem atalhos de teclado globais (`Cmd+K` para busca, `g+d` para dashboard).
14. Modais usam tamanhos diferentes — padronizar com `wide-form-dialog` (já documentado em memory).
15. Tipografia heterogênea — coexistem `text-sm` / `text-[11px]` / `text-xs` em contextos similares.

---

## 🎯 Onda 1 — Correções Críticas (Implementação imediata)

### 1.1 Corrigir links quebrados do Dashboard
Arquivo: `src/pages/Dashboard.tsx`
- `onViewAll` de "Contas a Receber": `/faturamento` → `/lancamentos?tab=faturas`
- `onViewAll` de "Contas a Pagar": `/contas-pagar` → `/contas?tab=pagar`

### 1.2 Corrigir `NavGroup` para respeitar estado
Arquivo: `src/components/layout/AppSidebar.tsx`
- `useState(true)` → `useState(defaultOpen || hasActiveChild)`
- Persistir estado aberto/fechado em `localStorage` por grupo.

### 1.3 Substituir cores hardcoded por tokens
Arquivo: `src/components/layout/AppSidebar.tsx` e `AppLayout.tsx`
- `text-slate-600` → `text-muted-foreground`
- `bg-white` → `bg-background` ou `bg-sidebar`
- `border-slate-200` → `border-border` ou `border-sidebar-border`
- `text-slate-800` → `text-foreground`

### 1.4 Endurecer RLS policies permissivas
Migration nova: substituir `USING (true)` em UPDATE/DELETE/INSERT por checagens reais:
- Tabelas de RH (`funcionarios`, `folha_pagamento`, `folha_beneficios`): exigir `has_role(auth.uid(), 'admin')`.
- Tabelas operacionais (`ordens_servico`, `lancamentos`, `caixa`): exigir `auth.uid() IS NOT NULL` no mínimo, e quando aplicável vincular ao operador criador.
- Vou rodar o linter completo e priorizar os top 30 (RH + financeiro + fiscal).

### 1.5 Ativar proteção HIBP
Via `configure_auth` com `password_hibp_enabled: true`.

### 1.6 Habilitar busca global Cmd+K
Componente novo `GlobalSearch.tsx` no `AppHeader`:
- Atalho `Cmd/Ctrl+K`
- Indexa: clientes, OS, produtos, fornecedores, lançamentos
- Usa `cmdk` (já vem com Shadcn `Command`)

### 1.7 Reorganização leve da sidebar
- Mover "Agenda Pessoal" para dentro do grupo "Operacional"
- Criar grupo "RH" extraído de Configurações (link rápido para `Equipe`, `Folha`, `Férias`)
- Renomear "Abrir Retirada" → "Ordens de Serviço" (consistência com a tela)

---

## 📐 Onda 2 — Melhorias Estruturais (Roadmap, não aplicar agora)

| # | Melhoria | Impacto |
|---|----------|---------|
| 1 | Dashboard com tabs (Operacional / Financeiro / RH) | Alto |
| 2 | Breadcrumb no AppHeader | Médio |
| 3 | Centro de notificações (sino com badge) | Alto |
| 4 | Refatorar sidebar com Shadcn `Sidebar` oficial | Médio |
| 5 | Dark mode completo (já tem tokens, falta toggle no header) | Médio |
| 6 | Padronizar todos os modais com classe `wide-form-dialog` | Baixo |

## ✨ Onda 3 — Polish & Escalabilidade (Backlog)

| # | Melhoria | Impacto |
|---|----------|---------|
| 1 | Skeleton loaders consistentes | Médio |
| 2 | Estados vazios ilustrados | Médio |
| 3 | Atalhos de teclado globais | Baixo |
| 4 | Auditoria de queries N+1 (várias listas fazem joins pesados) | Alto |
| 5 | Paginação server-side em listas >1000 registros | Alto |
| 6 | Testes E2E de fluxos críticos (PDV, Lançamento, Folha) | Alto |

---

## 📊 Comparativo com sistemas grandes (Omie / Bling / Tiny)

```text
                        AnjoLav   Omie/Bling
Sidebar agrupada          ✅        ✅
Busca global Cmd+K        ❌        ✅   → Onda 1
Breadcrumb                ❌        ✅   → Onda 2
Centro notificações       ❌        ✅   → Onda 2
Dashboard customizável    ❌        ✅   → Onda 3
Dark mode                 ⚠️        ✅   → Onda 2
Tour onboarding           ❌        ✅   → Onda 3
Tema personalizável       ✅        ✅
RLS por papel             ⚠️        ✅   → Onda 1
```

---

## 🧰 Detalhes Técnicos da Onda 1

**Arquivos a editar:**
- `src/pages/Dashboard.tsx` — fix navigate paths
- `src/components/layout/AppSidebar.tsx` — tokens semânticos + NavGroup state + reorg
- `src/components/layout/AppHeader.tsx` — adicionar `<GlobalSearch/>`
- `src/components/layout/GlobalSearch.tsx` — **novo**, usando Shadcn `Command`
- `src/hooks/useGlobalSearch.ts` — **novo**, agrega clientes/OS/produtos
- Nova migration SQL — endurece policies das tabelas críticas
- Chamada `configure_auth` — HIBP on

**Risco:** Endurecer RLS pode quebrar fluxos atuais que dependem de policies abertas. Faremos em modo aditivo: nova policy com checagem real + manter a antiga temporariamente comentada na migration para rollback rápido.

**Validação após implementar:**
- Login como `operador` e tentar editar funcionário → deve falhar.
- Cmd+K abre busca; navega para resultado.
- Sidebar mantém grupo aberto após reload.
- Links do Dashboard levam às páginas corretas.
- `supabase--linter` reduz issues de ~152 para <30.

---

Após sua aprovação, implemento a **Onda 1** completa numa única passada. Ondas 2 e 3 ficam para você decidir quando avançar.
