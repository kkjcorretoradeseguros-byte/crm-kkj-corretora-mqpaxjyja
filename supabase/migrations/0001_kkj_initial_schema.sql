-- ==============================================================================
-- KK JEKABSON CORRETORA DE SEGUROS E BENEFÍCIOS (KKJ)
-- MIGRATION INICIAL COMPLETA PARA SUPABASE (POSTGRESQL)
-- Versão: 0001_kkj_initial_schema.sql
-- Idioma de documentação: Português do Brasil (pt-BR)
-- 
-- CARACTERÍSTICAS DESTA MIGRATION:
-- 1. Idempotência: segura para reexecuções no SQL Editor do Supabase.
-- 2. Chaves UUID primárias e estrangeiras com integridade referencial.
-- 3. Row Level Security (RLS) habilitado e aplicado em TODAS as tabelas.
-- 4. Separação física de dados financeiros sensíveis (contract_financials)
--    impedindo leitura de comissões globais e margens por vendedores via API.
-- 5. Triggers de auditoria contínua e timeline imutável de eventos.
-- 6. Seeds idempotentes para produtos, etapas de funil, motivos de perda e tipos de tarefa.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. EXTENSÕES NECESSÁRIAS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS (ENUMS)
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

  -- Tipos Padrão de Tarefa Operacional
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
    CREATE TYPE public.contract_status AS ENUM ('ativo', 'cancelado', 'em_implantacao', 'pendente_renovacao');
  END IF;

  -- Tipos de Eventos da Timeline
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
    CREATE TYPE public.message_delivery_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. TABELAS DO DOMÍNIO KKJ
-- ------------------------------------------------------------------------------

-- 2.1 PROFILES (1:1 com auth.users do Supabase)
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
COMMENT ON TABLE public.profiles IS 'Perfil estendido dos usuários do CRM KKJ vinculado ao auth.users.';
COMMENT ON COLUMN public.profiles.role IS 'Perfil de permissões: administrador, gestor ou vendedor.';

-- 2.2 CATÁLOGO DE PRODUTOS (Seguros & Benefícios)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  categoria TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.products IS 'Catálogo de modalidades de seguros e planos de benefícios da KKJ.';

-- 2.3 EMPRESAS / CLIENTES PJ
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
COMMENT ON TABLE public.companies IS 'Empresas clientes e estipulantes de apólices e planos PJ (PME/Corporativo).';

-- 2.4 CONTATOS (Pessoas Físicas, Titulares ou Representantes de PJ)
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

-- 2.5 ETAPAS DO PIPELINE (Funis de Vendas e Pós-Venda)
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
COMMENT ON TABLE public.pipeline_stages IS 'Etapas operacionais dos funis Comercial e de Pós-Venda.';

-- 2.6 MOTIVOS DE PERDA (Configuráveis pelo Administrador)
CREATE TABLE IF NOT EXISTS public.loss_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.loss_reasons IS 'Motivos padronizados de encerramento de negócios sem fechamento.';

-- 2.7 TIPOS DE TAREFA (Configuráveis pelo Administrador)
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
COMMENT ON TABLE public.task_types IS 'Tipos de tarefas operacionais parametrizáveis pelo administrador.';

-- 2.8 OPORTUNIDADES (Registro Central dos Funis)
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  status public.opp_status NOT NULL DEFAULT 'ativa',
  funnel_type public.funnel_type NOT NULL DEFAULT 'vendas',
  temperatura public.temperature NOT NULL DEFAULT 'morno',
  valor_venda NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  origem TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  proxima_tarefa_id UUID,
  health_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  loss_reason_id UUID REFERENCES public.loss_reasons(id) ON DELETE SET NULL,
  loss_notes TEXT,
  data_entrada TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_opp_loss_reason CHECK (
    (status = 'perdida' AND loss_reason_id IS NOT NULL) OR
    (status <> 'perdida')
  )
);
COMMENT ON TABLE public.opportunities IS 'Entidade central do CRM de seguros com histórico de saúde em health_data JSONB.';
COMMENT ON COLUMN public.opportunities.health_data IS 'Dados de saúde e cotação: possui_plano_atual, operadora_atual, operadora_cotada, cnpj, razao_social, qtd_vidas, idades, cidade, estado, valor_plano_atual, tipo_contratacao, acomodacao, rede_desejada, objetivo, data_contratacao, data_renovacao.';

