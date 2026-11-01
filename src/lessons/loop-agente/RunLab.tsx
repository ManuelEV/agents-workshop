import { Code, linesOf } from '../../components/Code'
import { MessageList } from '../../components/Messages'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { Lab, Panel, Pill, Stat } from '../../components/ui'
import { usePlayer, useTypewriter } from '../../lib/hooks'
import { fmtInt, fmtUsd } from '../../sim/math'
import { FINAL_TEXT, FIRST_REQUEST, LLM_MS, RUN_CALLS, RUN_MESSAGES, TOOL_EXECS, toolResultBlock, usageCost } from './run'
import { LoopRing } from './LoopRing'

export const LOOP_CODE = `import json
import anthropic

client = anthropic.Anthropic()  # usa ANTHROPIC_API_KEY
messages = [{"role": "user", "content": pregunta}]

while True:
    resp = client.messages.create(
        model="claude-sonnet-5-5",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=TOOLS,
        messages=messages,
    )
    messages.append({"role": "assistant", "content": resp.content})

    if resp.stop_reason != "tool_use":
        break  # end_turn: el modelo terminó

    resultados = []
    for block in resp.content:
        if block.type == "tool_use":
            salida, es_error = run_tool(block.name, block.input)
            resultados.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": json.dumps(salida),
                "is_error": es_error,
            })
    messages.append({"role": "user", "content": resultados})

print(resp.content[-1].text)`

