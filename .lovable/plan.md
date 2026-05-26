
# Análise + Plano de Reorganização do Sistema (ERP)

> Plano em duas partes: **(A) Diagnóstico do que existe hoje** e **(B) Reorganização proposta** com diagramas, padronizações e migrations incrementais. Nada é recriado do zero — tudo se apoia em tabelas e componentes já existentes.

---

## A) DIAGNÓSTICO DO SISTEMA ATUAL

### A.1 Mapa de módulos existentes (resumo)

**Cadastros / Operacional**
- `clientes`, `enderecos_clientes`, `configuracoes_cliente`, `configuracoes_pagamento_cliente`
- `fornecedores`
- `produtos` (não listada acima, mas usada por `useProdutos`)
- `funcionarios`, `folha_pagamento`, `folha_beneficios`, `beneficios_catalogo`
- `estoque_produtos`, `movimentacoes_estoque`

**Operação / Produção**
- `ordens_servico`, `historico_producao`, `lotes_producao`
- `agendamentos`, `eventos_agenda`
- `lancamentos` (ROL industrial) + `itens_lancamento`

**Financeiro (estado atual — fragmentado)**
- `contas_pagar` (despesas)
- `faturas` (recebíveis do industrial gerados a partir de `lancamentos`)
- `asaas_charges` (cobranças externas via Asaas) — usado como “Contas a Receber” na UI
- `caixas` + `caixa_movimentacoes` (PDV Loja)
- `contratos_aluguel` + `itens_contrato_aluguel`
- `configuracoes_fiscais`, `historico_envios`

**Telas existentes (`src/pages`)**
- `Contas.tsx` (abas: A Receber → `ContasReceberContent` lendo `asaas_charges`; A Pagar → `ContasPagarContent` lendo `contas_pagar`)
- `ContasPagar.tsx`, `ContasReceber.tsx` (duplicadas, hoje redirecionam para `/contas`)
- `CaixaPDV.tsx` (PDV Loja), `HistoricoCaixas.tsx`
- `Lancamentos.tsx` (PDV Industrial), `Faturamento.tsx`
- `DashboardFinanceiro.tsx`, `RelatorioFinanceiro.tsx`, `RelatorioMensal.tsx`
- `Fornecedores.tsx`, `Clientes.tsx`, `Produtos.tsx`, `Estoque.tsx`

### A.2 Inconsistências e problemas identificados

1. **Dois "Contas a Receber" desconectados**
   - UI A Receber usa apenas `asaas_charges`.
   - `faturas` (industrial) e `caixa_movimentacoes` (loja) **não aparecem** em A Receber, mas aparecem no `RelatorioMensal` e no `DashboardFinanceiro`. Resultado: total de recebíveis nunca bate.

2. **Categorias financeiras como string livre**
   - `contas_pagar.categoria` é texto. `useRelatorioMensal` faz `if isCat(c.categoria, ["produtos_insumos","Insumos","produtos"])` — frágil, sem normalização, sem centro de custo.

3. **Sem Centro de Custo**
   - Nada modela `centro_custo` em despesa/receita. Impossível DRE por unidade (Industrial vs Loja).

4. **Status de `contas_pagar` incompleto**
   - Hoje: `pendente | pago | vencido`. Faltam: `parcial`, `cancelado`. "Vencido" deveria ser **calculado**, não armazenado (gera divergência).

5. **PDV Loja não gera registro contábil em recebíveis**
   - `caixa_movimentacoes` registra a venda, mas não há entidade unificada que represente "entrada financeira", então o Fluxo de Caixa precisa unir 3 fontes manualmente (faturas, asaas, caixa).

6. **Tabelas redundantes / sobrepostas**
   - `RelatorioFinanceiro.tsx` + `DashboardFinanceiro.tsx` + `RelatorioMensal.tsx` reimplementam agregações semelhantes em hooks diferentes (`useRelatorioFinanceiro`, `useDashboardFinanceiro`, `useRelatorioMensal`).
   - Páginas `ContasPagar.tsx` e `ContasReceber.tsx` estão obsoletas (`/contas` já é a tela ativa).

