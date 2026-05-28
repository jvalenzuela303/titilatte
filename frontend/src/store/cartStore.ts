import { create } from 'zustand'
import type { CartItem, Product } from '@/types'

interface CartState {
  items: CartItem[]
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

function computeTotal(items: CartItem[]): number {
  return parseFloat(
    items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)
  )
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product: Product, quantity = 1) => {
    const { items } = get()
    const existing = items.find((i) => i.product.id === product.id)

    let updated: CartItem[]
    if (existing) {
      const newQty = existing.quantity + quantity
      updated = items.map((i) =>
        i.product.id === product.id
          ? {
              ...i,
              quantity: newQty,
              subtotal: parseFloat((product.salePrice * newQty).toFixed(2)),
            }
          : i
      )
    } else {
      const newItem: CartItem = {
        product,
        quantity,
        unitPrice: product.salePrice,
        subtotal: parseFloat((product.salePrice * quantity).toFixed(2)),
      }
      updated = [...items, newItem]
    }

    set({ items: updated })
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((i) => i.product.id !== productId),
    }))
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.product.id === productId
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
