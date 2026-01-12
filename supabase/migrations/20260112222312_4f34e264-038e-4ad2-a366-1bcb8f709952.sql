-- Remover a constraint existente
ALTER TABLE ordens_servico 
DROP CONSTRAINT IF EXISTS ordens_servico_status_check;

-- Adicionar a nova constraint incluindo "separacao"
ALTER TABLE ordens_servico 
ADD CONSTRAINT ordens_servico_status_check 
CHECK (status = ANY (ARRAY[
  'retirada'::text, 
  'separacao'::text,
  'lavagem'::text, 
  'secagem'::text, 
  'passadoria'::text, 
  'embalagem'::text, 
  'expedicao'::text, 
  'entregue'::text, 
  'cancelada'::text
]));