7. **`asaas_charges` não tem `cliente_id`**
   - Liga-se ao cliente por `customer_name` / `customer_cpf_cnpj`. Inviabiliza relatórios "receita por cliente" consistentes.

8. **Período fixo no mês atual**
   - `useDashboardFinanceiro` não recebe range; `RelatorioMensal` é mês-fechado. Relatórios precisam aceitar **período arbitrário**.

9. **Nomenclatura inconsistente**
   - `caixa_movimentacoes.tipo` em CAIXA ALTA (`VENDA`, `SANGRIA`), `faturas.status` em minúsculo, `asaas_charges.status` em INGLÊS ALTO (`PENDING`, `RECEIVED`). Dificulta unificação de relatórios.

10. **Sem origem unificada de receita**
    - Não existe entidade `contas_receber` que centralize: fatura industrial, venda PDV loja, cobrança Asaas, contrato de aluguel mensal.

### A.3 O que reaproveitar (manter)

| Tabela / Componente | Decisão |
|---|---|
| `clientes`, `fornecedores`, `produtos` | **Manter como está** (cadastros estáveis) |
| `contas_pagar` | **Estender** (categoria FK, centro_custo, status enum, valor_pago) |
| `faturas` | **Manter**, virar fonte de "Contas a Receber Industrial" |
| `asaas_charges` | **Manter** como gateway; mas registrar paralelamente em `contas_receber` |
| `caixa_movimentacoes` | **Manter** como log do PDV; refletir em `contas_receber` via trigger |
| `folha_pagamento`, `folha_beneficios` | **Manter** (são fonte de "Despesa Folha") |
| `useRelatorioMensal`, `useDashboardFinanceiro` | **Refatorar** para ler de views unificadas, não somar 3 fontes em JS |
| `Contas.tsx` (abas) | **Manter** — vira a tela canônica de A Receber / A Pagar |
| `CaixaPDV.tsx`, `Lancamentos.tsx` | **Manter** (são os 2 PDVs pedidos) |
| `RelatorioMensal.tsx`, `RelatorioFinanceiro.tsx` | **Consolidar** dentro do grupo Relatórios |

### A.4 O que está errado / deve ser removido

- Páginas duplicadas: `src/pages/ContasPagar.tsx`, `src/pages/ContasReceber.tsx`, `src/pages/RelatorioFinanceiro.tsx` (substituída por `DashboardFinanceiro` + `RelatorioMensal`).
- Hook `useRelatorioFinanceiro` será absorvido por `useRelatorioMensal` v2 + novas queries por período.
- Categoria como string livre em `contas_pagar` (substituída por FK).

---

## B) ARQUITETURA-ALVO

### B.1 Estrutura final de navegação

```
CADASTROS
├── Clientes              (existente)
├── Fornecedores          (existente)
├── Categorias Financeiras (NOVA – tela simples CRUD)
└── Centros de Custo      (NOVA – tela simples CRUD)

FINANCEIRO
├── Contas a Pagar        (Contas.tsx aba "pagar" – refatorada)
├── Contas a Receber      (Contas.tsx aba "receber" – unificada)
└── Fluxo de Caixa        (NOVA – usa view v_fluxo_caixa)

PDV
├── PDV Loja              (CaixaPDV.tsx – existente)
└── PDV Industrial        (Lancamentos.tsx – existente)

RELATÓRIOS
├── Relatório Mensal      (RelatorioMensal.tsx – estendido)
├── Fluxo de Caixa        (mesma view, com filtro de período)
├── DRE                   (NOVA – usa categorias + centro de custo)
├── Despesas por Categoria (NOVA)
└── Receitas por Origem   (NOVA – fatura / pdv / asaas / contrato)
```

