

## Plano: Menu de ações com "três pontinhos" na tabela de Clientes

### Problema
Na tela de Clientes em 768px, os botões de ação (Visualizar, Editar, Desativar, Excluir) não cabem na coluna AÇÕES — alguns ficam com `hidden sm:flex` e desaparecem completamente.

### Solução
Substituir os 4 botões individuais por um **DropdownMenu** acionado por um botão de "três pontinhos" (`MoreHorizontal` icon). Todas as ações ficam disponíveis em qualquer tamanho de tela.

### Arquivo alterado
**`src/pages/Clientes.tsx`**

- Importar `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` de `@/components/ui/dropdown-menu` e `MoreHorizontal` de `lucide-react`
- Substituir o bloco de 4 botões (linhas 258-294) por um único `DropdownMenu` com:
  - **Visualizar** (ícone Eye) → `handleEditCliente(cliente.id)`
  - **Editar** (ícone Pencil) → `handleEditCliente(cliente.id)`
  - **Desativar/Ativar** (ícone Ban) → `handleToggleAtivo(cliente)`
  - **Excluir** (ícone Trash2, texto vermelho) → abre diálogo de confirmação

### Resultado
Um único botão "⋯" sempre visível em qualquer resolução, que ao clicar abre um menu dropdown com todas as 4 ações disponíveis.

