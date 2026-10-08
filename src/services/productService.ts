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

export const productService = {
  async getAllProducts(onlyActive = true): Promise<Product[]> {
    if (!isSupabaseConfigured) return []

    try {
      let query = supabase.from('products').select('*').order('nome', { ascending: true })

      if (onlyActive) {
        query = query.eq('ativo', true)
      }

      const { data, error } = await query
      if (error) {
        console.warn('Erro ao carregar produtos do Supabase:', error.message)
        return []
      }
      return ((data || []) as ProductRow[]).map(mapProductRow)
    } catch {
      return []
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
