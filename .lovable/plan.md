

## Plano: Corrigir cache de clientes no módulo Lançamentos

### Diagnóstico
O cliente Fabricio Gaspar **já está salvo como "industrial" no banco de dados** — a alteração foi gravada corretamente. O problema é que o React Query está usando dados em cache da sessão anterior (quando o cliente ainda era "residencial"). Como o `QueryClient` não tem `defaultOptions` configuradas, o `staleTime` padrão é 0, mas a query `["clientes"]` pode não ter sido invalidada ao navegar entre páginas.

### Alteração

#### `src/components/lancamentos/NovoLancamentoTab.tsx`
- Adicionar `refetchOnMount: "always"` na chamada do `useClientes` para garantir que a lista de clientes industriais esteja sempre atualizada ao abrir a aba de Lançamentos.

Como o `useClientes` é um hook compartilhado, a melhor abordagem é configurar o `QueryClient` globalmente:

#### `src/App.tsx`
- Configurar `defaultOptions` no `QueryClient` com `refetchOnWindowFocus: true` (já é padrão) e `staleTime: 0` (já é padrão), mas adicionar `refetchOnMount: "always"` para garantir que dados sempre sejam revalidados ao montar componentes.

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: "always",
    },
  },
});
```

### Resultado
Ao navegar para Lançamentos após alterar a classificação de um cliente, a lista será recarregada automaticamente e o cliente aparecerá corretamente na lista de industriais.

