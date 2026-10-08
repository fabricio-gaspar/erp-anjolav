# Segurança

## Princípios aplicados

- Autorização em camadas: rota, módulo, Edge Function e, obrigatoriamente, RLS.
- Comportamento fail-closed: erro ou ausência de permissão nega o acesso.
- Secrets somente no backend; variáveis `VITE_*` são públicas por definição.
- CORS com allowlist de origens e integrações externas apenas por HTTPS/allowlist de host.
- Respostas públicas sem dados internos, cache desativado e logs sem payloads completos de clientes.
- Tokens públicos do portal com 160 bits de entropia e lookup server-side.
- Operações administrativas e integrações privilegiadas executadas em Edge Functions autenticadas.

## Isolamento multiempresa

A migration `20260930120000_commercial_multitenancy_hardening.sql` remove as policies históricas e recria o isolamento por tenant, módulo e área de negócio. Ela também adiciona FKs compostas e um gatilho que rejeita referências cruzadas. Isso é código preparado, não evidência de produção: até a migration ser aplicada e testada no projeto real, considere o ambiente remoto não homologado.

Os filtros do frontend nunca são fronteira de segurança. Toda Edge Function que usa `service_role` deve validar a empresa do usuário e repetir `tenant_id` em cada consulta e mutação.

## Secrets

- Não commitar `.env`, certificados, tokens, senhas ou dumps.
- Frontend: apenas URL, project ref e chave publicável do Supabase.
- Edge Functions: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `EVOLUTION_API_KEY`, `N8N_WEBHOOK_TOKEN`, allowlists e flags no cofre de secrets.
- Certificado A1 e senha: usar cofre/KMS no backend, criptografia em repouso, acesso mínimo, rotação e auditoria. O upload direto pelo navegador está desativado.
- Tokens antigos que possam ter sido armazenados no banco devem ser revogados e rotacionados.

## Dados pessoais no histórico

A migration histórica continha seeds identificáveis de funcionários e folha. O conteúdo foi neutralizado no estado atual da branch, mas continua alcançável em commits antigos. Isso precisa de avaliação de LGPD antes de ampliar o acesso ao repositório.

- Verifique em staging e produção quais registros vieram desse seed; correção, retenção ou anonimização no banco exige decisão documentada do controlador dos dados.
- Decida com o proprietário do repositório se o histórico Git público precisa ser saneado; reescrita de histórico é operação coordenada e não foi executada nesta auditoria.
- Revise clones, artefatos, logs, backups e forks, pois remover o arquivo da branch atual não apaga cópias existentes.
- O diretório legado `backup/` foi removido do estado atual da branch.

## Revisão obrigatória do Supabase

1. Reativar o projeto próprio e inventariar tabelas, views, funções, buckets, grants e policies antes da aplicação.
2. Criar backup e restaurá-lo em ambiente isolado.
3. Aplicar a migration de hardening primeiro em staging.
4. Gerar os tipos TypeScript do esquema resultante e revisar o diff.
5. Testar cada policy com JWTs de owner/admin, membro, usuário sem associação, outra empresa, portal e anon.
6. Confirmar que tabelas administrativas, folha, integrações, auditoria e Storage negam acesso indevido.
7. Repetir os advisors de segurança e desempenho após a DDL.

O receptor Asaas valida o token, grava o evento com ID determinístico antes da conciliação, reconcilia o estado no provedor e registra falhas/tentativas. O ledger do PDV é inacessível a `anon` e `authenticated`; apenas a Edge Function autorizada no módulo `caixa` chama as rotinas transacionais com `service_role`. A implantação comercial ainda exige um worker assíncrono monitorado para reprocessar eventos `failed` sem depender apenas do retry do provedor.

## Controles de produção ainda necessários

- Rate limiting/WAF para login, portal e webhooks públicos.
- MFA para administradores e política de sessão.
- SMTP transacional e proteção contra enumeração/abuso.
- Envio de faturamento por provedor transacional no backend; `mailto:` manual não oferece confirmação, anexos confiáveis, retry ou auditoria de entrega.
- CSP e demais headers no host do frontend.
- SAST, dependency scanning, secret scanning e atualização controlada de dependências.
- Validar retenção e exportação da trilha append-only de auditoria no banco real.
- Monitoramento, alertas e procedimento de resposta a incidentes.
- Backups/PITR e teste periódico de restauração.

Não publique uma vulnerabilidade com secrets ou dados pessoais em issue aberta. Registre o incidente em canal privado e rotacione qualquer credencial possivelmente exposta.
