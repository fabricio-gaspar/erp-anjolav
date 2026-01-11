
-- =============================================
-- FASE 1: CLIENTES E RELACIONADOS
-- =============================================

-- Tabela principal de clientes
CREATE TABLE public.clientes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo_pessoa TEXT NOT NULL DEFAULT 'cnpj' CHECK (tipo_pessoa IN ('cpf', 'cnpj')),
    classificacao TEXT NOT NULL DEFAULT 'industrial' CHECK (classificacao IN ('residencial', 'industrial')),
    cpf_cnpj TEXT,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    email TEXT,
    telefone TEXT,
    telefone2 TEXT,
    contato TEXT,
    inscricao_estadual TEXT,
    inscricao_municipal TEXT,
    regime_tributario TEXT DEFAULT 'simples_nacional',
    observacoes TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Endereços dos clientes
CREATE TABLE public.enderecos_clientes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    cep TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    uf TEXT,
    pais TEXT DEFAULT 'Brasil',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Configurações de pagamento do cliente
CREATE TABLE public.configuracoes_pagamento_cliente (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE UNIQUE,
    tipo_faturamento TEXT DEFAULT 'mensal',
    forma_pagamento TEXT DEFAULT 'boleto',
    dia_vencimento INTEGER DEFAULT 10,
    condicao_pagamento TEXT DEFAULT 'a_vista',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Configurações de acesso e agenda do cliente
CREATE TABLE public.configuracoes_cliente (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE UNIQUE,
    codigo_acesso TEXT,
    link_acesso TEXT,
    frequencia TEXT DEFAULT 'semanal',
    dias_retirada TEXT[] DEFAULT '{}',
    dias_entrega TEXT[] DEFAULT '{}',
    horario_retirada TIME,
    horario_entrega TIME,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- FASE 2: PRODUTOS E PREÇOS
-- =============================================

-- Tabela de produtos/serviços
CREATE TABLE public.produtos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco DECIMAL(10, 2) NOT NULL DEFAULT 0,
    unidade TEXT DEFAULT 'kg' CHECK (unidade IN ('kg', 'peca', 'metro', 'unidade')),
    unidade_negocio TEXT DEFAULT 'ambos' CHECK (unidade_negocio IN ('ID1', 'ID2', 'ambos')),
    categoria TEXT,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Preços especiais por cliente
CREATE TABLE public.precos_especiais (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    preco_especial DECIMAL(10, 2) NOT NULL,
    tipo TEXT DEFAULT 'normal' CHECK (tipo IN ('acrescido', 'desconto', 'normal')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(cliente_id, produto_id)
);

-- =============================================
-- FASE 3: ORDENS DE SERVIÇO
-- =============================================

-- Motoristas
CREATE TABLE public.motoristas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    cnh TEXT,
    cnh_validade DATE,
    telefone TEXT,
    email TEXT,
    funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Veículos
CREATE TABLE public.veiculos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    placa TEXT NOT NULL UNIQUE,
    modelo TEXT NOT NULL,
    tipo TEXT,
    cor TEXT,
    ano INTEGER,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ordens de Serviço
CREATE TABLE public.ordens_servico (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    numero TEXT NOT NULL UNIQUE,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
    motorista_id UUID REFERENCES public.motoristas(id) ON DELETE SET NULL,
    veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
    data_retirada DATE NOT NULL DEFAULT CURRENT_DATE,
    data_previsao_entrega DATE,
    data_entrega DATE,
    status TEXT NOT NULL DEFAULT 'retirada' CHECK (status IN ('retirada', 'lavagem', 'secagem', 'passadoria', 'embalagem', 'expedicao', 'entregue', 'cancelada')),
    prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Itens da Ordem de Serviço
CREATE TABLE public.itens_ordem_servico (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
    quantidade DECIMAL(10, 3) NOT NULL DEFAULT 1,
    preco_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- FASE 4: FINANCEIRO
-- =============================================

-- Contas a Pagar
CREATE TABLE public.contas_pagar (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    descricao TEXT NOT NULL,
    fornecedor TEXT,
    valor DECIMAL(10, 2) NOT NULL,
    vencimento DATE NOT NULL,
    data_pagamento DATE,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'vencido')),
    categoria TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Faturas (faturamento de clientes)
CREATE TABLE public.faturas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    valor_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'faturado', 'pago', 'cancelado')),
    numero_nf TEXT,
    asaas_charge_id UUID REFERENCES public.asaas_charges(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- FASE 5: CONFIGURAÇÕES DO SISTEMA
-- =============================================

-- Configurações Fiscais
CREATE TABLE public.configuracoes_fiscais (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    cnpj TEXT,
    razao_social TEXT,
    inscricao_municipal TEXT,
    inscricao_estadual TEXT,
    endereco JSONB DEFAULT '{}',
    aliquota_iss DECIMAL(5, 2) DEFAULT 5.00,
    codigo_servico TEXT,
    ambiente TEXT DEFAULT 'homologacao' CHECK (ambiente IN ('producao', 'homologacao')),
    ativo BOOLEAN NOT NULL DEFAULT false,
    certificado_url TEXT,
    validade_certificado DATE,
    urls_webservice JSONB DEFAULT '{}',
    series_numeracao JSONB DEFAULT '{}',
    csc_dados JSONB DEFAULT '{}',
    regime_tributario TEXT DEFAULT 'simples_nacional',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Descrições de serviços fiscais
CREATE TABLE public.descricoes_servicos_fiscais (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    descricao TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Configurações Gerais do Sistema
CREATE TABLE public.configuracoes_gerais (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome_empresa TEXT,
    cor_primaria TEXT DEFAULT '#3c62f6',
    logo_url TEXT,
    pix_tipo_chave TEXT,
    pix_chave TEXT,
    banco_nome TEXT,
    banco_agencia TEXT,
    banco_conta TEXT,
    banco_titular TEXT,
    template_pix TEXT,
    template_boleto TEXT,
    template_transferencia TEXT,
    whatsapp_numero TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- FASE 6: AGENDA
-- =============================================

-- Agendamentos
CREATE TABLE public.agendamentos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('retirada', 'entrega')),
    data DATE NOT NULL,
    horario TIME,
    frequencia TEXT DEFAULT 'unico',
    recorrente BOOLEAN DEFAULT false,
    motorista_id UUID REFERENCES public.motoristas(id) ON DELETE SET NULL,
    observacoes TEXT,
    status TEXT DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'realizado', 'cancelado')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- TRIGGERS PARA UPDATED_AT
-- =============================================

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_enderecos_clientes_updated_at BEFORE UPDATE ON public.enderecos_clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_configuracoes_pagamento_cliente_updated_at BEFORE UPDATE ON public.configuracoes_pagamento_cliente FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_configuracoes_cliente_updated_at BEFORE UPDATE ON public.configuracoes_cliente FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_precos_especiais_updated_at BEFORE UPDATE ON public.precos_especiais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_motoristas_updated_at BEFORE UPDATE ON public.motoristas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_veiculos_updated_at BEFORE UPDATE ON public.veiculos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ordens_servico_updated_at BEFORE UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contas_pagar_updated_at BEFORE UPDATE ON public.contas_pagar FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_faturas_updated_at BEFORE UPDATE ON public.faturas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_configuracoes_fiscais_updated_at BEFORE UPDATE ON public.configuracoes_fiscais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_configuracoes_gerais_updated_at BEFORE UPDATE ON public.configuracoes_gerais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agendamentos_updated_at BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_pagamento_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precos_especiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_ordem_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.descricoes_servicos_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_gerais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- Policies para clientes
CREATE POLICY "Allow all on clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

-- Policies para enderecos_clientes
CREATE POLICY "Allow all on enderecos_clientes" ON public.enderecos_clientes FOR ALL USING (true) WITH CHECK (true);

-- Policies para configuracoes_pagamento_cliente
CREATE POLICY "Allow all on configuracoes_pagamento_cliente" ON public.configuracoes_pagamento_cliente FOR ALL USING (true) WITH CHECK (true);

-- Policies para configuracoes_cliente
CREATE POLICY "Allow all on configuracoes_cliente" ON public.configuracoes_cliente FOR ALL USING (true) WITH CHECK (true);

-- Policies para produtos
CREATE POLICY "Allow all on produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);

-- Policies para precos_especiais
CREATE POLICY "Allow all on precos_especiais" ON public.precos_especiais FOR ALL USING (true) WITH CHECK (true);

-- Policies para motoristas
CREATE POLICY "Allow all on motoristas" ON public.motoristas FOR ALL USING (true) WITH CHECK (true);

-- Policies para veiculos
CREATE POLICY "Allow all on veiculos" ON public.veiculos FOR ALL USING (true) WITH CHECK (true);

-- Policies para ordens_servico
CREATE POLICY "Allow all on ordens_servico" ON public.ordens_servico FOR ALL USING (true) WITH CHECK (true);

-- Policies para itens_ordem_servico
CREATE POLICY "Allow all on itens_ordem_servico" ON public.itens_ordem_servico FOR ALL USING (true) WITH CHECK (true);

-- Policies para contas_pagar
CREATE POLICY "Allow all on contas_pagar" ON public.contas_pagar FOR ALL USING (true) WITH CHECK (true);

-- Policies para faturas
CREATE POLICY "Allow all on faturas" ON public.faturas FOR ALL USING (true) WITH CHECK (true);

-- Policies para configuracoes_fiscais
CREATE POLICY "Allow all on configuracoes_fiscais" ON public.configuracoes_fiscais FOR ALL USING (true) WITH CHECK (true);

-- Policies para descricoes_servicos_fiscais
CREATE POLICY "Allow all on descricoes_servicos_fiscais" ON public.descricoes_servicos_fiscais FOR ALL USING (true) WITH CHECK (true);

-- Policies para configuracoes_gerais
CREATE POLICY "Allow all on configuracoes_gerais" ON public.configuracoes_gerais FOR ALL USING (true) WITH CHECK (true);

-- Policies para agendamentos
CREATE POLICY "Allow all on agendamentos" ON public.agendamentos FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- FUNÇÃO PARA GERAR NÚMERO DA OS
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS TRIGGER AS $$
DECLARE
    next_number INTEGER;
    year_prefix TEXT;
BEGIN
    year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 6) AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.ordens_servico
    WHERE numero LIKE year_prefix || '-%';
    
    NEW.numero := year_prefix || '-' || LPAD(next_number::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER generate_os_number_trigger
BEFORE INSERT ON public.ordens_servico
FOR EACH ROW
WHEN (NEW.numero IS NULL OR NEW.numero = '')
EXECUTE FUNCTION public.generate_os_number();

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX idx_clientes_cpf_cnpj ON public.clientes(cpf_cnpj);
CREATE INDEX idx_clientes_razao_social ON public.clientes(razao_social);
CREATE INDEX idx_clientes_ativo ON public.clientes(ativo);
CREATE INDEX idx_enderecos_cliente_id ON public.enderecos_clientes(cliente_id);
CREATE INDEX idx_produtos_status ON public.produtos(status);
CREATE INDEX idx_produtos_categoria ON public.produtos(categoria);
CREATE INDEX idx_ordens_servico_cliente ON public.ordens_servico(cliente_id);
CREATE INDEX idx_ordens_servico_status ON public.ordens_servico(status);
CREATE INDEX idx_ordens_servico_data_retirada ON public.ordens_servico(data_retirada);
CREATE INDEX idx_itens_os_ordem ON public.itens_ordem_servico(ordem_servico_id);
CREATE INDEX idx_contas_pagar_vencimento ON public.contas_pagar(vencimento);
CREATE INDEX idx_contas_pagar_status ON public.contas_pagar(status);
CREATE INDEX idx_faturas_cliente ON public.faturas(cliente_id);
CREATE INDEX idx_faturas_status ON public.faturas(status);
CREATE INDEX idx_agendamentos_data ON public.agendamentos(data);
CREATE INDEX idx_agendamentos_cliente ON public.agendamentos(cliente_id);
