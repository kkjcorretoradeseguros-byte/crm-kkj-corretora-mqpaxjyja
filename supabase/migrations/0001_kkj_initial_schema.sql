-- ==============================================================================
-- KK JEKABSON CORRETORA DE SEGUROS E BENEFÍCIOS (KKJ)
-- MIGRATION V1 CONSOLIDADA COMPLETA PARA SUPABASE (POSTGRESQL)
-- Arquivo: supabase/migrations/0001_kkj_initial_schema.sql
-- Idioma de documentação e comentários: Português do Brasil (pt-BR)
--
-- PRINCÍPIOS FUNDAMENTAIS:
-- 1. Idempotência estrita: seguro para execução limpa em banco Supabase vazio
--    ou reexecução via SQL Editor (IF NOT EXISTS, DROP IF EXISTS, ON CONFLICT).
-- 2. Resolução estrita de dependências lineares:
--    1. Extensões (uuid-ossp, pgcrypto)
--    2. Tipos enumerados (ENUMs)
--    3. profiles (vinculado a auth.users)
--    4. Funções helper SECURITY DEFINER (current_role, is_admin, is_gestor, is_vendedor, is_manager_or_admin, has_permission)
--    5. Tabelas do domínio KKJ ordenadas por dependência de Foreign Keys (28 tabelas)
--    6. Foreign Key circular (opportunities.proxima_tarefa_id -> tasks.id) via ALTER TABLE
--    7. Índices de performance, integridade funcional e busca indexada
--    8. Triggers operacionais e de negócio (updated_at, handle_new_user, check_profile_role,
--       trg_opportunity_changes, trg_opportunity_stage_history, trg_opportunity_assignments)
--    9. Políticas Row Level Security (RLS) habilitadas em TODAS as tabelas
--    10. RPC Financeira SECURITY DEFINER get_meu_financeiro() (restrita a authenticated)
--    11. Triggers de Auditoria append-only (audit_log) em tabelas críticas
--    12. Seeds idempotentes de configuração administrativa (ON CONFLICT DO NOTHING / UPDATE)
--
-- PROTEÇÃO FINANCEIRA E DE ROLES:
-- - contract_financials é estritamente restrita a administradores (RLS exclusiva is_admin()).
-- - Vendedor e gestor consultam financeiro pessoal SOMENTE via RPC get_meu_financeiro()
--   com SET search_path = '' e filtro estrito por auth.uid().
-- - Todo novo signup nasce VENDEDOR (sem auto-promoção).
-- - Coluna profiles.role protegida por trigger contra alteração por não-admin.
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
-- 3. CRIAR TABELA public.profiles
-- Criada antes dos helpers, pois as funções helper consultam public.profiles.
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
-- 4. ESTRUTURA DE PERMISSÕES GRANULARES (Criada logo após profiles)
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

-- ------------------------------------------------------------------------------
-- 6. TABELAS DO DOMÍNIO KKJ (ORDEM ESTRITA DE FOREIGN KEYS)
-- ------------------------------------------------------------------------------

-- 6.1 OPERADORAS DE SAÚDE E SEGURADORAS (Carriers)
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

-- Índice funcional de unicidade case-insensitive para prevenir duplicações de digitação
CREATE UNIQUE INDEX IF NOT EXISTS uq_carriers_nome_lower ON public.carriers (lower(trim(nome)));

-- 6.2 CATÁLOGO DE PRODUTOS (Seguros & Benefícios)
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

-- 6.3 RELACIONAMENTO OPERADORA × PRODUTO
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

-- 6.4 EMPRESAS / CLIENTES PJ
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  cidade TEXT,
  estado VARCHAR(2),
  segmento TEXT,
  notas TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.companies IS 'Empresas clientes e estipulantes de apólices e planos de saúde PJ.';

-- 6.5 CONTATOS (Pessoas Físicas, Titulares ou Interlocutores PJ)
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  celular TEXT NOT NULL,
  email TEXT,
  cargo TEXT,
  cpf TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  notas TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.contacts IS 'Contatos individuais, segurados titulares ou interlocutores corporativos.';

-- 6.6 ETAPAS DO PIPELINE (Funis de Vendas e Pós-Venda)
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

