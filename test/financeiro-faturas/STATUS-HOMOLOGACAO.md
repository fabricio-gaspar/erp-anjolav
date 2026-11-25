# Faturamento agrupado — trabalho em andamento

Esta cópia é de desenvolvimento. Não aplicar as migrações nem publicar as funções antes da revisão e homologação completas.

## Validado localmente

Em banco descartável com dados fictícios, foram exercitados pagamentos parciais e integrais, estorno manual, concorrência, recusa de pagamento acima do saldo, entrega de ROL faturado sem pagamento, taxa de delivery, saldo de contas a receber, filtros, reserva de boleto e eventos simulados de recebimento e estorno integral do Asaas. Os testes locais usam uma fixture simplificada: não substituem testes com as políticas e integrações reais do projeto de homologação.

Foi acrescentado cancelamento com motivo e trilha histórica para faturas sem recebimento, boleto ou situação fiscal a conciliar. Os ROLs são liberados para novo fechamento sem alterar a entrega; teste local cobre refaturamento, repetição, consulta histórica e bloqueios por pagamento, cobrança, nota, permissão e operação. O fechamento agora define a operação da fatura, obrigatória no banco publicado.

Os formatos `mapa_pecas`, `mapa_mensal` e `detalhado` são gerados a partir dos itens e preços do ROL, com testes locais para datas, preços distintos e taxa de delivery. A prévia e o relatório reaberto usam a mesma lógica. A quantidade informada pelo cliente (Q.CLI) não consta no snapshot atual, e o relatório informa essa limitação. O detalhamento de contrato deve ser verificado antes de homologar esses modelos.

## Pendências para concluir

- Identificar o projeto Supabase de homologação e a referência segura do certificado A1 de teste; validar permissões e políticas reais, interface e ciclo de NFS-e na produção restrita, sem expor chaves.
- Configurar a conta sandbox do Asaas e seu webhook. Homologar emissão, retorno, eventos repetidos, estornos, chargebacks e falhas de comunicação com dados do provedor. Estorno parcial e chargeback exigem conciliação assistida e não estão concluídos; eventos não devem ser ignorados como pagos.
- Criar e testar um procedimento seguro para solucionar reserva de boleto cujo resultado no provedor permaneça incerto, sem criar cobrança duplicada.
- Homologar visualmente os modelos de relatório, incluindo Q.CLI e contrato, com exemplos reais autorizados; não inferir dados ausentes dos ROLs.
- Homologar a tela unificada de faturas do painel financeiro, inclusive os controles de cancelamento e novo fechamento. Implementar operações de recebimento em dinheiro/cartão e sua integração com caixa.
- Concluir e homologar os recursos fiscais pendentes, inclusive documento fiscal de saída e operações de cancelamento/substituição conforme suporte da integração. Não afirmar emissão funcional com base apenas nos testes locais.
- Reexecutar testes integrados de permissões, concorrência, proteção de dados, reversão e migração de dados históricos no ambiente de homologação. Rever as funções SECURITY DEFINER e validar planos de recuperação.
- Publicar apenas após concluir e validar as pendências. O usuário autorizou a publicação quando os testes estiverem concluídos.

Os SQLs nesta pasta são exclusivamente para o banco descartável identificado nas próprias fixtures; não executá-los em banco real.
