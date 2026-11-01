import { useState } from 'react'
import { Database, GitPullRequest, Gauge, Rocket, ScanEye, UserCheck } from 'lucide-react'
import { FlowDiagram, type FlowEdge, type FlowNode } from '../../components/Flow'
import { Lab, Pill } from '../../components/ui'

const NODES: FlowNode[] = [
  { id: 'dataset', x: 110, y: 60, w: 180, label: 'Dataset de casos', sub: 'offline', tone: 'data', icon: Database },
  { id: 'ci', x: 330, y: 60, w: 180, label: 'Evals en CI', sub: 'gate por PR', tone: 'guard', icon: GitPullRequest },
  { id: 'deploy', x: 550, y: 60, w: 160, label: 'Despliegue', sub: 'versión nueva', tone: 'system', icon: Rocket },
  { id: 'prod', x: 550, y: 200, w: 160, label: 'Producción', sub: 'trazas OTel', tone: 'user', icon: Gauge },
  { id: 'online', x: 330, y: 200, w: 180, label: 'Evals online', sub: 'muestra de trazas', tone: 'model', icon: ScanEye },
  { id: 'review', x: 110, y: 200, w: 180, label: 'Revisión humana', sub: 'fallos confirmados', tone: 'memory', icon: UserCheck },
]

const EDGES: FlowEdge[] = [
  { from: 'dataset', to: 'ci' },
  { from: 'ci', to: 'deploy', label: 'pasa' },
  { from: 'deploy', to: 'prod' },
  { from: 'prod', to: 'online' },
  { from: 'online', to: 'review', label: 'alertas' },
  { from: 'review', to: 'dataset', label: 'casos nuevos' },
]

const INFO: Record<string, { title: string; text: string; tag: string }> = {
  dataset: {
    tag: 'offline',
    title: 'Empieza chico, desde fallos reales',
    text: '20–50 casos sacados de tickets y errores reales bastan para empezar. Incluye casos donde el agente NO debe actuar (pedido sin número, preguntas fuera de alcance).',
  },
  ci: {
    tag: 'offline',
    title: 'Cada cambio pasa por la suite',
    text: 'En cada PR corre la regresión rápida (graders de código); en main o nightly, la completa con varios intentos por caso y juez LLM. Bloquea si un caso que pasaba ahora falla.',
  },
  deploy: {
    tag: 'release',
    title: 'Versiona todo lo que cambia el comportamiento',
    text: 'Prompt, descripciones de herramientas, modelo y parámetros. Registra la versión como atributo de cada traza (app.agent.version) para comparar antes/después.',
  },
  prod: {
    tag: 'online',
    title: 'Trazas de todo',
    text: 'Cada conversación deja una traza con spans de LLM y herramientas: latencia, tokens, costo, errores. Captura el contenido de los mensajes solo si tu política de datos lo permite (puede tener datos personales).',
  },
  online: {
    tag: 'online',
    title: 'Evaluar una muestra real',
    text: 'Un juez automático puntúa un porcentaje de las trazas (p. ej. 5%) más todas las que tienen error, escalamiento o feedback negativo. Genera alertas, no bloqueos.',
  },
  review: {
    tag: 'humano',
    title: 'Las personas calibran todo',
    text: 'Alguien revisa lo marcado, confirma fallos y los convierte en casos nuevos del dataset. También compara al juez LLM con su propio criterio para saber si se puede confiar en él.',
  },
}

export function CycleLab() {
  const [sel, setSel] = useState('online')
  const out = EDGES.find((e) => e.from === sel)
  const info = INFO[sel]
  return (
    <Lab title="El ciclo: offline, CI y producción" hint="Toca una etapa">
      <FlowDiagram
        nodes={NODES}
        edges={EDGES}
        width={660}
        height={260}
        active={[sel]}
        flows={out ? [`${out.from}>${out.to}`] : []}
        onNodeClick={setSel}
        ariaLabel="Ciclo de evaluación: dataset, CI, despliegue, producción, evals online y revisión humana"
      />
      <div className="observabilidad-cycle-info anim-fade" key={sel}>
        <Pill tone={NODES.find((n) => n.id === sel)?.tone} mono>
          {info.tag}
        </Pill>{' '}
        <strong>{info.title}.</strong> {info.text}
      </div>
    </Lab>
  )
}
