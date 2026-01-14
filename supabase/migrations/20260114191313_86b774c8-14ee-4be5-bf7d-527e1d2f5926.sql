-- Remover FKs duplicadas antigas (manter apenas as novas nomeadas)

-- Remover FK antiga de precos_especiais para clientes
ALTER TABLE precos_especiais
DROP CONSTRAINT IF EXISTS precos_especiais_cliente_id_fkey;

-- Remover FK antiga de precos_especiais para produtos
ALTER TABLE precos_especiais
DROP CONSTRAINT IF EXISTS precos_especiais_produto_id_fkey;

-- Remover FK antiga de agendamentos para clientes
ALTER TABLE agendamentos
DROP CONSTRAINT IF EXISTS agendamentos_cliente_id_fkey;

-- Remover FK antiga de agendamentos para motoristas
ALTER TABLE agendamentos
DROP CONSTRAINT IF EXISTS agendamentos_motorista_id_fkey;

-- Remover FK antiga de configuracoes_cliente
ALTER TABLE configuracoes_cliente
DROP CONSTRAINT IF EXISTS configuracoes_cliente_cliente_id_fkey;

-- Remover FK antiga de configuracoes_pagamento_cliente
ALTER TABLE configuracoes_pagamento_cliente
DROP CONSTRAINT IF EXISTS configuracoes_pagamento_cliente_cliente_id_fkey;

-- Remover FK antiga de enderecos_clientes
ALTER TABLE enderecos_clientes
DROP CONSTRAINT IF EXISTS enderecos_clientes_cliente_id_fkey;