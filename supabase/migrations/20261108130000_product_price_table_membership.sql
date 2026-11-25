-- Padrão is the base catalog; Cesto uses its base price and Personalizada
-- may replace it per customer. Existing products keep their current reach.
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS tabelas_preco text[] NOT NULL DEFAULT ARRAY['padrao']::text[];

UPDATE public.produtos
   SET tabelas_preco = ARRAY['padrao', 'cesto', 'personalizada']::text[]
 WHERE tabelas_preco = ARRAY['padrao']::text[];

ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_tabelas_preco_validas
  CHECK (
    tabelas_preco @> ARRAY['padrao']::text[]
    AND tabelas_preco <@ ARRAY['padrao', 'cesto', 'personalizada']::text[]
  );
