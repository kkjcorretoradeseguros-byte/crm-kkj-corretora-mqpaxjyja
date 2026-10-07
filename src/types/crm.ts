export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  created?: string
  updated?: string
}

export type PropertyType = 'Apartamento' | 'Casa' | 'Terreno' | 'Comercial' | 'Cobertura'
export type TransactionType = 'Venda' | 'Aluguel'
export type PropertyStatus = 'Disponível' | 'Vendido' | 'Alugado' | 'Reservado'

export interface Property {
  id: string
  title: string
  description?: string
  type: PropertyType
  transaction_type: TransactionType
  price: number
  condominium_fee?: number
  iptu?: number
  area_m2?: number
  bedrooms?: number
  bathrooms?: number
  parking_spots?: number
  address_street?: string
  address_number?: string
  address_neighborhood?: string
  address_city?: string
  address_state?: string
  address_cep?: string
  status: PropertyStatus
  photos?: string[]
  created_by?: string
  created?: string
  updated?: string
}

export type ClientStatus = 'Ativo' | 'Inativo' | 'Interessado'

export interface Client {
  id: string
  full_name: string
  phone: string
  email?: string
  status: ClientStatus
  notes?: string
  interested_properties?: string[]
  expand?: {
    interested_properties?: Property[]
  }
  created_by?: string
  created?: string
  updated?: string
}

export type InteractionType = 'E-mail' | 'Telefone' | 'Visita' | 'Reunião' | 'WhatsApp'

export interface Interaction {
  id: string
  client_id: string
  type: InteractionType
  notes: string
  interaction_date: string
  follow_up_date?: string
  expand?: {
    client_id?: Client
  }
  created_by?: string
  created?: string
  updated?: string
}

export interface PipelineStage {
  id: string
  name: string
  position: number
  color?: string
  created_by?: string
  created?: string
  updated?: string
}

export interface PipelineEntry {
  id: string
  stage_id: string
  client_id: string
  property_id?: string
  value?: number
  notes?: string
  expand?: {
    stage_id?: PipelineStage
    client_id?: Client
    property_id?: Property
  }
  created_by?: string
  created?: string
  updated?: string
}
