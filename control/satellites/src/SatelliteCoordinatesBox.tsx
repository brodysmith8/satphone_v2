import {
  type SatellitePositionData,
  positionToDegrees,
} from './satellitePosition'

export type SatelliteCoordinatesBoxProps = {
  /** Satellite position data (JSON from API): lat/lon in radians, height in meters. */
  satellitePositionData: SatellitePositionData | null
}

function formatDegrees(value: number): string {
  return `${value >= 0 ? '' : '−'}${Math.abs(value).toFixed(5)}°`
}

function formatAltitudeKm(km: number): string {
  return `${km.toFixed(2)} km`
}

export function SatelliteCoordinatesBox({
  satellitePositionData,
}: SatelliteCoordinatesBoxProps) {
  const entries =
    satellitePositionData != null ? Object.entries(satellitePositionData) : []

  return (
    <section
      className="satellite-coords"
      aria-label="Satellite coordinates"
    >
      <h2>Satellite coordinates</h2>
      {entries.length === 0 ? (
        <p className="satellite-coords__empty">No data yet.</p>
      ) : (
        <ul className="satellite-coords__list" role="list">
          {entries.map(([id, pos]) => {
            const { latDeg, lonDeg, heightKm } = positionToDegrees(pos)
            return (
              <li key={id} className="satellite-coords__card">
                <div className="satellite-coords__id">{id}</div>
                <dl className="satellite-coords__grid">
                  <div className="satellite-coords__row">
                    <dt>Latitude</dt>
                    <dd className="satellite-coords__value" aria-label={`Latitude ${formatDegrees(latDeg)}`}>
                      {formatDegrees(latDeg)}
                    </dd>
                  </div>
                  <div className="satellite-coords__row">
                    <dt>Longitude</dt>
                    <dd className="satellite-coords__value" aria-label={`Longitude ${formatDegrees(lonDeg)}`}>
                      {formatDegrees(lonDeg)}
                    </dd>
                  </div>
                  <div className="satellite-coords__row">
                    <dt>Altitude</dt>
                    <dd className="satellite-coords__value" aria-label={`Altitude ${formatAltitudeKm(heightKm)}`}>
                      {formatAltitudeKm(heightKm)}
                    </dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
