import { create } from 'zustand'
import type { CartItem, Product } from '@/types'

interface CartState {
  items: CartItem[]
  addItem: (product: Product, quantity?: number, customUnitPrice?: number) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

let _nextId = 1
function nextId(): string {
  return String(_nextId++)
}

function computeTotal(items: CartItem[]): number {
  return parseFloat(
    items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)
  )
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product: Product, quantity = 1, customUnitPrice?: number) => {
    const { items } = get()

    // Custom-price products always enter as a new line (never merged) so the
    // cashier can add multiple different amounts for the same product.
    if (customUnitPrice !== undefined) {
      const newItem: CartItem = {
        id: nextId(),
        product,
        quantity: 1,
        unitPrice: customUnitPrice,
        subtotal: parseFloat(customUnitPrice.toFixed(2)),
        customUnitPrice,
      }
      set({ items: [...items, newItem] })
      return
    }

    const existing = items.find((i) => i.product.id === product.id && !i.customUnitPrice)

    let updated: CartItem[]
    if (existing) {
      const newQty = existing.quantity + quantity
      updated = items.map((i) =>
        i.id === existing.id
          ? {
              ...i,
              quantity: newQty,
              subtotal: parseFloat((product.salePrice * newQty).toFixed(2)),
            }
          : i
      )
    } else {
      const newItem: CartItem = {
        id: nextId(),
        product,
        quantity,
        unitPrice: product.salePrice,
        subtotal: parseFloat((product.salePrice * quantity).toFixed(2)),
      }
      updated = [...items, newItem]
    }

    set({ items: updated })
  },

  removeItem: (itemId: string) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== itemId),
    }))
  },

  updateQuantity: (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(itemId)
      return
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              quantity,
              subtotal: parseFloat((i.unitPrice * quantity).toFixed(2)),
            }
          : i
      ),
    }))
  },

  clearCart: () => set({ items: [] }),

  getTotal: () => computeTotal(get().items),

  getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
