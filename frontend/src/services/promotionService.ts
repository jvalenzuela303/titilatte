import apiClient from '@/config/axios'
import type { Promotion, AppliedPromotion, CreatePromotionRequest, PageResponse } from '@/types'

const promotionService = {
  getAll: (params?: { active?: boolean; page?: number; size?: number }) =>
    apiClient.get<PageResponse<Promotion>>('/promotions', { params }),

  getActive: () =>
    apiClient.get<Promotion[]>('/promotions/active'),

  getById: (id: string) =>
    apiClient.get<Promotion>(`/promotions/${id}`),

  create: (data: CreatePromotionRequest) =>
    apiClient.post<Promotion>('/promotions', data),

  update: (id: string, data: CreatePromotionRequest) =>
    apiClient.put<Promotion>(`/promotions/${id}`, data),

  deactivate: (id: string) =>
    apiClient.delete(`/promotions/${id}`),

  applyBestPromotion: (productId: string, quantity: number, branchId?: string) =>
    apiClient.post<AppliedPromotion | null>('/promotions/apply', { productId, quantity, branchId }),

  getImpact: (from: string, to: string) =>
    apiClient.get('/promotions/impact', { params: { from, to } }),
}

export default promotionService
