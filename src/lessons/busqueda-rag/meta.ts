import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "busqueda-rag",
  module: "rag",
  order: 4,
  title: "Una consulta RAG de punta a punta",
  short: "Consulta RAG",
  summary: "Sigue una pregunta real desde que se escribe hasta la respuesta con citas: embedding de la consulta, vecinos en el mapa, top-k, prompt aumentado y generación.",
  minutes: 16,
  concepts: [
    "retrieval",
    "top-k",
    "prompt aumentado",
    "grounding",
    "citas"
  ]
}
