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
  v_rule_product uuid;
  v_contract_product uuid;
  v_rule_start date;
  v_rule_end date;
  v_required_field text;
  v_recurring boolean;
  v_min_lives integer;
  v_max_lives integer;
  v_contract_lives integer;
  v_split_rate numeric;
  v_schedule_distinct integer;
  v_due_date date;
  v_first_due date;
  v_expected_due date;
begin
  if p_lead_origin not in ('kkj','vendedor') or p_lead_origin is null then
    raise exception 'Origem do lead inválida';
  end if;
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  select status::text, carrier_id, valor_mensal, product_id, qtd_vidas
    into v_status, v_contract_carrier, v_contract_premium, v_contract_product, v_contract_lives from public.contracts
    where id = p_contract_id for update;
  if not found then raise exception 'Contrato inexistente'; end if;
  if v_status = 'cancelado' then raise exception 'Contrato cancelado'; end if;
  select carrier_id, aliquota_imposto_pct, cronograma_parcelas,
    data_inicio_vigencia, data_fim_vigencia, product_id, has_recurring, min_lives, max_lives,
    case when p_lead_origin = 'vendedor' then repasse_vendedor_proprio_pct else repasse_vendedor_pct end
    into v_rule_carrier, v_rule_tax, v_rule_schedule, v_rule_start, v_rule_end,
      v_rule_product, v_recurring, v_min_lives, v_max_lives, v_split_rate
    from public.commission_rules where id = p_rule_id and ativo;
  if not found or v_rule_carrier is distinct from v_contract_carrier then
    raise exception 'Regra de comissão incompatível com contrato';
  end if;
  if coalesce(v_recurring, false) then
    raise exception 'Comissão recorrente ainda não suportada nesta operação';
  end if;
  if (v_min_lives is not null and (v_contract_lives is null or v_contract_lives < v_min_lives))
    or (v_max_lives is not null and (v_contract_lives is null or v_contract_lives > v_max_lives)) then
    raise exception 'Número de vidas fora da regra';
  end if;
  if v_rule_product is not null and v_rule_product is distinct from v_contract_product then
    raise exception 'Produto incompatível com a regra de comissão';
  end if;
  if (v_rule_start is not null and current_date < v_rule_start)
     or (v_rule_end is not null and current_date > v_rule_end) then
    raise exception 'Regra fora da vigência';
  end if;
  if v_rule_tax is null or v_rule_tax < 0 or v_rule_tax > 100 then
    raise exception 'Alíquota da regra inválida';
  end if;
  if v_contract_premium is null or v_contract_premium <= 0 then
    raise exception 'Mensalidade do contrato inválida';
  end if;
  if jsonb_typeof(p_installments) is distinct from 'array' then
    raise exception 'Parcelas inválidas';
  end if;
  v_count := jsonb_array_length(p_installments);
  if v_count < 1 or v_count > 1200 then raise exception 'Quantidade de parcelas inválida'; end if;
  if exists (select 1 from jsonb_array_elements(p_installments) x
    where jsonb_typeof(x) is distinct from 'object'
      or jsonb_typeof(x->'numero_parcela') is distinct from 'number') then
    raise exception 'Estrutura de parcela inválida';
  end if;
  if jsonb_typeof(v_rule_schedule) is distinct from 'array' then raise exception 'Cronograma inválido'; end if;
  v_schedule_count := jsonb_array_length(v_rule_schedule);
  if v_count <> v_schedule_count then raise exception 'Cronograma incompleto'; end if;
  if exists (select 1 from jsonb_array_elements(v_rule_schedule) x
    where jsonb_typeof(x) is distinct from 'object'
      or (x->>'month') is null or (x->>'pct') is null
      or (x->>'month')::integer < 1 or (x->>'month')::integer > 1200
      or (x->>'pct')::numeric < 0 or (x->>'pct')::numeric > 100) then
    raise exception 'Cronograma da regra inválido';
  end if;
  select count(distinct (x->>'month')::integer) into v_schedule_distinct
    from jsonb_array_elements(v_rule_schedule) x;
  if v_schedule_distinct <> v_schedule_count then
    raise exception 'Cronograma da regra possui meses repetidos';
  end if;
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
  select (x->>'data_vencimento')::date into v_first_due
    from jsonb_array_elements(p_installments) x
    where (x->>'numero_parcela')::integer = 1;
  if v_first_due is null then raise exception 'Primeira parcela obrigatória'; end if;
  for v_row in select value from jsonb_array_elements(p_installments) loop
    if jsonb_typeof(v_row) is distinct from 'object' then
      raise exception 'Formato de parcela inválido';
    end if;
    foreach v_required_field in array array[
      'numero_parcela', 'data_vencimento', 'valor_previsto',
      'imposto_retido', 'valor_liquido', 'repasse_previsto_vendedor',
      'percentual_aplicado', 'valor_base_mensalidade'
    ] loop
      if not (v_row ? v_required_field) or v_row->>v_required_field is null then
        raise exception 'Campo obrigatório ausente na parcela: %', v_required_field;
      end if;
    end loop;
    if jsonb_typeof(v_row->'numero_parcela') <> 'number'
      or jsonb_typeof(v_row->'valor_previsto') <> 'number'
      or jsonb_typeof(v_row->'imposto_retido') <> 'number'
      or jsonb_typeof(v_row->'valor_liquido') <> 'number'
      or jsonb_typeof(v_row->'repasse_previsto_vendedor') <> 'number'
      or jsonb_typeof(v_row->'percentual_aplicado') <> 'number'
      or jsonb_typeof(v_row->'valor_base_mensalidade') <> 'number' then
      raise exception 'Valores numéricos obrigatórios';
    end if;
    if (v_row->>'numero_parcela')::integer < 1
      or (v_row->>'percentual_aplicado')::numeric < 0
      or (v_row->>'percentual_aplicado')::numeric > 100
      or (v_row->>'valor_base_mensalidade')::numeric <= 0
      or (v_row->>'valor_previsto')::numeric < 0
      or (v_row->>'imposto_retido')::numeric < 0
      or (v_row->>'valor_liquido')::numeric < 0
      or (v_row->>'repasse_previsto_vendedor')::numeric < 0 then
      raise exception 'Valores de parcela inválidos';
    end if;
    v_due_date := (v_row->>'data_vencimento')::date;
    if v_due_date is null then raise exception 'Vencimento obrigatório'; end if;
    v_expected_due := (date_trunc('month', v_first_due)::date +
      make_interval(months => (v_row->>'numero_parcela')::integer - 1))::date;
    v_expected_due := v_expected_due +
      least(extract(day from v_first_due)::integer,
        extract(day from (date_trunc('month', v_expected_due) + interval '1 month - 1 day'))::integer) - 1;
    if v_due_date <> v_expected_due then raise exception 'Vencimento fora do cronograma'; end if;
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
grant execute on function public.persist_contract_commission_forecast(uuid,uuid,text,jsonb) to authenticated;
