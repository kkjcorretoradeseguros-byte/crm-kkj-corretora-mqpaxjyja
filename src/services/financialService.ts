import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

export interface FinancialCommissionSummary {
  vendedor_id: string
  vendedor_nome: string
  total_faturado_kkj: number
  total_comissao_recebida: number
  total_comissao_prevista: number
  parcelas_pagas: number
  parcelas_pendentes: number
  parcelas_atrasadas: number
}

export interface FinancialInstallmentItem {
  installment_id: string
  policy_id: string
  numero_proposta_apolice: string | null
  carrier_nome: string | null
  product_nome: string | null
  client_nome: string | null
  numero_parcela: number
  data_vencimento: string
  data_pagamento_cliente: string | null
  valor_premio_parcela: number
  valor_base_comissao: number
  percentual_comissao_vendedor: number
  valor_comissao_vendedor: number
  status_comissao: 'PREVISTA' | 'CONFIRMADA' | 'PAGA' | 'CANCELADA' | 'ESTORNADA'
  data_repasse_vendedor: string | null
}

export const financialService = {
  /**
   * Consulta o resumo financeiro consolidado do vendedor autenticado via RPC SECURITY DEFINER `get_meu_financeiro`.
   * Vendedor só enxerga seus números; admin/gestor podem chamar para obter o resumo individual.
   */
  async getMeuFinanceiro(): Promise<FinancialCommissionSummary | null> {
    if (!isSupabaseConfigured) return null

    try {
      const { data, error } = await supabase.rpc('get_meu_financeiro')
      if (error) {
        console.warn('Erro ao chamar RPC get_meu_financeiro:', error.message)
        return null
      }

      if (!data) return null

      // O retorno da RPC pode ser um objeto ou um array com 1 linha
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return null

      return {
        vendedor_id: row.vendedor_id,
        vendedor_nome: row.vendedor_nome,
        total_faturado_kkj: Number(row.total_faturado_kkj || 0),
        total_comissao_recebida: Number(row.total_comissao_recebida || 0),
        total_comissao_prevista: Number(row.total_comissao_prevista || 0),
        parcelas_pagas: Number(row.parcelas_pagas || 0),
        parcelas_pendentes: Number(row.parcelas_pendentes || 0),
        parcelas_atrasadas: Number(row.parcelas_atrasadas || 0),
      }
    } catch (err) {
      console.warn('Falha inesperada ao consultar RPC get_meu_financeiro:', err)
      return null
    }
  },

  /**
   * Consulta a lista de parcelas de comissão do vendedor autenticado via RPC SECURITY DEFINER `get_minhas_parcelas`.
   */
  async getMinhasParcelas(statusFiltro?: string): Promise<FinancialInstallmentItem[]> {
    if (!isSupabaseConfigured) return []

    try {
      const { data, error } = await supabase.rpc('get_minhas_parcelas', {
        status_filtro: statusFiltro || null,
      })

      if (error) {
        console.warn('Erro ao chamar RPC get_minhas_parcelas:', error.message)
        return []
      }

      if (!data || !Array.isArray(data)) return []

      return data.map((item: Record<string, unknown>) => ({
        installment_id: String(item.installment_id || ''),
        policy_id: String(item.policy_id || ''),
        numero_proposta_apolice: item.numero_proposta_apolice
          ? String(item.numero_proposta_apolice)
          : null,
        carrier_nome: item.carrier_nome ? String(item.carrier_nome) : null,
        product_nome: item.product_nome ? String(item.product_nome) : null,
        client_nome: item.client_nome ? String(item.client_nome) : null,
        numero_parcela: Number(item.numero_parcela || 1),
        data_vencimento: String(item.data_vencimento || ''),
        data_pagamento_cliente: item.data_pagamento_cliente
          ? String(item.data_pagamento_cliente)
          : null,
        valor_premio_parcela: Number(item.valor_premio_parcela || 0),
        valor_base_comissao: Number(item.valor_base_comissao || 0),
        percentual_comissao_vendedor: Number(item.percentual_comissao_vendedor || 0),
        valor_comissao_vendedor: Number(item.valor_comissao_vendedor || 0),
        status_comissao:
          (item.status_comissao as FinancialInstallmentItem['status_comissao']) || 'PREVISTA',
        data_repasse_vendedor: item.data_repasse_vendedor
          ? String(item.data_repasse_vendedor)
          : null,
      }))
    } catch (err) {
      console.warn('Falha inesperada ao consultar RPC get_minhas_parcelas:', err)
      return []
    }
  },
}
