// Serviço de Boletos de Adesão
// Regra definitiva KKJ: 1ª mensalidade 100% KKJ, boleto próprio, sem repasse à operadora.
// Não duplicar comissão de operadora; comissões posteriores seguem tabela normal.

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { AdesaoBoleto } from '@/types/crm'

export const adesaoService = {
  async getBoletos(): Promise<AdesaoBoleto[]> {
    if (!isSupabaseConfigured) return []

    try {
      const { data, error } = await supabase
        .from('adesao_boletos')
        .select('*')
        .order('data_vencimento', { ascending: false })

      if (error) {
        // Se a tabela ainda não foi criada via SQL pelo cliente, não quebra a interface
        console.warn('Tabela adesao_boletos ainda não existe no Supabase:', error.message)
        return []
      }

      return (data || []) as AdesaoBoleto[]
    } catch {
      return []
    }
  },

  async registrarPrimeiroBoleto(params: {
    contract_id: string
    company_id?: string
    contact_id?: string
    vendedor_id?: string
    valor_integral: number
    data_vencimento: string
    aliquota_imposto?: number // Decimal (ex: 0.11 para 11%) ou percentual (11)
  }): Promise<AdesaoBoleto | null> {
    const {
      contract_id,
      company_id,
      contact_id,
      vendedor_id,
      valor_integral,
      data_vencimento,
      aliquota_imposto = 0.11, // Padrão 11% KKJ
    } = params

    // Normaliza alíquota para fração decimal se fornecida como percentual (ex: 11 -> 0.11)
    const taxaDecimal = aliquota_imposto > 1 ? aliquota_imposto / 100 : aliquota_imposto

    const impostoValor = valor_integral * taxaDecimal
    const receitaLiquida = valor_integral - impostoValor
    const comissaoVendedor = receitaLiquida * 0.3 // 30% da receita líquida elegível
    const resultadoCorretora = receitaLiquida - comissaoVendedor

    const boleto: Partial<AdesaoBoleto> = {
      contract_id,
      company_id: company_id || undefined,
      contact_id: contact_id || undefined,
      vendedor_id: vendedor_id || undefined,
      valor_integral,
      data_vencimento,
      status: 'pendente',
      receita_bruta_kkj: valor_integral,
      aliquota_imposto,
      valor_imposto: impostoValor,
      receita_liquida_kkj: receitaLiquida,
      comissao_vendedor_percentual: 30,
      comissao_vendedor_valor: comissaoVendedor,
      resultado_liquido_corretora: resultadoCorretora,
      observacoes:
        '1ª mensalidade de adesão integral da KKJ gerada automaticamente na Venda Ganha.',
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase não configurado para registrar o boleto de adesão.')
    }

    const { data, error } = await supabase
      .from('adesao_boletos')
      .insert(boleto)
      .select('*')
      .single()

    if (error) {
      console.error('Falha crítica ao gravar boleto de adesão no Supabase:', error.message)
      throw new Error(`Não foi possível salvar o boleto de adesão: ${error.message}`)
    }

    if (!data) {
      throw new Error('Falha ao registrar boleto de adesão: nenhum dado retornado pelo banco.')
    }

    return data as AdesaoBoleto
  },

  async confirmarPagamento(id: string, dataPagamento?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return true

    try {
      const { error } = await supabase
        .from('adesao_boletos')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento || new Date().toISOString().slice(0, 10),
        })
        .eq('id', id)

      return !error
    } catch {
      return false
    }
  },
}
