import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, useTexture } from '@react-three/drei'
import { createContext, useRef, useState, useContext, type CSSProperties } from 'react'

/** True when the pointer is over the Globe container; used to deactivate satellite focus when cursor leaves. */
const GlobeHoverContext = createContext(false)

import earthTextureUrl from './assets/earth_5400x2700.png'
import {
  type SatellitePosition,
  type SatellitePositionData,
  positionToDegrees,
} from './satellitePosition'

const EARTH_RADIUS_KM = 6371

/**
 * Convert (lat, lon) in degrees + height in meters to Cartesian (x,y,z) for a unit-radius
 * sphere. Aligned with equirectangular Earth texture and MapView: texture center (u=0.5)
 * is prime meridian (lon 0°), so we use phi = (lon + 180)° so lon 0° maps to phi = π.
 * theta = colatitude from +y.
 */
function sphericalToCartesian(
  latDeg: number,
  lonDeg: number,
  heightM: number
): [number, number, number] {
  const heightKm = heightM / 1000
  const r = 1 + heightKm / EARTH_RADIUS_KM
  const phi = ((lonDeg + 180) * Math.PI) / 180
  const theta = ((90 - latDeg) * Math.PI) / 180
  const x = -r * Math.cos(phi) * Math.sin(theta)
  const y = r * Math.cos(theta)
  const z = r * Math.sin(phi) * Math.sin(theta)
  return [x, y, z]
}

export type { SatellitePosition, SatellitePositionData }

/**
 * Dot product (satellite · camera) at which the label reaches full opacity.
 * As the satellite moves toward the limb (dot → 0) and behind (dot < 0), label opacity
 * fades linearly from 1 to 0 over the range [0, LABEL_FADE_FULL_VISIBLE].
 */
const LABEL_FADE_FULL_VISIBLE = 0.25

function labelOpacityFromDot(dot: number): number {
  if (dot >= LABEL_FADE_FULL_VISIBLE) return 1
  if (dot <= 0) return 0
  return dot / LABEL_FADE_FULL_VISIBLE
}

/** Depth range over which focus fades from 1 to 0 (in world units). Larger = smoother transition. */
const FOCUS_DEPTH_RANGE = 0.5

type SatelliteNodeProps = SatellitePosition & {
  id: string
  /** Camera position in world space; when provided, label opacity fades as satellite goes behind Earth. */
  cameraPosition: [number, number, number] | null
  /** Focus strength 0–1; 1 = closest to camera. Drives box opacity for gradual transition. */
  focus: number
}

/** Lerp factor per frame (~60fps). Higher = snappier, lower = smoother. */
const FOCUS_SMOOTHING = 0.18

function SatelliteNode({
  id,
  height,
  latitude,
  longitude,
  cameraPosition,
  focus,
}: SatelliteNodeProps) {
  const { latDeg, lonDeg, heightKm } = positionToDegrees({
    latitude,
    longitude,
    height,
  })
  const [x, y, z] = sphericalToCartesian(latDeg, lonDeg, height)
  const r = 1 + heightKm / EARTH_RADIUS_KM
  const scale = Math.max(0.012, Math.min(0.04, (r - 1) * 3 + 0.015))
  const latR = Math.round(latDeg * 10) / 10
  const lonR = Math.round(lonDeg * 10) / 10

  const dot =
    cameraPosition == null
      ? 1
      : x * cameraPosition[0] + y * cameraPosition[1] + z * cameraPosition[2]
  const labelOpacity = labelOpacityFromDot(dot)

  const displayFocusRef = useRef(focus)
  const lastRenderedRef = useRef(focus)
  const [displayFocus, setDisplayFocus] = useState(focus)
  useFrame(() => {
    displayFocusRef.current +=
      (focus - displayFocusRef.current) * FOCUS_SMOOTHING
    const next = displayFocusRef.current
    if (Math.abs(next - lastRenderedRef.current) > 0.004) {
      lastRenderedRef.current = next
      setDisplayFocus(next)
    }
  })

  return (
    <group position={[x, y, z]}>
      <pointLight
        color="#f0d060"
        intensity={0.25}
        distance={0.4}
        decay={2}
      />
      {/* Single billboard: name and coords on same 2D plane with spacer for sphere */}
      <Html
        center
        position={[0, -0.05, 0]}
        style={{
          pointerEvents: 'none',
          opacity: labelOpacity * (0.4 + 0.6 * displayFocus),
          transition: 'opacity 0.08s ease-out',
        }}
        distanceFactor={4}
      >
        <div
          className="globe-satellite-label-stack"
          style={
            {
              '--focus': displayFocus,
              zIndex: displayFocus > 0.01 ? Math.round(50 + displayFocus * 50) : 0,
            } as CSSProperties & { '--focus': number }
          }
        >
          <div className="globe-satellite-label-line globe-satellite-label-line--name">
            <div className="globe-satellite-label globe-satellite-label-id">
              {id}
            </div>
          </div>
          <div className="globe-satellite-label-spacer" aria-hidden />
          <div className="globe-satellite-label-line">
            <div className="globe-satellite-label-coords">
              <span>lat: {latR.toFixed(1)}°</span>
              <span>lon: {lonR.toFixed(1)}°</span>
              <span>alt: {heightKm.toFixed(2)} km</span>
            </div>
          </div>
        </div>
      </Html>
      <mesh scale={scale} castShadow>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color="#f0c040"
          roughness={0.3}
          metalness={0.6}
          emissive="#332200"
        />
      </mesh>
    </group>
  )
}

