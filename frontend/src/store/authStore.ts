import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import axios from 'axios'
import type { User, LoginResponse } from '@/types'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setTokens: (accessToken: string, refreshToken: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await axios.post<LoginResponse>(
            `${BASE_URL}/auth/login`,
            { email, password },
            { headers: { 'Content-Type': 'application/json' } }
          )
          const data = response.data

          // Map flat backend response to frontend User shape
          const user: User = {
            id: data.userId,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            roles: data.roles.map((name) => ({ id: name, name })),
          }

          // Persist tokens in localStorage for axios interceptor access
          localStorage.setItem('access_token', data.accessToken)
          localStorage.setItem('refresh_token', data.refreshToken)

          set({
            user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (err) {
          let message = 'Error al iniciar sesión. Verifica tus credenciales.'
          if (axios.isAxiosError(err) && err.response?.data) {
            const data = err.response.data as { message?: string }
            message = data.message ?? message
          }
          set({ isLoading: false, error: message, isAuthenticated: false })
          throw new Error(message)
        }
      },

      logout: async () => {
        const { accessToken, refreshToken } = get()
        if (refreshToken) {
          // Fire and forget — do not block UI on server logout.
          // The refreshToken must be sent in the body so the server can revoke it.
          axios
            .post(
              `${BASE_URL}/auth/logout`,
              { refreshToken },
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )
            .catch(() => {
              // Ignore errors — logout is best-effort on the client side.
              // The token will expire naturally if revocation fails.
            })
        }

        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          isLoading: false,
        })
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('refresh_token', refreshToken)
        set({ accessToken, refreshToken })
      },

      clearAuth: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          isLoading: false,
        })
      },
    }),
    {
      name: 'minimarket-auth',
      storage: createJSONStorage(() => localStorage),
      // Persist auth state but not transient UI flags
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      // Re-sync localStorage token keys on store rehydration
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          localStorage.setItem('access_token', state.accessToken)
        }
        if (state?.refreshToken) {
          localStorage.setItem('refresh_token', state.refreshToken)
        }
      },
    }
  )
)
