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
    .select('id,status,valor_mensal').eq('id', params.contractId).single()
  if (error || !contract) throw new Error(error?.message || 'Contrato não encontrado')
  if (contract.status === 'cancelado') throw new Error('Contrato cancelado não pode gerar novas previsões')
  if (!Number.isFinite(params.mensalidade) || Number(contract.valor_mensal) !== params.mensalidade) {
    throw new Error('A mensalidade da previsão deve corresponder ao valor registrado no contrato')
  }
  const { data: financial, error: financialError } = await supabase.from('contract_financials')
    .select('id').eq('contract_id', params.contractId).maybeSingle()
  if (financialError) throw new Error('Não foi possível verificar previsões anteriores: ' + financialError.message)
  if (financial) throw new Error('Este contrato já possui previsão financeira registrada')
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

/**
 * Persiste a previsão somente pela função transacional do banco.
 * A função RPC recalcula e valida valores contra contrato e regra comercial.
 * Requer a migração correspondente aplicada e privilégios administrativos.
 */
export async function persistContractCommissionForecast(params: {
  contractId: string
  ruleId: string
  rule: DatabaseCommissionRule
  mensalidade: number
  leadOrigin: 'kkj' | 'vendedor'
  firstDueDate: string
}): Promise<string> {
  if (!params.ruleId?.trim()) throw new Error('Regra de comissão obrigatória')
  const preview = await previewContractCommissions(params)
  const { data, error } = await supabase.rpc('persist_contract_commission_forecast', {
    p_contract_id: params.contractId,
    p_rule_id: params.ruleId,
    p_lead_origin: params.leadOrigin,
    p_installments: preview.installments,
  })
  if (error) throw new Error('Falha ao registrar previsão financeira: ' + error.message)
  if (typeof data !== 'string' || !data) throw new Error('Resposta financeira inválida')
  return data
}