### B.2 Diagrama de entidades (financeiro)

```text
                ┌──────────────┐         ┌──────────────────┐
                │   clientes   │         │   fornecedores   │
                └──────┬───────┘         └─────────┬────────┘
                       │                           │
        ┌──────────────┴────────────┐   ┌──────────┴─────────┐
        │                           │   │                    │
┌───────▼────────┐  ┌───────────────▼───▼──┐   ┌─────────────▼──────┐
│   faturas      │  │   contas_receber     │   │   contas_pagar     │
│ (industrial)   │──┤  (UNIFICADA)         │   │ (despesas)         │
└────────────────┘  │  origem: fatura |    │   │                    │
                    │   pdv | asaas |      │   │ categoria_id  FK ──┼─┐
┌────────────────┐  │   contrato | manual  │   │ centro_custo_id FK ┼─┤
│ caixa_movim.   │──┤                      │   │ fornecedor_id  FK  │ │
│ (PDV loja)     │  │ categoria_id  FK ────┼─┐ │ status enum        │ │
└────────────────┘  │ centro_custo_id FK ──┼─┤ │ valor_pago         │ │
                    │ cliente_id    FK     │ │ └────────────────────┘ │
┌────────────────┐  │ status enum          │ │                        │
│ asaas_charges  │──┤ valor_recebido       │ │ ┌────────────────────┐ │
└────────────────┘  └──────────────────────┘ └─┤ categorias_financ. │◀┘
                                               │ tipo: receita|desp │
┌────────────────┐                             └────────────────────┘
│contratos_alug. │──┐                          ┌────────────────────┐
└────────────────┘  └──────────────────────────│ centros_custo      │
                                               │ (Industrial/Loja…) │
                                               └────────────────────┘
```

### B.3 Fluxo financeiro

```text
[PDV Loja] ──venda──▶ caixa_movimentacoes ──trigger──▶ contas_receber (origem=pdv, status=recebido)
[PDV Indl] ──ROL─────▶ lancamentos ──faturar──▶ faturas ──trigger──▶ contas_receber (origem=fatura, status=pendente)
[Asaas]   ──cobrar──▶ asaas_charges ──trigger──▶ contas_receber (origem=asaas)
[Aluguel] ──mensal──▶ contratos_aluguel ──job/cron──▶ contas_receber (origem=contrato)
[Manual]  ──UI──────────────────────────────────────▶ contas_receber (origem=manual)

[Despesa] ──UI──▶ contas_pagar (categoria FK + centro de custo FK)
[Folha]   ──fechamento──▶ folha_pagamento ──trigger──▶ contas_pagar (categoria=Folha)

                       ▼                              ▼
                contas_receber                  contas_pagar
                       └──────────┬───────────────────┘
                                  ▼
                         v_fluxo_caixa (view)
                                  ▼
                  Dashboard / Relatório Mensal / DRE
```

### B.4 Padrão de nomenclatura

- Tabelas: `snake_case`, plural português (`contas_receber`, `centros_custo`).
- Status: **sempre minúsculo em português** (`pendente`, `pago`, `parcial`, `atrasado`, `cancelado`, `recebido`). Mapear estados do Asaas via função.
- Enums: `status_conta`, `origem_receita`, `tipo_categoria`.
- Datas: `data_vencimento`, `data_pagamento`, `data_recebimento`, `competencia`.
- FKs: `<tabela_singular>_id` (`categoria_id`, `centro_custo_id`, `fornecedor_id`).
- Hooks: `useContas{Receber|Pagar}`, `useFluxoCaixa`, `useDRE`, `useCategoriasFinanceiras`, `useCentrosCusto`.

### B.5 Plano de escalabilidade / integrações futuras