function EarthSphere() {
  const map = useTexture(earthTextureUrl)
  return (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial
        map={map}
        roughness={0.7}
        metalness={0.1}
      />
    </mesh>
  )
}

function SphereScene({
  positions,
}: {
  positions: SatellitePositionData | null
}) {
  const { camera } = useThree()
  const isPointerOverGlobe = useContext(GlobeHoverContext)
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>(
    () => [camera.position.x, camera.position.y, camera.position.z]
  )

  useFrame(() => {
    const { x, y, z } = camera.position
    setCameraPosition((prev: [number, number, number]) =>
      prev[0] === x && prev[1] === y && prev[2] === z ? prev : [x, y, z]
    )
  })

  const entries = positions ? Object.entries(positions) : []
  const [cx, cy, cz] = cameraPosition
  const distances = new Map<string, number>()
  let minDistance = Infinity
  for (const [id, state] of entries) {
    const { latDeg, lonDeg } = positionToDegrees({
      latitude: state.latitude,
      longitude: state.longitude,
      height: state.height,
    })
    const [x, y, z] = sphericalToCartesian(latDeg, lonDeg, state.height)
    const dx = x - cx
    const dy = y - cy
    const dz = z - cz
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
    distances.set(id, d)
    if (d < minDistance) minDistance = d
  }
  return (
    <>
      <directionalLight
        position={[10, 10, 10]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <ambientLight intensity={0.9} />
      <EarthSphere />
      {entries.map(([id, state]) => {
        const d = distances.get(id) ?? Infinity
        const computedFocus = Math.max(
          0,
          1 - (d - minDistance) / FOCUS_DEPTH_RANGE
        )
        const focus = isPointerOverGlobe ? computedFocus : 0
        return (
          <SatelliteNode
            key={id}
            id={id}
            latitude={state.latitude}
            longitude={state.longitude}
            height={state.height}
            cameraPosition={cameraPosition}
            focus={focus}
          />
        )
      })}
      <OrbitControls
        enablePan={false}
        minDistance={2}
        maxDistance={10}
        autoRotate={false}
      />
    </>
  )
}

export type GlobeProps = {
  /** Satellite position data (JSON from API): lat/lon in radians, height in meters. */
  satellitePositionData: SatellitePositionData | null
}

export function Globe({ satellitePositionData }: GlobeProps) {
  const [isPointerOverGlobe, setIsPointerOverGlobe] = useState(false)
  return (
    <GlobeHoverContext.Provider value={isPointerOverGlobe}>
      <div
        className="sphere-container"
        onPointerEnter={() => setIsPointerOverGlobe(true)}
        onPointerLeave={() => setIsPointerOverGlobe(false)}
      >
        <Canvas
          camera={{ position: [0, 0, 3.2], fov: 50 }}
          gl={{ antialias: true }}
          shadows
        >
          <SphereScene positions={satellitePositionData} />
        </Canvas>
        <p className="sphere-hint">Drag to rotate · Scroll to zoom</p>
      </div>
    </GlobeHoverContext.Provider>
  )
}
