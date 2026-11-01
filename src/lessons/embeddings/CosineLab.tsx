import { useState } from 'react'
import { Lab, Pill, type Tone } from '../../components/ui'
import { cellColor, DIM_LABELS } from '../../sim/embed'
import { dot, norm } from '../../sim/math'
import { CORPUS, DIM_SHORT } from './data'

const idOf = (text: string) => CORPUS.find((p) => p.text === text)?.id ?? CORPUS[0].id

const PRESETS: { label: string; a: string; b: string }[] = [
  { label: 'Sin palabras en común, mismo tema', a: 'Quiero devolver las zapatillas que compré', b: '¿Cómo pido un reembolso?' },
  { label: 'Temas distintos', a: 'Quiero devolver las zapatillas que compré', b: '¿Va a llover mañana? Quiero saber el clima' },
  { label: 'Casi lo mismo', a: '¿Cuándo llega mi pedido?', b: '¿Cuántos días tarda el despacho a Arica?' },
  { label: 'Parecidas a medias', a: 'Olvidé mi contraseña', b: 'Creo que hackearon mi cuenta' },
]

function verdict(c: number): { text: string; tone: Tone } {
  if (c >= 0.75) return { text: 'casi el mismo significado', tone: 'ok' }
  if (c >= 0.45) return { text: 'tema relacionado', tone: 'data' }
  if (c >= 0.2) return { text: 'algo en común', tone: 'guard' }
  return { text: 'sin relación', tone: 'system' }
}

