import pb from '@/lib/pocketbase/client'
import type { Property, PropertyType, PropertyStatus, TransactionType } from '@/types/crm'

export interface PropertyFilterOptions {
  type?: PropertyType | 'ALL'
  status?: PropertyStatus | 'ALL'
  transactionType?: TransactionType | 'ALL'
  search?: string
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  page?: number
  perPage?: number
}

export const propertyService = {
  async getProperties(options: PropertyFilterOptions = {}) {
    const {
      type,
      status,
      transactionType,
      search,
      minPrice,
      maxPrice,
      bedrooms,
      page = 1,
      perPage = 12,
    } = options

    const filterParts: string[] = []

    if (type && type !== 'ALL') {
      filterParts.push(`type = '${type}'`)
    }
    if (status && status !== 'ALL') {
      filterParts.push(`status = '${status}'`)
    }
    if (transactionType && transactionType !== 'ALL') {
      filterParts.push(`transaction_type = '${transactionType}'`)
    }
    if (search && search.trim()) {
      const q = search.trim().replace(/'/g, "\\'")
      filterParts.push(
        `(title ~ '${q}' || description ~ '${q}' || address_city ~ '${q}' || address_neighborhood ~ '${q}')`,
      )
    }
    if (minPrice !== undefined && !isNaN(minPrice)) {
      filterParts.push(`price >= ${minPrice}`)
    }
    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      filterParts.push(`price <= ${maxPrice}`)
    }
    if (bedrooms !== undefined && bedrooms > 0) {
      filterParts.push(`bedrooms >= ${bedrooms}`)
    }

    const filter = filterParts.join(' && ')

    return await pb.collection('properties').getList<Property>(page, perPage, {
      filter,
      sort: '-created',
    })
  },

  async getAllProperties() {
    return await pb.collection('properties').getFullList<Property>({
      sort: '-created',
    })
  },

  async getPropertyById(id: string) {
    return await pb.collection('properties').getOne<Property>(id)
  },

  async createProperty(data: FormData | Partial<Property>) {
    return await pb.collection('properties').create<Property>(data)
  },

  async updateProperty(id: string, data: FormData | Partial<Property>) {
    return await pb.collection('properties').update<Property>(id, data)
  },

  async deleteProperty(id: string) {
    return await pb.collection('properties').delete(id)
  },

  getFileUrl(record: Property, filename: string) {
    return pb.files.getURL(record, filename)
  },
}
