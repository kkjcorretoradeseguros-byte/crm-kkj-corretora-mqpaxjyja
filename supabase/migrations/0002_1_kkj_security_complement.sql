-- ==============================================================================
-- MIGRAÇÃO 0002.1 (CORREÇÃO COMPLEMENTAR DA 0002):
-- REFORÇO ESTRITO DE SEGURANÇA, TRIGGERS DE INTEGRIDADE EM INSERT E UPDATE,
-- TRATAMENTO DE NULOS COM IS DISTINCT FROM E CONFERÊNCIA DE COLUNAS
-- Compatível com Schema 0001 (32 tabelas), 0002, 0003 e 0004 | Idempotente | Não destrutiva
-- NÃO EXECUTAR AUTOMATICAMENTE: o cliente aplica via SQL Editor do Supabase se necessário.
-- ==============================================================================

-- 1. CONFERÊNCIA E GARANTIA DAS COLUNAS DE ETAPAS (funnel_type, is_fechamento)
-- A 0001 já criou funnel_type e is_fechamento em pipeline_stages.
-- Asseguramos a existência e índices parciais sem recriação.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pipeline_stages' AND column_name = 'funnel_type'
  ) THEN
    ALTER TABLE public.pipeline_stages ADD COLUMN funnel_type public.funnel_type NOT NULL DEFAULT 'vendas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pipeline_stages' AND column_name = 'is_fechamento'
  ) THEN
    ALTER TABLE public.pipeline_stages ADD COLUMN is_fechamento BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_fechamento
  ON public.pipeline_stages(funnel_type, is_fechamento)
  WHERE is_fechamento = true;

-- 2. REVISÃO INTEGRAL DO TRIGGER DE TAREFAS (tasks):
-- Protege tanto em INSERT quanto em UPDATE:
-- - Vendedor não pode criar tarefa atribuída a outro vendedor (assignee_id <> auth.uid()).
-- - Vendedor não pode transferir tarefa atribuída a outro usuário (IS DISTINCT FROM).
-- - Vendedor não pode alterar criador original (created_by IS DISTINCT FROM).
-- - Vendedor não pode vincular tarefa a oportunidade de outro corretor (nem no INSERT nem no UPDATE).
-- - Gestores e administradores possuem permissão de delegação.
CREATE OR REPLACE FUNCTION public.check_task_security_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_manager_or_admin() THEN
    -- Regras para INSERT
    IF TG_OP = 'INSERT' THEN
      -- Criador deve ser o próprio usuário autenticado se preenchido
      IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'O criador da tarefa deve ser o próprio usuário autenticado.';
      END IF;

      -- Vendedor comum só pode criar tarefa para si mesmo
      IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Vendedores não possuem permissão para atribuir tarefas a outros corretores.';
      END IF;

      -- Não pode vincular a oportunidade de outro corretor
      IF NEW.opportunity_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.opportunities o
          WHERE o.id = NEW.opportunity_id
            AND (o.owner_id = auth.uid() OR (o.owner_id IS NULL AND public.has_permission('visualizar_todos_leads')))
        ) THEN
          RAISE EXCEPTION 'Não é permitido vincular tarefa a uma oportunidade de outro corretor.';
        END IF;
      END IF;

    -- Regras para UPDATE
    ELSIF TG_OP = 'UPDATE' THEN
      -- Vendedor não pode transferir a tarefa para outro usuário
      IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
        RAISE EXCEPTION 'Vendedores não possuem permissão para transferir tarefas para outros corretores.';
      END IF;

      -- Vendedor não pode alterar o autor original
      IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
        RAISE EXCEPTION 'Não é permitido alterar o criador original da tarefa.';
      END IF;

      -- Vendedor não pode mover a tarefa para oportunidade de outro usuário
      IF OLD.opportunity_id IS DISTINCT FROM NEW.opportunity_id AND NEW.opportunity_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.opportunities o
          WHERE o.id = NEW.opportunity_id
            AND (o.owner_id = auth.uid() OR (o.owner_id IS NULL AND public.has_permission('visualizar_todos_leads')))
        ) THEN
          RAISE EXCEPTION 'Não é permitido vincular tarefa a uma oportunidade de outro corretor.';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_task_security_rules() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_task_security_rules() FROM anon;
