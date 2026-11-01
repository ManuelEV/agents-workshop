import { Link } from 'react-router'
import { Code } from '../../components/Code'
import { Callout, KeyIdeas, Section, Tabs, Term } from '../../components/ui'
import { CostLab } from './CostLab'
import { CycleLab } from './CycleLab'
import { EvalLab } from './EvalLab'
import { TraceLab } from './TraceLab'
import './lesson.css'

const OTEL_CODE = `from opentelemetry import trace

tracer = trace.get_tracer("andi")

def llamar_modelo(messages):
    with tracer.start_as_current_span(f"chat {MODEL}") as span:
        span.set_attribute("gen_ai.operation.name", "chat")
        span.set_attribute("gen_ai.provider.name", "anthropic")
        span.set_attribute("gen_ai.request.model", MODEL)
        resp = client.messages.create(model=MODEL, max_tokens=1024,
                                      system=SYSTEM, tools=TOOLS, messages=messages)
        span.set_attribute("gen_ai.response.finish_reasons", [resp.stop_reason])
        span.set_attribute("gen_ai.usage.input_tokens", resp.usage.input_tokens)
        span.set_attribute("gen_ai.usage.output_tokens", resp.usage.output_tokens)
        return resp

def ejecutar_herramienta(block):
    with tracer.start_as_current_span(f"execute_tool {block.name}") as span:
        span.set_attribute("gen_ai.operation.name", "execute_tool")
        span.set_attribute("gen_ai.tool.name", block.name)
        span.set_attribute("gen_ai.tool.call.id", block.id)
        salida, es_error = run_tool(block.name, block.input)
        if es_error:
            span.set_status(trace.StatusCode.ERROR)
            span.set_attribute("error.type", salida.get("error", "tool_error"))
        return salida, es_error`

const JUDGE_PROMPT = `Eres un evaluador estricto de Andi, el agente de soporte de Andes Market.
Recibirás: la pregunta del cliente, el comportamiento esperado, una
respuesta de referencia, la trayectoria (herramientas llamadas) y la
respuesta final del agente.

Evalúa cada criterio con 1 (mal), 2 (parcial) o 3 (bien):
- correctitud: ¿los hechos coinciden con la referencia y los datos?
- herramientas: ¿usó las adecuadas, con argumentos reales (no
  inventados) y sin acciones innecesarias?
- fundamentacion: ¿lo que afirma se apoya en resultados de
  herramientas o en una fuente citada?
- tono: ¿es breve, cordial y en español neutro?

Primero escribe tu justificación; después los puntajes.
Responde SOLO con JSON:
{"justificacion": "...", "correctitud": n, "herramientas": n,
 "fundamentacion": n, "tono": n}`

const JUDGE_CALL = `def juzgar(caso: dict, salida) -> dict:
    resp = client.messages.create(
        model=JUDGE_MODEL,        # idealmente distinto al del agente
        max_tokens=600,
        temperature=0,
        system=RUBRICA,
        messages=[{"role": "user", "content": json.dumps({
            "pregunta": caso["pregunta"],
            "esperado": caso["esperado"],
            "referencia": caso["referencia"],
            "trayectoria": salida.herramientas,
            "respuesta": salida.texto,
        }, ensure_ascii=False)}],
    )
    return json.loads(resp.content[0].text)`

const CI_TEST = `# tests/test_regresion.py  (corre en cada PR)
import pytest
from evals import (cargar_casos, cargar_resultados, correr_agente,
                   grader_trayectoria, juzgar, pasa)

BASELINE = cargar_resultados("main")          # resultados de la versión desplegada

@pytest.mark.parametrize("caso", cargar_casos("soporte.jsonl"), ids=lambda c: c["id"])
def test_caso(caso):
    salida = correr_agente(caso["pregunta"])
    ok = grader_trayectoria(caso, salida) and pasa(juzgar(caso, salida))
    if BASELINE[caso["id"]].paso:               # pasaba antes → no puede fallar ahora
        assert ok, f"Regresión en el caso {caso['id']}"`

