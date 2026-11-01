import { Link } from 'react-router'
import { Bot, Brain, Database, User } from 'lucide-react'
import { Callout, KeyIdeas, Lab, Section, Term } from '../../components/ui'
import { FlowDiagram, type FlowEdge, type FlowNode } from '../../components/Flow'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { BreakParserLab, ByHandLab } from './ByHand'
import { NativeLab } from './Native'
import { FrameworksTabs, SchemaLab } from './Frameworks'
import './lesson.css'

const NODES: FlowNode[] = [
  { id: 'user', x: 90, y: 150, w: 130, label: 'Usuario', sub: 'Camila', tone: 'user', icon: User },
  { id: 'app', x: 330, y: 150, w: 170, h: 66, label: 'Tu aplicación', sub: 'el bucle del agente', tone: 'tool', icon: Bot },
  { id: 'llm', x: 590, y: 60, w: 160, label: 'LLM', sub: 'solo genera texto', tone: 'model', icon: Brain },
  { id: 'api', x: 590, y: 245, w: 160, label: 'API de pedidos', sub: 'buscar_pedido()', tone: 'data', icon: Database },
]
const EDGES: FlowEdge[] = [
  { from: 'user', to: 'app' },
  { from: 'app', to: 'llm', curve: -18 },
  { from: 'llm', to: 'app', curve: -18 },
  { from: 'app', to: 'api' },
]

const WHO_STEPS: (StepInfo & { flows: string[] })[] = [
  { title: 'La pregunta llega a tu aplicación', body: '"¿Dónde está mi pedido 4821?"', flows: ['user>app'] },
  {
    title: 'Tu app llama al LLM con la lista de herramientas',
    body: 'Envía el historial y la descripción de las herramientas disponibles (nombre, para qué sirve, qué argumentos recibe).',
    flows: ['app>llm'],
  },
  {
    title: 'El LLM responde con una PETICIÓN',
    body: (
      <>
        No ejecuta nada: devuelve texto/JSON que dice "quiero llamar <code>buscar_pedido</code> con <code>pedido_id = "4821"</code>".
      </>
    ),
    flows: ['llm>app'],
  },
  {
    title: 'Tu código ejecuta la función real',
    body: 'Tú decides si obedecer: validas, revisas permisos y llamas a la API. Aquí viven la seguridad y los errores.',
    flows: ['app>api'],
  },
  { title: 'El resultado vuelve a tu app', body: 'Estado: en_ruta, courier Chilexpress, ETA 4 de noviembre.', flows: ['api>app'] },
  { title: 'Tu app le devuelve el resultado al LLM', body: 'Se agrega al historial y se llama de nuevo al modelo, que ahora tiene el dato.', flows: ['app>llm'] },
  { title: 'El LLM redacta la respuesta', body: 'Con la observación en el contexto, genera la respuesta final en lenguaje natural.', flows: ['llm>app'] },
  { title: 'Respuesta al usuario', body: '"Tu pedido va en camino con Chilexpress y llega el miércoles 4."', flows: ['app>user'] },
]

function WhoExecutesLab() {
  const player = usePlayer(WHO_STEPS.length, { interval: 2300 })
  return (
    <Lab title="¿Quién ejecuta la herramienta?" hint="Dale play">
      <div className="stack">
        <div style={{ maxWidth: 820, width: '100%', margin: '0 auto' }}>
          <FlowDiagram nodes={NODES} edges={EDGES} width={700} height={300} flows={WHO_STEPS[player.step].flows} ariaLabel="Flujo de una llamada a herramienta" />
        </div>
        <Narration steps={WHO_STEPS} step={player.step} />
        <PlayerBar player={player} labels={WHO_STEPS.map((s) => s.title)} />
      </div>
    </Lab>
  )
}

