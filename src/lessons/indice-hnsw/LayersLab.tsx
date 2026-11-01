import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Shuffle } from 'lucide-react'
import { Lab, Panel, Stat } from '../../components/ui'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { buildHnsw, exactKnn, points2D, recallAt, searchHnsw, type Graph, type SearchResult, type Vec } from './hnsw'

/* ---------------------------- datos y grafo ---------------------------- */
const N = 54
const M = 3
const K = 3
const EF = 6
const PTS = points2D(N, 3)
const G = buildHnsw(PTS, { M, efConstruction: 16, seed: 3, maxLevelCap: 2, minTopNodes: 3 })
const PRESET_QUERIES: Vec[] = [
  [38, 62],
  [80, 22],
  [18, 30],
  [62, 88],
  [50, 45],
]

/* ---------------------------- geometría ---------------------------- */
const W = 700
const PH = 128 // alto de cada plano
const GAP = 66
const TOP0 = 38
const LAYERS = G.maxLevel + 1
const H = TOP0 + LAYERS * PH + (LAYERS - 1) * GAP + 16
const topOf = (layer: number) => TOP0 + (G.maxLevel - layer) * (PH + GAP)
const SX = 4.9
const SH = 1.1
const SY = PH / 100
const P = (p: Vec, layer: number): [number, number] => [140 + p[0] * SX - p[1] * SH, topOf(layer) + p[1] * SY]
const fromPlane = (X: number, Y: number, layer: number): Vec => {
  const y = (Y - topOf(layer)) / SY
  const x = (X - 140 + y * SH) / SX
  return [Math.max(2, Math.min(98, x)), Math.max(2, Math.min(98, y))]
}
const nodeName = (i: number) => `n${i}`
const fmtD = (d: number) => d.toFixed(1).replace('.', ',')

/* ---------------------------- vistas por paso ---------------------------- */
type View = {
  title: string
  body: ReactNode
  layer: number | null
  cur: number | null
  evalNow: number[]
  hops: { layer: number; a: number; b: number }[]
  descents: { node: number; to: number }[]
  seen: Set<number>
  expanded: Set<number>
  W: number[]
  newInW: number[]
  comps: number
  best: number | null
  showQuery: boolean
  final: boolean
}

