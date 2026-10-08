import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { Company } from '@/types/crm'

export interface CompanyFilterOptions {
  page?: number
  perPage?: number
  search?: string
  city?: string
  state?: string
}

interface CompanyRow {
  id: string
  trade_name: string
  legal_name?: string | null
  cnpj?: string | null
  city?: string | null
  state?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

function mapCompanyRow(r: CompanyRow): Company {
  return {
    id: r.id,
    trade_name: r.trade_name,
    legal_name: r.legal_name || undefined,
    cnpj: r.cnpj || undefined,
    city: r.city || undefined,
    state: r.state || undefined,
    phone: r.phone || undefined,
    email: r.email || undefined,
    address: r.address || undefined,
    notes: r.notes || undefined,
    created_by: r.created_by || undefined,
    created: r.created_at || new Date().toISOString(),
    updated: r.updated_at || new Date().toISOString(),
  }
}

export const companyService = {
  async getCompanies(options: CompanyFilterOptions = {}) {
    if (!isSupabaseConfigured) {
      return { items: [] as Company[], totalItems: 0, totalPages: 0, page: 1, perPage: 50 }
    }

    const page = options.page || 1
    const perPage = options.perPage || 50
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    try {
      let query = supabase.from('companies').select('*', { count: 'exact' })

      if (options.search) {
        const s = options.search.trim()
        query = query.or(
          `trade_name.ilike.%${s}%,legal_name.ilike.%${s}%,cnpj.ilike.%${s}%,city.ilike.%${s}%`,
        )
      }
      if (options.city) {
        query = query.eq('city', options.city)
      }
      if (options.state) {
        query = query.eq('state', options.state)
      }

      query = query.order('created_at', { ascending: false }).range(from, to)

      const { data, count, error } = await query
      if (error) {
        console.warn('Erro ao consultar empresas no Supabase:', error.message)
        return { items: [] as Company[], totalItems: 0, totalPages: 0, page, perPage }
      }

      const totalItems = count || 0
      const totalPages = Math.ceil(totalItems / perPage)
      const items = ((data || []) as CompanyRow[]).map(mapCompanyRow)

      return { items, totalItems, totalPages, page, perPage }
    } catch {
      return { items: [] as Company[], totalItems: 0, totalPages: 0, page, perPage }
    }
  },

  async getAllCompanies(): Promise<Company[]> {
    if (!isSupabaseConfigured) return []

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('trade_name', { ascending: true })

      if (error) {
        console.warn('Erro ao listar todas empresas:', error.message)
        return []
      }
      return ((data || []) as CompanyRow[]).map(mapCompanyRow)
    } catch {
      return []
    }
  },

  async getCompanyById(id: string): Promise<Company> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data, error } = await supabase.from('companies').select('*').eq('id', id).single()

    if (error || !data) {
      throw new Error(error?.message || 'Empresa não encontrada')
    }

    return mapCompanyRow(data as CompanyRow)
  },

  async createCompany(data: Partial<Company>): Promise<Company> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const { data: created, error } = await supabase
      .from('companies')
      .insert({
        trade_name: data.trade_name || '',
        legal_name: data.legal_name || null,
        cnpj: data.cnpj || null,
        city: data.city || null,
        state: data.state || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
        created_by: currentUserId,
      })
      .select('*')
      .single()

    if (error || !created) {
      throw new Error(error?.message || 'Falha ao cadastrar empresa')
    }

    return mapCompanyRow(created as CompanyRow)
  },

  async updateCompany(id: string, data: Partial<Company>): Promise<Company> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (data.trade_name !== undefined) payload.trade_name = data.trade_name
    if (data.legal_name !== undefined) payload.legal_name = data.legal_name
    if (data.cnpj !== undefined) payload.cnpj = data.cnpj
    if (data.city !== undefined) payload.city = data.city
    if (data.state !== undefined) payload.state = data.state
    if (data.phone !== undefined) payload.phone = data.phone
    if (data.email !== undefined) payload.email = data.email
    if (data.address !== undefined) payload.address = data.address
    if (data.notes !== undefined) payload.notes = data.notes

    const { data: updated, error } = await supabase
      .from('companies')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error || !updated) {
      throw new Error(error?.message || 'Falha ao atualizar empresa')
    }

    return mapCompanyRow(updated as CompanyRow)
  },

  async deleteCompany(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false

    const { error } = await supabase.from('companies').delete().eq('id', id)
    return !error
  },
}
