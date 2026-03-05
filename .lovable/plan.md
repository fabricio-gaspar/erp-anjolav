
# Auditoria Completa — Correções Aplicadas

## Migração Executada (Fase 1 — Críticos)

### ✅ Correções de FK aplicadas:
1. `contas_pagar.fornecedor_id` → FK para `fornecedores(id)` ON DELETE SET NULL
2. `caixas.operador_id` → FK para `funcionarios(id)` ON DELETE SET NULL
3. `lancamentos_cliente.cliente_id` → FK para `clientes(id)` ON DELETE CASCADE
4. `lancamentos_cliente.ordem_servico_id` → FK para `ordens_servico(id)` ON DELETE SET NULL
5. `itens_lancamento_cliente.produto_id` → FK para `produtos(id)` ON DELETE RESTRICT
6. `caixa_movimentacoes.cliente_id` → FK para `clientes(id)` ON DELETE SET NULL
7. `caixa_movimentacoes.ordem_servico_id` → FK para `ordens_servico(id)` ON DELETE SET NULL

### ✅ Constraints de integridade:
- `UNIQUE INDEX idx_clientes_cpf_cnpj_unique` (parcial, ignora NULL/vazio)
- `CHECK chk_contas_pagar_valor_positivo` (valor >= 0)
- `CHECK chk_lancamentos_valor_positivo` (valor_total >= 0)
- `CHECK chk_faturas_valor_positivo` (valor_total >= 0)
- `CHECK chk_movimentacoes_valor_positivo` (valor >= 0)

### ✅ Dados órfãos limpos:
- Removido 1 registro em `lancamentos_cliente` que referenciava cliente inexistente

### ✅ Hooks atualizados:
- `useContasPagar` — interface com `fornecedor_id`
- `useCaixa` — interfaces com `operador_id`, `cliente_id`, `ordem_servico_id`

---

## Pendente (Fases futuras)

### Fase 2 — Segurança (RLS granular)
- Criar função `has_module_access(user_id, modulo)` SECURITY DEFINER
- Aplicar nas políticas RLS em vez de `USING (true)`
- Verificar `modulo_permissoes` no ProtectedRoute

### Fase 3 — Tabelas complementares
- `audit_log` — rastreabilidade de ações
- `historico_precos` — registrar alterações de preço

### Fase 4 — Melhorias de fluxo
- Vincular vendas PDV ao financeiro (contas_receber ou view)
- Tratamento de estorno em OS cancelada
- CASCADE em `lancamentos.fatura_id`
