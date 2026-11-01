import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleSlash, XCircle } from 'lucide-react'
import { Lab, Panel, Pill } from '../../components/ui'
import { Code, linesOf } from '../../components/Code'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { runTool } from '../../sim/scenario'

/* ==========================================================================
   Nivel 1: herramientas "a mano". El modelo solo produce texto; tu código
   busca un patrón en ese texto, lo parsea y ejecuta la función.
   ========================================================================== */

export const SYSTEM_MANUAL = `Eres Andi, asistente de Andes Market.
Tienes estas herramientas:
- buscar_pedido(pedido_id): estado de un pedido.
- consultar_politicas(pregunta): busca en las políticas.

Para usar una herramienta responde SOLO con una línea:
ACCIÓN: nombre_herramienta({"argumento": "valor"})
Luego espera la OBSERVACIÓN. Cuando tengas la respuesta final:
RESPUESTA: <texto para el cliente>`

const CODE = `import json, re

TOOLS = {"buscar_pedido": buscar_pedido, "consultar_politicas": consultar_politicas}
PATRON = re.compile(r"ACCIÓN:\\s*(\\w+)\\((\\{.*\\})\\)", re.DOTALL)

def agente(pregunta: str, max_pasos: int = 5) -> str:
    historial = [{"role": "user", "content": pregunta}]
    for _ in range(max_pasos):
        texto = llm(SYSTEM_MANUAL, historial)       # el modelo solo devuelve TEXTO
        historial.append({"role": "assistant", "content": texto})

        if texto.startswith("RESPUESTA:"):
            return texto.removeprefix("RESPUESTA:").strip()

        m = PATRON.search(texto)                    # 1) buscar la intención en el texto
        if not m:
            historial.append({"role": "user", "content": "Formato inválido, usa ACCIÓN: ..."})
            continue
        nombre, args_json = m.group(1), m.group(2)
        args = json.loads(args_json)                # 2) puede explotar si el JSON viene mal
        resultado = TOOLS[nombre](**args)           # 3) TU código ejecuta la función
        historial.append({"role": "user",
                          "content": f"OBSERVACIÓN: {json.dumps(resultado)}"})
    return "No pude completar la tarea."`

const L = (...n: string[]) => linesOf(CODE, ...n)

const QUESTION = '¿Dónde está mi pedido 4821?'
const OUT1 = 'Necesito revisar el pedido.\nACCIÓN: buscar_pedido({"pedido_id": "4821"})'
const OBS = runTool('buscar_pedido', { pedido_id: '4821' }).content as Record<string, unknown>
const OBS_TEXT = `OBSERVACIÓN: ${JSON.stringify({ id: OBS.id, estado: OBS.estado, courier: OBS.courier, seguimiento: OBS.seguimiento, eta: OBS.eta })}`
const OUT2 = 'RESPUESTA: Tu pedido 4821 va en camino con Chilexpress (seguimiento CX-99812-CL) y debería llegar el 4 de noviembre.'

type Line = { role: 'system' | 'user' | 'assistant'; text: string; mark?: boolean }

