

# Melhorar integração Fornecedor → Contas a Pagar

## Problema

Ao selecionar um fornecedor com preço recorrente no modal "Nova Despesa", o sistema preenche valor e descrição, mas **não preenche automaticamente a data de vencimento** com base no `dia_vencimento` cadastrado. Isso obriga o usuário a inserir a data manualmente.

## Solução

**Arquivo: `src/components/contas/NovaContaPagarModal.tsx`**

Na função `handleFornecedorSelect`, quando o fornecedor tem `dia_vencimento` configurado:
- Calcular automaticamente a próxima data de vencimento (mês atual ou próximo, se o dia já passou)
- Preencher o campo `vencimento` no formulário
- Manter a categoria do fornecedor (se mapeável)

Alteração na lógica existente (linhas 60-70):
```
// Após selecionar fornecedor com dia_vencimento:
// - Calcular data: se dia_vencimento <= hoje → próximo mês, senão → mês atual
// - Preencher formData.vencimento com essa data formatada YYYY-MM-DD
```

Isso é uma correção pequena em um único arquivo — apenas ~10 linhas adicionais dentro de `handleFornecedorSelect`.

