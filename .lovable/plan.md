
# Diagnóstico — Sistema de Lavanderia (AnjoLav ERP)

## Resumo executivo
SPA React+Vite+Supabase servindo duas linhas de negócio (Industrial ID1 / Residencial ID2) num único frontend com sidebar unificada. Base sólida: 54 tabelas com RLS ativa, 19 rotas protegidas, integrações reais (Asaas sandbox, Evolution API, n8n). Maturidade global: **6/10** — CRUD funciona, mas há inconsistências de escopo (industrial/residencial se misturam em vários hooks), permissões *fail-open*, código órfão, RLS excessivamente permissiva, e não existe segregação por painel/unidade nem no roteamento nem no banco.

## Stack e arquitetura
- Frontend: React 18, TS, Vite, Tailwind, shadcn/ui, React Query (`refetchOnMount:"always"`), React Router v6.
- Backend: Supabase (Postgres + Edge Functions Deno). 5 edge functions, 2 views, 67 triggers.
- Auth: Supabase Auth com login por username (RPC `get_employee_email_by_login` → email → signIn).
- Integrações reais: Asaas (sandbox), Evolution API (WhatsApp), n8n dispatcher. NFS-e ainda **só preview PDF** — sem função de emissão.

## Rotas (src/App.tsx:63-101)
Públicas: `/login`, `/forgot-password`, `/signup`→redirect, `/portal/:codigo`.
Protegidas (19): `/`, `/configuracoes`, `/financeiro`, `/caixa`, `/lancamentos`, `/contas`, `/clientes`, `/produtos`, `/producao`, `/ordens`, `/agenda`, `/fornecedores`, `/estoque`, `/relatorios/{clientes,proximidade,caixa,quilometragem,mensal}`, `/agenda-eventos`.
Redirects legados: `/faturamento`, `/receber`, `/pagar`, `/asaas`, `/relatorios/financeiro`.

## Módulos — situação real
| Módulo | Estado | Observação |
|---|---|---|
| Dashboard | ✅ funcional | mistura KPIs sem seletor de unidade |
| Clientes | ✅ funcional | filtro por `classificacao` (industrial/residencial) OK |
| Produtos/Estoque | ✅ funcional | `unidade_negocio` ID1/ID2/ambos |
| PDV Industrial (Lançamentos) | ✅ funcional | filtra `classificacao="industrial"` |
| PDV Loja (CaixaPDV) | ✅ funcional | filtra `residencial`+ID2 |
| Produção (Kanban) | ⚠️ parcial | filtra `origem!="loja"` só client-side; **hardcoda `origem:"industrial"`** ao criar OS via agenda (useFluxoProducao.ts:64) e NovaOS.tsx:77 |
| OS | ⚠️ parcial | `useOrdensServico` retorna tudo sem filtro por origem |
| Faturas | ⚠️ parcial | `useFaturas` sem filtro; consumidor é responsável |
| Contas a Pagar/Receber | ✅ funcional | `v_contas_receber` unificada; `useContasReceberUnificado` default `"todos"` mistura industrial+loja |
| Fluxo de Caixa | ✅ funcional | via `v_fluxo_caixa` |
| Fiscal / NFS-e | 🟡 visual | apenas preview PDF, sem edge function de emissão real |
| WhatsApp / Evolution | ✅ real | edge function real, sem checagem de role admin |
| Asaas | ✅ real (sandbox) | URL hardcoded sandbox |
| Agenda / Rotas | ✅ funcional | |
| Folha / Benefícios | ✅ funcional | admin-only |
| Permissões | ⚠️ fail-open | ver §Auth |
| Portal Cliente | ✅ funcional | rota pública |
| **Órfãos** (arquivos existem, nunca importados): `Faturamento.tsx`, `ContasPagar.tsx`, `ContasReceber.tsx`, `RelatorioFinanceiro.tsx`, `DashboardCobrancas.tsx`, `Index.tsx`, `Signup.tsx` | 🗑️ obsoleto | substituídos por redirects |
| Máquinas / Manutenção / Qualidade | ❌ ausente | não existe no banco nem no frontend |

