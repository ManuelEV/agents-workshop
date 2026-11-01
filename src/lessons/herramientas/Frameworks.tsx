import { ArrowRight } from 'lucide-react'
import { Lab, Pill, Tabs } from '../../components/ui'
import { Code, linesOf } from '../../components/Code'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { MODEL_ID } from '../../sim/scenario'

/* ==========================================================================
   Nivel 3: el framework genera el esquema leyendo tu función
   (nombre, firma con type hints, valores por defecto y docstring).
   ========================================================================== */

const FN = `@tool
def buscar_pedido(
    pedido_id: str,
    incluir_items: bool = False,
) -> dict:
    """Obtiene el estado de un pedido:
    despacho, courier y fecha estimada.

    Args:
        pedido_id: Número del pedido, p. ej. "4821".
        incluir_items: Si es True, incluye productos.
    """
    return api.obtener(pedido_id, incluir_items)`

const SCHEMA = {
  name: 'buscar_pedido',
  description: 'Obtiene el estado de un pedido: despacho, courier y fecha estimada.',
  input_schema: {
    type: 'object',
    properties: {
      pedido_id: { type: 'string', description: 'Número del pedido, p. ej. "4821".' },
      incluir_items: { type: 'boolean', description: 'Si es True, incluye productos.', default: false },
    },
    required: ['pedido_id'],
  },
}
const SCHEMA_TEXT = JSON.stringify(SCHEMA, null, 2)

type MapStep = StepInfo & { code: number[]; json: number[]; how: string }

