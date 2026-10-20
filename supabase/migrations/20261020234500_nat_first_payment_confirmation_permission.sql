-- Restringe confirmação de pagamento no banco: administrador ou Nat no próprio contrato.
CREATE OR REPLACE FUNCTION public.guard_first_payment_confirmation_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF (OLD.data_confirmacao_pagamento IS DISTINCT FROM NEW.data_confirmacao_pagamento
      OR OLD.usuario_confirmou_pagamento_id IS DISTINCT FROM NEW.usuario_confirmou_pagamento_id)
     AND NEW.data_confirmacao_pagamento IS NOT NULL
     AND NOT public.is_admin()
  THEN
    IF auth.uid() IS DISTINCT FROM '75c3d247-8a9c-40c8-acb7-186f8d2af63e'::uuid
       OR OLD.responsavel_id IS DISTINCT FROM auth.uid()
       OR NEW.responsavel_id IS DISTINCT FROM auth.uid()
       OR NEW.usuario_confirmou_pagamento_id IS DISTINCT FROM auth.uid()
    THEN
      RAISE EXCEPTION 'A confirmação de pagamento exige administrador ou Nat no contrato sob sua responsabilidade.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_first_payment_confirmation_permission ON public.contracts;
CREATE TRIGGER trg_guard_first_payment_confirmation_permission
BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.guard_first_payment_confirmation_permission();
