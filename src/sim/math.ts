/* Utilidades numéricas compartidas. Todo es determinista para que las simulaciones
   se vean igual en cada recarga. */

/** Hash FNV-1a de 32 bits. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** PRNG mulberry32: `const rnd = rng(42); rnd() // [0,1)` */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0)
export const norm = (a: number[]) => Math.sqrt(dot(a, a))
export const normalize = (a: number[]) => {
  const n = norm(a) || 1
  return a.map((x) => x / n)
}
export const cosine = (a: number[], b: number[]) => dot(a, b) / ((norm(a) || 1) * (norm(b) || 1))
export const euclid = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - (b[i] ?? 0)) ** 2, 0))
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** softmax con temperatura. T→0 se vuelve argmax, T alto aplana la distribución. */
export function softmax(logits: number[], temperature = 1): number[] {
  const T = Math.max(temperature, 1e-4)
  const scaled = logits.map((l) => l / T)
  const m = Math.max(...scaled)
  const ex = scaled.map((s) => Math.exp(s - m))
  const z = ex.reduce((a, b) => a + b, 0)
  return ex.map((e) => e / z)
}

/** Índices que sobreviven al corte top-p (nucleus sampling), en orden de prob. desc. */
export function topPIndices(probs: number[], p: number): number[] {
  const order = probs.map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0])
  const keep: number[] = []
  let acc = 0
  for (const [x, i] of order) {
    keep.push(i)
    acc += x
    if (acc >= p) break
  }
  return keep
}

/** Muestrea un índice según `probs` usando un número aleatorio u ∈ [0,1). */
export function sampleIndex(probs: number[], u: number): number {
  let acc = 0
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i]
    if (u < acc) return i
  }
  return probs.length - 1
}

/** Estimación rápida de tokens (~3,8 caracteres por token en español). */
export function countTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.round(text.length / 3.8))
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('es-CL')
export const fmt = (n: number, d = 2) => n.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtUsd = (n: number) => `US$ ${n < 0.01 ? n.toFixed(5) : n.toFixed(4)}`
export const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`

/** Quita tildes y pasa a minúsculas (para matching simple). */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
