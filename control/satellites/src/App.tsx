import { useState, useEffect } from 'react'
import { Globe } from './Globe'
import { MapView } from './MapView'
import { type SatellitePositionData } from './satellitePosition'

const STATUS_URL = 'http://localhost:8848/status/all'

function App() {
  const [response, setResponse] = useState<string | null>(null)
  const [satellitePositionData, setSatellitePositionData] =
    useState<SatellitePositionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchStatus() {
    setError(null)
    setResponse(null)
    setSatellitePositionData(null)
    setLoading(true)
    try {
      const res = await fetch(STATUS_URL)
      const text = await res.text()
      try {
        const data = JSON.parse(text) as SatellitePositionData
        setResponse(JSON.stringify(data, null, 2))
        setSatellitePositionData(data)
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
        const data = JSON.parse(text) as SatellitePositionData
        setSatellitePositionData(data)
        setResponse(JSON.stringify(data, null, 2))
      } catch {
        // keep previous state on poll error
      }
    }
    poll()
    const id = setInterval(poll, 10) // 10 = 10ms poll interval
    return () => clearInterval(id)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetchStatus()
  }

  return (
    <div className="app">
      <h1>Satellites</h1>

      <Globe satellitePositionData={satellitePositionData} />

      <MapView satellitePositionData={satellitePositionData} />

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
