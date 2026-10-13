import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

export interface CommissionRuleInstallmentItem {
  month: number
  pct: number
}

export interface CommissionRule {
  id: string
  nome: string
  code?: string | null
  carrier_id?: string | null
  product_id?: string | null
  modalidade?: string | null
  contract_type?: string | null
  tipo_regra?: string
  percentual_base?: number | null
  valor_fixo?: number | null
  multiplo_mensalidade?: number | null
  total_comissao_pct?: number | null
  total_parcelas?: number
  cronograma_parcelas: CommissionRuleInstallmentItem[]
  has_recurring: boolean
  recurring_percentage?: number | null
  recurring_start_month?: number | null
  min_lives?: number | null
  max_lives?: number | null
  repasse_vendedor_pct?: number | null
  repasse_vendedor_proprio_pct?: number | null
  aliquota_imposto_pct?: number | null
  data_inicio_vigencia: string
  data_fim_vigencia?: string | null
  ativo: boolean
  observacoes?: string | null
  created_at?: string
  updated_at?: string
  carriers?: {
    id: string
    nome: string
  } | null
  products?: {
    id: string
    nome: string
  } | null
}

export interface CommissionRuleHistoryItem {
  id: string
  rule_id: string
  changed_by?: string | null
  action: string
  previous_state?: any
  new_state?: any
  created_at: string
}

export interface SellerSplitSettings {
  lead_proprio_pct: number
  kkj_pme_pct: number
  kkj_adesao_pct: number
  kkj_pf_pct: number
  consorcio_pct: number
  vida_pct: number
  auto_pct: number
  outros_pct: number
}

export const DEFAULT_SELLER_SPLITS: SellerSplitSettings = {
  lead_proprio_pct: 100, // Próprio/Indicação do vendedor: 100% da comissão líquida
  kkj_pme_pct: 50, // KKJ-PME: 50%
  kkj_adesao_pct: 30, // KKJ-Adesão: 30% da comissão líquida, conforme PF
  kkj_pf_pct: 30, // KKJ-PF: 30%
  consorcio_pct: 50, // Consórcio configurável (não presume PME/PF)
  vida_pct: 50, // Seguro de Vida configurável (não presume PME/PF)
  auto_pct: 50, // Seguro Auto configurável (não presume PME/PF)
  outros_pct: 50, // Outros
}

export async function getApplicableCommissionRule(params: {
  carrierId: string
  productId?: string | null
  modality?: string | null
  livesCount?: number | null
}): Promise<CommissionRule> {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
  if (!params.carrierId?.trim()) throw new Error('Operadora não informada')
  const { data, error } = await supabase
    .from('commission_rules')
    .select('*')
    .eq('ativo', true)
    .eq('carrier_id', params.carrierId)
  if (error) throw new Error('Erro ao consultar regras: ' + error.message)
  const today = new Date().toISOString().slice(0, 10)
  if (params.livesCount != null && (!Number.isInteger(params.livesCount) || params.livesCount < 1)) throw new Error('Quantidade de vidas inválida')
  const candidates = (data ?? []).filter(rule => {
    if (rule.product_id && rule.product_id !== params.productId) return false
    if (rule.contract_type && rule.contract_type.toLowerCase() !== params.modality?.toLowerCase()) return false
    if (!params.modality || !rule.modalidade || rule.modalidade.toLowerCase() !== params.modality.toLowerCase()) return false
    if (rule.data_inicio_vigencia && rule.data_inicio_vigencia > today) return false
    if (rule.data_fim_vigencia && rule.data_fim_vigencia < today) return false
    if (rule.min_lives != null && params.livesCount == null) return false
    if (rule.max_lives != null && params.livesCount == null) return false
    if (params.livesCount != null && (params.livesCount < (rule.min_lives ?? 0) || params.livesCount > (rule.max_lives ?? Infinity))) return false
    return true
  })
  if (candidates.length !== 1) {
    throw new Error(candidates.length === 0
      ? 'Nenhuma regra comercial aplicável à operadora e ao produto'
      : 'Há mais de uma regra comercial aplicável; revise as regras antes de calcular')
  }
  return candidates[0] as CommissionRule
}

