import type { Tone } from '../components/ui'
import type { ModuleId } from './types'

export type ModuleInfo = { id: ModuleId; n: number; title: string; tone: Tone; description: string }

export const MODULES: ModuleInfo[] = [
  {
    id: 'llm',
    n: 1,
    title: 'El modelo por dentro',
    tone: 'model',
    description: 'Qué ve realmente un LLM: tokens, probabilidades y una ventana de contexto que se reenvía en cada llamada.',
  },
  {
    id: 'rag',
    n: 2,
    title: 'RAG: buscar antes de responder',
    tone: 'data',
    description: 'Embeddings, chunking, vector stores e índices: cómo el agente encuentra el párrafo correcto entre miles.',
  },
  {
    id: 'agentes',
    n: 3,
    title: 'Agentes',
    tone: 'tool',
    description: 'El ciclo razonar → actuar → observar, herramientas, memoria y cómo se coordinan varios agentes.',
  },
  {
    id: 'protocolos',
    n: 4,
    title: 'Protocolos',
    tone: 'user',
    description: 'MCP para conectar herramientas y A2A para que agentes de distintos equipos colaboren.',
  },
  {
    id: 'produccion',
    n: 5,
    title: 'Producción',
    tone: 'guard',
    description: 'Guardrails contra prompt injection, trazas, costos y evaluación de agentes reales.',
  },
]
