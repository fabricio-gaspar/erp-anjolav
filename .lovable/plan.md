

# Separação completa entre Residencial e Industrial no módulo Lançamentos e Relatórios

## Contexto

O sistema já tem a regra de segmentação: Industrial usa Lançamentos/Faturamento, Residencial usa PDV/Caixa. Porém a separação não está sendo aplicada consistentemente:

- **NovoLancamentoTab**: lista TODOS os clientes no combobox, sem filtrar por `classificacao === "industrial"`
- **PendentesTab**: já filtra industrial (linha 47) — OK
- **FaturasTab**: não filtra — mostra faturas de qualquer cliente
- **ConferenciaTab**: não filtra — mostra OS de qualquer cliente
- **RelatoriosCliente**: lista TODOS os clientes no select, sem filtrar

## Correções

### 1. `src/components/lancamentos/NovoLancamentoTab.tsx`
- No `clientesFiltrados` (linha 92-101), adicionar filtro `.filter(c => c.classificacao === "industrial")` antes do `.slice(0, 20)`
- Isso garante que apenas clientes industriais apareçam no combobox de seleção

### 2. `src/components/lancamentos/FaturasTab.tsx`
- Sem mudança necessária: faturas são geradas a partir de lançamentos que já são industriais. A tabela `faturas` vincula ao `cliente_id` e os dados vêm dos lançamentos pendentes (já filtrados)

### 3. `src/components/lancamentos/ConferenciaTab.tsx`
- No hook `useConferenciaProducao`, as OS consultadas são do fluxo de produção industrial. Porém, se houver OS residenciais no sistema, elas apareceriam
- Adicionar filtro no `filteredConferencias` para incluir apenas OS de clientes com `classificacao === "industrial"`

### 4. `src/pages/RelatoriosCliente.tsx`
- No select de clientes (que usa `useClientes()`), filtrar para mostrar apenas clientes industriais: `.filter(c => c.classificacao === "industrial")`

### 5. `src/pages/Lancamentos.tsx`
- O contador de pendentes no badge da aba usa `useLancamentosPendentes()` sem filtro. Filtrar para contar apenas lançamentos de clientes industriais

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/lancamentos/NovoLancamentoTab.tsx` | Filtrar combobox de clientes para industrial |
| `src/components/lancamentos/ConferenciaTab.tsx` | Filtrar OS para clientes industriais |
| `src/pages/RelatoriosCliente.tsx` | Filtrar select de clientes para industrial |
| `src/pages/Lancamentos.tsx` | Filtrar contador de pendentes para industrial |

Nenhuma migração de banco necessária.

