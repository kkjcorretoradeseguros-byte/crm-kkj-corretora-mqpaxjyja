// ==============================================================================
// CRM KK JEKABSON CORRETORA DE SEGUROS E BENEFÍCIOS (KKJ)
// MODELO DE TIPOS CONSOLIDADO V1 (TYPESCRIPT)
// Compatível com Supabase e abstraído para portabilidade completa
// ==============================================================================

export type UserRole = 'ADMINISTRADOR' | 'GESTOR' | 'VENDEDOR' | 'admin' | 'gestor' | 'vendedor'

export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  role?: UserRole
  phone?: string
  position?: string
  team?: string
  active?: boolean
  ativo?: boolean
  receives_automatic_leads?: boolean
  created?: string
  updated?: string
}

// ------------------------------------------------------------------------------
// OPERADORAS (Carriers) & PRODUTOS
// ------------------------------------------------------------------------------
export interface Carrier {
  id: string
  nome: string
  nome_curto?: string
  ativo: boolean
  observacoes?: string
  cnpj?: string | null
  ans_registro?: string | null
  segmento_principal?: string | null
  segmentos_atendidos?: string[]
  logo_url?: string | null
  site?: string | null
  telefone_suporte?: string | null
  email_operacional?: string | null
  portal_corretor_url?: string | null
  created_at?: string
  updated_at?: string
}

export type ProductCategory =
  | 'Saúde PME'
  | 'Saúde PF'
  | 'Adesão'
  | 'Odontológico'
  | 'Seguro de Vida'
  | 'Seguro Auto'
  | 'Consórcio'
  | 'Outros'
  | 'SAUDE'
  | 'ODONTO'
  | 'VIDA'
  | 'AUTO'

export interface Product {
  id: string
  name: string
  category: ProductCategory
  description?: string
  active?: boolean
  created?: string
  updated?: string
}

export interface CarrierProduct {
  id: string
  carrier_id: string
  product_id: string
  ativo: boolean
  observacoes?: string
}

// ------------------------------------------------------------------------------
// EMPRESAS & CONTATOS
// ------------------------------------------------------------------------------
export interface Company {
  id: string
  trade_name: string // Nome Fantasia
  legal_name?: string // Razão Social
  cnpj?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  segment?: string
  notes?: string
  created_by?: string
  created?: string
  updated?: string
}

export interface Contact {
  id: string
  name: string
  phone: string
  email?: string
  position?: string
  cpf?: string
  is_primary?: boolean
  company_id?: string
  notes?: string
  expand?: {
    company_id?: Company
  }
  created_by?: string
  created?: string
  updated?: string
}

// ------------------------------------------------------------------------------
// FUNIS, ETAPAS & MOTIVOS
// ------------------------------------------------------------------------------
export type PipelineType = 'VENDAS' | 'POS_VENDA'

export type SalesStage =
  | 'Novo Lead'
  | 'Contato realizado'
  | 'Qualificado'
  | 'Cotação'
  | 'Follow-up'
  | 'Negociação'
  | 'Venda ganha'
  | 'Venda perdida'

export type PostSalesStage =
  | 'Documentação'
  | 'Implantação'
  | 'Aguardando pagamento'
  | 'Implantado'
  | 'Cliente ativo'

export interface PipelineStageEntity {
  id: string
  funnel_type: PipelineType
  nome: string
  ordem: number
  e_saida: boolean
  ativo: boolean
}

export type Temperature = 'Frio' | 'Morno' | 'Quente'

export type LostReason =
  | 'Preço'
  | 'Carência'
  | 'Rede hospitalar'
  | 'Concorrência'
  | 'Falta de retorno'
  | 'Decisão adiada'
  | 'Sem interesse'
  | 'Outros'
  | 'Sem retorno'
  | 'Fechou com concorrente'
  | 'Sem CNPJ elegível'
  | 'Quantidade de vidas'
  | 'Rede inadequada'
  | 'Desistiu'
  | 'Outro'

export type HealthObjective =
  | 'Reduzir custo'
  | 'Melhorar rede'
  | 'Trocar operadora'
  | 'Primeiro plano'
  | 'Outro'

export interface HealthData {
  has_current_plan?: boolean
  current_operator?: string
  quoted_operator?: string
  carrier_id?: string
  cnpj?: string
  legal_name?: string
  lives_count?: number
  ages_summary?: string
  city?: string
  state?: string
  current_value?: number
  contract_type?: string // PME Coparticipativo, etc.
  accommodation?: 'Enfermaria' | 'Apartamento' | 'Ambos' | string
  desired_network?: string // Hospitais / laboratórios desejados
  objective?: HealthObjective | string
  hiring_date?: string
  renewal_date?: string
}

