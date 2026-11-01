import { useState } from 'react'
import { ArrowRight, Bot, Check, Code2, X } from 'lucide-react'
import { Lab, Pill, Segmented, type Tone } from '../../components/ui'

/* -------------------------------------------------------------------------- */
/* ¿Quién hace qué? (intuición)                                                */
/* -------------------------------------------------------------------------- */

type Who = 'llm' | 'code'
const ACTIONS: { text: string; who: Who; why: string }[] = [
  { text: 'Decide que hay que consultar el pedido', who: 'llm', why: 'Genera un bloque tool_use; es solo texto estructurado.' },
  { text: 'Consulta la base de datos de pedidos', who: 'code', why: 'El modelo no tiene red ni base de datos: tu función hace la consulta.' },
  { text: 'Escribe los argumentos {"pedido_id": "4821"}', who: 'llm', why: 'Los argumentos son tokens generados por el modelo.' },
  { text: 'Valida que pedido_id tenga 4 dígitos', who: 'code', why: 'Nunca confíes ciegamente en los argumentos: valida antes de ejecutar.' },
  { text: 'Agrega el tool_result a messages', who: 'code', why: 'El historial lo administras tú; el modelo no guarda estado.' },
  { text: 'Decide que ya puede responder', who: 'llm', why: 'Termina su turno sin pedir herramientas: stop_reason "end_turn".' },
  { text: 'Corta el loop tras 10 iteraciones', who: 'code', why: 'Los límites viven en el harness; el modelo no sabe cuánto lleva gastado.' },
  { text: 'Redacta la respuesta final', who: 'llm', why: 'Texto generado a partir de todo lo que hay en el contexto.' },
]

