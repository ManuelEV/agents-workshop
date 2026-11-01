import { useMemo, useState } from 'react'
import { Bot, EyeOff, MessageSquare, ScanSearch, ShieldCheck, ShieldOff, User, Wrench } from 'lucide-react'
import { BarRow, Lab, Panel, Pill, Segmented, type Tone } from '../../components/ui'
import { FlowDiagram, type FlowEdge, type FlowNode } from '../../components/Flow'
import { Narration, PlayerBar } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { ATTACKS, LAYERS, THRESHOLD, simulate, type AttackId, type LayerId, type NodeId, type Stage, type Status } from './data'

const BASE: Record<NodeId, FlowNode> = {
  in: { id: 'in', x: 100, y: 70, w: 150, label: 'Entrada', sub: 'mensaje', tone: 'user', icon: User },
  inj: { id: 'inj', x: 330, y: 70, w: 175, label: 'Clasificador', sub: 'inyección', tone: 'guard', icon: ScanSearch },
  pii: { id: 'pii', x: 565, y: 70, w: 165, label: 'Redacción', sub: 'PII', tone: 'guard', icon: EyeOff },
  agent: { id: 'agent', x: 795, y: 70, w: 150, label: 'Agente', sub: 'LLM', tone: 'model', icon: Bot },
  tools: { id: 'tools', x: 790, y: 232, w: 175, label: 'Control tools', sub: 'allowlist · permisos', tone: 'guard', icon: Wrench },
  out: { id: 'out', x: 520, y: 232, w: 175, label: 'Validación', sub: 'salida', tone: 'guard', icon: ShieldCheck },
  resp: { id: 'resp', x: 190, y: 232, w: 175, label: 'Usuario', sub: 'respuesta', tone: 'user', icon: MessageSquare },
}

const EDGES: FlowEdge[] = [
  { from: 'in', to: 'inj' },
  { from: 'inj', to: 'pii' },
  { from: 'pii', to: 'agent' },
  { from: 'agent', to: 'tools', tone: 'tool' },
  { from: 'agent', to: 'out' },
  { from: 'out', to: 'resp' },
  { from: 'tools', to: 'inj', dashed: true, label: 'resultados de tools', curve: -30 },
]

const STATUS: Record<Status, { label: string; tone: Tone; mark: string }> = {
  info: { label: 'info', tone: 'system', mark: '' },
  pass: { label: 'pasa', tone: 'ok', mark: '✓ pasa' },
  transform: { label: 'transforma', tone: 'guard', mark: '✎ transforma' },
  block: { label: 'bloquea', tone: 'error', mark: '✕ bloquea' },
  off: { label: 'desactivada', tone: 'system', mark: 'apagada' },
  ok: { label: 'seguro', tone: 'ok', mark: '✓ seguro' },
  fail: { label: 'ataque exitoso', tone: 'error', mark: '✕ comprometido' },
  partial: { label: 'contenido a medias', tone: 'guard', mark: '◐ a medias' },
}

/** En el nodo final, "block" significa ataque detenido: es un éxito de la defensa. */
const FINAL_BLOCK = { label: 'ataque detenido', tone: 'ok' as Tone, mark: '✓ detenido' }
const info = (status: Status, node: NodeId) => (node === 'resp' && status === 'block' ? FINAL_BLOCK : STATUS[status])

const LAYER_NODE: Record<LayerId, NodeId> = { inj: 'inj', pii: 'pii', tools: 'tools', out: 'out' }

function outcome(stages: Stage[]) {
  return stages[stages.length - 1]
}

