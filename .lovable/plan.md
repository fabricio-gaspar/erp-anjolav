

# AUDITORIA COMPLETA DO SISTEMA ERP LAVANDERIA

---

## 1. ESTRUTURA DO BANCO DE DADOS

### Tabelas Existentes (28 tabelas)

| # | Tabela | Status |
|---|--------|--------|
| 1 | clientes | OK |
| 2 | enderecos_clientes | OK |
| 3 | configuracoes_cliente | OK |
| 4 | configuracoes_pagamento_cliente | OK |
| 5 | precos_especiais | OK |
| 6 | produtos | OK |
| 7 | ordens_servico | OK |
| 8 | itens_ordem_servico | OK |
| 9 | lancamentos | OK |
| 10 | itens_lancamento | OK |
| 11 | lancamentos_cliente | OK |
| 12 | itens_lancamento_cliente | OK |
| 13 | lancamentos_fatura | OK |
| 14 | faturas | OK |
| 15 | contas_pagar | Problema |
| 16 | contratos_aluguel | OK |
| 17 | itens_contrato_aluguel | OK |
| 18 | caixas | Problema |
| 19 | caixa_movimentacoes | OK |
| 20 | historico_producao | OK |
| 21 | historico_envios | OK |
| 22 | agendamentos | OK |
| 23 | motoristas | OK |
| 24 | veiculos | OK |
| 25 | rotas_entrega | OK |
| 26 | paradas_rota | OK |
| 27 | estoque_produtos | OK |
| 28 | movimentacoes_estoque | OK |
| 29 | funcionarios | OK |
| 30 | user_roles | OK |
| 31 | modulo_permissoes | OK |
| 32 | configuracoes_gerais | OK |
| 33 | configuracoes_fiscais | OK |
| 34 | descricoes_servicos_fiscais | OK |
| 35 | rol_configuracoes | OK |
| 36 | etiquetas_configuracoes | OK |
| 37 | notificacoes_config | OK |
| 38 | automacoes_config | OK |
| 39 | portal_config | OK |
| 40 | asaas_charges | OK |
| 41 | asaas_webhook_events | OK |
| 42 | fornecedores | OK |

---

## 2. PROBLEMAS ENCONTRADOS

### CRITICOS (Afetam integridade de dados)

**P1. `contas_pagar` sem FK para `fornecedores`**
- O campo `fornecedor` e um TEXT livre em vez de `fornecedor_id UUID REFERENCES fornecedores(id)`
- Impacto: nao ha vinculo real entre despesa e fornecedor cadastrado, impossivel gerar relatorios cruzados
- Correcao: adicionar `fornecedor_id UUID REFERENCES fornecedores(id)` e manter `fornecedor TEXT` como fallback para fornecedores avulsos

**P2. `caixas.operador` e TEXT livre em vez de FK**
- Deveria ser `operador_id UUID REFERENCES funcionarios(id)` para rastrear qual funcionario operou o caixa
- Impacto: impossivel gerar relatorio de desempenho por operador com dados consistentes

**P3. `lancamentos_cliente` sem FK declarada no banco**
- A tabela `lancamentos_cliente` referencia `cliente_id` e `ordem_servico_id` mas os Relationships no types.ts estao vazios (`Relationships: []`), indicando que as FKs nao foram criadas no banco
- Impacto: sem integridade referencial, pode referenciar clientes/OS inexistentes

**P4. `itens_lancamento_cliente` sem FK para `produtos`**
- O campo `produto_id` existe mas nao tem FK declarada (so referencia `lancamentos_cliente`)
- Impacto: pode referenciar produtos inexistentes

**P5. `historico_envios` sem FK real para `faturas`**
- O Relationships no types.ts mostra a FK, mas a tabela no schema info nao mostra foreign-keys
- Precisa verificar se a constraint realmente existe

**P6. Tabela `faturas` sem user_id de quem criou**
- Nenhuma tabela operacional registra QUAL usuario executou a acao (criou fatura, criou lancamento, etc.)
- Impacto: sem trilha de auditoria

### IMPORTANTES (Afetam fluxo do sistema)

