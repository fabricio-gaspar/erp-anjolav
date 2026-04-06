

# Analise do modulo Fornecedores — Problemas e Melhorias

## Problemas encontrados

### 1. Categorias insuficientes para lavanderia industrial
As categorias atuais sao apenas 4 (Produtos de Limpeza, Embalagens, Manutencao, Outros). Faltam categorias essenciais do segmento:
- **Energia/Agua/Gas** — custos operacionais recorrentes
- **Aluguel** — espaco fisico
- **Transporte/Logistica** — entregas
- **Quimicos/Solventes** — produtos especificos de lavanderia
- **Equipamentos** — maquinas industriais

### 2. Endereco cadastrado mas NAO exibido no formulario
O campo `endereco` (jsonb) e preenchido via consulta CNPJ mas **nao tem campos visiveis** no formulario para editar manualmente. O usuario nao consegue ver nem corrigir o endereco.

### 3. EditarContaPagarModal NAO usa fornecedor cadastrado
O modal de edicao de contas a pagar (`EditarContaPagarModal.tsx`) usa um campo de texto livre para "Fornecedor" em vez do Select com fornecedores cadastrados — perdendo o vinculo `fornecedor_id`. Isso quebra a rastreabilidade.

### 4. Exclusao sem confirmacao
O botao de excluir fornecedor executa `excluirFornecedor.mutate(f.id)` diretamente, sem dialog de confirmacao. Risco de exclusao acidental.

### 5. Historico de contas geradas invisivel
O botao "Gerar conta do mes" nao verifica se ja existe uma conta gerada para aquele fornecedor/mes, podendo criar duplicatas.

### 6. Filtro de status ausente
Nao ha filtro por Ativo/Inativo na listagem. Fornecedores inativos aparecem misturados.

---

## Plano de implementacao

### Arquivo: `src/pages/Fornecedores.tsx`

1. **Ampliar CATEGORIAS** — adicionar: `energia_agua`, `aluguel`, `transporte`, `quimicos`, `equipamentos`
2. **Adicionar campos de endereco no formulario** — apos Contato/Categoria, exibir CEP, Logradouro, Numero, Bairro, Cidade, UF em grid compacto, lidos de `form.endereco`
3. **Adicionar dialog de confirmacao de exclusao** — um AlertDialog simples antes de executar `excluirFornecedor`
4. **Filtro por status** — adicionar Select Ativo/Inativo/Todos junto ao filtro de categoria
5. **Verificar duplicata ao gerar conta** — na funcao `gerarContaMes`, consultar `contas_pagar` para verificar se ja existe conta com mesmo `fornecedor_id` e mes/ano antes de criar

### Arquivo: `src/components/contas/EditarContaPagarModal.tsx`

6. **Substituir campo texto "Fornecedor" por Select** — importar `useFornecedores`, usar Select com fornecedores cadastrados (igual ao NovaContaPagarModal), mantendo opcao de texto livre. Preservar `fornecedor_id` no update.

---

## Resumo de arquivos

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Fornecedores.tsx` | Mais categorias, campos endereco, confirmacao exclusao, filtro status, prevenir duplicatas |
| `src/components/contas/EditarContaPagarModal.tsx` | Select de fornecedor com vinculo `fornecedor_id` |

Nenhuma migracao de banco necessaria — todas as colunas ja existem.

