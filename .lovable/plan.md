

# Alerta de fechamentos 1 dia antes com datas visíveis

## Situação atual
O card "Fechamentos Próximos" filtra clientes com fechamento nos próximos 3 dias, mas não mostra a **data exata** do fechamento — só mostra "Dia X". Além disso, a janela de 3 dias pode não capturar nenhum cliente dependendo do momento do mês.

## Solução
Ampliar a janela para mostrar **todos os fechamentos do mês** (até 31 dias) com a **data exata** de fechamento, e destacar visualmente os que estão a **1 dia ou menos** (urgentes) vs os demais.

### Mudanças

**`src/hooks/useFechamentosProximos.ts`**
- Adicionar campo `dataFechamento` (Date) ao interface `ClienteFechamento` para retornar a data exata
- Mudar default de `diasAntecedencia` de 3 para 31 (mês inteiro)

**`src/components/dashboard/BillingClosuresCard.tsx`**
- Chamar hook com janela de 31 dias
- Mostrar a **data exata** do fechamento (ex: "16/04") em vez de apenas "Dia 16"
- Separar em duas seções:
  - **Urgentes** (0-1 dia): fundo vermelho/laranja, destaque forte — "HOJE" ou "AMANHÃ"
  - **Próximos** (2+ dias): lista normal com contagem regressiva
- Badge com cores diferenciadas:
  - 0 dias → vermelho "HOJE"
  - 1 dia → laranja "AMANHÃ"  
  - 2-3 dias → amarelo
  - 4+ dias → cinza neutro

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useFechamentosProximos.ts` | Adicionar `dataFechamento`, ampliar janela para 31 dias |
| `src/components/dashboard/BillingClosuresCard.tsx` | Mostrar data exata, separar urgentes (0-1 dia) dos demais, cores por urgência |

