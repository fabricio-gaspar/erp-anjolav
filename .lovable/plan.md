

## Plano: Exibir nome do cliente nas abas de cadastro

### Problema
Ao navegar pelas abas (Dados, Endereço, Pagamento, Config., Contrato, Preços), não há indicação visual de qual cliente está sendo editado.

### Solução
Adicionar um banner/header acima das abas (quando `selectedClienteId` existe) mostrando o nome da empresa e classificação (Industrial/Residencial). Quando for novo cliente (sem ID), exibir "Novo Cliente".

### Implementação

**Arquivo: `src/pages/Clientes.tsx`**
- Usar o hook `useClienteById(selectedClienteId)` para obter os dados do cliente selecionado
- Quando `activeTab !== "lista"`, renderizar um banner com:
  - Nome/Razão Social do cliente (ou "Novo Cliente")
  - Nome Fantasia (se houver)
  - Badge Industrial/Residencial
  - CPF/CNPJ
- Posicionar entre o botão "Voltar para Lista" e as abas

### Outros módulos
- **Fornecedores**: usa Dialog modal (já exibe nome no título do modal) -- não precisa
- **Produtos**: usa form inline com nome visível no campo -- não precisa
- **Ordens de Serviço**: `DetalhesOS` e `NovaOS` já exibem dados do cliente no próprio formulário -- não precisa

Apenas o módulo **Clientes** precisa desta alteração.

### Resultado visual
```text
[← Voltar para Lista]

┌─────────────────────────────────────────────┐
│ 🏢 Lavanderia Industrial ABC Ltda     [ID1] │
│    Nome Fantasia: ABC Lavanderia             │
│    CNPJ: 12.345.678/0001-90                  │
└─────────────────────────────────────────────┘

[Lista] [Dados] [Endereço] [Pagamento] [Config] [Contrato] [Preços]
```

