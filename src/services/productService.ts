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
    id: 'none',
    name: 'Nenhum / A definir',
    category: 'Outros' as ProductCategory,
    modalidade: 'A definir',
  },
  {
    id: 'saude-pme',
    name: 'Saúde PME',
    category: 'Saúde PME' as ProductCategory,
    modalidade: 'PME Saúde',
  },
  {
    id: 'saude-pf',
    name: 'Saúde PF',
    category: 'Saúde PF' as ProductCategory,
    modalidade: 'PF Saúde',
  },
  {
    id: 'adesao',
    name: 'Adesão',
    category: 'Adesão' as ProductCategory,
    modalidade: 'Adesão Saúde',
  },
  {
    id: 'odontologico',
    name: 'Odontológico',
    category: 'Odontológico' as ProductCategory,
    modalidade: 'PF odonto / PME odonto',
  },
  {
    id: 'consorcio',
    name: 'Consórcio',
    category: 'Consórcio' as ProductCategory,
    modalidade: 'Consórcio',
  },
  {
    id: 'seguro-vida',
    name: 'Seguro de Vida',
    category: 'Seguro de Vida' as ProductCategory,
    modalidade: 'Vida',
  },
  {
    id: 'seguro-auto',
    name: 'Seguro Auto',
    category: 'Seguro Auto' as ProductCategory,
    modalidade: 'Auto',
  },
  {
    id: 'outros',
    name: 'Outros',
    category: 'Outros' as ProductCategory,
    modalidade: 'Outros',
  },
]

export function formatSimplifiedProductName(rawName?: string | null): string {
  if (!rawName) return 'Nenhum / A definir'
  const trimmed = rawName.trim()
  // Remove qualquer sufixo ou menção a (SAUDE), (SAÚDE), (ODONTO), etc.
  const cleaned = trimmed
    .replace(
      /\s*\((SAUDE|SAÚDE|ODONTO|BENEFICIOS|BENEFÍCIOS|VIDA|AUTO|CONSORCIO|CONSÓRCIO)\)/gi,
      '',
    )
    .trim()

  const lower = cleaned.toLowerCase()
  if (
    lower === 'nenhum' ||
    lower === 'a definir' ||
    lower === 'nenhum / a definir' ||
    lower === 'sem produto'
  )
    return 'Nenhum / A definir'
  if (
    lower.includes('saúde pme') ||
    lower.includes('saude pme') ||
    lower === 'pme saúde' ||
    lower === 'pme saude'
  )
    return 'Saúde PME'
  if (
    lower.includes('saúde pf') ||
    lower.includes('saude pf') ||
    lower === 'pf saúde' ||
    lower === 'pf saude' ||
    lower === 'individual / familiar' ||
    lower === 'individual'
  )
    return 'Saúde PF'
  if (
    lower.includes('adesão') ||
    lower.includes('adesao') ||
    lower === 'adesão saúde' ||
    lower === 'adesao saude'
  )
    return 'Adesão'
  if (lower.includes('odonto') || lower.includes('odontológico') || lower.includes('odontologico'))
    return 'Odontológico'
  if (lower.includes('consórcio') || lower.includes('consorcio')) return 'Consórcio'
  if (lower.includes('vida')) return 'Seguro de Vida'
  if (lower.includes('auto')) return 'Seguro Auto'
  return cleaned || 'Outros'
}

export const productService = {
  async getAllProducts(onlyActive = true): Promise<Product[]> {
    const defaultSelectable = KKJ_SIMPLIFIED_PRODUCT_OPTIONS.filter((opt) => opt.id !== 'none').map(
      (opt) => ({
        id: opt.id,
        name: opt.name,
        category: opt.category,
        active: true,
      }),
    )

    if (!isSupabaseConfigured) {
      return defaultSelectable
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
        return defaultSelectable
      }

      const mapped = ((data || []) as ProductRow[]).map(mapProductRow)
      // Normalizar os nomes conforme o Menu de Produtos Simplificado do item 9
      return mapped.map((p) => ({
        ...p,
        name: formatSimplifiedProductName(p.name),
      }))
    } catch {
      return defaultSelectable
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
