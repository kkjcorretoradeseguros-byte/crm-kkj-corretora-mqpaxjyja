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
  tipo?: string | null
  type?: TaskType
  titulo?: string | null
  title?: string | null
  descricao?: string | null
  description?: string | null
  due_date: string
  due_time?: string | null
  priority?: TaskPriority
  status: string
  assignee_id?: string | null
  assigned_to?: string | null
  completed_at?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
  opportunities?: {
    id: string
    titulo?: string | null
    title?: string | null
    status?: string | null
    funnel_type?: string | null
  } | null
  contacts?: {
    id: string
    nome?: string | null
    name?: string | null
    celular?: string | null
    phone?: string | null
    email?: string | null
  } | null
  companies?: {
    id: string
    nome_fantasia?: string | null
    trade_name?: string | null
    razao_social?: string | null
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
  tipo,
  titulo,
  descricao,
  due_date,
  due_time,
  assignee_id,
  status,
  created_by,
  created_at,
  updated_at,
  opportunities:opportunity_id(id, titulo, funnel_type, status),
  profiles:assignee_id(id, nome, email)
`

function mapTaskRow(r: TaskDbRow): Task {
  // Mapear status enum 0001 ('pendente', 'concluida', 'cancelada') para formato UI
  const rawStatus = (r.status || 'pendente').toLowerCase()
  let uiStatus: TaskStatus = 'Pendente'
  if (rawStatus === 'concluida' || rawStatus === 'concluída') uiStatus = 'Concluída'
  if (rawStatus === 'cancelada') uiStatus = 'Cancelada'

  // Mapear tipo slug 0001 ('ligacao', 'whatsapp', 'follow_up', etc.)
  const rawType = (r.tipo || r.type || 'follow_up').toLowerCase()
  let uiType: TaskType = 'Follow-up'
  if (rawType === 'ligacao') uiType = 'Ligação'
  else if (rawType === 'whatsapp') uiType = 'WhatsApp'
  else if (rawType === 'reuniao') uiType = 'Reunião'
  else if (rawType === 'cotacao') uiType = 'Cotação'
  else if (rawType === 'documentacao') uiType = 'Documentação'
  else if (rawType === 'implantacao') uiType = 'Implantação'
  else if (rawType === 'cobranca_pagamento') uiType = 'Cobrança/Pagamento'
  else if (rawType === 'outro') uiType = 'Outro'

  const t: Task = {
    id: r.id,
    opportunity_id: r.opportunity_id || undefined,
    type: uiType,
    title: r.titulo || r.title || 'Tarefa',
    description: r.descricao || r.description || undefined,
    due_date: r.due_date,
    due_time: r.due_time || undefined,
    priority: r.priority || 'Média',
    status: uiStatus,
    assigned_to: r.assignee_id || r.assigned_to || undefined,
    completed_at: r.completed_at || undefined,
    notes: r.notes || undefined,
    created: r.created_at || new Date().toISOString(),
    updated: r.updated_at || new Date().toISOString(),
  }

  t.expand = {}
  if (r.opportunities) {
    t.expand.opportunity_id = {
      id: r.opportunities.id,
      title: r.opportunities.titulo || r.opportunities.title || '',
      company_id: '',
      stage: '',
      pipeline_type: r.opportunities.funnel_type === 'pos_venda' ? 'POS_VENDA' : 'VENDAS',
      value: 0,
      created: r.created_at || new Date().toISOString(),
      updated: r.updated_at || new Date().toISOString(),
    } as Opportunity
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
        const sVal =
          options.status === 'Concluída'
            ? 'concluida'
            : options.status === 'Cancelada'
              ? 'cancelada'
              : 'pendente'
        query = query.eq('status', sVal)
      }
      if (options.opportunityId) {
        query = query.eq('opportunity_id', options.opportunityId)
      }
      if (options.assignedTo) {
        query = query.eq('assignee_id', options.assignedTo)
      }

      const todayStr = new Date().toISOString().slice(0, 10)
      if (options.dateFilter === 'HOJE') {
        query = query.eq('due_date', todayStr)
      } else if (options.dateFilter === 'ATRASADAS') {
        query = query.lt('due_date', todayStr).eq('status', 'pendente')
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

    // Converter tipo da UI para slug do enum 0001
    const tSlugMap: Record<string, string> = {
      Ligação: 'ligacao',
      LIGACAO: 'ligacao',
      WhatsApp: 'whatsapp',
      WHATSAPP: 'whatsapp',
      'Follow-up': 'follow_up',
      FOLLOW_UP: 'follow_up',
      Reunião: 'reuniao',
      REUNIAO: 'reuniao',
      Cotação: 'cotacao',
      Documentação: 'documentacao',
      Implantação: 'implantacao',
      'Cobrança/Pagamento': 'cobranca_pagamento',
      Outro: 'outro',
      OUTRO: 'outro',
    }
    const slug = (data.type && tSlugMap[data.type]) || 'follow_up'

    const { data: created, error } = await supabase
      .from('tasks')
      .insert({
        opportunity_id: data.opportunity_id || null,
        tipo: slug,
        titulo: data.title || 'Tarefa',
        descricao: data.description || null,
        due_date: data.due_date || new Date().toISOString().slice(0, 10),
        due_time: data.due_time || null,
        assignee_id: assignedTo,
        status: 'pendente',
      })
      .select(SELECT_TASK_EXPAND)
      .single()

    if (error || !created) {
      throw new Error(error?.message || 'Falha ao criar tarefa')
    }

    const task = mapTaskRow(created as unknown as TaskDbRow)

    if (task.opportunity_id) {
      try {
        // Schema 0001: tipo_evento, conteudo, dados_adicionais, user_id
        await supabase.from('opportunity_timeline').insert({
          opportunity_id: task.opportunity_id,
          tipo_evento: 'tarefa_criada',
          conteudo: `Tarefa agendada: ${task.type} - ${task.title} (Vencimento: ${task.due_date}${task.due_time ? ` às ${task.due_time}` : ''})`,
          dados_adicionais: {
            task_id: task.id,
            tipo_tarefa: task.type,
            due_date: task.due_date,
            due_time: task.due_time,
            assignee_id: task.assigned_to,
          },
          user_id: currentUserId,
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
    if (data.title !== undefined) payload.titulo = data.title
    if (data.description !== undefined) payload.descricao = data.description || null
    if (data.due_date !== undefined) payload.due_date = data.due_date
    if (data.due_time !== undefined) payload.due_time = data.due_time || null
    if (data.status !== undefined) {
      payload.status =
        data.status === 'Concluída'
          ? 'concluida'
          : data.status === 'Cancelada'
            ? 'cancelada'
            : 'pendente'
    }
    if (data.assigned_to !== undefined) payload.assignee_id = data.assigned_to || null

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

    if (mapped.opportunity_id) {
      try {
        if (data.status === 'Concluída') {
          await supabase.from('opportunity_timeline').insert({
            opportunity_id: mapped.opportunity_id,
            tipo_evento: 'tarefa_concluida',
            conteudo: `Tarefa concluída: ${mapped.title}`,
            dados_adicionais: { task_id: mapped.id, tipo_tarefa: mapped.type },
            user_id: currentUserId,
          })
        } else if (data.status === 'Cancelada') {
          await supabase.from('opportunity_timeline').insert({
            opportunity_id: mapped.opportunity_id,
            tipo_evento: 'tarefa_cancelada',
            conteudo: `Tarefa cancelada: ${mapped.title}`,
            dados_adicionais: { task_id: mapped.id, tipo_tarefa: mapped.type },
            user_id: currentUserId,
          })
        } else if (data.title || data.due_date || data.assigned_to) {
          await supabase.from('opportunity_timeline').insert({
            opportunity_id: mapped.opportunity_id,
            tipo_evento: 'tarefa_alterada',
            conteudo: `Tarefa alterada: ${mapped.title}`,
            dados_adicionais: {
              task_id: mapped.id,
              due_date: mapped.due_date,
              assignee_id: mapped.assigned_to,
            },
            user_id: currentUserId,
          })
        }
      } catch (tlErr) {
        console.warn('Falha ao registrar alteração de tarefa na timeline:', tlErr)
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
