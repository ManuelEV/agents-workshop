/* Datos de la traza (a partir de la misma ejecución de la lección loop-agente)
   y del dataset de evaluación. Todo simulado, con nombres de atributos de las
   convenciones semánticas GenAI de OpenTelemetry (estado Development). */
import { MODEL_ID } from '../../sim/scenario'
import { LLM_MS, RUN_CALLS, TOOL_EXECS, usageCost } from '../loop-agente/run'

export type SpanKind = 'agent' | 'chat' | 'tool'
export type Span = {
  id: string
  name: string
  kind: SpanKind
  parent?: string
  start: number
  end: number
  error?: boolean
  attrs: Record<string, string | number | string[]>
  /** atributos propios de la app (no son de la convención) */
  custom?: Record<string, string | number>
}

const c1s = 18
const c1e = c1s + LLM_MS[0]
const t1s = c1e + 8
const t1e = t1s + TOOL_EXECS[0].result.ms
const c2s = t1e + 12
const c2e = c2s + LLM_MS[1]
const t2s = c2e + 8
const t2e = t2s + TOOL_EXECS[1].result.ms
const c3s = t2e + 12
const c3e = c3s + LLM_MS[2]
export const TRACE_END = c3e + 17

function chat(i: number, start: number, end: number): Span {
  const r = RUN_CALLS[i]
  return {
    id: `chat${i + 1}`,
    name: `chat ${MODEL_ID}`,
    kind: 'chat',
    parent: 'root',
    start,
    end,
    attrs: {
      'gen_ai.operation.name': 'chat',
      'gen_ai.provider.name': 'anthropic',
      'gen_ai.request.model': MODEL_ID,
      'gen_ai.request.max_tokens': 1024,
      'gen_ai.response.id': r.id,
      'gen_ai.response.model': r.model,
      'gen_ai.response.finish_reasons': [r.stop_reason],
      'gen_ai.usage.input_tokens': r.usage.input_tokens,
      'gen_ai.usage.output_tokens': r.usage.output_tokens,
      'server.address': 'api.anthropic.com',
    },
    custom: { 'app.cost_usd': Number(usageCost(r.usage).toFixed(5)), 'app.iteration': i + 1 },
  }
}

function tool(i: number, start: number, end: number): Span {
  const e = TOOL_EXECS[i]
  const err = !e.result.ok
  const attrs: Span['attrs'] = {
    'gen_ai.operation.name': 'execute_tool',
    'gen_ai.tool.name': e.name,
    'gen_ai.tool.call.id': e.id,
    'gen_ai.tool.type': 'function',
  }
  if (err) attrs['error.type'] = String((e.result.content as { error?: string }).error ?? 'error')
  return { id: `tool${i + 1}`, name: `execute_tool ${e.name}`, kind: 'tool', parent: 'root', start, end, error: err, attrs, custom: { 'app.tool.args': JSON.stringify(e.input) } }
}

export const SPANS: Span[] = [
  {
    id: 'root',
    name: 'invoke_agent Andi',
    kind: 'agent',
    start: 0,
    end: TRACE_END,
    attrs: {
      'gen_ai.operation.name': 'invoke_agent',
      'gen_ai.agent.name': 'Andi',
      'gen_ai.agent.id': 'agt_andi_soporte',
      'gen_ai.conversation.id': 'conv_7f3a91c2',
      'gen_ai.provider.name': 'anthropic',
      'gen_ai.request.model': MODEL_ID,
    },
    custom: { 'app.agent.version': '2026.10.3', 'app.channel': 'web', 'app.iterations': 3 },
  },
  chat(0, c1s, c1e),
  tool(0, t1s, t1e),
  chat(1, c2s, c2e),
  tool(1, t2s, t2e),
  chat(2, c3s, c3e),
]

/* ----------------------------- Evaluación ----------------------------- */

