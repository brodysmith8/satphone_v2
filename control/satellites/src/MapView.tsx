

/**
 * Top-down 2D equirectangular map view of satellite positions.
 * Accepts the same API data shape as Globe: id -> { latitude, longitude, height }
 * with latitude/longitude in RADIANS and height in meters.
 * Supports zoom (buttons + wheel) and drag-to-pan.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import earthTextureUrl from './assets/earth_5400x2700.png'
import {
  type SatellitePosition,
  type SatellitePositionData,
  positionToDegrees,
} from './satellitePosition'

const MAP_WIDTH = 800
const MAP_HEIGHT = 400
const ZOOM_MIN = 0.5
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25
const CLICK_DRAG_THRESHOLD_PX = 6
const SATELLITE_CLICK_RADIUS = 25
/** Name line: tight like Globe (globe-satellite-label-line--name padding 1px 4px). */
const NAME_RECT_WIDTH = 30
const NAME_RECT_HEIGHT = 14
/** Coords line: three lines at 11px line height; rect sized to center the text block. */
const COORDS_RECT_WIDTH = 90
const COORDS_RECT_HEIGHT = 39

/** Distance range (view coords) over which focus fades from 1 to 0. Matches Globe's gradual focus. */
const FOCUS_DISTANCE_RANGE = 60
/** Lerp factor per frame (~60fps). Same as Globe for consistent feel. */
const FOCUS_SMOOTHING = 0.18
/** Only re-render when display focus change exceeds this (performance). */
const FOCUS_UPDATE_THRESHOLD = 0.004

export type MapViewPosition = SatellitePosition
export type MapViewPositionData = SatellitePositionData

export type MapViewProps = {
  /** Satellite position data (JSON from API): lat/lon in radians, height in meters. */
  satellitePositionData: MapViewPositionData | null
}

/**
 * Equirectangular projection aligned with the shared Earth texture and simulation lat/lon:
 * - Texture center (width/2, height/2) = prime meridian (0° lon), equator (0° lat).
 * - lon [-180, 180] -> x [0, width]; lat [90, -90] -> y [0, height].
 */
function lonLatToXY(
  lonDeg: number,
  latDeg: number,
  width: number,
  height: number
): { x: number; y: number } {
  const x = ((lonDeg + 180) / 360) * width
  const y = ((90 - latDeg) / 180) * height
  return { x, y }
}

function clampZoom(zoom: number) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom))
}

function clampPan(pan: number, visible: number, total: number) {
  const maxPan = Math.max(0, (total - visible) / 2)
  return Math.max(-maxPan, Math.min(maxPan, pan))
}

/**
 * Map client (clientX, clientY) to SVG viewBox coordinates using xMidYMid meet.
 */
function clientToView(
  clientX: number,
  clientY: number,
  svgEl: SVGSVGElement | null,
  viewBoxX: number,
  viewBoxY: number,
  visibleWidth: number,
  visibleHeight: number
): { x: number; y: number } | null {
  if (!svgEl) return null
  const rect = svgEl.getBoundingClientRect()
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  const scale = Math.min(rect.width / visibleWidth, rect.height / visibleHeight)
  const viewLeft = (rect.width - visibleWidth * scale) / 2
  const viewTop = (rect.height - visibleHeight * scale) / 2
  const x = viewBoxX + (localX - viewLeft) / scale
  const y = viewBoxY + (localY - viewTop) / scale
  return { x, y }
}

type DragState = {
  clientX: number
  clientY: number
  startPanX: number
  startPanY: number
  scaleX: number
  scaleY: number
}

type Point = { id: string; x: number; y: number; height: number }