- **Views materializadas** para DRE e Fluxo de Caixa (refresh por trigger).
- **Tabela `eventos_financeiros`** (append-only) para auditoria e replay (preparação IA/n8n).
- **Webhooks padronizados** via `webhook-dispatcher` já existente: emitir eventos `conta_pagar.created`, `conta_receber.paid` para n8n.
- **Edge function `sync-asaas-to-receber`** consolidando o que hoje vive só em `asaas_charges`.
- **Endpoint REST de leitura agregada** (via PostgREST RPC) para a IA consumir KPIs sem reimplementar regras.

---

## C) PLANO DE EXECUÇÃO (incremental, em fases)

> Cada fase é independente e deixa o sistema funcional. Nada é apagado antes do substituto estar provado.

### Fase 1 — Fundação (DB, sem quebrar UI)
- Criar enum `status_conta` (`pendente | parcial | pago | atrasado | cancelado | recebido`).
- Criar tabelas:
  - `categorias_financeiras (id, nome, tipo enum 'receita'|'despesa', cor, ativo)`
  - `centros_custo (id, nome, descricao, ativo)`
- Adicionar colunas em `contas_pagar`: `categoria_id FK`, `centro_custo_id FK`, `valor_pago numeric default 0`.
- Adicionar colunas em `faturas`, `asaas_charges`, `caixa_movimentacoes`: `centro_custo_id`, `categoria_id`.
- View `v_contas_receber` unindo `faturas` + `asaas_charges` + `caixa_movimentacoes` + `contratos_aluguel` com schema canônico.
- View `v_fluxo_caixa` (data, descrição, origem, valor, sinal, categoria, centro_custo).
- Seeds iniciais: categorias e 2 centros de custo (`Industrial`, `Loja`).
- Migration de **backfill**: mapear `contas_pagar.categoria` texto → `categoria_id`.
- GRANTs + RLS conforme padrão do projeto.

### Fase 2 — Cadastros novos (UI)
- Página `Configuracoes` → novas abas (ou rotas dedicadas) **Categorias Financeiras** e **Centros de Custo** (reaproveitando `wide-form-dialog`, `Card`, `Table` existentes).
- Hooks: `useCategoriasFinanceiras`, `useCentrosCusto`.

### Fase 3 — Refatorar Contas a Pagar
- `NovaContaPagarModal` / `EditarContaPagarModal`: trocar texto livre por `Select` de categoria + `Select` de centro de custo.
- Adicionar status `parcial` e `cancelado` na UI.
- Calcular `atrasado` em runtime (não persistir).

### Fase 4 — Unificar Contas a Receber
- Refatorar `ContasReceberContent` para ler de `v_contas_receber` (mostra faturas + asaas + PDV + contratos numa lista com filtro por origem).
- Manter modal "Nova Cobrança" existente (continua criando em `asaas_charges`).
- Trigger SQL: inserts em `caixa_movimentacoes (tipo=VENDA)`, `faturas`, `asaas_charges`, `contratos_aluguel` propagam para a view (a view já resolve, então sem trigger se for view normal; materializada → trigger refresh).

### Fase 5 — Sidebar e roteamento
- Atualizar `AppSidebar.tsx` com os grupos finais: Cadastros / Financeiro / PDV / Relatórios.
- Apagar páginas obsoletas: `ContasPagar.tsx`, `ContasReceber.tsx`, `RelatorioFinanceiro.tsx`.
- Renomear nomes visíveis (`PDV Loja`, `PDV Industrial`).

### Fase 6 — Relatórios novos
- Página **Fluxo de Caixa**: filtro por período (date-range), agrupa por dia/semana/mês a partir de `v_fluxo_caixa`.
- Página **DRE**: receitas - deduções - despesas por categoria → lucro bruto / líquido, com filtro por centro de custo e período.
- Página **Despesas por Categoria** e **Receitas por Origem**: gráficos (Recharts já no projeto) + tabela exportável.
- Estender `RelatorioMensal` para aceitar **range de meses** (comparativo mensal) sem quebrar layout atual.

