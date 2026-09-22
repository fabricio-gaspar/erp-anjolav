# Segurança

## Princípios aplicados

- Autorização em camadas: rota, módulo, Edge Function e, obrigatoriamente, RLS.
- Comportamento fail-closed: erro ou ausência de permissão nega o acesso.
- Secrets somente no backend; variáveis `VITE_*` são públicas por definição.
- CORS com allowlist de origens e integrações externas apenas por HTTPS/allowlist de host.
- Respostas públicas sem dados internos, cache desativado e logs sem payloads completos de clientes.
- Tokens públicos do portal com 160 bits de entropia e lookup server-side.
- Operações administrativas e integrações privilegiadas executadas em Edge Functions autenticadas.

## Limite importante

Os filtros do frontend não são uma fronteira de segurança. O banco atual contém policies históricas amplas, incluindo `USING (true)`. Até que uma migration nova feche essas policies e testes RLS comprovem o isolamento, qualquer usuário autenticado pode potencialmente acessar dados além do que a interface exibe.

## Secrets

- Não commitar `.env`, certificados, tokens, senhas ou dumps.
- Frontend: apenas URL, project ref e chave publicável do Supabase.
- Edge Functions: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `EVOLUTION_API_KEY`, `N8N_WEBHOOK_TOKEN`, allowlists e flags no cofre de secrets.
- Certificado A1 e senha: usar cofre/KMS no backend, criptografia em repouso, acesso mínimo, rotação e auditoria. O upload direto pelo navegador está desativado.
- Tokens antigos que possam ter sido armazenados no banco devem ser revogados e rotacionados.

## Dados pessoais no histórico

A migration histórica `supabase/migrations/20260511151748_5134974c-2254-4cc9-bbcf-829c541bf05f.sql` contém seeds identificáveis de funcionários e folha. Isso precisa de avaliação imediata de LGPD antes de qualquer comercialização ou ampliação de acesso ao repositório.

- Não edite a migration se ela já foi aplicada.
- Verifique em staging e produção quais registros vieram desse seed e faça correção/anonimização por migration nova, após aprovação dos responsáveis pelos dados.
- Decida com o proprietário do repositório se o histórico Git público precisa ser saneado; reescrita de histórico é operação coordenada e não foi executada nesta auditoria.
- Revise clones, artefatos, logs, backups e forks, pois remover o arquivo da branch atual não apaga cópias existentes.
- O diretório legado `backup/` também permanece versionado; ele é ignorado para novas inclusões, mas deve ser arquivado ou removido do release após revisão do proprietário.

## Revisão obrigatória do Supabase

1. Inventariar tabelas, views, funções, buckets, grants e policies no projeto vinculado.
2. Definir tenant/unidade e propagar o identificador em todas as relações transacionais.
3. Criar helpers RLS `SECURITY DEFINER` com `search_path` fixo e privilégios mínimos.
4. Aplicar policies separadas para `SELECT`, `INSERT`, `UPDATE` e `DELETE`.
5. Restringir tabelas administrativas e de integração a admin/service role.
6. Revogar o RPC legado `get_employee_email_by_login` de `anon` e `public`.
7. Tornar códigos de portal únicos e armazenar somente hash quando o modelo de dados for atualizado.
8. Adicionar constraints únicas para idempotência de cobranças e webhooks.
9. Testar cada policy com JWTs de admin, industrial, residencial, usuário sem permissão, portal e anon.

O receptor Asaas valida o token, grava o evento com ID determinístico antes da conciliação, reconcilia o estado no provedor e registra falhas/tentativas. O ledger do PDV é inacessível a `anon` e `authenticated`; apenas a Edge Function autorizada no módulo `caixa` chama as rotinas transacionais com `service_role`. A implantação comercial ainda exige um worker assíncrono monitorado para reprocessar eventos `failed` sem depender apenas do retry do provedor.

## Controles de produção ainda necessários

- Rate limiting/WAF para login, portal e webhooks públicos.
- MFA para administradores e política de sessão.
- SMTP transacional e proteção contra enumeração/abuso.
- Envio de faturamento por provedor transacional no backend; `mailto:` manual não oferece confirmação, anexos confiáveis, retry ou auditoria de entrega.
- CSP e demais headers no host do frontend.
- SAST, dependency scanning, secret scanning e atualização controlada de dependências.
- Trilha de auditoria imutável para ações administrativas e financeiras.
- Monitoramento, alertas e procedimento de resposta a incidentes.
- Backups/PITR e teste periódico de restauração.

Não publique uma vulnerabilidade com secrets ou dados pessoais em issue aberta. Registre o incidente em canal privado e rotacione qualquer credencial possivelmente exposta.
