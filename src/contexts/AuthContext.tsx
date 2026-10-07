import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/crm'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  requestPasswordReset: (email: string) => Promise<void>
  confirmPasswordReset: (token: string, password: string, passwordConfirm: string) => Promise<void>
  confirmVerification: (token: string) => Promise<void>
  requestEmailChange: (newEmail: string) => Promise<void>
  confirmEmailChange: (token: string, password: string) => Promise<void>
  updateProfile: (data: { name?: string; avatar?: File | null }) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    return (pb.authStore.record as unknown as User) || null
  })
  const [token, setToken] = useState<string | null>(pb.authStore.token)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsub = pb.authStore.onChange((newToken, model) => {
      setToken(newToken)
      setUser((model as unknown as User) || null)
    })

    // Validate token on mount
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .then((res) => {
          setUser(res.record as unknown as User)
        })
        .catch(() => {
          // Keep current store or clear if expired
          if (!pb.authStore.isValid) {
            setUser(null)
          }
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsub()
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await pb.collection('users').authWithPassword(email, password)
    setUser(res.record as unknown as User)
    setToken(res.token)
  }

  const signup = async (email: string, password: string, name: string) => {
    await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name,
    })
    // Also trigger email verification
    try {
      await pb.collection('users').requestVerification(email)
    } catch {
      // ignore in local or without mailer configured
    }
    // Auto-login after signup
    await login(email, password)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  const requestPasswordReset = async (email: string) => {
    await pb.collection('users').requestPasswordReset(email)
  }

  const confirmPasswordReset = async (token: string, password: string, passwordConfirm: string) => {
    await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
  }

  const confirmVerification = async (token: string) => {
    await pb.collection('users').confirmVerification(token)
  }

  const requestEmailChange = async (newEmail: string) => {
    await pb.collection('users').requestEmailChange(newEmail)
  }

  const confirmEmailChange = async (token: string, password: string) => {
    await pb.collection('users').confirmEmailChange(token, password)
    logout()
  }

  const updateProfile = async (data: { name?: string; avatar?: File | null }) => {
    if (!pb.authStore.record?.id) return
    const formData = new FormData()
    if (data.name !== undefined) {
      formData.append('name', data.name)
    }
    if (data.avatar instanceof File) {
      formData.append('avatar', data.avatar)
    }
    const updated = await pb.collection('users').update(pb.authStore.record.id, formData)
    setUser(updated as unknown as User)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && pb.authStore.isValid,
        login,
        signup,
        logout,
        requestPasswordReset,
        confirmPasswordReset,
        confirmVerification,
        requestEmailChange,
        confirmEmailChange,
        updateProfile,
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