function between(code: string, from: string, to: string) {
  const a = linesOf(code, from)[0]
  const b = linesOf(code, to)[0]
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

const L = {
  ctx: linesOf(LOOP_CODE, 'messages = [{"role"'),
  call: between(LOOP_CODE, 'resp = client.messages.create(', '    )'),
  decide: linesOf(LOOP_CODE, '"role": "assistant"', 'if resp.stop_reason'),
  exec: linesOf(LOOP_CODE, 'for block in', 'if block.type', 'run_tool(block.name'),
  obs: [...between(LOOP_CODE, 'resultados.append({', '            })'), ...linesOf(LOOP_CODE, '"content": resultados')],
  end: linesOf(LOOP_CODE, 'if resp.stop_reason', '        break', 'print(resp'),
}

type PanelKind = { kind: 'request' } | { kind: 'response'; call: number; hlStop?: boolean } | { kind: 'exec'; exec: number } | { kind: 'result'; exec: number } | { kind: 'final' }

type Step = StepInfo & { phase: number; pos: number; msgs: number; panel: PanelKind; code: number[]; iter: number; calls: number; done?: boolean }

const STEPS: Step[] = [
  {
    title: 'Armar la petición',
    body: (
      <>
        Tu código junta todo lo que el modelo verá: <code>system</code>, las definiciones de <code>tools</code> y el arreglo <code>messages</code> (por ahora solo el mensaje
        de Camila). El modelo no recuerda nada entre llamadas: <strong>lo que no va aquí, no existe</strong>.
      </>
    ),
    phase: 0, pos: 0, msgs: 1, panel: { kind: 'request' }, code: L.ctx, iter: 1, calls: 0,
  },
  {
    title: 'Llamada 1 al LLM',
    body: (
      <>
        <code>client.messages.create(...)</code> envía todo por HTTP. El modelo responde con un texto corto y un bloque <code>tool_use</code> pidiendo{' '}
        <code>buscar_pedido</code> con <code>{'{"pedido_id": "4821"}'}</code>. Fíjate en <code>stop_reason: "tool_use"</code>: se detuvo para esperar un resultado.
      </>
    ),
    phase: 1, pos: 1, msgs: 1, panel: { kind: 'response', call: 0 }, code: L.call, iter: 1, calls: 1,
  },
  {
    title: '¿Sigue o termina? Lo decide un if en tu código',
    body: (
      <>
        Guardas la respuesta del asistente en <code>messages</code> (tal cual, con su <code>tool_use</code>) y miras <code>stop_reason</code>. Como es{' '}
        <code>"tool_use"</code>, el loop continúa. El modelo <em>pidió</em> una acción; ejecutarla es cosa tuya.
      </>
    ),
    phase: 2, pos: 2, msgs: 2, panel: { kind: 'response', call: 0, hlStop: true }, code: L.decide, iter: 1, calls: 1,
  },
  {
    title: 'Tu código ejecuta buscar_pedido',
    body: (
      <>
        Recorres los bloques, encuentras el <code>tool_use</code> y llamas a tu función real (aquí, una consulta a la base de pedidos). Tarda 132 ms. El LLM no
        participa en este paso: podrías validar argumentos, pedir permisos o registrar auditoría.
      </>
    ),
    phase: 3, pos: 3, msgs: 2, panel: { kind: 'exec', exec: 0 }, code: L.exec, iter: 1, calls: 1,
  },
  {
    title: 'Observación: el resultado vuelve al contexto',
    body: (
      <>
        El resultado se empaqueta como bloque <code>tool_result</code> con el mismo <code>tool_use_id</code> y se agrega como mensaje de rol <code>user</code>. Así es
        como el modelo "ve" el mundo: <strong>solo a través de lo que tú le devuelves</strong>.
      </>
    ),
    phase: 4, pos: 4, msgs: 3, panel: { kind: 'result', exec: 0 }, code: L.obs, iter: 1, calls: 1,
  },
  {
    title: 'Iteración 2: se reenvía todo el historial',
    body: (
      <>
        De vuelta arriba del <code>while</code>. La petición ahora lleva 3 mensajes: por eso <code>input_tokens</code> sube de 1.248 a 1.530. El modelo lee el estado{' '}
        <code>en_ruta</code> y pide <code>cambiar_direccion</code>.
      </>
    ),
    phase: 1, pos: 6, msgs: 3, panel: { kind: 'response', call: 1 }, code: L.call, iter: 2, calls: 2,
  },
  {
    title: 'Otra vez tool_use',
    body: (
      <>
        Se agrega la respuesta y el <code>if</code> vuelve a dejar pasar. Ojo: la descripción de <code>cambiar_direccion</code> decía que solo funciona en estado
        "preparando", y el modelo la intentó igual. Los modelos no siempre obedecen las descripciones.
      </>
    ),
    phase: 2, pos: 7, msgs: 4, panel: { kind: 'response', call: 1, hlStop: true }, code: L.decide, iter: 2, calls: 2,
  },
  {
    title: 'La herramienta falla (y está bien)',
    body: (
      <>
        Tu función valida la regla de negocio y responde <code>pedido_ya_despachado</code>. Esta es la protección real: <strong>las reglas van en el código</strong>, no
        solo en el prompt. Un error bien descrito es información útil para el modelo.
      </>
    ),
    phase: 3, pos: 8, msgs: 4, panel: { kind: 'exec', exec: 1 }, code: L.exec, iter: 2, calls: 2,
  },
  {
    title: 'El error también es una observación',
    body: (
      <>
        Se devuelve un <code>tool_result</code> con <code>is_error: true</code>. No se lanza una excepción ni se corta el loop: el modelo recibe el error y puede
        adaptarse.
      </>
    ),
    phase: 4, pos: 9, msgs: 5, panel: { kind: 'result', exec: 1 }, code: L.obs, iter: 2, calls: 2,
  },
  {
    title: 'Llamada 3: el modelo decide que terminó',
    body: (
      <>
        Con el estado del pedido y el error a la vista, el modelo redacta la respuesta: explica, no inventa un cambio exitoso y ofrece alternativas. Esta vez{' '}
        <code>stop_reason</code> es <code>"end_turn"</code>. Es la llamada más lenta: genera más tokens de salida.
      </>
    ),
    phase: 1, pos: 11, msgs: 5, panel: { kind: 'response', call: 2 }, code: L.call, iter: 3, calls: 3,
  },
  {
    title: 'Fin del loop',
    body: (
      <>
        El <code>if</code> ve <code>end_turn</code>, hace <code>break</code> y devuelves el texto a Camila. Total: 3 llamadas al LLM, 2 herramientas, 6 mensajes. Nadie
        programó "primero buscar, luego cambiar": <strong>el modelo eligió la ruta</strong>.
      </>
    ),
    phase: 2, pos: 12, msgs: 6, panel: { kind: 'final' }, code: L.end, iter: 3, calls: 3, done: true,
  },
]

const EXECS_AT = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]

function jsonWithHl(value: unknown, needle?: string) {
  const code = JSON.stringify(value, null, 2)
  return { code, hl: needle ? linesOf(code, needle) : [] }
}

