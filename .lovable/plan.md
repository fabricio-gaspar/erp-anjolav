

# Correcao: Data/Hora no ROL e Quantidade na Etiqueta

## Problema 1: Data mostrando dia anterior

**Causa raiz**: No modulo Lancamento, o campo `dataEmissao` vem de um input `type="date"` como string `"2026-03-05"`. Ao fazer `new Date("2026-03-05")`, o JavaScript interpreta como **meia-noite UTC**, que no fuso do Brasil (UTC-3) vira **04/03/2026 21:00** — exatamente o que aparece na imagem.

O mesmo problema ocorre em `fetchOSPrintData` (linha 142), onde `new Date(ordem.created_at)` pode mostrar hora errada se o timestamp UTC nao for ajustado.

**Correcao**: Usar `new Date(dateString + 'T00:00:00')` para datas de input (interpreta como horario local) e `new Date()` para data de emissao no momento da impressao. Tambem corrigir a exibicao de hora no ROL para usar horario local correto.

## Problema 2: Quantidade pouco clara na etiqueta

**Situacao atual**: A etiqueta mostra `CAMISA x3` — mas so quando `quantidade > 1`. Se for 1 peca, nao mostra nada.

**Correcao**: Sempre exibir a quantidade com destaque visual separado. Formato proposto:

```text
CAMISA
QTD: 3 peças
```

Em vez do formato inline `CAMISA x3`.

## Alteracoes

| Arquivo | O que muda |
|---|---|
| `src/services/printService.ts` | Corrigir criacao de Date para usar fuso local; melhorar template da etiqueta com quantidade separada e destacada |
| `src/hooks/usePrintOS.ts` | Corrigir `new Date(dataEmissao)` no `printROLFromData` e `printEtiquetaFromData` |
| `src/components/lancamentos/NovoLancamentoTab.tsx` | Corrigir `new Date(dataEmissao)` na construcao do `LancamentosPrintData` |

### Detalhes tecnicos

**Data** — Em 3 pontos:
- `NovoLancamentoTab.tsx` linha 159: `new Date(dataEmissao)` → `new Date(dataEmissao + 'T00:00:00')`
- `printService.ts` linha 142: `new Date(ordem.created_at)` — este ja vem como timestamp ISO completo do banco, esta OK. Mas a exibicao no ROL (linha 288) usa `toLocaleTimeString` que ja mostra horario local — precisa apenas garantir que o Date foi criado corretamente.
- `usePrintOS.ts` linhas 224 e 251: `data.dataEmissao` ja e um Date recebido do componente — a correcao e no componente que cria o Date.

**Etiqueta** — Na funcao `generateEtiquetaHTMLWithData` e `generateMultipleItemLabelsHTML`:
- Substituir `${data.produtoNome}${data.quantidade > 1 ? ' x' + data.quantidade : ''}` por duas linhas separadas:
  - Linha 1: Nome do produto (bold, uppercase)
  - Linha 2: `QTD: X peça(s)` (sempre visivel, fonte destacada)
- Adicionar estilo CSS `.quantidade` com fonte bold, background sutil