-- 2.9 TAREFAS OPERACIONAIS
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
COMMENT ON TABLE public.tasks IS 'Tarefas, follow-ups e lembretes vinculados a oportunidades e corretores.';

-- FK circular de proxima_tarefa_id em opportunities (adicionada com segurança)
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

-- 2.10 TIMELINE IMUTÁVEL DA OPORTUNIDADE (Auditoria de Eventos Comerciais)
CREATE TABLE IF NOT EXISTS public.opportunity_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  tipo_evento public.timeline_action_type NOT NULL DEFAULT 'sistema',
  conteudo TEXT NOT NULL,
  dados_adicionais JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.opportunity_timeline IS 'Timeline append-only (imutável) de todos os passos e notas da oportunidade.';

-- 2.11 CONTRATOS (Snapshot Comercial e Cadastral)
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_contrato TEXT,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  operadora TEXT NOT NULL,
  plano TEXT,
  qtd_vidas INTEGER NOT NULL DEFAULT 1,
  valor_mensal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  valor_venda NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  status public.contract_status NOT NULL DEFAULT 'em_implantacao',
  data_envio DATE,
  data_previsao_vigencia DATE,
  data_pagamento DATE,
  data_implantacao DATE,
  data_inicio_vigencia DATE,
  data_renovacao DATE,
  responsavel_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.contracts IS 'Contratos consolidados e apólices ativas. Dados financeiros sensíveis em contract_financials.';

-- 2.12 DADOS FINANCEIROS SENSÍVEIS DO CONTRATO (Proteção Real no PostgreSQL)
-- Separado fisicamente para garantir que corretores e gestores não leiam faturamento bruto,
-- comissões da operadora, impostos, margens ou resultado da KKJ via PostgREST/API.
CREATE TABLE IF NOT EXISTS public.contract_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  faturamento_bruto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  comissao_prevista NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  comissao_recebida NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  impostos_descontos NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  comissao_liquida NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  repasse_vendedor NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  bonificacao_vendedor NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  resultado_kkj NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  comissao_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.contract_financials IS 'Dados financeiros ultrassensíveis da KKJ protegidos por RLS estrita (exclusivo Administrador).';

-- 2.12.1 VISÃO SEGURA DE REPASSE DO VENDEDOR (SECURITY BARRIER / SECURITY DEFINER)
-- Expõe ao vendedor estritamente os campos autorizados pelo cliente:
-- valor das próprias vendas, próprio repasse/comissão, própria bonificação e total a receber.
-- NENHUM dado de faturamento KKJ, comissão de operadora, impostos ou resultado é exposto.
CREATE OR REPLACE VIEW public.v_vendedor_financeiro
WITH (security_barrier = true)
AS
  SELECT
    c.id AS contract_id,
    c.numero_contrato,
    c.responsavel_id AS vendedor_id,
    c.operadora,
    c.plano,
    c.valor_venda,
    f.repasse_vendedor,
    f.bonificacao_vendedor,
    (f.repasse_vendedor + f.bonificacao_vendedor) AS total_a_receber,
    c.status AS status_contrato,
    c.data_inicio_vigencia,
    c.data_pagamento
  FROM public.contracts c
  INNER JOIN public.contract_financials f ON f.contract_id = c.id
  WHERE (
    -- Administrador pode consultar todos
    public.is_admin()
    -- Vendedor consulta estritamente os contratos sob sua responsabilidade direta
    OR (c.responsavel_id = auth.uid() AND public.is_vendedor())
    -- Gestor consulta caso tenha permissão no sistema granular (ou responsável direto)
    OR (c.responsavel_id = auth.uid() AND public.is_gestor())
  );
COMMENT ON VIEW public.v_vendedor_financeiro IS 'Visão de segurança (security barrier) para vendedores consultarem exclusivamente suas próprias comissões e bonificações sem acesso aos dados internos da KKJ.';

