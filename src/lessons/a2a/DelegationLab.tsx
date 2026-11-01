import { Bot, IdCard, Truck, User } from 'lucide-react'
import { Lab, Panel, Pill } from '../../components/ui'
import { Code, linesOf } from '../../components/Code'
import { FlowDiagram, type FlowEdge, type FlowNode } from '../../components/Flow'
import { Narration, PlayerBar } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { DELEG_STEPS, STATE_INFO, type TaskState } from './data'
import { StateMachine, STATE_TONE } from './StateMachine'

const NODES: FlowNode[] = [
  { id: 'camila', x: 90, y: 50, w: 150, label: 'Camila', sub: 'clienta', tone: 'user', icon: User },
  { id: 'andi', x: 90, y: 215, w: 150, label: 'Andi', sub: 'agente cliente', tone: 'model', icon: Bot },
  { id: 'card', x: 420, y: 50, w: 170, label: 'Agent Card', sub: '/.well-known/…', tone: 'data', icon: IdCard },
  { id: 'rutasur', x: 420, y: 215, w: 170, label: 'RutaSur', sub: 'agente remoto', tone: 'tool', icon: Truck },
]
const EDGES: FlowEdge[] = [
  { from: 'camila', to: 'andi', label: 'chat' },
  { from: 'andi', to: 'card', label: 'GET', dashed: true },
  { from: 'andi', to: 'rutasur', label: 'A2A · JSON-RPC' },
]

export function DelegationLab() {
  const steps = DELEG_STEPS
  const player = usePlayer(steps.length, { interval: (s) => (steps[s]?.lang === 'json' ? 4200 : 3000) })
  const s = steps[player.step]
  const visited = Array.from(new Set(steps.slice(0, player.step + 1).flatMap((x) => (x.state ? [x.state] : [])))) as TaskState[]
  const lastEdge = s.edge ?? null

  return (
    <Lab
      title="Andi delega en RutaSur: reprogramar el pedido 5230"
      hint="Reproduce paso a paso"
      footer={
        <span className="small muted">
          Mensajes con la forma de A2A v1.0 (binding JSON-RPC). RutaSur es ficticio; se omiten campos opcionales y el intercambio OAuth.
        </span>
      }
    >
      <PlayerBar player={player} labels={steps.map((x) => x.title)} />
      <div className="a2a-top">
        <div className="a2a-actors">
          <FlowDiagram
            nodes={NODES}
            edges={EDGES}
            width={520}
            height={270}
            flows={s.flows}
            active={s.active}
            dimInactive
            ariaLabel="Actores: Camila, Andi, la Agent Card y el agente de RutaSur"
          />
        </div>
        <div className="a2a-sm-wrap">
          <div className="a2a-sm-head">
            <span className="label">Task {s.state ? '· tsk-7f3a9c' : ''}</span>
            {s.state ? (
              <Pill tone={STATE_TONE[s.state]} mono>
                TASK_STATE_{s.state}
              </Pill>
            ) : (
              <Pill mono>aún no existe</Pill>
            )}
          </div>
          <StateMachine current={s.state} lastEdge={lastEdge} visited={visited} />
        </div>
      </div>
      <div className="a2a-detail">
        <div className="stack" style={{ gap: 12 }}>
          <Narration steps={steps} step={player.step} />
          {s.state && <div className="small muted">{STATE_INFO[s.state].desc}</div>}
          <ol className="a2a-timeline" aria-label="Línea de tiempo">
            {steps.slice(0, player.step + 1).map((x, i) => (
              <li key={i} data-tone={x.eventTone} className={i === player.step ? 'is-cur' : ''}>
                <button onClick={() => player.goTo(i)}>
                  <span className="t mono">{x.time}</span>
                  <span className="e">{x.event}</span>
                  {x.state && x.edge && <span className="s mono">{x.state}</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="anim-fade" key={player.step}>
          {s.chat ? (
            <Panel title={s.codeTitle} tone={s.chat}>
              <div className="a2a-bubble" data-tone={s.chat}>
                {s.code}
              </div>
            </Panel>
          ) : (
            <Code code={s.code} lang={s.lang} title={s.codeTitle} highlight={linesOf(s.code, ...(s.hl ?? []))} maxHeight={420} />
          )}
        </div>
      </div>
    </Lab>
  )
}