export function ByHandLab() {
  const steps: StepInfo[] = [
    {
      title: 'Las herramientas se describen en texto libre',
      body: 'No hay ningún campo especial en la API: le explicas al modelo, en el system prompt, qué funciones existen y en qué formato pedirlas.',
    },
    { title: 'Llega la pregunta', body: 'Tu código arma el historial y llama al modelo.' },
    {
      title: 'El modelo responde… texto',
      body: (
        <>
          Como siguió las instrucciones, su texto incluye una línea <code>ACCIÓN: …</code>. Para la API esto es una respuesta normal: no sabe que
          es una "llamada a herramienta".
        </>
      ),
    },
    {
      title: 'Una regex busca la intención',
      body: 'Tu parser busca el patrón en el texto y separa el nombre de la herramienta y el JSON de argumentos. Si el modelo cambió una coma, aquí falla.',
    },
    {
      title: 'json.loads + ejecutar la función',
      body: 'Conviertes el texto a un dict y llamas a la función real. El LLM nunca toca tu sistema: solo escribió texto que tú decidiste obedecer.',
    },
    {
      title: 'El resultado vuelve como texto',
      body: 'Agregas una línea OBSERVACIÓN al historial y vuelves a llamar al modelo con todo.',
    },
    { title: 'Segunda llamada: respuesta final', body: 'Con la observación en el contexto, el modelo escribe la línea RESPUESTA.' },
    { title: 'Fin del bucle', body: 'Tu código detecta el prefijo RESPUESTA: y devuelve el texto al usuario. Funciona… mientras el modelo respete el formato.' },
  ]
  const codeLines = [
    L('TOOLS =', 'PATRON ='),
    L('def agente', 'historial = ['),
    L('texto = llm(', 'historial.append({"role": "assistant"'),
    L('PATRON.search', 'nombre, args_json'),
    L('json.loads', 'TOOLS[nombre]'),
    L('OBSERVACIÓN', 'historial.append({"role": "user",'),
    L('texto = llm(', 'historial.append({"role": "assistant"'),
    L('startswith("RESPUESTA:")', 'removeprefix'),
  ]
  const player = usePlayer(steps.length, { interval: 3000 })
  const s = player.step

  const transcript: Line[] = [{ role: 'system', text: SYSTEM_MANUAL }]
  if (s >= 1) transcript.push({ role: 'user', text: QUESTION })
  if (s >= 2) transcript.push({ role: 'assistant', text: OUT1, mark: s >= 3 && s <= 4 })
  if (s >= 5) transcript.push({ role: 'user', text: OBS_TEXT })
  if (s >= 6) transcript.push({ role: 'assistant', text: OUT2 })

  return (
    <Lab title="Herramientas a mano: un parser sobre texto libre" hint="Avanza paso a paso">
      <div className="stack">
        <div className="split">
          <Panel title="Lo que ve y escribe el modelo (solo texto)" tone="model">
            <div className="tools-transcript">
              {transcript.map((t, i) => (
                <div key={i} className={`tools-tline anim-in`} data-tone={t.role === 'assistant' ? 'model' : t.role}>
                  <span className="tools-trole">{t.role}</span>
                  {t.mark ? <MarkedAction text={t.text} /> : <span style={{ whiteSpace: 'pre-wrap' }}>{t.text}</span>}
                </div>
              ))}
            </div>
          </Panel>
          <div className="stack" style={{ gap: 10 }}>
            <Code code={CODE} lang="python" title="agente_manual.py" highlight={codeLines[s]} dim maxHeight={360} />
            {s >= 3 && s <= 4 && (
              <Panel title="Parser" tone="tool">
                <div className="tools-kv anim-fade">
                  <span>m.group(1)</span>
                  <code>buscar_pedido</code>
                  <span>m.group(2)</span>
                  <code>{'{"pedido_id": "4821"}'}</code>
                  {s === 4 && (
                    <>
                      <span>resultado</span>
                      <code style={{ whiteSpace: 'normal' }}>
                        {`{estado: "${OBS.estado}", courier: "${OBS.courier}", eta: "${OBS.eta}", …}`}
                      </code>
                    </>
                  )}
                </div>
              </Panel>
            )}
          </div>
        </div>
        <Narration steps={steps} step={s} />
        <PlayerBar player={player} labels={steps.map((x) => x.title)} />
      </div>
    </Lab>
  )
}

