

# Cadastro em Massa de Clientes

## Resumo

Inserir 36 novos clientes e atualizar os 4 existentes no banco de dados, incluindo dados basicos e configuracoes de pagamento/faturamento para cada um.

## Clientes ja existentes (serao atualizados)

4 clientes ja estao cadastrados e terao suas configuracoes de pagamento ajustadas:
1. ADEGA E RESTAURANTE QUINTA DO OLIVARDO LTDA
2. ALDEIA PARQUE E POUSADA LTDA
3. CARBOTEX QUIMICA INDUSTRIA...
4. COMERCIO DE PRODUTOS ALIMENTICIOS CASA ARAUCARIA LTDA

## Clientes novos (serao inseridos)

36 novos clientes serao criados com todos os dados informados.

## Mapeamento dos campos

Os dados fornecidos serao mapeados para as tabelas do sistema assim:

| Campo informado | Tabela/Coluna no banco |
|---|---|
| NOME DA EMPRESA | clientes.razao_social |
| CNPJ | clientes.cpf_cnpj + tipo_pessoa (cpf ou cnpj) |
| E-MAIL | clientes.email |
| DIAS DE VENCIMENTO | configuracoes_pagamento_cliente.condicao_pagamento (ex: '10_dias') |
| CONTRATO MENSAL | configuracoes_pagamento_cliente.tipo_faturamento ('mensal' ou 'avulso') |
| PLANILHA | configuracoes_pagamento_cliente.listar_itens_detalhados (true/false) |
| EMISSAO CNPJ | configuracoes_pagamento_cliente.cnpj_emissor_id (referencia a configuracoes_fiscais) |
| BOLETO CNPJ | configuracoes_pagamento_cliente.forma_pagamento ('boleto' ou 'pix') |
| ENVIO WHATSAPP | clientes.observacoes (registrado como nota) |
| SERVICO/DESCRICAO | configuracoes_pagamento_cliente.descricao_nf_id |

### CNPJs Emissores disponiveis no sistema

- **07.528.955/0001-65** = ANJOLAV (id: 8719604a...)
- **23.227.029/0001-06** = LAVANDERIA SAO ROQUE (id: 4eed988a...)

### Forma de pagamento

- Quando BOLETO CNPJ = "PIX" -> forma_pagamento = 'pix'
- Quando BOLETO CNPJ = numero CNPJ -> forma_pagamento = 'boleto'

### Classificacao

Todos os clientes serao cadastrados como **industrial** (tipo_pessoa = 'cnpj'), exceto SILVANA MORAES que tem CPF e sera tipo_pessoa = 'cpf'.

## Execucao

Sera feito via SQL direto no banco de dados usando INSERT e UPDATE, dividido em etapas:

1. **Inserir os 36 novos clientes** na tabela `clientes`
2. **Inserir configuracoes de pagamento** na tabela `configuracoes_pagamento_cliente` para todos os novos
3. **Atualizar configuracoes de pagamento** dos 4 clientes existentes

Nenhuma alteracao de codigo ou schema e necessaria - apenas insercao/atualizacao de dados.

