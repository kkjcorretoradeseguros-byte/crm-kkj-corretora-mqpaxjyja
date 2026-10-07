-- ==============================================================================
-- KK JEKABSON CORRETORA DE SEGUROS E BENEFÍCIOS (KKJ)
-- MIGRATION V1 CONSOLIDADA COMPLETA PARA SUPABASE (POSTGRESQL)
-- Arquivo: supabase/migrations/0001_kkj_initial_schema.sql
-- Idioma de documentação e comentários: Português do Brasil (pt-BR)
--
-- PRINCÍPIOS FUNDAMENTAIS:
-- 1. Idempotência estrita para CLEAN INSTALL em banco Supabase vazio.
--    Nota técnica: CREATE TABLE IF NOT EXISTS não altera nem adiciona colunas a
--    tabelas já existentes. A finalidade primordial deste script é a instalação limpa
--    (clean install) reproduzível e íntegra.
-- 2. Quantidade REAL de tabelas criadas: EXATAMENTE 32 TABELAS na ordem linear
--    estrita de resolução de dependências de chaves estrangeiras:
--    1. profiles (vinculado a auth.users)
--    2. permissions
--    3. user_permissions
--    4. carriers
--    5. products
--    6. carrier_products
--    7. companies
--    8. contacts
--    9. pipeline_stages
--    10. loss_reasons
--    11. task_types
--    12. opportunities
--    13. tasks
--    14. opportunity_timeline
--    15. opportunity_assignments
--    16. opportunity_stage_history
--    17. contracts
--    18. commission_rules
--    19. bonus_campaigns
--    20. contract_financials
--    21. commission_installments
--    22. document_checklist_templates
--    23. document_checklist_items
--    24. post_sale_requests
--    25. custom_field_definitions
--    26. custom_field_values
--    27. user_preferences
--    28. audit_log
--    29. whatsapp_channels
--    30. message_templates
--    31. conversations
--    32. messages
--
-- REGRAS E CORREÇÕES OBRIGATÓRIAS INCORPORADAS:
-- - PROFILES SEM RECURSÃO: helpers SECURITY DEFINER com search_path = ''
--   (current_role, is_admin, is_manager_or_admin, etc.) criados DEPOIS de public.profiles.
--   Policy profiles_update_own_or_admin reescrita sem subquery recursiva.
-- - REMOÇÃO DE contracts.operadora TEXT: carrier_id FK carriers é a fonte única.
-- - PROTEÇÃO FINANCEIRA: contract_financials restrita a is_admin() no RLS.
--   commission_installments sem SELECT direto para vendedor/gestor; apenas admin lê direto.
--   Vendedor consulta repasses exclusivamente via RPC get_meu_financeiro() e get_minhas_parcelas().
-- - LEADS E CONVERSAS SEM RESPONSÁVEL: owner_id IS NULL / responsible_user_id IS NULL
--   visíveis exclusivamente para is_manager_or_admin() ou has_permission('visualizar_todos_leads').
-- - IMPEDIR AUTOTRANSFERÊNCIA DE LEADS: trigger e WITH CHECK de UPDATE em opportunities
--   garantem que vendedor dono NÃO altera nem anula seu próprio owner_id.
-- - CREATED_BY: companies e contacts exigem created_by = auth.uid() para usuário comum.
-- - CUSTOM_FIELD_VALUES: com FKs opportunity_id e contract_id com CHECK garantindo exatamente um.
-- - WHATSAPP_CHANNELS: sem seed fictício (+5511999999999 removido; inicia vazia).
-- - CHECK CONSTRAINTS em estados TEXT: theme, densidade, modo_disparo, status de conversas,
--   prioridade de pós-venda, status de parcelas e situacao_recebimento financeiro.
-- - OPORTUNIDADES: current_carrier_id (FK carriers) e current_carrier_name para plano anterior;
--   carrier_id para operadora cotada/fechada.
-- - VALIDAÇÃO STAGE/FUNNEL E PERDA: trigger garante stage_id no mesmo funnel_type;
--   status 'perdida' exige loss_reason_id; ao sair de perdida, limpa loss_reason_id e loss_notes.
-- - STAGE_HISTORY: UNIQUE parcial uq_stage_history_active para apenas 1 etapa aberta por oportunidade.
-- - AUDIT_LOG E TIMELINE: append-only real, sem UPDATE/DELETE para usuários comuns; audit_log
--   somente admin consulta e triggers gravam.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSÕES NECESSÁRIAS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. TIPOS ENUMERADOS (ENUMS)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Perfis de Usuário
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('administrador', 'gestor', 'vendedor');
  END IF;

  -- Tipos de Funil do CRM
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'funnel_type') THEN
    CREATE TYPE public.funnel_type AS ENUM ('vendas', 'pos_venda');
  END IF;

  -- Temperatura de Qualificação Comercial
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'temperature') THEN
    CREATE TYPE public.temperature AS ENUM ('frio', 'morno', 'quente');
  END IF;

  -- Status de Execução de Tarefas
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE public.task_status AS ENUM ('pendente', 'concluida', 'cancelada');
  END IF;

  -- Tipos Padrão de Tarefa Operacional (Seeds Exatos)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
    CREATE TYPE public.task_type AS ENUM (
      'ligacao',
      'whatsapp',
      'follow_up',
      'reuniao',
      'cotacao',
      'documentacao',
      'implantacao',
      'cobranca_pagamento',
      'outro'
    );
  END IF;

  -- Status Macro da Oportunidade
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opp_status') THEN
    CREATE TYPE public.opp_status AS ENUM ('ativa', 'ganha', 'perdida', 'pos_venda');
  END IF;

  -- Status de Documentação
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_status') THEN
    CREATE TYPE public.doc_status AS ENUM ('pendente', 'recebido', 'nao_se_aplica');
  END IF;

  -- Status do Contrato Ativo
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status') THEN
    CREATE TYPE public.contract_status AS ENUM (
      'em_implantacao',
      'ativo',
      'pendente_renovacao',
      'cancelado'
    );
  END IF;

  -- Tipos de Eventos da Timeline Comercial
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timeline_action_type') THEN
    CREATE TYPE public.timeline_action_type AS ENUM (
      'nota',
      'mudanca_etapa',
      'mudanca_responsavel',
      'tarefa',
      'venda_contrato',
      'sistema'
    );
  END IF;

  -- Direção da Mensagem WhatsApp
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_direction') THEN
    CREATE TYPE public.message_direction AS ENUM ('incoming', 'outgoing');
  END IF;

  -- Status de Entrega da Mensagem WhatsApp
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_delivery_status') THEN
    CREATE TYPE public.message_delivery_status AS ENUM (
      'pending',
      'sent',
      'delivered',
      'read',
      'failed'
    );
  END IF;

  -- Origem da Atribuição de Responsável de Oportunidade
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_origin') THEN
    CREATE TYPE public.assignment_origin AS ENUM ('manual', 'round_robin', 'redistribuicao');
  END IF;

  -- Tipos de Solicitação de Pós-Venda (Seeds Exatos)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_sale_type') THEN
    CREATE TYPE public.post_sale_type AS ENUM (
      'inclusao',
      'exclusao',
      'alteracao_cadastral',
      'segunda_via',
      'autorizacao',
      'reembolso',
      'rede_credenciada',
      'fatura',
      'movimentacao_empresarial',
      'outro'
    );
  END IF;

  -- Status de Solicitação de Pós-Venda (Seeds Exatos)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_sale_status') THEN
    CREATE TYPE public.post_sale_status AS ENUM (
      'aberto',
      'em_andamento',
      'aguardando_cliente',
      'aguardando_operadora',
      'concluido'
    );
  END IF;

  -- Tipo de Regra de Comissão e Bonificação
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calc_type') THEN
    CREATE TYPE public.calc_type AS ENUM ('percentual', 'valor_fixo', 'multiplo', 'faixas');
  END IF;

  -- Tipo de Campo Personalizado
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_field_type') THEN
    CREATE TYPE public.custom_field_type AS ENUM (
      'texto',
      'numero',
      'moeda',
      'data',
      'booleano',
      'selecao',
      'multipla_selecao'
    );
  END IF;

  -- Alvo do Campo Personalizado
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_field_target') THEN
    CREATE TYPE public.custom_field_target AS ENUM ('oportunidade', 'contrato');
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. TABELA 1: public.profiles
-- Criada ANTES dos helpers SECURITY DEFINER para garantir que a relação exista.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  celular TEXT,
  cargo TEXT,
  equipe TEXT,
  role public.user_role NOT NULL DEFAULT 'vendedor',
  ativo BOOLEAN NOT NULL DEFAULT true,
  recebe_leads_automaticos BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.profiles IS 'Perfil operacional estendido dos corretores e colaboradores vinculado ao auth.users.';
COMMENT ON COLUMN public.profiles.recebe_leads_automaticos IS 'Flag indicativa se o corretor participa do round-robin automático de distribuição.';

-- ------------------------------------------------------------------------------
-- 4. TABELA 2 E 3: PERMISSÕES GRANULARES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'geral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.permissions IS 'Catálogo de permissões granulares do CRM KKJ (visualizar_todos_leads, redistribuir_leads, etc.).';

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_user_permission UNIQUE (user_id, permission_id)
);
COMMENT ON TABLE public.user_permissions IS 'Associação direta de permissões granulares a usuários específicos.';

-- ------------------------------------------------------------------------------
-- 5. FUNÇÕES HELPER SECURITY DEFINER (CONTROLE DE ACESSO, PERFIS E PERMISSÕES)
-- Hardening: SET search_path = '', schema-qualified e uso em policies sem recursão.
-- ------------------------------------------------------------------------------

-- 5.1 Retorna o role do usuário autenticado de forma estável
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid();
$$;
COMMENT ON FUNCTION public.current_role() IS 'Retorna o papel (user_role) do usuário autenticado no auth.uid().';

-- 5.2 Helper booleano: É Administrador ativo?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'administrador'::public.user_role AND p.ativo = true
  );
$$;
COMMENT ON FUNCTION public.is_admin() IS 'Verifica se o usuário autenticado é um administrador ativo.';

-- 5.3 Helper booleano: É Gestor ativo?
CREATE OR REPLACE FUNCTION public.is_gestor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'gestor'::public.user_role AND p.ativo = true
  );
$$;
COMMENT ON FUNCTION public.is_gestor() IS 'Verifica se o usuário autenticado é um gestor ativo.';

-- 5.4 Helper booleano: É Vendedor ativo?
CREATE OR REPLACE FUNCTION public.is_vendedor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'vendedor'::public.user_role AND p.ativo = true
  );
$$;
COMMENT ON FUNCTION public.is_vendedor() IS 'Verifica se o usuário autenticado é um vendedor ativo.';

-- 5.5 Helper booleano: Administrador ou Gestor ativo?
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('administrador'::public.user_role, 'gestor'::public.user_role)
      AND p.ativo = true
  );
$$;
COMMENT ON FUNCTION public.is_manager_or_admin() IS 'Verifica se o usuário autenticado é gestor ou administrador ativo.';

