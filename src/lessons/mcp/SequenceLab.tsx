import { useMemo, useState } from 'react'
import { Lab, Panel, Pill, Segmented, toneVar, type Tone } from '../../components/ui'
import { Code, linesOf } from '../../components/Code'
import { Narration, PlayerBar } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { API_TOOL, MCP_TOOL, buildSteps, type ArrowKind, type Lane, type SeqStep, type Spec } from './data'

const LANES: { id: Lane; label: string; sub: string; tone: Tone }[] = [
  { id: 'user', label: 'Usuario', sub: 'Camila', tone: 'user' },
  { id: 'llm', label: 'LLM', sub: 'API del modelo', tone: 'model' },
  { id: 'host', label: 'Host', sub: 'app de soporte', tone: 'system' },
  { id: 'client', label: 'Cliente MCP', sub: 'dentro del host', tone: 'accent' },
  { id: 'server', label: 'Servidor MCP', sub: 'andes-pedidos', tone: 'tool' },
]

const W = 900
const MX = 90
const HEAD_Y = 10
const HEAD_H = 46
const ROW0 = 86
const ROW_H = 30

const laneX = (id: Lane) => {
  const i = LANES.findIndex((l) => l.id === id)
  return MX + (i * (W - 2 * MX)) / (LANES.length - 1)
}

const KIND_TONE: Record<ArrowKind, Tone> = { req: 'accent', res: 'tool', notif: 'system', self: 'system', api: 'model' }

function arrowTone(s: SeqStep): Tone {
  if (s.kind === 'api') return s.from === 'user' || s.to === 'user' ? 'user' : 'model'
  return KIND_TONE[s.kind]
}

