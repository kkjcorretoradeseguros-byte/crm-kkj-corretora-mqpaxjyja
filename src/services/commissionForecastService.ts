import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { buildFinancialInstallmentDrafts, type DatabaseCommissionRule } from './commissionEngine'

/**
 * Prepara a previsão financeira. Não efetua gravações parciais: a persistência
 * deve ocorrer em uma única transação no banco, com autorização e idempotência.
 */
export async function previewContractCommissions(params: {
  contractId: string
  rule: DatabaseCommissionRule
  mensalidade: number
  leadOrigin: 'kkj' | 'vendedor'
  firstDueDate: string
}) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
  if (!params.contractId?.trim()) throw new Error('Contrato obrigatório')
  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData.user) throw new Error('Sessão expirada')
  const { data: contract, error } = await supabase.from('contracts')
    .select('id,status').eq('id', params.contractId).single()
  if (error || !contract) throw new Error(error?.message || 'Contrato não encontrado')
  if (contract.status === 'cancelado') throw new Error('Contrato cancelado não pode gerar novas previsões')
  const installments = buildFinancialInstallmentDrafts(params)
  const total = (field: 'valor_previsto' | 'imposto_retido' | 'valor_liquido' | 'repasse_previsto_vendedor') =>
    Math.round(installments.reduce((sum, row) => sum + row[field], 0) * 100) / 100
  return {
    contractId: params.contractId,
    installments,
    comissao_prevista: total('valor_previsto'),
    impostos_descontos: total('imposto_retido'),
    comissao_liquida: total('valor_liquido'),
    repasse_vendedor: total('repasse_previsto_vendedor'),
    // Nenhum recebimento ou repasse é confirmado pela previsão.
    comissao_recebida: 0,
    repasse_pago_vendedor: 0,
  }
}
