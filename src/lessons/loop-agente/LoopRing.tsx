import { Cpu, Eye, GitBranch, Layers, Wrench, type LucideIcon } from 'lucide-react'
import type { Tone } from '../../components/ui'

/* Diagrama circular del loop: Contexto → LLM → ¿stop_reason? → Ejecutar → Observación → …
   El "pulso" gira con una transición CSS de rotación (posición acumulada, así
   siempre avanza en el sentido del reloj). El centro muestra la iteración o el fin. */

export const PHASES: { label: string; sub: string; tone: Tone; icon: LucideIcon }[] = [
  { label: 'Contexto', sub: 'messages', tone: 'system', icon: Layers },
  { label: 'LLM', sub: 'messages.create', tone: 'model', icon: Cpu },
  { label: '¿stop_reason?', sub: 'tu código decide', tone: 'guard', icon: GitBranch },
  { label: 'Ejecutar', sub: 'run_tool()', tone: 'tool', icon: Wrench },
  { label: 'Observación', sub: 'tool_result', tone: 'data', icon: Eye },
]

const CX = 200
const CY = 165
const R = 104
const NR = 25

const ang = (i: number) => ((-90 + i * 72) * Math.PI) / 180
const pt = (i: number, r = R) => ({ x: CX + r * Math.cos(ang(i)), y: CY + r * Math.sin(ang(i)) })

function arc(i: number) {
  const pad = 0.26
  const a0 = ang(i) + pad
  const a1 = ang(i + 1) - pad
  const p0 = { x: CX + R * Math.cos(a0), y: CY + R * Math.sin(a0) }
  const p1 = { x: CX + R * Math.cos(a1), y: CY + R * Math.sin(a1) }
  return `M${p0.x.toFixed(1)},${p0.y.toFixed(1)} A${R},${R} 0 0 1 ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`
}

export function LoopRing({ phase, pos, iter, done, maxLabel }: { phase: number; pos: number; iter: number; done: boolean; maxLabel?: string }) {
  const prev = (phase + 4) % 5
  const stop = pt(2)
  const exitFrom = { x: stop.x - (stop.x - CX) * (NR / R) * 1.25, y: stop.y - (stop.y - CY) * (NR / R) * 1.25 }
  return (
    <svg className="loop-agente-ring" viewBox="0 0 400 330" role="img" aria-label={`Ciclo del agente, fase activa: ${done ? 'fin' : PHASES[phase].label}`}>
      <defs>
        <marker id="loop-agente-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="loop-agente-ring-arrowhead" />
        </marker>
      </defs>
      <circle cx={CX} cy={CY} r={R} className="loop-agente-ring-track" />
      {PHASES.map((_, i) => (
        <path
          key={i}
          d={arc(i)}
          className={`loop-agente-ring-arc${!done && i === prev ? ' is-active' : ''}`}
          markerEnd="url(#loop-agente-arrow)"
          style={{ ['--tone' as string]: `var(--c-${PHASES[(i + 1) % 5].tone})` }}
        />
      ))}
      {/* salida: end_turn */}
      <line x1={exitFrom.x} y1={exitFrom.y} x2={CX + 30} y2={CY + 30} className={`loop-agente-ring-exit${done ? ' is-active' : ''}`} markerEnd="url(#loop-agente-arrow)" />
      <text x={(exitFrom.x + CX + 30) / 2 + 14} y={(exitFrom.y + CY + 30) / 2 - 2} className="loop-agente-ring-exit-lbl">
        end_turn
      </text>
      <text x={CX} y={CY + R - 12} textAnchor="middle" className="loop-agente-ring-exit-lbl">
        tool_use
      </text>

      {/* pulso */}
      {!done && (
        <g className="loop-agente-ring-pulse" style={{ transform: `rotate(${pos * 72}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
          <circle cx={CX} cy={CY - R} r={NR + 7} className="loop-agente-ring-glow" style={{ ['--tone' as string]: `var(--c-${PHASES[phase].tone})` }} />
        </g>
      )}

      {PHASES.map((p, i) => {
        const c = pt(i)
        const on = !done && i === phase
        const Icon = p.icon
        const top = i === 0
        return (
          <g key={p.label} className={`loop-agente-ring-node${on ? ' is-active' : ''}`} data-tone={p.tone}>
            <circle cx={c.x} cy={c.y} r={NR} className="disc" />
            <Icon x={c.x - 10} y={c.y - 10} width={20} height={20} className="ico" />
            <text x={c.x} y={top ? c.y - NR - 20 : c.y + NR + 16} textAnchor="middle" className="lbl">
              {p.label}
            </text>
            <text x={c.x} y={top ? c.y - NR - 7 : c.y + NR + 29} textAnchor="middle" className="sub">
              {p.sub}
            </text>
          </g>
        )
      })}

      <g className={`loop-agente-ring-center${done ? ' is-done' : ''}`}>
        <circle cx={CX} cy={CY} r={44} className="disc" />
        {done ? (
          <>
            <text x={CX} y={CY - 4} textAnchor="middle" className="big">
              Fin
            </text>
            <text x={CX} y={CY + 14} textAnchor="middle" className="sub">
              respuesta al usuario
            </text>
          </>
        ) : (
          <>
            <text x={CX} y={CY - 14} textAnchor="middle" className="sub">
              iteración
            </text>
            <text x={CX} y={CY + 12} textAnchor="middle" className="big">
              {iter}
            </text>
            <text x={CX} y={CY + 28} textAnchor="middle" className="sub">
              {maxLabel ?? 'de máx. 10'}
            </text>
          </>
        )}
      </g>
    </svg>
  )
}
