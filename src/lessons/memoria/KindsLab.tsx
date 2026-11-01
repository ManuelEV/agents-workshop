import { useState } from 'react'
import { Archive, Bot, ClipboardList, Cpu, History, User } from 'lucide-react'
import { Json } from '../../components/Code'
import { FlowDiagram, type FlowEdge, type FlowNode } from '../../components/Flow'
import { Lab, Segmented } from '../../components/ui'

type Kind = 'corta' | 'trabajo' | 'larga'

const NODES: FlowNode[] = [
  { id: 'user', x: 100, y: 175, label: 'Camila', sub: 'usuario', tone: 'user', icon: User, w: 140 },
  { id: 'app', x: 360, y: 175, label: 'Tu app', sub: 'harness / orquestador', tone: 'system', icon: Cpu, w: 180 },
  { id: 'llm', x: 690, y: 175, label: 'LLM', sub: 'solo ve su ventana', tone: 'model', icon: Bot, w: 170 },
  { id: 'hist', x: 360, y: 48, label: 'Historial', sub: 'messages[] de la sesión', tone: 'memory', icon: History, w: 200 },
  { id: 'state', x: 690, y: 310, label: 'Estado', sub: 'scratchpad / plan', tone: 'memory', icon: ClipboardList, w: 180 },
  { id: 'store', x: 360, y: 310, label: 'Memory store', sub: 'vectores + clave', tone: 'memory', icon: Archive, w: 190 },
]
const EDGES: FlowEdge[] = [
  { from: 'user', to: 'app' },
  { from: 'app', to: 'llm', label: 'prompt' },
  { from: 'hist', to: 'app' },
  { from: 'store', to: 'app', dashed: true },
  { from: 'state', to: 'llm', dashed: true },
  { from: 'state', to: 'app', dashed: true },
]

const INFO: Record<Kind, { flows: string[]; rows: [string, string][]; example: unknown; exampleTitle: string }> = {
  corta: {
    flows: ['hist>app', 'app>llm'],
    rows: [
      ['Qué guarda', 'Los mensajes de esta conversación, tal cual (incluidos tool_use y tool_result).'],
      ['Dónde vive', 'En el arreglo messages que tu app reenvía completo en cada llamada.'],
      ['Cuánto dura', 'Lo que dura la sesión… o hasta que no cabe en la ventana.'],
      ['Quién la escribe', 'Tu app, agregando cada turno.'],
      ['En frameworks', 'Sessions (ADK), checkpointers por thread_id (LangGraph), eventos de sesión (AgentCore Memory).'],
    ],
    exampleTitle: 'messages (corto plazo)',
    example: [
      { role: 'user', content: '¿Puedo cambiar las Trail Andes por talla 40?' },
      { role: 'assistant', content: 'Sí, tienes 30 días para cambios…' },
    ],
  },
  trabajo: {
    flows: ['llm>state', 'state>app'],
    rows: [
      ['Qué guarda', 'El estado de la tarea en curso: plan, pasos hechos, variables, notas intermedias.'],
      ['Dónde vive', 'Fuera del historial: un objeto de estado, un archivo de notas, una lista de tareas.'],
      ['Cuánto dura', 'Lo que dura la tarea (puede cruzar varias ventanas si compactas).'],
      ['Quién la escribe', 'El agente (con una herramienta tipo escribir_nota) o tu código.'],
      ['En frameworks', 'session.state (ADK), el State del grafo (LangGraph), un NOTES.md o lista de tareas en agentes de larga duración.'],
    ],
    exampleTitle: 'estado (memoria de trabajo)',
    example: { tarea: 'cambio_talla', cambio: 'CAM-2291', pasos: { verificar_plazo: 'ok', generar_cambio: 'ok', confirmar_retiro: 'pendiente' } },
  },
  larga: {
    flows: ['store>app', 'app>llm'],
    rows: [
      ['Qué guarda', 'Hechos destilados y duraderos sobre el usuario: preferencias, perfil, contexto.'],
      ['Dónde vive', 'En una base externa (vectorial y/o clave-valor), por usuario o tenant.'],
      ['Cuánto dura', 'Semanas o meses; con TTL, actualización y borrado.'],
      ['Quién la escribe', 'Un proceso de extracción (otra llamada al LLM) al final de la sesión o en segundo plano.'],
      ['En frameworks', 'Memory Bank (ADK / Agent Platform), estrategias de AgentCore Memory, Stores de LangGraph, capas como Mem0.'],
    ],
    exampleTitle: 'registro de memoria (largo plazo)',
    example: { user_id: 'camila.rojas', tipo: 'preferencia', clave: 'talla_zapatillas', texto: 'Usa talla 40 en zapatillas', vector: '[0.03, 0.71, …]' },
  },
}

export function KindsLab() {
  const [kind, setKind] = useState<Kind>('corta')
  const info = INFO[kind]
  const active = kind === 'corta' ? ['hist'] : kind === 'trabajo' ? ['state'] : ['store']
  return (
    <Lab title="¿Dónde vive cada memoria?" hint="Cambia el tipo de memoria">
      <Segmented
        options={[
          { value: 'corta', label: 'Corto plazo' },
          { value: 'trabajo', label: 'De trabajo' },
          { value: 'larga', label: 'Largo plazo' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <div style={{ margin: '12px 0' }}>
        <FlowDiagram nodes={NODES} edges={EDGES} width={900} height={360} flows={info.flows} active={active} dimInactive ariaLabel="Componentes de memoria de un agente" />
      </div>
      <div className="split" key={kind}>
        <div className="table-wrap anim-fade" style={{ margin: 0 }}>
          <table className="tbl">
            <tbody>
              {info.rows.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text)' }}>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="anim-fade">
          <Json value={info.example} title={info.exampleTitle} />
        </div>
      </div>
    </Lab>
  )
}
