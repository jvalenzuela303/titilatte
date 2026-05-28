import apiClient from '@/config/axios'
import type {
  Product,
  CreateProductRequest,
  UpdateProductRequest,
  PageResponse,
} from '@/types'

export interface ProductFilters {
  page?: number
  size?: number
  name?: string
  barcode?: string
  active?: boolean
}

const productService = {
  getProducts: (filters: ProductFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.page !== undefined) params.set('page', String(filters.page))
    if (filters.size !== undefined) params.set('size', String(filters.size))
    if (filters.name) params.set('name', filters.name)
    if (filters.barcode) params.set('barcode', filters.barcode)
    if (filters.active !== undefined) params.set('active', String(filters.active))
    return apiClient.get<PageResponse<Product>>(`/products?${params.toString()}`)
  },

  getByBarcode: (code: string) =>
    apiClient.get<Product>(`/products/barcode/${encodeURIComponent(code)}`),

  create: (data: CreateProductRequest) =>
    apiClient.post<Product>('/products', data),

  update: (id: string, data: UpdateProductRequest) =>
    apiClient.put<Product>(`/products/${id}`, data),

  delete: (id: string) => apiClient.delete(`/products/${id}`),

  deactivate: (id: string) =>
    apiClient.put<Product>(`/products/${id}`, { active: false }),
}

export default productService
