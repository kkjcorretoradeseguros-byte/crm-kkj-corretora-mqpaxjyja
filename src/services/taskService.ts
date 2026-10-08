import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type {
  Task,
  TaskType,
  TaskPriority,
  TaskStatus,
  Opportunity,
  Contact,
  Company,
  User,
} from '@/types/crm'

export interface TaskFilterOptions {
  page?: number
  perPage?: number
  status?: TaskStatus | 'TODOS'
  opportunityId?: string
  assignedTo?: string
  dateFilter?: 'HOJE' | 'ATRASADAS' | 'PROXIMAS' | 'TODAS'
}

interface TaskDbRow {
  id: string
  opportunity_id?: string | null
  company_id?: string | null
  contact_id?: string | null
  type: TaskType
  title: string
  description?: string | null
  due_date: string
  due_time?: string | null
  priority: TaskPriority
  status: TaskStatus
  assigned_to?: string | null
  completed_at?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
  opportunities?: {
    id: string
    title: string
    stage: string
    pipeline_type: string
  } | null
  contacts?: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
  } | null
  companies?: {
    id: string
    trade_name: string
    legal_name?: string | null
  } | null
  profiles?: {
    id: string
    nome: string
    email: string
  } | null
}

const SELECT_TASK_EXPAND = `
  id,
  opportunity_id,
  company_id,
  contact_id,
  type,
  title,
  description,
  due_date,
  due_time,
  priority,
  status,
  assigned_to,
  completed_at,
  notes,
  created_at,
  updated_at,
  opportunities:opportunity_id(id, title, stage, pipeline_type),
  contacts:contact_id(id, name, phone, email),
  companies:company_id(id, trade_name, legal_name),
  profiles:assigned_to(id, nome, email)
`

function mapTaskRow(r: TaskDbRow): Task {
  const t: Task = {
    id: r.id,
    opportunity_id: r.opportunity_id || undefined,
    contact_id: r.contact_id || undefined,
    type: r.type,
    title: r.title,
    description: r.description || undefined,
    due_date: r.due_date,
    due_time: r.due_time || undefined,
    priority: r.priority,
    status: r.status,
    assigned_to: r.assigned_to || undefined,
    completed_at: r.completed_at || undefined,
    notes: r.notes || undefined,
    created: r.created_at || new Date().toISOString(),
    updated: r.updated_at || new Date().toISOString(),
  }

  t.expand = {}
  if (r.opportunities) {
    t.expand.opportunity_id = {
      id: r.opportunities.id,
      title: r.opportunities.title,
      company_id: r.company_id || '',
      stage: r.opportunities.stage,
      pipeline_type: r.opportunities.pipeline_type as 'VENDAS' | 'POS_VENDA',
      value: 0,
      created: r.created_at || new Date().toISOString(),
      updated: r.updated_at || new Date().toISOString(),
    } as Opportunity
  }
  if (r.contacts) {
    t.expand.contact_id = {
      id: r.contacts.id,
      company_id: r.company_id || '',
      name: r.contacts.name,
      phone: r.contacts.phone || undefined,
      email: r.contacts.email || undefined,
    } as Contact
  }
  if (r.companies) {
    t.expand.company_id = {
      id: r.companies.id,
      trade_name: r.companies.trade_name,
      legal_name: r.companies.legal_name || undefined,
    } as Company
  }
  if (r.profiles) {
    t.expand.assigned_to = {
      id: r.profiles.id,
      name: r.profiles.nome,
      email: r.profiles.email,
      role: 'vendedor',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    } as User
  }

  return t
}

