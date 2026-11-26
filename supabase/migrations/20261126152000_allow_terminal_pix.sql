-- PIX paid on the external terminal is confirmed by the operator. It does
-- not create an Asaas charge or an online payment identifier.
ALTER TABLE public.pdv_pagamentos
  DROP CONSTRAINT IF EXISTS pdv_pagamentos_pix_check;
ALTER TABLE public.pdv_pagamentos
  ADD CONSTRAINT pdv_pagamentos_pix_check CHECK (
    metodo <> 'PIX'
    OR provedor = 'LEGACY'
    OR (provedor = 'ASAAS' AND asaas_charge_id IS NOT NULL
        AND provedor_pagamento_id IS NOT NULL)
    OR (provedor = 'TERMINAL_EXTERNO' AND status = 'CONFIRMADO'
        AND asaas_charge_id IS NULL AND provedor_pagamento_id IS NULL)
  );
