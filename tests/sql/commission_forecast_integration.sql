-- Isolated integration fixture; never run against production.
create table public.contracts (
  id uuid primary key, status text not null, carrier_id uuid not null,
  valor_mensal numeric not null, product_id uuid, qtd_vidas integer not null
);
\i supabase/migrations/20261016155500_contract_commercial_lead_origin.sql
create table public.commission_rules (
  id uuid primary key, carrier_id uuid not null, aliquota_imposto_pct numeric,
  cronograma_parcelas jsonb, data_inicio_vigencia date, data_fim_vigencia date,
  product_id uuid, has_recurring boolean, min_lives integer, max_lives integer,
  recurring_start_month integer, recurring_percentage numeric,
  repasse_vendedor_proprio_pct numeric, repasse_vendedor_pct numeric,
  ativo boolean not null
);
create table public.contract_financials (
  id uuid primary key default gen_random_uuid(), contract_id uuid unique not null,
  commission_rule_id uuid, comissao_prevista numeric, impostos_descontos numeric,
  comissao_liquida numeric, repasse_vendedor numeric, comissao_snapshot jsonb
);
create table public.commission_installments (
  id uuid primary key default gen_random_uuid(), contract_id uuid,
  contract_financial_id uuid, numero_parcela integer, total_parcelas integer,
  data_vencimento date, valor_previsto numeric, repasse_previsto_vendedor numeric,
  tipo_parcela text, percentual_aplicado numeric, valor_base_mensalidade numeric,
  imposto_retido numeric, valor_liquido numeric, status text
);
grant select on public.contracts, public.commission_rules, public.contract_financials to authenticated;
-- SELECT ... FOR UPDATE requires UPDATE privilege on the locked contract row.
grant update on public.contracts to authenticated;
grant select, insert on public.commission_installments to authenticated;
grant insert on public.contract_financials to authenticated;
alter table public.contract_financials enable row level security;
alter table public.commission_installments enable row level security;
create policy financial_admin on public.contract_financials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy installment_admin on public.commission_installments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
insert into public.contracts values (
  '00000000-0000-0000-0000-000000000001', 'ativo',
  '00000000-0000-0000-0000-000000000010', 1000, null, 3
);
insert into public.commission_rules values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000010', 15,
  '[{"month":1,"pct":100}]'::jsonb, null, null, null,
  false, 1, null, null, null, 100, 50, true
);
-- The contract must attest commercial origin before the commission snapshot.
update public.contracts set origem_comercial_lead = 'kkj'
where id = '00000000-0000-0000-0000-000000000001';
-- Administrator identity is mocked in this disposable database.
create or replace function public.is_admin() returns boolean
language sql stable as 'select true';
set role authenticated;
select public.persist_contract_commission_forecast(
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'kkj',
  '[{"numero_parcela":1,"total_parcelas":1,"data_vencimento":"2026-11-15","valor_previsto":1000,"imposto_retido":150,"valor_liquido":850,"repasse_previsto_vendedor":425,"percentual_aplicado":100,"valor_base_mensalidade":1000}]'::jsonb
);
reset role;
do $$
begin
  if (select count(*) from public.contract_financials) <> 1
     or (select count(*) from public.commission_installments) <> 1 then
    raise exception 'Expected exactly one financial record and installment';
  end if;
  if (select comissao_prevista from public.contract_financials) <> 1000 then
    raise exception 'Incorrect financial forecast amount';
  end if;
end $$;
-- Duplicate calls must fail without creating extra records.
do $$
begin
  execute 'set local role authenticated';
  begin
    perform public.persist_contract_commission_forecast(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002', 'kkj',
      '[{"numero_parcela":1,"data_vencimento":"2026-11-15","valor_previsto":1000,"imposto_retido":150,"valor_liquido":850,"repasse_previsto_vendedor":425,"percentual_aplicado":100,"valor_base_mensalidade":1000}]'::jsonb
    );
    raise exception 'Duplicate was incorrectly accepted';
  exception when others then
    if sqlerrm not like 'Previsão já existente:%' then raise; end if;
  end;
end $$;
reset role;
-- A non-administrator must be denied even with direct table grants.
create or replace function public.is_admin() returns boolean
language sql stable as 'select false';
do $secure$
begin
  execute 'set local role authenticated';
  begin
    perform public.persist_contract_commission_forecast(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002', 'kkj', '[]'::jsonb
    );
    raise exception 'Non-admin RPC call was incorrectly accepted';
  exception when others then
    if sqlerrm <> 'Acesso administrativo necessário' then raise; end if;
  end;
end $secure$;
reset role;
do $secure$
begin
  execute 'set local role authenticated';
  if exists (select 1 from public.contract_financials)
     or exists (select 1 from public.commission_installments) then
    raise exception 'RLS leaked financial rows to non-admin';
  end if;
end $secure$;
reset role;
select count(*) as financial_count from public.contract_financials;
select count(*) as installment_count from public.commission_installments;
