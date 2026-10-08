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
  status?: ContractStatus
  search?: string
}

interface ContractDbRow {
  id: string
  opportunity_id?: string | null
  company_id: string
  contact_id?: string | null
  carrier_id?: string | null
  product_id?: string | null
  contract_number?: string | null
  status: ContractStatus
  start_date: string
  end_date?: string | null
  renewal_date?: string | null
  sale_value: number
  commission_value?: number | null
  lives_count?: number | null
  billing_day?: number | null
  notes?: string | null
  assigned_to?: string | null
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

const SELECT_EXPAND = `
  id,
  opportunity_id,
  company_id,
  contact_id,
  carrier_id,
  product_id,
  contract_number,
  status,
  start_date,
  end_date,
  renewal_date,
  sale_value,
  commission_value,
  lives_count,
  billing_day,
  notes,
  assigned_to,
  created_at,
  updated_at,
  companies:company_id(id, trade_name, legal_name, cnpj, city, state, phone, email),
  contacts:contact_id(id, name, phone, email, position),
  products:product_id(id, nome, segmento),
  carriers:carrier_id(id, nome),
  profiles:assigned_to(id, nome, email)
`

function mapContractRow(r: ContractDbRow): Contract {
  const c: Contract = {
    id: r.id,
    company_id: r.company_id,
    contact_id: r.contact_id || undefined,
    carrier_id: r.carrier_id || undefined,
    product_id: r.product_id || undefined,
    opportunity_id: r.opportunity_id || undefined,
    contract_number: r.contract_number || undefined,
    status: r.status,
    start_date: r.start_date,
    end_date: r.end_date || undefined,
    renewal_date: r.renewal_date || undefined,
    sale_value: Number(r.sale_value || 0),
    commission_value:
      r.commission_value !== null && r.commission_value !== undefined
        ? Number(r.commission_value)
        : undefined,
    lives_count: r.lives_count || undefined,
    billing_day: r.billing_day || undefined,
    notes: r.notes || undefined,
    assigned_to: r.assigned_to || undefined,
    created: r.created_at || new Date().toISOString(),
    updated: r.updated_at || new Date().toISOString(),
  }

  c.expand = {}
  if (r.companies) {
    c.expand.company_id = {
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
    c.expand.contact_id = {
      id: r.contacts.id,
      company_id: r.company_id,
      name: r.contacts.name,
      phone: r.contacts.phone || undefined,
      email: r.contacts.email || undefined,
      position: r.contacts.position || undefined,
    } as Contact
  }
  if (r.products) {
    c.expand.product_id = {
      id: r.products.id,
      name: r.products.nome,
      category: (r.products.segmento as unknown) || 'SAUDE',
      active: true,
    } as Product
  }
  if (r.carriers) {
    c.expand.carrier_id = {
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
      if (options.status) {
        query = query.eq('status', options.status)
      }
      if (options.search) {
        const s = options.search.trim()
        query = query.ilike('contract_number', `%${s}%`)
      }

      query = query.order('start_date', { ascending: false }).range(from, to)

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
        .order('start_date', { ascending: false })

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

    const { data: created, error } = await supabase
      .from('contracts')
      .insert({
        opportunity_id: data.opportunity_id || null,
        company_id: data.company_id!,
        contact_id: data.contact_id || null,
        carrier_id: data.carrier_id || null,
        product_id: data.product_id || null,
        contract_number: data.contract_number || null,
        status: data.status || 'ATIVO',
        start_date: data.start_date || new Date().toISOString().split('T')[0],
        end_date: data.end_date || null,
        renewal_date: data.renewal_date || null,
        sale_value: data.sale_value || 0,
        commission_value: data.commission_value || 0,
        lives_count: data.lives_count || null,
        billing_day: data.billing_day || null,
        notes: data.notes || null,
        assigned_to: assignedTo,
      })
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
    if (data.contract_number !== undefined) payload.contract_number = data.contract_number || null
    if (data.status !== undefined) payload.status = data.status
    if (data.start_date !== undefined) payload.start_date = data.start_date
    if (data.end_date !== undefined) payload.end_date = data.end_date || null
    if (data.renewal_date !== undefined) payload.renewal_date = data.renewal_date || null
    if (data.sale_value !== undefined) payload.sale_value = data.sale_value
    if (data.commission_value !== undefined) payload.commission_value = data.commission_value
    if (data.lives_count !== undefined) payload.lives_count = data.lives_count || null
    if (data.billing_day !== undefined) payload.billing_day = data.billing_day || null
    if (data.notes !== undefined) payload.notes = data.notes || null
    if (data.assigned_to !== undefined) payload.assigned_to = data.assigned_to || null

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
