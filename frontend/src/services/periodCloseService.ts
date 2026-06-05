import apiClient from '@/config/axios'
import type { PeriodClose, MonthlyComparison, CreatePeriodCloseRequest, PageResponse } from '@/types'

const periodCloseService = {
  getAll: (page = 0, size = 20) =>
    apiClient.get<PageResponse<PeriodClose>>('/period-closes', { params: { page, size } }),

  getById: (id: string) =>
    apiClient.get<PeriodClose>(`/period-closes/${id}`),

  preview: (year: number, month: number, branchId?: string) =>
    apiClient.get<PeriodClose>('/period-closes/preview', { params: { year, month, branchId } }),

  close: (data: CreatePeriodCloseRequest) =>
    apiClient.post<PeriodClose>('/period-closes', data),

  getComparison: (months = 12, branchId?: string) =>
    apiClient.get<MonthlyComparison[]>('/period-closes/comparison', { params: { months, branchId } }),

  exportExcel: (id: string) =>
    apiClient.get(`/period-closes/${id}/export/excel`, { responseType: 'blob' }),
}

export default periodCloseService
