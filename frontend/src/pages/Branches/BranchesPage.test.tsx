import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BranchesPage from './BranchesPage'
import { branchService } from '@/services/branchService'
import { useAuthStore } from '@/store/authStore'
import type { Branch } from '@/services/branchService'

// ── Service mock ──────────────────────────────────────────────────────────────

vi.mock('@/services/branchService', () => ({
  branchService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  },
}))

const mockedBranchService = vi.mocked(branchService, true)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockBranches: Branch[] = [
  {
    id: 'branch-001',
    name: 'Sucursal Centro',
    address: 'Av. Principal 100, Santiago',
    phone: '+56212345678',
    rut: '76.543.210-K',
    isActive: true,
  },
  {
    id: 'branch-002',
    name: 'Sucursal Norte',
    address: 'Calle Norte 200',
    phone: '+56987654321',
    rut: null,
    isActive: false,
  },
]

// ── Auth helpers ──────────────────────────────────────────────────────────────

function setRole(roleName: string) {
  useAuthStore.setState({
    user: {
      id: 'user-001',
      email: `${roleName.toLowerCase()}@minimarket.com`,
      firstName: roleName,
      lastName: 'Test',
      roles: [{ id: `role-${roleName}`, name: roleName as any }],
    },
    isAuthenticated: true,
    accessToken: 'mock-token',
    refreshToken: 'mock-refresh',
    isLoading: false,
    error: null,
  })
}

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

// ── Render helper ─────────────────────────────────────────────────────────────

function renderBranchesPage() {
  return render(
    <MemoryRouter>
      <BranchesPage />
    </MemoryRouter>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BranchesPage', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    resetAuthStore()
    mockedBranchService.findAll.mockResolvedValue({ data: mockBranches } as any)
  })

  // ── Table rendering ───────────────────────────────────────────────────────

  describe('muestra tabla con branches cargados', () => {

    it('renderiza las sucursales retornadas por branchService', async () => {
      // Arrange
      setRole('ADMIN')

      // Act
      renderBranchesPage()

      // Assert — esperar que los datos del servicio aparezcan en la tabla
      await waitFor(() => {
        expect(screen.getByText('Sucursal Centro')).toBeInTheDocument()
        expect(screen.getByText('Sucursal Norte')).toBeInTheDocument()
      })

      expect(screen.getByText('Av. Principal 100, Santiago')).toBeInTheDocument()
    })

    it('llama a branchService.findAll al montar el componente', async () => {
      // Arrange
      setRole('SUPERVISOR')

      // Act
      renderBranchesPage()

      // Assert
      await waitFor(() => {
        expect(mockedBranchService.findAll).toHaveBeenCalledOnce()
      })
    })

    it('muestra tag de estado correcto: activo e inactivo', async () => {
      // Arrange
      setRole('ADMIN')

      // Act
      renderBranchesPage()

      // Assert — una sucursal activa y una inactiva
      await waitFor(() => {
        expect(screen.getByText('Activo')).toBeInTheDocument()
        expect(screen.getByText('Inactivo')).toBeInTheDocument()
      })
    })

    it('muestra el título de la página', async () => {
      // Arrange
      setRole('ADMIN')
      renderBranchesPage()

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Sucursales')).toBeInTheDocument()
      })
    })
  })

  // ── Visibilidad del botón "Nueva Sucursal" ────────────────────────────────

  describe('botón Nueva Sucursal según rol', () => {

    it('botón "Nueva Sucursal" visible para ADMIN', async () => {
      // Arrange
      setRole('ADMIN')

      // Act
      renderBranchesPage()

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /nueva sucursal/i })).toBeInTheDocument()
      })
    })

    it('botón "Nueva Sucursal" NO visible para SUPERVISOR', async () => {
      // Arrange
      setRole('SUPERVISOR')

      // Act
      renderBranchesPage()

      // Assert — SUPERVISOR no puede crear sucursales
      await waitFor(() => {
        expect(screen.getByText('Sucursal Centro')).toBeInTheDocument()
      })
      expect(screen.queryByRole('button', { name: /nueva sucursal/i })).not.toBeInTheDocument()
    })
  })

  // ── Modal crear sucursal ──────────────────────────────────────────────────

  describe('modal crear sucursal', () => {

    it('click en "Nueva Sucursal" abre modal', async () => {
      // Arrange
      const user = userEvent.setup()
      setRole('ADMIN')
      renderBranchesPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /nueva sucursal/i })).toBeInTheDocument()
      })

      // Act
      await user.click(screen.getByRole('button', { name: /nueva sucursal/i }))

      // Assert — modal visible con título
      await waitFor(() => {
        expect(screen.getByText('Nueva Sucursal')).toBeInTheDocument()
      })
    })

    it('submit de formulario sin nombre muestra validación requerida', async () => {
      // Arrange
      const user = userEvent.setup()
      setRole('ADMIN')
      renderBranchesPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /nueva sucursal/i })).toBeInTheDocument()
      })

      // Abrir modal
      await user.click(screen.getByRole('button', { name: /nueva sucursal/i }))
      await waitFor(() => {
        expect(screen.getByText('Nueva Sucursal')).toBeInTheDocument()
      })

      // Act — hacer click en "Crear Sucursal" sin llenar el nombre
      const submitButton = screen.getByRole('button', { name: /crear sucursal/i })
      await user.click(submitButton)

      // Assert — mensaje de validación requerida aparece
      await waitFor(() => {
        expect(screen.getByText(/el nombre es requerido/i)).toBeInTheDocument()
      })
    })
  })

  // ── Desactivar sucursal ───────────────────────────────────────────────────

  describe('desactivar sucursal', () => {

    it('click en "Desactivar" muestra Modal.confirm antes de llamar al servicio', async () => {
      // Arrange
      const user = userEvent.setup()
      setRole('ADMIN')
      renderBranchesPage()

      await waitFor(() => {
        expect(screen.getByText('Sucursal Centro')).toBeInTheDocument()
      })

      // Act — click en el botón de desactivar de la primera sucursal activa
      const deactivateButton = screen.getByRole('button', {
        name: /desactivar sucursal centro/i,
      })
      await user.click(deactivateButton)

      // Assert — Modal.confirm aparece con el título de confirmación
      await waitFor(() => {
        expect(screen.getByText(/desactivar sucursal/i)).toBeInTheDocument()
      })

      // Assert — el servicio NO fue llamado todavía (esperando confirmación)
      expect(mockedBranchService.deactivate).not.toHaveBeenCalled()
    })

    it('confirmar en Modal.confirm llama a branchService.deactivate', async () => {
      // Arrange
      const user = userEvent.setup()
      setRole('ADMIN')
      mockedBranchService.deactivate.mockResolvedValueOnce({} as any)
      // Segunda llamada a findAll para refrescar la lista
      mockedBranchService.findAll.mockResolvedValue({ data: mockBranches } as any)

      renderBranchesPage()

      await waitFor(() => {
        expect(screen.getByText('Sucursal Centro')).toBeInTheDocument()
      })

      // Abrir Modal.confirm
      const deactivateButton = screen.getByRole('button', {
        name: /desactivar sucursal centro/i,
      })
      await user.click(deactivateButton)

      // Confirmar en el modal
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^desactivar$/i })).toBeInTheDocument()
      })
      await user.click(screen.getByRole('button', { name: /^desactivar$/i }))

      // Assert — servicio llamado con el id correcto
      await waitFor(() => {
        expect(mockedBranchService.deactivate).toHaveBeenCalledWith('branch-001')
      })
    })
  })
})
