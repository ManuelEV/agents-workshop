import { useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Callout, KeyIdeas, Lab, Pill, Section, Term } from '../../components/ui'
import { QUIZ } from './data'
import { DelegationLab } from './DelegationLab'
import { StateLab } from './StateLab'
import { UpdatesLab } from './UpdatesLab'
import './lesson.css'

function QuizLab() {
  const [answers, setAnswers] = useState<Record<number, 'mcp' | 'a2a'>>({})
  const done = Object.keys(answers).length
  const right = QUIZ.filter((q, i) => answers[i] === q.answer).length
  return (
    <Lab
      title="¿Herramienta o agente?"
      hint="Elige MCP o A2A para cada caso"
      footer={
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="small muted">
            {done}/{QUIZ.length} respondidas · {right} correctas
          </span>
          {done > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={() => setAnswers({})}>
              Reiniciar
            </button>
          )}
        </div>
      }
    >
      <div className="a2a-quiz">
        {QUIZ.map((q, i) => {
          const a = answers[i]
          const ok = a === q.answer
          return (
            <div key={i} className={`a2a-quiz-item${a ? (ok ? ' is-ok' : ' is-bad') : ''}`}>
              <div className="a2a-quiz-q">{q.text}</div>
              <div className="row" style={{ gap: 6 }}>
                {(['mcp', 'a2a'] as const).map((opt) => (
                  <button
                    key={opt}
                    className={`a2a-quiz-btn${a === opt ? ' is-picked' : ''}`}
                    data-tone={opt === 'mcp' ? 'tool' : 'model'}
                    onClick={() => setAnswers((s) => ({ ...s, [i]: opt }))}
                    disabled={!!a}
                  >
                    {opt === 'mcp' ? 'MCP · tool' : 'A2A · agente'}
                  </button>
                ))}
              </div>
              {a && (
                <div className="a2a-quiz-why anim-fade">
                  {ok ? <CheckCircle2 size={15} color="var(--c-ok)" /> : <XCircle size={15} color="var(--c-error)" />}
                  <span>
                    <strong>{q.answer === 'mcp' ? 'MCP.' : 'A2A.'}</strong> {q.why}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Lab>
  )
}

export default function Lesson() {
  return (
    <>
      <Section n={1} title="Una herramienta obedece; un agente decide">
        <p>
          Con <Link to="/leccion/mcp">MCP</Link> tu agente llama funciones: esquema de entrada, resultado predecible, segundos. Pero a veces el otro
          lado no es una función sino <strong>otro agente</strong>, de otro equipo u otra empresa, con su propio modelo, herramientas y reglas. Puede
          tardar, pedir más datos o negarse. Para eso existe <strong>Agent2Agent (A2A)</strong>.
        </p>
        <p>
          En A2A cada agente es una <Term tip="Expone qué sabe hacer, pero no su código, prompt, herramientas ni memoria.">caja negra</Term>: no
          compartes cómo trabaja, solo un contrato. La unidad de trabajo no es una llamada sino una <strong>Task</strong> con estados, y su resultado
          llega como <strong>artefactos</strong>.
        </p>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <th>MCP</th>
                <th>A2A</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Conecta</td>
                <td>agente ↔ herramientas y datos</td>
                <td>agente ↔ agente</td>
              </tr>
              <tr>
                <td>El otro lado</td>
                <td>una función con esquema</td>
                <td>un agente autónomo y opaco</td>
              </tr>
              <tr>
                <td>Unidad de trabajo</td>
                <td>
                  <code>tools/call</code>
                </td>
                <td>Task con estados y artefactos</td>
              </tr>
              <tr>
                <td>Duración típica</td>
                <td>segundos</td>
                <td>segundos a días</td>
              </tr>
              <tr>
                <td>Quién decide el cómo</td>
                <td>el agente que llama</td>
                <td>el agente remoto</td>
              </tr>
            </tbody>
          </table>
        </div>
        <QuizLab />
      </Section>

      <Section n={2} title="Una delegación completa">
        <p>
          Camila no estará en casa cuando llegue su pedido <strong>5230</strong> (una parka, distinta del 4821). Ese despacho lo hace <strong>RutaSur Logística</strong> (un courier ficticio de este taller),
          que publica un agente A2A. Andi lo descubre por su <strong>Agent Card</strong> en <code>/.well-known/agent-card.json</code>, le delega la
          reprogramación y sigue la tarea hasta que termina. Mira cómo la tarea se pausa en <code>INPUT_REQUIRED</code> cuando falta un dato.
        </p>
        <DelegationLab />
        <Callout tone="info" title="v0.3 vs v1.0: cuidado con los tutoriales">
          A2A <strong>v1.0</strong> (marzo de 2026) renombró casi todo. Si ves <code>message/send</code>, <code>tasks/get</code>,{' '}
          <code>tasks/cancel</code> o estados como <code>input-required</code>, es la v0.3 (2025). En v1.0 son <code>SendMessage</code>,{' '}
          <code>GetTask</code>, <code>CancelTask</code> y <code>TASK_STATE_INPUT_REQUIRED</code>; las Parts ya no tienen <code>kind</code> (un Part
          lleva <code>text</code>, <code>raw</code>, <code>url</code> o <code>data</code>) y la card usa <code>supportedInterfaces</code>.
        </Callout>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Operación (v1.0)</th>
                <th>En v0.3</th>
                <th>Para qué</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono">SendMessage</td>
                <td className="mono">message/send</td>
                <td>Enviar un mensaje; crea o continúa una tarea.</td>
              </tr>
              <tr>
                <td className="mono">SendStreamingMessage</td>
                <td className="mono">message/stream</td>
                <td>Lo mismo, recibiendo actualizaciones por SSE.</td>
              </tr>
              <tr>
                <td className="mono">GetTask</td>
                <td className="mono">tasks/get</td>
                <td>Consultar estado y artefactos.</td>
              </tr>
              <tr>
                <td className="mono">CancelTask</td>
                <td className="mono">tasks/cancel</td>
                <td>Cancelar una tarea no terminal.</td>
              </tr>
              <tr>
                <td className="mono">SubscribeToTask</td>
                <td className="mono">tasks/resubscribe</td>
                <td>Volver a engancharse al stream de una tarea.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={3} title="Los estados de una Task">
        <p>
          Una tarea avanza de <code>SUBMITTED</code> a <code>WORKING</code> y termina en uno de cuatro estados <strong>terminales</strong>. Dos
          estados la <strong>interrumpen</strong> sin terminarla: <code>INPUT_REQUIRED</code> (falta un dato) y <code>AUTH_REQUIRED</code> (falta una
          credencial). Ignorarlos es el error clásico: el cliente queda esperando una tarea que nunca terminará.
        </p>
        <StateLab />
        <Callout tone="info">
          La spec define los estados y cuáles son terminales; las transiciones de este lab son una simplificación didáctica. Un agente también puede
          responder directamente con un mensaje, sin crear tarea, si el pedido es trivial.
        </Callout>
      </Section>

      <Section n={4} title="Esperar sin bloquear">
        <p>
          Mientras la tarea avanza, el cliente necesita enterarse. Hay tres formas: preguntar cada cierto tiempo (<strong>polling</strong> con{' '}
          <code>GetTask</code>), mantener un <strong>stream SSE</strong> abierto con <code>SendStreamingMessage</code>, o registrar un{' '}
          <strong>webhook</strong> para que el remoto avise (<strong>push notifications</strong>). La Agent Card declara cuáles soporta en{' '}
          <code>capabilities</code>.
        </p>
        <UpdatesLab />
        <h3>Seguridad entre agentes</h3>
        <p>
          OWASP lista la comunicación insegura entre agentes entre los riesgos de aplicaciones agénticas. Lo mínimo: autentica siempre según la card,
          verifica <strong>cards firmadas</strong> y descúbrelas desde un registry gobernado, autoriza <strong>por skill</strong>, limita profundidad y
          presupuesto de delegación, y trata cada artefacto como entrada no confiable (puede traer instrucciones inyectadas; ver{' '}
          <Link to="/leccion/guardrails">Guardrails</Link>).
        </p>
        <div className="row" style={{ gap: 6, marginBottom: 16 }}>
          <Pill tone="guard">OAuth / OIDC / mTLS</Pill>
          <Pill tone="guard">Agent Card firmada (JWS)</Pill>
          <Pill tone="guard">autorización por skill</Pill>
          <Pill tone="guard">validar artefactos con esquema</Pill>
        </div>
        <KeyIdeas
          items={[
            <>MCP conecta un agente con herramientas; A2A conecta agentes autónomos y opacos que no comparten código ni memoria.</>,
            <>
              El descubrimiento parte de la <strong>Agent Card</strong> (<code>/.well-known/agent-card.json</code>): skills, interfaces, capacidades y
              seguridad.
            </>,
            <>
              La unidad de trabajo es la <strong>Task</strong>: SUBMITTED → WORKING → (INPUT_REQUIRED / AUTH_REQUIRED) → COMPLETED, FAILED, CANCELED o
              REJECTED.
            </>,
            <>
              Para continuar una tarea pausada se envía otro mensaje con su <code>taskId</code> y <code>contextId</code>; una tarea terminal no se
              reabre.
            </>,
            <>Mensajes y artefactos están hechos de Parts (texto, datos JSON, archivos): prefiere datos estructurados y valídalos.</>,
            <>Polling para lo simple, streaming SSE para segundos o minutos, push notifications para horas o días.</>,
          ]}
        />
      </Section>
    </>
  )
}