export interface MarketingAttribution {
  origem?: string
  midia?: string
  campanha?: string
  campaign_id?: string
  adset?: string
  adset_id?: string
  anuncio?: string
  ad_id?: string
  external_lead_id?: string
  data_aquisicao?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}

export interface PlanSuggestion {
  id: string
  opportunity_id?: string
  carrier_id?: string
  carrier_name: string
  product_name?: string
  categoria?: string
  quoted_monthly_value: number
  is_principal: boolean
  quotation_date?: string
  notes?: string
}

export interface CrmTag {
  id: string
  name: string
  color: string
  bg_color: string
  text_color: string
  is_system?: boolean
  active: boolean
  created_at?: string
}

export interface Opportunity {
  id: string
  title: string
  pipeline_type: PipelineType
  stage: string
  stage_id?: string
  temperature?: Temperature
  contact_id?: string
  company_id?: string
  product_id?: string
  carrier_id?: string // Operadora sugerida principal
  suggested_plan?: string // Plano sugerido
  plan_suggestions?: PlanSuggestion[] // Lista de sugestões de plano cotadas
  current_carrier_id?: string // Operadora atual cadastrada (FK carriers)
  current_carrier_name?: string // Nome da operadora atual quando não cadastrada
  assigned_to?: string // owner_id
  origin?: string
  commercial_origin?: 'kkj' | 'vendedor'
  tags?: string | string[]
  value?: number // Mensalidade Comercial (Cotação Principal)
  sale_value?: number // Mensalidade Comercial (Cotação Principal)
  commission_value?: number // Removido da entrada; apenas retrocompatibilidade
  lives_count?: number
  probability?: number
  expected_close_date?: string
  close_date?: string
  data_fechamento?: string
  lost_details?: string
  notes?: string
  quotation_link?: string
  qualification_notes?: string
  lost_reason?: LostReason | string
  health_data?: HealthData
  attribution?: MarketingAttribution
  expand?: {
    contact_id?: Contact
    company_id?: Company
    product_id?: Product
    carrier_id?: Carrier
    current_carrier_id?: Carrier
    assigned_to?: User
    created_by?: User
  }
  archived_at?: string
  archived_by?: string
  created_by?: string
  created?: string
  updated?: string
}

// ------------------------------------------------------------------------------
// TAREFAS & TIMELINE
// ------------------------------------------------------------------------------
export type TaskType =
  | 'Ligação'
  | 'WhatsApp'
  | 'Follow-up'
  | 'Reunião'
  | 'Cotação'
  | 'Documentação'
  | 'Implantação'
  | 'Cobrança/Pagamento'
  | 'Outro'
  | 'LIGACAO'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'REUNIAO'
  | 'PROPOSTA'
  | 'FOLLOW_UP'
  | 'OUTRO'

export type TaskStatus =
  | 'Pendente'
  | 'Concluída'
  | 'Cancelada'
  | 'CONCLUIDA'
  | 'PENDENTE'
  | 'CANCELADA'

export type TaskPriority =
  | 'Baixa'
  | 'Média'
  | 'Alta'
  | 'Urgente'
  | 'BAIXA'
  | 'MEDIA'
  | 'ALTA'
  | 'URGENTE'

export interface Task {
  id: string
  title: string
  type: TaskType
  due_date: string
  due_time?: string
  status: TaskStatus
  priority?: TaskPriority
  description?: string
  completed_at?: string
  notes?: string
  opportunity_id?: string
  contact_id?: string
  company_id?: string
  assigned_to?: string
  expand?: {
    opportunity_id?: Opportunity
    contact_id?: Contact
    company_id?: Company
    assigned_to?: User
  }
  created_by?: string
  created?: string
  updated?: string
}

export type TimelineActionType =
  | 'NOTA'
  | 'MUDANCA_ETAPA'
  | 'MUDANCA_RESPONSAVEL'
  | 'TAREFA'
  | 'VENDA_CONTRATO'
  | 'SISTEMA'
  | 'nota'
  | 'mudanca_etapa'
  | 'mudanca_responsavel'
  | 'tarefa'
  | 'venda_contrato'
  | 'sistema'
  | 'repescagem'
  | 'reabertura'
  | 'pagamento_confirmado'
  | 'implantado'
  | 'cancelamento_admin'
  | 'pos_venda'

export interface OpportunityTimeline {
  id: string
  opportunity_id: string
  action_type?: TimelineActionType
  action?: string
  title: string
  description?: string
  metadata?: Record<string, unknown>
  expand?: {
    created_by?: User
  }
  created_by?: string
  created?: string
  updated?: string
}

export type OpportunityTimelineAction = OpportunityTimeline

