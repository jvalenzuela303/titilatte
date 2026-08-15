import apiClient from '@/config/axios'
import type {
  ProductCategory,
  ProductFamily,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CreateFamilyRequest,
} from '@/types'

const categoryService = {
  getCategories: (activeOnly = false) =>
    apiClient.get<ProductCategory[]>('/categories', { params: { activeOnly } }),

  getById: (id: string) =>
    apiClient.get<ProductCategory>(`/categories/${id}`),

  getFamilies: () =>
    apiClient.get<ProductFamily[]>('/categories/families'),

  getAllFamilies: () =>
    apiClient.get<ProductFamily[]>('/categories/families/all'),

  createFamily: (data: CreateFamilyRequest) =>
    apiClient.post<ProductFamily>('/categories/families', data),

  updateFamily: (id: string, data: CreateFamilyRequest) =>
    apiClient.put<ProductFamily>(`/categories/families/${id}`, data),

  deleteFamily: (id: string) =>
    apiClient.delete(`/categories/families/${id}`),

  create: (data: CreateCategoryRequest) =>
    apiClient.post<ProductCategory>('/categories', data),

  update: (id: string, data: UpdateCategoryRequest) =>
    apiClient.put<ProductCategory>(`/categories/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/categories/${id}`),
}

export default categoryService
