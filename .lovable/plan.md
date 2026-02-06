

# Analise: Sistema NFS-e e Desabilitacao do Boleto

## 1. Analise do Sistema de Nota Fiscal (NFS-e)

Apos analisar todo o codigo do sistema de emissao de NFS-e, identifiquei que **o sistema atual NAO esta pronto para emissao real**. Ele funciona apenas em modo simulacao. Segue o detalhamento:

### O que funciona hoje (modo simulacao/demo):
- Preview visual da NFS-e no padrao de Sao Roque (fiel ao portal)
- Validacao de CPF/CNPJ com digito verificador
- Validacao de dados fiscais do cliente (endereco, documento)
- Snapshots de emitente e tomador para historico
- Selecao de natureza de operacao
- Selecao de CNPJ emissor e descricao do servico
- Geracao de chave de acesso simulada (44 digitos)
- Download/impressao de previa em PDF

### O que FALTA para emissao real:
1. **Nao existe integracao com API da prefeitura** - A funcao `handleEmitirNF` (linha 146-208 do EtapaNF.tsx) apenas gera dados simulados e salva no banco. Nao faz nenhuma chamada HTTP para nenhum webservice de NFS-e.
2. **Numero da NF e aleatorio** - O numero da nota e gerado como `Math.random()` (linha 153), nao vem de um sistema de numeracao sequencial da prefeitura.
3. **Chave de acesso simulada** - A funcao `gerarChaveAcesso()` usa CNPJ "00000000000000" e DV fixo "0" (faturamentoUtils.ts, linhas 165-181).
4. **Sem certificado digital na emissao** - Embora o sistema permita upload de certificado A1 (.pfx), ele nunca e usado na emissao.
5. **Status e sempre "nao_enviada"** - O campo `status_sefaz` fica como "nao_enviada" em simulacao (linha 197).
6. **Sem edge function de emissao** - Nao existe uma edge function que se comunique com o webservice da prefeitura (ex: ISS Digital de Sao Roque).

### Conclusao sobre NFS-e:
Tirar do modo demo **NAO** fara o sistema funcionar para emissao real. Seria necessario criar uma edge function completa que:
- Assine digitalmente o XML com o certificado A1
- Envie para a API da prefeitura de Sao Roque
- Processe a resposta (numero real, protocolo, PDF)
- Controle numeracao sequencial

Isso e um desenvolvimento significativo que envolve integracao com webservice SOAP/REST da prefeitura. **Recomendo manter em modo simulacao por enquanto** e focar nisso como um projeto futuro separado.

---

## 2. Plano: Desabilitar Sistema de Boleto

A estrategia sera criar uma **constante de feature flag** simples que pode ser ligada/desligada em um unico arquivo. Isso afeta os seguintes pontos:

### Arquivos que serao modificados:

**Novo arquivo:**
- `src/lib/featureFlags.ts` - Arquivo central com as flags de funcionalidades

**Arquivos modificados:**
- `src/components/clientes/ClientePagamento.tsx` - Esconder opcao "Boleto" no cadastro do cliente
- `src/components/faturamento/EtapaPagamento.tsx` - Esconder geracao de boleto no wizard de faturamento
- `src/components/cobrancas/NovaCobrancaModal.tsx` - Esconder opcao "Apenas Boleto" na criacao de cobranca

### Como vai funcionar:

Sera criado um arquivo `src/lib/featureFlags.ts` com:

```text
BOLETO_ENABLED = false   // Muda para true quando quiser habilitar
```

Nos componentes, o sistema vai:
- No cadastro do cliente: esconder o botao "Boleto" das formas de pagamento
- No wizard de faturamento (Etapa 3): se a forma de pagamento for "boleto", redirecionar para PIX ou transferencia
- No modal de nova cobranca: esconder "Apenas Boleto" e "Boleto + PIX", deixando apenas "PIX"

### Para reabilitar depois:
Basta alterar `BOLETO_ENABLED` para `true` no arquivo de feature flags. Nenhum codigo sera removido, apenas escondido condicionalmente.

### Detalhes tecnicos:

1. Criar `src/lib/featureFlags.ts`:
   - Exportar constante `BOLETO_ENABLED = false`

2. `ClientePagamento.tsx`:
   - Importar flag e esconder botao "Boleto" quando desabilitado
   - Se cliente ja tinha boleto configurado, manter funcional mas nao permitir nova selecao

3. `EtapaPagamento.tsx`:
   - Importar flag e esconder secao de boleto quando desabilitado
   - Se forma_pagamento do cliente for "boleto" e flag estiver desabilitada, mostrar aviso e oferecer PIX/transferencia

4. `NovaCobrancaModal.tsx`:
   - Filtrar opcoes "BOLETO" e "BOLETO_PIX" do dropdown quando flag estiver desabilitada
   - Default passa a ser "PIX" quando boleto desabilitado

