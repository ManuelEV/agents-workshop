import { useState } from 'react'
import { CheckCircle2, Circle, Loader2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import { Code } from '../../components/Code'
import { PlayerBar } from '../../components/Player'
import { BarRow, Lab, Panel, Pill, Segmented, Stat } from '../../components/ui'
import { usePlayer } from '../../lib/hooks'
import { fmtUsd } from '../../sim/math'
import { PRICING } from '../../sim/scenario'
import { EVAL_CASES, passes, type RunOut, type Scores } from './data'

const CRITERIA: (keyof Scores)[] = ['correctitud', 'herramientas', 'fundamentacion', 'tono']
const JUDGE_IN = 1850
const JUDGE_OUT = 140

function Dots({ n }: { n: number }) {
  return (
    <span className="observabilidad-dots" data-score={n}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? 'on' : ''} />
      ))}
    </span>
  )
}

export function EvalLab() {
  const [ver, setVer] = useState<'v1' | 'v2'>('v1')
  const player = usePlayer(EVAL_CASES.length + 1, { interval: 1500 })
  const k = player.step // casos evaluados
  const done = EVAL_CASES.slice(0, k)
  const run = (c: (typeof EVAL_CASES)[number]): RunOut => c[ver]
  const passed = done.filter((c) => passes(run(c))).length
  const traj = done.filter((c) => run(c).traj).length
  const avg = (crit: keyof Scores) => (done.length ? done.reduce((a, c) => a + run(c).judge[crit], 0) / done.length : 0)
  const cur = k > 0 ? EVAL_CASES[k - 1] : null
  const finished = k === EVAL_CASES.length
  const regressions = ver === 'v2' ? done.filter((c) => passes(c.v1) && !passes(c.v2)) : []
  const fixes = ver === 'v2' ? done.filter((c) => !passes(c.v1) && passes(c.v2)) : []
  const judgeCost = (done.length * (JUDGE_IN * PRICING.inputPerM + JUDGE_OUT * PRICING.outputPerM)) / 1e6

  return (
    <Lab title="Suite de evaluación: 8 casos, código + juez LLM" hint="Pulsa ▶ para correr la suite">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <Segmented
          options={[
            { value: 'v1', label: 'v1 · en producción' },
            { value: 'v2', label: 'v2 · prompt nuevo (PR)' },
          ]}
          value={ver}
          onChange={(v) => {
            setVer(v)
            player.reset()
          }}
        />
        {ver === 'v2' && <span className="small muted">v2 agrega: "consulta siempre la política" y "confirma antes de modificar datos"</span>}
      </div>
      <PlayerBar player={player} labels={['inicio', ...EVAL_CASES.map((c) => `caso ${c.id}`)]} />

      <div className="observabilidad-eval">
        <div className="table-wrap" style={{ margin: 0 }}>
          <table className="tbl observabilidad-eval-tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Pregunta</th>
                <th>Trayect.</th>
                <th>Juez</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {EVAL_CASES.map((c, i) => {
                const r = run(c)
                const state = i < k ? 'done' : i === k && player.playing ? 'running' : 'pending'
                const ok = passes(r)
                const reg = regressions.includes(c)
                return (
                  <tr key={c.id} className={cur?.id === c.id ? 'is-hl' : ''} onClick={() => player.goTo(i + 1)} style={{ cursor: 'pointer' }}>
                    <td className="num">{c.id}</td>
                    <td className="observabilidad-eval-q">{c.q}</td>
                    <td>{state === 'done' ? r.traj ? <CheckCircle2 size={15} className="observabilidad-ok" /> : <XCircle size={15} className="observabilidad-bad" /> : <Circle size={13} className="muted" />}</td>
                    <td className="mono small">{state === 'done' ? CRITERIA.map((cr) => r.judge[cr]).join('·') : '—'}</td>
                    <td>
                      {state === 'running' ? (
                        <Loader2 size={15} className="observabilidad-spin" />
                      ) : state === 'done' ? (
                        <span className="row" style={{ gap: 4 }}>
                          <Pill tone={ok ? 'ok' : 'error'} mono>
                            {ok ? 'pasa' : 'falla'}
                          </Pill>
                          {reg && (
                            <Pill tone="guard" mono>
                              regresión
                            </Pill>
                          )}
                        </span>
                      ) : (
                        <span className="muted small">pendiente</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="stack" style={{ gap: 10 }}>
          {cur ? (
            <Panel title={`caso ${cur.id}`} tone="user" right={<Pill tone={passes(run(cur)) ? 'ok' : 'error'} mono>{passes(run(cur)) ? 'pasa' : 'falla'}</Pill>}>
              <div className="stack anim-fade" key={`${ver}-${cur.id}`} style={{ gap: 8 }}>
                <div className="small">
                  <span className="label">esperado</span> {cur.expected}
                </div>
                <div className="row" style={{ gap: 5 }}>
                  <span className="label">trayectoria</span>
                  {run(cur).tools.length ? (
                    run(cur).tools.map((t) => (
                      <Pill key={t} tone="tool" mono>
                        {t}
                      </Pill>
                    ))
                  ) : (
                    <Pill tone="system" mono>
                      sin herramientas
                    </Pill>
                  )}
                </div>
                <div className={`observabilidad-grader small${run(cur).traj ? ' is-ok' : ' is-bad'}`}>
                  <strong>grader de código:</strong> {run(cur).trajNote}
                </div>
                <div className="observabilidad-answer">{run(cur).answer}</div>
                <div className="label">juez LLM</div>
                <div className="observabilidad-judge">
                  <div className="small">
                    <em>"{run(cur).judge.justificacion}"</em>
                  </div>
                  {CRITERIA.map((cr) => (
                    <div key={cr} className="row small" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <span className="mono">{cr}</span>
                      <Dots n={run(cur).judge[cr]} />
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          ) : (
            <Panel title="cómo se califica" tone="system">
              <ul className="small observabilidad-ul">
                <li>
                  <strong>Grader de código</strong> (determinista): ¿llamó las herramientas esperadas, con los argumentos clave, y ninguna prohibida?
                </li>
                <li>
                  <strong>Juez LLM</strong> con rúbrica 1–3: correctitud, uso de herramientas, fundamentación, tono.
                </li>
                <li>
                  Un caso <strong>pasa</strong> si la trayectoria es válida, correctitud = 3 y ningún criterio queda en 1.
                </li>
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <div className="observabilidad-eval-metrics">
        <Stat label="tasa de éxito" value={done.length ? `${passed}/${done.length}` : '—'} tone={passed === done.length ? 'ok' : 'guard'} sub={done.length ? `${Math.round((passed / done.length) * 100)}%` : undefined} />
        <Stat label="trayectoria válida" value={done.length ? `${traj}/${done.length}` : '—'} tone="tool" sub="grader de código" />
        <Stat label="costo del juez" value={fmtUsd(judgeCost)} tone="guard" sub={`~${JUDGE_IN} tok in por caso`} />
        <div className="observabilidad-crit">
          {CRITERIA.map((cr) => (
            <BarRow key={cr} label={cr} value={avg(cr)} max={3} display={done.length ? avg(cr).toFixed(2) : '—'} tone="model" />
          ))}
        </div>
      </div>

      {ver === 'v2' && finished && (
        <div className="observabilidad-gate anim-in" data-tone={regressions.length ? 'error' : 'ok'}>
          {regressions.length ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
          <div>
            <div className="observabilidad-gate-title">{regressions.length ? 'Gate de CI: PR bloqueado' : 'Gate de CI: aprobado'}</div>
            <div className="small">
              v2 sube de 5/8 a {passed}/8 (arregla {fixes.map((f) => `#${f.id}`).join(', ')}), pero el caso{' '}
              {regressions.map((r) => `#${r.id}`).join(', ')} pasaba en v1 y ahora falla. Un umbral global ("≥ 80%") lo dejaría pasar; comparar caso por caso, no. Toca
              decidir: ¿es una regresión real o hay que actualizar lo esperado?
            </div>
          </div>
        </div>
      )}
      {ver === 'v1' && finished && (
        <p className="small muted" style={{ margin: '12px 0 0' }}>
          v1 falla 3 casos: responde de memoria (#4), inventa un argumento (#6) y elige mal la prioridad (#8). Cambia a v2 para ver si el prompt nuevo los arregla
          sin romper nada.
        </p>
      )}
      <details className="observabilidad-details">
        <summary>Ver el caso como entrada del dataset (JSON)</summary>
        <Code code={JSON.stringify(cur ?? EVAL_CASES[0], (key, v) => (key === 'v1' || key === 'v2' ? undefined : v), 2)} lang="json" />
      </details>
    </Lab>
  )
}