export default function Lesson() {
  return (
    <>
      <Section n={1} title="Una ejecución es una traza">
        <p>
          Un agente toma decisiones distintas en cada ejecución, así que un log de "entró pregunta, salió respuesta" no alcanza. Necesitas ver{' '}
          <strong>cada paso</strong>: qué llamó, cuánto tardó, cuántos tokens usó y dónde falló. Eso es una{' '}
          <Term tip="Registro de una operación completa como árbol de spans. Cada span tiene nombre, inicio, fin, estado y atributos, y apunta a su span padre.">
            traza
          </Term>
          , y cada paso es un <strong>span</strong>.
        </p>
        <p>
          El estándar que se impone son las <strong>convenciones semánticas GenAI de OpenTelemetry</strong>: nombres de spans (<code>invoke_agent</code>,{' '}
          <code>chat</code>, <code>execute_tool</code>) y atributos (<code>gen_ai.*</code>) comunes a cualquier proveedor y framework. Aquí ves la misma ejecución de
          Andi de la lección <Link to="/leccion/loop-agente">El ciclo del agente</Link>, ahora como traza.
        </p>
        <TraceLab />
        <Callout tone="info" title="Convenciones en evolución">
          A octubre de 2026 las convenciones GenAI siguen en estado <em>Development</em>: los nombres pueden cambiar (ya pasó: <code>gen_ai.system</code> se
          renombró <code>gen_ai.provider.name</code>). Fija la versión de tu librería de instrumentación. Los atributos <code>app.*</code> de la traza son propios,
          no parte del estándar. Tiempos, IDs y conteos son simulados.
        </Callout>
        <details className="observabilidad-details">
          <summary>Instrumentar el loop a mano con OpenTelemetry (Python)</summary>
          <Code code={OTEL_CODE} lang="python" />
          <p className="small muted">
            Muchos frameworks ya emiten estos spans automáticamente. Conviene saber qué hay debajo para completar lo que falte (costo, versión, tenant) y para
            depurar.
          </p>
        </details>
      </Section>

      <Section n={2} title="Cuánto cuesta un agente">
        <p>
          Con los tokens de cada span calculas el <strong>costo por tarea</strong>, la métrica que de verdad importa (no el costo por llamada). En un agente pesan
          tres cosas: cuántas iteraciones hace, cuánto contexto reenvía en cada una y cuánto escribe.
        </p>
        <CostLab />
        <Callout tone="tip" title="Prompt caching">
          El prefijo que se repite en cada llamada (system + definiciones de herramientas + historial previo) puede quedar en caché del proveedor; leerlo cuesta una
          fracción del precio normal. Ordena el prompt de lo más estable a lo más variable para aprovecharlo.
        </Callout>
      </Section>

      <Section n={3} title="¿Responde bien? Evaluación">
        <p>
          Las trazas dicen <em>qué hizo</em> el agente; las evaluaciones dicen <em>si estuvo bien</em>. Una suite es un conjunto de casos con el comportamiento
          esperado. Combina dos tipos de calificador: <strong>código</strong> para lo verificable (¿llamó la herramienta correcta?, ¿con prioridad alta?) y un{' '}
          <strong>juez LLM</strong> con rúbrica para lo que no se puede comprobar con código (correctitud del texto, fundamentación, tono).
        </p>
        <EvalLab />
        <Tabs
          tabs={[
            { id: 'rubrica', label: 'Rúbrica del juez', content: <Code code={JUDGE_PROMPT} lang="text" title="system prompt del juez" /> },
            { id: 'llamada', label: 'Llamada al juez', content: <Code code={JUDGE_CALL} lang="python" title="evals/juez.py" /> },
            { id: 'ci', label: 'Gate en CI', content: <Code code={CI_TEST} lang="python" title="tests/test_regresion.py" /> },
          ]}
        />
        <Callout tone="warn" title="Un juez sin calibrar es una opinión">
          Antes de confiar en el juez, etiqueta a mano 30–50 casos y mide cuánto coincide contigo. Pide la justificación antes del puntaje, usa escalas cortas,
          temperatura 0 y, si puedes, un modelo distinto al del agente. Y como cada ejecución varía, corre varios intentos por caso: un 75% de éxito por intento es
          apenas ~42% de pasar 3 de 3.
        </Callout>
      </Section>

      <Section n={4} title="Offline, online y el ciclo completo">
        <p>
          Las evals <strong>offline</strong> corren sobre tu dataset antes de desplegar; las <strong>online</strong> puntúan una muestra de trazas reales. Juntas
          forman un ciclo: producción revela fallos nuevos, las personas los confirman y se vuelven casos del dataset, que protege el próximo cambio.
        </p>
        <CycleLab />
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Momento</th>
                <th>Qué corre</th>
                <th>¿Bloquea?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cada PR</td>
                <td>Regresión rápida con graders de código, 1 intento</td>
                <td>Sí</td>
              </tr>
              <tr>
                <td>Merge / nightly</td>
                <td>Suite completa, varios intentos por caso, juez LLM</td>
                <td>La regresión sí</td>
              </tr>
              <tr>
                <td>Cambio de modelo</td>
                <td>Todas las suites, versión actual vs. candidata</td>
                <td>Decisión del equipo</td>
              </tr>
              <tr>
                <td>Producción</td>
                <td>Juez online sobre una muestra de trazas</td>
                <td>No: alerta</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <KeyIdeas
        items={[
          <>
            Una ejecución es una <strong>traza</strong>: un span raíz <code>invoke_agent</code> con hijos <code>chat</code> y <code>execute_tool</code>, con atributos{' '}
            <code>gen_ai.*</code> de OpenTelemetry.
          </>,
          <>
            Las llamadas al LLM dominan la latencia; para acelerar, <strong>reduce iteraciones y tokens de salida</strong> antes que optimizar herramientas.
          </>,
          <>
            Mide el <strong>costo por tarea</strong>: en agentes suele dominar la entrada, porque cada iteración reenvía el historial. La caché ayuda mucho.
          </>,
          <>
            Evalúa con <strong>graders de código</strong> para lo verificable y un <strong>juez LLM calibrado</strong> para lo subjetivo.
          </>,
          <>
            En CI, compara <strong>caso por caso</strong> contra la versión desplegada: una mejora global puede esconder una regresión.
          </>,
        ]}
      />
    </>
  )
}
