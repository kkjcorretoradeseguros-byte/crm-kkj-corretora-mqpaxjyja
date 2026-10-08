import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { Contact, Company } from '@/types/crm'

export interface ContactFilterOptions {
  page?: number
  perPage?: number
  search?: string
  companyId?: string
}

interface ContactRow {
  id: string
  company_id?: string | null
  name: string
  email?: string | null
  phone?: string | null
  position?: string | null
  is_primary?: boolean
  notes?: string | null
  created_by?: string | null
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
}

function mapContactRow(r: ContactRow): Contact {
  const c: Contact = {
    id: r.id,
    company_id: r.company_id || '',
    name: r.name,
    email: r.email || undefined,
    phone: r.phone || undefined,
    position: r.position || undefined,
    is_primary: r.is_primary ?? false,
    notes: r.notes || undefined,
    created_by: r.created_by || undefined,
    created: r.created_at || new Date().toISOString(),
    updated: r.updated_at || new Date().toISOString(),
  }

  if (r.companies) {
    c.expand = {
      company_id: {
        id: r.companies.id,
        trade_name: r.companies.trade_name,
        legal_name: r.companies.legal_name || undefined,
        cnpj: r.companies.cnpj || undefined,
        city: r.companies.city || undefined,
        state: r.companies.state || undefined,
        phone: r.companies.phone || undefined,
        email: r.companies.email || undefined,
      } as Company,
    }
  }

  return c
}

export const contactService = {
  async getContacts(options: ContactFilterOptions = {}) {
    if (!isSupabaseConfigured) {
      return { items: [] as Contact[], totalItems: 0, totalPages: 0, page: 1, perPage: 50 }
    }

    const page = options.page || 1
    const perPage = options.perPage || 50
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    try {
      let query = supabase
        .from('contacts')
        .select(
          '*, companies:company_id(id, trade_name, legal_name, cnpj, city, state, phone, email)',
          { count: 'exact' },
        )

      if (options.search) {
        const s = options.search.trim()
        query = query.or(
          `name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,position.ilike.%${s}%`,
        )
      }
      if (options.companyId) {
        query = query.eq('company_id', options.companyId)
      }

      query = query.order('name', { ascending: true }).range(from, to)

      const { data, count, error } = await query
      if (error) {
        console.warn('Erro ao carregar contatos do Supabase:', error.message)
        return { items: [] as Contact[], totalItems: 0, totalPages: 0, page, perPage }
      }

      const totalItems = count || 0
      const totalPages = Math.ceil(totalItems / perPage)
      const items = ((data || []) as unknown as ContactRow[]).map(mapContactRow)

      return { items, totalItems, totalPages, page, perPage }
    } catch {
      return { items: [] as Contact[], totalItems: 0, totalPages: 0, page, perPage }
    }
  },

  async getAllContacts(): Promise<Contact[]> {
    if (!isSupabaseConfigured) return []

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(
          '*, companies:company_id(id, trade_name, legal_name, cnpj, city, state, phone, email)',
        )
        .order('name', { ascending: true })

      if (error) {
        console.warn('Erro ao carregar lista completa de contatos:', error.message)
        return []
      }
      return ((data || []) as unknown as ContactRow[]).map(mapContactRow)
    } catch {
      return []
    }
  },

  async getContactById(id: string): Promise<Contact> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data, error } = await supabase
      .from('contacts')
      .select(
        '*, companies:company_id(id, trade_name, legal_name, cnpj, city, state, phone, email)',
      )
      .eq('id', id)
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Contato não encontrado')
    }

    return mapContactRow(data as unknown as ContactRow)
  },

  async createContact(data: Partial<Contact>): Promise<Contact> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const { data: created, error } = await supabase
      .from('contacts')
      .insert({
        company_id: data.company_id || null,
        name: data.name || '',
        email: data.email || null,
        phone: data.phone || null,
        position: data.position || null,
        is_primary: data.is_primary ?? false,
        notes: data.notes || null,
        created_by: currentUserId,
      })
      .select(
        '*, companies:company_id(id, trade_name, legal_name, cnpj, city, state, phone, email)',
      )
      .single()

    if (error || !created) {
      throw new Error(error?.message || 'Falha ao criar contato')
    }

    return mapContactRow(created as unknown as ContactRow)
  },

  async updateContact(id: string, data: Partial<Contact>): Promise<Contact> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (data.company_id !== undefined) payload.company_id = data.company_id || null
    if (data.name !== undefined) payload.name = data.name
    if (data.email !== undefined) payload.email = data.email
    if (data.phone !== undefined) payload.phone = data.phone
    if (data.position !== undefined) payload.position = data.position
    if (data.is_primary !== undefined) payload.is_primary = data.is_primary
    if (data.notes !== undefined) payload.notes = data.notes

    const { data: updated, error } = await supabase
      .from('contacts')
      .update(payload)
      .eq('id', id)
      .select(
        '*, companies:company_id(id, trade_name, legal_name, cnpj, city, state, phone, email)',
      )
      .single()

    if (error || !updated) {
      throw new Error(error?.message || 'Falha ao atualizar contato')
    }

    return mapContactRow(updated as unknown as ContactRow)
  },

  async deleteContact(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false

    const { error } = await supabase.from('contacts').delete().eq('id', id)
    return !error
  },
}
