-- Criar tabela de rotas de entrega
CREATE TABLE public.rotas_entrega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  motorista_id UUID REFERENCES public.motoristas(id),
  veiculo_id UUID REFERENCES public.veiculos(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  km_inicial NUMERIC,
  km_final NUMERIC,
  hora_saida TIMESTAMPTZ,
  hora_retorno TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar tabela de paradas da rota
CREATE TABLE public.paradas_rota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID NOT NULL REFERENCES public.rotas_entrega(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  ordem_servico_id UUID REFERENCES public.ordens_servico(id),
  agendamento_id UUID REFERENCES public.agendamentos(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  hora_chegada TIMESTAMPTZ,
  hora_saida TIMESTAMPTZ,
  assinatura_url TEXT,
  foto_comprovante_url TEXT,
  observacoes TEXT,
  motivo_nao_entrega TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.rotas_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paradas_rota ENABLE ROW LEVEL SECURITY;

-- Políticas para rotas_entrega
CREATE POLICY "Allow all on rotas_entrega" ON public.rotas_entrega
  FOR ALL USING (true) WITH CHECK (true);

-- Políticas para paradas_rota
CREATE POLICY "Allow all on paradas_rota" ON public.paradas_rota
  FOR ALL USING (true) WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_rotas_entrega_data ON public.rotas_entrega(data);
CREATE INDEX idx_rotas_entrega_motorista ON public.rotas_entrega(motorista_id);
CREATE INDEX idx_rotas_entrega_status ON public.rotas_entrega(status);
CREATE INDEX idx_paradas_rota_rota ON public.paradas_rota(rota_id);
CREATE INDEX idx_paradas_rota_os ON public.paradas_rota(ordem_servico_id);

-- Trigger para updated_at
CREATE TRIGGER update_rotas_entrega_updated_at
  BEFORE UPDATE ON public.rotas_entrega
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();