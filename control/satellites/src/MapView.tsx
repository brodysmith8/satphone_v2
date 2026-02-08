

/**
 * Top-down 2D equirectangular map view of satellite positions.
 * Accepts the same API data shape as Globe: id -> { latitude, longitude, height }
 * with latitude/longitude in RADIANS and height in meters.
 * Supports zoom (buttons + wheel) and drag-to-pan.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import earthTextureUrl from './assets/earth_atmos_2048.jpg'
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

  const entries = satellitePositionData ? Object.entries(satellitePositionData) : []
  const width = MAP_WIDTH
  const height = MAP_HEIGHT

  const points = entries.map(([id, pos]) => {
    const { latDeg, lonDeg } = positionToDegrees(pos)
    const { x, y } = lonLatToXY(lonDeg, latDeg, width, height)
    return {
      id,
      x,
      y,
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
      <p className="map-view-hint">Equirectangular map · True lat/lon from simulator · Scroll to zoom · Drag to pan</p>
    </div>
  )
}
