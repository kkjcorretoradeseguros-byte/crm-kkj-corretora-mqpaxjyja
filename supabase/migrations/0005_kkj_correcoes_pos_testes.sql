-- ==============================================================================
-- CRM KKJ CORRETORA - CORREÇÕES PÓS-TESTES REAIS
-- Migration Incremental: 0005_kkj_correcoes_pos_testes.sql
-- Estado: IDEMPOTENTE, incremental, segura para execução posterior no Supabase.
-- ATENÇÃO: NÃO EXECUTADA AUTOMATICAMENTE (entregue como arquivo de migração).
-- ==============================================================================

-- 1. Ampliação do ENUM public.timeline_action_type
-- Valores adicionais para cobrir os eventos de fechamento, implantação, repescagem e cancelamento.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timeline_action_type') THEN
    BEGIN
      ALTER TYPE public.timeline_action_type ADD VALUE IF NOT EXISTS 'repescagem';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.timeline_action_type ADD VALUE IF NOT EXISTS 'reabertura';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.timeline_action_type ADD VALUE IF NOT EXISTS 'pagamento_confirmado';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.timeline_action_type ADD VALUE IF NOT EXISTS 'implantado';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.timeline_action_type ADD VALUE IF NOT EXISTS 'cancelamento_admin';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.timeline_action_type ADD VALUE IF NOT EXISTS 'pos_venda';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.timeline_action_type ADD VALUE IF NOT EXISTS 'temperatura_alterada';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.timeline_action_type ADD VALUE IF NOT EXISTS 'tarefa_criada';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.timeline_action_type ADD VALUE IF NOT EXISTS 'tarefa_concluida';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.timeline_action_type ADD VALUE IF NOT EXISTS 'tarefa_cancelada';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 2. Colunas de marcos temporais e auditoria na tabela public.contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS data_vencimento_primeiro_pagamento DATE,
  ADD COLUMN IF NOT EXISTS data_confirmacao_pagamento DATE,
  ADD COLUMN IF NOT EXISTS usuario_confirmou_pagamento_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usuario_implantacao_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primeira_competencia TEXT;

COMMENT ON COLUMN public.contracts.data_vencimento_primeiro_pagamento IS 'Data de vencimento do primeiro boleto / pagamento da 1ª mensalidade.';
COMMENT ON COLUMN public.contracts.data_confirmacao_pagamento IS 'Data efetiva em que o 1º pagamento foi confirmado.';
COMMENT ON COLUMN public.contracts.usuario_confirmou_pagamento_id IS 'Usuário responsável por atestar a confirmação do 1º pagamento.';
COMMENT ON COLUMN public.contracts.usuario_implantacao_id IS 'Usuário que moveu o contrato para Implantado / ativou no pós-venda.';
COMMENT ON COLUMN public.contracts.primeira_competencia IS 'Competência de referência da 1ª mensalidade (YYYY-MM).';

-- 3. Atualização da policy de inserção em public.opportunity_timeline
-- Permite que usuários autenticados gravem notas e eventos padronizados autorizados,
-- mantendo a proteção contra adulteração de autoria e append-only.
DROP POLICY IF EXISTS "timeline_insert_policy" ON public.opportunity_timeline;
CREATE POLICY "timeline_insert_policy" ON public.opportunity_timeline FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_manager_or_admin()
      OR EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_timeline.opportunity_id
          AND (o.owner_id = auth.uid() OR (o.owner_id IS NULL AND public.has_permission('visualizar_todos_leads')))
      )
    )
  );

-- 4. Reforço de RLS para DELETE: exclusão física permitida ESTRITAMENTE para ADMINISTRADOR
-- Garante via banco que vendedores e gestores não consigam deletar registros mesmo via API Supabase direta.
DROP POLICY IF EXISTS "opportunities_delete_admin_only" ON public.opportunities;
CREATE POLICY "opportunities_delete_admin_only" ON public.opportunities FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "companies_delete_policy" ON public.companies;
CREATE POLICY "companies_delete_policy" ON public.companies FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "contacts_delete_policy" ON public.contacts;
CREATE POLICY "contacts_delete_policy" ON public.contacts FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "contracts_delete_policy" ON public.contracts;
CREATE POLICY "contracts_delete_policy" ON public.contracts FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5. Garantir etapas de 'Repescagem' e 'Perdido' no Funil de Vendas em public.pipeline_stages
DO $$
BEGIN
  -- Repescagem no Funil de Vendas (apenas se ainda não existir)
  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages
    WHERE funnel_type = 'vendas' AND lower(trim(nome)) = 'repescagem'
  ) THEN
    INSERT INTO public.pipeline_stages (
      funnel_type,
      nome,
      ordem,
      e_saida,
      is_fechamento,
      ativo
    ) VALUES (
      'vendas',
      'Repescagem',
      8,
      false,
      false,
      true
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Perdido no Funil de Vendas
  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages
    WHERE funnel_type = 'vendas' AND lower(trim(nome)) IN ('perdido', 'venda perdida')
  ) THEN
    INSERT INTO public.pipeline_stages (
      funnel_type,
      nome,
      ordem,
      e_saida,
      is_fechamento,
      ativo
    ) VALUES (
      'vendas',
      'Perdido',
      9,
      true,
      false,
      true
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;
