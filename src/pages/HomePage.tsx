import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Bot, Brain, CheckCircle2, Database, Network, Plug, ShieldCheck, User, Wrench } from 'lucide-react'
import { FlowDiagram, type FlowEdge, type FlowNode } from '../components/Flow'
import { LESSONS, lessonNumber, lessonsByModule } from '../lessons'
import { MODULES } from '../lessons/modules'
import { useVisited } from '../lib/hooks'

/* Anatomía de un agente: cada pieza enlaza con la lección que la explica. */
const NODES: (FlowNode & { lesson: string })[] = [
  { id: 'user', x: 80, y: 200, w: 130, label: 'Usuario', sub: 'pregunta', tone: 'user', icon: User, lesson: 'ventana-contexto' },
  { id: 'guard', x: 250, y: 200, w: 150, label: 'Guardrails', sub: 'filtra entrada', tone: 'guard', icon: ShieldCheck, lesson: 'guardrails' },
  { id: 'agent', x: 450, y: 200, w: 160, h: 70, label: 'Agente', sub: 'bucle LLM', tone: 'model', icon: Bot, lesson: 'loop-agente' },
  { id: 'llm', x: 450, y: 62, w: 160, label: 'LLM', sub: 'siguiente token', tone: 'model', icon: Brain, lesson: 'siguiente-token' },
  { id: 'tools', x: 680, y: 125, w: 160, label: 'Herramientas', sub: 'tool calling', tone: 'tool', icon: Wrench, lesson: 'herramientas' },
  { id: 'mcp', x: 680, y: 36, w: 160, h: 50, label: 'Servidor MCP', tone: 'user', icon: Plug, lesson: 'mcp' },
  { id: 'rag', x: 680, y: 230, w: 160, label: 'Vector store', sub: 'RAG', tone: 'data', icon: Database, lesson: 'busqueda-rag' },
  { id: 'mem', x: 450, y: 338, w: 160, label: 'Memoria', sub: 'corta y larga', tone: 'memory', icon: Brain, lesson: 'memoria' },
  { id: 'a2a', x: 680, y: 338, w: 160, label: 'Otro agente', sub: 'A2A', tone: 'tool', icon: Network, lesson: 'a2a' },
]
const EDGES: FlowEdge[] = [
  { from: 'user', to: 'guard' },
  { from: 'guard', to: 'agent' },
  { from: 'agent', to: 'llm' },
  { from: 'agent', to: 'tools' },
  { from: 'tools', to: 'mcp', dashed: true },
  { from: 'agent', to: 'rag' },
  { from: 'agent', to: 'mem' },
  { from: 'agent', to: 'a2a', dashed: true },
]
const LOOP = [
  { flows: ['user>guard'], text: 'Llega una pregunta y pasa por los guardrails' },
  { flows: ['guard>agent'], text: 'El agente arma el contexto: system prompt, historial y herramientas' },
  { flows: ['agent>mem'], text: 'Recupera lo que recuerda del usuario' },
  { flows: ['agent>llm'], text: 'El LLM predice tokens… y "decide" pedir una herramienta' },
  { flows: ['agent>tools', 'tools>mcp'], text: 'Tu código ejecuta la herramienta (aquí, vía un servidor MCP)' },
  { flows: ['agent>rag'], text: 'Busca en la base de conocimiento (RAG)' },
  { flows: ['agent>llm'], text: 'Con las observaciones, el LLM redacta la respuesta' },
  { flows: ['agent>user'], text: 'Responde al usuario, con fuentes' },
]

export function HomePage() {
  const nav = useNavigate()
  const visited = useVisited()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    document.title = 'Agents Workshop · Agentes por dentro'
  }, [])
  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => setI((x) => (x + 1) % LOOP.length), 2000)
    return () => clearTimeout(t)
  }, [i, paused])
  const first = LESSONS[0]

  return (
    <div className="home">
      <section className="home-hero">
        <div>
          <div className="eyebrow">Taller interactivo · {LESSONS.length} lecciones · 5 módulos</div>
          <h1>
            Mira cómo funcionan los <em>agentes por dentro</em>
          </h1>
          <p className="lead">
            Cada concepto con una explicación corta y un laboratorio animado: tokens que se cortan, vectores que se ubican en un mapa, un LLM
            que "decide" llamar una herramienta, mensajes JSON-RPC de MCP viajando entre procesos. Los datos son simulados; los formatos y
            algoritmos, reales.
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            {first && (
              <Link className="btn btn-primary" to={`/leccion/${first.slug}`} style={{ height: 42, padding: '0 18px', fontSize: 15 }}>
                Empezar por el principio <ArrowRight size={16} />
              </Link>
            )}
            <Link className="btn" to="/leccion/busqueda-rag" style={{ height: 42 }}>
              Ir a RAG
            </Link>
            <Link className="btn" to="/leccion/herramientas" style={{ height: 42 }}>
              Ir a herramientas
            </Link>
          </div>
        </div>
        <div className="lab" style={{ margin: 0 }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="lab-head">
            <span className="lab-badge">Mapa</span>
            <span className="lab-title">Anatomía de un agente</span>
            <span className="lab-hint">Haz clic en una pieza</span>
          </div>
          <div className="lab-body">
            <FlowDiagram
              nodes={NODES}
              edges={EDGES}
              width={780}
              height={380}
              flows={LOOP[i].flows}
              onNodeClick={(id) => {
                const n = NODES.find((x) => x.id === id)
                if (n) nav(`/leccion/${n.lesson}`)
              }}
              ariaLabel="Diagrama de las piezas de un agente"
            />
            <div className="narration" style={{ minHeight: 0, marginTop: 6 }}>
              <div className="narration-step">
                {i + 1}/{LOOP.length}
              </div>
              <div className="narration-body anim-fade" key={i} style={{ color: 'var(--text)' }}>
                {LOOP[i].text}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="module-grid">
        {MODULES.map((m) => (
          <div key={m.id} className="module-card" data-tone={m.tone}>
            <div className="eyebrow">Módulo {m.n}</div>
            <h3>{m.title}</h3>
            <p>{m.description}</p>
            <ol>
              {lessonsByModule(m.id).map((l) => (
                <li key={l.slug}>
                  <Link to={`/leccion/${l.slug}`}>
                    <span className="n">{String(lessonNumber(l.slug)).padStart(2, '0')}</span>
                    <span className="t">
                      {l.title} {visited.includes(l.slug) && <CheckCircle2 size={13} className="check" style={{ verticalAlign: '-2px' }} />}
                    </span>
                    <span className="m">{l.minutes} min</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}
