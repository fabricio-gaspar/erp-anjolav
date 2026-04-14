

## Plano: Sistema de Eventos + Férias de Funcionários no Dashboard

### 1. Migração de Banco de Dados

**Tabela `eventos_agenda` (nova)**
- `id`, `titulo`, `descricao`, `data_evento DATE`, `horario TIME`, `tipo` (lembrete/reuniao/tarefa/outro), `cor` (para visual no calendário), `concluido BOOLEAN DEFAULT false`, `created_at`, `updated_at`

**Tabela `funcionarios` — novos campos**
- `data_admissao DATE` — data de admissão
- `carga_horaria INTEGER DEFAULT 44` — horas semanais
- `dias_trabalhados TEXT[] DEFAULT '{seg,ter,qua,qui,sex}'` — dias da semana

### 2. Nova Página: Agenda de Eventos (`src/pages/AgendaEventos.tsx`)
- Calendário mensal com destaque nos dias que possuem eventos
- Lista de eventos do dia selecionado
- Formulário lateral/modal para criar/editar evento (título, descrição, data, horário, tipo)
- Marcar evento como concluído
- Rota: `/agenda-eventos`

### 3. Hook `useEventosAgenda`
- CRUD completo da tabela `eventos_agenda`
- Query para eventos do dia atual (para o Dashboard)

### 4. Hook `useFeriasProximas`
- Consulta `funcionarios` onde `data_admissao` + N anos = próximos 30 dias
- Calcula período aquisitivo e data de férias devidas
- Retorna lista de funcionários com férias próximas

### 5. Formulário de Funcionários — Novos Campos
- Adicionar campos `data_admissao`, `carga_horaria`, `dias_trabalhados` no formulário existente em Configurações > Equipe
- Atualizar `useFuncionarios` com os novos campos na interface

### 6. Dashboard — 2 Cards Novos
- **Card "Eventos do Dia"**: lista eventos de hoje com ícone, horário e título. Link para `/agenda-eventos`.
- **Card "Férias Próximas"**: lista funcionários com férias vencendo nos próximos 30 dias, mostrando nome, data de admissão e dias restantes.

### 7. Sidebar
- Adicionar item "Agenda Pessoal" ou "Eventos" no menu lateral apontando para `/agenda-eventos`

### Resultado
Sistema completo de lembretes com calendário visual, formulário de eventos, controle de férias baseado na data de admissão, e dois cards no Dashboard alertando sobre eventos do dia e férias próximas de funcionários.

