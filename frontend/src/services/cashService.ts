import api from '../config/axios'
import type { CashRegister, CashSummary, CashMovement } from '../types'

export const cashService = {
  getCurrent: () =>
    api.get<CashRegister | null>('/cash/current', {
      validateStatus: (status) => status === 200 || status === 204,
    }),
  open: (data: { openingAmount: number; notes?: string }) =>
    api.post<CashRegister>('/cash/open', data),
  close: (id: string, data: { countedAmount: number; notes?: string }) =>
    api.patch<CashRegister>(`/cash/${id}/close`, data),
  getSummary: (id: string) => api.get<CashSummary>(`/cash/${id}/summary`),
  getMovements: (id: string) =>
    api.get<{ content: CashMovement[] }>(`/cash/${id}/movements`),
  getHistory: (page = 0, size = 20) =>
    api.get<{ content: CashRegister[]; totalElements: number }>(`/cash/history?page=${page}&size=${size}`),
  addMovement: (
    id: string,
    data: {
      movementType: string
      category: string
      amount: number
      description: string
    },
  ) => api.post(`/cash/${id}/movements`, data),
}
