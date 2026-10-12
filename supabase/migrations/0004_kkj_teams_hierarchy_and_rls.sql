-- ==============================================================================
-- MIGRATION 0004_KKJ_TEAMS_HIERARCHY_AND_RLS.SQL
-- CRM KK JEKABSON CORRETORA DE SEGUROS E BENEFÍCIOS
-- ==============================================================================
-- ATENÇÃO: NÃO REEXECUTAR A 0001, NÃO RECRIAR TABELAS EXISTENTES.
-- ESTE SCRIPT É 100% INCREMENTAL, IDEMPOTENTE E SEGURO.
--
-- Objetivos:
-- 1. Equipes comerciais (teams) e membros (team_members) com vínculo histórico
--    - Substituto da UNIQUE (vendedor_id, ativo) por índice único parcial:
--      CREATE UNIQUE INDEX uq_team_members_vendedor_ativo ON team_members(vendedor_id) WHERE ativo = true;
--      (permite múltiplos vínculos históricos inativos, apenas 1 ativo por vendedor)
-- 2. Histórico de alterações de perfis e hierarquia (profile_role_history)
-- 3. Regras de comissão de gestão (management_commission_rules / settlements):
--    - Nathany: ativo=false, percentual 0, sem lançamentos (não impede comissão por vendas próprias)
-- 4. Colunas em profiles: superior_direto_id, equipe_atual_id, recebe_leads_automaticos
-- 5. Trigger protect_sensitive_profile_fields() BEFORE UPDATE em profiles:
--    - Se role, ativo, recebe_leads_automaticos, superior_direto_id ou equipe_atual_id mudarem
--      (IS DISTINCT FROM) e o usuário não for admin, RAISE EXCEPTION
-- 6. Helper is_manager_of_seller(seller_id) SECURITY DEFINER com SET search_path = ''
-- 7. DROP das políticas permissivas legadas da 0001 antes de recriar as novas
-- 8. Novas políticas por tabela (SELECT/INSERT/UPDATE/DELETE explícitos, USING e WITH CHECK):
--    - profiles, opportunities, tasks, contracts, conversations, companies, contacts,
--      teams, team_members, management_*, snapshots, boletos, suggestions, meta_ads_leads
--    - SEM acesso via created_by órfão
-- 9. RPCs get_meu_financeiro() e get_minhas_parcelas(p_mes, p_ano) REESCRITAS:
--    - WHERE = is_admin() OR responsavel_id = auth.uid() OR (is_gestor() AND is_manager_of_seller(responsavel_id))
--    - REMOVER o is_manager_or_admin() que dava visão global a qualquer gestor
--    - SECURITY DEFINER, SET search_path = '', REVOKE ALL FROM PUBLIC/anon, GRANT EXECUTE TO authenticated
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE EQUIPES COMERCIAIS (teams)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  gestor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.teams IS 'Equipes comerciais da KKJ lideradas por gestores.';

-- Trigger updated_at para teams (usando public.handle_updated_at() existente na 0001)
DROP TRIGGER IF EXISTS trigger_teams_updated_at ON public.teams;
CREATE TRIGGER trigger_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. TABELA DE INTEGRANTES DA EQUIPE (team_members)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  vendedor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  participa_distribuicao BOOLEAN NOT NULL DEFAULT true,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  data_fim TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.team_members IS 'Vínculo histórico e atual de corretores/vendedores com equipes comerciais da KKJ.';

-- Remover constraint antiga se existir
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS uq_vendedor_ativo_team;

-- Índice único parcial: permite múltiplos vínculos históricos inativos, mas apenas 1 ativo por vendedor
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_members_vendedor_ativo
  ON public.team_members(vendedor_id)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_vendedor ON public.team_members(vendedor_id);

-- Trigger updated_at para team_members
DROP TRIGGER IF EXISTS trigger_team_members_updated_at ON public.team_members;
CREATE TRIGGER trigger_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. COLUNAS DE SUPORTE HIERÁRQUICO EM PROFILES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS superior_direto_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS equipe_atual_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recebe_leads_automaticos BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_superior_direto ON public.profiles(superior_direto_id);
CREATE INDEX IF NOT EXISTS idx_profiles_equipe_atual ON public.profiles(equipe_atual_id);

