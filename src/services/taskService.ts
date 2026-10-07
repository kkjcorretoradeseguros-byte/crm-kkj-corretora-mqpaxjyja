import pb from '@/lib/pocketbase/client'
import type { Task, TaskStatus, TaskType } from '@/types/crm'

export interface TaskFilterOptions {
  page?: number
  perPage?: number
  status?: TaskStatus | 'TODOS'
  opportunityId?: string
  assignedTo?: string
  dateFilter?: 'HOJE' | 'ATRASADAS' | 'PROXIMAS' | 'TODAS'
}

export const taskService = {
  async getTasks(options: TaskFilterOptions = {}) {
    const page = options.page || 1
    const perPage = options.perPage || 100
    const filters: string[] = []

    if (options.status && options.status !== 'TODOS') {
      filters.push(`status = "${options.status}"`)
    }

    if (options.opportunityId) {
      filters.push(`opportunity_id = "${options.opportunityId}"`)
    }

    if (options.assignedTo) {
      filters.push(`assigned_to = "${options.assignedTo}"`)
    }

    const todayStr = new Date().toISOString().slice(0, 10)

    if (options.dateFilter === 'HOJE') {
      filters.push(`due_date ~ "${todayStr}"`)
    } else if (options.dateFilter === 'ATRASADAS') {
      filters.push(`due_date < "${todayStr}" && status = "Pendente"`)
    } else if (options.dateFilter === 'PROXIMAS') {
      filters.push(`due_date > "${todayStr}"`)
    }

    const filterString = filters.join(' && ')

    return await pb.collection('tasks').getList<Task>(page, perPage, {
      filter: filterString || undefined,
      sort: 'due_date,due_time',
      expand: 'opportunity_id,assigned_to',
    })
  },

  async getAllTasks(): Promise<Task[]> {
    return await pb.collection('tasks').getFullList<Task>({
      sort: 'due_date,due_time',
      expand: 'opportunity_id,assigned_to',
    })
  },

  async getTasksByOpportunity(opportunityId: string): Promise<Task[]> {
    return await pb.collection('tasks').getFullList<Task>({
      filter: `opportunity_id = "${opportunityId}"`,
      sort: 'due_date,due_time',
      expand: 'assigned_to',
    })
  },

  async getNextTaskForOpportunity(opportunityId: string): Promise<Task | null> {
    const list = await pb.collection('tasks').getList<Task>(1, 1, {
      filter: `opportunity_id = "${opportunityId}" && status = "Pendente"`,
      sort: 'due_date,due_time',
    })
    return list.items[0] || null
  },

  async createTask(data: Partial<Task>): Promise<Task> {
    const currentUserId = pb.authStore.record?.id
    const task = await pb.collection('tasks').create<Task>({
      ...data,
      created_by: currentUserId,
      assigned_to: data.assigned_to || currentUserId,
    })

    if (task.opportunity_id) {
      try {
        await pb.collection('opportunity_timeline').create({
          opportunity_id: task.opportunity_id,
          action_type: 'TAREFA',
          title: `Tarefa criada: ${task.type} - ${task.title}`,
          description: `Vencimento: ${task.due_date}${task.due_time ? ` às ${task.due_time}` : ''}`,
          created_by: currentUserId,
        })
      } catch {
        /* intentionally ignored */
      }
    }

    return task
  },

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    const updated = await pb.collection('tasks').update<Task>(id, data)

    if (data.status === 'Concluída' && updated.opportunity_id) {
      try {
        await pb.collection('opportunity_timeline').create({
          opportunity_id: updated.opportunity_id,
          action_type: 'TAREFA',
          title: `Tarefa Concluída: ${updated.title}`,
          created_by: pb.authStore.record?.id,
        })
      } catch {
        /* intentionally ignored */
      }
    }

    return updated
  },

  async deleteTask(id: string): Promise<boolean> {
    return await pb.collection('tasks').delete(id)
  },
}
