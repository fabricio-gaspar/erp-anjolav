

# Separação Financeira: Industrial vs Loja

## Situação Atual

O sistema já segmenta operacionalmente:
- **Lançamentos** → apenas clientes `industrial`
- **PDV/Caixa** → apenas clientes `residencial`

Porém o Dashboard Financeiro mistura tudo. As receitas vêm de `faturas` (industrial) e `caixa_movimentacoes` (loja), mas não há filtro por setor.

## Solução

Adicionar um **filtro de setor** (Todos / Industrial / Loja) no Dashboard Financeiro e no Relatório Financeiro, separando automaticamente os dados pela origem.

### Como identificar o setor de cada movimentação

| Dado | Setor | Lógica |
|---|---|---|
| Faturas | Industrial | `faturas.cliente_id → clientes.classificacao = 'industrial'` |
| Vendas PDV (caixa_movimentacoes tipo VENDA) | Loja | Sempre residencial (PDV só aceita residencial) |
| Contas a Pagar | Compartilhado | Sem distinção (despesas gerais da empresa) |

### Alterações

**1. `useDashboardFinanceiro.ts`** — Receber parâmetro `setor: 'todos' | 'industrial' | 'loja'`
- Quando `industrial`: filtrar faturas cujo cliente tem `classificacao = 'industrial'`, ignorar vendas do caixa
- Quando `loja`: usar vendas do caixa como receita, ignorar faturas industriais
- Quando `todos`: somar ambos (comportamento atual)
- Despesas (contas a pagar) ficam iguais em todos os filtros (são custos gerais)

**2. `DashboardFinanceiro.tsx`** — Adicionar toggle/tabs "Todos | Industrial | Loja" no topo
- Passar o setor selecionado para o hook
- Mudar subtítulo conforme setor selecionado

**3. `useFaturas.ts`** — Já faz join com `clientes(razao_social, ...)`, precisa incluir `classificacao` no select para permitir filtragem

**4. Incluir receitas do Caixa** — O hook atual só usa `faturas` como receita. Precisa também buscar `caixa_movimentacoes` tipo VENDA para contabilizar receitas da Loja.

### Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `src/hooks/useDashboardFinanceiro.ts` | Adicionar filtro por setor + incluir receitas do caixa |
| `src/hooks/useFaturas.ts` | Incluir `classificacao` no join com clientes |
| `src/pages/DashboardFinanceiro.tsx` | Adicionar seletor de setor no topo |

Nenhuma alteração no banco de dados — a classificação já existe na tabela `clientes`.

