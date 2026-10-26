-- Client pricing mode and optional product/service size classification.
-- Existing price overrides are preserved and only select existing clients are
-- marked as personalized during the compatibility backfill.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tabela_preco_tipo text NOT NULL DEFAULT 'padrao';

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS porte text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clientes_tabela_preco_tipo_check'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_tabela_preco_tipo_check
      CHECK (tabela_preco_tipo IN ('padrao', 'personalizada'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'produtos_porte_check'
      AND conrelid = 'public.produtos'::regclass
  ) THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_porte_check
      CHECK (porte IS NULL OR porte IN ('pequeno', 'medio', 'grande'));
  END IF;
END;
$$;

UPDATE public.clientes AS cliente
SET tabela_preco_tipo = 'personalizada'
WHERE cliente.tabela_preco_tipo = 'padrao'
  AND EXISTS (
    SELECT 1
    FROM public.precos_especiais AS preco
    WHERE preco.cliente_id = cliente.id
      AND preco.tenant_id = cliente.tenant_id
  );