-- 5.6 Helper de permissão granular: Possui a permissão ou é Admin?
CREATE OR REPLACE FUNCTION public.has_permission(p_codigo TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions up
      JOIN public.permissions perm ON perm.id = up.permission_id
      JOIN public.profiles prof ON prof.id = up.user_id
      WHERE up.user_id = auth.uid()
        AND prof.ativo = true
        AND perm.codigo = p_codigo
    )
  );
$$;
COMMENT ON FUNCTION public.has_permission(TEXT) IS 'Verifica se o usuário logado possui uma permissão granular específica ou se é administrador ativo.';

-- Revoga execução pública e concede a authenticated para os helpers
REVOKE ALL ON FUNCTION public.current_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.is_gestor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_gestor() TO authenticated;
REVOKE ALL ON FUNCTION public.is_vendedor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_vendedor() TO authenticated;
REVOKE ALL ON FUNCTION public.is_manager_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.has_permission(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. TABELAS DO DOMÍNIO KKJ (ORDEM ESTRITA DE FOREIGN KEYS)
-- ------------------------------------------------------------------------------

-- 6.1 TABELA 4: OPERADORAS DE SAÚDE E SEGURADORAS (Carriers)
CREATE TABLE IF NOT EXISTS public.carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  nome_curto TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.carriers IS 'Operadoras de saúde, odontológicas e companhias seguradoras parceiras da KKJ.';
CREATE UNIQUE INDEX IF NOT EXISTS uq_carriers_nome_lower ON public.carriers (lower(trim(nome)));

-- 6.2 TABELA 5: CATÁLOGO DE PRODUTOS (Seguros & Benefícios)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  categoria TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.products IS 'Modalidades de seguros e planos de benefícios da KKJ.';

-- 6.3 TABELA 6: RELACIONAMENTO OPERADORA × PRODUTO
CREATE TABLE IF NOT EXISTS public.carrier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID NOT NULL REFERENCES public.carriers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_carrier_product UNIQUE (carrier_id, product_id)
);
COMMENT ON TABLE public.carrier_products IS 'Associação entre operadoras parceiras e os produtos comercializados por cada uma.';

-- 6.4 TABELA 7: EMPRESAS / CLIENTES PJ
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  cidade TEXT,
  estado VARCHAR(2),
  segmento TEXT,
  notas TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.companies IS 'Empresas clientes e estipulantes de apólices e planos de saúde PJ.';

-- 6.5 TABELA 8: CONTATOS (Pessoas Físicas, Titulares ou Interlocutores PJ)
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  celular TEXT NOT NULL,
  email TEXT,
  cargo TEXT,
  cpf TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  notas TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.contacts IS 'Contatos individuais, segurados titulares ou interlocutores corporativos.';

-- 6.6 TABELA 9: ETAPAS DO PIPELINE (Funis de Vendas e Pós-Venda)
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_type public.funnel_type NOT NULL,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  e_saida BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_pipeline_stages_funnel_nome UNIQUE (funnel_type, nome),
  CONSTRAINT uq_pipeline_stages_funnel_ordem UNIQUE (funnel_type, ordem)
);
COMMENT ON TABLE public.pipeline_stages IS 'Etapas dos funis Comercial e de Pós-Venda da KKJ.';

-- 6.7 TABELA 10: MOTIVOS DE PERDA (Configuráveis)
CREATE TABLE IF NOT EXISTS public.loss_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.loss_reasons IS 'Motivos padronizados de encerramento sem fechamento no funil de vendas.';

-- 6.8 TABELA 11: TIPOS DE TAREFA (Configuráveis)
CREATE TABLE IF NOT EXISTS public.task_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_slug public.task_type NOT NULL UNIQUE,
  rotulo TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.task_types IS 'Tipos padronizados de tarefas operacionais parametrizáveis pelo administrador.';

-- 6.9 TABELA 12: OPORTUNIDADES (Registro Central dos Funis)
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  carrier_id UUID REFERENCES public.carriers(id) ON DELETE SET NULL,
  current_carrier_id UUID REFERENCES public.carriers(id) ON DELETE SET NULL,
  current_carrier_name TEXT,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  status public.opp_status NOT NULL DEFAULT 'ativa',
  funnel_type public.funnel_type NOT NULL DEFAULT 'vendas',
  temperatura public.temperature NOT NULL DEFAULT 'morno',
  valor_venda NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- Atribuição de Responsável (pode ser NULL para distribuição posterior)
  owner_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  proxima_tarefa_id UUID,
  health_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  loss_reason_id UUID REFERENCES public.loss_reasons(id) ON DELETE SET NULL,
  loss_notes TEXT,
  -- Atribuição Estruturada de Marketing
  origem TEXT,
  midia TEXT,
  campanha TEXT,
  campaign_id TEXT,
  adset TEXT,
  adset_id TEXT,
  anuncio TEXT,
  ad_id TEXT,
  external_lead_id TEXT,
  data_aquisicao TIMESTAMPTZ,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_entrada TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_opp_loss_reason CHECK (
    (status = 'perdida' AND loss_reason_id IS NOT NULL) OR
    (status <> 'perdida')
  )
);
COMMENT ON TABLE public.opportunities IS 'Entidade central comercial e de pós-venda com dados estruturados de marketing, saúde e distribuição.';
COMMENT ON COLUMN public.opportunities.carrier_id IS 'Operadora principal cotada ou negociada na oportunidade.';
COMMENT ON COLUMN public.opportunities.current_carrier_id IS 'Operadora atual do cliente cadastrada em public.carriers.';
COMMENT ON COLUMN public.opportunities.current_carrier_name IS 'Nome da operadora atual do cliente caso ainda não cadastrada em carriers.';
COMMENT ON COLUMN public.opportunities.health_data IS 'JSONB com dados de saúde do grupo/proposta: possui_plano_atual, cnpj, razao_social, qtd_vidas, idades, cidade, estado, valor_plano_atual, tipo_contratacao, acomodacao, rede_desejada, objetivo, data_contratacao, data_renovacao.';

-- 6.10 TABELA 13: TAREFAS OPERACIONAIS
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  tipo public.task_type NOT NULL DEFAULT 'follow_up',
  titulo TEXT NOT NULL,
  descricao TEXT,
  due_date DATE NOT NULL,
  due_time TIME,
  assignee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status public.task_status NOT NULL DEFAULT 'pendente',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.tasks IS 'Tarefas, follow-ups e compromissos vinculados a corretores e oportunidades.';

