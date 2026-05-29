import { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE } from './config'

type Granularity = 'tight' | 'fine' | 'coarse' | 'extreme'

type GranularitySetting = {
  label: string
  min: number
  max: number
  step: number
}

// Delay is in microseconds (µs). Ranges target sub-millisecond delays.
const GRANULARITIES: Record<Granularity, GranularitySetting> = {
  tight: { label: 'Tight', min: 0, max: 625, step: 6.25 }, //   max 0.625 ms, step 0.00625 ms
  fine: { label: 'Fine', min: 0, max: 1250, step: 12.5 }, //   max 1.25 ms,  step 0.0125 ms
  coarse: { label: 'Coarse', min: 0, max: 5000, step: 125 }, // max 5 ms,     step 0.125 ms
  extreme: { label: 'Extreme', min: 0, max: 5_000_000, step: 125_000 }, // max 5 s, step 125 ms
}

const DEFAULT_GRANULARITY: Granularity = 'fine'
const POST_DEBOUNCE_MS = 150

// Simulation time step (dt) is in seconds. Ranges span ~1 µs up to days. The
// backend rejects dt <= 0, so every min is a small positive value (not 0).
const DT_GRANULARITIES: Record<Granularity, GranularitySetting> = {
  tight: { label: 'Tight', min: 1e-6, max: 1e-4, step: 1e-6 }, //   max 100 µs, step 1 µs
  fine: { label: 'Fine', min: 1e-6, max: 1e-2, step: 1e-4 }, //     max 10 ms,  step 0.1 ms
  coarse: { label: 'Coarse', min: 1e-3, max: 1, step: 1e-2 }, //    max 1 s,    step 10 ms
  extreme: { label: 'Extreme', min: 1e-3, max: 86_400, step: 60 }, // max 1 day, step 1 min
}

const DEFAULT_DT_GRANULARITY: Granularity = 'fine'

// Stream broadcast cadence (Hz) for the WebSocket data plane. Mirrors backend
// validation in POST /stream/rate (1–144 Hz).
const RATE_MIN = 1
const RATE_MAX = 144
const RATE_STEP = 1
const DEFAULT_RATE = 144

/** Clamp to range and coerce to an integer (backend requires 1–144 Hz). */
function clampRate(value: number): number {
  const clamped = Math.min(Math.max(value, RATE_MIN), RATE_MAX)
  return Math.round(clamped)
}

/** Clamp to range and coerce to a non-negative integer (backend requires integral, non-negative). */
function clampDelay(value: number, min: number, max: number): number {
  const clamped = Math.min(Math.max(value, min), max)
  return Math.max(0, Math.round(clamped))
}

/** Clamp to range and enforce a positive result (backend rejects dt <= 0). */
function clampDt(value: number, min: number, max: number): number {
  const clamped = Math.min(Math.max(value, min), max)
  return Math.max(min, clamped)
}

/** Trim trailing zeros from a fixed-decimal string (e.g. "1.250" -> "1.25", "5.000" -> "5"). */
function trimDecimals(value: string): string {
  return value.replace(/\.?0+$/, '')
}

/** Format a delay in microseconds into the most readable unit (µs / ms / s). */
function formatDelay(us: number): string {
  if (us >= 1_000_000) return `${trimDecimals((us / 1_000_000).toFixed(3))} s`
  if (us >= 1_000) return `${trimDecimals((us / 1_000).toFixed(3))} ms`
  return `${us} µs`
}

/** Format a time step in seconds into the largest readable unit (µs / ms / s / min / hr / day). */
function formatDt(seconds: number): string {
  if (seconds < 1e-3) return `${trimDecimals((seconds * 1_000_000).toFixed(3))} µs`
  if (seconds < 1) return `${trimDecimals((seconds * 1_000).toFixed(3))} ms`
  if (seconds < 60) return `${trimDecimals(seconds.toFixed(3))} s`
  if (seconds < 3600) return `${trimDecimals((seconds / 60).toFixed(3))} min`
  if (seconds < 86_400) return `${trimDecimals((seconds / 3600).toFixed(3))} hr`
  return `${trimDecimals((seconds / 86_400).toFixed(3))} day`
}

