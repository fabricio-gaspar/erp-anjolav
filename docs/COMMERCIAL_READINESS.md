# Estado de prontidão comercial

Última revisão local: 22/09/2026

Branch: `edit/edt-618b97b0-b02d-458e-86e8-a144c5456b77`

Commit-base auditado: `5da2fe112f425d937952e68fd4a80027b24c4fca`

## Veredito

**NÃO APROVADO PARA COMERCIALIZAÇÃO NESTE MOMENTO.**

O frontend e as Edge Functions receberam correções importantes, mas ainda não existe evidência suficiente para garantir isolamento de dados, emissão fiscal real, processamento financeiro em produção ou comportamento integrado no ambiente Supabase. Compilar não equivale a estar pronto para operar com dados e dinheiro de clientes.

## Situação por fase

| Fase | Estado | Evidência ou pendência |
|---|---|---|
| Segurança, tenants e RLS | Bloqueada | A aplicação passou a filtrar por painel e negar acessos desconhecidos, porém migrations existentes ainda contêm policies `USING (true)`. É necessário acesso ao projeto, decisão do modelo de tenancy, backfill e testes cruzados de RLS. |
| Permissões e autenticação | Parcial | Rotas e Edge Functions usam gates explícitos e fail-closed. Login por usuário foi movido para backend; funcionário inativo é recusado e a desativação remove roles e bloqueia a conta Auth. Ainda é preciso revogar o RPC legado `get_employee_email_by_login`, implantar as funções, testar todas as roles e configurar proteção contra abuso/rate limit no perímetro. |
| Portal do cliente | Parcial | Consultas e lançamentos passaram para uma Edge Function com escopo derivado do código do cliente; códigos novos têm 160 bits. Falta implantar a função, regenerar links antigos e executar testes de tentativa de acesso entre clientes. |
| Transações e integridade | Parcial | Fluxos críticos agora verificam erros e alguns possuem compensação. Operações multi-tabela e atualizações concorrentes ainda precisam de RPCs transacionais, constraints e testes no Postgres. |
| Fiscal e pagamentos | Bloqueada | O PDV agora possui ledger próprio, venda atômica, dinheiro/troco, débito, crédito/parcelas, recebimento parcial, múltiplas formas por OS e PIX dinâmico com QR, confirmação real e cancelamento. O webhook persiste o evento antes da conciliação e registra retry/falha. Ainda faltam worker assíncrono, credenciais e homologação externa do Asaas; NFS-e continua sem provedor homologado e a tela gera somente prévia sem valor fiscal. |
| WhatsApp, e-mail e webhooks | Parcial | Secrets saíram do frontend, há autenticação/autorização, allowlist HTTPS, timeout e logs reduzidos. Envios por WhatsApp vinculados a OS/fatura obtêm o telefone no servidor e só são marcados como enviados após confirmação positiva da Evolution; o fallback automático `wa.me` foi removido. O n8n agora recebe um token obrigatório no header `X-AnjoLav-Webhook-Token`, configurado apenas em secret de backend. E-mail permanece manual, sem anexos e sem ser contabilizado como entrega. Falta homologar Evolution, provedor transacional de e-mail, n8n, callbacks e retries. |
| Testes automatizados | Parcial | Os 28 testes locais passam e cobrem autorização, escopo de área, códigos do portal, documentos brasileiros, impressão segura, checksum Code 128-B, contrato de produção, troco, idempotência e encerramento correto do PIX. Faltam testes RLS, integração Supabase, E2E dos fluxos principais, concorrência, restauração e carga. |
| Frontend, responsividade e acessibilidade | Parcial | Rotas foram segmentadas e carregadas sob demanda; ficha de funcionário e telas alteradas receberam ajustes responsivos; copiar preços e impressões do PDV deixaram de ser placeholders. O dashboard deixou de exibir clientes, números, status e indicadores estáticos como se fossem reais: agora usa consultas escopadas, oculta indicadores que falharam e informa a fonte indisponível. Notificações fictícias foram removidas. Prévias de impressão estão marcadas como amostra e as etiquetas usam Code 128-B com checksum e zona silenciosa. O smoke test visual automatizado foi bloqueado pelo runtime CUA desta sessão (`EPERM`). Falta matriz completa de dispositivos, teclado, leitor de tela, contraste, scanner físico e auditoria WCAG. |
| Lint, build e documentação | Parcial | Typecheck real dos dois projetos TS, 25 testes, lint e build de produção passam. O lint tem zero erros e 178 warnings legados (157 `no-explicit-any` e 21 `react-refresh/only-export-components`). O build gerou 3.511 módulos com divisão por rota; falta confirmar o mesmo resultado no CI limpo. |
| Auditoria final | Bloqueada | A auditoria local foi concluída, mas a auditoria de go-live só pode ocorrer depois dos bloqueios abaixo e de uma implantação de staging equivalente à produção. |

## Bloqueadores obrigatórios

