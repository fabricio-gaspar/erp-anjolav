## Objetivo

Expandir o cadastro de funcionários com uma "ficha completa" (dados pessoais, trabalhistas, salário, benefícios, banco) e criar um Relatório Mensal de Despesas + Faturamento + Lucro, separando despesas em três blocos: Funcionários (folha), Produtos/Insumos e Contas Mensais (operacionais).

---

## 1. Banco de Dados — novas tabelas e campos

### 1.1 Expandir `funcionarios` (ALTER TABLE)
Adicionar colunas para a ficha completa:

**Documentos:**
- `rg` text
- `rg_orgao_emissor` text
- `pis` text
- `ctps_numero` text, `ctps_serie` text, `ctps_uf` text
- `titulo_eleitor` text
- `cnh_numero` text, `cnh_categoria` text, `cnh_validade` date

**Pessoal:**
- `data_nascimento` date
- `genero` text
- `estado_civil` text
- `nacionalidade` text default 'Brasileira'
- `naturalidade` text
- `nome_mae` text, `nome_pai` text
- `escolaridade` text

**Endereço:**
- `endereco` jsonb default '{}' (logradouro, numero, complemento, bairro, cidade, uf, cep)

**Contato emergência:**
- `contato_emergencia_nome` text
- `contato_emergencia_telefone` text
- `contato_emergencia_parentesco` text

**Trabalhista / Contratual:**
- `data_demissao` date
- `tipo_contrato` text default 'CLT' (CLT, PJ, Estágio, Temporário, Autônomo)
- `regime_jornada` text (mensalista, horista, comissionado)

**Remuneração (salário e benefícios — base mensal):**
- `salario_base` numeric(12,2) default 0
- `valor_hora` numeric(12,2)
- `vale_transporte` numeric(12,2) default 0
- `vale_alimentacao` numeric(12,2) default 0
- `vale_refeicao` numeric(12,2) default 0
- `plano_saude` numeric(12,2) default 0
- `plano_odontologico` numeric(12,2) default 0
- `comissao_percentual` numeric(5,2) default 0
- `gratificacao` numeric(12,2) default 0
- `periculosidade` boolean default false
- `insalubridade_percentual` numeric(5,2) default 0
- `desconto_inss_percentual` numeric(5,2)
- `desconto_vt_percentual` numeric(5,2) default 6
- `outros_descontos` numeric(12,2) default 0
- `outros_beneficios` numeric(12,2) default 0

**Bancário (pagamento de salário):**
- `banco_nome` text
- `banco_agencia` text
- `banco_conta` text
- `banco_tipo_conta` text (corrente, poupança)
- `pix_chave` text, `pix_tipo_chave` text

**Observações:**
- `observacoes` text

### 1.2 Nova tabela `folha_pagamento`
Lançamento mensal da folha (gera despesa do mês). Permite histórico mês a mês.

```
id uuid PK
funcionario_id uuid (ref funcionarios.id)
competencia date  -- primeiro dia do mês de referência
salario_base numeric(12,2)
horas_extras numeric(12,2) default 0
comissoes numeric(12,2) default 0
gratificacao numeric(12,2) default 0
vale_transporte numeric(12,2) default 0
vale_alimentacao numeric(12,2) default 0
vale_refeicao numeric(12,2) default 0
plano_saude numeric(12,2) default 0
plano_odontologico numeric(12,2) default 0
outros_beneficios numeric(12,2) default 0
desconto_inss numeric(12,2) default 0
desconto_irrf numeric(12,2) default 0
desconto_vt numeric(12,2) default 0
outros_descontos numeric(12,2) default 0
total_proventos numeric(12,2) default 0
total_descontos numeric(12,2) default 0
liquido numeric(12,2) default 0
custo_total_empresa numeric(12,2) default 0  -- proventos + benefícios + encargos
status text default 'aberto'  -- aberto / fechado / pago
data_pagamento date
observacoes text
created_at, updated_at timestamptz
UNIQUE (funcionario_id, competencia)
```

RLS: authenticated CRUD (mesmo padrão das demais tabelas).

### 1.3 Garantir categorização em `contas_pagar`
A tabela já tem `categoria` (text). Vamos padronizar valores usados pelo relatório:
- `folha_pagamento`
- `produtos_insumos` (compras de estoque/produtos químicos)
- `contas_mensais` (luz, água, aluguel, internet, telefone, etc.)
- `impostos`
- `outros`

Não exige migração estrutural, só padronização no front (select de categoria).

### 1.4 Ligações (FKs lógicas usadas pelo relatório)
- `folha_pagamento.funcionario_id` → `funcionarios.id`
- `contas_pagar.fornecedor_id` → `fornecedores.id` (já existe)
- `faturas.cliente_id` → `clientes.id` (já existe)
- `caixa_movimentacoes.tipo='VENDA'` → receita Loja (já usado no dashboard)

---

## 2. Frontend — Ficha do Funcionário