-- 6.7 MOTIVOS DE PERDA (Configuráveis)
CREATE TABLE IF NOT EXISTS public.loss_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.loss_reasons IS 'Motivos padronizados de encerramento sem fechamento no funil de vendas.';

-- 6.8 TIPOS DE TAREFA (Configuráveis)
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

-- 6.9 OPORTUNIDADES (Registro Central dos Funis)
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  carrier_id UUID REFERENCES public.carriers(id) ON DELETE SET NULL,
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
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_opp_loss_reason CHECK (
    (status = 'perdida' AND loss_reason_id IS NOT NULL) OR
    (status <> 'perdida')
  )
);
COMMENT ON TABLE public.opportunities IS 'Entidade central comercial e de pós-venda com dados estruturados de marketing, saúde e distribuição.';
COMMENT ON COLUMN public.opportunities.carrier_id IS 'Operadora principal cotada ou negociada na oportunidade.';
COMMENT ON COLUMN public.opportunities.health_data IS 'JSONB com: possui_plano_atual, operadora_atual, operadora_cotada, cnpj, razao_social, qtd_vidas, idades, cidade, estado, valor_plano_atual, tipo_contratacao, acomodacao, rede_desejada, objetivo, data_contratacao, data_renovacao.';

-- 6.10 TAREFAS OPERACIONAIS
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
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.tasks IS 'Tarefas, follow-ups e compromissos vinculados a corretores e oportunidades.';

-- FK circular de proxima_tarefa_id em opportunities
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

-- 6.11 TIMELINE VISUAL DA OPORTUNIDADE (Append-Only)
CREATE TABLE IF NOT EXISTS public.opportunity_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  tipo_evento public.timeline_action_type NOT NULL DEFAULT 'sistema',
  conteudo TEXT NOT NULL,
  dados_adicionais JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.opportunity_timeline IS 'Timeline append-only (imutável) para visualização cronológica das ações e notas da oportunidade.';

-- 6.12 HISTÓRICO ESTRUTURADO DE MUDANÇA DE RESPONSÁVEL (Assignments)
CREATE TABLE IF NOT EXISTS public.opportunity_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  responsavel_anterior_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  novo_responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  alterado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  motivo public.assignment_origin NOT NULL DEFAULT 'manual',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.opportunity_assignments IS 'Histórico estruturado de distribuição de leads para auditoria e relatórios de round-robin.';

-- 6.13 HISTÓRICO ESTRUTURADO DE ETAPAS (Para BI / Analytics de Gargalos)
CREATE TABLE IF NOT EXISTS public.opportunity_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  etapa_anterior_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  nova_etapa_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_entrada TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  data_saida TIMESTAMPTZ,
  duracao_segundos BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.opportunity_stage_history IS 'Histórico estruturado de transições de etapa para cálculo de tempo médio e gargalos sem parsing de texto.';

-- 6.14 CONTRATOS (Snapshot Comercial e Cadastral)
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_contrato TEXT,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  carrier_id UUID REFERENCES public.carriers(id) ON DELETE RESTRICT,
  operadora TEXT, -- Nome texto legado para histórico
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
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.contracts IS 'Apólices e contratos ativos. Dados financeiros e comissões sensíveis em contract_financials.';

-- 6.15 REGRAS DE COMISSÃO (Parametrizável sem código)
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  carrier_id UUID REFERENCES public.carriers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  modalidade TEXT, -- PME, PF, Adesão, etc.
  tipo_regra public.calc_type NOT NULL DEFAULT 'percentual',
  percentual_base NUMERIC(6, 2),
  valor_fixo NUMERIC(14, 2),
  multiplo_mensalidade NUMERIC(6, 2),
  cronograma_parcelas JSONB NOT NULL DEFAULT '[]'::jsonb, -- Faixas e parcelamento
  data_inicio_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_vigencia DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.commission_rules IS 'Tabela de parametrização de regras de comissionamento por operadora e produto.';

-- 6.16 CAMPANHAS DE BONIFICAÇÃO (Independente da comissão normal)
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

