import { useState, useEffect, useRef, useCallback } from 'react'

const API_BASE = 'http://localhost:8848'

type Granularity = 'tight' | 'fine' | 'coarse'

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
}

const DEFAULT_GRANULARITY: Granularity = 'fine'
const POST_DEBOUNCE_MS = 150

/** Clamp to range and coerce to a non-negative integer (backend requires integral, non-negative). */
function clampDelay(value: number, min: number, max: number): number {
  const clamped = Math.min(Math.max(value, min), max)
  return Math.max(0, Math.round(clamped))
}

export function SimulationMetadataMenu() {
  const [open, setOpen] = useState(false)
  const [delay, setDelay] = useState(0)
  const [granularity, setGranularity] = useState<Granularity>(DEFAULT_GRANULARITY)
  const [error, setError] = useState<string | null>(null)

  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const postTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const range = GRANULARITIES[granularity]

  // Fetch the current delay whenever the popup opens (it may have changed elsewhere).
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
    fetchDelay()
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

  // Clear any pending debounced POST on unmount.
  useEffect(() => {
    return () => {
      if (postTimerRef.current) clearTimeout(postTimerRef.current)
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

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = clampDelay(Number(event.target.value), range.min, range.max)
    setDelay(value)
    postDelay(value)
  }

  // Switching granularity only changes the slider scale — it does not POST.
  // If the current delay exceeds the new max, the thumb clamps for display only.
  const thumbValue = Math.min(Math.max(delay, range.min), range.max)

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
          <div className="sim-metadata-menu__granularity" role="group" aria-label="Slider granularity">
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

          <div className="sim-metadata-menu__value">{delay} µs</div>

          {error && (
            <p className="sim-metadata-menu__error" role="alert" aria-live="polite">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
