import api from '../config/axios'
import type { Purchase, PurchasePayment, CreatePurchaseRequest, Supplier, PageResponse } from '../types'

export const purchaseService = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<PageResponse<Purchase>>('/purchases', { params }),
  getById: (id: string) => api.get<Purchase>(`/purchases/${id}`),
  create: (data: CreatePurchaseRequest) => api.post<Purchase>('/purchases', data),
  confirm: (id: string) => api.patch<Purchase>(`/purchases/${id}/confirm`),
  cancel: (id: string) => api.patch<Purchase>(`/purchases/${id}/cancel`),

  // ── Abonos a compras ───────────────────────────────────────────────────────
  registerPayment: (
    id: string,
    data: { amount: number; paymentMethod: string; notes?: string },
  ) => api.post<PurchasePayment>(`/purchases/${id}/payments`, data),
  getPayments: (id: string) =>
    api.get<PurchasePayment[]>(`/purchases/${id}/payments`),

  // ── Proveedores CRUD ───────────────────────────────────────────────────────
  getSuppliers: (params?: Record<string, unknown>) =>
    api.get<PageResponse<Supplier>>('/purchases/suppliers', { params }),
  getSupplierById: (id: string) =>
    api.get<Supplier>(`/purchases/suppliers/${id}`),
  createSupplier: (data: Partial<Supplier>) =>
    api.post<Supplier>('/purchases/suppliers', data),
  updateSupplier: (id: string, data: Partial<Supplier>) =>
    api.put<Supplier>(`/purchases/suppliers/${id}`, data),
}
