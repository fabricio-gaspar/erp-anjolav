

## Análise dos Cards do Dashboard

### Cards Funcionando Corretamente ✓
1. **KPICard** — Exibe métricas rápidas (OS em Aberto, Entregas Atrasadas, Clientes Ativos, Peças Processadas, Caixa status, Vendas, Sangrias, Saldo Esperado). Adapta-se conforme permissões do usuário.
2. **CaixaResumoCard** — Mostra caixa aberto OU último caixa fechado (como você pediu). Exibe operador, valores, diferença com cores.
3. **EventosDoDiaCard** — Eventos do dia com ícones por tipo e botão "Ver agenda completa".
4. **FeriasProximasCard** — Férias próximas com alerta de vencidas.
5. **BillingClosuresCard** — Fechamentos próximos com badges coloridas por urgência.
6. **ContasVencendoCard** — Contas a pagar vencendo em 3 dias.
7. **EstoqueBaixoCard** — Itens abaixo do estoque mínimo.
8. **ContratosVencendoCard** — Contratos vencendo em 30 dias.
9. **DailySchedule** — Retiradas e entregas do dia.
10. **ProductionBottleneck** — Gargalos de produção com barra de progresso.
11. **ProcessingSummary** — OS em processamento com status colorido (No Prazo/Atrasado/Em Risco).

### Problemas Encontrados

#### 1. FinanceCard "Contas a Receber" — Estático/Em Desenvolvimento
- O card "Contas a Receber" está com `total={0}`, `items={[]}` e subtitle "Em desenvolvimento". Não busca dados reais.

#### 2. OperationalCosts — Importado mas Nunca Usado
- O componente `OperationalCosts` é importado na linha 5 mas nunca renderizado no Dashboard. É import morto.

#### 3. FinanceCard "Ver Todas" — Botão Sem Ação
- O botão "Ver Todas" nos FinanceCards não tem `onClick` — não navega para nenhuma página.

### Plano de Correção

#### `src/pages/Dashboard.tsx`
- Remover import não utilizado de `OperationalCosts`
- Adicionar navegação no botão "Ver Todas" do FinanceCard de Contas a Pagar (→ `/contas-pagar`)

#### `src/components/dashboard/FinanceCard.tsx`
- Adicionar prop `onViewAll?: () => void` e vincular ao botão "Ver Todas"

#### Dashboard — Contas a Receber
- Conectar o card "Contas a Receber" a dados reais das faturas pendentes (via `useFaturas` ou `useDadosFaturamento`), ou remover o card se a funcionalidade ainda não está pronta

### Resultado
Dashboard limpo sem imports mortos, botões funcionais com navegação, e transparência sobre cards em desenvolvimento.