1. Definir o produto como instalação de empresa única, multiunidade ou SaaS multi-tenant.
2. Criar migration nova e aditiva para propagar `tenant_id`/`unidade_negocio`, fazer backfill, constraints, índices e policies RLS restritivas.
3. Remover policies permissivas antigas somente depois de testes canário; nunca editar migrations já aplicadas.
4. Revogar acesso anônimo ao RPC legado de descoberta de e-mail e revisar todos os grants de `anon` e `authenticated`.
5. Validar, com usuários reais de teste, que Industrial, Residencial, Central e Portal não leem nem alteram dados fora do escopo.
6. Implementar transações Postgres para fechamento de caixa, estoque, produção, faturamento e operações multi-tabela.
7. Contratar/definir o provedor NFS-e e município, instalar o certificado A1 em cofre seguro, homologar emissão, consulta e cancelamento.
8. Aplicar em staging a migration do ledger do PDV, publicar `pdv-payment` e homologar o Asaas com cliente piloto, token exclusivo, idempotência e conciliação.
9. Adicionar um worker assíncrono monitorado para reprocessar eventos Asaas `failed`; o inbox e a persistência anterior à conciliação já estão implementados.
10. Homologar Evolution API e n8n, incluindo validação de `X-AnjoLav-Webhook-Token`, callbacks, retries e fila de falhas.
11. Contratar e integrar provedor de e-mail transacional para faturamento, anexos, rastreio de entrega/bounce e retries; o fluxo `mailto:` atual é apenas preparação manual e nunca comprova envio.
12. Configurar backups, teste de restauração, observabilidade, alertas, retenção, continuidade e resposta a incidentes.
13. Tratar a migration histórica `20260511151748_5134974c-2254-4cc9-bbcf-829c541bf05f.sql`, que contém dados identificáveis de funcionários/folha: avaliar base real, remoção por migration aditiva e eventual saneamento coordenado do histórico Git. Não reescrever o histórico sem plano para todos os clones e ambientes.
14. Revisar e remover de forma coordenada o diretório versionado `backup/lovable-main-20260804`; novas cópias já estão ignoradas, mas os 310 arquivos legados continuam no histórico.
15. Concluir testes E2E/RLS/carga e uma rodada de UAT assinada pelos responsáveis da operação.
16. Concluir requisitos legais e comerciais: LGPD, termos, política de privacidade, contratos, suporte, SLA, faturamento e treinamento.

## Testes que dependem de ambiente externo

- Policies e grants no banco Supabase real, inclusive acessos cruzados e Storage.
- Login, recuperação de senha, SMTP, redirects e expiração de sessão.
- Asaas sandbox e produção: criação, duplicidade, PIX, boleto, liquidação, estorno e webhook fora de ordem.
- Asaas webhook: confirmação de que o token do provedor corresponde ao secret, persistência antes do HTTP 200, worker, retry e fila interrompida.
- NFS-e: certificado, assinatura, autorização, rejeição, consulta, cancelamento e DANFSE.
- Evolution/WhatsApp: conexão, envio, retorno, indisponibilidade e retry.
- E-mail transacional: anexos, entrega, bounce, retry e rastreabilidade; o cliente de e-mail manual não constitui teste de envio.
- n8n: autenticação, payload, idempotência, timeout e replay.
- Backup/PITR e restauração em ambiente isolado.
- E2E em staging com dados sanitizados, navegadores e dispositivos suportados.
- Dashboard em staging: conferir os totais contra consultas independentes e testar estados vazio, sem permissão e falha de rede.
- Etiquetas: confirmar leitura do Code 128-B em impressora, papel e scanners efetivamente usados pela operação.
- Smoke visual responsivo desta sessão, bloqueado porque o runtime de navegador do Codex não pôde carregar um módulo interno (`EPERM`).

## Evidências locais desta revisão

- Branch e base: `edit/edt-618b97b0-b02d-458e-86e8-a144c5456b77` em `5da2fe112f425d937952e68fd4a80027b24c4fca`.
- Typecheck: `tsconfig.app.json` e `tsconfig.node.json`, sem erros.
- Testes: 25 aprovados, zero falhas.
- Lint: zero erros; 178 warnings legados classificados acima.
- Edge Functions: 12 arquivos TypeScript passaram pela checagem sintática local.
- Build: produção concluída, 3.511 módulos transformados; maior chunk: gráficos, 420,41 kB antes de gzip.
- Dependências: a última auditoria local após a atualização retornou zero vulnerabilidades conhecidas; deve ser repetida no CI do commit de release.
- Secrets: nenhum padrão de chave privada, JWT, chave Asaas ou service role foi encontrado no código ativo; `.env` deixou de ser versionado.
- Preparação de produção: modelos não versionados de ambiente, preflight sem exposição de secrets, registro de evidências de release e workflow manual de Edge Functions foram adicionados; não realizam deploy ou teste externo por conta própria.

## Escopo funcional a decidir

A auditoria também identificou módulos não existentes: central de notificações persistentes, máquinas, manutenção preventiva/corretiva, qualidade/reprocesso, custos por OS/kg, consumo de químicos e produtividade por operador. Eles não devem ser prometidos comercialmente até haver decisão de produto, modelo de dados, implementação e aceite.
