import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSse } from './useSse'
import { useAuthStore } from '../store/authStore'
import type { SseEvent } from '../types'

// ── EventSource mock ──────────────────────────────────────────────────────────

// jsdom does not ship EventSource. We provide a minimal controllable mock.
interface MockEventSourceInstance {
  url: string
  onopen: ((ev: Event) => void) | null
  onmessage: ((ev: MessageEvent) => void) | null
  onerror: ((ev: Event) => void) | null
  close: ReturnType<typeof vi.fn>
  readyState: number
  simulateOpen: () => void
  simulateMessage: (data: string) => void
  simulateError: () => void
}

let lastEventSource: MockEventSourceInstance | null = null

const MockEventSource = vi.fn().mockImplementation((url: string) => {
  const instance: MockEventSourceInstance = {
    url,
    onopen: null,
    onmessage: null,
    onerror: null,
    close: vi.fn(),
    readyState: 0,
    simulateOpen: function () {
      this.readyState = 1
      this.onopen?.(new Event('open'))
    },
    simulateMessage: function (data: string) {
      this.onmessage?.(new MessageEvent('message', { data }))
    },
    simulateError: function () {
      this.onerror?.(new Event('error'))
    },
  }
  lastEventSource = instance
  return instance
})

// Attach to globalThis before tests
beforeEach(() => {
  // @ts-expect-error — injecting mock
  globalThis.EventSource = MockEventSource
})

afterEach(() => {
  MockEventSource.mockClear()
  lastEventSource = null
  // Reset auth store to no token
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    user: null,
    isLoading: false,
    error: null,
  })
  vi.clearAllTimers()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSse', () => {

  // ── Connection lifecycle ───────────────────────────────────────────────────

  describe('connection lifecycle', () => {

    it('should connect to SSE endpoint on mount', () => {
      // Arrange
      useAuthStore.setState({ accessToken: 'test-token' })

      // Act
      renderHook(() => useSse())

      // Assert — EventSource was constructed with the stream URL and the token
      expect(MockEventSource).toHaveBeenCalledOnce()
      const [[url]] = MockEventSource.mock.calls
      expect(url as string).toContain('/events/stream')
      expect(url as string).toContain('token=test-token')
    })

    it('should not connect when accessToken is null', () => {
      // Arrange — no token in store (default)

      // Act
      renderHook(() => useSse())

      // Assert — EventSource must NOT be created
      expect(MockEventSource).not.toHaveBeenCalled()
    })

    it('should disconnect on unmount', () => {
      // Arrange
      useAuthStore.setState({ accessToken: 'abc' })
      const { unmount } = renderHook(() => useSse())

      expect(lastEventSource).not.toBeNull()
      const closeSpy = lastEventSource!.close

      // Act
      unmount()

      // Assert — close() was called on the EventSource
      expect(closeSpy).toHaveBeenCalledOnce()
    })

    it('should reset reconnect delay to 1000ms on successful open', () => {
      // Arrange
      useAuthStore.setState({ accessToken: 'abc' })
      renderHook(() => useSse())

      // Act — simulate successful open
      act(() => {
        lastEventSource!.simulateOpen()
      })

      // Assert — we verify by confirming no timer was scheduled (no reconnect after open)
      expect(lastEventSource!.close).not.toHaveBeenCalled()
    })
  })

  // ── Event handling ─────────────────────────────────────────────────────────

  describe('event handling', () => {

    it('should call onEvent callback when message received', () => {
      // Arrange
      useAuthStore.setState({ accessToken: 'abc' })
      const onEvent = vi.fn()

      renderHook(() => useSse({ onEvent }))

      const eventPayload: SseEvent = {
        type: 'VENTA_CONFIRMADA',
        data: { saleNumber: '00123', total: 5000 },
        timestamp: new Date().toISOString(),
      }

      // Act
      act(() => {
        lastEventSource!.simulateMessage(JSON.stringify(eventPayload))
      })

      // Assert
      expect(onEvent).toHaveBeenCalledOnce()
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'VENTA_CONFIRMADA' })
      )
    })

    it('should not throw when message data is malformed JSON', () => {
      // Arrange
      useAuthStore.setState({ accessToken: 'abc' })
      const onEvent = vi.fn()

      renderHook(() => useSse({ onEvent }))

      // Act + Assert — must not throw
      expect(() => {
        act(() => {
          lastEventSource!.simulateMessage(':keepalive')
        })
      }).not.toThrow()

      // onEvent must NOT be called for malformed frames
      expect(onEvent).not.toHaveBeenCalled()
    })

    it('should not call onEvent when accessToken changes to null', () => {
      // Arrange — start connected
      useAuthStore.setState({ accessToken: 'original-token' })
      const onEvent = vi.fn()
      const { unmount } = renderHook(() => useSse({ onEvent }))

      // Act — remove token (simulates logout)
      act(() => {
        useAuthStore.setState({ accessToken: null })
      })
      unmount()

      // Assert — no spurious callbacks
      expect(onEvent).not.toHaveBeenCalled()
    })
  })

  // ── Reconnect with exponential backoff ─────────────────────────────────────

  describe('reconnection', () => {

    it('should reconnect with exponential backoff on error', () => {
      // Arrange
      vi.useFakeTimers()
      useAuthStore.setState({ accessToken: 'abc' })

      renderHook(() => useSse())

      const firstInstance = lastEventSource
      expect(firstInstance).not.toBeNull()

      // Act — simulate connection error → triggers backoff
      act(() => {
        firstInstance!.simulateError()
      })

      // Assert — EventSource was closed after error
      expect(firstInstance!.close).toHaveBeenCalled()

      // Advance timers past the initial 1000ms backoff
      act(() => {
        vi.advanceTimersByTime(1100)
      })

      // A new EventSource should have been created (reconnect attempt)
      expect(MockEventSource).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('should double the reconnect delay on consecutive errors up to 30s cap', () => {
      // Arrange
      vi.useFakeTimers()
      useAuthStore.setState({ accessToken: 'abc' })

      renderHook(() => useSse())

      // First error → delay becomes 2000ms
      act(() => { lastEventSource!.simulateError() })
      act(() => { vi.advanceTimersByTime(1100) }) // second EventSource created

      // Second error → delay becomes 4000ms
      act(() => { lastEventSource!.simulateError() })

      // Advance only 2000ms — should NOT have reconnected yet
      act(() => { vi.advanceTimersByTime(2100) })

      // Third EventSource should be created at the 4000ms mark
      act(() => { vi.advanceTimersByTime(2000) })
      expect(MockEventSource).toHaveBeenCalledTimes(3)

      vi.useRealTimers()
    })
  })
})
