

## Plano: Incluir prateleira e posição no ROL

### Problema
A interface `PrintOSData` já possui campos `bloco` e `posicao`, e o template HTML do ROL já renderiza esses dados — mas a função `fetchOSPrintData()` nunca os preenche. Os itens da OS têm `posicao_prateleira` (formato "corredor-seção-prateleira"), porém esse valor não é extraído.

### Alteração

#### Arquivo: `src/services/printService.ts` — função `fetchOSPrintData()`
- Após buscar os itens, extrair o primeiro `posicao_prateleira` preenchido
- Mapear para os campos `bloco` e `posicao` do `PrintOSData`:
  - Se formato "X-Y-Z": `bloco = X`, `posicao = Y-Z`
  - Se outro formato: `posicao = valor completo`
- Adicionar esses campos no objeto retornado (linhas 135-145)

### Resultado
O ROL passará a exibir o número da prateleira e posição quando o toggle "Bloco" estiver ativado nas configurações e os itens tiverem `posicao_prateleira` preenchido.

