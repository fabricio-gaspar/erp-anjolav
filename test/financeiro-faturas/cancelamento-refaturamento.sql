\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
SELECT set_config('test.tenant','11111111-1111-4111-8111-111111111111',false),set_config('test.user','22222222-2222-4222-8222-222222222222',false),set_config('test.access','yes',false),set_config('test.area','industrial',false);

SELECT set_config('test.access','no',false);
SET ROLE authenticated;
DO $$ DECLARE id uuid; rejected boolean:=false; BEGIN
 SELECT f.id INTO id FROM public.faturas f WHERE f.cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 BEGIN PERFORM public.cancelar_fatura_sem_documentos(id,'Correção de conferência'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cancelamento sem permissão foi aceito'; END IF;
END $$;
RESET ROLE;
SELECT set_config('test.access','yes',false),set_config('test.area','residencial',false);
SET ROLE authenticated;
DO $$ DECLARE id uuid; rejected boolean:=false; BEGIN
 SELECT f.id INTO id FROM public.faturas f WHERE f.cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 BEGIN PERFORM public.cancelar_fatura_sem_documentos(id,'Correção de conferência'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cancelamento por outra operação foi aceito'; END IF;
END $$;
RESET ROLE;
SELECT set_config('test.area','industrial',false);

-- Recusa o cancelamento quando existe saldo já recebido.
UPDATE public.faturas SET valor_recebido=10 WHERE cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$ DECLARE id uuid; rejected boolean:=false; BEGIN
 SELECT f.id INTO id FROM public.faturas f WHERE f.cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 BEGIN PERFORM public.cancelar_fatura_sem_documentos(id,'Correção de conferência'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Pagamento parcial não impediu cancelamento'; END IF;
END $$;
RESET ROLE;
UPDATE public.faturas SET valor_recebido=0,cobranca_reservada_em=now() WHERE cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$ DECLARE id uuid; rejected boolean:=false; BEGIN
 SELECT f.id INTO id FROM public.faturas f WHERE f.cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 BEGIN PERFORM public.cancelar_fatura_sem_documentos(id,'Correção de conferência'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cobrança reservada não impediu cancelamento'; END IF;
END $$;
RESET ROLE;
UPDATE public.faturas SET cobranca_reservada_em=NULL,nfse_status='autorizada' WHERE cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$ DECLARE id uuid; rejected boolean:=false; BEGIN
 SELECT f.id INTO id FROM public.faturas f WHERE f.cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 BEGIN PERFORM public.cancelar_fatura_sem_documentos(id,'Correção de conferência'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Nota autorizada não impediu cancelamento'; END IF;
END $$;
RESET ROLE;
UPDATE public.faturas SET nfse_status='nao_preparada' WHERE cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$ DECLARE id uuid; result jsonb; BEGIN
 SELECT f.id INTO id FROM public.faturas f WHERE f.cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 result:=public.cancelar_fatura_sem_documentos(id,'Correção de conferência');
 IF (result->>'rols_liberados')::integer <> 1 THEN RAISE EXCEPTION 'ROL não liberado'; END IF;
 result:=public.cancelar_fatura_sem_documentos(id,'Correção de conferência');
 IF (result->>'idempotente')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'Repetição não foi idempotente'; END IF;
 IF (public.consultar_recebimentos_fatura(id)->'rols'->0->>'numero') <> 'TESTE-1' THEN RAISE EXCEPTION 'Histórico de ROL perdido'; END IF;
 result:=public.consultar_faturas_faturamento_filtradas('industrial',current_date,current_date,1,25,'Cliente fictício','cancelado');
 IF (result->>'total')::integer <> 1 THEN RAISE EXCEPTION 'Fatura cancelada não aparece no filtro industrial'; END IF;
END $$;
SELECT public.fechar_faturamento_rols('industrial','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_date,current_date,ARRAY['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid],'test-refaturar-0001',null);
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.lancamentos_fatura WHERE lancamento_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 2 THEN RAISE EXCEPTION 'Rastreabilidade do refaturamento foi perdida'; END IF;
 IF (SELECT status FROM public.ordens_servico WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 'entregue' THEN RAISE EXCEPTION 'A entrega foi modificada'; END IF;
 IF (SELECT count(*) FROM public.faturas WHERE cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND status='relatorio_gerado') <> 1 THEN RAISE EXCEPTION 'Nova fatura não foi criada'; END IF;
END $$;
