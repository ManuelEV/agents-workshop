import { useState } from 'react'
import { Bot, Cpu, Wrench } from 'lucide-react'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { BarRow, Lab, Panel, Pill, Segmented, Stat } from '../../components/ui'
import { usePlayer } from '../../lib/hooks'
import { fmtInt, fmtUsd } from '../../sim/math'
import { SPANS, TRACE_END, type Span } from './data'

const byId = (id: string) => SPANS.find((s) => s.id === id)!

type TStep = StepInfo & { t: number; sel: string; done?: boolean }

const STEPS: TStep[] = [
  {
    title: 'Llega el mensaje: se abre el span raíz',
    body: (
      <>
        Tu harness crea el span <code>invoke_agent Andi</code>. Todo lo que pase durante esta ejecución colgará de él y compartirá el mismo{' '}
        <code>trace_id</code>.
      </>
    ),
    t: 18,
    sel: 'root',
  },
  {
    title: 'Primera llamada al modelo',
    body: (
      <>
        Un span hijo <code>chat {'{modelo}'}</code> mide la llamada HTTP completa. Al cerrarse guarda <code>gen_ai.usage.*</code> y{' '}
        <code>gen_ai.response.finish_reasons = ["tool_use"]</code>. 1,4 s.
      </>
    ),
    t: byId('chat1').end,
    sel: 'chat1',
  },
  {
    title: 'La herramienta: rápida',
    body: (
      <>
        <code>execute_tool buscar_pedido</code> dura 132 ms: una consulta a la base de datos. Comparado con el LLM, casi no se ve.
      </>
    ),
    t: byId('tool1').end,
    sel: 'tool1',
  },
  {
    title: 'Segunda llamada al modelo',
    body: <>Otra vez ~1,4 s. Los tokens de entrada subieron porque el historial creció.</>,
    t: byId('chat2').end,
    sel: 'chat2',
  },
  {
    title: 'Un span con error',
    body: (
      <>
        <code>cambiar_direccion</code> falla con <code>pedido_ya_despachado</code>: el span queda con estado ERROR y <code>error.type</code>. En un dashboard puedes
        filtrar "todas las trazas con errores de herramienta".
      </>
    ),
    t: byId('tool2').end,
    sel: 'tool2',
  },
  {
    title: 'La respuesta final es la más lenta',
    body: <>La tercera llamada genera 171 tokens de salida: 2,9 s. La latencia de un LLM crece sobre todo con los tokens que genera, no con los que lee.</>,
    t: byId('chat3').end,
    sel: 'chat3',
  },
  {
    title: 'Se cierra la traza: ¿dónde se fue el tiempo?',
    body: (
      <>
        Todo fue secuencial, así que el <strong>camino crítico</strong> es la cadena completa. Las llamadas al LLM son ~95% de la latencia: optimizar las
        herramientas casi no mueve la aguja.
      </>
    ),
    t: TRACE_END,
    sel: 'root',
    done: true,
  },
]

const KIND_TONE = { agent: 'system', chat: 'model', tool: 'tool' } as const
const KIND_ICON = { agent: Bot, chat: Cpu, tool: Wrench }

