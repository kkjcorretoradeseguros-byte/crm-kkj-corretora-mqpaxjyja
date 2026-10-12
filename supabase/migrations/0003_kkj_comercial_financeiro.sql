-- ==============================================================================
-- MIGRAÇÃO 0003: AMPLIAÇÃO INCREMENTAL DO MOTOR COMERCIAL E FINANCEIRO DA KKJ
-- Compatível 100% com as Migrações 0001 e 0002.1 do banco Supabase.
-- REGRAS ESTRITAS DO PROJETO:
-- 1. Proibido recriar commission_rules e commission_installments (usar ALTER TABLE incremental).
-- 2. Preserva UNIQUE(contract_id, numero_parcela) e a FK composta uq_contract_financials_contract_id_id.
-- 3. Segurança estrita com public.user_role ('administrador', 'gestor', 'vendedor').
-- 4. Alíquota padrão de imposto/retenção KKJ: 11.00% (substitui todo padrão 8%).
-- 5. Nova tabela system_settings com histórico auditado em system_settings_history.
-- 6. Trigger handle_updated_at() é a função existente da migration 0001.
-- 7. NUNCA usar blocos WHEN OTHERS THEN NULL.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE CONFIGURAÇÕES DO SISTEMA (system_settings) E HISTÓRICO
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.system_settings IS 'Parâmetros centrais do sistema CRM KKJ configuráveis por administradores.';

CREATE TABLE IF NOT EXISTS public.system_settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.system_settings_history IS 'Trilha de auditoria das alterações em system_settings.';

CREATE INDEX IF NOT EXISTS idx_system_settings_history_key ON public.system_settings_history(key, created_at DESC);

