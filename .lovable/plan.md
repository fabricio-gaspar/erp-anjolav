

# Plano: Auto-Preencher Observacao, Natureza e Descricao NF do Cliente + Replica Visual da NFS-e Real

## O que sera feito

1. **Observacao da Fatura** - Puxar automaticamente do cadastro do cliente (precisa novo campo no banco)
2. **Natureza da Operacao** - Derivar automaticamente do regime tributario do cliente cadastrado
3. **Tipo de Descricao NF** - Ja esta parcialmente implementado, mas precisa garantir que vem pre-selecionado corretamente do cadastro
4. **Previa Visual da NFS-e** - Replicar identicamente o layout da nota real fornecida (Prefeitura de Sao Roque), corrigindo diferencas visuais

## Fase 1: Novo campo no banco — `observacao_faturamento`

**Migracao SQL**: Adicionar coluna `observacao_faturamento TEXT` na tabela `configuracoes_pagamento_cliente` para armazenar a observacao padrao que sera usada automaticamente na fatura.

## Fase 2: Cadastro do Cliente — Campo de Observacao

**Arquivo: `src/components/clientes/ClientePagamento.tsx`**
- Adicionar campo de texto "Observacao padrao para faturamento" na secao de configuracao fiscal
- Salvar/carregar do novo campo `observacao_faturamento`

## Fase 3: Hook centralizado — Carregar observacao

**Arquivo: `src/hooks/useDadosFaturamento.ts`**
- Incluir `observacao_faturamento` no select de `configuracoes_pagamento_cliente`

**Arquivo: `src/components/faturamento/FaturamentoModal.tsx`**
- Adicionar `observacao_faturamento: string | null` dentro de `configPagamento` na interface `DadosFaturamento`

## Fase 4: EtapaRelatorio — Auto-preencher observacao

**Arquivo: `src/components/faturamento/EtapaRelatorio.tsx`**
- Inicializar `observacaoFatura` com `dados.configPagamento?.observacao_faturamento` se existir, em vez de vazio
- Manter editavel para ajustes manuais

## Fase 5: EtapaNF — Auto-selecionar natureza da operacao

**Arquivo: `src/components/faturamento/EtapaNF.tsx`**
- Mapear `dados.clienteRegimeTributario` para `naturezaOperacao` automaticamente:
  - `simples_nacional` → `tributacao_municipio` (padrao — ME/EPP no Simples)
  - `lucro_presumido` / `lucro_real` → `tributacao_municipio`
  - Se o emitente e o tomador estao em municipios diferentes (comparar `enderecoConfig.cidade` vs `clienteEndereco.cidade`) → `tributacao_fora`
- Manter seletor visivel para override manual, mas ja vem pre-selecionado
- Tipo de descricao NF ja vem pre-selecionado (codigo existente funciona) — apenas garantir que a inicializacao respeita a ordem correta dos useEffects

## Fase 6: Previa Visual — Replica identica da NFS-e real

**Arquivo: `src/components/faturamento/NFSePreviewOficial.tsx`**

Corrigir layout para ser identico a nota real fornecida (NF-07528955000165_28.pdf). Diferencas identificadas:

| Elemento | Estado Atual | Nota Real | Correcao |
|---|---|---|---|
| Cabecalho emitente | Sem E-mail, sem SALA | Mostra email, telefone, endereco completo com SALA | Incluir todos os dados |
| Inscricao Estadual/CNPJ | Inline "CNPJ / IE / IM" | Separado em campos rotulados "CNPJ / CPF", "Inscricao Estadual", "Inscricao Municipal" | Separar em grid |
| Numero NFS-e | "Numero NFS-e:" label + numero | "Numero da NFS-e" + numero grande | Ajustar label |
| Serie | "NACIONAL" | "Série da NFS-e: NACIONAL" | Ajustar label |
| Data/Codigo | "Data Servico" + "Codigo Verif." | "Data do Servico" + "Codigo Verificador" | Nomes completos |
| Prefeitura faixa | Background #4a4a4a | Background cinza claro com borda | Ajustar cores para combinar |
| URL prefeitura | www.saoroque.sp.gov.br | saoroque.govbr.cloud/nfse.portal | Atualizar URL |
| Fone prefeitura | 4784-8282 | 4784-8514 | Corrigir |
| Tomador layout | 2 colunas genericas | Grid com campos rotulados: Nome, Endereco, Cidade/UF/Bairro/CEP, CNPJ, IM, IE, Email, Fone | Replicar grid exato |
| Descricao servicos | Coluna unica com sub-colunas CBS/IBS | Tabela com VALOR TOTAL, ALIQ. ISSQN, VALOR ISSQN, RETIDO + segunda linha CBS | Ajustar para colunas certas |
| Info Fiscais | Layout simplificado | Campos em grid: Cod Servico, Cod NBS, Cod Trib Nacional, Indicador Op, Cod Trib Municipal, Classificacao | Replicar grid exato |
| Impostos | 8 colunas | 8 colunas (CIDE, COFINS, COFINS Imp, ICMS, IOF, IPI, PIS/PASEP, PIS/PASEP Imp) | Ja esta correto |
| Valores ISSQN | 4 colunas | 4 colunas (Base Calc Proprio, Valor Proprio, Base Retido, Valor Retido) + Valor Total ISSQN + Valor Deducao | Adicionar Total ISSQN e Deducao |
| CBS/IBS valores | Inline em uma linha | Grid: Valor CBS, Valor IBS Estadual, Valor total IBS CBS | Adicionar grid CBS/IBS |
| Valor Total/Liquido | 2 colunas fundo verde | 2 colunas como na real | Ja esta similar |
| Info Adicionais | Texto + QR | Texto + QR lateral | Ja esta similar |
| Recibo | 2 colunas | 3 colunas: Recebemos + Numero/Competencia + "Numero de Controle do Municipio" | Adicionar 3a coluna |
| Rodape | URL generica | URL + "Para consultar a autenticidade..." + "Pagina 1 de 1" | Ajustar texto |

## Fase 7: Popular dados nos tabs de lancamento

**Arquivo: `src/components/lancamentos/PendentesTab.tsx`**
- Popular `observacao_faturamento` no `configPagamento` ao montar `dadosFaturamento`

**Arquivo: `src/components/lancamentos/FaturasTab.tsx`**
- Popular `observacao_faturamento` ao reconstruir dados de fatura existente

## Arquivos Afetados (7 + 1 migracao)

| Arquivo | Acao |
|---|---|
| Migracao SQL | Novo campo `observacao_faturamento` |
| `src/hooks/useDadosFaturamento.ts` | Incluir novo campo no select |
| `src/components/faturamento/FaturamentoModal.tsx` | Adicionar campo na interface |
| `src/components/clientes/ClientePagamento.tsx` | Campo para editar observacao padrao |
| `src/components/faturamento/EtapaRelatorio.tsx` | Auto-preencher observacao do cliente |
| `src/components/faturamento/EtapaNF.tsx` | Auto-selecionar natureza por regime/municipio |
| `src/components/faturamento/NFSePreviewOficial.tsx` | Replica identica da nota real |
| `src/components/lancamentos/PendentesTab.tsx` + `FaturasTab.tsx` | Popular novo campo |

