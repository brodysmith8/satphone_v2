

/**
 * Top-down 2D map view of satellite positions.
 * Accepts the same API data shape: id -> { latitude, longitude, height }.
 * No dependency on Globe.
 * Supports zoom (buttons + wheel) and drag-to-pan.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import earthTextureUrl from './assets/earth_atmos_2048.jpg'

const LAT_LON_SCALE = 1e7
const ANGULAR_EXAGGERATION = 1e6
const MAP_WIDTH = 800
const MAP_HEIGHT = 400
const ZOOM_MIN = 0.5
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25
/** Pixels per "exaggerated degree" so small offsets are visible (matches Globe). */
const PX_PER_EXAG_DEG = 3

export type MapViewPosition = {
  latitude: number
  longitude: number
  height: number
}

/** Map of satellite id -> position (same shape as API return). */
export type MapViewPositionData = Record<string, MapViewPosition>

export type MapViewProps = {
  /** Satellite position data (JSON from API): id -> { latitude, longitude, height }. */
  satellitePositionData: MapViewPositionData | null
}

/** Center of satellite cluster in degrees. Sorted by id to match Globe's reference frame. */
function computeCenter(entries: [string, MapViewPosition][]): { latDeg: number; lonDeg: number } {
  if (entries.length === 0) return { latDeg: 0, lonDeg: 0 }
  const sorted = [...entries].sort(([a], [b]) => a.localeCompare(b))
  return {
    latDeg:
      sorted.reduce((s, [, pos]) => s + pos.latitude / LAT_LON_SCALE, 0) / sorted.length,
    lonDeg:
      sorted.reduce((s, [, pos]) => s + pos.longitude / LAT_LON_SCALE, 0) / sorted.length,
  }
}

/**
 * Project lat/lon to SVG x,y using same center + exaggeration as Globe.
 * Origin is map center; small angular offsets are scaled so satellites don't overlap.
 */
function lonLatToXY(
  lonDeg: number,
  latDeg: number,
  center: { latDeg: number; lonDeg: number },
  width: number,
  height: number
) {
  const dLon = (lonDeg - center.lonDeg) * ANGULAR_EXAGGERATION
  const dLat = (latDeg - center.latDeg) * ANGULAR_EXAGGERATION
  const x = width / 2 + dLon * PX_PER_EXAG_DEG
  const y = height / 2 - dLat * PX_PER_EXAG_DEG
  return { x, y }
}

/** Wrap a value into [0, bound) so positions that exceed canvas bounds wrap to the opposite side. */
function wrapToCanvas(value: number, bound: number): number {
  return ((value % bound) + bound) % bound
}

function clampZoom(zoom: number) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom))
}

function clampPan(pan: number, visible: number, total: number) {
  const maxPan = Math.max(0, (total - visible) / 2)
  return Math.max(-maxPan, Math.min(maxPan, pan))
}

type DragState = {
  clientX: number
  clientY: number
  startPanX: number
  startPanY: number
  scaleX: number
  scaleY: number
}

export function MapView({ satellitePositionData }: MapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [drag, setDrag] = useState<DragState | null>(null)
  /** Fixed reference frame: set once from first data so only satellites move. */
  const [referenceCenter, setReferenceCenter] = useState<{
    latDeg: number
    lonDeg: number
  } | null>(null)

  const entries = satellitePositionData ? Object.entries(satellitePositionData) : []
  const width = MAP_WIDTH
  const height = MAP_HEIGHT

  useEffect(() => {
    if (entries.length === 0 || referenceCenter !== null) return
    setReferenceCenter(computeCenter(entries as [string, MapViewPosition][]))
  }, [entries.length, referenceCenter])

  const center = referenceCenter ?? { latDeg: 0, lonDeg: 0 }

  const points = entries.map(([id, pos]) => {
    const latDeg = pos.latitude / LAT_LON_SCALE
    const lonDeg = pos.longitude / LAT_LON_SCALE
    const { x, y } = lonLatToXY(lonDeg, latDeg, center, width, height)
    return {
      id,
      x: wrapToCanvas(x, width),
      y: wrapToCanvas(y, height),
      height: pos.height,
    }
  })

  const visibleWidth = width / zoom
  const visibleHeight = height / zoom
  const clampedPanX = clampPan(panX, visibleWidth, width)
  const clampedPanY = clampPan(panY, visibleHeight, height)
  const viewBoxX = width / 2 - visibleWidth / 2 + clampedPanX
  const viewBoxY = height / 2 - visibleHeight / 2 + clampedPanY
  const viewBox = `${viewBoxX} ${viewBoxY} ${visibleWidth} ${visibleHeight}`

  const zoomIn = useCallback(() => setZoom((z: number) => clampZoom(z + ZOOM_STEP)), [])
  const zoomOut = useCallback(() => setZoom((z: number) => clampZoom(z - ZOOM_STEP)), [])

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

  const handleMouseUp = useCallback(() => setDrag(null), [])

  useEffect(() => {
    if (!drag) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag, handleMouseMove, handleMouseUp])

  return (
    <div className="map-view-container">
      <div className="map-view-zoom-controls">
        <button type="button" onClick={zoomIn} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <span className="map-view-zoom-level">{Math.round(zoom * 100)}%</span>
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
        {points.map(({ id, x, y, height: h }) => (
          <g key={id}>
            <circle cx={x} cy={y} r={6} fill="#f0c040" stroke="#2a2a3e" strokeWidth={1.5} />
            <text x={x} y={y - 12} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={10}>
              {id}
            </text>
            <text x={x} y={y + 22} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={9}>
              {Math.round(h)} m
            </text>
          </g>
        ))}
      </svg>
      <p className="map-view-hint">Top-down view · Lat/lon from API · Scroll to zoom · Drag to pan</p>
    </div>
  )
}
