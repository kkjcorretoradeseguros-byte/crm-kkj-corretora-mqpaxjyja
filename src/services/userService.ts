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

  async updateUserRole(id: string, newRole: UserRole, motivo?: string): Promise<User> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase não configurado')
    }

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    // Buscar perfil atual para registrar histórico
    const { data: currentProf } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single()

    const previousRole = (currentProf?.role as UserRole) || 'vendedor'

    const { data, error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, nome, email, role, phone, avatar_url, ativo, created_at, updated_at')
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Falha ao atualizar papel do usuário')
    }

    // Gravar auditoria em profile_role_history
    try {
      await supabase.from('profile_role_history').insert({
        profile_id: id,
        perfil_anterior: previousRole,
        novo_perfil: newRole,
        alterado_por: currentUserId,
        motivo: motivo || `Alteração dinâmica de perfil pela Central do Administrador`,
        detalhes: { timestamp: new Date().toISOString() },
      })
    } catch (auditErr) {
      console.warn('Falha silenciosa ao gravar histórico de perfil:', auditErr)
    }

    return mapProfileToUser(data as ProfileRow)
  },

  async toggleUserActive(id: string, ativo: boolean): Promise<User> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data, error } = await supabase
      .from('profiles')
      .update({ ativo, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, nome, email, role, phone, avatar_url, ativo, created_at, updated_at')
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Falha ao alterar status do usuário')
    }
    return mapProfileToUser(data as ProfileRow)
  },
}
