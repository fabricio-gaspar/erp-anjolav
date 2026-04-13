

## Plano: Redesign do Dashboard no estilo URBN

Baseado nas imagens de referência, o estilo URBN se caracteriza por:
- **Fundo branco puro** (não cinza/azulado como está hoje)
- **Cards com borda fina cinza clara** e sombra muito sutil
- **Sem bordas coloridas laterais** nos KPIs — layout limpo e horizontal
- **KPIs em linha** com mini-gráficos/sparklines ao lado e indicadores de tendência verde/vermelho
- **Tipografia escura e limpa** — números grandes em preto, labels em cinza claro
- **Seções separadas por bordas sutis**, sem section-headers com ícones — apenas títulos em texto bold

### Alterações

#### 1. `src/index.css` — Variáveis e classes base
- Alterar `--background` para branco puro (`0 0% 100%`) e `--card` para `0 0% 100%`
- `.content-panel`: fundo branco, borda `border-slate-200`, sombra `shadow-[0_1px_3px_rgba(0,0,0,0.04)]` — sem border-radius exagerado, usar `rounded-lg`
- `.kpi-card`: remover `border-l-4` (sem borda lateral colorida), usar borda completa fina `border border-slate-200`, padding `p-4`, sombra mínima
- `.kpi-card-title`: texto cinza médio, `text-xs font-medium` (não uppercase bold)
- `.kpi-card-value`: `text-2xl font-bold text-slate-900`
- `.section-header`: simplificar — apenas título bold sem ícone/linha decorativa

#### 2. `src/components/dashboard/KPICard.tsx`
- Redesign: card com borda fina, ícone removido do canto — substituir por mini-sparkline decorativo (SVG estático) no lado direito
- Adicionar indicador de tendência embaixo (`↗ 18 Last week` / `Show more →`) com seta verde/vermelha
- Layout: título em cima, valor grande, tendência embaixo, sparkline à direita

#### 3. `src/pages/Dashboard.tsx`
- KPIs: grid `grid-cols-4` uniforme, sem `content-panel` wrapper — cards diretos
- Remover `SectionHeader` com ícones — usar `<h2>` simples bold
- Seções de gráficos (Financeiro, Produção) com layout mais limpo
- Reduzir o número de wrappers `content-panel` aninhados

#### 4. `src/components/dashboard/FinanceCard.tsx`
- Estilo mais limpo: remover ícone circular do header, usar tipografia direta
- Valores em preto bold, labels em cinza

#### 5. `src/components/dashboard/ProductionBottleneck.tsx` e `ProcessingSummary.tsx`
- Remover badge "Atenção Necessária" chamativo
- Estilo mais clean com bordas finas e cores neutras

#### 6. `src/components/ui/section-header.tsx`
- Adicionar variante `minimal` sem ícone e sem linha decorativa — apenas título

### Resultado
Dashboard com visual premium estilo URBN: fundo branco, cards com bordas finas e sombras sutis, tipografia limpa em preto/cinza, indicadores de tendência coloridos discretos, layout organizado e profissional.