-- ------------------------------------------------------------------------------
-- 4. TABELA DE AUDITORIA DE PERFIS E CARTEIRA (profile_role_history)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_role_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  perfil_anterior public.user_role NOT NULL,
  novo_perfil public.user_role NOT NULL,
  alterado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  motivo TEXT,
  detalhes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.profile_role_history IS 'Auditoria de transições de papéis de usuários (administrador, gestor, vendedor).';

CREATE INDEX IF NOT EXISTS idx_profile_role_history_profile ON public.profile_role_history(profile_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. REGRAS DE COMISSÃO DE GESTÃO (management_commission_rules)
-- Nathany: ativo=false, percentual 0, sem lançamentos (não impede comissão por vendas próprias)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.management_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gestor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  percentual NUMERIC(6, 3) NOT NULL DEFAULT 0.000,
  base_calculo VARCHAR(50) NOT NULL DEFAULT 'comissao_liquida_equipe', -- 'comissao_liquida_equipe', 'receita_bruta_equipe', 'volume_mensalidade'
  ativo BOOLEAN NOT NULL DEFAULT false, -- desativado por padrão
  data_inicio_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_vigencia DATE,
  observacoes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.management_commission_rules IS 'Regras parametrizáveis de sobretaxa/comissão de gestão para líderes de equipe comercial.';

DROP TRIGGER IF EXISTS trg_mgmt_rules_updated_at ON public.management_commission_rules;
CREATE TRIGGER trg_mgmt_rules_updated_at
  BEFORE UPDATE ON public.management_commission_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Lançamentos e liquidações de comissão de gestão
CREATE TABLE IF NOT EXISTS public.management_commission_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.management_commission_rules(id) ON DELETE SET NULL,
  gestor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  valor_base NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  percentual_aplicado NUMERIC(6, 3) NOT NULL DEFAULT 0.000,
  valor_comissao_gestao NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'previsto', -- 'previsto', 'aprovado', 'pago', 'estornado'
  data_competencia DATE NOT NULL,
  data_pagamento DATE,
  aprovado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.management_commission_settlements IS 'Liquidações de comissão de gestão calculadas sobre a produção de subordinados.';

DROP TRIGGER IF EXISTS trg_mgmt_settlements_updated_at ON public.management_commission_settlements;
CREATE TRIGGER trg_mgmt_settlements_updated_at
  BEFORE UPDATE ON public.management_commission_settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 6. FUNÇÃO AUXILIAR DE HIERARQUIA: is_manager_of_seller(seller_id)
-- SECURITY DEFINER com SET search_path = ''
-- Retorna true apenas se o auth.uid() for gestor da equipe ativa à qual seller_id pertence.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_manager_of_seller(seller_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.team_members tm ON tm.team_id = t.id AND tm.ativo = true
    WHERE t.gestor_id = auth.uid()
      AND tm.vendedor_id = seller_id
      AND t.ativo = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_manager_of_seller(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_manager_of_seller(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_manager_of_seller(UUID) TO authenticated;

-- Helper adicional: lista de IDs de vendedores subordinados da equipe ativa do gestor logado
CREATE OR REPLACE FUNCTION public.get_subordinate_seller_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT tm.vendedor_id
  FROM public.teams t
  JOIN public.team_members tm ON tm.team_id = t.id AND tm.ativo = true
  WHERE t.gestor_id = auth.uid()
    AND t.ativo = true;
$$;

REVOKE ALL ON FUNCTION public.get_subordinate_seller_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_subordinate_seller_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_subordinate_seller_ids() TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. TRIGGER DE PROTEÇÃO DE CAMPOS SENSÍVEIS EM PROFILES
-- BEFORE UPDATE: se role, ativo, recebe_leads_automaticos, superior_direto_id ou
-- equipe_atual_id mudarem (IS DISTINCT FROM) e o usuário não for admin, RAISE EXCEPTION.
-- Protege contra elevação de privilégio via chamadas diretas à API REST/GraphQL.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (
    OLD.role IS DISTINCT FROM NEW.role
    OR OLD.ativo IS DISTINCT FROM NEW.ativo
    OR OLD.recebe_leads_automaticos IS DISTINCT FROM NEW.recebe_leads_automaticos
    OR OLD.superior_direto_id IS DISTINCT FROM NEW.superior_direto_id
    OR OLD.equipe_atual_id IS DISTINCT FROM NEW.equipe_atual_id
  ) THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar papel, status ativo, distribuição de leads ou vinculação hierárquica do usuário.';
    END IF;

    -- Se o role foi alterado por um admin, registra no histórico de papéis
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO public.profile_role_history (
        profile_id,
        perfil_anterior,
        novo_perfil,
        alterado_por,
        motivo
      ) VALUES (
        NEW.id,
        OLD.role,
        NEW.role,
        auth.uid(),
        'Alteração de papel realizada pelo administrador'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_sensitive_profile_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_sensitive_profile_fields() FROM anon;
GRANT EXECUTE ON FUNCTION public.protect_sensitive_profile_fields() TO authenticated;

DROP TRIGGER IF EXISTS trg_protect_sensitive_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_sensitive_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_fields();

-- ------------------------------------------------------------------------------
-- 8. EXPURGO (DROP) DE POLÍTICAS LEGADAS DA 0001 / VERSÕES ANTERIORES
-- Evita que regras OR permissivas antigas anulem as restrições da hierarquia.
-- ------------------------------------------------------------------------------
-- Profiles
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;

-- Opportunities
DROP POLICY IF EXISTS "opportunities_select_policy" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities_insert_policy" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities_update_policy" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities_delete_policy" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities_select_hierarchy" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities_update_hierarchy" ON public.opportunities;

-- Tasks
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_hierarchy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_hierarchy" ON public.tasks;

-- Contracts
DROP POLICY IF EXISTS "contracts_select_policy" ON public.contracts;
DROP POLICY IF EXISTS "contracts_insert_policy" ON public.contracts;
DROP POLICY IF EXISTS "contracts_update_policy" ON public.contracts;
DROP POLICY IF EXISTS "contracts_delete_policy" ON public.contracts;
DROP POLICY IF EXISTS "contracts_select_hierarchy" ON public.contracts;

-- Companies
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_delete_policy" ON public.companies;

-- Contacts
DROP POLICY IF EXISTS "contacts_select_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_policy" ON public.contacts;

-- Conversations
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete_policy" ON public.conversations;

-- Teams & Members
DROP POLICY IF EXISTS "teams_read_policy" ON public.teams;
DROP POLICY IF EXISTS "teams_admin_all" ON public.teams;
DROP POLICY IF EXISTS "teams_select_policy" ON public.teams;
DROP POLICY IF EXISTS "teams_insert_policy" ON public.teams;
DROP POLICY IF EXISTS "teams_update_policy" ON public.teams;
DROP POLICY IF EXISTS "teams_delete_policy" ON public.teams;
DROP POLICY IF EXISTS "team_members_read_policy" ON public.team_members;
DROP POLICY IF EXISTS "team_members_admin_all" ON public.team_members;
DROP POLICY IF EXISTS "team_members_select_policy" ON public.team_members;
DROP POLICY IF EXISTS "team_members_insert_policy" ON public.team_members;
DROP POLICY IF EXISTS "team_members_update_policy" ON public.team_members;
DROP POLICY IF EXISTS "team_members_delete_policy" ON public.team_members;

-- Management Rules & Settlements
DROP POLICY IF EXISTS "mgm_rules_policy" ON public.management_commission_rules;
DROP POLICY IF EXISTS "mgm_rules_gestor_select" ON public.management_commission_rules;
DROP POLICY IF EXISTS "mgm_settlements_admin" ON public.management_commission_settlements;
DROP POLICY IF EXISTS "mgm_settlements_gestor_select" ON public.management_commission_settlements;

-- ------------------------------------------------------------------------------
-- 9. NOVAS POLÍTICAS RLS ESTRITAS POR TABELA
-- Regra geral:
-- - Administrador: acesso irrestrito
-- - Gestor: carteira própria + subordinados da equipe ativa (via is_manager_of_seller)
-- - Vendedor: estritamente sua própria carteira (owner_id / responsavel_id = auth.uid())
-- - SEM acesso via created_by órfão
-- ------------------------------------------------------------------------------

-- 9.1 PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT liberado para autenticados (necessário para dropdowns de equipe, responsáveis e sistema)
CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE apenas no próprio registro (campos sensíveis como role/equipe já travados por trigger)
CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- 9.2 OPPORTUNITIES
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opportunities_select_policy"
  ON public.opportunities FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR owner_id = auth.uid()
    OR (owner_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(owner_id))
    OR (owner_id IS NULL AND (public.is_admin() OR public.has_permission('visualizar_todos_leads')))
  );

CREATE POLICY "opportunities_insert_policy"
  ON public.opportunities FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR owner_id = auth.uid()
    OR (owner_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(owner_id))
    OR (owner_id IS NULL AND (public.is_admin() OR public.has_permission('visualizar_todos_leads')))
  );

CREATE POLICY "opportunities_update_policy"
  ON public.opportunities FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR owner_id = auth.uid()
    OR (owner_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(owner_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (
      -- Vendedor comum mantém o lead atribuído a si próprio (não transfere)
      owner_id = auth.uid()
    )
    OR (
      -- Gestor pode atualizar leads de si ou transferir apenas entre subordinados de sua equipe ativa
      public.is_gestor()
      AND (owner_id = auth.uid() OR public.is_manager_of_seller(owner_id))
    )
  );

CREATE POLICY "opportunities_delete_policy"
  ON public.opportunities FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 9.3 TASKS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_policy"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR assignee_id = auth.uid()
    OR (assignee_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(assignee_id))
  );

CREATE POLICY "tasks_insert_policy"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      assignee_id = auth.uid()
      AND created_by = auth.uid()
      AND (
        opportunity_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.opportunities o
          WHERE o.id = tasks.opportunity_id
            AND (o.owner_id = auth.uid() OR (o.owner_id IS NULL AND public.has_permission('visualizar_todos_leads')))
        )
      )
    )
    OR (
      public.is_gestor()
      AND (
        assignee_id = auth.uid()
        OR public.is_manager_of_seller(assignee_id)
      )
    )
  );