-- 6.17 DADOS FINANCEIROS SENSÍVEIS DO CONTRATO (Proteção Real no PostgreSQL)
-- Separado fisicamente: Vendedores e Gestores NÃO possuem permissão de SELECT direto.
-- Acesso somente pelo Administrador via RLS ou pelo Vendedor via RPC get_meu_financeiro().
CREATE TABLE IF NOT EXISTS public.contract_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  faturamento_bruto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  comissao_prevista NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  comissao_recebida NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  data_prevista_recebimento DATE,
  data_efetiva_recebimento DATE,
  situacao_recebimento TEXT NOT NULL DEFAULT 'pendente',
  impostos_descontos NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  comissao_liquida NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  repasse_vendedor NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  bonificacao_vendedor NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  resultado_kkj NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  -- Snapshots imutáveis das regras no fechamento da venda
  commission_rule_id UUID REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  bonus_campaign_id UUID REFERENCES public.bonus_campaigns(id) ON DELETE SET NULL,
  comissao_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  bonificacao_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.contract_financials IS 'Dados financeiros ultrassensíveis da KKJ: restritos a administrador via RLS.';

-- 6.18 PARCELAS / CRONOGRAMA DE COMISSÃO (Previsto × Recebido em Parcelas)
CREATE TABLE IF NOT EXISTS public.commission_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  contract_financial_id UUID NOT NULL REFERENCES public.contract_financials(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  total_parcelas INTEGER NOT NULL DEFAULT 1,
  data_vencimento DATE NOT NULL,
  valor_previsto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  repasse_previsto_vendedor NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  valor_recebido NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  repasse_pago_vendedor NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  data_recebimento DATE,
  data_repasse DATE,
  status TEXT NOT NULL DEFAULT 'previsto', -- previsto, recebido, repassado, cancelado
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_contract_installment UNIQUE (contract_id, numero_parcela)
);
COMMENT ON TABLE public.commission_installments IS 'Detalhamento do cronograma de parcelas da comissão (previsto x recebido) da corretora e do vendedor.';

-- 6.19 TEMPLATES DE CHECKLIST DOCUMENTAL POR PRODUTO
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

-- 6.20 ITENS DE CHECKLIST DOCUMENTAL DO CLIENTE / CONTRATO
CREATE TABLE IF NOT EXISTS public.document_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.document_checklist_templates(id) ON DELETE SET NULL,
  nome_documento TEXT NOT NULL,
  status public.doc_status NOT NULL DEFAULT 'pendente',
  link_externo TEXT, -- Apenas link para repositório externo (ex: OneDrive), sem arquivos pesados no PostgreSQL
  data_recebimento DATE,
  observacao TEXT,
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.document_checklist_items IS 'Controle de recebimento de documentos sem guardar binários no PostgreSQL (apenas links externos).';

-- 6.21 SOLICITAÇÕES DE PÓS-VENDA (Atendimento Operacional Separado de Vendas)
CREATE TABLE IF NOT EXISTS public.post_sale_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo TEXT,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  tipo public.post_sale_type NOT NULL DEFAULT 'outro',
  status public.post_sale_status NOT NULL DEFAULT 'aberto',
  prioridade TEXT NOT NULL DEFAULT 'media', -- baixa, media, alta, urgente
  prazo DATE,
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  data_abertura TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  data_conclusao TIMESTAMPTZ,
  historico JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.post_sale_requests IS 'Demandas operacionais de pós-venda (inclusão/exclusão de vidas, faturamento, reembolso, etc.).';

-- 6.22 CAMPOS PERSONALIZADOS POR PRODUTO: DEFINIÇÃO
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  alvo public.custom_field_target NOT NULL DEFAULT 'oportunidade',
  nome TEXT NOT NULL,
  chave TEXT NOT NULL,
  tipo public.custom_field_type NOT NULL DEFAULT 'texto',
  opcoes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Para selecao / multipla_selecao
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_custom_field_product_chave UNIQUE (product_id, alvo, chave)
);
COMMENT ON TABLE public.custom_field_definitions IS 'Definições dinâmicas de campos personalizados por tipo de produto comercializado.';

-- 6.23 CAMPOS PERSONALIZADOS: VALORES ARMAZENADOS
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  registro_id UUID NOT NULL, -- ID da oportunidade ou do contrato
  valor JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_custom_field_reg_def UNIQUE (definition_id, registro_id)
);
COMMENT ON TABLE public.custom_field_values IS 'Valores preenchidos dos campos personalizados dinâmicos vinculados a registros do CRM.';

