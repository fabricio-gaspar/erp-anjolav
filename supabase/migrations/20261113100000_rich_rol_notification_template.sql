-- Keep the editable WhatsApp template aligned with the ROL receipt data.
-- Only the untouched legacy default is upgraded; custom tenant templates stay intact.
do $migration$
declare
  v_template text := $template$
*{empresa}*
{endereco_empresa}
Telefone: {telefone_empresa} · {email_empresa}
CNPJ: {cnpj_empresa}

*ROL DE ENTRADA Nº {numero}*
Entrada: {data_entrada}
Previsão: {previsao}
Atendente: {atendente}
Modalidade: {modalidade}
Bloco: {bloco}

*DADOS DO CLIENTE*
Nome: {cliente}
Cód. cliente: {cliente_codigo}
Endereço: {cliente_endereco}
Telefone: {cliente_telefone}

*PEÇAS*
{itens}

Total de peças: {total_pecas}
Valor bruto: {valor_bruto}
Desconto: {desconto}
Total do ROL: {valor}
Total recebido: {valor_recebido}
A pagar: {a_pagar}

Informações para produção: {observacoes}
Assinatura do cliente: ____________________

{rodape}$template$;
begin
  update public.notificacoes_config
     set template = v_template,
         variaveis = jsonb_build_array(
           'empresa', 'endereco_empresa', 'telefone_empresa', 'email_empresa', 'cnpj_empresa',
           'numero', 'data_entrada', 'previsao', 'atendente', 'modalidade', 'bloco',
           'cliente', 'cliente_codigo', 'cliente_endereco', 'cliente_telefone', 'itens',
           'total_pecas', 'valor_bruto', 'desconto', 'valor', 'valor_recebido', 'a_pagar',
           'observacoes', 'rodape'
         ),
         updated_at = now()
   where canal = 'whatsapp'
     and evento = 'rol_entrada'
     and template = $legacy$Olá, {cliente}! Recebemos seu ROL de entrada nº {numero}.

Peças lançadas:
{itens}

Total de peças: {total_pecas}
Valor do ROL: {valor}
Previsão: {previsao}
Modalidade: {modalidade}$legacy$;
end;
$migration$;
