import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type {
  Contract,
  ContractStatus,
  Company,
  Contact,
  Product,
  Carrier,
  User,
} from '@/types/crm'

export interface ContractFilterOptions {
  page?: number
  perPage?: number
  companyId?: string
  opportunity_id?: string
  status?: ContractStatus
  search?: string
}

interface ContractDbRow {
  id: string
  numero_contrato?: string | null
  contract_number?: string | null
  opportunity_id?: string | null
  company_id?: string | null
  contact_id?: string | null
  carrier_id: string
  product_id?: string | null
  plano?: string | null
  qtd_vidas?: number | null
  valor_mensal?: number | null
  valor_venda?: number | null
  sale_value?: number | null
  status: string
  data_inicio_vigencia?: string | null
  data_previsao_vigencia?: string | null
  data_pagamento?: string | null
  data_implantacao?: string | null
  data_renovacao?: string | null
  data_vencimento_primeiro_pagamento?: string | null
  data_confirmacao_pagamento?: string | null
  usuario_confirmou_pagamento_id?: string | null
  usuario_implantacao_id?: string | null
  primeira_competencia?: string | null
  observacoes?: string | null
  responsavel_id?: string | null
  created_at?: string
  updated_at?: string
  companies?: {
    id: string
    nome_fantasia?: string | null
    trade_name?: string | null
    razao_social?: string | null
    legal_name?: string | null
    cnpj?: string | null
    cidade?: string | null
    estado?: string | null
  } | null
  contacts?: {
    id: string
    nome?: string | null
    name?: string | null
    celular?: string | null
    phone?: string | null
    email?: string | null
  } | null
  products?: {
    id: string
    nome: string
    categoria?: string | null
  } | null
  carriers?: {
    id: string
    nome: string
    nome_curto?: string | null
  } | null
  profiles?: {
    id: string
    nome: string
    email: string
  } | null
  confirmed_by_profile?: {
    id: string
    nome: string
    email: string
  } | null
  implanted_by_profile?: {
    id: string
    nome: string
    email: string
  } | null
}

const SELECT_EXPAND = `
  id,
  numero_contrato,
  opportunity_id,
  company_id,
  contact_id,
  product_id,
  carrier_id,
  plano,
  qtd_vidas,
  valor_mensal,
  valor_venda,
  status,
  data_inicio_vigencia,
  data_previsao_vigencia,
  data_pagamento,
  data_confirmacao_pagamento,
  data_vencimento_primeiro_pagamento,
  primeira_competencia,
  usuario_confirmou_pagamento_id,
  usuario_implantacao_id,
  data_implantacao,
  data_renovacao,





  observacoes,
  responsavel_id,
  created_at,
  updated_at,
  companies:company_id(id, razao_social, nome_fantasia, cnpj, cidade, estado),
  contacts:contact_id(id, nome, celular, email),
  products:product_id(id, nome, categoria),
  carriers:carrier_id(id, nome, nome_curto),
  profiles:responsavel_id(id, nome, email)
`

