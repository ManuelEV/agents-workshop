/* ==========================================================================
   Escenario compartido de las lecciones de agentes:
   "Andi", el agente de soporte de Andes Market (retail online ficticio).

   Incluye: system prompt, definiciones de herramientas en el formato real de la
   API de Anthropic (name / description / input_schema) y su equivalente OpenAI,
   una "base de datos" de pedidos y ejecutores simulados de cada herramienta.
   ========================================================================== */
import { KB_INDEX } from './corpus'
import { searchTopK } from './embed'

export const AGENT_NAME = 'Andi'
export const MODEL_ID = 'claude-sonnet-5-5'

export const SYSTEM_PROMPT = `Eres Andi, el asistente de soporte de Andes Market (retail online en Chile).
- Responde en español, breve y cordial.
- Usa las herramientas para consultar datos reales; nunca inventes estados de pedidos.
- Para preguntas de políticas, usa consultar_politicas y cita la fuente.
- Si no puedes resolver algo, crea un ticket para un humano.`

export type JsonSchema = {
  type: 'object'
  properties: Record<string, { type: string; description?: string; enum?: string[]; pattern?: string }>
  required?: string[]
}

export type ToolDef = {
  name: string
  description: string
  input_schema: JsonSchema
}

export const TOOLS: ToolDef[] = [
  {
    name: 'buscar_pedido',
    description:
      'Obtiene el estado actual de un pedido: productos, estado del despacho, courier, fecha estimada de entrega y dirección. Úsala cuando el cliente pregunte por un pedido específico.',
    input_schema: {
      type: 'object',
      properties: {
        pedido_id: { type: 'string', description: 'Número del pedido, p. ej. "4821"', pattern: '^[0-9]{4}$' },
      },
      required: ['pedido_id'],
    },
  },
  {
    name: 'cambiar_direccion',
    description:
      'Cambia la dirección de entrega de un pedido. Solo funciona si el pedido está en estado "preparando". Requiere la dirección completa.',
    input_schema: {
      type: 'object',
      properties: {
        pedido_id: { type: 'string', description: 'Número del pedido' },
        nueva_direccion: { type: 'string', description: 'Calle, número y comuna' },
      },
      required: ['pedido_id', 'nueva_direccion'],
    },
  },
  {
    name: 'consultar_politicas',
    description:
      'Busca en la base de conocimiento de Andes Market (devoluciones, envíos, pagos, garantía, cuenta). Devuelve fragmentos con su fuente.',
    input_schema: {
      type: 'object',
      properties: {
        pregunta: { type: 'string', description: 'La pregunta en lenguaje natural' },
      },
      required: ['pregunta'],
    },
  },
  {
    name: 'crear_ticket',
    description: 'Escala el caso a un ejecutivo humano. Úsala solo si no puedes resolverlo con las otras herramientas.',
    input_schema: {
      type: 'object',
      properties: {
        resumen: { type: 'string', description: 'Resumen del problema' },
        prioridad: { type: 'string', enum: ['baja', 'media', 'alta'] },
      },
      required: ['resumen', 'prioridad'],
    },
  },
]

/** Misma definición en el formato de OpenAI (Chat Completions `tools`). */
export function toOpenAITool(t: ToolDef) {
  return { type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }
}

export type Order = {
  id: string
  cliente: string
  productos: string[]
  total: number
  estado: 'preparando' | 'en_ruta' | 'entregado'
  courier: string | null
  seguimiento: string | null
  eta: string | null
  direccion: string
}

export const ORDERS: Record<string, Order> = {
  '4821': {
    id: '4821',
    cliente: 'Camila Rojas',
    productos: ['Zapatillas Trail Andes 40', 'Calcetines técnicos x3'],
    total: 54990,
    estado: 'en_ruta',
    courier: 'Chilexpress',
    seguimiento: 'CX-99812-CL',
    eta: '2026-11-04',
    direccion: 'Av. Providencia 1234, Providencia',
  },
  '5102': {
    id: '5102',
    cliente: 'Camila Rojas',
    productos: ['Chaqueta Cortaviento M'],
    total: 32990,
    estado: 'preparando',
    courier: null,
    seguimiento: null,
    eta: '2026-11-06',
    direccion: 'Av. Providencia 1234, Providencia',
  },
  '5230': {
    id: '5230',
    cliente: 'Camila Rojas',
    productos: ['Parka Andes Pro L'],
    total: 89990,
    estado: 'en_ruta',
    courier: 'RutaSur Logística',
    seguimiento: 'RS-52300-CL',
    eta: '2026-11-04',
    direccion: 'Av. Providencia 1234, Providencia',
  },
  '4790': {
    id: '4790',
    cliente: 'Camila Rojas',
    productos: ['Mochila Urbana 22L'],
    total: 27990,
    estado: 'entregado',
    courier: 'Starken',
    seguimiento: 'ST-55120',
    eta: null,
    direccion: 'Av. Providencia 1234, Providencia',
  },
}

export type ToolResult = { ok: boolean; content: unknown; ms: number }

/** Ejecuta una herramienta simulada (lo que haría TU código, no el LLM). */
export function runTool(name: string, input: Record<string, string>): ToolResult {
  switch (name) {
    case 'buscar_pedido': {
      const o = ORDERS[input.pedido_id]
      if (!o) return { ok: false, content: { error: `No existe el pedido ${input.pedido_id}` }, ms: 84 }
      return { ok: true, content: o, ms: 132 }
    }
    case 'cambiar_direccion': {
      const o = ORDERS[input.pedido_id]
      if (!o) return { ok: false, content: { error: `No existe el pedido ${input.pedido_id}` }, ms: 90 }
      if (o.estado !== 'preparando')
        return {
          ok: false,
          content: { error: 'pedido_ya_despachado', detalle: `El pedido está "${o.estado}". Coordinar con ${o.courier}.` },
          ms: 118,
        }
      return { ok: true, content: { ok: true, pedido_id: o.id, direccion: input.nueva_direccion }, ms: 205 }
    }
    case 'consultar_politicas': {
      const hits = searchTopK(input.pregunta ?? '', KB_INDEX, 2)
      return {
        ok: true,
        content: hits.map((h) => ({ fuente: h.item.source, score: Number(h.score.toFixed(3)), texto: h.item.text })),
        ms: 341,
      }
    }
    case 'crear_ticket':
      return { ok: true, content: { ticket: 'TK-20931', prioridad: input.prioridad, sla: '4 horas hábiles' }, ms: 160 }
    default:
      return { ok: false, content: { error: `Herramienta desconocida: ${name}` }, ms: 2 }
  }
}

/** Precios de referencia (US$ por millón de tokens) usados en las simulaciones de costo. */
export const PRICING = { inputPerM: 3, outputPerM: 15, cachedInputPerM: 0.3 }
