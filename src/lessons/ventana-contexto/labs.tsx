import { useState } from 'react'
import { BarRow, Lab, Panel, Pill, Segmented, Stat, toneVar, type Tone } from '../../components/ui'
import { Code } from '../../components/Code'
import { MessageList } from '../../components/Messages'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { fmtInt, fmtUsd, pct } from '../../sim/math'
import { PRICING } from '../../sim/scenario'
import { CALLS, LONG, MAX_TOKENS, STATS, SYSTEM_TOK, TOOLS_TOK, longTok, requestCode, type Fact, type LongMsg } from './data'

/* -------------------------------------------------------------------------- */
/* Barra apilada de la ventana de contexto                                     */
/* -------------------------------------------------------------------------- */

type Seg = { key: string; label: string; value: number; tone: Tone; striped?: boolean; ghost?: boolean }

function CtxBar({ segs, scale, caption }: { segs: Seg[]; scale: number; caption?: string }) {
  const used = segs.reduce((s, x) => s + x.value, 0)
  return (
    <div className="ventana-contexto-bar-wrap">
      <div className="ventana-contexto-bar" role="img" aria-label={`Ventana de contexto: ${segs.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
        {segs.map((s) =>
          s.value > 0 ? (
            <span
              key={s.key}
              className={`ventana-contexto-seg${s.striped ? ' is-striped' : ''}${s.ghost ? ' is-ghost' : ''}`}
              style={{ width: `${(s.value / scale) * 100}%`, ['--tone' as string]: toneVar(s.tone) }}
              title={`${s.label}: ${fmtInt(s.value)} tokens`}
            />
          ) : null,
        )}
      </div>
      <div className="ventana-contexto-bar-legend small">
        {segs.map((s) => (
          <span key={s.key} className="ventana-contexto-leg">
            <i className={s.striped ? 'is-striped' : s.ghost ? 'is-ghost' : ''} style={{ ['--tone' as string]: toneVar(s.tone) }} />
            {s.label} <b className="mono">{fmtInt(s.value)}</b>
          </span>
        ))}
        <span className="ventana-contexto-leg muted" style={{ marginLeft: 'auto' }}>
          {caption ?? `${fmtInt(used)} / ${fmtInt(scale)}`}
        </span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Lab 1 · Cada turno reenvía todo                                             */
/* -------------------------------------------------------------------------- */

const ZOOM = 2000
const PROJ_N = 20

function GrowthChart({ upto }: { upto: number }) {
  // datos reales (6 llamadas) + proyección lineal del input por llamada
  const real = STATS.map((s) => s.input)
  const slope = (real[real.length - 1] - real[0]) / (real.length - 1)
  const per = Array.from({ length: PROJ_N }, (_, i) => (i < real.length ? real[i] : real[real.length - 1] + slope * (i - real.length + 1)))
  const cum: number[] = []
  per.reduce((acc, x, i) => (cum[i] = acc + x), 0)
  const W = 560
  const H = 210
  const L = 46
  const R = 92
  const T = 14
  const B = 28
  const maxY = cum[cum.length - 1]
  const x = (i: number) => L + (i / (PROJ_N - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - v / maxY) * (H - T - B)
  const path = (arr: number[], from: number, to: number) =>
    arr
      .slice(from, to + 1)
      .map((v, j) => `${j ? 'L' : 'M'}${x(from + j).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ')
  const last = real.length - 1
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round((maxY * t) / 1000) * 1000)
  return (
    <svg className="ventana-contexto-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tokens de entrada por llamada versus acumulado facturado">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="ventana-contexto-grid" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" className="ventana-contexto-axis">
            {t >= 1000 ? `${t / 1000}k` : t}
          </text>
        </g>
      ))}
      {[1, 6, 10, 15, 20].map((n) => (
        <text key={n} x={x(n - 1)} y={H - 8} textAnchor="middle" className="ventana-contexto-axis">
          {n}
        </text>
      ))}
      <text x={W - R + 4} y={H - 8} className="ventana-contexto-axis">
        llamada
      </text>
      {/* proyección punteada */}
      <path d={path(cum, last, PROJ_N - 1)} className="ventana-contexto-line is-proj" style={{ stroke: toneVar('tool') }} />
      <path d={path(per, last, PROJ_N - 1)} className="ventana-contexto-line is-proj" style={{ stroke: toneVar('model') }} />
      {/* real hasta la llamada actual */}
      <path d={path(cum, 0, upto)} className="ventana-contexto-line" style={{ stroke: toneVar('tool') }} />
      <path d={path(per, 0, upto)} className="ventana-contexto-line" style={{ stroke: toneVar('model') }} />
      {real.map((_, i) => (
        <g key={i} opacity={i <= upto ? 1 : 0.25}>
          <circle cx={x(i)} cy={y(cum[i])} r={i === upto ? 5 : 3} fill={toneVar('tool')} />
          <circle cx={x(i)} cy={y(per[i])} r={i === upto ? 5 : 3} fill={toneVar('model')} />
        </g>
      ))}
      <text x={x(PROJ_N - 1) + 6} y={y(cum[PROJ_N - 1]) + 4} className="ventana-contexto-lbl" style={{ fill: toneVar('tool') }}>
        acumulado
      </text>
      <text x={x(PROJ_N - 1) + 6} y={y(cum[PROJ_N - 1]) + 18} className="ventana-contexto-axis">
        {fmtInt(cum[PROJ_N - 1])}
      </text>
      <text x={x(PROJ_N - 1) + 6} y={y(per[PROJ_N - 1]) - 4} className="ventana-contexto-lbl" style={{ fill: toneVar('model') }}>
        por llamada
      </text>
      <text x={x(PROJ_N - 1) + 6} y={y(per[PROJ_N - 1]) + 10} className="ventana-contexto-axis">
        {fmtInt(per[PROJ_N - 1])}
      </text>
      <text x={x(last) + 4} y={T + 8} className="ventana-contexto-axis">
        ← real · proyección →
      </text>
      <line x1={x(last)} x2={x(last)} y1={T} y2={H - B} className="ventana-contexto-grid" strokeDasharray="3 3" />
    </svg>
  )
}

