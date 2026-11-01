import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "guardrails",
  module: "produccion",
  order: 1,
  title: "Guardrails y prompt injection",
  short: "Guardrails",
  summary: "Ataca a un agente y mira qué capa lo detiene: validación de entrada, PII, inyección indirecta desde documentos y control de herramientas.",
  minutes: 14,
  concepts: [
    "prompt injection",
    "inyección indirecta",
    "PII",
    "allowlist",
    "human-in-the-loop"
  ]
}
