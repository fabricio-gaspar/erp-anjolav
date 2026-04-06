

# Reformular aba Pagamento do cadastro de clientes

## Mudancas solicitadas

1. **Remover "Tipo de Faturamento"** — o campo com botoes Mensal/Avulso sera eliminado da interface
2. **Tipo de Fechamento** — manter como esta (ja tem Avulso, Quinzenal, Mensal)
3. **Forma de Pagamento** — mostrar sempre PIX, Transferencia e Boleto (remover feature flag `BOLETO_ENABLED`)
4. **Prazo para Pagamento** — substituir os toggles (5 dias, 7 dias...) por um seletor de dia do mes (1 a 31) em formato de calendario/grid, usando o campo `dia_vencimento` que ja existe na tabela `configuracoes_pagamento_cliente`

## Nenhuma migracao necessaria

A tabela `configuracoes_pagamento_cliente` ja possui:
- `dia_vencimento` (integer) — para armazenar o dia do mes
- `tipo_faturamento`, `forma_pagamento`, `condicao_pagamento` — continuam existindo

O campo `condicao_pagamento` deixa de ser usado na interface (substituido pelo `dia_vencimento`).

## Alteracoes no arquivo `src/components/clientes/ClientePagamento.tsx`

1. **Remover** o bloco "Tipo de Faturamento" (linhas 166-188) e o estado `tipoFaturamento`
2. **Forma de Pagamento** — remover condicional `BOLETO_ENABLED`, sempre mostrar 3 botoes: PIX, Transferencia, Boleto
3. **Prazo para Pagamento** — substituir `ToggleGroup` de condicoes por um grid 7x5 com dias 1-31, onde o usuario clica no dia desejado. Usar estado `diaVencimento` (number). Estilo: grid compacto com botoes pequenos, dia selecionado destacado em primary
4. **handleSave** — enviar `dia_vencimento: diaVencimento` no upsert; remover `condicao_pagamento`
5. **Resumo** — remover linha "Tipo de Faturamento", atualizar "Prazo para Pagamento" para mostrar "Dia X" em vez das condicoes antigas

