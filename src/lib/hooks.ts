import { useCallback, useEffect, useRef, useState } from 'react'

export type Player = {
  /** paso actual (0-based) */
  step: number
  count: number
  playing: boolean
  isFirst: boolean
  isLast: boolean
  play: () => void
  pause: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  reset: () => void
  goTo: (i: number) => void
}

/**
 * Controla una animación por pasos. `interval` puede ser fijo o depender del paso
 * (útil cuando un paso tiene una animación más larga, p. ej. un typewriter).
 *
 *   const player = usePlayer(steps.length, { interval: 2400 })
 *   <PlayerBar player={player} labels={steps.map(s => s.title)} />
 */
export function usePlayer(
  count: number,
  opts: { interval?: number | ((step: number) => number); loop?: boolean; autoplay?: boolean } = {},
): Player {
  const { interval = 2400, loop = false, autoplay = false } = opts
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(autoplay)
  const intervalRef = useRef(interval)
  intervalRef.current = interval

  useEffect(() => {
    if (!playing) return
    const ms = typeof intervalRef.current === 'function' ? intervalRef.current(step) : intervalRef.current
    if (step >= count - 1) {
      if (!loop) {
        setPlaying(false)
        return
      }
      const t = setTimeout(() => setStep(0), ms)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStep((s) => Math.min(s + 1, count - 1)), ms)
    return () => clearTimeout(t)
  }, [playing, step, count, loop])

  // si cambia la cantidad de pasos (p. ej. cambia el escenario), vuelve a 0
  useEffect(() => {
    setStep((s) => (s > count - 1 ? 0 : s))
  }, [count])

  const play = useCallback(() => {
    setStep((s) => (s >= count - 1 ? 0 : s))
    setPlaying(true)
  }, [count])
  const pause = useCallback(() => setPlaying(false), [])
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, play, pause])
  const next = useCallback(() => {
    setPlaying(false)
    setStep((s) => Math.min(s + 1, count - 1))
  }, [count])
  const prev = useCallback(() => {
    setPlaying(false)
    setStep((s) => Math.max(s - 1, 0))
  }, [])
  const reset = useCallback(() => {
    setPlaying(false)
    setStep(0)
  }, [])
  const goTo = useCallback(
    (i: number) => {
      setPlaying(false)
      setStep(Math.max(0, Math.min(count - 1, i)))
    },
    [count],
  )

  return { step, count, playing, isFirst: step === 0, isLast: step === count - 1, play, pause, toggle, next, prev, reset, goTo }
}

/**
 * Escribe `text` carácter a carácter (o por palabras) mientras `active` sea true.
 * Devuelve el texto visible y si terminó. Cambiar `text` reinicia.
 */
export function useTypewriter(text: string, active: boolean, opts: { cps?: number; by?: 'char' | 'word' } = {}) {
  const { cps = 60, by = 'char' } = opts
  const units = by === 'word' ? text.split(/(\s+)/) : Array.from(text)
  const [n, setN] = useState(0)

  useEffect(() => {
    setN(0)
  }, [text])

  useEffect(() => {
    if (!active) return
    if (n >= units.length) return
    const t = setTimeout(() => setN((x) => x + 1), 1000 / cps)
    return () => clearTimeout(t)
  }, [active, n, units.length, cps])

  return { shown: active ? units.slice(0, n).join('') : '', done: n >= units.length }
}

/** Cuenta animada de un número hacia `target` (para métricas). */
export function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const e = 1 - Math.pow(1 - t, 3)
      setV(a + (target - a) * e)
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

/** Lecciones visitadas (progreso local). */
const VISITED_KEY = 'workshop:visited'
export function readVisited(): string[] {
  try {
    return JSON.parse(localStorage.getItem(VISITED_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}
export function markVisited(slug: string) {
  try {
    const v = new Set(readVisited())
    v.add(slug)
    localStorage.setItem(VISITED_KEY, JSON.stringify([...v]))
    window.dispatchEvent(new Event('workshop:visited'))
  } catch {
    /* almacenamiento no disponible */
  }
}
export function useVisited(): string[] {
  const [v, setV] = useState<string[]>(() => readVisited())
  useEffect(() => {
    const on = () => setV(readVisited())
    window.addEventListener('workshop:visited', on)
    return () => window.removeEventListener('workshop:visited', on)
  }, [])
  return v
}