## Banco — mapa e divergências
- **54 tabelas**, todas com RLS ativa. GRANTs de `authenticated`/`anon` em todas (controle real via policies).
- **Coluna `classificacao`**: existe **só em `clientes`**. Não há em produtos, OS, lançamentos, faturas, caixas.
- **`origem`**: existe em `ordens_servico`, propaga nas views. Não é marcador multi-tenant, é canal.
- **`unidade`**: em `produtos`/`itens_lancamento`/`estoque_produtos` — é unidade de medida (kg/un), não filial.
- **Nenhuma coluna `id1`/`id2`/`unidade_negocio` no banco** — no frontend `unidade_negocio` (ID1/ID2/AMBOS) existe em `produtos`, mas o mapeamento cliente→unidade é derivado de `classificacao`.
- **Views** `v_fluxo_caixa` e `v_contas_receber`: sem `security_barrier` declarada explicitamente — herdam privilégios do caller (OK), mas convém confirmar que não são SECURITY DEFINER.
- **Triggers duplicados** em ~20 tabelas (dois `updated_at` triggers no mesmo alvo) — inofensivo, mas indica migrações não deduplicadas.
- **Row counts**: `ordens_servico=0`, `lancamentos=0`, `faturas=0`, `caixas=0`; `clientes=44`, `produtos=163`, `funcionarios=26`, `contas_pagar=12`. **Ambiente de pré-produção**.

## Como Industrial × Residencial estão separados hoje
Mecanismo único de fato: `clientes.classificacao ∈ {industrial, residencial}` + `produtos.unidade_negocio ∈ {ID1, ID2, AMBOS}`. **Não existe**: coluna de unidade em OS/faturas/caixas, tenant/branch, painel, escopo em RLS. Toda separação é **derivada e client-side**.

### Filtram corretamente
`Clientes.tsx`, `useDashboardFinanceiro`, `useRelatorioMensal`, `Lancamentos.tsx`+abas industriais, `CaixaPDV.tsx` (loja), `RelatoriosCliente.tsx`, `ClienteTabelaPrecos`, `ProdutoFilters/Form`.

### Misturam ou vazam
- `useFluxoProducao.ts:64` — cria OS sempre com `origem:"industrial"` a partir de agendamento.
- `NovaOS.tsx:77` — mesmo hardcode manual.
- `useOrdensServico.ts` — sem filtro por origem; `FluxoProducao` filtra client-side por string frágil.
- `useFaturas.ts` — sem filtro em-hook.
- `useContasReceberUnificado.ts` — default `origem:"todos"` mistura industrial+loja em `/contas`.
- `useClientes.ts`/`useProdutos.ts` — sem filtro; empurram responsabilidade ao consumidor.

## Painel Central — diagnóstico
**Não existe hoje**. Dashboard atual é um agregado plano sem seletor de escopo. Para virar Painel Central:
- Precisa consolidar KPIs Industrial+Residencial + gestão administrativa completa (usuários, permissões, configurações, fiscal, financeiro global, auditoria).
- Precisa de rota raiz `/central/*` distinta de `/industrial/*` e `/residencial/*`.
- Requer role `admin` (já existe) + seletor de painel no header.

## Autenticação, ProtectedRoute e permissões
- **AuthContext** (`AuthContext.tsx:55-92`): `onAuthStateChange` + `getSession`, mapeia `funcionario` por `user_id`. Erros silenciados (funcionario=null → cargo default "Operador").
- **ProtectedRoute** (`ProtectedRoute.tsx:10-30`): **fail-closed sem sessão**, mas **sem branch de erro** — se `getSession()` lançar, `loading` fica preso e a tela trava no spinner (fail-stuck). Não verifica cargo nem permissão por rota.
- **usePermissoesUsuario** (`:32-73`): **fail-open** — admin bypass; carregando → true; permissões vazias → true; rota sem chave no `ROUTE_PERMISSION_MAP` → true. Um funcionário sem nenhuma linha em `modulo_permissoes` **vê tudo**.
- `ROUTE_PERMISSION_MAP` **não cobre** `/relatorios/{caixa,mensal,quilometragem}`, `/agenda-eventos` — sempre visíveis.
- `ConfiguracoesPermissoes` lista módulos `faturamento`, `contas_receber` que **nenhuma rota consome** (só `contas_pagar` cobre `/contas`).
- **Não existe permissão por unidade/painel nem por ação** (só por módulo, e só na sidebar).

