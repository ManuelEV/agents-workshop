import { Link } from 'react-router'
import { Callout, KeyIdeas, Section, Term } from '../../components/ui'
import { GuardLab } from './GuardLab'
import { RunLab } from './RunLab'
import { ReactLab, WhoLab, WorkflowLab } from './SmallLabs'
import './lesson.css'

export default function Lesson() {
  return (
    <>
      <Section n={1} title="Un LLM dentro de un while">
        <p>
          Un LLM solo hace una cosa: recibe texto y genera texto. Un <strong>agente</strong> aparece cuando lo pones dentro de un bucle: el modelo puede pedir una
          herramienta, tu código la ejecuta, el resultado vuelve al contexto y el modelo decide de nuevo. Repite hasta que el modelo diga "terminé".
        </p>
        <p>
          La clave es la división del trabajo. El modelo <strong>decide y redacta</strong>; tu código (el{' '}
          <Term tip="El programa que envuelve al modelo: arma el contexto, llama a la API, ejecuta herramientas, aplica límites y registra todo.">harness</Term>)
          <strong> ejecuta, valida y pone los límites</strong>.
        </p>
        <WhoLab />
      </Section>

      <Section n={2} title="Una ejecución real, paso a paso">
        <p>
          Camila escribe al soporte de Andes Market. Sigue cada vuelta del loop: qué se envía, qué responde la API (con la forma real de la Messages API de
          Anthropic), qué línea del código se está ejecutando y cómo crece el arreglo <code>messages</code>.
        </p>
        <RunLab />
        <Callout tone="info" title="Qué es simulado">
          Las respuestas, los IDs y los conteos de tokens están escritos a mano, pero con la estructura exacta de la API: bloques <code>text</code> y{' '}
          <code>tool_use</code>, <code>stop_reason</code> y <code>usage</code>. El código Python funciona tal cual con el SDK <code>anthropic</code> si defines{' '}
          <code>run_tool</code>. Cómo se escribe cada herramienta lo ves en <Link to="/leccion/herramientas">Herramientas</Link>.
        </Callout>
        <p>
          Tres detalles que se pasan por alto: el modelo puede pedir <strong>varias herramientas en una misma respuesta</strong> (por eso el <code>for</code> recorre
          todos los bloques y devuelve todos los <code>tool_result</code> juntos); si <code>stop_reason</code> es <code>"max_tokens"</code> la respuesta quedó cortada y
          no es un final real; y los errores de herramienta se devuelven al modelo con <code>is_error</code>, no se lanzan como excepción.
        </p>
      </Section>

      <Section n={3} title="Cuándo cortar el loop">
        <p>
          El modelo decide cuándo terminar, pero no hay garantía de que lo haga pronto. Una herramienta caída, un resultado ambiguo o un objetivo imposible pueden
          producir reintentos sin fin. Por eso todo harness serio pone límites <strong>fuera del modelo</strong>.
        </p>
        <GuardLab />
        <Callout tone="warn" title="Otros frenos habituales">
          Presupuesto de tokens o de costo por tarea, timeout total de la ejecución, timeouts por herramienta (para no esperar 10 s en cada intento), y aprobación
          humana antes de acciones irreversibles. Cuando un freno salta, responde algo útil al usuario y deja registro: lo verás en{' '}
          <Link to="/leccion/observabilidad">Observabilidad</Link>.
        </Callout>
      </Section>

      <Section n={4} title="De dónde viene el patrón, y cuándo no usarlo">
        <p>
          El patrón se popularizó con <strong>ReAct</strong> (Yao et al., 2022): intercalar <em>Thought</em> (razonar), <em>Action</em> (usar una herramienta) y{' '}
          <em>Observation</em> (leer el resultado). En ese entonces todo era texto plano y el harness lo parseaba con expresiones regulares. Hoy las APIs traen tool
          calling nativo, pero el ciclo es el mismo.
        </p>
        <ReactLab />
        <h3>Workflow o agente</h3>
        <p>
          No todo necesita un agente. En un <strong>workflow</strong> tu código fija los pasos y el LLM cumple un rol dentro de cada uno; en un{' '}
          <strong>agente</strong> el modelo elige qué hacer y cuántas veces. El workflow es más predecible y barato; el agente maneja lo que no anticipaste.
        </p>
        <WorkflowLab />
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <th>Workflow</th>
                <th>Agente</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Quién decide la ruta</td>
                <td>Tu código</td>
                <td>El modelo, en cada iteración</td>
              </tr>
              <tr>
                <td>Costo y latencia</td>
                <td>Acotados y estables</td>
                <td>Variables (más llamadas, más tokens)</td>
              </tr>
              <tr>
                <td>Evaluación</td>
                <td>Paso a paso, sencilla</td>
                <td>Hay que evaluar resultado y trayectoria</td>
              </tr>
              <tr>
                <td>Ideal para</td>
                <td>Procesos repetibles y bien definidos</td>
                <td>Pedidos abiertos, compuestos o imprevistos</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <KeyIdeas
        items={[
          <>
            Un agente es un LLM en un bucle: <strong>contexto → LLM → ¿tool_use? → ejecutar → observación → …</strong> hasta <code>end_turn</code>.
          </>,
          <>
            El modelo solo <strong>pide</strong> acciones (bloques <code>tool_use</code>); tu código las ejecuta, las valida y devuelve <code>tool_result</code>.
          </>,
          <>
            La API no guarda estado: <strong>cada llamada reenvía todo el historial</strong>, así que los tokens de entrada crecen en cada iteración.
          </>,
          <>
            Las reglas de negocio y los límites (máx. iteraciones, repetición, presupuesto) van <strong>en el código</strong>, no solo en el prompt.
          </>,
          <>Si los pasos son fijos, un workflow es más simple y barato. Usa un agente cuando la ruta realmente depende del caso.</>,
        ]}
      />
    </>
  )
}
