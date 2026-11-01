import { useMemo, useState } from 'react'
import { FlowDiagram } from '../../components/Flow'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { Lab, Pill, Segmented, Stat, toneVar } from '../../components/ui'
import { usePlayer } from '../../lib/hooks'
import { fmt, fmtInt, fmtUsd } from '../../sim/math'
import { AGENT_INFO, PATTERNS, REQUEST, tallyUpTo, timeline, type Pattern, type PatternId } from './runs'

export function PatternLab() {
  const [id, setId] = useState<PatternId>('supervisor')
  const pattern = PATTERNS.find((p) => p.id === id)!
  return (
    <Lab title="Mismo pedido, seis arquitecturas" hint="Elige un patrón y dale play" badge="Animación">
      <Segmented options={PATTERNS.map((p) => ({ value: p.id, label: p.label }))} value={id} onChange={setId} />
      <p className="small" style={{ margin: '10px 0 4px', color: 'var(--text-2)' }}>
        {pattern.blurb}
      </p>
      <div className="multiagente-request">
        <Pill tone="user">Camila</Pill> <span>{REQUEST}</span>
      </div>
      <PatternRun key={pattern.id} pattern={pattern} />
    </Lab>
  )
}

function PatternRun({ pattern }: { pattern: Pattern }) {
  const tl = useMemo(() => timeline(pattern), [pattern])
  const player = usePlayer(pattern.beats.length, { interval: 3400 })
  const step = player.step
  const beat = pattern.beats[step]
  const tally = tallyUpTo(tl, step)
  const nowMs = tl.beatEnd[step] ?? 0
  const beatStart = step === 0 ? 0 : tl.beatEnd[step - 1]

  const steps: StepInfo[] = pattern.beats.map((b) => ({ title: b.title, body: b.caption }))
  const name = (a: string) => AGENT_INFO[a]?.label ?? a
  const maxS = Math.max(1, Math.ceil(tl.total.ms / 1000))

  return (
    <div style={{ marginTop: 12 }}>
      <PlayerBar player={player} labels={steps.map((s) => s.title)} />
      <div style={{ margin: '12px 0' }}>
        <Narration steps={steps} step={step} />
      </div>

      <div className="multiagente-stage">
        <FlowDiagram nodes={pattern.nodes} edges={pattern.edges} width={900} height={360} flows={beat.flows} active={beat.active} dimInactive ariaLabel={`Patrón ${pattern.label}`} />
      </div>

      <div className="multiagente-packets" key={step}>
        {beat.packets.map((p, i) => (
          <div key={i} className="multiagente-packet anim-in" style={{ animationDelay: `${i * 0.12}s`, ['--ptone' as string]: toneVar(AGENT_INFO[p.from]?.tone ?? 'system') }}>
            <div className="multiagente-packet-head">
              {p.from === p.to ? (
                <>salida de {name(p.from)}</>
              ) : (
                <>
                  {name(p.from)} <span aria-hidden>→</span> {name(p.to)}
                </>
              )}
            </div>
            <div className="multiagente-packet-body">{p.body}</div>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 14, alignItems: 'stretch' }}>
        <Stat label="Llamadas LLM" value={`${tally.llm}`} tone="model" sub={`de ${tl.total.llm} en total`} />
        <Stat label="Tokens" value={fmtInt(tally.inTok + tally.outTok)} tone="data" sub={`${fmtInt(tally.inTok)} in · ${fmtInt(tally.outTok)} out`} />
        <Stat label="Latencia" value={`${fmt(nowMs / 1000, 1)} s`} tone="guard" sub={`de ${fmt(tl.total.ms / 1000, 1)} s`} />
        <Stat label="Costo" value={fmtUsd(tally.usd)} tone="tool" sub="por solicitud" />
      </div>

      <div className="multiagente-gantt" aria-label="Línea de tiempo de llamadas por agente">
        <div className="multiagente-gantt-axis">
          <span />
          <div className="multiagente-gantt-track">
            {Array.from({ length: maxS + 1 }, (_, s) => (
              <span key={s} className="multiagente-gantt-tick" style={{ left: `${((s * 1000) / Math.max(tl.total.ms, maxS * 1000)) * 100}%` }}>
                {s}s
              </span>
            ))}
          </div>
        </div>
        {tl.lanes.map((a) => (
          <div key={a} className="multiagente-gantt-row">
            <span className="multiagente-gantt-label" style={{ color: toneVar(AGENT_INFO[a]?.tone ?? 'system') }}>
              {name(a)}
            </span>
            <div className="multiagente-gantt-track">
              {tl.calls
                .filter((c) => c.agent === a)
                .map((c, i) => {
                  const scale = Math.max(tl.total.ms, maxS * 1000)
                  const state = c.beat < step ? 'done' : c.beat === step ? 'now' : 'todo'
                  return (
                    <span
                      key={i}
                      className="multiagente-gantt-bar"
                      data-kind={c.kind}
                      data-state={state}
                      style={{ left: `${(c.start / scale) * 100}%`, width: `${Math.max(0.6, ((c.end - c.start) / scale) * 100)}%` }}
                      title={`${name(a)} · ${c.label} · ${c.ms} ms${c.kind === 'llm' ? ` · ${c.inTok} in / ${c.outTok} out` : ''}`}
                    />
                  )
                })}
            </div>
          </div>
        ))}
        <div className="multiagente-gantt-row multiagente-gantt-now-row">
          <span />
          <div className="multiagente-gantt-track">
            <span
              className="multiagente-gantt-window"
              style={{
                left: `${(beatStart / Math.max(tl.total.ms, maxS * 1000)) * 100}%`,
                width: `${((nowMs - beatStart) / Math.max(tl.total.ms, maxS * 1000)) * 100}%`,
              }}
            />
          </div>
        </div>
        <div className="row small muted" style={{ gap: 12, marginTop: 6 }}>
          <span className="multiagente-legend" data-kind="llm">
            llamada LLM
          </span>
          <span className="multiagente-legend" data-kind="tool">
            herramienta
          </span>
          <span>Las barras que se solapan en el tiempo corren en paralelo.</span>
        </div>
      </div>
    </div>
  )
}