-- 6.24 PREFERÊNCIAS DO USUÁRIO (Tema Claro/Escuro/Sistema, Notificações, etc.)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system', -- light, dark, system
  densidade TEXT NOT NULL DEFAULT 'normal', -- compacto, normal, confortavel
  notificacoes JSONB NOT NULL DEFAULT '{"tarefas_email": true, "whatsapp_notif": true, "leads_novos": true}'::jsonb,
  filtros_salvos JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.user_preferences IS 'Preferências individuais de interface e notificações de cada corretor / colaborador.';

-- 6.25 AUDIT LOG (Auditoria Geral do Sistema — Append-Only)
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

-- 6.26 CANAIS MULTICANAL DO WHATSAPP (Agnóstico a Provedores)
CREATE TABLE IF NOT EXISTS public.whatsapp_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  numero_telefone TEXT NOT NULL,
  provedor TEXT NOT NULL DEFAULT 'oficial', -- meta, z-api, evolution, baileys
  ativo BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.whatsapp_channels IS 'Canais e números de atendimento de WhatsApp cadastrados no CRM.';

-- 6.27 TEMPLATES DE MENSAGENS WHATSAPP
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  conteudo TEXT NOT NULL,
  descricao TEXT,
  modo_disparo TEXT NOT NULL DEFAULT 'desligado', -- desligado, aprovacao, automatico
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.message_templates IS 'Modelos de mensagens com suporte às tags {nome}, {empresa}, {vendedor}, {operadora}, {data}.';

-- 6.28 SESSÕES DE CONVERSA DO WHATSAPP
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
  phone_number_id TEXT,
  remote_jid TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aberta', -- aberta, aguardando, resolvida, fechada
  nao_lidas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.conversations IS 'Sessões ativas de conversa de WhatsApp vinculadas a canais, contatos e corretores.';

-- 6.29 MENSAGENS DO WHATSAPP
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  external_message_id TEXT,
  direction public.message_direction NOT NULL,
  conteudo TEXT NOT NULL,
  status_entrega public.message_delivery_status NOT NULL DEFAULT 'pending',
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_opp_health_data_gin ON public.opportunities USING GIN (health_data);
CREATE INDEX IF NOT EXISTS idx_opp_attribution_gin ON public.opportunities USING GIN (attribution);
CREATE INDEX IF NOT EXISTS idx_opp_origem ON public.opportunities(origem);
CREATE INDEX IF NOT EXISTS idx_opp_campanha ON public.opportunities(campanha);
CREATE INDEX IF NOT EXISTS idx_opp_data_entrada ON public.opportunities(data_entrada DESC);

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

-- Pós-venda
CREATE INDEX IF NOT EXISTS idx_post_sale_contract ON public.post_sale_requests(contract_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_status ON public.post_sale_requests(status);
CREATE INDEX IF NOT EXISTS idx_post_sale_responsavel ON public.post_sale_requests(responsavel_id);

-- Checklists e Campos Personalizados
CREATE INDEX IF NOT EXISTS idx_checklist_items_contract ON public.document_checklist_items(contract_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_opp ON public.document_checklist_items(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_registro ON public.custom_field_values(registro_id);

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
-- 8. TRIGGERS OPERACIONAIS E AUTOMATISMOS
-- ------------------------------------------------------------------------------

-- 8.1 Função Geral de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

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
-- Regra estrita: TODO novo signup nasce SEMPRE como 'vendedor'.
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

  -- Cria preferências padrão para o usuário
  INSERT INTO public.user_preferences (user_id, theme)
  VALUES (NEW.id, 'system')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8.3 Trigger de Proteção da Coluna role
CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Apenas usuários administradores podem alterar o perfil (role) de um usuário.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_role_update();

-- 8.4 Timeline Visual e Histórico Estruturado ao Mudar Oportunidade
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
  tempo_segundos BIGINT;
BEGIN
  -- 1. Mudança de Etapa
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    SELECT nome INTO old_stage_name FROM public.pipeline_stages WHERE id = OLD.stage_id;
    SELECT nome INTO new_stage_name FROM public.pipeline_stages WHERE id = NEW.stage_id;

    IF NEW.status = 'perdida' AND NEW.loss_reason_id IS NOT NULL THEN
      SELECT nome INTO lost_reason_txt FROM public.loss_reasons WHERE id = NEW.loss_reason_id;
    END IF;

    -- Registra na timeline textual
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

    -- Atualiza registro anterior no histórico estruturado de etapas fechando a data de saída
    UPDATE public.opportunity_stage_history
    SET data_saida = timezone('utc'::text, now()),
        duracao_segundos = EXTRACT(EPOCH FROM (timezone('utc'::text, now()) - data_entrada))::BIGINT
    WHERE opportunity_id = NEW.id
      AND nova_etapa_id = OLD.stage_id
      AND data_saida IS NULL;

    -- Insere nova linha no histórico estruturado de etapas
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
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    SELECT nome INTO old_owner_name FROM public.profiles WHERE id = OLD.owner_id;
    SELECT nome INTO new_owner_name FROM public.profiles WHERE id = NEW.owner_id;

    -- Registra na timeline visual
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
        'responsavel_novo_nome', new_owner_name
      ),
      auth.uid()
    );

    -- Registra no histórico estruturado de atribuições
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
      'manual'::public.assignment_origin
    );
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

