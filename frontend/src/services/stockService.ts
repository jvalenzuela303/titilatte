import apiClient from '@/config/axios'
import type { StockEntry, StockMovement, StockAdjustmentRequest, PageResponse } from '@/types'

const stockService = {
  getStock: (page = 0, size = 200) =>
    apiClient.get<PageResponse<StockEntry>>(`/stock?page=${page}&size=${size}`),

  getLowStock: (page = 0, size = 200) =>
    apiClient.get<PageResponse<StockEntry>>(`/stock/low?page=${page}&size=${size}`),

  createAdjustment: (data: StockAdjustmentRequest) =>
    apiClient.post('/stock/adjustment', data),

  getMovements: (page = 0, size = 20) =>
    apiClient.get<PageResponse<StockMovement>>(
      `/stock/movements?page=${page}&size=${size}`
    ),
}

export default stockService
