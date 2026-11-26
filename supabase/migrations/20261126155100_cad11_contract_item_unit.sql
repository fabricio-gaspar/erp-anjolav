-- Some installed schemas predate the contract item unit column. The CAD-11
-- command persists the product's unit with each measured contract item.
ALTER TABLE public.itens_contrato_aluguel
  ADD COLUMN IF NOT EXISTS unidade text;