export function StatelessLab() {
  const player = usePlayer(CALLS.length, { interval: 3200 })
  const k = player.step
  const c = CALLS[k]
  const s = STATS[k]
  const cum = STATS.slice(0, k + 1).reduce((a, x) => a + x.input, 0)
  const { code, add } = requestCode(c)
  const shown = [...c.messages, { ...c.response, note: `respuesta de la llamada ${k + 1}` }]

  const steps: StepInfo[] = CALLS.map((cc, i) => ({
    title: `Llamada ${i + 1}: ${fmtInt(STATS[i].input)} tokens de entrada`,
    body: cc.what,
  }))

  return (
    <Lab title="Seis llamadas de una conversación con Andi" hint="Avanza llamada por llamada" badge="Lab animado">
      <div className="stack">
        <PlayerBar player={player} labels={steps.map((x) => x.title)} />
        <div className="ventana-contexto-stats">
          <Stat label="llamada" value={`${k + 1} / ${CALLS.length}`} />
          <Stat label="entrada (esta llamada)" value={fmtInt(s.input)} tone="model" sub={`${c.messages.length} mensajes`} />
          <Stat label="entrada acumulada" value={fmtInt(cum)} tone="tool" sub={`= ${fmtUsd((cum * PRICING.inputPerM) / 1e6)}`} />
          <Stat label="salida" value={fmtInt(s.output)} sub="tokens generados" />
        </div>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>
            Composición de la ventana (zoom a {fmtInt(ZOOM)} tokens)
          </div>
          <CtxBar
            scale={ZOOM}
            segs={[
              { key: 's', label: 'system', value: s.system, tone: 'system' },
              { key: 't', label: 'tools', value: s.tools, tone: 'tool' },
              { key: 'h', label: 'historial', value: s.history, tone: 'memory' },
              { key: 'n', label: 'nuevo', value: s.fresh, tone: 'user' },
              { key: 'r', label: 'reservado salida (max_tokens)', value: MAX_TOKENS, tone: 'guard', striped: true },
            ]}
          />
        </div>
        <div className="split">
          <Code code={code} lang="json" title={`POST /v1/messages · llamada ${k + 1}`} add={add} highlight={add} maxHeight={360} />
          <Panel title="messages + respuesta" tone="model" right={<span className="mono small">verde = nuevo</span>}>
            <MessageList messages={shown} newFrom={shown.length - 1 - c.fresh} highlight={[shown.length - 1]} showTokens maxHeight={330} />
          </Panel>
        </div>
        <Panel title="Tokens de entrada: por llamada vs. acumulado" tone="tool">
          <GrowthChart upto={k} />
          <div className="small muted">
            Cada llamada paga todo el historial otra vez. El tamaño de cada llamada crece en línea recta; lo que pagas en total crece como un
            triángulo (≈ cuadrático en el número de turnos).
          </div>
        </Panel>
        <Narration steps={steps} step={k} />
      </div>
    </Lab>
  )
}

