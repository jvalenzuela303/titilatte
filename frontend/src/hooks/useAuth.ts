import { useAuthStore } from '@/store/authStore'
import type { RoleName } from '@/types'

/**
 * Convenience hook that exposes auth state and actions.
 * Keeps components decoupled from the Zustand store internals.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  /**
   * Returns true if the current user has at least one of the specified roles.
   */
  const hasRole = (...roles: RoleName[]): boolean => {
    if (!user) return false
    return user.roles.some((r) => roles.includes(r.name))
  }

  const isAdmin = hasRole('ADMIN')
  const isSupervisor = hasRole('SUPERVISOR')
  const isCajero = hasRole('CAJERO')
  const isBodega = hasRole('BODEGA')

  return {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    clearAuth,
    hasRole,
    isAdmin,
    isSupervisor,
    isCajero,
    isBodega,
  }
}
