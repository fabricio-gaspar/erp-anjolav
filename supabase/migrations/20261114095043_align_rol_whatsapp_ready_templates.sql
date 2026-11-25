-- Align the real WhatsApp notifications with the receipt data already shown in
-- the ROL print preview. Only known short legacy defaults are replaced; any
-- template customized by a tenant remains untouched.
do $migration$
declare
  v_retirada text := $retirada$
*{empresa}*
{endereco_empresa}
Telefone: {telefone_empresa} · {email_empresa}
CNPJ: {cnpj_empresa}

*ROL DISPONÍVEL PARA RETIRADA Nº {numero}*
Disponível em: {data_disponibilidade}
Previsão original: {previsao}
Atendente: {atendente}

*DADOS DO CLIENTE*
Nome: {cliente}
Cód. cliente: {cliente_codigo}
Endereço: {cliente_endereco}
Telefone: {cliente_telefone}

*PEÇAS DISPONÍVEIS*
{itens}

Total de peças: {total_pecas}
Localização: {localizacao}
Valor do ROL: {valor}
Total recebido: {valor_recebido}
A pagar: {a_pagar}

Apresente este ROL no balcão para retirada.

{rodape}$retirada$;
  v_delivery text := $delivery$
*{empresa}*
{endereco_empresa}
Telefone: {telefone_empresa} · {email_empresa}
CNPJ: {cnpj_empresa}

*ROL PRONTO PARA DELIVERY Nº {numero}*
Disponível em: {data_disponibilidade}
Previsão: {previsao}
Atendente: {atendente}

*DADOS DO CLIENTE*
Nome: {cliente}
Cód. cliente: {cliente_codigo}
Endereço: {cliente_endereco}
Telefone: {cliente_telefone}

*PEÇAS PRONTAS*
{itens}

Total de peças: {total_pecas}
Localização: {localizacao}
Valor do ROL: {valor}
Total recebido: {valor_recebido}
A pagar: {a_pagar}

O ROL foi encaminhado para Agenda, coletas e rotas.

{rodape}$delivery$;
begin
  update public.notificacoes_config
     set template = v_retirada,
         variaveis = jsonb_build_array(
           'empresa', 'endereco_empresa', 'telefone_empresa', 'email_empresa', 'cnpj_empresa',
           'numero', 'data_disponibilidade', 'previsao', 'atendente',
           'cliente', 'cliente_codigo', 'cliente_endereco', 'cliente_telefone', 'itens',
           'total_pecas', 'localizacao', 'valor', 'valor_recebido', 'a_pagar', 'rodape'
         ),
         updated_at = now()
   where canal = 'whatsapp'
     and evento = 'rol_pronto_retirada'
     and template in (
       'Olá, {cliente}! Seu ROL nº {numero} está pronto e disponível para retirada. Total: {total_pecas} peça(s).',
       'Olá, {cliente}! Seu ROL nº {numero} está pronto e disponível para retirada na loja. Total: {total_pecas} peça(s).'
     );

  update public.notificacoes_config
     set template = v_delivery,
         variaveis = jsonb_build_array(
           'empresa', 'endereco_empresa', 'telefone_empresa', 'email_empresa', 'cnpj_empresa',
           'numero', 'data_disponibilidade', 'previsao', 'atendente',
           'cliente', 'cliente_codigo', 'cliente_endereco', 'cliente_telefone', 'itens',
           'total_pecas', 'localizacao', 'valor', 'valor_recebido', 'a_pagar', 'rodape'
         ),
         updated_at = now()
   where canal = 'whatsapp'
     and evento = 'rol_pronto_delivery'
     and template in (
       'Olá, {cliente}! Seu ROL nº {numero} está pronto para entrega. Previsão: {previsao}',
       'Olá, {cliente}! Seu ROL nº {numero} está pronto. Ele foi encaminhado para Entregas e Coletas e seguirá por delivery para o endereço combinado. Previsão: {previsao}.'
     );
end;
$migration$;
