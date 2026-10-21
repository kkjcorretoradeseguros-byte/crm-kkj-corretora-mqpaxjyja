-- Scoped permission for the two existing commission RPCs.
-- No access is granted to edit commission rules or mark seller repasses paid.
-- Fail closed if the audited function signatures/guards have changed.
DO $$
DECLARE
  v_fn text;
  v_guard text := 'if auth.uid() is null or not public.is_admin() then';
  v_scoped text := 'if auth.uid() is null or (not public.is_admin() and not (auth.uid() = ''75c3d247-8a9c-40c8-acb7-186f8d2af63e''::uuid and exists (select 1 from public.contracts c where c.id = p_contract_id and c.responsavel_id = auth.uid() and c.data_confirmacao_pagamento is not null and c.status::text <> ''cancelado''))) then';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_fn FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='persist_contract_commission_forecast'
  AND pg_get_function_identity_arguments(p.oid)='p_contract_id uuid, p_rule_id uuid, p_lead_origin text, p_installments jsonb';
  IF v_fn IS NULL OR position(v_guard IN lower(v_fn))=0 THEN
    RAISE EXCEPTION 'Forecast RPC differs from audited version; migration aborted';
  END IF;
  v_fn := replace(v_fn,v_guard,v_scoped);
  -- A seller cannot select an arbitrary commission competence to manufacture a receipt.
  v_fn := replace(v_fn,
    'if v_first_due is null then raise exception ''Primeira parcela obrigatória''; end if;',
    'if v_first_due is null then raise exception ''Primeira parcela obrigatória''; end if;
     if not public.is_admin() and v_first_due is distinct from
       (select data_confirmacao_pagamento from public.contracts where id=p_contract_id) then
       raise exception ''Primeiro vencimento deve coincidir com o pagamento confirmado'';
     end if;');
  EXECUTE v_fn;

  SELECT pg_get_functiondef(p.oid) INTO v_fn FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='confirm_first_commission_receipt'
  AND pg_get_function_identity_arguments(p.oid)='p_contract_id uuid';
  IF v_fn IS NULL OR position(v_guard IN lower(v_fn))=0 THEN
    RAISE EXCEPTION 'Receipt RPC differs from audited version; migration aborted';
  END IF;
  v_fn := replace(v_fn,v_guard,v_scoped);
  -- Use actual confirmed payment date, not a potentially empty legacy column.
  v_fn := replace(v_fn,'select data_pagamento into v_date',
    'select coalesce(data_confirmacao_pagamento,data_pagamento) into v_date');
  EXECUTE v_fn;
END $$;