export const taskService = {
  async getTasks(options: TaskFilterOptions = {}) {
    if (!isSupabaseConfigured) {
      return { items: [] as Task[], totalItems: 0, totalPages: 0, page: 1, perPage: 100 }
    }

    const page = options.page || 1
    const perPage = options.perPage || 100
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    try {
      let query = supabase.from('tasks').select(SELECT_TASK_EXPAND, { count: 'exact' })

      if (options.status && options.status !== 'TODOS') {
        query = query.eq('status', options.status)
      }
      if (options.opportunityId) {
        query = query.eq('opportunity_id', options.opportunityId)
      }
      if (options.assignedTo) {
        query = query.eq('assigned_to', options.assignedTo)
      }

      const todayStr = new Date().toISOString().slice(0, 10)
      if (options.dateFilter === 'HOJE') {
        query = query.eq('due_date', todayStr)
      } else if (options.dateFilter === 'ATRASADAS') {
        query = query.lt('due_date', todayStr).eq('status', 'Pendente')
      } else if (options.dateFilter === 'PROXIMAS') {
        query = query.gt('due_date', todayStr)
      }

      query = query.order('due_date', { ascending: true }).range(from, to)

      const { data, count, error } = await query
      if (error) {
        console.warn('Erro ao consultar tarefas do Supabase:', error.message)
        return { items: [] as Task[], totalItems: 0, totalPages: 0, page, perPage }
      }

      const totalItems = count || 0
      const totalPages = Math.ceil(totalItems / perPage)
      const items = ((data || []) as unknown as TaskDbRow[]).map(mapTaskRow)

      return { items, totalItems, totalPages, page, perPage }
    } catch {
      return { items: [] as Task[], totalItems: 0, totalPages: 0, page, perPage }
    }
  },

  async getAllTasks(): Promise<Task[]> {
    if (!isSupabaseConfigured) return []

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(SELECT_TASK_EXPAND)
        .order('due_date', { ascending: true })

      if (error) {
        console.warn('Erro ao listar todas tarefas:', error.message)
        return []
      }
      return ((data || []) as unknown as TaskDbRow[]).map(mapTaskRow)
    } catch {
      return []
    }
  },

  async getTasksByOpportunity(opportunityId: string): Promise<Task[]> {
    if (!isSupabaseConfigured || !opportunityId) return []

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(SELECT_TASK_EXPAND)
        .eq('opportunity_id', opportunityId)
        .order('due_date', { ascending: true })

      if (error) {
        console.warn('Erro ao listar tarefas da oportunidade:', error.message)
        return []
      }
      return ((data || []) as unknown as TaskDbRow[]).map(mapTaskRow)
    } catch {
      return []
    }
  },

  async getNextTaskForOpportunity(opportunityId: string): Promise<Task | null> {
    if (!isSupabaseConfigured || !opportunityId) return null

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(SELECT_TASK_EXPAND)
        .eq('opportunity_id', opportunityId)
        .eq('status', 'Pendente')
        .order('due_date', { ascending: true })
        .limit(1)

      if (error || !data || data.length === 0) return null
      return mapTaskRow(data[0] as unknown as TaskDbRow)
    } catch {
      return null
    }
  },

  async createTask(data: Partial<Task>): Promise<Task> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const assignedTo = data.assigned_to || currentUserId

    const { data: created, error } = await supabase
      .from('tasks')
      .insert({
        opportunity_id: data.opportunity_id || null,
        company_id: (data as { company_id?: string }).company_id || null,
        contact_id: data.contact_id || null,
        type: data.type || 'LIGACAO',
        title: data.title || '',
        description: data.description || null,
        due_date: data.due_date || new Date().toISOString().slice(0, 10),
        due_time: data.due_time || null,
        priority: data.priority || 'Média',
        status: data.status || 'Pendente',
        assigned_to: assignedTo,
        notes: data.notes || null,
      })
      .select(SELECT_TASK_EXPAND)
      .single()

    if (error || !created) {
      throw new Error(error?.message || 'Falha ao criar tarefa')
    }

    const task = mapTaskRow(created as unknown as TaskDbRow)

    if (task.opportunity_id) {
      try {
        await supabase.from('opportunity_timeline').insert({
          opportunity_id: task.opportunity_id,
          action: 'TASK_CREATED',
          title: `Tarefa criada: ${task.type} - ${task.title}`,
          description: `Vencimento: ${task.due_date}${task.due_time ? ` às ${task.due_time}` : ''}`,
          created_by: currentUserId,
        })
      } catch (tlErr) {
        console.warn('Falha ao registrar criação de tarefa na timeline:', tlErr)
      }
    }

    return task
  },

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id || null

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (data.opportunity_id !== undefined) payload.opportunity_id = data.opportunity_id || null
    if (data.contact_id !== undefined) payload.contact_id = data.contact_id || null
    if (data.type !== undefined) payload.type = data.type
    if (data.title !== undefined) payload.title = data.title
    if (data.description !== undefined) payload.description = data.description || null
    if (data.due_date !== undefined) payload.due_date = data.due_date
    if (data.due_time !== undefined) payload.due_time = data.due_time || null
    if (data.priority !== undefined) payload.priority = data.priority
    if (data.status !== undefined) {
      payload.status = data.status
      if (data.status === 'Concluída') {
        payload.completed_at = new Date().toISOString()
      }
    }
    if (data.assigned_to !== undefined) payload.assigned_to = data.assigned_to || null
    if (data.notes !== undefined) payload.notes = data.notes || null

    const { data: updated, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select(SELECT_TASK_EXPAND)
      .single()

    if (error || !updated) {
      throw new Error(error?.message || 'Falha ao atualizar tarefa')
    }

    const mapped = mapTaskRow(updated as unknown as TaskDbRow)

    if (data.status === 'Concluída' && mapped.opportunity_id) {
      try {
        await supabase.from('opportunity_timeline').insert({
          opportunity_id: mapped.opportunity_id,
          action: 'TASK_COMPLETED',
          title: `Tarefa Concluída: ${mapped.title}`,
          description: `Tarefa do tipo ${mapped.type} marcada como concluída.`,
          created_by: currentUserId,
        })
      } catch (tlErr) {
        console.warn('Falha ao registrar conclusão de tarefa na timeline:', tlErr)
      }
    }

    return mapped
  },

  async deleteTask(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false

    const { error } = await supabase.from('tasks').delete().eq('id', id)
    return !error
  },
}
