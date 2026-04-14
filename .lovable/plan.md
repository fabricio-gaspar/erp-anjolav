
## Plano: Cards de produtos menores e quadrados no PDV

### Alteração em `src/pages/CaixaPDV.tsx`

#### Grid (linha 738)
- Aumentar colunas: `grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2`

#### Card/button (linhas 748-777)
- Reduzir padding: `p-2` em vez de `p-3`
- Forçar formato quadrado: `aspect-square` + `flex flex-col justify-between`
- Reduzir tamanho do nome: `text-xs` com `line-clamp-2`
- Reduzir tamanho do preço: `text-sm font-bold` em vez de `text-lg font-bold`
- Código do produto: manter `text-[10px]`
- Remover unidade label para economizar espaço

### Resultado
Cards compactos, quadrados, mostrando apenas nome e preço, com mais produtos visíveis por linha.
