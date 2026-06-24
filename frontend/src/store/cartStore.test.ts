import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from './cartStore'
import type { Product } from '@/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    barcode: '1234567890123',
    name: 'Agua 500ml',
    description: null,
    purchasePrice: 500,
    salePrice: 800,
    stockCurrent: 50,
    stockMinimum: 0,
    stockMaximum: 200,
    active: true,
    trackStock: true,
    allowCustomPrice: false,
    category: { id: 'cat-1', code: 'BEB', name: 'Bebidas' },
    tax: { id: 'tax-1', code: 'IVA', name: 'IVA 19%', rate: 0.19 },
    unit: { id: 'unit-1', code: 'UN', name: 'Unidad', abbreviation: 'UN' },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

const productA = makeProduct({ id: 'prod-a', name: 'Agua 500ml', salePrice: 800 })
const productB = makeProduct({ id: 'prod-b', barcode: '9999999999999', name: 'Jugo 1L', salePrice: 1500 })

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetCart() {
  useCartStore.setState({ items: [] })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('cartStore', () => {
  beforeEach(() => {
    resetCart()
  })

  // ── addItem ────────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('should add a new product to the cart', () => {
      // Act
      useCartStore.getState().addItem(productA)

      // Assert
      const { items } = useCartStore.getState()
      expect(items).toHaveLength(1)
      expect(items[0].product.id).toBe('prod-a')
      expect(items[0].quantity).toBe(1)
      expect(items[0].unitPrice).toBe(800)
      expect(items[0].subtotal).toBe(800)
    })

    it('should add a product with a custom quantity', () => {
      // Act
      useCartStore.getState().addItem(productA, 3)

      // Assert
      const { items } = useCartStore.getState()
      expect(items[0].quantity).toBe(3)
      expect(items[0].subtotal).toBe(2400)
    })

    it('should increment quantity when the same product is added again', () => {
      // Arrange
      useCartStore.getState().addItem(productA, 2)

      // Act
      useCartStore.getState().addItem(productA, 3)

      // Assert
      const { items } = useCartStore.getState()
      expect(items).toHaveLength(1)
      expect(items[0].quantity).toBe(5)
      expect(items[0].subtotal).toBe(4000) // 800 * 5
    })

    it('should keep separate entries for different products', () => {
      // Act
      useCartStore.getState().addItem(productA)
      useCartStore.getState().addItem(productB)

      // Assert
      const { items } = useCartStore.getState()
      expect(items).toHaveLength(2)
    })

    it('should recalculate subtotal correctly when adding same product multiple times', () => {
      // Act
      useCartStore.getState().addItem(productA, 1) // 800
      useCartStore.getState().addItem(productA, 1) // qty 2 -> 1600
      useCartStore.getState().addItem(productA, 1) // qty 3 -> 2400

      // Assert
      const { items } = useCartStore.getState()
      expect(items[0].quantity).toBe(3)
      expect(items[0].subtotal).toBe(2400)
    })
  })

  // ── removeItem ─────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('should remove the specified product from the cart', () => {
      // Arrange
      useCartStore.getState().addItem(productA)
      useCartStore.getState().addItem(productB)
      const itemAId = useCartStore.getState().items.find((i) => i.product.id === 'prod-a')!.id

      // Act
      useCartStore.getState().removeItem(itemAId)

      // Assert
      const { items } = useCartStore.getState()
      expect(items).toHaveLength(1)
      expect(items[0].product.id).toBe('prod-b')
    })

    it('should leave cart unchanged when removing a non-existent item id', () => {
      // Arrange
      useCartStore.getState().addItem(productA)

      // Act
      useCartStore.getState().removeItem('non-existent-id')

      // Assert
      expect(useCartStore.getState().items).toHaveLength(1)
    })

    it('should result in an empty cart when the only item is removed', () => {
      // Arrange
      useCartStore.getState().addItem(productA)
      const itemId = useCartStore.getState().items[0].id

      // Act
      useCartStore.getState().removeItem(itemId)

      // Assert
      expect(useCartStore.getState().items).toHaveLength(0)
    })
  })

  // ── updateQuantity ─────────────────────────────────────────────────────────

  describe('updateQuantity', () => {
    it('should update the quantity and recalculate subtotal', () => {
      // Arrange
      useCartStore.getState().addItem(productA, 1) // 800
      const itemId = useCartStore.getState().items[0].id

      // Act
      useCartStore.getState().updateQuantity(itemId, 4)

      // Assert
      const { items } = useCartStore.getState()
      expect(items[0].quantity).toBe(4)
      expect(items[0].subtotal).toBe(3200) // 800 * 4
    })

    it('should remove the item when quantity is set to 0', () => {
      // Arrange
      useCartStore.getState().addItem(productA, 2)
      const itemId = useCartStore.getState().items[0].id

      // Act
      useCartStore.getState().updateQuantity(itemId, 0)

      // Assert
      expect(useCartStore.getState().items).toHaveLength(0)
    })

    it('should remove the item when quantity is set to a negative value', () => {
      // Arrange
      useCartStore.getState().addItem(productA, 2)
      const itemId = useCartStore.getState().items[0].id

      // Act
      useCartStore.getState().updateQuantity(itemId, -1)

      // Assert
      expect(useCartStore.getState().items).toHaveLength(0)
    })

    it('should not affect other items when updating one product quantity', () => {
      // Arrange
      useCartStore.getState().addItem(productA, 2)
      useCartStore.getState().addItem(productB, 1)
      const itemAId = useCartStore.getState().items.find((i) => i.product.id === 'prod-a')!.id

      // Act
      useCartStore.getState().updateQuantity(itemAId, 5)

      // Assert
      const { items } = useCartStore.getState()
      const itemB = items.find((i) => i.product.id === 'prod-b')
      expect(itemB?.quantity).toBe(1)
    })
  })

  // ── clearCart ──────────────────────────────────────────────────────────────

  describe('clearCart', () => {
    it('should empty the cart', () => {
      // Arrange
      useCartStore.getState().addItem(productA, 3)
      useCartStore.getState().addItem(productB, 2)

      // Act
      useCartStore.getState().clearCart()

      // Assert
      expect(useCartStore.getState().items).toHaveLength(0)
    })

    it('should be idempotent — clearing an empty cart leaves it empty', () => {
      // Act
      useCartStore.getState().clearCart()
      useCartStore.getState().clearCart()

      // Assert
      expect(useCartStore.getState().items).toHaveLength(0)
    })
  })

  // ── getTotal ───────────────────────────────────────────────────────────────

  describe('getTotal', () => {
    it('should return 0 for an empty cart', () => {
      expect(useCartStore.getState().getTotal()).toBe(0)
    })

    it('should calculate the correct total for a single item', () => {
      // Arrange
      useCartStore.getState().addItem(productA, 2) // 800 * 2 = 1600

      // Assert
      expect(useCartStore.getState().getTotal()).toBe(1600)
    })

    it('should calculate the correct total for multiple items', () => {
      // Arrange
      useCartStore.getState().addItem(productA, 2) // 800 * 2 = 1600
      useCartStore.getState().addItem(productB, 1) // 1500 * 1 = 1500

      // Assert
      expect(useCartStore.getState().getTotal()).toBe(3100)
    })

    it('should return 0 after clearing the cart', () => {
      // Arrange
      useCartStore.getState().addItem(productA, 3)
      useCartStore.getState().clearCart()

      // Assert
      expect(useCartStore.getState().getTotal()).toBe(0)
    })

    it('should round total to 2 decimal places', () => {
      // Arrange — product with price that produces floating point edge cases
      const oddProduct = makeProduct({ id: 'odd', salePrice: 999.99 })
      useCartStore.getState().addItem(oddProduct, 3) // 2999.97

      // Assert
      expect(useCartStore.getState().getTotal()).toBe(2999.97)
    })
  })

  // ── getItemCount ───────────────────────────────────────────────────────────

  describe('getItemCount', () => {
    it('should return 0 for an empty cart', () => {
      expect(useCartStore.getState().getItemCount()).toBe(0)
    })

    it('should return the sum of all item quantities', () => {
      // Arrange
      useCartStore.getState().addItem(productA, 3)
      useCartStore.getState().addItem(productB, 2)

      // Assert
      expect(useCartStore.getState().getItemCount()).toBe(5)
    })
  })
})
