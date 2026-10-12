-- ==============================================================================
-- MIGRAÇÃO 0002.1 (CORREÇÃO COMPLEMENTAR DA 0002):
-- REFORÇO ESTRITO DE SEGURANÇA, TRIGGERS DE INTEGRIDADE EM INSERT E UPDATE,
-- TRATAMENTO DE NULOS COM IS DISTINCT FROM E CONFERÊNCIA DE COLUNAS
-- Compatível com Schema 0001 (32 tabelas) e 0002 existente | Idempotente | Não destrutiva
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
    ALTER TABLE public.pipeline_stages ADD COLUMN funnel_type public.pipeline_type NOT NULL DEFAULT 'vendas';
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

-- 4. CONFIRMAÇÃO DO TRIGGER DE PROTEÇÃO CONTRA AUTOTRANSFERÊNCIA DE LEADS (opportunities)
-- Preserva e reforça a verificação da migration 0001 sem substituição destrutiva.
-- Vendedor não transfere lead sem permissão 'redistribuir_leads' ou papel gestor/administrador.
CREATE OR REPLACE FUNCTION public.validate_opportunity_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stage_funnel public.pipeline_type;
  v_won_stage_id UUID;
BEGIN
  -- 1. VALIDAÇÃO DE COERÊNCIA ETAPA X FUNIL
  IF NEW.stage_id IS NOT NULL THEN
    SELECT ps.funnel_type INTO v_stage_funnel
    FROM public.pipeline_stages ps
    WHERE ps.id = NEW.stage_id;

    IF v_stage_funnel IS NULL THEN
      RAISE EXCEPTION 'A etapa informada não existe no catálogo de pipeline_stages.';
    END IF;

    IF v_stage_funnel <> NEW.funnel_type THEN
      RAISE EXCEPTION 'Incoerência de funil: a etapa selecionada pertence ao funil "%" e a oportunidade está configurada como "%".',
        v_stage_funnel, NEW.funnel_type;
    END IF;
  END IF;

  -- 2. VALIDAÇÃO DE MOTIVO DE PERDA
  IF NEW.status = 'perdida' THEN
    IF NEW.loss_reason_id IS NULL THEN
      RAISE EXCEPTION 'Para marcar a oportunidade como perdida, é obrigatório informar o motivo da perda (loss_reason_id).';
    END IF;
    IF NEW.data_fechamento IS NULL THEN
      NEW.data_fechamento := timezone('utc'::text, now());
    END IF;
  END IF;

  -- 3. FECHAMENTO GANHO
  IF NEW.status = 'ganha' THEN
    IF NEW.data_fechamento IS NULL THEN
      NEW.data_fechamento := timezone('utc'::text, now());
    END IF;
  END IF;

  -- 4. IMPEDIR AUTOTRANSFERÊNCIA DE LEADS NO UPDATE:
  -- Se o owner_id estiver sendo alterado ou removido, exige privilégio de gestor/admin ou permissão redistribuir_leads
  IF TG_OP = 'UPDATE' THEN
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      IF NOT (public.is_manager_or_admin() OR public.has_permission('redistribuir_leads')) THEN
        RAISE EXCEPTION 'Vendedor não possui permissão para transferir ou remover o responsável do lead. Exige permissão de redistribuição.';
      END IF;
    END IF;
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
