
# Plano: Envio de ROL e Notificacoes Automaticas no PDV e Producao

## Problema Atual
O sistema possui toda a **infraestrutura de configuracao** (templates, WhatsApp, toggles ativo/inativo) mas nao executa nenhum envio real. Os templates ficam ociosos na tabela `notificacoes_config`.

## O que sera implementado

### 1. Envio do ROL ao cliente apos o checkout no PDV
No modal de pos-venda (`ImpressaoPosVendaModal.tsx`), alem das opcoes de impressao fisica, sera adicionada uma opcao para **enviar o ROL por WhatsApp** ao cliente.

**Como funcionara:**
- Nova checkbox "Enviar ROL por WhatsApp" no modal de pos-venda
- Ao marcar, o sistema monta a mensagem usando o template `os_retirada` configurado
- Abre o WhatsApp Web (`wa.me/`) com a mensagem pre-preenchida contendo: nome do cliente, numero da OS, total de pecas, valor e previsao de entrega
- So aparece se o cliente tiver telefone cadastrado

### 2. Notificacao automatica quando a OS ficar pronta (Expedicao)
No formulario de avanco de etapa (`FormularioEtapa.tsx`), quando a OS avancar para o status **expedicao** (pronta para entrega), o sistema dispara automaticamente uma notificacao ao cliente.

**Como funcionara:**
- Apos o `updateOrdemServico` confirmar a mudanca para `expedicao`, o sistema verifica se a notificacao `os_pronto` esta ativa na configuracao
- Se estiver ativa, abre o WhatsApp Web com a mensagem do template `os_pronto` preenchida com os dados do cliente e OS
- Tambem funciona para `os_producao` (quando entra em producao) e `os_entregue` (quando entregue)

### 3. Servico centralizado de notificacoes
Criar um servico utilitario que consulta a tabela `notificacoes_config`, verifica se o evento esta ativo e monta a mensagem com as variaveis substituidas.

---

## Arquivos que serao criados/modificados

### Novo arquivo:
- `src/services/notificacaoService.ts` - Servico centralizado para montar e disparar notificacoes

### Arquivos modificados:
- `src/components/caixa/ImpressaoPosVendaModal.tsx` - Adicionar opcao "Enviar WhatsApp" com ROL
- `src/components/producao/FormularioEtapa.tsx` - Disparar notificacao ao avancar para expedicao/entregue
- `src/hooks/useNotificacoesConfig.ts` - Adicionar funcao helper para buscar template por evento

---

## Detalhes tecnicos

### `src/services/notificacaoService.ts`
Novo servico com funcoes:
- `getNotificacaoTemplate(evento: string)` - busca o template ativo para o evento
- `montarMensagem(template: string, variaveis: Record<string, string>)` - substitui {cliente}, {numero}, {valor} etc.
- `enviarWhatsApp(telefone: string, mensagem: string)` - abre `wa.me/` com mensagem codificada
- `dispararNotificacao(evento: string, dados: { cliente, telefone, numero, valor?, previsao? })` - funcao principal que verifica config e dispara

### `ImpressaoPosVendaModal.tsx`
Mudancas:
- Receber prop `clienteTelefone` (opcional)
- Adicionar checkbox "Enviar comprovante por WhatsApp"
- No `handlePrint`, apos imprimir, chamar `dispararNotificacao("os_retirada", dados)` se marcado
- Mostrar checkbox somente se o cliente tiver telefone

### `FormularioEtapa.tsx`
Mudancas:
- Importar servico de notificacao
- Apos o `updateOrdemServico` e `registrarMudancaEtapa` com sucesso:
  - Se `proximaEtapa === "separacao"` ou equivalente a producao: disparar `os_producao`
  - Se `proximaEtapa === "expedicao"`: disparar `os_pronto`
  - Se `proximaEtapa === "entregue"`: disparar `os_entregue`
- Para isso, buscar os dados do cliente (nome e telefone) da OS

### `CaixaPDV.tsx`
Mudancas minimas:
- Passar `clienteTelefone` do cliente selecionado para o `ImpressaoPosVendaModal`

---

## Fluxo do usuario

### No PDV (ao finalizar venda):
1. Modal "OS Criada!" aparece
2. Opcoes: Imprimir ROL, Imprimir Etiquetas, **Enviar WhatsApp** (novo)
3. Ao clicar "Imprimir" ou "Enviar", executa as acoes selecionadas
4. WhatsApp Web abre com mensagem pre-montada

### Na Producao (ao avancar etapa):
1. Operador avanca OS para "Expedicao" (pronta)
2. Sistema verifica se notificacao `os_pronto` esta ativa
3. Se sim, abre WhatsApp Web automaticamente com mensagem para o cliente
4. Toast confirma "Notificacao enviada ao cliente"

### Controle pelo admin:
- Em Configuracoes > Notificacoes, o admin continua podendo ativar/desativar cada evento
- Templates editaveis com variaveis dinamicas
- Se um evento estiver **inativo**, nenhuma acao e disparada
