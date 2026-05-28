import api from '../config/axios'
import type { SalesReport, ProfitReport, TopProduct, SellerReport } from '../types'

export const reportService = {
  getSales: (startDate: string, endDate: string) =>
    api.get<SalesReport>('/reports/sales', { params: { startDate, endDate } }),
  getBySeller: (startDate: string, endDate: string) =>
    api.get<SellerReport[]>('/reports/sales/by-seller', {
      params: { startDate, endDate },
    }),
  getTopProducts: (startDate: string, endDate: string, limit = 10) =>
    api.get<TopProduct[]>('/reports/top-products', {
      params: { startDate, endDate, limit },
    }),
  getProfit: (startDate: string, endDate: string) =>
    api.get<ProfitReport>('/reports/profit', { params: { startDate, endDate } }),
  getDebtors: () => api.get('/reports/debtors'),
  getStockCritical: () => api.get('/reports/stock-critical'),
  exportExcel: (reportType: string, startDate: string, endDate: string) =>
    api.get('/reports/export/excel', {
      params: { reportType, startDate, endDate },
      responseType: 'blob',
    }),
}