-- FK circular de proxima_tarefa_id em opportunities criada após a existência de tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_opp_proxima_tarefa'
  ) THEN
    ALTER TABLE public.opportunities
    ADD CONSTRAINT fk_opp_proxima_tarefa
    FOREIGN KEY (proxima_tarefa_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6.11 TABELA 14: TIMELINE VISUAL DA OPORTUNIDADE (Append-Only)
-- Preservação histórica: ON DELETE RESTRICT para proteger histórico de exclusões acidentais.
CREATE TABLE IF NOT EXISTS public.opportunity_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  tipo_evento public.timeline_action_type NOT NULL DEFAULT 'sistema',
  conteudo TEXT NOT NULL,
  dados_adicionais JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.opportunity_timeline IS 'Timeline append-only (imutável) para visualização cronológica das ações e notas da oportunidade.';

-- 6.12 TABELA 15: HISTÓRICO ESTRUTURADO DE MUDANÇA DE RESPONSÁVEL (Assignments)
-- Preservação histórica: ON DELETE RESTRICT para manter rastreabilidade imutável de atribuições.
CREATE TABLE IF NOT EXISTS public.opportunity_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  responsavel_anterior_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  novo_responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  alterado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  motivo public.assignment_origin NOT NULL DEFAULT 'manual',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.opportunity_assignments IS 'Histórico estruturado de distribuição de leads para auditoria e relatórios de round-robin.';

-- 6.13 TABELA 16: HISTÓRICO ESTRUTURADO DE ETAPAS (Analytics de Gargalos)
-- Preservação histórica: ON DELETE RESTRICT para auditoria estrita de transições de funil.
CREATE TABLE IF NOT EXISTS public.opportunity_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  etapa_anterior_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  nova_etapa_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  data_entrada TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  data_saida TIMESTAMPTZ,
  duracao_segundos BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.opportunity_stage_history IS 'Histórico estruturado de transições de etapa para cálculo de tempo médio e gargalos sem parsing de texto.';

-- Índice único parcial garantindo que cada oportunidade possua NO MÁXIMO UMA etapa ativa aberta (data_saida IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_history_active
  ON public.opportunity_stage_history(opportunity_id)
  WHERE data_saida IS NULL;

-- 6.14 TABELA 17: CONTRATOS (Snapshot Comercial e Cadastral)
-- Coluna legado TEXT 'operadora' REMOVIDA: o relacionamento é exclusivo com public.carriers(id).
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_contrato TEXT,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  carrier_id UUID NOT NULL REFERENCES public.carriers(id) ON DELETE RESTRICT,
  plano TEXT,
  qtd_vidas INTEGER NOT NULL DEFAULT 1,
  valor_mensal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  valor_venda NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  status public.contract_status NOT NULL DEFAULT 'em_implantacao',
  -- Ciclo de vida / implantação
  data_envio DATE,
  data_previsao_vigencia DATE,
  data_pagamento DATE,
  data_implantacao DATE,
  data_inicio_vigencia DATE,
  data_renovacao DATE,
  data_cancelamento DATE,
  motivo_cancelamento TEXT,
  observacoes TEXT,
  -- Alertas configuráveis de renovação
  dias_alerta_renovacao INTEGER[] DEFAULT ARRAY[90, 60, 30]::INTEGER[],
  responsavel_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.contracts IS 'Apólices e contratos ativos. Operadora referenciada exclusivamente via carrier_id.';

-- 6.15 TABELA 18: REGRAS DE COMISSÃO (Parametrizável sem código)
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  carrier_id UUID REFERENCES public.carriers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  modalidade TEXT,
  tipo_regra public.calc_type NOT NULL DEFAULT 'percentual',
  percentual_base NUMERIC(6, 2),
  valor_fixo NUMERIC(14, 2),
  multiplo_mensalidade NUMERIC(6, 2),
  cronograma_parcelas JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_inicio_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_vigencia DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.commission_rules IS 'Tabela de parametrização de regras de comissionamento por operadora e produto.';

-- 6.16 TABELA 19: CAMPANHAS DE BONIFICAÇÃO (Independente da comissão normal)
CREATE TABLE IF NOT EXISTS public.bonus_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  carrier_id UUID REFERENCES public.carriers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  modalidade TEXT,
  tipo_bonificacao public.calc_type NOT NULL DEFAULT 'valor_fixo',
  percentual_bonus NUMERIC(6, 2),
  valor_fixo_bonus NUMERIC(14, 2),
  multiplo_bonus NUMERIC(6, 2),
  faixas_metas JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_inicio_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_vigencia DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.bonus_campaigns IS 'Campanhas de bonificação e prêmios comerciais parametrizáveis pelo administrador.';

-- 6.17 TABELA 20: DADOS FINANCEIROS SENSÍVEIS DO CONTRATO
-- Separado fisicamente: Vendedores e Gestores NÃO possuem permissão de SELECT direto.
-- situacao_recebimento possui CHECK constraint ('pendente','parcial','recebido','inadimplente','cancelado').
CREATE TABLE IF NOT EXISTS public.contract_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  faturamento_bruto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  comissao_prevista NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  comissao_recebida NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  data_prevista_recebimento DATE,
  data_efetiva_recebimento DATE,
  situacao_recebimento TEXT NOT NULL DEFAULT 'pendente'
    CONSTRAINT chk_contract_financials_situacao CHECK (situacao_recebimento IN ('pendente','parcial','recebido','inadimplente','cancelado')),
  impostos_descontos NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  comissao_liquida NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  repasse_vendedor NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  bonificacao_vendedor NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  resultado_kkj NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  commission_rule_id UUID REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  bonus_campaign_id UUID REFERENCES public.bonus_campaigns(id) ON DELETE SET NULL,
  comissao_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  bonificacao_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.contract_financials IS 'Dados financeiros ultrassensíveis da KKJ: restritos a administrador via RLS.';

-- Chave única composta para integridade com commission_installments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_contract_financials_contract_id_id'
  ) THEN
    ALTER TABLE public.contract_financials
    ADD CONSTRAINT uq_contract_financials_contract_id_id UNIQUE (contract_id, id);
  END IF;
END $$;

-- 6.18 TABELA 21: PARCELAS / CRONOGRAMA DE COMISSÃO
-- FK composta (contract_id, contract_financial_id) garante que a parcela pertença ao mesmo contrato da capa financeira.
CREATE TABLE IF NOT EXISTS public.commission_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  contract_financial_id UUID NOT NULL,
  numero_parcela INTEGER NOT NULL,
  total_parcelas INTEGER NOT NULL DEFAULT 1,
  data_vencimento DATE NOT NULL,
  valor_previsto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  repasse_previsto_vendedor NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  valor_recebido NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  repasse_pago_vendedor NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  data_recebimento DATE,
  data_repasse DATE,
  status TEXT NOT NULL DEFAULT 'previsto'
    CONSTRAINT chk_commission_installments_status CHECK (status IN ('previsto', 'recebido', 'repassado', 'cancelado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_contract_installment UNIQUE (contract_id, numero_parcela),
  CONSTRAINT fk_installment_contract_financial
    FOREIGN KEY (contract_id, contract_financial_id)
    REFERENCES public.contract_financials(contract_id, id) ON DELETE CASCADE
);
COMMENT ON TABLE public.commission_installments IS 'Detalhamento do cronograma de parcelas da comissão com integridade referencial ao contrato.';

-- 6.19 TABELA 22: TEMPLATES DE CHECKLIST DOCUMENTAL POR PRODUTO
CREATE TABLE IF NOT EXISTS public.document_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  nome_documento TEXT NOT NULL,
  descricao TEXT,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.document_checklist_templates IS 'Templates de documentos exigidos por modalidade de produto na contratação.';

-- 6.20 TABELA 23: ITENS DE CHECKLIST DOCUMENTAL DO CLIENTE / CONTRATO
-- CHECK constraint chk_checklist_item_target: exige que pelo menos um (opportunity_id ou contract_id)
-- esteja preenchido para suportar tanto o fluxo de coleta durante o funil comercial quanto o contrato fechado.
CREATE TABLE IF NOT EXISTS public.document_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.document_checklist_templates(id) ON DELETE SET NULL,
  nome_documento TEXT NOT NULL,
  status public.doc_status NOT NULL DEFAULT 'pendente',
  link_externo TEXT,
  data_recebimento DATE,
  observacao TEXT,
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_checklist_item_target CHECK (
    contract_id IS NOT NULL OR opportunity_id IS NOT NULL
  )
);
COMMENT ON TABLE public.document_checklist_items IS 'Controle de recebimento de documentos sem guardar binários no PostgreSQL (apenas links externos). Não permite item órfão.';

-- 6.21 TABELA 24: SOLICITAÇÕES DE PÓS-VENDA
CREATE TABLE IF NOT EXISTS public.post_sale_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo TEXT,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  tipo public.post_sale_type NOT NULL DEFAULT 'outro',
  status public.post_sale_status NOT NULL DEFAULT 'aberto',
  prioridade TEXT NOT NULL DEFAULT 'media'
    CONSTRAINT chk_post_sale_prioridade CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  prazo DATE,
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  data_abertura TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  data_conclusao TIMESTAMPTZ,
  historico JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.post_sale_requests IS 'Demandas operacionais de pós-venda (inclusão/exclusão de vidas, faturamento, reembolso, etc.).';

-- 6.22 TABELA 25: CAMPOS PERSONALIZADOS POR PRODUTO: DEFINIÇÃO
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  alvo public.custom_field_target NOT NULL DEFAULT 'oportunidade',
  nome TEXT NOT NULL,
  chave TEXT NOT NULL,
  tipo public.custom_field_type NOT NULL DEFAULT 'texto',
  opcoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_custom_field_product_chave UNIQUE (product_id, alvo, chave)
);
COMMENT ON TABLE public.custom_field_definitions IS 'Definições dinâmicas de campos personalizados por tipo de produto comercializado.';

-- 6.23 TABELA 26: CAMPOS PERSONALIZADOS: VALORES ARMAZENADOS COM INTEGRIDADE
-- Substituição de registro_id genérico por opportunity_id e contract_id com CHECK de exatamente um preenchido.
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  valor JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_cfv_single_target CHECK (
    (opportunity_id IS NOT NULL AND contract_id IS NULL) OR
    (opportunity_id IS NULL AND contract_id IS NOT NULL)
  )
);
COMMENT ON TABLE public.custom_field_values IS 'Valores de campos personalizados dinâmicos vinculados com integridade referencial a oportunidade ou contrato.';

-- Índices de unicidade parciais para evitar duplicação do mesmo campo no mesmo registro
CREATE UNIQUE INDEX IF NOT EXISTS uq_cfv_definition_opportunity
  ON public.custom_field_values(definition_id, opportunity_id)
  WHERE opportunity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cfv_definition_contract
  ON public.custom_field_values(definition_id, contract_id)
  WHERE contract_id IS NOT NULL;

-- 6.24 TABELA 27: PREFERÊNCIAS DO USUÁRIO
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system'
    CONSTRAINT chk_user_prefs_theme CHECK (theme IN ('light', 'dark', 'system')),
  densidade TEXT NOT NULL DEFAULT 'normal'
    CONSTRAINT chk_user_prefs_densidade CHECK (densidade IN ('compacto', 'normal', 'confortavel')),
  notificacoes JSONB NOT NULL DEFAULT '{"tarefas_email": true, "whatsapp_notif": true, "leads_novos": true}'::jsonb,
  filtros_salvos JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.user_preferences IS 'Preferências individuais de interface e notificações de cada usuário.';

-- 6.25 TABELA 28: AUDIT LOG (Auditoria Geral do Sistema — Append-Only)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  tabela TEXT NOT NULL,
  registro_id UUID,
  valores_anteriores JSONB,
  valores_novos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.audit_log IS 'Log append-only restrito a administradores para auditoria das alterações no CRM.';

-- 6.26 TABELA 29: CANAIS MULTICANAL DO WHATSAPP
CREATE TABLE IF NOT EXISTS public.whatsapp_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  numero_telefone TEXT NOT NULL UNIQUE,
  provedor TEXT NOT NULL DEFAULT 'oficial',
  ativo BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.whatsapp_channels IS 'Canais e números de atendimento de WhatsApp cadastrados no CRM (sem seeds fictícios).';

