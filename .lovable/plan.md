

## Diagnóstico

O erro de "permissão do administrador" **não é uma permissão real** — é uma mensagem placeholder hardcoded na função `handleConfirmDelete` (linhas 275-293 de `src/components/configuracoes/ConfiguracoesDados.tsx`).

Quando o usuário clica em excluir uma entidade individual (ex: só Clientes, só Produtos), o código atual apenas mostra o toast `"A exclusão de X requer confirmação adicional do administrador do sistema."` e **nunca chama nenhuma função de exclusão real**. A função `deleteEntityData` existe no hook mas não está conectada.

Já a exclusão geral ("ZERAR TUDO") funciona corretamente, exigindo a palavra-chave.

## Plano de Correção

Aplicar o mesmo padrão de confirmação por palavra-chave para exclusão individual de entidades.

### Alteração em `src/components/configuracoes/ConfiguracoesDados.tsx`

**1. Importar `deleteEntityData`** do hook `useDataManagement`.

**2. Adicionar estado para confirmação:**
```ts
const [deleteConfirmText, setDeleteConfirmText] = useState("");
const [isDeletingEntity, setIsDeletingEntity] = useState(false);
```

**3. Reescrever `handleConfirmDelete`** para realmente excluir:
- Validar que o usuário digitou `EXCLUIR` (palavra-chave)
- Chamar `deleteEntityData(deleteEntity.table)`
- Mostrar toast de sucesso com a quantidade removida
- Tratar erros reais (FK, RLS) exibindo mensagem clara
- Atualizar a listagem com `refetch()`

**4. Atualizar o `AlertDialog` de exclusão individual** para incluir:
- Aviso claro do que será apagado (nome da entidade + contagem)
- Campo `Input` exigindo digitar `EXCLUIR` para liberar o botão
- Botão "Excluir" desabilitado até a palavra-chave correta + estado de loading
- Limpar `deleteConfirmText` ao fechar o modal

### Resultado

- Exclusão individual de entidades passa a funcionar de fato
- Mantém o padrão de segurança do sistema (palavra-chave obrigatória, igual ao "ZERAR TUDO")
- Mensagem enganosa de "requer permissão do administrador" é removida
- Erros reais (ex: violação de chave estrangeira) são exibidos ao usuário

