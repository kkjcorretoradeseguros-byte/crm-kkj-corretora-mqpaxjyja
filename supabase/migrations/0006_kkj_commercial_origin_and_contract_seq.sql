-- ==============================================================================
-- Migration 0006: KKJ Commercial Origin, Contract Sequence, Financial RLS & Audit
-- Idempotente. Arquivo de auditoria KKJ - NÃO executar cegamente em produção.
-- ==============================================================================

-- 1. Coluna commercial_origin em opportunities (kkj = lead da corretora, vendedor = lead próprio)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'opportunities' AND column_name = 'commercial_origin'
  ) THEN
    ALTER TABLE opportunities
      ADD COLUMN commercial_origin TEXT NOT NULL DEFAULT 'kkj';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_opportunities_commercial_origin'
  ) THEN
    ALTER TABLE opportunities
      ADD CONSTRAINT check_opportunities_commercial_origin
      CHECK (commercial_origin IN ('kkj', 'vendedor'));
  END IF;
END $$;

COMMENT ON COLUMN opportunities.commercial_origin IS
  'Origem comercial do lead para fins de comissionamento (kkj = 50% 1ª liq PME; vendedor = 100% 1ª liq PME). Distinto do canal lead_source.';

-- 2. Sequence e gerador sequencial de número de contrato (KKJ-YYYY-0001)
CREATE SEQUENCE IF NOT EXISTS contract_number_seq START WITH 1 INCREMENT BY 1;

-- Garantir constraint UNIQUE em contracts(numero_contrato)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_contracts_numero_contrato'
  ) THEN
    -- Adiciona apenas se não houver duplicatas ou após dedup
    ALTER TABLE contracts
      ADD CONSTRAINT uq_contracts_numero_contrato UNIQUE (numero_contrato);
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN
    NULL;
END $$;

CREATE OR REPLACE FUNCTION generate_contract_number(p_year INT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT;
  v_seq INT;
  v_num TEXT;
  v_tries INT := 0;
  v_exists BOOLEAN;
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT);

  LOOP
    v_tries := v_tries + 1;
    v_seq := nextval('contract_number_seq');
    v_num := 'KKJ-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0');

    SELECT EXISTS(SELECT 1 FROM contracts WHERE numero_contrato = v_num)
      INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_num;
    END IF;

    IF v_tries > 50 THEN
      -- Fallback de segurança anti-trava
      RETURN 'KKJ-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0') || '-' || LPAD((FLOOR(RANDOM() * 900) + 100)::TEXT, 3, '0');
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION generate_contract_number(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_contract_number(INT) TO authenticated, service_role;

-- 3. RLS estrito em contract_financials e commission_installments
-- Apenas administradores (is_admin()) podem consultar diretamente as tabelas financeiras completas.
-- Vendedores e gestores consultam seus próprios valores exclusivamente via RPC get_meu_financeiro().
ALTER TABLE contract_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_installments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Limpar policies permissivas anteriores se existirem
  DROP POLICY IF EXISTS "contract_financials_admin_all" ON contract_financials;
  DROP POLICY IF EXISTS "commission_installments_admin_all" ON commission_installments;
  DROP POLICY IF EXISTS "contract_financials_select_all" ON contract_financials;
  DROP POLICY IF EXISTS "commission_installments_select_all" ON commission_installments;

  CREATE POLICY "contract_financials_admin_all"
    ON contract_financials
    FOR ALL
    TO authenticated
    USING (
      COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), (auth.jwt() -> 'user_metadata' ->> 'role')) = 'admin'
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    )
    WITH CHECK (
      COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), (auth.jwt() -> 'user_metadata' ->> 'role')) = 'admin'
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    );

  CREATE POLICY "commission_installments_admin_all"
    ON commission_installments
    FOR ALL
    TO authenticated
    USING (
      COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), (auth.jwt() -> 'user_metadata' ->> 'role')) = 'admin'
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    )
    WITH CHECK (
      COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), (auth.jwt() -> 'user_metadata' ->> 'role')) = 'admin'
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    );
END $$;

-- Revisão de grants de funções RPC financeiras
DO $$
BEGIN
  -- get_meu_financeiro
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_meu_financeiro') THEN
    REVOKE ALL ON FUNCTION get_meu_financeiro FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION get_meu_financeiro TO authenticated, service_role;
  END IF;

  -- persist_contract_commission_forecast
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'persist_contract_commission_forecast') THEN
    REVOKE ALL ON FUNCTION persist_contract_commission_forecast FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION persist_contract_commission_forecast TO authenticated, service_role;
  END IF;

  -- confirm_first_commission_receipt
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'confirm_first_commission_receipt') THEN
    REVOKE ALL ON FUNCTION confirm_first_commission_receipt FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION confirm_first_commission_receipt TO authenticated, service_role;
  END IF;
