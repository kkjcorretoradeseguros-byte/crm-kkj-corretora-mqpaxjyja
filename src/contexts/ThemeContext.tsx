import React, { createContext, useContext, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  resolvedTheme: 'light' | 'dark'
}

const THEME_STORAGE_KEY = 'kkj_crm_theme_preference'

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system'
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
    return 'system'
  })

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const root = document.documentElement

    const applyTheme = () => {
      let active: 'light' | 'dark' = 'light'
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        active = prefersDark ? 'dark' : 'light'
      } else {
        active = theme
      }

      setResolvedTheme(active)
      if (active === 'dark') {
        root.classList.add('dark')
        root.style.colorScheme = 'dark'
      } else {
        root.classList.remove('dark')
        root.style.colorScheme = 'light'
      }
    }

    applyTheme()

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const listener = () => applyTheme()
      mediaQuery.addEventListener('change', listener)
      return () => mediaQuery.removeEventListener('change', listener)
    }
  }, [theme])

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme)
    try {
      // localStorage atua como cache anti-flash
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    } catch (e) {
      console.warn('Failed to save theme in localStorage', e)
    }
    // Sincronização assíncrona com user_preferences no backend (quando autenticado)
    try {
      const globalWindow =
        typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null
      if (globalWindow && globalWindow.__supabaseClient) {
        const client = globalWindow.__supabaseClient as {
          from: (tbl: string) => {
            upsert: (values: Record<string, unknown>) => Promise<unknown>
          }
          auth: { getUser: () => Promise<{ data: { user?: { id: string } } }> }
        }
        client.auth
          .getUser()
          .then(({ data }) => {
            if (data.user?.id) {
              client
                .from('user_preferences')
                .upsert({
                  user_id: data.user.id,
                  theme: newTheme,
                })
                .catch(() => {
                  /* fallback silencioso se offline */
                })
            }
          })
          .catch(() => {
            /* fallback silencioso */
          })
      }
    } catch {
      /* fallback se cliente Supabase ainda não inicializado */
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
