import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "loop-agente",
  module: "agentes",
  order: 1,
  title: "El ciclo del agente",
  short: "Ciclo del agente",
  summary: "Un agente es un LLM dentro de un bucle: razona, pide una herramienta, observa el resultado y repite hasta terminar. Recorre una ejecución real paso a paso.",
  minutes: 14,
  concepts: [
    "ReAct",
    "stop_reason",
    "bucle",
    "observación",
    "máx. iteraciones"
  ]
}
