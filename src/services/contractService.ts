import pb from '@/lib/pocketbase/client'
import type { Contract, ContractStatus } from '@/types/crm'

export interface ContractFilterOptions {
  page?: number
  perPage?: number
  companyId?: string
  status?: ContractStatus
  search?: string
}

export const contractService = {
  async getContracts(options: ContractFilterOptions = {}) {
    const page = options.page || 1
    const perPage = options.perPage || 50
    const filters: string[] = []

    if (options.companyId) {
      filters.push(`company_id = "${options.companyId}"`)
    }

    if (options.status) {
      filters.push(`status = "${options.status}"`)
    }

    if (options.search) {
      filters.push(
        `(contract_number ~ "${options.search}" || carrier_id.nome ~ "${options.search}")`,
      )
    }

    const filterString = filters.join(' && ')

    return await pb.collection('contracts').getList<Contract>(page, perPage, {
      filter: filterString || undefined,
      sort: '-start_date',
      expand: 'company_id,contact_id,product_id,carrier_id,opportunity_id,assigned_to',
    })
  },

  async getAllContracts(): Promise<Contract[]> {
    return await pb.collection('contracts').getFullList<Contract>({
      sort: '-start_date',
      expand: 'company_id,contact_id,product_id,carrier_id,opportunity_id,assigned_to',
    })
  },

  async createContract(data: Partial<Contract>): Promise<Contract> {
    const currentUserId = pb.authStore.record?.id
    const contract = await pb.collection('contracts').create<Contract>({
      ...data,
      created_by: currentUserId,
      assigned_to: data.assigned_to || currentUserId,
    })

    if (contract.opportunity_id) {
      try {
        await pb.collection('opportunity_timeline').create({
          opportunity_id: contract.opportunity_id,
          action_type: 'VENDA_CONTRATO',
          title: `Venda Consolidada - Contrato Gerado`,
          description: `Valor do produto: R$ ${contract.sale_value.toLocaleString('pt-BR')} | Faturamento KKJ estimado: R$ ${(contract.commission_value || 0).toLocaleString('pt-BR')}`,
          created_by: currentUserId,
        })
      } catch {
        /* intentionally ignored */
      }
    }

    return contract
  },

  async updateContract(id: string, data: Partial<Contract>): Promise<Contract> {
    return await pb.collection('contracts').update<Contract>(id, data)
  },

  async deleteContract(id: string): Promise<boolean> {
    return await pb.collection('contracts').delete(id)
  },
}