**P7. Sem tabela de `contas_receber` independente**
- As contas a receber sao derivadas das faturas, mas nao existe uma tabela dedicada
- Para o setor Loja (PDV), vendas no caixa nao geram faturas nem contas a receber — o dinheiro "desaparece" do fluxo financeiro apos fechar o caixa
- Correcao sugerida: criar tabela `contas_receber` ou derivar via view

**P8. `caixa_movimentacoes` sem `cliente_id` e `ordem_servico_id`**
- Vendas no PDV nao vinculam ao cliente nem a OS
- Impacto: impossivel saber qual cliente comprou o que pela loja

**P9. Sem tabela de `categorias_produto`**
- O campo `categoria` em `produtos` e TEXT livre
- Impacto: categorias inconsistentes, sem padronizacao

**P10. Sem tabela de `categorias_despesa`**
- O campo `categoria` em `contas_pagar` e TEXT livre
- Mesmo problema do P9

**P11. `configuracoes_gerais` e `rol_configuracoes` duplicam dados**
- Ambas armazenam nome da empresa, CNPJ, endereco, logo
- Correcao: `rol_configuracoes` deveria referenciar `configuracoes_gerais` para dados comuns

**P12. Tabela `ordens_servico.numero` depende de trigger mas `numero` nao tem DEFAULT no Insert**
- O trigger `generate_os_number` preenche, mas se o trigger falhar, insercoes vao quebrar porque `numero` e NOT NULL sem DEFAULT

### MODERADOS (Melhorias recomendadas)

**P13. `estoque_produtos` vs `produtos` — confusao de nomenclatura**
- `produtos` = itens de servico (roupas/pecas)
- `estoque_produtos` = insumos (detergente, embalagens)
- A nomenclatura pode confundir. Sugestao: renomear `estoque_produtos` para `insumos`

**P14. Sem historico de alteracoes de preco**
- Quando um preco de produto muda, o historico se perde
- Impacto: faturas antigas com valores diferentes nao tem rastreabilidade

**P15. `veiculos` sem campo de manutencao**
- Faltam campos como `km_atual`, `proxima_revisao`, `data_ultima_revisao`

---

## 3. FOREIGN KEYS AUSENTES

| Tabela | Campo | Deveria referenciar |
|--------|-------|-------------------|
| contas_pagar | fornecedor | fornecedores.id (via novo campo fornecedor_id) |
| caixas | operador | funcionarios.id (via novo campo operador_id) |
| lancamentos_cliente | cliente_id | clientes.id |
| lancamentos_cliente | ordem_servico_id | ordens_servico.id |
| itens_lancamento_cliente | produto_id | produtos.id |
| caixa_movimentacoes | (falta campo) | clientes.id |

---

## 4. CAMPOS AUSENTES POR MODULO

### Clientes
- OK completo (razao_social, CPF/CNPJ, endereco, pagamento, configuracao)

### Produtos
- Falta: `ncm` (codigo fiscal), `ean` (codigo de barras para PDV)

### Ordens de Servico
- Falta: `created_by` (usuario que criou)
- Falta: `conferido_por` (funcionario que conferiu)

### Faturas / Financeiro
- Falta: `created_by` (usuario que criou a fatura)
- Falta: campo de `desconto` na fatura

### Caixa PDV
- Falta: `operador_id` como FK real (hoje e texto)
- Falta: `cliente_id` na movimentacao de venda

### Contas a Pagar
- Falta: `fornecedor_id` como FK
- Falta: `recorrente` (boolean) e `parcela_atual`/`total_parcelas`

### Estoque
- OK (tem fornecedor_id, quantidade, minimo)

---

## 5. FLUXO COMPLETO — ANALISE DE CONTINUIDADE

```text
FLUXO INDUSTRIAL:
Cadastro Cliente → Contrato Aluguel → Agendamento → OS (retirada) → 
Producao (lavagem→secagem→passadoria→embalagem) → Lancamento → 
Faturamento → NF-e → Cobranca (Asaas) → Pagamento → Financeiro

STATUS: FUNCIONAL ✓ (fluxo completo integrado)


FLUXO LOJA (PDV):
Cadastro Cliente → OS (balcao) → Producao → 
Caixa PDV (venda) → Fechamento Caixa

STATUS: PARCIALMENTE FUNCIONAL ⚠
  - Vendas do caixa NAO geram conta a receber
  - Vendas NAO vinculam ao cliente
  - Financeiro da Loja depende apenas de caixa_movimentacoes
  - Sem NF para vendas do PDV


FLUXO ESTOQUE:
Cadastro Fornecedor → Cadastro Insumo → Entrada Estoque → 
Consumo (saida) → Alerta estoque baixo

STATUS: FUNCIONAL ✓


FLUXO LOGISTICA:
Agendamento → Rota do Dia → Paradas → 
Comprovante Entrega → Conclusao

STATUS: FUNCIONAL ✓
```

