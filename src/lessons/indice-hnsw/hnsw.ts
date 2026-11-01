/* ==========================================================================
   HNSW (Hierarchical Navigable Small World) — implementación didáctica pero
   real: asignación aleatoria de niveles, inserción con búsqueda por capas,
   vecinos más cercanos por capa (selección simple) y búsqueda con ef.
   Cuenta cada cálculo de distancia para poder compararlo con fuerza bruta.
   ========================================================================== */
import { rng } from '../../sim/math'

export type Vec = number[]

export type Graph = {
  pts: Vec[]
  levels: number[]
  /** layers[l][nodo] = ids de vecinos en la capa l (vacío si el nodo no vive en esa capa) */
  layers: number[][][]
  entry: number
  maxLevel: number
  M: number
  /** distancias calculadas durante la construcción */
  buildComps: number
}

/** Distancia euclidiana al cuadrado (el orden es el mismo que con la raíz). */
export function dist2(a: Vec, b: Vec): number {
  let s = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    s += d * d
  }
  return s
}

type Cand = [d: number, id: number]

/** Búsqueda en una capa con lista dinámica de tamaño ef (algoritmo 2 del paper). */
function searchLayer(g: Graph, eps: number[], ef: number, layer: number, dist: (id: number) => number): Cand[] {
  const visited = new Set<number>(eps)
  const C: Cand[] = eps.map((e) => [dist(e), e])
  const W: Cand[] = C.map((c) => [c[0], c[1]])
  C.sort((a, b) => a[0] - b[0])
  W.sort((a, b) => a[0] - b[0])
  while (C.length) {
    const c = C.shift()!
    const f = W[W.length - 1]
    if (c[0] > f[0]) break
    for (const e of g.layers[layer][c[1]]) {
      if (visited.has(e)) continue
      visited.add(e)
      const d = dist(e)
      const far = W[W.length - 1]
      if (W.length < ef || d < far[0]) {
        insertSorted(C, [d, e])
        insertSorted(W, [d, e])
        if (W.length > ef) W.pop()
      }
    }
  }
  return W
}

function insertSorted(arr: Cand[], c: Cand) {
  let i = arr.length
  while (i > 0 && arr[i - 1][0] > c[0]) i--
  arr.splice(i, 0, c)
}

export function buildHnsw(pts: Vec[], opts: { M: number; efConstruction?: number; seed?: number; maxLevelCap?: number; minTopNodes?: number }): Graph {
  const { M, efConstruction = 40, seed = 7, maxLevelCap = 6 } = opts
  const r = rng(seed)
  const mL = 1 / Math.log(Math.max(2, M))
  const levels = pts.map(() => Math.min(maxLevelCap, Math.floor(-Math.log(1 - r()) * mL)))
  // garantiza que la capa superior tenga al menos `minTopNodes` nodos (solo para el dibujo)
  if (opts.minTopNodes) {
    const top = Math.max(...levels)
    let have = levels.filter((l) => l === top).length
    for (let i = 0; i < levels.length && have < opts.minTopNodes; i++) {
      if (levels[i] === top - 1) {
        levels[i] = top
        have++
      }
    }
  }
  const maxLevel = Math.max(...levels)
  const g: Graph = {
    pts,
    levels,
    layers: Array.from({ length: maxLevel + 1 }, () => pts.map(() => [] as number[])),
    entry: -1,
    maxLevel: -1,
    M,
    buildComps: 0,
  }
  for (let i = 0; i < pts.length; i++) insert(g, i, efConstruction)
  g.maxLevel = maxLevel
  return g
}

function insert(g: Graph, id: number, efC: number) {
  const q = g.pts[id]
  const l = g.levels[id]
  if (g.entry < 0) {
    g.entry = id
    g.maxLevel = l
    return
  }
  const dist = (e: number) => {
    g.buildComps++
    return dist2(q, g.pts[e])
  }
  let eps = [g.entry]
  for (let lc = g.maxLevel; lc > l; lc--) eps = [searchLayer(g, eps, 1, lc, dist)[0][1]]
  for (let lc = Math.min(g.maxLevel, l); lc >= 0; lc--) {
    const W = searchLayer(g, eps, efC, lc, dist)
    const mMax = lc === 0 ? g.M * 2 : g.M
    const neigh = W.slice(0, g.M).map((c) => c[1])
    g.layers[lc][id] = [...neigh]
    for (const n of neigh) {
      const list = g.layers[lc][n]
      list.push(id)
      if (list.length > mMax) {
        // poda: conserva los mMax más cercanos a n
        const base = g.pts[n]
        list.sort((a, b) => dist2(base, g.pts[a]) - dist2(base, g.pts[b]))
        g.buildComps += list.length
        list.length = mMax
      }
    }
    eps = W.map((c) => c[1])
  }
  if (l > g.maxLevel) {
    g.maxLevel = l
    g.entry = id
  }
}

/* -------------------------------------------------------------------------- */
/* Búsqueda instrumentada                                                      */
/* -------------------------------------------------------------------------- */

export type TraceStep =
  | { kind: 'enter'; layer: number; node: number; d: number; comps: number }
  | { kind: 'hop'; layer: number; from: number; evaluated: number[]; to: number | null; d: number; comps: number }
  | { kind: 'descend'; layer: number; node: number; comps: number }
  | { kind: 'expand'; node: number; evaluated: number[]; added: number[]; W: number[]; comps: number }
  | { kind: 'stop'; node: number; W: number[]; comps: number }

