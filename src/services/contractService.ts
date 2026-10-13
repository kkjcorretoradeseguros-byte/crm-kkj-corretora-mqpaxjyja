import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type {
  Contract,
  ContractStatus,
  Company,
  Contact,
  Product,
  Carrier,
  User,
} from '@/types/crm'

export interface ContractFilterOptions {
  page?: number
  perPage?: number
  companyId?: string
  opportunity_id?: string
  status?: ContractStatus
  search?: string
}

interface ContractDbRow {
  id: string
  numero_contrato?: string | null
  contract_number?: string | null
  opportunity_id?: string | null
  company_id?: string | null
  contact_id?: string | null
  carrier_id: string
  product_id?: string | null
  plano?: string | null
  qtd_vidas?: number | null
  valor_mensal?: number | null
  valor_venda?: number | null
  sale_value?: number | null
  status: string
  data_inicio_vigencia?: string | null
  data_renovacao?: string | null
  observacoes?: string | null
  responsavel_id?: string | null
  created_at?: string
  updated_at?: string
  companies?: {
    id: string
    nome_fantasia?: string | null
    trade_name?: string | null
    razao_social?: string | null
    legal_name?: string | null
    cnpj?: string | null
    cidade?: string | null
    estado?: string | null
  } | null
  contacts?: {
    id: string
    nome?: string | null
    name?: string | null
    celular?: string | null
    phone?: string | null
    email?: string | null
  } | null
  products?: {
    id: string
    nome: string
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

const SELECT_EXPAND = `
  id,
  numero_contrato,
  opportunity_id,
  company_id,
  contact_id,
  product_id,
  carrier_id,
  plano,
  qtd_vidas,
  valor_mensal,
  valor_venda,
  status,
  data_inicio_vigencia,
  data_renovacao,
  observacoes,
  responsavel_id,
  created_at,
  updated_at,
  companies:company_id(id, razao_social, nome_fantasia, cnpj, cidade, estado),
  contacts:contact_id(id, nome, celular, email),
  products:product_id(id, nome, categoria),
  carriers:carrier_id(id, nome, nome_curto),
  profiles:responsavel_id(id, nome, email)
`

function mapContractRow(r: ContractDbRow): Contract {
  const statusRaw = (r.status || 'em_implantacao').toLowerCase()
  let uiStatus: ContractStatus = 'Em Implantação'
  if (statusRaw === 'ativo') uiStatus = 'Ativo'
  else if (statusRaw === 'cancelado') uiStatus = 'Cancelado'
  else if (statusRaw === 'pendente_renovacao') uiStatus = 'Pendente Renovação'

  const val = Number(r.valor_mensal ?? r.valor_venda ?? r.sale_value ?? 0)

  const c: Contract = {
    id: r.id,
    company_id: r.company_id || undefined,
    contact_id: r.contact_id || undefined,
    carrier_id: r.carrier_id,
    product_id: r.product_id || undefined,
    opportunity_id: r.opportunity_id || undefined,
    contract_number: r.numero_contrato || r.contract_number || undefined,
    plano: r.plano || undefined,
    status: uiStatus,
    start_date: r.data_inicio_vigencia || new Date().toISOString().slice(0, 10),
    renewal_date: r.data_renovacao || undefined,
    data_vencimento_primeiro_pagamento: (r as any).data_vencimento_primeiro_pagamento || undefined,
    data_confirmacao_pagamento: (r as any).data_confirmacao_pagamento || undefined,
    usuario_confirmou_pagamento_id: (r as any).usuario_confirmou_pagamento_id || undefined,
    usuario_implantacao_id: (r as any).usuario_implantacao_id || undefined,
    primeira_competencia: (r as any).primeira_competencia || undefined,
    first_installment_reference: (r as any).primeira_competencia || undefined,
    sale_value: val,
    commission_value: undefined,
    lives_count: r.qtd_vidas || undefined,
    notes: r.observacoes || undefined,
    assigned_to: r.responsavel_id || undefined,
    created: r.created_at || new Date().toISOString(),
    updated: r.updated_at || new Date().toISOString(),
  }

  c.expand = {}
  if (r.companies) {
    c.expand.company_id = {
      id: r.companies.id,
      trade_name: r.companies.nome_fantasia || r.companies.trade_name || 'Empresa',
      legal_name: r.companies.razao_social || r.companies.legal_name || undefined,
      cnpj: r.companies.cnpj || undefined,
      city: r.companies.cidade || undefined,
      state: r.companies.estado || undefined,
    } as Company
  }
  if (r.contacts) {
    c.expand.contact_id = {
      id: r.contacts.id,
      company_id: r.company_id || '',
      name: r.contacts.nome || r.contacts.name || 'Contato',
      phone: r.contacts.celular || r.contacts.phone || '',
      email: r.contacts.email || undefined,
    } as Contact
  }
  if (r.products) {
    c.expand.product_id = {
      id: r.products.id,
      name: r.products.nome,
      category: (r.products.categoria || 'SAUDE') as any,
      active: true,
    } as Product
  }
  if (r.carriers) {
    c.expand.carrier_id = {
      id: r.carriers.id,
      nome: r.carriers.nome,
      nome_curto: r.carriers.nome_curto || undefined,
      ativo: true,
    } as Carrier
  }
  if (r.profiles) {
    c.expand.assigned_to = {
      id: r.profiles.id,
      name: r.profiles.nome,
      email: r.profiles.email,
      role: 'vendedor',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    } as User
  }

  return c
}

export const contractService = {
  async getContracts(options: ContractFilterOptions = {}) {
    if (!isSupabaseConfigured) {
      return { items: [] as Contract[], totalItems: 0, totalPages: 0, page: 1, perPage: 50 }
    }

    const page = options.page || 1
    const perPage = options.perPage || 50
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    try {
      let query = supabase.from('contracts').select(SELECT_EXPAND, { count: 'exact' })

      if (options.companyId) {
        query = query.eq('company_id', options.companyId)
      }
      if (options.opportunity_id) {
        query = query.eq('opportunity_id', options.opportunity_id)
      }
      if (options.status) {
        query = query.eq('status', options.status)
      }
      if (options.search) {
        const s = options.search.trim()
        query = query.ilike('numero_contrato', `%${s}%`)
      }

      query = query.order('created_at', { ascending: false }).range(from, to)

      const { data, count, error } = await query
      if (error) {
        console.warn('Erro ao consultar contratos do Supabase:', error.message)
        return { items: [] as Contract[], totalItems: 0, totalPages: 0, page, perPage }
      }

      const totalItems = count || 0
      const totalPages = Math.ceil(totalItems / perPage)
      const items = ((data || []) as unknown as ContractDbRow[]).map(mapContractRow)

      return { items, totalItems, totalPages, page, perPage }
    } catch {
      return { items: [] as Contract[], totalItems: 0, totalPages: 0, page, perPage }
    }
  },

  async getAllContracts(): Promise<Contract[]> {
    if (!isSupabaseConfigured) return []

    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(SELECT_EXPAND)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Erro ao listar contratos:', error.message)
        return []
      }
      return ((data || []) as unknown as ContractDbRow[]).map(mapContractRow)
    } catch {
      return []
    }
  },

