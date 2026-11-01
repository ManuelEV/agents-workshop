import { useMemo, useState } from 'react'
import { Lab, Slider, Stat } from '../../components/ui'
import { fmtInt, rng } from '../../sim/math'
import { buildHnsw, clusteredVectors, exactKnn, recallAt, searchHnsw, type Graph } from './hnsw'

const N = 2000
const DIM = 16
const K = 10
const N_QUERIES = 40
const M_VALUES = [2, 3, 4, 6, 8, 12, 16]
const EF_CURVE = [10, 15, 20, 30, 40, 60, 80, 120, 160, 200]

const DATA = clusteredVectors(N, DIM, 14, 5)
const QUERIES = (() => {
  const r = rng(77)
  return Array.from({ length: N_QUERIES }, () => DATA[Math.floor(r() * N)].map((x) => x + (r() - 0.5) * 1.2))
})()
const EXACT = QUERIES.map((q) => exactKnn(DATA, q, K))

const graphCache = new Map<number, Graph>()
function graphFor(m: number): Graph {
  let g = graphCache.get(m)
  if (!g) {
    g = buildHnsw(DATA, { M: m, efConstruction: 60, seed: 9 })
    graphCache.set(m, g)
  }
  return g
}

function measure(g: Graph, ef: number) {
  let rec = 0
  let comps = 0
  QUERIES.forEach((q, i) => {
    const s = searchHnsw(g, q, K, ef)
    rec += recallAt(s.results, EXACT[i])
    comps += s.comps
  })
  return { recall: rec / QUERIES.length, comps: comps / QUERIES.length }
}

export function ParamsLab() {
  const [mi, setMi] = useState(3)
  const [ef, setEf] = useState(20)
  const m = M_VALUES[mi]
  const g = useMemo(() => graphFor(m), [m])
  const cur = useMemo(() => measure(g, ef), [g, ef])
  const curve = useMemo(() => EF_CURVE.map((e) => ({ ef: e, ...measure(g, e) })), [g])
  const edges = g.layers.reduce((n, layer) => n + layer.reduce((a, l) => a + l.length, 0), 0)

  return (
    <Lab title="M y ef_search: velocidad contra recall" hint="Mueve los parámetros y mira cómo cambian las cuentas reales">
      <div className="stack">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Slider label="M (vecinos por nodo)" value={mi} min={0} max={M_VALUES.length - 1} onChange={setMi} format={() => String(m)} style={{ flex: '1 1 220px' }} />
          <Slider label="ef_search (tamaño de la lista)" value={ef} min={10} max={200} step={5} onChange={setEf} style={{ flex: '1 1 220px' }} />
        </div>
        <div className="small muted">
          {fmtInt(N)} vectores de {DIM} dimensiones agrupados en temas · {N_QUERIES} consultas de prueba · se compara el top-{K} de HNSW con el top-{K} exacto. Todo se calcula de
          verdad en tu navegador.
        </div>
        <div className="row">
          <Stat label={`recall@${K}`} value={`${(cur.recall * 100).toFixed(1).replace('.', ',')}%`} tone={cur.recall >= 0.95 ? 'ok' : cur.recall >= 0.8 ? 'guard' : 'error'} sub="vecinos verdaderos encontrados" />
          <Stat label="distancias / consulta" value={fmtInt(cur.comps)} tone="tool" sub={`${((cur.comps / N) * 100).toFixed(1).replace('.', ',')}% de la fuerza bruta (${fmtInt(N)})`} />
          <Stat label="aristas del grafo" value={fmtInt(edges)} sub="más M = más memoria" />
          <Stat label="costo de construcción" value={fmtInt(g.buildComps)} sub="distancias al indexar" />
        </div>
        <CurveChart curve={curve} cur={{ ef, ...cur }} m={m} />
        <div className="small muted">
          Subir ef_search revisa más candidatos: más recall, más distancias. Subir M agrega atajos al grafo: mejor recall con el mismo ef, pero más memoria y una construcción
          más lenta. Con M = 2 el grafo queda mal conectado y ningún ef razonable lo salva.
        </div>
      </div>
    </Lab>
  )
}

type Pt = { ef: number; recall: number; comps: number }

function CurveChart({ curve, cur, m }: { curve: Pt[]; cur: Pt; m: number }) {
  const [hover, setHover] = useState<Pt | null>(null)
  const W = 640
  const H = 250
  const L = 48
  const R = 16
  const T = 26
  const B = 40
  const maxC = Math.max(N * 0.6, ...curve.map((c) => c.comps), cur.comps)
  const x = (c: number) => L + (c / maxC) * (W - L - R)
  const y = (r: number) => T + (1 - r) * (H - T - B)
  const path = curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.comps)},${y(p.recall)}`).join(' ')
  const xticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((maxC * f) / 50) * 50)
  const tip = hover ?? null

  return (
    <svg className="indice-hnsw-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Curva recall contra distancias calculadas para M = ${m}`}>
      <text x={L} y={14} style={{ fill: 'var(--text-2)', fontWeight: 600 }}>
        recall@{K} vs distancias por consulta · M = {m} (cada punto es un ef_search)
      </text>
      {[0, 0.25, 0.5, 0.75, 1].map((r) => (
        <g key={r}>
          <line className="gridline" x1={L} x2={W - R} y1={y(r)} y2={y(r)} />
          <text x={L - 8} y={y(r) + 4} textAnchor="end">
            {Math.round(r * 100)}%
          </text>
        </g>
      ))}
      <line className="axis" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
      {xticks.map((t) => (
        <text key={t} x={x(t)} y={H - B + 16} textAnchor="middle">
          {fmtInt(t)}
        </text>
      ))}
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle">
        distancias calculadas por consulta (fuerza bruta = {fmtInt(N)})
      </text>
      <path className="line" d={path} />
      {curve.map((p) => (
        <g key={p.ef} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}>
          <circle cx={x(p.comps)} cy={y(p.recall)} r={12} fill="transparent" />
          <circle className="pt" cx={x(p.comps)} cy={y(p.recall)} r={4.5} />
        </g>
      ))}
      <circle className="pt is-cur" cx={x(cur.comps)} cy={y(cur.recall)} r={7} style={{ transition: 'all 0.4s' }} onMouseEnter={() => setHover(cur)} onMouseLeave={() => setHover(null)} />
      {tip && <Tip x={x(tip.comps)} y={y(tip.recall)} lines={[`ef_search = ${tip.ef}`, `recall ${(tip.recall * 100).toFixed(1)}%`, `${fmtInt(tip.comps)} distancias`]} w={W} />}
    </svg>
  )
}

function Tip({ x, y, lines, w }: { x: number; y: number; lines: string[]; w: number }) {
  const bw = 150
  const bh = lines.length * 16 + 10
  const left = Math.min(Math.max(x - bw / 2, 4), w - bw - 4)
  const top = y - bh - 12 < 2 ? y + 12 : y - bh - 12
  return (
    <g className="tip" style={{ pointerEvents: 'none' }}>
      <rect x={left} y={top} width={bw} height={bh} rx={7} opacity={0.95} />
      {lines.map((l, i) => (
        <text key={i} x={left + 9} y={top + 18 + i * 16}>
          {l}
        </text>
      ))}
    </g>
  )
}
