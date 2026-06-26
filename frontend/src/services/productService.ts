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

// Catalog cache: shared across all components that need the full active product list.
// TTL of 5 minutes — avoids fetching 200 products on every modal open.
let catalogCache: { data: Product[]; ts: number } | null = null
const CATALOG_TTL_MS = 5 * 60 * 1000

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

  /** Returns the full active catalog (up to 200 items), cached for 5 min. */
  getCatalog: async (): Promise<Product[]> => {
    if (catalogCache && Date.now() - catalogCache.ts < CATALOG_TTL_MS) {
      return catalogCache.data
    }
    const res = await apiClient.get<PageResponse<Product>>('/products?size=200&active=true')
    catalogCache = { data: res.data.content, ts: Date.now() }
    return res.data.content
  },

  invalidateCatalogCache: () => {
    catalogCache = null
  },

  getByBarcode: (code: string) =>
    apiClient.get<Product>(`/products/barcode/${encodeURIComponent(code)}`),

  create: async (data: CreateProductRequest) => {
    const res = await apiClient.post<Product>('/products', data)
    catalogCache = null
    return res
  },

  update: async (id: string, data: UpdateProductRequest) => {
    const res = await apiClient.put<Product>(`/products/${id}`, data)
    catalogCache = null
    return res
  },

  delete: async (id: string) => {
    const res = await apiClient.delete(`/products/${id}`)
    catalogCache = null
    return res
  },

  deactivate: async (id: string) => {
    const res = await apiClient.put<Product>(`/products/${id}`, { active: false })
    catalogCache = null
    return res
  },
}

export default productService
