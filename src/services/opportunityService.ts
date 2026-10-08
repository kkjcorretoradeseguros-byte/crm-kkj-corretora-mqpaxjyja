import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type {
  Opportunity,
  OpportunityTimeline,
  OpportunityTimelineAction,
  PipelineType,
  Company,
  Contact,
  Product,
  Carrier,
  User,
} from '@/types/crm'

export interface OpportunityFilterOptions {
  page?: number
  perPage?: number
  pipelineType?: PipelineType
  stage?: string
  assignedTo?: string
  companyId?: string
  search?: string
}

interface OpportunityDbRow {
  id: string
  title: string
  company_id: string
  contact_id?: string | null
  product_id?: string | null
  carrier_id?: string | null
  pipeline_type: PipelineType
  stage: string
  value: number
  commission_value?: number | null
  lives_count?: number | null
  probability?: number | null
  expected_close_date?: string | null
  close_date?: string | null
  assigned_to?: string | null
  origin?: string | null
  lost_reason?: string | null
  lost_details?: string | null
  tags?: string[] | null
  notes?: string | null
  created_at?: string
  updated_at?: string
  companies?: {
    id: string
    trade_name: string
    legal_name?: string | null
    cnpj?: string | null
    city?: string | null
    state?: string | null
    phone?: string | null
    email?: string | null
  } | null
  contacts?: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
    position?: string | null
  } | null
  products?: {
    id: string
    nome: string
    segmento: string
  } | null
  carriers?: {
    id: string
    nome: string
  } | null
  profiles?: {
    id: string
    nome: string
    email: string
  } | null
}

const SELECT_OPP_EXPAND = `
  id,
  title,
  company_id,
  contact_id,
  product_id,
  carrier_id,
  pipeline_type,
  stage,
  value,
  commission_value,
  lives_count,
  probability,
  expected_close_date,
  close_date,
  assigned_to,
  origin,
  lost_reason,
  lost_details,
  tags,
  notes,
  created_at,
  updated_at,
  companies:company_id(id, trade_name, legal_name, cnpj, city, state, phone, email),
  contacts:contact_id(id, name, phone, email, position),
  products:product_id(id, nome, segmento),
  carriers:carrier_id(id, nome),
  profiles:assigned_to(id, nome, email)
`

