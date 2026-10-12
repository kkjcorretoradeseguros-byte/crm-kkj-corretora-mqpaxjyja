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
  titulo?: string | null
  title?: string | null
  company_id?: string | null
  contact_id?: string | null
  product_id?: string | null
  carrier_id?: string | null
  current_carrier_id?: string | null
  current_carrier_name?: string | null
  stage_id?: string | null
  funnel_type?: PipelineType | string | null
  pipeline_type?: PipelineType | null
  stage?: string | null
  status?: string | null
  temperatura?: string | null
  valor_venda?: number | null
  value?: number | null
  commission_value?: number | null
  lives_count?: number | null
  probability?: number | null
  expected_close_date?: string | null
  close_date?: string | null
  owner_id?: string | null
  assigned_to?: string | null
  origin?: string | null
  origem?: string | null
  lost_reason?: string | null
  loss_notes?: string | null
  lost_details?: string | null
  tags?: string[] | null
  notes?: string | null
  health_data?: Record<string, unknown> | null
  attribution?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
  companies?: {
    id: string
    trade_name?: string | null
    nome_fantasia?: string | null
    legal_name?: string | null
    razao_social?: string | null
    cnpj?: string | null
    city?: string | null
    cidade?: string | null
    state?: string | null
    estado?: string | null
    phone?: string | null
    email?: string | null
  } | null
  contacts?: {
    id: string
    name?: string | null
    nome?: string | null
    phone?: string | null
    celular?: string | null
    email?: string | null
    position?: string | null
    cargo?: string | null
  } | null
  products?: {
    id: string
    nome?: string | null
    name?: string | null
    segmento?: string | null
    categoria?: string | null
  } | null
  carriers?: {
    id: string
    nome: string
    nome_curto?: string | null
  } | null
  profiles?: {
    id: string
    nome: string
    email: string
  } | null
}

const SELECT_OPP_EXPAND = `
  id,
  titulo,
  company_id,
  contact_id,
  product_id,
  carrier_id,
  current_carrier_id,
  current_carrier_name,
  stage_id,
  status,
  funnel_type,
  temperatura,
  valor_venda,
  tags,
  owner_id,
  health_data,
  loss_reason_id,
  loss_notes,
  origem,
  midia,
  campanha,
  campaign_id,
  adset,
  adset_id,
  anuncio,
  ad_id,
  external_lead_id,
  attribution,
  created_by,
  created_at,
  updated_at,
  companies:company_id(id, razao_social, nome_fantasia, cnpj, cidade, estado, segmento, notas),
  contacts:contact_id(id, nome, celular, email, cargo, cpf),
  products:product_id(id, nome, categoria),
  carriers:carrier_id(id, nome, nome_curto),
  pipeline_stages:stage_id(id, nome, ordem, funnel_type, is_fechamento),
  profiles:owner_id(id, nome, email)
`

interface ExtendedOppRow extends OpportunityDbRow {
  pipeline_stages?: {
    id: string
    nome: string
    ordem: number
    funnel_type: string
    is_fechamento?: boolean
  } | null
}

