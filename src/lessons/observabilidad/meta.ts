import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "observabilidad",
  module: "produccion",
  order: 2,
  title: "Trazas, costos y evaluación",
  short: "Observabilidad y evals",
  summary: "Una ejecución de agente vista como traza: spans, tokens, latencia y costo por paso. Y cómo evaluar si responde bien con un juez LLM.",
  minutes: 14,
  concepts: [
    "trazas",
    "spans",
    "OpenTelemetry",
    "costo por tarea",
    "LLM-as-judge"
  ]
}
