-- The ERP uses these reporting views through authenticated REST requests.
-- They must never be enumerable by an unauthenticated GraphQL/Data API caller.
REVOKE SELECT ON public.v_contas_receber FROM anon;
REVOKE SELECT ON public.v_fluxo_caixa FROM anon;