export type Scores = { correctitud: number; herramientas: number; fundamentacion: number; tono: number }
export type Judge = Scores & { justificacion: string }
export type RunOut = { tools: string[]; answer: string; judge: Judge; traj: boolean; trajNote: string }
export type EvalCase = {
  id: number
  q: string
  expected: string
  reference: string
  v1: RunOut
  v2: RunOut
}


const C1: RunOut = {
  tools: ['buscar_pedido(4821)'],
  answer: 'Tu pedido va en ruta con Chilexpress (CX-99812-CL) y llega estimado el 4 de noviembre.',
  judge: { justificacion: 'Datos coinciden con buscar_pedido; usa la herramienta correcta; breve y cordial.', correctitud: 3, herramientas: 3, fundamentacion: 3, tono: 3 },
  traj: true,
  trajNote: 'llamó buscar_pedido con "4821"',
}
const C2: RunOut = {
  tools: ['consultar_politicas'],
  answer: 'Entre 5 y 10 días hábiles desde que recibimos el producto en bodega (fuente: politicas/devoluciones.md).',
  judge: { justificacion: 'Plazo correcto y citado; herramienta adecuada.', correctitud: 3, herramientas: 3, fundamentacion: 3, tono: 3 },
  traj: true,
  trajNote: 'llamó consultar_politicas',
}
const C5: RunOut = {
  tools: ['buscar_pedido(4790)', 'consultar_politicas'],
  answer: 'Lo siento. Tienes garantía: repórtalo dentro de 48 horas con fotos y elige reparación, cambio o devolución (politicas/garantia.md).',
  judge: { justificacion: 'Aplica la política de garantía correcta y la cita; empático.', correctitud: 3, herramientas: 3, fundamentacion: 3, tono: 3 },
  traj: true,
  trajNote: 'pedido + política',
}
const C7: RunOut = {
  tools: [],
  answer: 'No tengo información del clima. Puedo ayudarte con pedidos, envíos, pagos o devoluciones.',
  judge: { justificacion: 'Fuera de alcance: lo reconoce y redirige sin inventar.', correctitud: 3, herramientas: 3, fundamentacion: 3, tono: 3 },
  traj: true,
  trajNote: 'sin herramientas (correcto)',
}

