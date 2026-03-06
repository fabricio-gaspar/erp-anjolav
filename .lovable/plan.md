

# Correcao do formato de valor (R$ 1.518,00) e formularios desconectados

## Problemas encontrados

### 1. Formato de valor incorreto — NAO suporta milhar
O usuario quer o formato brasileiro completo: `1.518,00` (ponto como separador de milhar, virgula para decimais). Atualmente:
- **NovaContaPagarModal**: aceita `0-9.,` mas sem mascara — o `parseFloat("1.518,00".replace(",", "."))` resulta em `1.518` (errado!)
- **EditarContaPagarModal**: AINDA usa `type="number"` — nunca foi corrigido
- **Fornecedores**: mesmo problema de parsing sem mascara de milhar
- **ContasPagar (tabela)**: `formatCurrency` nao formata milhar (`1518` aparece como `R$ 1518,00` em vez de `R$ 1.518,00`)

### 2. EditarContaPagarModal desatualizado
- Campo valor com `type="number"` (quebrado)
- Sem botao "+" para categorias customizadas
- Sem campo de fornecedor vinculado (so texto livre)

## Plano de correcao

### Criar funcao utilitaria de moeda (`src/lib/currencyUtils.ts`)
- `formatCurrencyInput(value: string): string` — formata enquanto digita: `1518` → `1.518,00`, `1518,5` → `1.518,50`
- `parseCurrencyToNumber(value: string): number` — converte display para numero: `1.518,00` → `1518.00`
- `formatNumberToCurrency(value: number): string` — formata numero para display: `1518` → `1.518,00`

### Corrigir NovaContaPagarModal
- Usar `parseCurrencyToNumber` no submit (em vez de `replace(",", ".")`)
- Usar `formatNumberToCurrency` no `handleFornecedorSelect`
- Aplicar mascara no onChange do campo valor

### Corrigir EditarContaPagarModal
- Remover `type="number"` e `step="0.01"` do campo valor
- Adicionar `skipUppercase` e mascara monetaria
- Usar `parseCurrencyToNumber` no submit
- Formatar valor ao carregar conta (`useEffect`)

### Corrigir Fornecedores
- Aplicar mascara no campo valor do formulario
- Corrigir `salvar()` para usar `parseCurrencyToNumber`
- Corrigir display na tabela com formato milhar

### Corrigir ContasPagar (tabela)
- Atualizar `formatCurrency` para usar `toLocaleString('pt-BR')` com separador de milhar

## Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `src/lib/currencyUtils.ts` | **NOVO** — funcoes de formatacao monetaria BR |
| `src/components/contas/NovaContaPagarModal.tsx` | Usar mascara e parser correto |
| `src/components/contas/EditarContaPagarModal.tsx` | Corrigir campo valor, adicionar skipUppercase |
| `src/pages/Fornecedores.tsx` | Usar mascara e parser correto |
| `src/pages/ContasPagar.tsx` | Formatar valores com milhar na tabela |