function SidePanel({ p, typing }: { p: PanelKind; typing: string }) {
  if (p.kind === 'request') {
    const { code } = jsonWithHl(FIRST_REQUEST)
    return <Code code={code} lang="json" title="POST /v1/messages · cuerpo de la petición" maxHeight={300} highlight={linesOf(code, '"messages"')} />
  }
  if (p.kind === 'response') {
    const { code, hl } = jsonWithHl(RUN_CALLS[p.call], p.hlStop ? '"stop_reason"' : '"type": "tool_use"')
    return <Code code={code} lang="json" title={`respuesta · llamada ${p.call + 1}`} maxHeight={300} highlight={p.hlStop ? hl : [...hl, ...linesOf(code, '"stop_reason"')]} />
  }
  if (p.kind === 'exec') {
    const e = TOOL_EXECS[p.exec]
    return (
      <Panel title="tu código · run_tool()" tone="tool" right={<Pill tone={e.result.ok ? 'ok' : 'error'} mono>{e.result.ok ? 'ok' : 'error'} · {e.result.ms} ms</Pill>}>
        <div className="mono small loop-agente-call">
          run_tool(<span className="loop-agente-str">"{e.name}"</span>, {JSON.stringify(e.input)})
        </div>
        <div className="label" style={{ margin: '10px 0 4px' }}>
          devuelve
        </div>
        <Code code={JSON.stringify(e.result.content, null, 2)} lang="json" maxHeight={200} lineNumbers={false} />
      </Panel>
    )
  }
  if (p.kind === 'result') {
    const b = toolResultBlock(TOOL_EXECS[p.exec])
    return <Code code={JSON.stringify(b, null, 2)} lang="json" title="bloque tool_result (rol user)" maxHeight={300} highlight={[2, 3]} />
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Code code={JSON.stringify({ stop_reason: 'end_turn', usage: RUN_CALLS[2].usage }, null, 2)} lang="json" title="respuesta · llamada 3 (extracto)" highlight={[2]} />
      <div className="loop-agente-bubble">
        <div className="label">Lo que ve Camila</div>
        <div className={`loop-agente-bubble-text${typing.length < FINAL_TEXT.length ? ' caret' : ''}`}>{typing}</div>
      </div>
    </div>
  )
}

export function RunLab() {
  const player = usePlayer(STEPS.length, { interval: (s) => (s === STEPS.length - 1 ? 5000 : 4200) })
  const st = STEPS[player.step]
  const { shown } = useTypewriter(FINAL_TEXT, !!st.done, { cps: 140 })
  const calls = RUN_CALLS.slice(0, st.calls)
  const tin = calls.reduce((a, c) => a + c.usage.input_tokens, 0)
  const tout = calls.reduce((a, c) => a + c.usage.output_tokens, 0)
  const cost = calls.reduce((a, c) => a + usageCost(c.usage), 0)
  const execsDone = EXECS_AT[player.step] ?? 0
  const ms = LLM_MS.slice(0, st.calls).reduce((a, b) => a + b, 0) + TOOL_EXECS.slice(0, execsDone).reduce((a, e) => a + e.result.ms, 0)

  return (
    <Lab title="Una ejecución de Andi, llamada por llamada" hint="Usa ▶ o los botones de paso">
      <div className="loop-agente-user">
        <span className="label">usuario</span> {RUN_MESSAGES[0].content as string}
      </div>
      <PlayerBar player={player} labels={STEPS.map((s) => s.title)} />
      <div className="loop-agente-run">
        <div className="stack" style={{ gap: 12 }}>
          <LoopRing phase={st.phase} pos={st.pos} iter={st.iter} done={!!st.done} />
          <Narration steps={STEPS} step={player.step} />
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <Panel title="messages" tone="user" right={<span className="mono small">{st.msgs} mensajes</span>}>
            <MessageList messages={RUN_MESSAGES.slice(0, st.msgs)} newFrom={st.msgs - 1} highlight={[st.msgs - 1]} maxHeight={330} />
          </Panel>
          <div key={player.step} className="anim-fade">
            <SidePanel p={st.panel} typing={shown} />
          </div>
        </div>
      </div>
      <div className="loop-agente-stats">
        <Stat label="llamadas LLM" value={st.calls} tone="model" />
        <Stat label="tokens entrada" value={fmtInt(tin)} tone="model" sub="acumulados" />
        <Stat label="tokens salida" value={fmtInt(tout)} tone="model" sub="acumulados" />
        <Stat label="costo" value={fmtUsd(cost)} tone="guard" sub="precio de referencia" />
        <Stat label="tiempo" value={`${(ms / 1000).toFixed(2)} s`} tone="system" sub="LLM + herramientas" />
      </div>
      <Code code={LOOP_CODE} lang="python" title="agente.py · el loop completo" highlight={st.code} dim maxHeight={330} />
    </Lab>
  )
}
