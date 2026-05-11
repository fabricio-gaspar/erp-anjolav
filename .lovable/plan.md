## Objetivo

Reescrever o componente de prévia da NFS-e (`src/components/faturamento/NFSePreviewOficial.tsx`) para reproduzir, posição por posição e estilo por estilo, o modelo oficial enviado (NFS-e Nacional padrão São Roque/Cidade360). Hoje a prévia tem cabeçalho azul e blocos coloridos que não existem no modelo real, então quando o usuário clica em "Visualizar prévia" antes de gerar a nota, o que ele vê não é o que será emitido.

## O que muda

### Componente único modularizado
Reorganizar o `NFSePreviewOficial.tsx` em sub-componentes internos para ficar legível e fiel:

```
NFSePreviewOficial
├── HeaderTitulo            "NFS-e  Nota Fiscal de Serviço Eletrônica" (preto, fundo branco, bold)
├── BlocoEmitente           Emitente (esq) + QR code (centro) + Número/Série/Data (dir)
├── BlocoPrefeitura         Brasão + Prefeitura (esq) + Dt.Emissão | Exigib. ISS | Município | Tributado (4 colunas)
├── BlocoChaveAcesso        Chave de Acesso (esq) + Nº DPS / Série DPS / Data DPS (dir)
├── BlocoTomador            Header cinza "TOMADOR DO SERVIÇO" + 2 linhas de campos (Nome,CNPJ / End,IM,IE / Cidade,UF,Bairro,CEP,E-mail,Fone)
├── BlocoIntermediario      Header cinza + 5 campos com "*****"
├── BlocoDescricaoServicos  Header cinza + tabela com ALIQ ISSQN/CBS/IBS EST + área grande de descrição
├── BlocoCodigosServico     Código Serviço, Código NBS, Indicador Operações, Classificação Tributária
├── BlocoTributacao         Cód.Trib.Nacional / Municipal + linha CIDE/COFINS Imp/ICMS/IOF/IPI/PIS/CST + linha PIS/COFINS apuração
├── BlocoBaseCalculoISSQN   Base ISSQN Próprio | Valor ISSQN Próprio | Base Retido | Valor Retido | Valor Total ISSQN | Dedução
├── BlocoCBS_IBS            Valor CBS | Valor IBS Estadual | "Valor total IBS CBS" (cinza) | *****
├── BlocoTotaisNFSe         Valor Total da NFS-e | Valor Líquido da NFS-e
├── BlocoInformacoesAdic    Caixa de informações adicionais + 2º QR code à direita
├── BlocoBarcode            Code128 com "{numero}{codVerif}{cnpjEmitente}"
└── BlocoRecibo             Recebi(emos) ... + Nº NFS-e + Competência + Nº Controle Município + linha de consulta
```

### Estilos fiéis ao modelo

- Fonte Arial 9px base, títulos em preto (sem azul de fundo)
- Bordas finas pretas (`1px solid #000`) em todas as células
- Headers de seção (`TOMADOR`, `INTERMEDIÁRIO`, `DESCRIÇÃO`): fundo `#cfcfcf`, texto preto, centralizado, 10px bold
- Mini-labels acima dos valores em fonte 7-8px cinza (`#444`), valor em 9-10px preto
- Faixa "Valor total IBS CBS" com fundo cinza médio
- Páginas com largura máxima A4 (`210mm`), margens internas de 6mm
- Marca d'água "PRÉVIA - SEM VALOR FISCAL" mantida quando `isPrevia=true`
- Texto do rodapé "Página 1 de 1" alinhado à direita

### Código de barras real

Trocar a placeholder por code128 usando `jsbarcode` (ou implementação SVG inline simples). Valor: `{numero_nf}{codigo_verificacao}{cnpj_emitente_sem_mascara}`.

### Dados dinâmicos vs estáticos

Tudo que vem do `NFSeOficialData` (emitente, tomador, valor, descrição, número, chave) continua dinâmico. Campos fiscais não preenchidos pelo prestador (CBS, IBS, NBS, etc.) ficam como `*****` exatamente como no modelo. Lei 12741/2012 calculada como hoje. Texto "NOTA EMITIDA POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL" só aparece quando `regime_tributario` for Simples/MEI.

### Ações (manter)

Botões "Imprimir", "Baixar PDF" e "Expandir" permanecem no topo, fora da área da nota. A área `#nfse-preview-oficial` continua sendo o alvo da impressão e do `nfPreviewPdf.ts`.

## Detalhes técnicos

- **Arquivo único alterado:** `src/components/faturamento/NFSePreviewOficial.tsx` (reescrita completa, ~600 linhas)
- **Dependência nova:** `jsbarcode` (~20kb) para gerar Code128 SVG. Alternativa: gerar manualmente um SVG estilizado se preferir não adicionar dependência.
- **Sem mudanças** em `EtapaNF.tsx`, `nfPreviewPdf.ts`, hooks ou banco de dados.
- **Sem mudanças** em `NFSePreviewNacional.tsx` (não está em uso pelo fluxo atual; pode ser removido em outro momento).
- A interface `NFSeOficialData` ganha 2 campos opcionais: `regime_tributario?: string` e `informacoes_adicionais?: string` para compor o rodapé sem hard-code.

## Fora de escopo

- Alterações no PDF gerado pelo `nfPreviewPdf.ts` (ele captura o DOM via html2canvas, então herda automaticamente o novo visual).
- Integração real com webservice de prefeitura.
- Geração da chave de acesso/código verificador definitivos (continua simulado na prévia).
- Mudanças no `FaturamentoModal` ou nas demais etapas.

Posso seguir e implementar?