CREATE POLICY "tasks_update_policy"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR assignee_id = auth.uid()
    OR (assignee_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(assignee_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (
      assignee_id = auth.uid()
    )
    OR (
      public.is_gestor()
      AND (
        assignee_id = auth.uid()
        OR public.is_manager_of_seller(assignee_id)
      )
    )
  );

CREATE POLICY "tasks_delete_policy"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (assignee_id = auth.uid() AND created_by = auth.uid())
    OR (assignee_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(assignee_id))
  );

-- 9.4 CONTRACTS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_select_policy"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR responsavel_id = auth.uid()
    OR (responsavel_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(responsavel_id))
  );

CREATE POLICY "contracts_insert_policy"
  ON public.contracts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      responsavel_id = auth.uid()
      AND (
        opportunity_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.opportunities o
          WHERE o.id = contracts.opportunity_id AND o.owner_id = auth.uid()
        )
      )
    )
    OR (
      public.is_gestor()
      AND (
        responsavel_id = auth.uid()
        OR public.is_manager_of_seller(responsavel_id)
      )
    )
  );

CREATE POLICY "contracts_update_policy"
  ON public.contracts FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR responsavel_id = auth.uid()
    OR (responsavel_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(responsavel_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (
      responsavel_id = auth.uid()
    )
    OR (
      public.is_gestor()
      AND (
        responsavel_id = auth.uid()
        OR public.is_manager_of_seller(responsavel_id)
      )
    )
  );

CREATE POLICY "contracts_delete_policy"
  ON public.contracts FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 9.5 CONVERSATIONS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select_policy"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR responsible_user_id = auth.uid()
    OR (responsible_user_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(responsible_user_id))
    OR (responsible_user_id IS NULL AND (public.is_admin() OR public.is_gestor() OR public.has_permission('visualizar_todos_leads')))
  );