export interface OpportunityAssignment {
  id: string
  opportunity_id: string
  responsavel_anterior_id?: string
  novo_responsavel_id?: string
  alterado_por?: string
  motivo: 'manual' | 'round_robin' | 'redistribuicao'
  observacao?: string
  created_at: string
}

export interface OpportunityStageHistory {
  id: string
  opportunity_id: string
  etapa_anterior_id?: string
  nova_etapa_id: string
  usuario_id?: string
  data_entrada: string
  data_saida?: string
  duracao_segundos?: number
}

// ------------------------------------------------------------------------------
// CONTRATOS & FINANCEIRO SENSÍVEL
// ------------------------------------------------------------------------------
export type ContractStatus = 'Ativo' | 'Cancelado' | 'Em Implantação' | 'Pendente Renovação'

export interface Contract {
  id: string
  contract_number?: string
  opportunity_id?: string
  company_id?: string
  contact_id?: string
  product_id?: string
  carrier_id?: string // FK exclusiva para carriers
  contracted_carrier_name?: string // Operadora Contratada
  contracted_plan_name?: string // Plano Contratado
  monthly_value?: number // Mensalidade Contratada
  sale_value: number // Mensalidade Contratada efetiva
  commission_value?: number // Faturamento KKJ da venda
  lives_count?: number
  operator?: string
  plano?: string
  start_date?: string
  end_date?: string
  first_installment_reference?: string // Referência da 1ª mensalidade
  hiring_date?: string // Data de contratação
  data_vencimento_primeiro_pagamento?: string // Vencimento do 1º boleto / pagamento
  data_confirmacao_pagamento?: string // Data efetiva da confirmação de pagamento
  data_implantacao?: string
  usuario_confirmou_pagamento_id?: string
  usuario_implantacao_id?: string
  primeira_competencia?: string
  billing_day?: number
  notes?: string
  renewal_date?: string
  status: ContractStatus
  assigned_to?: string
  dias_alerta_renovacao?: number[]
  modalidade?: 'PME' | 'PF' | 'Adesão' | string
  expand?: {
    company_id?: Company
    contact_id?: Contact
    product_id?: Product
    carrier_id?: Carrier
    opportunity_id?: Opportunity
    assigned_to?: User
  }
  created_by?: string
  created?: string
  updated?: string
}

export interface AdesaoBoleto {
  id: string
  contract_id: string
  company_id?: string
  contact_id?: string
  vendedor_id?: string
  valor_integral: number
  data_vencimento: string
  data_pagamento?: string
  status: 'pendente' | 'pago' | 'atrasado' | 'estornado' | 'cancelado'
  receita_bruta_kkj: number
  aliquota_imposto: number
  valor_imposto: number
  receita_liquida_kkj: number
  comissao_vendedor_percentual: number
  comissao_vendedor_valor: number
  resultado_liquido_corretora: number
  observacoes?: string
  created_at: string
}