export function WhoLab() {
  const [ans, setAns] = useState<Record<number, Who>>({})
  const answered = Object.keys(ans).length
  const right = ACTIONS.filter((a, i) => ans[i] === a.who).length
  return (
    <Lab
      title="¿Quién hace qué: el modelo o tu código?"
      hint="Clasifica cada acción"
      footer={
        <div className="row small" style={{ justifyContent: 'space-between' }}>
          <span>
            {answered}/{ACTIONS.length} respondidas · <strong>{right}</strong> correctas
          </span>
          {answered > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={() => setAns({})}>
              Reiniciar
            </button>
          )}
        </div>
      }
    >
      <div className="loop-agente-who">
        {ACTIONS.map((a, i) => {
          const g = ans[i]
          const ok = g === a.who
          return (
            <div key={i} className={`loop-agente-who-item${g ? (ok ? ' is-ok' : ' is-bad') : ''}`}>
              <div className="loop-agente-who-text">{a.text}</div>
              <div className="row" style={{ gap: 6 }}>
                <button className={`btn btn-sm loop-agente-who-btn${g === 'llm' ? ' is-picked' : ''}`} data-tone="model" onClick={() => setAns({ ...ans, [i]: 'llm' })}>
                  <Bot size={14} /> LLM
                </button>
                <button className={`btn btn-sm loop-agente-who-btn${g === 'code' ? ' is-picked' : ''}`} data-tone="tool" onClick={() => setAns({ ...ans, [i]: 'code' })}>
                  <Code2 size={14} /> Tu código
                </button>
              </div>
              {g && (
                <div className="loop-agente-who-why anim-fade">
                  {ok ? <Check size={14} /> : <X size={14} />} <strong>{a.who === 'llm' ? 'LLM' : 'Tu código'}.</strong> {a.why}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Lab>
  )
}

/* -------------------------------------------------------------------------- */
/* ReAct (texto) ↔ tool calling nativo                                          */
/* -------------------------------------------------------------------------- */

type Kind = 'thought' | 'action' | 'obs' | 'final'
const KIND_TONE: Record<Kind, Tone> = { thought: 'model', action: 'tool', obs: 'data', final: 'ok' }

const REACT: { id: number; kind: Kind; text: string }[] = [
  { id: 1, kind: 'thought', text: 'Thought: Quiere saber dónde está el pedido 4821 y cambiar la dirección. Primero reviso el pedido.' },
  { id: 2, kind: 'action', text: 'Action: buscar_pedido[4821]' },
  { id: 3, kind: 'obs', text: 'Observation: {"estado": "en_ruta", "courier": "Chilexpress", "eta": "2026-11-04"}' },
  { id: 4, kind: 'thought', text: 'Thought: Va en ruta. Intento cambiar la dirección.' },
  { id: 5, kind: 'action', text: 'Action: cambiar_direccion[4821 | Av. Grecia 2001, Ñuñoa]' },
  { id: 6, kind: 'obs', text: 'Observation: {"error": "pedido_ya_despachado"}' },
  { id: 7, kind: 'thought', text: 'Thought: No se puede cambiar. Explico y ofrezco alternativas.' },
  { id: 8, kind: 'final', text: 'Final Answer: Tu pedido 4821 va en camino con Chilexpress…' },
]

const NATIVE: { id: number; role: string; tone: Tone; text: string }[] = [
  { id: 1, role: 'assistant · text', tone: 'model', text: '"Reviso tu pedido 4821."  (o un bloque thinking)' },
  { id: 2, role: 'assistant · tool_use', tone: 'tool', text: 'buscar_pedido {"pedido_id": "4821"} → stop_reason: "tool_use"' },
  { id: 3, role: 'user · tool_result', tone: 'data', text: '{"estado": "en_ruta", "courier": "Chilexpress", …}' },
  { id: 4, role: 'assistant · text', tone: 'model', text: '"El pedido ya va en ruta… Intento el cambio."' },
  { id: 5, role: 'assistant · tool_use', tone: 'tool', text: 'cambiar_direccion {"pedido_id": "4821", "nueva_direccion": "…"}' },
  { id: 6, role: 'user · tool_result', tone: 'data', text: 'is_error: true · {"error": "pedido_ya_despachado", …}' },
  { id: 7, role: '(implícito)', tone: 'system', text: 'El razonamiento queda dentro del modelo, o en bloques thinking si activas extended thinking.' },
  { id: 8, role: 'assistant · text', tone: 'ok', text: '"Tu pedido 4821 ya va en camino…" → stop_reason: "end_turn"' },
]

export function ReactLab() {
  const [hl, setHl] = useState(2)
  const r = REACT.find((x) => x.id === hl)!
  const how: Record<Kind, string> = {
    thought: 'En ReAct el razonamiento se escribía como texto visible. Hoy suele ser un bloque text breve, un bloque thinking o simplemente no aparece.',
    action: 'En 2022 tu código buscaba "Action: nombre[arg]" con una expresión regular. Hoy la API devuelve un bloque tool_use con JSON ya parseado.',
    obs: 'Antes: cortabas la generación con la secuencia de parada "Observation:" y pegabas el resultado como texto. Hoy: un bloque tool_result con tool_use_id.',
    final: 'Antes: buscabas "Final Answer:". Hoy: stop_reason "end_turn" te dice que el turno terminó.',
  }
  return (
    <Lab title="ReAct (2022) vs. tool calling nativo (hoy)" hint="Toca una línea para ver su equivalente">
      <div className="grid-2">
        <div>
          <div className="label" style={{ marginBottom: 6 }}>
            ReAct · todo es texto en el prompt
          </div>
          <div className="loop-agente-react">
            {REACT.map((l) => (
              <button key={l.id} className={`loop-agente-react-line${hl === l.id ? ' is-hl' : ''}`} data-tone={KIND_TONE[l.kind]} onClick={() => setHl(l.id)}>
                {l.text}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>
            Messages API · bloques estructurados
          </div>
          <div className="loop-agente-react">
            {NATIVE.map((l) => (
              <button key={l.id} className={`loop-agente-native${hl === l.id ? ' is-hl' : ''}`} data-tone={l.tone} onClick={() => setHl(l.id)}>
                <span className="mono loop-agente-native-role">{l.role}</span>
                <span>{l.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="loop-agente-react-how anim-fade" key={hl} data-tone={KIND_TONE[r.kind]}>
        <Pill tone={KIND_TONE[r.kind]} mono>
          {r.kind === 'thought' ? 'Thought' : r.kind === 'action' ? 'Action' : r.kind === 'obs' ? 'Observation' : 'Final Answer'}
        </Pill>{' '}
        {how[r.kind]}
      </div>
    </Lab>
  )
}

/* -------------------------------------------------------------------------- */
/* Workflow vs agente                                                          */
/* -------------------------------------------------------------------------- */

type Route = 'pedido' | 'direccion' | 'politica'
type Case = {
  id: string
  label: string
  text: string
  route: Route
  wfOk: boolean
  wfNote: string
  agent: string[]
  agentNote: string
}

const CASES: Case[] = [
  {
    id: 'a',
    label: 'Estado',
    text: '¿Dónde está mi pedido 4821?',
    route: 'pedido',
    wfOk: true,
    wfNote: 'Ruta perfecta para un workflow: predecible y barata.',
    agent: ['buscar_pedido'],
    agentNote: 'Mismo resultado, con la misma cantidad de llamadas.',
  },
  {
    id: 'b',
    label: 'Política',
    text: '¿Cuánto demora el reembolso si pagué con tarjeta?',
    route: 'politica',
    wfOk: true,
    wfNote: 'El clasificador acierta y la ruta fija resuelve.',
    agent: ['consultar_politicas'],
    agentNote: 'Equivalente; el agente no aporta nada aquí.',
  },
  {
    id: 'c',
    label: 'Compuesto',
    text: '¿Dónde está mi pedido 4821? ¿Puedo cambiar la dirección a Av. Grecia 2001?',
    route: 'pedido',
    wfOk: false,
    wfNote: 'El clasificador elige UNA intención ("pedido"): responde el estado e ignora el cambio de dirección.',
    agent: ['buscar_pedido', 'cambiar_direccion'],
    agentNote: 'Encadena dos herramientas y maneja el error del cambio.',
  },
  {
    id: 'd',
    label: 'Imprevisto',
    text: 'Me llegó roto el pedido 4790, ¿qué hago?',
    route: 'pedido',
    wfOk: false,
    wfNote: 'Cae en la ruta "pedido": contesta "tu pedido fue entregado" y no menciona la garantía.',
    agent: ['buscar_pedido', 'consultar_politicas'],
    agentNote: 'Combina el estado del pedido con la política de garantía (48 h con fotos).',
  },
]

const ROUTES: { id: Route; tool: string; label: string }[] = [
  { id: 'pedido', tool: 'buscar_pedido', label: 'pedido' },
  { id: 'direccion', tool: 'cambiar_direccion', label: 'dirección' },
  { id: 'politica', tool: 'consultar_politicas', label: 'política' },
]

export function WorkflowLab() {
  const [cid, setCid] = useState('c')
  const c = CASES.find((x) => x.id === cid)!
  return (
    <Lab title="Mismo pedido, dos arquitecturas" hint="Elige un mensaje">
      <Segmented options={CASES.map((x) => ({ value: x.id, label: x.label }))} value={cid} onChange={setCid} />
      <div className="loop-agente-wf-msg" data-tone="user">
        <span className="label">usuario</span> {c.text}
      </div>
      <div className="grid-2">
        <div className="loop-agente-wf" data-ok={c.wfOk}>
          <div className="loop-agente-wf-head">
            <strong>Workflow</strong> <span className="muted small">tu código fija los pasos</span>
          </div>
          <div className="loop-agente-wf-path" key={c.id}>
            <span className="loop-agente-node" data-tone="model">
              clasificar (LLM)
            </span>
            <ArrowRight size={14} className="loop-agente-arr" />
            <span className="loop-agente-routes">
              {ROUTES.map((r) => (
                <span key={r.id} className={`loop-agente-node${r.id === c.route ? ' is-on' : ' is-off'}`} data-tone="tool">
                  <span className="muted small">{r.label} →</span> {r.tool}
                </span>
              ))}
            </span>
            <ArrowRight size={14} className="loop-agente-arr" />
            <span className="loop-agente-node" data-tone="model">
              redactar (LLM)
            </span>
          </div>
          <div className="loop-agente-wf-result" data-tone={c.wfOk ? 'ok' : 'error'}>
            {c.wfOk ? <Check size={15} /> : <X size={15} />} {c.wfNote}
          </div>
          <div className="small muted mono">2 llamadas LLM · siempre</div>
        </div>
        <div className="loop-agente-wf" data-ok>
          <div className="loop-agente-wf-head">
            <strong>Agente</strong> <span className="muted small">el modelo elige los pasos</span>
          </div>
          <div className="loop-agente-wf-path" key={c.id}>
            {c.agent.map((t, i) => (
              <span key={i} className="row" style={{ gap: 6 }}>
                <span className="loop-agente-node anim-in" data-tone="model" style={{ animationDelay: `${i * 160}ms` }}>
                  LLM
                </span>
                <ArrowRight size={14} className="loop-agente-arr" />
                <span className="loop-agente-node is-on anim-in" data-tone="tool" style={{ animationDelay: `${i * 160 + 80}ms` }}>
                  {t}
                </span>
                <ArrowRight size={14} className="loop-agente-arr" />
              </span>
            ))}
            <span className="loop-agente-node anim-in" data-tone="model" style={{ animationDelay: `${c.agent.length * 160}ms` }}>
              LLM → respuesta
            </span>
          </div>
          <div className="loop-agente-wf-result" data-tone="ok">
            <Check size={15} /> {c.agentNote}
          </div>
          <div className="small muted mono">{c.agent.length + 1} llamadas LLM · variable</div>
        </div>
      </div>
      <p className="small muted" style={{ margin: '12px 0 0' }}>
        Los casos 3 y 4 los podrías resolver agregando rutas al workflow… hasta que el diagrama se vuelve inmanejable. Esa es la señal para pasar a un agente.
      </p>
    </Lab>
  )
}
