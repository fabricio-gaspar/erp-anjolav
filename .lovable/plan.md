

## Problema Identificado

Os **54 produtos** criados durante o processo de ingestão de tabelas de preços industriais foram cadastrados com `unidade_negocio = 'ambos'`, o que faz com que apareçam no PDV Residencial. Nenhum desses produtos é utilizado por clientes residenciais — todos deveriam ser `ID1` (Industrial).

O filtro do PDV está correto (permite `ID2` e `ambos`), mas os dados estão errados.

## Plano de Correção

### 1. Corrigir os 54 produtos no banco de dados
Executar uma migration para alterar `unidade_negocio` de `'ambos'` para `'ID1'` em todos os produtos que:
- Têm `unidade_negocio = 'ambos'`
- Têm `preco = 0.00` (indicando que foram criados apenas para tabelas de preços industriais)
- **NÃO** são usados por nenhum cliente residencial

```sql
UPDATE produtos 
SET unidade_negocio = 'ID1'
WHERE unidade_negocio = 'ambos' 
  AND preco = 0.00
  AND id NOT IN (
    SELECT pe.produto_id FROM precos_especiais pe
    JOIN clientes c ON c.id = pe.cliente_id
    WHERE c.classificacao = 'residencial'
  );
```

### 2. Resultado esperado
- Os 54 produtos deixarão de aparecer no PDV Residencial
- Os produtos continuarão disponíveis para clientes industriais nas tabelas de preços
- Nenhum dado será perdido

### Detalhes Técnicos
- A query é segura pois verifica se nenhum cliente residencial usa esses produtos
- Produtos com `preco > 0` e `unidade_negocio = 'ambos'` não serão afetados (são produtos legítimos de ambas as unidades)

