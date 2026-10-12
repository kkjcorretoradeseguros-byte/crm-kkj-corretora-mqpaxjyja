import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

export interface CommercialTeam {
  id: string
  nome: string
  descricao?: string
  gestor_id?: string | null
  ativo: boolean
  gestor?: {
    id: string
    nome: string
    email: string
  } | null
  membros_count?: number
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  vendedor_id: string
  ativo: boolean
  participa_distribuicao: boolean
  data_inicio: string
  data_fim?: string | null
  vendedor?: {
    id: string
    nome: string
    email: string
    role: string
  } | null
}

export interface ManagementCommissionRule {
  id: string
  gestor_id: string
  team_id?: string | null
  nome: string
  percentual: number
  base_calculo: 'comissao_liquida_equipe' | 'receita_bruta_equipe' | 'volume_mensalidade'
  ativo: boolean
  data_inicio_vigencia: string
  data_fim_vigencia?: string | null
  observacoes?: string | null
}

export const teamService = {
  async getTeams(): Promise<CommercialTeam[]> {
    if (!isSupabaseConfigured) return []
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          nome,
          descricao,
          gestor_id,
          ativo,
          created_at,
          gestor:gestor_id(id, nome, email)
        `)
        .order('nome', { ascending: true })

      if (error) {
        console.warn('Erro ao carregar equipes:', error.message)
        return []
      }

      return (data || []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        descricao: t.descricao || undefined,
        gestor_id: t.gestor_id,
        ativo: Boolean(t.ativo),
        gestor: Array.isArray(t.gestor)
          ? t.gestor[0]
            ? { id: t.gestor[0].id, nome: t.gestor[0].nome, email: t.gestor[0].email }
            : null
          : t.gestor
            ? { id: t.gestor.id, nome: t.gestor.nome, email: t.gestor.email }
            : null,
        created_at: t.created_at,
      }))
    } catch {
      return []
    }
  },

  async createTeam(
    nome: string,
    gestorId?: string | null,
    descricao?: string,
  ): Promise<CommercialTeam> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data, error } = await supabase
      .from('teams')
      .insert({
        nome: nome.trim(),
        gestor_id: gestorId || null,
        descricao: descricao?.trim() || null,
        ativo: true,
      })
      .select(`
        id,
        nome,
        descricao,
        gestor_id,
        ativo,
        created_at,
        gestor:gestor_id(id, nome, email)
      `)
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Falha ao criar equipe comercial')
    }

    const t: any = data
    return {
      id: t.id,
      nome: t.nome,
      descricao: t.descricao || undefined,
      gestor_id: t.gestor_id,
      ativo: Boolean(t.ativo),
      gestor: Array.isArray(t.gestor)
        ? t.gestor[0]
          ? { id: t.gestor[0].id, nome: t.gestor[0].nome, email: t.gestor[0].email }
          : null
        : t.gestor
          ? { id: t.gestor.id, nome: t.gestor.nome, email: t.gestor.email }
          : null,
      created_at: t.created_at,
    }
  },

  async updateTeam(
    id: string,
    updates: { nome?: string; gestor_id?: string | null; ativo?: boolean; descricao?: string },
  ): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const payload: any = { updated_at: new Date().toISOString() }
    if (updates.nome !== undefined) payload.nome = updates.nome.trim()
    if (updates.gestor_id !== undefined) payload.gestor_id = updates.gestor_id || null
    if (updates.ativo !== undefined) payload.ativo = updates.ativo
    if (updates.descricao !== undefined) payload.descricao = updates.descricao?.trim() || null

    const { error } = await supabase.from('teams').update(payload).eq('id', id)
    if (error) {
      throw new Error(error.message || 'Falha ao atualizar equipe')
    }
  },

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    if (!isSupabaseConfigured) return []
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          id,
          team_id,
          vendedor_id,
          ativo,
          participa_distribuicao,
          data_inicio,
          data_fim,
          vendedor:vendedor_id(id, nome, email, role)
        `)
        .eq('team_id', teamId)
        .eq('ativo', true)

      if (error) {
        console.warn('Erro ao carregar membros da equipe:', error.message)
        return []
      }

      return (data || []).map((m: any) => ({
        id: m.id,
        team_id: m.team_id,
        vendedor_id: m.vendedor_id,
        ativo: Boolean(m.ativo),
        participa_distribuicao: Boolean(m.participa_distribuicao),
        data_inicio: m.data_inicio,
        data_fim: m.data_fim,
        vendedor: Array.isArray(m.vendedor)
          ? m.vendedor[0]
            ? {
                id: m.vendedor[0].id,
                nome: m.vendedor[0].nome,
                email: m.vendedor[0].email,
                role: m.vendedor[0].role,
              }
            : null
          : m.vendedor
            ? {
                id: m.vendedor.id,
                nome: m.vendedor.nome,
                email: m.vendedor.email,
                role: m.vendedor.role,
              }
            : null,
      }))
    } catch {
      return []
    }
  },

  async addMemberToTeam(
    teamId: string,
    vendedorId: string,
    participaDistribuicao: boolean = true,
  ): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    // 1. Transferência preservando histórico: encerra vínculo ativo anterior com data_fim
    // A transferência NÃO altera o responsável (owner_id) de oportunidades já existentes
    await supabase
      .from('team_members')
      .update({ ativo: false, data_fim: new Date().toISOString() })
      .eq('vendedor_id', vendedorId)
      .eq('ativo', true)

    // 2. Inserir novo vínculo ativo com data_inicio
    const { error } = await supabase.from('team_members').insert({
      team_id: teamId,
      vendedor_id: vendedorId,
      ativo: true,
      participa_distribuicao: participaDistribuicao,
      data_inicio: new Date().toISOString(),
    })

    if (error) {
      throw new Error(error.message || 'Falha ao vincular vendedor à equipe')
    }

    // 3. Atualizar profile do vendedor com a equipe atual sem alterar seus leads
    await supabase
      .from('profiles')
      .update({ equipe_atual_id: teamId, recebe_leads_automaticos: participaDistribuicao })
      .eq('id', vendedorId)
  },

  async removeMemberFromTeam(teamId: string, vendedorId: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    // Desativar da equipe atual preservando data_fim histórica
    // O corretor fica vinculado diretamente ao administrador
    await supabase
      .from('team_members')
      .update({ ativo: false, data_fim: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('vendedor_id', vendedorId)

    await supabase.from('profiles').update({ equipe_atual_id: null }).eq('id', vendedorId)
  },

  /**
   * Comissão de Gestão Configurável por Gestor
   */
  async getManagementRules(): Promise<ManagementCommissionRule[]> {
    if (!isSupabaseConfigured) return []
    try {
      const { data, error } = await supabase
        .from('management_commission_rules')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Erro ao carregar regras de comissão de gestão:', error.message)
        return []
      }

      return (data || []).map((r: any) => ({
        id: r.id,
        gestor_id: r.gestor_id,
        team_id: r.team_id,
        nome: r.nome,
        percentual: Number(r.percentual || 0),
        base_calculo: r.base_calculo,
        ativo: Boolean(r.ativo),
        data_inicio_vigencia: r.data_inicio_vigencia,
        data_fim_vigencia: r.data_fim_vigencia,
        observacoes: r.observacoes,
      }))
    } catch {
      return []
    }
  },

  async saveManagementRule(rule: {
    gestor_id: string
    team_id?: string | null
    nome: string
    percentual: number
    base_calculo: 'comissao_liquida_equipe' | 'receita_bruta_equipe' | 'volume_mensalidade'
    ativo: boolean
    observacoes?: string
  }): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { error } = await supabase.from('management_commission_rules').insert({
      gestor_id: rule.gestor_id,
      team_id: rule.team_id || null,
      nome: rule.nome.trim(),
      percentual: rule.percentual,
      base_calculo: rule.base_calculo,
      ativo: rule.ativo,
      observacoes: rule.observacoes || null,
    })

    if (error) {
      throw new Error(error.message || 'Falha ao salvar regra de comissão de gestão')
    }
  },

  async toggleManagementRule(id: string, ativo: boolean): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { error } = await supabase
      .from('management_commission_rules')
      .update({ ativo, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      throw new Error(error.message || 'Falha ao alterar status da regra')
    }
  },
}
