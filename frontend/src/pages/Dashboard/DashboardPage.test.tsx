import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from './DashboardPage'
import api from '@/config/axios'
import { useAuthStore } from '@/store/authStore'
import type {
  AdminDashboard,
  SupervisorDashboard,
  CashierDashboard,
  SseEvent,
} from '@/types'

// ── useSse mock ────────────────────────────────────────────────────────────────
// We need to control onEvent callbacks from tests, so we expose a handle.

let capturedOnEvent: ((event: SseEvent) => void) | undefined

vi.mock('../../hooks/useSse', () => ({
  useSse: (opts?: { onEvent?: (event: SseEvent) => void; enableNotifications?: boolean }) => {
    capturedOnEvent = opts?.onEvent
  },
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const adminDashboard: AdminDashboard = {
  dashboardType: 'ADMIN',
  salesToday: 25000,
  saleCountToday: 42,
  profitToday: 8000,
  profitMarginToday: 32,
  lowStockCount: 3,
  debtorCount: 5,
  totalDebt: 15000,
  last7Days: [],
  last30Days: [],
}

const supervisorDashboard: SupervisorDashboard = {
  dashboardType: 'SUPERVISOR',
  openCashRegisters: [],
  sellerStatsToday: [],
  lowStockCount: 2,
  salesToday: 18000,
  saleCountToday: 30,
}

const cashierDashboard: CashierDashboard = {
  dashboardType: 'CASHIER',
  currentCash: null,
  myTotalSalesToday: 5000,
  mySaleCountToday: 10,
  myTotalCash: 0,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardPage', () => {

  beforeEach(() => {
    capturedOnEvent = undefined
    useAuthStore.setState({ accessToken: 'test-token', isAuthenticated: true })
  })

  // ── Loading state ─────────────────────────────────────────────────────────

  describe('loading state', () => {

    it('shows loading spinner while fetching', () => {
      // Arrange — never-resolving promise keeps loading state active
      vi.mocked(api.get).mockReturnValueOnce(new Promise(() => {}))

      // Act
      renderDashboard()

      // Assert — Ant Design Spin renders an element with role="img" or aria-label
      // The Spin component from antd renders with class 'ant-spin'
      const spinContainer = document.querySelector('.ant-spin')
      expect(spinContainer).not.toBeNull()
    })
  })

  // ── Role-based view rendering ─────────────────────────────────────────────

  describe('role-based view rendering', () => {

    it('renders AdminDashboardView when role is ADMIN', async () => {
      // Arrange
      vi.mocked(api.get).mockResolvedValueOnce({ data: adminDashboard })

      // Act
      renderDashboard()

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Dashboard — Administrador/i)).toBeInTheDocument()
      })
      expect(screen.getByText(/Ventas Hoy/i)).toBeInTheDocument()
      expect(screen.getByText(/Utilidad Hoy/i)).toBeInTheDocument()
    })

    it('renders SupervisorDashboardView when role is SUPERVISOR', async () => {
      // Arrange
      vi.mocked(api.get).mockResolvedValueOnce({ data: supervisorDashboard })

      // Act
      renderDashboard()

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Dashboard — Supervisor/i)).toBeInTheDocument()
      })
      expect(screen.getByText(/Cajas Abiertas/i)).toBeInTheDocument()
    })

    it('renders CashierDashboardView when role is CAJERO', async () => {
      // Arrange
      vi.mocked(api.get).mockResolvedValueOnce({ data: cashierDashboard })

      // Act
      renderDashboard()

      // Assert — cashier view shows greeting and sales stats
      await waitFor(() => {
        expect(screen.getByText(/Mis Ventas Hoy/i)).toBeInTheDocument()
      })
      expect(screen.getByText(/Numero de Ventas/i)).toBeInTheDocument()
    })
  })

  // ── Error state ───────────────────────────────────────────────────────────

  describe('error state', () => {

    it('shows error alert when fetch fails', async () => {
      // Arrange
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))

      // Act
      renderDashboard()

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })
      expect(screen.getByText(/error cargando el dashboard/i)).toBeInTheDocument()
    })
  })

  // ── SSE-triggered refresh ─────────────────────────────────────────────────

  describe('SSE event refresh', () => {

    it('refreshes dashboard when VENTA_CONFIRMADA SSE event received', async () => {
      // Arrange — initial load
      vi.mocked(api.get)
        .mockResolvedValueOnce({ data: adminDashboard })  // initial fetch
        .mockResolvedValueOnce({ data: { ...adminDashboard, saleCountToday: 43 } }) // after SSE

      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Dashboard — Administrador/i)).toBeInTheDocument()
      })

      // Act — simulate SSE event arriving
      const sseEvent: SseEvent = {
        type: 'VENTA_CONFIRMADA',
        data: { saleNumber: '00100', total: 500 },
        timestamp: new Date().toISOString(),
      }

      act(() => {
        capturedOnEvent?.(sseEvent)
      })

      // Assert — api.get called twice (initial + refresh)
      await waitFor(() => {
        expect(vi.mocked(api.get)).toHaveBeenCalledTimes(2)
      })
    })

    it('refreshes dashboard when CAJA_ABIERTA SSE event received', async () => {
      // Arrange
      vi.mocked(api.get)
        .mockResolvedValueOnce({ data: supervisorDashboard })
        .mockResolvedValueOnce({ data: supervisorDashboard })

      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Dashboard — Supervisor/i)).toBeInTheDocument()
      })

      // Act
      const sseEvent: SseEvent = {
        type: 'CAJA_ABIERTA',
        data: { cashierName: 'Juan' },
        timestamp: new Date().toISOString(),
      }

      act(() => {
        capturedOnEvent?.(sseEvent)
      })

      // Assert
      await waitFor(() => {
        expect(vi.mocked(api.get)).toHaveBeenCalledTimes(2)
      })
    })

    it('does NOT refresh dashboard on HEARTBEAT event', async () => {
      // Arrange
      vi.mocked(api.get).mockResolvedValueOnce({ data: adminDashboard })

      renderDashboard()
      await waitFor(() => {
        expect(screen.getByText(/Dashboard — Administrador/i)).toBeInTheDocument()
      })
      const callCountBeforeEvent = vi.mocked(api.get).mock.calls.length

      // Act — HEARTBEAT should not trigger re-fetch
      const heartbeat: SseEvent = {
        type: 'HEARTBEAT',
        data: {},
        timestamp: new Date().toISOString(),
      }

      act(() => {
        capturedOnEvent?.(heartbeat)
      })

      // Assert — no additional API call
      expect(vi.mocked(api.get)).toHaveBeenCalledTimes(callCountBeforeEvent)
    })
  })
})
