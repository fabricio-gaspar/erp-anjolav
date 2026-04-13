

## Plano: Compactar menu lateral para dispositivos móveis

### Problema
No mobile (390px), o menu lateral (Sheet) ocupa `w-72` (288px) — quase toda a tela. Os ícones e espaçamentos são os mesmos do desktop, ficando desproporcionalmente grandes.

### Solução
Reduzir o tamanho do menu e compactar os itens quando `isMobile` estiver ativo.

### Alterações

#### 1. `src/components/layout/AppLayout.tsx`
- Reduzir largura do Sheet de `w-72` para `w-60` (240px)

#### 2. `src/components/layout/AppSidebar.tsx`
- Receber e propagar `isMobile` para os componentes internos
- Quando mobile:
  - **Logo**: Reduzir altura de `h-14` para `h-12`, ícone de `w-9 h-9` para `w-7 h-7`
  - **NavItem**: Reduzir padding de `px-3 py-2.5` para `px-2.5 py-1.5`, ícones de `w-5 h-5` para `w-4 h-4`, texto `text-xs`
  - **NavGroup**: Mesmo tratamento nos botões do grupo, padding menor
  - **UserSection**: Avatar de `w-9 h-9` para `w-7 h-7`, texto menor
  - **Nav container**: Reduzir `space-y-1` e padding geral

### Resultado
Menu mais compacto no mobile, com todos os itens visíveis sem scroll excessivo, proporcional ao tamanho da tela.