END $$;

-- 4. Trigger BEFORE DELETE em contracts bloqueando exclusão com dados financeiros
CREATE OR REPLACE FUNCTION trg_prevent_contract_deletion_with_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_installments BOOLEAN;
  v_has_financials BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM commission_installments
    WHERE contract_id = OLD.id
  ) INTO v_has_installments;

  SELECT EXISTS(
    SELECT 1 FROM contract_financials
    WHERE contract_id = OLD.id
  ) INTO v_has_financials;

  IF v_has_installments OR v_has_financials THEN
    RAISE EXCEPTION 'Contrato não pode ser excluído pois possui lançamentos financeiros ou comissões registradas. Utilize o fluxo de cancelamento auditável do contrato.'
      USING ERRCODE = '23503';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_contracts_prevent_deletion ON contracts;
CREATE TRIGGER trg_contracts_prevent_deletion
  BEFORE DELETE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION trg_prevent_contract_deletion_with_financials();

-- 5. RPC delete_opportunity_transactional (apenas admin, bloqueia se houver boleto pago ou comissão recebida/repassada)
CREATE OR REPLACE FUNCTION delete_opportunity_transactional(
  p_opportunity_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_has_paid_adesao BOOLEAN;
  v_has_received_commission BOOLEAN;
  v_has_paid_split BOOLEAN;
  v_contract_id UUID;
BEGIN
  -- Validação de perfil administrativo
  SELECT (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), (auth.jwt() -> 'user_metadata' ->> 'role')) = 'admin'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  ) INTO v_is_admin;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir oportunidades do CRM.'
      USING ERRCODE = '42501';
  END IF;

  -- Obter contrato vinculado se existir
  SELECT id INTO v_contract_id
  FROM contracts
  WHERE opportunity_id = p_opportunity_id
  LIMIT 1;

  -- 1. Checar se há boleto de adesão pago
  SELECT EXISTS(
    SELECT 1 FROM boletos_adesao
    WHERE (opportunity_id = p_opportunity_id OR (v_contract_id IS NOT NULL AND contract_id = v_contract_id))
      AND status = 'pago'
  ) INTO v_has_paid_adesao;

  IF v_has_paid_adesao THEN
    RAISE EXCEPTION 'Não é permitido excluir oportunidade com boleto de adesão PAGO. Cancele o contrato via fluxo auditável.'
      USING ERRCODE = '23503';
  END IF;

  -- 2. Checar se há comissão recebida ou repassada
  IF v_contract_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM commission_installments
      WHERE contract_id = v_contract_id
        AND (status_recebimento IN ('recebido', 'parcial') OR status_repasse = 'repassado')
    ) INTO v_has_received_commission;

    IF v_has_received_commission THEN
      RAISE EXCEPTION 'Não é permitido excluir oportunidade com parcelas de comissão recebidas ou repassadas. Utilize cancelamento auditável.'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  -- Remoção em cascata segura dentro da transação
  IF v_contract_id IS NOT NULL THEN
    -- Deleta parcelas pendentes
    DELETE FROM commission_installments WHERE contract_id = v_contract_id;
    -- Deleta registro financeiro
    DELETE FROM contract_financials WHERE contract_id = v_contract_id;
    -- Deleta boletos pendentes/cancelados
    DELETE FROM boletos_adesao WHERE contract_id = v_contract_id;
    -- Deleta o contrato
    DELETE FROM contracts WHERE id = v_contract_id;
  END IF;

  -- Deleta boletos de adesão ligados diretamente à oportunidade
  DELETE FROM boletos_adesao WHERE opportunity_id = p_opportunity_id;

  -- Deleta tarefas, notas, eventos e a oportunidade
  DELETE FROM tasks WHERE opportunity_id = p_opportunity_id;
  DELETE FROM opportunity_events WHERE opportunity_id = p_opportunity_id;
  DELETE FROM opportunities WHERE id = p_opportunity_id;

  RETURN jsonb_build_object(
    'success', true,
    'opportunity_id', p_opportunity_id,
    'contract_id', v_contract_id,
    'reason', p_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION delete_opportunity_transactional(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_opportunity_transactional(UUID, TEXT) TO authenticated, service_role;
