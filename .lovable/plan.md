

## Plano: Renomear opções de pagamento/logística + Datas no ROL

### Alterações

#### 1. `src/components/delivery/LogisticaSection.tsx` — Renomear "Vai Buscar"
- Linha 115: "Vai Buscar" → "Retirada no Local"
- Linha 116: "Cliente retira na loja" → manter ou ajustar subtítulo

#### 2. `src/components/caixa/PagamentoModal.tsx` — Renomear "Pagar na Entrega"
- Linha 390: "Pagar na Entrega" → "Pagamento na Retirada"
- Linha 391: "Quando for buscar" → "Quando retirar o pedido"

#### 3. `src/components/lancamentos/PendentesTab.tsx` — Adicionar colunas de data
- Adicionar coluna **ENTRADA** (data_lancamento) e **ENTREGA** (data_entrega) na tabela
- A coluna DATA atual (linha 261/299) será dividida em duas: Entrada e Entrega
- Se `data_entrega` for null, exibir "—"

### Resultado
Terminologia corrigida no PDV ("Retirada no Local" e "Pagamento na Retirada") e ROL exibindo data de entrada e data de entrega separadamente.