const pct = (ms: number) => `${(ms / TRACE_END) * 100}%`
const dur = (s: Span) => s.end - s.start
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`)

function AttrRow({ k, v, custom }: { k: string; v: string | number | string[]; custom?: boolean }) {
  return (
    <div className={`observabilidad-attr${custom ? ' is-custom' : ''}`}>
      <span className="k">{k}</span>
      <span className="v">{Array.isArray(v) ? JSON.stringify(v) : typeof v === 'string' ? `"${v}"` : v}</span>
    </div>
  )
}

const LLM_TOTAL = SPANS.filter((s) => s.kind === 'chat').reduce((a, s) => a + dur(s), 0)
const TOOL_TOTAL = SPANS.filter((s) => s.kind === 'tool').reduce((a, s) => a + dur(s), 0)
const TIN = SPANS.reduce((a, s) => a + Number(s.attrs['gen_ai.usage.input_tokens'] ?? 0), 0)
const TOUT = SPANS.reduce((a, s) => a + Number(s.attrs['gen_ai.usage.output_tokens'] ?? 0), 0)
const COST = SPANS.reduce((a, s) => a + Number(s.custom?.['app.cost_usd'] ?? 0), 0)

const WHATIF = {
  tools: { label: 'herramientas 2× más rápidas', save: TOOL_TOTAL / 2, note: 'Ahorro casi invisible: las herramientas ya eran rápidas.' },
  output: { label: 'respuesta final 40% más corta', save: Math.round(171 * 0.4 * 15), note: 'Menos tokens de salida = menos tiempo de generación (y salida es 5× más cara).' },
  iter: { label: 'una iteración menos', save: dur(byId('chat2')) + dur(byId('tool2')), note: 'Si el agente no hubiera intentado un cambio imposible (p. ej. con mejores instrucciones), se ahorra una llamada completa.' },
}

export function TraceLab() {
  const player = usePlayer(STEPS.length, { interval: 3000 })
  const st = STEPS[player.step]
  const [picked, setPicked] = useState<{ step: number; id: string } | null>(null)
  const [wi, setWi] = useState<keyof typeof WHATIF>('iter')
  const selId = picked && picked.step === player.step ? picked.id : st.sel
  const sel = byId(selId)
  const visible = (s: Span) => s.start <= st.t
  const selVisible = visible(sel)

  return (
    <Lab title="La traza de una ejecución de Andi" hint="Reproduce y toca un span">
      <PlayerBar player={player} labels={STEPS.map((s) => s.title)} />
      <div className="observabilidad-trace">
        <div className="observabilidad-axis">
          <span />
          <div className="observabilidad-ticks">
            {[0, 1, 2, 3, 4, 5, 6].map((s) => (
              <span key={s} style={{ left: pct(s * 1000) }}>
                {s} s
              </span>
            ))}
          </div>
        </div>
        {SPANS.map((s) => {
          const on = visible(s)
          const w = on ? Math.max(0, Math.min(st.t, s.end) - s.start) : 0
          const Icon = KIND_ICON[s.kind]
          const tone = s.error ? 'error' : KIND_TONE[s.kind]
          return (
            <button
              key={s.id}
              className={`observabilidad-row${selId === s.id ? ' is-sel' : ''}${on ? '' : ' is-future'}${st.done && s.parent ? ' is-crit' : ''}`}
              data-tone={tone}
              onClick={() => setPicked({ step: player.step, id: s.id })}
            >
              <span className={`observabilidad-name${s.parent ? ' is-child' : ''}`}>
                <Icon size={13} />
                <span>{s.name}</span>
              </span>
              <span className="observabilidad-lane">
                {[1, 2, 3, 4, 5, 6].map((x) => (
                  <span key={x} className="observabilidad-gridline" style={{ left: pct(x * 1000) }} />
                ))}
                {!st.done && <span className="observabilidad-cursor" style={{ left: pct(st.t) }} />}
                <span className="observabilidad-bar" style={{ left: pct(s.start), width: pct(w) }}>
                  {on && w > 0 && (s.kind !== 'agent' || st.done) && <span className="observabilidad-bar-lbl">{fmtMs(Math.min(st.t, s.end) - s.start)}</span>}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="observabilidad-trace-bottom">
        <div className="stack" style={{ gap: 10 }}>
          <Narration steps={STEPS} step={player.step} />
          {st.done && (
            <div className="anim-in stack" style={{ gap: 8 }}>
              <div className="label">dónde se fue el tiempo</div>
              <div className="observabilidad-stack-bar" role="img" aria-label="Reparto de la latencia">
                <span data-tone="model" style={{ width: pct(LLM_TOTAL) }}>
                  LLM {((LLM_TOTAL / TRACE_END) * 100).toFixed(0)}%
                </span>
                <span data-tone="tool" style={{ width: pct(TOOL_TOTAL) }} title="herramientas" />
                <span data-tone="system" style={{ width: pct(TRACE_END - LLM_TOTAL - TOOL_TOTAL) }} title="harness" />
              </div>
              <div className="small muted">
                LLM {fmtMs(LLM_TOTAL)} · herramientas {fmtMs(TOOL_TOTAL)} · harness {fmtMs(TRACE_END - LLM_TOTAL - TOOL_TOTAL)}
              </div>
              <div className="label" style={{ marginTop: 6 }}>
                ¿qué optimizarías?
              </div>
              <Segmented options={(Object.keys(WHATIF) as (keyof typeof WHATIF)[]).map((k) => ({ value: k, label: WHATIF[k].label }))} value={wi} onChange={setWi} />
              <BarRow label="antes" value={TRACE_END} max={TRACE_END} display={fmtMs(TRACE_END)} tone="system" />
              <BarRow label="después" value={TRACE_END - WHATIF[wi].save} max={TRACE_END} display={fmtMs(TRACE_END - WHATIF[wi].save)} tone="ok" pick />
              <div className="small">
                <strong>−{((WHATIF[wi].save / TRACE_END) * 100).toFixed(0)}%.</strong> {WHATIF[wi].note}
              </div>
            </div>
          )}
        </div>
        <Panel
          title={sel.name}
          tone={sel.error ? 'error' : KIND_TONE[sel.kind]}
          right={selVisible ? <Pill tone={sel.error ? 'error' : 'ok'} mono>{sel.error ? 'ERROR' : 'OK'}</Pill> : undefined}
        >
          {selVisible ? (
            <div className="stack" style={{ gap: 2 }} key={sel.id}>
              <div className="small muted mono" style={{ marginBottom: 6 }}>
                kind={sel.kind === 'chat' ? 'CLIENT' : 'INTERNAL'} · inicio +{sel.start} ms · duración {fmtMs(dur(sel))}
              </div>
              {Object.entries(sel.attrs).map(([k, v]) => (
                <AttrRow key={k} k={k} v={v} />
              ))}
              {sel.custom && (
                <>
                  <div className="label" style={{ marginTop: 8 }}>
                    atributos propios
                  </div>
                  {Object.entries(sel.custom).map(([k, v]) => (
                    <AttrRow key={k} k={k} v={v} custom />
                  ))}
                </>
              )}
            </div>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              Este span todavía no ocurre en la reproducción.
            </p>
          )}
        </Panel>
      </div>

      <div className="observabilidad-totals">
        <Stat label="duración" value={st.done ? fmtMs(TRACE_END) : '…'} tone="system" />
        <Stat label="llamadas LLM" value={SPANS.filter((s) => s.kind === 'chat' && s.end <= st.t).length} tone="model" />
        <Stat label="tokens" value={st.done ? fmtInt(TIN + TOUT) : '…'} tone="model" sub={st.done ? `${fmtInt(TIN)} in · ${fmtInt(TOUT)} out` : undefined} />
        <Stat label="costo de la tarea" value={st.done ? fmtUsd(COST) : '…'} tone="guard" sub="precio de referencia" />
      </div>
    </Lab>
  )
}
