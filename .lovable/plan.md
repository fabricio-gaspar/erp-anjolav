

## Plano: Dashboard mais elegante e compacto

### Objetivo
Reduzir espaçamento, compactar componentes e tornar o dashboard visualmente mais limpo e elegante, ocupando menos espaço vertical.

### Alterações

#### 1. `src/pages/Dashboard.tsx` — Layout principal
- Reduzir `space-y-3` para `space-y-2`
- Compactar seção de KPIs: usar grid `grid-cols-4` fixo em desktop, remover wrapper `content-panel` dos painéis e usar diretamente os cards para eliminar padding duplo
- Fundir seções "Visão Financeira" e "Alertas Operacionais" em uma única linha de grid para reduzir separações
- Agenda do Dia: colocar retiradas e entregas lado a lado em cards menores

#### 2. `src/index.css` — Classes base
- `.content-panel`: reduzir padding de `p-2.5 sm:p-3` para `p-2`
- `.section-header`: reduzir `mb-3` para `mb-1.5`, ícone menor (`w-5 h-5`)
- `.kpi-card`: reduzir padding para `p-2`, valor de `text-lg sm:text-2xl` para `text-base sm:text-xl`
- `.kpi-card-icon`: reduzir de `w-7 h-7 sm:w-9 sm:h-9` para `w-6 h-6 sm:w-7 sm:h-7`
- `.finance-card`: reduzir padding para `p-2.5 sm:p-3`

#### 3. `src/components/dashboard/FinanceCard.tsx`
- Reduzir ícone header de `w-10 h-10 sm:w-12 sm:h-12` para `w-8 h-8`
- Reduzir item spacing e padding
- Footer "Ver Todas" mais compacto

#### 4. `src/components/dashboard/ProductionBottleneck.tsx`
- Reduzir padding de `p-5` para `p-3`
- Header e items mais compactos (ícones menores, espaçamento reduzido)
- Recomendação com padding menor

#### 5. `src/components/dashboard/ProcessingSummary.tsx`
- Reduzir padding de `p-5` para `p-3`
- Header mais compacto
- Tabela com fonte menor

#### 6. `src/components/dashboard/DailySchedule.tsx`
- Reduzir padding de `p-5` para `p-3`
- Header e items mais compactos

#### 7. `src/components/dashboard/CaixaResumoCard.tsx`
- Espaçamento interno reduzido

#### 8. `src/components/dashboard/BillingClosuresCard.tsx` e `ContasVencendoCard.tsx`
- Reduzir max-height do ScrollArea para caber melhor

### Resultado
Dashboard com aparência premium e densa — mais informação visível sem scroll, espaçamentos proporcionais e consistentes.

