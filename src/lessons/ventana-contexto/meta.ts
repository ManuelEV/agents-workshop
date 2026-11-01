import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "ventana-contexto",
  module: "llm",
  order: 3,
  title: "Ventana de contexto y mensajes",
  short: "Ventana de contexto",
  summary: "El modelo no recuerda nada entre llamadas: tu aplicación le reenvía toda la conversación cada vez. Mira cómo crece la ventana y qué pasa cuando se llena.",
  minutes: 12,
  concepts: [
    "stateless",
    "messages",
    "ventana de contexto",
    "truncado",
    "resumen"
  ]
}
