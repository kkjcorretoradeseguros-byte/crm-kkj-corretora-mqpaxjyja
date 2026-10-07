import pb from '@/lib/pocketbase/client'
import type { Product, ProductCategory } from '@/types/crm'

export const productService = {
  async getAllProducts(onlyActive = true): Promise<Product[]> {
    const filter = onlyActive ? 'active = true' : undefined
    return await pb.collection('products').getFullList<Product>({
      filter,
      sort: 'name',
    })
  },

  async getProductById(id: string): Promise<Product> {
    return await pb.collection('products').getOne<Product>(id)
  },

  async createProduct(data: Partial<Product>): Promise<Product> {
    return await pb.collection('products').create<Product>({
      active: true,
      ...data,
    })
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    return await pb.collection('products').update<Product>(id, data)
  },

  async deleteProduct(id: string): Promise<boolean> {
    return await pb.collection('products').delete(id)
  },
}
