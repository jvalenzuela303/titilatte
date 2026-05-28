import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { useAuthStore } from './authStore'
import type { User, LoginResponse } from '@/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockUser: User = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'cajero@minimarket.com',
  firstName: 'Juan',
  lastName: 'Pérez',
  roles: [{ id: 'aaa', name: 'CAJERO' }],
}

const mockLoginResponse: LoginResponse = {
  accessToken: 'mock-access-token-jwt',
  refreshToken: 'mock-refresh-token-uuid',
  user: mockUser,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStore() {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authStore', () => {
  beforeEach(() => {
    resetStore()
    localStorage.clear()
    vi.clearAllMocks()
  })

  // ── login ──────────────────────────────────────────────────────────────────

  describe('login action', () => {
    it('should set user, tokens, and isAuthenticated=true on success', async () => {
      // Arrange
      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockLoginResponse })

      // Act
      await useAuthStore.getState().login('cajero@minimarket.com', 'password123')

      // Assert
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toEqual(mockUser)
      expect(state.accessToken).toBe('mock-access-token-jwt')
      expect(state.refreshToken).toBe('mock-refresh-token-uuid')
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should persist tokens in localStorage on successful login', async () => {
      // Arrange
      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockLoginResponse })

      // Act
      await useAuthStore.getState().login('cajero@minimarket.com', 'password123')

      // Assert
      expect(localStorage.getItem('access_token')).toBe('mock-access-token-jwt')
      expect(localStorage.getItem('refresh_token')).toBe('mock-refresh-token-uuid')
    })

    it('should set error and isAuthenticated=false on 401 failure', async () => {
      // Arrange
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: { message: 'Credenciales incorrectas' },
        },
      }
      vi.mocked(axios.post).mockRejectedValueOnce(axiosError)
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      // Act & Assert
      await expect(
        useAuthStore.getState().login('wrong@test.com', 'wrongpass')
      ).rejects.toThrow()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.error).toBe('Credenciales incorrectas')
      expect(state.isLoading).toBe(false)
    })

    it('should set generic error message when server error has no message', async () => {
      // Arrange
      const genericError = {
        isAxiosError: true,
        response: { status: 500, data: {} },
      }
      vi.mocked(axios.post).mockRejectedValueOnce(genericError)
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      // Act
      await expect(
        useAuthStore.getState().login('test@test.com', 'pass')
      ).rejects.toThrow()

      // Assert
      const { error } = useAuthStore.getState()
      expect(error).not.toBeNull()
      expect(error).toContain('Error al iniciar sesión')
    })

    it('should set isLoading=true during login and false after', async () => {
      // Arrange — capture loading state mid-flight
      let loadingDuringCall = false
      vi.mocked(axios.post).mockImplementationOnce(async () => {
        loadingDuringCall = useAuthStore.getState().isLoading
        return { data: mockLoginResponse }
      })

      // Act
      await useAuthStore.getState().login('cajero@minimarket.com', 'password123')

      // Assert
      expect(loadingDuringCall).toBe(true)
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
  })

  // ── logout ─────────────────────────────────────────────────────────────────

  describe('logout action', () => {
    it('should clear auth state and localStorage', async () => {
      // Arrange — simulate logged-in state
      useAuthStore.setState({
        user: mockUser,
        accessToken: 'some-access-token',
        refreshToken: 'some-refresh-token',
        isAuthenticated: true,
        error: null,
        isLoading: false,
      })
      localStorage.setItem('access_token', 'some-access-token')
      localStorage.setItem('refresh_token', 'some-refresh-token')

      vi.mocked(axios.post).mockResolvedValueOnce({}) // logout call resolves

      // Act
      await useAuthStore.getState().logout()

      // Assert
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.accessToken).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(localStorage.getItem('access_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
    })

    it('should still clear state even when server logout call fails', async () => {
      // Arrange
      useAuthStore.setState({
        user: mockUser,
        accessToken: 'token',
        refreshToken: 'refresh',
        isAuthenticated: true,
        error: null,
        isLoading: false,
      })
      vi.mocked(axios.post).mockRejectedValueOnce(new Error('Network Error'))

      // Act
      await useAuthStore.getState().logout()

      // Assert — client state cleared regardless of server response
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
    })

    it('should not call server logout when no refreshToken is present', async () => {
      // Arrange — user with no refresh token
      useAuthStore.setState({
        user: mockUser,
        accessToken: 'token',
        refreshToken: null,
        isAuthenticated: true,
        error: null,
        isLoading: false,
      })

      // Act
      await useAuthStore.getState().logout()

      // Assert — no API call made
      expect(axios.post).not.toHaveBeenCalled()
    })
  })

  // ── clearAuth ──────────────────────────────────────────────────────────────

  describe('clearAuth action', () => {
    it('should reset to initial state', () => {
      // Arrange
      useAuthStore.setState({
        user: mockUser,
        accessToken: 'token-to-clear',
        refreshToken: 'refresh-to-clear',
        isAuthenticated: true,
        error: 'some error',
        isLoading: true,
      })
      localStorage.setItem('access_token', 'token-to-clear')
      localStorage.setItem('refresh_token', 'refresh-to-clear')

      // Act
      useAuthStore.getState().clearAuth()

      // Assert
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.accessToken).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.error).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(localStorage.getItem('access_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
    })
  })

  // ── setTokens ──────────────────────────────────────────────────────────────

  describe('setTokens action', () => {
    it('should update tokens in store and localStorage', () => {
      // Act
      useAuthStore.getState().setTokens('new-access', 'new-refresh')

      // Assert
      const state = useAuthStore.getState()
      expect(state.accessToken).toBe('new-access')
      expect(state.refreshToken).toBe('new-refresh')
      expect(localStorage.getItem('access_token')).toBe('new-access')
      expect(localStorage.getItem('refresh_token')).toBe('new-refresh')
    })
  })
})
