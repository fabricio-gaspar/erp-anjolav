# Padronização da máscara de valor monetário (R$ 1.250,30)

## Objetivo
Garantir que todo campo de entrada de valor em dinheiro do sistema use a máscara brasileira padrão: separador de milhar com ponto e duas casas decimais com vírgula (ex.: `1.250,30`), com prefixo `R$` visível quando aplicável.

## Estratégia

Criar um componente reutilizável `CurrencyInput` baseado no `Input` do shadcn que:
- Aplica `formatCurrencyInput` enquanto digita (já existe em `src/lib/currencyUtils.ts`).
- Exibe o prefixo `R$` à esquerda dentro do campo.
- Expõe `value: string` (formatado) e `onValueChange(numeric: number, formatted: string)` para facilitar integração.
- Aceita `value` numérico inicial e converte com `formatNumberToCurrency`.
- Desabilita o auto-uppercase do `Input` global e bloqueia caracteres inválidos.

Depois, substituir os campos de valor existentes pelos novos `CurrencyInput`, ajustando o submit de cada formulário para usar `parseCurrencyToNumber` em vez de `parseFloat`.

## Arquivos a criar
- `src/components/ui/currency-input.tsx` — componente reutilizável.

## Arquivos a ajustar (campos de valor identificados)

Caixa / PDV:
- `src/components/caixa/AbrirCaixaModal.tsx` (valor inicial)
- `src/components/caixa/FecharCaixaModal.tsx` (valor contado)
- `src/components/caixa/SangriaModal.tsx` (valor)
- `src/components/caixa/SuprimentoModal.tsx` (valor)
- `src/components/caixa/PagamentoModal.tsx` (valor recebido / troco)
- `src/components/caixa/ReceberPagamentoModal.tsx` (valor recebido)

Contas a Pagar:
- `src/components/contas/NovaContaPagarModal.tsx` (valor)
- `src/components/contas/EditarContaPagarModal.tsx` (valor / valor pago)

Clientes / Contrato / Preços:
- `src/components/clientes/ClienteContrato.tsx` (valor mensal, multas, etc.)
- `src/components/clientes/ClienteTabelaPrecos.tsx` (preços especiais)

Produtos:
- `src/components/produtos/ProdutoForm.tsx` (preço padrão / custo)

Faturamento / Lançamentos:
- `src/components/faturamento/EditarLancamentoModal.tsx` (valor unitário / total)
- `src/components/lancamentos/NovoLancamentoTab.tsx` (valor item)
- `src/components/lancamentos/HistoricoROLsTab.tsx` (se houver edição de valor)

RH / Folha:
- `src/components/configuracoes/FichaFuncionarioModal.tsx` (salário, vales)
- `src/components/configuracoes/FolhaPagamentoTab.tsx` (valores da folha)
- `src/components/configuracoes/FolhaBeneficiosPopover.tsx` (já usa utils — apenas migrar para o componente)
- `src/components/configuracoes/ConfiguracoesEquipe.tsx` (salário/vale-transporte)

Fornecedores:
- `src/pages/Fornecedores.tsx` (caso reaparecem campos de valor — após remoção de pagamento recorrente, validar se ainda há).

Configurações Gerais:
- `src/components/configuracoes/ConfiguracoesGeral.tsx` (taxas, valores default)

Produção / Outros:
- `src/components/producao/FormularioEtapa.tsx` (caso possua valor)

## Critérios de aceite
- Todos os inputs acima exibem `R$` e formatam automaticamente enquanto o usuário digita.
- Submissões salvam valor numérico correto no banco (via `parseCurrencyToNumber`).
- Valores carregados do banco são exibidos formatados (`formatNumberToCurrency`).
- Não há regressão visual: alturas, tamanhos e variantes preservados.

## Detalhes técnicos
- Reutilizar `formatCurrencyInput`, `parseCurrencyToNumber`, `formatNumberToCurrency` de `src/lib/currencyUtils.ts` (já em conformidade com a memória de formatação BR).
- O `Input` base força uppercase; o novo `CurrencyInput` passará `skipUppercase` e `inputMode="decimal"`.
- Não alterar lógica de negócio nem queries — apenas camada de apresentação e parsing de entrada.
