

# Auditoria Completa: Problemas Encontrados e Correções

## Resumo da Analise

Comparei todas as 42 tabelas do banco com o codigo e encontrei **dois problemas criticos**:

---

## Problema 1: TRIGGERS NAO EXISTEM

As funções de trigger existem no banco, mas **nenhum trigger esta conectado**. Isso significa:

| Funcao | Efeito | Impacto |
|--------|--------|---------|
| `generate_os_number()` | Gerar numero automatico da OS | OS criadas com numero VAZIO |
| `registrar_historico_status()` | Registrar mudancas de status da OS | Historico de producao NAO funciona |
| `handle_new_user_role()` | Auto-atribuir role ao vincular funcionario | Novos usuarios sem permissao |
| `update_updated_at_column()` | Atualizar campo updated_at automaticamente | Datas de atualizacao incorretas |

## Problema 2: COLUNAS FALTANDO NAS TABELAS DO CAIXA

O codigo (hooks) espera colunas que nao existem no banco:

| Tabela | Coluna esperada | Situacao |
|--------|----------------|----------|
| `caixas` | `operador_id` (uuid) | NAO EXISTE - so tem `operador` (text) |
| `caixa_movimentacoes` | `cliente_id` (uuid) | NAO EXISTE |
| `caixa_movimentacoes` | `ordem_servico_id` (uuid) | NAO EXISTE |

---

## Plano de Correcao (1 migracao)

### Migracao SQL:

**1. Criar todos os triggers ausentes:**
- `BEFORE INSERT` em `ordens_servico` → `generate_os_number()`
- `AFTER UPDATE` em `ordens_servico` → `registrar_historico_status()`
- `AFTER UPDATE` em `funcionarios` → `handle_new_user_role()`
- `BEFORE UPDATE` em todas as tabelas com `updated_at` → `update_updated_at_column()`

**2. Adicionar colunas faltantes:**
- `caixas.operador_id` (uuid, nullable, FK → funcionarios)
- `caixa_movimentacoes.cliente_id` (uuid, nullable, FK → clientes)
- `caixa_movimentacoes.ordem_servico_id` (uuid, nullable, FK → ordens_servico)

**3. Nenhuma alteracao de codigo necessaria** — os hooks ja esperam essas colunas.

---

## Tabelas OK (sem problemas)

Todas as outras 40 tabelas estao corretas: estrutura, FKs e RLS conferem com o codigo. Nenhuma tabela referenciada no codigo esta faltando no banco.