-- Inserção inicial no histórico de etapas quando uma oportunidade é criada
CREATE OR REPLACE FUNCTION public.handle_opportunity_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
      'manual'::public.assignment_origin
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opportunity_created ON public.opportunities;
CREATE TRIGGER trg_opportunity_created
  AFTER INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.handle_opportunity_creation();

-- ------------------------------------------------------------------------------
-- 9. POLÍTICAS DE ROW LEVEL SECURITY (RLS REAL)
-- ------------------------------------------------------------------------------

-- Habilitar RLS em TODAS as 28 tabelas
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

-- 9.1 PROFILES
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
  WITH CHECK (
    (id = auth.uid() AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
    OR public.is_admin()
  );

-- 9.2 PERMISSÕES GRANULARES
DROP POLICY IF EXISTS "permissions_select_auth" ON public.permissions;
CREATE POLICY "permissions_select_auth" ON public.permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "permissions_admin_write" ON public.permissions;
CREATE POLICY "permissions_admin_write" ON public.permissions FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "user_permissions_select_auth" ON public.user_permissions;
CREATE POLICY "user_permissions_select_auth" ON public.user_permissions FOR SELECT TO authenticated USING (public.is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "user_permissions_admin_write" ON public.user_permissions;
CREATE POLICY "user_permissions_admin_write" ON public.user_permissions FOR ALL TO authenticated USING (public.is_admin());

-- 9.3 OPERADORAS (Carriers) & CARRIER_PRODUCTS
DROP POLICY IF EXISTS "carriers_select_auth" ON public.carriers;
CREATE POLICY "carriers_select_auth" ON public.carriers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "carriers_admin_write" ON public.carriers;
CREATE POLICY "carriers_admin_write" ON public.carriers FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "carrier_products_select_auth" ON public.carrier_products;
CREATE POLICY "carrier_products_select_auth" ON public.carrier_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "carrier_products_admin_write" ON public.carrier_products;
CREATE POLICY "carrier_products_admin_write" ON public.carrier_products FOR ALL TO authenticated USING (public.is_admin());

-- 9.4 PRODUTOS, ETAPAS, PERDAS, TIPOS DE TAREFA, TEMPLATES
DROP POLICY IF EXISTS "products_select_auth" ON public.products;
CREATE POLICY "products_select_auth" ON public.products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "products_all_admin" ON public.products;
CREATE POLICY "products_all_admin" ON public.products FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "pipeline_stages_select_auth" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select_auth" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pipeline_stages_all_admin" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_all_admin" ON public.pipeline_stages FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "loss_reasons_select_auth" ON public.loss_reasons;
CREATE POLICY "loss_reasons_select_auth" ON public.loss_reasons FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "loss_reasons_all_admin" ON public.loss_reasons;
CREATE POLICY "loss_reasons_all_admin" ON public.loss_reasons FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "task_types_select_auth" ON public.task_types;
CREATE POLICY "task_types_select_auth" ON public.task_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "task_types_all_admin" ON public.task_types;
CREATE POLICY "task_types_all_admin" ON public.task_types FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "message_templates_select_auth" ON public.message_templates;
CREATE POLICY "message_templates_select_auth" ON public.message_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "message_templates_all_admin" ON public.message_templates;
CREATE POLICY "message_templates_all_admin" ON public.message_templates FOR ALL TO authenticated USING (public.is_admin());

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
    OR created_by IS NULL
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
CREATE POLICY "companies_update_policy" ON public.companies FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.company_id = companies.id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "companies_delete_policy" ON public.companies;
CREATE POLICY "companies_delete_policy" ON public.companies FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());

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
    OR created_by IS NULL
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "contacts_update_policy" ON public.contacts;
CREATE POLICY "contacts_update_policy" ON public.contacts FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.contact_id = contacts.id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "contacts_delete_policy" ON public.contacts;
CREATE POLICY "contacts_delete_policy" ON public.contacts FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());