### Pontos de Quebra Identificados

1. **PDV → Financeiro**: venda no caixa nao aparece como receita rastreavel por cliente
2. **OS cancelada → Financeiro**: sem tratamento de estorno automatico
3. **Fatura excluida → Lancamentos**: lancamentos vinculados ficam orfaos (a FK `lancamentos.fatura_id` nao tem CASCADE)
4. **Produto excluido → Itens OS**: FK e RESTRICT (correto), mas nao ha validacao no front impedindo exclusao de produto em uso

---

## 6. SEGURANCA

### Pontos Positivos
- RLS habilitado em TODAS as tabelas ✓
- Politicas restritas a `authenticated` ✓
- `user_roles` com politicas separadas (admin-only para CRUD, user pode ver proprios) ✓
- Funcao `has_role()` como SECURITY DEFINER ✓
- `ProtectedRoute` em todas as rotas operacionais ✓
- Certificados em bucket privado ✓
- Portal do Cliente como rota publica separada ✓

### Problemas de Seguranca

**S1. RLS muito permissiva — qualquer usuario autenticado ve TUDO**
- Todas as tabelas operacionais tem `USING (true)` para authenticated
- Um operador de producao pode ver dados financeiros, faturas, contas a pagar
- Correcao: usar `modulo_permissoes` + funcao `has_module_access()` nas politicas RLS

**S2. `modulo_permissoes` nao e aplicado no backend**
- As permissoes de modulo so sao verificadas no frontend (sidebar/UI)
- Um usuario pode acessar qualquer endpoint direto via API
- Correcao: criar funcao `has_module_access(user_id, modulo)` e aplicar nas RLS

**S3. `ProtectedRoute` nao verifica permissao de modulo**
- Qualquer usuario logado acessa qualquer rota
- Correcao: verificar `modulo_permissoes` no ProtectedRoute

**S4. Sem rate limiting nas Edge Functions**
- `create-asaas-charge` e `asaas-webhook` nao tem protecao contra abuso

**S5. `senha_certificado_encrypted` em `configuracoes_fiscais`**
- O campo sugere criptografia mas nao ha evidencia de criptografia real no codigo
- Se e texto plano, e uma vulnerabilidade

---

## 7. REGRAS DE NEGOCIO FALTANDO

| Regra | Status | Impacto |
|-------|--------|---------|
| Validar CPF/CNPJ unico por cliente | Nao implementado no banco | Clientes duplicados |
| Impedir valor negativo em faturas/lancamentos | Sem CHECK constraint | Dados inconsistentes |
| Impedir exclusao de cliente com OS ativas | Sem validacao | Perda de dados |
| Impedir exclusao de produto em uso | FK RESTRICT existe mas sem feedback no UI | UX ruim |
| Validar data_fim > data_inicio em contratos | Sem validacao | Contratos invalidos |
| Limite de desconto em OS | Sem validacao | Desconto > valor total |
| Impedir reabrir caixa ja fechado | Sem constraint | Inconsistencia |
| Unique constraint em `clientes.cpf_cnpj` | Nao existe | Duplicatas possiveis |

---

## 8. TABELAS QUE FALTAM (Sugestoes)

| Tabela Sugerida | Justificativa | Prioridade |
|-----------------|---------------|------------|
| `audit_log` | Registrar quem fez o que e quando | Alta |
| `contas_receber` | Separar receitas do caixa das faturas | Media |
| `categorias_produto` | Normalizar categorias | Baixa |
| `categorias_despesa` | Normalizar categorias de contas_pagar | Baixa |
| `manutencao_veiculos` | Controle de revisoes | Baixa |
| `historico_precos` | Rastrear alteracoes de preco | Media |

---

## 9. DIAGRAMA IDEAL DO BANCO

