import { type SatellitePositionData } from './satellitePosition'

export type SatelliteCoordinatesBoxProps = {
  /** Satellite position data (JSON from API): lat/lon in radians, height in meters. */
  satellitePositionData: SatellitePositionData | null
}

export function SatelliteCoordinatesBox({
  satellitePositionData,
}: SatelliteCoordinatesBoxProps) {
  const content =
    satellitePositionData != null
      ? JSON.stringify(satellitePositionData, null, 2)
      : 'No data yet.'

  return (
    <div className="response" aria-label="Satellite coordinates">
      <h2>Satellite coordinates</h2>
      <pre className="response-content">
        <code className="response-code">{content}</code>
      </pre>
    </div>
  )
}
