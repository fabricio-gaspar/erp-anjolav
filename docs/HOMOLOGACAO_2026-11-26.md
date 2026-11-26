# Homologação técnica do AnjoLav ERP — 26/11/2026

## Estado

**Pré-produção. Não aprovado para comercialização integral.** A revisão partiu
da auditoria de 25/11/2026 e corrigiu os defeitos reproduzidos abaixo. O build
e os testes locais não substituem a homologação operacional de cada tela,
integração externa e procedimento de recuperação.

## Correções aplicadas e verificadas

| Área | Correção | Evidência |
| --- | --- | --- |
| PDV Doméstico e autorização | Domínio de operação alinhado e RPC de venda restrita ao serviço, sem execução anônima/autenticada direta | ROL Doméstico de teste criado pela interface; privilégios conferidos no catálogo PostgreSQL |
| Pagamento misto | RPC atômica com idempotência e Pix de maquininha | Cenário transacional de R$ 20 em dinheiro + R$ 28 em Pix, repetição sem duplicar e falha na segunda parcela sem gravar a primeira |
| Caixa e contas | Caixa compartilhado considera operações autorizadas; valor de conta a pagar deve ser positivo após normalização | Migrações aplicadas e consultas transacionais |
| Folha, contratos e retirada | Comandos ausentes reconstruídos com restrições de empresa e permissões | Testes SQL com `ROLLBACK`: contrato industrial, folha e confirmação de retirada repetida |
| Faturamento | Recebimento manual de fatura parcial/total, registro em caixa e contas a receber; Asaas e recebimento manual mutuamente exclusivos | `test/fat05-manual-invoice-receipts.integration.sql` passou contra a base conectada, com reversão integral |
| Demonstrativo Industrial | Consulta por cliente/período/fatura; referência incompatível a campo de cancelamento removida | Consulta autenticada com cliente existente; cenário transacional de fatura quitada passou |
| Permissões | Auditoria das alterações de permissões de módulo | Teste SQL transacional com trilha de auditoria |
| Fiscal e WhatsApp | Autorização fiscal por área ajustada; títulos padrão dos avisos corrigidos; envio em texto mantido | 7 testes locais do conteúdo e avisos de entrada/disponibilidade aceitos pelo WA-AKG no destinatário autorizado; entrega/leitura não confirmadas |
| Exportação de dados | Interface passou a informar o escopo parcial e o manifesto da exportação | Testes locais de paginação e limites passaram; não equivale a backup restaurável |
| Fonte | Seis Edge Functions ativas recuperadas do código implantado | Sintaxe/importações e paridade do fonte conferidas; novas publicações dessas seis não foram necessárias |

## Validação executada

- `npm run preflight:production`: tipos, lint, 59 testes, build e orçamento
  inicial de transferência aprovados. Alerta de chunk grande do mapa permanece.
- `npm run test:e2e`: 2 testes públicos aprovados; 4 jornadas autenticadas
  ficaram ignoradas por exigirem contas fictícias de homologação e seus dados.
- Isolamento RLS: operador Doméstico consultou apenas clientes Domésticos;
  operador Industrial consultou apenas clientes Industriais; usuário sem vínculo
  não consultou clientes/ROLs. Não houve dados de teste remanescentes do segundo
  tenant criado em transação.
- Um ROL Doméstico de teste foi persistido com item, valor e posição. Os dois
  avisos em texto foram aceitos pelo provedor; não houve confirmação de entrega
  ou leitura. O ROL de teste segue com saldo pendente e deve ser identificado
  como teste na operação.
- Testes de fatura, contratos, folha e agendamento usaram transações revertidas.
  Não geraram cobrança externa nem nota fiscal.

## Pendências para o aceite comercial

1. **Backup e restauração:** o exportador cobre 41 tabelas, sem prova de
   restauração completa, Auth e Storage. Definir retenção, cópia externa,
   recuperação e executar ensaio de restore em projeto isolado.
2. **Jornadas autenticadas:** executar os quatro testes E2E ignorados com
   contas fictícias de administrador e operadores e concluir os cenários
   Industrial, produção, estoque, fidelidade, cancelamento, entrega e baixa.
3. **Provedores e equipamentos:** NFS-e e boleto estão intencionalmente
   desabilitados até configuração e homologação; validar e-mail, webhooks,
   impressoras físicas, WhatsApp entregue e recuperação de falhas. Não marcar
   mensagem aceita pelo provedor como entregue.
4. **Segurança:** habilitar proteção contra senhas vazadas no Supabase Auth e
   revisar os avisos atuais do Security Advisor, em especial funções
   `SECURITY DEFINER` executáveis por usuários autenticados e grants de
   tabelas. RLS habilitada, por si, não conclui essa revisão.
5. **Cobertura funcional:** 13 nomes de RPC legadas continuam referenciados por
   componentes sem navegação ativa identificada nesta versão. Remover ou
   recuperar esses caminhos após decidir quais funções antigas permanecem no
   produto. Conferir todas as 97 entradas da matriz original; a correção de
   defeitos prioritários não converte automaticamente itens não validados em
   aprovados.
6. **Operação e desempenho:** medir uso real em dispositivos e rede da loja,
   ensaiar carga e indisponibilidade, definir alertas e suporte. O teste local
   de orçamento de transferência não mede latência nem disponibilidade.

Fonte da auditoria inicial: `artifacts/auditoria-erp-20261125/RELATORIO.md`
na workspace Codex. Nenhuma credencial ou documento pessoal está neste arquivo.
