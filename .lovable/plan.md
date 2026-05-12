## Objetivo

Unificar **Funcionários + Folha + Benefícios** em uma única tela. Cada funcionário vira uma linha expansível que mostra/edita salário, adiantamento e benefícios (Alimentação, Refeição, Transporte, Flex) do **mês corrente**, sem precisar mudar de aba.

## Mudanças

### 1. `ConfiguracoesEquipe.tsx`
- **Remover** as abas `folha` e `beneficios` do `TabsList`.
- Manter apenas: Funcionários, Motoristas, Veículos.
- Remover imports de `FolhaPagamentoTab` e `BeneficiosCatalogoTab`.

### 2. `FuncionariosTab` (dentro do mesmo arquivo)
- Adicionar competência fixa = mês corrente (`format(new Date(), "yyyy-MM-01")`).
- Carregar todas as folhas do mês via `useFolhaPagamento(competencia)` e indexar por `funcionario_id`.
- Botão **"Gerar Folha do Mês"** discreto no topo (chama `useGerarFolhaMes`) — só aparece se houver funcionário ativo sem folha gerada.
- Em cada linha de funcionário, adicionar botão chevron que expande um painel inline contendo:
  - Linha 1 (salário): `Adiantamento` + `Pagamento (salário)` (componentes `SalarioField` reutilizados).
  - Linha 2 (benefícios): os 4 benefícios do catálogo lado a lado, cada um com bolinha colorida + nome + `CurrencyInput`, salvando on-blur via `useUpsertFolhaBeneficio`.
  - Mini-resumo: Total a pagar do mês = salário + benefícios.
- Se não houver folha do mês para aquele funcionário, mostrar botão "Gerar folha deste mês" inline (gera só para ele) ou desabilitar os campos com aviso.

### 3. Componente novo `FuncionarioFolhaInline.tsx`
- Recebe `funcionarioId`, `folha` (ou null) e `competencia`.
- Renderiza adiantamento + pagamento + benefícios coloridos (reusa lógica de `FolhaBeneficiosCompactPopover`, mas em layout horizontal expandido em vez de popover).

### 4. Manter
- `FolhaPagamentoTab.tsx`, `BeneficiosCatalogoTab.tsx`, `FolhaBeneficiosCompactPopover.tsx` ficam no projeto (usados em outros lugares ou para futuro), mas saem da navegação de Configurações → Equipe.
- Catálogo de benefícios (Alimentação, Refeição, Transporte, Flex) já está populado — sem mudança de banco.
- "Fechar Folha" continua funcional, mas será movido para um botão único no topo da aba Funcionários ("Fechar Folha do Mês"), abrindo o mesmo `AlertDialog` com data de pagamento.

## Arquivos
- `src/components/configuracoes/ConfiguracoesEquipe.tsx` — editar (remover 2 tabs, expandir FuncionariosTab)
- `src/components/configuracoes/FuncionarioFolhaInline.tsx` — criar
- Sem mudanças de banco.