function buildViews(g: Graph, res: SearchResult, exact: number[]): View[] {
  const d = (id: number) => res.dists.get(id) ?? 0
  const views: View[] = []
  const base = {
    evalNow: [] as number[],
    hops: [] as View['hops'],
    descents: [] as View['descents'],
    seen: new Set<number>(),
    expanded: new Set<number>(),
    W: [] as number[],
    newInW: [] as number[],
    comps: 0,
    best: null as number | null,
    showQuery: false,
    final: false,
  }
  const counts = Array.from({ length: g.maxLevel + 1 }, (_, l) => g.levels.filter((x) => x >= l).length)
  views.push({
    ...base,
    title: 'El grafo ya está construido',
    body: `${N} vectores (aquí en 2D para poder dibujarlos). Todos viven en la capa 0; ${counts[1] ?? 0} subieron a la capa 1 y ${counts[2] ?? 0} a la capa 2, por sorteo. Cada nodo se conecta con sus vecinos más cercanos de su capa (M = ${M}). El punto de entrada es ${nodeName(g.entry)}.`,
    layer: null,
    cur: g.entry,
    seen: new Set(),
  })
  let st = { ...base, seen: new Set<number>(), expanded: new Set<number>(), hops: [] as View['hops'], descents: [] as View['descents'] }
  for (const t of res.trace) {
    if (t.kind === 'enter') {
      st.seen.add(t.node)
      views.push({
        ...st,
        seen: new Set(st.seen),
        title: 'Llega una consulta',
        body: `La estrella es el vector de la consulta. La búsqueda siempre parte del punto de entrada en la capa más alta: ${nodeName(t.node)}, a distancia ${fmtD(Math.sqrt(t.d))}.`,
        layer: t.layer,
        cur: t.node,
        comps: t.comps,
        best: Math.sqrt(t.d),
        showQuery: true,
      })
    } else if (t.kind === 'hop') {
      t.evaluated.forEach((e) => st.seen.add(e))
      const body = t.to !== null
        ? `Capa ${t.layer}: compara la consulta con los ${t.evaluated.length} vecinos de ${nodeName(t.from)}. ${nodeName(t.to)} está más cerca (d = ${fmtD(Math.sqrt(t.d))}), así que salta hacia allá.`
        : `Capa ${t.layer}: ningún vecino de ${nodeName(t.from)} está más cerca que él. Es el mejor punto de esta capa (búsqueda voraz).`
      const view: View = {
        ...st,
        seen: new Set(st.seen),
        hops: [...st.hops],
        title: t.to !== null ? `Salto en la capa ${t.layer}` : `Mínimo local en la capa ${t.layer}`,
        body,
        layer: t.layer,
        cur: t.from,
        evalNow: t.evaluated,
        comps: t.comps,
        best: Math.sqrt(t.d),
        showQuery: true,
      }
      if (t.to !== null) {
        st.hops = [...st.hops, { layer: t.layer, a: t.from, b: t.to }]
        view.hops = st.hops
      }
      views.push(view)
    } else if (t.kind === 'descend') {
      st.descents = [...st.descents, { node: t.node, to: t.layer }]
      views.push({
        ...st,
        seen: new Set(st.seen),
        title: `Baja a la capa ${t.layer}`,
        body:
          t.layer === 0
            ? `${nodeName(t.node)} también existe en la capa 0, la más densa. Desde aquí empieza la búsqueda fina, con una lista de candidatos de tamaño ef = ${EF}.`
            : `${nodeName(t.node)} existe en todas las capas inferiores. Baja a la capa ${t.layer}, que tiene más nodos y enlaces más cortos, y sigue desde ahí.`,
        layer: t.layer,
        cur: t.node,
        comps: t.comps,
        best: d(t.node),
        showQuery: true,
      })
    } else if (t.kind === 'expand') {
      t.evaluated.forEach((e) => st.seen.add(e))
      st.expanded.add(t.node)
      views.push({
        ...st,
        seen: new Set(st.seen),
        expanded: new Set(st.expanded),
        title: `Capa 0: expandir ${nodeName(t.node)}`,
        body:
          t.evaluated.length === 0
            ? `Toma el candidato más cercano sin revisar (${nodeName(t.node)}). Todos sus vecinos ya fueron medidos: no hay nada nuevo.`
            : `Toma el candidato más cercano sin revisar (${nodeName(t.node)}) y mide ${t.evaluated.length} vecinos nuevos. ${
                t.added.length ? `Entran a la lista: ${t.added.map(nodeName).join(', ')}.` : 'Ninguno mejora la lista.'
              }`,
        layer: 0,
        cur: t.node,
        evalNow: t.evaluated,
        W: t.W,
        newInW: t.added,
        comps: t.comps,
        best: d(t.W[0]),
        showQuery: true,
      })
    } else if (t.kind === 'stop') {
      views.push({
        ...st,
        seen: new Set(st.seen),
        expanded: new Set(st.expanded),
        title: 'Condición de término',
        body: `El candidato más cercano que queda por revisar está más lejos que el peor de la lista (ef = ${EF}). Seguir buscando no puede mejorar el resultado: se detiene.`,
        layer: 0,
        cur: null,
        W: t.W,
        comps: t.comps,
        best: d(t.W[0]),
        showQuery: true,
      })
    }
  }
  const rec = recallAt(res.results, exact)
  const last = views[views.length - 1]
  views.push({
    ...last,
    title: 'Resultado vs búsqueda exacta',
    body: `Top-${K} de HNSW (verde) vs top-${K} exacto por fuerza bruta (anillo punteado): recall ${Math.round(rec * K)}/${K}. Calculó ${res.comps} distancias en vez de ${N}. Con ${N} puntos el ahorro es modesto; con millones es enorme.`,
    cur: null,
    evalNow: [],
    W: res.results,
    newInW: [],
    final: true,
  })
  return views
}