-- 9.7 OPORTUNIDADES (Opportunities)
DROP POLICY IF EXISTS "opportunities_select_policy" ON public.opportunities;
CREATE POLICY "opportunities_select_policy" ON public.opportunities FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR public.has_permission('visualizar_todos_leads')
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
    OR owner_id IS NULL -- Leads sem responsável disponíveis para distribuição
  );

DROP POLICY IF EXISTS "opportunities_insert_policy" ON public.opportunities;
CREATE POLICY "opportunities_insert_policy" ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR owner_id = auth.uid()
    OR owner_id IS NULL
    OR created_by = auth.uid()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "opportunities_update_policy" ON public.opportunities;
CREATE POLICY "opportunities_update_policy" ON public.opportunities FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR public.has_permission('redistribuir_leads')
    OR owner_id = auth.uid()
    OR (owner_id IS NULL AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "opportunities_delete_policy" ON public.opportunities;
CREATE POLICY "opportunities_delete_policy" ON public.opportunities FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());

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
CREATE POLICY "tasks_insert_policy" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR assignee_id = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
CREATE POLICY "tasks_update_policy" ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR assignee_id = auth.uid()
  );

DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
CREATE POLICY "tasks_delete_policy" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_manager_or_admin() OR created_by = auth.uid());

-- 9.9 TIMELINE (Imutável / Append-Only)
DROP POLICY IF EXISTS "timeline_select_policy" ON public.opportunity_timeline;
CREATE POLICY "timeline_select_policy" ON public.opportunity_timeline FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_timeline.opportunity_id AND (o.owner_id = auth.uid() OR o.owner_id IS NULL))
  );

DROP POLICY IF EXISTS "timeline_insert_policy" ON public.opportunity_timeline;
CREATE POLICY "timeline_insert_policy" ON public.opportunity_timeline FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_timeline.opportunity_id AND o.owner_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- 9.10 HISTÓRICOS ESTRUTURADOS (Assignments & Stage History)
DROP POLICY IF EXISTS "opp_assignments_select" ON public.opportunity_assignments;
CREATE POLICY "opp_assignments_select" ON public.opportunity_assignments FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR novo_responsavel_id = auth.uid()
    OR responsavel_anterior_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_assignments.opportunity_id AND o.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "opp_assignments_insert" ON public.opportunity_assignments;
CREATE POLICY "opp_assignments_insert" ON public.opportunity_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin() OR auth.role() = 'service_role' OR alterado_por = auth.uid());

DROP POLICY IF EXISTS "stage_history_select" ON public.opportunity_stage_history;
CREATE POLICY "stage_history_select" ON public.opportunity_stage_history FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_stage_history.opportunity_id AND o.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "stage_history_insert" ON public.opportunity_stage_history;
CREATE POLICY "stage_history_insert" ON public.opportunity_stage_history FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin() OR auth.role() = 'service_role' OR usuario_id = auth.uid());

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
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "contracts_update_policy" ON public.contracts;
CREATE POLICY "contracts_update_policy" ON public.contracts FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin());

DROP POLICY IF EXISTS "contracts_delete_policy" ON public.contracts;
CREATE POLICY "contracts_delete_policy" ON public.contracts FOR DELETE TO authenticated
  USING (public.is_admin());

