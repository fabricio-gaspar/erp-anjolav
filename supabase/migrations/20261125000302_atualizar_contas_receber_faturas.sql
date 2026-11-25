-- Mantém a view de contas a receber e mostra os recebimentos reais de faturas.
CREATE OR REPLACE VIEW public.v_contas_receber WITH (security_invoker=true) AS
 SELECT f.id,
    'fatura'::text AS origem,
    f.cliente_id,
    c.razao_social AS cliente_nome,
    COALESCE(f.numero_nf, 'Fatura '::text || substr(f.id::text, 1, 8)) AS descricao,
    f.valor_total AS valor,
    coalesce(f.valor_recebido, 0) AS valor_recebido,
    COALESCE(f.data_vencimento, f.periodo_fim) AS data_vencimento,
    CASE WHEN f.valor_recebido > 0 THEN COALESCE(f.data_recebimento, fatura_charge.paid_at::date, f.updated_at::date) ELSE NULL::date END AS data_recebimento,
    CASE WHEN f.status = 'cancelado' THEN 'cancelado'
         WHEN f.valor_total > 0 AND f.valor_recebido >= f.valor_total THEN 'recebido'
         WHEN f.valor_recebido > 0 THEN 'parcial'
         ELSE 'pendente' END AS status,
    f.categoria_id,
    f.centro_custo_id,
    f.created_at
   FROM faturas f
     LEFT JOIN clientes c ON c.id = f.cliente_id AND c.tenant_id = f.tenant_id
     LEFT JOIN asaas_charges fatura_charge ON fatura_charge.id = f.asaas_charge_id AND fatura_charge.tenant_id = f.tenant_id
  WHERE f.tenant_id = (( SELECT private.current_tenant_id() AS current_tenant_id)) AND private.can_access_client(f.cliente_id)
UNION ALL
 SELECT cm.id,
        CASE
            WHEN setor_movimento.area = 'industrial'::text THEN 'pdv_industrial'::text
            WHEN setor_movimento.area = 'residencial'::text THEN 'pdv_loja'::text
            ELSE 'manual'::text
        END AS origem,
    cm.cliente_id,
    COALESCE(cl.razao_social, 'Venda Balcão'::text) AS cliente_nome,
    COALESCE(cm.descricao, 'Venda PDV'::text) AS descricao,
        CASE
            WHEN upper(cm.tipo) = 'ESTORNO'::text THEN - abs(cm.valor)
            ELSE cm.valor
        END AS valor,
        CASE
            WHEN upper(cm.tipo) = 'ESTORNO'::text THEN - abs(cm.valor)
            ELSE cm.valor
        END AS valor_recebido,
    cm.created_at::date AS data_vencimento,
    cm.created_at::date AS data_recebimento,
        CASE
            WHEN upper(cm.tipo) = 'ESTORNO'::text THEN 'estornado'::text
            ELSE 'recebido'::text
        END AS status,
    cm.categoria_id,
    cm.centro_custo_id,
    cm.created_at
   FROM caixa_movimentacoes cm
     LEFT JOIN ordens_servico os ON os.id = cm.ordem_servico_id AND os.tenant_id = cm.tenant_id
     LEFT JOIN clientes cl ON cl.id = COALESCE(os.cliente_id, cm.cliente_id) AND cl.tenant_id = cm.tenant_id
     LEFT JOIN centros_custo centro ON centro.id = cm.centro_custo_id AND centro.tenant_id = cm.tenant_id
     CROSS JOIN LATERAL ( SELECT
                CASE
                    WHEN os.id IS NOT NULL THEN
                    CASE
                        WHEN lower(os.origem) = 'industrial'::text THEN 'industrial'::text
                        WHEN lower(os.origem) = ANY (ARRAY['residencial'::text, 'loja'::text]) THEN 'residencial'::text
                        ELSE NULL::text
                    END
                    WHEN lower(cl.classificacao) = ANY (ARRAY['industrial'::text, 'residencial'::text]) THEN lower(cl.classificacao)
                    WHEN lower(centro.nome) = 'industrial'::text THEN 'industrial'::text
                    WHEN lower(centro.nome) = ANY (ARRAY['loja'::text, 'residencial'::text]) THEN 'residencial'::text
                    ELSE NULL::text
                END AS area) setor_movimento
  WHERE (upper(cm.tipo) = ANY (ARRAY['VENDA'::text, 'ESTORNO'::text])) AND cm.tenant_id = (( SELECT private.current_tenant_id() AS current_tenant_id)) AND (cm.ordem_servico_id IS NULL OR os.id IS NOT NULL) AND (COALESCE(os.cliente_id, cm.cliente_id) IS NULL OR cl.id IS NOT NULL) AND private.can_access_area(COALESCE(setor_movimento.area, 'central'::text)) AND NOT (EXISTS ( SELECT 1
           FROM pdv_pagamentos pagamento
             JOIN faturas fatura ON fatura.asaas_charge_id = pagamento.asaas_charge_id AND fatura.tenant_id = pagamento.tenant_id
          WHERE pagamento.id = cm.pdv_pagamento_id AND pagamento.tenant_id = cm.tenant_id))
