import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { Product, ProductCategory } from '@/types/crm'

interface ProductRow {
  id: string
  carrier_id?: string | null
  nome: string
  codigo?: string | null
  segmento: ProductCategory
  ativo: boolean
  descricao?: string | null
  created_at?: string
  updated_at?: string
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.nome,
    category: row.segmento || 'SAUDE',
    active: row.ativo ?? true,
    description: row.descricao || undefined,
    created: row.created_at,
    updated: row.updated_at,
  }
}

// Lista canônica oficial KKJ dos produtos simplificados do CRM (Item 9 da especificação)
export const KKJ_SIMPLIFIED_PRODUCT_OPTIONS = [
  {
    id: 'saude-pme',
    name: 'Saúde PME',
    category: 'SAUDE' as ProductCategory,
    modalidade: 'PME Saúde',
  },
  {
    id: 'saude-pf',
    name: 'Saúde PF',
    category: 'SAUDE' as ProductCategory,
    modalidade: 'PF Saúde',
  },
  {
    id: 'adesao',
    name: 'Adesão',
    category: 'SAUDE' as ProductCategory,
    modalidade: 'Adesão Saúde',
  },
  {
    id: 'odontologico',
    name: 'Odontológico',
    category: 'ODONTO' as ProductCategory,
    modalidade: 'Odonto PME/PF',
  },
  {
    id: 'consorcio',
    name: 'Consórcio',
    category: 'CONSORCIO' as ProductCategory,
    modalidade: 'Consórcio',
  },
  {
    id: 'seguro-vida',
    name: 'Seguro de Vida',
    category: 'VIDA' as ProductCategory,
    modalidade: 'Vida',
  },
  {
    id: 'seguro-auto',
    name: 'Seguro Auto',
    category: 'AUTO' as ProductCategory,
    modalidade: 'Auto',
  },
  { id: 'outros', name: 'Outros', category: 'OUTROS' as ProductCategory, modalidade: 'Outros' },
]

export function formatSimplifiedProductName(rawName?: string | null): string {
  if (!rawName) return 'Nenhum / A definir'
  const trimmed = rawName.trim()
  // Remove sufixos como (SAUDE), (ODONTO), etc.
  const cleaned = trimmed
    .replace(/\s*\((SAUDE|ODONTO|BENEFICIOS|VIDA|AUTO|CONSORCIO)\)/gi, '')
    .trim()

  const lower = cleaned.toLowerCase()
  if (lower.includes('saúde pme') || lower.includes('saude pme') || lower === 'pme saúde')
    return 'Saúde PME'
  if (
    lower.includes('saúde pf') ||
    lower.includes('saude pf') ||
    lower === 'pf saúde' ||
    lower === 'individual / familiar'
  )
    return 'Saúde PF'
  if (lower.includes('adesão') || lower.includes('adesao') || lower === 'adesão saúde')
    return 'Adesão'
  if (lower.includes('odonto') || lower.includes('odontológico') || lower.includes('odontologico'))
    return 'Odontológico'
  if (lower.includes('consórcio') || lower.includes('consorcio')) return 'Consórcio'
  if (lower.includes('vida')) return 'Seguro de Vida'
  if (lower.includes('auto')) return 'Seguro Auto'
  if (lower === 'nenhum' || lower === 'a definir' || lower === 'nenhum / a definir')
    return 'Nenhum / A definir'
  return cleaned || 'Outros'
}

export const productService = {
  async getAllProducts(onlyActive = true): Promise<Product[]> {
    if (!isSupabaseConfigured) {
      return KKJ_SIMPLIFIED_PRODUCT_OPTIONS.map((opt) => ({
        id: opt.id,
        name: opt.name,
        category: opt.category,
        active: true,
      }))
    }

    try {
      let query = supabase.from('products').select('*').order('nome', { ascending: true })

      if (onlyActive) {
        query = query.eq('ativo', true)
      }

      const { data, error } = await query
      if (error || !data || data.length === 0) {
        if (error) {
          console.warn(
            'Erro ao carregar produtos do Supabase, usando padrão simplificado KKJ:',
            error.message,
          )
        }
        return KKJ_SIMPLIFIED_PRODUCT_OPTIONS.map((opt) => ({
          id: opt.id,
          name: opt.name,
          category: opt.category,
          active: true,
        }))
      }

      const mapped = ((data || []) as ProductRow[]).map(mapProductRow)
      // Normalizar os nomes conforme o Menu de Produtos Simplificado do item 9
      return mapped.map((p) => ({
        ...p,
        name: formatSimplifiedProductName(p.name),
      }))
    } catch {
      return KKJ_SIMPLIFIED_PRODUCT_OPTIONS.map((opt) => ({
        id: opt.id,
        name: opt.name,
        category: opt.category,
        active: true,
      }))
    }
  },

  async getProductById(id: string): Promise<Product> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data, error } = await supabase.from('products').select('*').eq('id', id).single()

    if (error || !data) {
      throw new Error(error?.message || 'Produto não encontrado')
    }

    return mapProductRow(data as ProductRow)
  },

  async createProduct(data: Partial<Product>): Promise<Product> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: created, error } = await supabase
      .from('products')
      .insert({
        nome: data.name || '',
        segmento: (data.category as ProductCategory) || 'SAUDE',
        ativo: data.active ?? true,
        descricao: data.description || null,
      })
      .select('*')
      .single()

    if (error || !created) {
      throw new Error(error?.message || 'Falha ao criar produto')
    }

    return mapProductRow(created as ProductRow)
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (data.name !== undefined) updatePayload.nome = data.name
    if (data.category !== undefined) updatePayload.segmento = data.category
    if (data.active !== undefined) updatePayload.ativo = data.active
    if (data.description !== undefined) updatePayload.descricao = data.description

    const { data: updated, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    if (error || !updated) {
      throw new Error(error?.message || 'Falha ao atualizar produto')
    }

    return mapProductRow(updated as ProductRow)
  },

  async deleteProduct(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false

    const { error } = await supabase.from('products').delete().eq('id', id)
    return !error
  },
}
