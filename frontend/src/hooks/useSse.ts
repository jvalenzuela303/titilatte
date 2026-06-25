import { useEffect, useRef, useCallback } from 'react'
import { notification } from 'antd'
import { useAuthStore } from '../store/authStore'
import type { SseEvent, SseEventType } from '../types'

const MIN_RECONNECT_MS = 1_000
const MAX_RECONNECT_MS = 30_000

interface SseOptions {
  onEvent?: (event: SseEvent) => void
  enableNotifications?: boolean
}

export function useSse(options: SseOptions = {}) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelay = useRef(1000)
  // Keep options in a stable ref so callbacks never trigger reconnections
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const connect = useCallback(() => {
    if (!accessToken) return

    const tokenAtConnect = accessToken
    const base = import.meta.env.VITE_API_URL || '/api/v1'
    const url = `${base}/events/stream?token=${tokenAtConnect}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => {
      reconnectDelay.current = MIN_RECONNECT_MS
    }

    es.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as SseEvent
        optionsRef.current.onEvent?.(event)
        if (optionsRef.current.enableNotifications) {
          showNotification(event)
        }
      } catch {
        // Ignore malformed JSON frames (e.g. keep-alive comments)
      }
    }

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null

      // If the token changed since we connected (e.g. refreshed by the axios
      // interceptor), do NOT schedule a reconnect with the stale token.
      // The useEffect dependency on `accessToken` will trigger a new connect
      // automatically once the store updates.
      const currentToken = useAuthStore.getState().accessToken
      if (currentToken !== tokenAtConnect) return

      const delay = Math.min(reconnectDelay.current, MAX_RECONNECT_MS)
      reconnectDelay.current = delay * 2
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }
  }, [accessToken])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [connect])
}

function showNotification(event: SseEvent): void {
  const handlers: Partial<Record<SseEventType, () => void>> = {
    VENTA_CONFIRMADA: () =>
      notification.success({
        message: 'Venta confirmada',
        description: `Venta #${String(event.data.saleNumber ?? '')} — $${String(event.data.total ?? '')}`,
        placement: 'bottomRight',
        duration: 3,
      }),
    STOCK_CRITICO: () =>
      notification.warning({
        message: 'Stock critico',
        description: `${String(event.data.productName ?? 'Producto')}: ${String(event.data.stockCurrent ?? '')} unidades`,
        placement: 'bottomRight',
        duration: 6,
      }),
    CAJA_ABIERTA: () =>
      notification.info({
        message: 'Caja abierta',
        description: `Cajero: ${String(event.data.cashierName ?? '')}`,
        placement: 'bottomRight',
        duration: 3,
      }),
    CAJA_CERRADA: () =>
      notification.info({
        message: 'Caja cerrada',
        description: `Caja #${String(event.data.registerNumber ?? '')}`,
        placement: 'bottomRight',
        duration: 3,
      }),
  }

  handlers[event.type]?.()
}
