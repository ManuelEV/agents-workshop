import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Code } from '../../components/Code'
import { BarRow, Lab, Panel, Segmented } from '../../components/ui'
import { countTokens, softmax } from '../../sim/math'
import { TOOLS } from '../../sim/scenario'

/* "Qué cambia la decisión": logits escritos a mano por escenario, modificados
   por la calidad de las descripciones, la cantidad de herramientas y tool_choice.
   Después: softmax real + máscara de tool_choice. */

type MsgId = 'pedido' | 'politica' | 'saludo' | 'sin_numero'
type Desc = 'buena' | 'vaga' | 'ausente'
type Choice = 'auto' | 'any' | 'tool' | 'none'
type Count = '4' | '40'

const MSGS: Record<MsgId, { label: string; text: string }> = {
  pedido: { label: 'Pedido', text: '¿Dónde está mi pedido 4821?' },
  politica: { label: 'Política', text: '¿Cuánto demora el reembolso si pagué con tarjeta?' },
  saludo: { label: 'Saludo', text: '¡Hola! ¿Cómo estás?' },
  sin_numero: { label: 'Sin número', text: '¿Dónde está mi pedido?' },
}

const BASE = ['buscar_pedido', 'cambiar_direccion', 'consultar_politicas', 'crear_ticket']
// logits: [texto, buscar_pedido, cambiar_direccion, consultar_politicas, crear_ticket]
const LOGITS: Record<MsgId, number[]> = {
  pedido: [0.6, 4.4, 0.2, 0.9, -0.6],
  politica: [1.3, 0.1, -1.0, 4.0, -0.4],
  saludo: [4.6, 0.2, -1.5, 0.3, -1.0],
  sin_numero: [3.3, 2.2, -0.8, 0.4, 0.2],
}

const VAGUE: Record<string, string> = {
  buscar_pedido: 'Herramienta de pedidos.',
  cambiar_direccion: 'Gestiona pedidos.',
  consultar_politicas: 'Información.',
  crear_ticket: 'Soporte.',
}

// Herramientas parecidas que aparecen al pasar a 40
const SIMILAR: Record<string, string[]> = {
  buscar_pedido: ['obtener_pedido', 'estado_orden', 'rastrear_envio', 'consultar_despacho', 'ver_pedido_cliente'],
  consultar_politicas: ['buscar_faq', 'consultar_ayuda', 'leer_terminos', 'buscar_documentos'],
}
const GAPS: Record<Desc, number[]> = { buena: [1.5, 1.9, 2.2, 2.5, 2.8], vaga: [0.3, 0.45, 0.6, 0.8, 0.9], ausente: [0.1, 0.2, 0.3, 0.4, 0.5] }
const GENERIC_N = 27

type Option = { name: string; logit: number; generic?: boolean }

function buildOptions(msg: MsgId, desc: Desc, count: Count): { text: number; tools: Option[] } {
  const [text, ...tl] = LOGITS[msg]
  const k = desc === 'buena' ? 1 : desc === 'vaga' ? 0.5 : 0.35
  const shift = desc === 'buena' ? 0 : desc === 'vaga' ? -0.4 : -0.8
  const mean = tl.reduce((a, b) => a + b, 0) / tl.length
  const tools: Option[] = BASE.map((name, i) => ({ name, logit: mean + (tl[i] - mean) * k + shift }))
  if (count === '40') {
    for (const parent of Object.keys(SIMILAR)) {
      const pl = tools.find((t) => t.name === parent)!.logit
      SIMILAR[parent].forEach((name, j) => tools.push({ name, logit: pl - GAPS[desc][j] }))
    }
    for (let i = 0; i < GENERIC_N; i++) tools.push({ name: `otra_${i + 1}`, logit: -1.2 + shift, generic: true })
  }
  return { text, tools }
}

const TEXT_OUT: Record<MsgId, { text: string; ok: boolean; note: string }> = {
  pedido: { text: 'Para ver tu pedido 4821 necesito consultar el sistema y ahora no puedo hacerlo. ¿Te ayudo con otra cosa?', ok: false, note: 'Sin herramienta no puede responder. Lo bueno es que no inventó un estado; un prompt peor podría haberlo hecho.' },
  politica: { text: 'Normalmente los reembolsos con tarjeta tardan algunos días hábiles en verse reflejados.', ok: false, note: 'Responde "de memoria", vago y sin citar la política real (5 a 10 días hábiles).' },
  saludo: { text: '¡Hola! Muy bien, gracias. Soy Andi, ¿en qué te ayudo con tu compra?', ok: true, note: 'Correcto: un saludo no necesita herramientas.' },
  sin_numero: { text: '¡Claro! ¿Me das el número de tu pedido? Lo encuentras en el correo de confirmación.', ok: true, note: 'Correcto: pide el dato que falta en lugar de inventarlo.' },
}

