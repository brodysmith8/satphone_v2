import {
  type SatellitePositionData,
  positionToDegrees,
} from './satellitePosition'
import { API_BASE } from './config'

export type SatelliteCoordinatesBoxProps = {
  /** Satellite position data (JSON from API): lat/lon in radians, height in meters. */
  satellitePositionData: SatellitePositionData | null
  /** Error message from a failed add-satellite (POST /satellite) request, if any. */
  addSatelliteError?: string | null
  /** Called when the user dismisses the add-satellite error. */
  onDismissAddSatelliteError?: () => void
}

async function deleteSatellite(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/satellite/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  return res.ok
}

function formatDegrees(value: number): string {
  return `${value >= 0 ? '' : '−'}${Math.abs(value).toFixed(5)}°`
}

function formatAltitudeKm(km: number): string {
  return `${km.toFixed(2)} km`
}

export function SatelliteCoordinatesBox({
  satellitePositionData,
  addSatelliteError,
  onDismissAddSatelliteError,
}: SatelliteCoordinatesBoxProps) {
  const entries =
    satellitePositionData != null ? Object.entries(satellitePositionData) : []
  const hasAddError =
    addSatelliteError != null && String(addSatelliteError).trim() !== ''

  return (
    <section
      className="satellite-coords"
      aria-label="Satellite coordinates"
    >
      <h2>Satellite coordinates</h2>
      {hasAddError && (
        <div
          className="satellite-coords__error"
          role="alert"
          aria-live="polite"
        >
          <p className="satellite-coords__error-message">
            {addSatelliteError}
          </p>
          {onDismissAddSatelliteError && (
            <button
              type="button"
              className="satellite-coords__error-dismiss"
              onClick={onDismissAddSatelliteError}
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
      {entries.length === 0 ? (
        <p className="satellite-coords__empty">No data yet.</p>
      ) : (
        <ul className="satellite-coords__list" role="list">
          {entries.map(([id, pos]) => {
            const { latDeg, lonDeg, heightKm } = positionToDegrees(pos)
            const handleDelete = async () => {
              if (!window.confirm(`Delete satellite "${id}"?`)) return
              const ok = await deleteSatellite(id)
              if (!ok) {
                // eslint-disable-next-line no-alert
                window.alert(`Failed to delete satellite "${id}".`)
              }
            }
            return (
              <li key={id} className="satellite-coords__card">
                <div className="satellite-coords__card-header">
                  <div className="satellite-coords__id">{id}</div>
                  <button
                    type="button"
                    className="satellite-coords__delete"
                    onClick={handleDelete}
                    title={`Delete satellite ${id}`}
                    aria-label={`Delete satellite ${id}`}
                  >
                    Delete
                  </button>
                </div>
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
