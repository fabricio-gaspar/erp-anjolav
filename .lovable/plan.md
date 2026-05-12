## Mudanças

**1. Resetar catálogo de benefícios** (via insert tool)
- `DELETE FROM beneficios_catalogo` (limpa os 8 antigos: VT, VA, VR, Saúde, Odonto, Cesta, Bonificação, Outros)
- Inserir 4 novos:
  - **Alimentação** — verde (green), ordem 1
  - **Refeição** — laranja (orange), ordem 2
  - **Transporte** — azul (blue), ordem 3
  - **Flex** — roxo (purple), ordem 4

**2. `FolhaPagamentoTab.tsx`**
- Remover import e uso do `FolhaBeneficiosPopover` (sistema antigo de texto livre)
- Manter apenas `FolhaBeneficiosCompactPopover` (catálogo)
- Coluna de ações fica só com botão de excluir folha

**3. Visual já existente** no `FolhaBeneficiosCompactPopover`
- Cada linha mostra bolinha colorida + nome do benefício + campo de valor
- Salva on-blur por funcionário/competência
- Usuário ainda pode editar/criar/desativar benefícios em Configurações → Equipe → Benefícios

## Arquivos
- `src/components/configuracoes/FolhaPagamentoTab.tsx` — editar
- Dados: reset da tabela `beneficios_catalogo`
