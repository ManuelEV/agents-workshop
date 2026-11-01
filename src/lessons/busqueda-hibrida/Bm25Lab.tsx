import { useMemo, useState } from 'react'
import { BarRow, Lab, Panel, Slider } from '../../components/ui'
import { fmt } from '../../sim/math'
import { AVGDL, B, bm25, K1, N_DOCS } from './search'

/* Lab 2: desarmar BM25. Saturación de tf (k1) y normalización por largo (b). */
export function Bm25Lab({ query }: { query: string }) {
  const [k1, setK1] = useState(K1)
  const [b, setB] = useState(B)
  const hits = useMemo(() => bm25(query, k1, b).filter((h) => h.score > 0).slice(0, 6), [query, k1, b])
  const base = useMemo(() => bm25(query).filter((h) => h.score > 0).map((h) => h.chunk.id), [query])
  const top = hits[0]
  const max = top?.score || 1

  // curva de saturación: aporte relativo tf·(k1+1)/(tf + k1·norm) con dl = avgdl
  const W = 320
  const H = 150
  const PAD = 28
  const xs = Array.from({ length: 41 }, (_, i) => i / 4) // tf 0..10
  const curve = (k: number, lenRatio: number) =>
    xs.map((tf) => (tf === 0 ? 0 : (tf * (k + 1)) / (tf + k * (1 - b + b * lenRatio))))
  const yMax = 3.2
  const px = (tf: number) => PAD + (tf / 10) * (W - PAD - 8)
  const py = (v: number) => H - PAD + 6 - (Math.min(v, yMax) / yMax) * (H - PAD - 10)
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${px(xs[i]).toFixed(1)},${py(v).toFixed(1)}`).join(' ')

  return (
    <Lab title="Desarma el puntaje BM25" hint="Mueve k1 y b; mira cómo cambia el orden">
      <div className="row" style={{ gap: 20, marginBottom: 12 }}>
        <Slider label="k1 · saturación de tf" value={k1} min={0} max={3} step={0.1} onChange={setK1} format={(v) => v.toFixed(1)} style={{ flex: '1 1 200px' }} />
        <Slider label="b · normalización por largo" value={b} min={0} max={1} step={0.05} onChange={setB} format={(v) => v.toFixed(2)} style={{ flex: '1 1 200px' }} />
        <button className="btn btn-sm" onClick={() => (setK1(K1), setB(B))}>
          Valores típicos (1,2 · 0,75)
        </button>
      </div>

      <div className="split">
        <Panel title={`Ranking BM25 · “${query.length > 34 ? query.slice(0, 33) + '…' : query}”`} tone="tool">
          {hits.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              Esta consulta no comparte ningún término con la base: ningún k1 o b la salva. Prueba otro preset arriba.
            </p>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {hits.map((h, i) => {
                const was = base.indexOf(h.chunk.id)
                const moved = was >= 0 && was !== i
                return (
                  <BarRow
                    key={h.chunk.id}
                    label={`${i + 1}. ${h.chunk.id}${moved ? (was > i ? ' ↑' : ' ↓') : ''}`}
                    value={h.score}
                    max={max}
                    display={fmt(h.score, 2)}
                    tone="tool"
                    pick={i === 0}
                    title={`${h.len} términos`}
                  />
                )
              })}
            </div>
          )}
          {top && (
            <div className="busqueda-hibrida-formula">
              {top.parts
                .filter((p) => p.tf > 0)
                .map((p) => (
                  <div key={p.term}>
                    <b className="mono">{p.term}</b>: idf = ln(1 + ({N_DOCS} − {p.df} + 0,5) / ({p.df} + 0,5)) = <b>{fmt(p.idf, 2)}</b>
                    <br />
                    tf norm. = {p.tf}·({fmt(k1, 1)}+1) / ({p.tf} + {fmt(k1, 1)}·(1 − {fmt(b, 2)} + {fmt(b, 2)}·{top.len}/{fmt(AVGDL, 1)})) = <b>{fmt(p.tfNorm, 2)}</b>
                  </div>
                ))}
            </div>
          )}
        </Panel>

        <Panel title="Saturación: aporte vs. repeticiones" tone="system">
          <svg viewBox={`0 0 ${W} ${H}`} className="flow" role="img" aria-label="Curva de saturación de BM25 según k1 y largo del documento">
            <line x1={PAD} y1={H - PAD + 6} x2={W - 6} y2={H - PAD + 6} stroke="var(--border-strong)" />
            <line x1={PAD} y1={6} x2={PAD} y2={H - PAD + 6} stroke="var(--border-strong)" />
            {[0, 2, 4, 6, 8, 10].map((t) => (
              <text key={t} x={px(t)} y={H - 6} textAnchor="middle" className="busqueda-hibrida-axis">
                {t}
              </text>
            ))}
            {[1, 2, 3].map((v) => (
              <text key={v} x={PAD - 6} y={py(v) + 4} textAnchor="end" className="busqueda-hibrida-axis">
                {v}
              </text>
            ))}
            <path d={xs.map((t, i) => `${i ? 'L' : 'M'}${px(t)},${py(t)}`).join(' ')} fill="none" stroke="var(--text-3)" strokeDasharray="3 4" />
            <path d={path(curve(k1, 2))} fill="none" stroke="var(--c-tool)" strokeOpacity={0.45} strokeWidth={2} />
            <path d={path(curve(k1, 1))} fill="none" stroke="var(--c-tool)" strokeWidth={2.5} />
            <path d={path(curve(k1, 0.5))} fill="none" stroke="var(--c-tool)" strokeOpacity={0.75} strokeWidth={1.5} strokeDasharray="6 3" />
          </svg>
          <div className="small muted" style={{ lineHeight: 1.5 }}>
            Eje x: veces que aparece el término (tf). Línea gruesa: chunk de largo promedio; tenue: el doble de largo; discontinua: la mitad. Punteada gris: sin saturación (tf crudo).
            Con k1 = 0 repetir no suma nada; con k1 alto se parece a contar palabras. Con b = 0 el largo no importa.
          </div>
        </Panel>
      </div>
    </Lab>
  )
}
