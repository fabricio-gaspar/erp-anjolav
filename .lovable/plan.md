
# Ajuste definitivo de largura e apresentação das telas

## Diagnóstico real
O problema principal não está no banco nem em uma única tela:
- o layout base já ocupa a largura total, então o sistema não está “preso” por `#root`
- o efeito de tela estreita vem de componentes de formulário e páginas com largura visual limitada
- no `Fornecedores`, o modal ainda está pequeno para a quantidade de campos e usa grids fixos de 2 e 3 colunas, o que deixa tudo apertado
- há outros pontos iguais no sistema, principalmente em `Estoque` e no cadastro de `Clientes`

## O que vou corrigir
1. Criar um padrão definitivo para telas e modais largos
   - padronizar uma variante de modal largo para formulários extensos
   - manter dialogs de confirmação pequenos e deixar só os cadastros principais mais amplos
   - aplicar largura baseada em viewport, não só `max-w-2xl`

2. Reorganizar o modal de `Novo Fornecedor`
   - ampliar para um modal realmente largo
   - dividir o conteúdo em blocos visuais mais claros: dados básicos, endereço, pagamento recorrente, observações
   - trocar grids rígidos por grids responsivos (`1 / 2 / 3 colunas por breakpoint`)
   - melhorar espaçamento interno e alinhamento dos botões

3. Aplicar o mesmo padrão aos cadastros que hoje continuam apertados
   - `Novo/Editar Insumo`
   - `Entrada de Estoque`
   - `Saída de Estoque`
   - telas de cadastro do módulo `Clientes` com foco nas abas de formulário

4. Melhorar a apresentação das páginas principais
   - garantir uso consistente de `content-panel`
   - reforçar headers, filtros e áreas de tabela com composição mais larga e equilibrada
   - evitar sensação de “coluna estreita no meio da tela”

## Arquivos que entram no ajuste
- `src/components/ui/dialog.tsx`
- `src/index.css`
- `src/pages/Fornecedores.tsx`
- `src/pages/Estoque.tsx`
- `src/components/estoque/EntradaEstoqueModal.tsx`
- `src/components/estoque/SaidaEstoqueModal.tsx`
- `src/pages/Clientes.tsx`
- `src/components/clientes/ClienteDadosBasicos.tsx`
- `src/components/clientes/ClienteEndereco.tsx`
- `src/components/clientes/ClientePagamento.tsx`
- `src/components/clientes/ClienteConfiguracao.tsx`
- `src/components/clientes/ClienteContrato.tsx`

## Abordagem técnica
- adicionar classes reutilizáveis para modal de formulário largo e seções internas
- usar algo no padrão:
  - largura: quase toda a viewport em telas grandes
  - altura: limitada com rolagem interna
  - grids responsivos com `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`
- evitar mudanças globais perigosas em dialogs pequenos; o ajuste largo será aplicado só onde faz sentido

## Resultado esperado
- o modal de `Novo Fornecedor` ficará claramente mais largo e confortável
- os campos deixarão de parecer espremidos
- as telas principais terão visual mais “aberto”, profissional e consistente
- o problema deixa de ser pontual e passa a ter um padrão visual reaproveitável no sistema inteiro

## Observação
Nenhuma migração de banco é necessária. Esta correção é 100% de interface e responsividade.