  async getContractById(id: string): Promise<Contract> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data, error } = await supabase
      .from('contracts')
      .select(SELECT_EXPAND)
      .eq('id', id)
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Contrato não encontrado')
    }

    return mapContractRow(data as unknown as ContractDbRow)
  },

  async createContract(data: Partial<Contract>): Promise<Contract> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const assignedTo = data.assigned_to || currentUserId

    const statusMap: Record<string, string> = {
      Ativo: 'ativo',
      Cancelado: 'cancelado',
      'Em Implantação': 'em_implantacao',
      'Pendente Renovação': 'pendente_renovacao',
    }
    const dbStatus = (data.status && statusMap[data.status]) || 'em_implantacao'

    const insertPayload: Record<string, unknown> = {
      opportunity_id: data.opportunity_id || null,
      company_id: data.company_id || null,
      contact_id: data.contact_id || null,
      carrier_id: data.carrier_id!,
      product_id: data.product_id || null,
      plano: data.plano || null,
      numero_contrato: data.contract_number || null,
      status: dbStatus,
      data_inicio_vigencia: data.start_date || new Date().toISOString().split('T')[0],
      data_renovacao: data.renewal_date || null,
      valor_mensal: data.sale_value || 0,
      valor_venda: data.sale_value || 0,
      qtd_vidas: data.lives_count || 1,
      observacoes: data.notes || null,
      responsavel_id: assignedTo,
    }
    if (data.data_vencimento_primeiro_pagamento) {
      insertPayload.data_vencimento_primeiro_pagamento = data.data_vencimento_primeiro_pagamento
    }
    if (data.data_confirmacao_pagamento) {
      insertPayload.data_confirmacao_pagamento = data.data_confirmacao_pagamento
    }
    if (data.usuario_confirmou_pagamento_id) {
      insertPayload.usuario_confirmou_pagamento_id = data.usuario_confirmou_pagamento_id
    }
    if (data.usuario_implantacao_id) {
      insertPayload.usuario_implantacao_id = data.usuario_implantacao_id
    }
    if (data.primeira_competencia || data.first_installment_reference) {
      insertPayload.primeira_competencia =
        data.primeira_competencia || data.first_installment_reference
    }

    const { data: created, error } = await supabase
      .from('contracts')
      .insert(insertPayload)
      .select(SELECT_EXPAND)
      .single()

    if (error || !created) {
      throw new Error(error?.message || 'Falha ao criar contrato')
    }

    const mapped = mapContractRow(created as unknown as ContractDbRow)

    if (mapped.opportunity_id) {
      try {
        await supabase.from('opportunity_timeline').insert({
          opportunity_id: mapped.opportunity_id,
          action: 'STATUS_CHANGE',
          title: `Contrato Ativado (${mapped.contract_number || 'Sem número'})`,
          description: `Valor do produto: R$ ${mapped.sale_value.toLocaleString('pt-BR')} | Faturamento KKJ estimado: R$ ${(mapped.commission_value || 0).toLocaleString('pt-BR')}`,
          created_by: currentUserId,
        })
      } catch (tlErr) {
        console.warn('Erro ao registrar histórico do contrato na timeline:', tlErr)
      }
    }

    return mapped
  },

  async updateContract(id: string, data: Partial<Contract>): Promise<Contract> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (data.opportunity_id !== undefined) payload.opportunity_id = data.opportunity_id || null
    if (data.company_id !== undefined) payload.company_id = data.company_id
    if (data.contact_id !== undefined) payload.contact_id = data.contact_id || null
    if (data.carrier_id !== undefined) payload.carrier_id = data.carrier_id || null
    if (data.product_id !== undefined) payload.product_id = data.product_id || null
    if (data.plano !== undefined) payload.plano = data.plano || null
    if (data.contract_number !== undefined) payload.numero_contrato = data.contract_number || null
    if (data.status !== undefined) {
      const statusMap: Record<string, string> = {
        Ativo: 'ativo',
        Cancelado: 'cancelado',
        'Em Implantação': 'em_implantacao',
        'Pendente Renovação': 'pendente_renovacao',
      }
      payload.status = statusMap[data.status] || data.status
    }
    if (data.start_date !== undefined) payload.data_inicio_vigencia = data.start_date
    if (data.renewal_date !== undefined) payload.data_renovacao = data.renewal_date || null
    if (data.sale_value !== undefined) {
      payload.valor_mensal = data.sale_value
      payload.valor_venda = data.sale_value
    }
    if (data.lives_count !== undefined) payload.qtd_vidas = data.lives_count || null
    if (data.notes !== undefined) payload.observacoes = data.notes || null
    if (data.assigned_to !== undefined) payload.responsavel_id = data.assigned_to || null
    if (data.data_vencimento_primeiro_pagamento !== undefined) {
      payload.data_vencimento_primeiro_pagamento = data.data_vencimento_primeiro_pagamento || null
    }
    if (data.data_confirmacao_pagamento !== undefined) {
      payload.data_confirmacao_pagamento = data.data_confirmacao_pagamento || null
    }
    if (data.usuario_confirmou_pagamento_id !== undefined) {
      payload.usuario_confirmou_pagamento_id = data.usuario_confirmou_pagamento_id || null
    }
    if (data.usuario_implantacao_id !== undefined) {
      payload.usuario_implantacao_id = data.usuario_implantacao_id || null
    }
    if (data.primeira_competencia !== undefined || data.first_installment_reference !== undefined) {
      payload.primeira_competencia =
        data.primeira_competencia || data.first_installment_reference || null
    }

    const { data: updated, error } = await supabase
      .from('contracts')
      .update(payload)
      .eq('id', id)
      .select(SELECT_EXPAND)
      .single()

    if (error || !updated) {
      throw new Error(error?.message || 'Falha ao atualizar contrato')
    }

    return mapContractRow(updated as unknown as ContractDbRow)
  },

  async deleteContract(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false

    const { error } = await supabase.from('contracts').delete().eq('id', id)
    return !error
  },
}
