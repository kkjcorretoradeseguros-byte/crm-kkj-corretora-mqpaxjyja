import pb from '@/lib/pocketbase/client'
import type { Company } from '@/types/crm'

export interface CompanyFilterOptions {
  page?: number
  perPage?: number
  search?: string
  city?: string
  state?: string
}

export const companyService = {
  async getCompanies(options: CompanyFilterOptions = {}) {
    const page = options.page || 1
    const perPage = options.perPage || 50
    const filters: string[] = []

    if (options.search) {
      filters.push(
        `(trade_name ~ "${options.search}" || legal_name ~ "${options.search}" || cnpj ~ "${options.search}" || city ~ "${options.search}")`,
      )
    }

    if (options.city) {
      filters.push(`city = "${options.city}"`)
    }

    if (options.state) {
      filters.push(`state = "${options.state}"`)
    }

    const filterString = filters.join(' && ')

    return await pb.collection('companies').getList<Company>(page, perPage, {
      filter: filterString || undefined,
      sort: '-created',
    })
  },

  async getAllCompanies(): Promise<Company[]> {
    return await pb.collection('companies').getFullList<Company>({
      sort: 'trade_name',
    })
  },

  async getCompanyById(id: string): Promise<Company> {
    return await pb.collection('companies').getOne<Company>(id)
  },

  async createCompany(data: Partial<Company>): Promise<Company> {
    const currentUserId = pb.authStore.record?.id
    return await pb.collection('companies').create<Company>({
      ...data,
      created_by: currentUserId,
    })
  },

  async updateCompany(id: string, data: Partial<Company>): Promise<Company> {
    return await pb.collection('companies').update<Company>(id, data)
  },

  async deleteCompany(id: string): Promise<boolean> {
    return await pb.collection('companies').delete(id)
  },
}
