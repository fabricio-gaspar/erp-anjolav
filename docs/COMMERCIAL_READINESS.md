# Prontidão comercial do AnjoLav ERP

Última revisão de código: 30/09/2026.

## Veredito

O repositório está **tecnicamente preparado para implantação controlada**, mas ainda não deve ser apresentado como produção homologada. O código, por si só, não comprova que migrations, secrets, provedores, backups e políticas estão ativos no ambiente real.

O destino próprio é o projeto Supabase `anjolav` (`uomhckyqghkcnctbdwvp`). Ele foi encontrado inativo durante esta revisão; nenhuma migration ou Edge Function foi aplicada enquanto o banco permaneceu indisponível.

## Implementado no código

- SaaS multiempresa com `tenants`, associação de usuários, empresa ativa, seletor de empresa e limpeza de cache ao alternar.
- `tenant_id` obrigatório, backfill determinístico, índices, FKs compostas e gatilho que bloqueia relações entre empresas diferentes em todas as tabelas de negócio.
- Remoção das policies históricas permissivas e recriação de RLS por tenant, módulo e área de negócio, com tabelas administrativas e de integração restritas.
- Grants explícitos para `authenticated` e `service_role`; RPC legado que revelava e-mail por login revogado do navegador.
- Auditoria append-only para alterações sensíveis, com remoção de tokens, senhas e material de certificado do payload auditado.
- Login, funcionários, Asaas, PDV, WhatsApp, webhooks, importação e portal escopados pela empresa ativa no backend.
- Portal com expiração/revogação, rate limit, fingerprint sem IP em claro e lançamento transacional idempotente.
- Produção e cancelamento de OS por RPC transacional; pagamentos preservados com `ON DELETE RESTRICT`.
- PDV com dinheiro/troco, débito, crédito, pagamento parcial/múltiplo e PIX dinâmico com QR e valor.
- NFS-e em adaptador fail-closed: `NFSE_ENABLED=false` é o padrão e nenhuma emissão é enviada sem município, provedor, allowlist HTTPS, credenciais, certificado e adaptador específico homologado.
- Artefatos do Lovable, preview auth e `lovable-tagger` removidos do estado atual do repositório.
- Migration com dados pessoais de funcionários/folha neutralizada para instalações novas.
- TypeScript, testes, lint sem erros, checagem das Edge Functions e build de produção validados localmente.

## Bloqueios de go-live que dependem do ambiente real

1. Reativar o projeto Supabase próprio e confirmar plano/custo.
2. Fazer backup verificável antes da mudança e ensaiar restauração.
3. Comparar migrations remotas, aplicar a migration de hardening primeiro em staging e executar testes cruzados de RLS com duas empresas e todos os perfis.
4. Gerar novamente os tipos TypeScript a partir do banco aplicado e executar o pipeline completo.
5. Publicar as Edge Functions e cadastrar secrets reais sem prefixo `VITE_`.
6. Homologar Asaas, webhook, PIX, estorno, duplicidade e recuperação de eventos falhos.
7. Homologar Evolution e n8n, incluindo indisponibilidade, retry e replay.
8. Manter NFS-e desativada até receber município, provedor e credenciais; depois implementar o adaptador específico e homologar emissão, consulta, rejeição, cancelamento e DANFSE.
9. Contratar e integrar e-mail transacional se o envio automático de faturamento fizer parte da oferta; `mailto:` não é comprovante de envio.
10. Executar E2E/UAT, responsividade, acessibilidade, impressoras/scanners e carga no ambiente equivalente à produção.
11. Ativar monitoramento, alertas, retenção, resposta a incidentes, MFA administrativo e proteção de perímetro.
12. Aprovar LGPD, termos, política de privacidade, contrato, SLA, suporte, treinamento e processo de atendimento.
13. Decidir juridicamente se os dados pessoais ainda presentes no histórico antigo do Git exigem reescrita coordenada, rotação de artefatos e limpeza de clones/forks.

## Critério para declarar comercializável

Somente declarar o sistema pronto depois que todos os itens do [checklist de go-live](GO_LIVE_CHECKLIST.md) tiverem evidência real em `ops/release-evidence.json` e o preflight aprovar exatamente o commit implantado. NFS-e pode permanecer desativada se essa limitação estiver explícita no contrato e na oferta comercial.
