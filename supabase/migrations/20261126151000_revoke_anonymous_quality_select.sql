-- Quality movement history is available only to authenticated users under
-- its tenant RLS policy. Remove the redundant anonymous table grant.
REVOKE SELECT ON TABLE public.qualidade_movimentos FROM anon;
