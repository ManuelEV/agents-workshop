import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, RotateCcw, ShieldAlert } from 'lucide-react'
import { Json } from '../../components/Code'
import { Lab, Pill, type Tone } from '../../components/ui'
import { embed } from '../../sim/embed'
import { cosine } from '../../sim/math'
import { FACT_PRESETS, STORE0, type FactPreset, type Op, type StoreRec } from './data'

const OP_TONE: Record<Op, Tone> = { ADD: 'ok', UPDATE: 'tool', DELETE: 'error', NOOP: 'system' }
const STAGES = ['Extraer hecho', 'Buscar similares', 'Decidir', 'Aplicar']

type Decision = { op: Op; target?: string; motivo: string }

/** Ajusta la decisión guionada al estado actual del store (p. ej. no se puede borrar dos veces). */
function decide(p: FactPreset, store: StoreRec[]): Decision {
  const t = store.find((r) => r.id === p.target)
  const alive = t && t.estado !== 'borrado' && t.estado !== 'expirado'
  if (p.op === 'DELETE' && !alive) return { op: 'NOOP', motivo: 'No hay nada que borrar: ese recuerdo ya no existe.' }
  if (p.op === 'UPDATE' && !alive) return { op: 'ADD', motivo: 'El recuerdo anterior ya no existe: se agrega como nuevo.' }
  if (p.op === 'UPDATE' && t && p.hecho && t.texto === p.hecho.texto) return { op: 'NOOP', target: t.id, motivo: 'Ya está actualizado: no hay cambios.' }
  if (p.op === 'ADD' && p.hecho && store.some((r) => r.clave === p.hecho!.clave && r.estado !== 'borrado' && r.estado !== 'expirado'))
    return { op: 'NOOP', motivo: 'Ya se agregó antes: no se duplica.' }
  return { op: p.op, target: p.target, motivo: p.motivo }
}