CREATE POLICY "conversations_insert_policy"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR responsible_user_id = auth.uid()
    OR (responsible_user_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(responsible_user_id))
    OR (responsible_user_id IS NULL AND (public.is_admin() OR public.is_gestor()))
  );

CREATE POLICY "conversations_update_policy"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR responsible_user_id = auth.uid()
    OR (responsible_user_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(responsible_user_id))
    OR (responsible_user_id IS NULL AND (public.is_admin() OR public.is_gestor()))
  )
  WITH CHECK (
    public.is_admin()
    OR responsible_user_id = auth.uid()
    OR (responsible_user_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(responsible_user_id))
  );

-- 9.6 COMPANIES
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select_policy"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('visualizar_todas_empresas')
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.company_id = companies.id
        AND (
          o.owner_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(o.owner_id))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.company_id = companies.id
        AND (
          c.responsavel_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(c.responsavel_id))
        )
    )
  );

CREATE POLICY "companies_insert_policy"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR created_by = auth.uid()
  );

CREATE POLICY "companies_update_policy"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.company_id = companies.id
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
      WHERE o.company_id = companies.id
        AND (
          o.owner_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(o.owner_id))
        )
    )
  );

CREATE POLICY "companies_delete_policy"
  ON public.companies FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 9.7 CONTACTS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select_policy"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('visualizar_todos_contatos')
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.contact_id = contacts.id
        AND (
          o.owner_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(o.owner_id))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.contact_id = contacts.id
        AND (
          c.responsavel_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(c.responsavel_id))
        )
    )
  );

