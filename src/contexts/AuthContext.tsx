import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  supabase,
  isSupabaseConfigured as isSupabaseConfiguredStatic,
  ensureSupabaseConfigured,
  onSupabaseConfigChange,
} from '@/lib/supabase/client'
import type { User, UserRole } from '@/types/crm'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isSupabaseConfigured: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  confirmPasswordReset: (token: string, password: string, passwordConfirm?: string) => Promise<void>
  confirmVerification: (token: string) => Promise<void>
  requestEmailChange: (newEmail: string) => Promise<void>
  confirmEmailChange: (token: string, password?: string) => Promise<void>
  updateProfile: (data: { name?: string; phone?: string; avatar?: File | null }) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PROFILE_STORAGE_KEY = 'kkj_auth_profile'

function mapDbRoleToAppRole(dbRole?: string | null): UserRole {
  const norm = (dbRole || '').toLowerCase().trim()
  if (norm === 'administrador') return 'ADMINISTRADOR'
  if (norm === 'gestor') return 'GESTOR'
  return 'VENDEDOR'
}

function persistProfile(profile: User | null) {
  try {
    if (profile) {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
    } else {
      localStorage.removeItem(PROFILE_STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [configured, setConfigured] = useState<boolean>(() => isSupabaseConfiguredStatic)

  const fetchProfileForAuthUser = useCallback(
    async (authUserId: string, authEmail: string, metaName?: string): Promise<User> => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUserId)
          .maybeSingle()

        if (error && error.code !== 'PGRST116') {
          console.warn('Erro ao consultar profile:', error.message)
        }

        const role = mapDbRoleToAppRole(data?.role)
        const appUser: User = {
          id: authUserId,
          email: data?.email || authEmail,
          name: data?.nome || metaName || authEmail.split('@')[0],
          role,
          phone: data?.celular || undefined,
          position: data?.cargo || undefined,
          team: data?.equipe || undefined,
          active: data?.ativo ?? true,
          receives_automatic_leads: data?.recebe_leads_automaticos ?? true,
          created: data?.created_at,
          updated: data?.updated_at,
        }
        return appUser
      } catch {
        return {
          id: authUserId,
          email: authEmail,
          name: metaName || authEmail.split('@')[0],
          role: 'VENDEDOR',
        }
      }
    },
    [],
  )

  const refreshProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) {
      const profile = await fetchProfileForAuthUser(
        session.user.id,
        session.user.email || '',
        (session.user.user_metadata?.nome as string) ||
          (session.user.user_metadata?.name as string),
      )
      setUser(profile)
      persistProfile(profile)
    }
  }, [fetchProfileForAuthUser])

  useEffect(() => {
    let isMounted = true
    let authSub: { unsubscribe: () => void } | null = null

    const setupAuthListeners = () => {
      if (authSub) {
        authSub.unsubscribe()
        authSub = null
      }

      // 1. Carrega sessão inicial do Supabase Auth
      supabase.auth
        .getSession()
        .then(async ({ data: { session } }) => {
          if (!isMounted) return
          if (session?.user) {
            setToken(session.access_token)
            const profile = await fetchProfileForAuthUser(
              session.user.id,
              session.user.email || '',
              (session.user.user_metadata?.nome as string) ||
                (session.user.user_metadata?.name as string),
            )
            if (isMounted) {
              setUser(profile)
              persistProfile(profile)
            }
          } else {
            setToken(null)
            setUser(null)
            persistProfile(null)
          }
          if (isMounted) setIsLoading(false)
        })
        .catch(() => {
          if (isMounted) {
            setToken(null)
            setUser(null)
            persistProfile(null)
            setIsLoading(false)
          }
        })

      // 2. Ouvinte de mudanças de estado de autenticação (onAuthStateChange)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        // Avoid awaiting Supabase queries inside the auth-state callback.
        void Promise.resolve().then(async () => {
        if (!isMounted) return
        if (session?.user) {
          setToken(session.access_token)
          const profile = await fetchProfileForAuthUser(
            session.user.id,
            session.user.email || '',
            (session.user.user_metadata?.nome as string) ||
              (session.user.user_metadata?.name as string),
          )
          if (isMounted) {
            setUser(profile)
            persistProfile(profile)
          }
        } else {
          setToken(null)
          setUser(null)
          persistProfile(null)
        }
        if (isMounted) setIsLoading(false)
        }).catch((error) => {
          console.error('Falha ao atualizar perfil após mudança de sessão:', error)
          if (isMounted) setIsLoading(false)
        })
      })

      authSub = subscription
    }

    // Inicializa auth com a configuração atual
    setupAuthListeners()

    // Se ainda não estiver configurado estaticamente, busca assincronamente a configuração
    if (!configured) {
      ensureSupabaseConfigured().then((isNowConfigured) => {
        if (!isMounted) return
        if (isNowConfigured) {
          setConfigured(true)
          setupAuthListeners()
        }
      })
    }

    // Ouvinte caso o cliente Supabase mude dinamicamente
    const unregisterConfigListener = onSupabaseConfigChange((isConfigured) => {
      if (!isMounted) return
      setConfigured(isConfigured)
      if (isConfigured) {
        setupAuthListeners()
      }
    })

    return () => {
      isMounted = false
      if (authSub) {
        authSub.unsubscribe()
      }
      unregisterConfigListener()
    }
  }, [fetchProfileForAuthUser, configured])

  const login = async (email: string, password: string) => {
    // Garante resolução de configuração antes de falhar
    const hasConfig = configured || (await ensureSupabaseConfigured())
    if (!hasConfig) {
      throw new Error(
        'Supabase não configurado no ambiente. Defina as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para autenticar.',
      )
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      throw new Error(
        error.message || 'Falha ao autenticar no Supabase. Verifique suas credenciais.',
      )
    }

    if (data.user) {
      setToken(data.session?.access_token || null)
      const profile = await fetchProfileForAuthUser(
        data.user.id,
        data.user.email || email,
        (data.user.user_metadata?.nome as string) || (data.user.user_metadata?.name as string),
      )
      setUser(profile)
      persistProfile(profile)
    }
  }

  const signup = async (email: string, password: string, name: string) => {
    const hasConfig = configured || (await ensureSupabaseConfigured())
    if (!hasConfig) {
      throw new Error(
        'Supabase não configurado no ambiente. Defina as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para cadastrar.',
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // O signup cria o usuário no Supabase Auth com data.nome (e alias name para compatibilidade).
    // A trigger do banco `handle_new_user` cria automaticamente o registro correspondente em `public.profiles`
    // com papel padrão estrito 'vendedor' e em `public.user_preferences` com tema 'system'.
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          nome: name.trim(),
          name: name.trim(),
        },
      },
    })

    if (error) {
      throw new Error(error.message || 'Falha ao criar conta no Supabase.')
    }

    // Se a confirmação de e-mail estiver desabilitada no Supabase, a sessão já vem ativa
    if (data.session && data.user) {
      setToken(data.session.access_token)
      const profile = await fetchProfileForAuthUser(data.user.id, normalizedEmail, name)
      setUser(profile)
      persistProfile(profile)
    } else {
      // Tenta login direto (caso email não exija confirmação)
      try {
        await login(normalizedEmail, password)
      } catch {
        // Se exigir confirmação de e-mail, encerra sem erro fatal
      }
    }
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
    setUser(null)
    setToken(null)
    persistProfile(null)
  }

  const requestPasswordReset = async (email: string) => {
    const hasConfig = configured || (await ensureSupabaseConfigured())
    if (!hasConfig) {
      throw new Error('Supabase não configurado no ambiente.')
    }
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    })
    if (error) {
      throw new Error(error.message || 'Falha ao solicitar recuperação de senha.')
    }
  }

  const confirmPasswordReset = async (
    _token: string,
    password: string,
    _passwordConfirm?: string,
  ) => {
    const hasConfig = configured || (await ensureSupabaseConfigured())
    if (!hasConfig) {
      throw new Error('Supabase não configurado no ambiente.')
    }
    // No Supabase, ao acessar via link de recuperação, a sessão de recovery é iniciada automaticamente pelo client.
    // O updateUser atualiza a senha do usuário autenticado no fluxo de recovery.
    const { error } = await supabase.auth.updateUser({
      password,
    })
    if (error) {
      throw new Error(error.message || 'Falha ao redefinir a senha.')
    }
  }

  const confirmVerification = async (tokenParam: string) => {
    const hasConfig = configured || (await ensureSupabaseConfigured())
    if (!hasConfig) {
      throw new Error('Supabase não configurado no ambiente.')
    }
    // Supabase suporta verifyOtp com tipo signup/email
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenParam,
      type: 'email',
    })
    if (error) {
      // Fallback para token direto
      const { error: fallbackError } = await supabase.auth.verifyOtp({
        token_hash: tokenParam,
        type: 'signup',
      })
      if (fallbackError) {
        throw new Error(fallbackError.message || error.message || 'Falha ao verificar e-mail.')
      }
    }
  }

  const requestEmailChange = async (newEmail: string) => {
    const hasConfig = configured || (await ensureSupabaseConfigured())
    if (!hasConfig) {
      throw new Error('Supabase não configurado no ambiente.')
    }
    const { error } = await supabase.auth.updateUser({
      email: newEmail.trim().toLowerCase(),
    })
    if (error) {
      throw new Error(error.message || 'Falha ao solicitar alteração de e-mail.')
    }
  }

  const confirmEmailChange = async (tokenParam: string, _password?: string) => {
    const hasConfig = configured || (await ensureSupabaseConfigured())
    if (!hasConfig) {
      throw new Error('Supabase não configurado no ambiente.')
    }
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenParam,
      type: 'email_change',
    })
    if (error) {
      throw new Error(error.message || 'Falha ao confirmar novo e-mail.')
    }
    await logout()
  }

  const updateProfile = async (data: { name?: string; phone?: string; avatar?: File | null }) => {
    if (!user?.id) return
    const updates: Record<string, unknown> = {}
    if (data.name !== undefined) updates.nome = data.name.trim()
    if (data.phone !== undefined) updates.celular = data.phone.trim()

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)

      if (error) {
        throw new Error(error.message || 'Falha ao atualizar perfil.')
      }
    }

    if (data.name) {
      await supabase.auth.updateUser({
        data: { nome: data.name.trim(), name: data.name.trim() },
      })
    }

    await refreshProfile()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        isSupabaseConfigured: configured,
        login,
        signup,
        logout,
        requestPasswordReset,
        confirmPasswordReset,
        confirmVerification,
        requestEmailChange,
        confirmEmailChange,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