function toolOut(msg: MsgId, tool: string): { input: Record<string, string>; ok: boolean; note: string } {
  const right: Record<MsgId, string> = { pedido: 'buscar_pedido', politica: 'consultar_politicas', saludo: '', sin_numero: '' }
  if (tool === 'buscar_pedido') {
    if (msg === 'pedido') return { input: { pedido_id: '4821' }, ok: true, note: 'Herramienta correcta, argumento copiado del mensaje.' }
    return { input: { pedido_id: msg === 'sin_numero' ? '1234' : '0000' }, ok: false, note: 'pedido_id es obligatorio y no había número: el modelo lo inventa para cumplir el esquema.' }
  }
  if (tool === 'consultar_politicas') {
    if (msg === 'politica') return { input: { pregunta: '¿Cuánto demora el reembolso con tarjeta?' }, ok: true, note: 'Herramienta correcta: la respuesta podrá citar la fuente.' }
    return { input: { pregunta: MSGS[msg].text }, ok: false, note: 'Busca en las políticas algo que no es una pregunta de política.' }
  }
  if (tool === 'cambiar_direccion') return { input: { pedido_id: '4821', nueva_direccion: 'Av. Providencia 1234' }, ok: false, note: 'Acción con efectos, sin que nadie la pidiera y con datos inventados. Peligroso.' }
  if (tool === 'crear_ticket') return { input: { resumen: MSGS[msg].text, prioridad: 'baja' }, ok: false, note: 'Escala a un humano sin necesidad.' }
  const similar = right[msg] && SIMILAR[right[msg]]?.includes(tool)
  return {
    input: msg === 'pedido' ? { pedido_id: '4821' } : { consulta: MSGS[msg].text },
    ok: false,
    note: similar ? 'Eligió una herramienta parecida a la correcta. Puede funcionar o no: depende de qué haga realmente.' : 'Herramienta equivocada entre muchas parecidas.',
  }
}

