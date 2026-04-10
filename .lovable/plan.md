

## Problema

A página **Histórico de Caixas** com todos os relatórios de fechamento (Resumo, Movimentações, Itens, Peças, Operadores, Diferenças) existe no código (`HistoricoCaixas.tsx`) mas está inacessível porque:
- A rota `/relatorios/caixa` redireciona direto para `/caixa` (o PDV)
- Não há botão no PDV nem item no menu que leve a essa página

## Plano de Correção

### 1. Restaurar a rota no App.tsx
- Importar `HistoricoCaixas` e adicionar a rota `/relatorios/caixa` como rota ativa (não redirect)
- Remover o redirect que sobrescreve essa rota

### 2. Adicionar acesso no PDV
- Adicionar um botão "Relatórios / Histórico" na barra de ações do Caixa PDV que navega para `/relatorios/caixa`

### 3. Adicionar item no menu lateral
- No grupo Financeiro do `AppSidebar.tsx`, adicionar um sub-item "Histórico Caixas" abaixo de "Caixa PDV" apontando para `/relatorios/caixa`

### Arquivos modificados
- `src/App.tsx` — restaurar rota
- `src/pages/CaixaPDV.tsx` — botão de acesso ao histórico
- `src/components/layout/AppSidebar.tsx` — item no menu

