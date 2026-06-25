import apiClient from '@/config/axios'
import type { Sale, CreateSaleRequest, PageResponse } from '@/types'

export interface SaleFilters {
  page?: number
  size?: number
  startDate?: string
  endDate?: string
  status?: string
  type?: string
  sellerId?: string
}

const saleService = {
  getSales: (filters: SaleFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.page !== undefined) params.set('page', String(filters.page))
    if (filters.size !== undefined) params.set('size', String(filters.size))
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.status) params.set('status', filters.status)
    if (filters.type) params.set('type', filters.type)
    if (filters.sellerId) params.set('sellerId', filters.sellerId)
    return apiClient.get<PageResponse<Sale>>(`/sales?${params.toString()}`)
  },

  getSaleById: (id: string) => apiClient.get<Sale>(`/sales/${id}`),

  createSale: (data: CreateSaleRequest) =>
    apiClient.post<Sale>('/sales', data),

  cancelSale: (id: string, reason: string) =>
    apiClient.post<Sale>(`/sales/${id}/cancel`, { reason }),
}

export default saleService
