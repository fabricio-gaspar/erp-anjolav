

# Pré-visualização e Recriação dos 3 Tipos de Relatório

## Diagnóstico

Analisando as imagens enviadas e o código atual:

1. **`RelatoriosCliente.tsx` linha 322**: usa `MapaMensalPecas` para AMBOS `mapa_pecas` e `mapa_mensal` — o Mapa de Peças (ROL-by-ROL) nunca é renderizado
2. **`RelatorioDetalhadoCliente.tsx`**: é uma cópia do `MapaPecasCliente.tsx` — não corresponde à imagem 86 (RELATÓRIO DE HIGIENIZAÇÃO com colunas data+ROL, cabeçalho azul, linha CONTRATO)
3. **`ClienteConfiguracao.tsx`**: seletor de tipo sem preview visual — usuário não sabe como cada relatório será impresso

## Correspondência Imagem → Tipo

| Tipo | Imagem | Formato |
|---|---|---|
| **Mapa de Peças** | Imagem 85 | ROL-por-ROL com itens, COMPLEMENTO, PESO, Q.CLI, QUANT, UNIT, TOTAL, OBS. Subtotal por ROL, TOTAL GERAL |
| **Mapa Mensal** | Imagem 84 | Matriz: linhas=peças, colunas=DIA/MÊS, Quant/Vlr.Unit/Vlr.Total no final |
| **Relatório Detalhado** | Imagem 86 | "RELATÓRIO DE HIGIENIZAÇÃO" com cabeçalho azul, colunas=data+nºROL, ITEM numerado, linha CONTRATO, TOTAL destacado |

## Alterações

### 1. ClienteConfiguracao.tsx — Adicionar mini-previews
Abaixo de cada botão de tipo de relatório, inserir um mini thumbnail SVG/HTML estilizado mostrando o layout do relatório correspondente (tabela miniaturizada com dados fictícios). Quando selecionado, o preview fica destacado.

### 2. RelatorioDetalhadoCliente.tsx — Recriar completo (imagem 86)
Recriar para corresponder exatamente à imagem 86:
- Cabeçalho: logo à esquerda, "RELATÓRIO DE HIGIENIZAÇÃO [CLIENTE]" no centro, "MÊS [NOME DO MÊS] DE [ANO]" à direita
- Colunas: DATA (dd/mmm) com nº ROL abaixo de cada data
- Linhas: ITEM (numerado), DESCRIÇÃO, quantidades por data, QTDE TOTAL, VALOR UNIT R$, VALOR TOTAL R$
- Linha especial "CONTRATO" com valor fixo do contrato de aluguel
- Rodapé: TOTAL com destaque azul/amarelo
- Estilo com cabeçalho azul (#4472C4) e texto branco

### 3. MapaPecasCliente.tsx — Ajustar para imagem 85
Ajustar o cabeçalho do ROL para incluir "PREV.ENTR.:" e adicionar coluna "Q.CLI." Garantir que o formato R$ aparece com "R$" separado do valor (como na imagem). Garantir "TOTAIS DO ROL:" e "TOTAL GERAL R$ X.XXX,XX".

### 4. MapaMensalPecas.tsx — Ajustar para imagem 84
Confirmar que corresponde à imagem. Ajustar colunas DIA/MES para mostrar corretamente. Garantir "Vlr.Unit" e "Vlr.Total" como cabeçalhos. Total do Departamento e Total Geral no rodapé.

### 5. RelatoriosCliente.tsx — Corrigir renderização
Linha 322: separar `mapa_pecas` (usar `MapaPecasCliente`) de `mapa_mensal` (usar `MapaMensalPecas`). Atualmente ambos usam o mesmo componente.

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/clientes/ClienteConfiguracao.tsx` | Adicionar mini-previews visuais |
| `src/components/relatorios/RelatorioDetalhadoCliente.tsx` | Recriar completo (imagem 86) |
| `src/components/relatorios/MapaPecasCliente.tsx` | Ajustar detalhes (imagem 85) |
| `src/components/relatorios/MapaMensalPecas.tsx` | Ajustar detalhes (imagem 84) |
| `src/pages/RelatoriosCliente.tsx` | Corrigir mapeamento tipo→componente |

Nenhuma alteração no banco de dados.

