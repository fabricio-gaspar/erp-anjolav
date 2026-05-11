## Mudanças

### 1. Confirmar Retirada → vai direto para Separação
No hook `useConfirmarRetiradaAgendamento` (`src/hooks/useFluxoProducao.ts`):
- Alterar o `status` da OS criada de `"retirada"` para `"separacao"`.
- Atualizar o `historico_producao.etapa_nova` para `"separacao"`.
- Toast: "Retirada confirmada — OS X enviada para Separação".

No Kanban (`src/pages/FluxoProducao.tsx`):
- A coluna "Aguardando Retirada" continua mostrando apenas os agendamentos pendentes (cards de retirada).
- Ao confirmar, o card desaparece dessa coluna e a OS já aparece na coluna **Separação**.

### 2. Renomear e reposicionar menu
Em `src/components/layout/AppSidebar.tsx`, no grupo **Operacional**, reordenar:

```text
Antes:                          Depois:
- Ordens de Serviço             - Produção
- Produção                      - Relatório do Fluxo   (era "Ordens de Serviço", rota /ordens)
- Agenda                        - Agenda
- Agenda Pessoal                - Agenda Pessoal
```

A rota `/ordens` e a página continuam as mesmas — muda apenas o label e a ordem no menu.

## Fora de escopo
- Renomear a página interna (título dentro de `/ordens`) — só o item do menu, conforme pedido.
- Mudar lógica de outras etapas do Kanban.
