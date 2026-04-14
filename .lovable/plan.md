

## Plano: ROLs da PDV Loja separados da Produção + Card no Dashboard

### Problema atual
- OS criadas pelo PDV Loja vão para o Fluxo de Produção (Kanban) junto com as industriais
- Não há como distinguir a origem de uma OS (PDV Loja vs Industrial/Lançamentos)
- Não existe card no Dashboard para acompanhar ROLs da loja

### Alterações

#### 1. Migração: adicionar coluna `origem` na tabela `ordens_servico`
```sql
ALTER TABLE public.ordens_servico 
ADD COLUMN origem text NOT NULL DEFAULT 'industrial';
```
Valores: `'industrial'` (padrão, compatível com OS existentes) e `'loja'`.

#### 2. `src/pages/CaixaPDV.tsx` — Marcar origem como `'loja'`
Na criação da OS (linha ~311), adicionar `origem: 'loja'` ao payload do `createOrdemServico`.

#### 3. `src/pages/FluxoProducao.tsx` — Filtrar apenas industriais
Adicionar `.eq("origem", "industrial")` na query de OS do Kanban, excluindo OS da loja.

#### 4. Novo componente `src/components/dashboard/RolsLojaCard.tsx`
- Card com título "ROLs Loja"
- Lista OS com `origem = 'loja'` e status diferente de `entregue`/`cancelada`
- Cada ROL exibe: número, cliente, data retirada, previsão entrega, valor
- **Cores por status**: retirada (azul), separacao (amarelo), lavagem (roxo), secagem (laranja), passadoria (pink), embalagem (cyan), expedicao (verde), entregue (cinza)
- **Filtro**: toggle entre "Data Retirada" e "Data Entrega" + seletor de data
- Ao clicar num ROL, navega para `/caixa` (onde o operador pode consultar a OS)

#### 5. `src/pages/Dashboard.tsx` — Adicionar o card
Inserir `RolsLojaCard` na seção "Caixa PDV" (condicionado a `temCaixa`).

### Resultado
- OS da loja não aparecem mais no Kanban de produção
- Dashboard mostra card com ROLs da loja, coloridos por status, filtráveis por data

