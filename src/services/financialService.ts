import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

export interface FinancialCommissionSummary {
  total_contratos: number
  total_repasse_previsto: number
  total_repasse_pago: number
  total_repasse_pendente: number
  parcelas_a_vencer: number
  parcelas_vencidas: number
}

export interface FinancialInstallmentItem {
  parcela_id: string
  contract_id: string
  numero_contrato: string | null
  cliente_nome: string | null
  operadora_nome: string | null
  numero_parcela: number
  total_parcelas: number
  tipo_parcela: string
  data_vencimento: string
  repasse_previsto_vendedor: number
  repasse_pago_vendedor: number
  data_repasse: string | null
  status: string
}

export const financialService = {
  /**
   * Consulta o resumo financeiro consolidado via RPC SECURITY DEFINER `get_meu_financeiro`.
   * Vendedor enxerga seus contratos; gestor enxerga subordinados de sua equipe ativa; admin enxerga tudo.
   */
  async getMeuFinanceiro(): Promise<FinancialCommissionSummary | null> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    try {
      const { data, error } = await supabase.rpc('get_meu_financeiro')
      if (error) {
        throw new Error('Erro ao consultar resumo financeiro: ' + error.message)
      }

      if (!data) return null

      // O retorno da RPC pode ser um objeto ou um array com 1 linha
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return null

      return {
        total_contratos: Number(row.total_contratos || 0),
        total_repasse_previsto: Number(row.total_repasse_previsto || 0),
        total_repasse_pago: Number(row.total_repasse_pago || 0),
        total_repasse_pendente: Number(row.total_repasse_pendente || 0),
        parcelas_a_vencer: Number(row.parcelas_a_vencer || 0),
        parcelas_vencidas: Number(row.parcelas_vencidas || 0),
      }
    } catch (err) {
      throw err
    }
  },

  /**
   * Consulta a lista de parcelas de comissão via RPC SECURITY DEFINER `get_minhas_parcelas(p_mes, p_ano)`.
   * Suporta filtros opcionais de mês e ano para conciliação.
   */
  async getMinhasParcelas(mes?: number, ano?: number): Promise<FinancialInstallmentItem[]> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    try {
      const { data, error } = await supabase.rpc('get_minhas_parcelas', {
        p_mes: mes ?? null,
        p_ano: ano ?? null,
      })

      if (error) {
        throw new Error('Erro ao consultar parcelas: ' + error.message)
      }

      if (!Array.isArray(data)) throw new Error('Resposta inválida da consulta de parcelas')

      return data.map((item: Record<string, unknown>) => ({
        parcela_id: String(item.parcela_id || ''),
        contract_id: String(item.contract_id || ''),
        numero_contrato: item.numero_contrato ? String(item.numero_contrato) : null,
        cliente_nome: item.cliente_nome ? String(item.cliente_nome) : null,
        operadora_nome: item.operadora_nome ? String(item.operadora_nome) : null,
        numero_parcela: Number(item.numero_parcela || 1),
        total_parcelas: Number(item.total_parcelas || 1),
        tipo_parcela: String(item.tipo_parcela || 'vitalicia'),
        data_vencimento: String(item.data_vencimento || ''),
        repasse_previsto_vendedor: Number(item.repasse_previsto_vendedor || 0),
        repasse_pago_vendedor: Number(item.repasse_pago_vendedor || 0),
        data_repasse: item.data_repasse ? String(item.data_repasse) : null,
        status: String(item.status || 'previsto'),
      }))
    } catch (err) {
      throw err
    }
  },
}
