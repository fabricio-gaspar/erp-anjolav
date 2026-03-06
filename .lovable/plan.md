

# Dashboard mais elegante e compacta

## Mudancas

### 1. KPI Cards menores (CSS — `src/index.css`)
- Reduzir padding de `p-5` para `p-3`
- Valor de `text-4xl` para `text-2xl`
- Icone de `w-12 h-12` / `w-6 h-6` para `w-9 h-9` / `w-4 h-4`
- Titulo `text-xs` para `text-[10px]`

### 2. Reducao geral de espacamento (Dashboard.tsx)
- `space-y-4` para `space-y-3`
- Gap dos KPIs de `gap-3 sm:gap-4` para `gap-2 sm:gap-3`
- Gaps dos grids financeiros e alertas de `gap-4 sm:gap-5` para `gap-3 sm:gap-4`

### 3. Section Headers mais compactos (CSS)
- Reduzir `mb-5` para `mb-3`
- Icone de `w-8 h-8` para `w-6 h-6`

### 4. Content Panel mais fino
- Padding de `p-4` para `p-3`

### 5. Alertas Operacionais mais compactos
- Os 3 cards (ContasVencendo, EstoqueBaixo, ContratosVencendo) usam `Card` do shadcn com padding grande — reduzir `CardHeader` e `CardContent` padding via className

## Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `src/index.css` | KPI card, section header, content-panel mais compactos |
| `src/pages/Dashboard.tsx` | Espacamento reduzido nos grids |
| `src/components/dashboard/KPICard.tsx` | Icone menor inline |