-- Trigger de updated_at para system_settings (usando a função existente handle_updated_at)
DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger SECURITY DEFINER com search_path = '' para gravar histórico em system_settings_history
CREATE OR REPLACE FUNCTION public.handle_system_settings_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.value IS DISTINCT FROM NEW.value THEN
      INSERT INTO public.system_settings_history (
        key,
        previous_value,
        new_value,
        changed_by,
        reason
      ) VALUES (
        NEW.key,
        OLD.value,
        NEW.value,
        auth.uid(),
        'Alteração via painel administrativo'
      );
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.system_settings_history (
      key,
      previous_value,
      new_value,
      changed_by,
      reason
    ) VALUES (
      NEW.key,
      NULL,
      NEW.value,
      auth.uid(),
      'Criação inicial da configuração'
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_system_settings_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_system_settings_history() FROM anon;
GRANT EXECUTE ON FUNCTION public.handle_system_settings_history() TO authenticated;

DROP TRIGGER IF EXISTS trg_system_settings_history ON public.system_settings;
CREATE TRIGGER trg_system_settings_history
  AFTER INSERT OR UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_settings_history();

-- RLS de system_settings e system_settings_history
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_select_authenticated" ON public.system_settings;
CREATE POLICY "system_settings_select_authenticated"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "system_settings_admin_write" ON public.system_settings;
CREATE POLICY "system_settings_admin_write"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "system_settings_history_admin_select" ON public.system_settings_history;
CREATE POLICY "system_settings_history_admin_select"
  ON public.system_settings_history FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "system_settings_history_admin_write" ON public.system_settings_history;
CREATE POLICY "system_settings_history_admin_write"
  ON public.system_settings_history FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed padrão de alíquota de imposto: 11.00%
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'aliquota_imposto_padrao',
  '11.00'::jsonb,
  'Alíquota de imposto/retenção padrão da KKJ em percentual (11.00%)'
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = timezone('utc'::text, now());

-- ------------------------------------------------------------------------------
-- 2. TABELA DE TAGS DO CRM (crm_tags) COM AS 8 PADRÃO DA KKJ
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#0284c7',
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.crm_tags IS 'Tags para segmentação comercial e automações (Saúde, PME, PF, Adesão, Tráfego pago, BNI, Indicação, Renovação).';

DROP TRIGGER IF EXISTS trg_crm_tags_updated_at ON public.crm_tags;
CREATE TRIGGER trg_crm_tags_updated_at
  BEFORE UPDATE ON public.crm_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Seed idempotente das 8 tags padrão da KKJ
INSERT INTO public.crm_tags (name, color, description, active)
VALUES
  ('Saúde', '#0284c7', 'Oportunidades e clientes do ramo de planos de saúde', true),
  ('PME', '#16a34a', 'Planos de saúde e benefícios para pequenas e médias empresas', true),
  ('PF', '#9333ea', 'Planos de saúde individuais e familiares pessoa física', true),
  ('Adesão', '#ea580c', 'Planos coletivos por adesão via entidades de classe', true),
  ('Tráfego pago', '#ec4899', 'Leads originados de campanhas pagas (Meta Ads / Google)', true),
  ('BNI', '#ca8a04', 'Oportunidades de referências da rede de negócios BNI', true),
  ('Indicação', '#06b6d4', 'Leads indicados por clientes ativos ou parceiros', true),
  ('Renovação', '#64748b', 'Contratos e apólices em ciclo anual de renovação', true)
ON CONFLICT (name) DO UPDATE
  SET color = EXCLUDED.color,
      description = EXCLUDED.description,
      active = EXCLUDED.active,
      updated_at = timezone('utc'::text, now());

-- RLS de crm_tags
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_tags_select" ON public.crm_tags;
CREATE POLICY "crm_tags_select"
  ON public.crm_tags FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "crm_tags_admin_write" ON public.crm_tags;
CREATE POLICY "crm_tags_admin_write"
  ON public.crm_tags FOR ALL
  TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

-- ------------------------------------------------------------------------------
-- 3. TABELA DE SUGESTÕES / COTAÇÕES DE PLANOS (opportunity_plan_suggestions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opportunity_plan_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES public.carriers(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  nome_plano TEXT NOT NULL,
  valor_mensal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CONSTRAINT chk_opp_sug_valor_mensal CHECK (valor_mensal >= 0),
  coparticipacao BOOLEAN NOT NULL DEFAULT false,
  acomodacao TEXT DEFAULT 'apartamento' CONSTRAINT chk_opp_sug_acomodacao CHECK (acomodacao IN ('enfermaria', 'apartamento', 'vip', 'nao_se_aplica')),
  vidas INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_opp_sug_vidas CHECK (vidas > 0),
  is_principal BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.opportunity_plan_suggestions IS 'Múltiplas cotações e sugestões de plano com no máximo UMA cotação principal por oportunidade.';

-- Índice único parcial garantindo que apenas 1 cotação seja principal por oportunidade
CREATE UNIQUE INDEX IF NOT EXISTS uq_opp_plan_suggestions_principal
  ON public.opportunity_plan_suggestions (opportunity_id)
  WHERE is_principal = true;

CREATE INDEX IF NOT EXISTS idx_opp_plan_suggestions_opp
  ON public.opportunity_plan_suggestions (opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opp_plan_suggestions_carrier
  ON public.opportunity_plan_suggestions (carrier_id);

-- RLS de opportunity_plan_suggestions
ALTER TABLE public.opportunity_plan_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opp_plan_suggestions_select" ON public.opportunity_plan_suggestions;
CREATE POLICY "opp_plan_suggestions_select"
  ON public.opportunity_plan_suggestions FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_plan_suggestions.opportunity_id
        AND (
          o.owner_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(o.owner_id))
        )
    )
  );

DROP POLICY IF EXISTS "opp_plan_suggestions_insert" ON public.opportunity_plan_suggestions;
CREATE POLICY "opp_plan_suggestions_insert"
  ON public.opportunity_plan_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_plan_suggestions.opportunity_id
        AND (
          o.owner_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(o.owner_id))
        )
    )
  );

DROP POLICY IF EXISTS "opp_plan_suggestions_update" ON public.opportunity_plan_suggestions;
CREATE POLICY "opp_plan_suggestions_update"
  ON public.opportunity_plan_suggestions FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_plan_suggestions.opportunity_id
        AND (
          o.owner_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(o.owner_id))
        )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_plan_suggestions.opportunity_id
        AND (
          o.owner_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(o.owner_id))
        )
    )
  );

DROP POLICY IF EXISTS "opp_plan_suggestions_delete" ON public.opportunity_plan_suggestions;
CREATE POLICY "opp_plan_suggestions_delete"
  ON public.opportunity_plan_suggestions FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_plan_suggestions.opportunity_id
        AND (
          o.owner_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(o.owner_id))
        )
    )
  );

