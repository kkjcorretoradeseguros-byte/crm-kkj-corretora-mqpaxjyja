-- ==============================================================================
-- MIGRAÇÃO 0002: CORREÇÕES COMPLEMENTARES DE SEGURANÇA E INTEGRIDADE
-- Compatível com o Schema 0001 (32 tabelas) | Não destrutiva | Idempotente
-- ==============================================================================

-- 1. TRIGGER DE PROTEÇÃO ESTRITA PARA TAREFAS (tasks)
CREATE OR REPLACE FUNCTION public.check_task_security_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_manager_or_admin() THEN
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
        WHERE o.id = NEW.opportunity_id AND o.owner_id = auth.uid()
      ) THEN
        RAISE EXCEPTION 'Não é permitido vincular tarefa a uma oportunidade de outro corretor.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_task_security_rules() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_check_task_security ON public.tasks;
CREATE TRIGGER trg_check_task_security
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_task_security_rules();

-- 2. TRIGGER DE VALIDAÇÃO ESTRITA DE VÍNCULOS DE CONVERSAS (conversations)
CREATE OR REPLACE FUNCTION public.check_conversation_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_manager_or_admin() THEN
    -- Impedir vinculação de conversa a oportunidade de outro corretor
    IF NEW.opportunity_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = NEW.opportunity_id AND o.owner_id = auth.uid()
      ) THEN
        RAISE EXCEPTION 'Não é permitido associar conversa a uma oportunidade pertencente a outro corretor.';
      END IF;
    END IF;

    -- Impedir alteração arbitrária de responsabilidade por vendedor comum
    IF OLD.responsible_user_id IS DISTINCT FROM NEW.responsible_user_id AND NEW.responsible_user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Vendedores comuns não podem delegar conversas a outros corretores.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_conversation_links() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_check_conversation_links ON public.conversations;
CREATE TRIGGER trg_check_conversation_links
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_conversation_links();

-- 3. REFORÇO DE IDENTIFICAÇÃO DA ETAPA DE VENDA GANHA (pipeline_stages)
-- Garante indexação acelerada para identificador explícito de fechamento
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_fechamento
  ON public.pipeline_stages(funnel_type, is_fechamento)
  WHERE is_fechamento = true;
