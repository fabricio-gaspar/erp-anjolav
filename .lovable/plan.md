

## Plano: Mostrar resumo do último caixa fechado no Dashboard

### Problema
O `CaixaResumoCard` só consulta caixas com status "ABERTO". Quando o caixa é fechado, o card mostra apenas "Nenhum caixa aberto no momento" — sem nenhum resumo do caixa que acabou de ser fechado.

### Solução

#### `src/components/dashboard/CaixaResumoCard.tsx`
- Quando não há caixa aberto, buscar o **último caixa fechado** (ordenado por `data_fechamento DESC`, limit 1)
- Exibir o resumo do último fechamento com:
  - Badge "Fechado" (amarelo/secondary)
  - Operador, data/hora do fechamento
  - Valores: Abertura, Vendas, Sangrias, Reforços, Esperado, **Contado**, **Diferença**
  - A diferença com cor: verde se positiva/zero, vermelho se negativa
- Manter o comportamento atual quando há caixa aberto (mostra o caixa aberto)

#### `src/hooks/useCaixa.ts`
- Adicionar hook `useUltimoCaixaFechado()` que busca o último caixa com status "FECHADO" ordenado por `data_fechamento DESC`

### Resultado
Após fechar o caixa, o Dashboard mostrará o resumo completo do último fechamento com todos os valores e a diferença de conferência.

