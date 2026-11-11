# WhatsApp WA-AKG no AnjoLav

## Estado da integração

- A instalação examinada em 11/11/2026 está em `https://wa.wfdigital.com.br` (HTTPS válido), com código em `/opt/wa-akg/app`, commit `c7dd01a04339e4363b549beb3a41fe02cf131acb`.
- O envio usa `POST /api/messages/{sessionId}/{jid}/send`, autenticação `X-API-Key` e corpo `{ "message": { "text": "..." } }`.
- A migração `20261111140000_wa_akg_notifications.sql` mantém registros antigos para auditoria, acrescenta o diário de entrega e a opção de não receber WhatsApp no cliente.
- A Edge Function `whatsapp-evolution` antiga responde 410; o frontend chama `whatsapp-gateway` e os avisos de ROL chamam `rol-notifications`.
- Mensagens reais ficam desativadas se `WA_AKG_ENABLED` não for exatamente `true`. Não habilite antes de validar a sessão, o destinatário e o webhook.

## Configuração por ambiente

1. Aplique a migração, depois implante `whatsapp-gateway`, `rol-notifications`, `wa-akg-webhook` e por último a função 410 da Evolution.
2. Configure **no Supabase, sem gravar no repositório**: `WA_AKG_API_KEY`, `WA_AKG_ALLOWED_HOSTS=wa.wfdigital.com.br`, `WA_AKG_WEBHOOK_SECRET` (segredo aleatório com pelo menos 32 caracteres) e `WA_AKG_ENABLED=false`.
3. Em Configurações > WhatsApp da empresa autorizada, salve a URL HTTPS exata `https://wa.wfdigital.com.br`. O servidor deriva uma sessão separada por empresa (`anjolav-{tenantId}`); a tela não recebe a chave da API.
4. Configure a WA-AKG para enviar `message.status` ao endpoint Supabase `/functions/v1/wa-akg-webhook`, com o **mesmo** segredo de assinatura. A função exige `X-Webhook-Signature: sha256=<HMAC-SHA256 do corpo bruto>` e não usa JWT porque a assinatura autentica o provedor.
5. Conecte a sessão pelo QR Code e confirme o status na tela. Só depois ative `WA_AKG_ENABLED=true` e envie um teste a número autorizado, usando o botão de teste. O teste real deve ser solicitado pelo administrador.

## Operação e segurança

- Notificações de entrada e liberação usam dados do ROL persistido. A liberação só é elegível quando todas as peças têm posição e o ROL está em expedição.
- O pedido é verificado com RLS do usuário antes de o servidor consultar dados do cliente. Dados de outra empresa ou área não são elegíveis.
- O diário reserva uma chave por evento antes do envio. HTTP 5xx, timeout ou confirmação sem ID deixam o resultado `incerto`; nunca faça reenvio automático nesses casos.
- Em `incerto`, confira a mensagem no WA-AKG e registre a decisão e evidência na tela de configurações. Falhas definitivas podem ser tentadas novamente por administrador, até o limite de três tentativas.
- `enviado` significa aceito pelo provedor; `entregue` e `lido` dependem do webhook. O painel não deve afirmar entrega apenas com a resposta do endpoint de envio.
- O cliente pode optar por não receber WhatsApp em seu cadastro. A opção é revalidada imediatamente antes de chamar o provedor.
- Não há anexo PDF automático de ROL ou nota: o fluxo atual envia texto factual. Um documento só deve ser anexado após persistência e autorização de acesso próprias.

## Reversão segura

Defina `WA_AKG_ENABLED=false` no Supabase para interromper novos envios. Preserve `mensagens_log` e `mensagens_log_eventos` para auditoria e concilie estados `processando`/`incerto` antes de reativar. A função Evolution permanece desativada para impedir envios por um caminho sem a mesma trilha de controle.
