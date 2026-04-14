

## Plano: Cores de status no ROL (etapa + pagamento)

### Situação atual
- A tabela `lancamentos` tem `status` com valores: `pendente` e `faturado`
- Não existe um campo para rastrear a **etapa de produção** do ROL (em processo / prateleira / entregue)
- A tabela `faturas` tem `status` (pendente/pago/cancelado) e `forma_pagamento`, mas o lançamento individual não tem informação de pagamento própria
- Na listagem de Pendentes, o ROL aparece apenas com badge `outline` sem cor

### Alterações

#### 1. Migração — Novo campo `etapa` na tabela `lancamentos`
- Adicionar coluna `etapa TEXT DEFAULT 'em_processo'` com valores: `em_processo`, `prateleira`, `entregue`
- Isso permite rastrear onde o ROL está fisicamente, independente do status de faturamento

#### 2. `src/hooks/useLancamentos.ts` — Atualizar interface
- Adicionar `etapa` na interface `Lancamento`

#### 3. `src/components/lancamentos/PendentesTab.tsx` — Cores por etapa + pagamento
- Badge do ROL colorido por etapa:
  - **Vermelho** (`bg-destructive/10 text-destructive`): Em Processo
  - **Amarelo** (`bg-warning/10 text-warning`): Prateleira
  - **Verde** (`bg-success/10 text-success`): Entregue
- Adicionar coluna **ETAPA** com dropdown para alterar a etapa diretamente na tabela
- Adicionar coluna **PAGAMENTO** mostrando status da fatura vinculada:
  - Vermelho: Não faturado / Pendente
  - Verde: Pago
  - Cinza: Sem fatura

#### 4. `src/components/lancamentos/FaturasTab.tsx` — Cor de pagamento + forma
- Na coluna STATUS já existe com cores (warning=pendente, success=pago, danger=cancelado)
- Adicionar exibição da `forma_pagamento` ao lado do status quando disponível (ex: "Pago · Boleto")

#### 5. `src/components/lancamentos/NovoLancamentoTab.tsx`
- Permitir selecionar a etapa inicial ao criar o lançamento (padrão: "Em Processo")

### Resultado
Cada ROL na listagem terá indicação visual colorida da etapa de produção (vermelho/amarelo/verde) e do status de pagamento, com possibilidade de alterar a etapa diretamente na tabela.

