import { useState, useCallback } from 'react'
import { message   App,
} from 'antd'
import apiClient from '@/config/axios'
import type { Product, PageResponse, CreateProductRequest, UpdateProductRequest } from '@/types'

export interface ProductFilters {
  page?: number
  size?: number
  name?: string
  barcode?: string
  active?: boolean
}

interface UseProductsReturn {
  products: Product[]
  pagination: {
    current: number
    pageSize: number
    total: number
  }
  isLoading: boolean
  loading: boolean
  error: string | null
  searchProducts: (query: string) => Promise<Product[]>
  getByBarcode: (code: string) => Promise<Product | null>
  getProducts: (params?: ProductFilters) => Promise<void>
  fetchProducts: (params?: ProductFilters) => Promise<void>
  createProduct: (data: CreateProductRequest) => Promise<void>
  updateProduct: (id: string, data: UpdateProductRequest) => Promise<void>
}

export function useProducts(): UseProductsReturn {
  const { message } = App.useApp()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })

  /**
   * Fetch paginated product list with optional filters.
   * page param is 1-indexed (Ant Design convention); API is 0-indexed.
   */
  const getProducts = useCallback(async (params: ProductFilters = {}) => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      const apiPage = ((params.page ?? 1) - 1).toString()
      query.set('page', apiPage)
      query.set('size', String(params.size ?? 20))
      if (params.name) query.set('name', params.name)
      if (params.barcode) query.set('barcode', params.barcode)
      if (params.active !== undefined) query.set('active', String(params.active))

      const res = await apiClient.get<PageResponse<Product>>(`/products?${query.toString()}`)
      const data = res.data
      setProducts(data.content)
      setPagination({
        current: data.number + 1,
        pageSize: data.size,
        total: data.totalElements,
      })
    } catch {
      const msg = 'Error al cargar los productos'
      setError(msg)
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Search products by name — returns the matching list directly.
   */
  const searchProducts = useCallback(async (query: string): Promise<Product[]> => {
    if (!query.trim()) return []
    try {
      const params = new URLSearchParams({ name: query.trim(), size: '10', active: 'true' })
      const res = await apiClient.get<PageResponse<Product>>(`/products?${params.toString()}`)
      return res.data.content
    } catch {
      return []
    }
  }, [])

  /**
   * Look up a single product by exact barcode. Returns null if not found.
   */
  const getByBarcode = useCallback(async (code: string): Promise<Product | null> => {
    try {
      const res = await apiClient.get<Product>(`/products/barcode/${encodeURIComponent(code)}`)
      return res.data
    } catch {
      return null
    }
  }, [])

  const createProduct = useCallback(async (data: CreateProductRequest) => {
    await apiClient.post<Product>('/products', data)
    message.success('Producto creado exitosamente')
  }, [])

  const updateProduct = useCallback(async (id: string, data: UpdateProductRequest) => {
    await apiClient.put<Product>(`/products/${id}`, data)
    message.success('Producto actualizado exitosamente')
  }, [])

  return {
    products,
    pagination,
    loading,
    isLoading: loading,
    error,
    searchProducts,
    getByBarcode,
    getProducts,
    fetchProducts: getProducts,
    createProduct,
    updateProduct,
  }
}
