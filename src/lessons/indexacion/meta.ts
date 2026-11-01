import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "indexacion",
  module: "rag",
  order: 2,
  title: "Ingesta: chunking, vectores y vector store",
  short: "Ingesta e indexación",
  summary: "Antes de buscar hay que preparar: cortar documentos en chunks, convertir cada uno en vector y guardarlo con su metadata. Mira la tubería completa en acción.",
  minutes: 14,
  concepts: [
    "chunking",
    "solapamiento",
    "metadata",
    "upsert",
    "vector store"
  ]
}
