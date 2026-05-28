import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { RoleName } from '@/types'

interface Props {
  children: React.ReactNode
  /** Single required role — user must have exactly this role. */
  requiredRole?: RoleName
  /** Multiple allowed roles — user must have at least one. Takes precedence over requiredRole. */
  requiredRoles?: RoleName[]
}

/**
 * Guards a route behind authentication and optional role check.
 *
 * - Unauthenticated users are redirected to /login (with `from` state preserved).
 * - Authenticated users lacking the required role(s) are redirected to /dashboard.
 * - Otherwise the children are rendered as-is.
 *
 * Use `requiredRoles` (array) when multiple roles are permitted.
 * Use `requiredRole` (single) for backward compatibility with existing routes.
 */
const ProtectedRoute: React.FC<Props> = ({ children, requiredRole, requiredRoles }) => {
  const { isAuthenticated, hasRole } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // requiredRoles (array) takes precedence
  if (requiredRoles && requiredRoles.length > 0 && !hasRole(...requiredRoles)) {
    return <Navigate to="/dashboard" replace />
  }

  // Legacy single-role check
  if (!requiredRoles && requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