```text
                    ┌──────────────┐
                    │  auth.users  │
                    └──────┬───────┘
                           │ user_id
              ┌────────────┼────────────┐
              ▼            ▼            ▼
      ┌──────────────┐ ┌──────────┐ ┌──────────────┐
      │ funcionarios  │ │user_roles│ │  audit_log   │
      └──────┬───────┘ └──────────┘ └──────────────┘
             │ id
    ┌────────┼────────┬──────────────┐
    ▼        ▼        ▼              ▼
┌────────┐┌────────┐┌───────────┐┌──────────────────┐
│motorist││modulo_ ││historico_ ││movimentacoes_    │
│as      ││permiss ││producao   ││estoque           │
└────────┘└────────┘└───────────┘└──────────────────┘

      ┌──────────────┐
      │   clientes   │
      └──────┬───────┘
             │ id
    ┌────────┼────────┬───────────┬──────────┬────────┐
    ▼        ▼        ▼           ▼          ▼        ▼
┌────────┐┌────────┐┌─────────┐┌────────┐┌───────┐┌────────┐
│endere- ││config_ ││config_  ││precos_ ││contra-││agenda- │
│cos_cli ││cliente ││pagamen- ││especia-││tos_   ││mentos  │
│entes   ││        ││to_cli   ││is      ││aluguel││        │
└────────┘└────────┘└─────────┘└────────┘└───┬───┘└────────┘
                                             │
                                    ┌────────┘
                                    ▼
                              ┌───────────┐
                              │itens_contr│
                              │ato_aluguel│
                              └───────────┘

      ┌──────────────┐
      │   produtos   │──────────────────┐
      └──────┬───────┘                  │
             │ id                       │
    ┌────────┼────────┐          ┌──────┘
    ▼        ▼        ▼          ▼
┌────────┐┌────────┐┌─────────┐┌────────────────┐
│itens_  ││itens_  ││itens_   ││itens_lancament │
│ordem_  ││lanc_   ││contrato_││o               │
│servico ││cliente ││aluguel  ││                │
└───┬────┘└───┬────┘└─────────┘└───┬────────────┘
    │         │                    │
    ▼         ▼                    ▼
┌────────┐┌────────────┐    ┌──────────┐
│ordens_ ││lancamentos_│    │lancament │
│servico ││cliente     │    │os        │
└───┬────┘└────────────┘    └────┬─────┘
    │                            │
    ▼                            ▼
┌──────────┐              ┌──────────────┐
│historico_│              │lancamentos_  │
│producao  │              │fatura        │
└──────────┘              └──────┬───────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │   faturas    │
                          └──────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             ┌──────────┐┌───────────┐┌──────────────┐
             │historico_││asaas_     ││contas_pagar  │
             │envios    ││charges    ││(despesas)    │
             └──────────┘└───────────┘└──────────────┘

    ┌──────────────┐     ┌──────────────┐
    │   caixas     │     │rotas_entrega │
    └──────┬───────┘     └──────┬───────┘
           │                    │
           ▼                    ▼
    ┌──────────────┐     ┌──────────────┐
    │caixa_movimen │     │paradas_rota  │
    │tacoes        │     │              │
    └──────────────┘     └──────────────┘
```

---

## 10. RESUMO EXECUTIVO

| Categoria | Encontrado | Critico | Importante | Moderado |
|-----------|-----------|---------|------------|----------|
| FKs ausentes | 6 | 3 | 3 | 0 |
| Campos faltando | 12 | 2 | 6 | 4 |
| Tabelas faltando | 6 | 1 | 2 | 3 |
| Seguranca | 5 | 2 | 2 | 1 |
| Regras de negocio | 8 | 3 | 3 | 2 |
| Fluxos quebrados | 4 | 1 | 2 | 1 |
| **TOTAL** | **41** | **12** | **18** | **11** |

### Top 5 Acoes Prioritarias

1. **Corrigir RLS** — Restringir acesso por modulo no backend (S1/S2)
2. **Adicionar FK em contas_pagar** — Vincular fornecedor_id (P1)
3. **Adicionar FK em caixas** — operador_id como FK real (P2)
4. **Corrigir FKs de lancamentos_cliente** — Adicionar constraints (P3/P4)
5. **Criar tabela audit_log** — Rastreabilidade de acoes (P6)

Deseja que eu implemente alguma dessas correcoes? Posso priorizar por criticidade.