## RLS — estado efetivo (verificado no banco, não só nas migrations)
- **Totalmente aberto para qualquer `authenticated`** (USING/WITH CHECK = `true`): `clientes`, `ordens_servico`, `itens_ordem_servico`, `lancamentos`, `itens_lancamento`, `faturas`, `contas_pagar`, `caixas`, `caixa_movimentacoes`, `produtos`, `estoque_produtos`, `agendamentos`, `rotas_entrega`, `paradas_rota`. Qualquer login lê/edita/apaga tudo.
- **Admin-only**: `folha_pagamento`, `folha_beneficios`, `configuracoes_fiscais`, `asaas_charges`, `whatsapp_instancias`, CUD de `modulo_permissoes`/`categorias_financeiras`/`centros_custo`/`user_roles`.
- **Misto**: `funcionarios` (SELECT: admin OU self). `asaas_webhook_events` (SELECT auth, INSERT admin — mas na prática só service_role escreve).
- **⚠️ `rol_configuracoes.SELECT` com `roles={public}` e `qual=true`** — literalmente qualquer requisição (incluindo `anon`) lê a tabela. Provável excesso de escopo.
- **Nenhuma policy referencia unidade/classificacao/branch** — não há isolamento por painel no banco.

## Edge Functions — segurança
`config.toml` desliga `verify_jwt` em todas (5) — cada função valida internamente.
| Função | JWT | Admin | CORS | Notas |
|---|---|---|---|---|
| `asaas-webhook` | N/A (webhook) | — | `*` | Compara `asaas-access-token` com env, sem timing-safe; hard-fail 503 se ausente ✔ |
| `create-asaas-charge` | ✔ | ✔ (`has_role admin`) | `*` | URL Asaas sandbox hardcoded; sem validação numérica |
| `manage-employee` | ✔ | ✔ | `*` | Retorna erro como `200 { error }` — semântica HTTP inconsistente |
| `webhook-dispatcher` | ✔ | ❌ | `*` | Qualquer auth dispara webhook n8n |
| `whatsapp-evolution` | ✔ | ❌ | `*` | Qualquer auth conecta/envia WhatsApp; `api_key_encrypted` usado como plaintext |

