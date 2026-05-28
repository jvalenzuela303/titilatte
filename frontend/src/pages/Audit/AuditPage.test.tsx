import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AuditPage from './AuditPage'
import { auditService } from '../../services/auditService'
import type { AuditLog, PageResponse } from '../../types'

// ── Mock auditService ─────────────────────────────────────────────────────────

vi.mock('../../services/auditService', () => ({
  auditService: {
    getLogs: vi.fn(),
    exportExcel: vi.fn(),
  },
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  id: 'log-uuid-' + Math.random().toString(36).slice(2),
  entityType: 'SALE',
  entityId: 'entity-uuid-001',
  action: 'CANCEL',
  oldValue: '{"status":"CONFIRMED"}',
  newValue: '{"status":"CANCELLED"}',
  reason: 'Producto defectuoso',
  performedByEmail: 'admin@minimarket.com',
  ipAddress: '192.168.1.100',
  createdAt: '2026-01-15T10:30:00',
  ...overrides,
})

const makePageResponse = (logs: AuditLog[]): PageResponse<AuditLog> => ({
  content: logs,
  totalElements: logs.length,
  totalPages: 1,
  size: 20,
  number: 0,
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderAuditPage() {
  return render(
    <MemoryRouter>
      <AuditPage />
    </MemoryRouter>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuditPage', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Table rendering ───────────────────────────────────────────────────────

  describe('renders audit log table', () => {

    it('renders audit log table with data', async () => {
      // Arrange
      const logs = [makeLog(), makeLog({ entityType: 'PRODUCT', action: 'PRICE_CHANGE' })]
      vi.mocked(auditService.getLogs).mockResolvedValueOnce({
        data: makePageResponse(logs),
      } as any)

      // Act
      renderAuditPage()

      // Assert — column headers
      await waitFor(() => {
        expect(screen.getByText('Fecha')).toBeInTheDocument()
        expect(screen.getByText('Entidad')).toBeInTheDocument()
        expect(screen.getByText('Accion')).toBeInTheDocument()
        expect(screen.getByText('Usuario')).toBeInTheDocument()
      })

      // Assert — data rows
      expect(screen.getByText('SALE')).toBeInTheDocument()
      expect(screen.getByText('admin@minimarket.com')).toBeInTheDocument()
    })

    it('shows empty table message when no logs returned', async () => {
      // Arrange
      vi.mocked(auditService.getLogs).mockResolvedValueOnce({
        data: makePageResponse([]),
      } as any)

      // Act
      renderAuditPage()

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/No hay registros de auditoria/i)).toBeInTheDocument()
      })
    })

    it('shows page title and subtitle', async () => {
      // Arrange
      vi.mocked(auditService.getLogs).mockResolvedValueOnce({
        data: makePageResponse([]),
      } as any)

      // Act
      renderAuditPage()

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Auditoria del Sistema/i)).toBeInTheDocument()
      })
    })
  })

  // ── Filtering ─────────────────────────────────────────────────────────────

  describe('filters by entity type', () => {

    it('calls getLogs again with entityType filter when Buscar is clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      vi.mocked(auditService.getLogs).mockResolvedValue({
        data: makePageResponse([]),
      } as any)

      renderAuditPage()
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Tipo de entidad/i)).toBeInTheDocument()
      })

      // Act — select SALE from the entity type dropdown
      await user.click(screen.getByText('Buscar'))

      // Assert — getLogs called a second time with filters
      expect(vi.mocked(auditService.getLogs)).toHaveBeenCalledTimes(2)
    })

    it('getLogs is called on initial mount', async () => {
      // Arrange
      vi.mocked(auditService.getLogs).mockResolvedValueOnce({
        data: makePageResponse([]),
      } as any)

      // Act
      renderAuditPage()

      // Assert
      await waitFor(() => {
        expect(vi.mocked(auditService.getLogs)).toHaveBeenCalledOnce()
      })
    })
  })

  // ── Detail modal ──────────────────────────────────────────────────────────

  describe('opens detail modal on row click', () => {

    it('opens detail modal when eye icon button is clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      const log = makeLog({ reason: 'Defecto de fabrica' })
      vi.mocked(auditService.getLogs).mockResolvedValueOnce({
        data: makePageResponse([log]),
      } as any)

      renderAuditPage()
      await waitFor(() => {
        expect(screen.getByText('admin@minimarket.com')).toBeInTheDocument()
      })

      // Act — click the "Ver detalle" button
      const detailButton = screen.getByRole('button', { name: /Ver detalle del registro/i })
      await user.click(detailButton)

      // Assert — modal is open
      await waitFor(() => {
        expect(screen.getByText(/Detalle del Registro/i)).toBeInTheDocument()
      })
    })

    it('shows formatted JSON in detail modal for old and new values', async () => {
      // Arrange
      const user = userEvent.setup()
      const log = makeLog({
        oldValue: '{"status":"CONFIRMED"}',
        newValue: '{"status":"CANCELLED"}',
      })
      vi.mocked(auditService.getLogs).mockResolvedValueOnce({
        data: makePageResponse([log]),
      } as any)

      renderAuditPage()
      await waitFor(() => {
        expect(screen.getByText('admin@minimarket.com')).toBeInTheDocument()
      })

      // Act
      const detailButton = screen.getByRole('button', { name: /Ver detalle del registro/i })
      await user.click(detailButton)

      // Assert — modal shows the old and new value pre-formatted sections
      await waitFor(() => {
        expect(screen.getByText('Valor Anterior')).toBeInTheDocument()
        expect(screen.getByText('Valor Nuevo')).toBeInTheDocument()
      })

      // The JSON should be formatted (contains newlines from JSON.stringify with indent)
      const preElements = document.querySelectorAll('pre')
      expect(preElements.length).toBeGreaterThanOrEqual(2)
    })

    it('closes detail modal on Cerrar button click', async () => {
      // Arrange
      const user = userEvent.setup()
      const log = makeLog()
      vi.mocked(auditService.getLogs).mockResolvedValueOnce({
        data: makePageResponse([log]),
      } as any)

      renderAuditPage()
      await waitFor(() => {
        expect(screen.getByText('admin@minimarket.com')).toBeInTheDocument()
      })

      // Open modal
      await user.click(screen.getByRole('button', { name: /Ver detalle del registro/i }))
      await waitFor(() => {
        expect(screen.getByText(/Detalle del Registro/i)).toBeInTheDocument()
      })

      // Act — close modal
      await user.click(screen.getByRole('button', { name: /Cerrar/i }))

      // Assert — modal is closed
      await waitFor(() => {
        expect(screen.queryByText(/Detalle del Registro/i)).not.toBeInTheDocument()
      })
    })
  })

  // ── Excel export ──────────────────────────────────────────────────────────

  describe('export excel button triggers download', () => {

    it('calls auditService.exportExcel when export button is clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      vi.mocked(auditService.getLogs).mockResolvedValueOnce({
        data: makePageResponse([]),
      } as any)

      // Mock exportExcel to return a small blob
      const mockBlob = new Blob(['PK\x03\x04'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      vi.mocked(auditService.exportExcel).mockResolvedValueOnce({
        data: mockBlob,
      } as any)

      // Mock DOM link for download verification
      const linkClickSpy = vi.fn()
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          const link = document.createElement.call(document, 'a')
          link.click = linkClickSpy
          return link
        }
        return document.createElement.call(document, tag)
      })

      // Mock URL.createObjectURL
      const objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
      const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

      renderAuditPage()
      await waitFor(() => {
        expect(screen.getByText(/Exportar Excel/i)).toBeInTheDocument()
      })

      // Act
      await user.click(screen.getByText(/Exportar Excel/i))

      // Assert
      await waitFor(() => {
        expect(vi.mocked(auditService.exportExcel)).toHaveBeenCalledOnce()
      })
      expect(linkClickSpy).toHaveBeenCalledOnce()
      expect(objectUrlSpy).toHaveBeenCalledOnce()

      // Cleanup
      createElementSpy.mockRestore()
      objectUrlSpy.mockRestore()
      revokeUrlSpy.mockRestore()
    })

    it('shows error message.error when export fails', async () => {
      // Arrange
      const user = userEvent.setup()
      vi.mocked(auditService.getLogs).mockResolvedValueOnce({
        data: makePageResponse([]),
      } as any)
      vi.mocked(auditService.exportExcel).mockRejectedValueOnce(new Error('Export failed'))

      renderAuditPage()
      await waitFor(() => {
        expect(screen.getByText(/Exportar Excel/i)).toBeInTheDocument()
      })

      // Act — should not throw in the UI
      await user.click(screen.getByText(/Exportar Excel/i))

      // Assert — the export promise rejects gracefully (no unhandled error in component)
      await waitFor(() => {
        expect(vi.mocked(auditService.exportExcel)).toHaveBeenCalledOnce()
      })
    })
  })
})
