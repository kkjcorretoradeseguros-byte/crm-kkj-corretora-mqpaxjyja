import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { User, UserRole } from '@/types/crm'

interface ProfileRow {
  id: string
  nome: string
  email: string
  role: UserRole
  phone?: string | null
  avatar_url?: string | null
  ativo?: boolean
  created_at?: string
  updated_at?: string
}

function mapProfileToUser(p: ProfileRow): User {
  return {
    id: p.id,
    name: p.nome || p.email || 'Usuário',
    email: p.email || '',
    role: (p.role as UserRole) || 'vendedor',
    phone: p.phone || undefined,
    avatar: p.avatar_url || undefined,
    created: p.created_at || new Date().toISOString(),
    updated: p.updated_at || new Date().toISOString(),
  }
}

export const userService = {
  async getAllUsers(): Promise<User[]> {
    if (!isSupabaseConfigured) return []
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email, role, phone, avatar_url, ativo, created_at, updated_at')
        .order('nome', { ascending: true })

      if (error) {
        console.warn('Erro ao carregar usuários:', error.message)
        return []
      }
      return ((data || []) as ProfileRow[]).map(mapProfileToUser)
    } catch {
      return []
    }
  },

  async getUserById(id: string): Promise<User> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase não configurado')
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nome, email, role, phone, avatar_url, ativo, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Usuário não encontrado')
    }
    return mapProfileToUser(data as ProfileRow)
  },

  async updateUserRole(id: string, role: UserRole): Promise<User> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase não configurado')
    }
    const { data, error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, nome, email, role, phone, avatar_url, ativo, created_at, updated_at')
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Falha ao atualizar papel do usuário')
    }
    return mapProfileToUser(data as ProfileRow)
  },
}
