-- Adicionar Foreign Keys para integridade referencial

-- FK: configuracoes_cliente -> clientes
ALTER TABLE configuracoes_cliente
ADD CONSTRAINT fk_configuracoes_cliente_cliente
FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

-- FK: agendamentos -> clientes
ALTER TABLE agendamentos
ADD CONSTRAINT fk_agendamentos_cliente
FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

-- FK: agendamentos -> motoristas
ALTER TABLE agendamentos
ADD CONSTRAINT fk_agendamentos_motorista
FOREIGN KEY (motorista_id) REFERENCES motoristas(id) ON DELETE SET NULL;

-- FK: configuracoes_pagamento_cliente -> clientes
ALTER TABLE configuracoes_pagamento_cliente
ADD CONSTRAINT fk_configuracoes_pagamento_cliente
FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

-- FK: enderecos_clientes -> clientes
ALTER TABLE enderecos_clientes
ADD CONSTRAINT fk_enderecos_clientes
FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

-- FK: precos_especiais -> clientes e produtos
ALTER TABLE precos_especiais
ADD CONSTRAINT fk_precos_especiais_cliente
FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

ALTER TABLE precos_especiais
ADD CONSTRAINT fk_precos_especiais_produto
FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE;