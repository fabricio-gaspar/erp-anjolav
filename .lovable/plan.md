

## Análise do Fluxo Atual

### Como funciona hoje
- **Cards "Retiradas/Entregas do Dia"** no Dashboard → vêm da tabela `agendamentos` (agenda de coletas/entregas)
- **Relatório de Quilometragem** → vem da tabela `rotas_entrega` (rotas com km_inicial/km_final)
- **São tabelas separadas**, sem vínculo direto

### Fluxo do motorista (já correto)
1. Uma rota é criada em `rotas_entrega` com paradas (clientes)
2. Motorista clica "Iniciar Rota" → grava `km_inicial` e `status = em_rota`
3. Motorista clica "Finalizar Rota" → grava `km_final` e `status = concluida`
4. O relatório já filtra apenas `status = concluida` com `km_inicial` e `km_final` preenchidos

**O relatório já só mostra rotas finalizadas pelo motorista.** Isso está correto.

### O problema
Os agendamentos do dia (cards do Dashboard) não geram automaticamente rotas de entrega. São dados separados. Ou seja, se o motorista faz retiradas/entregas que estão nos agendamentos mas ninguém cria uma rota em `rotas_entrega`, a quilometragem não é registrada.

### Plano de Correção

#### 1. Vincular agendamentos às rotas
Quando os agendamentos do dia são exibidos no Dashboard, adicionar um botão/ação para "Gerar Rota" que cria automaticamente uma `rota_entrega` com as paradas baseadas nos agendamentos do dia (retiradas e entregas).

#### 2. Alternativa mais simples
Se as rotas já estão sendo criadas manualmente pelo módulo de Logística (que já existe), o fluxo já está correto:
- Rota criada → Motorista inicia (km_inicial) → Motorista finaliza (km_final) → Aparece no relatório

### Pergunta para você
As rotas já estão sendo criadas pelo módulo de Logística antes do motorista sair? Ou você quer que os agendamentos do dia automaticamente virem rotas para o motorista registrar a quilometragem?

