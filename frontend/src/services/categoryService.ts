import apiClient from '@/config/axios'
import type {
  ProductCategory,
  ProductFamily,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@/types'

const categoryService = {
  getCategories: (activeOnly = false) =>
    apiClient.get<ProductCategory[]>('/categories', { params: { activeOnly } }),

  getById: (id: string) =>
    apiClient.get<ProductCategory>(`/categories/${id}`),

  getFamilies: () =>
    apiClient.get<ProductFamily[]>('/categories/families'),

  create: (data: CreateCategoryRequest) =>
    apiClient.post<ProductCategory>('/categories', data),

  update: (id: string, data: UpdateCategoryRequest) =>
    apiClient.put<ProductCategory>(`/categories/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/categories/${id}`),
}

export default categoryService
