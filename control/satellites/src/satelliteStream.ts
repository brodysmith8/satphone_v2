/**
 * WebSocket client for the satellite position data plane.
 *
 * Replaces the old 100 ms polling loop: opens a single persistent connection to
 * WS_URL and invokes a callback with each position frame. The frame shape is
 * identical to GET /status/all, so SatellitePositionData is reused unchanged.
 * Reconnects with capped exponential backoff on close/error.
 */
import { API_BASE, WS_URL } from './config'
import { type SatellitePositionData } from './satellitePosition'

const RECONNECT_BASE_MS = 500
const RECONNECT_MAX_MS = 10_000

export type SatelliteStreamHandle = {
  /** Close the stream and stop reconnecting. */
  close: () => void
}

/**
 * Subscribe to the position stream. Calls onFrame for every frame received.
 * Optionally fetches one snapshot from REST immediately so the UI has data
 * before the socket finishes connecting. Returns a handle to close the stream.
 */
export function subscribeToSatelliteStream(
  onFrame: (data: SatellitePositionData) => void,
): SatelliteStreamHandle {
  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let attempts = 0
  let closed = false

  // Immediate snapshot so the globe/map have something to draw right away.
  fetch(`${API_BASE}/status/all`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!closed && data) onFrame(data as SatellitePositionData)
    })
    .catch(() => {
      // Ignore; the socket will deliver frames shortly.
    })

  const connect = () => {
    if (closed) return
    socket = new WebSocket(WS_URL)

    socket.onopen = () => {
      attempts = 0
    }

    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as SatellitePositionData
        onFrame(data)
      } catch {
        // Ignore malformed frames; keep previous state.
      }
    }

    socket.onclose = () => {
      socket = null
      scheduleReconnect()
    }

    socket.onerror = () => {
      // onclose fires after onerror; reconnect is scheduled there.
      socket?.close()
    }
  }

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** attempts,
      RECONNECT_MAX_MS,
    )
    attempts += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  connect()

  return {
    close: () => {
      closed = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      if (socket) {
        socket.onclose = null
        socket.onerror = null
        socket.close()
        socket = null
      }
    },
  }
}
