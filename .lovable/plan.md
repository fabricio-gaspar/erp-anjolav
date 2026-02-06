

# Simplificar Configuracao de Pagamento do Cliente

## Resumo da mudanca

Reestruturar a aba "Pagamento" no cadastro de clientes para refletir a regra de negocio real:
- **Fechamento**: Mensal (dia 1) ou Quinzenal (dia 16)
- **Prazo para pagamento**: A Vista, 7 dias, 15 dias ou 30 dias
- **Dia de Vencimento**: removido como campo manual -- sera calculado automaticamente a partir do tipo de fechamento + prazo

## O que muda na interface

### Antes (atual)
- Dia de Fechamento: campo de texto livre (1 a 31)
- Dia de Vencimento: campo de texto livre (1 a 31)
- Condicao de Pagamento: dropdown com "Mensal (30 dias)", "Quinzenal (15 dias)", "Semanal (7 dias)", "A Vista"

### Depois (novo)
- **Tipo de Fechamento**: dois botoes toggle -- "Mensal" (dia 1) e "Quinzenal" (dia 16)
  - Ao selecionar "Mensal", o sistema grava `dia_fechamento = 1`
  - Ao selecionar "Quinzenal", o sistema grava `dia_fechamento = 16`
- **Prazo para Pagamento**: quatro botoes toggle -- "A Vista", "7 dias", "15 dias", "30 dias"
  - Grava `condicao_pagamento` como `a_vista`, `7_dias`, `15_dias` ou `30_dias`
- **Dia de Vencimento**: removido da tela (o calculo de vencimento usara a data de fechamento + prazo)

### Resumo visual (card no final)
Atualizado para mostrar:
- Tipo de Fechamento: "Mensal (dia 1)" ou "Quinzenal (dia 16)"
- Prazo: "A Vista", "7 dias", "15 dias" ou "30 dias"

---

## Arquivos que serao modificados

### 1. `src/components/clientes/ClientePagamento.tsx`
- Substituir campo de texto "Dia de Fechamento" por toggle "Mensal / Quinzenal"
- Substituir campo de texto "Dia de Vencimento" -- removido da tela
- Substituir dropdown "Condicao de Pagamento" por 4 botoes toggle (A Vista, 7, 15, 30 dias)
- Atualizar logica de `handleSave`:
  - `dia_fechamento` = 1 (mensal) ou 16 (quinzenal)
  - `dia_vencimento` = null (nao mais usado diretamente)
  - `condicao_pagamento` = novo valor selecionado
- Atualizar card de Resumo com os novos labels

### 2. `src/components/dashboard/BillingClosuresCard.tsx`
- Atualizar `condicaoLabels` para incluir os novos valores (`7_dias`, `15_dias`, `30_dias`, `a_vista`)

### 3. `src/hooks/useFechamentosProximos.ts`
- Adaptar para clientes quinzenais: alem do dia configurado, verificar se ha dois fechamentos por mes (dia 1 e dia 16) para clientes quinzenais
- Na pratica, o `dia_fechamento` ja e um numero (1 ou 16), entao a logica existente ja funciona corretamente

### 4. `src/hooks/useFaturas.ts` - funcao `calcularVencimento`
- Ajustar para aceitar o prazo em dias (a_vista=0, 7_dias=7, 15_dias=15, 30_dias=30) a partir da data de fechamento, em vez de usar um dia fixo do mes

### 5. `src/components/faturamento/EtapaPagamento.tsx`
- Atualizar calculo de vencimento para usar `dia_fechamento` + prazo em dias, em vez de `dia_vencimento` fixo

---

## Detalhes tecnicos

### Mapeamento de valores no banco

O campo `condicao_pagamento` (tipo `string`) passara a usar:

```text
Valor antigo       ->  Valor novo
mensal_30          ->  30_dias
mensal_15          ->  15_dias
semanal            ->  7_dias
a_vista            ->  a_vista (sem mudanca)
```

O campo `dia_fechamento` (tipo `integer`) passara a ter apenas dois valores possiveis: `1` ou `16`.

O campo `dia_vencimento` continuara existindo no banco mas nao sera mais preenchido pela interface (compatibilidade retroativa).

### Calculo de vencimento

```text
data_vencimento = data_fechamento + prazo_dias

Exemplo 1 (Mensal, 30 dias):
  Fechamento dia 1 de marco -> Vencimento dia 31 de marco

Exemplo 2 (Quinzenal, 7 dias):
  Fechamento dia 16 de fevereiro -> Vencimento dia 23 de fevereiro

Exemplo 3 (Mensal, A Vista):
  Fechamento dia 1 de marco -> Vencimento dia 1 de marco (mesmo dia)
```

### Compatibilidade com dados existentes

Os dados antigos no banco (`mensal_30`, `mensal_15`, `semanal`) continuarao funcionando porque:
- O `BillingClosuresCard` tera labels para valores antigos E novos
- A funcao `calcularVencimento` tratara ambos os formatos
- Novos salvamentos usarao os novos valores
