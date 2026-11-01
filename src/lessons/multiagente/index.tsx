import { Callout, KeyIdeas, Section, Term } from '../../components/ui'
import { Code } from '../../components/Code'
import { CompareLab } from './CompareLab'
import { IsolationLab } from './IsolationLab'
import { PatternLab } from './PatternLab'
import './lesson.css'

const SUPERVISOR_CODE = `from strands import Agent, tool

@tool
def agente_pedidos(tarea: str) -> str:
    """Consulta estado, productos y montos de pedidos de Andes Market."""
    worker = Agent(system_prompt="Eres el especialista en pedidos. Responde en 1-2 líneas.",
                   tools=[buscar_pedido], callback_handler=None)   # contexto limpio
    return str(worker(tarea))

@tool
def agente_politicas(tarea: str) -> str:
    """Responde dudas de devoluciones, garantía y envíos citando la fuente."""
    worker = Agent(system_prompt="Responde solo con la política aplicable y su fuente.",
                   tools=[consultar_politicas], callback_handler=None)
    return str(worker(tarea))

@tool
def agente_pagos(tarea: str) -> str:
    """Inicia reembolsos. Única vía con permiso para mover dinero."""
    worker = Agent(system_prompt="Ejecuta reembolsos solo si la tarea indica que son elegibles.",
                   tools=[iniciar_reembolso], callback_handler=None)
    return str(worker(tarea))

supervisor = Agent(
    model="global.anthropic.claude-sonnet-5-5",
    system_prompt="Eres Andi. Descompón la solicitud, delega en los especialistas "
                  "con encargos concretos y responde al cliente con una sola voz.",
    tools=[agente_pedidos, agente_politicas, agente_pagos],
)
supervisor("Mi mochila del pedido 4790 llegó con el cierre roto. Quiero devolverla.")`

export default function Lesson() {
  return (
    <>
      <Section n={1} title="Varios agentes, una solicitud">
        <p>
          Un sistema multi-agente reparte una tarea entre varios LLM con prompts, herramientas y ventanas de contexto propias. Lo que cambia entre patrones es{' '}
          <b>quién decide el camino</b>, <b>qué contexto viaja</b> entre agentes y <b>qué corre en paralelo</b>.
        </p>
        <p>
          Abajo, la misma solicitud de Camila resuelta con cada patrón. Mira los mensajes que se pasan los agentes, el contador de llamadas y la línea de tiempo: en el
          patrón paralelo las barras se solapan.
        </p>
        <PatternLab />
        <Callout tone="info" title="Lo que está simulado">
          Los mensajes, tokens y latencias son estimaciones coherentes entre patrones, no mediciones. <code>iniciar_reembolso</code> es una herramienta hipotética de este
          ejemplo; las demás son las de Andi en el resto del taller.
        </Callout>
      </Section>

      <Section n={2} title="El precio de cada patrón">
        <p>
          Cada agente extra es al menos una llamada más al LLM con su propio system prompt. El paralelismo compra <b>tiempo</b>, no ahorro: el paralelo hace más llamadas
          que el secuencial, pero termina antes.
        </p>
        <CompareLab />
      </Section>

      <Section n={3} title="La ventaja real: aislar contexto">
        <p>
          El beneficio estructural del multi-agente es que cada subagente trabaja con <b>su propia ventana</b>. El supervisor no necesita ver los 40 resultados de búsqueda que
          revisó un especialista: necesita su conclusión. Si los subagentes devuelven transcripciones completas, pierdes esa ventaja y pagas el contexto dos veces.
        </p>
        <IsolationLab />
        <Callout tone="tip" title="Delegar bien">
          Cada encargo debe llevar objetivo, formato de salida, herramientas o fuentes a usar y límites claros. Encargos vagos producen subagentes que duplican trabajo, como
          el agente de pagos del patrón paralelo que tuvo que buscar el pedido por su cuenta.
        </Callout>
      </Section>

      <Section n={4} title="Cuándo NO usar multi-agente">
        <p>
          Empieza con <b>un solo agente con buenas herramientas</b>; para la solicitud de Camila alcanzan 4 llamadas. Divide solo cuando aparece una señal concreta:
        </p>
        <ul>
          <li>
            <b>Lógica compleja</b>: el system prompt se llenó de condicionales por tipo de caso.
          </li>
          <li>
            <b>Sobrecarga de herramientas</b>: muchas herramientas parecidas que el modelo confunde (importa más el solapamiento que la cantidad).
          </li>
          <li>
            <b>Contexto que no cabe</b>: subtareas que leen mucho material y solo necesitan devolver una conclusión.
          </li>
          <li>
            <b>Paralelismo natural</b>: subtareas independientes y lentas, donde la latencia importa más que el costo.
          </li>
          <li>
            <b>Aislar privilegios</b>: que solo un agente pueda mover dinero o escribir en sistemas críticos.
          </li>
        </ul>
        <p>
          El patrón supervisor con <Term tip="El orquestador ve a cada subagente como una herramienta más: llama, recibe un resultado de texto y sigue su loop.">agentes como herramientas</Term>{' '}
          se ve así en AWS Strands Agents (Google ADK lo ofrece como <code>AgentTool</code>; LangGraph y el Claude Agent SDK tienen equivalentes):
        </p>
        <Code code={SUPERVISOR_CODE} lang="python" title="supervisor_strands.py · buscar_pedido, consultar_politicas e iniciar_reembolso son tus @tool" />
        <Callout tone="warn" title="Errores comunes">
          Usar multi-agente para tareas simples (multiplicas costo y latencia); handoffs sin límite (ping-pong entre agentes: pon máximos de transferencias y detección de
          repeticiones); y confiar a ciegas en lo que devuelve otro agente: un error con mucha seguridad se propaga en cascada hasta el cliente.
        </Callout>
        <KeyIdeas
          items={[
            'Router elige una ruta; supervisor delega y sintetiza; handoff transfiere el control; paralelo divide y consolida; secuencial encadena etapas fijas.',
            'Cada agente extra suma llamadas, tokens y latencia: el paralelismo reduce el tiempo, no el costo.',
            'La ventaja estructural es el aislamiento de contexto: los subagentes deben devolver resúmenes, no transcripciones.',
            'Un solo agente con buenas herramientas resuelve la mayoría de los casos; divide solo ante señales concretas.',
            'Todo sistema multi-agente necesita límites duros: turnos, transferencias, tiempo y costo.',
          ]}
        />
      </Section>
    </>
  )
}
