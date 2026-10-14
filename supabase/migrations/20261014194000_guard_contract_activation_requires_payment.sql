-- Prevent activation of contracts without a recorded payment.
-- Existing active contracts are not modified by this migration.
create or replace function public.guard_contract_activation_requires_payment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'ativo'
     and (tg_op = 'INSERT' or old.status is distinct from 'ativo')
     and new.data_pagamento is null then
    raise exception 'Confirme o pagamento antes de ativar o contrato';
  end if;
  if tg_op = 'UPDATE' and old.status = 'cancelado'
     and new.status is distinct from 'cancelado' then
    raise exception 'Contrato cancelado não pode ser reativado por edição';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_contract_activation_requires_payment on public.contracts;
create trigger trg_guard_contract_activation_requires_payment
before insert or update on public.contracts
for each row execute function public.guard_contract_activation_requires_payment();
