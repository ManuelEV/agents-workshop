import { Link } from 'react-router'
import { Callout, KeyIdeas, Section, Term } from '../../components/ui'
import { ChoiceLab } from './ChoiceLab'
import { ConstrainLab } from './ConstrainLab'
import { PromptLab } from './PromptLab'
import { TokenLab } from './TokenLab'
import './lesson.css'

export default function Lesson() {
  return (
    <>
      <Section n={1} title="No hay un if escondido">
        <p>
          Cuando le pasas <code>tools</code> a la API, parece que el modelo tuviera un módulo aparte que "decide" usar herramientas. No lo tiene. Las definiciones se{' '}
          <strong>serializan como texto</strong> dentro del prompt, junto con instrucciones de cómo pedir una llamada, y el modelo hace lo único que sabe hacer:
          predecir el siguiente token.
        </p>
        <PromptLab />
        <Callout tone="info" title="Plantilla ilustrativa">
          El formato exacto (tokens especiales, dónde van las herramientas, cómo se marca una llamada) es propio de cada proveedor y no es público. Lo que sí está
          documentado: habilitar herramientas agrega un <em>system prompt</em> especial de algunos cientos de tokens, además de lo que ocupan tus definiciones, y todo
          eso se cobra como tokens de entrada.
        </Callout>
      </Section>

      <Section n={2} title="La decisión, token a token">
        <p>
          "Decidir" usar una herramienta es, en realidad, una cadena de predicciones: primero si el turno empieza con texto o con una llamada, después qué nombre de
          herramienta, después cada token de los argumentos. Cada paso es una distribución de probabilidad que depende de <strong>todo</strong> lo que hay en el
          contexto.
        </p>
        <TokenLab />
        <p>
          Esto explica comportamientos que de otro modo parecen caprichosos: una herramienta mal nombrada pierde probabilidad, un argumento obligatorio sin dato se
          rellena con algo verosímil, y con temperatura mayor que 0 la misma pregunta puede, de vez en cuando, tomar otra ruta. Cómo se implementa cada herramienta del
          lado de tu código lo ves en <Link to="/leccion/herramientas">Herramientas</Link>.
        </p>
      </Section>

      <Section n={3} title="Qué cambia la decisión">
        <p>
          Como todo es probabilidad condicionada al contexto, puedes mover la decisión desde varios lugares: el mensaje del usuario, la calidad de las descripciones,
          cuántas herramientas compiten y el parámetro <code>tool_choice</code> de la API, que restringe lo que el modelo tiene permitido generar.
        </p>
        <ChoiceLab />
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>tool_choice</th>
                <th>Efecto</th>
                <th>Úsalo para</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>{'{"type": "auto"}'}</code>
                </td>
                <td>El modelo elige: texto o cualquier herramienta (por defecto cuando hay tools).</td>
                <td>Agentes conversacionales</td>
              </tr>
              <tr>
                <td>
                  <code>{'{"type": "any"}'}</code>
                </td>
                <td>Debe llamar alguna herramienta; elige cuál.</td>
                <td>Pasos de un workflow donde siempre hay que actuar</td>
              </tr>
              <tr>
                <td>
                  <code>{'{"type": "tool", "name": "…"}'}</code>
                </td>
                <td>Debe llamar esa herramienta exacta.</td>
                <td>Extracción estructurada (la herramienta es un "formulario")</td>
              </tr>
              <tr>
                <td>
                  <code>{'{"type": "none"}'}</code>
                </td>
                <td>No puede llamar herramientas, aunque estén definidas.</td>
                <td>Forzar una respuesta final sin cambiar el prompt</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout tone="tip" title="Las descripciones son prompt">
          La descripción de una herramienta es el texto que más influye en si se usa y cuándo. Di qué hace, cuándo usarla y cuándo <em>no</em>, qué devuelve, y da
          ejemplos de argumentos. Con muchas herramientas parecidas, fusiona, renombra o carga solo las relevantes para cada tarea.
        </Callout>
      </Section>

      <Section n={4} title="Argumentos que siempre cumplen el esquema">
        <p>
          Aunque el modelo casi siempre respeta el <code>input_schema</code>, "casi siempre" no basta en producción. La{' '}
          <Term tip="Técnica de inferencia que, en cada paso, anula la probabilidad de los tokens que violarían una gramática (derivada del JSON Schema) y renormaliza el resto.">
            decodificación restringida
          </Term>{' '}
          compila el esquema en una gramática y, en cada token, enmascara los candidatos que harían imposible un JSON válido.
        </p>
        <ConstrainLab />
        <Callout tone="info" title="Dónde lo encuentras">
          Es la idea detrás de los modos de <em>structured outputs</em> / herramientas estrictas (por ejemplo, <code>strict: true</code> en la definición de una
          herramienta, en OpenAI y en Anthropic). Cada proveedor soporta un subconjunto de JSON Schema: revisa qué palabras clave admite (<code>pattern</code>,{' '}
          <code>enum</code>, formatos…). Y valida igual en tu código: el esquema garantiza la forma, no que el valor sea el correcto.
        </Callout>
      </Section>

      <KeyIdeas
        items={[
          <>
            Las herramientas se convierten en <strong>texto del prompt</strong>; el modelo no tiene un mecanismo aparte para usarlas.
          </>,
          <>
            Usar una herramienta = generar un token especial de llamada, luego el <strong>nombre</strong> y luego los <strong>argumentos</strong>, cada uno con su
            probabilidad.
          </>,
          <>
            La API parsea esos tokens y te entrega un bloque <code>tool_use</code> estructurado con <code>stop_reason: "tool_use"</code>.
          </>,
          <>
            Mueves la decisión con buenas descripciones, menos herramientas parecidas y <code>tool_choice</code> (<code>auto</code>, <code>any</code>,{' '}
            <code>tool</code>, <code>none</code>).
          </>,
          <>
            Los modos estrictos enmascaran tokens inválidos: garantizan <strong>JSON bien formado</strong>, no argumentos correctos.
          </>,
        ]}
      />
    </>
  )
}
