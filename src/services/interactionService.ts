import pb from '@/lib/pocketbase/client'
import type { Interaction, InteractionType } from '@/types/crm'

export interface InteractionFilterOptions {
  clientId?: string
  type?: InteractionType | 'ALL'
  page?: number
  perPage?: number
}

export const interactionService = {
  async getInteractions(options: InteractionFilterOptions = {}) {
    const { clientId, type, page = 1, perPage = 50 } = options

    const filterParts: string[] = []

    if (clientId) {
      filterParts.push(`client_id = '${clientId}'`)
    }
    if (type && type !== 'ALL') {
      filterParts.push(`type = '${type}'`)
    }

    const filter = filterParts.join(' && ')

    return await pb.collection('interactions').getList<Interaction>(page, perPage, {
      filter,
      sort: '-interaction_date',
      expand: 'client_id',
    })
  },

  async getAllInteractions() {
    return await pb.collection('interactions').getFullList<Interaction>({
      sort: '-interaction_date',
      expand: 'client_id',
    })
  },

  async getInteractionsByClient(clientId: string) {
    return await pb.collection('interactions').getFullList<Interaction>({
      filter: `client_id = '${clientId}'`,
      sort: '-interaction_date',
    })
  },

  async createInteraction(data: Partial<Interaction>) {
    return await pb.collection('interactions').create<Interaction>(data)
  },

  async updateInteraction(id: string, data: Partial<Interaction>) {
    return await pb.collection('interactions').update<Interaction>(id, data)
  },

  async deleteInteraction(id: string) {
    return await pb.collection('interactions').delete(id)
  },
}
