import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "indice-hnsw",
  module: "rag",
  order: 3,
  title: "Cómo busca rápido un vector store (HNSW)",
  short: "Índice HNSW",
  summary: "Comparar la consulta con millones de vectores uno por uno es lento. HNSW navega un grafo por capas para encontrar vecinos en milisegundos. Míralo saltar.",
  minutes: 12,
  concepts: [
    "kNN exacto",
    "ANN",
    "HNSW",
    "recall vs latencia"
  ]
}
