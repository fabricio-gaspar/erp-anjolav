-- FAT-05: the invoice workflow status is not its settlement status. Keep the
-- other receivables sources as they are, including their duplicate exclusions.
-- The billing UI expects invoice receipt fields that are absent from the
-- current live schema. to_jsonb reads them when present and supports both
-- schema versions without treating a stale workflow status as a receipt.

-- A security-invoker view cannot see a linked Asaas charge through the existing
-- admin-only charge SELECT policy. Permit only charges belonging to an invoice
-- the caller can already read, within the same tenant, module and operation.
CREATE INDEX IF NOT EXISTS faturas_charge_tenant_idx
  ON public.faturas (asaas_charge_id, tenant_id)
  WHERE asaas_charge_id IS NOT NULL;

CREATE POLICY invoice_receivables_charge_read ON public.asaas_charges
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT private.current_tenant_id())
    AND (SELECT private.has_any_module_access(
      '{faturamento,caixa,contas_receber,contas_pagar,dashboard,relatorios}'::text[]
    ))
    AND EXISTS (
      SELECT 1
      FROM public.faturas invoice
      WHERE invoice.tenant_id = asaas_charges.tenant_id
        AND invoice.asaas_charge_id = asaas_charges.id
        AND invoice.asaas_charge_id IS NOT NULL
        AND private.can_access_client(invoice.cliente_id)
    )
  );

DO $migration$
DECLARE
  v_definition text;
  v_invoice_branch text;
  v_next_branch integer;
BEGIN
  -- Make pg_get_viewdef's qualification stable across migration runners.
  PERFORM set_config('search_path', 'public, pg_temp', true);
  SELECT pg_get_viewdef('public.v_contas_receber'::regclass, true)
    INTO v_definition;
  v_next_branch := strpos(v_definition, E'\nUNION ALL\n');
  v_invoice_branch := left(v_definition, greatest(v_next_branch - 1, 0));

  -- Fail closed if the source view has been reorganized. Replacing just its
  -- first branch preserves the PDV, standalone Asaas and contract branches.
  IF v_next_branch = 0
     OR v_invoice_branch NOT LIKE '%FROM faturas f%'
     OR v_invoice_branch NOT LIKE '%LEFT JOIN asaas_charges fatura_charge%'
     OR v_invoice_branch NOT LIKE '%private.can_access_client(f.cliente_id)%'
     OR v_invoice_branch NOT LIKE '%f.tenant_id =%' THEN
    RAISE EXCEPTION 'v_contas_receber changed; review FAT-05 before applying';
  END IF;

  EXECUTE 'CREATE OR REPLACE VIEW public.v_contas_receber '
    || 'WITH (security_invoker = true) AS '
    || $invoice$
SELECT
  f.id,
  'fatura'::text AS origem,
  f.cliente_id,
  c.razao_social AS cliente_nome,
  COALESCE(f.numero_nf, 'Fatura ' || substr(f.id::text, 1, 8)) AS descricao,
  f.valor_total AS valor,
  settlement.valor_recebido,
  COALESCE(f.data_vencimento, fatura_charge.due_date, f.periodo_fim) AS data_vencimento,
  CASE WHEN settlement.valor_recebido > 0
    THEN CASE WHEN fatura_charge.status = 'RECEIVED'
      THEN COALESCE(fatura_charge.paid_at, f.updated_at)::date
      ELSE f.updated_at::date END
    ELSE NULL::date END AS data_recebimento,
  CASE
    WHEN f.status = 'cancelado' OR receipt.status_pagamento = 'cancelado' THEN 'cancelado'
    WHEN settlement.valor_recebido >= f.valor_total AND f.valor_total > 0 THEN 'recebido'
    WHEN settlement.valor_recebido > 0 THEN 'parcial'
    WHEN fatura_charge.status = 'OVERDUE' THEN 'atrasado'
    ELSE 'pendente'
  END::text AS status,
  f.categoria_id,
  f.centro_custo_id,
  f.created_at
FROM public.faturas f
LEFT JOIN public.clientes c
  ON c.id = f.cliente_id AND c.tenant_id = f.tenant_id
LEFT JOIN public.asaas_charges fatura_charge
  ON fatura_charge.id = f.asaas_charge_id
 AND fatura_charge.tenant_id = f.tenant_id
CROSS JOIN LATERAL (
  SELECT
    LEAST(
      GREATEST(COALESCE(NULLIF(to_jsonb(f)->>'valor_pago', '')::numeric, 0), 0),
      GREATEST(f.valor_total, 0)
    ) AS valor_pago,
    to_jsonb(f) ? 'valor_pago' AS has_valor_pago,
    to_jsonb(f)->>'status_pagamento' AS status_pagamento
) receipt
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN f.status = 'cancelado' OR receipt.status_pagamento = 'cancelado' THEN 0::numeric
    WHEN fatura_charge.status = 'RECEIVED' THEN GREATEST(f.valor_total, 0)
    WHEN f.asaas_charge_id IS NULL AND NOT receipt.has_valor_pago
      AND (f.status = 'pago' OR receipt.status_pagamento = 'pago')
      THEN GREATEST(f.valor_total, 0)
    ELSE receipt.valor_pago
  END AS valor_recebido
) settlement
WHERE f.tenant_id = (SELECT private.current_tenant_id())
  AND private.can_access_client(f.cliente_id)
$invoice$
    || substr(v_definition, v_next_branch);
END;
$migration$;

-- Preserve invoker RLS and expose only the read operation through the Data API.
ALTER VIEW public.v_contas_receber SET (security_invoker = true);
REVOKE ALL ON public.v_contas_receber FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_contas_receber TO authenticated;
