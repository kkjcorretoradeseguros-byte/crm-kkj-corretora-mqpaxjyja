import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
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

function getStoredProfile(): User | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
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
  const [user, setUser] = useState<User | null>(() => getStoredProfile())
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
    // 1. Carrega sessão inicial do Supabase Auth
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (session?.user) {
          setToken(session.access_token)
          const profile = await fetchProfileForAuthUser(
            session.user.id,
            session.user.email || '',
            (session.user.user_metadata?.nome as string) ||
              (session.user.user_metadata?.name as string),
          )
          setUser(profile)
          persistProfile(profile)
        } else {
          setToken(null)
          setUser(null)
          persistProfile(null)
        }
        setIsLoading(false)
      })
      .catch(() => {
        setIsLoading(false)
      })

    // 2. Ouvinte de mudanças de estado de autenticação (onAuthStateChange)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setToken(session.access_token)
        const profile = await fetchProfileForAuthUser(
          session.user.id,
          session.user.email || '',
          (session.user.user_metadata?.nome as string) ||
            (session.user.user_metadata?.name as string),
        )
        setUser(profile)
        persistProfile(profile)
      } else {
        setToken(null)
        setUser(null)
        persistProfile(null)
      }
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfileForAuthUser])

  const login = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
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
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase não configurado no ambiente. Defina as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para cadastrar.',
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // O signup cria o usuário no Supabase Auth.
    // A trigger do banco `handle_new_user` cria automaticamente o registro correspondente em `public.profiles`
    // com papel padrão 'vendedor' e em `public.user_preferences` com tema 'system'.
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
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    } finally {
      setUser(null)
      setToken(null)
      persistProfile(null)
    }
  }

  const requestPasswordReset = async (email: string) => {
    if (!isSupabaseConfigured) {
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
    if (!isSupabaseConfigured) {
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
    if (!isSupabaseConfigured) {
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
    if (!isSupabaseConfigured) {
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
    if (!isSupabaseConfigured) {
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
        isAuthenticated: !!user,
        isSupabaseConfigured,
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
