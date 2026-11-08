# Biblioteca visual ANJOLAV — tela-padrão v1

Base: branch `main` no commit `6ecb8e813e2c094e7c15d40a0f118d83c3951694` (07/11/2026, 16h17 BRT). As mudanças posteriores do trabalho de referência estão isoladas em branch própria. **Não substituir nem limpar o working tree local do Mac**, que contém alterações sem commit.

## Objetivo

Criar uma tela de referência real em React/TypeScript, integrada aos componentes que o ERP já utiliza, para padronizar novas telas administrativas sem redesenhar ou alterar a lógica operacional.

Acesse, após integrar a branch, `/admin/biblioteca-visual` com um usuário administrador autorizado a Configurações. A biblioteca não aparece no PDV e não consulta, grava ou altera pedidos, clientes, valores ou produção. Os dados são fictícios.

## Componentes reutilizáveis

`src/components/design-system/StandardScreen.tsx` exporta:

- `StandardScreen`: estrutura principal, PageHeader e AppLayout existentes;
- `StandardPanel`: cabeçalho de seção, descrição, ações e card semântico;
- `StandardMetric`: KPI de título, valor e indicador de estado;
- `StandardField`: rótulo acessível, campo, obrigatoriedade e texto auxiliar.

A tela `src/pages/BibliotecaVisual.tsx` demonstra o uso dos componentes, filtros, tabela responsiva, formulário, badges e modal.

### Princípios

1. **Reutilização acima de duplicação.** Não criar novos botões, cards ou tabelas quando já existe componente em `src/components/ui`.
2. **Tokens acima de cores fixas.** Preferir `bg-card`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`, estados `success`, `warning`, `destructive`. Respeitar `src/index.css` e os espaços de trabalho.
3. **Tipografia.** Inter, h1 ~28 px, títulos de card 16 px, corpo 14–15 px, legendas 11–12 px. Evitar texto minúsculo em ações frequentes.
4. **Espaçamento.** Escala principal 4/8/12/16/24/32 px. Componentes de entrada ~40 px de altura; alvos de interação com tamanho adequado para toque.
5. **Hierarquia.** Cabeçalho com título/explicação/ação primária, KPIs quando úteis, filtros junto dos resultados, tabela responsiva, modal para detalhes curtos e formulário agrupado logicamente.
6. **Operação não é administração.** A biblioteca serve ao Administrativo; o PDV compartilha tokens/componentes, mas mantém sua tela operacional rápida e sem menu administrativo.
7. **Sem regressão.** Nunca excluir campos/ações/regras por não aparecerem no protótipo. A capacidade de entrega diária, tabelas de preço, ROL, etiquetas, pagamento, sangria e estoque continuam sob suas implementações reais.
8. **Acessibilidade e responsividade.** Rótulos associados a campos, foco visível, estados claros, conteúdo adaptável, tabela com rolagem quando necessário, sem dependência de hover.
9. **Dados de demonstração são fictícios.** Nunca usar dados reais nessa biblioteca, nem simular que uma gravação local foi persistida.
10. **Validação.** Conferir lint, TypeScript, testes, build e screenshots em desktop/tablet/mobile antes de considerar uma tela adaptada concluída.

## Como adotar

- Use `StandardScreen` no início de cada nova tela administrativa.
- Componha seções com `StandardPanel`, métricas com `StandardMetric` e campos com `StandardField`.
- Reutilize Table, Input, Tabs, Dialog, Badge e Button da biblioteca shadcn/ui existente.
- Aplique aos módulos reais em PRs pequenos, módulo por módulo, protegendo suas regras de negócio.
- Para novas telas do PDV, mantenha `PdvLayout` e adapte apenas os padrões compartilháveis; não inclua navegação administrativa.

## Limites desta entrega

Esta entrega contém **um padrão implementável e uma página de referência demonstrativa**. Não moderniza automaticamente todas as telas do ERP nem substitui a homologação funcional. Não implica publicação na produção.

## Verificação recomendada

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