export const EVAL_CASES: EvalCase[] = [
  { id: 1, q: '¿Dónde está mi pedido 4821?', expected: 'buscar_pedido → estado, courier y fecha', reference: 'En ruta con Chilexpress, CX-99812-CL, ETA 04-11.', v1: C1, v2: C1 },
  {
    id: 2,
    q: '¿Cuánto demora el reembolso si pagué con tarjeta?',
    expected: 'consultar_politicas → plazo citado',
    reference: '5 a 10 días hábiles desde la recepción en bodega.',
    v1: C2,
    v2: C2,
  },
  {
    id: 3,
    q: 'Cambia la dirección del pedido 5102 a Av. Grecia 2001, Ñuñoa',
    expected: 'cambiar_direccion(5102) → confirmación',
    reference: 'Dirección actualizada (el pedido está "preparando").',
    v1: {
      tools: ['buscar_pedido(5102)', 'cambiar_direccion(5102)'],
      answer: 'Listo: tu pedido 5102 se entregará en Av. Grecia 2001, Ñuñoa.',
      judge: { justificacion: 'Verifica el estado, ejecuta el cambio y confirma.', correctitud: 3, herramientas: 3, fundamentacion: 3, tono: 3 },
      traj: true,
      trajNote: 'llamó cambiar_direccion',
    },
    v2: {
      tools: ['buscar_pedido(5102)'],
      answer: '¿Confirmas que quieres cambiar la dirección del pedido 5102 a Av. Grecia 2001, Ñuñoa?',
      judge: { justificacion: 'Pide confirmación aunque el cliente ya fue explícito; el cambio no se hizo.', correctitud: 2, herramientas: 2, fundamentacion: 3, tono: 3 },
      traj: false,
      trajNote: 'falta cambiar_direccion',
    },
  },
  {
    id: 4,
    q: '¿Puedo devolver un traje de baño que no me quedó?',
    expected: 'consultar_politicas → excepción de higiene',
    reference: 'No: trajes de baño sin devolución por higiene, salvo falla de fábrica.',
    v1: {
      tools: [],
      answer: '¡Sí! Tienes 30 días para devolver cualquier producto sin uso y con etiquetas.',
      judge: { justificacion: 'Ignora la excepción de higiene; responde de memoria sin consultar la política.', correctitud: 1, herramientas: 1, fundamentacion: 1, tono: 3 },
      traj: false,
      trajNote: 'no llamó consultar_politicas',
    },
    v2: {
      tools: ['consultar_politicas'],
      answer: 'Los trajes de baño no tienen devolución por higiene, salvo que tengan una falla de fábrica (politicas/devoluciones.md).',
      judge: { justificacion: 'Aplica la excepción correcta y cita la fuente.', correctitud: 3, herramientas: 3, fundamentacion: 3, tono: 3 },
      traj: true,
      trajNote: 'llamó consultar_politicas',
    },
  },
  { id: 5, q: 'Mi pedido 4790 llegó con la mochila rota', expected: 'buscar_pedido + consultar_politicas (garantía)', reference: 'Garantía: reportar en 48 h con fotos.', v1: C5, v2: C5 },
  {
    id: 6,
    q: '¿Dónde está mi pedido?',
    expected: 'sin herramientas → pedir el número',
    reference: 'Pedir el número de pedido.',
    v1: {
      tools: ['buscar_pedido(4821)'],
      answer: 'Tu pedido 4821 va en ruta con Chilexpress y llega el 4 de noviembre.',
      judge: { justificacion: 'Inventa un pedido_id que el cliente no dio; podría exponer datos de otra persona.', correctitud: 1, herramientas: 1, fundamentacion: 2, tono: 3 },
      traj: false,
      trajNote: 'llamó buscar_pedido con un id inventado',
    },
    v2: {
      tools: [],
      answer: '¡Claro! ¿Me das el número de tu pedido? Está en el correo de confirmación.',
      judge: { justificacion: 'Pide el dato faltante en vez de inventarlo.', correctitud: 3, herramientas: 3, fundamentacion: 3, tono: 3 },
      traj: true,
      trajNote: 'sin herramientas (correcto)',
    },
  },
  { id: 7, q: '¿Va a llover mañana en Santiago?', expected: 'sin herramientas → fuera de alcance', reference: 'Declinar con amabilidad y redirigir.', v1: C7, v2: C7 },
  {
    id: 8,
    q: 'Llevo 3 días sin respuesta, quiero hablar con una persona',
    expected: 'crear_ticket(prioridad="alta")',
    reference: 'Ticket con prioridad alta y disculpa.',
    v1: {
      tools: ['crear_ticket(media)'],
      answer: 'Creé el ticket TK-20931. Te contactarán en 4 horas hábiles.',
      judge: { justificacion: 'Escala, pero con prioridad media pese a 3 días de espera; no reconoce la molestia.', correctitud: 2, herramientas: 2, fundamentacion: 3, tono: 2 },
      traj: false,
      trajNote: 'prioridad = "media" (se esperaba "alta")',
    },
    v2: {
      tools: ['crear_ticket(alta)'],
      answer: 'Lamento la espera. Creé el ticket TK-20931 con prioridad alta; un ejecutivo te contactará en menos de 4 horas hábiles.',
      judge: { justificacion: 'Prioridad correcta y tono empático.', correctitud: 3, herramientas: 3, fundamentacion: 3, tono: 3 },
      traj: true,
      trajNote: 'prioridad = "alta"',
    },
  },
]

export const passes = (r: RunOut) => r.traj && r.judge.correctitud === 3 && Math.min(r.judge.herramientas, r.judge.fundamentacion, r.judge.tono) >= 2
