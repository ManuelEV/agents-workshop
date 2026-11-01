import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "decision-herramienta",
  module: "agentes",
  order: 3,
  title: "Cómo \"decide\" el LLM usar una herramienta",
  short: "¿Cómo decide?",
  summary: "No hay un if escondido: las herramientas se convierten en texto dentro del prompt y el modelo predice tokens. Mira la decisión token a token y qué la cambia.",
  minutes: 14,
  concepts: [
    "tool choice",
    "descripciones",
    "probabilidades",
    "decodificación restringida"
  ]
}