function SeqDiagram({ steps, current, onPick }: { steps: SeqStep[]; current: number; onPick: (i: number) => void }) {
  const H = ROW0 + steps.length * ROW_H + 10
  const cur = steps[current]
  const activeLanes = new Set<Lane>(cur ? [cur.from, cur.to] : [])
  return (
    <div className="mcp-seq-wrap">
      <svg className="mcp-seq" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Diagrama de secuencia de una llamada MCP">
        {LANES.map((l) => {
          const x = laneX(l.id)
          const on = activeLanes.has(l.id)
          return (
            <g key={l.id} data-tone={l.tone} className={`mcp-lane${on ? ' is-on' : ''}`}>
              <line className="mcp-lifeline" x1={x} x2={x} y1={HEAD_Y + HEAD_H} y2={H - 4} />
              <rect className="mcp-lane-box" x={x - 72} y={HEAD_Y} width={144} height={HEAD_H} rx={10} />
              <text className="mcp-lane-lbl" x={x} y={HEAD_Y + 21} textAnchor="middle">
                {l.label}
              </text>
              <text className="mcp-lane-sub" x={x} y={HEAD_Y + 37} textAnchor="middle">
                {l.sub}
              </text>
            </g>
          )
        })}
        {steps.map((s, i) => {
          if (i > current) return null
          const y = ROW0 + i * ROW_H + 14
          const x1 = laneX(s.from)
          const x2 = laneX(s.to)
          const isCur = i === current
          const tone = toneVar(arrowTone(s))
          const dir = x2 >= x1 ? 1 : -1
          const cls = `mcp-arrow k-${s.kind}${isCur ? ' is-cur' : ''}`
          if (s.kind === 'self') {
            const xs = laneX('client')
            const xh = laneX('host')
            const d = `M${xs},${y - 6} C${xs - 40},${y - 22} ${xh + 40},${y - 22} ${xh + 6},${y - 4}`
            return (
              <g key={i} className={cls} style={{ ['--atone' as string]: tone }} onClick={() => onPick(i)}>
                <rect className="mcp-hit" x={xh} y={y - 24} width={xs - xh} height={28} />
                <path d={d} className="mcp-arrow-line" fill="none" />
                <polygon points={`${xh + 6},${y - 4} ${xh + 15},${y - 10} ${xh + 16},${y - 1}`} className="mcp-arrow-head" />
                <text x={(xs + xh) / 2} y={y + 9} textAnchor="middle" className="mcp-arrow-lbl">
                  {s.label}
                </text>
                {isCur && (
                  <circle r={5} className="mcp-packet">
                    <animateMotion dur="1.2s" repeatCount="indefinite" path={d} />
                  </circle>
                )}
              </g>
            )
          }
          const a = x1 + dir * 4
          const b = x2 - dir * 6
          const d = `M${a},${y} L${b},${y}`
          return (
            <g key={i} className={cls} style={{ ['--atone' as string]: tone }} onClick={() => onPick(i)}>
              <rect className="mcp-hit" x={Math.min(x1, x2)} y={y - 18} width={Math.abs(x2 - x1)} height={26} />
              <path d={d} className="mcp-arrow-line" />
              <polygon points={`${b + dir * 2},${y} ${b - dir * 8},${y - 5} ${b - dir * 8},${y + 5}`} className="mcp-arrow-head" />
              <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" className="mcp-arrow-lbl">
                {s.label.length > 46 ? s.label.slice(0, 44) + '…' : s.label}
              </text>
              {isCur && (
                <circle r={5.5} className="mcp-packet">
                  <animateMotion dur="1.1s" repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          )
        })}
        {steps.map((_, i) =>
          i > current ? (
            <line key={`g${i}`} className="mcp-ghost" x1={MX} x2={W - MX} y1={ROW0 + i * ROW_H + 14} y2={ROW0 + i * ROW_H + 14} />
          ) : null,
        )}
      </svg>
    </div>
  )
}

function ConvertView() {
  const mcp = JSON.stringify(MCP_TOOL, null, 2)
  const api = JSON.stringify(API_TOOL, null, 2)
  return (
    <div className="grid-2">
      <Code code={mcp} lang="json" title="tools/list → tool MCP" highlight={linesOf(mcp, '"inputSchema"', '"annotations"', '"title"')} maxHeight={300} />
      <Code code={api} lang="json" title="tools[] de la Messages API" highlight={linesOf(api, '"input_schema"')} maxHeight={300} />
    </div>
  )
}

export function SequenceLab() {
  const [spec, setSpec] = useState<Spec>('2025-11-25')
  const steps = useMemo(() => buildSteps(spec), [spec])
  const player = usePlayer(steps.length, { interval: (s) => (steps[s]?.convert ? 5200 : 3600) })
  const step = Math.min(player.step, steps.length - 1)
  const s = steps[step]

  return (
    <Lab
      title="Diagrama de secuencia: ¿dónde está mi pedido 4821?"
      hint="Reproduce o haz clic en una flecha"
      footer={
        <span className="small muted">
          Mensajes JSON-RPC con la forma de la spec elegida. En 2026-07-28 las claves dentro de <code>_meta</code> y la respuesta de{' '}
          <code>server/discover</code> están simplificadas.
        </span>
      }
    >
      <div className="row" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="label">Versión de la spec</span>
          <Segmented
            options={[
              { value: '2025-11-25', label: '2025-11-25 · con handshake' },
              { value: '2026-07-28', label: '2026-07-28 · stateless' },
            ]}
            value={spec}
            onChange={(v) => {
              setSpec(v)
              player.reset()
            }}
          />
        </div>
        <div className="mcp-legend small">
          <span data-tone="accent">— request</span>
          <span data-tone="tool">- - response</span>
          <span data-tone="system">··· notificación</span>
          <span data-tone="model">— API del LLM</span>
        </div>
      </div>
      <PlayerBar player={player} labels={steps.map((x) => x.title)} />
      <SeqDiagram steps={steps} current={step} onPick={player.goTo} />
      <div className={`mcp-step-detail${s.convert ? ' is-wide' : ''}`}>
        <div className="stack" style={{ gap: 10 }}>
          <Narration steps={steps.map((x) => ({ title: x.title, body: x.body }))} step={step} />
          <div className="row" style={{ gap: 6 }}>
            <Pill tone={arrowTone(s)} mono>
              {LANES.find((l) => l.id === s.from)?.label} → {LANES.find((l) => l.id === s.to)?.label}
            </Pill>
            {s.tags?.map((t) => (
              <Pill key={t} mono>
                {t}
              </Pill>
            ))}
          </div>
        </div>
        <div className="anim-fade" key={`${spec}-${step}`}>
          {s.convert ? (
            <ConvertView />
          ) : s.lang === 'text' ? (
            <Panel title={s.codeTitle} tone={arrowTone(s)}>
              <div className="mcp-chat-bubble" data-tone={s.from === 'user' ? 'user' : 'model'}>
                {s.code}
              </div>
            </Panel>
          ) : (
            <Code code={s.code} lang={s.lang} title={s.codeTitle} highlight={linesOf(s.code, ...(s.hl ?? []))} maxHeight={320} />
          )}
        </div>
      </div>
    </Lab>
  )
}