function MarkedAction({ text }: { text: string }) {
  const m = text.match(/ACCIÓN:\s*(\w+)\((\{.*\})\)/s)
  if (!m || m.index === undefined) return <span>{text}</span>
  const before = text.slice(0, m.index)
  const after = text.slice(m.index + m[0].length)
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {before}
      <span className="tools-match">
        ACCIÓN: <span className="tools-g1">{m[1]}</span>(<span className="tools-g2">{m[2]}</span>)
      </span>
      {after}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Rompe el parser                                                             */
/* -------------------------------------------------------------------------- */

const VARIANTS = [
  { id: 'ok', label: 'Correcta', text: 'Necesito revisar el pedido.\nACCIÓN: buscar_pedido({"pedido_id": "4821"})' },
  { id: 'case', label: 'Minúsculas', text: 'Claro, reviso tu pedido.\nAcción: buscar_pedido({"pedido_id": "4821"})' },
  { id: 'quotes', label: 'Comillas simples', text: "ACCIÓN: buscar_pedido({'pedido_id': '4821'})" },
  { id: 'invent', label: 'Herramienta inventada', text: 'ACCIÓN: rastrear_envio({"numero": "4821"})' },
  { id: 'two', label: 'Dos acciones', text: 'ACCIÓN: buscar_pedido({"pedido_id": "4821"})\nACCIÓN: consultar_politicas({"pregunta": "cambio de dirección"})' },
  { id: 'type', label: 'Número sin comillas', text: 'ACCIÓN: buscar_pedido({"pedido_id": 4821})' },
  {
    id: 'halluc',
    label: 'Observación inventada',
    text: 'ACCIÓN: buscar_pedido({"pedido_id": "4821"})\nOBSERVACIÓN: {"estado": "entregado"}\nRESPUESTA: Tu pedido ya fue entregado ayer.',
  },
]

const FN_ARGS: Record<string, string[]> = { buscar_pedido: ['pedido_id'], consultar_politicas: ['pregunta'] }

type Check = { label: string; status: 'ok' | 'fail' | 'warn' | 'skip'; detail: string }

function parse(text: string): { checks: Check[]; verdict: { tone: 'ok' | 'error' | 'guard'; text: string } } {
  const checks: Check[] = []
  const m = text.match(/ACCIÓN:\s*(\w+)\((\{.*\})\)/s)
  if (!m) {
    checks.push({ label: 'PATRON.search', status: 'fail', detail: 'No hay coincidencia: el patrón es sensible a mayúsculas y al formato exacto.' })
    return { checks, verdict: { tone: 'guard', text: 'Reintento: le pides al modelo que corrija el formato. Gastas otra llamada completa.' } }
  }
  checks.push({ label: 'PATRON.search', status: 'ok', detail: `nombre = "${m[1]}", args = ${m[2].length > 70 ? m[2].slice(0, 70) + '…' : m[2]}` })
  let args: Record<string, unknown>
  try {
    args = JSON.parse(m[2])
    checks.push({ label: 'json.loads', status: 'ok', detail: JSON.stringify(args) })
  } catch (e) {
    checks.push({ label: 'json.loads', status: 'fail', detail: `JSONDecodeError: ${(e as Error).message.slice(0, 80)}` })
    const two = m[2].includes('ACCIÓN')
    return {
      checks,
      verdict: {
        tone: 'error',
        text: two
          ? 'El .* codicioso unió las dos acciones en un solo "JSON" inválido. Tu parser solo sabía manejar una.'
          : 'Excepción no controlada: el agente se cae (o tienes que envolver todo en try/except y reintentar).',
      },
    }
  }
  const fn = FN_ARGS[m[1]]
  if (!fn) {
    checks.push({ label: 'TOOLS[nombre]', status: 'fail', detail: `KeyError: '${m[1]}' — el modelo inventó una herramienta.` })
    return { checks, verdict: { tone: 'error', text: 'El modelo "alucinó" una herramienta que no existe.' } }
  }
  checks.push({ label: 'TOOLS[nombre]', status: 'ok', detail: `función ${m[1]} encontrada` })
  const bad = Object.entries(args).find(([k, v]) => !fn.includes(k) || typeof v !== 'string')
  if (bad) {
    checks.push({
      label: 'validación de tipos',
      status: 'warn',
      detail: `Nadie valida: ${bad[0]} = ${JSON.stringify(bad[1])} (${typeof bad[1]}). La función recibe un tipo inesperado.`,
    })
  } else checks.push({ label: 'validación de tipos', status: 'skip', detail: 'No existe en este código: confías en que el modelo acierte.' })
  if (/OBSERVACI[ÓO]N:/i.test(text) || /RESPUESTA:/.test(text)) {
    checks.push({ label: 'texto extra', status: 'warn', detail: 'El modelo escribió su propia OBSERVACIÓN y RESPUESTA: inventó el resultado de la herramienta.' })
    return { checks, verdict: { tone: 'error', text: 'Peligroso: si tu código buscara "RESPUESTA:" en cualquier parte, entregarías un dato inventado al cliente.' } }
  }
  return {
    checks,
    verdict: bad ? { tone: 'guard', text: 'Pasó el parser, pero con un argumento mal tipado: buscar_pedido(4821) no encuentra el pedido "4821".' } : { tone: 'ok', text: 'Se ejecuta buscar_pedido(pedido_id="4821").' },
  }
}

const STATUS_ICON = { ok: CheckCircle2, fail: XCircle, warn: AlertTriangle, skip: CircleSlash }

export function BreakParserLab() {
  const [text, setText] = useState(VARIANTS[0].text)
  const result = useMemo(() => parse(text), [text])
  const active = VARIANTS.find((v) => v.text === text)?.id
  return (
    <Lab title="Rompe el parser" hint="Elige una variante o edita la salida del modelo">
      <div className="stack">
        <div className="row" style={{ gap: 6 }}>
          {VARIANTS.map((v) => (
            <button key={v.id} className={`btn btn-sm${active === v.id ? ' btn-primary' : ''}`} onClick={() => setText(v.text)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="split">
          <div className="stack" style={{ gap: 6 }}>
            <span className="label">Salida del modelo (editable)</span>
            <textarea className="textarea mono" style={{ fontSize: 13, minHeight: 130 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Salida del modelo" />
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {result.checks.map((c, i) => {
              const Icon = STATUS_ICON[c.status]
              return (
                <div key={c.label + i} className={`tools-check anim-in is-${c.status}`} style={{ animationDelay: `${i * 0.06}s` }}>
                  <Icon size={16} />
                  <div>
                    <div className="mono small" style={{ fontWeight: 600 }}>
                      {c.label}
                    </div>
                    <div className="small" style={{ color: 'var(--text-2)', wordBreak: 'break-word' }}>
                      {c.detail}
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="tools-verdict" data-tone={result.verdict.tone}>
              <Pill tone={result.verdict.tone}>{result.verdict.tone === 'ok' ? 'funciona' : result.verdict.tone === 'guard' ? 'frágil' : 'falla'}</Pill>
              <span>{result.verdict.text}</span>
            </div>
          </div>
        </div>
      </div>
    </Lab>
  )
}
