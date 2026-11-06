-- Existing PDV profiles created by the first invitation flow received only the
-- caixa module. Upgrade that exact legacy shape without touching customized
-- employees, administrators, Central access, or the user's assigned sector.
WITH legacy_pdv_employees AS (
  SELECT employee.id, employee.tenant_id
  FROM public.funcionarios AS employee
  JOIN public.area_permissoes AS area_permission
    ON area_permission.tenant_id = employee.tenant_id
   AND area_permission.user_id = employee.user_id
  WHERE employee.user_id IS NOT NULL
    AND employee.ativo = true
    AND area_permission.area IN ('industrial', 'residencial')
    AND EXISTS (
      SELECT 1
      FROM public.modulo_permissoes AS cash_permission
      WHERE cash_permission.tenant_id = employee.tenant_id
        AND cash_permission.funcionario_id = employee.id
        AND cash_permission.modulo_key = 'caixa'
        AND cash_permission.tem_acesso = true
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.modulo_permissoes AS customized_permission
      WHERE customized_permission.tenant_id = employee.tenant_id
        AND customized_permission.funcionario_id = employee.id
        AND customized_permission.modulo_key <> 'caixa'
    )
  GROUP BY employee.id, employee.tenant_id
  HAVING count(DISTINCT area_permission.area) = 1
)
INSERT INTO public.modulo_permissoes (
  tenant_id,
  funcionario_id,
  modulo_key,
  tem_acesso
)
SELECT
  employee.tenant_id,
  employee.id,
  module.module_key,
  true
FROM legacy_pdv_employees AS employee
CROSS JOIN (
  VALUES
    ('clientes'),
    ('produtos'),
    ('ordens'),
    ('agenda'),
    ('producao'),
    ('faturamento'),
    ('relatorios')
) AS module(module_key)
ON CONFLICT (funcionario_id, modulo_key) DO NOTHING;
