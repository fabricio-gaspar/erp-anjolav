# Fluxo de Produção integrado com a Agenda

Hoje o **Fluxo de Produção** mostra apenas OS já criadas, e a **Agenda de Retiradas** vive separada. O motorista precisa abrir a OS manualmente. O objetivo é unificar: tudo que está agendado aparece automaticamente na primeira coluna; o motorista confirma a retirada; a OS é criada e segue o fluxo; ao ser entregue, sai do quadro e vai para uma lista de **Finalizadas**.

## 1. Novo desenho do quadro (mais curto e organizado)

Hoje são **8 colunas** (Retirado, Separação, Lavagem, Secagem, Passadoria, Embalagem, Pronto Entrega, Entregue). Proposta enxuta de **6 colunas visíveis** + 1 arquivo:

```text
┌────────────┬───────────┬──────────┬───────────┬───────────┬──────────────┐
│ AGUARDANDO │ SEPARAÇÃO │ LAVAGEM  │ ACABAMENTO│ EMBALAGEM │ PRONTO/SAIU  │
│  RETIRADA  │           │ + SECAGEM│ (passad.) │           │ P/ ENTREGA   │
└────────────┴───────────┴──────────┴───────────┴───────────┴──────────────┘
                                                                    │
                                                                    ▼
                                                        [ Lista: Finalizadas ]
```

Mudanças:
- **Aguardando Retirada** = mistura de *agendamentos do dia* (ainda sem OS) + *OS já com status "retirada"* (motorista pegou mas ainda não chegou no galpão).
- **Lavagem + Secagem** viram uma coluna só (são processos contínuos da mesma máquina/fluxo).
- **Pronto / Saiu para entrega** combina `expedicao` em uma única coluna com badge "saiu".
- **Entregue** sai do kanban e vira uma aba/lista lateral chamada **Finalizadas (hoje)** com filtro por data.

Resultado: quadro cabe em tela 1366px sem scroll horizontal.

## 2. Cards de "agendamento" na coluna Aguardando Retirada

Na primeira coluna aparecem dois tipos de card:

- **Card cinza (Agendado)**: vem de `agendamentos` com `tipo='retirada'` e `data` ≤ hoje, status `agendado`/`confirmado`. Mostra cliente, horário, motorista designado e botão **"Confirmar Retirada"**.
- **Card normal (Em rota)**: OS já criada com `status='retirada'`. Segue o fluxo clicando para avançar.

Ao clicar **Confirmar Retirada** no card cinza:
1. Cria automaticamente uma OS (`ordens_servico`) vinculada ao cliente, com `status='retirada'`, `origem='industrial'`, prioridade `normal` e link para o agendamento.
2. Marca o `agendamento.status = 'realizado'`.
3. Registra histórico em `historico_producao` (etapa "retirada", funcionário = motorista logado, observação "Retirada confirmada via app/kanban").
4. O card vira automaticamente "OS em rota" e segue o fluxo normal.

Isso permite que o motorista, pelo celular, abra o Fluxo de Produção e marque a retirada com 1 toque — sem precisar abrir tela de "Nova OS".

## 3. Saída do fluxo + lista de Finalizadas

Quando uma OS chega em **Pronto/Saiu para entrega** e o usuário clica para concluir:
- Status vira `entregue`, `data_entrega = now()`.
- O card **some do kanban** imediatamente.
- Aparece na nova seção **Finalizadas** (aba ao lado dos filtros) com 3 sub-abas:
  - **Em processo** (atalho que só destaca o que está no kanban — não é arquivo, mas dá visão de lista).
  - **Aguardando entrega** (status `expedicao` ainda não saiu).
  - **Finalizadas** (status `entregue`, com filtro de data, default = hoje).

## 4. Melhorias de UX no quadro

- Ícone de **moto/caminhão** no card quando é agendamento (diferenciar de OS).
- Badge de horário previsto da retirada destacado em vermelho se já passou.
- Botão flutuante "**+ Nova OS Avulsa**" no canto, para casos sem agendamento prévio.
- Contador no header agora mostra: `X aguardando · Y em produção · Z prontas`.

## Detalhes técnicos

**Frontend (`src/pages/FluxoProducao.tsx`)**
- Reduzir array `columns` para 6 (mesclar lavagem/secagem em uma; remover entregue do kanban).
- Adicionar fetch de `agendamentos` do dia (hook `useAgendamentos` já existe) ao lado de `useOrdensServico`.
- Construir `osByStatus['retirada']` concatenando: agendamentos pendentes (tipados como cards "agendamento") + OS com status `retirada`.
- Coluna "lavagem" agrupa `os.status in ('lavagem','secagem')`.
- Adicionar `<Tabs>` no topo: **Kanban** | **Aguardando entrega** | **Finalizadas**.
- Esconder cards `entregue` do kanban (já há lógica — basta remover a coluna).

**Novo card** `AgendamentoCard.tsx` em `src/components/producao/`:
- Recebe agendamento, mostra cliente/horário/motorista.
- Botão "Confirmar Retirada" → chama mutação `confirmarRetiradaAgendamento` que:
  - `INSERT` em `ordens_servico` (trigger gera número),
  - `UPDATE agendamentos SET status='realizado'`,
  - `INSERT historico_producao`,
  - invalida queries `ordensServico` e `agendamentos`.

**Backend (migration)**
- Adicionar coluna opcional `agendamento_id uuid` em `ordens_servico` para rastrear origem (sem FK rígida, igual ao padrão do projeto).
- Nenhuma RLS nova: políticas existentes já cobrem `authenticated`.

**Hook novo** `src/hooks/useFluxoProducao.ts` — agrega `ordensServico` + `agendamentos` do dia e expõe `cardsPorColuna` já mesclados, evitando lógica espalhada na página.

## Arquivos a editar/criar

- editar: `src/pages/FluxoProducao.tsx` (colunas, tabs, integração agendamentos)
- criar: `src/components/producao/AgendamentoCard.tsx`
- criar: `src/components/producao/FinalizadasLista.tsx`
- criar: `src/hooks/useFluxoProducao.ts`
- migration: adicionar `agendamento_id` em `ordens_servico`

## Fora de escopo (pode ficar para depois)

- Notificação push ao motorista quando agendamento é criado.
- Drag-and-drop entre colunas (hoje é clique).
- Reabertura de OS finalizada.