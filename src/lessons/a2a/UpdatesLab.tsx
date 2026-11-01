import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Lab, Segmented, Slider } from '../../components/ui'
import { Code } from '../../components/Code'

const EVENTS = [
  { t: 0, label: 'SUBMITTED' },
  { t: 1.2, label: 'WORKING' },
  { t: 5, label: 'artefacto parcial' },
  { t: 8.4, label: 'COMPLETED' },
]
const T = 10
const END = 8.4
const X0 = 170
const X1 = 880
const x = (t: number) => X0 + (t / T) * (X1 - X0)
const LANE = { task: 46, poll: 120, stream: 190, push: 258 }

function polls(p: number) {
  const out: { t: number; hit: boolean }[] = []
  let prev = -1
  for (let t = 0; t <= END + p + 1e-9; t += p) {
    const hit = EVENTS.some((e) => e.t > prev && e.t <= t + 1e-9)
    out.push({ t: Number(t.toFixed(3)), hit })
    prev = t
    if (t >= END) break
  }
  return out
}

const SSE = `HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"jsonrpc":"2.0","id":"req-9","result":{"task":{"id":"tsk-7f3a9c","status":{"state":"TASK_STATE_SUBMITTED"}}}}

data: {"jsonrpc":"2.0","id":"req-9","result":{"statusUpdate":{"taskId":"tsk-7f3a9c","status":{"state":"TASK_STATE_WORKING"}}}}

data: {"jsonrpc":"2.0","id":"req-9","result":{"artifactUpdate":{"taskId":"tsk-7f3a9c","artifact":{"artifactId":"art-01","parts":[{"text":"Cupo reservado…"}]}}}}

data: {"jsonrpc":"2.0","id":"req-9","result":{"statusUpdate":{"taskId":"tsk-7f3a9c","status":{"state":"TASK_STATE_COMPLETED"}}}}`

