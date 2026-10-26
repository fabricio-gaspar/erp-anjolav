# Clientes, produtos e preços por cliente — Especificação

## Objetivo

Corrigir a persistência/visualização de preços por cliente, permitir tabela padrão ou personalizada, abrir clientes pelo nome na lista e classificar produtos/serviços por porte.

## Regras funcionais

- `produtos.preco` continua sendo o preço padrão.
- `precos_especiais` continua sendo o override por cliente e produto.
- Cada cliente terá `tabela_preco_tipo`: `padrao` ou `personalizada`.
- O modo padrão lista produtos ativos compatíveis com a área/classificação do cliente usando `produtos.preco`.
- O modo personalizado lista e edita `precos_especiais`, preservando importar, adicionar e remover.
- Clientes que já possuem preços especiais serão tratados como personalizados no backfill; nenhum preço será apagado.
- Produtos terão `porte` opcional com os valores `pequeno`, `medio` e `grande`. Dados antigos ficam sem classificação até edição.
- O nome/razão social do cliente será um controle acessível que abre a aba Dados existente.

## Segurança e compatibilidade

- Manter `tenant_id`, RLS, RBAC e filtros de área existentes.
- Não criar política permissiva nova nem desabilitar RLS.
- Explicitar as relações Supabase quando houver FKs simples e compostas concorrentes.
- Mostrar erros de consulta/gravação em estado recuperável; não converter erro em lista vazia.

## Validação

- Contrato da migração e tipos.
- Hook de preços: relação explícita, upsert atômico e propagação de erro.
- Fluxos UI de tabela padrão/personalizada, clique no cliente e porte do produto.
- Typecheck, testes Node, lint, build e E2E focalizado.