-- Trigger de updated_at para sugestões
DROP TRIGGER IF EXISTS trg_opp_plan_suggestions_updated_at ON public.opportunity_plan_suggestions;
CREATE TRIGGER trg_opp_plan_suggestions_updated_at
  BEFORE UPDATE ON public.opportunity_plan_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. AMPLIAÇÃO INCREMENTAL DE commission_rules (0001 JÁ CRIOU ESSA TABELA)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Código identificador amigável da regra
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'code') THEN
    ALTER TABLE public.commission_rules ADD COLUMN code VARCHAR(60);
  END IF;

  -- Tipo de contrato (pme, pf, adesao, vida, odonto)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'contract_type') THEN
    ALTER TABLE public.commission_rules ADD COLUMN contract_type TEXT DEFAULT 'pme';
  END IF;

  -- Indicador de existência de recorrência
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'has_recurring') THEN
    ALTER TABLE public.commission_rules ADD COLUMN has_recurring BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- Percentual de recorrência
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'recurring_percentage') THEN
    ALTER TABLE public.commission_rules ADD COLUMN recurring_percentage NUMERIC(6, 2) DEFAULT 0.00;
  END IF;

  -- Mês de início da recorrência
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'recurring_start_month') THEN
    ALTER TABLE public.commission_rules ADD COLUMN recurring_start_month INTEGER DEFAULT 4;
  END IF;

  -- Faixa mínima e máxima de vidas para aplicação da regra
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'min_lives') THEN
    ALTER TABLE public.commission_rules ADD COLUMN min_lives INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'max_lives') THEN
    ALTER TABLE public.commission_rules ADD COLUMN max_lives INTEGER;
  END IF;

  -- Alíquota de repasse padrão ao vendedor na 1ª parcela
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'repasse_vendedor_pct') THEN
    ALTER TABLE public.commission_rules ADD COLUMN repasse_vendedor_pct NUMERIC(6, 2) DEFAULT 50.00;
  END IF;

  -- Alíquota de repasse em caso de indicação própria do vendedor
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'repasse_vendedor_proprio_pct') THEN
    ALTER TABLE public.commission_rules ADD COLUMN repasse_vendedor_proprio_pct NUMERIC(6, 2) DEFAULT 100.00;
  END IF;

  -- Alíquota padrão de imposto/retenção KKJ para cálculo líquido (11.00%)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_rules' AND column_name = 'aliquota_imposto_pct') THEN
    ALTER TABLE public.commission_rules ADD COLUMN aliquota_imposto_pct NUMERIC(6, 2) DEFAULT 11.00;
  ELSE
    ALTER TABLE public.commission_rules ALTER COLUMN aliquota_imposto_pct SET DEFAULT 11.00;
  END IF;
END $$;

-- Constraint UNIQUE nomeada uq_commission_rules_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_commission_rules_code'
      AND conrelid = 'public.commission_rules'::regclass
  ) THEN
    ALTER TABLE public.commission_rules
      ADD CONSTRAINT uq_commission_rules_code UNIQUE (code);
  END IF;
END $$;

-- RLS de commission_rules (estrita por perfil)
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_rules_admin_select" ON public.commission_rules;
CREATE POLICY "commission_rules_admin_select"
  ON public.commission_rules FOR SELECT
  TO authenticated
  USING (public.is_manager_or_admin());

DROP POLICY IF EXISTS "commission_rules_admin_all" ON public.commission_rules;
CREATE POLICY "commission_rules_admin_all"
  ON public.commission_rules FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. TABELA DE SNAPSHOTS DE COMISSÃO POR CONTRATO (contract_commission_snapshots)
-- Garante que alterações globais em commission_rules nunca afetem contratos históricos.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_commission_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL CONSTRAINT uq_contract_commission_snapshots_contract UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES public.carriers(id) ON DELETE RESTRICT,
  carrier_name TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'pme',
  mensalidade_base NUMERIC(14, 2) NOT NULL CONSTRAINT chk_snap_mensalidade CHECK (mensalidade_base >= 0),
  qtd_vidas INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_snap_vidas CHECK (qtd_vidas > 0),
  rule_id UUID REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  has_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_percentage NUMERIC(6, 2) DEFAULT 0.00,
  recurring_start_month INTEGER DEFAULT 4,
  aliquota_imposto_pct NUMERIC(6, 2) NOT NULL DEFAULT 11.00,
  repasse_vendedor_pct NUMERIC(6, 2) NOT NULL DEFAULT 50.00,
  total_comissao_prevista NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  total_repasse_previsto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  data_snapshot TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.contract_commission_snapshots IS 'Fotografia imutável das regras de comissão vigentes na contratação.';

CREATE INDEX IF NOT EXISTS idx_snapshots_contract ON public.contract_commission_snapshots(contract_id);

DROP TRIGGER IF EXISTS trg_snapshots_updated_at ON public.contract_commission_snapshots;
CREATE TRIGGER trg_snapshots_updated_at
  BEFORE UPDATE ON public.contract_commission_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS de contract_commission_snapshots
ALTER TABLE public.contract_commission_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshots_admin_select" ON public.contract_commission_snapshots;
CREATE POLICY "snapshots_admin_select"
  ON public.contract_commission_snapshots FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_commission_snapshots.contract_id
        AND (
          c.responsavel_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(c.responsavel_id))
        )
    )
  );