function mapOpportunityRow(r: ExtendedOppRow): Opportunity {
  const pType: PipelineType =
    r.funnel_type === 'pos_venda' || r.pipeline_type === 'POS_VENDA' ? 'POS_VENDA' : 'VENDAS'
  const stageName = r.pipeline_stages?.nome || r.stage || 'Novo Lead'
  const finalVal = Number(r.valor_venda ?? r.value ?? 0)

  const opp: Opportunity = {
    id: r.id,
    title: r.titulo || r.title || 'Sem título',
    company_id: r.company_id || undefined,
    contact_id: r.contact_id || undefined,
    product_id: r.product_id || undefined,
    carrier_id: r.carrier_id || undefined,
    current_carrier_id: r.current_carrier_id || undefined,
    current_carrier_name: r.current_carrier_name || undefined,
    pipeline_type: pType,
    stage: stageName,
    value: finalVal,
    sale_value: finalVal,
    commission_value: undefined,
    lives_count: r.lives_count || (r.health_data?.lives_count as number | undefined),
    probability:
      r.probability !== null && r.probability !== undefined ? Number(r.probability) : undefined,
    expected_close_date: r.expected_close_date || undefined,
    close_date: r.close_date || undefined,
    assigned_to: r.owner_id || r.assigned_to || undefined,
    origin: r.origem || r.origin || undefined,
    lost_reason: (r.lost_reason as any) || undefined,
    lost_details: r.loss_notes || r.lost_details || undefined,
    tags: Array.isArray(r.tags) ? r.tags : [],
    notes: r.notes || undefined,
    health_data: r.health_data as any,
    attribution: r.attribution as any,
    created: r.created_at || new Date().toISOString(),
    updated: r.updated_at || new Date().toISOString(),
  }

  opp.expand = {}
  if (r.companies) {
    opp.expand.company_id = {
      id: r.companies.id,
      trade_name: r.companies.nome_fantasia || r.companies.trade_name || 'Sem nome fantasia',
      legal_name: r.companies.razao_social || r.companies.legal_name || undefined,
      cnpj: r.companies.cnpj || undefined,
      city: r.companies.cidade || r.companies.city || undefined,
      state: r.companies.estado || r.companies.state || undefined,
      phone: r.companies.phone || undefined,
      email: r.companies.email || undefined,
    } as Company
  }
  if (r.contacts) {
    opp.expand.contact_id = {
      id: r.contacts.id,
      company_id: r.company_id || '',
      name: r.contacts.nome || r.contacts.name || 'Contato',
      phone: r.contacts.celular || r.contacts.phone || '',
      email: r.contacts.email || undefined,
      position: r.contacts.cargo || r.contacts.position || undefined,
    } as Contact
  }
  if (r.products) {
    opp.expand.product_id = {
      id: r.products.id,
      name: r.products.nome || r.products.name || 'Produto',
      category: (r.products.categoria || r.products.segmento || 'SAUDE') as any,
      active: true,
    } as Product
  }
  if (r.carriers) {
    opp.expand.carrier_id = {
      id: r.carriers.id,
      nome: r.carriers.nome,
      nome_curto: r.carriers.nome_curto || undefined,
      ativo: true,
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
        const fType = options.pipelineType === 'POS_VENDA' ? 'pos_venda' : 'vendas'
        query = query.eq('funnel_type', fType)
      }
      if (options.assignedTo) {
        query = query.eq('owner_id', options.assignedTo)
      }
      if (options.companyId) {
        query = query.eq('company_id', options.companyId)
      }
      if (options.search) {
        const s = options.search.trim()
        query = query.or(`titulo.ilike.%${s}%,origem.ilike.%${s}%`)
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
        const fType = pipelineType === 'POS_VENDA' ? 'pos_venda' : 'vendas'
        query = query.eq('funnel_type', fType)
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

    // Buscar stage_id correspondente no banco 0001
    const funnelType = data.pipeline_type === 'POS_VENDA' ? 'pos_venda' : 'vendas'
    let stageId: string | null = null
    if (data.stage) {
      const { data: stageRow } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('funnel_type', funnelType)
        .ilike('nome', data.stage.trim())
        .limit(1)
        .maybeSingle()
      if (stageRow?.id) {
        stageId = stageRow.id
      }
    }

    if (!stageId) {
      const { data: defaultStage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('funnel_type', funnelType)
        .order('ordem', { ascending: true })
        .limit(1)
        .maybeSingle()
      stageId = defaultStage?.id || null
    }

    // Se ainda não encontrou stage_id, fallback seguro
    const insertPayload: Record<string, unknown> = {
      titulo: data.title || 'Nova Oportunidade',
      company_id: data.company_id || null,
      contact_id: data.contact_id || null,
      product_id: data.product_id || null,
      carrier_id: data.carrier_id || null,
      current_carrier_id: data.current_carrier_id || null,
      current_carrier_name: data.current_carrier_name || null,
      funnel_type: funnelType,
      status: 'ativa',
      temperatura: data.temperature ? data.temperature.toLowerCase() : 'morno',
      valor_venda: data.sale_value ?? data.value ?? 0,
      owner_id: assignedTo,
      origem: data.origin || null,
      tags: Array.isArray(data.tags)
        ? data.tags
        : typeof data.tags === 'string'
          ? (data.tags as string)
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean)
          : [],
      health_data: data.health_data || {},
      attribution: data.attribution || {},
    }
    if (stageId) {
      insertPayload.stage_id = stageId
    }

    const { data: created, error } = await supabase
      .from('opportunities')
      .insert(insertPayload)
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
    if (data.title !== undefined) payload.titulo = data.title
    if (data.company_id !== undefined) payload.company_id = data.company_id || null
    if (data.contact_id !== undefined) payload.contact_id = data.contact_id || null
    if (data.product_id !== undefined) payload.product_id = data.product_id || null
    if (data.carrier_id !== undefined) payload.carrier_id = data.carrier_id || null
    if (data.current_carrier_id !== undefined)
      payload.current_carrier_id = data.current_carrier_id || null
    if (data.current_carrier_name !== undefined)
      payload.current_carrier_name = data.current_carrier_name || null
    if (data.pipeline_type !== undefined) {
      payload.funnel_type = data.pipeline_type === 'POS_VENDA' ? 'pos_venda' : 'vendas'
    }
    if (data.value !== undefined || data.sale_value !== undefined) {
      payload.valor_venda = data.sale_value ?? data.value ?? 0
    }
    if (data.assigned_to !== undefined) payload.owner_id = data.assigned_to || null
    if (data.origin !== undefined) payload.origem = data.origin || null
    if (data.tags !== undefined) {
      payload.tags = Array.isArray(data.tags)
        ? data.tags
        : typeof data.tags === 'string'
          ? (data.tags as string)
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean)
          : []
    }
    if (data.health_data !== undefined) payload.health_data = data.health_data || {}
    if (data.attribution !== undefined) payload.attribution = data.attribution || {}

    if (data.stage !== undefined) {
      // Resolver stage_id
      const fType = (payload.funnel_type as string) || 'vendas'
      const { data: stRow } = await supabase
        .from('pipeline_stages')
        .select('id, is_fechamento')
        .eq('funnel_type', fType)
        .ilike('nome', data.stage.trim())
        .limit(1)
        .maybeSingle()
      if (stRow?.id) {
        payload.stage_id = stRow.id
        if (stRow.is_fechamento) {
          payload.status = 'ganha'
        }
      }
    }

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
        owner_id: newUserId,
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
      // 0001 schema usa: tipo_evento, conteudo, dados_adicionais, user_id
      const { data, error } = await supabase
        .from('opportunity_timeline')
        .select(
          'id, opportunity_id, tipo_evento, conteudo, dados_adicionais, user_id, created_at, profiles:user_id(id, nome, email)',
        )
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Erro ao carregar timeline da oportunidade:', error.message)
        return []
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        opportunity_id: row.opportunity_id,
        action: row.tipo_evento,
        action_type: row.tipo_evento,
        title:
          row.tipo_evento === 'nota'
            ? 'Anotação Interna'
            : row.conteudo
              ? row.conteudo.slice(0, 30)
              : 'Evento',
        description: row.conteudo,
        metadata: row.dados_adicionais,
        created_by: row.user_id,
        created: row.created_at,
        expand: row.profiles
          ? {
              created_by: {
                id: row.profiles.id,
                name: row.profiles.nome,
                email: row.profiles.email,
                role: 'vendedor',
              },
            }
          : undefined,
      }))
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
        tipo_evento: 'nota',
        conteudo: note,
        dados_adicionais: {},
        user_id: currentUserId,
      })
      .select(
        'id, opportunity_id, tipo_evento, conteudo, dados_adicionais, user_id, created_at, profiles:user_id(id, nome, email)',
      )
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Falha ao registrar anotação na timeline')
    }

    const row = data as any
    return {
      id: row.id,
      opportunity_id: row.opportunity_id,
      action: row.tipo_evento,
      action_type: row.tipo_evento,
      title: 'Anotação Interna',
      description: row.conteudo,
      metadata: row.dados_adicionais,
      created_by: row.user_id,
      created: row.created_at,
      expand: row.profiles
        ? {
            created_by: {
              id: row.profiles.id,
              name: row.profiles.nome,
              email: row.profiles.email,
              role: 'vendedor',
            },
          }
        : undefined,
    }
  },
}
