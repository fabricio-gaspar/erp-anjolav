## Objetivo

Simplificar a aba **Folha de Pagamento** (Configurações → Equipe → Folha) para mostrar apenas:
- O **salário cheio** pago a cada funcionário.
- Uma coluna **Benefícios** com os tipos pré-cadastrados (cada um em uma cor), com campo de valor para os que a empresa fornece.
- **Custo Total Empresa** (salário + benefícios + encargos) preservado nos cards.

Remover da tela: Horas Extras, Comissões, Descontos, Líquido a Pagar.

## Mudanças na tabela da Folha

**Colunas finais:**
1. Funcionário (nome, cargo, empregador)
2. Salário (somente leitura, valor cheio cadastrado na ficha)
3. Benefícios (8 chips coloridos editáveis)
4. Total Benefícios
5. Status
6. Ações (excluir)

**Tipos de benefícios pré-cadastrados (cada um com cor própria):**

| Tipo | Cor (token semântico) | Campo no banco |
|---|---|---|
| Vale Transporte (VT) | azul | `vale_transporte` |
| Vale Alimentação (VA) | verde | `vale_alimentacao` |
| Vale Refeição (VR) | laranja | `vale_refeicao` |
| Plano de Saúde | vermelho/rosa | `plano_saude` |
| Plano Odontológico | ciano | `plano_odontologico` |
| Cesta Básica | âmbar | `desconto_cesta_basica` (renomeado visualmente como benefício; valor positivo) |
| Bonificação | roxo | `gratificacao` |
| Outros | cinza | `outros_beneficios` |

Cada chip mostra: ícone/label + `CurrencyInput` compacto. Se valor 0, fica esmaecido. Edição salva via `useUpdateFolha` (debounce no blur).

## Cards de totais

Mantidos 3 cards:
- **Total Salários** (soma dos `salario_base`)
- **Total Benefícios** (soma de todos os 8 campos acima)
- **Custo Total Empresa** (salários + benefícios + encargos 36% sobre salário)

Removidos: Total Descontos, Líquido a Pagar.

## Fechamento da folha

`useFecharFolhaMes` continua criando conta a pagar por funcionário, mas o valor lançado passa a ser **salário + benefícios** (em vez de líquido). Categoria continua `folha_pagamento`.

## Benefícios extras (popover existente)

`FolhaBeneficiosPopover` permanece disponível para benefícios/descontos avulsos não previstos nos 8 tipos fixos. Sem mudanças.

## Arquivos a alterar

- `src/components/configuracoes/FolhaPagamentoTab.tsx` — refatorar tabela e cards.
- `src/components/configuracoes/FolhaBeneficiosChips.tsx` *(novo)* — componente de 8 chips coloridos editáveis.
- `src/hooks/useFolhaPagamento.ts` — ajustar `calcularTotaisFolha` para zerar descontos não usados na UI e no fechamento usar `salario + beneficios`.
- `src/index.css` / `tailwind.config.ts` — adicionar tokens de cor para os tipos de benefício se ainda não existirem (HSL semânticos).

## Sem mudanças

- Schema do banco (campos já existem em `folha_pagamento`).
- Ficha do funcionário (continua sendo a fonte do salário cheio).
- Relatório mensal e popover de extras.
