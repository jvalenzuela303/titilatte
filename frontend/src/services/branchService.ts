import api from '../config/axios'

export interface Branch {
  id: string
  name: string
  address: string | null
  phone: string | null
  rut: string | null
  isActive: boolean
}

export interface BranchRequest {
  name: string
  address?: string
  phone?: string
  rut?: string
}

export const branchService = {
  findAll: () => api.get<Branch[]>('/branches'),
  findById: (id: string) => api.get<Branch>(`/branches/${id}`),
  create: (data: BranchRequest) => api.post<Branch>('/branches', data),
  update: (id: string, data: BranchRequest) => api.put<Branch>(`/branches/${id}`, data),
  deactivate: (id: string) => api.delete(`/branches/${id}`),
}
