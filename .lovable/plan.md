

# Atualização dos Endereços de Webservice/API NFS-e - São Roque

## Contexto

A Prefeitura de São Roque (via Cidade360/ISS Digital) comunicou a migração dos endereços de integração NFS-e. O domínio antigo `saoroque.govbr.cloud` sera substituido por `webapp1-saoroque.cidade360.cloud` a partir de 13 de março.

## O que precisa ser atualizado

### 1. Dados no banco de dados (configuracoes_fiscais)

A LAVANDERIA SAO ROQUE tem URLs antigas armazenadas no campo `urls_webservice`:
- **producao**: `HTTPS://SAOROQUE.GOVBR.CLOUD/NFSE.PORTAL.INTEGRACAO/SERVICES.SVC`
- **webservice_im**: `HTTPS://SAOROQUE.GOVBR.CLOUD/NFSE.PORTAL.INTEGRACAO/SERVICES.SVC?WSDL`

Atualizar para:
- **producao**: `https://webapp1-saoroque.cidade360.cloud/Nfse.Portal.Integracao/services.svc`
- **webservice_im**: `https://webapp1-saoroque.cidade360.cloud/Nfse.Portal.Integracao/services.svc?wsdl`

### 2. Codigo fonte - Templates de URL (validacoesFiscais.ts)

Atualizar o template `TEMPLATES_API_NFSE` de:
- `https://saoroque.govbr.cloud/NFSe.Api/NotaNacional`
- `https://saoroque.govbr.cloud/NFSe.Api/swagger`

Para:
- `https://webapp1-saoroque.cidade360.cloud/Nfse.Api/NotaNacional`
- `https://webapp1-saoroque.cidade360.cloud/Nfse.Api/swagger`

### 3. Codigo fonte - Placeholder no formulario (ConfiguracoesFiscal.tsx)

Atualizar placeholder do campo URL API NFS-e.

### 4. Codigo fonte - Preview da NFS-e (NFSePreviewNacional.tsx + NFSePreviewOficial.tsx)

Atualizar URLs de consulta/verificação da nota:
- QR Code URL
- Texto de consulta no rodape

Trocar todas as ocorrencias de `saoroque.govbr.cloud` por `webapp1-saoroque.cidade360.cloud`.

## Resumo das alterações

| Local | Tipo |
|---|---|
| Banco de dados (urls_webservice da SAO ROQUE) | SQL UPDATE |
| `src/lib/validacoesFiscais.ts` | Código |
| `src/components/configuracoes/ConfiguracoesFiscal.tsx` | Código |
| `src/components/faturamento/NFSePreviewNacional.tsx` | Código |
| `src/components/faturamento/NFSePreviewOficial.tsx` | Código |

Total: 1 migração de dados + 4 arquivos de código.

