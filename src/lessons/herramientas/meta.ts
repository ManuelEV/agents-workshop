import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "herramientas",
  module: "agentes",
  order: 2,
  title: "Herramientas: a mano, nativo y con frameworks",
  short: "Herramientas (tools)",
  summary: "Implementa la misma herramienta tres veces: parseando texto a mano, con function calling nativo y con un framework que genera el esquema desde tu función.",
  minutes: 18,
  concepts: [
    "tool calling",
    "JSON Schema",
    "tool_use",
    "tool_result",
    "@tool"
  ]
}
