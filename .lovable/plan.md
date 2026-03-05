

# Melhoria Completa do Fluxo de Faturamento

## Problemas Confirmados

1. **Dados fragmentados**: `PendentesTab` monta `DadosFaturamento` com apenas 7 campos basicos (nome, doc, email, telefone, itens, valor, periodo). Faltam: inscricao_municipal/estadual, regime_tributario, endereco completo, configPagamento, configCliente.

2. **Queries duplicadas**: EtapaNF faz 4 queries (useClienteById, useEnderecoCliente, useConfiguracaoPagamentoCliente, useConfiguracoesFiscais). EtapaPagamento repete useConfiguracaoPagamentoCliente + useConfiguracoesGerais. EtapaEnvio repete useConfiguracaoCliente + useConfiguracoesGerais.

3. **CNPJ emissor ignorado**: EtapaNF detecta `configPagamento.cnpj_emissor_id` (linhas 80-96) mas nunca seleciona essa config — sempre usa `configuracaoAtiva` global.

4. **Codigo duplicado em EtapaNF**: `handlePreviewPdf` (linhas 214-270) e `handlePrintPreview` (linhas 272-328) sao identicos (~60 linhas cada).

5. **ROL generico na EtapaEnvio**: O `handleDownloadROL` gera HTML basico sem usar tipo de relatorio configurado nem dados da empresa.

6. **FaturasTab incompleto**: `reconstruirDadosFaturamento` so popula campos basicos ao retomar fatura.

## Plano de Implementacao

### 1. Expandir interface `DadosFaturamento` (FaturamentoModal.tsx)

Adicionar campos:
- `clienteInscricaoMunicipal`, `clienteInscricaoEstadual`, `clienteRegimeTributario`, `clienteClassificacao`
- `clienteEndereco` (objeto: logradouro, numero, bairro, cidade, uf, cep)
- `configPagamento` (cnpj_emissor_id, descricao_nf_id, listar_itens_detalhados, forma_pagamento, dia_fechamento, condicao_pagamento, dia_vencimento)
- `configCliente` (tipo_relatorio, codigo_acesso, link_acesso)

### 2. Criar hook centralizado `useDadosFaturamentoCompletos` (NOVO)

Arquivo: `src/hooks/useDadosFaturamento.ts`

Combina em uma unica chamada: dados do cliente, endereco, config pagamento, config cliente. Retorna objeto tipado pronto para preencher `DadosFaturamento`.

### 3. Atualizar PendentesTab — popular dados completos

Usar o novo hook para buscar todos os dados do cliente ao montar `dadosFaturamento`, populando os novos campos (endereco, configs, inscricoes).

### 4. Atualizar FaturasTab — reconstruir dados completos

`reconstruirDadosFaturamento` passa a buscar dados completos do cliente ao retomar fatura existente (usando o hook centralizado).

### 5. Refatorar EtapaNF — usar dados centralizados + CNPJ emissor

- Remover `useClienteById`, `useEnderecoCliente`, `useConfiguracaoPagamentoCliente` — usar `dados.*`
- Quando `dados.configPagamento?.cnpj_emissor_id` existe, **selecionar essa config fiscal** como ativa em vez da global
- Extrair funcao `buildNFPreviewData()` para eliminar duplicacao entre handlePreviewPdf e handlePrintPreview

### 6. Refatorar EtapaPagamento — usar dados centralizados

- Remover `useConfiguracaoPagamentoCliente` — usar `dados.configPagamento`
- Manter `useConfiguracoesGerais` (dados bancarios/PIX da empresa)

### 7. Refatorar EtapaRelatorio — usar dados centralizados

- Remover `useConfiguracaoCliente` — usar `dados.configCliente?.tipo_relatorio`

### 8. Refatorar EtapaEnvio — usar dados centralizados + melhorar ROL

- Remover `useConfiguracaoCliente` — usar `dados.configCliente`
- Melhorar `handleDownloadROL` com dados da empresa (nome, CNPJ, logo do ROL config) e respeitar tipo de relatorio

## Arquivos Afetados (8)

| Arquivo | Acao |
|---|---|
| `src/hooks/useDadosFaturamento.ts` | NOVO — hook centralizado |
| `src/components/faturamento/FaturamentoModal.tsx` | Expandir interface DadosFaturamento |
| `src/components/lancamentos/PendentesTab.tsx` | Popular dados completos do cliente |
| `src/components/lancamentos/FaturasTab.tsx` | Atualizar reconstruirDadosFaturamento |
| `src/components/faturamento/EtapaRelatorio.tsx` | Usar dados.configCliente |
| `src/components/faturamento/EtapaNF.tsx` | Usar CNPJ emissor do cliente, extrair buildNFPreviewData, remover queries |
| `src/components/faturamento/EtapaPagamento.tsx` | Usar dados.configPagamento |
| `src/components/faturamento/EtapaEnvio.tsx` | Usar dados.configCliente, melhorar ROL |