export function ChoiceLab() {
  const [msg, setMsg] = useState<MsgId>('pedido')
  const [desc, setDesc] = useState<Desc>('buena')
  const [choice, setChoice] = useState<Choice>('auto')
  const [forced, setForced] = useState('buscar_pedido')
  const [count, setCount] = useState<Count>('4')

  const { text, tools } = buildOptions(msg, desc, count)
  const logits = [text, ...tools.map((t) => t.logit)]
  const allowed = [choice === 'auto' || choice === 'none', ...tools.map((t) => (choice === 'none' ? false : choice === 'tool' ? t.name === forced : true))]
  const raw = softmax(logits, 1)
  const masked = raw.map((p, i) => (allowed[i] ? p : 0))
  const z = masked.reduce((a, b) => a + b, 0)
  const probs = masked.map((p) => p / z)
  const pText = probs[0]
  const pTools = 1 - pText
  const rawText = raw[0]

  // ranking de herramientas (condicional a llamar una)
  const toolProbs = tools.map((t, i) => ({ ...t, p: probs[i + 1], raw: raw[i + 1], allowed: allowed[i + 1] }))
  const condZ = toolProbs.reduce((a, t) => a + (t.allowed ? t.raw : 0), 0) || 1
  const named = toolProbs.filter((t) => !t.generic).map((t) => ({ ...t, cond: t.allowed ? t.raw / condZ : 0 }))
  named.sort((a, b) => b.cond - a.cond || b.raw - a.raw)
  const generic = toolProbs.filter((t) => t.generic)
  const genericCond = generic.reduce((a, t) => a + (t.allowed ? t.raw / condZ : 0), 0)
  const shown = named.slice(0, 6)
  const restNamed = named.slice(6)
  const restCond = genericCond + restNamed.reduce((a, t) => a + t.cond, 0)
  const restCount = generic.length + restNamed.length

  const best = probs.indexOf(Math.max(...probs))
  const winsText = best === 0
  const winner = winsText ? null : tools[best - 1].name
  const out = winsText ? null : toolOut(msg, winner!)
  const tOut = TEXT_OUT[msg]
  const pWinner = probs[best]
  const toolTokens = countTokens(JSON.stringify(TOOLS)) * (count === '40' ? 10 : 1) * (desc === 'buena' ? 1 : desc === 'vaga' ? 0.55 : 0.4)

  const tc = choice === 'tool' ? { type: 'tool', name: forced } : { type: choice }
  const ok = winsText ? tOut.ok : out!.ok

  return (
    <Lab title="Qué cambia la decisión" hint="Combina los controles">
      <div className="decision-herramienta-ctrls">
        <div className="stack" style={{ gap: 4 }}>
          <span className="label">mensaje</span>
          <Segmented options={(Object.keys(MSGS) as MsgId[]).map((k) => ({ value: k, label: MSGS[k].label }))} value={msg} onChange={setMsg} />
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <span className="label">descripciones</span>
          <Segmented
            options={[
              { value: 'buena', label: 'buenas' },
              { value: 'vaga', label: 'vagas' },
              { value: 'ausente', label: 'sin descripción' },
            ]}
            value={desc}
            onChange={setDesc}
          />
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <span className="label">tool_choice</span>
          <Segmented
            options={[
              { value: 'auto', label: 'auto' },
              { value: 'any', label: 'any' },
              { value: 'tool', label: 'tool' },
              { value: 'none', label: 'none' },
            ]}
            value={choice}
            onChange={setChoice}
          />
          {choice === 'tool' && (
            <select className="select" value={forced} onChange={(e) => setForced(e.target.value)} aria-label="Herramienta forzada">
              {BASE.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <span className="label">herramientas</span>
          <Segmented
            options={[
              { value: '4', label: '4 (Andi)' },
              { value: '40', label: '40 parecidas' },
            ]}
            value={count}
            onChange={setCount}
          />
        </div>
      </div>

      <div className="decision-herramienta-q" style={{ marginTop: 12 }}>
        <span className="label">usuario</span> {MSGS[msg].text}
        {desc !== 'buena' && (
          <span className="small muted" style={{ display: 'block' }}>
            descripción de buscar_pedido: <code>{desc === 'vaga' ? VAGUE.buscar_pedido : '(vacía)'}</code>
          </span>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <Panel title="1 · ¿texto o herramienta?" tone="model">
          <div className="stack" style={{ gap: 6 }}>
            <BarRow label="texto directo" value={pText} display={allowed[0] ? pText.toFixed(2) : 'bloqueado'} tone="user" off={!allowed[0]} pick={winsText} />
            <BarRow
              label="llamar herramienta"
              value={pTools}
              display={choice === 'none' ? 'bloqueado' : pTools.toFixed(2)}
              tone="tool"
              off={choice === 'none'}
              pick={!winsText}
            />
          </div>
          {(choice === 'any' || choice === 'tool') && (
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              Sin restricción, el texto tenía {rawText.toFixed(2)}. Con <code>{choice}</code> la API prellena el turno para forzar una llamada: el modelo ni siquiera
              escribe texto antes.
            </p>
          )}
          {choice === 'none' && (
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              Con <code>none</code> las herramientas siguen descritas en el prompt, pero el modelo no puede llamarlas.
            </p>
          )}
        </Panel>
        <Panel title="2 · ¿cuál herramienta?" tone="tool" right={<span className="mono small">~{Math.round(toolTokens).toLocaleString('es-CL')} tok de definiciones</span>}>
          <div className="stack" style={{ gap: 5 }}>
            {choice === 'none' ? (
              <p className="small muted" style={{ margin: 0 }}>
                No aplica: no hay llamadas posibles.
              </p>
            ) : (
              <>
                {shown.map((t) => (
                  <BarRow key={t.name} label={t.name} value={t.cond} display={t.allowed ? t.cond.toFixed(2) : '—'} tone="tool" off={!t.allowed} pick={t.name === winner} />
                ))}
                {restCount > 0 && <BarRow label={`otras ${restCount}`} value={restCond} display={restCond.toFixed(2)} tone="system" off={restCond === 0} />}
              </>
            )}
          </div>
        </Panel>
      </div>

      <div className="decision-herramienta-out" data-tone={ok ? 'ok' : 'guard'}>
        <div className="decision-herramienta-out-head">
          {ok ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          <strong>Salida más probable</strong>
          <span className="mono small muted">p = {pWinner.toFixed(2)}</span>
          {pWinner < 0.8 && pWinner > 0 && <span className="small muted">· en ~{Math.round((1 - pWinner) * 100)} de 100 ejecuciones saldría otra cosa</span>}
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div>
            {winsText ? (
              <div className="decision-herramienta-bubble">{tOut.text}</div>
            ) : (
              <Code code={JSON.stringify({ type: 'tool_use', name: winner, input: out!.input }, null, 2)} lang="json" lineNumbers={false} />
            )}
            <p className="small" style={{ margin: '8px 0 0' }}>
              {winsText ? tOut.note : out!.note}
            </p>
          </div>
          <Code code={JSON.stringify({ tool_choice: tc }, null, 2)} lang="json" title="en la petición" lineNumbers={false} />
        </div>
      </div>
    </Lab>
  )
}