/* -------------------------------------------------------------------------- */
/* Lab 2 · Cuando la ventana se llena                                          */
/* -------------------------------------------------------------------------- */

export const WINDOW = 1200
export const OUT_RESERVE = 400
const FIXED = SYSTEM_TOK + TOOLS_TOK
export const BUDGET = WINDOW - FIXED - OUT_RESERVE
const SLIDE_K = 6
const KEEP_LAST = 4

type Strategy = 'truncar' | 'ventana' | 'resumir'
type Item = { kind: 'msg'; i: number } | { kind: 'sum'; covers: number[]; text: string; tok: number }
type WinState = { ctx: Item[]; dropped: number[]; summarized: number[]; event: string | null; extraCalls: number; overflow: number }

const itemTok = (it: Item) => (it.kind === 'msg' ? longTok(LONG[it.i]) : it.tok)
const isUserText = (it: Item) => it.kind === 'sum' || LONG[it.i].role === 'user'
const roleLabel = (m: LongMsg) => (m.role === 'tool_result' ? 'tool_result' : m.role)

function makeSummary(covers: number[]): Item {
  const parts = [...new Set(covers.map((i) => LONG[i].sum).filter(Boolean))]
  const text = `[Resumen de la conversación anterior] ${parts.join(' ')}`
  return { kind: 'sum', covers, text, tok: Math.max(1, Math.round(text.length / 3.8)) + 4 }
}

function simulate(strategy: Strategy, n: number): WinState {
  let ctx: Item[] = []
  const dropped: number[] = []
  const summarized: number[] = []
  let extraCalls = 0
  let event: string | null = null
  let overflow = 0
  const total = () => ctx.reduce((s, it) => s + itemTok(it), 0)
  for (let j = 0; j < n; j++) {
    ctx.push({ kind: 'msg', i: j })
    event = null
    overflow = Math.max(0, total() - BUDGET)
    if (strategy === 'truncar' && overflow > 0) {
      const gone: number[] = []
      while (total() > BUDGET && ctx.length > 1) gone.push((ctx.shift() as { i: number }).i)
      while (ctx.length > 1 && !isUserText(ctx[0])) gone.push((ctx.shift() as { i: number }).i)
      dropped.push(...gone)
      event = `Se pasó por ${overflow} tokens. Se borran los mensajes ${gone.map((g) => g + 1).join(', ')} (los más antiguos, hasta que el historial vuelva a empezar con un mensaje del usuario).`
    }
    if (strategy === 'ventana' && ctx.length > SLIDE_K + 1) {
      const pinned = ctx[0]
      let rest = ctx.slice(1)
      const gone: number[] = []
      while (rest.length > SLIDE_K || (rest.length && rest[0].kind === 'msg' && LONG[rest[0].i].role === 'tool_result')) {
        gone.push((rest.shift() as { i: number }).i)
      }
      ctx = [pinned, ...rest]
      dropped.push(...gone)
      event = `La ventana se desliza: se queda el primer mensaje (fijado) y los últimos ${rest.length}. Sale: ${gone.map((g) => g + 1).join(', ')}.`
    }
    if (strategy === 'resumir' && overflow > 0) {
      let cut = Math.max(0, ctx.length - KEEP_LAST)
      while (cut < ctx.length - 1 && !isUserText(ctx[cut])) cut++
      const old = ctx.slice(0, cut)
      const covers = old.flatMap((it) => (it.kind === 'msg' ? [it.i] : it.covers))
      summarized.push(...old.flatMap((it) => (it.kind === 'msg' ? [it.i] : [])))
      const sum = makeSummary(covers)
      ctx = [sum, ...ctx.slice(cut)]
      extraCalls++
      event = `Se pasó por ${overflow} tokens. Una llamada extra al modelo resume ${old.length} elementos antiguos en un mensaje de ${(sum as { tok: number }).tok} tokens.`
    }
  }
  return { ctx, dropped, summarized, event, extraCalls, overflow }
}

