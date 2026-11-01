import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Repeat, Scissors } from 'lucide-react'
import { Code } from '../../components/Code'
import { Lab, Pill, Segmented, Slider, Stat } from '../../components/ui'
import { fmtInt, fmtUsd } from '../../sim/math'
import { PRICING } from '../../sim/scenario'

/* Guardrails del loop: límite de iteraciones y detector de repetición.
   Los "planes" son lo que haría el modelo en cada iteración (simulado). */

type Call = { tool?: string; args?: string; ok?: boolean; result?: string; input: number; output: number; llm: number; toolMs?: number }

const PLAN_OK: Call[] = [
  { tool: 'buscar_pedido', args: '{"pedido_id":"4821"}', ok: true, result: 'en_ruta', input: 1248, output: 74, llm: 1420, toolMs: 132 },
  { tool: 'cambiar_direccion', args: '{"pedido_id":"4821",…}', ok: false, result: 'pedido_ya_despachado', input: 1530, output: 88, llm: 1430, toolMs: 118 },
  { input: 1702, output: 171, llm: 2865 },
]

const TIMEOUT = 'timeout (10 s)'
const PLAN_FAIL: Call[] = [
  { tool: 'buscar_pedido', args: '{"pedido_id":"4821"}', ok: false, result: TIMEOUT, input: 1248, output: 74, llm: 1420, toolMs: 10000 },
  { tool: 'buscar_pedido', args: '{"pedido_id":"4821"}', ok: false, result: TIMEOUT, input: 1371, output: 61, llm: 1180, toolMs: 10000 },
  { tool: 'buscar_pedido', args: '{"pedido_id":"4821"}', ok: false, result: TIMEOUT, input: 1481, output: 61, llm: 1190, toolMs: 10000 },
  { tool: 'buscar_pedido', args: '{"pedido_id":"4821"}', ok: false, result: TIMEOUT, input: 1591, output: 63, llm: 1200, toolMs: 10000 },
  { tool: 'cambiar_direccion', args: '{"pedido_id":"4821",…}', ok: false, result: TIMEOUT, input: 1703, output: 95, llm: 1500, toolMs: 10000 },
  { tool: 'crear_ticket', args: '{"prioridad":"media",…}', ok: true, result: 'TK-20931', input: 1851, output: 112, llm: 1650, toolMs: 160 },
  { input: 1998, output: 158, llm: 2700 },
]

type Iter = Call & { n: number; status: 'tool-ok' | 'tool-err' | 'final' | 'blocked' }
type End = 'ok' | 'max' | 'repeat'

function simulate(maxIter: number, failing: boolean, repeatGuard: boolean): { iters: Iter[]; end: End } {
  const plan = failing ? PLAN_FAIL : PLAN_OK
  const iters: Iter[] = []
  for (let i = 0; i < plan.length; i++) {
    if (i >= maxIter) return { iters, end: 'max' }
    const c = plan[i]
    if (!c.tool) {
      iters.push({ ...c, n: i + 1, status: 'final' })
      return { iters, end: 'ok' }
    }
    const prev = iters.slice(-2)
    if (repeatGuard && prev.length === 2 && prev.every((p) => p.tool === c.tool && p.args === c.args)) {
      iters.push({ ...c, n: i + 1, status: 'blocked', toolMs: 0 })
      return { iters, end: 'repeat' }
    }
    iters.push({ ...c, n: i + 1, status: c.ok ? 'tool-ok' : 'tool-err' })
  }
  return { iters, end: 'max' }
}

const cost = (c: Call) => (c.input * PRICING.inputPerM + c.output * PRICING.outputPerM) / 1e6

const GUARD_CODE = `MAX_ITER = 8

for i in range(MAX_ITER):
    resp = client.messages.create(model=MODEL, max_tokens=1024,
                                  system=SYSTEM, tools=TOOLS, messages=messages)
    messages.append({"role": "assistant", "content": resp.content})
    if resp.stop_reason != "tool_use":
        return texto_final(resp)

    llamadas = [(b.name, json.dumps(b.input, sort_keys=True))
                for b in resp.content if b.type == "tool_use"]
    historial.extend(llamadas)
    if se_repite(historial, veces=3):        # mismo nombre + mismos args
        log.warning("loop repetitivo", extra={"llamadas": llamadas})
        return RESPUESTA_DE_RESPALDO

    messages.append({"role": "user", "content": ejecutar(resp.content)})

log.warning("max_iterations alcanzado")      # el for terminó sin end_turn
return RESPUESTA_DE_RESPALDO`

