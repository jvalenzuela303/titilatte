import api from '../config/axios'
import type { DashboardData } from '../types'

export const dashboardService = {
  getDashboard: () => api.get<DashboardData>('/dashboard'),
}