function factsIn(ctx: Item[]): Set<Fact> {
  const f = new Set<Fact>()
  for (const it of ctx) {
    const idx = it.kind === 'msg' ? [it.i] : it.covers
    idx.forEach((i) => LONG[i].facts.forEach((x) => f.add(x)))
  }
  return f
}

function finalAnswer(f: Set<Fact>): { text: string; tone: Tone; verdict: string } {
  if (f.has('pedido') && f.has('seguimiento'))
    return { text: 'Claro: tu pedido es el 4821 y el código de seguimiento es CX-99812-CL.', tone: 'ok', verdict: 'Recuerda ambos datos' }
  if (f.has('pedido'))
    return {
      text: 'Tu pedido es el 4821. El código de seguimiento no lo tengo a mano; ¿quieres que lo vuelva a consultar?',
      tone: 'guard',
      verdict: 'Recuerda el pedido, perdió el seguimiento',
    }
  return {
    text: 'No veo el número de pedido en nuestra conversación. ¿Me lo puedes indicar?',
    tone: 'error',
    verdict: 'Olvidó todo: esos mensajes ya no se envían',
  }
}

const STRAT_INFO: Record<Strategy, string> = {
  truncar: 'Cuando no cabe, borra desde el principio. Simple, pero lo primero que se dijo suele ser lo más importante.',
  ventana: `Envía siempre el primer mensaje + los últimos ${SLIDE_K}. Costo estable y predecible, aunque sobre espacio.`,
  resumir: `Cuando no cabe, una llamada extra resume lo antiguo y se conservan los últimos ${KEEP_LAST} mensajes tal cual.`,
}

