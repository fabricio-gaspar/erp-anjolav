

## Plano: Integração WhatsApp via Evolution API + n8n

### Situação Atual
O sistema hoje usa links `wa.me/` (abre WhatsApp Web manualmente). Não há integração com Evolution API, n8n, nem envio automático real de mensagens.

### Arquitetura Proposta

```text
Lovable (evento: criar OS, mudar status)
    ↓ Edge Function (webhook dispatcher)
n8n (automação + lógica de mensagens)
    ↓ HTTP
Evolution API (WhatsApp real via QR Code)
    ↓
Cliente recebe mensagem no WhatsApp
```

### O que será implementado

#### 1. Tabelas novas (migration)
- **`whatsapp_instancias`** — armazena URL da Evolution API, nome da instância, status (conectado/desconectado), QR code temporário
- **`mensagens_log`** — log de todas as mensagens enviadas (order_id, telefone, mensagem, status, erro, created_at) — substitui/complementa `notificacoes_enviadas`

#### 2. Tela "WhatsApp" nas Configurações
- Nova aba "WhatsApp" em `Configuracoes.tsx`
- Componente `ConfiguracoesWhatsApp.tsx`:
  - Campo: URL da Evolution API (ex: `https://evo.minhaempresa.com`)
  - Campo: Nome da instância (ex: `loja1`)
  - Botão "Conectar" → chama Edge Function → retorna QR Code
  - Exibe QR Code para escanear
  - Indicador de status: 🟢 Conectado / 🔴 Desconectado
  - Botão para verificar status / reconectar

#### 3. Edge Function `whatsapp-evolution`
- Rota `POST /connect` → cria instância + retorna QR code
- Rota `POST /status` → verifica status da conexão
- Rota `POST /send` → envia mensagem via Evolution API
- Usa secrets: `EVOLUTION_API_URL` e `EVOLUTION_API_KEY`

#### 4. Edge Function `webhook-dispatcher`
- Chamada pelo sistema quando:
  - OS é criada (evento `pedido_criado`)
  - Status muda para "pronto" (evento `pedido_pronto`)
  - Status muda para "entregue" (evento `pedido_entregue`)
- Envia payload para URL do n8n (configurável na tabela `whatsapp_instancias`)
- Registra no `mensagens_log`

#### 5. Atualizar `notificacaoService.ts`
- Adicionar modo de envio: `"wa.me"` (atual) ou `"evolution"` (novo)
- Se Evolution estiver configurada e conectada, enviar via Edge Function em vez de abrir link
- Fallback para `wa.me/` se Evolution não estiver ativa

#### 6. Botão "Reenviar mensagem" nos pedidos
- Em `DetalhesOS.tsx`: botão "📤 Reenviar WhatsApp"
- Dispara notificação usando o template do evento

#### 7. Histórico de mensagens no cliente
- Em `Clientes.tsx`: nova aba ou seção mostrando mensagens enviadas (query em `mensagens_log` por `cliente_id`)

#### 8. Configuração do n8n
- Campo na tela WhatsApp para informar URL do webhook n8n
- O sistema envia webhooks para essa URL nos eventos configurados
- A automação no n8n é responsabilidade do usuário (fora do Lovable)

### Secrets necessários
- `EVOLUTION_API_URL` — URL base da Evolution API
- `EVOLUTION_API_KEY` — API Key da Evolution

### Arquivos novos
- `supabase/migrations/xxx_whatsapp_tables.sql`
- `supabase/functions/whatsapp-evolution/index.ts`
- `supabase/functions/webhook-dispatcher/index.ts`
- `src/components/configuracoes/ConfiguracoesWhatsApp.tsx`
- `src/hooks/useWhatsAppConfig.ts`
- `src/hooks/useMensagensLog.ts`

### Arquivos modificados
- `src/pages/Configuracoes.tsx` — nova aba WhatsApp
- `src/services/notificacaoService.ts` — dual mode (wa.me vs Evolution)
- `src/components/ordens/DetalhesOS.tsx` — botão reenviar
- `src/App.tsx` — (se necessário para rotas)

### Ordem de implementação
1. Tabelas + migration
2. Edge Function `whatsapp-evolution`
3. Tela de configuração WhatsApp
4. Atualizar serviço de notificação (dual mode)
5. Edge Function `webhook-dispatcher` (n8n)
6. Botão reenviar + histórico de mensagens

### Pré-requisitos do usuário
- Ter uma instância da Evolution API rodando (self-hosted ou cloud)
- Ter uma instância do n8n configurada com os fluxos de automação
- Fornecer as API keys quando solicitado

