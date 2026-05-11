## Objetivo

Ler o PDF "Recibo de Pagamento — LAVANDERIA SÃO ROQUE — Abril/2026", cadastrar os 6 funcionários (com todos os dados disponíveis), classificá-los pelo CNPJ empregador e lançar a folha de pagamento de Abril/2026 para cada um.

---

## 1. O que o PDF contém

Empresa empregadora única: **LAVANDERIA SAO ROQUE LTDA — CNPJ 23.227.029/0001-06** (todos os 6 funcionários estão sob este CNPJ).

Competência: **Abril de 2026** (todos mensalistas).

Funcionários extraídos:

| Cód. | Nome | Cargo (CBO) | Admissão | Sal. Base | Líquido Abr/26 |
|---|---|---|---|---|---|
| 3 | ANA CLAUDIA SANCHES | DIRETOR ADM. FINANCEIRO (123110) | 08/09/2015 | 1.621,00 (pró-labore) | 1.442,00 |
| 29 | JULIA MARIA BARBOSA DA SILVA | AUXILIAR DE LAVANDERIA (516345) | 15/04/2026 | 1.900,00 | 1.016,00 |
| 16 | JULIA VIANA RAMOS DOS SANTOS | ATENDENTE (422105) | 02/12/2021 | 3.200,00 | 1.680,00 |
| 27 | LUCAS CAETANO FERREIRA DA SILVA | AUXILIAR DE LAVANDERIA (516345) | 15/04/2026 | 1.900,00 | 859,00 |
| 28 | MARIA APARECIDA ESTEVAM DA SILVA | AUXILIAR DE LAVANDERIA (516345) | 15/04/2026 | 1.900,00 | 1.079,00 |
| 26 | MISLENE BARBOSA DA SILVA | ATENDIMENTO AO CLIENTE (516340) | 24/03/2026 | 2.300,00 | 1.488,00 |

Para a Ana Cláudia o PDF traz a Matrícula INSS: **11972958318**.

Para cada funcionário o PDF detalha vencimentos (dias normais, reflexo extras DSR, HE 50/70/100%, troco) e descontos (INSS, contribuição assistencial, vale-transporte 4%, cesta básica, adiantamento salarial, empréstimos consignados quando houver), além de Salário-base, Sal. Contr. INSS, Base FGTS, FGTS do mês, Base IRRF e Faixa IRRF.

---

## 2. Banco — pequenos ajustes necessários

Para "classificar por CNPJ empregador" (regra do usuário) e guardar dados que o PDF traz mas o cadastro atual não tem:

ALTER TABLE `funcionarios` (todos opcionais, sem default destrutivo):
- `empregador_cnpj` text — usado para filtro/relatório
- `empregador_nome` text — ex.: "LAVANDERIA SAO ROQUE LTDA"
- `codigo_externo` text — código do funcionário no sistema da contabilidade (3, 16, 26, 27, 28, 29)
- `cbo` text
- `matricula_inss` text
- `centro_custo` text — ex.: "GERAL"
- `filial` text — ex.: "1"

ALTER TABLE `folha_pagamento` (campos que o recibo traz e hoje não temos):
- `reflexo_dsr` numeric(12,2) default 0
- `horas_extras_50` numeric(12,2) default 0
- `horas_extras_70` numeric(12,2) default 0
- `horas_extras_100` numeric(12,2) default 0
- `adiantamento_salarial` numeric(12,2) default 0
- `desconto_emprestimo` numeric(12,2) default 0
- `desconto_cesta_basica` numeric(12,2) default 0
- `contribuicao_assistencial` numeric(12,2) default 0
- `troco_mes` numeric(12,2) default 0
- `troco_mes_anterior` numeric(12,2) default 0
- `base_fgts` numeric(12,2) default 0
- `valor_fgts` numeric(12,2) default 0
- `base_irrf` numeric(12,2) default 0
- `faixa_irrf` numeric(5,2) default 0
- `salario_contrib_inss` numeric(12,2) default 0
- `dias_trabalhados` numeric(5,2) default 30

A função `calcularTotaisFolha` é estendida para somar HE 50/70/100 e reflexo DSR aos proventos, e adiantamento + cesta + assistencial + empréstimos aos descontos.

---

## 3. Inserts de dados (operação)

### 3.1 Funcionários (UPSERT por nome + empregador_cnpj)
Para cada um dos 6 nomes, criar/atualizar registro com:
- nome, cargo, data_admissao, salario_base
- empregador_cnpj = "23.227.029/0001-06", empregador_nome = "LAVANDERIA SAO ROQUE LTDA"
- codigo_externo, cbo, centro_custo = "GERAL", filial = "1"
- tipo_contrato = "CLT" (ou "PRO-LABORE" para Ana Cláudia)
- desconto_vt_percentual = 6 (padrão; o PDF mostra desconto efetivo de 4% sobre base, mantemos 6 como padrão CLT)
- ativo = true
- matricula_inss para Ana Cláudia
- Demais campos (CPF, RG, endereço, banco) ficam vazios — não vêm no PDF

