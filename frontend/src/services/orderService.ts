import api from '../config/axios'
import type { Order, OrderPayment, CreateOrderRequest, PageResponse } from '../types'

export const orderService = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<PageResponse<Order>>('/orders', { params }),
  getById: (id: string) => api.get<Order>(`/orders/${id}`),
  create: (data: CreateOrderRequest) => api.post<Order>('/orders', data),
  updateStatus: (id: string, status: string) =>
    api.patch<Order>(`/orders/${id}/status`, { status }),
  registerPayment: (
    id: string,
    data: { amount: number; paymentMethod: string; notes?: string },
  ) => api.post<OrderPayment>(`/orders/${id}/payments`, data),
  getPayments: (id: string) => api.get<OrderPayment[]>(`/orders/${id}/payments`),
}
