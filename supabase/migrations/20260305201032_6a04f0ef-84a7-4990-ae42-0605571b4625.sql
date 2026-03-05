
-- P3: Add FKs to lancamentos_cliente
ALTER TABLE public.lancamentos_cliente 
  ADD CONSTRAINT fk_lancamentos_cliente_cliente 
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE public.lancamentos_cliente 
  ADD CONSTRAINT fk_lancamentos_cliente_os 
  FOREIGN KEY (ordem_servico_id) REFERENCES public.ordens_servico(id) ON DELETE SET NULL;

-- P4: Add produto_id FK to itens_lancamento_cliente
ALTER TABLE public.itens_lancamento_cliente 
  ADD CONSTRAINT fk_itens_lancamento_cliente_produto 
  FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE RESTRICT;

-- Unique constraint on cpf_cnpj (partial - only non-null values)
CREATE UNIQUE INDEX idx_clientes_cpf_cnpj_unique 
  ON public.clientes (cpf_cnpj) 
  WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != '';

-- CHECK: prevent negative values
ALTER TABLE public.contas_pagar ADD CONSTRAINT chk_contas_pagar_valor_positivo CHECK (valor >= 0);
ALTER TABLE public.lancamentos ADD CONSTRAINT chk_lancamentos_valor_positivo CHECK (valor_total >= 0);
ALTER TABLE public.faturas ADD CONSTRAINT chk_faturas_valor_positivo CHECK (valor_total >= 0);
ALTER TABLE public.caixa_movimentacoes ADD CONSTRAINT chk_movimentacoes_valor_positivo CHECK (valor >= 0);
