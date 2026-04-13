

## Plano: Responsividade Global do Sistema

### Problema
As screenshots mostram que em telas menores (~768px) vários módulos apresentam problemas:
1. **PDV Loja (CaixaPDV)**: Header com botões cortados, layout de 2 painéis lado a lado não cabe, cards de produtos cortados
2. **Ordens de Serviço**: Tabela com colunas cortadas (STATUS cortado)
3. **Clientes**: Tabela com texto empilhado, tabs apertadas
4. **Agenda**: Filtros e navegação empilham mal, calendário apertado
5. **Relatório Proximidade**: Tabela cortada

### Solução
Criar responsividade adaptativa usando o hook `useIsMobile()` existente e breakpoints Tailwind, aplicando mudanças em cada módulo problemático.

### Arquivos a alterar

#### 1. `src/pages/CaixaPDV.tsx`
- **Header PDV** (linhas 578-675): Reorganizar em mobile — empilhar verticalmente: info do caixa em cima, botões de ação embaixo em `flex-wrap`
- **Layout 2 painéis** (linha 574): Mudar de `flex` horizontal para `flex-col` em mobile — produtos em cima, carrinho embaixo
- **Carrinho** (linha 783): Mudar de `w-96` fixo para `w-full` em mobile
- **Grid de produtos** (linha 735): Mudar de `grid-cols-3` para `grid-cols-2` em mobile

#### 2. `src/pages/Agenda.tsx`
- **Filtros** (linhas 191-297): Reorganizar em mobile — empilhar filtros e navegação verticalmente, esconder badges de legenda
- **Botões de view** (Semanal/Quinzenal/Mensal): Compactar em mobile
- **Calendário**: Já tem `overflow-x-auto` e `min-w-[700px]` — ok

#### 3. `src/components/ordens/ListaOS.tsx`
- **Tabela** (linha 118): Reduzir `min-w` e esconder colunas menos importantes (Motorista) em mobile via `hidden md:table-cell`

#### 4. `src/pages/Clientes.tsx`
- **Tabs** (linhas de tabs): Tornar scrollável horizontalmente em mobile
- **Tabela**: Esconder colunas secundárias (Telefone) em mobile

#### 5. `src/pages/RelatorioProximidade.tsx`
- **KPI cards**: Ajustar grid para `grid-cols-2` em mobile
- **Tabela**: Esconder colunas secundárias em mobile

#### 6. `src/index.css` (global)
- Adicionar utilitário CSS para tabs scrolláveis em mobile
- Adicionar classe `.content-panel` com padding responsivo

### Detalhes técnicos
- Usar breakpoints Tailwind (`sm:`, `md:`, `lg:`) em vez de JavaScript quando possível
- Usar `useIsMobile()` apenas quando layout precisa mudar estruturalmente (ex: PDV 2 painéis → empilhado)
- Nenhuma tabela nova, nenhuma migration — apenas CSS/layout

### Ordem
1. CaixaPDV (mais crítico — layout quebrado)
2. Agenda (filtros cortados)
3. ListaOS + Clientes (tabelas)
4. RelatorioProximidade (tabela)
5. CSS global (utilitários)

