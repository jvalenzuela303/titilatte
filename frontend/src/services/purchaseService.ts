import api from '../config/axios'
import type { Purchase, CreatePurchaseRequest, Supplier, PageResponse } from '../types'

export const purchaseService = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<PageResponse<Purchase>>('/purchases', { params }),
  getById: (id: string) => api.get<Purchase>(`/purchases/${id}`),
  create: (data: CreatePurchaseRequest) => api.post<Purchase>('/purchases', data),
  confirm: (id: string) => api.post<Purchase>(`/purchases/${id}/confirm`),
  cancel: (id: string) => api.post<Purchase>(`/purchases/${id}/cancel`),
  getSuppliers: () => api.get<PageResponse<Supplier>>('/suppliers'),
  createSupplier: (data: Partial<Supplier>) => api.post<Supplier>('/suppliers', data),
}