function mapContractRow(r: ContractDbRow): Contract {
  const statusRaw = (r.status || 'em_implantacao').toLowerCase()
  let uiStatus: ContractStatus = 'Em Implantação'
  if (statusRaw === 'ativo') uiStatus = 'Ativo'
  else if (statusRaw === 'cancelado') uiStatus = 'Cancelado'
  else if (statusRaw === 'pendente_renovacao') uiStatus = 'Pendente Renovação'

  const val = Number(r.valor_mensal ?? r.valor_venda ?? r.sale_value ?? 0)

  const c: Contract = {
    id: r.id,
    company_id: r.company_id || undefined,
    contact_id: r.contact_id || undefined,
    carrier_id: r.carrier_id,
    product_id: r.product_id || undefined,
    opportunity_id: r.opportunity_id || undefined,
    contract_number: r.numero_contrato || r.contract_number || undefined,
    plano: r.plano || undefined,
    status: uiStatus,
    start_date: r.data_inicio_vigencia || undefined,
    data_vencimento_primeiro_pagamento: r.data_vencimento_primeiro_pagamento || r.data_previsao_vigencia || undefined,
    data_confirmacao_pagamento: r.data_confirmacao_pagamento || r.data_pagamento || undefined,
    data_implantacao: r.data_implantacao || undefined,
    usuario_confirmou_pagamento_id: r.usuario_confirmou_pagamento_id || undefined,
    usuario_implantacao_id: r.usuario_implantacao_id || undefined,
    primeira_competencia: r.primeira_competencia || undefined,
    first_installment_reference: r.primeira_competencia || undefined,
    renewal_date: r.data_renovacao || undefined,
    sale_value: val,
    commission_value: undefined,
    lives_count: r.qtd_vidas || undefined,
    notes: r.observacoes || undefined,
    assigned_to: r.responsavel_id || undefined,
    created: r.created_at || new Date().toISOString(),
    updated: r.updated_at || new Date().toISOString(),
  }

  c.expand = {}
  if (r.companies) {
    c.expand.company_id = {
      id: r.companies.id,
      trade_name: r.companies.nome_fantasia || r.companies.trade_name || 'Empresa',
      legal_name: r.companies.razao_social || r.companies.legal_name || undefined,
      cnpj: r.companies.cnpj || undefined,
      city: r.companies.cidade || undefined,
      state: r.companies.estado || undefined,
    } as Company
  }
  if (r.contacts) {
    c.expand.contact_id = {
      id: r.contacts.id,
      company_id: r.company_id || '',
      name: r.contacts.nome || r.contacts.name || 'Contato',
      phone: r.contacts.celular || r.contacts.phone || '',
      email: r.contacts.email || undefined,
    } as Contact
  }
  if (r.products) {
    c.expand.product_id = {
      id: r.products.id,
      name: r.products.nome,
      category: (r.products.categoria || 'SAUDE') as any,
      active: true,
    } as Product
  }
  if (r.carriers) {
    c.expand.carrier_id = {
      id: r.carriers.id,
      nome: r.carriers.nome,
      nome_curto: r.carriers.nome_curto || undefined,
      ativo: true,
    } as Carrier
    c.operator = r.carriers.nome || r.carriers.nome_curto || undefined
    c.contracted_carrier_name = r.carriers.nome || r.carriers.nome_curto || undefined
  }
  if (r.plano) {
    c.contracted_plan_name = r.plano
  } else if (r.products?.nome) {
    c.contracted_plan_name = r.products.nome
  }
  if (r.profiles) {
    c.expand.assigned_to = {
      id: r.profiles.id,
      name: r.profiles.nome,
      email: r.profiles.email,
      role: 'vendedor',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    } as User
  }

  return c
}

