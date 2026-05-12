## Objetivo

Tornar a coluna **Benefícios** compacta e permitir que o usuário **cadastre seus próprios tipos de benefício** (com cor) e atribua **valores diferentes para cada funcionário**.

## Banco de dados

**Nova tabela `beneficios_catalogo`** (gerenciada pelo admin)
- `nome` (texto, único)
- `cor` (texto — token de cor: blue, green, orange, rose, cyan, amber, purple, slate)
- `ordem` (int, para ordenação)
- `ativo` (bool)
- RLS: select para autenticados; insert/update/delete só admin

**Reaproveitar tabela existente `folha_beneficios`** para os valores por funcionário/competência
- Já tem: `folha_id`, `funcionario_id`, `nome`, `categoria`, `tipo`, `valor`
- Adicionar coluna `beneficio_id` (FK lógica para `beneficios_catalogo`, nullable para retrocompatibilidade)
- Único por (`folha_id`, `beneficio_id`) para evitar duplicidade

Os campos fixos `vale_transporte`, `vale_alimentacao`, etc. em `folha_pagamento` deixam de ser usados pela UI nova (continuam no banco para histórico).

## UI — Aba "Folha de Pagamento"

Coluna **Benefícios** vira uma única célula compacta com botão:

```text
[ + Benefícios (3) · R$ 850,00 ]
```

- Sem chips na linha — economiza espaço.
- Badge com contagem de benefícios ativos do funcionário no mês.
- Total em R$ ao lado.

Ao clicar abre **Popover** (largura ~340px) com:
- Lista de todos os tipos do catálogo (cada um com bolinha colorida + nome).
- `CurrencyInput` compacto à direita de cada tipo.
- Salvamento on-blur via upsert em `folha_beneficios`.
- Rodapé: "Total: R$ 850,00".
- Tipos com valor 0 ficam visíveis mas esmaecidos.

## Nova aba "Benefícios" em Configurações → Equipe

Tela simples de CRUD:
- Lista com bolinha de cor + nome + switch ativo + botões editar/excluir.
- Botão "+ Novo Benefício" abre dialog com: nome, seletor de cor (8 opções pré-definidas com swatches), ativo.
- Drag handle opcional para reordenar (ou apenas campo número de ordem).

## Cards de totais

Mantidos: **Total Salários**, **Total Benefícios** (somatório de `folha_beneficios` da competência), **Custo Total Empresa** (salário + benefícios + 36% encargos).

## Fechamento da folha

`useFecharFolhaMes` recalcula valor da conta a pagar como `salario_base + soma(folha_beneficios da folha)`.

## Arquivos

**Migração:**
- Criar `beneficios_catalogo` + RLS + seed com 8 tipos atuais (VT, VA, VR, Saúde, Odonto, Cesta, Bonificação, Outros) com suas cores.
- Adicionar `beneficio_id` em `folha_beneficios`.

**Novos:**
- `src/hooks/useBeneficiosCatalogo.ts` — CRUD + lista.
- `src/components/configuracoes/BeneficiosCatalogoTab.tsx` — aba CRUD.
- `src/components/configuracoes/FolhaBeneficiosCompactPopover.tsx` — botão + popover compacto.

**Editar:**
- `src/components/configuracoes/FolhaPagamentoTab.tsx` — substituir `FolhaBeneficiosChips` pelo popover compacto; recalcular total a partir de `folha_beneficios`.
- `src/components/configuracoes/ConfiguracoesEquipe.tsx` — adicionar aba "Benefícios".
- `src/hooks/useFolhaBeneficios.ts` — adicionar mutation `upsertValorBeneficio` por (folha_id, beneficio_id) e somatório por folha.
- `src/hooks/useFolhaPagamento.ts` — fechamento usa soma de `folha_beneficios` em vez dos campos fixos.

**Remover do uso (mantém arquivo):**
- `FolhaBeneficiosChips.tsx` deixa de ser referenciado (pode ser excluído depois).
