

# Preenchimento automático do código IBGE ao digitar cidade

## Solução

Adicionar lógica no `handleInputChange` para que, quando o campo `cidade` for alterado e o valor corresponder a um município conhecido, o código IBGE e a URL da API sejam preenchidos automaticamente.

## Alterações

**Arquivo: `src/components/configuracoes/ConfiguracoesFiscal.tsx`**

1. Importar `MUNICIPIOS_SP` e `TEMPLATES_API_NFSE` de `@/lib/validacoesFiscais`

2. Modificar `handleInputChange` (linha 249-251) para incluir lógica de auto-preenchimento:
   - Quando `field === "cidade"`, normalizar o valor e comparar com `MUNICIPIOS_SP`
   - Se encontrar match (ex: "são roque" → código `3554003`), preencher `codigoMunicipioIbge` automaticamente
   - Se a cidade for "São Roque", preencher também `urlApiNfse` com a URL do template correspondente

3. Corrigir o código IBGE de São Roque na lista `MUNICIPIOS_SP` em `src/lib/validacoesFiscais.ts`:
   - Atualmente está `3550605` — o correto é `3554003`
   - Atualizar também o placeholder do campo no formulário

**Arquivo: `src/lib/validacoesFiscais.ts`**
- Corrigir `{ codigo: '3550605', nome: 'São Roque' }` para `{ codigo: '3554003', nome: 'São Roque' }`

