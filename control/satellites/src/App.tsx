import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
const STATUS_URL = 'http://localhost:8848/status/all'

const EARTH_RADIUS_KM = 6371
const LAT_LON_SCALE = 1e7
const HEIGHT_SCALE = 1e6
const ANGULAR_EXAGGERATION = 1e6

type SatelliteState = {
  height: number
  latitude: number
  longitude: number
}

type StatusResponse = Record<string, SatelliteState>

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

function SatelliteNode({
  height,
  latitude,
  longitude,
  center,
}: SatelliteState & { center: { latDeg: number; lonDeg: number } }) {
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

function SphereScene({ satellites }: { satellites: StatusResponse | null }) {
  const entries = satellites ? Object.entries(satellites) : []
  const ref =
    entries.length > 0
      ? {
          latDeg:
            entries.reduce((s, [, st]) => s + st.latitude / LAT_LON_SCALE, 0) /
            entries.length,
          lonDeg:
            entries.reduce((s, [, st]) => s + st.longitude / LAT_LON_SCALE, 0) /
            entries.length,
        }
      : { latDeg: 0, lonDeg: 0 }
  return (
    <>
      <directionalLight
        position={[10, 10, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <ambientLight intensity={0.4} />
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color="#3a7ca5"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
      {entries.map(([id, state]) => (
        <SatelliteNode key={id} {...state} center={ref} />
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

function App() {
  const [response, setResponse] = useState<string | null>(null)
  const [satellites, setSatellites] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchStatus() {
    setError(null)
    setResponse(null)
    setSatellites(null)
    setLoading(true)
    try {
      const res = await fetch(STATUS_URL)
      const text = await res.text()
      try {
        const data = JSON.parse(text) as StatusResponse
        setResponse(JSON.stringify(data, null, 2))
        setSatellites(data)
      } catch {
        setResponse(text || `(empty, status ${res.status})`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(STATUS_URL)
        const text = await res.text()
        const data = JSON.parse(text) as StatusResponse
        setSatellites(data)
        setResponse(JSON.stringify(data, null, 2))
      } catch {
        // keep previous state on poll error
      }
    }
    poll()
    const id = setInterval(poll, 100)
    return () => clearInterval(id)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetchStatus()
  }

  return (
    <div className="app">
      <h1>Satellites</h1>

      <div className="sphere-container">
        <Canvas
          camera={{ position: [0, 0, 3], fov: 50 }}
          gl={{ antialias: true }}
          shadows
        >
          <SphereScene satellites={satellites} />
        </Canvas>
        <p className="sphere-hint">Drag to rotate · Scroll to zoom</p>
      </div>

      <form onSubmit={handleSubmit} className="status-form">
        <button type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'GET /status/all'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {response && (
        <div className="response">
          <h2>Response</h2>
          <pre><code>{response}</code></pre>
        </div>
      )}
    </div>
  )
}

export default App