export type SearchResult = {
  results: number[]
  comps: number
  trace: TraceStep[]
  /** distancia (euclidiana, no al cuadrado) de cada nodo evaluado */
  dists: Map<number, number>
}

export function searchHnsw(g: Graph, q: Vec, k: number, ef: number, withTrace = false): SearchResult {
  const dists = new Map<number, number>()
  const trace: TraceStep[] = []
  const dist = (e: number) => {
    let d = dists.get(e)
    if (d === undefined) {
      d = dist2(q, g.pts[e])
      dists.set(e, d)
    }
    return d
  }
  let cur = g.entry
  let curD = dist(cur)
  if (withTrace) trace.push({ kind: 'enter', layer: g.maxLevel, node: cur, d: curD, comps: dists.size })
  // capas superiores: búsqueda voraz (equivalente a ef = 1)
  for (let lc = g.maxLevel; lc >= 1; lc--) {
    for (;;) {
      const evaluated = g.layers[lc][cur]
      let best = cur
      let bestD = curD
      for (const e of evaluated) {
        const d = dist(e)
        if (d < bestD) {
          bestD = d
          best = e
        }
      }
      if (withTrace) trace.push({ kind: 'hop', layer: lc, from: cur, evaluated: [...evaluated], to: best === cur ? null : best, d: bestD, comps: dists.size })
      if (best === cur) break
      cur = best
      curD = bestD
    }
    if (withTrace) trace.push({ kind: 'descend', layer: lc - 1, node: cur, comps: dists.size })
  }
  // capa 0: búsqueda con lista dinámica de tamaño ef
  const efEff = Math.max(ef, k)
  const visited = new Set<number>([cur])
  const C: Cand[] = [[curD, cur]]
  const W: Cand[] = [[curD, cur]]
  while (C.length) {
    const c = C.shift()!
    const f = W[W.length - 1]
    if (c[0] > f[0]) {
      if (withTrace) trace.push({ kind: 'stop', node: c[1], W: W.map((w) => w[1]), comps: dists.size })
      break
    }
    const evaluated: number[] = []
    const added: number[] = []
    for (const e of g.layers[0][c[1]]) {
      if (visited.has(e)) continue
      visited.add(e)
      evaluated.push(e)
      const d = dist(e)
      const far = W[W.length - 1]
      if (W.length < efEff || d < far[0]) {
        insertSorted(C, [d, e])
        insertSorted(W, [d, e])
        added.push(e)
        if (W.length > efEff) W.pop()
      }
    }
    if (withTrace) trace.push({ kind: 'expand', node: c[1], evaluated, added, W: W.map((w) => w[1]), comps: dists.size })
    if (!C.length && withTrace) trace.push({ kind: 'stop', node: c[1], W: W.map((w) => w[1]), comps: dists.size })
  }
  const sq = new Map<number, number>()
  dists.forEach((v, key) => sq.set(key, Math.sqrt(v)))
  return { results: W.slice(0, k).map((w) => w[1]), comps: dists.size, trace, dists: sq }
}

/** kNN exacto por fuerza bruta. */
export function exactKnn(pts: Vec[], q: Vec, k: number): number[] {
  return pts
    .map((p, i) => [dist2(p, q), i] as Cand)
    .sort((a, b) => a[0] - b[0])
    .slice(0, k)
    .map((c) => c[1])
}

export function recallAt(found: number[], exact: number[]): number {
  if (!exact.length) return 1
  const s = new Set(exact)
  return found.filter((f) => s.has(f)).length / exact.length
}

/* -------------------------------------------------------------------------- */
/* Datos sintéticos                                                            */
/* -------------------------------------------------------------------------- */

/** Puntos 2D (0..100) con algo de estructura (grupos + ruido), deterministas. */
export function points2D(n: number, seed: number): Vec[] {
  const r = rng(seed)
  const centers = Array.from({ length: 5 }, () => [12 + r() * 76, 12 + r() * 76])
  const out: Vec[] = []
  let guard = 0
  while (out.length < n && guard++ < n * 50) {
    const useCluster = r() < 0.6
    const c = centers[Math.floor(r() * centers.length)]
    const p = useCluster ? [c[0] + gauss(r) * 9, c[1] + gauss(r) * 9] : [4 + r() * 92, 4 + r() * 92]
    if (p[0] < 3 || p[0] > 97 || p[1] < 3 || p[1] > 97) continue
    // separación mínima para que el dibujo se lea
    if (out.some((o) => dist2(o, p) < 16)) continue
    out.push(p)
  }
  return out
}

/** Vectores de alta dimensión agrupados en "temas" (para medir recall de verdad). */
export function clusteredVectors(n: number, dim: number, clusters: number, seed: number): Vec[] {
  const r = rng(seed)
  const centers = Array.from({ length: clusters }, () => Array.from({ length: dim }, () => gauss(r)))
  return Array.from({ length: n }, () => {
    const c = centers[Math.floor(r() * clusters)]
    return c.map((x) => x + gauss(r) * 0.85)
  })
}

export function gauss(r: () => number): number {
  const u = Math.max(1e-9, r())
  const v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