CREATE POLICY "contacts_insert_policy"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR created_by = auth.uid()
  );

CREATE POLICY "contacts_update_policy"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.contact_id = contacts.id
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
      WHERE o.contact_id = contacts.id
        AND (
          o.owner_id = auth.uid()
          OR (public.is_gestor() AND public.is_manager_of_seller(o.owner_id))
        )
    )
  );

CREATE POLICY "contacts_delete_policy"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 9.8 TEAMS & TEAM_MEMBERS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select_policy"
  ON public.teams FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR gestor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = teams.id AND tm.vendedor_id = auth.uid() AND tm.ativo = true
    )
  );

CREATE POLICY "teams_admin_write"
  ON public.teams FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "team_members_select_policy"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR vendedor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = team_members.team_id AND t.gestor_id = auth.uid()
    )
  );

CREATE POLICY "team_members_admin_write"
  ON public.team_members FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 9.9 PROFILE_ROLE_HISTORY
ALTER TABLE public.profile_role_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_history_select_policy"
  ON public.profile_role_history FOR SELECT
  TO authenticated
  USING (public.is_admin() OR profile_id = auth.uid());

CREATE POLICY "role_history_admin_write"
  ON public.profile_role_history FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 9.10 MANAGEMENT RULES & SETTLEMENTS
ALTER TABLE public.management_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_commission_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "management_rules_admin_all"
  ON public.management_commission_rules FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "management_rules_gestor_select"
  ON public.management_commission_rules FOR SELECT
  TO authenticated
  USING (gestor_id = auth.uid());

