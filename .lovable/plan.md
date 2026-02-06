
# Simplificar Cards de Produtos

## O que muda

Os cards de produtos serao reduzidos ao essencial para caber mais itens na tela. Atualmente cada card mostra muitas informacoes (badge de unidade de negocio, temperatura, tempo de processo, badge de processo, preco). O objetivo e mostrar apenas o necessario para identificar o produto rapidamente.

## Card simplificado - apenas 3 informacoes

Cada card tera apenas:

1. **Nome do produto** (com indicador de status - bolinha verde/amarela)
2. **Preco** com unidade (ex: R$ 8,00 /Peca)

As informacoes removidas da visualizacao principal:
- Badge de unidade de negocio (Industrial/Residencial)
- Temperatura maxima
- Tempo de processo
- Badge de tipo de processo (Normal, Delicado, etc.)

Essas informacoes continuam disponiveis ao **editar** o produto.

## Layout do card simplificado

```text
+---------------------------+
| NOME DO PRODUTO        *  |
| R$ 8,00 /Peca             |
+---------------------------+
```

- Bolinha de status (*) no canto superior direito
- Nome em negrito, 1 linha com truncamento
- Preco em destaque na cor primaria
- Acoes (editar, duplicar, excluir) aparecem no hover como ja funciona hoje

## Grid mais denso

O grid sera ajustado para caber mais colunas:
- Atual: `grid-cols-2 sm:3 md:4 lg:5 xl:6`
- Novo: `grid-cols-3 sm:4 md:5 lg:6 xl:7`

## Reducao do padding

O padding interno do card sera reduzido de `p-3` para `p-2` e o gap entre cards de `gap-3` para `gap-2`.

---

## Arquivos modificados

### `src/components/produtos/ProdutoCard.tsx`
- Remover as linhas de temperatura e tempo de processo (icones Thermometer e Clock)
- Remover o badge de processo de lavagem
- Remover o badge de unidade de negocio (Industrial/Residencial)
- Manter apenas: nome, bolinha de status e preco
- Reduzir padding de `p-3` para `p-2`
- Remover a borda separadora (`border-t`) antes do preco
- Remover imports nao utilizados (Thermometer, Clock, Badge, PROCESSOS_LAVAGEM)

### `src/pages/Produtos.tsx`
- Ajustar grid para mais colunas: `grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7`
- Reduzir gap de `gap-3` para `gap-2`
