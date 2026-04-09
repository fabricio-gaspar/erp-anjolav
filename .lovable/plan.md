

# Dashboard adaptativo por perfil do funcionário

## Problema atual
O dashboard só mostra cards relevantes ao fluxo **industrial** (OS, Produção, Agenda). Um funcionário com perfil **residencial/PDV** (só acesso ao Caixa) vê o dashboard praticamente vazio — sem nenhuma métrica útil.

## Solução
Adicionar cards específicos para o módulo **Caixa PDV** e garantir que cada perfil veja métricas relevantes aos seus módulos.

### Novos cards para quem tem acesso ao Caixa PDV

| Card | Dados |
|------|-------|
| **KPI: Caixa Aberto** | Status do caixa atual (Aberto/Fechado) |
| **KPI: Vendas Hoje** | Total de vendas do caixa aberto (valor_vendas) |
| **KPI: Sangrias Hoje** | Total de sangrias do caixa aberto |
| **KPI: Valor Esperado** | Valor esperado no caixa atual |

### Novo painel: "Resumo do Caixa"
Card dedicado visível apenas para quem tem `temCaixa = true`, mostrando:
- Status do caixa (aberto/fechado)
- Valor de abertura, vendas acumuladas, sangrias e reforços
- Diferença acumulada (se houver dados)

### Mudanças nos KPIs existentes
Os 4 KPIs atuais (OS em Aberto, Entregas Atrasadas, Clientes Ativos, Peças Processadas) já estão condicionados por permissão. Vou **adicionar** KPIs do Caixa quando `temCaixa` for `true`, para que o grid sempre tenha conteúdo.

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dashboard.tsx` | Importar `useCaixaAberto`, adicionar KPIs do Caixa e painel "Resumo do Caixa" condicionado a `temCaixa` |
| `src/components/dashboard/CaixaResumoCard.tsx` | **Novo** - Card com resumo do caixa aberto (status, vendas, sangrias, valor esperado) |

Nenhuma migração necessária.