export function UpdatesLab() {
  const [unit, setUnit] = useState<'s' | 'h'>('s')
  const [p, setP] = useState(2)
  const [t, setT] = useState(T)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)

  useEffect(() => {
    if (!playing) return
    let start = 0
    const from = t >= T ? 0 : t
    const tick = (now: number) => {
      if (!start) start = now
      const nt = from + ((now - start) / 7000) * T
      if (nt >= T) {
        setT(T)
        setPlaying(false)
        return
      }
      setT(nt)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  const ps = polls(p)
  const detect = (et: number) => ps.find((q) => q.t + 1e-9 >= et)?.t ?? et
  const delays = EVENTS.slice(1).map((e) => detect(e.t) - e.t)
  const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length
  const u = unit === 's' ? 's' : 'h'
  const fmt = (v: number) => `${v.toFixed(1).replace('.', ',')} ${u}`
  const long = unit === 'h'

  return (
    <Lab
      title="¿Cómo se entera el cliente? Polling, streaming y push"
      hint="Reproduce y mueve el intervalo"
      footer={<span className="small muted">Misma tarea en las tres filas. Tiempos de red despreciables; la escala de horas ilustra una tarea larga (aprobaciones, retiros).</span>}
    >
      <div className="row" style={{ marginBottom: 10, gap: 16 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            if (t >= T) setT(0)
            setPlaying((v) => !v)
          }}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pausar' : 'Reproducir'}
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            setPlaying(false)
            setT(0)
          }}
        >
          <RotateCcw size={14} /> Reiniciar
        </button>
        <Segmented
          options={[
            { value: 's', label: 'tarea de segundos' },
            { value: 'h', label: 'tarea de horas' },
          ]}
          value={unit}
          onChange={setUnit}
        />
        <Slider label="Intervalo de polling" value={p} min={0.5} max={3} step={0.5} onChange={setP} format={(v) => fmt(v)} style={{ flex: '1 1 200px' }} />
      </div>
      <div className="a2a-upd-wrap">
        <svg className="a2a-upd" viewBox="0 0 900 290" role="img" aria-label="Comparación temporal de polling, streaming y push notifications">
          {(
            [
              ['task', 'Tarea en RutaSur', 'tool'],
              ['poll', 'Polling · GetTask', 'model'],
              ['stream', 'Streaming · SSE', 'model'],
              ['push', 'Push · webhook', 'model'],
            ] as const
          ).map(([k, label, tone]) => (
            <g key={k} data-tone={tone}>
              <text x={12} y={LANE[k] + 4} className="a2a-upd-lane">
                {label}
              </text>
              <line x1={X0} x2={X1} y1={LANE[k]} y2={LANE[k]} className="a2a-upd-axis" />
            </g>
          ))}
          {/* eventos de la tarea */}
          {EVENTS.map((e) => (
            <g key={e.label} className={`a2a-upd-ev${t >= e.t ? ' is-on' : ''}`}>
              <rect x={x(e.t) - 6} y={LANE.task - 6} width={12} height={12} transform={`rotate(45 ${x(e.t)} ${LANE.task})`} />
              <text x={x(e.t)} y={LANE.task - 14} textAnchor="middle">
                {e.label}
              </text>
              <line x1={x(e.t)} x2={x(e.t)} y1={LANE.task + 8} y2={LANE.push} className="a2a-upd-guide" />
            </g>
          ))}
          {/* polling */}
          {EVENTS.slice(1).map((e) => {
            const d = detect(e.t)
            return t >= e.t ? <rect key={e.label} x={x(e.t)} y={LANE.poll - 4} width={Math.max(0, x(Math.min(d, t)) - x(e.t))} height={8} rx={3} className="a2a-upd-lag" /> : null
          })}
          {ps.map((q, i) =>
            t >= q.t ? (
              <g key={i} className={`a2a-upd-poll${q.hit ? ' is-hit' : ''}`}>
                <line x1={x(q.t)} x2={x(q.t)} y1={LANE.poll + 14} y2={LANE.poll - 12} />
                <circle cx={x(q.t)} cy={LANE.poll} r={4.5} />
              </g>
            ) : null,
          )}
          {/* streaming */}
          <rect x={X0} y={LANE.stream - 5} width={Math.max(0, x(Math.min(t, END)) - X0)} height={10} rx={5} className={`a2a-upd-conn${long ? ' is-long' : ''}`} />
          {EVENTS.map((e) => (t >= e.t ? <circle key={e.label} cx={x(e.t)} cy={LANE.stream} r={5.5} className="a2a-upd-dot" /> : null))}
          {/* push */}
          <line x1={X0} x2={x(Math.min(t, END))} y1={LANE.push} y2={LANE.push} className="a2a-upd-idle" />
          {EVENTS.map((e) =>
            t >= e.t ? (
              <g key={e.label} className="a2a-upd-hook">
                <path d={`M${x(e.t)},${LANE.push - 18} L${x(e.t)},${LANE.push - 4}`} />
                <polygon points={`${x(e.t)},${LANE.push - 1} ${x(e.t) - 4},${LANE.push - 8} ${x(e.t) + 4},${LANE.push - 8}`} />
              </g>
            ) : null,
          )}
          <line x1={x(t)} x2={x(t)} y1={18} y2={278} className="a2a-upd-head" />
          <text x={x(t)} y={286} textAnchor="middle" className="a2a-upd-time">
            {fmt(t)}
          </text>
        </svg>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Mecanismo</th>
              <th>Requests del cliente</th>
              <th>Retraso medio</th>
              <th>Conexión abierta</th>
              <th>Cuándo conviene</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Polling</strong> <span className="mono small">GetTask</span>
              </td>
              <td className="num">{ps.length + 1}</td>
              <td className="num">{fmt(avgDelay)}</td>
              <td className="num">0</td>
              <td>Simple y robusto; pagas en requests o en retraso.</td>
            </tr>
            <tr className={!long ? 'is-hl' : ''}>
              <td>
                <strong>Streaming</strong> <span className="mono small">SendStreamingMessage</span>
              </td>
              <td className="num">1</td>
              <td className="num">≈ 0</td>
              <td className="num" style={{ color: long ? 'var(--c-error)' : undefined }}>
                {fmt(END)}
              </td>
              <td>{long ? 'Mantener un stream horas es frágil (proxies, timeouts, despliegues).' : 'Tareas de segundos o minutos con UI que muestra progreso.'}</td>
            </tr>
            <tr className={long ? 'is-hl' : ''}>
              <td>
                <strong>Push</strong> <span className="mono small">webhook</span>
              </td>
              <td className="num">1 + {EVENTS.length - 1} avisos</td>
              <td className="num">≈ 0</td>
              <td className="num">0</td>
              <td>Tareas de horas o días. Necesitas un endpoint HTTPS y validar cada aviso.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Code code={SSE} lang="http" title="Streaming: lo que recibe Andi por SSE (v1.0, simplificado)" maxHeight={240} />
    </Lab>
  )
}