function mapOpportunityRow(r: OpportunityDbRow): Opportunity {
  const opp: Opportunity = {
    id: r.id,
    title: r.title,
    company_id: r.company_id,
    contact_id: r.contact_id || undefined,
    product_id: r.product_id || undefined,
    carrier_id: r.carrier_id || undefined,
    pipeline_type: r.pipeline_type,
    stage: r.stage,
    value: Number(r.value || 0),
    commission_value:
      r.commission_value !== null && r.commission_value !== undefined
        ? Number(r.commission_value)
        : undefined,
    lives_count: r.lives_count || undefined,
    probability:
      r.probability !== null && r.probability !== undefined ? Number(r.probability) : undefined,
    expected_close_date: r.expected_close_date || undefined,
    close_date: r.close_date || undefined,
    assigned_to: r.assigned_to || undefined,
    origin: r.origin || undefined,
    lost_reason: r.lost_reason || undefined,
    lost_details: r.lost_details || undefined,
    tags: Array.isArray(r.tags) ? r.tags : [],
    notes: r.notes || undefined,
    created: r.created_at || new Date().toISOString(),
    updated: r.updated_at || new Date().toISOString(),
  }

  opp.expand = {}
  if (r.companies) {
    opp.expand.company_id = {
      id: r.companies.id,
      trade_name: r.companies.trade_name,
      legal_name: r.companies.legal_name || undefined,
      cnpj: r.companies.cnpj || undefined,
      city: r.companies.city || undefined,
      state: r.companies.state || undefined,
      phone: r.companies.phone || undefined,
      email: r.companies.email || undefined,
    } as Company
  }
  if (r.contacts) {
    opp.expand.contact_id = {
      id: r.contacts.id,
      company_id: r.company_id,
      name: r.contacts.name,
      phone: r.contacts.phone || undefined,
      email: r.contacts.email || undefined,
      position: r.contacts.position || undefined,
    } as Contact
  }
  if (r.products) {
    opp.expand.product_id = {
      id: r.products.id,
      name: r.products.nome,
      category: (r.products.segmento as unknown) || 'SAUDE',
      active: true,
    } as Product
  }
  if (r.carriers) {
    opp.expand.carrier_id = {
      id: r.carriers.id,
      nome: r.carriers.nome,
      segmento_principal: 'SAUDE',
      segmentos_atendidos: [],
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Carrier
  }
  if (r.profiles) {
    opp.expand.assigned_to = {
      id: r.profiles.id,
      name: r.profiles.nome,
      email: r.profiles.email,
      role: 'vendedor',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    } as User
  }

  return opp
}

interface TimelineDbRow {
  id: string
  opportunity_id: string
  action: string
  title: string
  description?: string | null
  metadata?: Record<string, unknown> | null
  created_by?: string | null
  created_at?: string
  profiles?: {
    id: string
    nome: string
    email: string
  } | null
}

function mapTimelineRow(r: TimelineDbRow): OpportunityTimeline {
  const item: OpportunityTimeline = {
    id: r.id,
    opportunity_id: r.opportunity_id,
    action: r.action,
    title: r.title,
    description: r.description || undefined,
    metadata: r.metadata || undefined,
    created_by: r.created_by || undefined,
    created: r.created_at || new Date().toISOString(),
  }

  if (r.profiles) {
    item.expand = {
      created_by: {
        id: r.profiles.id,
        name: r.profiles.nome,
        email: r.profiles.email,
        role: 'vendedor',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      } as User,
    }
  }

  return item
}

export const opportunityService = {
  async getOpportunities(options: OpportunityFilterOptions = {}) {
    if (!isSupabaseConfigured) {
      return { items: [] as Opportunity[], totalItems: 0, totalPages: 0, page: 1, perPage: 100 }
    }

    const page = options.page || 1
    const perPage = options.perPage || 100
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    try {
      let query = supabase.from('opportunities').select(SELECT_OPP_EXPAND, { count: 'exact' })

      if (options.pipelineType) {
        query = query.eq('pipeline_type', options.pipelineType)
      }
      if (options.stage) {
        query = query.eq('stage', options.stage)
      }
      if (options.assignedTo) {
        query = query.eq('assigned_to', options.assignedTo)
      }
      if (options.companyId) {
        query = query.eq('company_id', options.companyId)
      }
      if (options.search) {
        const s = options.search.trim()
        query = query.or(`title.ilike.%${s}%,origin.ilike.%${s}%`)
      }

      query = query.order('created_at', { ascending: false }).range(from, to)

      const { data, count, error } = await query
      if (error) {
        console.warn('Erro ao consultar oportunidades no Supabase:', error.message)
        return { items: [] as Opportunity[], totalItems: 0, totalPages: 0, page, perPage }
      }

      const totalItems = count || 0
      const totalPages = Math.ceil(totalItems / perPage)
      const items = ((data || []) as unknown as OpportunityDbRow[]).map(mapOpportunityRow)

      return { items, totalItems, totalPages, page, perPage }
    } catch {
      return { items: [] as Opportunity[], totalItems: 0, totalPages: 0, page, perPage }
    }
  },

  async getAllOpportunities(pipelineType?: PipelineType): Promise<Opportunity[]> {
    if (!isSupabaseConfigured) return []

    try {
      let query = supabase
        .from('opportunities')
        .select(SELECT_OPP_EXPAND)
        .order('created_at', { ascending: false })

      if (pipelineType) {
        query = query.eq('pipeline_type', pipelineType)
      }

      const { data, error } = await query
      if (error) {
        console.warn('Erro ao carregar oportunidades:', error.message)
        return []
      }

      return ((data || []) as unknown as OpportunityDbRow[]).map(mapOpportunityRow)
    } catch {
      return []
    }
  },

  async getOpportunityById(id: string): Promise<Opportunity> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data, error } = await supabase
      .from('opportunities')
      .select(SELECT_OPP_EXPAND)
      .eq('id', id)
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Oportunidade não encontrada')
    }

    return mapOpportunityRow(data as unknown as OpportunityDbRow)
  },

  async createOpportunity(data: Partial<Opportunity>): Promise<Opportunity> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const assignedTo = data.assigned_to || currentUserId

    const { data: created, error } = await supabase
      .from('opportunities')
      .insert({
        title: data.title || '',
        company_id: data.company_id!,
        contact_id: data.contact_id || null,
        product_id: data.product_id || null,
        carrier_id: data.carrier_id || null,
        pipeline_type: data.pipeline_type || 'VENDAS',
        stage: data.stage || 'PROSPECCAO',
        value: data.value || 0,
        commission_value: data.commission_value || 0,
        lives_count: data.lives_count || null,
        probability: data.probability ?? 10,
        expected_close_date: data.expected_close_date || null,
        close_date: data.close_date || null,
        assigned_to: assignedTo,
        origin: data.origin || null,
        lost_reason: data.lost_reason || null,
        lost_details: data.lost_details || null,
        tags: data.tags || [],
        notes: data.notes || null,
      })
      .select(SELECT_OPP_EXPAND)
      .single()

    if (error || !created) {
      throw new Error(error?.message || 'Falha ao criar oportunidade')
    }

    const mapped = mapOpportunityRow(created as unknown as OpportunityDbRow)

    try {
      await supabase.from('opportunity_timeline').insert({
        opportunity_id: mapped.id,
        action: 'CREATION',
        title: 'Oportunidade Criada',
        description: `Oportunidade "${mapped.title}" inserida na etapa ${mapped.stage} (${mapped.pipeline_type === 'VENDAS' ? 'Funil de Vendas' : 'Pós-Venda'}).`,
        created_by: currentUserId,
      })
    } catch (err) {
      console.warn('Falha ao registrar criação na timeline:', err)
    }

    return mapped
  },

  async updateOpportunity(
    id: string,
    data: Partial<Opportunity>,
    logTimelineAction?: string | OpportunityTimelineAction,
    timelineDescription?: string,
  ): Promise<Opportunity> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (data.title !== undefined) payload.title = data.title
    if (data.company_id !== undefined) payload.company_id = data.company_id
    if (data.contact_id !== undefined) payload.contact_id = data.contact_id || null
    if (data.product_id !== undefined) payload.product_id = data.product_id || null
    if (data.carrier_id !== undefined) payload.carrier_id = data.carrier_id || null
    if (data.pipeline_type !== undefined) payload.pipeline_type = data.pipeline_type
    if (data.stage !== undefined) payload.stage = data.stage
    if (data.value !== undefined) payload.value = data.value
    if (data.commission_value !== undefined) payload.commission_value = data.commission_value
    if (data.lives_count !== undefined) payload.lives_count = data.lives_count || null
    if (data.probability !== undefined) payload.probability = data.probability
    if (data.expected_close_date !== undefined)
      payload.expected_close_date = data.expected_close_date || null
    if (data.close_date !== undefined) payload.close_date = data.close_date || null
    if (data.assigned_to !== undefined) payload.assigned_to = data.assigned_to || null
    if (data.origin !== undefined) payload.origin = data.origin || null
    if (data.lost_reason !== undefined) payload.lost_reason = data.lost_reason || null
    if (data.lost_details !== undefined) payload.lost_details = data.lost_details || null
    if (data.tags !== undefined) payload.tags = data.tags || []
    if (data.notes !== undefined) payload.notes = data.notes || null

    const { data: updated, error } = await supabase
      .from('opportunities')
      .update(payload)
      .eq('id', id)
      .select(SELECT_OPP_EXPAND)
      .single()

    if (error || !updated) {
      throw new Error(error?.message || 'Falha ao atualizar oportunidade')
    }

    const mapped = mapOpportunityRow(updated as unknown as OpportunityDbRow)

    if (logTimelineAction) {
      try {
        const actionStr =
          typeof logTimelineAction === 'string'
            ? logTimelineAction
            : logTimelineAction.action || 'STAGE_CHANGE'
        await supabase.from('opportunity_timeline').insert({
          opportunity_id: id,
          action: actionStr,
          title:
            actionStr === 'STAGE_CHANGE'
              ? `Etapa alterada para ${mapped.stage}`
              : 'Atualização de oportunidade',
          description: timelineDescription || `Atualizado para etapa ${mapped.stage}`,
          created_by: currentUserId,
        })
      } catch (err) {
        console.warn('Falha ao gravar evento na timeline:', err)
      }
    }

    return mapped
  },

  async updateStage(
    id: string,
    stage: string,
    previousStageOrLostReason?: string,
    lostReasonParam?: string,
  ): Promise<Opportunity> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const lostReason =
      lostReasonParam ||
      (stage === 'PERDIDO' || stage === 'Venda perdida' ? previousStageOrLostReason : undefined)

    const updatePayload: Partial<Opportunity> = { stage }
    if (stage === 'PERDIDO' || stage === 'Venda perdida') {
      updatePayload.lost_reason = lostReason || 'Outro'
      updatePayload.close_date = new Date().toISOString()
    } else if (stage === 'IMPLANTADO' || stage === 'GANHO' || stage === 'Venda ganha') {
      updatePayload.close_date = new Date().toISOString()
    }

    const updated = await this.updateOpportunity(id, updatePayload)

    try {
      await supabase.from('opportunity_timeline').insert({
        opportunity_id: id,
        action: 'STAGE_CHANGE',
        title: `Etapa alterada para ${stage}`,
        description:
          stage === 'PERDIDO'
            ? `Motivo da perda: ${lostReason || 'Não informado'}`
            : `Movido para ${stage}`,
        metadata: { newStage: stage, lostReason },
        created_by: currentUserId,
      })
    } catch (err) {
      console.warn('Falha ao gravar transição de etapa na timeline:', err)
    }

    return updated
  },

  async updateAssigned(id: string, newUserId: string, _newUserName?: string): Promise<Opportunity> {
    return this.transferOpportunity(id, newUserId)
  },

  async transferOpportunity(id: string, newUserId: string): Promise<Opportunity> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const { data: updated, error } = await supabase
      .from('opportunities')
      .update({
        assigned_to: newUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(SELECT_OPP_EXPAND)
      .single()

    if (error || !updated) {
      throw new Error(error?.message || 'Falha ao redistribuir oportunidade')
    }

    const mapped = mapOpportunityRow(updated as unknown as OpportunityDbRow)

    try {
      await supabase.from('opportunity_timeline').insert({
        opportunity_id: id,
        action: 'TRANSFER',
        title: 'Responsável Alterado',
        description: `Oportunidade reatribuída ao consultor (${mapped.expand?.assigned_to?.name || newUserId})`,
        metadata: { newUserId },
        created_by: currentUserId,
      })
    } catch (err) {
      console.warn('Falha ao registrar redistribuição na timeline:', err)
    }

    return mapped
  },

  async deleteOpportunity(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false

    const { error } = await supabase.from('opportunities').delete().eq('id', id)
    return !error
  },

  async getTimeline(opportunityId: string): Promise<OpportunityTimeline[]> {
    if (!isSupabaseConfigured || !opportunityId) return []

    try {
      const { data, error } = await supabase
        .from('opportunity_timeline')
        .select(
          'id, opportunity_id, action, title, description, metadata, created_by, created_at, profiles:created_by(id, nome, email)',
        )
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Erro ao carregar timeline da oportunidade:', error.message)
        return []
      }

      return ((data || []) as unknown as TimelineDbRow[]).map(mapTimelineRow)
    } catch {
      return []
    }
  },

  async addTimelineNote(opportunityId: string, note: string): Promise<OpportunityTimeline> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const { data, error } = await supabase
      .from('opportunity_timeline')
      .insert({
        opportunity_id: opportunityId,
        action: 'NOTE',
        title: 'Anotação Interna',
        description: note,
        created_by: currentUserId,
      })
      .select(
        'id, opportunity_id, action, title, description, metadata, created_by, created_at, profiles:created_by(id, nome, email)',
      )
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Falha ao registrar anotação na timeline')
    }

    return mapTimelineRow(data as unknown as TimelineDbRow)
  },
}