-- 2.13 AUDIT LOG (Auditoria Geral do Sistema — Append-Only)
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
COMMENT ON TABLE public.audit_log IS 'Log append-only de alterações críticas no CRM KKJ.';

-- 2.14 MENSAGERIA / WHATSAPP (Estrutura Preparada sem Mock)
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  conteudo TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.message_templates IS 'Templates padronizados com variáveis: {nome}, {empresa}, {vendedor}, {operadora}, {data}.';

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id TEXT,
  remote_jid TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.conversations IS 'Sessões de conversa de atendimento via WhatsApp API.';

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  external_message_id TEXT,
  direction public.message_direction NOT NULL,
  conteudo TEXT NOT NULL,
  status_entrega public.message_delivery_status NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE public.messages IS 'Mensagens individuais enviadas e recebidas pelo canal WhatsApp.';

-- ------------------------------------------------------------------------------
-- 3. ÍNDICES DE PERFORMANCE E INTEGRIDADE
-- ------------------------------------------------------------------------------

-- Perfis
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_ativo ON public.profiles(ativo);

-- Empresas e Contatos
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_companies_nome_fantasia ON public.companies(nome_fantasia);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_celular ON public.contacts(celular);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_cpf ON public.contacts(cpf);

-- Oportunidades
CREATE INDEX IF NOT EXISTS idx_opp_owner_id ON public.opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opp_stage_id ON public.opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opp_funnel_type ON public.opportunities(funnel_type);
CREATE INDEX IF NOT EXISTS idx_opp_status ON public.opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opp_contact_id ON public.opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_opp_company_id ON public.opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opp_product_id ON public.opportunities(product_id);
CREATE INDEX IF NOT EXISTS idx_opp_health_data_gin ON public.opportunities USING GIN (health_data);

-- Tarefas
CREATE INDEX IF NOT EXISTS idx_tasks_opp_id ON public.tasks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- Timeline
CREATE INDEX IF NOT EXISTS idx_timeline_opp_created ON public.opportunity_timeline(opportunity_id, created_at DESC);

-- Contratos e Financeiro
CREATE INDEX IF NOT EXISTS idx_contracts_opp_id ON public.contracts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_responsavel ON public.contracts(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_renovacao ON public.contracts(data_renovacao);
CREATE INDEX IF NOT EXISTS idx_contract_financials_contract ON public.contract_financials(contract_id);

-- Auditoria
CREATE INDEX IF NOT EXISTS idx_audit_tabela_registro ON public.audit_log(tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON public.audit_log(user_id, created_at DESC);

-- Mensagens WhatsApp
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_opp ON public.conversations(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_conversations_resp ON public.conversations(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at ASC);

-- ------------------------------------------------------------------------------
-- 4. FUNÇÕES HELPER SECURITY DEFINER (CONTROLE DE ACESSO)
-- ------------------------------------------------------------------------------

-- 4.1 Retorna o role do usuário logado de forma otimizada
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;
COMMENT ON FUNCTION public.current_role() IS 'Retorna o papel (user_role) do usuário autenticado no auth.uid().';

-- 4.2 Helper booleano: É Administrador?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'administrador' AND ativo = true
  );
$$;

-- 4.3 Helper booleano: É Gestor?
CREATE OR REPLACE FUNCTION public.is_gestor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'gestor' AND ativo = true
  );
$$;

-- 4.4 Helper booleano: É Vendedor?
CREATE OR REPLACE FUNCTION public.is_vendedor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'vendedor' AND ativo = true
  );
$$;

-- 4.5 Helper booleano: Tem acesso gerencial (Admin ou Gestor)?
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('administrador', 'gestor') AND ativo = true
  );
$$;

-- ------------------------------------------------------------------------------
-- 5. TRIGGERS OPERACIONAIS E AUTOMATISMOS
-- ------------------------------------------------------------------------------

-- 5.1 Atualização Automática de updated_at
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
      'products',
      'companies',
      'contacts',
      'pipeline_stages',
      'loss_reasons',
      'task_types',
      'opportunities',
      'tasks',
      'contracts',
      'contract_financials',
      'message_templates',
      'conversations'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I;', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();', t);
  END LOOP;
END $$;

