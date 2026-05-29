import { useState, useEffect } from 'react'
import { Globe } from './Globe'
import { MapView } from './MapView'
import { SatelliteCoordinatesBox } from './SatelliteCoordinatesBox'
import { type SatellitePositionData } from './satellitePosition'

const STATUS_URL = 'http://localhost:8848/status/all'

function App() {
  const [satellitePositionData, setSatellitePositionData] =
    useState<SatellitePositionData | null>(null)
  const [addSatelliteError, setAddSatelliteError] = useState<string | null>(null)

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
    const id = setInterval(poll, 100) // 10 = 10ms poll interval
    return () => clearInterval(id)
  }, [])

  return (
    <div className="app">
      <h1>Satellites</h1>

      <Globe satellitePositionData={satellitePositionData} />

      <MapView
        satellitePositionData={satellitePositionData}
        onAddSatelliteError={(msg) => setAddSatelliteError(msg || null)}
      />

      <SatelliteCoordinatesBox
        satellitePositionData={satellitePositionData}
        addSatelliteError={addSatelliteError}
        onDismissAddSatelliteError={() => setAddSatelliteError(null)}
      />
    </div>
  )
}

export default App
