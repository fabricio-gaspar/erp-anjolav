-- Clientes usam 'domestico'; permissões e parametrizações do PDV ainda usam
-- 'residencial'. Preserve estas configurações enquanto a migração de domínio
-- não for concluída, sem deixar a RPC de venda acessível diretamente.
DO $migration$
DECLARE
  definition text;
  old_fragment text;
  new_fragment text;
BEGIN
  definition := pg_get_functiondef('private.pdv_actor_allowed(uuid,uuid,text,text[])'::regprocedure);
  old_fragment := 'a.area IN (_area,''central'')';
  new_fragment := 'a.area IN (CASE WHEN _area = ''domestico'' THEN ''residencial'' ELSE _area END,''central'')';
  IF position(old_fragment IN definition) = 0 THEN
    RAISE EXCEPTION 'A definição de private.pdv_actor_allowed mudou; revise esta migração';
  END IF;
  EXECUTE replace(definition, old_fragment, new_fragment);

  definition := pg_get_functiondef('public.criar_venda_pdv_com_taxa(uuid,uuid,date,boolean,numeric,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text)'::regprocedure);
  old_fragment := 'v_cliente.classificacao NOT IN (''industrial'',''residencial'')';
  new_fragment := 'v_cliente.classificacao NOT IN (''industrial'',''domestico'',''residencial'')';
  IF position(old_fragment IN definition) = 0 THEN
    RAISE EXCEPTION 'A validação de cliente em criar_venda_pdv_com_taxa mudou; revise esta migração';
  END IF;
  definition := replace(definition, old_fragment, new_fragment);
  old_fragment := ',v_cliente.classificacao,_idempotency_key';
  new_fragment := ',CASE WHEN v_cliente.classificacao = ''domestico'' THEN ''residencial'' ELSE v_cliente.classificacao END,_idempotency_key';
  IF position(old_fragment IN definition) = 0 THEN
    RAISE EXCEPTION 'A origem do ROL em criar_venda_pdv_com_taxa mudou; revise esta migração';
  END IF;
  EXECUTE replace(definition, old_fragment, new_fragment);

  definition := pg_get_functiondef('public.criar_pedido_atendimento_v2(uuid,uuid,date,boolean,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text,date,text,text,text,jsonb,numeric,boolean)'::regprocedure);
  old_fragment := 'v_client.classificacao NOT IN (''industrial'',''residencial'')';
  new_fragment := 'v_client.classificacao NOT IN (''industrial'',''domestico'',''residencial'')';
  IF position(old_fragment IN definition) = 0 THEN
    RAISE EXCEPTION 'A validação de cliente em criar_pedido_atendimento_v2 mudou; revise esta migração';
  END IF;
  definition := replace(definition, old_fragment, new_fragment);
  old_fragment := 'area = v_client.classificacao';
  new_fragment := 'area = CASE WHEN v_client.classificacao = ''domestico'' THEN ''residencial'' ELSE v_client.classificacao END';
  IF position(old_fragment IN definition) = 0 THEN
    RAISE EXCEPTION 'A consulta de parâmetros do PDV mudou; revise esta migração';
  END IF;
  EXECUTE replace(definition, old_fragment, new_fragment);
END;
$migration$;

-- Apenas a Edge Function validada chama esta rotina, via service_role.
-- A função externa criar_pedido_atendimento_v2 já tem a mesma restrição.
REVOKE ALL ON FUNCTION public.criar_venda_pdv_com_taxa(uuid,uuid,date,boolean,numeric,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_venda_pdv_com_taxa(uuid,uuid,date,boolean,numeric,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text)
  TO service_role;

-- Os operadores autenticados continuam usando as rotinas de produção.
-- Nenhuma delas é um endpoint público sem sessão.
REVOKE EXECUTE ON FUNCTION public.processar_fila_producao(jsonb,text,text,uuid,text,text,date,text)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_qualidade_pedido(uuid,jsonb,uuid,text,date,text)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validar_tabela_item_rol()
  FROM PUBLIC, anon, authenticated;