-- 6.27 TABELA 30: TEMPLATES DE MENSAGENS WHATSAPP
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  conteudo TEXT NOT NULL,
  descricao TEXT,
  modo_disparo TEXT NOT NULL DEFAULT 'desligado'
    CONSTRAINT chk_msg_tpl_modo_disparo CHECK (modo_disparo IN ('desligado', 'aprovacao', 'automatico')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.message_templates IS 'Modelos de mensagens com suporte às tags {nome}, {empresa}, {vendedor}, {operadora}, {data}.';

-- 6.28 TABELA 31: SESSÕES DE CONVERSA DO WHATSAPP
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
  phone_number_id TEXT,
  remote_jid TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aberta'
    CONSTRAINT chk_conversations_status CHECK (status IN ('aberta', 'aguardando', 'resolvida', 'fechada')),
  nao_lidas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.conversations IS 'Sessões ativas de conversa de WhatsApp vinculadas a canais, contatos e corretores.';

-- 6.29 TABELA 32: MENSAGENS DO WHATSAPP
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  external_message_id TEXT,
  direction public.message_direction NOT NULL,
  conteudo TEXT NOT NULL,
  status_entrega public.message_delivery_status NOT NULL DEFAULT 'pending',
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.messages IS 'Mensagens enviadas e recebidas no canal de atendimento do WhatsApp.';

-- ------------------------------------------------------------------------------
-- 7. ÍNDICES DE PERFORMANCE E INTEGRIDADE
-- ------------------------------------------------------------------------------

-- Perfis
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_ativo ON public.profiles(ativo);
CREATE INDEX IF NOT EXISTS idx_profiles_recebe_leads ON public.profiles(recebe_leads_automaticos) WHERE ativo = true;

-- Operadoras
CREATE INDEX IF NOT EXISTS idx_carriers_ativo ON public.carriers(ativo);

-- Empresas e Contatos
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_companies_nome_fantasia ON public.companies(nome_fantasia);
CREATE INDEX IF NOT EXISTS idx_companies_cidade_estado ON public.companies(cidade, estado);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_celular ON public.contacts(celular);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_cpf ON public.contacts(cpf);
CREATE INDEX IF NOT EXISTS idx_contacts_nome ON public.contacts(nome);

-- Oportunidades
CREATE INDEX IF NOT EXISTS idx_opp_owner_id ON public.opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opp_stage_id ON public.opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opp_funnel_type ON public.opportunities(funnel_type);
CREATE INDEX IF NOT EXISTS idx_opp_status ON public.opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opp_contact_id ON public.opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_opp_company_id ON public.opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opp_product_id ON public.opportunities(product_id);
CREATE INDEX IF NOT EXISTS idx_opp_carrier_id ON public.opportunities(carrier_id);
CREATE INDEX IF NOT EXISTS idx_opp_current_carrier ON public.opportunities(current_carrier_id);
CREATE INDEX IF NOT EXISTS idx_opp_health_data_gin ON public.opportunities USING GIN (health_data);
CREATE INDEX IF NOT EXISTS idx_opp_attribution_gin ON public.opportunities USING GIN (attribution);
CREATE INDEX IF NOT EXISTS idx_opp_origem ON public.opportunities(origem);
CREATE INDEX IF NOT EXISTS idx_opp_campanha ON public.opportunities(campanha);
CREATE INDEX IF NOT EXISTS idx_opp_data_entrada ON public.opportunities(data_entrada DESC);
CREATE INDEX IF NOT EXISTS idx_opp_archived_at ON public.opportunities(archived_at) WHERE archived_at IS NOT NULL;

-- Tarefas
CREATE INDEX IF NOT EXISTS idx_tasks_opp_id ON public.tasks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- Timeline
CREATE INDEX IF NOT EXISTS idx_timeline_opp_created ON public.opportunity_timeline(opportunity_id, created_at DESC);

-- Históricos estruturados
CREATE INDEX IF NOT EXISTS idx_opp_assignments_opp ON public.opportunity_assignments(opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opp_stage_hist_opp ON public.opportunity_stage_history(opportunity_id, data_entrada DESC);

-- Contratos e Financeiro
CREATE INDEX IF NOT EXISTS idx_contracts_opp_id ON public.contracts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_carrier_id ON public.contracts(carrier_id);
CREATE INDEX IF NOT EXISTS idx_contracts_responsavel ON public.contracts(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_renovacao ON public.contracts(data_renovacao);
CREATE INDEX IF NOT EXISTS idx_contract_financials_contract ON public.contract_financials(contract_id);
CREATE INDEX IF NOT EXISTS idx_commission_installments_contract ON public.commission_installments(contract_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_commission_installments_financial ON public.commission_installments(contract_financial_id);

-- Pós-venda
CREATE INDEX IF NOT EXISTS idx_post_sale_contract ON public.post_sale_requests(contract_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_status ON public.post_sale_requests(status);
CREATE INDEX IF NOT EXISTS idx_post_sale_responsavel ON public.post_sale_requests(responsavel_id);

-- Checklists e Campos Personalizados
CREATE INDEX IF NOT EXISTS idx_checklist_items_contract ON public.document_checklist_items(contract_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_opp ON public.document_checklist_items(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_opp ON public.custom_field_values(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_contract ON public.custom_field_values(contract_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_definition ON public.custom_field_values(definition_id);

-- Preferências
CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON public.user_preferences(user_id);

-- Auditoria
CREATE INDEX IF NOT EXISTS idx_audit_tabela_registro ON public.audit_log(tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON public.audit_log(user_id, created_at DESC);

-- Mensageria WhatsApp
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON public.conversations(channel_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_opp ON public.conversations(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_conversations_resp ON public.conversations(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at ASC);

-- ------------------------------------------------------------------------------
-- 8. TRIGGERS OPERACIONAIS, DE INTEGRIDADE E DE NEGÓCIO
-- ------------------------------------------------------------------------------

-- 8.1 Função Geral de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN 
    SELECT unnest(ARRAY[
      'profiles',
      'carriers',
      'products',
      'carrier_products',
      'companies',
      'contacts',
      'pipeline_stages',
      'loss_reasons',
      'task_types',
      'opportunities',
      'tasks',
      'contracts',
      'commission_rules',
      'bonus_campaigns',
      'contract_financials',
      'commission_installments',
      'document_checklist_templates',
      'document_checklist_items',
      'post_sale_requests',
      'custom_field_definitions',
      'custom_field_values',
      'user_preferences',
      'whatsapp_channels',
      'message_templates',
      'conversations'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I;', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();', t);
  END LOOP;
END $$;

-- 8.2 Criação Automática de Profile no Signup (auth.users -> public.profiles)
-- Todo novo signup nasce SEMPRE como 'vendedor'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    nome,
    email,
    celular,
    role,
    ativo,
    recebe_leads_automaticos
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'celular',
    'vendedor'::public.user_role,
    true,
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      updated_at = timezone('utc'::text, now());

  INSERT INTO public.user_preferences (user_id, theme)
  VALUES (NEW.id, 'system')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8.3 Trigger de Proteção dos Campos Administrativos de public.profiles
-- Protege role, ativo e recebe_leads_automaticos: vendedor/usuário comum NÃO altera.
-- Condição estrita: permite mudança de role SOMENTE se:
--   (a) public.is_admin() = true (operação normal pós-bootstrap por administrador ativo), OU
--   (b) current_setting('kkj.bootstrap_active', true) = 'on' E nenhum admin ativo existe E NEW.role = 'administrador'.
-- Sem o GUC 'kkj.bootstrap_active' = 'on', NUNCA permite — nem na ausência de admins.
-- Mitigação de segurança de canal:
-- PostgREST não expõe set_config/SET para usuários via REST/GraphQL, e bootstrap_admin()
-- tem privilégios revogados de PUBLIC, anon e authenticated. Portanto, nenhum cliente authenticated
-- consegue definir o GUC ou invocar o procedimento de bootstrap.
CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_exists BOOLEAN;
  v_bootstrap_active TEXT;
BEGIN
  -- Verificar se houve alteração em campos administrativos
  IF (OLD.role IS DISTINCT FROM NEW.role)
     OR (OLD.ativo IS DISTINCT FROM NEW.ativo)
     OR (OLD.recebe_leads_automaticos IS DISTINCT FROM NEW.recebe_leads_automaticos) THEN

    -- (a) Se já é administrador ativo, a alteração é permitida normalmente
    IF public.is_admin() THEN
      RETURN NEW;
    END IF;

    -- (b) Canal administrativo seguro de bootstrap:
    -- Exige estritamente o GUC 'kkj.bootstrap_active' = 'on' setado em tempo de transação (SET LOCAL)
    -- pela função administrativa public.bootstrap_admin() no SQL Editor, ausência total de administradores
    -- ativos e que o novo papel seja 'administrador'.
    v_bootstrap_active := current_setting('kkj.bootstrap_active', true);

    IF v_bootstrap_active = 'on' AND NEW.role = 'administrador'::public.user_role THEN
      SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.role = 'administrador'::public.user_role AND p.ativo = true
      ) INTO v_admin_exists;

      IF NOT v_admin_exists THEN
        -- Permite bootstrap inicial exclusivamente pelo canal administrativo
        RETURN NEW;
      END IF;
    END IF;

    RAISE EXCEPTION 'Apenas administradores ativos podem alterar papel (role), status (ativo) ou flag de leads.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE OF role, ativo, recebe_leads_automaticos ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_role_update();

REVOKE ALL ON FUNCTION public.check_profile_role_update() FROM PUBLIC;

-- 8.3.1 Procedimento Administrativo Explícito de Bootstrap do Primeiro Administrador
-- Destinado exclusivamente ao SQL Editor do Supabase (DBA / Administrador do Banco via postgres/service_role).
-- Revogado expressamente de PUBLIC, anon e authenticated para não criar qualquer backdoor de API/frontend.
-- Ativa o GUC 'kkj.bootstrap_active' = 'on' com is_local = true no escopo da transação antes de promover o profile.
CREATE OR REPLACE FUNCTION public.bootstrap_admin(p_email TEXT)
RETURNS TABLE (
  promoted_id UUID,
  promoted_nome TEXT,
  promoted_email TEXT,
  promoted_role public.user_role,
  status_mensagem TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_exists BOOLEAN;
  v_profile RECORD;
BEGIN
  -- 1. Validar se já existe algum administrador ativo no sistema
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.role = 'administrador'::public.user_role AND p.ativo = true
  ) INTO v_admin_exists;

  IF v_admin_exists THEN
    RAISE EXCEPTION 'Operação bloqueada: o CRM KKJ já possui administrador ativo configurado.';
  END IF;

  -- 2. Localizar o profile do usuário pelo e-mail (lower(trim(email)))
  SELECT p.id, p.nome, p.email, p.role
  INTO v_profile
  FROM public.profiles p
  WHERE lower(trim(p.email)) = lower(trim(p_email));

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Usuário com o e-mail "%" não foi encontrado em public.profiles. Realize o cadastro prévio antes de promover.', p_email;
  END IF;

  -- 3. Ativar o GUC de sessão/transação com escopo local exclusivo para o UPDATE
  PERFORM set_config('kkj.bootstrap_active', 'on', true);

  -- 4. Promover explicitamente para administrador
  UPDATE public.profiles
  SET role = 'administrador'::public.user_role,
      ativo = true,
      updated_at = timezone('utc'::text, now())
  WHERE id = v_profile.id;

  -- 5. Retornar informações úteis do usuário promovido
  RETURN QUERY
  SELECT
    v_profile.id AS promoted_id,
    v_profile.nome AS promoted_nome,
    v_profile.email AS promoted_email,
    'administrador'::public.user_role AS promoted_role,
    'Primeiro administrador promovido com sucesso no CRM KKJ.'::TEXT AS status_mensagem;
END;
$$;
COMMENT ON FUNCTION public.bootstrap_admin(TEXT) IS 'Procedimento de uso exclusivo no SQL Editor para eleger o primeiro administrador da KKJ quando nenhum existe. Ativa kkj.bootstrap_active localmente e é revogado de anon e authenticated.';

REVOKE ALL ON FUNCTION public.bootstrap_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_admin(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.bootstrap_admin(TEXT) FROM authenticated;

-- 8.4 Trigger de Validação de Etapa, Funil, Perda e Proteção de Autotransferência de Leads
-- Totalmente segregado por TG_OP: não acessa OLD no caminho de INSERT.
-- Venda ganha tratada com robustez: fallback por ordem máxima caso renomeada.
CREATE OR REPLACE FUNCTION public.validate_opportunity_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stage_funnel public.funnel_type;
  v_stage_name TEXT;
  v_won_stage_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 1. Validar coerência entre etapa (stage_id) e o funnel_type da oportunidade no INSERT
    SELECT ps.funnel_type, ps.nome INTO v_stage_funnel, v_stage_name
    FROM public.pipeline_stages ps
    WHERE ps.id = NEW.stage_id;

    IF v_stage_funnel IS NULL THEN
      RAISE EXCEPTION 'Etapa de pipeline inválida ou inexistente.';
    END IF;

    IF v_stage_funnel <> NEW.funnel_type THEN
      RAISE EXCEPTION 'A etapa informada pertence ao funil %, mas a oportunidade está no funil %.',
        v_stage_funnel, NEW.funnel_type;
    END IF;

    -- Validar perda no INSERT
    IF NEW.status = 'perdida' THEN
      IF NEW.loss_reason_id IS NULL THEN
        RAISE EXCEPTION 'Oportunidades com status "perdida" exigem a seleção de um motivo de perda (loss_reason_id).';
      END IF;
    ELSE
      NEW.loss_reason_id := NULL;
      NEW.loss_notes := NULL;
    END IF;

    -- Identificar etapa "Venda ganha" com fallback robusto (nome = 'Venda ganha' ou maior ordem do funil de vendas)
    IF NEW.funnel_type = 'vendas' THEN
      SELECT ps.id INTO v_won_stage_id
      FROM public.pipeline_stages ps
      WHERE ps.funnel_type = 'vendas'
      ORDER BY (ps.nome = 'Venda ganha') DESC, ps.ordem DESC
      LIMIT 1;

      IF NEW.stage_id = v_won_stage_id AND NEW.status <> 'ganha' THEN
        NEW.status := 'ganha';
      ELSIF NEW.status = 'ganha' AND NEW.stage_id <> v_won_stage_id THEN
        NEW.stage_id := v_won_stage_id;
      END IF;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- 1. Validar coerência entre etapa (stage_id) e o funnel_type no UPDATE
    SELECT ps.funnel_type, ps.nome INTO v_stage_funnel, v_stage_name
    FROM public.pipeline_stages ps
    WHERE ps.id = NEW.stage_id;

    IF v_stage_funnel IS NULL THEN
      RAISE EXCEPTION 'Etapa de pipeline inválida ou inexistente.';
    END IF;

    IF v_stage_funnel <> NEW.funnel_type THEN
      RAISE EXCEPTION 'A etapa informada pertence ao funil %, mas a oportunidade está no funil %.',
        v_stage_funnel, NEW.funnel_type;
    END IF;

    -- Validar perda no UPDATE
    IF NEW.status = 'perdida' THEN
      IF NEW.loss_reason_id IS NULL THEN
        RAISE EXCEPTION 'Oportunidades com status "perdida" exigem a seleção de um motivo de perda (loss_reason_id).';
      END IF;
    ELSE
      -- Ao sair de perdida (ou em qualquer outro status), limpa campos de perda
      NEW.loss_reason_id := NULL;
      NEW.loss_notes := NULL;
    END IF;

    -- Identificar etapa "Venda ganha" com fallback robusto
    IF NEW.funnel_type = 'vendas' THEN
      SELECT ps.id INTO v_won_stage_id
      FROM public.pipeline_stages ps
      WHERE ps.funnel_type = 'vendas'
      ORDER BY (ps.nome = 'Venda ganha') DESC, ps.ordem DESC
      LIMIT 1;

      IF NEW.stage_id = v_won_stage_id AND NEW.status <> 'ganha' THEN
        NEW.status := 'ganha';
      ELSIF NEW.status = 'ganha' AND NEW.stage_id <> v_won_stage_id AND NEW.stage_id = OLD.stage_id THEN
        -- Se marcado como ganho sem mudar de etapa manualmente, ajusta para a etapa ganha
        NEW.stage_id := v_won_stage_id;
      END IF;
    END IF;

    -- 2. IMPEDIR AUTOTRANSFERÊNCIA DE LEADS NO UPDATE:
    -- Se o owner_id estiver sendo alterado ou removido, exige privilégio de gestor/admin ou redistribuir_leads
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      IF NOT (public.is_manager_or_admin() OR public.has_permission('redistribuir_leads')) THEN
        RAISE EXCEPTION 'Vendedor não possui permissão para transferir ou remover o responsável do lead. Exige permissão de redistribuição.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_opportunity_rules ON public.opportunities;
CREATE TRIGGER trg_validate_opportunity_rules
  BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_opportunity_rules();

REVOKE ALL ON FUNCTION public.validate_opportunity_rules() FROM PUBLIC;

-- 8.5 Trigger de Validação de Alvo e Produto em Campos Personalizados (custom_field_values)
-- Valida alvo (oportunidade vs contrato) e coerência do product_id (caso a definição seja vinculada a produto específico).
CREATE OR REPLACE FUNCTION public.validate_custom_field_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expected_target public.custom_field_target;
  v_def_product_id UUID;
  v_record_product_id UUID;
BEGIN
  SELECT alvo, product_id INTO v_expected_target, v_def_product_id
  FROM public.custom_field_definitions
  WHERE id = NEW.definition_id;

  IF v_expected_target IS NULL THEN
    RAISE EXCEPTION 'Definição de campo personalizado não encontrada.';
  END IF;

  IF v_expected_target = 'oportunidade' THEN
    IF NEW.opportunity_id IS NULL THEN
      RAISE EXCEPTION 'Este campo personalizado é restrito ao alvo "oportunidade", mas opportunity_id não foi informado.';
    END IF;
    -- Validar compatibilidade de produto da oportunidade quando o campo não for global
    IF v_def_product_id IS NOT NULL THEN
      SELECT product_id INTO v_record_product_id
      FROM public.opportunities
      WHERE id = NEW.opportunity_id;

      IF v_record_product_id IS DISTINCT FROM v_def_product_id THEN
        RAISE EXCEPTION 'O campo personalizado pertence a um produto específico diferente do produto da oportunidade.';
      END IF;
    END IF;
  END IF;

  IF v_expected_target = 'contrato' THEN
    IF NEW.contract_id IS NULL THEN
      RAISE EXCEPTION 'Este campo personalizado é restrito ao alvo "contrato", mas contract_id não foi informado.';
    END IF;
    -- Validar compatibilidade de produto do contrato quando o campo não for global
    IF v_def_product_id IS NOT NULL THEN
      SELECT product_id INTO v_record_product_id
      FROM public.contracts
      WHERE id = NEW.contract_id;

      IF v_record_product_id IS DISTINCT FROM v_def_product_id THEN
        RAISE EXCEPTION 'O campo personalizado pertence a um produto específico diferente do produto do contrato.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_custom_field_target ON public.custom_field_values;
CREATE TRIGGER trg_validate_custom_field_target
  BEFORE INSERT OR UPDATE ON public.custom_field_values
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_custom_field_target();

REVOKE ALL ON FUNCTION public.validate_custom_field_target() FROM PUBLIC;

-- 8.6 Timeline Visual e Histórico Estruturado ao Alterar Oportunidade
CREATE OR REPLACE FUNCTION public.handle_opportunity_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_stage_name TEXT;
  new_stage_name TEXT;
  old_owner_name TEXT;
  new_owner_name TEXT;
  lost_reason_txt TEXT;
BEGIN
  -- 1. Mudança de Etapa
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    SELECT nome INTO old_stage_name FROM public.pipeline_stages WHERE id = OLD.stage_id;
    SELECT nome INTO new_stage_name FROM public.pipeline_stages WHERE id = NEW.stage_id;

    IF NEW.status = 'perdida' AND NEW.loss_reason_id IS NOT NULL THEN
      SELECT nome INTO lost_reason_txt FROM public.loss_reasons WHERE id = NEW.loss_reason_id;
    END IF;

    -- Registra na timeline textual (append-only)
    INSERT INTO public.opportunity_timeline (
      opportunity_id,
      tipo_evento,
      conteudo,
      dados_adicionais,
      user_id
    ) VALUES (
      NEW.id,
      'mudanca_etapa',
      format('Etapa alterada: %s → %s', COALESCE(old_stage_name, 'Início'), new_stage_name),
      jsonb_build_object(
        'etapa_anterior_id', OLD.stage_id,
        'etapa_anterior_nome', old_stage_name,
        'etapa_nova_id', NEW.stage_id,
        'etapa_nova_nome', new_stage_name,
        'motivo_perda', lost_reason_txt,
        'notas_perda', NEW.loss_notes
      ),
      auth.uid()
    );

    -- Fecha etapa anterior no histórico estruturado
    UPDATE public.opportunity_stage_history
    SET data_saida = timezone('utc'::text, now()),
        duracao_segundos = EXTRACT(EPOCH FROM (timezone('utc'::text, now()) - data_entrada))::BIGINT
    WHERE opportunity_id = NEW.id
      AND data_saida IS NULL;

    -- Insere nova linha aberta no histórico estruturado de etapas
    INSERT INTO public.opportunity_stage_history (
      opportunity_id,
      etapa_anterior_id,
      nova_etapa_id,
      usuario_id,
      data_entrada
    ) VALUES (
      NEW.id,
      OLD.stage_id,
      NEW.stage_id,
      auth.uid(),
      timezone('utc'::text, now())
    );
  END IF;

  -- 2. Mudança de Responsável (Owner)
  -- Determinação estruturada da origem (assignment_origin):
  -- Permite que processos automáticos informem a origem real via context config ('kkj.assignment_origin'),
  -- mantendo 'manual' como padrão para ações de tela do usuário sem confiar em campos livres do cliente.
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    DECLARE
      v_origin public.assignment_origin;
      v_ctx_origin TEXT;
    BEGIN
      v_ctx_origin := current_setting('kkj.assignment_origin', true);
      IF v_ctx_origin IN ('round_robin', 'redistribuicao', 'manual') THEN
        v_origin := v_ctx_origin::public.assignment_origin;
      ELSE
        v_origin := 'manual'::public.assignment_origin;
      END IF;

      SELECT nome INTO old_owner_name FROM public.profiles WHERE id = OLD.owner_id;
      SELECT nome INTO new_owner_name FROM public.profiles WHERE id = NEW.owner_id;

      INSERT INTO public.opportunity_timeline (
        opportunity_id,
        tipo_evento,
        conteudo,
        dados_adicionais,
        user_id
      ) VALUES (
        NEW.id,
        'mudanca_responsavel',
        format('Responsável alterado de "%s" para "%s"', COALESCE(old_owner_name, 'Sem responsável'), COALESCE(new_owner_name, 'Desconhecido')),
        jsonb_build_object(
          'responsavel_anterior_id', OLD.owner_id,
          'responsavel_anterior_nome', old_owner_name,
          'responsavel_novo_id', NEW.owner_id,
          'responsavel_novo_nome', new_owner_name,
          'origem', v_origin
        ),
        auth.uid()
      );

      INSERT INTO public.opportunity_assignments (
        opportunity_id,
        responsavel_anterior_id,
        novo_responsavel_id,
        alterado_por,
        motivo
      ) VALUES (
        NEW.id,
        OLD.owner_id,
        NEW.owner_id,
        auth.uid(),
        v_origin
      );
    END;
  END IF;

  -- 3. Mudança significativa de Valor da Venda
  IF OLD.valor_venda IS DISTINCT FROM NEW.valor_venda THEN
    INSERT INTO public.opportunity_timeline (
      opportunity_id,
      tipo_evento,
      conteudo,
      dados_adicionais,
      user_id
    ) VALUES (
      NEW.id,
      'sistema',
      format('Valor da venda alterado de R$ %s para R$ %s', OLD.valor_venda::text, NEW.valor_venda::text),
      jsonb_build_object(
        'valor_anterior', OLD.valor_venda,
        'valor_novo', NEW.valor_venda
      ),
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opportunity_changes ON public.opportunities;
CREATE TRIGGER trg_opportunity_changes
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.handle_opportunity_changes();

REVOKE ALL ON FUNCTION public.handle_opportunity_changes() FROM PUBLIC;

-- 8.7 Inserção inicial no histórico de etapas ao criar oportunidade
CREATE OR REPLACE FUNCTION public.handle_opportunity_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_origin public.assignment_origin;
  v_ctx_origin TEXT;
BEGIN
  INSERT INTO public.opportunity_stage_history (
    opportunity_id,
    etapa_anterior_id,
    nova_etapa_id,
    usuario_id,
    data_entrada
  ) VALUES (
    NEW.id,
    NULL,
    NEW.stage_id,
    COALESCE(auth.uid(), NEW.created_by),
    timezone('utc'::text, now())
  );

  IF NEW.owner_id IS NOT NULL THEN
    v_ctx_origin := current_setting('kkj.assignment_origin', true);
    IF v_ctx_origin IN ('round_robin', 'redistribuicao', 'manual') THEN
      v_origin := v_ctx_origin::public.assignment_origin;
    ELSE
      v_origin := 'manual'::public.assignment_origin;
    END IF;

    INSERT INTO public.opportunity_assignments (
      opportunity_id,
      responsavel_anterior_id,
      novo_responsavel_id,
      alterado_por,
      motivo
    ) VALUES (
      NEW.id,
      NULL,
      NEW.owner_id,
      COALESCE(auth.uid(), NEW.created_by),
      v_origin
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opportunity_created ON public.opportunities;
CREATE TRIGGER trg_opportunity_created
  AFTER INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.handle_opportunity_creation();

REVOKE ALL ON FUNCTION public.handle_opportunity_creation() FROM PUBLIC;

-- ------------------------------------------------------------------------------
-- 9. POLÍTICAS DE ROW LEVEL SECURITY (RLS REAL EM TODAS AS 32 TABELAS)
-- ------------------------------------------------------------------------------

-- Habilitar RLS em TODAS as 32 tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 9.1 PROFILES (SEM RECURSÃO INFINITA E COM PROTEÇÃO TOTAL)
-- Nota de Minimização de Dados: SELECT mantido para authenticated porque o CRM KKJ exige
-- a listagem de corretores e gestores em dropdowns operacionais (atribuição de leads,
-- filtros de equipe, responsáveis por tarefas e pós-venda).
-- UPDATE: usuário comum edita apenas seus dados pessoais (id = auth.uid()).
-- Os campos administrativos (role, ativo, recebe_leads_automaticos) são protegidos de forma
-- hermética pelo trigger BEFORE UPDATE check_profile_role_update(), ELIMINANDO QUALQUER SUBQUERY RECURSIVA na policy.
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_all_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- 9.2 PERMISSÕES GRANULARES
DROP POLICY IF EXISTS "permissions_select_auth" ON public.permissions;
CREATE POLICY "permissions_select_auth" ON public.permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "permissions_admin_write" ON public.permissions;
CREATE POLICY "permissions_admin_write" ON public.permissions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "user_permissions_select_auth" ON public.user_permissions;
CREATE POLICY "user_permissions_select_auth" ON public.user_permissions FOR SELECT TO authenticated USING (public.is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "user_permissions_admin_write" ON public.user_permissions;
CREATE POLICY "user_permissions_admin_write" ON public.user_permissions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9.3 OPERADORAS (Carriers) & CARRIER_PRODUCTS
DROP POLICY IF EXISTS "carriers_select_auth" ON public.carriers;
CREATE POLICY "carriers_select_auth" ON public.carriers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "carriers_admin_write" ON public.carriers;
CREATE POLICY "carriers_admin_write" ON public.carriers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "carrier_products_select_auth" ON public.carrier_products;
CREATE POLICY "carrier_products_select_auth" ON public.carrier_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "carrier_products_admin_write" ON public.carrier_products;
CREATE POLICY "carrier_products_admin_write" ON public.carrier_products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9.4 PRODUTOS, ETAPAS, PERDAS, TIPOS DE TAREFA, TEMPLATES
DROP POLICY IF EXISTS "products_select_auth" ON public.products;
CREATE POLICY "products_select_auth" ON public.products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "products_all_admin" ON public.products;
CREATE POLICY "products_all_admin" ON public.products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "pipeline_stages_select_auth" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select_auth" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pipeline_stages_all_admin" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_all_admin" ON public.pipeline_stages FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "loss_reasons_select_auth" ON public.loss_reasons;
CREATE POLICY "loss_reasons_select_auth" ON public.loss_reasons FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "loss_reasons_all_admin" ON public.loss_reasons;
CREATE POLICY "loss_reasons_all_admin" ON public.loss_reasons FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "task_types_select_auth" ON public.task_types;
CREATE POLICY "task_types_select_auth" ON public.task_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "task_types_all_admin" ON public.task_types;
CREATE POLICY "task_types_all_admin" ON public.task_types FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "message_templates_select_auth" ON public.message_templates;
CREATE POLICY "message_templates_select_auth" ON public.message_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "message_templates_all_admin" ON public.message_templates;
CREATE POLICY "message_templates_all_admin" ON public.message_templates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9.5 EMPRESAS (Companies)
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
CREATE POLICY "companies_select_policy" ON public.companies FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR public.has_permission('visualizar_todas_empresas')
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.company_id = companies.id AND o.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.company_id = companies.id AND c.responsavel_id = auth.uid())
  );

DROP POLICY IF EXISTS "companies_insert_policy" ON public.companies;
CREATE POLICY "companies_insert_policy" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
CREATE POLICY "companies_update_policy" ON public.companies FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.company_id = companies.id AND o.owner_id = auth.uid())
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.company_id = companies.id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "companies_delete_policy" ON public.companies;
CREATE POLICY "companies_delete_policy" ON public.companies FOR DELETE TO authenticated
  USING (public.is_admin());

-- 9.6 CONTATOS (Contacts)
DROP POLICY IF EXISTS "contacts_select_policy" ON public.contacts;
CREATE POLICY "contacts_select_policy" ON public.contacts FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR public.has_permission('visualizar_todos_contatos')
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.contact_id = contacts.id AND o.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.contact_id = contacts.id AND c.responsavel_id = auth.uid())
  );

DROP POLICY IF EXISTS "contacts_insert_policy" ON public.contacts;
CREATE POLICY "contacts_insert_policy" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "contacts_update_policy" ON public.contacts;
CREATE POLICY "contacts_update_policy" ON public.contacts FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.contact_id = contacts.id AND o.owner_id = auth.uid())
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.contact_id = contacts.id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "contacts_delete_policy" ON public.contacts;
CREATE POLICY "contacts_delete_policy" ON public.contacts FOR DELETE TO authenticated
  USING (public.is_admin());

-- 9.7 OPORTUNIDADES (Opportunities)
-- Regra de visibilidade de leads sem responsável: SOMENTE gestor/admin ou quem possui permissão visualizar_todos_leads.
DROP POLICY IF EXISTS "opportunities_select_policy" ON public.opportunities;
CREATE POLICY "opportunities_select_policy" ON public.opportunities FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR public.has_permission('visualizar_todos_leads')
    OR owner_id = auth.uid()
    OR (created_by = auth.uid() AND owner_id IS NULL)
  );

DROP POLICY IF EXISTS "opportunities_insert_policy" ON public.opportunities;
CREATE POLICY "opportunities_insert_policy" ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR owner_id = auth.uid()
    OR (owner_id IS NULL AND created_by = auth.uid())
  );

-- Impedir autotransferência de leads no UPDATE: vendedor dono edita dados comerciais,
-- mas a troca de owner_id é protegida pelo WITH CHECK e pela trigger validate_opportunity_rules.
DROP POLICY IF EXISTS "opportunities_update_policy" ON public.opportunities;
CREATE POLICY "opportunities_update_policy" ON public.opportunities FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR public.has_permission('redistribuir_leads')
    OR owner_id = auth.uid()
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR public.has_permission('redistribuir_leads')
    OR (owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "opportunities_delete_policy" ON public.opportunities;
-- ESTRATÉGIA DE PRESERVAÇÃO HISTÓRICA / V1:
-- NENHUMA policy de DELETE físico para authenticated. Oportunidades são arquivadas
-- preenchendo archived_at e archived_by via UPDATE pelo administrador, preservando
-- timeline, atribuições, contratos e histórico de etapas intactos.

-- 9.8 TAREFAS (Tasks)
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
CREATE POLICY "tasks_select_policy" ON public.tasks FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR assignee_id = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = tasks.opportunity_id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
-- Vendedor comum pode criar tarefa para si mesmo (assignee_id = auth.uid())
-- ou para oportunidade da qual é owner (assignee_id = auth.uid() AND owner_id = auth.uid()).
-- Não pode atribuir arbitrariamente tarefas a outros corretores.
-- Gestores e Administradores possuem permissão irrestrita de atribuição a terceiros.
CREATE POLICY "tasks_insert_policy" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR (
      created_by = auth.uid()
      AND (
        assignee_id = auth.uid()
        OR (
          opportunity_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.opportunities o
            WHERE o.id = tasks.opportunity_id AND o.owner_id = auth.uid()
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
CREATE POLICY "tasks_update_policy" ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR assignee_id = auth.uid()
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR assignee_id = auth.uid()
  );

DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
CREATE POLICY "tasks_delete_policy" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_manager_or_admin() OR created_by = auth.uid());

-- 9.9 TIMELINE (Append-Only Real: sem UPDATE nem DELETE para ninguém)
DROP POLICY IF EXISTS "timeline_select_policy" ON public.opportunity_timeline;
CREATE POLICY "timeline_select_policy" ON public.opportunity_timeline FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR public.has_permission('visualizar_todos_leads')
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_timeline.opportunity_id
        AND o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "timeline_insert_policy" ON public.opportunity_timeline;
-- Usuário comum somente pode inserir notas manuais: tipo_evento = 'nota' AND user_id = auth.uid()
-- AND ter acesso à oportunidade. Eventos automáticos (mudanca_etapa, mudanca_responsavel,
-- venda_contrato, sistema) são gravados exclusivamente pelas funções/triggers internas SECURITY DEFINER.
CREATE POLICY "timeline_insert_policy" ON public.opportunity_timeline FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR (
      tipo_evento = 'nota'::public.timeline_action_type
      AND user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = opportunity_timeline.opportunity_id
          AND (o.owner_id = auth.uid() OR (o.owner_id IS NULL AND public.has_permission('visualizar_todos_leads')))
      )
    )
  );

-- 9.10 HISTÓRICOS ESTRUTURADOS (Assignments & Stage History — Append-Only)
DROP POLICY IF EXISTS "opp_assignments_select" ON public.opportunity_assignments;
CREATE POLICY "opp_assignments_select" ON public.opportunity_assignments FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR novo_responsavel_id = auth.uid()
    OR responsavel_anterior_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_assignments.opportunity_id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "opp_assignments_insert" ON public.opportunity_assignments;
-- Inserção direta de assignments BLOQUEADA para frontend/authenticated:
-- A tabela é alimentada exclusivamente pelos triggers/funções internas SECURITY DEFINER de mudança de responsável.

DROP POLICY IF EXISTS "stage_history_select" ON public.opportunity_stage_history;
CREATE POLICY "stage_history_select" ON public.opportunity_stage_history FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_stage_history.opportunity_id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "stage_history_insert" ON public.opportunity_stage_history;
-- Inserção direta de stage_history BLOQUEADA para frontend/authenticated:
-- A tabela é alimentada exclusivamente pelos triggers/funções internas SECURITY DEFINER de transição de etapa.

-- 9.11 CONTRATOS (Contracts)
DROP POLICY IF EXISTS "contracts_select_policy" ON public.contracts;
CREATE POLICY "contracts_select_policy" ON public.contracts FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR responsavel_id = auth.uid()
  );

DROP POLICY IF EXISTS "contracts_insert_policy" ON public.contracts;
CREATE POLICY "contracts_insert_policy" ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR responsavel_id = auth.uid()
  );

DROP POLICY IF EXISTS "contracts_update_policy" ON public.contracts;
CREATE POLICY "contracts_update_policy" ON public.contracts FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin() OR responsavel_id = auth.uid())
  WITH CHECK (public.is_manager_or_admin() OR responsavel_id = auth.uid());

DROP POLICY IF EXISTS "contracts_delete_policy" ON public.contracts;
CREATE POLICY "contracts_delete_policy" ON public.contracts FOR DELETE TO authenticated
  USING (public.is_admin());

-- 9.12 REGRAS DE COMISSÃO & BONIFICAÇÃO (Configurações Financeiras)
DROP POLICY IF EXISTS "commission_rules_select_auth" ON public.commission_rules;
CREATE POLICY "commission_rules_select_auth" ON public.commission_rules FOR SELECT TO authenticated USING (public.is_manager_or_admin() OR public.is_admin());
DROP POLICY IF EXISTS "commission_rules_admin_write" ON public.commission_rules;
CREATE POLICY "commission_rules_admin_write" ON public.commission_rules FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "bonus_campaigns_select_auth" ON public.bonus_campaigns;
-- bonus_campaigns expõe parâmetros financeiros sensíveis (percentual_bonus, faixas_metas, valor_fixo).
-- SELECT direto restrito exclusivamente a administradores ativos.
CREATE POLICY "bonus_campaigns_select_auth" ON public.bonus_campaigns FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "bonus_campaigns_admin_write" ON public.bonus_campaigns;
CREATE POLICY "bonus_campaigns_admin_write" ON public.bonus_campaigns FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9.13 FINANCEIRO SENSÍVEL (Contract Financials & Commission Installments)
-- REGRA ESTRITA: SOMENTE ADMINISTRADOR TEM ACESSO DIRETO VIA RLS.
-- Vendedores e Gestores NÃO possuem SELECT direto em contract_financials nem em commission_installments.
DROP POLICY IF EXISTS "financials_admin_select" ON public.contract_financials;
CREATE POLICY "financials_admin_select" ON public.contract_financials FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "financials_admin_insert" ON public.contract_financials;
CREATE POLICY "financials_admin_insert" ON public.contract_financials FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "financials_admin_update" ON public.contract_financials;
CREATE POLICY "financials_admin_update" ON public.contract_financials FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "financials_admin_delete" ON public.contract_financials;
CREATE POLICY "financials_admin_delete" ON public.contract_financials FOR DELETE TO authenticated
  USING (public.is_admin());

-- commission_installments: SOMENTE administrador ativo via RLS direto.
-- Vendedores consultam suas parcelas EXCLUSIVAMENTE via RPC get_minhas_parcelas() ou get_meu_financeiro().
DROP POLICY IF EXISTS "installments_select_policy" ON public.commission_installments;
DROP POLICY IF EXISTS "installments_admin_select" ON public.commission_installments;
CREATE POLICY "installments_admin_select" ON public.commission_installments FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "installments_admin_write" ON public.commission_installments;
CREATE POLICY "installments_admin_write" ON public.commission_installments FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 9.14 CHECKLISTS DOCUMENTAIS
DROP POLICY IF EXISTS "doc_templates_select" ON public.document_checklist_templates;
CREATE POLICY "doc_templates_select" ON public.document_checklist_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_templates_admin" ON public.document_checklist_templates;
CREATE POLICY "doc_templates_admin" ON public.document_checklist_templates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "doc_items_select" ON public.document_checklist_items;
CREATE POLICY "doc_items_select" ON public.document_checklist_items FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR responsavel_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = document_checklist_items.contract_id AND c.responsavel_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = document_checklist_items.opportunity_id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "doc_items_write" ON public.document_checklist_items;
CREATE POLICY "doc_items_write" ON public.document_checklist_items FOR ALL TO authenticated
  USING (
    public.is_manager_or_admin()
    OR responsavel_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = document_checklist_items.contract_id AND c.responsavel_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = document_checklist_items.opportunity_id AND o.owner_id = auth.uid())
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR responsavel_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = document_checklist_items.contract_id AND c.responsavel_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = document_checklist_items.opportunity_id AND o.owner_id = auth.uid())
  );

-- 9.15 SOLICITAÇÕES DE PÓS-VENDA (Post Sale Requests)
DROP POLICY IF EXISTS "post_sale_select_policy" ON public.post_sale_requests;
CREATE POLICY "post_sale_select_policy" ON public.post_sale_requests FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR responsavel_id = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = post_sale_requests.contract_id AND c.responsavel_id = auth.uid())
  );

DROP POLICY IF EXISTS "post_sale_insert_policy" ON public.post_sale_requests;
CREATE POLICY "post_sale_insert_policy" ON public.post_sale_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR responsavel_id = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "post_sale_update_policy" ON public.post_sale_requests;
CREATE POLICY "post_sale_update_policy" ON public.post_sale_requests FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR responsavel_id = auth.uid()
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR responsavel_id = auth.uid()
  );

