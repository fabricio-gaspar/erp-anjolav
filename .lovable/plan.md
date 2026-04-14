

## Plano: Número de ROL individual por lançamento

### Contexto
Atualmente a tabela `lancamentos` não possui um campo de numeração sequencial (número do ROL). Cada lançamento já é registrado individualmente (um registro por operação), então a separação já existe — falta apenas a **numeração automática**.

### Alterações

#### 1. Migração — Adicionar coluna `numero_rol` + trigger de auto-numeração
- Adicionar coluna `numero_rol TEXT` na tabela `lancamentos`
- Criar trigger `generate_rol_number` que gera número sequencial no formato `ROL-YYYY-NNNNNN` (ex: `ROL-2026-000001`) ao inserir um novo lançamento
- Preencher retroativamente os lançamentos existentes com números sequenciais

#### 2. `src/hooks/useLancamentos.ts`
- Incluir `numero_rol` na interface `Lancamento`
- O campo virá automaticamente do select `*`

#### 3. `src/components/lancamentos/NovoLancamentoTab.tsx`
- Após finalizar, exibir o `numero_rol` no toast de sucesso: "ROL-2026-000001 registrado com sucesso!"
- Exibir o número do ROL no cabeçalho do painel de itens quando disponível

#### 4. `src/components/lancamentos/PendentesTab.tsx`
- Exibir coluna/badge com o `numero_rol` em cada lançamento pendente

#### 5. `src/hooks/usePrintOS.ts` — Impressão do ROL
- Passar `numero_rol` para os dados de impressão para que apareça no ROL impresso

### Resultado
Cada lançamento recebe automaticamente um número de ROL único e sequencial (ROL-2026-000001), exibido na listagem, na impressão e no toast de confirmação.

