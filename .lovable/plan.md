

# Plano: Vincular Fornecedores ao Contas a Pagar com Geração Recorrente

## Resumo

Adicionar campos de pagamento recorrente no cadastro de fornecedores (valor, dia vencimento, frequência). Ao vincular, o sistema permite gerar automaticamente as contas a pagar mensais vinculadas ao fornecedor. O Dashboard já exibe alertas de contas vencendo — basta que as contas geradas tenham o `fornecedor_id` preenchido.

## Mudanças

### 1. Migração: Novos campos na tabela `fornecedores`

Adicionar colunas:
- `valor_recorrente NUMERIC DEFAULT NULL` — valor mensal do fornecedor
- `dia_vencimento INTEGER DEFAULT NULL` — dia do mês que vence
- `frequencia_pagamento TEXT DEFAULT 'mensal'` — mensal/quinzenal/avulso

Adicionar coluna `fornecedor_id UUID REFERENCES fornecedores(id)` na tabela `contas_pagar` (se ainda não existir — preciso verificar schema).

### 2. Cadastro de Fornecedores — Campos de Pagamento

**Arquivo: `src/pages/Fornecedores.tsx`**
- Adicionar seção "Pagamento Recorrente" no modal de cadastro/edição com:
  - Valor mensal (input numérico)
  - Dia de vencimento (1-31)
  - Frequência (mensal/quinzenal)
- Botão "Gerar Conta do Mês" que cria automaticamente uma entrada em `contas_pagar` com `fornecedor_id` vinculado

### 3. Hook `useFornecedores` — Suporte aos novos campos

**Arquivo: `src/hooks/useFornecedores.ts`**
- Expandir interface `Fornecedor` com `valor_recorrente`, `dia_vencimento`, `frequencia_pagamento`

### 4. Nova Conta a Pagar — Selecionar Fornecedor cadastrado

**Arquivo: `src/components/contas/NovaContaPagarModal.tsx`**
- Trocar campo de texto "Fornecedor" por um Select com os fornecedores cadastrados (+ opção "Outro" para texto livre)
- Ao selecionar fornecedor, auto-preencher valor e descrição se tiver pagamento recorrente configurado
- Salvar `fornecedor_id` junto com `fornecedor` (nome)

### 5. Tabela na listagem de Fornecedores — Indicador visual

**Arquivo: `src/pages/Fornecedores.tsx`**
- Mostrar na tabela uma coluna "Pagamento" com valor e dia de vencimento quando configurado
- Badge visual indicando se tem pagamento recorrente

### 6. Dashboard — Já funciona

O `ContasVencendoCard` já busca todas as contas pendentes/vencidas e mostra alertas. Contas geradas a partir de fornecedores aparecerão automaticamente.

## Arquivos Afetados (4 + 1 migração)

| Arquivo | Ação |
|---|---|
| Migração SQL | Novos campos em fornecedores + fornecedor_id em contas_pagar |
| `src/hooks/useFornecedores.ts` | Expandir interface |
| `src/pages/Fornecedores.tsx` | Campos de pagamento + botão gerar conta |
| `src/components/contas/NovaContaPagarModal.tsx` | Select de fornecedores + auto-preenchimento |
| `src/hooks/useContasPagar.ts` | Incluir fornecedor_id na interface |