-- 5.2 Criação Automática de Profile no Signup (auth.users -> public.profiles)
-- Regra estrita: TODO novo signup nasce SEMPRE como 'vendedor'.
-- Não existe auto-promoção ao primeiro signup. A promoção a 'administrador' é realizada
-- via instrução SQL explícita de bootstrap (ver seção 5.2.1 abaixo).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5.2.1 INSTRUÇÃO SQL SEPARADA DE BOOTSTRAP PARA PROMOÇÃO DO ADMINISTRADOR INICIAL
-- Como todo signup nasce como 'vendedor', execute o comando abaixo no Supabase SQL Editor
-- APÓS criar sua conta inicial para promover especificamente seu usuário a 'administrador':
-- 
-- ------------------------------------------------------------------------------
-- COMANDO DE BOOTSTRAP INICIAL (EXECUTAR MANUALMENTE NO SQL EDITOR APÓS SIGNUP):
-- ------------------------------------------------------------------------------
-- UPDATE public.profiles
-- SET role = 'administrador',
--     updated_at = timezone('utc'::text, now())
-- WHERE id = (
--   SELECT id FROM auth.users 
--   WHERE lower(email) = lower('SEU_EMAIL_AQUI@DOMINIO.COM')
--   LIMIT 1
-- );
-- ------------------------------------------------------------------------------

-- 5.2.2 TRIGGER DE PROTEÇÃO: IMPEDIR ALTERAÇÃO DE ROLE POR NÃO-ADMINISTRADORES
CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o campo role foi alterado, apenas um administrador ativo ou a service_role pode fazer isso
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Apenas usuários administradores podem alterar a role de um perfil.';
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

-- 5.3 Timeline Automática ao Mudar de Etapa ou Responsável na Oportunidade
CREATE OR REPLACE FUNCTION public.handle_opportunity_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  END IF;

  -- 2. Mudança de Responsável (Owner)
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
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
        'responsavel_novo_nome', new_owner_name
      ),
      auth.uid()
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

-- 5.4 Triggers de Auditoria Geral (Audit Log)
CREATE OR REPLACE FUNCTION public.handle_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Aplica auditoria em todas as entidades críticas solicitadas:
-- opportunities, contracts, contract_financials, profiles, produtos, etapas do pipeline, motivos de perda
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
      'products',
      'pipeline_stages',
      'loss_reasons',
      'task_types'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_audit_trigger();', tbl, tbl);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 6. POLÍTICAS DE ROW LEVEL SECURITY (RLS REAL)
-- ------------------------------------------------------------------------------

-- Habilitar RLS em TODAS as tabelas do CRM
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 6.1 PROFILES
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
    -- Usuário comum só pode atualizar seu próprio perfil e NUNCA alterar sua própria role
    (id = auth.uid() AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
    OR public.is_admin()
  );

-- 6.2 CONFIGURAÇÕES (Products, Pipeline Stages, Loss Reasons, Task Types, Templates)
-- Todos autenticados leem; apenas Admin cria, edita ou deleta.

-- Products
DROP POLICY IF EXISTS "products_select_auth" ON public.products;
CREATE POLICY "products_select_auth" ON public.products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "products_all_admin" ON public.products;
CREATE POLICY "products_all_admin" ON public.products FOR ALL TO authenticated USING (public.is_admin());

-- Pipeline Stages
DROP POLICY IF EXISTS "pipeline_stages_select_auth" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select_auth" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pipeline_stages_all_admin" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_all_admin" ON public.pipeline_stages FOR ALL TO authenticated USING (public.is_admin());

-- Loss Reasons
DROP POLICY IF EXISTS "loss_reasons_select_auth" ON public.loss_reasons;
CREATE POLICY "loss_reasons_select_auth" ON public.loss_reasons FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "loss_reasons_all_admin" ON public.loss_reasons;
CREATE POLICY "loss_reasons_all_admin" ON public.loss_reasons FOR ALL TO authenticated USING (public.is_admin());

-- Task Types
DROP POLICY IF EXISTS "task_types_select_auth" ON public.task_types;
CREATE POLICY "task_types_select_auth" ON public.task_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "task_types_all_admin" ON public.task_types;
CREATE POLICY "task_types_all_admin" ON public.task_types FOR ALL TO authenticated USING (public.is_admin());

