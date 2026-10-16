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
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id,status,valor_mensal')
    .eq('id', params.contractId)
    .single()
  if (error || !contract) throw new Error(error?.message || 'Contrato não encontrado')
  if (contract.status === 'cancelado')
    throw new Error('Contrato cancelado não pode gerar novas previsões')
  if (
    !Number.isFinite(params.mensalidade) ||
    params.mensalidade <= 0 ||
    Number(contract.valor_mensal) !== params.mensalidade
  ) {
    throw new Error('A mensalidade da previsão deve corresponder ao valor registrado no contrato')
  }
  const { data: financial, error: financialError } = await supabase
    .from('contract_financials')
    .select('id')
    .eq('contract_id', params.contractId)
    .maybeSingle()
  if (financialError)
    throw new Error('Não foi possível verificar previsões anteriores: ' + financialError.message)
  if (financial) throw new Error('Este contrato já possui previsão financeira registrada')
  const installments = buildFinancialInstallmentDrafts(params)
  const total = (
    field: 'valor_previsto' | 'imposto_retido' | 'valor_liquido' | 'repasse_previsto_vendedor',
  ) => Math.round(installments.reduce((sum, row) => sum + row[field], 0) * 100) / 100
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

/**
 * Resolve uma única regra ativa compatível com o contrato, sem escolher
 * silenciosamente entre condições comerciais concorrentes.
 * A data de pagamento já registrada é a referência das competências.
 */
export async function previewConfirmedContractCommissions(contractId: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id,carrier_id,product_id,qtd_vidas,valor_mensal,data_pagamento,data_confirmacao_pagamento,origem_comercial_lead')
    .eq('id', contractId)
    .single()
  if (contractError || !contract)
    throw new Error(contractError?.message || 'Contrato não encontrado')
  const leadOrigin = contract.origem_comercial_lead
  if (leadOrigin !== 'kkj' && leadOrigin !== 'vendedor') {
    throw new Error('Defina a origem comercial do lead antes de gerar comissões')
  }
  const paymentDate = contract.data_confirmacao_pagamento || contract.data_pagamento
  if (!paymentDate) throw new Error('Confirme primeiro o pagamento do cliente')
  const { data: rules, error: rulesError } = await supabase
    .from('commission_rules')
    .select(
      'id,nome,carrier_id,product_id,min_lives,max_lives,data_inicio_vigencia,data_fim_vigencia,cronograma_parcelas,aliquota_imposto_pct,repasse_vendedor_pct,repasse_vendedor_proprio_pct,has_recurring,recurring_percentage,recurring_start_month',
    )
    .eq('carrier_id', contract.carrier_id)
    .eq('ativo', true)
  if (rulesError) throw new Error('Falha ao consultar regras de comissão: ' + rulesError.message)
  const lives = Number(contract.qtd_vidas)
  if (!Number.isInteger(lives) || lives < 1) throw new Error('Quantidade de vidas inválida')
  if (!Number.isFinite(Number(contract.valor_mensal)) || !(Number(contract.valor_mensal) > 0)) throw new Error('Mensalidade inválida')
  const applicable = (rules || []).filter(
    (rule) =>
      (!rule.product_id || rule.product_id === contract.product_id) &&
      (rule.min_lives == null || lives >= Number(rule.min_lives)) &&
      (rule.max_lives == null || lives <= Number(rule.max_lives)) &&
      (!rule.data_inicio_vigencia || paymentDate >= rule.data_inicio_vigencia) &&
      (!rule.data_fim_vigencia || paymentDate <= rule.data_fim_vigencia),
  )
  if (applicable.length !== 1) {
    throw new Error(
      applicable.length === 0
        ? 'Nenhuma regra de comissão aplicável ao contrato'
        : 'Mais de uma regra aplicável: seleção administrativa necessária',
    )
  }
  const selected = applicable[0]
  const rule: DatabaseCommissionRule = {
    cronograma_parcelas:
      selected.cronograma_parcelas as DatabaseCommissionRule['cronograma_parcelas'],
    aliquota_imposto_pct: Number(selected.aliquota_imposto_pct),
    repasse_vendedor_pct: Number(selected.repasse_vendedor_pct),
    repasse_vendedor_proprio_pct: Number(selected.repasse_vendedor_proprio_pct),
    has_recurring: Boolean(selected.has_recurring),
    recurring_percentage:
      selected.recurring_percentage == null ? undefined : Number(selected.recurring_percentage),
    recurring_start_month:
      selected.recurring_start_month == null ? undefined : Number(selected.recurring_start_month),
  }
  const preview = await previewContractCommissions({
    contractId,
    rule: rule as DatabaseCommissionRule,
    mensalidade: Number(contract.valor_mensal),
    leadOrigin,
    firstDueDate: paymentDate,
  })
  return {
    ...preview,
    ruleId: selected.id,
    ruleName: selected.nome,
    rule,
    firstDueDate: paymentDate,
    mensalidade: Number(contract.valor_mensal),
    leadOrigin,
  }
}

/** Idempotent UI entrypoint: existing forecast is returned without recreating installments. */
export async function ensureConfirmedContractForecast(contractId: string) {
  const { data: existing, error } = await supabase
    .from('contract_financials')
    .select('id')
    .eq('contract_id', contractId)
    .maybeSingle()
  if (error) throw new Error('Falha ao consultar previsão existente: ' + error.message)
  if (existing) {
    await confirmFirstCommissionReceipt(contractId)
    return existing.id
  }
  const preview = await previewConfirmedContractCommissions(contractId)
  const financialId = await persistContractCommissionForecast({
    contractId,
    ruleId: preview.ruleId,
    rule: preview.rule,
    mensalidade: preview.mensalidade,
    leadOrigin: preview.leadOrigin,
    firstDueDate: preview.firstDueDate,
  })
  await confirmFirstCommissionReceipt(contractId)
  return financialId
}

/** Confirm first commission receipt using the already confirmed client payment date. */
export async function confirmFirstCommissionReceipt(contractId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_first_commission_receipt', {
    p_contract_id: contractId,
  })
  if (error) throw new Error('Falha ao confirmar recebimento da comissão: ' + error.message)
}