function TokenChart({ iters, maxIter }: { iters: Iter[]; maxIter: number }) {
  const W = 560
  const H = 190
  const pad = { l: 44, r: 52, t: 14, b: 26 }
  const slots = Math.max(maxIter, iters.length, 3)
  const bw = Math.min(46, ((W - pad.l - pad.r) / slots) * 0.62)
  const step = (W - pad.l - pad.r) / slots
  const yMax = 2400
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / yMax)
  let acc = 0
  const cum = iters.map((c) => (acc += cost(c)))
  const cMax = 0.03
  const yc = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - Math.min(v, cMax) / cMax)
  const line = cum.map((v, i) => `${pad.l + step * i + step / 2},${yc(v)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="loop-agente-chart" role="img" aria-label="Tokens de entrada y salida por iteración, y costo acumulado">
      {[0, 800, 1600, 2400].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="ax">
            {v === 0 ? '0' : `${v / 1000}k`}
          </text>
        </g>
      ))}
      {[0, 0.01, 0.02, 0.03].map((v) => (
        <text key={v} x={W - pad.r + 6} y={yc(v) + 4} className="ax ax-cost">
          {v === 0 ? '$0' : `$${v.toFixed(2)}`}
        </text>
      ))}
      {Array.from({ length: slots }, (_, i) => {
        const it = iters[i]
        const x = pad.l + step * i + (step - bw) / 2
        const over = i >= maxIter
        return (
          <g key={i}>
            {it ? (
              <g className="loop-agente-chart-bar" style={{ animationDelay: `${i * 70}ms` }}>
                <rect x={x} y={y(it.input)} width={bw} height={y(0) - y(it.input)} className="in" rx={3} />
                <rect x={x} y={y(it.input + it.output)} width={bw} height={y(it.input) - y(it.input + it.output)} className="out" rx={2} />
              </g>
            ) : (
              <rect x={x} y={y(400)} width={bw} height={y(0) - y(400)} className={over ? 'ghost-over' : 'ghost'} rx={3} />
            )}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="ax">
              {i + 1}
            </text>
          </g>
        )
      })}
      {iters.length > 0 && <polyline points={line} className="cost" />}
      {cum.map((v, i) => (
        <circle key={i} cx={pad.l + step * i + step / 2} cy={yc(v)} r={3.5} className="cost-dot" />
      ))}
      {maxIter < slots && (
        <line x1={pad.l + step * maxIter} x2={pad.l + step * maxIter} y1={pad.t - 4} y2={H - pad.b} className="limit" />
      )}
    </svg>
  )
}

export function GuardLab() {
  const [maxIter, setMaxIter] = useState(5)
  const [failing, setFailing] = useState<'ok' | 'fail'>('fail')
  const [guard, setGuard] = useState<'off' | 'on'>('off')
  const { iters, end } = simulate(maxIter, failing === 'fail', guard === 'on')
  const tin = iters.reduce((a, c) => a + c.input, 0)
  const tout = iters.reduce((a, c) => a + c.output, 0)
  const total = iters.reduce((a, c) => a + cost(c), 0)
  const ms = iters.reduce((a, c) => a + c.llm + (c.toolMs ?? 0), 0)
  const key = `${maxIter}-${failing}-${guard}`

  const endInfo = {
    ok: {
      tone: 'ok',
      Icon: CheckCircle2,
      title: 'end_turn: el modelo terminó solo',
      text:
        failing === 'fail'
          ? 'Tras varios timeouts el modelo se rindió, creó un ticket y respondió. Funcionó… pero gastó 7 llamadas y más de 50 s esperando timeouts.'
          : 'Ejecución normal: 3 iteraciones, el límite nunca se tocó.',
    },
    max: {
      tone: 'guard',
      Icon: Scissors,
      title: `Cortado por max_iterations (${maxIter})`,
      text: 'El harness detuvo el loop sin que el modelo terminara. Devuelves una respuesta de respaldo, registras el incidente y, si corresponde, escalas a un humano.',
    },
    repeat: {
      tone: 'guard',
      Icon: Repeat,
      title: 'Cortado por el detector de repetición',
      text: 'La tercera llamada idéntica (mismo nombre, mismos argumentos) se bloqueó antes de ejecutarse. Ahorra iteraciones inútiles sin bajar el límite general.',
    },
  }[end]

  return (
    <Lab title="Límites del loop" hint="Cambia el límite y rompe la herramienta">
      <div className="loop-agente-controls">
        <Slider label="max_iterations" value={maxIter} min={1} max={10} onChange={setMaxIter} />
        <div className="stack" style={{ gap: 4 }}>
          <span className="label">buscar_pedido</span>
          <Segmented
            options={[
              { value: 'ok', label: 'funciona' },
              { value: 'fail', label: 'siempre falla' },
            ]}
            value={failing}
            onChange={setFailing}
          />
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <span className="label">detector de repetición</span>
          <Segmented
            options={[
              { value: 'off', label: 'apagado' },
              { value: 'on', label: '3 iguales → cortar' },
            ]}
            value={guard}
            onChange={setGuard}
          />
        </div>
      </div>

      <div className="loop-agente-iters" key={key}>
        {iters.map((it, i) => (
          <div key={i} className="loop-agente-iter anim-in" data-tone={it.status === 'final' ? 'ok' : it.status === 'tool-ok' ? 'tool' : it.status === 'blocked' ? 'guard' : 'error'} style={{ animationDelay: `${i * 70}ms` }}>
            <div className="loop-agente-iter-n">iter {it.n}</div>
            <div className="mono loop-agente-iter-what">{it.status === 'final' ? 'end_turn' : it.tool}</div>
            <div className="small muted">
              {it.status === 'final' ? 'respuesta' : it.status === 'blocked' ? 'bloqueada' : it.ok ? it.result : `✗ ${it.result}`}
            </div>
            <div className="mono loop-agente-iter-tok">{fmtInt(it.input)} tok in</div>
          </div>
        ))}
        {end !== 'ok' && (
          <div className="loop-agente-iter is-cut anim-in" data-tone="guard" style={{ animationDelay: `${iters.length * 70}ms` }}>
            <AlertTriangle size={18} />
            <div className="small">{end === 'max' ? 'límite' : 'repetición'}</div>
          </div>
        )}
      </div>

      <div className="loop-agente-guard-grid">
        <div>
          <div className="label" style={{ marginBottom: 4 }}>
            tokens por llamada <span className="loop-agente-key in" /> entrada <span className="loop-agente-key out" /> salida <span className="loop-agente-key cost" /> costo acumulado
          </div>
          <TokenChart iters={iters} maxIter={maxIter} />
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <div className="loop-agente-end" data-tone={endInfo.tone}>
            <endInfo.Icon size={18} />
            <div>
              <div className="loop-agente-end-title">{endInfo.title}</div>
              <div className="small">{endInfo.text}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Stat label="llamadas" value={iters.length} tone="model" />
            <Stat label="tokens" value={fmtInt(tin + tout)} tone="model" sub={`${fmtInt(tin)} in · ${fmtInt(tout)} out`} />
            <Stat label="costo" value={fmtUsd(total)} tone="guard" />
            <Stat label="tiempo" value={`${(ms / 1000).toFixed(1)} s`} tone="system" />
          </div>
        </div>
      </div>
      <p className="small muted" style={{ margin: '10px 0 0' }}>
        Cada barra es más alta que la anterior aunque cada iteración agrega poco: <strong>cada llamada reenvía todo el historial</strong>. Un loop sin freno no solo
        tarda: paga una y otra vez por los mismos tokens. <Pill tone="guard" mono>precios de referencia</Pill>
      </p>
      <details className="loop-agente-details">
        <summary>Ver el loop con guardrails (Python)</summary>
        <Code code={GUARD_CODE} lang="python" highlight={[1, 3, 13, 14, 15, 19, 20]} />
      </details>
    </Lab>
  )
}
