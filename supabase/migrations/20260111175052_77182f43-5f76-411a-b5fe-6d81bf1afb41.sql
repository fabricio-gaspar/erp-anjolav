-- Adicionar coluna tipo_relatorio na tabela configuracoes_cliente
ALTER TABLE configuracoes_cliente 
ADD COLUMN tipo_relatorio TEXT DEFAULT 'detalhado';

COMMENT ON COLUMN configuracoes_cliente.tipo_relatorio IS 'Tipo de relatório: detalhado, mapa_pecas, mapa_mensal';