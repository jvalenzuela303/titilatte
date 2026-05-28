import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoginPage from './LoginPage'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockUser: User = {
  id: 'admin-id',
  email: 'admin@minimarket.com',
  firstName: 'Admin',
  lastName: 'Sistema',
  roles: [{ id: 'r1', name: 'ADMIN' }],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetAuthStore() {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  })
}

function renderLoginPage(initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    resetAuthStore()
    vi.clearAllMocks()
  })

  // ── Rendering ─────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('should render the login form with email and password fields', () => {
      // Act
      renderLoginPage()

      // Assert
      expect(screen.getByPlaceholderText('usuario@minimarket.com')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
    })

    it('should render the Minimarket brand title', () => {
      // Act
      renderLoginPage()

      // Assert
      expect(screen.getByText('Minimarket')).toBeInTheDocument()
    })

    it('should render the subtitle', () => {
      // Act
      renderLoginPage()

      // Assert
      expect(screen.getByText(/sistema de punto de venta/i)).toBeInTheDocument()
    })

    it('should not show any error alert on initial render', () => {
      // Act
      renderLoginPage()

      // Assert
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  // ── Validation errors ─────────────────────────────────────────────────────

  describe('form validation', () => {
    it('should show validation error for invalid email format', async () => {
      // Arrange
      const user = userEvent.setup()
      renderLoginPage()

      // Act — submit with invalid email
      await user.type(screen.getByPlaceholderText('usuario@minimarket.com'), 'not-an-email')
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123')
      await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/ingresa un email válido/i)).toBeInTheDocument()
      })
    })

    it('should show validation error when email is empty', async () => {
      // Arrange
      const user = userEvent.setup()
      renderLoginPage()

      // Act — submit without filling email
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123')
      await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/el email es requerido/i)).toBeInTheDocument()
      })
    })

    it('should show validation error for empty password', async () => {
      // Arrange
      const user = userEvent.setup()
      renderLoginPage()

      // Act
      await user.type(screen.getByPlaceholderText('usuario@minimarket.com'), 'admin@minimarket.com')
      await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/la contraseña es requerida/i)).toBeInTheDocument()
      })
    })

    it('should show validation error when password is too short (less than 6 chars)', async () => {
      // Arrange
      const user = userEvent.setup()
      renderLoginPage()

      // Act
      await user.type(screen.getByPlaceholderText('usuario@minimarket.com'), 'admin@minimarket.com')
      await user.type(screen.getByPlaceholderText('••••••••'), '12345') // only 5 chars
      await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/la contraseña debe tener al menos 6 caracteres/i)).toBeInTheDocument()
      })
    })
  })

  // ── Successful login ──────────────────────────────────────────────────────

  describe('successful login', () => {
    it('should call the login action with correct credentials on valid submit', async () => {
      // Arrange
      const user = userEvent.setup()
      const loginMock = vi.fn().mockResolvedValueOnce(undefined)
      useAuthStore.setState({ login: loginMock } as any)
      renderLoginPage()

      // Act
      await user.type(screen.getByPlaceholderText('usuario@minimarket.com'), 'admin@minimarket.com')
      await user.type(screen.getByPlaceholderText('••••••••'), 'admin1234')
      await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

      // Assert
      await waitFor(() => {
        expect(loginMock).toHaveBeenCalledWith('admin@minimarket.com', 'admin1234')
      })
    })

    it('should redirect to /dashboard after successful login', async () => {
      // Arrange
      const user = userEvent.setup()
      const loginMock = vi.fn().mockImplementationOnce(async () => {
        useAuthStore.setState({
          user: mockUser,
          accessToken: 'token',
          refreshToken: 'refresh',
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })
      })
      useAuthStore.setState({ login: loginMock } as any)
      renderLoginPage()

      // Act
      await user.type(screen.getByPlaceholderText('usuario@minimarket.com'), 'admin@minimarket.com')
      await user.type(screen.getByPlaceholderText('••••••••'), 'admin1234')
      await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument()
      })
    })

    it('should show loading state while submitting', async () => {
      // Arrange
      const user = userEvent.setup()
      let resolveLogin: () => void
      const loginPromise = new Promise<void>((resolve) => {
        resolveLogin = resolve
      })
      const loginMock = vi.fn().mockReturnValueOnce(loginPromise)
      useAuthStore.setState({ login: loginMock, isLoading: false } as any)
      renderLoginPage()

      // Act
      await user.type(screen.getByPlaceholderText('usuario@minimarket.com'), 'admin@minimarket.com')
      await user.type(screen.getByPlaceholderText('••••••••'), 'admin1234')

      // Submit
      await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

      // Manually set loading during the pending login
      useAuthStore.setState({ isLoading: true })

      // Assert — button should be disabled/loading
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /iniciar sesión/i })
        expect(button).toBeDisabled()
      })

      // Cleanup
      resolveLogin!()
    })
  })

  // ── Login failure ─────────────────────────────────────────────────────────

  describe('login failure', () => {
    it('should show error message when login fails', async () => {
      // Arrange
      const user = userEvent.setup()
      const errorMessage = 'Credenciales incorrectas'
      const loginMock = vi.fn().mockRejectedValueOnce(new Error(errorMessage))
      useAuthStore.setState({
        login: loginMock,
        error: errorMessage,
      } as any)
      renderLoginPage()

      // Trigger re-render with error
      await user.type(screen.getByPlaceholderText('usuario@minimarket.com'), 'wrong@minimarket.com')
      await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpassword')
      await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

      // Assert
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should display the error from auth store when it is set', () => {
      // Arrange — pre-set error state
      useAuthStore.setState({ error: 'Error al iniciar sesión. Verifica tus credenciales.' })
      renderLoginPage()

      // Assert
      expect(screen.getByText(/error al iniciar sesión/i)).toBeInTheDocument()
    })

    it('should not render error alert when there is no error in store', () => {
      // Arrange
      useAuthStore.setState({ error: null })
      renderLoginPage()

      // Assert
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  // ── Already authenticated ─────────────────────────────────────────────────

  describe('when user is already authenticated', () => {
    it('should redirect to /dashboard immediately', () => {
      // Arrange — user already logged in
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        accessToken: 'existing-token',
        refreshToken: 'existing-refresh',
        isLoading: false,
        error: null,
      })

      // Act
      renderLoginPage()

      // Assert
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })
  })
})
