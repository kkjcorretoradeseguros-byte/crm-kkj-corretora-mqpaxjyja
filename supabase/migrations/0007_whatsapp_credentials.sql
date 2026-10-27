-- ==============================================================================
-- MIGRATION 0007_WHATSAPP_CREDENTIALS.SQL
-- CRM KKJ CORRETORA DE SEGUROS E BENEFÍCIOS
-- ==============================================================================
-- ATENÇÃO: NÃO EXECUTAR AUTOMATICAMENTE NESTE AMBIENTE.
-- O CLIENTE EXECUTA ESTE SQL DIRETAMENTE NO SUPABASE DE PRODUÇÃO DA KKJ
-- (https://bqlltqqnoexyhbtjrhzq.supabase.co).
--
-- Objetivos:
-- 1. Criação da tabela PRIVADA `whatsapp_integration_credentials` para armazenar
--    tokens de acesso (access_token, refresh_token, expiração e metadados de credencial)
--    obtidos via troca de código com a Graph API da Meta.
-- 2. Habilitação de RLS com política restritiva (DENY-ALL para anon e authenticated).
--    Nenhum token fica exposto via REST/GraphQL pública do PostgREST.
--    O acesso a esta tabela ocorre EXCLUSIVAMENTE via service_role a partir do backend pb_hooks.
-- 3. Atualização e extensão de `whatsapp_channels` com colunas de suporte à integração oficial:
--    - user_id UUID REFERENCES public.profiles(id): corretor/usuário dono do canal
--    - waba_id TEXT: ID da conta WhatsApp Business (Messaging Account)
--    - phone_number_id TEXT: ID do número de telefone na Graph API
--    - business_id TEXT: ID do portfólio de negócios da Meta
--    - status TEXT: estado da conexão ('not_connected', 'connecting', 'connected', 'error')
--    - status_coexistencia TEXT: confirmação de coexistência ('eligible', 'ineligible', 'verified')
--    - erro_conexao TEXT: mensagem descritiva de erro quando status = 'error'
-- 4. Políticas RLS de `whatsapp_channels`:
--    - SELECT: autenticados visualizam (vendedor visualiza seus canais e canais gerais da corretora; admin/gestor visualizam conforme governança)
--    - INSERT / UPDATE: usuário autenticado pode vincular seu próprio canal (user_id = auth.uid()) ou admin
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA PRIVADA DE CREDENCIAIS (whatsapp_integration_credentials)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.whatsapp_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  token_type VARCHAR(50) DEFAULT 'bearer',
  expires_in INTEGER,
  token_expires_at TIMESTAMPTZ,
  scopes JSONB DEFAULT '[]'::jsonb,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_whatsapp_creds_channel UNIQUE (channel_id)
);

COMMENT ON TABLE public.whatsapp_integration_credentials IS 'Tabela privada e isolada para tokens OAuth da Meta WhatsApp Cloud API. RLS ativo sem permissões para authenticated: leitura e escrita restritas à service_role (backend seguro).';

-- Trigger updated_at para whatsapp_integration_credentials
DROP TRIGGER IF EXISTS trg_whatsapp_creds_updated_at ON public.whatsapp_integration_credentials;
CREATE TRIGGER trg_whatsapp_creds_updated_at
  BEFORE UPDATE ON public.whatsapp_integration_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_creds_channel_id ON public.whatsapp_integration_credentials(channel_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_creds_user_id ON public.whatsapp_integration_credentials(user_id);

-- RLS: HABILITADO COM BLOQUEIO TOTAL (DENY-ALL) PARA CLIENTES HTTP/REST
ALTER TABLE public.whatsapp_integration_credentials ENABLE ROW LEVEL SECURITY;

-- Revoga explicitamente permissões de leitura/escrita para roles públicas
REVOKE ALL ON public.whatsapp_integration_credentials FROM PUBLIC;
REVOKE ALL ON public.whatsapp_integration_credentials FROM anon;
REVOKE ALL ON public.whatsapp_integration_credentials FROM authenticated;
-- Acesso permitido estritamente para service_role (usado no backend pb_hooks) e postgres
GRANT ALL ON public.whatsapp_integration_credentials TO service_role;
GRANT ALL ON public.whatsapp_integration_credentials TO postgres;

-- ------------------------------------------------------------------------------
-- 2. EXTENSÃO E AJUSTES EM whatsapp_channels
-- ------------------------------------------------------------------------------
ALTER TABLE public.whatsapp_channels
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS waba_id TEXT,
  ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS business_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_connected'
    CONSTRAINT chk_whatsapp_channel_status CHECK (status IN ('not_connected', 'connecting', 'connected', 'error')),
  ADD COLUMN IF NOT EXISTS status_coexistencia TEXT DEFAULT 'not_verified'
    CONSTRAINT chk_whatsapp_channel_coexistence CHECK (status_coexistencia IN ('not_verified', 'eligible', 'ineligible', 'verified')),
  ADD COLUMN IF NOT EXISTS erro_conexao TEXT;

-- Índices úteis para busca de canal por número ou waba
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_user_id ON public.whatsapp_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_phone_number_id ON public.whatsapp_channels(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_waba_id ON public.whatsapp_channels(waba_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_status ON public.whatsapp_channels(status);

-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS RLS DE whatsapp_channels ATUALIZADAS
-- Respeita governança:
-- - SELECT: autenticado vê canais ativos vinculados a ele, canais sem usuário específico (da corretora) ou se for admin/gestor
-- - INSERT/UPDATE: usuário pode conectar e atualizar o SEU próprio canal (user_id = auth.uid()) ou admin
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "channels_select_auth" ON public.whatsapp_channels;
CREATE POLICY "channels_select_auth" ON public.whatsapp_channels
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR user_id IS NULL
    OR (user_id IS NOT NULL AND public.is_gestor() AND public.is_manager_of_seller(user_id))
  );

DROP POLICY IF EXISTS "channels_insert_policy" ON public.whatsapp_channels;
CREATE POLICY "channels_insert_policy" ON public.whatsapp_channels
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "channels_update_policy" ON public.whatsapp_channels;
CREATE POLICY "channels_update_policy" ON public.whatsapp_channels
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "channels_admin_write" ON public.whatsapp_channels;
CREATE POLICY "channels_admin_write" ON public.whatsapp_channels
  FOR DELETE TO authenticated
  USING (public.is_admin());
