/**
 * Backend connection configuration.
 *
 * Both values are overridable at build time via Vite env vars (VITE_API_BASE /
 * VITE_WS_URL) so the same bundle can target different backends. Defaults point
 * at a local backend fronted by nginx (REST under /api, WebSocket under /ws).
 */
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ?? 'http://localhost:8848/api'

export const WS_URL: string =
  import.meta.env.VITE_WS_URL ?? 'ws://localhost:8848/ws/positions'
