

# Inserir itens da imagem para ADEGA E RESTAURANTE QUINTA DO OLIVARDO

## Dados extraídos da imagem

| Código | Nome | Unidade | Preço |
|--------|------|---------|-------|
| 614 | TOALHA DE MESA LOCAÇÃO | Quantidade | 0,50 |
| 186 | MANTA | Quantidade | 29,00 |
| 44 | COBERTOR | Quantidade | 43,00 |
| 266 | LUVAS DE COZINHA | Quantidade | 0,00 |
| 615 | GUARDANAPO LOC | Quantidade | 0,00 |
| 30 | CAMINHO DE MESA | Quantidade | 0,00 |
| 754 | TOALHA DE MESA DELES | Quantidade | 1,80 |
| 755 | GUARDANAPO DELES | Quantidade | 0,50 |
| 892 | EMPRESTADO GUARDANAPO | Quantidade | 0,50 |

## Situação atual
- Cliente ID: `7586051a-af34-4af7-a126-2f0a8d456216`
- Possui **65 preços especiais** cadastrados atualmente
- Produtos que **já existem** na tabela `produtos`: COBERTOR, LUVAS DE COZINHA, CAMINHO DE MESA
- Produtos que **NÃO existem** e precisam ser criados: TOALHA DE MESA LOCAÇÃO, MANTA, GUARDANAPO LOC, TOALHA DE MESA DELES, GUARDANAPO DELES, EMPRESTADO GUARDANAPO

## Ações a executar

### 1. Excluir todos os preços especiais do cliente
Deletar os 65 registros atuais em `precos_especiais` para este cliente.

### 2. Criar produtos que não existem
Inserir 6 novos produtos na tabela `produtos` (TOALHA DE MESA LOCAÇÃO, MANTA, GUARDANAPO LOC, TOALHA DE MESA DELES, GUARDANAPO DELES, EMPRESTADO GUARDANAPO) com unidade "Quantidade".

### 3. Inserir os 9 preços especiais da imagem
Para cada item, verificar se já existe um `precos_especiais` com **mesmo nome e mesmo valor** — como acabamos de limpar tudo, todos serão inseridos. A verificação serve como proteção extra.

### Resumo esperado
- **9 itens inseridos** (todos novos após exclusão)
- **0 itens ignorados**

Nenhuma alteração de código — apenas operações de dados no banco.

