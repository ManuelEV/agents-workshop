/* Respuestas "generadas" para las consultas de ejemplo.
   Cada oración depende de un chunk: si ese chunk no llegó al prompt (k muy bajo,
   umbral muy alto) la oración no se puede generar. Así se ve cómo la
   recuperación limita lo que el modelo puede responder con fundamento. */
import type { KbChunk } from '../../sim/corpus'
import type { Embedded } from '../../sim/embed'

type Sentence = { chunk: string; text: string }
type AnswerSpec = { sentences: Sentence[]; offTopic?: boolean }

export const ANSWERS: Record<string, AnswerSpec> = {
  '¿Cuánto demora el reembolso si pagué con tarjeta?': {
    sentences: [
      {
        chunk: 'devoluciones#3',
        text: 'El reembolso se hace al mismo medio de pago: con tarjeta de crédito o débito demora entre 5 y 10 días hábiles desde que el producto llega a nuestra bodega.',
      },
      { chunk: 'pagos#2', text: 'Si lo que ves es un cargo pendiente de un pago rechazado, ese se libera solo en 72 horas.' },
    ],
  },
  '¿Puedo cambiar la dirección de mi pedido?': {
    sentences: [
      {
        chunk: 'envios#4',
        text: 'Solo puedes cambiar la dirección mientras el pedido está en preparación; si ya fue despachado, debes coordinarlo directamente con el courier.',
      },
      { chunk: 'envios#3', text: 'Puedes revisar en qué estado está con el número de seguimiento que te llegó por correo.' },
    ],
  },
  'Me llegó la zapatilla rota, ¿qué hago?': {
    sentences: [
      {
        chunk: 'garantia#1',
        text: 'Lamento lo ocurrido. Repórtalo dentro de 48 horas con fotos: el producto tiene 6 meses de garantía legal por fallas de fabricación.',
      },
      { chunk: 'devoluciones#2', text: 'Puedes iniciar el trámite desde Mis pedidos → Solicitar devolución, y te enviamos una etiqueta de despacho gratuita.' },
    ],
  },
  '¿El envío es gratis?': {
    sentences: [
      { chunk: 'envios#2', text: 'Sí, el envío es gratis en compras sobre $39.990; bajo ese monto el costo depende de la comuna y del peso del paquete.' },
      { chunk: 'envios#5', text: 'Otra opción sin costo es el retiro en tienda, disponible en 24 horas.' },
    ],
  },
  'Olvidé mi contraseña': {
    sentences: [
      { chunk: 'cuenta#1', text: 'Usa la opción Recuperar clave en la página de inicio de sesión: te llegará un enlace al correo que vence en 30 minutos.' },
      { chunk: 'cuenta#3', text: 'Ojo: tras 5 intentos fallidos la cuenta se bloquea por 15 minutos.' },
    ],
  },
  '¿Va a llover mañana en Santiago?': { sentences: [], offTopic: true },
}

export const NO_INFO =
  'No encontré información sobre eso en la base de conocimiento de Andes Market. ¿Quieres que te derive con un ejecutivo?'

export type GeneratedAnswer = {
  /** partes del texto: string o número de cita */
  parts: (string | number)[]
  /** ids de chunks citados en orden */
  cited: string[]
  grounded: boolean
  note?: string
}

/** Compone la respuesta a partir de los chunks que realmente llegaron al prompt. */
export function generateAnswer(query: string, passed: Embedded<KbChunk>[]): GeneratedAnswer {
  const spec = ANSWERS[query]
  const pos = (id: string) => passed.findIndex((p) => p.id === id) + 1

  if (spec) {
    if (spec.offTopic) {
      if (passed.length === 0) return { parts: [NO_INFO], cited: [], grounded: true }
      return {
        parts: ['Los fragmentos que encontré hablan de ', passed[0].docTitle.toLowerCase(), ', no del clima: no tengo información para responder eso.'],
        cited: [],
        grounded: true,
        note: 'El umbral dejó pasar fragmentos irrelevantes. Un buen system prompt ("si no está en los documentos, dilo") evita que el modelo invente.',
      }
    }
    const usable = spec.sentences.filter((s) => pos(s.chunk) > 0)
    if (usable.length === 0) {
      return {
        parts: [NO_INFO],
        cited: [],
        grounded: true,
        note: 'El fragmento con la respuesta no llegó al prompt (k muy bajo o umbral muy alto).',
      }
    }
    const parts: (string | number)[] = []
    usable.forEach((s, i) => {
      if (i > 0) parts.push(' ')
      parts.push(s.text + ' ', pos(s.chunk))
    })
    const missing = spec.sentences.length - usable.length
    return {
      parts,
      cited: usable.map((s) => s.chunk),
      grounded: true,
      note: missing > 0 ? 'La respuesta salió incompleta: faltó un fragmento útil en el top-k.' : undefined,
    }
  }

  // consulta libre: respuesta extractiva simple a partir de los fragmentos
  if (passed.length === 0) return { parts: [NO_INFO], cited: [], grounded: true }
  const first = (t: string) => t.split(/(?<=\.)\s/)[0]
  const parts: (string | number)[] = [`Según ${passed[0].docTitle.toLowerCase()}: ${first(passed[0].text)} `, 1]
  if (passed[1]) parts.push(` Además: ${first(passed[1].text)} `, 2)
  return {
    parts,
    cited: passed.slice(0, 2).map((p) => p.id),
    grounded: true,
    note: 'Respuesta simulada: para consultas libres el "modelo" parafrasea los fragmentos recuperados.',
  }
}
