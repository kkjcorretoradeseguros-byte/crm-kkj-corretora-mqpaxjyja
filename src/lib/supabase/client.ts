import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase oficial da KKJ Corretora de Seguros e Benefícios.
 * Utiliza as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
 * Em conformidade com o schema 0001 (32 tabelas, RLS ativo, triggers SECURITY DEFINER).
 */

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const isSupabaseConfigured = Boolean(
  envUrl &&
  envAnonKey &&
  envUrl.startsWith('https://') &&
  !envUrl.includes('placeholder') &&
  envAnonKey.length > 20,
)

export const SUPABASE_URL = envUrl || 'https://placeholder.supabase.co'
export const SUPABASE_ANON_KEY = envAnonKey || 'placeholder-anon-key'

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

// Torna o cliente acessível globalmente de forma segura para sincronizações de tema / hooks leves
if (typeof window !== 'undefined') {
  ;(window as unknown as { __supabaseClient?: SupabaseClient }).__supabaseClient = supabase
}

export default supabase
