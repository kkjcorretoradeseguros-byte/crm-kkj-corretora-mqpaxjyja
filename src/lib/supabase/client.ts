import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import pb from '@/lib/pocketbase/client'

/**
 * Cliente Supabase oficial da KKJ Corretora de Seguros e Benefícios.
 *
 * Mecanismo de resolução de credenciais:
 * 1. Primário: variáveis inlined pelo Vite (`import.meta.env.VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`)
 * 2. Cache em runtime (localStorage) se já obtidas anteriormente
 * 3. Fallback seguro: endpoint de runtime do backend Skip Cloud (`/backend/v1/public-config`),
 *    que expõe somente URL e chave pública (anon key) cadastradas nos Segredos do backend.
 *    (Chaves anon são públicas por design e destinadas ao cliente frontend).
 *
 * Em conformidade com o schema 0001 (32 tabelas, RLS ativo, triggers SECURITY DEFINER).
 */

const CACHE_KEY_URL = 'kkj_supabase_url'
const CACHE_KEY_KEY = 'kkj_supabase_anon_key'

function getInitialCreds(): { url: string; key: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || ''

  if (isValidSupabaseConfig(envUrl, envKey)) {
    return { url: envUrl, key: envKey }
  }

  // Tenta recuperar do localStorage (se salvo em runtime anterior pelo fetch da config pública)
  if (typeof window !== 'undefined') {
    try {
      const cachedUrl = (localStorage.getItem(CACHE_KEY_URL) || '').trim()
      const cachedKey = (localStorage.getItem(CACHE_KEY_KEY) || '').trim()
      if (isValidSupabaseConfig(cachedUrl, cachedKey)) {
        return { url: cachedUrl, key: cachedKey }
      }
    } catch {
      /* ignore */
    }
  }

  return { url: envUrl, key: envKey }
}

export function isValidSupabaseConfig(url?: string | null, key?: string | null): boolean {
  if (!url || !key) return false
  const trimmedUrl = url.trim()
  const trimmedKey = key.trim()
  return (
    trimmedUrl.startsWith('https://') &&
    !trimmedUrl.includes('placeholder') &&
    trimmedKey.length > 20 &&
    trimmedKey !== 'placeholder-anon-key'
  )
}

let activeUrl = getInitialCreds().url
let activeAnonKey = getInitialCreds().key
export let isSupabaseConfigured = isValidSupabaseConfig(activeUrl, activeAnonKey)

export let SUPABASE_URL = activeUrl || 'https://placeholder.supabase.co'
export let SUPABASE_ANON_KEY = activeAnonKey || 'placeholder-anon-key'

function instantiateSupabase(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  })
}

let internalClient: SupabaseClient = instantiateSupabase(SUPABASE_URL, SUPABASE_ANON_KEY)

// Listeners notificados quando o cliente é reconfigurado em tempo de execução
type ConfigListener = (configured: boolean, client: SupabaseClient) => void
const configListeners: Set<ConfigListener> = new Set()

export function onSupabaseConfigChange(listener: ConfigListener): () => void {
  configListeners.add(listener)
  return () => {
    configListeners.delete(listener)
  }
}

/**
 * Proxy transparente para garantir que qualquer chamada a `supabase.*`
 * acerte a instância atualizada, mesmo se reconfigurada após o carregamento inicial.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const val = Reflect.get(internalClient, prop, receiver)
    if (typeof val === 'function') {
      return val.bind(internalClient)
    }
    return val
  },
  set(_target, prop, value, receiver) {
    return Reflect.set(internalClient, prop, value, receiver)
  },
})

// Torna o cliente acessível globalmente de forma segura para sincronizações de tema / hooks leves
if (typeof window !== 'undefined') {
  ;(window as unknown as { __supabaseClient?: SupabaseClient }).__supabaseClient = supabase
}

let initPromise: Promise<boolean> | null = null

/**
 * Inicializa e sincroniza a configuração do Supabase.
 * Se as variáveis já estiverem no Vite build, retorna true imediatamente.
 * Caso contrário, consulta o backend Skip Cloud (/backend/v1/public-config) para obter
 * a URL e anon key cadastradas em Segredos sem expor nenhuma chave sensível.
 */
export async function ensureSupabaseConfigured(): Promise<boolean> {
  if (isSupabaseConfigured) {
    return true
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      const res = await pb.send<{ supabaseUrl?: string; supabaseAnonKey?: string }>(
        '/backend/v1/public-config',
        {
          method: 'GET',
          requestKey: null,
        },
      )

      const fetchedUrl = (res?.supabaseUrl || '').trim()
      const fetchedKey = (res?.supabaseAnonKey || '').trim()

      if (isValidSupabaseConfig(fetchedUrl, fetchedKey)) {
        activeUrl = fetchedUrl
        activeAnonKey = fetchedKey
        SUPABASE_URL = fetchedUrl
        SUPABASE_ANON_KEY = fetchedKey
        isSupabaseConfigured = true

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(CACHE_KEY_URL, fetchedUrl)
            localStorage.setItem(CACHE_KEY_KEY, fetchedKey)
          } catch {
            /* ignore */
          }
        }

        internalClient = instantiateSupabase(fetchedUrl, fetchedKey)
        if (typeof window !== 'undefined') {
          ;(window as unknown as { __supabaseClient?: SupabaseClient }).__supabaseClient = supabase
        }

        configListeners.forEach((fn) => {
          try {
            fn(true, internalClient)
          } catch (e) {
            console.error('Erro no ouvinte de config Supabase:', e)
          }
        })

        return true
      }
    } catch (err) {
      console.warn('Falha ao obter configuração pública do Supabase via backend:', err)
    }

    return isSupabaseConfigured
  })()

  try {
    return await initPromise
  } finally {
    initPromise = null
  }
}

// Inicia a verificação/busca em segundo plano imediatamente na importação no navegador
if (typeof window !== 'undefined' && !isSupabaseConfigured) {
  ensureSupabaseConfigured().catch(() => {
    /* falha silenciosa tratada na UI */
  })
}

export default supabase
