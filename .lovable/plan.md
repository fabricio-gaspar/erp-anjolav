

## Plano: Implementar os 5 Itens Parciais do Sistema

### Resumo
Completar os 5 requisitos que estão parcialmente implementados: orçamento formal, notificação de atraso, rankings globais, controle por lote e rastreamento para o cliente.

---

### 1. Orçamento Formal (separado do pedido)

**Situação atual**: O PDV calcula valor automaticamente, mas não existe conceito de "orçamento" que pode ser aprovado/rejeitado antes de virar OS.

**O que será feito**:
- Criar tabela `orcamentos` (cliente_id, itens_snapshot JSON, valor_total, status: rascunho/enviado/aprovado/rejeitado, validade, observacoes)
- Criar página `/orcamentos` com listagem e formulário de criação (similar à NovaOS, mas sem criar OS)
- Botão "Converter em OS" que transforma orçamento aprovado em ordem de serviço
- Botão "Enviar via WhatsApp" usando o serviço de notificação existente
- Adicionar item "Orçamentos" no menu lateral (grupo Operacional)

**Arquivos**: nova tabela via migration, `src/pages/Orcamentos.tsx`, `src/hooks/useOrcamentos.ts`, `src/components/orcamentos/NovoOrcamentoModal.tsx`, sidebar e rotas

---

### 2. Notificação Automática de Atraso

**Situação atual**: Templates de notificação existem, alertas de OS atrasada aparecem no Portal do Cliente, mas não há disparo automático de WhatsApp.

**O que será feito**:
- Criar componente `AlertasAtraso` no Dashboard que detecta OS com `data_previsao_entrega < hoje` e status diferente de "entregue"
- Exibir card com lista de OS atrasadas e botão "Notificar Cliente" para cada uma
- Ao clicar, dispara `dispararNotificacao("os_atrasada", dados)` usando o serviço existente
- Adicionar badge de alerta no Dashboard com contagem de OS atrasadas
- Registrar no banco quais notificações já foram enviadas (evitar spam)

**Arquivos**: `src/components/dashboard/AlertasAtrasoCard.tsx`, update em `Dashboard.tsx`, nova tabela `notificacoes_enviadas` (os_id, evento, data_envio)

---

### 3. Rankings Globais (Clientes Frequentes + Serviços Mais Vendidos)

**Situação atual**: Relatório Financeiro tem aba "Clientes" com resumo por valor, mas falta ranking de frequência. Não há ranking global de serviços.

**O que será feito**:
- Adicionar na aba "Clientes" do Relatório Financeiro uma coluna "Frequência" (qtd de lançamentos/OS no período)
- Adicionar na aba "Produtos" do Relatório Financeiro colunas de ranking com ordenação por quantidade e por valor
- Criar card "Top 5 Clientes" no Dashboard principal mostrando clientes com mais OS/lançamentos
- Criar card "Serviços Mais Vendidos" no Dashboard com os 5 produtos mais processados

**Arquivos**: update em `src/pages/RelatorioFinanceiro.tsx`, `src/hooks/useRelatorioFinanceiro.ts`, `src/pages/Dashboard.tsx`, novos componentes `TopClientesCard.tsx` e `TopServicosCard.tsx`

---

### 4. Controle por Lote na Produção

**Situação atual**: Etapa de separação existe no Kanban, mas não há agrupamento formal de OS em lotes para processamento conjunto.

**O que será feito**:
- Criar tabela `lotes_producao` (numero_lote auto-gerado, data_criacao, status: aberto/em_processo/finalizado, etapa_atual, observacoes)
- Criar tabela `lotes_ordens` (lote_id, ordem_servico_id) — relação N:N
- No FluxoProducao, adicionar botão "Criar Lote" que agrupa OS selecionadas da mesma etapa
- Exibir badge com número do lote nos cards do Kanban
- Permitir avançar todas as OS do lote juntas para a próxima etapa

**Arquivos**: 2 migrations, `src/hooks/useLotesProducao.ts`, `src/components/producao/CriarLoteModal.tsx`, update em `FluxoProducao.tsx`

---

### 5. Rastreamento para o Cliente (Portal)

**Situação atual**: O Portal do Cliente mostra status da OS e histórico, mas não há uma view de "rastreamento" visual estilo delivery.

**O que será feito**:
- No Portal do Cliente, criar componente `RastreamentoOS` com timeline visual mostrando todas as etapas (Retirada → Separação → Lavagem → Secagem → Passadoria → Embalagem → Entrega)
- Destacar a etapa atual com animação de progresso
- Mostrar data/hora de entrada em cada etapa (dados já existem em `historico_producao`)
- Exibir tempo estimado restante baseado na média histórica
- Adicionar link de rastreamento compartilhável via WhatsApp

**Arquivos**: `src/components/portal/RastreamentoOS.tsx`, update em `PortalCliente.tsx`

---

### Ordem de Implementação
1. Rankings Globais (menor risco, só UI)
2. Notificação de Atraso (usa serviço existente)
3. Rastreamento no Portal (usa dados existentes)
4. Orçamento Formal (nova tabela + CRUD)
5. Controle por Lote (mais complexo, 2 tabelas + lógica de grupo)

### Tabelas Novas (migrations)
- `orcamentos` — orçamentos formais
- `notificacoes_enviadas` — log de notificações
- `lotes_producao` — lotes de produção
- `lotes_ordens` — OS vinculadas a lotes