/* ---------------------------- componente ---------------------------- */
export function LayersLab() {
  const [q, setQ] = useState<Vec>(PRESET_QUERIES[0])
  const svgRef = useRef<SVGSVGElement>(null)
  const res = useMemo(() => searchHnsw(G, q, K, EF, true), [q])
  const exact = useMemo(() => exactKnn(PTS, q, K), [q])
  const views = useMemo(() => buildViews(G, res, exact), [res, exact])
  const steps: StepInfo[] = views.map((v) => ({ title: v.title, body: v.body }))
  const player = usePlayer(views.length, { interval: (s) => (s < 2 ? 3200 : 2300) })
  const v = views[Math.min(player.step, views.length - 1)]

  const pickQuery = (next: Vec) => {
    setQ(next)
    player.goTo(1)
  }
  const onPlaneClick = (e: MouseEvent<SVGPolygonElement>, layer: number) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(ctm.inverse())
    pickQuery(fromPlane(p.x, p.y, layer))
  }
  const nextPreset = () => {
    const i = PRESET_QUERIES.findIndex((p) => p[0] === q[0] && p[1] === q[1])
    pickQuery(PRESET_QUERIES[(i + 1) % PRESET_QUERIES.length])
  }

  const layerIds = Array.from({ length: LAYERS }, (_, l) => l).reverse()
  const resSet = new Set(v.final ? res.results : [])
  const exactSet = new Set(v.final ? exact : [])
  const wSet = new Set(v.W)
  const evalSet = new Set(v.evalNow)
  const newestHop = v.hops[v.hops.length - 1]
  const maxW = Math.max(1, ...v.W.map((id) => res.dists.get(id) ?? 0))

  return (
    <Lab title="Búsqueda HNSW, salto a salto" hint="Dale play · haz clic en una capa para mover la consulta">
      <div className="stack">
        <div className="row">
          <button className="btn btn-sm" onClick={nextPreset}>
            <Shuffle size={14} /> Otra consulta
          </button>
          <span className="small muted">
            M = {M} · ef_search = {EF} · k = {K} · {N} vectores
          </span>
        </div>
        <PlayerBar player={player} labels={steps.map((s) => s.title)} />
        <div className="split">
          <div>
            <svg ref={svgRef} className="indice-hnsw-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafo HNSW de tres capas con la ruta de búsqueda">
              <defs>
                <marker id="indice-hnsw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="var(--c-user)" />
                </marker>
              </defs>
              {/* conectores verticales: el mismo nodo en capas contiguas */}
              {PTS.map((p, i) =>
                Array.from({ length: G.levels[i] }, (_, l) => {
                  const [x1, y1] = P(p, l + 1)
                  const [x2, y2] = P(p, l)
                  return <line key={`c${i}-${l}`} className="connector" x1={x1} y1={y1} x2={x2} y2={y2} />
                }),
              )}
              {layerIds.map((l) => {
                const corners = [P([0, 0], l), P([100, 0], l), P([100, 100], l), P([0, 100], l)]
                const active = v.layer === l
                const [lx, ly] = P([0, 0], l)
                const count = G.levels.filter((x) => x >= l).length
                return (
                  <g key={`plane${l}`}>
                    <polygon className={`plane${active ? ' is-active' : ''}`} points={corners.map((c) => c.join(',')).join(' ')} onClick={(e) => onPlaneClick(e, l)} />
                    <text className={`plane-label${active ? ' is-active' : ''}`} x={lx} y={ly - 9}>
                      CAPA {l} · {count} nodos
                    </text>
                  </g>
                )
              })}
              {/* aristas de cada capa */}
              {layerIds.map((l) =>
                G.layers[l].flatMap((nbrs, a) =>
                  nbrs
                    .filter((b) => b > a || !G.layers[l][b].includes(a))
                    .map((b) => {
                      const [x1, y1] = P(PTS[a], l)
                      const [x2, y2] = P(PTS[b], l)
                      return <line key={`e${l}-${a}-${b}`} className="edge" x1={x1} y1={y1} x2={x2} y2={y2} style={{ pointerEvents: 'none' }} />
                    }),
                ),
              )}
              {/* radio de la mejor distancia actual (círculo sobre el plano) */}
              {v.showQuery && v.layer !== null && v.best !== null && (
                <g transform={`matrix(${SX} 0 ${-SH} ${SY} 140 ${topOf(v.layer)})`} style={{ pointerEvents: 'none' }}>
                  <circle className="best" cx={q[0]} cy={q[1]} r={v.best} vectorEffect="non-scaling-stroke" />
                </g>
              )}
              {/* líneas de evaluación del paso actual */}
              {v.cur !== null &&
                v.layer !== null &&
                v.evalNow.map((e) => {
                  const [x1, y1] = P(PTS[v.cur!], v.layer!)
                  const [x2, y2] = P(PTS[e], v.layer!)
                  return <line key={`ev${player.step}-${e}`} className="eval-line" x1={x1} y1={y1} x2={x2} y2={y2} />
                })}
              {/* ruta: saltos y descensos */}
              {v.hops.map((h, i) => {
                const [x1, y1] = P(PTS[h.a], h.layer)
                const [x2, y2] = P(PTS[h.b], h.layer)
                return (
                  <line key={`h${i}`} className={`hop${h === newestHop && v.title.startsWith('Salto') ? ' is-new' : ''}`} x1={x1} y1={y1} x2={x2} y2={y2} markerEnd="url(#indice-hnsw-arrow)" />
                )
              })}
              {v.descents.map((dd, i) => {
                const [x1, y1] = P(PTS[dd.node], dd.to + 1)
                const [x2, y2] = P(PTS[dd.node], dd.to)
                return <line key={`d${i}`} className="descend" x1={x1} y1={y1} x2={x2} y2={y2 - 7} markerEnd="url(#indice-hnsw-arrow)" />
              })}
              {/* nodos */}
              {layerIds.map((l) =>
                PTS.map((p, i) => {
                  if (G.levels[i] < l) return null
                  const [x, y] = P(p, l)
                  const here = v.layer === l || (v.final && l === 0)
                  const isCur = v.cur === i && v.layer === l
                  const isRes = l === 0 && resSet.has(i)
                  const cls = isCur ? ' is-cur' : isRes ? ' is-res' : v.seen.has(i) && here ? ' is-seen' : ''
                  return (
                    <g key={`n${l}-${i}`} style={{ pointerEvents: 'none' }}>
                      <circle className={`node${cls}`} cx={x} cy={y} r={isCur || isRes ? 7 : l > 0 ? 5.5 : 4.5}>
                        <title>{`${nodeName(i)}${res.dists.has(i) ? ` · d = ${fmtD(res.dists.get(i)!)}` : ''}`}</title>
                      </circle>
                      {here && evalSet.has(i) && <circle className="ring-eval" cx={x} cy={y} r={9} />}
                      {l === 0 && v.layer === 0 && wSet.has(i) && !v.final && <circle className="ring-w" cx={x} cy={y} r={11} />}
                      {l === 0 && exactSet.has(i) && <circle className="ring-exact" cx={x} cy={y} r={13} />}
                      {isCur && <circle className="ring-cur" cx={x} cy={y} r={10} />}
                    </g>
                  )
                }),
              )}
              {/* punto de entrada */}
              {(() => {
                const [x, y] = P(PTS[G.entry], G.maxLevel)
                return (
                  <text className="entry-tag" x={x + 10} y={y - 8}>
                    entrada
                  </text>
                )
              })()}
              {/* consulta en cada capa */}
              {v.showQuery &&
                layerIds.map((l) => {
                  const [x, y] = P(q, l)
                  return <path key={`q${l}`} className="star" d={starPath(x, y, l === v.layer ? 11 : 8, l === v.layer ? 4.6 : 3.4)} opacity={l === v.layer || v.final ? 1 : 0.45} style={{ pointerEvents: 'none' }} />
                })}
            </svg>
            <div className="indice-hnsw-legend">
              <span>
                <i style={{ background: 'var(--c-user)' }} /> consulta / nodo actual
              </span>
              <span>
                <i style={{ background: 'var(--c-tool)' }} /> distancia calculada
              </span>
              <span>
                <i style={{ border: '2px solid var(--c-data)' }} /> lista de candidatos (ef)
              </span>
              <span>
                <i style={{ background: 'var(--c-data)' }} /> resultado HNSW
              </span>
              <span>
                <i style={{ border: '2px dashed var(--c-ok)' }} /> top-{K} exacto
              </span>
            </div>
          </div>

          <div className="stack">
            <Narration steps={steps} step={Math.min(player.step, steps.length - 1)} />
            <div className="row" style={{ gap: 10 }}>
              <Stat label="capa" value={v.layer ?? '—'} tone="user" />
              <Stat label="distancias" value={v.comps} sub={`fuerza bruta: ${N}`} tone="tool" />
              <Stat label="mejor d" value={v.best !== null ? fmtD(v.best) : '—'} />
            </div>
            {v.W.length > 0 && (
              <Panel title={v.final ? `Top-${K} HNSW vs exacto` : `Lista de candidatos (ef = ${EF})`} tone="data">
                <div className="indice-hnsw-cands">
                  {(v.final ? res.results : v.W).map((id, i) => {
                    const dist = res.dists.get(id) ?? 0
                    return (
                      <div key={id} className={`indice-hnsw-cand${v.newInW.includes(id) ? ' is-new' : ''}`}>
                        <span className="muted">{i + 1}</span>
                        <span>{nodeName(id)}</span>
                        <span className="bar" style={{ width: `${(dist / maxW) * 100}%` }} />
                        <span className="v">{fmtD(dist)}</span>
                      </div>
                    )
                  })}
                </div>
                {v.final && (
                  <div className="small" style={{ marginTop: 8 }}>
                    Exacto: {exact.map(nodeName).join(', ')} · recall@{K} = <b>{Math.round(recallAt(res.results, exact) * K)}/{K}</b>
                  </div>
                )}
              </Panel>
            )}
          </div>
        </div>
      </div>
    </Lab>
  )
}

function starPath(cx: number, cy: number, R: number, r: number) {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? R : r
    d += `${i === 0 ? 'M' : 'L'}${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`
  }
  return d + 'Z'
}
