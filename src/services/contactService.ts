import pb from '@/lib/pocketbase/client'
import type { Contact } from '@/types/crm'

export interface ContactFilterOptions {
  page?: number
  perPage?: number
  search?: string
  companyId?: string
}

export const contactService = {
  async getContacts(options: ContactFilterOptions = {}) {
    const page = options.page || 1
    const perPage = options.perPage || 50
    const filters: string[] = []

    if (options.search) {
      filters.push(
        `(name ~ "${options.search}" || phone ~ "${options.search}" || email ~ "${options.search}" || position ~ "${options.search}")`,
      )
    }

    if (options.companyId) {
      filters.push(`company_id = "${options.companyId}"`)
    }

    const filterString = filters.join(' && ')

    return await pb.collection('contacts').getList<Contact>(page, perPage, {
      filter: filterString || undefined,
      sort: 'name',
      expand: 'company_id',
    })
  },

  async getAllContacts(): Promise<Contact[]> {
    return await pb.collection('contacts').getFullList<Contact>({
      sort: 'name',
      expand: 'company_id',
    })
  },

  async getContactById(id: string): Promise<Contact> {
    return await pb.collection('contacts').getOne<Contact>(id, {
      expand: 'company_id',
    })
  },

  async createContact(data: Partial<Contact>): Promise<Contact> {
    const currentUserId = pb.authStore.record?.id
    return await pb.collection('contacts').create<Contact>({
      ...data,
      created_by: currentUserId,
    })
  },

  async updateContact(id: string, data: Partial<Contact>): Promise<Contact> {
    return await pb.collection('contacts').update<Contact>(id, data)
  },

  async deleteContact(id: string): Promise<boolean> {
    return await pb.collection('contacts').delete(id)
  },
}
