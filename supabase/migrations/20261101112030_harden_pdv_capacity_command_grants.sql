-- These commands are exclusively caller-authorized administrative RPCs.
-- Service-role jobs may use the protected table directly when needed, but
-- must not impersonate an interactive administrator through this API.
REVOKE EXECUTE ON FUNCTION public.listar_capacidades_pdv() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.configurar_capacidade_pdv(text, date, numeric, boolean) FROM service_role;
