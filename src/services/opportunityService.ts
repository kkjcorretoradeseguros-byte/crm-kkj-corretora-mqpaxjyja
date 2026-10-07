import pb from '@/lib/pocketbase/client'
import type {
  Opportunity,
  OpportunityTimeline,
  PipelineType,
  Temperature,
  LostReason,
} from '@/types/crm'

export interface OpportunityFilterOptions {
  page?: number
  perPage?: number
  search?: string
  pipelineType?: PipelineType
  stage?: string
  assignedTo?: string
  companyId?: string
}

export const opportunityService = {
  async getOpportunities(options: OpportunityFilterOptions = {}) {
    const page = options.page || 1
    const perPage = options.perPage || 100
    const filters: string[] = []

    if (options.pipelineType) {
      filters.push(`pipeline_type = "${options.pipelineType}"`)
    }

    if (options.stage) {
      filters.push(`stage = "${options.stage}"`)
    }

    if (options.assignedTo) {
      filters.push(`assigned_to = "${options.assignedTo}"`)
    }

    if (options.companyId) {
      filters.push(`company_id = "${options.companyId}"`)
    }

    if (options.search) {
      filters.push(
        `(title ~ "${options.search}" || tags ~ "${options.search}" || origin ~ "${options.search}")`,
      )
    }

    const filterString = filters.join(' && ')

    return await pb.collection('opportunities').getList<Opportunity>(page, perPage, {
      filter: filterString || undefined,
      sort: '-updated',
      expand: 'contact_id,company_id,product_id,assigned_to',
    })
  },

  async getAllOpportunities(pipelineType?: PipelineType): Promise<Opportunity[]> {
    const filter = pipelineType ? `pipeline_type = "${pipelineType}"` : undefined
    return await pb.collection('opportunities').getFullList<Opportunity>({
      filter,
      sort: '-updated',
      expand: 'contact_id,company_id,product_id,assigned_to',
    })
  },

  async getOpportunityById(id: string): Promise<Opportunity> {
    return await pb.collection('opportunities').getOne<Opportunity>(id, {
      expand: 'contact_id,company_id,product_id,assigned_to,created_by',
    })
  },

  async createOpportunity(data: Partial<Opportunity>): Promise<Opportunity> {
    const currentUserId = pb.authStore.record?.id
    const opp = await pb.collection('opportunities').create<Opportunity>({
      ...data,
      created_by: currentUserId,
      assigned_to: data.assigned_to || currentUserId,
    })

    // Log creation on timeline
    try {
      await pb.collection('opportunity_timeline').create<OpportunityTimeline>({
        opportunity_id: opp.id,
        action_type: 'SISTEMA',
        title: 'Oportunidade Criada',
        description: `Oportunidade "${opp.title}" inserida na etapa ${opp.stage} (${opp.pipeline_type === 'VENDAS' ? 'Funil de Vendas' : 'Pós-Venda'}).`,
        created_by: currentUserId,
      })
    } catch (err) {
      console.warn('Failed to auto-log timeline:', err)
    }

    return opp
  },

  async updateOpportunity(
    id: string,
    data: Partial<Opportunity>,
    logTitle?: string,
  ): Promise<Opportunity> {
    const currentUserId = pb.authStore.record?.id
    const updated = await pb.collection('opportunities').update<Opportunity>(id, data)

    if (logTitle) {
      try {
        await pb.collection('opportunity_timeline').create<OpportunityTimeline>({
          opportunity_id: id,
          action_type: 'SISTEMA',
          title: logTitle,
          created_by: currentUserId,
        })
      } catch {
        /* intentionally ignored */
      }
    }

    return updated
  },

  async updateStage(
    id: string,
    newStage: string,
    previousStage?: string,
    lostReason?: LostReason | string,
  ): Promise<Opportunity> {
    const currentUserId = pb.authStore.record?.id
    const dataToUpdate: Partial<Opportunity> = { stage: newStage }

    if (newStage === 'Venda perdida') {
      dataToUpdate.lost_reason = lostReason || 'Outro'
    }

    const updated = await pb.collection('opportunities').update<Opportunity>(id, dataToUpdate)

    // Audit on timeline
    try {
      await pb.collection('opportunity_timeline').create<OpportunityTimeline>({
        opportunity_id: id,
        action_type: 'MUDANCA_ETAPA',
        title: `Etapa alterada: ${previousStage ? `${previousStage} → ` : ''}${newStage}`,
        description:
          newStage === 'Venda perdida'
            ? `Motivo da perda: ${lostReason || 'Não informado'}`
            : undefined,
        metadata: {
          previousStage,
          newStage,
          lostReason,
        },
        created_by: currentUserId,
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  async updateAssigned(
    id: string,
    newAssignedId: string,
    assignedName?: string,
  ): Promise<Opportunity> {
    const currentUserId = pb.authStore.record?.id
    const updated = await pb.collection('opportunities').update<Opportunity>(id, {
      assigned_to: newAssignedId,
    })

    try {
      await pb.collection('opportunity_timeline').create<OpportunityTimeline>({
        opportunity_id: id,
        action_type: 'MUDANCA_RESPONSAVEL',
        title: `Responsável alterado para ${assignedName || 'novo usuário'}`,
        created_by: currentUserId,
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  async deleteOpportunity(id: string): Promise<boolean> {
    return await pb.collection('opportunities').delete(id)
  },

  // Timeline methods
  async getTimeline(opportunityId: string): Promise<OpportunityTimeline[]> {
    return await pb.collection('opportunity_timeline').getFullList<OpportunityTimeline>({
      filter: `opportunity_id = "${opportunityId}"`,
      sort: '-created',
      expand: 'created_by',
    })
  },

  async addTimelineNote(opportunityId: string, noteText: string): Promise<OpportunityTimeline> {
    const currentUserId = pb.authStore.record?.id
    return await pb.collection('opportunity_timeline').create<OpportunityTimeline>({
      opportunity_id: opportunityId,
      action_type: 'NOTA',
      title: 'Nota do corretor',
      description: noteText,
      created_by: currentUserId,
    })
  },
}
