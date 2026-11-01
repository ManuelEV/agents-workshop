/* Datos de la lección: una conversación real con Andi en formato Messages API. */
import type { Msg } from '../../components/Messages'
import { msgTokens } from '../../components/Messages'
import { countTokens } from '../../sim/math'
import { ORDERS, SYSTEM_PROMPT, TOOLS, runTool } from '../../sim/scenario'
import { KB_DOCS } from '../../sim/corpus'

export const MAX_TOKENS = 1024
export const SYSTEM_TOK = countTokens(SYSTEM_PROMPT)
export const TOOLS_TOK = countTokens(JSON.stringify(TOOLS))

const pick = (id: string) => {
  const o = ORDERS[id]
  return JSON.stringify({ id: o.id, productos: o.productos, estado: o.estado, courier: o.courier, seguimiento: o.seguimiento, eta: o.eta })
}
const err = JSON.stringify(runTool('cambiar_direccion', { pedido_id: '4821', nueva_direccion: 'Av. Apoquindo 4500, Las Condes' }).content)

/* ------------------------- Lab 1: 6 llamadas a la API ------------------------- */

export type Call = {
  /** mensajes enviados en esta llamada */
  messages: Msg[]
  /** cuántos de esos mensajes son nuevos respecto a la llamada anterior */
  fresh: number
  response: Msg
  what: string
}