### Fase 7 — Hardening e integrações
- Refatorar `useDashboardFinanceiro` e `useRelatorioMensal` para consumir as views (uma só fonte de verdade).
- Emitir eventos via `webhook-dispatcher` para n8n.
- Adicionar índices (`contas_pagar(categoria_id, vencimento)`, `faturas(status, data_vencimento)` etc.).

---

## D) DETALHES TÉCNICOS

### D.1 Schema novo (resumo SQL)
```sql
CREATE TYPE status_conta AS ENUM
  ('pendente','parcial','pago','atrasado','cancelado','recebido');

CREATE TYPE origem_receita AS ENUM
  ('fatura','pdv_loja','asaas','contrato','manual');

CREATE TABLE public.categorias_financeiras(
  id uuid PK, nome text, tipo text CHECK (tipo IN ('receita','despesa')),
  cor text, ativo bool default true, created_at, updated_at);

CREATE TABLE public.centros_custo(
  id uuid PK, nome text UNIQUE, descricao text, ativo bool default true);

ALTER TABLE contas_pagar
  ADD COLUMN categoria_id uuid REFERENCES categorias_financeiras(id),
  ADD COLUMN centro_custo_id uuid REFERENCES centros_custo(id),
  ADD COLUMN valor_pago numeric DEFAULT 0;

CREATE VIEW v_contas_receber AS
  SELECT id, 'fatura'::origem_receita AS origem, cliente_id,
         valor_total AS valor, COALESCE(data_vencimento, periodo_fim) AS vencimento,
         status, ...
  FROM faturas
  UNION ALL
  SELECT id, 'pdv_loja', NULL, valor, created_at::date, 'recebido', ...
  FROM caixa_movimentacoes WHERE tipo='VENDA'
  UNION ALL
  SELECT id, 'asaas', NULL, value, due_date, lower(status), ...
  FROM asaas_charges
  UNION ALL
  SELECT id, 'contrato', cliente_id, valor_servico, ...
  FROM contratos_aluguel WHERE ativo;
```

### D.2 Migração de dados
- Script idempotente que percorre `contas_pagar.categoria` e cria/associa `categoria_id` com base no dicionário hoje espalhado em `useRelatorioMensal` (CAT_PRODUTOS, CAT_CONTAS_MENSAIS, CAT_IMPOSTOS, CAT_FOLHA).
- Default `centro_custo_id` = `Industrial` (revisar manualmente após).

### D.3 Componentes reutilizados
- `Card`, `Table`, `Tabs`, `StatusBadge`, `Select`, `wide-form-dialog`, `KPICard`, `Recharts` wrappers já existentes em `src/components/dashboard` e `src/components/relatorios`.
- Hooks `useContasPagar`, `useFaturas`, `useCaixa` continuam — apenas ganham campos.

### D.4 Arquivos a remover (após Fase 5 estabilizar)
- `src/pages/ContasPagar.tsx`
- `src/pages/ContasReceber.tsx`
- `src/pages/RelatorioFinanceiro.tsx`
- `src/hooks/useRelatorioFinanceiro.ts`

---

## E) CONFIRMAÇÕES NECESSÁRIAS ANTES DE EXECUTAR

1. **Centros de Custo iniciais**: posso seedar com `Industrial`, `Loja`, `Administrativo`? (ou outros)
2. **Status `atrasado`**: confirma calcular em runtime (recomendado) em vez de persistir?
3. **`asaas_charges.cliente_id`**: posso adicionar a FK e fazer backfill por CPF/CNPJ quando casar com `clientes.cpf_cnpj`?
4. **Fase 1 primeiro?** Posso iniciar pela criação das tabelas/enums/views (não muda UI), e depois seguir fase a fase com aprovação a cada uma?

Ao aprovar este plano, começo pela **Fase 1 (Fundação DB)** e paro para validação antes de seguir para a UI.
