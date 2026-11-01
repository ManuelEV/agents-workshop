import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "multiagente",
  module: "agentes",
  order: 5,
  title: "Patrones multi-agente",
  short: "Multi-agente",
  summary: "Router, supervisor, handoff y paralelo: anima cómo fluyen mensajes y tokens entre agentes y cuándo vale la pena cada patrón.",
  minutes: 14,
  concepts: [
    "router",
    "supervisor",
    "handoff",
    "fan-out",
    "costo"
  ]
}