export const contractService = {
  async getContracts(options: ContractFilterOptions = {}) {
    if (!isSupabaseConfigured) {
      return { items: [] as Contract[], totalItems: 0, totalPages: 0, page: 1, perPage: 50 }
    }

    const page = options.page || 1
    const perPage = options.perPage || 50
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    try {
      let query = supabase.from('contracts').select(SELECT_EXPAND, { count: 'exact' })

      if (options.companyId) {
        query = query.eq('company_id', options.companyId)
      }
      if (options.opportunity_id) {
        query = query.eq('opportunity_id', options.opportunity_id)
      }
      if (options.status) {
        const statusToDb: Record<ContractStatus, string> = {
          Ativo: 'ativo',
          Cancelado: 'cancelado',
          'Em Implantação': 'em_implantacao',
          'Pendente Renovação': 'pendente_renovacao',
        }
        query = query.eq('status', statusToDb[options.status])
      }
      if (options.search) {
        const s = options.search.trim()
        query = query.ilike('numero_contrato', `%${s}%`)
      }

      query = query.order('created_at', { ascending: false }).range(from, to)

      const { data, count, error } = await query
      if (error) {
        throw new Error('Falha ao consultar contratos: ' + error.message)
      }

      const totalItems = count || 0
      const totalPages = Math.ceil(totalItems / perPage)
      const items = ((data || []) as unknown as ContractDbRow[]).map(mapContractRow)

      return { items, totalItems, totalPages, page, perPage }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Falha ao consultar contratos')
    }
  },

  async getContractForOpportunity(opportunityId: string): Promise<Contract | null> {
    const direct = await this.getContracts({ opportunity_id: opportunityId })
    if (direct.items.length > 1) throw new Error('Mais de um contrato vinculado à oportunidade')
    if (direct.items.length === 1) return direct.items[0]

    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .select('funnel_type, company_id, contact_id, carrier_id')
      .eq('id', opportunityId)
      .single()
    if (opportunityError) throw new Error(opportunityError.message)
    if (opportunity?.funnel_type !== 'pos_venda') return null
    if (!opportunity.company_id || !opportunity.contact_id || !opportunity.carrier_id) {
      throw new Error(
        'Pós-venda sem empresa, contato e operadora para localizar o contrato com segurança',
      )
    }
    const { data: matches, error } = await supabase
      .from('contracts')
      .select('id')
      .eq('company_id', opportunity.company_id)
      .eq('contact_id', opportunity.contact_id)
      .eq('carrier_id', opportunity.carrier_id)
      .neq('status', 'cancelado')
      .limit(2)
    if (error) throw new Error('Falha ao localizar contrato do pós-venda: ' + error.message)
    if (!matches?.length) return null
    if (matches.length !== 1)
      throw new Error('Múltiplos contratos correspondentes; selecione o contrato explicitamente')
    return this.getContractById(matches[0].id)
  },

  async getAllContracts(): Promise<Contract[]> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(SELECT_EXPAND)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error('Falha ao listar contratos: ' + error.message)
      }
      return ((data || []) as unknown as ContractDbRow[]).map(mapContractRow)
    } catch (error) {
      throw error instanceof Error ? error : new Error('Falha ao listar contratos')
    }
  },

  async getContractById(id: string): Promise<Contract> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data, error } = await supabase
      .from('contracts')
      .select(SELECT_EXPAND)
      .eq('id', id)
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Contrato não encontrado')
    }

    return mapContractRow(data as unknown as ContractDbRow)
  },

  async createContract(data: Partial<Contract>): Promise<Contract> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    if (!data.carrier_id || typeof data.carrier_id !== 'string' || !data.carrier_id.trim()) {
      throw new Error('Selecione uma operadora para cadastrar o contrato')
    }
    if (
      data.sale_value !== undefined &&
      (!Number.isFinite(data.sale_value) || data.sale_value < 0)
    ) {
      throw new Error('Valor do contrato inválido')
    }
    if (
      data.lives_count !== undefined &&
      (!Number.isInteger(data.lives_count) || data.lives_count < 1)
    ) {
      throw new Error('Quantidade de vidas inválida')
    }
    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const assignedTo = data.assigned_to || currentUserId
    if (!currentUserId)
      throw new Error('Sessão expirada. Faça login novamente para cadastrar o contrato')
    if (typeof assignedTo !== 'string' || !assignedTo.trim()) {
      throw new Error('Responsável pelo contrato obrigatório')
    }

    const statusMap: Record<string, string> = {
      Ativo: 'ativo',
      Cancelado: 'cancelado',
      'Em Implantação': 'em_implantacao',
      'Pendente Renovação': 'pendente_renovacao',
    }
    if (data.status && !statusMap[data.status]) throw new Error('Status de contrato inválido')
    if (data.status === 'Cancelado')
      throw new Error('Use a ação de cancelamento para registrar a justificativa')
    const dbStatus = (data.status && statusMap[data.status]) || 'em_implantacao'
    if (dbStatus === 'ativo' && !data.data_confirmacao_pagamento) {
      throw new Error('Confirme o pagamento antes de ativar o contrato')
    }

    const paymentDueDate = data.data_vencimento_primeiro_pagamento || null
    const paymentConfirmedDate = data.data_confirmacao_pagamento || null
    const firstComp = data.primeira_competencia || data.first_installment_reference || null

    const insertPayload: Record<string, unknown> = {
      opportunity_id: data.opportunity_id || null,
      company_id: data.company_id || null,
      contact_id: data.contact_id || null,
      carrier_id: data.carrier_id!,
      product_id: data.product_id || null,
      plano: data.plano || null,
      numero_contrato: data.contract_number || null,
      status: dbStatus,
      data_inicio_vigencia: data.start_date || new Date().toISOString().split('T')[0],
      data_renovacao: data.renewal_date || null,
      data_previsao_vigencia: paymentDueDate,
      data_vencimento_primeiro_pagamento: paymentDueDate,
      data_pagamento: paymentConfirmedDate,
      data_confirmacao_pagamento: paymentConfirmedDate,
      usuario_confirmou_pagamento_id: data.usuario_confirmou_pagamento_id || null,
      usuario_implantacao_id: data.usuario_implantacao_id || null,
      primeira_competencia: firstComp,
      valor_mensal: data.sale_value || 0,
      valor_venda: data.sale_value || 0,
      qtd_vidas: data.lives_count || 1,
      observacoes: data.notes || null,
      responsavel_id: assignedTo,
    }

    const { data: created, error } = await supabase
      .from('contracts')
      .insert(insertPayload)
      .select(SELECT_EXPAND)
      .single()

    if (error || !created) {
      throw new Error(error?.message || 'Falha ao criar contrato')
    }

    const mapped = mapContractRow(created as unknown as ContractDbRow)

    if (mapped.opportunity_id) {
      try {
        const { error: timelineError } = await supabase.from('opportunity_timeline').insert({
          opportunity_id: mapped.opportunity_id,
          tipo_evento: 'STATUS_CHANGE',
          conteudo: `Contrato cadastrado (${mapped.contract_number || 'Sem número'}). Valor do produto: R$ ${mapped.sale_value.toLocaleString('pt-BR')} | Comissão KKJ: a conciliar`,
          dados_adicionais: { contract_id: mapped.id },
          user_id: currentUserId,
        })
        if (timelineError)
          console.warn('Falha ao registrar cadastro na timeline:', timelineError.message)
      } catch (tlErr) {
        console.warn('Erro ao registrar histórico do contrato na timeline:', tlErr)
      }
    }

    return mapped
  },

  async updateContract(id: string, data: Partial<Contract>): Promise<Contract> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
    if (
      data.sale_value !== undefined &&
      (!Number.isFinite(data.sale_value) || data.sale_value < 0)
    ) {
      throw new Error('Valor do contrato inválido')
    }
    if (
      data.lives_count !== undefined &&
      (!Number.isInteger(data.lives_count) || data.lives_count < 1)
    ) {
      throw new Error('Quantidade de vidas inválida')
    }
    if (
      data.carrier_id !== undefined &&
      (typeof data.carrier_id !== 'string' || !data.carrier_id.trim())
    ) {
      throw new Error('Operadora inválida')
    }
    if (data.status === 'Cancelado')
      throw new Error('Use a ação de cancelamento para registrar a justificativa')
    if (
      data.status !== undefined &&
      !['Ativo', 'Em Implantação', 'Pendente Renovação'].includes(data.status)
    ) {
      throw new Error('Status de contrato inválido')
    }
    if (
      data.assigned_to !== undefined &&
      (typeof data.assigned_to !== 'string' || !data.assigned_to.trim())
    ) {
      throw new Error('Responsável pelo contrato inválido')
    }

    if (data.status === 'Ativo') {
      const { data: current, error: currentError } = await supabase
        .from('contracts')
        .select('id, data_pagamento, status')
        .eq('id', id)
        .single()
      if (currentError || !current)
        throw new Error(currentError?.message || 'Contrato não encontrado')
      if (current.status === 'cancelado')
        throw new Error('Contrato cancelado não pode ser reativado por edição')
      const isConfirmed =
        Boolean(data.data_confirmacao_pagamento) || Boolean(current.data_pagamento)
      if (!isConfirmed) {
        throw new Error(
          'Não é possível implantar este contrato. O primeiro pagamento ainda não foi confirmado.',
        )
      }
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (data.opportunity_id !== undefined) payload.opportunity_id = data.opportunity_id || null
    if (data.company_id !== undefined) payload.company_id = data.company_id
    if (data.contact_id !== undefined) payload.contact_id = data.contact_id || null
    if (data.carrier_id !== undefined) payload.carrier_id = data.carrier_id || null
    if (data.product_id !== undefined) payload.product_id = data.product_id || null
    if (data.plano !== undefined) payload.plano = data.plano || null
    if (data.contract_number !== undefined) payload.numero_contrato = data.contract_number || null
    if (data.status !== undefined) {
      const statusMap: Record<string, string> = {
        Ativo: 'ativo',
        Cancelado: 'cancelado',
        'Em Implantação': 'em_implantacao',
        'Pendente Renovação': 'pendente_renovacao',
      }
      payload.status = statusMap[data.status] || data.status
      if (data.status === 'Ativo' && !data.data_implantacao) {
        payload.data_implantacao = new Date().toISOString().slice(0, 10)
      }
    }
    if (data.data_implantacao !== undefined) {
      payload.data_implantacao = data.data_implantacao || null
    }
    if (data.start_date !== undefined) payload.data_inicio_vigencia = data.start_date || null
    if (data.data_vencimento_primeiro_pagamento !== undefined) {
      payload.data_previsao_vigencia = data.data_vencimento_primeiro_pagamento || null
    }
    if (data.data_confirmacao_pagamento !== undefined) {
      payload.data_pagamento = data.data_confirmacao_pagamento || null
      payload.data_confirmacao_pagamento = data.data_confirmacao_pagamento || null
    }
    if (data.data_vencimento_primeiro_pagamento !== undefined) payload.data_vencimento_primeiro_pagamento = data.data_vencimento_primeiro_pagamento || null
    if (data.primeira_competencia !== undefined) payload.primeira_competencia = data.primeira_competencia || null
    if (data.usuario_confirmou_pagamento_id !== undefined) payload.usuario_confirmou_pagamento_id = data.usuario_confirmou_pagamento_id || null
    if (data.usuario_implantacao_id !== undefined) payload.usuario_implantacao_id = data.usuario_implantacao_id || null
    if (data.renewal_date !== undefined) payload.data_renovacao = data.renewal_date || null
    if (data.sale_value !== undefined) {
      payload.valor_mensal = data.sale_value
      payload.valor_venda = data.sale_value
    }
    if (data.lives_count !== undefined) payload.qtd_vidas = data.lives_count || null
    if (data.notes !== undefined) payload.observacoes = data.notes || null
    if (data.assigned_to !== undefined) payload.responsavel_id = data.assigned_to || null

    const { data: updated, error } = await supabase
      .from('contracts')
      .update(payload)
      .eq('id', id)
      .select(SELECT_EXPAND)
      .single()

    if (error || !updated) {
      throw new Error(error?.message || 'Falha ao atualizar contrato')
    }

    return mapContractRow(updated as unknown as ContractDbRow)
  },

  async deleteContract(id: string, _motivo?: string): Promise<boolean> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
    if (typeof id !== 'string' || !id.trim()) throw new Error('Contrato inválido')

    // Exclusão física pode apagar histórico financeiro e deixar registros órfãos.
    // Até existir uma operação transacional auditável no banco, usar cancelamento.
    throw new Error(
      'Exclusão definitiva de contratos desabilitada para proteger o histórico financeiro. Utilize o cancelamento auditável.',
    )
  },

  async cancelContract(id: string, motivo: string): Promise<Contract> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
    if (typeof id !== 'string' || !id.trim()) throw new Error('Contrato inválido')
    if (typeof motivo !== 'string' || !motivo.trim())
      throw new Error('Informe o motivo do cancelamento')
    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null
    if (!currentUserId)
      throw new Error('Sessão expirada. Faça login novamente para cancelar o contrato')

    const { data: cancelledRow, error: cancellationError } = await supabase
      .from('contracts')
      .update({
        status: 'cancelado',
        motivo_cancelamento: motivo.trim(),
        data_cancelamento: new Date().toISOString().slice(0, 10),
      })
      .eq('id', id)
      .select('id')
      .single()

    if (cancellationError || !cancelledRow) {
      throw new Error(cancellationError?.message || 'Não foi possível cancelar o contrato')
    }
    const updated = await this.getContractById(id)

    if (updated.opportunity_id) {
      try {
        const { error: timelineError } = await supabase.from('opportunity_timeline').insert({
          opportunity_id: updated.opportunity_id,
          tipo_evento: 'STATUS_CHANGE',
          conteudo: `Contrato Cancelado (${updated.contract_number || id}). Motivo: ${motivo}`,
          dados_adicionais: { cancelado_por: currentUserId, motivo },
          user_id: currentUserId,
        })
        if (timelineError)
          console.warn('Falha ao registrar cancelamento na timeline:', timelineError.message)
      } catch (err) {
        console.warn('Erro ao registrar cancelamento do contrato na timeline:', err)
      }
    }

    return updated
  },

  async confirmFirstPayment(contractId: string, dataConfirmacao: string): Promise<Contract> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null
    if (!currentUserId)
      throw new Error('Sessão expirada. Faça login novamente para confirmar o primeiro pagamento')

    const targetDate = dataConfirmacao || new Date().toISOString().slice(0, 10)
    const updated = await this.updateContract(contractId, {
      data_confirmacao_pagamento: targetDate,
      usuario_confirmou_pagamento_id: currentUserId,
    })

    // Automação: Gerar previsão e cronograma financeiro automaticamente
    // considerando a 1ª comissão como recebida pela KKJ (regra operacional simplificada KKJ)
    try {
      const { ensureConfirmedContractForecast } = await import('./commissionForecastService')
      await ensureConfirmedContractForecast(contractId)
    } catch (forecastErr) {
      console.warn(
        'Aviso: cronograma automático de comissão não pôde ser gerado imediatamente:',
        forecastErr,
      )
    }

    if (updated.opportunity_id) {
      try {
        await supabase.from('opportunity_timeline').insert({
          opportunity_id: updated.opportunity_id,
          tipo_evento: 'pagamento_confirmado',
          conteudo: `Primeiro pagamento confirmado na data ${targetDate}. Contrato ${updated.contract_number || contractId}.`,
          dados_adicionais: {
            contract_id: contractId,
            data_confirmacao: targetDate,
            confirmado_por: currentUserId,
          },
          user_id: currentUserId,
        })
      } catch (tlErr) {
        console.warn('Erro ao registrar confirmação de pagamento na timeline:', tlErr)
      }
    }

    return updated
  },

  async markAsImplanted(contractId: string, dataImplantacao?: string): Promise<Contract> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null
    if (!currentUserId)
      throw new Error('Sessão expirada. Faça login novamente para implantar o contrato')

    const targetDate = dataImplantacao || new Date().toISOString().slice(0, 10)
    const updated = await this.updateContract(contractId, {
      status: 'Ativo',
      data_implantacao: targetDate,
      usuario_implantacao_id: currentUserId,
    })

    if (updated.opportunity_id) {
      try {
        await supabase.from('opportunity_timeline').insert({
          opportunity_id: updated.opportunity_id,
          tipo_evento: 'implantado',
          conteudo: `Contrato ${updated.contract_number || contractId} implantado com sucesso na data ${targetDate}.`,
          dados_adicionais: {
            contract_id: contractId,
            data_implantacao: targetDate,
            implantado_por: currentUserId,
          },
          user_id: currentUserId,
        })
      } catch (tlErr) {
        console.warn('Erro ao registrar implantação na timeline:', tlErr)
      }
    }

    return updated
  },
}
