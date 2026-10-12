-- ==============================================================================
-- MIGRATION 0004_KKJ_TEAMS_HIERARCHY_AND_RLS.SQL
-- CRM KK JEKABSON CORRETORA DE SEGUROS E BENEFÍCIOS
-- ==============================================================================
-- ATENÇÃO: NÃO REEXECUTAR A 0001, NÃO RECRIAR TABELAS EXISTENTES.
-- ESTE SCRIPT É 100% INCREMENTAL, IDEMPOTENTE E SEGURO.
--
-- Objetivos:
-- 1. Equipes comerciais (teams) e membros (team_members) com vínculo hierárquico
-- 2. Histórico de alterações de perfis e hierarquia (profile_role_history)
-- 3. Regras de comissão de gestão configuráveis por gestor (management_commission_rules / logs)
-- 4. Funções auxiliares de hierarquia segura no banco (RLS)
-- 5. Atualização de políticas RLS em opportunities, tasks, contracts e financeiro:
--    - Administrador acessa tudo e pode vender / ser responsável
--    - Gestor acessa sua própria carteira + subordinados da sua equipe ativa
--    - Nathany não acessa Eliana enquanto Eliana estiver vinculada diretamente ao administrador
--    - Vendedor acessa estritamente seus próprios dados
-- ==============================================================================

-- 1. TABELA DE EQUIPES COMERCIAIS
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    gestor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Gatilho updated_at para teams
DROP TRIGGER IF EXISTS trigger_teams_updated_at ON public.teams;
CREATE TRIGGER trigger_teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 2. TABELA DE INTEGRANTES DA EQUIPE (VENDEDORES)
-- Regra de negócio: cada vendedor só pode ter UMA equipe ativa por vez
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ativo BOOLEAN NOT NULL DEFAULT true,
    participa_distribuicao BOOLEAN NOT NULL DEFAULT true,
    data_inicio TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    data_fim TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_vendedor_ativo_team UNIQUE (vendedor_id, ativo)
);

-- Gatilho updated_at para team_members
DROP TRIGGER IF EXISTS trigger_team_members_updated_at ON public.team_members;
CREATE TRIGGER trigger_team_members_updated_at
    BEFORE UPDATE ON public.team_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar colunas de suporte hierárquico em profiles se não existirem
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS superior_direto_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS equipe_atual_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recebe_leads_automaticos BOOLEAN DEFAULT true;

-- 3. AUDITORIA DE ALTERAÇÃO DE PERFIS E CARTEIRA (profile_role_history)
CREATE TABLE IF NOT EXISTS public.profile_role_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    perfil_anterior public.user_role NOT NULL,
    novo_perfil public.user_role NOT NULL,
    alterado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    motivo TEXT,
    detalhes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. REGRAS DE COMISSÃO DE GESTÃO (Configurável via UI, sem alterar código)