GRANT EXECUTE ON FUNCTION public.check_task_security_rules() TO authenticated;

DROP TRIGGER IF EXISTS trg_check_task_security ON public.tasks;
CREATE TRIGGER trg_check_task_security
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_task_security_rules();

-- 3. REVISÃO INTEGRAL DO TRIGGER DE CONVERSAS (conversations):
-- Protege tanto em INSERT quanto em UPDATE com tratamento correto de nulos (IS DISTINCT FROM):
-- - Vendedor não pode associar conversa a oportunidade de outro corretor (INSERT e UPDATE).
-- - Vendedor não pode transferir conversa para outro usuário nem se apropriar sem ser manager/admin.
-- - Se responsible_user_id for nulo, apenas gestor/admin pode alterar para terceiros.
CREATE OR REPLACE FUNCTION public.check_conversation_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_manager_or_admin() THEN
    -- Regras de Associação de Oportunidade (INSERT e UPDATE)
    IF NEW.opportunity_id IS NOT NULL THEN
      IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.opportunity_id IS DISTINCT FROM NEW.opportunity_id) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.opportunities o
          WHERE o.id = NEW.opportunity_id
            AND (o.owner_id = auth.uid() OR (o.owner_id IS NULL AND public.has_permission('visualizar_todos_leads')))
        ) THEN
          RAISE EXCEPTION 'Não é permitido associar conversa a uma oportunidade pertencente a outro corretor.';
        END IF;
      END IF;
    END IF;

    -- Regras de Responsabilidade (INSERT e UPDATE)
    IF TG_OP = 'INSERT' THEN
      IF NEW.responsible_user_id IS NOT NULL AND NEW.responsible_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Vendedores não possuem permissão para delegar conversas a outros corretores.';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.responsible_user_id IS DISTINCT FROM NEW.responsible_user_id THEN
        -- Vendedor só pode alterar se estiver assumindo uma conversa sem responsável prévio
        IF OLD.responsible_user_id IS NOT NULL OR NEW.responsible_user_id IS DISTINCT FROM auth.uid() THEN
          RAISE EXCEPTION 'Vendedores comuns não podem transferir nem alterar a responsabilidade de conversas.';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_conversation_links() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_conversation_links() FROM anon;
GRANT EXECUTE ON FUNCTION public.check_conversation_links() TO authenticated;

DROP TRIGGER IF EXISTS trg_check_conversation_links ON public.conversations;
CREATE TRIGGER trg_check_conversation_links
  BEFORE INSERT OR UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_conversation_links();