Segredos OK (`ASAAS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc. no vault). Nenhuma allowlist de origem.

## Integrações — realidade
- **Asaas**: ✅ real contra sandbox. Precisa flag prod/sandbox por ambiente antes de faturar.
- **WhatsApp/Evolution**: ✅ real, URL+chave por instância em `whatsapp_instancias`.
- **NFS-e**: 🟡 **apenas preview PDF client-side**. Sem função de emissão real, sem envio ao webservice da prefeitura, sem tratamento de cancelamento/status. Certificado A1 já é enviado ao Storage (`certificates` bucket, admin-only).
- **n8n**: ✅ real via `webhook-dispatcher`.

## Fluxo industrial atual
Cliente(industrial) → Agendamento (Ter/Qui) → Confirma retirada (**cria OS com `origem:"industrial"` hardcoded**) → Kanban Produção (8 etapas, `historico_producao` via trigger) → Lote (`L-YYYY-NNNN`) → Conferência → Lançamento (`ROL-YYYY-NNNNNN` via trigger) → Fatura (mensal/quinzenal) → Cobrança (Asaas ou manual) → Recebimento. **Gap**: rastreio por lote ainda solto, custo por OS não consolidado.

## Fluxo residencial atual
Cliente(residencial) → Balcão/Agenda → OS (**também hardcode industrial hoje — bug**) → Produção compartilhada → Pronto para entrega → **PDV Caixa** (abertura de caixa, venda, forma de pagamento, fechamento com conferência cega) → Sangria/Suprimento → Fechamento. **Gap**: fluxo PDV não conecta corretamente com produção quando a origem é hardcoded errada.

## Estoque, máquinas, manutenção, qualidade e custos
- **Existente**: `estoque_produtos`, `movimentacoes_estoque`, entrada/saída, alerta de baixo.
- **Faltante**: máquinas (lavadoras/secadoras/calandras), plano de manutenção, ordens de manutenção, controle de qualidade/reprocesso, custo direto por OS/kg, produtividade por operador, consumo de químicos por lote.

## Problemas classificados

**P0 (bloqueadores para os 3 painéis)**
1. `origem` hardcoded `"industrial"` em criação de OS (2 pontos) — impede fluxo residencial.
2. RLS totalmente aberta em tabelas transacionais (clientes, OS, faturas, contas, caixa) — qualquer operador apaga tudo.
3. Permissões fail-open + ProtectedRoute sem gate por role/módulo — usuários limitados veem tudo.
4. Sem coluna/estrutura de "unidade de negócio" nas tabelas transacionais — impossível consolidar/filtrar no banco.
5. Não há rotas segmentadas `/central`, `/industrial`, `/residencial` — sidebar única mistura contextos.

**P1**
6. NFS-e sem emissão real.
7. `rol_configuracoes` público a `anon`.
8. `webhook-dispatcher` e `whatsapp-evolution` sem checagem admin.
9. Hooks list/report sem filtro (`useOrdensServico`, `useFaturas`, `useClientes`, `useProdutos`).
10. `useContasReceberUnificado` mistura setores por default.
11. Asaas sandbox hardcoded — sem toggle prod.
12. ProtectedRoute sem branch de erro (spinner infinito).

**P2**
13. Triggers `updated_at` duplicados em ~20 tabelas.
14. `ROUTE_PERMISSION_MAP` incompleto.
15. Módulos de permissão (`faturamento`, `contas_receber`) sem rota mapeada.
16. Páginas órfãs (7 arquivos).
17. CORS `*` universal, sem allowlist.
18. `api_key_encrypted` armazenado como plaintext.
19. Timing attack teórico no compare do webhook Asaas.

**P3**
20. `manage-employee` responde erros com HTTP 200.
21. Sem auditoria/log de ações administrativas.
22. Sem testes automatizados.

## Proposta de arquitetura futura (3 painéis integrados)

```text
                    ┌──────────────────────────────────┐
                    │  Login → seletor de painel       │
                    │  (admin vê 3; outros só o seu)   │
                    └──────────────┬───────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
   /central/*               /industrial/*              /residencial/*
   Layout central           Layout industrial          Layout loja
   - Consolidado            - Clientes ID1             - Clientes ID2
   - Gestão global          - Lançamentos/ROL          - PDV Caixa
   - Fiscal, Folha,         - Faturas mensais          - Vendas balcão
     Config, Usuários,      - Produção industrial      - Produção loja
     Auditoria              - Rotas/Logística          - Entrega bairro
   - BI + ações             - Contratos                - Agendamento residencial
        │                          │                          │
        └──────────────────────────┼──────────────────────────┘
                                   ▼
                    Componentes compartilhados
              (OS, Produção Kanban, Estoque, Agenda,
               Financeiro base, Fiscal, WhatsApp)
                                   │
                                   ▼
                    Supabase (schema único, coluna
                    `unidade_negocio` propagada em
                    todas as tabelas transacionais +
                    RLS por unidade + role)
```

**Novas roles**: `admin_geral` (todos os painéis), `gestor_industrial`, `gestor_loja`, `operador_industrial`, `operador_loja`, `caixa`, `producao`. Cada usuário tem `unidades_permitidas: text[]` em `funcionarios`.
**Guard**: `ProtectedRoute` passa a receber `requiredPanel` e `requiredModule`; checa role + unidade + permissão de módulo antes de renderizar.

## Plano incremental de banco (aditivo, sem apagar dados, sem editar migrations aplicadas)

**M1 — Adicionar `unidade_negocio` sem quebrar**
- `ALTER TABLE ordens_servico ADD COLUMN unidade_negocio text` (nullable inicial); mesma coluna em `lancamentos`, `faturas`, `caixas`, `contas_pagar`, `contas_receber` (via view), `agendamentos`, `rotas_entrega`.
- Backfill: `UPDATE ordens_servico SET unidade_negocio = c.classificacao FROM clientes c WHERE ordens_servico.cliente_id=c.id`.
- CHECK constraint só após backfill.

**M2 — Roles e escopo por unidade**
- Enum `app_role` estendido; `funcionarios.unidades_permitidas text[] default '{}'`.
- Função `public.user_pode_unidade(_uid uuid, _un text) returns boolean` SECURITY DEFINER.

**M3 — RLS por unidade (substituir "true" gradualmente)**
- Novas policies em paralelo às antigas (`USING (user_pode_unidade(auth.uid(), unidade_negocio))`) — drop das antigas só após validação em canário.

**M4 — Corrigir P0/P1 pontuais**
- Fechar `rol_configuracoes` para `authenticated`.
- Adicionar admin-check em `webhook-dispatcher`/`whatsapp-evolution`.
- Toggle Asaas sandbox/prod via env.

**M5 — Novas tabelas**
- `maquinas`, `manutencoes`, `qualidade_reprocessos`, `custos_os`, `auditoria_acoes`.

**Todos os passos** são `ADD`/`CREATE` — nenhum `DROP`/`ALTER TYPE` destrutivo.

## Roadmap por fases

| Fase | Escopo | Critérios de aceite | Rollback |
|---|---|---|---|
| **1** | Fundação de painéis: rotas `/central`, `/industrial`, `/residencial`; seletor de painel no header; ProtectedRoute com `requiredPanel`; layouts base | Admin loga → escolhe painel → sidebar contextual carrega; operador só vê seu painel; nenhuma rota antiga quebra (redirects) | Reverter rotas; sidebar volta ao formato atual |
| **2** | Coluna `unidade_negocio` aditiva + backfill + hooks com filtro em-hook (`useOrdensServico`, `useFaturas`, `useClientes`, `useProdutos`, `useContasReceberUnificado`) | Todas as queries transacionais filtradas no server; nenhum consumidor precisa filtrar client-side; dashboards do painel correto batem com o antigo agregado | Coluna fica nullable; queries voltam a ignorá-la |
| **3** | Fix P0 hardcodes (`origem`), permissões fail-closed com allowlist explícita, ProtectedRoute com branch de erro, gate por módulo+ação+unidade | Operador industrial não acessa rota residencial; sem sessão → login; erro de sessão → tela de erro amigável | Feature flag para reverter para fail-open |
| **4** | RLS por unidade em paralelo às policies "true"; testes de acesso cross-unit; drop das policies antigas | Usuário de ID1 recebe 0 rows ao consultar ID2; admin vê todos; auditoria confirma | Manter policies antigas até validar; drop reversível via nova migration |
| **5** | Painel Central completo: consolidação financeira, gestão de usuários/permissões por unidade, auditoria, fiscal centralizado | KPIs conferem com soma dos painéis; ações admin registradas em `auditoria_acoes` | Painel central fica só leitura até estabilizar |
| **6** | NFS-e real (edge function de emissão), toggle Asaas prod, hardening (admin-check nas 2 edge functions, CORS allowlist, timing-safe compare) | Nota emitida em homologação da prefeitura; cobrança prod validada com 1 cliente piloto | Feature flag por cliente/instalação |
| **7** | Módulos ausentes: máquinas, manutenção, qualidade, custo por OS, produtividade | Cadastro + relatório operacional por unidade | Módulos isolados, podem ser desativados no menu |
| **8** | Limpeza: remover páginas órfãs, deduplicar triggers, cobrir rotas faltantes no `ROUTE_PERMISSION_MAP`, testes automatizados básicos (auth, RLS, filtros por unidade) | CI verde; sem código morto | Cada limpeza em commit isolado |

**Testes por fase**: smoke manual (Playwright em preview local para fluxos críticos) + queries SQL de verificação (contagens antes/depois do backfill; tentativa de acesso cross-unit deve retornar 0). **Rollback** sempre por nova migration aditiva ou feature flag — nunca editando migration aplicada.

---

**DIAGNÓSTICO CONCLUÍDO — AGUARDANDO AUTORIZAÇÃO PARA A FASE 1.**
