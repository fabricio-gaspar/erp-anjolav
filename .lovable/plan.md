

# Corrigir tema inconsistente entre usuários

## Problema
O tema é uma configuração **global** (tabela `configuracoes_gerais`), então todos os usuários deveriam ver o mesmo tema. O que acontece é:

1. Quando o admin faz logout, as variáveis CSS inline ficam no `:root` do documento (do tema que o admin estava usando)
2. A página de Login **não está dentro do AppLayout**, então não re-aplica o tema
3. Quando o funcionário faz login e o AppLayout monta, pode haver um flash ou delay antes do tema ser aplicado
4. Se o admin alterou o tema durante sua sessão (via configurações) mas o valor salvo no banco é diferente, há inconsistência

## Solução

Mover a aplicação do tema para um nível mais alto (ex: `App.tsx` ou criar um `ThemeProvider`), para que o tema seja aplicado **independentemente** da rota — inclusive na tela de Login.

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Adicionar um componente `ThemeLoader` que carrega e aplica o tema globalmente, envolvendo todas as rotas |
| `src/components/layout/AppLayout.tsx` | Remover o `useEffect` de tema (não é mais responsabilidade do layout) |

### Detalhes do `ThemeLoader`
- Componente simples que usa `useConfiguracoesGerais` + `useEffect` para aplicar o tema
- Fica no topo da árvore de componentes, dentro do `QueryClientProvider` mas acima do `RouterProvider`
- Garante que o tema é consistente em todas as páginas (Login, Dashboard, etc.)
- Ao fazer logout e login com outro usuário, o tema global é o mesmo pois vem da mesma tabela