-- 4. TRIGGER DE VALIDAÇÃO DE OPORTUNIDADES, ETAPAS, FUNIL, PERDA E REDISTRIBUIÇÃO HIERÁRQUICA
-- Preserva 100% de todas as validações de domínio da migration 0001 (INSERT e UPDATE segregados,
-- coerência stage_id x funnel_type, loss_reason_id obrigatório e loss_notes em perda,
-- limpeza de loss_reason_id e loss_notes ao sair de perdida, sincronização bidirecional
-- com a etapa de fechamento ganho is_fechamento = true).
--
-- Reforça e estende a segurança em INSERT e UPDATE com tratamento seguro de NULL (IS DISTINCT FROM).
--
-- Regras de atribuição / transferência de responsável (owner_id):
-- a) Administrador ativo (is_admin()): acesso irrestrito para atribuir ou transferir qualquer lead.
-- b) Gestor ativo (is_gestor()):
--    - Se a tabela teams existir (após migration 0004): gestor só redistribui leads dentro de sua equipe ativa
--      (o novo responsável deve ser membro ativo da equipe liderada pelo gestor, ou o próprio gestor).
--    - Não pode transferir para vendedores fora de sua equipe ativa (ex.: Eliana vinculada ao admin).
--    - Se a 0004 ainda não foi aplicada: gestor pode redistribuir como na 0001.
-- c) Vendedor comum (vendedor):
--    - No INSERT: só pode criar oportunidades para si (owner_id = auth.uid()) ou sem responsável (owner_id IS NULL)
--      caso tenha permissão para visualização de leads não atribuídos. NUNCA pode criar lead atribuído a terceiro.
--    - No UPDATE: NÃO pode transferir nem remover responsável (owner_id). A permissão granular 'redistribuir_leads'
--      NÃO autoriza vendedor a transferir oportunidades fora da hierarquia. Vendedor não possui autorização para
--      redistribuir leads de terceiros nem atribuir a quem quer que seja.
--
-- Tipo de retorno mantido como TRIGGER compatível com os triggers da 0001.
CREATE OR REPLACE FUNCTION public.validate_opportunity_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stage_funnel public.funnel_type;
  v_stage_is_fechamento BOOLEAN;
  v_won_stage_id UUID;
  v_is_admin BOOLEAN;
  v_is_gestor BOOLEAN;
  v_has_teams_table BOOLEAN;
  v_is_subordinate BOOLEAN;
