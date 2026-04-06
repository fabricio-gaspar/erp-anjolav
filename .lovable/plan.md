

# Tornar todas as telas responsivas

## Diagnostico

Analisei todas as 20+ paginas do sistema. A maioria ja usa grids responsivos (`grid-cols-1 md:grid-cols-X`), porem existem problemas recorrentes:

### Problemas encontrados

1. **Tabelas sem scroll horizontal** — Fornecedores, Estoque, ContasPagar, DashboardCobrancas tem `<Table>` sem `overflow-x-auto`, causando corte/overflow em mobile
2. **Filtros com largura fixa** — `w-[200px]`, `w-[180px]`, `w-[140px]` em Selects que nao se adaptam em mobile
3. **Headers com botoes que quebram** — Fornecedores e Estoque tem `flex items-center justify-between` sem `flex-wrap`, empurrando botoes para fora
4. **Paginas sem content-panel** — Fornecedores, Estoque, ContasPagar, DashboardFinanceiro, DashboardCobrancas, HistoricoCaixas usam `Card` direto sem o wrapper `content-panel` padrao
5. **KPI cards com icones grandes** — ContasPagar tem `w-12 h-12` nos icones dos cards de resumo, maior que o padrao `w-9 h-9`

---

## Plano de correcoes

### 1. `src/pages/Fornecedores.tsx`
- Header: adicionar `flex-wrap` e botao `w-full sm:w-auto`
- Filtros: trocar `w-[200px]` e `w-[140px]` por `w-full sm:w-[200px]` e `w-full sm:w-[140px]`
- Tabela: envolver em `<div className="overflow-x-auto">` com `min-w-[700px]` na Table
- Wrapper: envolver conteudo em `content-panel`

### 2. `src/pages/Estoque.tsx`
- Header: adicionar `flex-wrap` e botoes responsivos
- Filtros: trocar `w-[180px]` por `w-full sm:w-[180px]`
- Tabela: envolver em `overflow-x-auto` com `min-w-[700px]`
- Wrapper: envolver em `content-panel`

### 3. `src/pages/ContasPagar.tsx`
- Filtros: trocar `w-[140px]` por `w-full sm:w-[140px]`; trocar `max-w-xl` por `min-w-0`
- Tabela: envolver em `overflow-x-auto` com `min-w-[600px]`
- KPI icons: reduzir de `w-12 h-12` / `w-6 h-6` para `w-9 h-9` / `w-4 h-4`
- KPI grid: usar `grid-cols-2` em vez de `grid-cols-3`

### 4. `src/pages/DashboardFinanceiro.tsx`
- Envolver conteudo principal em `content-panel`
- Tabela de movimentacoes vencidas: adicionar `overflow-x-auto`

### 5. `src/pages/DashboardCobrancas.tsx`
- Envolver em `content-panel`
- Charts: garantir `ResponsiveContainer` com `width="100%"` (ja tem)
- Header duplicado: remover h1 redundante (ja tem title no AppLayout)

### 6. `src/pages/HistoricoCaixas.tsx`
- Envolver em `content-panel`

### 7. `src/pages/Agenda.tsx`
- Barra de filtros: ja tem `flex-wrap` — OK
- Adicionar `overflow-x-auto` no grid de dias da semana para scroll em mobile

---

## Resumo de arquivos

| Arquivo | Mudancas |
|---------|----------|
| `src/pages/Fornecedores.tsx` | content-panel, overflow-x-auto tabela, filtros responsivos, header flex-wrap |
| `src/pages/Estoque.tsx` | content-panel, overflow-x-auto tabela, filtros responsivos, header flex-wrap |
| `src/pages/ContasPagar.tsx` | overflow-x-auto tabela, filtros responsivos, KPI icons menores |
| `src/pages/DashboardFinanceiro.tsx` | content-panel wrapper |
| `src/pages/DashboardCobrancas.tsx` | content-panel wrapper, remover header duplicado |
| `src/pages/HistoricoCaixas.tsx` | content-panel wrapper |
| `src/pages/Agenda.tsx` | overflow-x-auto no grid calendario |

Nenhuma migracao de banco necessaria.