export const commissionRuleService = {
  /**
   * Lista todas as regras de comissão do banco Supabase
   */
  async getRules(onlyActive = false): Promise<CommissionRule[]> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    try {
      let query = supabase
        .from('commission_rules')
        .select(`
          *,
          carriers:carrier_id(id, nome),
          products:product_id(id, nome)
        `)
        .order('nome', { ascending: true })

      if (onlyActive) {
        query = query.eq('ativo', true)
      }

      const { data, error } = await query
      if (error) {
        throw new Error('Erro ao carregar regras de comissão: ' + error.message)
      }

      return (data || []).map((r: any) => ({
        ...r,
        cronograma_parcelas: Array.isArray(r.cronograma_parcelas)
          ? r.cronograma_parcelas
          : typeof r.cronograma_parcelas === 'string'
            ? JSON.parse(r.cronograma_parcelas)
            : [],
      }))
    } catch (error) {
      throw error instanceof Error ? error : new Error('Falha inesperada ao carregar regras de comissão')
    }
  },

  /**
   * Cria ou edita uma regra de comissão com persistência segura no Supabase
   */
  async saveRule(rule: Partial<CommissionRule>): Promise<CommissionRule> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    if (rule.id) {
      const { data: existing, error: lookupError } = await supabase
        .from('commission_rules')
        .select('*')
        .eq('id', rule.id)
        .single()
      if (lookupError || !existing) throw new Error(lookupError?.message || 'Regra não encontrada')
      rule = { ...existing, ...rule }
    }

    if (!rule.carrier_id?.trim()) throw new Error('Operadora obrigatória para a regra')
    if (rule.data_inicio_vigencia && !/^\d{4}-\d{2}-\d{2}$/.test(rule.data_inicio_vigencia)) throw new Error('Data inicial inválida')
    if (rule.data_fim_vigencia && !/^\d{4}-\d{2}-\d{2}$/.test(rule.data_fim_vigencia)) throw new Error('Data final inválida')
    if (!rule.nome?.trim()) throw new Error('Nome da regra obrigatório')
    if (rule.min_lives != null && (!Number.isInteger(rule.min_lives) || rule.min_lives < 1)) throw new Error('Mínimo de vidas inválido')
    if (rule.max_lives != null && (!Number.isInteger(rule.max_lives) || rule.max_lives < (rule.min_lives ?? 1))) throw new Error('Máximo de vidas inválido')
    if (!Array.isArray(rule.cronograma_parcelas) || rule.cronograma_parcelas.length === 0) {
      throw new Error('Informe ao menos uma parcela da comissão')
    }
    const months = new Set<number>()
    for (const installment of rule.cronograma_parcelas) {
      if (!Number.isInteger(installment.month) || installment.month < 1 || installment.month > 1200 ||
          !Number.isFinite(installment.pct) || installment.pct < 0 || installment.pct > 100 ||
          months.has(installment.month)) throw new Error('Cronograma de comissão inválido')
      months.add(installment.month)
    }
    for (const rate of [rule.aliquota_imposto_pct ?? 15, rule.repasse_vendedor_pct ?? 50, rule.repasse_vendedor_proprio_pct ?? 100]) {
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Percentual de comissão inválido')
    }
    if (rule.has_recurring && (!Number.isFinite(rule.recurring_percentage) || (rule.recurring_percentage ?? 0) <= 0 ||
        (rule.recurring_percentage ?? 0) > 100 || !Number.isInteger(rule.recurring_start_month) ||
        (rule.recurring_start_month ?? 0) <= Math.max(...months))) {
      throw new Error('Vitalício incompatível com o cronograma')
    }

    for (const date of [rule.data_inicio_vigencia, rule.data_fim_vigencia]) {
      if (!date) continue
      const [year, month, day] = date.split('-').map(Number)
      const parsed = new Date(Date.UTC(year, month - 1, day))
      if (year < 1900 || year > 9999 || parsed.getUTCFullYear() !== year ||
          parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
        throw new Error('Data de vigência inexistente')
      }
    }

    if (rule.data_inicio_vigencia && rule.data_fim_vigencia &&
        rule.data_fim_vigencia < rule.data_inicio_vigencia) {
      throw new Error('Vigência final anterior à inicial')
    }

    const payload: Record<string, any> = {
      nome: rule.nome,
      code: rule.code || null,
      carrier_id: rule.carrier_id || null,
      product_id: rule.product_id || null,
      modalidade: rule.modalidade || 'PME',
      contract_type: rule.contract_type || 'pme',
      tipo_regra: rule.tipo_regra || 'percentual',
      total_comissao_pct: rule.total_comissao_pct ?? null,
      total_parcelas: rule.total_parcelas ?? (rule.cronograma_parcelas?.length || 1),
      cronograma_parcelas: rule.cronograma_parcelas || [],
      has_recurring: rule.has_recurring ?? false,
      recurring_percentage: rule.recurring_percentage ?? 0,
      recurring_start_month: rule.recurring_start_month ?? 4,
      min_lives: rule.min_lives ?? 1,
      max_lives: rule.max_lives ?? null,
      repasse_vendedor_pct: rule.repasse_vendedor_pct ?? 50,
      repasse_vendedor_proprio_pct: rule.repasse_vendedor_proprio_pct ?? 100,
      aliquota_imposto_pct: rule.aliquota_imposto_pct ?? 15,
      data_inicio_vigencia: rule.data_inicio_vigencia || new Date().toISOString().slice(0, 10),
      data_fim_vigencia: rule.data_fim_vigencia || null,
      ativo: rule.ativo ?? true,
      observacoes: rule.observacoes || null,
      updated_at: new Date().toISOString(),
    }

    if (rule.id) {
      const { data, error } = await supabase
        .from('commission_rules')
        .update(payload)
        .eq('id', rule.id)
        .select(`*, carriers:carrier_id(id, nome), products:product_id(id, nome)`)
        .single()

      if (error || !data) {
        throw new Error(error?.message || 'Falha ao atualizar regra de comissão')
      }
      return {
        ...data,
        cronograma_parcelas: Array.isArray(data.cronograma_parcelas)
          ? data.cronograma_parcelas
          : [],
      }
    } else {
      const { data, error } = await supabase
        .from('commission_rules')
        .insert(payload)
        .select(`*, carriers:carrier_id(id, nome), products:product_id(id, nome)`)
        .single()

      if (error || !data) {
        throw new Error(error?.message || 'Falha ao criar regra de comissão')
      }
      return {
        ...data,
        cronograma_parcelas: Array.isArray(data.cronograma_parcelas)
          ? data.cronograma_parcelas
          : [],
      }
    }
  },

  /**
   * Alterna status ativo/inativo de uma regra de comissão
   */
  async toggleRuleActive(id: string, currentActive: boolean): Promise<boolean> {
    if (!isSupabaseConfigured) return false
    const { error } = await supabase
      .from('commission_rules')
      .update({ ativo: !currentActive, updated_at: new Date().toISOString() })
      .eq('id', id)
    return !error
  },

  /**
   * Lê configurações globais de repasse dos vendedores em system_settings
   */
  async getSellerSplitSettings(): Promise<SellerSplitSettings> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'seller_split_rules')
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data || !data.value) return DEFAULT_SELLER_SPLITS

      return {
        ...DEFAULT_SELLER_SPLITS,
        ...(typeof data.value === 'object' ? data.value : JSON.parse(data.value)),
      }
    } catch {
      return DEFAULT_SELLER_SPLITS
    }
  },

  /**
   * Salva configurações globais de repasse dos vendedores em system_settings
   */
  async updateSellerSplitSettings(settings: SellerSplitSettings): Promise<SellerSplitSettings> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { error } = await supabase.from('system_settings').upsert({
      key: 'seller_split_rules',
      value: settings,
      description: 'Percentuais padrão de repasse ao vendedor por origem do lead e produto',
      updated_at: new Date().toISOString(),
    })

    if (error) {
      throw new Error(error.message || 'Falha ao salvar configurações de repasse')
    }

    return settings
  },
}
