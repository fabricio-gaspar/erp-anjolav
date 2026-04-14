

## Plano: Relatório de Quilometragem por Motorista

### Objetivo
Criar um novo relatório que mostra quantos quilometros cada motorista rodou, com filtro por período (dia, semana ou mes).

### Fonte dos Dados
A tabela `rotas_entrega` ja possui os campos `km_inicial`, `km_final`, `motorista_id` e `data`. O calculo e simples: `km_final - km_inicial = km_rodado` por rota. Agrupando por motorista e somando, temos o total.

### Alteracoes

#### 1. Nova pagina `src/pages/RelatorioKilometragem.tsx`
- Filtro de periodo: Hoje, Esta Semana, Este Mes, Personalizado (date pickers)
- Tabela com colunas: Motorista, Total Rotas, KM Total, KM Media/Rota
- Card de resumo no topo: Total KM rodados, Total rotas concluidas, Media KM/dia
- Busca rotas com status `concluida` no periodo selecionado, agrupando por `motorista_id`
- Join com `motoristas` para nome e com `veiculos` para placa
- Botao de exportar CSV
- Detalhamento: ao clicar no motorista, expande mostrando cada rota (data, veiculo, km_inicial, km_final, km_rodado)

#### 2. Rota em `src/App.tsx`
- Adicionar rota `/relatorios/quilometragem` apontando para o novo componente

#### 3. Menu lateral em `src/components/layout/AppSidebar.tsx`
- Adicionar item "Quilometragem" no grupo Relatorios, com icone `Gauge` ou `Route`

#### 4. Header em `src/components/layout/AppHeader.tsx`
- Adicionar titulo da rota no mapa de titulos

### Resultado
Novo relatorio acessivel pelo menu Relatorios > Quilometragem, mostrando KM rodados por motorista com filtro de periodo e exportacao CSV.