-- Message Templates
DROP POLICY IF EXISTS "message_templates_select_auth" ON public.message_templates;
CREATE POLICY "message_templates_select_auth" ON public.message_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "message_templates_all_admin" ON public.message_templates;
CREATE POLICY "message_templates_all_admin" ON public.message_templates FOR ALL TO authenticated USING (public.is_admin());

-- 6.3 EMPRESAS (Companies)
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
CREATE POLICY "companies_select_policy" ON public.companies FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.company_id = companies.id AND o.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.company_id = companies.id AND c.responsavel_id = auth.uid())
  );

DROP POLICY IF EXISTS "companies_insert_policy" ON public.companies;
CREATE POLICY "companies_insert_policy" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (
    -- Administradores e gestores podem cadastrar empresas
    public.is_manager_or_admin()
    -- Vendedor autenticado pode cadastrar se assumir a autoria (created_by)
    -- ou se created_by for nulo e for preenchido com seu uid
    OR created_by = auth.uid()
    OR created_by IS NULL
    -- Integrações server-side com service_role
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

-- 6.4 CONTATOS (Contacts)
DROP POLICY IF EXISTS "contacts_select_policy" ON public.contacts;
CREATE POLICY "contacts_select_policy" ON public.contacts FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.contact_id = contacts.id AND o.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.contact_id = contacts.id AND c.responsavel_id = auth.uid())
  );

DROP POLICY IF EXISTS "contacts_insert_policy" ON public.contacts;
CREATE POLICY "contacts_insert_policy" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (
    -- Administradores e gestores podem cadastrar contatos
    public.is_manager_or_admin()
    -- Vendedor pode cadastrar contato para si próprio ou associado à sua carteira/empresa
    OR created_by = auth.uid()
    OR created_by IS NULL
    OR (
      company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.companies comp
        WHERE comp.id = contacts.company_id
        AND (
          comp.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.company_id = comp.id AND o.owner_id = auth.uid())
        )
      )
    )
    -- Integrações server-side com service_role
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

-- 6.5 OPORTUNIDADES (Opportunities)
DROP POLICY IF EXISTS "opportunities_select_policy" ON public.opportunities;
CREATE POLICY "opportunities_select_policy" ON public.opportunities FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "opportunities_insert_policy" ON public.opportunities;
CREATE POLICY "opportunities_insert_policy" ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "opportunities_update_policy" ON public.opportunities;
CREATE POLICY "opportunities_update_policy" ON public.opportunities FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "opportunities_delete_policy" ON public.opportunities;
CREATE POLICY "opportunities_delete_policy" ON public.opportunities FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());

-- 6.6 TAREFAS (Tasks)
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

-- 6.7 TIMELINE (Opportunity Timeline — Imutável / Append-Only)
-- Sem políticas de UPDATE ou DELETE: ninguém edita nem deleta eventos registrados.
DROP POLICY IF EXISTS "timeline_select_policy" ON public.opportunity_timeline;
CREATE POLICY "timeline_select_policy" ON public.opportunity_timeline FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_timeline.opportunity_id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "timeline_insert_policy" ON public.opportunity_timeline;
CREATE POLICY "timeline_insert_policy" ON public.opportunity_timeline FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_timeline.opportunity_id AND o.owner_id = auth.uid())
  );

-- 6.8 CONTRATOS (Contracts)
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
  USING (public.is_manager_or_admin());

DROP POLICY IF EXISTS "contracts_delete_policy" ON public.contracts;
CREATE POLICY "contracts_delete_policy" ON public.contracts FOR DELETE TO authenticated
  USING (public.is_admin());