-- 9.12 REGRAS DE COMISSÃO & BONIFICAÇÃO (Configurações Financeiras)
DROP POLICY IF EXISTS "commission_rules_select_auth" ON public.commission_rules;
CREATE POLICY "commission_rules_select_auth" ON public.commission_rules FOR SELECT TO authenticated USING (public.is_manager_or_admin() OR public.is_admin());
DROP POLICY IF EXISTS "commission_rules_admin_write" ON public.commission_rules;
CREATE POLICY "commission_rules_admin_write" ON public.commission_rules FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "bonus_campaigns_select_auth" ON public.bonus_campaigns;
CREATE POLICY "bonus_campaigns_select_auth" ON public.bonus_campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bonus_campaigns_admin_write" ON public.bonus_campaigns;
CREATE POLICY "bonus_campaigns_admin_write" ON public.bonus_campaigns FOR ALL TO authenticated USING (public.is_admin());

-- 9.13 FINANCEIRO SENSÍVEL (Contract Financials & Commission Installments)
-- REGRA ESTRITA: SOMENTE ADMINISTRADOR TEM ACESSO DIRETO VIA RLS.
-- Vendedores e Gestores NÃO possuem SELECT direto em contract_financials.
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

-- Parcelas de comissão: Leitura por Admin (total) ou Vendedor (apenas os próprios registros do contrato)
DROP POLICY IF EXISTS "installments_select_policy" ON public.commission_installments;
CREATE POLICY "installments_select_policy" ON public.commission_installments FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = commission_installments.contract_id AND c.responsavel_id = auth.uid())
  );
DROP POLICY IF EXISTS "installments_admin_write" ON public.commission_installments;
CREATE POLICY "installments_admin_write" ON public.commission_installments FOR ALL TO authenticated
  USING (public.is_admin());

-- 9.14 CHECKLISTS DOCUMENTAIS
DROP POLICY IF EXISTS "doc_templates_select" ON public.document_checklist_templates;
CREATE POLICY "doc_templates_select" ON public.document_checklist_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "doc_templates_admin" ON public.document_checklist_templates;
CREATE POLICY "doc_templates_admin" ON public.document_checklist_templates FOR ALL TO authenticated USING (public.is_admin());

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
    OR auth.role() = 'service_role'
  );
DROP POLICY IF EXISTS "post_sale_update_policy" ON public.post_sale_requests;
CREATE POLICY "post_sale_update_policy" ON public.post_sale_requests FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR responsavel_id = auth.uid()
  );
DROP POLICY IF EXISTS "post_sale_delete_policy" ON public.post_sale_requests;
CREATE POLICY "post_sale_delete_policy" ON public.post_sale_requests FOR DELETE TO authenticated
  USING (public.is_admin());

-- 9.16 CAMPOS PERSONALIZADOS
DROP POLICY IF EXISTS "custom_defs_select" ON public.custom_field_definitions;
CREATE POLICY "custom_defs_select" ON public.custom_field_definitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "custom_defs_admin" ON public.custom_field_definitions;
CREATE POLICY "custom_defs_admin" ON public.custom_field_definitions FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "custom_vals_select" ON public.custom_field_values;
CREATE POLICY "custom_vals_select" ON public.custom_field_values FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = custom_field_values.registro_id AND (o.owner_id = auth.uid() OR o.owner_id IS NULL))
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = custom_field_values.registro_id AND c.responsavel_id = auth.uid())
  );
DROP POLICY IF EXISTS "custom_vals_write" ON public.custom_field_values;
CREATE POLICY "custom_vals_write" ON public.custom_field_values FOR ALL TO authenticated
  USING (
    public.is_manager_or_admin()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = custom_field_values.registro_id AND o.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = custom_field_values.registro_id AND c.responsavel_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- 9.17 PREFERÊNCIAS DO USUÁRIO (User Preferences)
DROP POLICY IF EXISTS "user_prefs_select_own" ON public.user_preferences;
CREATE POLICY "user_prefs_select_own" ON public.user_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_prefs_insert_own" ON public.user_preferences;
CREATE POLICY "user_prefs_insert_own" ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "user_prefs_update_own" ON public.user_preferences;
CREATE POLICY "user_prefs_update_own" ON public.user_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 9.18 AUDIT LOG (Append-Only)
DROP POLICY IF EXISTS "audit_select_admin" ON public.audit_log;
CREATE POLICY "audit_select_admin" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "audit_insert_system" ON public.audit_log;
CREATE POLICY "audit_insert_system" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR user_id IS NULL OR public.is_admin() OR auth.role() = 'service_role'
  );

