

# Melhorias nos Relatórios e Integração do Contrato

## Situação Atual

### Relatórios (Cliente > Config)
Os 3 tipos de relatório existentes atendem bem ao segmento de lavanderia:
- **Detalhado**: tabela com colunas por data/ROL, totais por peça, linha de CONTRATO e total geral
- **Mapa de Peças**: detalhamento por ROL individual (entrada, previsão de entrega, itens)
- **Mapa Mensal**: matriz dias x peças com totais

### Problema encontrado: Contrato DESCONECTADO
O `RelatorioDetalhadoCliente` aceita a prop `valorContrato` e exibe uma linha "CONTRATO" com o valor, MAS na página `RelatoriosCliente.tsx` (onde o relatório é gerado), essa prop **nunca é passada**. O valor do contrato simplesmente não aparece no relatório gerado.

Da mesma forma, nos relatórios **Mapa de Peças** e **Mapa Mensal**, não existe sequer a prop de contrato — o valor do contrato é completamente ignorado.

No faturamento (`FaturamentoModal`), o mesmo problema pode ocorrer: o valor do contrato precisa ser somado ao total da fatura.

---

## Sugestões de melhoria (da melhor forma)

### 1. Conectar o contrato aos relatórios (CORREÇÃO CRÍTICA)
Na página `RelatoriosCliente.tsx`, buscar o contrato ativo do cliente selecionado usando `useContratoCliente` e passar o `valor_servico` como prop para todos os 3 relatórios.

**Arquivos**: `src/pages/RelatoriosCliente.tsx`
- Importar `useContratoCliente` e `useCalculoContrato` de `useContratosAluguel`
- Buscar contrato quando cliente é selecionado
- Passar `valorContrato={contrato?.valor_servico}` ao `RelatorioDetalhadoCliente`
- Adicionar linha CONTRATO também ao `MapaPecasCliente` e `MapaMensalPecas`

### 2. Adicionar linha CONTRATO ao Mapa de Peças e Mapa Mensal
Atualmente só o Relatório Detalhado tem a linha de contrato. Os outros dois relatórios devem mostrar:
- Uma linha separadora após os totais de peças
- "CONTRATO: R$ X.XXX,XX"
- Total geral = peças + contrato

**Arquivos**: `src/components/relatorios/MapaPecasCliente.tsx`, `src/components/relatorios/MapaMensalPecas.tsx`
- Adicionar prop `valorContrato?: number`
- Renderizar linha CONTRATO antes do total geral
- Somar contrato ao total geral

### 3. Melhorar informações no cabeçalho dos relatórios
Puxar dados reais da empresa (de `configuracoes_gerais`) em vez de usar valores hardcoded "ANJOLAV":
- Nome da empresa
- Logo

**Arquivo**: `src/pages/RelatoriosCliente.tsx`
- Importar `useConfiguracoesGerais`
- Passar `empresaNome` e `logoUrl` aos componentes de relatório

### 4. Incluir informações adicionais úteis
- CPF/CNPJ do cliente no cabeçalho
- Endereço do cliente
- Número da cobrança real (sequencial por cliente)

---

## Resumo das alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/RelatoriosCliente.tsx` | Buscar contrato + config da empresa, passar props |
| `src/components/relatorios/MapaPecasCliente.tsx` | Adicionar prop e linha CONTRATO |
| `src/components/relatorios/MapaMensalPecas.tsx` | Adicionar prop e linha CONTRATO |
| `src/components/relatorios/RelatorioDetalhadoCliente.tsx` | Sem mudança (já suporta) |

Nenhuma alteração de banco necessária — todas as tabelas já existem (`contratos_aluguel`, `configuracoes_gerais`).

