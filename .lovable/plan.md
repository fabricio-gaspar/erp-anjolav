

# Auditoria: Impressao de Etiquetas

## Problemas Encontrados

### 1. Etiquetas NAO mostram nome do produto nem quantidade
A interface `EtiquetaData` so contem: `osNumero`, `clienteNome`, `bloco`, `posicao`, `data`. Nenhum campo de produto/item existe. Todas as etiquetas impressas sao identicas — mostram apenas OS + cliente.

### 2. Modulo Lancamento — imprime apenas 1 etiqueta
Em `NovoLancamentoTab.tsx` (linha 164): `printEtiquetaFromData(data, 1)` — sempre imprime **1 unica etiqueta**, ignorando completamente os itens do carrinho.

### 3. Modulo Caixa PDV — imprime N copias identicas
Em `ImpressaoPosVendaModal.tsx`: imprime N etiquetas via `printEtiquetas(qty)`, mas sao **todas copias identicas** (mesmo conteudo repetido). Nao diferencia por produto.

### 4. `printMultipleEtiquetas` repete o mesmo label
A funcao em `printService.ts` (linha 295): `Array(quantidade).fill(labelContent).join('')` — literalmente duplica o mesmo HTML N vezes.

---

## Solucao Proposta

Alterar o sistema para imprimir **uma etiqueta por tipo de item**, mostrando o **nome do produto** e a **quantidade de pecas** na etiqueta. Se o carrinho tem 3 itens diferentes, saem 3 etiquetas diferentes.

### Alteracoes

**1. `EtiquetaData` (printService.ts)** — Adicionar campo opcional `produtoNome` e `quantidade`

**2. Template da etiqueta** — Mostrar nome do produto abaixo do cliente e quantidade (ex: "Camisa Social x5")

**3. `printMultipleEtiquetas` / `printEtiquetaFromOS`** — Buscar itens da OS (`itens_ordem_servico`) e gerar uma etiqueta POR item, com nome e quantidade

**4. `NovoLancamentoTab.tsx`** — Passar os itens do carrinho para `printEtiquetaFromData`, gerando uma etiqueta por item

**5. `usePrintOS.ts` (`useLancamentosPrint`)** — Atualizar `printEtiquetaFromData` para receber itens e gerar uma etiqueta por item

**6. `ImpressaoPosVendaModal.tsx`** — Ja usa `printEtiquetas(qty, osId)` que busca dados da OS. Basta que `printMultipleEtiquetas` passe a iterar pelos itens

### Resultado esperado

Carrinho com: Camisa x3, Calca x2, Terno x1 → imprime 3 etiquetas:
- Etiqueta 1: OS 00045 | Maria Silva | **Camisa x3** | codigo barras
- Etiqueta 2: OS 00045 | Maria Silva | **Calca x2** | codigo barras  
- Etiqueta 3: OS 00045 | Maria Silva | **Terno x1** | codigo barras

### Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/services/printService.ts` | Adicionar produto/qtd ao EtiquetaData e template; alterar printMultipleEtiquetas para iterar itens |
| `src/hooks/usePrintOS.ts` | Atualizar printEtiquetaFromData para gerar por item |
| `src/components/lancamentos/NovoLancamentoTab.tsx` | Passar itens ao imprimir etiquetas |
| `src/components/caixa/ImpressaoPosVendaModal.tsx` | Nenhuma mudanca necessaria (ja passa osId, a logica muda no service) |

