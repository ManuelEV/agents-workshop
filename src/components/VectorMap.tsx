import { useState, type ReactNode } from 'react'
import { CONCEPTS } from '../sim/embed'
import { toneVar, type Tone } from './ui'

/* ==========================================================================
   Mapa semántico 2D (proyección tipo UMAP de los embeddings).
   Coordenadas de entrada en 0..100 (las que devuelve `project()`).
   ========================================================================== */

export type MapPoint = {
  id: string
  x: number
  y: number
  label?: string
  /** texto del tooltip (si no, usa label) */
  tip?: string
  tone?: Tone
  r?: number
  dim?: boolean
  hl?: boolean
  /** retraso (s) de la animación de entrada; si es undefined no anima */
  enterDelay?: number
}

export type MapLink = { from: [number, number]; to: [number, number]; label?: string; tone?: Tone; dashed?: boolean }

const W = 760
const H = 440
const PAD = 22
export const mapX = (x: number) => PAD + (x / 100) * (W - 2 * PAD)
export const mapY = (y: number) => PAD + (y / 100) * (H - 2 * PAD)

export function VectorMap({
  points,
  query,
  links = [],
  radius,
  showRegions = true,
  showLabels = 'hl',
  onPointClick,
  overlay,
  ariaLabel = 'Mapa de vectores',
}: {
  points: MapPoint[]
  /** punto de consulta (se dibuja como estrella con pulso) */
  query?: { x: number; y: number; label?: string } | null
  links?: MapLink[]
  /** radio de búsqueda alrededor de la consulta, en unidades del mapa (0..100) */
  radius?: number
  showRegions?: boolean
  /** 'none' | 'hl' (solo destacados) | 'all' */
  showLabels?: 'none' | 'hl' | 'all'
  onPointClick?: (id: string) => void
  /** SVG extra dibujado encima (en coordenadas del viewBox 760×440) */
  overlay?: ReactNode
  ariaLabel?: string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const hp = points.find((p) => p.id === hover)

  return (
    <div className="flow-scroll">
    <svg className="flow flow-min" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ borderRadius: 12, background: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
      <defs>
        <radialGradient id="vm-region">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.13" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <pattern id="vm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="var(--grid)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#vm-grid)" />
      {showRegions &&
        CONCEPTS.map((c) => (
          <g key={c.id}>
            <circle cx={mapX(c.anchor[0])} cy={mapY(c.anchor[1])} r={62} fill="url(#vm-region)" />
            <text
              x={mapX(c.anchor[0])}
              y={mapY(c.anchor[1]) - 38}
              textAnchor="middle"
              style={{ font: '600 12px var(--font-mono)', fill: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              {c.label}
            </text>
          </g>
        ))}

      {radius !== undefined && query && (
        <circle
          cx={mapX(query.x)}
          cy={mapY(query.y)}
          r={(radius / 100) * (W - 2 * PAD)}
          fill="color-mix(in srgb, var(--c-user) 7%, transparent)"
          stroke="var(--c-user)"
          strokeDasharray="6 6"
          strokeOpacity={0.6}
          style={{ transition: 'r 0.6s ease' }}
        />
      )}

      {links.map((l, i) => {
        const x1 = mapX(l.from[0])
        const y1 = mapY(l.from[1])
        const x2 = mapX(l.to[0])
        const y2 = mapY(l.to[1])
        const color = toneVar(l.tone ?? 'user')
        return (
          <g key={i} className="anim-fade">
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeDasharray={l.dashed ? '5 5' : undefined} strokeOpacity={0.85} />
            {l.label && (
              <g>
                <rect x={(x1 + x2) / 2 - 24} y={(y1 + y2) / 2 - 10} width={48} height={19} rx={6} fill="var(--bg-elev)" stroke={color} strokeOpacity={0.5} />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 4} textAnchor="middle" style={{ font: '600 11px var(--font-mono)', fill: 'var(--text)' }}>
                  {l.label}
                </text>
              </g>
            )}
          </g>
        )
      })}

      {points.map((p) => {
        const cx = mapX(p.x)
        const cy = mapY(p.y)
        const color = toneVar(p.tone ?? 'data')
        const r = p.r ?? 7
        return (
          <g
            key={p.id}
            style={{
              cursor: onPointClick ? 'pointer' : 'default',
              opacity: p.dim ? 0.28 : 1,
              transition: 'opacity 0.4s',
              animation: p.enterDelay !== undefined ? `pop-in 0.5s ${p.enterDelay}s both` : undefined,
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
            onClick={onPointClick ? () => onPointClick(p.id) : undefined}
          >
            <circle cx={cx} cy={cy} r={r + 9} fill="transparent" />
            {p.hl && <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.5} />}
            <circle cx={cx} cy={cy} r={r} fill={color} stroke="var(--bg-sunken)" strokeWidth={2} />
          </g>
        )
      })}

      {placeLabels(points, showLabels, query).map((l) => (
        <text
          key={'lbl-' + l.id}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          style={{ font: '600 13px var(--font-sans)', fill: 'var(--text)', paintOrder: 'stroke', stroke: 'var(--bg-sunken)', strokeWidth: 4, pointerEvents: 'none', opacity: l.dim ? 0.4 : 1 }}
        >
          {l.text}
        </text>
      ))}

      {query && (
        <g style={{ transition: 'transform 0.6s' }}>
          <circle cx={mapX(query.x)} cy={mapY(query.y)} r={14} fill="none" stroke="var(--c-user)" strokeWidth={2} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'pulse-ring 1.6s ease-out infinite' }} />
          <path
            d={starPath(mapX(query.x), mapY(query.y), 13, 5.5)}
            fill="var(--c-user)"
            stroke="var(--bg-sunken)"
            strokeWidth={2}
          />
          {query.label && (
            <text
              x={mapX(query.x)}
              y={mapY(query.y) - 20}
              textAnchor="middle"
              style={{ font: '700 13px var(--font-sans)', fill: 'var(--c-user)', paintOrder: 'stroke', stroke: 'var(--bg-sunken)', strokeWidth: 5 }}
            >
              {query.label}
            </text>
          )}
        </g>
      )}

      {overlay}

      {hp && (hp.tip || hp.label) && <Tooltip x={mapX(hp.x)} y={mapY(hp.y)} text={hp.tip ?? hp.label ?? ''} />}
    </svg>
    </div>
  )
}

type Box = { x0: number; y0: number; x1: number; y1: number }
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

/** Colocación simple de etiquetas: prueba varias posiciones y elige la primera sin choques. */
function placeLabels(points: MapPoint[], mode: 'none' | 'hl' | 'all', query?: { x: number; y: number; label?: string } | null) {
  if (mode === 'none') return []
  const placed: Box[] = []
  if (query) {
    const qx = mapX(query.x)
    const qy = mapY(query.y)
    placed.push({ x0: qx - 16, y0: qy - 16, x1: qx + 16, y1: qy + 16 })
    if (query.label) {
      const w = query.label.length * 7.4
      placed.push({ x0: qx - w / 2, y0: qy - 34, x1: qx + w / 2, y1: qy - 16 })
    }
  }
  const out: { id: string; x: number; y: number; anchor: 'start' | 'end' | 'middle'; text: string; dim?: boolean }[] = []
  const list = points.filter((p) => p.label && (mode === 'all' || p.hl)).sort((a, b) => Number(!!b.hl) - Number(!!a.hl))
  for (const p of list) {
    const text = p.label!.length > 34 ? p.label!.slice(0, 33) + '…' : p.label!
    const w = text.length * 7 + 4
    const h = 15
    const cx = mapX(p.x)
    const cy = mapY(p.y)
    const r = (p.r ?? 7) + 5
    const cands: { x: number; y: number; anchor: 'start' | 'end' | 'middle'; box: Box }[] = [
      { x: cx + r, y: cy + 4, anchor: 'start', box: { x0: cx + r, y0: cy - 9, x1: cx + r + w, y1: cy - 9 + h } },
      { x: cx - r, y: cy + 4, anchor: 'end', box: { x0: cx - r - w, y0: cy - 9, x1: cx - r, y1: cy - 9 + h } },
      { x: cx, y: cy - r - 4, anchor: 'middle', box: { x0: cx - w / 2, y0: cy - r - 4 - 12, x1: cx + w / 2, y1: cy - r - 1 } },
      { x: cx, y: cy + r + 13, anchor: 'middle', box: { x0: cx - w / 2, y0: cy + r, x1: cx + w / 2, y1: cy + r + h } },
      { x: cx + r, y: cy - 10, anchor: 'start', box: { x0: cx + r, y0: cy - 23, x1: cx + r + w, y1: cy - 23 + h } },
      { x: cx + r, y: cy + 19, anchor: 'start', box: { x0: cx + r, y0: cy + 6, x1: cx + r + w, y1: cy + 6 + h } },
      { x: cx - r, y: cy - 10, anchor: 'end', box: { x0: cx - r - w, y0: cy - 23, x1: cx - r, y1: cy - 23 + h } },
      { x: cx - r, y: cy + 19, anchor: 'end', box: { x0: cx - r - w, y0: cy + 6, x1: cx - r, y1: cy + 6 + h } },
    ]
    const inside = (b: Box) => b.x0 >= 2 && b.x1 <= W - 2 && b.y0 >= 2 && b.y1 <= H - 2
    const pick = cands.find((c) => inside(c.box) && !placed.some((b) => overlaps(b, c.box))) ?? cands.find((c) => inside(c.box)) ?? cands[0]
    placed.push(pick.box)
    out.push({ id: p.id, x: pick.x, y: pick.y, anchor: pick.anchor, text, dim: p.dim })
  }
  return out
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

/** Tooltip SVG multilínea (corta el texto en líneas de ~46 caracteres). */
function Tooltip({ x, y, text }: { x: number; y: number; text: string }) {
  const lines: string[] = []
  let cur = ''
  for (const w of text.split(' ')) {
    if ((cur + ' ' + w).trim().length > 46) {
      lines.push(cur.trim())
      cur = w
    } else cur += ' ' + w
  }
  if (cur.trim()) lines.push(cur.trim())
  const shown = lines.slice(0, 5)
  if (lines.length > 5) shown[4] += ' …'
  const w = Math.max(...shown.map((l) => l.length)) * 6.9 + 22
  const h = shown.length * 17 + 14
  const left = Math.min(Math.max(x - w / 2, 6), W - w - 6)
  const top = y - h - 16 < 6 ? y + 16 : y - h - 16
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={left} y={top} width={w} height={h} rx={9} fill="var(--text)" opacity={0.95} />
      {shown.map((l, i) => (
        <text key={i} x={left + 11} y={top + 20 + i * 17} style={{ font: '12.5px var(--font-sans)', fill: 'var(--bg)' }}>
          {l}
        </text>
      ))}
    </g>
  )
}
