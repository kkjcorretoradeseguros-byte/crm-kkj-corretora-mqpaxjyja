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
const LOCAL_STORAGE_KEY = 'kkj_carriers_cache'

export const carrierService = {
  async getAllCarriers(onlyActive = true): Promise<Carrier[]> {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      let list: Carrier[] = stored ? JSON.parse(stored) : INITIAL_CARRIERS
      if (!stored) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_CARRIERS))
      }
      if (onlyActive) {
        list = list.filter((c) => c.ativo)
      }
      return list
    } catch {
      return onlyActive ? INITIAL_CARRIERS.filter((c) => c.ativo) : INITIAL_CARRIERS
    }
  },

  async createCarrier(data: Omit<Carrier, 'id' | 'created_at' | 'updated_at'>): Promise<Carrier> {
    const list = await this.getAllCarriers(false)
    const newCarrier: Carrier = {
      ...data,
      id: `carrier-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const updated = [...list, newCarrier]
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
    return newCarrier
  },

  async updateCarrier(id: string, data: Partial<Carrier>): Promise<Carrier> {
    const list = await this.getAllCarriers(false)
    const index = list.findIndex((c) => c.id === id)
    if (index === -1) throw new Error('Operadora não encontrada')
    const updatedCarrier = {
      ...list[index],
      ...data,
      updated_at: new Date().toISOString(),
    }
    list[index] = updatedCarrier
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list))
    return updatedCarrier
  },

  async toggleCarrier(id: string): Promise<Carrier> {
    const list = await this.getAllCarriers(false)
    const item = list.find((c) => c.id === id)
    if (!item) throw new Error('Operadora não encontrada')
    return this.updateCarrier(id, { ativo: !item.ativo })
  },
}