export function HygieneLab() {
  const [store, setStore] = useState<StoreRec[]>(STORE0)
  const [preset, setPreset] = useState<FactPreset | null>(null)
  const [stage, setStage] = useState(0)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [log, setLog] = useState<{ op: Op; text: string }[]>([])

  const similar = useMemo(() => {
    if (!preset) return []
    const q = embed(preset.hecho?.texto ?? preset.dicho)
    return store
      .filter((r) => r.estado !== 'borrado' && r.estado !== 'expirado')
      .map((r) => ({ r, score: cosine(q, embed(r.texto)), sameKey: !!preset.hecho && r.clave === preset.hecho.clave }))
      .sort((a, b) => Number(b.sameKey) - Number(a.sameKey) || b.score - a.score)
      .slice(0, 2)
  }, [preset, store])

  // avanza las etapas de forma automática
  useEffect(() => {
    if (!preset || stage === 0 || stage >= 4) return
    const t = setTimeout(() => setStage((s) => s + 1), stage === 1 && preset.guard ? 300 : 1100)
    return () => clearTimeout(t)
  }, [preset, stage])

  // al llegar a "aplicar", modifica el store
  useEffect(() => {
    if (stage !== 4 || !preset || !decision) return
    setStore((st) => {
      const next: StoreRec[] = st.map((r) => ({ ...r, estado: r.estado === 'nuevo' || r.estado === 'actualizado' ? ('activo' as const) : r.estado }))
      if (decision.op === 'ADD' && preset.hecho) {
        next.push({ id: `m${next.length + 1}`, ...preset.hecho, edad: 0, ttl: preset.ttl ?? null, estado: 'nuevo' })
      } else if (decision.op === 'UPDATE' && preset.hecho) {
        const i = next.findIndex((r) => r.id === decision.target)
        if (i >= 0) next[i] = { ...next[i], previo: next[i].texto, texto: preset.hecho.texto, edad: 0, estado: 'actualizado' }
      } else if (decision.op === 'DELETE') {
        const i = next.findIndex((r) => r.id === decision.target)
        if (i >= 0) next[i] = { ...next[i], estado: 'borrado', previo: undefined }
      }
      return next
    })
    setLog((l) => [{ op: decision.op, text: preset.dicho }, ...l].slice(0, 6))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  const send = (p: FactPreset) => {
    setPreset(p)
    setDecision(decide(p, store))
    setStage(1)
  }
  const age = (days: number) =>
    setStore((st) =>
      st.map((r) => {
        if (r.estado === 'borrado') return r
        const edad = r.edad + days
        return { ...r, edad, estado: r.ttl !== null && edad > r.ttl ? ('expirado' as const) : r.estado }
      }),
    )
  const reset = () => {
    setStore(STORE0)
    setPreset(null)
    setStage(0)
    setDecision(null)
    setLog([])
  }
  const busy = stage > 0 && stage < 4

  return (
    <Lab title="Higiene de memoria: ADD, UPDATE, DELETE, NOOP" hint="Elige lo que dice Camila y mira qué decide el store">
      <div className="label" style={{ marginBottom: 6 }}>
        Camila dice…
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        {FACT_PRESETS.map((p) => (
          <button key={p.label} className={`btn btn-sm${preset === p ? ' btn-primary' : ''}`} onClick={() => send(p)} disabled={busy} title={p.dicho}>
            {p.guard && <ShieldAlert size={13} />} {p.label}
          </button>
        ))}
      </div>

      {preset && (
        <div className="memoria-pipeline">
          <div className="memoria-said">
            <span className="label">usuario</span> “{preset.dicho}”
          </div>
          <ol className="memoria-stages">
            {STAGES.map((s, i) => (
              <li key={s} data-state={stage > i + 1 || stage === 4 ? 'done' : stage === i + 1 ? 'now' : 'todo'}>
                <span className="memoria-stage-n">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="stack" style={{ gap: 8 }}>
              {stage >= 1 && (
                <div className="anim-fade">
                  {preset.hecho ? (
                    <Json value={preset.hecho} title="1 · hecho candidato" />
                  ) : preset.guard ? (
                    <div className="memoria-guard">
                      <ShieldAlert size={16} /> El filtro de PII detecta un número de tarjeta: no se extrae ningún hecho.
                    </div>
                  ) : (
                    <Json value={{ intencion: 'olvidar', clave: 'direccion' }} title="1 · intención detectada" />
                  )}
                </div>
              )}
              {stage >= 2 && !preset.guard && (
                <div className="memoria-similar anim-fade">
                  <div className="label">2 · similares en el store</div>
                  {similar.map(({ r, score, sameKey }) => (
                    <div key={r.id} className="small">
                      <span className="mono">{r.id}</span> {r.texto} · <span className="mono">cos {score.toFixed(2)}</span>
                      {sameKey && (
                        <>
                          {' '}
                          <Pill tone="tool" mono>
                            misma clave
                          </Pill>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {stage >= 3 && decision && (
              <div className="anim-fade">
                <Json
                  value={{ evento: decision.op, ...(decision.target ? { id: decision.target } : {}), ...(preset.hecho && decision.op !== 'NOOP' ? { texto: preset.hecho.texto } : {}), motivo: decision.motivo }}
                  title="3 · decisión del LLM"
                />
                <div style={{ marginTop: 8 }}>
                  <Pill tone={OP_TONE[decision.op]} mono>
                    {decision.op}
                  </Pill>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between', margin: '16px 0 6px' }}>
        <span className="label">Memory store de Camila</span>
        <span className="row" style={{ gap: 6 }}>
          <button className="btn btn-sm" onClick={() => age(30)} disabled={busy}>
            <CalendarClock size={14} /> +30 días
          </button>
          <button className="btn btn-sm btn-ghost" onClick={reset}>
            <RotateCcw size={14} /> Reiniciar
          </button>
        </span>
      </div>
      <div className="table-wrap" style={{ margin: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>id</th>
              <th>clave</th>
              <th>recuerdo</th>
              <th style={{ textAlign: 'right' }}>edad</th>
              <th style={{ textAlign: 'right' }}>TTL</th>
              <th>estado</th>
            </tr>
          </thead>
          <tbody>
            {store.map((r) => (
              <tr key={r.id} className={`memoria-rec memoria-rec-${r.estado}`}>
                <td className="mono">{r.id}</td>
                <td className="mono small">{r.clave}</td>
                <td>
                  <span className="memoria-rec-text">{r.texto}</span>
                  {r.previo && <div className="small muted">antes: {r.previo} (archivado)</div>}
                </td>
                <td className="num">{r.edad} d</td>
                <td className="num">{r.ttl === null ? '∞' : `${r.ttl} d`}</td>
                <td>
                  <Pill tone={r.estado === 'nuevo' ? 'ok' : r.estado === 'actualizado' ? 'tool' : r.estado === 'borrado' ? 'error' : r.estado === 'expirado' ? 'guard' : 'system'} mono>
                    {r.estado}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {log.length > 0 && (
        <div className="memoria-log">
          {log.map((l, i) => (
            <div key={i} className="small">
              <Pill tone={OP_TONE[l.op]} mono>
                {l.op}
              </Pill>{' '}
              <span className="muted">{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </Lab>
  )
}