export function OverflowLab() {
  const [strategy, setStrategy] = useState<Strategy>('truncar')
  const player = usePlayer(LONG.length + 1, { interval: (s) => (s >= LONG.length - 1 ? 2600 : 1500) })
  const step = player.step
  const n = Math.min(step + 1, LONG.length)
  const isAnswer = step === LONG.length
  const st = simulate(strategy, n)
  const inCtx = new Set(st.ctx.flatMap((it) => (it.kind === 'msg' ? [it.i] : [])))
  const sum = st.ctx.find((it) => it.kind === 'sum') as Extract<Item, { kind: 'sum' }> | undefined
  const histTok = st.ctx.reduce((s, it) => s + itemTok(it), 0)
  const ans = finalAnswer(factsIn(st.ctx))

  const steps: StepInfo[] = [
    ...LONG.map((m, i) => {
      const s = simulate(strategy, i + 1)
      const h = s.ctx.reduce((a, it) => a + itemTok(it), 0)
      return {
        title: s.event ? `Mensaje ${i + 1}: ¡no cabe!` : `Mensaje ${i + 1} (${roleLabel(m)}, ${longTok(m)} tok)`,
        body: s.event ?? `Cabe: el historial ocupa ${h} de ${BUDGET} tokens disponibles.`,
      }
    }),
    { title: 'La pregunta final', body: `${ans.verdict}. El modelo solo sabe lo que viene en esta llamada.` },
  ]

  return (
    <Lab title="¿Qué pasa cuando se llena?" hint="Elige una estrategia y reproduce" badge="Lab animado">
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Segmented
            value={strategy}
            onChange={setStrategy}
            options={[
              { value: 'truncar', label: 'Truncar antiguos' },
              { value: 'ventana', label: 'Ventana deslizante' },
              { value: 'resumir', label: 'Resumir (compactar)' },
            ]}
          />
          <span className="small muted">{STRAT_INFO[strategy]}</span>
        </div>
        <PlayerBar player={player} labels={steps.map((x) => x.title)} />
        <div>
          <div className="label" style={{ marginBottom: 6 }}>
            Ventana de juguete: {fmtInt(WINDOW)} tokens
          </div>
          <CtxBar
            scale={WINDOW}
            caption={`historial: ${histTok} / ${BUDGET}`}
            segs={[
              { key: 'f', label: 'system + tools', value: FIXED, tone: 'system' },
              ...(sum ? [{ key: 'sum', label: 'resumen', value: sum.tok, tone: 'memory' as Tone }] : []),
              { key: 'h', label: 'mensajes', value: histTok - (sum?.tok ?? 0), tone: 'user' },
              { key: 'free', label: 'libre', value: Math.max(0, BUDGET - histTok), tone: 'system', ghost: true },
              { key: 'r', label: 'reservado salida', value: OUT_RESERVE, tone: 'guard', striped: true },
            ]}
          />
        </div>
        <div className="ventana-contexto-win">
          {sum && (
            <div className="ventana-contexto-row is-summary" data-tone="memory" key={`sum-${sum.covers.length}`}>
              <span className="ventana-contexto-role">resumen</span>
              <span className="ventana-contexto-text">{sum.text}</span>
              <span className="mono small">{sum.tok}</span>
            </div>
          )}
          {LONG.slice(0, n).map((m, i) => {
            const state = inCtx.has(i) ? 'in' : st.summarized.includes(i) ? 'sum' : 'out'
            const tone: Tone = m.role === 'user' ? 'user' : m.role === 'assistant' ? 'model' : 'tool'
            return (
              <div key={i} className={`ventana-contexto-row is-${state}${i === n - 1 && !isAnswer ? ' is-new' : ''}`} data-tone={tone}>
                <span className="ventana-contexto-role">
                  {i + 1}. {roleLabel(m)}
                </span>
                <span className="ventana-contexto-text">{m.text}</span>
                <span className="mono small">
                  {state === 'out' ? '✂ fuera' : state === 'sum' ? '→ resumen' : longTok(m)}
                  {m.facts.length > 0 && <span className="ventana-contexto-fact" title={`contiene: ${m.facts.join(', ')}`}>★</span>}
                </span>
              </div>
            )
          })}
        </div>
        {isAnswer && (
          <div className="ventana-contexto-answer anim-in" data-tone={ans.tone}>
            <div className="label">assistant · respuesta a la pregunta 13</div>
            <div>{ans.text}</div>
            <Pill tone={ans.tone}>{ans.verdict}</Pill>
          </div>
        )}
        <div className="ventana-contexto-stats">
          <Stat label="mensajes enviados" value={`${st.ctx.length}`} sub={`de ${n} en la conversación`} />
          <Stat label="descartados" value={st.dropped.length} tone={st.dropped.length ? 'error' : undefined} />
          <Stat label="resumidos" value={st.summarized.length} tone={st.summarized.length ? 'memory' : undefined} sub={`${st.extraCalls} llamadas extra`} />
        </div>
        <Narration steps={steps} step={step} />
        <div className="small muted">★ = mensaje que contiene el número de pedido o el código de seguimiento.</div>
      </div>
    </Lab>
  )
}

/* -------------------------------------------------------------------------- */
/* Lab 3 · Prompt caching                                                      */
/* -------------------------------------------------------------------------- */

/** Escribir en caché cuesta más que el input normal (≈1,25× en la caché de 5 minutos de Anthropic). */
const CACHE_WRITE_PER_M = PRICING.inputPerM * 1.25

