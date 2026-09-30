# Checklist de go-live

O sistema só pode receber a aprovação comercial quando todos os itens obrigatórios estiverem marcados, com evidência anexada ao release.

## Produto e operação

- [ ] Escopo contratado e módulos disponíveis estão documentados.
- [ ] Fluxos Industrial, Residencial, Central e Portal foram aceitos pelos responsáveis.
- [ ] Cadastro inicial, importação e saneamento de dados foram aprovados.
- [ ] Treinamento, suporte, SLA e plano de continuidade estão definidos.

## Segurança e dados

- [ ] Migration SaaS multiempresa aplicada em staging e produção, com backfill e contagens validados.
- [ ] Policies RLS e grants revisados; nenhuma policy ampla indevida permanece.
- [ ] Testes cruzados provam que cada perfil recebe zero linhas fora de seu escopo.
- [ ] RPC legado de descoberta de e-mail foi revogado.
- [ ] MFA administrativo, rate limiting e política de sessão estão ativos.
- [ ] Secrets e certificados estão no cofre, com rotação e acesso mínimo.
- [ ] LGPD, privacidade, retenção, exportação e exclusão foram revisadas juridicamente.
- [ ] Seeds identificáveis da migration histórica foram tratados no banco e no histórico Git conforme decisão formal de LGPD.
- [x] Diretório de backup legado e artefatos do Lovable foram excluídos do estado atual do repositório.
- [ ] Auditoria de ações administrativas e financeiras está ativa.

## Integridade e qualidade

- [ ] Operações multi-tabela críticas são transacionais e seguras contra concorrência.
- [ ] Constraints, FKs, índices e idempotência foram verificadas no banco real.
- [ ] Typecheck, testes, lint e build passam no commit de release.
- [ ] Warnings do lint foram resolvidos ou aceitos formalmente em um baseline com responsável e prazo.
- [ ] Testes unitários, integração, RLS e E2E passam no CI.
- [ ] Testes de carga e recuperação de falhas atendem aos limites definidos.
- [ ] Responsividade, teclado, leitor de tela e contraste foram validados.
- [ ] Dashboard foi reconciliado com consultas independentes e testado sem dados, sem permissão e com falha de rede.
- [ ] Etiquetas Code 128-B foram lidas pelas impressoras e scanners do ambiente real.

## Integrações

- [ ] Asaas produção homologado com PIX, boleto, webhook, estorno e conciliação.
- [ ] Migration do ledger do PDV aplicada antes das Edge Functions `pdv-payment` e `asaas-webhook`.
- [ ] PDV homologado com dinheiro/troco, débito, crédito parcelado, pagamento parcial e múltiplas formas na mesma OS.
- [ ] PIX do PDV homologado com QR/valor, confirmação pelo webhook e consulta, cancelamento pendente, evento duplicado, reabertura sem nova cobrança, browser fechado, estorno e bloqueio de fechamento do caixa enquanto houver PIX pendente.
- [ ] Webhook Asaas persiste ID único antes da conciliação e possui worker, retry, ordenação e monitoramento de eventos `failed`.
- [ ] NFS-e permanece `NFSE_ENABLED=false`; antes de anunciá-la, homologar emissão, consulta, rejeição, cancelamento e DANFSE.
- [ ] Certificado A1 validado e alerta de expiração configurado.
- [ ] Evolution/WhatsApp homologado com retry e fila de falhas.
- [ ] Provedor de e-mail transacional homologado para faturamento, anexos, entrega, bounce e retry; ações manuais `mailto:` não são contabilizadas como envio.
- [ ] n8n homologado com validação de `X-AnjoLav-Webhook-Token`, idempotência e replay.
- [ ] SMTP e recuperação de senha funcionam no domínio final.
- [ ] O escopo comercial informa que não há central de notificações persistentes, ou o módulo foi implementado e homologado.

## Operação de produção

- [ ] Staging é equivalente à produção e UAT foi assinado.
- [ ] Backup/PITR está ativo e uma restauração foi concluída com sucesso.
- [ ] Logs, métricas, tracing, alertas e plantão estão configurados.
- [ ] Runbooks de incidente, indisponibilidade e rollback foram ensaiados.
- [ ] Domínio, HTTPS, DNS, CORS, CSP e redirects de autenticação foram validados.
- [ ] Responsáveis técnico, operacional e comercial assinaram o go-live.
- [ ] `ops/release-evidence.json` contém evidências dos gates e `npm run preflight:production` aprova o commit de release.
- [ ] Projeto Supabase próprio `uomhckyqghkcnctbdwvp` está ativo; nenhuma configuração aponta para o project ref antigo.
- [ ] Integração GitHub App do Lovable foi revogada nas configurações da conta/organização.

## Aprovação

- Release/commit: ______________________________
- Ambiente: ____________________________________
- Responsável técnico: _________________________
- Responsável operacional: _____________________
- Responsável comercial: _______________________
- Data: ________________________________________