DROP POLICY IF EXISTS "post_sale_delete_policy" ON public.post_sale_requests;
CREATE POLICY "post_sale_delete_policy" ON public.post_sale_requests FOR DELETE TO authenticated
  USING (public.is_admin());

-- 9.16 CAMPOS PERSONALIZADOS (Definições e Valores)
DROP POLICY IF EXISTS "custom_defs_select" ON public.custom_field_definitions;
CREATE POLICY "custom_defs_select" ON public.custom_field_definitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "custom_defs_admin" ON public.custom_field_definitions;
CREATE POLICY "custom_defs_admin" ON public.custom_field_definitions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "custom_vals_select" ON public.custom_field_values;
CREATE POLICY "custom_vals_select" ON public.custom_field_values FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR (
      opportunity_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = custom_field_values.opportunity_id
          AND (o.owner_id = auth.uid() OR (o.owner_id IS NULL AND public.has_permission('visualizar_todos_leads')))
      )
    )
    OR (
      contract_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = custom_field_values.contract_id AND c.responsavel_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "custom_vals_write" ON public.custom_field_values;
CREATE POLICY "custom_vals_write" ON public.custom_field_values FOR ALL TO authenticated
  USING (
    public.is_manager_or_admin()
    OR (
      opportunity_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = custom_field_values.opportunity_id AND o.owner_id = auth.uid()
      )
    )
    OR (
      contract_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = custom_field_values.contract_id AND c.responsavel_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR (
      opportunity_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = custom_field_values.opportunity_id AND o.owner_id = auth.uid()
      )
    )
    OR (
      contract_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = custom_field_values.contract_id AND c.responsavel_id = auth.uid()
      )
    )
  );

