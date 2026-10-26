# Redesign visual — cobertura

## Direção aplicada

- Fundo quente `#FDFCFA`, superfícies brancas e neutras lilás/azuladas.
- Inter como fonte principal, contraste reforçado e foco visível por teclado.
- Violeta `#6D5EF5` como ação primária; estados de sucesso, aviso, informação e erro mantêm cores semânticas.
- Cards compactos com raio de 12px, sombra curta e padding responsivo de 12–20px.
- Header único, sidebar clara com grupos semânticos, navegação por área e menu mobile de 280px.
- Títulos de página reduzidos para 28–36px; tabelas com linhas de 40–44px e células compactas.

## Matriz de cobertura

| Escopo | Rotas/componentes | Cobertura |
| --- | --- | --- |
| Shell compartilhado | `AppLayout`, `AppHeader`, `AppSidebar`, `GlobalSearch` | Tokens, header, painel único, grupos, sidebar clara, mobile e estados de foco |
| Primitives | `Card`, `Button`, `Input`, `Table`, `Tabs`, `Sheet` e derivados Radix | Contraste, raio, alturas, bordas, estados hover/focus/disabled e densidade |
| Painel Central | `/central`, financeiro, contas, agenda, relatórios, configurações, auditoria e SaaS | Herdam o shell e os primitives; títulos e cards alinhados ao sistema |
| Painel Industrial | dashboard, clientes, produtos, fornecedores, agenda, ordens, produção, faturamento, financeiro, estoque e relatórios | Herdam o shell e os primitives; área continua isolada pelo roteamento/RBAC existente |
| Painel Residencial | dashboard, PDV, clientes, agenda, ordens, produção, financeiro, produtos e relatório de caixa | Herdam o shell e os primitives; área continua isolada pelo roteamento/RBAC existente |
| Autenticação | `AuthShell`, login, recuperação e redefinição de senha | Superfícies, logo, tipografia, estados e cartão alinhados ao tema |
| Estados transversais | loading, vazio, erro, permissão, modal, menu, tooltip, tabela responsiva | Mantidos pelas implementações existentes; estilos passam pelos tokens compartilhados |

## Rotas inventariadas

O inventário é derivado de `src/lib/appRoutes.ts` e cobre as 28 rotas autenticadas declaradas no sistema. Não foram alteradas rotas, componentes de negócio, consultas, autenticação, RLS ou permissões.

## Verificação

- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run build`
- E2E de navegação/permissões já existente no projeto, preservado para a publicação.

As validações devem ser executadas novamente após qualquer alteração adicional de conteúdo ou regra de negócio.
