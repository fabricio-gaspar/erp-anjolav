-- Create table for Payroll Closing History (Snapshot)
CREATE TABLE public.folha_pagamento_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE CASCADE NOT NULL,
    mes_referencia DATE NOT NULL,
    salario_base DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_beneficios DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_descontos DECIMAL(12,2) NOT NULL DEFAULT 0,
    valor_liquido DECIMAL(12,2) NOT NULL DEFAULT 0,
    detalhes_beneficios JSONB DEFAULT '[]'::jsonb, -- Snapshot of benefits at the time
    status_pagamento TEXT DEFAULT 'pendente',
    data_fechamento TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    fechado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(funcionario_id, mes_referencia)
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folha_pagamento_historico TO authenticated;
GRANT ALL ON public.folha_pagamento_historico TO service_role;

-- Enable RLS
ALTER TABLE public.folha_pagamento_historico ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage payroll history"
ON public.folha_pagamento_historico
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own payroll history"
ON public.folha_pagamento_historico
FOR SELECT
TO authenticated
USING (auth.uid() = (SELECT user_id FROM public.funcionarios WHERE id = funcionario_id));
