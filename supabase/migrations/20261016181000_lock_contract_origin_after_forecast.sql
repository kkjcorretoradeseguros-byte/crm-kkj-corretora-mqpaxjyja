-- Freeze the commercial origin once a financial snapshot exists.
-- No backfill: legacy contracts remain NULL until reviewed by an administrator.
create or replace function public.guard_contract_commercial_origin_after_forecast()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.origem_comercial_lead is distinct from old.origem_comercial_lead
     and exists (
       select 1 from public.contract_financials
       where contract_id = old.id
     ) then
    raise exception 'Origem comercial bloqueada após previsão financeira';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_contract_commercial_origin_after_forecast on public.contracts;
create trigger trg_guard_contract_commercial_origin_after_forecast
before update of origem_comercial_lead on public.contracts
for each row execute function public.guard_contract_commercial_origin_after_forecast();
