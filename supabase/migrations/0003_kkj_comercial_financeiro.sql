-- ============================================================================
-- CRM KK JEKABSON CORRETORA DE SEGUROS (KKJ)
-- MIGRATION 0003: COMERCIAL, FINANCEIRO, ADESÃO 100% KKJ, TAGS & META ADS
-- Incremental, idempotente e segura (compatível com as 32 tabelas da 0001)
-- NÃO EXECUTAR AUTOMATICAMENTE: o cliente aplica via SQL Editor do Supabase
-- ============================================================================

-- 1. TABELA DE TAGS DO SISTEMA E CUSTOMIZADAS
CREATE TABLE IF NOT EXISTS public.crm_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT NOT NULL DEFAULT '#2563EB',
  cor_fundo TEXT NOT NULL DEFAULT '#EFF6FF',
  cor_texto TEXT NOT NULL DEFAULT '#1D4ED8',
  is_system BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed das 8 tags padrão solicitadas
INSERT INTO public.crm_tags (nome, cor, cor_fundo, cor_texto, is_system, ativo)
VALUES
  ('Saúde', '#2563EB', '#EFF6FF', '#1D4ED8', true, true),
  ('PME', '#16A34A', '#F0FDF4', '#15803D', true, true),
  ('PF', '#9333EA', '#FAF5FF', '#7E22CE', true, true),
  ('Adesão', '#EA580C', '#FFF7ED', '#C2410C', true, true),
  ('Tráfego pago', '#DB2777', '#FDF2F8', '#BE185D', true, true),
  ('BNI', '#CA8A04', '#FEFCE8', '#A16207', true, true),
  ('Indicação', '#0891B2', '#ECFEFF', '#0E7490', true, true),
  ('Renovação', '#4B5563', '#F3F4F6', '#374151', true, true)
ON CONFLICT (nome) DO NOTHING;

-- 2. TABELA DE SUGESTÕES DE PLANO E COTAÇÕES DA OPORTUNIDADE
CREATE TABLE IF NOT EXISTS public.opportunity_plan_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  carrier_id UUID REFERENCES public.carriers(id) ON DELETE SET NULL,
  carrier_name TEXT NOT NULL,
  product_name TEXT,
  categoria TEXT,
  quoted_monthly_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_principal BOOLEAN NOT NULL DEFAULT false,
  quotation_date DATE DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opp_plan_suggestions_opp ON public.opportunity_plan_suggestions(opportunity_id);

-- 3. TABELA DE BOLETOS DE ADESÃO (1ª MENSALIDADE 100% KKJ)
-- Regra definitiva: 1ª mensalidade de adesão é receita bruta integral da KKJ sem repasse à operadora
CREATE TABLE IF NOT EXISTS public.adesao_boletos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  valor_integral NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'estornado', 'cancelado')),
  receita_bruta_kkj NUMERIC(12,2) NOT NULL,
  aliquota_imposto NUMERIC(5,4) NOT NULL DEFAULT 0.0800,
  valor_imposto NUMERIC(12,2) NOT NULL DEFAULT 0,
  receita_liquida_kkj NUMERIC(12,2) NOT NULL DEFAULT 0,
  comissao_vendedor_percentual NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  comissao_vendedor_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  resultado_liquido_corretora NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adesao_boletos_contract ON public.adesao_boletos(contract_id);
CREATE INDEX IF NOT EXISTS idx_adesao_boletos_status ON public.adesao_boletos(status);