UNION ALL
 SELECT ac.id,
    'asaas'::text AS origem,
    ac.cliente_id,
    ac.customer_name AS cliente_nome,
    ac.description AS descricao,
    ac.value AS valor,
        CASE
            WHEN ac.status = 'RECEIVED'::text THEN ac.value
            ELSE 0::numeric
        END AS valor_recebido,
    ac.due_date AS data_vencimento,
    ac.paid_at::date AS data_recebimento,
        CASE ac.status
            WHEN 'RECEIVED'::text THEN 'recebido'::text
            WHEN 'CONFIRMED'::text THEN 'pendente'::text
            WHEN 'OVERDUE'::text THEN 'atrasado'::text
            WHEN 'PENDING'::text THEN 'pendente'::text
            ELSE lower(ac.status)
        END AS status,
    ac.categoria_id,
    ac.centro_custo_id,
    ac.created_at
   FROM asaas_charges ac
  WHERE ac.tenant_id = (( SELECT private.current_tenant_id() AS current_tenant_id)) AND
        CASE
            WHEN ac.cliente_id IS NULL THEN private.can_access_area('central'::text)
            ELSE private.can_access_client(ac.cliente_id)
        END AND NOT (EXISTS ( SELECT 1
           FROM faturas f
          WHERE f.asaas_charge_id = ac.id AND f.tenant_id = ac.tenant_id)) AND NOT (EXISTS ( SELECT 1
           FROM pdv_pagamentos pp
             JOIN caixa_movimentacoes cm ON cm.pdv_pagamento_id = pp.id AND cm.tenant_id = pp.tenant_id
          WHERE pp.asaas_charge_id = ac.id AND pp.tenant_id = ac.tenant_id AND upper(cm.tipo) = 'VENDA'::text))
UNION ALL
 SELECT ct.id,
    'contrato'::text AS origem,
    ct.cliente_id,
    c.razao_social AS cliente_nome,
    ct.descricao,
    ct.valor_servico AS valor,
    0::numeric AS valor_recebido,
    (date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) + '1 mon -1 days'::interval)::date AS data_vencimento,
    NULL::date AS data_recebimento,
    'pendente'::text AS status,
    ( SELECT categorias_financeiras.id
           FROM categorias_financeiras
          WHERE categorias_financeiras.tenant_id = ct.tenant_id AND categorias_financeiras.nome = 'Aluguel / Contrato'::text AND categorias_financeiras.tipo = 'receita'::text
         LIMIT 1) AS categoria_id,
    ( SELECT centros_custo.id
           FROM centros_custo
          WHERE centros_custo.tenant_id = ct.tenant_id AND centros_custo.nome = 'Industrial'::text
         LIMIT 1) AS centro_custo_id,
    ct.created_at
   FROM contratos_aluguel ct
     LEFT JOIN clientes c ON c.id = ct.cliente_id AND c.tenant_id = ct.tenant_id
  WHERE ct.ativo = true AND ct.tenant_id = (( SELECT private.current_tenant_id() AS current_tenant_id)) AND private.can_access_client(ct.cliente_id);