Reformular o formulário em `ConfiguracoesEquipe.tsx` (aba Funcionários) usando `Tabs` internas dentro do Dialog/Collapsible:

```
[Pessoal] [Documentos] [Endereço] [Contrato] [Remuneração] [Bancário] [Observações]
```

- Hook `useFuncionarios.ts`: estender interfaces `Funcionario`, `CreateFuncionarioData`, `UpdateFuncionarioData` com os novos campos.
- Máscaras: CEP, telefone, valores em R$ (BRL — formato 1.518,00).
- Visualização: Card "Ficha do Funcionário" no detalhe, mostrando totais (salário bruto estimado, custo mensal total).

---

## 3. Folha de Pagamento (mensal)

Nova página/aba `Folha de Pagamento` dentro de Configurações → Equipe (ou módulo Financeiro):
- Selecionar competência (mês/ano)
- Botão "Gerar folha do mês" → cria registros em `folha_pagamento` para todos os funcionários ativos, puxando os valores-base do cadastro
- Tabela editável por funcionário (ajustar horas extras, comissões, descontos)
- Botão "Fechar folha" → calcula totais e cria automaticamente um lançamento em `contas_pagar` com `categoria = 'folha_pagamento'` (um por funcionário ou um consolidado, configurável)

---

## 4. Relatório Mensal — Despesas, Faturamento e Lucro

Nova página: `src/pages/RelatorioMensal.tsx` (rota `/relatorios/mensal`), acessível pelo menu Relatórios.

### Filtros
- Mês/ano (default: mês atual)
- Setor: Todos / Industrial / Loja

### Estrutura visual
1. **Cards de resumo (topo):**
   - Faturamento Total (R$)
   - Despesas Totais (R$)
   - Lucro/Prejuízo (R$ + %)
   - Margem (%)

2. **Bloco Receitas:**
   - Faturas pagas (Industrial) — vindo de `faturas` com `status='pago'`
   - Vendas Loja — vindo de `caixa_movimentacoes` (`tipo='VENDA'`)
   - Total de receitas

3. **Bloco Despesas (3 sub-blocos com tabelas):**
   - **a) Folha de Funcionários** — soma de `folha_pagamento` da competência + breakdown por funcionário (nome, salário, benefícios, descontos, líquido, custo total)
   - **b) Produtos/Insumos** — `contas_pagar` onde `categoria='produtos_insumos'` no mês (data_pagamento ou vencimento)
   - **c) Contas Mensais** — `contas_pagar` onde `categoria IN ('contas_mensais','impostos','outros')` no mês

4. **Resultado Final:**
   ```
   Faturamento ........... R$ X
   (-) Folha ............. R$ A
   (-) Produtos .......... R$ B
   (-) Contas Mensais .... R$ C
   = Lucro Líquido ....... R$ Y
   ```

5. **Ações:** Exportar PDF e Exportar Excel (CSV).

### Hook `useRelatorioMensal.ts`
Buscas em paralelo via React Query:
- Faturas pagas no mês (filtra por `created_at`/`data_pagamento`)
- Vendas de caixa no mês
- Folha de pagamento da competência (com join em funcionarios)
- Contas a pagar do mês agrupadas por categoria

Tudo com `refetchOnMount: "always"` (padrão do projeto).

---

## 5. Detalhes técnicos

- **Stack:** React 18 + Tailwind (tokens semânticos) + Shadcn + React Query + Supabase.
- **Formato BR:** todos os valores via `formatCurrencyBR` (1.518,00).
- **Permissões:** usar `useModuloPermissoes`; ADMINISTRADOR bypass.
- **Migração:** uma única migration cria a tabela `folha_pagamento` + ALTER em `funcionarios` + RLS.
- **Tipos:** `src/integrations/supabase/types.ts` é regenerado automaticamente após a migração.

---

## 6. Entregáveis (ordem)

1. Migration: ALTER `funcionarios` + CREATE `folha_pagamento` + RLS + trigger updated_at.
2. Atualizar `useFuncionarios.ts` (interfaces + create/update com novos campos).
3. Refatorar formulário em `ConfiguracoesEquipe.tsx` com 7 abas internas.
4. Novo hook `useFolhaPagamento.ts` + UI da Folha (gerar / editar / fechar mês).
5. Padronizar categorias em `NovaContaPagarModal.tsx` (select fixo).
6. Nova página `RelatorioMensal.tsx` + hook `useRelatorioMensal.ts` + rota + item de menu.
7. Exportação PDF/CSV do relatório.

---

## 7. Pontos a confirmar antes de implementar

- A folha deve gerar **uma conta a pagar consolidada por mês** ou **uma por funcionário**? (sugiro: uma por funcionário, facilita conciliação bancária)
- Quer cálculo automático de **INSS/IRRF** por faixas oficiais ou apenas campo manual? (sugiro manual nesta v1; automático fica para v2)
- O relatório deve incluir **provisões** (13º, férias, FGTS) no custo da folha ou apenas o que efetivamente sai no mês? (sugiro apenas o que sai; provisão fica como informativo no card)