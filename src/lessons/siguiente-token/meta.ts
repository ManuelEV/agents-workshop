import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "siguiente-token",
  module: "llm",
  order: 2,
  title: "Predicción del siguiente token",
  short: "Siguiente token",
  summary: "Todo lo que genera un LLM sale de repetir una sola operación: elegir el próximo token a partir de una distribución de probabilidad. Juega con temperatura y top-p.",
  minutes: 14,
  concepts: [
    "logits",
    "softmax",
    "temperatura",
    "top-p",
    "autoregresivo"
  ]
}