export interface ContractFinancial {
  id: string
  contract_id: string
  faturamento_bruto: number
  comissao_prevista: number
  comissao_recebida: number
  data_prevista_recebimento?: string
  data_efetiva_recebimento?: string
  situacao_recebimento?: string
  impostos_descontos: number
  comissao_liquida: number
  repasse_vendedor: number
  bonificacao_vendedor: number
  resultado_kkj: number
  commission_rule_id?: string
  bonus_campaign_id?: string
  comissao_snapshot?: Record<string, unknown>
  bonificacao_snapshot?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface MeuFinanceiroItem {
  contract_id: string
  numero_contrato: string
  vendedor_id: string
  operadora: string
  plano?: string
  valor_venda: number
  repasse_vendedor: number
  bonificacao_vendedor: number
  total_a_receber: number
  status_contrato: string
  data_inicio_vigencia?: string
  data_pagamento?: string
}

export interface CommissionRule {
  id: string
  nome: string
  carrier_id?: string
  product_id?: string
  modalidade?: string
  tipo_regra: 'percentual' | 'valor_fixo' | 'multiplo' | 'faixas'
  percentual_base?: number
  valor_fixo?: number
  multiplo_mensalidade?: number
  cronograma_parcelas?: Array<{ parcela: number; percentual: number }>
  data_inicio_vigencia: string
  data_fim_vigencia?: string
  ativo: boolean
  observacoes?: string
}

export interface BonusCampaign {
  id: string
  nome: string
  carrier_id?: string
  product_id?: string
  modalidade?: string
  tipo_bonificacao: 'percentual' | 'valor_fixo' | 'multiplo' | 'faixas'
  percentual_bonus?: number
  valor_fixo_bonus?: number
  multiplo_bonus?: number
  faixas_metas?: Array<{ vidas_min: number; bonus: number }>
  data_inicio_vigencia: string
  data_fim_vigencia?: string
  ativo: boolean
  descricao?: string
}

export interface CommissionInstallment {
  id: string
  contract_id: string
  contract_financial_id: string
  numero_parcela: number
  total_parcelas: number
  data_vencimento: string
  valor_previsto: number
  repasse_previsto_vendedor: number
  valor_recebido: number
  repasse_pago_vendedor: number
  data_recebimento?: string
  data_repasse?: string
  status: 'previsto' | 'recebido' | 'repassado' | 'cancelado'
}

export interface MinhasParcelasItem {
  contract_id: string
  numero_contrato: string
  numero_parcela: number
  total_parcelas: number
  data_vencimento: string
  repasse_previsto_vendedor: number
  repasse_pago_vendedor: number
  data_repasse?: string
  status: string
  bonificacao_vendedor: number
  bonificacao_contrato_total?: number
}

// ------------------------------------------------------------------------------
// CAMPOS PERSONALIZADOS (Custom Fields com integridade referencial)
// ------------------------------------------------------------------------------
export type CustomFieldType =
  | 'texto'
  | 'numero'
  | 'moeda'
  | 'data'
  | 'booleano'
  | 'selecao'
  | 'multipla_selecao'

export type CustomFieldTarget = 'oportunidade' | 'contrato'

export interface CustomFieldDefinition {
  id: string
  product_id?: string
  alvo: CustomFieldTarget
  nome: string
  chave: string
  tipo: CustomFieldType
  opcoes?: unknown[]
  obrigatorio: boolean
  ordem: number
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export interface CustomFieldValue {
  id: string
  definition_id: string
  opportunity_id?: string | null
  contract_id?: string | null
  valor: unknown
  created_at?: string
  updated_at?: string
}

// ------------------------------------------------------------------------------
// PÓS-VENDA & CHECKLISTS
// ------------------------------------------------------------------------------
export type PostSaleType =
  | 'Inclusão'
  | 'Exclusão'
  | 'Alteração cadastral'
  | 'Segunda via'
  | 'Autorização'
  | 'Reembolso'
  | 'Rede credenciada'
  | 'Fatura'
  | 'Movimentação empresarial'
  | 'Outro'

export type PostSaleStatus =
  | 'Aberto'
  | 'Em andamento'
  | 'Aguardando cliente'
  | 'Aguardando operadora'
  | 'Concluído'

export interface PostSaleRequest {
  id: string
  protocolo?: string
  contract_id?: string
  company_id?: string
  contact_id?: string
  tipo: PostSaleType
  status: PostSaleStatus
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  prazo?: string
  responsavel_id?: string
  titulo: string
  descricao: string
  data_abertura: string
  data_conclusao?: string
  historico?: Array<Record<string, unknown>>
  created_by?: string
}

export interface DocumentChecklistTemplate {
  id: string
  product_id?: string
  nome_documento: string
  descricao?: string
  obrigatorio: boolean
  ordem: number
  ativo: boolean
}

export interface DocumentChecklistItem {
  id: string
  contract_id?: string
  opportunity_id?: string
  template_id?: string
  nome_documento: string
  status: 'pendente' | 'recebido' | 'nao_se_aplica'
  link_externo?: string
  data_recebimento?: string
  observacao?: string
  responsavel_id?: string
}

// ------------------------------------------------------------------------------
// PREFERÊNCIAS & PERMISSÕES
// ------------------------------------------------------------------------------
export interface UserPreferences {
  id: string
  user_id: string
  theme: 'light' | 'dark' | 'system'
  densidade: 'compacto' | 'normal' | 'confortavel'
  notificacoes: {
    tarefas_email: boolean
    whatsapp_notif: boolean
    leads_novos: boolean
  }
}

export interface Permission {
  id: string
  codigo: string
  nome: string
  descricao?: string
  categoria: string
}

// ------------------------------------------------------------------------------
// WHATSAPP MULTICANAL
// ------------------------------------------------------------------------------
export interface WhatsappChannel {
  id: string
  nome: string
  numero_telefone: string
  provedor: string
  ativo: boolean
  metadata?: Record<string, unknown>
}

export interface MessageTemplate {
  id: string
  nome: string
  conteudo: string
  descricao?: string
  modo_disparo: 'desligado' | 'aprovacao' | 'automatico'
  ativo: boolean
}

export interface Conversation {
  id: string
  channel_id?: string
  phone_number_id?: string
  remote_jid: string
  contact_id?: string
  opportunity_id?: string
  responsible_user_id?: string
  status: string
  nao_lidas: number
}

export interface Message {
  id: string
  conversation_id: string
  external_message_id?: string
  direction: 'incoming' | 'outgoing'
  conteudo: string
  status_entrega: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  user_id?: string
  metadata?: Record<string, unknown>
  created_at: string
}
