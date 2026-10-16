-- Explicit commercial ownership for commission calculations.
-- Existing contracts remain unclassified until an administrator attests ownership.
alter table public.contracts
  add column if not exists origem_comercial_lead text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contracts'::regclass
      and conname = 'contracts_origem_comercial_lead_check'
  ) then
    alter table public.contracts
      add constraint contracts_origem_comercial_lead_check
      check (origem_comercial_lead is null or origem_comercial_lead in ('kkj', 'vendedor'));
  end if;
end $$;

comment on column public.contracts.origem_comercial_lead is
  'Origem comercial atestada: kkj ou vendedor. NULL em contratos legados ate revisao administrativa.';
