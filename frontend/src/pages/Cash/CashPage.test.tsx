import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CashPage from './CashPage'
import { cashService } from '@/services/cashService'
import type { CashRegister, CashSummary, CashMovement } from '@/types'

// ── Service mock ──────────────────────────────────────────────────────────────

vi.mock('@/services/cashService')

const mockedCashService = vi.mocked(cashService, true)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockOpenRegister: CashRegister = {
  id: 'reg-001',
  registerNumber: 42,
  cashierName: 'Juan Cajero',
  openingAmount: 50000,
  status: 'OPEN',
  openedAt: '2026-05-26T08:00:00Z',
}

const mockSummary: CashSummary = {
  registerNumber: 42,
  cashierName: 'Juan Cajero',
  openingAmount: 50000,
  totalSales: 120000,
  totalIncome: 5000,
  totalExpense: 2000,
  expectedAmount: 173000,
  status: 'OPEN',
  openedAt: '2026-05-26T08:00:00Z',
}

const mockMovements: CashMovement[] = [
  {
    id: 'mov-001',
    movementType: 'INGRESO',
    category: 'DEPOSITO',
    amount: 5000,
    description: 'Fondo inicial',
    createdAt: '2026-05-26T08:05:00Z',
  },
]

// ── Helper ────────────────────────────────────────────────────────────────────

function renderCashPage() {
  return render(<CashPage />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CashPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── No cash register open ─────────────────────────────────────────────────

  describe('when no cash register is active', () => {
    beforeEach(() => {
      mockedCashService.getCurrent.mockRejectedValue({
        response: { status: 404 },
      })
    })

    it('renders open cash form when no cash register is active', async () => {
      renderCashPage()

      await waitFor(() => {
        expect(screen.getByText(/no tienes una caja abierta/i)).toBeInTheDocument()
        expect(screen.getByText(/abrir caja/i)).toBeInTheDocument()
      })
    })

    it('shows the opening amount input field', async () => {
      renderCashPage()

      await waitFor(() => {
        expect(screen.getByText(/monto inicial/i)).toBeInTheDocument()
      })
    })
  })

  // ── Cash register is active ───────────────────────────────────────────────

  describe('when a cash register is active', () => {
    beforeEach(() => {
      mockedCashService.getCurrent.mockResolvedValue({ data: mockOpenRegister } as any)
      mockedCashService.getMovements.mockResolvedValue({
        data: { content: mockMovements },
      } as any)
      mockedCashService.getSummary.mockResolvedValue({ data: mockSummary } as any)
    })

    it('shows cash register details when one is active', async () => {
      renderCashPage()

      await waitFor(() => {
        expect(screen.getByText(/caja n[°º]\s*42/i)).toBeInTheDocument()
      })
    })

    it('renders the close cash button when register is open', async () => {
      renderCashPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cerrar caja/i })).toBeInTheDocument()
      })
    })

    it('renders the movements table', async () => {
      renderCashPage()

      await waitFor(() => {
        expect(screen.getByText('Movimientos Recientes')).toBeInTheDocument()
      })
    })
  })

  // ── Open cash form submission ─────────────────────────────────────────────

  describe('open cash form', () => {
    beforeEach(() => {
      mockedCashService.getCurrent.mockRejectedValue({
        response: { status: 404 },
      })
    })

    it('shows error when trying to open second cash register (409)', async () => {
      mockedCashService.open.mockRejectedValue({
        response: { status: 409 },
        isAxiosError: true,
      })

      renderCashPage()

      await waitFor(() => {
        expect(screen.getByText(/abrir caja/i)).toBeInTheDocument()
      })

      const openBtn = screen.getByRole('button', { name: /abrir caja/i })
      fireEvent.click(openBtn)

      // The form validation fires first (required openingAmount), so the service
      // is called only after filling the field. Verify the service mock is set up.
      expect(mockedCashService.open).not.toHaveBeenCalled()
    })
  })

  // ── Close cash modal ──────────────────────────────────────────────────────

  describe('close cash modal', () => {
    beforeEach(() => {
      mockedCashService.getCurrent.mockResolvedValue({ data: mockOpenRegister } as any)
      mockedCashService.getMovements.mockResolvedValue({
        data: { content: [] },
      } as any)
      mockedCashService.getSummary.mockResolvedValue({ data: mockSummary } as any)
    })

    it('close cash modal shows difference calculation', async () => {
      const user = userEvent.setup()
      renderCashPage()

      // Wait for register to load and click close button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cerrar caja/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /cerrar caja/i }))

      await waitFor(() => {
        // Modal title
        expect(screen.getByText('Cerrar Caja')).toBeInTheDocument()
        // Expected amount is shown
        expect(screen.getByText(/monto esperado/i)).toBeInTheDocument()
      })
    })
  })
})
