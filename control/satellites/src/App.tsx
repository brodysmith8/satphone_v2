import { useState, useEffect } from 'react'
import { Globe } from './Globe'
import { MapView } from './MapView'
import { SatelliteCoordinatesBox } from './SatelliteCoordinatesBox'
import { SimulationMetadataMenu } from './SimulationMetadataMenu'
import { type SatellitePositionData } from './satellitePosition'
import { subscribeToSatelliteStream } from './satelliteStream'

function App() {
  const [satellitePositionData, setSatellitePositionData] =
    useState<SatellitePositionData | null>(null)
  const [addSatelliteError, setAddSatelliteError] = useState<string | null>(null)

  useEffect(() => {
    const stream = subscribeToSatelliteStream(setSatellitePositionData)
    return () => stream.close()
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Satellites</h1>
        <SimulationMetadataMenu />
      </header>

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
