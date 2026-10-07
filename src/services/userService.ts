import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/crm'

export const userService = {
  async getAllUsers(): Promise<User[]> {
    return await pb.collection('users').getFullList<User>({
      sort: 'name',
    })
  },

  async getUserById(id: string): Promise<User> {
    return await pb.collection('users').getOne<User>(id)
  },

  async updateUserRole(id: string, role: 'ADMINISTRADOR' | 'GESTOR' | 'VENDEDOR'): Promise<User> {
    return await pb.collection('users').update<User>(id, { role })
  },
}
