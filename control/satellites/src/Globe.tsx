import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useTexture } from '@react-three/drei'

import earthTextureUrl from './assets/earth_atmos_2048.jpg'

const EARTH_RADIUS_KM = 6371
const LAT_LON_SCALE = 1e7
const HEIGHT_SCALE = 1000
const ANGULAR_EXAGGERATION = 1e6

/** Satellite position as returned by the API (lat/lon in scale units, height in meters). */
export type SatellitePosition = {
  latitude: number
  longitude: number
  height: number
}

/** Map of satellite id -> position (JSON from API). */
export type SatellitePositionData = Record<string, SatellitePosition>

function sphericalToCartesian(
  height: number,
  lat: number,
  lon: number,
  ref: { latDeg: number; lonDeg: number }
): [number, number, number] {
  const latDeg = lat / LAT_LON_SCALE
  const lonDeg = lon / LAT_LON_SCALE
  const latDisplay = ref.latDeg + (latDeg - ref.latDeg) * ANGULAR_EXAGGERATION
  const lonDisplay = ref.lonDeg + (lonDeg - ref.lonDeg) * ANGULAR_EXAGGERATION
  const heightKm = height / HEIGHT_SCALE
  const r = 1 + heightKm / EARTH_RADIUS_KM
  const phi = (latDisplay * Math.PI) / 180
  const theta = (lonDisplay * Math.PI) / 180
  const x = r * Math.cos(phi) * Math.cos(theta)
  const y = r * Math.sin(phi)
  const z = r * Math.cos(phi) * Math.sin(theta)
  return [x, y, z]
}

function computeCenter(entries: [string, SatellitePosition][]): {
  latDeg: number
  lonDeg: number
} {
  if (entries.length === 0) return { latDeg: 0, lonDeg: 0 }
  const sorted = [...entries].sort(([a], [b]) => a.localeCompare(b))
  return {
    latDeg:
      sorted.reduce((s, [, st]) => s + st.latitude / LAT_LON_SCALE, 0) /
      sorted.length,
    lonDeg:
      sorted.reduce((s, [, st]) => s + st.longitude / LAT_LON_SCALE, 0) /
      sorted.length,
  }
}

function SatelliteNode({
  height,
  latitude,
  longitude,
  center,
}: SatellitePosition & { center: { latDeg: number; lonDeg: number } }) {
  const [x, y, z] = sphericalToCartesian(height, latitude, longitude, center)
  const r = 1 + height / HEIGHT_SCALE / EARTH_RADIUS_KM
  const scale = Math.max(0.012, Math.min(0.04, (r - 1) * 3 + 0.015))
  return (
    <group position={[x, y, z]}>
      <pointLight
        color="#f0d060"
        intensity={0.25}
        distance={0.4}
        decay={2}
      />
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
  viewCenter,
}: {
  positions: SatellitePositionData | null
  viewCenter: { latDeg: number; lonDeg: number }
}) {
  const entries = positions ? Object.entries(positions) : []
  return (
    <>
      <directionalLight
        position={[10, 10, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <ambientLight intensity={0.4} />
      <EarthSphere />
      {entries.map(([id, state]) => (
        <SatelliteNode key={id} {...state} center={viewCenter} />
      ))}
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
  /** Satellite position data (JSON from API): id -> { latitude, longitude, height }. */
  satellitePositionData: SatellitePositionData | null
}

export function Globe({ satellitePositionData }: GlobeProps) {
  const [viewCenter, setViewCenter] = useState<{
    latDeg: number
    lonDeg: number
  }>({ latDeg: 0, lonDeg: 0 })
  const [satelliteIds, setSatelliteIds] = useState<string[]>([])

  useEffect(() => {
    if (!satellitePositionData) return
    const entries = Object.entries(satellitePositionData)
    const ids = entries.map(([id]) => id).sort()
    const idsKey = ids.join(',')
    const prevIdsKey = satelliteIds.join(',')
    if (idsKey !== prevIdsKey) {
      setViewCenter(computeCenter(entries as [string, SatellitePosition][]))
      setSatelliteIds(ids)
    }
  }, [satellitePositionData, satelliteIds])

  const center = viewCenter

  return (
    <div className="sphere-container">
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 50 }}
        gl={{ antialias: true }}
        shadows
      >
        <SphereScene
          positions={satellitePositionData}
          viewCenter={center}
        />
      </Canvas>
      <p className="sphere-hint">Drag to rotate · Scroll to zoom</p>
    </div>
  )
}
