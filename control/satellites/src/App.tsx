import { useState, useEffect } from 'react'
import { Globe } from './Globe'
import { MapView } from './MapView'
import { SatelliteCoordinatesBox } from './SatelliteCoordinatesBox'
import { type SatellitePositionData } from './satellitePosition'

const STATUS_URL = 'http://localhost:8848/status/all'

function App() {
  const [satellitePositionData, setSatellitePositionData] =
    useState<SatellitePositionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchStatus() {
    setError(null)
    setSatellitePositionData(null)
    setLoading(true)
    try {
      const res = await fetch(STATUS_URL)
      const text = await res.text()
      try {
        const data = JSON.parse(text) as SatellitePositionData
        setSatellitePositionData(data)
      } catch {
        // non-JSON response: keep previous state
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
      <SatelliteCoordinatesBox satellitePositionData={satellitePositionData} />
    </div>
  )
}

export default App
