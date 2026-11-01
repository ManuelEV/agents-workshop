import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "busqueda-hibrida",
  module: "rag",
  order: 5,
  title: "Búsqueda híbrida y reranking",
  short: "Híbrida y reranking",
  summary: "Los vectores entienden sinónimos pero fallan con códigos exactos; BM25 al revés. Combínalos con RRF y reordena con un reranker.",
  minutes: 12,
  concepts: [
    "BM25",
    "búsqueda híbrida",
    "RRF",
    "reranker",
    "cross-encoder"
  ]
}