-- 9.19 CANAIS WHATSAPP, CONVERSAS E MENSAGENS
DROP POLICY IF EXISTS "channels_select_auth" ON public.whatsapp_channels;
CREATE POLICY "channels_select_auth" ON public.whatsapp_channels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "channels_admin_write" ON public.whatsapp_channels;
CREATE POLICY "channels_admin_write" ON public.whatsapp_channels FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
CREATE POLICY "conversations_select_policy" ON public.conversations FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR responsible_user_id = auth.uid()
    OR responsible_user_id IS NULL
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = conversations.opportunity_id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
CREATE POLICY "conversations_insert_policy" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR responsible_user_id = auth.uid()
    OR responsible_user_id IS NULL
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations;
CREATE POLICY "conversations_update_policy" ON public.conversations FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR responsible_user_id = auth.uid()
    OR auth.role() = 'service_role'
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
        OR c.responsible_user_id IS NULL
        OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = c.opportunity_id AND o.owner_id = auth.uid())
      )
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
CREATE POLICY "messages_insert_policy" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.responsible_user_id = auth.uid() OR c.responsible_user_id IS NULL)
    )
    OR auth.role() = 'service_role'
  );

-- ------------------------------------------------------------------------------
-- 10. FUNÇÃO RPC FINANCEIRA SEGURA (SECURITY DEFINER)
-- Retorna SOMENTE os campos permitidos ao corretor/vendedor responsável:
-- - contract_id, numero_contrato, vendedor_id, operadora, plano, status_contrato
-- - data_inicio_vigencia, data_pagamento
-- - valor_venda, repasse_vendedor, bonificacao_vendedor, total_a_receber
-- E NUNCA expõe: faturamento_bruto, comissao_prevista, comissao_recebida,
-- impostos_descontos, comissao_liquida, resultado_kkj ou snapshots de comissão.
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_vendedor_financeiro CASCADE;

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
    COALESCE(car.nome, c.operadora) AS operadora,
    c.plano,
    c.valor_venda,
    COALESCE(f.repasse_vendedor, 0.00) AS repasse_vendedor,
    COALESCE(f.bonificacao_vendedor, 0.00) AS bonificacao_vendedor,
    (COALESCE(f.repasse_vendedor, 0.00) + COALESCE(f.bonificacao_vendedor, 0.00)) AS total_a_receber,
    c.status AS status_contrato,
    c.data_inicio_vigencia,
    c.data_pagamento
  FROM public.contracts c
  LEFT JOIN public.carriers car ON car.id = c.carrier_id
  INNER JOIN public.contract_financials f ON f.contract_id = c.id
  WHERE (
    public.is_admin()
    OR c.responsavel_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.get_meu_financeiro() IS 'Função RPC SECURITY DEFINER para consulta do extrato financeiro pessoal do vendedor sem conceder SELECT direto em contract_financials.';

-- Restringir execução: revoga de PUBLIC e concede estritamente a autenticados
REVOKE ALL ON FUNCTION public.get_meu_financeiro() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meu_financeiro() TO authenticated;

-- ------------------------------------------------------------------------------
-- 11. TRIGGERS DE AUDITORIA GERAL (AUDIT LOG)
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
INSERT INTO public.products (nome, categoria, descricao, ativo)
VALUES
  ('Saúde PME', 'Saúde PME', 'Planos de saúde empresariais para empresas.', true),
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

-- 12.3 Etapas Exatas do Funil de Vendas (Comercial)
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

-- 12.4 Etapas Exatas do Funil de Pós-Venda (Implantação & Ativação)
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

-- 12.9 Canal Padrão de WhatsApp
INSERT INTO public.whatsapp_channels (nome, numero_telefone, provedor, ativo)
VALUES
  ('Canal Principal KKJ', '+5511999999999', 'oficial', true)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- FIM DA MIGRATION CONSOLIDADA V1 — KKJ INITIAL SCHEMA
-- ==============================================================================