BEGIN
  -- Determinação dos papéis hierárquicos do usuário autenticado
  v_is_admin := public.is_admin();
  v_is_gestor := public.is_gestor();

  -- =========================================================================
  -- BLOCO 1: REGRAS DE INSERT
  -- =========================================================================
  IF TG_OP = 'INSERT' THEN
    -- 1.1 Coerência entre etapa (stage_id) e o funnel_type da oportunidade (regra 0001)
    SELECT ps.funnel_type, ps.is_fechamento INTO v_stage_funnel, v_stage_is_fechamento
    FROM public.pipeline_stages ps
    WHERE ps.id = NEW.stage_id;

    IF v_stage_funnel IS NULL THEN
      RAISE EXCEPTION 'Etapa de pipeline inválida ou inexistente.';
    END IF;

    IF v_stage_funnel <> NEW.funnel_type THEN
      RAISE EXCEPTION 'A etapa informada pertence ao funil %, mas a oportunidade está no funil %.',
        v_stage_funnel, NEW.funnel_type;
    END IF;

    -- 1.2 Validação de perda no INSERT (regras 0001 preservadas)
    IF NEW.status = 'perdida' THEN
      IF NEW.loss_reason_id IS NULL THEN
        RAISE EXCEPTION 'Oportunidades com status "perdida" exigem a seleção de um motivo de perda (loss_reason_id).';
      END IF;
      IF NEW.data_fechamento IS NULL THEN
        NEW.data_fechamento := timezone('utc'::text, now());
      END IF;
    ELSE
      NEW.loss_reason_id := NULL;
      NEW.loss_notes := NULL;
    END IF;

    -- 1.3 Fechamento ganho no INSERT: data de fechamento e sincronização de etapa (regras 0001 preservadas)
    IF NEW.status = 'ganha' THEN
      IF NEW.data_fechamento IS NULL THEN
        NEW.data_fechamento := timezone('utc'::text, now());
      END IF;
    END IF;

    -- Sincronização automática com etapa de fechamento (is_fechamento = true) no funil de vendas
    IF NEW.funnel_type = 'vendas' THEN
      SELECT ps.id INTO v_won_stage_id
      FROM public.pipeline_stages ps
      WHERE ps.funnel_type = 'vendas' AND ps.is_fechamento = true
      LIMIT 1;

      IF v_won_stage_id IS NOT NULL THEN
        IF NEW.stage_id = v_won_stage_id AND NEW.status <> 'ganha' THEN
          NEW.status := 'ganha';
          IF NEW.data_fechamento IS NULL THEN
            NEW.data_fechamento := timezone('utc'::text, now());
          END IF;
        ELSIF NEW.status = 'ganha' AND NEW.stage_id <> v_won_stage_id THEN
          NEW.stage_id := v_won_stage_id;
        END IF;
      END IF;
    END IF;

    -- 1.4 Segurança de atribuição de responsável no INSERT
    -- Vendedor comum NÃO pode criar lead atribuído a terceiro.
    IF NOT v_is_admin THEN
      IF v_is_gestor THEN
        -- Gestor pode criar atribuído a si ou a subordinado de sua equipe ativa (se 0004 existir)
        IF NEW.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM auth.uid() THEN
          v_has_teams_table := (to_regclass('public.teams') IS NOT NULL AND to_regclass('public.team_members') IS NOT NULL);
          IF v_has_teams_table THEN
            EXECUTE 'SELECT EXISTS (
              SELECT 1
              FROM public.teams t
              JOIN public.team_members tm ON tm.team_id = t.id AND tm.ativo = true
              WHERE t.gestor_id = $1
                AND tm.vendedor_id = $2
                AND t.ativo = true
            )' INTO v_is_subordinate USING auth.uid(), NEW.owner_id;

            IF NOT v_is_subordinate THEN
              RAISE EXCEPTION 'Gestor só pode atribuir oportunidades a corretores integrantes de sua equipe ativa.';
            END IF;
          END IF;
        END IF;
      ELSE
        -- Vendedor comum: só pode criar para si ou sem responsável
        IF NEW.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM auth.uid() THEN
          RAISE EXCEPTION 'Vendedores não possuem permissão para criar oportunidades atribuídas a outros corretores.';
        END IF;
      END IF;
    END IF;

    RETURN NEW;

  -- =========================================================================
  -- BLOCO 2: REGRAS DE UPDATE
  -- =========================================================================
  ELSIF TG_OP = 'UPDATE' THEN
    -- 2.1 Coerência entre etapa (stage_id) e o funnel_type da oportunidade no UPDATE (regra 0001)
    SELECT ps.funnel_type, ps.is_fechamento INTO v_stage_funnel, v_stage_is_fechamento
    FROM public.pipeline_stages ps
    WHERE ps.id = NEW.stage_id;

    IF v_stage_funnel IS NULL THEN
      RAISE EXCEPTION 'Etapa de pipeline inválida ou inexistente.';
    END IF;

    IF v_stage_funnel <> NEW.funnel_type THEN
      RAISE EXCEPTION 'A etapa informada pertence ao funil %, mas a oportunidade está no funil %.',
        v_stage_funnel, NEW.funnel_type;
    END IF;

    -- 2.2 Validação de perda no UPDATE (regras 0001 preservadas)
    IF NEW.status = 'perdida' THEN
      IF NEW.loss_reason_id IS NULL THEN
        RAISE EXCEPTION 'Oportunidades com status "perdida" exigem a seleção de um motivo de perda (loss_reason_id).';
      END IF;
      IF NEW.data_fechamento IS NULL THEN
        NEW.data_fechamento := timezone('utc'::text, now());
      END IF;
    ELSE
      -- Ao sair de perdida (ou em qualquer outro status), limpa campos de perda (0001)
      NEW.loss_reason_id := NULL;
      NEW.loss_notes := NULL;
    END IF;

    -- 2.3 Fechamento ganho no UPDATE (regras 0001 preservadas)
    IF NEW.status = 'ganha' THEN
      IF NEW.data_fechamento IS NULL THEN
        NEW.data_fechamento := timezone('utc'::text, now());
      END IF;
    END IF;

    -- Sincronização automática com etapa de fechamento (is_fechamento = true) no funil de vendas (0001)
    IF NEW.funnel_type = 'vendas' THEN
      SELECT ps.id INTO v_won_stage_id
      FROM public.pipeline_stages ps
      WHERE ps.funnel_type = 'vendas' AND ps.is_fechamento = true
      LIMIT 1;

      IF v_won_stage_id IS NOT NULL THEN
        IF NEW.stage_id = v_won_stage_id AND NEW.status <> 'ganha' THEN
          NEW.status := 'ganha';
          IF NEW.data_fechamento IS NULL THEN
            NEW.data_fechamento := timezone('utc'::text, now());
          END IF;
        ELSIF NEW.status = 'ganha' AND NEW.stage_id <> v_won_stage_id AND NEW.stage_id = OLD.stage_id THEN
          -- Se marcado como ganho sem mudar de etapa manualmente, ajusta para a etapa ganha
          NEW.stage_id := v_won_stage_id;
        END IF;
      END IF;
    END IF;

    -- 2.4 PROTEÇÃO CONTRA TRANSFERÊNCIA INDEVIDA E REDISTRIBUIÇÃO HIERÁRQUICA
    -- Verifica se o responsável (owner_id) está sendo alterado ou removido
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      -- Se o usuário for administrador ativo: transferência sempre permitida
      IF v_is_admin THEN
        -- Administrador tem acesso geral irrestrito
        NULL;
      ELSIF v_is_gestor THEN
        -- Gestor ativo:
        -- Exige que tenha a permissão ou capacidade de gestão de equipe
        -- Verifica se a tabela teams já existe (compatibilidade incremental com 0004)
        v_has_teams_table := (to_regclass('public.teams') IS NOT NULL AND to_regclass('public.team_members') IS NOT NULL);

        IF v_has_teams_table THEN
          -- 1. O gestor só pode redistribuir leads de sua própria equipe (origem: de si ou de subordinado de equipe ativa)
          IF OLD.owner_id IS NOT NULL AND OLD.owner_id IS DISTINCT FROM auth.uid() THEN
            EXECUTE 'SELECT EXISTS (
              SELECT 1
              FROM public.teams t
              JOIN public.team_members tm ON tm.team_id = t.id AND tm.ativo = true
              WHERE t.gestor_id = $1
                AND tm.vendedor_id = $2
                AND t.ativo = true
            )' INTO v_is_subordinate USING auth.uid(), OLD.owner_id;

            IF NOT v_is_subordinate THEN
              RAISE EXCEPTION 'Gestor não possui permissão para redistribuir leads de corretores fora de sua equipe ativa.';
            END IF;
          END IF;

          -- 2. O novo responsável deve ser o próprio gestor ou membro ativo de sua equipe (destino)
          IF NEW.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM auth.uid() THEN
            EXECUTE 'SELECT EXISTS (
              SELECT 1
              FROM public.teams t
              JOIN public.team_members tm ON tm.team_id = t.id AND tm.ativo = true
              WHERE t.gestor_id = $1
                AND tm.vendedor_id = $2
                AND t.ativo = true
            )' INTO v_is_subordinate USING auth.uid(), NEW.owner_id;

            IF NOT v_is_subordinate THEN
              RAISE EXCEPTION 'Gestor só pode redistribuir leads para corretores integrantes de sua própria equipe ativa.';
            END IF;
          END IF;
        ELSE
          -- Antes da 0004 existir, validação padrão da 0001/0002.1 para gestor
          IF NOT (public.is_manager_or_admin() OR public.has_permission('redistribuir_leads')) THEN
            RAISE EXCEPTION 'Usuário não possui privilégio de gestor/administrador para redistribuir leads.';
          END IF;
        END IF;
      ELSE
        -- Vendedor comum (vendedor) ou qualquer outro papel não gestor/não admin:
        -- Vendedores NÃO podem transferir oportunidades para terceiros nem desvincular o responsável.
        -- Mesmo que possua a flag 'redistribuir_leads', vendedores não podem redistribuir fora da hierarquia.
        RAISE EXCEPTION 'Vendedor não possui permissão para transferir ou remover o responsável da oportunidade comercial. Operação restrita a gestores e administradores.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_opportunity_rules() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_opportunity_rules() FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_opportunity_rules() TO authenticated;

DROP TRIGGER IF EXISTS trg_validate_opportunity_rules ON public.opportunities;
CREATE TRIGGER trg_validate_opportunity_rules
  BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_opportunity_rules();
