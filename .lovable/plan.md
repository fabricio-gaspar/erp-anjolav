# Mover Relatórios de Caixa para o grupo Relatórios

## O que muda

No `src/components/layout/AppSidebar.tsx`:

1. **Remover** do grupo **Financeiro** o item:
   - `Histórico Caixas` → `/relatorios/caixa`

2. **Adicionar** no grupo **Relatórios**, logo abaixo de "Relatório Mensal":
   - `Relatórios de Caixa` → `/relatorios/caixa` (ícone `BarChart3`)

## Resultado final do grupo Relatórios

```text
Relatórios
├── Relatório Mensal
├── Relatórios de Caixa     ← novo aqui
├── Clientes
├── Proximidade
├── Quilometragem
└── Agenda Pessoal
```

## Fora de escopo

- Não muda a rota (`/relatorios/caixa` continua igual).
- Não altera a página `HistoricoCaixas.tsx` nem nenhum hook.
- Não mexe em permissões/roles.
