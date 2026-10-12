import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

export interface SystemSettingHistoryItem {
  id: string
  key: string
  previous_value: any
  new_value: any
  changed_by?: string | null
  reason?: string | null
  created_at: string
}

export const systemSettingsService = {
  /**
   * Obtém a alíquota de imposto padrão da corretora (em percentual: ex 11 para 11%).
   * Fallback seguro: 11.00.
   */
  async getDefaultTaxRate(): Promise<number> {
    if (!isSupabaseConfigured) return 11.0

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'aliquota_imposto_padrao')
        .maybeSingle()

      if (error) {
        console.warn('Erro ao carregar aliquota_imposto_padrao:', error.message)
        return 11.0
      }

      if (!data || data.value === null || data.value === undefined) {
        return 11.0
      }

      const num = typeof data.value === 'number' ? data.value : parseFloat(data.value)
      return isNaN(num) ? 11.0 : num
    } catch {
      return 11.0
    }
  },

  /**
   * Atualiza a alíquota de imposto padrão da corretora (0 a 100).
   * Somente administradores (reforçado por RLS no banco).
   */
  async updateDefaultTaxRate(rate: number, reason?: string): Promise<number> {
    if (typeof rate !== 'number' || isNaN(rate) || rate < 0 || rate > 100) {
      throw new Error('A alíquota de imposto deve ser um valor numérico entre 0 e 100.')
    }

    if (!isSupabaseConfigured) {
      return rate
    }

    const { error } = await supabase.from('system_settings').upsert({
      key: 'aliquota_imposto_padrao',
      value: rate,
      description: 'Alíquota de imposto/retenção padrão da KKJ em percentual (11.00%)',
      updated_at: new Date().toISOString(),
    })

    if (error) {
      throw new Error(error.message || 'Falha ao atualizar a alíquota padrão de imposto')
    }

    return rate
  },

  /**
   * Obtém o histórico de alterações da alíquota de imposto.
   */
  async getTaxHistory(): Promise<SystemSettingHistoryItem[]> {
    if (!isSupabaseConfigured) return []

    try {
      const { data, error } = await supabase
        .from('system_settings_history')
        .select('*')
        .eq('key', 'aliquota_imposto_padrao')
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Erro ao carregar histórico de imposto:', error.message)
        return []
      }

      return (data || []) as SystemSettingHistoryItem[]
    } catch {
      return []
    }
  },
}
