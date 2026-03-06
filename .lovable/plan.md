

# Melhorias no Formulário Nova Despesa

## Problemas Identificados

1. **Campo Valor nao aceita entrada**: O `Input` usa `type="number"` com `step="0.01"`, mas o valor do fornecedor vem com 3 casas decimais (ex: `1.518`), o que causa conflito com a validacao HTML. Alem disso, o componente `Input` aplica `toUpperCase()` que pode interferir. Solucao: remover `type="number"` e usar input de texto com mascara monetaria (aceita virgula e ponto).

2. **Categorias fixas**: Nao ha como adicionar novas categorias. Solucao: adicionar botao "+" ao lado do Select de categorias que abre um mini-input inline para digitar uma nova categoria e adiciona-la a lista.

3. **Valor do fornecedor**: Ja esta sendo puxado corretamente (`f.valor_recorrente`), mas precisa formatar para exibicao adequada no campo.

## Mudancas

### Arquivo: `src/components/contas/NovaContaPagarModal.tsx`

**1. Campo Valor — Substituir por input monetario**
- Remover `type="number"` e `step="0.01"`
- Adicionar `skipUppercase` no Input
- Usar formatacao monetaria: aceitar virgula como separador decimal
- No submit, converter `formData.valor` (substituindo `,` por `.`) para `parseFloat`
- Quando o fornecedor e selecionado, formatar o valor com 2 casas decimais e virgula

**2. Categorias — Botao "+" para adicionar novas**
- Adicionar estado `categoriasCustom` que combina a lista padrao com categorias adicionadas pelo usuario
- Ao lado do Select de categoria, colocar um botao "+" que mostra um input inline
- O usuario digita a nova categoria e clica em confirmar — ela e adicionada a lista e selecionada automaticamente
- As categorias customizadas ficam na sessao (nao precisa de tabela no banco por enquanto — e uma melhoria simples)

**3. Corrigir warning de controlled/uncontrolled**
- O Select de fornecedor usa `value={formData.fornecedor_id || undefined}` — quando `fornecedor_id` e `""`, passa `undefined`, causando o warning. Corrigir para usar string vazia controlada ou manter consistente.

## Resumo de Alteracoes

| Arquivo | Acao |
|---|---|
| `src/components/contas/NovaContaPagarModal.tsx` | Corrigir input valor, adicionar "+" categorias, fix controlled warning |