-- 4. TABELA DE CAPTURAS E WEBHOOKS DO META ADS (FACEBOOK / INSTAGRAM)
CREATE TABLE IF NOT EXISTS public.meta_ads_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'Meta',
  form_id TEXT,
  form_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  payload_raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  status_processamento TEXT NOT NULL DEFAULT 'recebido' CHECK (status_processamento IN ('recebido', 'vinculado', 'duplicado', 'erro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. REGRAS GLOBAIS DE COMISSÃO & CONFIGURAÇÕES FINANCEIRAS
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID REFERENCES public.carriers(id) ON DELETE CASCADE,
  carrier_name TEXT NOT NULL,
  modalidade TEXT NOT NULL,
  produto_nome TEXT,
  schedule_parcelas NUMERIC[] NOT NULL DEFAULT '{}',
  vitalicio_percentual NUMERIC(5,2) DEFAULT 0,
  vitalicio_a_partir_de INT DEFAULT NULL,
  aliquota_imposto_padrao NUMERIC(5,4) DEFAULT 0.0800,
  repasse_vendedor_1a_kkj NUMERIC(5,2) DEFAULT 50.00,
  repasse_vendedor_1a_proprio NUMERIC(5,2) DEFAULT 100.00,
  is_special_pme BOOLEAN DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. SNAPSHOT DE COMISSÕES DO CONTRATO
CREATE TABLE IF NOT EXISTS public.contract_commission_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  carrier_name TEXT NOT NULL,
  modalidade TEXT NOT NULL,
  mensalidade_base NUMERIC(12,2) NOT NULL,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. PROGRAMAÇÃO E RECEBIMENTO DE COMISSÕES POR PARCELA
CREATE TABLE IF NOT EXISTS public.commission_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  numero_parcela INT NOT NULL,
  percentual_comissao NUMERIC(5,2) NOT NULL,
  valor_previsto NUMERIC(12,2) NOT NULL,
  valor_recebido NUMERIC(12,2) DEFAULT 0,
  data_prevista DATE,
  data_recebimento DATE,
  status TEXT NOT NULL DEFAULT 'prevista' CHECK (status IN ('prevista', 'liberada', 'recebida', 'atrasada', 'estornada', 'cancelada')),
  repasse_vendedor_previsto NUMERIC(12,2) DEFAULT 0,
  repasse_vendedor_pago NUMERIC(12,2) DEFAULT 0,
  data_repasse_vendedor DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_installments_contract ON public.commission_installments(contract_id);
CREATE INDEX IF NOT EXISTS idx_commission_installments_status ON public.commission_installments(status);

-- 8. POLÍTICAS RLS (SEGURANÇA POR PERFIL SUPABASE)
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_plan_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adesao_boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_commission_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_installments ENABLE ROW LEVEL SECURITY;

-- Tags: leitura aberta a todos autenticados; edição por admin/gestor
DROP POLICY IF EXISTS "Tags visíveis para autenticados" ON public.crm_tags;
CREATE POLICY "Tags visíveis para autenticados" ON public.crm_tags
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Tags gerenciáveis por admin" ON public.crm_tags;
CREATE POLICY "Tags gerenciáveis por admin" ON public.crm_tags
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'gestor'))
  );

-- Sugestões de plano: leitura e escrita para autenticados vinculados
DROP POLICY IF EXISTS "Plan suggestions acessíveis" ON public.opportunity_plan_suggestions;
CREATE POLICY "Plan suggestions acessíveis" ON public.opportunity_plan_suggestions
  FOR ALL TO authenticated USING (true);

-- Boletos de adesão: vendedor vê somente suas vendas; admin/gestor vê tudo
DROP POLICY IF EXISTS "Adesao boletos RLS" ON public.adesao_boletos;
CREATE POLICY "Adesao boletos RLS" ON public.adesao_boletos
  FOR SELECT TO authenticated USING (
    vendedor_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'gestor'))
  );

DROP POLICY IF EXISTS "Adesao boletos mutação por admin" ON public.adesao_boletos;
CREATE POLICY "Adesao boletos mutação por admin" ON public.adesao_boletos
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'gestor'))
  );

-- Regras de comissão: VENDEDOR NUNCA PODE MODIFICAR REGRAS GLOBAIS
DROP POLICY IF EXISTS "Commission rules leitura geral" ON public.commission_rules;
CREATE POLICY "Commission rules leitura geral" ON public.commission_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Commission rules alteração apenas admin" ON public.commission_rules;
CREATE POLICY "Commission rules alteração apenas admin" ON public.commission_rules
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
