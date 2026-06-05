import apiClient from '@/config/axios'
import type { AlertRule, AlertHistory, CreateAlertRuleRequest, PageResponse } from '@/types'

const alertService = {
  getRules: () =>
    apiClient.get<PageResponse<AlertRule>>('/alerts/rules'),

  createRule: (data: CreateAlertRuleRequest) =>
    apiClient.post<AlertRule>('/alerts/rules', data),

  updateRule: (id: string, data: CreateAlertRuleRequest) =>
    apiClient.put<AlertRule>(`/alerts/rules/${id}`, data),

  deactivateRule: (id: string) =>
    apiClient.delete(`/alerts/rules/${id}`),

  getHistory: (page = 0, size = 20) =>
    apiClient.get<PageResponse<AlertHistory>>('/alerts/history', { params: { page, size } }),

  acknowledge: (id: string) =>
    apiClient.patch(`/alerts/history/${id}/acknowledge`),

  evaluate: () =>
    apiClient.post('/alerts/evaluate'),
}

export default alertService