-- 9.17 PREFERÊNCIAS DO USUÁRIO (User Preferences)
DROP POLICY IF EXISTS "user_prefs_select_own" ON public.user_preferences;
CREATE POLICY "user_prefs_select_own" ON public.user_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_prefs_insert_own" ON public.user_preferences;
CREATE POLICY "user_prefs_insert_own" ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_prefs_update_own" ON public.user_preferences;
CREATE POLICY "user_prefs_update_own" ON public.user_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 9.18 AUDIT LOG (Append-Only Real: Apenas SELECT para Admin, SEM INSERT/UPDATE/DELETE para usuários)
DROP POLICY IF EXISTS "audit_select_admin" ON public.audit_log;
CREATE POLICY "audit_select_admin" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "audit_insert_system" ON public.audit_log;
-- Nenhuma policy de INSERT para authenticated: inserção ocorre exclusivamente via trigger SECURITY DEFINER handle_audit_trigger.

-- 9.19 CANAIS WHATSAPP, CONVERSAS E MENSAGENS
DROP POLICY IF EXISTS "channels_select_auth" ON public.whatsapp_channels;
CREATE POLICY "channels_select_auth" ON public.whatsapp_channels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "channels_admin_write" ON public.whatsapp_channels;
CREATE POLICY "channels_admin_write" ON public.whatsapp_channels FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Conversas sem responsável visíveis somente por gestor/admin ou com permissão visualizar_todos_leads
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
CREATE POLICY "conversations_select_policy" ON public.conversations FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR (responsible_user_id IS NULL AND public.has_permission('visualizar_todos_leads'))
    OR responsible_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = conversations.opportunity_id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
