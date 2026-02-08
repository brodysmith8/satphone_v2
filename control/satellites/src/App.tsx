import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
const STATUS_URL = 'http://localhost:8848/status/all'

function SphereScene() {
  return (
    <>
      {/* Single sun-like directional light (e.g. Sun illuminating Earth) */}
      <directionalLight
        position={[10, 10, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {/* Soft ambient so the dark side isn't pitch black */}
      <ambientLight intensity={0.15} />
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color="#3a7ca5"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResponse(null)
    setLoading(true)
    try {
      const res = await fetch(STATUS_URL)
      const text = await res.text()
      try {
        const data = JSON.parse(text)
        setResponse(JSON.stringify(data, null, 2))
      } catch {
        setResponse(text || `(empty, status ${res.status})`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
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
          <SphereScene />
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
