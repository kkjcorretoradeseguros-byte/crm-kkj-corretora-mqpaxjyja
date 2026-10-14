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
      // 1. Tentar carregar com as colunas oficiais do schema Supabase (celular / cargo / equipe)
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, nome, email, role, celular, cargo, equipe, ativo, recebe_leads_automaticos, created_at, updated_at',
        )
        .order('nome', { ascending: true })

      if (!error && data) {
        return (data as any[]).map((p) => {
          const rawRole = (p.role || '').toLowerCase().trim()
          let normalizedRole: UserRole = 'VENDEDOR'
          if (rawRole === 'administrador') normalizedRole = 'ADMINISTRADOR'
          else if (rawRole === 'gestor') normalizedRole = 'GESTOR'

          return {
            id: p.id,
            email: p.email,
            name: p.nome || p.email?.split('@')[0] || 'Usuário',
            role: normalizedRole,
            phone: p.celular || undefined,
            position: p.cargo || undefined,
            team: p.equipe || undefined,
            active: p.ativo ?? true,
            receives_automatic_leads: p.recebe_leads_automaticos ?? true,
            created: p.created_at || new Date().toISOString(),
            updated: p.updated_at || new Date().toISOString(),
          }
        })
      }

      // 2. Fallback caso colunas específicas difiram
      console.warn('Tentativa com select completo falhou, usando select genérico:', error?.message)
      const fallbackRes = await supabase
        .from('profiles')
        .select('*')
        .order('nome', { ascending: true })

      if (fallbackRes.error) {
        console.warn('Erro ao carregar usuários (fallback):', fallbackRes.error.message)
        return []
      }

      return ((fallbackRes.data || []) as any[]).map((p) => {
        const rawRole = (p.role || '').toLowerCase().trim()
        let normalizedRole: UserRole = 'VENDEDOR'
        if (rawRole === 'administrador') normalizedRole = 'ADMINISTRADOR'
        else if (rawRole === 'gestor') normalizedRole = 'GESTOR'

        return {
          id: p.id,
          email: p.email,
          name: p.nome || p.name || p.email?.split('@')[0] || 'Usuário',
          role: normalizedRole,
          phone: p.celular || p.phone || undefined,
          position: p.cargo || p.position || undefined,
          team: p.equipe || p.team || undefined,
          active: p.ativo ?? true,
          receives_automatic_leads: p.recebe_leads_automaticos ?? true,
          created: p.created_at || new Date().toISOString(),
          updated: p.updated_at || new Date().toISOString(),
        }
      })
    } catch (err: any) {
      console.warn('Exceção ao listar usuários:', err?.message)
      return []
    }
  },

  async getUserById(id: string): Promise<User> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase não configurado')
    }
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, nome, email, role, celular, cargo, equipe, ativo, recebe_leads_automaticos, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle()

    if (error || !data) {
      // Tentar fallback select *
      const fallback = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
      if (fallback.error || !fallback.data) {
        throw new Error(error?.message || 'Usuário não encontrado')
      }
      const p = fallback.data as any
      const rawRole = (p.role || '').toLowerCase().trim()
      let normalizedRole: UserRole = 'VENDEDOR'
      if (rawRole === 'administrador') normalizedRole = 'ADMINISTRADOR'
      else if (rawRole === 'gestor') normalizedRole = 'GESTOR'
      return {
        id: p.id,
        email: p.email,
        name: p.nome || p.name || p.email?.split('@')[0] || 'Usuário',
        role: normalizedRole,
        phone: p.celular || p.phone || undefined,
        position: p.cargo || p.position || undefined,
        team: p.equipe || p.team || undefined,
        active: p.ativo ?? true,
        receives_automatic_leads: p.recebe_leads_automaticos ?? true,
        created: p.created_at || new Date().toISOString(),
        updated: p.updated_at || new Date().toISOString(),
      }
    }
    const p = data as any
    const rawRole = (p.role || '').toLowerCase().trim()
    let normalizedRole: UserRole = 'VENDEDOR'
    if (rawRole === 'administrador') normalizedRole = 'ADMINISTRADOR'
    else if (rawRole === 'gestor') normalizedRole = 'GESTOR'
    return {
      id: p.id,
      email: p.email,
      name: p.nome || p.email?.split('@')[0] || 'Usuário',
      role: normalizedRole,
      phone: p.celular || undefined,
      position: p.cargo || undefined,
      team: p.equipe || undefined,
      active: p.ativo ?? true,
      receives_automatic_leads: p.recebe_leads_automaticos ?? true,
      created: p.created_at || new Date().toISOString(),
      updated: p.updated_at || new Date().toISOString(),
    }
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
      .update({ role: newRole.toLowerCase(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
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
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Falha ao alterar status do usuário')
    }
    return mapProfileToUser(data as ProfileRow)
  },
}