DROP POLICY IF EXISTS "snapshots_admin_all" ON public.contract_commission_snapshots;
CREATE POLICY "snapshots_admin_all"
  ON public.contract_commission_snapshots FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. AMPLIAÇÃO INCREMENTAL DE commission_installments (0001 JÁ CRIOU ESSA TABELA)
-- Preserva uq_contract_installment UNIQUE(contract_id, numero_parcela) e a FK composta.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Tipo de parcela ('vitalicia' | 'recorrencia' | 'bonificacao' | 'adesao' | 'ajuste')
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_installments' AND column_name = 'tipo_parcela') THEN
    ALTER TABLE public.commission_installments ADD COLUMN tipo_parcela TEXT NOT NULL DEFAULT 'vitalicia';
  END IF;

  -- Percentual aplicado sobre a mensalidade base nesta parcela
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_installments' AND column_name = 'percentual_aplicado') THEN
    ALTER TABLE public.commission_installments ADD COLUMN percentual_aplicado NUMERIC(6, 2) DEFAULT 0.00;
  END IF;

  -- Valor da mensalidade base do contrato tomada como referência para esta parcela
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_installments' AND column_name = 'valor_base_mensalidade') THEN
    ALTER TABLE public.commission_installments ADD COLUMN valor_base_mensalidade NUMERIC(14, 2) DEFAULT 0.00;
  END IF;

  -- Imposto descontado / retido da KKJ nesta parcela
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_installments' AND column_name = 'imposto_retido') THEN
    ALTER TABLE public.commission_installments ADD COLUMN imposto_retido NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
  END IF;

  -- Comissão líquida KKJ nesta parcela
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_installments' AND column_name = 'valor_liquido') THEN
    ALTER TABLE public.commission_installments ADD COLUMN valor_liquido NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
  END IF;

  -- Referência ou ID de conciliação bancária / extrato de operadora
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_installments' AND column_name = 'conciliacao_ref') THEN
    ALTER TABLE public.commission_installments ADD COLUMN conciliacao_ref TEXT;
  END IF;

  -- Informações de estorno quando houver
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_installments' AND column_name = 'estornado') THEN
    ALTER TABLE public.commission_installments ADD COLUMN estornado BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_installments' AND column_name = 'motivo_estorno') THEN
    ALTER TABLE public.commission_installments ADD COLUMN motivo_estorno TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commission_installments' AND column_name = 'data_estorno') THEN
    ALTER TABLE public.commission_installments ADD COLUMN data_estorno TIMESTAMPTZ;
  END IF;
END $$;

-- Alarga a CHECK constraint de status de commission_installments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_commission_installments_status'
      AND conrelid = 'public.commission_installments'::regclass
  ) THEN
    ALTER TABLE public.commission_installments DROP CONSTRAINT chk_commission_installments_status;
  END IF;

  ALTER TABLE public.commission_installments ADD CONSTRAINT chk_commission_installments_status
    CHECK (status IN ('previsto', 'liberado', 'recebido', 'repassado', 'atrasado', 'cancelado', 'estornado'));
END $$;

-- ------------------------------------------------------------------------------
-- 7. TABELA DE BOLETOS DE ADESÃO (adesao_boletos)
-- Regra de negócio: A KKJ emite e recebe o 1º boleto de taxa/mensalidade integralmente.
-- Receita bruta de 100% retida pela KKJ; repasse à operadora é R$ 0,00 na 1ª mensalidade.
-- Alíquota de imposto padrão: 11.00%.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.adesao_boletos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  numero_boleto TEXT NOT NULL,
  linha_digitavel TEXT,
  codigo_barras TEXT,
  valor_mensalidade NUMERIC(14, 2) NOT NULL CONSTRAINT chk_adesao_valor_mensalidade CHECK (valor_mensalidade > 0),
  taxa_adesao NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CONSTRAINT chk_adesao_taxa CHECK (taxa_adesao >= 0),
  valor_total_boleto NUMERIC(14, 2) NOT NULL CONSTRAINT chk_adesao_valor_total CHECK (valor_total_boleto > 0),
  receita_bruta_kkj NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  repasse_operadora NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  aliquota_imposto_pct NUMERIC(6, 2) NOT NULL DEFAULT 11.00,
  valor_imposto_retido NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  repasse_vendedor_pct NUMERIC(6, 2) NOT NULL DEFAULT 30.00,
  repasse_vendedor_valor NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  receita_liquida_kkj NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  data_repasse_vendedor DATE,
  status TEXT NOT NULL DEFAULT 'pendente'
    CONSTRAINT chk_adesao_boletos_status CHECK (status IN ('pendente', 'pago', 'repassado', 'vencido', 'cancelado', 'estornado')),
  comprovante_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_adesao_contract UNIQUE (contract_id)
);
COMMENT ON TABLE public.adesao_boletos IS 'Controle do 1º boleto da modalidade Adesão emitido e recolhido integralmente pela KKJ.';

