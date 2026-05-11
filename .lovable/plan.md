
## Objetivo

No PDV Industrial (aba **Pendentes** de Lançamentos), separar os ROLs lançados em **dois blocos por ciclo de faturamento** (Quinzenal e Mensal), conforme o cadastro de cada cliente, mantendo o fluxo já existente de Gerar Relatório → Gerar NF → Gerar Boleto → Enviar (FaturamentoModal).

## Como ficará organizado

```
Lançamentos > Pendentes
├── 🟦 FECHAMENTO QUINZENAL  (X clientes · R$ Y)
│    ├── Cliente A  (3 ROLs · R$ ...)   [▢ selecionar todos]
│    │    ├── ROL-2026-000123 ...
│    │    └── ROL-2026-000124 ...
│    └── Cliente B ...
│
├── 🟪 FECHAMENTO MENSAL     (X clientes · R$ Y)
│    └── Cliente C ...
│
└── ⬜ SEM CICLO DEFINIDO    (cair aqui se cliente não tiver tipo_faturamento)
```

Cada bloco terá:
- Cabeçalho colapsável com ícone, label, contagem de clientes/ROLs e total R$.
- Tabela atual (mesma estrutura: ROL, Cliente, Entrada, Entrega, Etapa, Pagamento, Valor, Ações).
- Possibilidade de expandir/recolher o bloco.

A barra superior "Selecionados" e o botão **Gerar Fatura** continuam funcionando como hoje (somente lançamentos do mesmo cliente). Ao clicar, abre o `FaturamentoModal` que já cobre as 4 etapas (Relatório, NF, Pagamento/Boleto, Envio).

## O que muda no código

**Arquivo único:** `src/components/lancamentos/PendentesTab.tsx`

1. Buscar `configuracoes_pagamento_cliente.tipo_faturamento` para os clientes presentes em `lancamentosFiltrados` (uma única query `in('cliente_id', [...])`).
2. Construir um mapa `clienteId → ciclo` (`quinzenal` | `mensal` | `outro`).
3. Substituir o atual `lancamentosPorCliente` por uma estrutura agrupada em 2 (ou 3) blocos:
   - `quinzenal`: clientes com `tipo_faturamento = 'quinzenal'`
   - `mensal`: clientes com `tipo_faturamento = 'mensal'` (ou ausente — default do schema é `mensal`)
   - `outro` (opcional): demais ciclos (`avulso`, etc.) — só renderizado se houver itens
4. Renderizar uma `<Card>` por bloco com header (cor/ícone diferentes) contendo a tabela atual filtrada para aquele ciclo. Se o filtro por cliente (URL `?cliente=`) estiver ativo, mostrar só o bloco relevante.
5. Manter toda a lógica de seleção, totais, Gerar Fatura, edição e exclusão exatamente como hoje.

## Fora de escopo

- Nenhuma alteração em `FaturamentoModal`, `FaturasTab`, hooks de faturamento ou banco.
- Nenhuma alteração no PDV Loja (residencial) — segmentação `classificacao = 'industrial'` já está aplicada.
- Sem migração de dados (campo `tipo_faturamento` já existe em `configuracoes_pagamento_cliente`).
