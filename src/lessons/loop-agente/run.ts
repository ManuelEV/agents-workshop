/* ==========================================================================
   Una ejecución completa (simulada, pero con la forma real de la Messages API
   de Anthropic) del agente Andi. La reutiliza también la lección de
   observabilidad para construir la traza.
   ========================================================================== */
import type { Block, Msg } from '../../components/Messages'
import { MODEL_ID, PRICING, SYSTEM_PROMPT, TOOLS, runTool, type ToolResult } from '../../sim/scenario'

export const USER_QUESTION = 'Hola, ¿dónde está mi pedido 4821? ¿Puedo cambiar la dirección a Av. Grecia 2001, Ñuñoa?'
export const NEW_ADDRESS = 'Av. Grecia 2001, Ñuñoa'

export type Usage = { input_tokens: number; output_tokens: number }

export type ApiResponse = {
  id: string
  type: 'message'
  role: 'assistant'
  model: string
  content: Block[]
  stop_reason: 'tool_use' | 'end_turn' | 'max_tokens'
  stop_sequence: null
  usage: Usage
}

export type ToolExec = {
  id: string
  name: string
  input: Record<string, string>
  result: ToolResult
}

const EXEC_1: ToolExec = {
  id: 'toolu_01HJq8V2rN5YtK',
  name: 'buscar_pedido',
  input: { pedido_id: '4821' },
  result: runTool('buscar_pedido', { pedido_id: '4821' }),
}
const EXEC_2: ToolExec = {
  id: 'toolu_01Pz3sWc7GmQ4e',
  name: 'cambiar_direccion',
  input: { pedido_id: '4821', nueva_direccion: NEW_ADDRESS },
  result: runTool('cambiar_direccion', { pedido_id: '4821', nueva_direccion: NEW_ADDRESS }),
}
export const TOOL_EXECS: ToolExec[] = [EXEC_1, EXEC_2]

export const FINAL_TEXT = `Tu pedido 4821 ya va en camino con Chilexpress (seguimiento CX-99812-CL) y debería llegar el 4 de noviembre a Av. Providencia 1234.

No pude cambiar la dirección: el pedido ya fue despachado y en ese estado el cambio no se hace desde la tienda. Te propongo:
1. Coordinar el cambio directamente con Chilexpress con tu número de seguimiento.
2. Si prefieres, creo un ticket para que un ejecutivo te ayude.
¿Cuál prefieres?`

export const RUN_CALLS: ApiResponse[] = [
  {
    id: 'msg_01XFDUDYJgAACzvnptvVoYEL',
    type: 'message',
    role: 'assistant',
    model: MODEL_ID,
    content: [
      { type: 'text', text: 'Reviso tu pedido 4821.' },
      { type: 'tool_use', id: EXEC_1.id, name: EXEC_1.name, input: EXEC_1.input },
    ],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 1248, output_tokens: 74 },
  },
  {
    id: 'msg_01Bq7kV9TnRrzE2mW5cYhL3a',
    type: 'message',
    role: 'assistant',
    model: MODEL_ID,
    content: [
      { type: 'text', text: 'El pedido ya va en ruta con Chilexpress. Intento el cambio de dirección.' },
      { type: 'tool_use', id: EXEC_2.id, name: EXEC_2.name, input: EXEC_2.input },
    ],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 1530, output_tokens: 88 },
  },
  {
    id: 'msg_01M4dJx8cQp2HnT6sVbW1uKe',
    type: 'message',
    role: 'assistant',
    model: MODEL_ID,
    content: [{ type: 'text', text: FINAL_TEXT }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1702, output_tokens: 171 },
  },
]

/** Bloque tool_result tal como lo arma TU código. */
export function toolResultBlock(e: ToolExec): Block {
  return {
    type: 'tool_result',
    tool_use_id: e.id,
    content: JSON.stringify(e.result.content),
    ...(e.result.ok ? {} : { is_error: true }),
  }
}

/** El arreglo `messages` completo al final de la ejecución. */
export const RUN_MESSAGES: Msg[] = [
  { role: 'user', content: USER_QUESTION },
  { role: 'assistant', content: RUN_CALLS[0].content, note: 'llamada 1' },
  { role: 'user', content: [toolResultBlock(EXEC_1)], note: 'resultado de herramienta' },
  { role: 'assistant', content: RUN_CALLS[1].content, note: 'llamada 2' },
  { role: 'user', content: [toolResultBlock(EXEC_2)], note: 'resultado de herramienta' },
  { role: 'assistant', content: RUN_CALLS[2].content, note: 'llamada 3' },
]

/** Cuerpo de la primera petición (herramientas 2..4 abreviadas para que quepa). */
export const FIRST_REQUEST = {
  model: MODEL_ID,
  max_tokens: 1024,
  system: SYSTEM_PROMPT,
  tools: TOOLS.map((t, i) => (i === 0 ? t : { name: t.name, description: t.description.slice(0, 38) + '…', input_schema: '{…}' })),
  messages: [{ role: 'user', content: USER_QUESTION }],
}

export const usageCost = (u: Usage) => (u.input_tokens * PRICING.inputPerM + u.output_tokens * PRICING.outputPerM) / 1e6

/** Duraciones simuladas (ms) de cada llamada al LLM; dominadas por los tokens de salida. */
export const LLM_MS = [1420, 1430, 2865]