const STEPS: MapStep[] = [
  {
    title: '@tool registra la función',
    body: 'El decorador no cambia lo que hace tu función: la envuelve en un objeto "herramienta" que sabe describirse a sí mismo y ejecutarse.',
    code: [1],
    json: [1, linesOf(SCHEMA_TEXT, '}').pop() ?? 15],
    how: 'decorador',
  },
  {
    title: 'El nombre sale del nombre de la función',
    body: (
      <>
        <code>def buscar_pedido(</code> → <code>"name": "buscar_pedido"</code>. Por eso conviene que el nombre sea un verbo claro: es lo primero que
        "lee" el modelo para elegir.
      </>
    ),
    code: [2],
    json: linesOf(SCHEMA_TEXT, '"name"'),
    how: 'fn.__name__',
  },
  {
    title: 'La descripción sale del docstring',
    body: 'La primera parte del docstring se convierte en la descripción de la herramienta. Escribir buenos docstrings ES prompt engineering.',
    code: [6, 7],
    json: linesOf(SCHEMA_TEXT, '"description": "Obtiene'),
    how: 'inspect.getdoc()',
  },
  {
    title: 'Los type hints se traducen a JSON Schema',
    body: (
      <>
        <code>pedido_id: str</code> → <code>{'{"type": "string"}'}</code>. Los frameworks usan la firma (y a menudo Pydantic) para generar el
        esquema.
      </>
    ),
    code: [3],
    json: linesOf(SCHEMA_TEXT, '"pedido_id": {', '"type": "string"'),
    how: 'inspect.signature()',
  },
  {
    title: 'La sección Args describe cada parámetro',
    body: 'El framework parsea el docstring (estilo Google) y asigna cada línea al parámetro correspondiente.',
    code: [9, 10, 11],
    json: linesOf(SCHEMA_TEXT, 'Número del pedido', 'Si es True'),
    how: 'parser de docstring',
  },
  {
    title: 'Un default = parámetro opcional',
    body: (
      <>
        <code>incluir_items: bool = False</code> → <code>"type": "boolean"</code> con <code>"default": false</code>, y queda fuera de{' '}
        <code>required</code>.
      </>
    ),
    code: [4],
    json: linesOf(SCHEMA_TEXT, '"incluir_items": {', '"type": "boolean"', '"default": false'),
    how: 'param.default',
  },
  {
    title: 'Sin default = obligatorio',
    body: 'pedido_id no tiene valor por defecto, así que entra en "required". El modelo sabe que no puede llamar la herramienta sin él.',
    code: [3],
    json: linesOf(SCHEMA_TEXT, '"required"', '"pedido_id"\n'),
    how: 'required[]',
  },
  {
    title: 'En ejecución, el framework cierra el ciclo',
    body: 'Cuando llega un tool_use con este nombre, el framework valida los argumentos contra el esquema, llama tu función y empaqueta el return como tool_result. Ese es el bucle que escribiste a mano en el nivel 2.',
    code: [13],
    json: [],
    how: 'tool_result',
  },
]
// línea exacta de "pedido_id" dentro de required
STEPS[6].json = (() => {
  const lines = SCHEMA_TEXT.split('\n')
  const r = lines.findIndex((l) => l.includes('"required"'))
  return [r + 1, r + 2]
})()

export function SchemaLab() {
  const player = usePlayer(STEPS.length, { interval: 2900 })
  const st = STEPS[player.step]
  return (
    <Lab title="De función Python a JSON Schema" hint="Mira qué parte del código produce cada línea del esquema">
      <div className="stack">
        <div className="tools-schema">
          <Code code={FN} lang="python" title="tools.py · lo que escribes" highlight={st.code} dim />
          <div className="tools-schema-mid">
            <ArrowRight size={22} />
            <Pill tone="tool" mono>
              {st.how}
            </Pill>
          </div>
          <Code code={SCHEMA_TEXT} lang="json" title="lo que recibe la API (generado)" highlight={st.json} dim={st.json.length > 0} />
        </div>
        <Narration steps={STEPS} step={player.step} />
        <PlayerBar player={player} labels={STEPS.map((x) => x.title)} />
      </div>
    </Lab>
  )
}

/* -------------------------------------------------------------------------- */
/* El mismo agente en cuatro frameworks                                        */
/* -------------------------------------------------------------------------- */

const STRANDS = `from strands import Agent, tool

@tool
def buscar_pedido(pedido_id: str) -> dict:
    """Obtiene el estado actual de un pedido.

    Args:
        pedido_id: Número del pedido, p. ej. "4821".
    """
    return api_pedidos.obtener(pedido_id)

agent = Agent(
    model="global.anthropic.${MODEL_ID}",   # model_id de Bedrock
    system_prompt=SYSTEM_PROMPT,
    tools=[buscar_pedido],
)
agent("¿Dónde está mi pedido 4821?")      # corre el bucle completo`

const LANGCHAIN = `from langchain.agents import create_agent
from langchain.tools import tool

@tool
def buscar_pedido(pedido_id: str) -> dict:
    """Obtiene el estado actual de un pedido. pedido_id: número, p. ej. "4821"."""
    return api_pedidos.obtener(pedido_id)

agent = create_agent(
    model="anthropic:${MODEL_ID}",
    tools=[buscar_pedido],
    system_prompt=SYSTEM_PROMPT,
)
result = agent.invoke({"messages": [{"role": "user", "content": "¿Dónde está mi pedido 4821?"}]})
print(result["messages"][-1].content)`

const ADK = `from google.adk.agents import Agent

def buscar_pedido(pedido_id: str) -> dict:
    """Obtiene el estado actual de un pedido.

    Args:
        pedido_id: Número del pedido, p. ej. "4821".
    """
    return api_pedidos.obtener(pedido_id)

root_agent = Agent(
    name="andi",
    model="gemini-flash-latest",
    instruction=SYSTEM_PROMPT,
    tools=[buscar_pedido],          # funciones planas: ADK las envuelve como FunctionTool
)
# se ejecuta con un Runner (o "adk web" / "adk run" en desarrollo)`

const OPENAI_SDK = `from agents import Agent, Runner, function_tool

@function_tool
def buscar_pedido(pedido_id: str) -> dict:
    """Obtiene el estado actual de un pedido.

    Args:
        pedido_id: Número del pedido, p. ej. "4821".
    """
    return api_pedidos.obtener(pedido_id)

agent = Agent(name="Andi", instructions=SYSTEM_PROMPT, tools=[buscar_pedido])
result = Runner.run_sync(agent, "¿Dónde está mi pedido 4821?")
print(result.final_output)`

export function FrameworksTabs() {
  const tab = (code: string, file: string, note: string) => (
    <div className="stack" style={{ gap: 8 }}>
      <Code code={code} lang="python" title={file} highlight={linesOf(code, '@tool', '@function_tool', 'tools=[buscar_pedido]')} />
      <div className="small" style={{ color: 'var(--text-2)' }}>
        {note}
      </div>
    </div>
  )
  return (
    <Tabs
      tabs={[
        { id: 'strands', label: 'Strands Agents', content: tab(STRANDS, 'agente_strands.py', 'Strands lee la firma y la sección Args del docstring. Llamar a agent(...) ejecuta el bucle completo y conserva el historial en agent.messages.') },
        { id: 'langchain', label: 'LangChain', content: tab(LANGCHAIN, 'agente_langchain.py', 'create_agent (LangChain 1.x) corre sobre LangGraph. @tool usa el docstring como descripción; para esquemas ricos puedes pasar un modelo Pydantic (args_schema).') },
        { id: 'adk', label: 'Google ADK', content: tab(ADK, 'agent.py', 'En ADK no necesitas decorador: cualquier función con type hints y docstring en tools se envuelve como FunctionTool.') },
        { id: 'openai', label: 'OpenAI Agents SDK', content: tab(OPENAI_SDK, 'agente_openai_sdk.py', '@function_tool genera el esquema (vía Pydantic) y Runner ejecuta el bucle hasta tener final_output.') },
      ]}
    />
  )
}
