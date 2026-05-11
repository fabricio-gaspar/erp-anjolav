
# Ajustes no Dashboard

## 1. Cards duplicados de "Contas a Pagar" — confirmado

Existem **dois cards** sobre contas a pagar:

| Card | Origem | O que mostra |
|------|--------|--------------|
| **FinanceCard "Contas a Pagar"** | `Dashboard.tsx` linhas 330-346 | Total geral pendente + 3 últimas |
| **ContasVencendoCard** | `ContasVencendoCard.tsx` | Apenas contas vencendo nos próximos 3 dias (alerta) |

**Decisão:** Remover o **FinanceCard "Contas a Pagar"** e manter apenas o **ContasVencendoCard** (mais útil porque é um alerta de urgência com prazo). O total geral já aparece em outras telas (Contas, Visão Geral).

→ Mantemos o **FinanceCard "Contas a Receber"** porque ele tem função diferente (totalizador + lista de faturas, sem alerta equivalente).

---

## 2. Card "Contratos Vencendo" não lista nada

**Causa raiz identificada:** o card filtra contratos com `c.data_fim` definido. No banco existe **1 contrato ativo**, mas com `data_fim = NULL`. Por isso não aparece nada.

**Correção:**
- Renomear o card para **"Contratos Ativos"**.
- Listar **todos os contratos ativos** dos clientes.
- Mostrar badge:
  - "Sem prazo" (cinza) se `data_fim` for NULL
  - "X dias" (amarelo) se faltar ≤ 30 dias
  - "Vencido" (vermelho) se já passou
  - "Ativo" (verde) se faltar > 30 dias
- Mostrar valor mensal do contrato (`valor_servico`) ao lado do nome do cliente.
- Click → leva pra `/clientes` na aba contratos do cliente.

---

## 3. Itens prioritários novos no Dashboard

Análise do que falta para um ERP de lavanderia industrial maduro:

| # | Card sugerido | Justificativa | Prioridade |
|---|---|---|---|
| A | **Inadimplência consolidada** (faturas vencidas + valor total atrasado) | Hoje só mostra "a receber" geral, não destaca vencidos | 🔴 Alta |
| B | **Top 5 Clientes do Mês** (por faturamento) | Visão comercial — quem está gerando receita | 🟡 Média |
| C | **NFs Pendentes de Emissão** (lançamentos sem nota emitida) | Risco fiscal, multa se atrasar | 🔴 Alta |
| D | **Aniversariantes do Mês** (clientes + funcionários) | Engajamento / RH | 🟢 Baixa |
| E | **Veículos em manutenção / próximos** | Gestão de frota | 🟢 Baixa |

**Sugestão:** Implementar **A** e **C** agora (críticos operacionais). B/D/E ficam como roadmap.

---

## 📋 Plano de execução

### 3.1 Remover duplicação
- Em `src/pages/Dashboard.tsx`, remover bloco `FinanceCard` "Contas a Pagar" (linhas 330-346) e ajustar o grid da seção "Financeiro & Alertas".

### 3.2 Corrigir Card de Contratos
- Editar `src/components/dashboard/ContratosVencendoCard.tsx`:
  - Remover filtro `c.data_fim`.
  - Adicionar lógica de status por prazo.
  - Exibir valor mensal.
  - Renomear para "Contratos Ativos".

### 3.3 Adicionar Card "Inadimplência"
- Novo componente `src/components/dashboard/InadimplenciaCard.tsx`.
- Hook reutiliza `useFaturas` e filtra `data_vencimento < hoje && status !== 'pago'`.
- Exibe: total devido, qtd faturas vencidas, top 3 clientes inadimplentes.

### 3.4 Adicionar Card "NFs Pendentes"
- Novo componente `src/components/dashboard/NFsPendentesCard.tsx`.
- Filtra lançamentos com `status_nf in ('pendente','erro')`.
- Mostra qtd + valor total + ação "Emitir agora".

### 3.5 Memory update
- Atualizar `mem://features/dashboard/adaptive-profiles-pdv` com a nova composição do dashboard.

---

## 🧰 Detalhes técnicos

**Arquivos editados:**
- `src/pages/Dashboard.tsx` — remove FinanceCard payable, adiciona Inadimplência + NFs Pendentes na seção "Financeiro & Alertas"
- `src/components/dashboard/ContratosVencendoCard.tsx` — refatoração da lógica
- `src/components/dashboard/InadimplenciaCard.tsx` — **novo**
- `src/components/dashboard/NFsPendentesCard.tsx` — **novo**

**Validação após implementar:**
- Dashboard mostra apenas 1 menção a "Contas a Pagar" (alerta de 3 dias).
- Card "Contratos Ativos" lista o contrato existente (CONTRATO DE ALUGUEL) com badge "Sem prazo".
- Cards novos aparecem apenas se houver dados ou alertas pertinentes (estado vazio elegante).

---

Aprovando, implemento as 4 mudanças (remover duplicado + corrigir contratos + 2 cards novos) numa única passada.