export function PipelineLab() {
  const [attack, setAttack] = useState<AttackId>('directa')
  const [enabled, setEnabled] = useState<Record<LayerId, boolean>>({ inj: true, pii: true, tools: true, out: true })
  const stages = useMemo(() => simulate(attack, enabled), [attack, enabled])
  const player = usePlayer(stages.length, { interval: (s) => (s >= stages.length - 2 ? 3600 : 2700) })
  const step = Math.min(player.step, stages.length - 1)
  const st = stages[step]
  const at = ATTACKS[attack]

  // estado visible de cada nodo hasta el paso actual
  const nodes: FlowNode[] = (Object.keys(BASE) as NodeId[]).map((id) => {
    const n = { ...BASE[id] }
    const layer = (Object.keys(LAYER_NODE) as LayerId[]).find((l) => LAYER_NODE[l] === id)
    if (layer && !enabled[layer]) return { ...n, tone: 'system', sub: 'DESACTIVADA' }
    const last = [...stages.slice(0, step + 1)].reverse().find((s) => s.node === id)
    if (last && last.status !== 'info' && last.status !== 'off') return { ...n, tone: info(last.status, id).tone, sub: info(last.status, id).mark }
    return n
  })

  const logs = stages
    .slice(0, step + 1)
    .map((s) => s.log)
    .filter((l): l is string => !!l)

  const toggle = (l: LayerId) => {
    setEnabled((e) => ({ ...e, [l]: !e[l] }))
    player.reset()
  }

  // ¿qué pasa con cada capa sola?
  const solo = LAYERS.map((l) => {
    const only = { inj: false, pii: false, tools: false, out: false, [l.id]: true } as Record<LayerId, boolean>
    return { l, res: outcome(simulate(attack, only)).status }
  })
  const none = outcome(simulate(attack, { inj: false, pii: false, tools: false, out: false })).status

  const isFinal = step === stages.length - 1
  const fs = info(st.status, st.node)

  return (
    <Lab
      title="Defensa en profundidad: ataca a Andi"
      hint="Elige un ataque, apaga capas y reproduce"
      footer={
        <div className="row" style={{ gap: 6 }}>
          <span className="small muted">Con una sola capa encendida:</span>
          {solo.map(({ l, res }) => (
            <Pill key={l.id} tone={info(res, 'resp').tone}>
              {l.short}: {info(res, 'resp').label}
            </Pill>
          ))}
          <Pill tone={info(none, 'resp').tone}>ninguna: {info(none, 'resp').label}</Pill>
        </div>
      }
    >
      <div className="stack" style={{ gap: 10, marginBottom: 12 }}>
        <Segmented
          options={(Object.keys(ATTACKS) as AttackId[]).map((k) => ({ value: k, label: ATTACKS[k].label }))}
          value={attack}
          onChange={(v) => {
            setAttack(v)
            player.reset()
          }}
        />
        <div className="row" style={{ gap: 6 }}>
          <span className="label">Capas</span>
          {LAYERS.map((l) => (
            <button key={l.id} className={`guardrails-layer${enabled[l.id] ? ' is-on' : ''}`} onClick={() => toggle(l.id)} aria-pressed={enabled[l.id]}>
              {enabled[l.id] ? <ShieldCheck size={14} /> : <ShieldOff size={14} />} {l.label}
            </button>
          ))}
        </div>
        <div className="guardrails-input">
          <span className="who">
            {at.actor.name} <span className="mono muted">({at.actor.id})</span>
          </span>
          <span className="txt">«{at.text}»</span>
          <Pill tone="guard" mono>
            {at.kind}
          </Pill>
        </div>
      </div>
      <PlayerBar player={player} labels={stages.map((s) => s.title)} />
      <div className="guardrails-flow">
        <FlowDiagram
          nodes={nodes}
          edges={EDGES}
          width={900}
          height={300}
          active={[st.node]}
          flows={st.flows}
          dimInactive
          ariaLabel="Pipeline de guardrails: entrada, clasificador, redacción de PII, agente, control de herramientas, validación de salida y usuario"
        />
      </div>
      <div className="split">
        <div className="stack" style={{ gap: 10 }}>
          <Narration steps={stages.map((s) => ({ title: s.title, body: s.body }))} step={step} />
          <div className="row" style={{ gap: 6 }}>
            <Pill tone={fs.tone}>{fs.label}</Pill>
          </div>
          {st.score !== undefined && (
            <div>
              <BarRow
                label="score"
                value={st.score}
                max={1}
                display={st.score.toFixed(2)}
                tone={st.score >= THRESHOLD ? 'error' : 'ok'}
              />
              <div className="small muted mono">umbral de bloqueo: {THRESHOLD.toFixed(2)}</div>
            </div>
          )}
          {st.checks && (
            <ul className="guardrails-checks">
              {st.checks.map((c, i) => (
                <li key={i} data-tone={c.tone}>
                  <span>{c.label}</span>
                  <span className="mono">{c.result}</span>
                </li>
              ))}
            </ul>
          )}
          {st.without && (
            <div className="guardrails-without">
              <strong>Sin esta capa:</strong> {st.without}
            </div>
          )}
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {st.payload && (
            <Panel title={st.payloadLabel ?? 'texto'} tone={st.node === 'resp' ? fs.tone : 'system'}>
              <div className={`guardrails-payload${isFinal ? ' is-final' : ''}`} data-tone={isFinal ? fs.tone : undefined}>
                {st.payload}
              </div>
            </Panel>
          )}
          <Panel title="auditoría" tone="system" right={<span className="mono small">{logs.length} eventos</span>}>
            {logs.length ? (
              <ol className="guardrails-log">
                {logs.map((l, i) => (
                  <li key={i} className={i === logs.length - 1 && st.log ? 'is-new' : ''}>
                    <span className="muted">15:02:{String(4 + i).padStart(2, '0')}</span> {l}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="small muted">Cada decisión de una capa queda registrada con su motivo.</div>
            )}
          </Panel>
        </div>
      </div>
      {isFinal && (
        <div className="guardrails-outcome anim-in" data-tone={fs.tone}>
          <strong>{st.title}.</strong> {st.body}
        </div>
      )}
    </Lab>
  )
}
