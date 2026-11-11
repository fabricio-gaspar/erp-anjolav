-- Keep a manual ready notification factual for both pickup and delivery.
-- Preserve any template already customized by the tenant.
update public.notificacoes_config
set template = 'Olá {cliente}! Seu ROL nº {numero} está pronto. Valor: {valor}. Consulte a equipe para combinar retirada ou entrega.'
where canal = 'whatsapp'
  and evento = 'os_pronto'
  and template = 'Olá {cliente}! Sua ROL #{numero} está pronta para entrega! Total: R$ {valor}';
