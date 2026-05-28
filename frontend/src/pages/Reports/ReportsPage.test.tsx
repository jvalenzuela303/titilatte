import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportsPage from './ReportsPage'
import { reportService } from '@/services/reportService'
import type { SalesReport, SellerReport, CustomerDebt } from '@/types'

// ── Service mock ──────────────────────────────────────────────────────────────

vi.mock('@/services/reportService')

const mockedReportService = vi.mocked(reportService, true)

// ── Window mock for blob download ─────────────────────────────────────────────

const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
const mockRevokeObjectURL = vi.fn()
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockSalesReport: SalesReport = {
  totalSales: 25,
  totalAmount: 1250000,
  totalDiscount: 30000,
  dailyBreakdown: [
    { date: '2026-05-01', saleCount: 10, totalAmount: 500000 },
    { date: '2026-05-02', saleCount: 15, totalAmount: 750000 },
  ],
}

const mockSellers: SellerReport[] = [
  { sellerId: 'u-001', sellerEmail: 'cajero@test.cl', saleCount: 25, totalAmount: 1250000 },
]

const mockDebtors: CustomerDebt[] = [
  {
    customerId: 'c-001',
    fullName: 'Ana López',
    rut: '12.345.678-9',
    creditLimit: 100000,
    creditUsed: 40000,
    available: 60000,
  },
]

// ── Helper ────────────────────────────────────────────────────────────────────

function renderReportsPage() {
  return render(<ReportsPage />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateObjectURL.mockReturnValue('blob:mock-url')
  })

  // ── Tab rendering ─────────────────────────────────────────────────────────

  it('renders 5 tabs', () => {
    renderReportsPage()

    // All 5 tab labels must be visible
    expect(screen.getByRole('tab', { name: /ventas/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /utilidades/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /top productos/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /deudores/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /stock crítico/i })).toBeInTheDocument()
  })

  // ── Sales tab ─────────────────────────────────────────────────────────────

  describe('Ventas tab', () => {
    it('sales tab shows date range picker and generate button', () => {
      renderReportsPage()

      // The sales tab is active by default
      expect(screen.getByRole('button', { name: /generar reporte/i })).toBeInTheDocument()
    })

    it('generate button is visible on initial render of sales tab', () => {
      renderReportsPage()

      const generateBtn = screen.getByRole('button', { name: /generar reporte/i })
      expect(generateBtn).toBeInTheDocument()
      // Button is enabled — date range has a default value in the component
      expect(generateBtn).not.toBeDisabled()
    })

    it('displays sales statistics after generating report', async () => {
      mockedReportService.getSales.mockResolvedValue({ data: mockSalesReport } as any)
      mockedReportService.getBySeller.mockResolvedValue({ data: mockSellers } as any)

      const user = userEvent.setup()
      renderReportsPage()

      await user.click(screen.getByRole('button', { name: /generar reporte/i }))

      await waitFor(() => {
        // totalSales statistic value
        expect(screen.getByText('25')).toBeInTheDocument()
      })
    })

    it('shows export excel button only after report is generated', async () => {
      mockedReportService.getSales.mockResolvedValue({ data: mockSalesReport } as any)
      mockedReportService.getBySeller.mockResolvedValue({ data: mockSellers } as any)

      const user = userEvent.setup()
      renderReportsPage()

      // Before generation: no export button
      expect(screen.queryByRole('button', { name: /exportar excel/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /generar reporte/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /exportar excel/i })).toBeInTheDocument()
      })
    })

    it('export excel button triggers blob download', async () => {
      mockedReportService.getSales.mockResolvedValue({ data: mockSalesReport } as any)
      mockedReportService.getBySeller.mockResolvedValue({ data: mockSellers } as any)
      mockedReportService.exportExcel.mockResolvedValue({
        data: new Blob(['xlsx-mock-content']),
      } as any)

      const user = userEvent.setup()
      renderReportsPage()

      // Generate report first to show the export button
      await user.click(screen.getByRole('button', { name: /generar reporte/i }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /exportar excel/i })).toBeInTheDocument()
      })

      // Click export
      await user.click(screen.getByRole('button', { name: /exportar excel/i }))

      await waitFor(() => {
        expect(mockedReportService.exportExcel).toHaveBeenCalledWith(
          'sales',
          expect.any(String),
          expect.any(String),
        )
        expect(mockCreateObjectURL).toHaveBeenCalled()
      })
    })
  })

  // ── Debtors tab ───────────────────────────────────────────────────────────

  describe('Deudores tab', () => {
    it('debtors tab loads without date filter', async () => {
      const user = userEvent.setup()
      renderReportsPage()

      // Navigate to debtors tab
      await user.click(screen.getByRole('tab', { name: /deudores/i }))

      // The debtors tab has a "Cargar Deudores" button — no date filter required
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cargar deudores/i })).toBeInTheDocument()
      })
    })

    it('debtors tab shows table after loading', async () => {
      mockedReportService.getDebtors.mockResolvedValue({ data: mockDebtors } as any)

      const user = userEvent.setup()
      renderReportsPage()

      await user.click(screen.getByRole('tab', { name: /deudores/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cargar deudores/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /cargar deudores/i }))

      await waitFor(() => {
        expect(screen.getByText('Ana López')).toBeInTheDocument()
      })
    })
  })
})