CREATE INDEX IF NOT EXISTS idx_adesao_boletos_contract ON public.adesao_boletos(contract_id);
CREATE INDEX IF NOT EXISTS idx_adesao_boletos_status ON public.adesao_boletos(status);
CREATE INDEX IF NOT EXISTS idx_adesao_boletos_vencimento ON public.adesao_boletos(data_vencimento);

DROP TRIGGER IF EXISTS trg_adesao_boletos_updated_at ON public.adesao_boletos;
CREATE TRIGGER trg_adesao_boletos_updated_at
  BEFORE UPDATE ON public.adesao_boletos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS de adesao_boletos (restrito: vendedor/gestor somente via ownership/equipe, nunca USING true)
ALTER TABLE public.adesao_boletos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adesao_boletos_admin_select" ON public.adesao_boletos;
CREATE POLICY "adesao_boletos_admin_select"
  ON public.adesao_boletos FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = adesao_boletos.contract_id
        AND (
          c.responsavel_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(c.responsavel_id))
        )
    )
  );

DROP POLICY IF EXISTS "adesao_boletos_admin_write" ON public.adesao_boletos;
CREATE POLICY "adesao_boletos_admin_write"
  ON public.adesao_boletos FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 8. TABELA DE LEADS META ADS (meta_ads_leads) — DESACOPLADA SEM INTEGRAÇÃO ATIVA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_ads_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL UNIQUE,
  form_id TEXT,
  form_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  platform TEXT DEFAULT 'fb',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  nome TEXT,
  email TEXT,
  telefone TEXT,
  cidade TEXT,
  estado TEXT,
  dados_saude JSONB DEFAULT '{}'::jsonb,
  status_processamento TEXT NOT NULL DEFAULT 'pendente'
    CONSTRAINT chk_meta_status CHECK (status_processamento IN ('pendente', 'processado', 'duplicado', 'erro', 'ignorado')),
  erro_detalhes TEXT,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  processed_at TIMESTAMPTZ
);
COMMENT ON TABLE public.meta_ads_leads IS 'Histórico e fila de processamento de leads capturados de campanhas do Meta Ads.';

CREATE INDEX IF NOT EXISTS idx_meta_leads_status ON public.meta_ads_leads(status_processamento);
CREATE INDEX IF NOT EXISTS idx_meta_leads_created ON public.meta_ads_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_leads_opp ON public.meta_ads_leads(opportunity_id);

-- RLS de meta_ads_leads
ALTER TABLE public.meta_ads_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_ads_leads_admin_all" ON public.meta_ads_leads;
CREATE POLICY "meta_ads_leads_admin_all"
  ON public.meta_ads_leads FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "meta_ads_leads_vendedor_select" ON public.meta_ads_leads;
