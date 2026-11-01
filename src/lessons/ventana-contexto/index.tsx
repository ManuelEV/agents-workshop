import { Callout, KeyIdeas, Section, Term } from '../../components/ui'
import { Code } from '../../components/Code'
import { fmtInt } from '../../sim/math'
import { BUDGET, CachingLab, OUT_RESERVE, OverflowLab, StatelessLab, WINDOW } from './labs'
import './lesson.css'

const LOOP_CODE = `import anthropic

client = anthropic.Anthropic()
historial = []                      # ← la "memoria" vive en TU código

def turno(texto_usuario: str) -> str:
    historial.append({"role": "user", "content": texto_usuario})
    resp = client.messages.create(
        model="claude-sonnet-5-5",
        max_tokens=1024,
        system=SYSTEM_PROMPT,         # se reenvía en cada llamada
        tools=TOOLS,                  # también
        messages=historial,           # TODO el historial, cada vez
    )
    historial.append({"role": "assistant", "content": resp.content})
    return resp`

const CACHE_CODE = `resp = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    tools=TOOLS,                                   # 1 · parte del prefijo
    system=[{
        "type": "text",
        "text": SYSTEM_PROMPT,                     # 2 · parte del prefijo
        "cache_control": {"type": "ephemeral"},    # ← punto de corte del caché
    }],
    messages=historial,  # 3 · marca también el último bloque del historial
)                        #     para cachear la conversación completa

u = resp.usage
print(u.cache_read_input_tokens, u.cache_creation_input_tokens, u.input_tokens)`

export default function Lesson() {
  return (
    <>
      <Section n={1} title="La API no recuerda nada">
        <p>
          La API de un LLM es <Term tip="No guarda estado entre peticiones: cada llamada es independiente y debe traer todo lo necesario.">stateless</Term>
          : no guarda tu conversación. Lo que parece “memoria” es que tu aplicación reenvía, en cada llamada, el system prompt, las definiciones de
          herramientas y <b>todo el historial</b> de mensajes. El modelo lee todo desde cero cada vez.
        </p>
        <StatelessLab />
        <p>Del lado de tu código, la conversación es solo una lista que crece:</p>
        <Code code={LOOP_CODE} lang="python" title="chat.py" highlight={[4, 13]} />
        <Callout tone="info" title="Lo simplificado">
          Los conteos de tokens son estimaciones (~3,8 caracteres por token). En la API real, además, las definiciones de herramientas agregan un
          pequeño texto de sistema propio, y la respuesta trae el conteo exacto en <span className="mono">usage</span>.
        </Callout>
      </Section>

      <Section n={2} title="¿Qué pasa cuando se llena?">
        <p>
          La <b>ventana de contexto</b> es el máximo de tokens que el modelo puede procesar en una llamada: entrada (system + tools + mensajes) más la
          salida que reservas con <span className="mono">max_tokens</span>. Hoy va de unos 128 mil a más de 1 millón de tokens según el modelo. Parece
          infinito, pero un agente que lee documentos y resultados de herramientas la llena más rápido de lo que crees; y antes de llenarla, ya pagas
          (y esperas) por cada token reenviado.
        </p>
        <p>
          Para que se vea, este lab usa una ventana de juguete de {fmtInt(WINDOW)} tokens: tras system, tools y {OUT_RESERVE} reservados para la
          respuesta, quedan {BUDGET} para el historial. Al final Camila pregunta por datos que dio al principio.
        </p>
        <OverflowLab />
        <Callout tone="danger" title="Olvidar no es lo peor">
          Con truncado ingenuo el modelo pierde el número de pedido. Si el prompt no le exige usar herramientas, puede ser peor: <b>inventar</b> un
          número plausible. Nada en la respuesta te avisa que el contexto se recortó.
        </Callout>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Estrategia</th>
                <th>Ventaja</th>
                <th>Costo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Truncar antiguos</td>
                <td>Trivial de implementar</td>
                <td>Pierde justo el inicio (quién es, qué pidió)</td>
              </tr>
              <tr>
                <td>Ventana deslizante + mensaje fijado</td>
                <td>Costo por llamada estable; conserva el pedido original</td>
                <td>Lo del medio desaparece aunque haya espacio</td>
              </tr>
              <tr>
                <td>Resumir (compactación)</td>
                <td>Conserva los hechos clave en pocos tokens</td>
                <td>Una llamada extra; el resumen puede omitir o deformar detalles</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout tone="tip">
          En agentes reales se combinan: resumir lo antiguo, recortar resultados de herramientas grandes y guardar hechos clave (como el número de
          pedido) en una memoria externa que se reinyecta. Lo verás en la lección de memoria.
        </Callout>
      </Section>

      <Section n={3} title="Prompt caching: no pagar dos veces el mismo prefijo">
        <p>
          Si cada llamada reenvía lo mismo, el proveedor puede guardar el procesamiento de ese <b>prefijo</b> y reutilizarlo. Con prompt caching, los
          tokens leídos de caché cuestan una fracción del precio normal (aquí US$ 0,30 vs US$ 3 por millón) y además responden más rápido. Escribir
          en caché cuesta un poco más que el input normal, así que conviene cuando el prefijo se repite.
        </p>
        <CachingLab />
        <Code code={CACHE_CODE} lang="python" title="cache.py" highlight={[8]} />
        <Callout tone="info" title="Detalles que importan">
          El caché expira tras unos minutos sin uso, exige un tamaño mínimo de prefijo (del orden de mil tokens, según el modelo) y solo sirve si el
          prefijo es idéntico. Pon lo estable primero (tools, system) y lo variable al final. En este lab ignoramos el mínimo para que se vea la mecánica.
        </Callout>
      </Section>

      <KeyIdeas
        items={[
          'La API es stateless: en cada llamada tu app reenvía system, tools y todo el historial de mensajes.',
          'Cada llamada crece en línea recta, pero lo que pagas en total crece de forma cuadrática con el número de turnos.',
          'La ventana de contexto limita entrada + salida reservada (max_tokens); cuando se llena, tú decides qué se descarta.',
          'Truncar es simple pero olvida lo primero; la ventana deslizante estabiliza el costo; resumir conserva hechos con una llamada extra.',
          'Prompt caching abarata el prefijo repetido (tools → system → historial) siempre que sea idéntico entre llamadas.',
        ]}
      />
    </>
  )
}