export function CachingLab() {
  const [mode, setMode] = useState<'sin' | 'con'>('con')
  const max = Math.max(...STATS.map((s) => s.input))
  const rows = STATS.map((s, i) => {
    const read = mode === 'con' && i > 0 ? STATS[i - 1].input : 0
    const write = mode === 'con' ? s.input - read : 0
    const plain = mode === 'con' ? 0 : s.input
    const cost = (read * PRICING.cachedInputPerM + write * CACHE_WRITE_PER_M + plain * PRICING.inputPerM) / 1e6
    return { i, input: s.input, read, write, plain, cost }
  })
  const total = rows.reduce((a, r) => a + r.cost, 0)
  const base = STATS.reduce((a, s) => a + (s.input * PRICING.inputPerM) / 1e6, 0)
  return (
    <Lab title="Prefijo cacheado: lo que no cambia, se cobra barato" hint="Compara con y sin caché">
      <div className="stack">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'sin', label: 'Sin caché' },
            { value: 'con', label: 'Con prompt caching' },
          ]}
        />
        <div className="ventana-contexto-cache">
          {rows.map((r) => (
            <div key={r.i} className="ventana-contexto-cache-row">
              <span className="mono small">#{r.i + 1}</span>
              <div className="ventana-contexto-cache-bar" style={{ width: `${(r.input / max) * 100}%` }}>
                {r.read > 0 && <span className="ventana-contexto-seg is-striped" style={{ flex: r.read, ['--tone' as string]: toneVar('data') }} title={`leído de caché: ${r.read}`} />}
                {r.write > 0 && <span className="ventana-contexto-seg" style={{ flex: r.write, ['--tone' as string]: toneVar('tool') }} title={`escrito en caché: ${r.write}`} />}
                {r.plain > 0 && <span className="ventana-contexto-seg" style={{ flex: r.plain, ['--tone' as string]: toneVar('user') }} title={`input normal: ${r.plain}`} />}
              </div>
              <span className="mono small ventana-contexto-cache-cost">{fmtUsd(r.cost)}</span>
            </div>
          ))}
        </div>
        <div className="ventana-contexto-bar-legend small">
          {mode === 'con' ? (
            <>
              <span className="ventana-contexto-leg">
                <i className="is-striped" style={{ ['--tone' as string]: toneVar('data') }} /> leído de caché · US$ {PRICING.cachedInputPerM}/M
              </span>
              <span className="ventana-contexto-leg">
                <i style={{ ['--tone' as string]: toneVar('tool') }} /> nuevo, se escribe en caché · US$ {CACHE_WRITE_PER_M}/M
              </span>
            </>
          ) : (
            <span className="ventana-contexto-leg">
              <i style={{ ['--tone' as string]: toneVar('user') }} /> input normal · US$ {PRICING.inputPerM}/M
            </span>
          )}
        </div>
        <div className="ventana-contexto-stats">
          <Stat label="costo de entrada (6 llamadas)" value={fmtUsd(total)} tone={mode === 'con' ? 'data' : 'user'} />
          <Stat label="sin caché" value={fmtUsd(base)} />
          <Stat label="ahorro" value={mode === 'con' ? pct(1 - total / base, 0) : '—'} tone="ok" sub="crece con conversaciones largas" />
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <div className="label">Qué es cacheable en la llamada 6</div>
          <BarRow label="tools" value={TOOLS_TOK} max={STATS[5].input} display={`${TOOLS_TOK}`} tone="data" />
          <BarRow label="system" value={SYSTEM_TOK} max={STATS[5].input} display={`${SYSTEM_TOK}`} tone="data" />
          <BarRow label="historial" value={STATS[5].history} max={STATS[5].input} display={`${STATS[5].history}`} tone="data" />
          <BarRow label="nuevo" value={STATS[5].fresh} max={STATS[5].input} display={`${STATS[5].fresh}`} tone="tool" />
          <div className="small muted">
            El caché funciona por <b>prefijo exacto</b>, en orden tools → system → messages. Si cambias una coma del system prompt, todo lo que viene
            después deja de coincidir.
          </div>
        </div>
      </div>
    </Lab>
  )
}
