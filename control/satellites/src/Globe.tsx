import { Canvas } from '@react-three/fiber'
import { OrbitControls, useTexture } from '@react-three/drei'

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

function SatelliteNode({ height, latitude, longitude }: SatellitePosition) {
  const { latDeg, lonDeg, heightKm } = positionToDegrees({
    latitude,
    longitude,
    height,
  })
  const [x, y, z] = sphericalToCartesian(latDeg, lonDeg, height)
  const r = 1 + heightKm / EARTH_RADIUS_KM
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
}: {
  positions: SatellitePositionData | null
}) {
  const entries = positions ? Object.entries(positions) : []
  return (
    <>
      <directionalLight
        position={[10, 10, 10]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <ambientLight intensity={0.65} />
      <EarthSphere />
      {entries.map(([id, state]) => (
        <SatelliteNode
          key={id}
          latitude={state.latitude}
          longitude={state.longitude}
          height={state.height}
        />
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
  /** Satellite position data (JSON from API): lat/lon in radians, height in meters. */
  satellitePositionData: SatellitePositionData | null
}

export function Globe({ satellitePositionData }: GlobeProps) {
  return (
    <div className="sphere-container">
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 50 }}
        gl={{ antialias: true }}
        shadows
      >
        <SphereScene positions={satellitePositionData} />
      </Canvas>
      <p className="sphere-hint">Drag to rotate · Scroll to zoom</p>
    </div>
  )
}
