import type { Carrier } from '@/types/crm'

// Default seed carriers matching Supabase initial schema
const INITIAL_CARRIERS: Carrier[] = [
  {
    id: 'c1111111-1111-1111-1111-111111111111',
    nome: 'Amil',
    nome_curto: 'Amil',
    ativo: true,
    observacoes: 'Amil Assistência Médica Internacional',
  },
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    nome: 'Bradesco Saúde',
    nome_curto: 'Bradesco',
    ativo: true,
    observacoes: 'Bradesco Saúde e Odontoprev',
  },
  {
    id: 'c3333333-3333-3333-3333-333333333333',
    nome: 'SulAmérica',
    nome_curto: 'SulAmérica',
    ativo: true,
    observacoes: 'SulAmérica Saúde e Odonto',
  },
  {
    id: 'c4444444-4444-4444-4444-444444444444',
    nome: 'Porto Seguro',
    nome_curto: 'Porto',
    ativo: true,
    observacoes: 'Porto Seguro Saúde e Odontológico',
  },
  {
    id: 'c5555555-5555-5555-5555-555555555555',
    nome: 'Alice',
    nome_curto: 'Alice',
    ativo: true,
    observacoes: 'Alice Saúde Individual e Empresarial',
  },
  {
    id: 'c6666666-6666-6666-6666-666666666666',
    nome: 'Seguros Unimed',
    nome_curto: 'Unimed',
    ativo: true,
    observacoes: 'Seguros Unimed Saúde e Odonto',
  },
  {
    id: 'c7777777-7777-7777-7777-777777777777',
    nome: 'MedSênior',
    nome_curto: 'MedSênior',
    ativo: true,
    observacoes: 'MedSênior Medicina Preventiva e Sênior',
  },
  {
    id: 'c8888888-8888-8888-8888-888888888888',
    nome: 'UniHosp',
    nome_curto: 'UniHosp',
    ativo: true,
    observacoes: 'UniHosp Saúde Regional',
  },
]
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

export const carrierService = {
  async getAllCarriers(onlyActive: boolean = true): Promise<Carrier[]> {
    if (!isSupabaseConfigured) {
      return onlyActive ? INITIAL_CARRIERS.filter((c) => c.ativo) : INITIAL_CARRIERS
    }

    try {
      let query = supabase.from('carriers').select('*').order('nome', { ascending: true })

      if (onlyActive) {
        query = query.eq('ativo', true)
      }

      const { data, error } = await query
      if (error) {
        console.warn('Erro ao carregar operadoras do Supabase:', error.message)
        return onlyActive ? INITIAL_CARRIERS.filter((c) => c.ativo) : INITIAL_CARRIERS
      }

      if (!data || data.length === 0) {
        return onlyActive ? INITIAL_CARRIERS.filter((c) => c.ativo) : INITIAL_CARRIERS
      }

      return data as Carrier[]
    } catch {
      return onlyActive ? INITIAL_CARRIERS.filter((c) => c.ativo) : INITIAL_CARRIERS
    }
  },

  async createCarrier(data: Omit<Carrier, 'id' | 'created_at' | 'updated_at'>): Promise<Carrier> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase não configurado')
    }

    const { data: created, error } = await supabase
      .from('carriers')
      .insert({
        nome: data.nome,
        cnpj: data.cnpj || null,
        ans_registro: data.ans_registro || null,
        segmento_principal: data.segmento_principal,
        segmentos_atendidos: data.segmentos_atendidos || [],
        ativo: data.ativo ?? true,
        logo_url: data.logo_url || null,
        site: data.site || null,
        telefone_suporte: data.telefone_suporte || null,
        email_operacional: data.email_operacional || null,
        portal_corretor_url: data.portal_corretor_url || null,
      })
      .select('*')
      .single()

    if (error || !created) {
      throw new Error(error?.message || 'Falha ao cadastrar operadora')
    }

    return created as Carrier
  },

  async updateCarrier(
    id: string,
    data: Partial<Omit<Carrier, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Carrier> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase não configurado')
    }

    const { data: updated, error } = await supabase
      .from('carriers')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error || !updated) {
      throw new Error(error?.message || 'Falha ao atualizar operadora')
    }

    return updated as Carrier
  },

  async toggleCarrierStatus(id: string): Promise<Carrier> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase não configurado')
    }

    const { data: current, error: getErr } = await supabase
      .from('carriers')
      .select('ativo')
      .eq('id', id)
      .single()

    if (getErr || !current) {
      throw new Error(getErr?.message || 'Operadora não encontrada')
    }

    return this.updateCarrier(id, { ativo: !current.ativo })
  },
}
