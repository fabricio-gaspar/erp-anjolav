-- Check membership only when a new order item is attached or its product changes.
-- Existing order items retain their historical price and table snapshot.
CREATE OR REPLACE FUNCTION public.validar_tabela_item_rol()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tenant_id uuid;
  v_table text;
  v_product_tenant uuid;
  v_tables text[];
BEGIN
  SELECT tenant_id, coalesce(nullif(tabela_preco_tipo_snapshot, ''), 'padrao')
    INTO v_tenant_id, v_table
    FROM public.ordens_servico
   WHERE id = NEW.ordem_servico_id;

  SELECT tenant_id, tabelas_preco
    INTO v_product_tenant, v_tables
    FROM public.produtos
   WHERE id = NEW.produto_id;

  IF v_tenant_id IS NULL OR v_product_tenant IS NULL OR v_tenant_id <> v_product_tenant
     OR NOT (v_table = ANY(coalesce(v_tables, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'Produto não vinculado à tabela de preços deste ROL' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validar_tabela_item_rol ON public.itens_ordem_servico;
CREATE TRIGGER validar_tabela_item_rol
BEFORE INSERT OR UPDATE OF produto_id, ordem_servico_id ON public.itens_ordem_servico
FOR EACH ROW EXECUTE FUNCTION public.validar_tabela_item_rol();
