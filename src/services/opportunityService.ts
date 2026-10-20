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
  PlanSuggestion,
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
  data_fechamento?: string | null
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
  data_fechamento,
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
    stage_id: r.stage_id || r.pipeline_stages?.id || undefined,
    value: finalVal,
    sale_value: finalVal,
    commission_value: undefined,
    lives_count: r.lives_count || (r.health_data?.lives_count as number | undefined),
    probability:
      r.probability !== null && r.probability !== undefined ? Number(r.probability) : undefined,
    expected_close_date: r.expected_close_date || undefined,
    close_date: r.data_fechamento || r.close_date || undefined,
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
        .is('archived_at', null)
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
    if (data.data_fechamento !== undefined) payload.data_fechamento = data.data_fechamento || null
    else if (data.close_date !== undefined) payload.data_fechamento = data.close_date || null
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

    if (data.stage_id) {
      payload.stage_id = data.stage_id
      const { data: stRow } = await supabase
        .from('pipeline_stages')
        .select('id, nome, is_fechamento')
        .eq('id', data.stage_id)
        .maybeSingle()
      if (stRow?.is_fechamento) payload.status = 'ganha'
    } else if (data.stage !== undefined) {
      // Resolve the stage against the opportunity's persisted funnel.
      const { data: current, error: currentError } = await supabase
        .from('opportunities')
        .select('funnel_type')
        .eq('id', id)
        .single()
      if (currentError || !current)
        throw new Error(currentError?.message || 'Oportunidade não encontrada')
      const fType = (payload.funnel_type as string) || current.funnel_type
      const { data: stRow, error: stageError } = await supabase
        .from('pipeline_stages')
        .select('id, is_fechamento')
        .eq('funnel_type', fType)
        .ilike('nome', data.stage.trim())
        .limit(1)
        .maybeSingle()
      if (stageError || !stRow) {
        throw new Error(stageError?.message || 'Etapa não cadastrada no funil selecionado')
      }
      payload.stage_id = stRow.id
      if (stRow.is_fechamento) payload.status = 'ganha'
    }

    // Buscar valores prévios para registrar alterações relevantes se não houver logTimelineAction explícito
    let previousRow: any = null
    if (
      data.temperature !== undefined ||
      data.sale_value !== undefined ||
      data.value !== undefined ||
      data.stage !== undefined ||
      data.assigned_to !== undefined
    ) {
      try {
        const { data: cur } = await supabase
          .from('opportunities')
          .select('temperatura, stage_id, owner_id, valor_venda')
          .eq('id', id)
          .single()
        previousRow = cur
      } catch {
        // silencioso
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
            : logTimelineAction.action || 'etapa_alterada'
        await supabase.from('opportunity_timeline').insert({
          opportunity_id: id,
          tipo_evento: actionStr,
          conteudo: timelineDescription || `Atualizado para etapa ${mapped.stage}`,
          dados_adicionais: { stage: mapped.stage },
          user_id: currentUserId,
        })
      } catch (err) {
        console.warn('Falha ao gravar evento na timeline:', err)
      }
    } else if (previousRow) {
      const newValue = data.sale_value ?? data.value
      if (newValue !== undefined && Number(newValue) !== Number(previousRow.valor_venda)) {
        await this.addTimelineEvent(
          id,
          'valor_alterado',
          `Valor da oportunidade alterado de R$ ${Number(previousRow.valor_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para R$ ${Number(newValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          { anterior: Number(previousRow.valor_venda || 0), novo: Number(newValue) },
        )
      }
      // Registrar timeline apenas se houver mudança real de temperatura
      if (data.temperature !== undefined && data.temperature !== previousRow.temperatura) {
        await this.addTimelineEvent(
          id,
          'temperatura_alterada',
          `Temperatura alterada de ${previousRow.temperatura || 'Não definida'} para ${data.temperature}`,
          { anterior: previousRow.temperatura, nova: data.temperature },
        )
      }
      // Mudança de responsável
      if (data.assigned_to !== undefined && data.assigned_to !== previousRow.owner_id) {
        await this.addTimelineEvent(
          id,
          'responsavel_alterado',
          `Responsável comercial redistribuído para ${mapped.expand?.assigned_to?.name || data.assigned_to}`,
          { anterior: previousRow.owner_id, novo: data.assigned_to },
        )
      }
    }

    return mapped
  },

  async getPipelineStages(pipelineType?: PipelineType): Promise<
    Array<{
      id: string
      nome: string
      ordem: number
      funnel_type: string
      is_fechamento?: boolean
      e_saida?: boolean
      ativo?: boolean
    }>
  > {
    if (!isSupabaseConfigured) {
      // Fallback padrão caso offline / sem conexão
      if (pipelineType === 'POS_VENDA') {
        return [
          { id: 'pos-1', nome: 'Documentação', ordem: 1, funnel_type: 'pos_venda' },
          { id: 'pos-2', nome: 'Implantação', ordem: 2, funnel_type: 'pos_venda' },
          { id: 'pos-3', nome: 'Aguardando pagamento', ordem: 3, funnel_type: 'pos_venda' },
          { id: 'pos-4', nome: 'Implantado', ordem: 4, funnel_type: 'pos_venda' },
          { id: 'pos-5', nome: 'Cliente ativo', ordem: 5, funnel_type: 'pos_venda' },
        ]
      }
      return [
        { id: 'vendas-1', nome: 'Novo Lead', ordem: 1, funnel_type: 'vendas' },
        { id: 'vendas-2', nome: 'Contato realizado', ordem: 2, funnel_type: 'vendas' },
        { id: 'vendas-3', nome: 'Qualificado', ordem: 3, funnel_type: 'vendas' },
        { id: 'vendas-4', nome: 'Cotação', ordem: 4, funnel_type: 'vendas' },
        { id: 'vendas-5', nome: 'Follow-up', ordem: 5, funnel_type: 'vendas' },
        { id: 'vendas-6', nome: 'Negociação', ordem: 6, funnel_type: 'vendas' },
        { id: 'vendas-7', nome: 'Repescagem', ordem: 7, funnel_type: 'vendas' },
        {
          id: 'vendas-8',
          nome: 'Venda ganha',
          ordem: 8,
          funnel_type: 'vendas',
          is_fechamento: true,
        },
        { id: 'vendas-9', nome: 'Perdido', ordem: 9, funnel_type: 'vendas', e_saida: true },
      ]
    }
    try {
      let query = supabase
        .from('pipeline_stages')
        .select('id, nome, ordem, funnel_type, is_fechamento, e_saida, ativo')
        .eq('ativo', true)
        .order('ordem', { ascending: true })

      if (pipelineType) {
        const fType = pipelineType === 'POS_VENDA' ? 'pos_venda' : 'vendas'
        query = query.eq('funnel_type', fType)
      }

      const { data, error } = await query
      if (error) {
        console.warn('Erro ao carregar pipeline_stages:', error.message)
        return []
      }
      return (data || []) as Array<{
        id: string
        nome: string
        ordem: number
        funnel_type: string
        is_fechamento?: boolean
        e_saida?: boolean
        ativo?: boolean
      }>
    } catch {
      return []
    }
  },

  async updateStage(
    id: string,
    stage: string,
    previousStageOrLostReason?: string,
    lostReasonParam?: string,
    targetStageId?: string,
  ): Promise<Opportunity> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const prevStage =
      previousStageOrLostReason && previousStageOrLostReason !== lostReasonParam
        ? previousStageOrLostReason
        : undefined

    const lostReason =
      lostReasonParam ||
      (stage === 'PERDIDO' || stage === 'Venda perdida' ? previousStageOrLostReason : undefined)

    let resolvedStageId = targetStageId
    if (!resolvedStageId) {
      const dbStages = await this.getPipelineStages()
      const match = dbStages.find((s) => s.nome.trim().toLowerCase() === stage.trim().toLowerCase())
      if (match) {
        resolvedStageId = match.id
      }
    }

    const updatePayload: Partial<Opportunity> = { stage }
    if (resolvedStageId) {
      updatePayload.stage_id = resolvedStageId
    }

    if (stage === 'PERDIDO' || stage === 'Venda perdida') {
      updatePayload.lost_reason = lostReason || 'Outro'
      updatePayload.close_date = new Date().toISOString()
      updatePayload.data_fechamento = new Date().toISOString()
    } else if (stage === 'IMPLANTADO' || stage === 'GANHO' || stage === 'Venda ganha') {
      updatePayload.close_date = new Date().toISOString()
      updatePayload.data_fechamento = new Date().toISOString()
    }

    if (stage.toLowerCase() === 'perdido' || stage.toLowerCase() === 'venda perdida') {
      const { data: reason } = await supabase
        .from('loss_reasons')
        .select('id')
        .eq('nome', lostReason || '')
        .eq('ativo', true)
        .maybeSingle()
      if (!reason || !resolvedStageId)
        throw new Error('Selecione um motivo válido e uma etapa Perdido cadastrada')
      const { error } = await supabase
        .from('opportunities')
        .update({
          stage_id: resolvedStageId,
          status: 'perdida',
          loss_reason_id: reason.id,
          loss_notes: lostReason,
          data_fechamento: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
    }
    const updated =
      stage.toLowerCase() === 'perdido' || stage.toLowerCase() === 'venda perdida'
        ? await this.getOpportunityById(id)
        : await this.updateOpportunity(id, updatePayload)

    try {
      const conteudoTimeline =
        stage === 'Venda perdida' || stage === 'PERDIDO'
          ? `Movido de "${prevStage || 'etapa anterior'}" para "Venda perdida". Motivo: ${lostReason || 'Não informado'}.`
          : prevStage
            ? `Movido de "${prevStage}" para "${stage}".`
            : `Etapa alterada para "${stage}".`

      await supabase.from('opportunity_timeline').insert({
        opportunity_id: id,
        tipo_evento: 'etapa_alterada',
        conteudo: conteudoTimeline,
        dados_adicionais: {
          previousStage: prevStage || null,
          newStage: stage,
          stage_id: resolvedStageId || null,
          lostReason: lostReason || null,
        },
        user_id: currentUserId,
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
        tipo_evento: 'responsavel_alterado',
        conteudo: `Oportunidade reatribuída ao consultor (${mapped.expand?.assigned_to?.name || newUserId})`,
        dados_adicionais: { newUserId },
        user_id: currentUserId,
      })
    } catch (err) {
      console.warn('Falha ao registrar redistribuição na timeline:', err)
    }

    return mapped
  },

  async deleteOpportunity(id: string, motivo?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false

    // Verificar se há contratos ou financeiro vinculado antes de excluir
    const { data: contracts } = await supabase
      .from('contracts')
      .select('id, status, numero_contrato')
      .eq('opportunity_id', id)

    // Contratos e seus lançamentos financeiros exigem cancelamento auditável.
    // Não excluir em cascata pelo cliente: operações separadas podem apagar histórico parcialmente.
    if (contracts && contracts.length > 0) {
      throw new Error(
        'Exclusão bloqueada: esta oportunidade possui contrato vinculado. Use o cancelamento auditável.',
      )
    }

    // Limpa tarefas, timeline e sugestões de cotação associadas
    await supabase.from('tasks').delete().eq('opportunity_id', id)
    await supabase.from('opportunity_plan_suggestions').delete().eq('opportunity_id', id)
    await supabase.from('opportunity_timeline').delete().eq('opportunity_id', id)

    const { error } = await supabase.from('opportunities').delete().eq('id', id)
    if (error) {
      throw new Error(error.message || 'Falha ao excluir oportunidade.')
    }
    return true
  },

  async cancelOpportunity(id: string, motivo: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false
    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    // Atualiza status da oportunidade para cancelada/perdida
    const { error } = await supabase
      .from('opportunities')
      .update({
        etapa_vendas: 'Perdido',
        perda_motivo: motivo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      throw new Error(error.message || 'Falha ao cancelar oportunidade.')
    }

    // Cancela contratos vinculados com auditoria
    await supabase
      .from('contracts')
      .update({
        status: 'cancelado',
        observacoes: `Venda cancelada administrativamente. Motivo: ${motivo}`,
        updated_at: new Date().toISOString(),
      })
      .eq('opportunity_id', id)

    // Registra na timeline auditável
    await this.addTimelineEvent(
      id,
      'STATUS_CHANGE',
      `Oportunidade e venda canceladas administrativamente. Motivo: ${motivo}`,
      { cancelado_por: currentUserId, motivo },
    )

    return true
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

  async addTimelineEvent(
    opportunityId: string,
    tipoEvento: string,
    conteudo: string,
    dadosAdicionais?: Record<string, any>,
  ): Promise<OpportunityTimeline | null> {
    if (!isSupabaseConfigured || !opportunityId) return null

    try {
      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData?.user?.id || null

      const { data, error } = await supabase
        .from('opportunity_timeline')
        .insert({
          opportunity_id: opportunityId,
          tipo_evento: tipoEvento,
          conteudo: conteudo,
          dados_adicionais: dadosAdicionais || {},
          user_id: currentUserId,
        })
        .select(
          'id, opportunity_id, tipo_evento, conteudo, dados_adicionais, user_id, created_at, profiles:user_id(id, nome, email)',
        )
        .single()

      if (error || !data) {
        console.warn('Erro ao registrar evento na timeline:', error?.message)
        return null
      }

      const row = data as any
      return {
        id: row.id,
        opportunity_id: row.opportunity_id,
        action: row.tipo_evento,
        action_type: row.tipo_evento,
        title:
          tipoEvento === 'nota'
            ? 'Anotação Interna'
            : tipoEvento === 'temperatura_alterada'
              ? 'Temperatura Atualizada'
              : tipoEvento === 'etapa_alterada'
                ? 'Etapa Alterada'
                : tipoEvento === 'responsavel_alterado'
                  ? 'Responsável Alterado'
                  : tipoEvento === 'tarefa_criada'
                    ? 'Tarefa Agendada'
                    : tipoEvento === 'tarefa_concluida'
                      ? 'Tarefa Concluída'
                      : tipoEvento === 'tarefa_cancelada'
                        ? 'Tarefa Cancelada'
                        : tipoEvento === 'venda_ganha'
                          ? 'Venda Ganha'
                          : tipoEvento === 'pos_venda'
                            ? 'Encaminhado para Pós-Venda'
                            : 'Registro de Atividade',
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
    } catch (e: any) {
      console.warn('Falha silenciosa ao registrar timeline:', e?.message)
      return null
    }
  },

  async addTimelineNote(opportunityId: string, note: string): Promise<OpportunityTimeline> {
    const res = await this.addTimelineEvent(opportunityId, 'nota', note)
    if (!res) throw new Error('Falha ao registrar anotação')
    return res
  },

  /**
   * Cotações / Sugestões de Planos (opportunity_plan_suggestions)
   * Suporta múltiplas cotações por oportunidade e estritamente UMA principal
   */
  async getPlanSuggestions(opportunityId: string): Promise<PlanSuggestion[]> {
    if (!isSupabaseConfigured) return []

    try {
      const { data, error } = await supabase
        .from('opportunity_plan_suggestions')
        .select(`
          id,
          opportunity_id,
          carrier_id,
          product_id,
          nome_plano,
          valor_mensal,
          coparticipacao,
          acomodacao,
          vidas,
          is_principal,
          observacoes,
          created_at,
          carriers:carrier_id(id, nome, nome_curto),
          products:product_id(id, nome, categoria)
        `)
        .eq('opportunity_id', opportunityId)
        .order('is_principal', { ascending: false })
        .order('valor_mensal', { ascending: true })

      if (error) {
        console.warn('Erro ao carregar sugestões de plano:', error.message)
        return []
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        opportunity_id: row.opportunity_id,
        carrier_id: row.carrier_id,
        carrier_name: row.carriers?.nome || 'Operadora',
        product_name: row.nome_plano || row.products?.nome || 'Plano Cotado',
        categoria: row.products?.categoria || 'SAUDE',
        quoted_monthly_value: Number(row.valor_mensal ?? 0),
        is_principal: Boolean(row.is_principal),
        quotation_date: row.created_at,
        notes: row.observacoes || undefined,
      }))
    } catch {
      return []
    }
  },

  async addPlanSuggestion(
    opportunityId: string,
    suggestion: {
      carrier_id: string
      product_id?: string
      nome_plano: string
      valor_mensal: number
      is_principal?: boolean
      vidas?: number
      coparticipacao?: boolean
      acomodacao?: string
      observacoes?: string
    },
  ): Promise<PlanSuggestion> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    // Se a nova cotação for marcada como principal, desmarcar qualquer principal existente antes
    if (suggestion.is_principal) {
      await supabase
        .from('opportunity_plan_suggestions')
        .update({ is_principal: false })
        .eq('opportunity_id', opportunityId)
    }

    const { data, error } = await supabase
      .from('opportunity_plan_suggestions')
      .insert({
        opportunity_id: opportunityId,
        carrier_id: suggestion.carrier_id,
        product_id: suggestion.product_id || null,
        nome_plano: suggestion.nome_plano.trim(),
        valor_mensal: Math.max(0, Number(suggestion.valor_mensal || 0)),
        is_principal: Boolean(suggestion.is_principal),
        vidas: Math.max(1, Number(suggestion.vidas || 1)),
        coparticipacao: Boolean(suggestion.coparticipacao),
        acomodacao: suggestion.acomodacao || 'apartamento',
        observacoes: suggestion.observacoes || null,
      })
      .select(`
        id,
        opportunity_id,
        carrier_id,
        product_id,
        nome_plano,
        valor_mensal,
        is_principal,
        created_at,
        carriers:carrier_id(id, nome)
      `)
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Falha ao cadastrar cotação de plano')
    }

    // Se tornou-se principal, sincronizar valor_venda e carrier_id na oportunidade
    if (suggestion.is_principal) {
      await supabase
        .from('opportunities')
        .update({
          carrier_id: suggestion.carrier_id,
          valor_venda: Math.max(0, Number(suggestion.valor_mensal || 0)),
          updated_at: new Date().toISOString(),
        })
        .eq('id', opportunityId)
    }

    const row = data as any
    return {
      id: row.id,
      opportunity_id: row.opportunity_id,
      carrier_id: row.carrier_id,
      carrier_name: row.carriers?.nome || 'Operadora',
      product_name: row.nome_plano,
      quoted_monthly_value: Number(row.valor_mensal ?? 0),
      is_principal: Boolean(row.is_principal),
      quotation_date: row.created_at,
    }
  },

  async setPrincipalPlanSuggestion(opportunityId: string, suggestionId: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    // 1. Desmarcar todas as cotações como principal
    await supabase
      .from('opportunity_plan_suggestions')
      .update({ is_principal: false })
      .eq('opportunity_id', opportunityId)

    // 2. Marcar a cotação escolhida como principal
    const { data: updatedSug, error } = await supabase
      .from('opportunity_plan_suggestions')
      .update({ is_principal: true })
      .eq('id', suggestionId)
      .eq('opportunity_id', opportunityId)
      .select('carrier_id, valor_mensal')
      .single()

    if (error || !updatedSug) {
      throw new Error(error?.message || 'Falha ao definir cotação principal')
    }

    // 3. Sincronizar oportunidade com a nova cotação principal
    await supabase
      .from('opportunities')
      .update({
        carrier_id: updatedSug.carrier_id,
        valor_venda: Number(updatedSug.valor_mensal || 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunityId)
  },

  async deletePlanSuggestion(opportunityId: string, suggestionId: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { error } = await supabase
      .from('opportunity_plan_suggestions')
      .delete()
      .eq('id', suggestionId)
      .eq('opportunity_id', opportunityId)

    if (error) {
      throw new Error(error.message || 'Falha ao excluir sugestão de cotação')
    }
  },
}