export function SimulationMetadataMenu() {
  const [open, setOpen] = useState(false)
  const [delay, setDelay] = useState(0)
  const [granularity, setGranularity] = useState<Granularity>(DEFAULT_GRANULARITY)
  const [error, setError] = useState<string | null>(null)
  const [dt, setDt] = useState(DT_GRANULARITIES[DEFAULT_DT_GRANULARITY].min)
  const [dtGranularity, setDtGranularity] = useState<Granularity>(DEFAULT_DT_GRANULARITY)
  const [dtError, setDtError] = useState<string | null>(null)
  const [rate, setRate] = useState(DEFAULT_RATE)
  const [rateError, setRateError] = useState<string | null>(null)

  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const postTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dtPostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ratePostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const range = GRANULARITIES[granularity]
  const dtRange = DT_GRANULARITIES[dtGranularity]

  // Fetch current delay + stream rate whenever the popup opens (they may have
  // changed elsewhere).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const fetchDelay = async () => {
      try {
        const res = await fetch(`${API_BASE}/delay`)
        if (!res.ok) throw new Error(`GET /delay failed (${res.status})`)
        const data = (await res.json()) as { delay: number }
        if (!cancelled) {
          setDelay(data.delay)
          setError(null)
        }
      } catch {
        if (!cancelled) setError('Could not load current delay.')
      }
    }
    const fetchDt = async () => {
      try {
        const res = await fetch(`${API_BASE}/dt`)
        if (!res.ok) throw new Error(`GET /dt failed (${res.status})`)
        const data = (await res.json()) as { dt: number }
        if (!cancelled) {
          setDt(data.dt)
          setDtError(null)
        }
      } catch {
        if (!cancelled) setDtError('Could not load current time step.')
      }
    }
    const fetchRate = async () => {
      try {
        const res = await fetch(`${API_BASE}/stream/rate`)
        if (!res.ok) throw new Error(`GET /stream/rate failed (${res.status})`)
        const data = (await res.json()) as { rate: number }
        if (!cancelled) {
          setRate(clampRate(data.rate))
          setRateError(null)
        }
      } catch {
        if (!cancelled) setRateError('Could not load current rate.')
      }
    }
    fetchDelay()
    fetchDt()
    fetchRate()
    return () => {
      cancelled = true
    }
  }, [open])

  // Close the popup when clicking outside of it.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Clear any pending debounced POSTs on unmount.
  useEffect(() => {
    return () => {
      if (postTimerRef.current) clearTimeout(postTimerRef.current)
      if (dtPostTimerRef.current) clearTimeout(dtPostTimerRef.current)
      if (ratePostTimerRef.current) clearTimeout(ratePostTimerRef.current)
    }
  }, [])

  const postDelay = useCallback((value: number) => {
    if (postTimerRef.current) clearTimeout(postTimerRef.current)
    postTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/delay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delay: value }),
        })
        if (!res.ok) throw new Error(`POST /delay failed (${res.status})`)
        setError(null)
      } catch {
        setError('Could not update delay.')
      }
    }, POST_DEBOUNCE_MS)
  }, [])

  const postDt = useCallback((value: number) => {
    if (dtPostTimerRef.current) clearTimeout(dtPostTimerRef.current)
    dtPostTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/dt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dt: value }),
        })
        if (!res.ok) throw new Error(`POST /dt failed (${res.status})`)
        setDtError(null)
      } catch {
        setDtError('Could not update time step.')
      }
    }, POST_DEBOUNCE_MS)
  }, [])

  const postRate = useCallback((value: number) => {
    if (ratePostTimerRef.current) clearTimeout(ratePostTimerRef.current)
    ratePostTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/stream/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rate: value }),
        })
        if (!res.ok) throw new Error(`POST /stream/rate failed (${res.status})`)
        setRateError(null)
      } catch {
        setRateError('Could not update rate.')
      }
    }, POST_DEBOUNCE_MS)
  }, [])

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = clampDelay(Number(event.target.value), range.min, range.max)
    setDelay(value)
    postDelay(value)
  }

  const handleDtSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = clampDt(Number(event.target.value), dtRange.min, dtRange.max)
    setDt(value)
    postDt(value)
  }

  const handleRateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = clampRate(Number(event.target.value))
    setRate(value)
    postRate(value)
  }

  // Switching granularity only changes the slider scale — it does not POST.
  // If the current delay exceeds the new max, the thumb clamps for display only.
  const thumbValue = Math.min(Math.max(delay, range.min), range.max)
  const dtThumbValue = Math.min(Math.max(dt, dtRange.min), dtRange.max)

  return (
    <div className="sim-metadata-menu" ref={wrapperRef}>
      <button
        type="button"
        className="sim-metadata-menu__gear"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Simulation settings"
        aria-expanded={open}
        title="Simulation settings"
      >
        ⚙
      </button>

      {open && (
        <div className="sim-metadata-menu__popup" role="dialog" aria-label="Simulation settings">
          <section className="sim-metadata-menu__section" aria-label="Simulation Metadata">
            <h2 className="sim-metadata-menu__section-title">Simulation Metadata</h2>

            <div className="sim-metadata-menu__subsection">
              <h3 className="sim-metadata-menu__subsection-title">Delay</h3>

              <div className="sim-metadata-menu__granularity" role="group" aria-label="Delay slider granularity">
                {(Object.keys(GRANULARITIES) as Granularity[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={
                      'sim-metadata-menu__granularity-button' +
                      (key === granularity ? ' sim-metadata-menu__granularity-button--active' : '')
                    }
                    aria-pressed={key === granularity}
                    onClick={() => setGranularity(key)}
                  >
                    {GRANULARITIES[key].label}
                  </button>
                ))}
              </div>

              <input
                type="range"
                className="sim-metadata-menu__slider"
                min={range.min}
                max={range.max}
                step={range.step}
                value={thumbValue}
                onChange={handleSliderChange}
                aria-label="Simulation delay (µs)"
              />

              <div className="sim-metadata-menu__value">{formatDelay(delay)}</div>

              {error && (
                <p className="sim-metadata-menu__error" role="alert" aria-live="polite">
                  {error}
                </p>
              )}
            </div>

            <div className="sim-metadata-menu__subsection">
              <h3 className="sim-metadata-menu__subsection-title">Time Step</h3>

              <div className="sim-metadata-menu__granularity" role="group" aria-label="Time step slider granularity">
                {(Object.keys(DT_GRANULARITIES) as Granularity[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={
                      'sim-metadata-menu__granularity-button' +
                      (key === dtGranularity ? ' sim-metadata-menu__granularity-button--active' : '')
                    }
                    aria-pressed={key === dtGranularity}
                    onClick={() => setDtGranularity(key)}
                  >
                    {DT_GRANULARITIES[key].label}
                  </button>
                ))}
              </div>

              <input
                type="range"
                className="sim-metadata-menu__slider"
                min={dtRange.min}
                max={dtRange.max}
                step={dtRange.step}
                value={dtThumbValue}
                onChange={handleDtSliderChange}
                aria-label="Simulation time step (s)"
              />

              <div className="sim-metadata-menu__value">{formatDt(dt)}</div>

              {dtError && (
                <p className="sim-metadata-menu__error" role="alert" aria-live="polite">
                  {dtError}
                </p>
              )}
            </div>
          </section>

          <section className="sim-metadata-menu__section" aria-label="Application Metadata">
            <h2 className="sim-metadata-menu__section-title">Application Metadata</h2>

            <input
              type="range"
              className="sim-metadata-menu__slider"
              min={RATE_MIN}
              max={RATE_MAX}
              step={RATE_STEP}
              value={rate}
              onChange={handleRateChange}
              aria-label="Stream rate (Hz)"
            />

            <div className="sim-metadata-menu__value">{rate} Hz</div>

            {rateError && (
              <p className="sim-metadata-menu__error" role="alert" aria-live="polite">
                {rateError}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
