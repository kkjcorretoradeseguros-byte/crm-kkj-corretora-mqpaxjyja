import pb from '@/lib/pocketbase/client'
import type { Client, ClientStatus } from '@/types/crm'

export interface ClientFilterOptions {
  status?: ClientStatus | 'ALL'
  search?: string
  page?: number
  perPage?: number
}

export const clientService = {
  async getClients(options: ClientFilterOptions = {}) {
    const { status, search, page = 1, perPage = 50 } = options

    const filterParts: string[] = []

    if (status && status !== 'ALL') {
      filterParts.push(`status = '${status}'`)
    }
    if (search && search.trim()) {
      const q = search.trim().replace(/'/g, "\\'")
      filterParts.push(`(full_name ~ '${q}' || email ~ '${q}' || phone ~ '${q}' || notes ~ '${q}')`)
    }

    const filter = filterParts.join(' && ')

    return await pb.collection('clients').getList<Client>(page, perPage, {
      filter,
      sort: '-created',
      expand: 'interested_properties',
    })
  },

  async getAllClients() {
    return await pb.collection('clients').getFullList<Client>({
      sort: 'full_name',
      expand: 'interested_properties',
    })
  },

  async getClientById(id: string) {
    return await pb.collection('clients').getOne<Client>(id, {
      expand: 'interested_properties',
    })
  },

  async createClient(data: Partial<Client>) {
    return await pb.collection('clients').create<Client>(data)
  },

  async updateClient(id: string, data: Partial<Client>) {
    return await pb.collection('clients').update<Client>(id, data)
  },

  async deleteClient(id: string) {
    return await pb.collection('clients').delete(id)
  },
}
