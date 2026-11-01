import { toneVar, type Tone } from '../../components/ui'
import { TERMINAL, type TaskState } from './data'

/* Diagrama de la máquina de estados de una Task A2A (v1.0, sin prefijo TASK_STATE_). */

const NW = 128
const NH = 36

const POS: Record<TaskState, { x: number; y: number }> = {
  SUBMITTED: { x: 72, y: 150 },
  WORKING: { x: 240, y: 150 },
  INPUT_REQUIRED: { x: 240, y: 46 },
  AUTH_REQUIRED: { x: 240, y: 254 },
  COMPLETED: { x: 482, y: 40 },
  FAILED: { x: 482, y: 113 },
  CANCELED: { x: 482, y: 187 },
  REJECTED: { x: 482, y: 260 },
}

export const STATE_TONE: Record<TaskState, Tone> = {
  SUBMITTED: 'system',
  WORKING: 'accent',
  INPUT_REQUIRED: 'guard',
  AUTH_REQUIRED: 'guard',
  COMPLETED: 'ok',
  FAILED: 'error',
  CANCELED: 'system',
  REJECTED: 'error',
}

type Edge = { from: TaskState; to: TaskState; dx?: number; path?: string; always?: boolean }

const EDGES: Edge[] = [
  { from: 'SUBMITTED', to: 'WORKING', always: true },
  { from: 'WORKING', to: 'INPUT_REQUIRED', dx: -14, always: true },
  { from: 'INPUT_REQUIRED', to: 'WORKING', dx: 14, always: true },
  { from: 'WORKING', to: 'AUTH_REQUIRED', dx: -14, always: true },
  { from: 'AUTH_REQUIRED', to: 'WORKING', dx: 14, always: true },
  { from: 'WORKING', to: 'COMPLETED', always: true },
  { from: 'WORKING', to: 'FAILED', always: true },
  { from: 'WORKING', to: 'CANCELED', always: true },
  { from: 'WORKING', to: 'REJECTED', always: true },
  { from: 'SUBMITTED', to: 'REJECTED', path: 'M72,168 C72,300 300,300 416,266', always: true },
  { from: 'SUBMITTED', to: 'CANCELED' },
  { from: 'INPUT_REQUIRED', to: 'CANCELED' },
  { from: 'AUTH_REQUIRED', to: 'CANCELED' },
]

function border(s: TaskState, toward: { x: number; y: number }, dx = 0) {
  const p = { x: POS[s].x + dx, y: POS[s].y }
  const ddx = toward.x - p.x
  const ddy = toward.y - p.y
  const k = Math.min((NW / 2 + 3) / Math.abs(ddx || 1e-9), (NH / 2 + 3) / Math.abs(ddy || 1e-9))
  return { x: p.x + ddx * k, y: p.y + ddy * k }
}

function geom(e: Edge) {
  if (e.path) {
    return { d: e.path, end: { x: 416, y: 266 }, ux: 0.95, uy: -0.3 }
  }
  const a = { x: POS[e.from].x + (e.dx ?? 0), y: POS[e.from].y }
  const b = { x: POS[e.to].x + (e.dx ?? 0), y: POS[e.to].y }
  const p1 = border(e.from, b, e.dx)
  const p2 = border(e.to, a, e.dx)
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1
  return { d: `M${p1.x},${p1.y} L${p2.x},${p2.y}`, end: p2, ux: (p2.x - p1.x) / len, uy: (p2.y - p1.y) / len }
}

export function StateMachine({
  current,
  lastEdge,
  visited = [],
  ariaLabel = 'Máquina de estados de una tarea A2A',
}: {
  current: TaskState | null
  lastEdge?: [TaskState, TaskState] | null
  visited?: TaskState[]
  ariaLabel?: string
}) {
  const isLast = (e: Edge) => !!lastEdge && lastEdge[0] === e.from && lastEdge[1] === e.to
  return (
    <svg className="a2a-sm" viewBox="0 0 560 310" role="img" aria-label={ariaLabel}>
      {EDGES.map((e, i) => {
        const last = isLast(e)
        if (!e.always && !last) return null
        const { d, end, ux, uy } = geom(e)
        const tone = toneVar(STATE_TONE[e.to])
        const head = `${end.x},${end.y} ${end.x - ux * 8 - uy * 4},${end.y - uy * 8 + ux * 4} ${end.x - ux * 8 + uy * 4},${end.y - uy * 8 - ux * 4}`
        return (
          <g key={i} className={`a2a-sm-edge${last ? ' is-last' : ''}${!e.always ? ' is-extra' : ''}`} style={{ ['--etone' as string]: tone }}>
            <path d={d} />
            <polygon points={head} />
            {last && (
              <circle r={4.5} className="a2a-sm-packet">
                <animateMotion dur="1s" repeatCount="indefinite" path={d} />
              </circle>
            )}
          </g>
        )
      })}
      {(Object.keys(POS) as TaskState[]).map((s) => {
        const { x, y } = POS[s]
        const on = current === s
        const term = TERMINAL.includes(s)
        return (
          <g key={s} className={`a2a-sm-node${on ? ' is-on' : ''}${visited.includes(s) ? ' is-visited' : ''}`} data-tone={STATE_TONE[s]}>
            <rect className="halo" x={x - NW / 2 - 5} y={y - NH / 2 - 5} width={NW + 10} height={NH + 10} rx={14} />
            <rect className="box" x={x - NW / 2} y={y - NH / 2} width={NW} height={NH} rx={10} />
            {term && <rect className="inner" x={x - NW / 2 + 3} y={y - NH / 2 + 3} width={NW - 6} height={NH - 6} rx={8} />}
            <text x={x} y={y + 4} textAnchor="middle">
              {s}
            </text>
          </g>
        )
      })}
      <text x={482} y={300} textAnchor="middle" className="a2a-sm-cap">
        terminales (doble borde)
      </text>
    </svg>
  )
}
