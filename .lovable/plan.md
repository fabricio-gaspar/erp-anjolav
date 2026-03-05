

# Alertas no Dashboard: Contas Vencendo, Estoque Baixo, Contratos Vencendo

Tres novos cards de alerta no mesmo estilo do `BillingClosuresCard`, posicionados no painel financeiro/operacional do Dashboard.

## Cards a criar

### 1. Contas a Pagar Vencendo (`ContasVencendoCard`)
- Hook: reutiliza `useContasPagar` (ja importado no Dashboard)
- Filtra contas pendentes com vencimento nos proximos 3 dias ou ja vencidas
- Badge "Vencida" (destructive), "Hoje", "Amanha", "X dias"
- Click navega para `/contas-pagar`
- Cor: borda vermelha/warning

### 2. Estoque Abaixo do Minimo (`EstoqueBaixoCard`)
- Hook: novo `useEstoqueBaixo` ou reutiliza `useEstoque` filtrando `quantidade_atual <= quantidade_minima`
- Lista insumos criticos (zerados primeiro, depois baixos)
- Badge "Critico" (vermelho) para zerados, "Baixo" (amarelo) para abaixo do minimo
- Click navega para `/estoque`

### 3. Contratos Vencendo (`ContratosVencendoCard`)
- Hook: reutiliza `useContratosAluguel` filtrando contratos ativos com `data_fim` nos proximos 30 dias
- Mostra nome do cliente e dias restantes
- Badge "Vencido" / "X dias"
- Click navega para `/clientes`

## Posicionamento no Dashboard

Adicionar uma nova row abaixo do painel financeiro atual, ou expandir o grid financeiro de 3 para incluir os novos cards. Sugiro uma nova section "Alertas Operacionais" com os 3 cards em grid 3 colunas.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/components/dashboard/ContasVencendoCard.tsx` | Criar |
| `src/components/dashboard/EstoqueBaixoCard.tsx` | Criar |
| `src/components/dashboard/ContratosVencendoCard.tsx` | Criar |
| `src/pages/Dashboard.tsx` | Adicionar os 3 cards em nova section |

Sem alteracoes no banco de dados. Todos os dados ja existem nas tabelas atuais.

