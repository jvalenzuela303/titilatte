import api from '../config/axios'
import type { Customer, CustomerDebt, PageResponse } from '../types'

export const customerService = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<PageResponse<Customer>>('/customers', { params }),
  getById: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (data: Partial<Customer>) => api.post<Customer>('/customers', data),
  update: (id: string, data: Partial<Customer>) =>
    api.put<Customer>(`/customers/${id}`, data),
  updateCreditLimit: (id: string, data: { newLimit: number; reason: string }) =>
    api.put(`/customers/${id}/credit-limit`, data),
  registerPayment: (
    id: string,
    data: { amount: number; paymentMethod: string; notes?: string },
  ) => api.post(`/customers/${id}/payments`, data),
  getDebtors: () => api.get<CustomerDebt[]>('/customers/debtors'),
}
