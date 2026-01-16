-- Adicionar campos para integração NFS-e na tabela configuracoes_fiscais
ALTER TABLE configuracoes_fiscais 
ADD COLUMN IF NOT EXISTS codigo_municipio_ibge TEXT,
ADD COLUMN IF NOT EXISTS url_api_nfse TEXT,
ADD COLUMN IF NOT EXISTS senha_certificado_encrypted TEXT,
ADD COLUMN IF NOT EXISTS modo_emissao TEXT DEFAULT 'simulacao';

-- Adicionar campos para controle de emissão real na tabela faturas
ALTER TABLE faturas
ADD COLUMN IF NOT EXISTS protocolo_nfse TEXT,
ADD COLUMN IF NOT EXISTS xml_nfse TEXT,
ADD COLUMN IF NOT EXISTS status_sefaz TEXT DEFAULT 'nao_enviada',
ADD COLUMN IF NOT EXISTS erros_sefaz JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS natureza_operacao TEXT DEFAULT 'tributacao_municipio';

-- Comentários para documentação
COMMENT ON COLUMN configuracoes_fiscais.codigo_municipio_ibge IS 'Código IBGE do município (7 dígitos)';
COMMENT ON COLUMN configuracoes_fiscais.url_api_nfse IS 'URL base da API NFS-e da prefeitura';
COMMENT ON COLUMN configuracoes_fiscais.senha_certificado_encrypted IS 'Senha do certificado digital criptografada';
COMMENT ON COLUMN configuracoes_fiscais.modo_emissao IS 'Modo de emissão: simulacao, homologacao, producao';
COMMENT ON COLUMN faturas.protocolo_nfse IS 'Protocolo de envio retornado pela prefeitura';
COMMENT ON COLUMN faturas.xml_nfse IS 'XML da DPS/NFS-e assinado';
COMMENT ON COLUMN faturas.status_sefaz IS 'Status na prefeitura: nao_enviada, processando, autorizada, rejeitada, cancelada';
COMMENT ON COLUMN faturas.erros_sefaz IS 'Array de erros retornados pela prefeitura';
COMMENT ON COLUMN faturas.natureza_operacao IS 'Natureza da tributação do serviço';