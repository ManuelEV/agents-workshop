import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "tokens",
  module: "llm",
  order: 1,
  title: "Tokens: cómo lee un LLM",
  short: "Tokens",
  summary: "Un LLM no ve letras ni palabras: ve números. Verás cómo un tokenizador BPE aprende a cortar texto y por qué eso afecta costo y comportamiento.",
  minutes: 12,
  concepts: [
    "tokenización",
    "BPE",
    "vocabulario",
    "IDs de token",
    "costo"
  ]
}
