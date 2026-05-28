import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const adminUser: User = {
  id: 'admin-id',
  email: 'admin@minimarket.com',
  firstName: 'Admin',
  lastName: 'Sistema',
  roles: [{ id: 'r1', name: 'ADMIN' }],
}

const cajeroUser: User = {
  id: 'cajero-id',
  email: 'cajero@minimarket.com',
  firstName: 'Cajero',
  lastName: 'Test',
  roles: [{ id: 'r2', name: 'CAJERO' }],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setAuthState(user: User | null, isAuthenticated: boolean) {
  useAuthStore.setState({
    user,
    isAuthenticated,
    accessToken: isAuthenticated ? 'mock-token' : null,
    refreshToken: isAuthenticated ? 'mock-refresh' : null,
    isLoading: false,
    error: null,
  })
}

function renderWithRouter(
  ui: React.ReactElement,
  { initialPath = '/dashboard' }: { initialPath?: string } = {}
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
        <Route path="/protected" element={ui} />
        <Route path="/admin-only" element={ui} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,
    })
  })

  // ── Unauthenticated ───────────────────────────────────────────────────────

  describe('when user is NOT authenticated', () => {
    it('should redirect to /login', () => {
      // Arrange
      setAuthState(null, false)

      // Act
      renderWithRouter(
        <ProtectedRoute>
          <div data-testid="protected-content">Contenido protegido</div>
        </ProtectedRoute>,
        { initialPath: '/protected' }
      )

      // Assert
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })

    it('should not render children when unauthenticated', () => {
      // Arrange
      setAuthState(null, false)

      // Act
      renderWithRouter(
        <ProtectedRoute>
          <div data-testid="secret">Secreto</div>
        </ProtectedRoute>,
        { initialPath: '/protected' }
      )

      // Assert
      expect(screen.queryByTestId('secret')).not.toBeInTheDocument()
    })
  })

  // ── Authenticated, no role requirement ────────────────────────────────────

  describe('when user IS authenticated and no role is required', () => {
    it('should render children', () => {
      // Arrange
      setAuthState(cajeroUser, true)

      // Act
      renderWithRouter(
        <ProtectedRoute>
          <div data-testid="protected-content">Contenido protegido</div>
        </ProtectedRoute>,
        { initialPath: '/protected' }
      )

      // Assert
      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
    })

    it('should render children for an ADMIN user with no role restriction', () => {
      // Arrange
      setAuthState(adminUser, true)

      // Act
      renderWithRouter(
        <ProtectedRoute>
          <div data-testid="content">Admin content</div>
        </ProtectedRoute>,
        { initialPath: '/protected' }
      )

      // Assert
      expect(screen.getByTestId('content')).toBeInTheDocument()
    })
  })

  // ── Authenticated, role required ──────────────────────────────────────────

  describe('when a specific role is required', () => {
    it('should render children when user has the required role', () => {
      // Arrange
      setAuthState(adminUser, true)

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="ADMIN">
          <div data-testid="admin-content">Solo ADMIN</div>
        </ProtectedRoute>,
        { initialPath: '/admin-only' }
      )

      // Assert
      expect(screen.getByTestId('admin-content')).toBeInTheDocument()
    })

    it('should redirect to /dashboard when user does not have the required role', () => {
      // Arrange — cajero tries to access admin-only route
      setAuthState(cajeroUser, true)

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="ADMIN">
          <div data-testid="admin-content">Solo ADMIN</div>
        </ProtectedRoute>,
        { initialPath: '/admin-only' }
      )

      // Assert
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument()
    })

    it('should redirect to /dashboard when CAJERO tries to access ADMIN route', () => {
      // Arrange
      setAuthState(cajeroUser, true)

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="ADMIN">
          <div data-testid="admin-only">Panel Admin</div>
        </ProtectedRoute>,
        { initialPath: '/admin-only' }
      )

      // Assert
      expect(screen.queryByTestId('admin-only')).not.toBeInTheDocument()
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })

    it('should render children when SUPERVISOR accesses a SUPERVISOR route', () => {
      // Arrange
      const supervisorUser: User = {
        id: 'sup-id',
        email: 'super@minimarket.com',
        firstName: 'Super',
        lastName: 'Visor',
        roles: [{ id: 'r3', name: 'SUPERVISOR' }],
      }
      setAuthState(supervisorUser, true)

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="SUPERVISOR">
          <div data-testid="supervisor-content">Panel Supervisor</div>
        </ProtectedRoute>,
        { initialPath: '/protected' }
      )

      // Assert
      expect(screen.getByTestId('supervisor-content')).toBeInTheDocument()
    })
  })
})