CREATE POLICY "meta_ads_leads_vendedor_select"
  ON public.meta_ads_leads FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      opportunity_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = meta_ads_leads.opportunity_id
          AND (
            o.owner_id = auth.uid()
            OR (public.is_gestor() AND public.is_manager_of_seller(o.owner_id))
          )
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 9. REGRAS ESPECIAIS KKJ SEED EM commission_rules (UPSERT ON CONFLICT (code) DO UPDATE)
-- NUNCA ON CONFLICT (id) DO NOTHING (que duplica por gerar novos IDs a cada execução).
-- - BRADESCO_PME: 100/100/100/50/50 sem recorrência
-- - AMIL_PME: 100/100/100 + 2% recorrente a partir da 4ª
-- - SULAMERICA_PME: 100/100/100 + 2% recorrente a partir da 4ª
-- - PORTO_PME: 100/100/100 + 2% recorrente a partir da 4ª
-- - ALICE_PME: 100/100/100 sem recorrência
-- - MEDSENIOR_PME: 100/50/50 sem recorrência
-- - HAPVIDA_PME: 100/100/100/50 sem recorrência
-- - PLENA_OP1: EXCLUSIVAMENTE Opção 1 (100/50/40/20/20 = 230%)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_carrier_id UUID;
BEGIN
  -- 1. BRADESCO SAÚDE (100/100/100/50/50, sem recorrência)
  SELECT id INTO v_carrier_id FROM public.carriers WHERE lower(nome) LIKE '%bradesco%' LIMIT 1;
  IF v_carrier_id IS NOT NULL THEN
    INSERT INTO public.commission_rules (
      nome, code, carrier_id, contract_type, tipo_regra, has_recurring,
      recurring_percentage, recurring_start_month, repasse_vendedor_pct, aliquota_imposto_pct,
      cronograma_parcelas, ativo
    ) VALUES (
      'Regra PME KKJ - Bradesco Saúde', 'BRADESCO_PME', v_carrier_id, 'pme', 'percentual', false,
      0.00, 4, 50.00, 11.00,
      '[{"month": 1, "pct": 100}, {"month": 2, "pct": 100}, {"month": 3, "pct": 100}, {"month": 4, "pct": 50}, {"month": 5, "pct": 50}]'::jsonb, true
    ) ON CONFLICT (code) DO UPDATE
      SET nome = EXCLUDED.nome,
          carrier_id = EXCLUDED.carrier_id,
          contract_type = EXCLUDED.contract_type,
          tipo_regra = EXCLUDED.tipo_regra,
          has_recurring = EXCLUDED.has_recurring,
          recurring_percentage = EXCLUDED.recurring_percentage,
          recurring_start_month = EXCLUDED.recurring_start_month,
          repasse_vendedor_pct = EXCLUDED.repasse_vendedor_pct,
          aliquota_imposto_pct = EXCLUDED.aliquota_imposto_pct,
          cronograma_parcelas = EXCLUDED.cronograma_parcelas,
          ativo = EXCLUDED.ativo,
          updated_at = timezone('utc'::text, now());
  END IF;

  -- 2. AMIL (100/100/100 + 2% recorrente a partir da 4ª)
  SELECT id INTO v_carrier_id FROM public.carriers WHERE lower(nome) LIKE '%amil%' LIMIT 1;
  IF v_carrier_id IS NOT NULL THEN
    INSERT INTO public.commission_rules (
      nome, code, carrier_id, contract_type, tipo_regra, has_recurring,
      recurring_percentage, recurring_start_month, repasse_vendedor_pct, aliquota_imposto_pct,
      cronograma_parcelas, ativo
    ) VALUES (
      'Regra PME KKJ - Amil', 'AMIL_PME', v_carrier_id, 'pme', 'percentual', true,
      2.00, 4, 50.00, 11.00,
      '[{"month": 1, "pct": 100}, {"month": 2, "pct": 100}, {"month": 3, "pct": 100}]'::jsonb, true
    ) ON CONFLICT (code) DO UPDATE
      SET nome = EXCLUDED.nome,
          carrier_id = EXCLUDED.carrier_id,
          contract_type = EXCLUDED.contract_type,
          tipo_regra = EXCLUDED.tipo_regra,
          has_recurring = EXCLUDED.has_recurring,
          recurring_percentage = EXCLUDED.recurring_percentage,
          recurring_start_month = EXCLUDED.recurring_start_month,
          repasse_vendedor_pct = EXCLUDED.repasse_vendedor_pct,
          aliquota_imposto_pct = EXCLUDED.aliquota_imposto_pct,
          cronograma_parcelas = EXCLUDED.cronograma_parcelas,
          ativo = EXCLUDED.ativo,
          updated_at = timezone('utc'::text, now());
  END IF;

  -- 3. SULAMÉRICA (100/100/100 + 2% recorrente a partir da 4ª)
  SELECT id INTO v_carrier_id FROM public.carriers WHERE lower(nome) LIKE '%sulamerica%' OR lower(nome) LIKE '%sul américa%' LIMIT 1;
  IF v_carrier_id IS NOT NULL THEN
    INSERT INTO public.commission_rules (
      nome, code, carrier_id, contract_type, tipo_regra, has_recurring,
      recurring_percentage, recurring_start_month, repasse_vendedor_pct, aliquota_imposto_pct,
      cronograma_parcelas, ativo
    ) VALUES (
      'Regra PME KKJ - SulAmérica', 'SULAMERICA_PME', v_carrier_id, 'pme', 'percentual', true,
      2.00, 4, 50.00, 11.00,
      '[{"month": 1, "pct": 100}, {"month": 2, "pct": 100}, {"month": 3, "pct": 100}]'::jsonb, true
    ) ON CONFLICT (code) DO UPDATE
      SET nome = EXCLUDED.nome,
          carrier_id = EXCLUDED.carrier_id,
          contract_type = EXCLUDED.contract_type,
          tipo_regra = EXCLUDED.tipo_regra,
          has_recurring = EXCLUDED.has_recurring,
          recurring_percentage = EXCLUDED.recurring_percentage,
          recurring_start_month = EXCLUDED.recurring_start_month,
          repasse_vendedor_pct = EXCLUDED.repasse_vendedor_pct,
          aliquota_imposto_pct = EXCLUDED.aliquota_imposto_pct,
          cronograma_parcelas = EXCLUDED.cronograma_parcelas,
          ativo = EXCLUDED.ativo,
          updated_at = timezone('utc'::text, now());
  END IF;

  -- 4. PORTO SEGURO (100/100/100 + 2% recorrente a partir da 4ª)
  SELECT id INTO v_carrier_id FROM public.carriers WHERE lower(nome) LIKE '%porto%' LIMIT 1;
  IF v_carrier_id IS NOT NULL THEN
    INSERT INTO public.commission_rules (
      nome, code, carrier_id, contract_type, tipo_regra, has_recurring,
      recurring_percentage, recurring_start_month, repasse_vendedor_pct, aliquota_imposto_pct,
      cronograma_parcelas, ativo
    ) VALUES (
      'Regra PME KKJ - Porto Seguro', 'PORTO_PME', v_carrier_id, 'pme', 'percentual', true,
      2.00, 4, 50.00, 11.00,
      '[{"month": 1, "pct": 100}, {"month": 2, "pct": 100}, {"month": 3, "pct": 100}]'::jsonb, true
    ) ON CONFLICT (code) DO UPDATE
      SET nome = EXCLUDED.nome,
          carrier_id = EXCLUDED.carrier_id,
          contract_type = EXCLUDED.contract_type,
          tipo_regra = EXCLUDED.tipo_regra,
          has_recurring = EXCLUDED.has_recurring,
          recurring_percentage = EXCLUDED.recurring_percentage,
          recurring_start_month = EXCLUDED.recurring_start_month,
          repasse_vendedor_pct = EXCLUDED.repasse_vendedor_pct,
          aliquota_imposto_pct = EXCLUDED.aliquota_imposto_pct,
          cronograma_parcelas = EXCLUDED.cronograma_parcelas,
          ativo = EXCLUDED.ativo,
          updated_at = timezone('utc'::text, now());
  END IF;

  -- 5. ALICE (100/100/100 sem recorrência)
  SELECT id INTO v_carrier_id FROM public.carriers WHERE lower(nome) LIKE '%alice%' LIMIT 1;
  IF v_carrier_id IS NOT NULL THEN
    INSERT INTO public.commission_rules (
      nome, code, carrier_id, contract_type, tipo_regra, has_recurring,
      recurring_percentage, recurring_start_month, repasse_vendedor_pct, aliquota_imposto_pct,
      cronograma_parcelas, ativo
    ) VALUES (
      'Regra PME KKJ - Alice', 'ALICE_PME', v_carrier_id, 'pme', 'percentual', false,
      0.00, 4, 50.00, 11.00,
      '[{"month": 1, "pct": 100}, {"month": 2, "pct": 100}, {"month": 3, "pct": 100}]'::jsonb, true
    ) ON CONFLICT (code) DO UPDATE
      SET nome = EXCLUDED.nome,
          carrier_id = EXCLUDED.carrier_id,
          contract_type = EXCLUDED.contract_type,
          tipo_regra = EXCLUDED.tipo_regra,
          has_recurring = EXCLUDED.has_recurring,
          recurring_percentage = EXCLUDED.recurring_percentage,
          recurring_start_month = EXCLUDED.recurring_start_month,
          repasse_vendedor_pct = EXCLUDED.repasse_vendedor_pct,
          aliquota_imposto_pct = EXCLUDED.aliquota_imposto_pct,
          cronograma_parcelas = EXCLUDED.cronograma_parcelas,
          ativo = EXCLUDED.ativo,
          updated_at = timezone('utc'::text, now());
  END IF;

  -- 6. MEDSÊNIOR (100/50/50 sem recorrência)
  SELECT id INTO v_carrier_id FROM public.carriers WHERE lower(nome) LIKE '%senior%' OR lower(nome) LIKE '%sênior%' LIMIT 1;
  IF v_carrier_id IS NOT NULL THEN
    INSERT INTO public.commission_rules (
      nome, code, carrier_id, contract_type, tipo_regra, has_recurring,
      recurring_percentage, recurring_start_month, repasse_vendedor_pct, aliquota_imposto_pct,
      cronograma_parcelas, ativo
    ) VALUES (
      'Regra PME KKJ - MedSênior', 'MEDSENIOR_PME', v_carrier_id, 'pme', 'percentual', false,
      0.00, 4, 50.00, 11.00,
      '[{"month": 1, "pct": 100}, {"month": 2, "pct": 50}, {"month": 3, "pct": 50}]'::jsonb, true
    ) ON CONFLICT (code) DO UPDATE
      SET nome = EXCLUDED.nome,
          carrier_id = EXCLUDED.carrier_id,
          contract_type = EXCLUDED.contract_type,
          tipo_regra = EXCLUDED.tipo_regra,
          has_recurring = EXCLUDED.has_recurring,
          recurring_percentage = EXCLUDED.recurring_percentage,
          recurring_start_month = EXCLUDED.recurring_start_month,
          repasse_vendedor_pct = EXCLUDED.repasse_vendedor_pct,
          aliquota_imposto_pct = EXCLUDED.aliquota_imposto_pct,
          cronograma_parcelas = EXCLUDED.cronograma_parcelas,
          ativo = EXCLUDED.ativo,
          updated_at = timezone('utc'::text, now());
  END IF;

  -- 7. HAPVIDA (100/100/100/50 sem recorrência)
  SELECT id INTO v_carrier_id FROM public.carriers WHERE lower(nome) LIKE '%hapvida%' LIMIT 1;
  IF v_carrier_id IS NOT NULL THEN
    INSERT INTO public.commission_rules (
      nome, code, carrier_id, contract_type, tipo_regra, has_recurring,
      recurring_percentage, recurring_start_month, repasse_vendedor_pct, aliquota_imposto_pct,
      cronograma_parcelas, ativo
    ) VALUES (
      'Regra PME KKJ - Hapvida', 'HAPVIDA_PME', v_carrier_id, 'pme', 'percentual', false,
      0.00, 5, 50.00, 11.00,
      '[{"month": 1, "pct": 100}, {"month": 2, "pct": 100}, {"month": 3, "pct": 100}, {"month": 4, "pct": 50}]'::jsonb, true
    ) ON CONFLICT (code) DO UPDATE
      SET nome = EXCLUDED.nome,
          carrier_id = EXCLUDED.carrier_id,
          contract_type = EXCLUDED.contract_type,
          tipo_regra = EXCLUDED.tipo_regra,
          has_recurring = EXCLUDED.has_recurring,
          recurring_percentage = EXCLUDED.recurring_percentage,
          recurring_start_month = EXCLUDED.recurring_start_month,
          repasse_vendedor_pct = EXCLUDED.repasse_vendedor_pct,
          aliquota_imposto_pct = EXCLUDED.aliquota_imposto_pct,
          cronograma_parcelas = EXCLUDED.cronograma_parcelas,
          ativo = EXCLUDED.ativo,
          updated_at = timezone('utc'::text, now());
  END IF;

  -- 8. PLENA SAÚDE (EXCLUSIVAMENTE OPÇÃO 1: 100/50/40/20/20 = 230%)
  SELECT id INTO v_carrier_id FROM public.carriers WHERE lower(nome) LIKE '%plena%' LIMIT 1;
  IF v_carrier_id IS NOT NULL THEN
    INSERT INTO public.commission_rules (
      nome, code, carrier_id, contract_type, tipo_regra, has_recurring,
      recurring_percentage, recurring_start_month, repasse_vendedor_pct, aliquota_imposto_pct,
      cronograma_parcelas, ativo
    ) VALUES (
      'Regra PME KKJ - Plena Saúde (Opção 1)', 'PLENA_OP1', v_carrier_id, 'pme', 'percentual', false,
      0.00, 6, 50.00, 11.00,
      '[{"month": 1, "pct": 100}, {"month": 2, "pct": 50}, {"month": 3, "pct": 40}, {"month": 4, "pct": 20}, {"month": 5, "pct": 20}]'::jsonb, true
    ) ON CONFLICT (code) DO UPDATE
      SET nome = EXCLUDED.nome,
          carrier_id = EXCLUDED.carrier_id,
          contract_type = EXCLUDED.contract_type,
          tipo_regra = EXCLUDED.tipo_regra,
          has_recurring = EXCLUDED.has_recurring,
          recurring_percentage = EXCLUDED.recurring_percentage,
          recurring_start_month = EXCLUDED.recurring_start_month,
          repasse_vendedor_pct = EXCLUDED.repasse_vendedor_pct,
          aliquota_imposto_pct = EXCLUDED.aliquota_imposto_pct,
          cronograma_parcelas = EXCLUDED.cronograma_parcelas,
          ativo = EXCLUDED.ativo,
          updated_at = timezone('utc'::text, now());
  END IF;
END $$;
