

# Módulos Estoque e Fornecedores - Posicionamento e Arquitetura

## Onde ficam no menu

```text
Dashboard

Comercial
├─ Clientes
├─ Produtos
├─ Fornecedores  ← NOVO (vive junto de Clientes/Produtos)

Operacional
├─ Abrir Retirada
├─ Produção
├─ Agenda
├─ Estoque  ← NOVO (controle operacional de insumos)

Financeiro
├─ Visão Geral
├─ Lançamentos
├─ Caixa PDV
├─ Contas

Relatórios
├─ Clientes
├─ Proximidade

Configurações
```

**Fornecedores** fica em "Comercial" porque é cadastro de parceiros comerciais (assim como Clientes e Produtos).
**Estoque** fica em "Operacional" porque controla insumos do dia a dia da produção (sabão, amaciante, embalagens, etc.).

---

## Arquitetura do Módulo Fornecedores

### Tabela: `fornecedores`
| Coluna | Tipo |
|---|---|
| id | uuid PK |
| nome | text NOT NULL |
| razao_social | text |
| cnpj_cpf | text |
| telefone | text |
| email | text |
| contato_nome | text |
| endereco | jsonb (cep, logradouro, numero, bairro, cidade, uf) |
| categoria | text (produtos_limpeza, embalagens, manutencao, outros) |
| observacoes | text |
| ativo | boolean DEFAULT true |
| created_at / updated_at | timestamptz |

### Página: `/fornecedores`
- Lista com filtro por categoria e status (ativo/inativo)
- Modal de cadastro/edição com consulta CNPJ (BrasilAPI, igual Clientes)
- Vinculação com produtos do estoque (qual fornecedor abastece qual insumo)

### Arquivo: `src/pages/Fornecedores.tsx` + `src/hooks/useFornecedores.ts`

---

## Arquitetura do Módulo Estoque

### Tabela: `estoque_produtos` (insumos, não confundir com `produtos` que são serviços)
| Coluna | Tipo |
|---|---|
| id | uuid PK |
| nome | text NOT NULL |
| categoria | text (quimico, embalagem, epi, manutencao, outros) |
| unidade | text (litro, kg, unidade, metro) |
| quantidade_atual | numeric DEFAULT 0 |
| quantidade_minima | numeric DEFAULT 0 (alerta de reposição) |
| preco_custo | numeric DEFAULT 0 |
| fornecedor_id | uuid FK → fornecedores |
| localizacao | text (ex: "Prateleira A3") |
| ativo | boolean DEFAULT true |
| created_at / updated_at | timestamptz |

### Tabela: `movimentacoes_estoque` (entradas e saidas)
| Coluna | Tipo |
|---|---|
| id | uuid PK |
| estoque_produto_id | uuid FK → estoque_produtos |
| tipo | text (entrada, saida, ajuste) |
| quantidade | numeric |
| motivo | text |
| fornecedor_id | uuid FK → fornecedores (para entradas) |
| custo_unitario | numeric |
| funcionario_id | uuid FK → funcionarios |
| created_at | timestamptz |

### Página: `/estoque`
- **Dashboard de estoque**: cards com total de itens, itens abaixo do mínimo, valor total em estoque
- **Lista de insumos**: tabela com nome, quantidade atual, mínimo, status (OK / Baixo / Crítico)
- **Modal de entrada**: registrar compra (vincula ao fornecedor, atualiza quantidade)
- **Modal de saída**: registrar consumo (vincula à produção ou uso geral)
- **Alertas visuais**: itens com `quantidade_atual <= quantidade_minima` em destaque vermelho

### Arquivos:
- `src/pages/Estoque.tsx`
- `src/hooks/useEstoque.ts`
- `src/hooks/useMovimentacoesEstoque.ts`
- `src/components/estoque/EstoqueDashboard.tsx`
- `src/components/estoque/EntradaEstoqueModal.tsx`
- `src/components/estoque/SaidaEstoqueModal.tsx`

---

## Fluxo integrado

```text
Fornecedor → Entrada no Estoque → Produção consome → Saída do Estoque
                                         ↓
                                  Contas a Pagar (custo)
```

- Ao registrar entrada, pode gerar automaticamente uma conta a pagar em `contas_pagar`
- Alerta no Dashboard quando insumos estiverem abaixo do mínimo

## Resumo de implementação

| Item | Tipo |
|---|---|
| 2 tabelas novas (fornecedores, estoque_produtos) | Migração SQL |
| 1 tabela de movimentações (movimentacoes_estoque) | Migração SQL |
| RLS para as 3 tabelas | Migração SQL |
| 2 páginas novas | Código |
| 3 hooks novos | Código |
| ~4 componentes de estoque | Código |
| Sidebar + App.tsx (rotas) | Código |

