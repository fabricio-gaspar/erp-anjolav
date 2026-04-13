

## Plano: Melhorar o Calendário de Dia de Vencimento

### Problema
O seletor de "Dia de Vencimento" (linhas 199-220 do `ClientePagamento.tsx`) é uma grade de 31 botões pequenos sem visual de calendário. Fica confuso e visualmente pobre.

### Solução
Redesenhar o seletor de dias com visual de calendário real:

- Organizar em grid 7 colunas com header dos dias da semana (Dom-Sáb)
- Botões maiores e mais espaçados
- Dia selecionado com destaque circular (estilo calendário)
- Adicionar ícone de calendário no título da seção
- Card envolvendo o seletor para dar mais destaque visual
- Manter a mesma lógica (selecionar dia 1-31)

### Arquivo alterado
- `src/components/clientes/ClientePagamento.tsx` — seção "Dia de Vencimento" (linhas 194-220)

### Resultado visual
```text
📅 Dia de Vencimento
┌──────────────────────────────┐
│  1   2   3   4   5   6   7  │
│  8   9  10  11  12  13  14  │
│ 15  16  17  18  19  20  21  │
│ 22  23  24  25  26  27  28  │
│ 29  30  31                   │
└──────────────────────────────┘
  O vencimento será no dia 10 de cada mês
```

Dias organizados em 7 colunas, botão selecionado com fundo primário circular, hover suave, dentro de um Card com borda sutil.