const u1: Msg = { role: 'user', content: 'Hola, ¿cuándo llega mi pedido 4821?' }
const a1: Msg = { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_01', name: 'buscar_pedido', input: { pedido_id: '4821' } }] }
const u2: Msg = { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: pick('4821') }] }
const a2: Msg = {
  role: 'assistant',
  content: 'Tu pedido 4821 va en ruta con Chilexpress y llega el miércoles 4 de noviembre. Código de seguimiento: CX-99812-CL.',
}
const u3: Msg = { role: 'user', content: '¿Puedo cambiar la dirección a Av. Apoquindo 4500, Las Condes?' }
const a3: Msg = {
  role: 'assistant',
  content: [
    { type: 'tool_use', id: 'toolu_02', name: 'cambiar_direccion', input: { pedido_id: '4821', nueva_direccion: 'Av. Apoquindo 4500, Las Condes' } },
  ],
}
const u4: Msg = { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_02', content: err, is_error: true }] }
const a4: Msg = {
  role: 'assistant',
  content: 'No pude cambiarla: el pedido ya fue despachado. Puedes coordinar el cambio con Chilexpress usando el código CX-99812-CL.',
}
const u5: Msg = { role: 'user', content: 'Ok. ¿Y mi otro pedido, el 5102?' }
const a5: Msg = { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_03', name: 'buscar_pedido', input: { pedido_id: '5102' } }] }
const u6: Msg = { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_03', content: pick('5102') }] }
const a6: Msg = {
  role: 'assistant',
  content: 'El pedido 5102 (Chaqueta Cortaviento M) está en preparación y llega el viernes 6 de noviembre. A ese sí puedo cambiarle la dirección, si quieres.',
}

const seq: [Msg, Msg, string][] = [
  [u1, a1, 'Camila escribe. La app envía system + tools + 1 mensaje. El modelo responde pidiendo una herramienta.'],
  [u2, a2, 'Tu código ejecutó buscar_pedido y agrega el tool_result. Se reenvía TODO lo anterior más el resultado.'],
  [u3, a3, 'Nueva pregunta de Camila. El modelo no “se acuerda” del pedido: lo lee otra vez del historial reenviado.'],
  [u4, a4, 'La herramienta falla (ya despachado). El error también queda en el historial y se paga en cada llamada futura.'],
  [u5, a5, 'Otro pedido. El historial ya es más grande que la pregunta nueva.'],
  [u6, a6, 'Sexta llamada: system y tools se enviaron 6 veces; el primer mensaje de Camila, 6 veces también.'],
]

export const CALLS: Call[] = (() => {
  const out: Call[] = []
  let hist: Msg[] = []
  seq.forEach(([u, a, what], i) => {
    const prevResp = i > 0 ? [seq[i - 1][1]] : []
    hist = [...hist, ...prevResp, u]
    out.push({ messages: hist, fresh: prevResp.length + 1, response: a, what })
  })
  return out
})()

export type CallStats = { system: number; tools: number; history: number; fresh: number; input: number; output: number }

export function callStats(c: Call): CallStats {
  const toks = c.messages.map(msgTokens)
  const fresh = toks.slice(-1).reduce((s, x) => s + x, 0)
  const history = toks.slice(0, -1).reduce((s, x) => s + x, 0)
  const input = SYSTEM_TOK + TOOLS_TOK + history + fresh
  return { system: SYSTEM_TOK, tools: TOOLS_TOK, history, fresh, input, output: msgTokens(c.response) }
}

export const STATS = CALLS.map(callStats)

/** Request JSON con una línea por mensaje + las líneas nuevas (1-based). */
export function requestCode(c: Call): { code: string; add: number[] } {
  const head = [
    '{',
    `  "model": "claude-sonnet-5-5",`,
    `  "max_tokens": ${MAX_TOKENS},`,
    `  "system": ${JSON.stringify(SYSTEM_PROMPT.split('\n')[0] + ' …')},`,
    `  "tools": ["… ${TOOLS.length} definiciones: ${TOOLS.map((t) => t.name).join(', ')} …"],`,
    `  "messages": [`,
  ]
  const lines = c.messages.map((m, i) => `    ${JSON.stringify({ role: m.role, content: m.content })}${i < c.messages.length - 1 ? ',' : ''}`)
  const firstNew = head.length + (c.messages.length - c.fresh) + 1
  const add = Array.from({ length: c.fresh }, (_, i) => firstNew + i)
  return { code: [...head, ...lines, '  ]', '}'].join('\n'), add }
}

/* ------------------- Lab 2: conversación larga + ventana chica ------------------- */

export type Fact = 'pedido' | 'seguimiento'
export type LongMsg = {
  role: 'user' | 'assistant' | 'tool_result'
  text: string
  facts: Fact[]
  /** frase que aporta al resumen si se compacta */
  sum: string
}

const dev = KB_DOCS.find((d) => d.id === 'devoluciones')!
const pag = KB_DOCS.find((d) => d.id === 'pagos')!

const S_PED = 'Camila Rojas; pedido 4821 en ruta con Chilexpress (seguimiento CX-99812-CL), llega mié 4/nov.'
const S_DIR = 'Pidió cambiar la dirección: no se pudo, ya estaba despachado.'
const S_DEV = 'Devoluciones: 30 días desde la entrega, etiqueta gratis desde Mis pedidos.'
const S_PAG = 'Puede pagar hasta en 6 cuotas sin interés con tarjeta de crédito.'

export const LONG: LongMsg[] = [
  { role: 'user', text: 'Hola, soy Camila. ¿Cuándo llega mi pedido 4821?', facts: ['pedido'], sum: S_PED },
  { role: 'assistant', text: 'tool_use → buscar_pedido({"pedido_id": "4821"})', facts: ['pedido'], sum: S_PED },
  { role: 'tool_result', text: JSON.stringify(ORDERS['4821']), facts: ['pedido', 'seguimiento'], sum: S_PED },
  {
    role: 'assistant',
    text: '¡Hola, Camila! Tu pedido 4821 va en ruta con Chilexpress (seguimiento CX-99812-CL) y llega el miércoles 4 de noviembre.',
    facts: ['pedido', 'seguimiento'],
    sum: S_PED,
  },
  { role: 'user', text: '¿Puedo cambiar la dirección a Av. Apoquindo 4500, Las Condes?', facts: [], sum: S_DIR },
  {
    role: 'assistant',
    text: 'No es posible: el pedido ya fue despachado. Debes coordinar el cambio directamente con Chilexpress.',
    facts: [],
    sum: S_DIR,
  },
  { role: 'user', text: 'Ok. ¿Y si las zapatillas no me quedan, cómo las devuelvo?', facts: [], sum: S_DEV },
  { role: 'assistant', text: 'tool_use → consultar_politicas({"pregunta": "cómo devolver zapatillas"})', facts: [], sum: S_DEV },
  {
    role: 'tool_result',
    text: JSON.stringify([
      { fuente: dev.source, texto: dev.paragraphs[0] },
      { fuente: dev.source, texto: dev.paragraphs[1] },
    ]),
    facts: [],
    sum: S_DEV,
  },
  {
    role: 'assistant',
    text: 'Tienes 30 días corridos desde la entrega, sin uso y con etiquetas. Entra a Mis pedidos → Solicitar devolución y te llegará una etiqueta de despacho gratis al correo.',
    facts: [],
    sum: S_DEV,
  },
  { role: 'user', text: '¿Y aceptan pago en cuotas para comprar otra talla?', facts: [], sum: S_PAG },
  { role: 'assistant', text: `Sí. ${pag.paragraphs[0]}`, facts: [], sum: S_PAG },
  {
    role: 'user',
    text: 'Perfecto. ¿Me recuerdas el número del pedido y el código de seguimiento para llamar a Chilexpress?',
    facts: [],
    sum: '',
  },
]

export const longTok = (m: LongMsg) => countTokens(m.text) + 4
