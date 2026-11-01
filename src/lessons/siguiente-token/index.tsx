import { Callout, KeyIdeas, Section, Term } from '../../components/ui'
import { Code } from '../../components/Code'
import { GenerationLab, RunsLab, SamplingLab, StopLab } from './labs'
import './lesson.css'

const API_CODE = `import anthropic

client = anthropic.Anthropic()

msg = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,          # tope duro de tokens de salida
    temperature=0.2,          # soporte: respuestas consistentes
    stop_sequences=["\\n\\nCliente:"],
    system="Eres Andi, el asistente de soporte de Andes Market.",
    messages=[{"role": "user", "content": "¿Cuándo llega mi pedido 4821?"}],
)

print(msg.stop_reason)  # "end_turn" | "max_tokens" | "stop_sequence" | "tool_use"
if msg.stop_reason == "max_tokens":
    # la respuesta quedó cortada: sube max_tokens o pide que continúe
    ...`

export default function Lesson() {
  return (
    <>
      <Section n={1} title="Una sola operación, repetida">
        <p>
          Un LLM hace una sola cosa: recibe una secuencia de tokens y devuelve, para <b>cada</b> token del vocabulario, un puntaje llamado{' '}
          <Term tip="Número real sin escala (puede ser negativo). Más alto = el modelo considera ese token más adecuado como siguiente.">logit</Term>.
          Esos puntajes se convierten en probabilidades, se elige un token, se agrega al contexto y se repite. Eso es generar texto: un bucle{' '}
          <Term tip="Cada salida se vuelve parte de la entrada del paso siguiente.">autoregresivo</Term>.
        </p>
        <GenerationLab />
        <Callout tone="info" title="Lo simplificado">
          Los logits de este lab están escritos a mano y mostramos ~6 candidatos; un modelo real calcula un logit para cada uno de sus ~100k+ tokens en
          cada paso. Para leer mejor, varias palabras aparecen como un solo token.
        </Callout>
        <Callout tone="warn" title="El modelo no planifica la respuesta completa">
          No hay un borrador que luego se “imprime”: cada token se decide viendo solo lo que ya está escrito, y lo escrito no se puede borrar. Si un
          token temprano se desvía, todo lo que sigue se condiciona a ese error. (Sus representaciones internas sí anticipan algo de lo que viene,
          pero la salida se compromete un token a la vez.) Por eso ayuda pedir que razone antes de responder.
        </Callout>
      </Section>

      <Section n={2} title="De logits a probabilidades: softmax y temperatura">
        <p>
          La función <b>softmax</b> convierte logits en probabilidades positivas que suman 1. La <b>temperatura</b> T divide los logits antes:
        </p>
        <div className="siguiente-token-formula" role="img" aria-label="p sub i igual a e elevado a z sub i sobre T, dividido por la suma sobre j de e elevado a z sub j sobre T">
          <span>
            p<sub>i</sub> =
          </span>
          <span className="siguiente-token-frac">
            <span>
              e<sup>z<sub>i</sub> / T</sup>
            </span>
            <span>
              Σ<sub>j</sub> e<sup>z<sub>j</sub> / T</sup>
            </span>
          </span>
        </div>
        <ul>
          <li>
            <b>T &lt; 1</b> agranda las diferencias: el favorito se lleva casi todo. Con <b>T → 0</b> siempre gana el más probable (decodificación{' '}
            <i>greedy</i>).
          </li>
          <li>
            <b>T &gt; 1</b> aplana la distribución: tokens improbables empiezan a salir. Más variedad, más riesgo de incoherencia.
          </li>
          <li>
            <b>top-p</b> (nucleus sampling) se queda con los tokens más probables hasta sumar p y descarta la cola larga antes de muestrear.
          </li>
        </ul>
        <SamplingLab />
        <Callout tone="tip" title="Fíjate en «Dato concreto»">
          Cuando el contexto deja la respuesta clara (el mes viene del resultado de la herramienta), la distribución es tan puntiaguda que la
          temperatura casi no importa. La temperatura pesa en las partes abiertas del texto: el saludo, el estilo, el orden de las ideas.
        </Callout>
      </Section>

      <Section n={3} title="Mismo prompt, distintas respuestas">
        <p>
          Como cada token se muestrea, dos llamadas idénticas pueden divergir en el primer token y desde ahí seguir caminos distintos. Cada corrida usa
          una semilla distinta para el generador aleatorio; la probabilidad de la secuencia es el producto de las probabilidades de cada elección.
        </p>
        <RunsLab />
        <Callout tone="info" title="T = 0 no siempre es 100% determinista">
          En producción, detalles numéricos del hardware y del procesamiento por lotes pueden cambiar el empate entre dos tokens casi iguales. Para un
          agente de soporte usa temperatura baja, pero no dependas de respuestas idénticas byte a byte.
        </Callout>
      </Section>

      <Section n={4} title="Cuándo se detiene">
        <p>
          La generación termina por una de pocas razones, y la API te dice cuál en <span className="mono">stop_reason</span>: el modelo eligió el token
          especial de fin de turno (<span className="mono">end_turn</span>), se alcanzó tu tope <span className="mono">max_tokens</span>, apareció una
          de tus <span className="mono">stop_sequences</span> (<span className="mono">stop_sequence</span>), o el modelo pidió usar una herramienta (
          <span className="mono">tool_use</span>, lo verás en el módulo de agentes).
        </p>
        <StopLab />
        <Code code={API_CODE} lang="python" title="parametros.py" />
        <Callout tone="warn" title="Errores comunes">
          Usar el texto sin revisar <span className="mono">stop_reason</span> (respuestas cortadas que parecen completas); subir la temperatura para
          “hacerlo más inteligente” (solo lo hace más variable); y combinar temperatura y top-p a la vez: lo usual es ajustar solo uno, y algunos modelos
          recientes no aceptan ambos en la misma llamada.
        </Callout>
      </Section>

      <KeyIdeas
        items={[
          'Generar = repetir: contexto → logits para todo el vocabulario → softmax → elegir un token → agregarlo al contexto.',
          'Softmax con temperatura: T baja concentra la probabilidad en el favorito (greedy en T→0); T alta la reparte.',
          'top-p corta la cola de tokens improbables antes de muestrear; los que quedan se re-normalizan.',
          'El mismo prompt puede dar respuestas distintas porque cada token se muestrea; el modelo no reescribe lo ya generado.',
          'La generación para por end_turn, max_tokens, stop_sequence o tool_use: revisa stop_reason siempre.',
        ]}
      />
    </>
  )
}