### 3.2 Folha de pagamento de Abril/2026 (competência 2026-04-01)
Inserir 1 lançamento por funcionário com todos os valores do recibo:

| Funcionário | Sal. Base | DSR | HE50 | HE70 | HE100 | INSS | Cont.Assist. | Cesta | VT | Adiant. | Empréstimos | Troco mês | Troco ant. | Estorno | Tot. Venc. | Tot. Desc. | Líquido | Base FGTS | FGTS | Base IRRF | Faixa | Sal.Contr.INSS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ana Cláudia | 1.621,00 (pró-labore) | — | — | — | — | 178,31 | — | — | — | — | — | 0,24 | 0,93/0,93 | — | 1.621,24 | 179,24 | 1.442,00 | 0,00 | 0,00 | 1.013,80 | 0,00 | 1.621,00 |
| Julia Maria | 1.013,33 | 31,89 | 25,91 | — | 112,27 | 88,75 | 38,00 | 0,50 | 40,53 | — | — | 0,38 | — | — | 1.183,78 | 167,78 | 1.016,00 | 1.183,40 | 94,67 | 576,20 | 0,00 | 1.183,40 |
| Julia Viana | 3.200,00 | 197,95 | 174,55 | 471,80 | 145,45 | 391,35 | 64,00 | 0,50 | 128,00 | 1.280,00 | 1.076,22 (39,50+281,44+106,76+648,52) | 0,41 | 0,58 | +430,49 | 4.620,65 | 2.940,65 | 1.680,00 | 4.189,75 | 335,18 | 3.582,55 | 15,00 | 4.189,75 |
| Lucas Caetano | 1.013,33 | — | — | — | — | 75,99 | 38,00 | 0,50 | 40,53 | — | — | 0,69 | — | — | 1.014,02 | 155,02 | 859,00 | 1.013,33 | 81,06 | 406,13 | 0,00 | 1.013,33 |
| Maria Aparecida | 1.013,33 | 36,39 | 25,91 | — | 131,79 | 90,55 | 38,00 | 0,50 | — | — | — | 0,63 | — | — | 1.208,05 | 129,05 | 1.079,00 | 1.207,42 | 96,59 | 600,22 | 0,00 | 1.207,42 |
| Mislene | 2.300,00 | 94,38 | 67,90 | 309,60 | — | 225,14 | 46,00 | 0,50 | 92,00 | 920,00 | — | 0,31 | 0,55 | — | 2.772,19 | 1.284,19 | 1.488,00 | 2.771,88 | 221,75 | 2.164,68 | 0,00 | 2.771,88 |

Status: "aberto" (o usuário fecha pelo botão "Fechar folha" da tela quando quiser gerar contas a pagar). Dia padrão de pagamento sugerido: 05/05/2026 (preenchido só ao fechar).

---

## 4. Frontend — pequenos ajustes

- `useFichaFuncionario.ts` / `useFuncionarios.ts`: incluir os novos campos (empregador_cnpj, empregador_nome, codigo_externo, cbo, matricula_inss, centro_custo, filial) nas interfaces e payloads.
- `FichaFuncionarioModal.tsx`: nova aba "Empregador" (ou seção dentro de "Contrato") com CNPJ empregador (select com as 2 entidades fiscais já registradas: ANJOLAV e LAVANDERIA SÃO ROQUE), nome, código externo, CBO, matrícula INSS, centro de custo, filial.
- `ConfiguracoesEquipe.tsx`: filtro por empregador (Todos / Lavanderia SR / Anjolav) e badge do CNPJ no card do funcionário.
- `FolhaPagamentoTab.tsx` + `useFolhaPagamento.ts`: exibir e permitir editar HE 50/70/100, reflexo DSR, adiantamento, cesta básica, contribuição assistencial, empréstimos. Atualizar `calcularTotaisFolha`.
- `RelatorioMensal.tsx`: agrupar a folha pelo CNPJ empregador (subtotal Lavanderia SR vs Anjolav) — mantém os totais gerais.

Sem mudanças em outros módulos.

---

## 5. Ordem de execução

1. **Migração 1** (estrutural): ALTER em `funcionarios` + ALTER em `folha_pagamento` com os campos listados.
2. **Inserts** (via tool de inserção): 6 funcionários + 6 lançamentos de folha competência 2026-04-01.
3. **Hooks/UI**: estender interfaces, modal, totais, filtro e relatório como descrito acima.
4. Verificar visualmente: lista em Configurações > Equipe e tela de Folha de Abril/2026.

---

## 6. Pontos a confirmar

- Os 4 admitidos em 15/04/2026 e a Mislene (24/03/2026) trabalharam apenas 16 dias proporcionais — vou lançar exatamente como o recibo (não rateio adicional). Confirmar?
- Para a Ana Cláudia: registrar como `tipo_contrato = "PRO-LABORE"` (sócia), já que não há FGTS e o vencimento é PRO-LABORE DIASS. Confirmar?
- O empréstimo consignado da Julia Viana (4 contratos) entra como um único campo `desconto_emprestimo` consolidado ou prefere uma sub-tabela detalhada por contrato? Sugiro consolidado nesta v1.