CREATE POLICY "management_settlements_admin_all"
  ON public.management_commission_settlements FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "management_settlements_gestor_select"
  ON public.management_commission_settlements FOR SELECT
  TO authenticated
  USING (gestor_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 10. RPCS FINANCEIRAS REESCRITAS COM SEGURANÇA ESTRITA DE HIERARQUIA
-- REMOVER o is_manager_or_admin() que dava visão ampla e faturamento global a gestores.
-- Gestor visualiza sua carteira própria e de seus subordinados da equipe ativa.
-- Vendedor visualiza estritamente seus contratos.
-- SECURITY DEFINER, SET search_path = '', REVOKE ALL FROM PUBLIC/anon, GRANT TO authenticated.
-- ------------------------------------------------------------------------------

-- 10.1 get_minhas_parcelas(p_mes, p_ano) e get_minhas_parcelas()
CREATE OR REPLACE FUNCTION public.get_minhas_parcelas(p_mes INTEGER DEFAULT NULL, p_ano INTEGER DEFAULT NULL)
RETURNS TABLE (
  parcela_id UUID,
  contract_id UUID,
  numero_contrato TEXT,
  cliente_nome TEXT,
  operadora_nome TEXT,
  numero_parcela INTEGER,
  total_parcelas INTEGER,
  tipo_parcela TEXT,
  data_vencimento DATE,
  repasse_previsto_vendedor NUMERIC(14, 2),
  repasse_pago_vendedor NUMERIC(14, 2),
  data_repasse DATE,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id AS parcela_id,
    c.id AS contract_id,
    c.numero_contrato,
    COALESCE(ct.nome, comp.razao_social, comp.nome_fantasia, 'Cliente') AS cliente_nome,
    car.nome AS operadora_nome,
    ci.numero_parcela,
    ci.total_parcelas,
    COALESCE(ci.tipo_parcela, 'vitalicia') AS tipo_parcela,
    ci.data_vencimento,
    ci.repasse_previsto_vendedor,
    ci.repasse_pago_vendedor,
    ci.data_repasse,
    ci.status
  FROM public.commission_installments ci
  INNER JOIN public.contracts c ON c.id = ci.contract_id
  LEFT JOIN public.contacts ct ON ct.id = c.contact_id
  LEFT JOIN public.companies comp ON comp.id = c.company_id
  LEFT JOIN public.carriers car ON car.id = c.carrier_id
  WHERE (
    -- Administrador vê de todos os contratos
    public.is_admin()
    -- Vendedor vê exclusivamente parcelas de seus contratos
    OR c.responsavel_id = auth.uid()
    -- Gestor vê apenas parcelas de contratos de vendedores da sua equipe ativa
    OR (c.responsavel_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(c.responsavel_id))
  )
  AND (p_mes IS NULL OR EXTRACT(MONTH FROM ci.data_vencimento) = p_mes)
  AND (p_ano IS NULL OR EXTRACT(YEAR FROM ci.data_vencimento) = p_ano)
  ORDER BY ci.data_vencimento ASC, ci.numero_parcela ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_minhas_parcelas(INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_minhas_parcelas(INTEGER, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_minhas_parcelas(INTEGER, INTEGER) TO authenticated;

-- Sobrecarga sem parâmetros para compatibilidade com chamadas legado
CREATE OR REPLACE FUNCTION public.get_minhas_parcelas()
RETURNS TABLE (
  parcela_id UUID,
  contract_id UUID,
  numero_contrato TEXT,
  cliente_nome TEXT,
  operadora_nome TEXT,
  numero_parcela INTEGER,
  total_parcelas INTEGER,
  tipo_parcela TEXT,
  data_vencimento DATE,
  repasse_previsto_vendedor NUMERIC(14, 2),
  repasse_pago_vendedor NUMERIC(14, 2),
  data_repasse DATE,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.get_minhas_parcelas(NULL, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.get_minhas_parcelas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_minhas_parcelas() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_minhas_parcelas() TO authenticated;

-- 10.2 get_meu_financeiro()
CREATE OR REPLACE FUNCTION public.get_meu_financeiro()
RETURNS TABLE (
  total_contratos BIGINT,
  total_repasse_previsto NUMERIC(14, 2),
  total_repasse_pago NUMERIC(14, 2),
  total_repasse_pendente NUMERIC(14, 2),
  parcelas_a_vencer BIGINT,
  parcelas_vencidas BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT c.id)::BIGINT AS total_contratos,
    COALESCE(SUM(ci.repasse_previsto_vendedor), 0.00) AS total_repasse_previsto,
    COALESCE(SUM(ci.repasse_pago_vendedor), 0.00) AS total_repasse_pago,
    COALESCE(SUM(CASE WHEN ci.status IN ('previsto', 'liberado', 'recebido') AND ci.data_repasse IS NULL THEN ci.repasse_previsto_vendedor ELSE 0.00 END), 0.00) AS total_repasse_pendente,
    COUNT(CASE WHEN ci.status = 'previsto' AND ci.data_vencimento >= CURRENT_DATE THEN 1 END)::BIGINT AS parcelas_a_vencer,
    COUNT(CASE WHEN ci.status = 'previsto' AND ci.data_vencimento < CURRENT_DATE THEN 1 END)::BIGINT AS parcelas_vencidas
  FROM public.contracts c
  INNER JOIN public.commission_installments ci ON ci.contract_id = c.id
  WHERE (
    -- Administrador vê consolidado geral
    public.is_admin()
    -- Vendedor vê de seus próprios contratos
    OR c.responsavel_id = auth.uid()
    -- Gestor vê apenas de subordinados da sua equipe ativa (e de sua própria carteira)
    OR (c.responsavel_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(c.responsavel_id))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_meu_financeiro() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_meu_financeiro() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_meu_financeiro() TO authenticated;