export default function Lesson() {
  return (
    <>
      <Section n={1} title="El LLM no ejecuta nada: pide">
        <p>
          Un LLM solo produce texto. Una <strong>herramienta</strong> (tool) es una función de tu código que el modelo puede <em>solicitar</em>:
          él escribe "quiero llamar a esta función con estos argumentos" y tu aplicación decide si la ejecuta y le devuelve el resultado. Todo el
          "poder" de un agente para actuar en el mundo pasa por ese intercambio.
        </p>
        <WhoExecutesLab />
        <p>
          Vamos a implementar la misma herramienta, <code>buscar_pedido</code>, en tres niveles de abstracción. Cada nivel resuelve los problemas
          del anterior, y entender los tres te permite depurar cualquier framework.
        </p>
      </Section>

      <Section n={2} title="Nivel 1 · A mano: instrucciones + parser">
        <p>
          Así se hacía antes de que las APIs soportaran herramientas (el patrón{' '}
          <Term tip="Reason + Act (Yao et al., 2022): el modelo alterna pensamientos, acciones y observaciones en texto.">ReAct</Term> original): le
          describes las herramientas en el prompt, le pides un formato exacto y escribes un parser que busca ese formato en la respuesta.
        </p>
        <ByHandLab />
        <h3>¿Qué tan frágil es?</h3>
        <p>
          El parser depende de que un modelo probabilístico escriba siempre el mismo formato. Prueba variantes reales que aparecen en producción:
          cada una rompe algo distinto.
        </p>
        <BreakParserLab />
      </Section>

      <Section n={3} title="Nivel 2 · Function calling nativo">
        <p>
          Hoy todas las APIs de modelos tienen un campo <code>tools</code>. Describes cada herramienta con un{' '}
          <Term tip="Estándar para describir la forma de un JSON: tipos, propiedades, campos obligatorios, enums, patrones.">JSON Schema</Term>, y
          el modelo (entrenado específicamente para esto) responde con un bloque estructurado en vez de texto libre. El proveedor garantiza que el
          bloque es JSON válido; tú sigues ejecutando la función.
        </p>
        <NativeLab />
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Anthropic</th>
                <th>OpenAI (Chat Completions)</th>
                <th>Gemini</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Definición</td>
                <td className="mono">tools[].input_schema</td>
                <td className="mono">tools[].function.parameters</td>
                <td className="mono">functionDeclarations[].parameters</td>
              </tr>
              <tr>
                <td>El modelo pide</td>
                <td className="mono">content[].type = "tool_use"</td>
                <td className="mono">message.tool_calls[]</td>
                <td className="mono">parts[].functionCall</td>
              </tr>
              <tr>
                <td>Señal de parada</td>
                <td className="mono">stop_reason = "tool_use"</td>
                <td className="mono">finish_reason = "tool_calls"</td>
                <td className="mono">(hay functionCall)</td>
              </tr>
              <tr>
                <td>Argumentos</td>
                <td>objeto JSON</td>
                <td>string JSON</td>
                <td>objeto JSON</td>
              </tr>
              <tr>
                <td>Devuelves</td>
                <td className="mono">tool_result en mensaje user</td>
                <td className="mono">mensaje role "tool"</td>
                <td className="mono">parts[].functionResponse</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout tone="tip" title="Errores como resultado, no como excepción">
          Si la herramienta falla (pedido inexistente, API caída), no lances la excepción: devuélvela como <code>tool_result</code> con{' '}
          <code>is_error: true</code> y un mensaje claro. El modelo la lee y puede corregirse (pedir el número de nuevo, probar otra herramienta,
          disculparse). Lo verás en <Link to="/leccion/loop-agente">El ciclo del agente</Link>.
        </Callout>
      </Section>

      <Section n={4} title="Nivel 3 · Frameworks: el esquema sale de tu función">
        <p>
          Escribir JSON Schemas a mano y mantener el bucle es repetitivo. Los frameworks de agentes hacen dos cosas: <strong>generan el esquema</strong>{' '}
          leyendo tu función (nombre, type hints, valores por defecto, docstring) y <strong>corren el bucle</strong> del nivel 2 por ti.
        </p>
        <SchemaLab />
        <p>El mismo agente en cuatro frameworks. Cambia la sintaxis; el mecanismo de abajo es exactamente el que acabas de ver.</p>
        <FrameworksTabs />
        <div className="table-wrap" style={{ marginTop: 18 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <th>A mano</th>
                <th>Nativo</th>
                <th>Framework</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Esquema de la herramienta</td>
                <td>Texto en el prompt</td>
                <td>JSON Schema escrito por ti</td>
                <td>Generado desde la función</td>
              </tr>
              <tr>
                <td>Parseo de la petición</td>
                <td>Regex + json.loads</td>
                <td>Lo hace la API</td>
                <td>Lo hace la API</td>
              </tr>
              <tr>
                <td>Bucle y reintentos</td>
                <td>Tuyo</td>
                <td>Tuyo (~20 líneas)</td>
                <td>Del framework</td>
              </tr>
              <tr>
                <td>Validación de argumentos</td>
                <td>Ninguna</td>
                <td>Opcional (tuya)</td>
                <td>Contra el esquema</td>
              </tr>
              <tr>
                <td>Extras</td>
                <td>—</td>
                <td>—</td>
                <td>Trazas, MCP, herramientas en paralelo, memoria</td>
              </tr>
              <tr>
                <td>Cuándo usarlo</td>
                <td>Para entender; modelos sin soporte</td>
                <td>Control total, pocas dependencias</td>
                <td>Casi siempre en producción</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout tone="info" title="¿Y cómo elige el modelo cuál usar?">
          Ya sabes cómo se <em>declara</em> y se <em>ejecuta</em> una herramienta. La pregunta interesante es qué pasa dentro del modelo cuando
          "decide" llamarla: lo verás token a token en <Link to="/leccion/decision-herramienta">Cómo "decide" el LLM</Link>.
        </Callout>
      </Section>

      <KeyIdeas
        items={[
          <>El LLM nunca ejecuta una herramienta: devuelve una <strong>petición</strong> y tu código decide si la cumple.</>,
          <>A mano, todo depende de un parser sobre texto libre: frágil ante cualquier variación del modelo.</>,
          <>El function calling nativo usa JSON Schema en <code>tools</code> y devuelve bloques estructurados (<code>tool_use</code> / <code>tool_calls</code>).</>,
          <>Los frameworks generan el esquema desde la firma y el docstring: escribir buenos nombres y docstrings es prompt engineering.</>,
          <>El resultado vuelve al modelo como un mensaje más (<code>tool_result</code>); los errores también, para que pueda corregirse.</>,
        ]}
      />
    </>
  )
}