-- 6.9 FINANCEIRO SENSÍVEL (Contract Financials — Proteção Real de Comissões e Margens)
-- Informações ultrassensíveis da KKJ: faturamento bruto, comissão de operadora, impostos e margem.
-- Regra estrita: POR PADRÃO, SOMENTE ADMINISTRADOR TEM ACESSO (SELECT/INSERT/UPDATE/DELETE).
-- GESTOR NÃO RECEBE ACESSO DEFAULT. Vendedores não têm acesso direto à tabela.
DROP POLICY IF EXISTS "financials_admin_gestor_select" ON public.contract_financials;
DROP POLICY IF EXISTS "financials_admin_select" ON public.contract_financials;
CREATE POLICY "financials_admin_select" ON public.contract_financials FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "financials_admin_gestor_insert" ON public.contract_financials;
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

-- 6.10 AUDIT LOG (Append-Only)
-- Sem UPDATE e sem DELETE para nenhum perfil.
DROP POLICY IF EXISTS "audit_select_admin" ON public.audit_log;
CREATE POLICY "audit_select_admin" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "audit_insert_system" ON public.audit_log;
CREATE POLICY "audit_insert_system" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (
    -- Triggers security definer inserem no audit_log
    -- Permite inserção por usuário autenticado se vinculado a si mesmo, admin ou service_role
    user_id = auth.uid() OR user_id IS NULL OR public.is_admin() OR auth.role() = 'service_role'
  );

-- 6.11 CONVERSAS E MENSAGENS (WhatsApp)
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
CREATE POLICY "conversations_select_policy" ON public.conversations FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR responsible_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = conversations.opportunity_id AND o.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
CREATE POLICY "conversations_insert_policy" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR responsible_user_id = auth.uid()
    OR (
      opportunity_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = conversations.opportunity_id AND o.owner_id = auth.uid()
      )
    )
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
      AND (
        c.responsible_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = c.opportunity_id AND o.owner_id = auth.uid())
      )
    )
    OR auth.role() = 'service_role'
  );

-- ------------------------------------------------------------------------------
-- 7. SEEDS DE CONFIGURAÇÃO ADMINISTRATIVA (IDEMPOTENTES VIA ON CONFLICT)
-- ------------------------------------------------------------------------------

-- 7.1 Catálogo Inicial de Produtos de Seguros & Benefícios
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

-- 7.2 Etapas Exatas do Funil de Vendas (Comercial)
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

-- 7.3 Etapas Exatas do Funil de Pós-Venda (Implantação & Ativação)
-- 1. Documentação -> 2. Implantação -> 3. Aguardando pagamento -> 4. Implantado -> 5. Cliente ativo
-- (Regra estrita: NÃO criar etapa "Proposta na operadora")
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

-- 7.4 Motivos de Perda Padronizados (Configuráveis)
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

-- 7.5 Tipos de Tarefas Padronizados
INSERT INTO public.task_types (tipo_slug, rotulo, descricao, ordem, ativo)
VALUES
  ('ligacao', 'Ligação Telefônica', 'Contato telefônico de prospecção ou alinhamento', 1, true),
  ('whatsapp', 'Mensagem WhatsApp', 'Envio de mensagem rápida, tabelas ou áudio no WhatsApp', 2, true),
  ('follow_up', 'Follow-up de Proposta', 'Retorno de acompanhamento de cotação enviada', 3, true),
  ('reuniao', 'Reunião Presencial/Online', 'Apresentação formal de estudo de rede e custos', 4, true),
  ('cotacao', 'Elaboração de Cotação', 'Montagem do estudo comparativo entre operadoras', 5, true),
  ('documentacao', 'Coleta de Documentação', 'Recolhimento de documentos, cartão CNPJ e carteirinhas', 6, true),
  ('implantacao', 'Acompanhamento de Implantação', 'Protocolo e acompanhamento do processo na operadora', 7, true),
  ('cobranca_pagamento', 'Cobrança / Confirmação de Pagamento', 'Validação da quitação da 1ª mensalidade / taxa de adesão', 8, true),
  ('outro', 'Outro Lembrete', 'Demais tarefas operacionais do dia a dia', 9, true)
ON CONFLICT (tipo_slug) DO UPDATE
SET rotulo = EXCLUDED.rotulo,
    descricao = EXCLUDED.descricao,
    ordem = EXCLUDED.ordem,
    ativo = EXCLUDED.ativo;

-- ==============================================================================
-- FIM DA MIGRATION KKJ INITIAL SCHEMA
-- ==============================================================================