CREATE POLICY "conversations_insert_policy" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR responsible_user_id = auth.uid()
    OR (responsible_user_id IS NULL AND public.is_manager_or_admin())
  );

DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations;
CREATE POLICY "conversations_update_policy" ON public.conversations FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR responsible_user_id = auth.uid()
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR responsible_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
CREATE POLICY "messages_select_policy" ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.responsible_user_id = auth.uid()
        OR (c.responsible_user_id IS NULL AND public.has_permission('visualizar_todos_leads'))
        OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = c.opportunity_id AND o.owner_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
-- Usuário authenticated autorizado pode inserir somente mensagens OUTGOING enviadas por ele mesmo (user_id = auth.uid()).
-- Mensagens INCOMING (recebidas do cliente) são inseridas exclusivamente por webhooks/serviços integrados server-side.
CREATE POLICY "messages_insert_policy" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    direction = 'outgoing'::public.message_direction
    AND user_id = auth.uid()
    AND (
      public.is_manager_or_admin()
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND (c.responsible_user_id = auth.uid() OR (c.responsible_user_id IS NULL AND public.has_permission('visualizar_todos_leads')))
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 10. FUNÇÕES RPC FINANCEIRAS SEGURAS (SECURITY DEFINER)
-- Retornam SOMENTE dados comerciais e repasses do vendedor autenticado.
-- NUNCA expõem margens da corretora, comissão prevista/recebida KKJ ou snapshots internos.
-- ------------------------------------------------------------------------------

-- 10.1 RPC get_meu_financeiro: Extrato por contrato
CREATE OR REPLACE FUNCTION public.get_meu_financeiro()
RETURNS TABLE (
  contract_id UUID,
  numero_contrato TEXT,
  vendedor_id UUID,
  operadora TEXT,
  plano TEXT,
  valor_venda NUMERIC(14, 2),
  repasse_vendedor NUMERIC(14, 2),
  bonificacao_vendedor NUMERIC(14, 2),
  total_a_receber NUMERIC(14, 2),
  status_contrato public.contract_status,
  data_inicio_vigencia DATE,
  data_pagamento DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.id AS contract_id,
    c.numero_contrato,
    c.responsavel_id AS vendedor_id,
    car.nome AS operadora,
    c.plano,
    c.valor_venda,
    COALESCE(f.repasse_vendedor, 0.00) AS repasse_vendedor,
    COALESCE(f.bonificacao_vendedor, 0.00) AS bonificacao_vendedor,
    (COALESCE(f.repasse_vendedor, 0.00) + COALESCE(f.bonificacao_vendedor, 0.00)) AS total_a_receber,
    c.status AS status_contrato,
    c.data_inicio_vigencia,
    c.data_pagamento
  FROM public.contracts c
  INNER JOIN public.carriers car ON car.id = c.carrier_id
  INNER JOIN public.contract_financials f ON f.contract_id = c.id
  WHERE (
    public.is_admin()
    OR c.responsavel_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.get_meu_financeiro() IS 'Função RPC SECURITY DEFINER para consulta do extrato financeiro pessoal do vendedor sem conceder SELECT direto em contract_financials. Operadora obtida exclusivamente via JOIN em carriers.';

REVOKE ALL ON FUNCTION public.get_meu_financeiro() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meu_financeiro() TO authenticated;

-- 10.2 RPC get_minhas_parcelas: Extrato de parcelas do vendedor
CREATE OR REPLACE FUNCTION public.get_minhas_parcelas()
RETURNS TABLE (
  contract_id UUID,
  numero_contrato TEXT,
  numero_parcela INTEGER,
  total_parcelas INTEGER,
  data_vencimento DATE,
  repasse_previsto_vendedor NUMERIC(14, 2),
  repasse_pago_vendedor NUMERIC(14, 2),
  data_repasse DATE,
  status TEXT,
  bonificacao_vendedor NUMERIC(14, 2)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.id AS contract_id,
    c.numero_contrato,
    ci.numero_parcela,
    ci.total_parcelas,
    ci.data_vencimento,
    ci.repasse_previsto_vendedor,
    ci.repasse_pago_vendedor,
    ci.data_repasse,
    ci.status,
    COALESCE(f.bonificacao_vendedor, 0.00) AS bonificacao_vendedor
  FROM public.commission_installments ci
  INNER JOIN public.contracts c ON c.id = ci.contract_id
  LEFT JOIN public.contract_financials f ON f.contract_id = c.id
  WHERE (
    public.is_admin()
    OR c.responsavel_id = auth.uid()
  )
  ORDER BY ci.data_vencimento ASC;
$$;

COMMENT ON FUNCTION public.get_minhas_parcelas() IS 'Função RPC SECURITY DEFINER para consulta segura de parcelas do vendedor sem SELECT direto em commission_installments.';

REVOKE ALL ON FUNCTION public.get_minhas_parcelas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_minhas_parcelas() TO authenticated;

-- ------------------------------------------------------------------------------
-- 11. TRIGGERS DE AUDITORIA GERAL (AUDIT LOG APPEND-ONLY)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, acao, tabela, registro_id, valores_novos)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, acao, tabela, registro_id, valores_anteriores, valores_novos)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, acao, tabela, registro_id, valores_anteriores)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_audit_trigger() FROM PUBLIC;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'opportunities',
      'contracts',
      'contract_financials',
      'profiles',
      'carriers',
      'products',
      'commission_rules',
      'bonus_campaigns',
      'pipeline_stages',
      'loss_reasons',
      'task_types',
      'custom_field_definitions',
      'document_checklist_templates',
      'permissions',
      'user_permissions'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_audit_trigger();', tbl, tbl);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 12. SEEDS DE CONFIGURAÇÃO ADMINISTRATIVA (IDEMPOTENTES)
-- ------------------------------------------------------------------------------

-- 12.1 Operadoras de Saúde e Seguradoras (Seeds Exatos - 8)
INSERT INTO public.carriers (nome, nome_curto, ativo, observacoes)
VALUES
  ('Amil', 'Amil', true, 'Amil Assistência Médica Internacional'),
  ('Bradesco Saúde', 'Bradesco', true, 'Bradesco Saúde e Odontoprev'),
  ('SulAmérica', 'SulAmérica', true, 'SulAmérica Saúde e Odonto'),
  ('Porto Seguro', 'Porto', true, 'Porto Seguro Saúde e Odontológico'),
  ('Alice', 'Alice', true, 'Alice Saúde Individual e Empresarial'),
  ('Seguros Unimed', 'Unimed', true, 'Seguros Unimed Saúde e Odonto'),
  ('MedSênior', 'MedSênior', true, 'MedSênior Medicina Preventiva e Sênior'),
  ('UniHosp', 'UniHosp', true, 'UniHosp Saúde Regional')
ON CONFLICT ((lower(trim(nome)))) DO UPDATE
SET nome_curto = EXCLUDED.nome_curto,
    ativo = EXCLUDED.ativo;

-- 12.2 Catálogo Inicial de Produtos (Seeds Exatos - 8)
-- Descrição neutra em Saúde PME (sem "2 a 99 vidas")
INSERT INTO public.products (nome, categoria, descricao, ativo)
VALUES
  ('Saúde PME', 'Saúde PME', 'Planos de saúde empresariais e corporativos para empresas.', true),
  ('Saúde PF', 'Saúde PF', 'Planos individuais e familiares diretos', true),
  ('Adesão', 'Adesão', 'Planos coletivos por adesão vinculados a entidades de classe', true),
  ('Odontológico', 'Odontológico', 'Planos odontológicos individuais e corporativos', true),
  ('Seguro de Vida', 'Seguro de Vida', 'Seguro de vida individual, em grupo e acidentes pessoais', true),
  ('Seguro Auto', 'Seguro Auto', 'Seguro de automóveis, frotas e coberturas especiais', true),
  ('Consórcio', 'Consórcio', 'Consórcios imobiliários, automotivos e de serviços', true),
  ('Outros', 'Outros', 'Responsabilidade civil, seguros patrimoniais e riscos diversos', true)
ON CONFLICT (nome) DO UPDATE
SET categoria = EXCLUDED.categoria,
    descricao = EXCLUDED.descricao,
    ativo = EXCLUDED.ativo;

-- 12.3 Etapas Exatas do Funil de Vendas (Comercial - 7)
-- 1. Novo Lead -> 2. Contato realizado -> 3. Qualificado -> 4. Cotação -> 5. Follow-up -> 6. Negociação -> 7. Venda ganha
INSERT INTO public.pipeline_stages (funnel_type, nome, ordem, e_saida, ativo)
VALUES
  ('vendas', 'Novo Lead', 1, false, true),
  ('vendas', 'Contato realizado', 2, false, true),
  ('vendas', 'Qualificado', 3, false, true),
  ('vendas', 'Cotação', 4, false, true),
  ('vendas', 'Follow-up', 5, false, true),
  ('vendas', 'Negociação', 6, false, true),
  ('vendas', 'Venda ganha', 7, false, true)
ON CONFLICT (funnel_type, nome) DO UPDATE
SET ordem = EXCLUDED.ordem,
    e_saida = EXCLUDED.e_saida,
    ativo = EXCLUDED.ativo;

-- 12.4 Etapas Exatas do Funil de Pós-Venda (Implantação & Ativação - 5)
-- 1. Documentação -> 2. Implantação -> 3. Aguardando pagamento -> 4. Implantado -> 5. Cliente ativo
-- PROIBIDO criar etapa "Proposta na operadora"
INSERT INTO public.pipeline_stages (funnel_type, nome, ordem, e_saida, ativo)
VALUES
  ('pos_venda', 'Documentação', 1, false, true),
  ('pos_venda', 'Implantação', 2, false, true),
  ('pos_venda', 'Aguardando pagamento', 3, false, true),
  ('pos_venda', 'Implantado', 4, false, true),
  ('pos_venda', 'Cliente ativo', 5, false, true)
ON CONFLICT (funnel_type, nome) DO UPDATE
SET ordem = EXCLUDED.ordem,
    e_saida = EXCLUDED.e_saida,
    ativo = EXCLUDED.ativo;

-- 12.5 Motivos de Perda Padronizados (Seeds Exatos - 9)
INSERT INTO public.loss_reasons (nome, ordem, ativo)
VALUES
  ('Preço', 1, true),
  ('Sem retorno', 2, true),
  ('Fechou com concorrente', 3, true),
  ('Sem CNPJ elegível', 4, true),
  ('Quantidade de vidas', 5, true),
  ('Carência', 6, true),
  ('Rede inadequada', 7, true),
  ('Desistiu', 8, true),
  ('Outro', 9, true)
ON CONFLICT (nome) DO UPDATE
SET ordem = EXCLUDED.ordem,
    ativo = EXCLUDED.ativo;

-- 12.6 Tipos de Tarefas Padronizados (Seeds Exatos - 9)
INSERT INTO public.task_types (tipo_slug, rotulo, descricao, ordem, ativo)
VALUES
  ('ligacao', 'Ligação', 'Contato telefônico de prospecção ou alinhamento', 1, true),
  ('whatsapp', 'WhatsApp', 'Envio de mensagem rápida, tabelas ou áudio no WhatsApp', 2, true),
  ('follow_up', 'Follow-up', 'Retorno de acompanhamento de cotação enviada', 3, true),
  ('reuniao', 'Reunião', 'Apresentação formal de estudo de rede e custos', 4, true),
  ('cotacao', 'Cotação', 'Montagem do estudo comparativo entre operadoras', 5, true),
  ('documentacao', 'Documentação', 'Recolhimento de documentos, cartão CNPJ e carteirinhas', 6, true),
  ('implantacao', 'Implantação', 'Protocolo e acompanhamento do processo na operadora', 7, true),
  ('cobranca_pagamento', 'Cobrança/Pagamento', 'Validação da quitação da 1ª mensalidade / taxa de adesão', 8, true),
  ('outro', 'Outro', 'Demais tarefas operacionais do dia a dia', 9, true)
ON CONFLICT (tipo_slug) DO UPDATE
SET rotulo = EXCLUDED.rotulo,
    descricao = EXCLUDED.descricao,
    ordem = EXCLUDED.ordem,
    ativo = EXCLUDED.ativo;

-- 12.7 Permissões Granulares Padrão do Sistema
INSERT INTO public.permissions (codigo, nome, descricao, categoria)
VALUES
  ('visualizar_todos_leads', 'Visualizar Todos os Leads', 'Permite ao corretor visualizar oportunidades além da sua própria carteira', 'leads'),
  ('redistribuir_leads', 'Redistribuir Leads', 'Permite transferir o responsável de qualquer oportunidade comercial', 'leads'),
  ('visualizar_relatorios', 'Visualizar Relatórios', 'Permite acessar visões consolidadas e relatórios de BI', 'relatorios'),
  ('visualizar_financeiro_interno', 'Visualizar Financeiro Interno', 'Permissão especial para acessar dados internos de faturamento da corretora', 'financeiro'),
  ('editar_configuracoes', 'Editar Configurações', 'Permite cadastrar operadoras, produtos e etapas', 'sistema'),
  ('administrar_usuarios', 'Administrar Usuários', 'Permite gerenciar cadastros e conceder permissões a outros corretores', 'usuarios')
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    categoria = EXCLUDED.categoria;

-- 12.8 Templates Padrão de Mensagens WhatsApp
INSERT INTO public.message_templates (nome, conteudo, descricao, modo_disparo, ativo)
VALUES
  (
    'Primeiro Contato - Novo Lead',
    'Olá {nome}! Tudo bem? Sou {vendedor} da KKJ Corretora. Recebemos seu contato com interesse em cotação de plano para a {empresa}. Como posso ajudar?',
    'Mensagem inicial de abordagem de novos leads recebidos',
    'desligado',
    true
  ),
  (
    'Envio de Estudo Comparativo',
    'Olá {nome}, aqui é {vendedor} da KKJ Corretora. Preparei o estudo comparativo de operadoras para a {empresa} cotando {operadora}. Posso te apresentar os detalhes?',
    'Acompanhamento de envio de proposta formal',
    'desligado',
    true
  ),
  (
    'Boas-vindas Pós-Venda',
    'Olá {nome}! Parabéns pela contratação do plano com a {operadora} via KKJ Corretora! A partir de hoje seu contrato entra em fase de implantação. Qualquer dúvida estamos à disposição.',
    'Mensagem enviada após fechamento de venda ganha',
    'desligado',
    true
  )
ON CONFLICT (nome) DO UPDATE
SET conteudo = EXCLUDED.conteudo,
    descricao = EXCLUDED.descricao,
    modo_disparo = EXCLUDED.modo_disparo,
    ativo = EXCLUDED.ativo;

-- Nota: whatsapp_channels inicia VAZIA (sem seed fictício de número de telefone).

-- ==============================================================================
-- FIM DA MIGRATION CONSOLIDADA V1 — KKJ INITIAL SCHEMA (32 TABELAS)
-- ==============================================================================
