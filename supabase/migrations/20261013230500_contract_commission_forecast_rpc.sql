-- Migration proposal only: DO NOT apply until authorization/RLS integration tests pass.
-- Transactional persistence of a reviewed forecast. Admin only.
create or replace function public.persist_contract_commission_forecast(
  p_contract_id uuid,
  p_rule_id uuid,
  p_installments jsonb
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_financial_id uuid;
  v_status text;
  v_row jsonb;
  v_total numeric := 0;
  v_tax numeric := 0;
  v_net numeric := 0;
  v_split numeric := 0;
  v_count integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  select status::text into v_status from public.contracts
    where id = p_contract_id for update;
  if not found then raise exception 'Contrato inexistente'; end if;
  if v_status = 'cancelado' then raise exception 'Contrato cancelado'; end if;
  if not exists (select 1 from public.commission_rules where id = p_rule_id and ativo) then
    raise exception 'Regra de comissão indisponível';
  end if;
  if jsonb_typeof(p_installments) is distinct from 'array' then
    raise exception 'Parcelas inválidas';
  end if;
  v_count := jsonb_array_length(p_installments);
  if v_count < 1 or v_count > 1200 then raise exception 'Quantidade de parcelas inválida'; end if;
  if exists (select 1 from public.contract_financials where contract_id = p_contract_id) then
    raise exception 'Previsão já existente: operação não pode sobrescrever histórico financeiro';
  end if;
  for v_row in select value from jsonb_array_elements(p_installments) loop
    if (v_row->>'numero_parcela')::integer < 1
      or (v_row->>'valor_previsto')::numeric < 0
      or (v_row->>'imposto_retido')::numeric < 0
      or (v_row->>'valor_liquido')::numeric < 0
      or (v_row->>'repasse_previsto_vendedor')::numeric < 0 then
      raise exception 'Valores de parcela inválidos';
    end if;
    v_total := v_total + (v_row->>'valor_previsto')::numeric;
    v_tax := v_tax + (v_row->>'imposto_retido')::numeric;
    v_net := v_net + (v_row->>'valor_liquido')::numeric;
    v_split := v_split + (v_row->>'repasse_previsto_vendedor')::numeric;
  end loop;
  insert into public.contract_financials (
    contract_id, commission_rule_id, comissao_prevista, impostos_descontos,
    comissao_liquida, repasse_vendedor, comissao_snapshot
  ) values (
    p_contract_id, p_rule_id, v_total, v_tax, v_net, v_split,
    jsonb_build_object('rule_id',p_rule_id,'installments',p_installments)
  ) returning id into v_financial_id;
  insert into public.commission_installments (
    contract_id, contract_financial_id, numero_parcela, total_parcelas,
    data_vencimento, valor_previsto, repasse_previsto_vendedor,
    tipo_parcela, percentual_aplicado, valor_base_mensalidade,
    imposto_retido, valor_liquido, status
  )
  select p_contract_id, v_financial_id, (x->>'numero_parcela')::integer,
    v_count, (x->>'data_vencimento')::date,
    (x->>'valor_previsto')::numeric,
    (x->>'repasse_previsto_vendedor')::numeric,
    'inicial', (x->>'percentual_aplicado')::numeric,
    (x->>'valor_base_mensalidade')::numeric,
    (x->>'imposto_retido')::numeric, (x->>'valor_liquido')::numeric, 'previsto'
  from jsonb_array_elements(p_installments) as x;
  return v_financial_id;
end;
$$;
revoke all on function public.persist_contract_commission_forecast(uuid,uuid,jsonb) from public, anon;
grant execute on function public.persist_contract_commission_forecast(uuid,uuid,jsonb) to authenticated;