export function CosineLab() {
  const [a, setA] = useState(idOf(PRESETS[0].a))
  const [b, setB] = useState(idOf(PRESETS[0].b))
  const A = CORPUS.find((p) => p.id === a)!
  const B = CORPUS.find((p) => p.id === b)!
  const prod = A.vector.map((x, i) => x * B.vector[i])
  const d = dot(A.vector, B.vector)
  const na = norm(A.vector)
  const nb = norm(B.vector)
  const cos = d / (na * nb)
  const top = prod
    .map((v, i) => [v, i] as const)
    .sort((x, y) => Math.abs(y[0]) - Math.abs(x[0]))
    .slice(0, 3)
  const topIdx = top.map((t) => t[1])
  const v = verdict(cos)

  const select = (value: string, set: (v: string) => void, label: string) => (
    <label className="stack" style={{ gap: 4, flex: '1 1 260px', minWidth: 0 }}>
      <span className="label">{label}</span>
      <select className="select" value={value} onChange={(e) => set(e.target.value)}>
        {CORPUS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.text}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <Lab title="Calculadora de similitud coseno" hint="Elige dos frases o un par de ejemplo">
      <div className="stack">
        <div className="row" style={{ gap: 6 }}>
          {PRESETS.map((p) => {
            const on = idOf(p.a) === a && idOf(p.b) === b
            return (
              <button
                key={p.label}
                className={`btn btn-sm${on ? ' btn-primary' : ''}`}
                onClick={() => {
                  setA(idOf(p.a))
                  setB(idOf(p.b))
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          {select(a, setA, 'Frase A')}
          {select(b, setB, 'Frase B')}
        </div>

        <div className="embeddings-rows" role="table" aria-label="Vectores A, B y su producto elemento a elemento">
          <span />
          {DIM_SHORT.map((s, i) => (
            <span key={s} className="hd" title={DIM_LABELS[i]}>
              {s}
            </span>
          ))}
          <span className="rl" style={{ color: 'var(--c-user)' }}>
            A
          </span>
          {A.vector.map((x, i) => (
            <span key={i} className="cell" style={{ background: cellColor(x) }} title={`${DIM_LABELS[i]}: ${x.toFixed(3)}`}>
              {x.toFixed(2)}
            </span>
          ))}
          <span className="rl" style={{ color: 'var(--c-data)' }}>
            B
          </span>
          {B.vector.map((x, i) => (
            <span key={i} className="cell" style={{ background: cellColor(x) }} title={`${DIM_LABELS[i]}: ${x.toFixed(3)}`}>
              {x.toFixed(2)}
            </span>
          ))}
          <span className="sep" />
          <span className="rl">A×B</span>
          {prod.map((x, i) => (
            <span key={i} className={`cell${topIdx.includes(i) ? ' is-top' : ''}`} style={{ background: cellColor(x, 0.3) }} title={`${DIM_LABELS[i]}: ${A.vector[i].toFixed(3)} × ${B.vector[i].toFixed(3)} = ${x.toFixed(4)}`}>
              {x.toFixed(2)}
            </span>
          ))}
        </div>
        <div className="small muted">
          Cada celda de A×B es aᵢ·bᵢ. Si ambos son positivos en la misma dimensión, suma; si uno es positivo y el otro negativo, resta. Marcadas: las 3 dimensiones que más pesan
          ({top.map((t) => `${DIM_LABELS[t[1]]} ${t[0] >= 0 ? '+' : ''}${t[0].toFixed(2)}`).join(', ')}).
        </div>

        <div className="grid-2" style={{ alignItems: 'center' }}>
          <div className="stack" style={{ gap: 10 }}>
            <div className="embeddings-eq">
              <span>
                A·B = Σ aᵢ·bᵢ = <b>{d.toFixed(3)}</b>
              </span>
              <span>
                ‖A‖ = <b>{na.toFixed(3)}</b>
              </span>
              <span>
                ‖B‖ = <b>{nb.toFixed(3)}</b>
              </span>
            </div>
            <div className="embeddings-eq">
              <span>
                cos(θ) = <span className="op">A·B / (‖A‖·‖B‖)</span> = <b style={{ fontSize: 18 }}>{cos.toFixed(3)}</b>
              </span>
              <Pill tone={v.tone}>{v.text}</Pill>
            </div>
            <div className="small muted">
              Los vectores ya vienen normalizados (largo 1), así que el coseno es igual al producto punto. Por eso muchas bases vectoriales usan producto punto: es más barato y da
              el mismo orden. Los umbrales (“relacionado”, “sin relación”) dependen de cada modelo: no hay un número universal.
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'center', gap: 18 }}>
            <Gauge value={cos} />
            <Angle cos={cos} />
          </div>
        </div>
      </div>
    </Lab>
  )
}

/** Medidor semicircular de -1 a 1. */
function Gauge({ value }: { value: number }) {
  const cx = 100
  const cy = 100
  const R = 72
  const ang = Math.PI - ((value + 1) / 2) * Math.PI
  const pt = (a: number, r = R) => [cx + Math.cos(a) * r, cy - Math.sin(a) * r]
  const arc = (a0: number, a1: number) => {
    const [x0, y0] = pt(a0)
    const [x1, y1] = pt(a1)
    return `M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1}`
  }
  const [nx, ny] = pt(ang, R - 12)
  return (
    <svg className="embeddings-gauge" viewBox="0 0 200 142" width={190} role="img" aria-label={`Similitud coseno ${value.toFixed(2)}`}>
      <path d={arc(Math.PI, Math.PI / 2)} stroke="var(--v-neg)" strokeOpacity={0.55} strokeWidth={12} fill="none" />
      <path d={arc(Math.PI / 2, 0)} stroke="var(--v-pos)" strokeOpacity={0.55} strokeWidth={12} fill="none" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text)" strokeWidth={3} strokeLinecap="round" style={{ transition: 'all 0.5s' }} />
      <circle cx={cx} cy={cy} r={5} fill="var(--text)" />
      <text x={22} y={cy + 18} textAnchor="middle">
        −1
      </text>
      <text x={cx} y={14} textAnchor="middle">
        0
      </text>
      <text x={178} y={cy + 18} textAnchor="middle">
        1
      </text>
      <text x={cx} y={cy + 34} textAnchor="middle" className="big">
        {value.toFixed(2)}
      </text>
    </svg>
  )
}

/** Dos flechas en 2D separadas por el ángulo θ = acos(coseno). */
function Angle({ cos }: { cos: number }) {
  const theta = Math.acos(Math.max(-1, Math.min(1, cos)))
  const deg = (theta * 180) / Math.PI
  const ox = 70
  const oy = 104
  const L = 70
  const a0 = 0.12
  const a1 = a0 + theta
  const p = (a: number, r = L) => [ox + Math.cos(a) * r, oy - Math.sin(a) * r]
  const [ax, ay] = p(a0)
  const [bx, by] = p(a1)
  const r = 26
  const [s0x, s0y] = p(a0, r)
  const [s1x, s1y] = p(a1, r)
  const [lx, ly] = p(a0 + theta / 2, r + 16)
  return (
    <svg className="embeddings-angle" viewBox="0 0 160 128" width={160} role="img" aria-label={`Ángulo entre los vectores: ${deg.toFixed(0)} grados`}>
      <defs>
        <marker id="embeddings-arrow-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--c-user)" />
        </marker>
        <marker id="embeddings-arrow-b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--c-data)" />
        </marker>
      </defs>
      <path d={`M${s0x},${s0y} A${r},${r} 0 ${theta > Math.PI ? 1 : 0} 0 ${s1x},${s1y}`} fill="none" stroke="var(--text-3)" strokeWidth={1.5} />
      <line x1={ox} y1={oy} x2={ax} y2={ay} stroke="var(--c-user)" strokeWidth={3} markerEnd="url(#embeddings-arrow-a)" />
      <line x1={ox} y1={oy} x2={bx} y2={by} stroke="var(--c-data)" strokeWidth={3} markerEnd="url(#embeddings-arrow-b)" style={{ transition: 'all 0.5s' }} />
      <text x={ax + 4} y={ay + 4} style={{ fill: 'var(--c-user)' }}>
        A
      </text>
      <text x={bx + (bx < ox ? -14 : 4)} y={by - 2} style={{ fill: 'var(--c-data)' }}>
        B
      </text>
      <text x={lx} y={ly + 4} textAnchor="middle" style={{ fontSize: 11 }}>
        {deg.toFixed(0)}°
      </text>
    </svg>
  )
}