-- Inicialmente desativada para Nathany (0%), preservada e flexível para o futuro
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 5. FUNÇÕES AUXILIARES DE SEGURANÇA E HIERARQUIA NO BANCO
-- Helper: Retorna se o usuário logado é gestor do vendedor em questão através da equipe ativa
CREATE OR REPLACE FUNCTION public.is_manager_of_seller(seller_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
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

-- Helper: Lista de IDs de vendedores subordinados ao usuário logado (gestor)
CREATE OR REPLACE FUNCTION public.get_subordinate_seller_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT tm.vendedor_id
    FROM public.teams t
    JOIN public.team_members tm ON tm.team_id = t.id AND tm.ativo = true
    WHERE t.gestor_id = auth.uid()
      AND t.ativo = true;
$$;

-- Helper: Verifica se o usuário tem permissão de leitura sobre um registro específico (owner_id)
-- Administrador: tudo
-- Gestor: seus próprios registros + subordinados da sua equipe ativa
-- Vendedor: somente seus próprios registros
CREATE OR REPLACE FUNCTION public.can_access_user_data(record_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    -- Se for o próprio dono do registro
    IF auth.uid() = record_owner_id THEN
        RETURN true;
    END IF;

    -- Se for administrador
    IF public.is_admin() THEN
        RETURN true;
    END IF;

    -- Se for gestor e o dono do registro for um vendedor de sua equipe
    IF public.is_gestor() AND public.is_manager_of_seller(record_owner_id) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- 6. HABILITAR RLS NAS NOVAS TABELAS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_role_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_commission_settlements ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS RLS PARA TEAMS
DROP POLICY IF EXISTS "teams_read_policy" ON public.teams;
CREATE POLICY "teams_read_policy" ON public.teams
    FOR SELECT
    USING (
        public.is_admin()
        OR gestor_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.team_members tm 
            WHERE tm.team_id = teams.id AND tm.vendedor_id = auth.uid() AND tm.ativo = true
        )
    );

DROP POLICY IF EXISTS "teams_admin_all" ON public.teams;
CREATE POLICY "teams_admin_all" ON public.teams
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8. POLÍTICAS RLS PARA TEAM_MEMBERS
DROP POLICY IF EXISTS "team_members_read_policy" ON public.team_members;
CREATE POLICY "team_members_read_policy" ON public.team_members
    FOR SELECT
    USING (
        public.is_admin()
        OR vendedor_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.teams t 
            WHERE t.id = team_members.team_id AND t.gestor_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "team_members_admin_all" ON public.team_members;
CREATE POLICY "team_members_admin_all" ON public.team_members
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 9. POLÍTICAS RLS PARA PROFILE_ROLE_HISTORY
DROP POLICY IF EXISTS "role_history_read_policy" ON public.profile_role_history;
CREATE POLICY "role_history_read_policy" ON public.profile_role_history
    FOR SELECT
    USING (public.is_admin() OR profile_id = auth.uid());

DROP POLICY IF EXISTS "role_history_admin_insert" ON public.profile_role_history;
CREATE POLICY "role_history_admin_insert" ON public.profile_role_history
    FOR INSERT
    WITH CHECK (public.is_admin());

-- 10. POLÍTICAS RLS PARA COMISSÃO DE GESTÃO
DROP POLICY IF EXISTS "mgm_rules_policy" ON public.management_commission_rules;
CREATE POLICY "mgm_rules_policy" ON public.management_commission_rules
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "mgm_rules_gestor_select" ON public.management_commission_rules;
CREATE POLICY "mgm_rules_gestor_select" ON public.management_commission_rules
    FOR SELECT
    USING (gestor_id = auth.uid());

DROP POLICY IF EXISTS "mgm_settlements_admin" ON public.management_commission_settlements;
CREATE POLICY "mgm_settlements_admin" ON public.management_commission_settlements
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "mgm_settlements_gestor_select" ON public.management_commission_settlements;
CREATE POLICY "mgm_settlements_gestor_select" ON public.management_commission_settlements
    FOR SELECT
    USING (gestor_id = auth.uid());

-- 11. ATUALIZAR POLÍTICAS RLS NAS TABELAS PRINCIPAIS RESPEITANDO A HIERARQUIA
-- A) OPPORTUNITIES:
DROP POLICY IF EXISTS "opportunities_select_hierarchy" ON public.opportunities;
CREATE POLICY "opportunities_select_hierarchy" ON public.opportunities
    FOR SELECT
    USING (
        public.is_admin()
        OR owner_id = auth.uid()
        OR created_by = auth.uid()
        OR (owner_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(owner_id))
    );

DROP POLICY IF EXISTS "opportunities_update_hierarchy" ON public.opportunities;
CREATE POLICY "opportunities_update_hierarchy" ON public.opportunities
    FOR UPDATE
    USING (
        public.is_admin()
        OR owner_id = auth.uid()
        OR (owner_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(owner_id))
    )
    WITH CHECK (
        public.is_admin()
        OR owner_id = auth.uid()
        OR (owner_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(owner_id))
    );

-- B) TASKS:
DROP POLICY IF EXISTS "tasks_select_hierarchy" ON public.tasks;
CREATE POLICY "tasks_select_hierarchy" ON public.tasks
    FOR SELECT
    USING (
        public.is_admin()
        OR assignee_id = auth.uid()
        OR created_by = auth.uid()
        OR (assignee_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(assignee_id))
    );

DROP POLICY IF EXISTS "tasks_update_hierarchy" ON public.tasks;
CREATE POLICY "tasks_update_hierarchy" ON public.tasks
    FOR UPDATE
    USING (
        public.is_admin()
        OR assignee_id = auth.uid()
        OR (assignee_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(assignee_id))
    )
    WITH CHECK (
        public.is_admin()
        OR assignee_id = auth.uid()
        OR (assignee_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(assignee_id))
    );

-- C) CONTRACTS:
DROP POLICY IF EXISTS "contracts_select_hierarchy" ON public.contracts;
CREATE POLICY "contracts_select_hierarchy" ON public.contracts
    FOR SELECT
    USING (
        public.is_admin()
        OR responsavel_id = auth.uid()
        OR created_by = auth.uid()
        OR (responsavel_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(responsavel_id))
    );

-- D) PROFILES:
-- Todo usuário autenticado pode ver id, nome, email e role para atribuição/seleção
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Atualização de perfil: apenas o próprio usuário (campos básicos) ou administrador (tudo, inclusive role)
DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (
        (auth.uid() = id AND (public.is_admin() OR role = (SELECT role FROM public.profiles WHERE id = auth.uid())))
        OR public.is_admin()
    );
