export type ModuleId = 'llm' | 'rag' | 'agentes' | 'protocolos' | 'produccion'

export type LessonMeta = {
  /** igual al nombre de la carpeta en src/lessons/ */
  slug: string
  module: ModuleId
  /** orden dentro del módulo */
  order: number
  title: string
  /** título corto para la barra lateral (opcional) */
  short?: string
  /** 1–2 frases: qué vas a entender */
  summary: string
  minutes: number
  /** conceptos que se ven (chips en la cabecera) */
  concepts: string[]
}
