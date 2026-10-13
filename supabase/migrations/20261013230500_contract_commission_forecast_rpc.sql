-- Migration proposal only: DO NOT apply until authorization/RLS integration tests pass.
-- Transactional persistence of a reviewed forecast. Admin only.
create or replace function public.persist_contract_commission_forecast(
  p_contract_id uuid,
  p_rule_id uuid,
  p_lead_origin text,
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
  v_unique_count integer;
  v_rule_carrier uuid;
  v_contract_carrier uuid;
  v_rule_tax numeric;
  v_rule_schedule jsonb;
  v_month integer;
  v_pct numeric;
  v_premium numeric;
  v_contract_premium numeric;
  v_schedule_count integer;
  v_rule_start date;
  v_rule_end date;
  v_split_rate numeric;
begin
  if p_lead_origin not in ('kkj','vendedor') or p_lead_origin is null then
    raise exception 'Origem do lead inválida';
  end if;
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  select status::text, carrier_id, valor_mensal into v_status, v_contract_carrier, v_contract_premium from public.contracts
    where id = p_contract_id for update;
  if not found then raise exception 'Contrato inexistente'; end if;
  if v_status = 'cancelado' then raise exception 'Contrato cancelado'; end if;
  select carrier_id, aliquota_imposto_pct, cronograma_parcelas,
    data_inicio_vigencia, data_fim_vigencia,
    case when p_lead_origin = 'vendedor' then repasse_vendedor_proprio_pct else repasse_vendedor_pct end
    into v_rule_carrier, v_rule_tax, v_rule_schedule, v_rule_start, v_rule_end, v_split_rate
    from public.commission_rules where id = p_rule_id and ativo;
  if not found or v_rule_carrier is distinct from v_contract_carrier then
    raise exception 'Regra de comissão incompatível com contrato';
  end if;
  if (v_rule_start is not null and current_date < v_rule_start)
     or (v_rule_end is not null and current_date > v_rule_end) then
    raise exception 'Regra fora da vigência';
  end if;
  if jsonb_typeof(p_installments) is distinct from 'array' then
    raise exception 'Parcelas inválidas';
  end if;
  v_count := jsonb_array_length(p_installments);
  if v_count < 1 or v_count > 1200 then raise exception 'Quantidade de parcelas inválida'; end if;
  if jsonb_typeof(v_rule_schedule) is distinct from 'array' then raise exception 'Cronograma inválido'; end if;
  v_schedule_count := jsonb_array_length(v_rule_schedule);
  if v_count <> v_schedule_count then raise exception 'Cronograma incompleto'; end if;
  select count(distinct (x->>'numero_parcela')::integer) into v_unique_count
    from jsonb_array_elements(p_installments) x;
  if v_unique_count <> v_count then raise exception 'Parcelas duplicadas'; end if;
  if exists (select 1 from jsonb_array_elements(p_installments) x
    where (x->>'numero_parcela')::integer not in
      (select (y->>'month')::integer from jsonb_array_elements(v_rule_schedule) y)) then
    raise exception 'Mês de comissão não previsto';
  end if;
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
    v_month := (v_row->>'numero_parcela')::integer;
    select (schedule->>'pct')::numeric into v_pct
      from jsonb_array_elements(v_rule_schedule) schedule
      where (schedule->>'month')::integer = v_month;
    if v_pct is null then raise exception 'Parcela não prevista na regra'; end if;
    v_premium := (v_row->>'valor_base_mensalidade')::numeric;
    if v_premium <= 0 or v_premium is distinct from v_contract_premium
       or (v_row->>'percentual_aplicado')::numeric <> v_pct
       or (v_row->>'valor_previsto')::numeric <> round(v_premium * v_pct / 100, 2) then
      raise exception 'Valor ou percentual de comissão divergente';
    end if;
    if round((v_row->>'valor_previsto')::numeric - (v_row->>'imposto_retido')::numeric, 2)
       <> (v_row->>'valor_liquido')::numeric then
      raise exception 'Imposto ou valor líquido inconsistente';
    end if;
    if (v_row->>'imposto_retido')::numeric <> round((v_row->>'valor_previsto')::numeric * v_rule_tax / 100, 2) then
      raise exception 'Alíquota de imposto divergente';
    end if;
    if v_split_rate is null or v_split_rate < 0 or v_split_rate > 100
       or (v_row->>'repasse_previsto_vendedor')::numeric <>
          case when v_month = 1 then round((v_row->>'valor_liquido')::numeric * v_split_rate / 100, 2) else 0 end then
      raise exception 'Repasse ao vendedor divergente';
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
revoke all on function public.persist_contract_commission_forecast(uuid,uuid,text,jsonb) from public, anon;
grant execute on function public.persist_contract_commission_forecast(uuid,uuid,jsonb) to authenticated;