export function MapView({ satellitePositionData }: MapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const viewParamsRef = useRef<{
    viewBoxX: number
    viewBoxY: number
    visibleWidth: number
    visibleHeight: number
  }>({ viewBoxX: 0, viewBoxY: 0, visibleWidth: MAP_WIDTH, visibleHeight: MAP_HEIGHT })

  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [mouseViewPos, setMouseViewPos] = useState<{ x: number; y: number } | null>(null)
  const [followedId, setFollowedId] = useState<string | null>(null)
  const [displayFocusMap, setDisplayFocusMap] = useState<Record<string, number>>({})

  const displayFocusRef = useRef<Record<string, number>>({})
  const targetFocusRef = useRef<Record<string, number>>({})
  const rafIdRef = useRef<number | null>(null)

  const entries = satellitePositionData ? Object.entries(satellitePositionData) : []
  const width = MAP_WIDTH
  const height = MAP_HEIGHT

  const points = useMemo(
    (): Point[] =>
      entries.map(([id, pos]) => {
        const { latDeg, lonDeg } = positionToDegrees(pos)
        const { x, y } = lonLatToXY(lonDeg, latDeg, width, height)
        return {
          id,
          x,
          y,
          height: pos.height,
        }
      }),
    [entries, width, height]
  )

  /** Target focus 0–1 per id from distance to cursor; 1 = closest, 0 = beyond range. */
  const targetFocusMap = useMemo((): Record<string, number> => {
    const out: Record<string, number> = {}
    if (!mouseViewPos || points.length === 0) {
      points.forEach((p: Point) => { out[p.id] = 0 })
      return out
    }
    let minDistance = Infinity
    const distances = new Map<string, number>()
    for (const p of points) {
      const d = Math.hypot(p.x - mouseViewPos.x, p.y - mouseViewPos.y)
      distances.set(p.id, d)
      if (d < minDistance) minDistance = d
    }
    for (const p of points) {
      const d = distances.get(p.id) ?? Infinity
      out[p.id] = Math.max(0, 1 - (d - minDistance) / FOCUS_DISTANCE_RANGE)
    }
    return out
  }, [mouseViewPos, points])

  targetFocusRef.current = targetFocusMap

  useEffect(() => {
    if (points.length === 0) return
    const tick = () => {
      const target = targetFocusRef.current
      const display = displayFocusRef.current
      let needsUpdate = false
      for (const id of Object.keys(target)) {
        const t = target[id] ?? 0
        const cur = display[id] ?? 0
        const next = cur + (t - cur) * FOCUS_SMOOTHING
        display[id] = next
        if (Math.abs(next - cur) > FOCUS_UPDATE_THRESHOLD) needsUpdate = true
      }
      if (needsUpdate) setDisplayFocusMap((prev: Record<string, number>) => ({ ...prev, ...display }))
      rafIdRef.current = requestAnimationFrame(tick)
    }
    rafIdRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [points.length])

  const visibleWidth = width / zoom
  const visibleHeight = height / zoom
  const followedPoint = points.find((p: Point) => p.id === followedId)
  const effectivePanX =
    followedPoint != null
      ? clampPan(followedPoint.x - width / 2, visibleWidth, width)
      : clampPan(panX, visibleWidth, width)
  const effectivePanY =
    followedPoint != null
      ? clampPan(followedPoint.y - height / 2, visibleHeight, height)
      : clampPan(panY, visibleHeight, height)
  const viewBoxX = width / 2 - visibleWidth / 2 + effectivePanX
  const viewBoxY = height / 2 - visibleHeight / 2 + effectivePanY
  const viewBox = `${viewBoxX} ${viewBoxY} ${visibleWidth} ${visibleHeight}`

  viewParamsRef.current = { viewBoxX, viewBoxY, visibleWidth, visibleHeight }

  const zoomIn = useCallback(() => setZoom((z: number) => clampZoom(z + ZOOM_STEP)), [])

  const zoomOut = useCallback(() => setZoom((z: number) => clampZoom(z - ZOOM_STEP)), [])
  const resetView = useCallback(() => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setZoom((z: number) => clampZoom(z + delta))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0 || !svgRef.current) return
      e.preventDefault()
      const rect = svgRef.current.getBoundingClientRect()
      const scaleX = visibleWidth / rect.width
      const scaleY = visibleHeight / rect.height
      setDrag({
        clientX: e.clientX,
        clientY: e.clientY,
        startPanX: panX,
        startPanY: panY,
        scaleX,
        scaleY,
      })
    },
    [visibleWidth, visibleHeight, panX, panY]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!drag) return
      const deltaX = (drag.clientX - e.clientX) * drag.scaleX
      const deltaY = (drag.clientY - e.clientY) * drag.scaleY
      setPanX(drag.startPanX + deltaX)
      setPanY(drag.startPanY + deltaY)
    },
    [drag]
  )

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!drag) return
      const dragDist = Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY)
      if (dragDist <= CLICK_DRAG_THRESHOLD_PX) {
        const vp = viewParamsRef.current
        const viewPos = clientToView(
          e.clientX,
          e.clientY,
          svgRef.current,
          vp.viewBoxX,
          vp.viewBoxY,
          vp.visibleWidth,
          vp.visibleHeight
        )
        if (viewPos) {
          let closest: { id: string; d2: number } | null = null
          for (const p of points) {
            const d2 = (p.x - viewPos.x) ** 2 + (p.y - viewPos.y) ** 2
            const r2 = SATELLITE_CLICK_RADIUS ** 2
            if (d2 <= r2 && (closest == null || d2 < closest.d2)) closest = { id: p.id, d2 }
          }
          if (closest) {
            setFollowedId((prev: string | null) => (prev === closest!.id ? null : closest!.id))
          } else {
            setFollowedId(null)
          }
        }
      }
      setDrag(null)
    },
    [drag, points]
  )

  useEffect(() => {
    if (!drag) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag, handleMouseMove, handleMouseUp])

  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const vp = viewParamsRef.current
      const viewPos = clientToView(
        e.clientX,
        e.clientY,
        svgRef.current,
        vp.viewBoxX,
        vp.viewBoxY,
        vp.visibleWidth,
        vp.visibleHeight
      )
      setMouseViewPos(viewPos)
    },
    []
  )

  const handleSvgMouseLeave = useCallback(() => setMouseViewPos(null), [])

  return (
    <div className="map-view-container">
      <div className="map-view-zoom-controls">
        {zoom !== 1 && (
          <button type="button" className="map-view-zoom-reset" onClick={resetView} aria-label="Reset zoom" title="Reset zoom and pan">
            <span className="map-view-zoom-reset-icon">⟲</span>
          </button>
        )}
        <button type="button" onClick={zoomIn} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        {zoom !== 1 && <span className="map-view-zoom-level">{Math.round(zoom * 100)}%</span>}
        <button type="button" onClick={zoomOut} aria-label="Zoom out" title="Zoom out">
          −
        </button>
      </div>
      <svg
        ref={svgRef}
        className="map-view-svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={handleSvgMouseLeave}
        style={{ cursor: drag ? 'grabbing' : 'grab', userSelect: drag ? 'none' : undefined }}
      >
        <defs>
          <pattern id="grid" width={40} height={40} patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          </pattern>
        </defs>
        {/* Equirectangular Earth: (0,0)-(width,height) = lon [-180,180], lat [90,-90] */}
        <image
          href={earthTextureUrl}
          x={0}
          y={0}
          width={width}
          height={height}
          preserveAspectRatio="none"
        />
        <rect width={width} height={height} fill="url(#grid)" />
        {/* Equator */}
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        {/* Prime meridian */}
        <line x1={width / 2} y1={0} x2={width / 2} y2={height} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        {(() => {
          const lineHeight = 11
          const labelYOffset = 20
          const sortedPoints = [...points].sort(
            (a, b) => (displayFocusMap[b.id] ?? 0) - (displayFocusMap[a.id] ?? 0)
          )
          return sortedPoints.map((point: Point) => {
            const { id, x, y, height: h } = point
            const displayFocus = displayFocusMap[id] ?? 0
            const heightKm = h / 1000
            const xR = Math.round(x * 10) / 10
            const yR = Math.round(y * 10) / 10
            const labelY = yR + labelYOffset
            const opacity = 0.4 + 0.6 * displayFocus
            const showRects = displayFocus > 0.01
            const focusFill = `rgba(0,0,0,${0.78 * displayFocus})`
            const focusStroke = `rgba(255,255,255,${0.12 * displayFocus})`
            const rectStyle = { transition: 'fill 0.2s ease-out, stroke 0.2s ease-out' }
            /* Name line rect: wrap name text (baseline at y-12, fontSize 10 ≈ top y-20, bottom y-10) */
            const nameRectX = x - NAME_RECT_WIDTH / 2
            const nameRectY = y - 12 - 10
            /* Coords rect: vertically center text block (baselines labelY, labelY+11, labelY+22; block center ≈ labelY+8) */
            const coordsRectX = x - COORDS_RECT_WIDTH / 2
            const coordsRectY = labelY + 8 - COORDS_RECT_HEIGHT / 2
            return (
              <g
                key={id}
                className="map-satellite-label-group"
                style={
                  {
                    opacity,
                    transition: 'opacity 0.08s ease-out',
                    '--focus': displayFocus,
                  } as CSSProperties & { '--focus': number }
                }
              >
                <circle cx={x} cy={y} r={6} fill="#f0c040" stroke="#2a2a3e" strokeWidth={1.5} />
                {showRects && (
                  <>
                    <rect
                      x={nameRectX}
                      y={nameRectY}
                      width={NAME_RECT_WIDTH}
                      height={NAME_RECT_HEIGHT}
                      rx={3}
                      ry={3}
                      className="map-satellite-label-rect map-satellite-label-rect--name"
                      fill={focusFill}
                      stroke={focusStroke}
                      strokeWidth={1}
                      style={rectStyle}
                    />
                    <rect
                      x={coordsRectX}
                      y={coordsRectY}
                      width={COORDS_RECT_WIDTH}
                      height={COORDS_RECT_HEIGHT}
                      rx={4}
                      ry={4}
                      className="map-satellite-label-rect map-satellite-label-rect--coords"
                      fill={focusFill}
                      stroke={focusStroke}
                      strokeWidth={1}
                      style={rectStyle}
                    />
                  </>
                )}
                <text
                  x={x}
                  y={y - 12}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.9)"
                  fontSize={10}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={2.5}
                  paintOrder="stroke fill"
                >
                  {id}
                </text>
                <text
                  x={xR}
                  y={labelY}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.6)"
                  fontSize={9}
                  fontFamily="'Courier New', Courier, monospace"
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={2}
                  paintOrder="stroke fill"
                >
                  <tspan x={xR} dy={0}>x: {xR.toFixed(1)}</tspan>
                  <tspan x={xR} dy={lineHeight}>y: {yR.toFixed(1)}</tspan>
                  <tspan x={xR} dy={lineHeight}>z: {heightKm.toFixed(2)} km</tspan>
                </text>
              </g>
            )
          })
        })()}
      </svg>
      {followedId && (
        <p className="map-view-following">
          Following <strong>{followedId}</strong> · Click satellite again or click map to stop
        </p>
      )}
      <p className="map-view-hint">
        Equirectangular map · True lat/lon from simulator · Scroll to zoom · Drag to pan
        {mouseViewPos != null ? ' · Closest label highlighted' : ''}
      </p>
    </div>
  )
}
