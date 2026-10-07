export type UserRole = 'ADMINISTRADOR' | 'GESTOR' | 'VENDEDOR'

export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  role?: UserRole
  created?: string
  updated?: string
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

export interface Product {
  id: string
  name: string
  category: ProductCategory
  description?: string
  active?: boolean
  created?: string
  updated?: string
}

export interface Company {
  id: string
  trade_name: string // Nome Fantasia
  legal_name?: string // Razão Social
  cnpj?: string
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
  company_id?: string
  notes?: string
  expand?: {
    company_id?: Company
  }
  created_by?: string
  created?: string
  updated?: string
}

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

export type Temperature = 'Frio' | 'Morno' | 'Quente'

export type LostReason =
  | 'Preço'
  | 'Sem retorno'
  | 'Fechou com concorrente'
  | 'Sem CNPJ elegível'
  | 'Quantidade de vidas'
  | 'Carência'
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

export interface Opportunity {
  id: string
  title: string
  pipeline_type: PipelineType
  stage: string
  temperature: Temperature
  contact_id?: string
  company_id?: string
  product_id?: string
  assigned_to?: string
  origin?: string
  tags?: string
  sale_value?: number // Mensalidade / Valor do produto
  commission_value?: number // Faturamento estimado para KKJ
  quotation_link?: string
  qualification_notes?: string
  lost_reason?: LostReason | string
  health_data?: HealthData
  expand?: {
    contact_id?: Contact
    company_id?: Company
    product_id?: Product
    assigned_to?: User
    created_by?: User
  }
  created_by?: string
  created?: string
  updated?: string
}

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

export type TaskStatus = 'Pendente' | 'Concluída' | 'Cancelada'

export interface Task {
  id: string
  title: string
  type: TaskType
  due_date: string
  due_time?: string
  status: TaskStatus
  notes?: string
  opportunity_id?: string
  assigned_to?: string
  expand?: {
    opportunity_id?: Opportunity
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

export interface OpportunityTimeline {
  id: string
  opportunity_id: string
  action_type: TimelineActionType
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

export type ContractStatus = 'Ativo' | 'Cancelado' | 'Em Implantação' | 'Pendente Renovação'

export interface Contract {
  id: string
  contract_number?: string
  opportunity_id?: string
  company_id?: string
  contact_id?: string
  product_id?: string
  sale_value: number // Valor vendido / Mensalidade
  commission_value?: number // Faturamento da KKJ
  lives_count?: number
  operator?: string
  start_date?: string
  renewal_date?: string
  status: ContractStatus
  assigned_to?: string
  expand?: {
    company_id?: Company
    contact_id?: Contact
    product_id?: Product
    opportunity_id?: Opportunity
    assigned_to?: User
  }
  created_by?: string
  created?: string
  updated?: string
}
