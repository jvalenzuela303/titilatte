import api from '../config/axios'
import type { AuditLog, PageResponse } from '../types'

export const auditService = {
  getLogs: (params?: Record<string, unknown>) =>
    api.get<PageResponse<AuditLog>>('/audit', { params }),

  exportExcel: (params?: Record<string, unknown>) =>
    api.get<Blob>('/audit/export/excel', { params, responseType: 'blob' }),
}
