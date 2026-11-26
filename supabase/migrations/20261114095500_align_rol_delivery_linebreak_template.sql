-- The production delivery template used a line break between the sentence and
-- the forecast, so it was not covered by the earlier one-line legacy match.
-- Upgrade that exact untouched fallback without replacing tenant customizations.
do $migration$
declare
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
     and template = $legacy$Olá, {cliente}! Seu ROL nº {numero} está pronto para entrega.
Previsão: {previsao}$legacy$;
end;
$migration$;
