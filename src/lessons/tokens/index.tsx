import { Callout, KeyIdeas, Section, Term, TokenChips } from '../../components/ui'
import { Code } from '../../components/Code'
import { BpeLab, EmbeddingLab, TokenizerLab, toChips } from './labs'
import { tokenize } from './tokenizer'
import './lesson.css'

const WORD = 'ferrocarril'
const WORD_TOKS = tokenize(' ' + WORD)

const COUNT_CODE = `import anthropic

client = anthropic.Anthropic()

# Cuenta tokens con el tokenizador real del modelo (sin generar nada)
r = client.messages.count_tokens(
    model="claude-sonnet-5-5",
    system="Eres Andi, el asistente de soporte de Andes Market.",
    messages=[{"role": "user", "content": "¿Dónde está mi pedido #4821?"}],
)
print(r.input_tokens)   # ← lo que te van a cobrar como input

# La respuesta normal también trae el uso real:
# msg.usage.input_tokens, msg.usage.output_tokens`

function LetterFigure() {
  // posición de cada letra dentro de qué token
  const owner: number[] = []
  WORD_TOKS.forEach((t, ti) => Array.from(t.text.trim()).forEach(() => owner.push(ti)))
  return (
    <div className="tokens-letters" aria-label="Letras de ferrocarril y sus tokens">
      <div className="tokens-letters-row">
        <span className="label">tú ves</span>
        <span className="tokens-letters-cells">
          {Array.from(WORD).map((c, i) => (
            <span key={i} className={`tokens-letter${c === 'r' ? ' is-r' : ''}`} data-tone={['user', 'model', 'data', 'tool'][owner[i] % 4]}>
              {c}
            </span>
          ))}
        </span>
      </div>
      <div className="tokens-letters-row">
        <span className="label">el modelo ve</span>
        <TokenChips tokens={toChips(WORD_TOKS).map((t, i) => ({ ...t, tone: (['user', 'model', 'data', 'tool'] as const)[i % 4] }))} />
      </div>
      <div className="tokens-letters-row">
        <span className="label">en realidad</span>
        <span className="mono small">[{WORD_TOKS.map((t) => t.id).join(', ')}]</span>
      </div>
    </div>
  )
}

export default function Lesson() {
  return (
    <>
      <Section n={1} title="El modelo no ve letras: ve tokens">
        <p>
          Antes de que un LLM “lea” tu mensaje, un <Term tip="Programa determinista (no es una red neuronal) que convierte texto en una lista de enteros y viceversa.">tokenizador</Term>{' '}
          lo corta en piezas llamadas <b>tokens</b>: palabras completas, trozos de palabra, signos o incluso bytes sueltos. Cada pieza tiene un número (su
          ID) en un vocabulario fijo. El modelo nunca ve tu texto: ve esa lista de números.
        </p>
        <p>
          Todo se mide en tokens: el límite de la ventana de contexto, la velocidad de generación y lo que pagas. Escribe en el lab y mira dónde cae cada
          corte.
        </p>
        <TokenizerLab />
        <Callout tone="tip" title="Regla práctica">
          En inglés un token ronda los 4 caracteres; en español suele ser algo menos, así que el mismo mensaje cuesta más. Números, código, emoji y
          tildes también “inflan” el conteo.
        </Callout>
      </Section>

      <Section n={2} title="Cómo se aprende el vocabulario: BPE">
        <p>
          Nadie escribe el vocabulario a mano. La mayoría de los modelos usa <b>Byte-Pair Encoding (BPE)</b> o una variante: se parte de caracteres (o
          bytes) y se fusiona, una y otra vez, el par de símbolos vecinos más frecuente en un corpus enorme. Cada fusión es una regla nueva y un token
          nuevo.
        </p>
        <p>
          Aquí corre el algoritmo de verdad sobre un corpus mínimo de palabras de soporte de Andes Market. Mira cómo emergen piezas reutilizables
          (como el sufijo «ado») y cómo una palabra muy frecuente termina siendo un solo token.
        </p>
        <BpeLab />
        <Callout tone="info" title="Lo simplificado">
          Los tokenizadores reales trabajan sobre bytes (así ningún texto queda sin representar), entrenan con miles de millones de palabras y hacen
          ~100.000 o más fusiones. La idea es exactamente esta.
        </Callout>
      </Section>

      <Section n={3} title="Texto → IDs → embeddings de entrada">
        <p>
          Un ID no significa nada por sí mismo: 4.821 no está “cerca” de 4.822. La primera capa del modelo es una tabla gigante, la{' '}
          <Term tip="Matriz de tamaño (tamaño del vocabulario) × (dimensión del modelo). Sus valores se aprenden durante el entrenamiento.">matriz de embeddings</Term>,
          con una fila por token del vocabulario. Cada ID selecciona su fila y esa fila (un vector de números aprendidos) es lo que entra a las capas de
          atención.
        </p>
        <EmbeddingLab />
        <p>
          Los vocabularios modernos tienen del orden de <b>100.000 a 200.000 tokens</b>. Con miles de dimensiones por fila, esta sola tabla puede tener
          cientos de millones de parámetros. Por eso el tamaño del vocabulario es una decisión de diseño:
        </p>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Vocabulario</th>
                <th>Ventaja</th>
                <th>Costo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Pequeño (p. ej. 30k)</td>
                <td>Tabla de embeddings chica, cada token se ve muchas veces al entrenar</td>
                <td>Textos más largos en tokens → más cómputo y menos texto en la ventana</td>
              </tr>
              <tr>
                <td>Grande (100k–200k+)</td>
                <td>Menos tokens por texto, mejor cobertura de idiomas y código</td>
                <td>Más parámetros; tokens raros con pocos ejemplos de entrenamiento</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={4} title="Consecuencias que vas a notar">
        <h3>¿Cuántas «r» tiene «ferrocarril»?</h3>
        <p>
          Una pregunta trivial para ti y sorprendentemente difícil para un LLM. El modelo no ve las 11 letras: ve {WORD_TOKS.length} IDs. Para contar
          «r» tendría que haber memorizado cómo se deletrea cada token, y aquí las «rr» incluso quedan partidas entre dos tokens.
        </p>
        <LetterFigure />
        <Callout tone="warn" title="Síntomas típicos de la tokenización">
          Errores al contar letras o invertir palabras, aritmética frágil con números largos (se cortan en grupos de dígitos arbitrarios), y peor
          rendimiento en idiomas o alfabetos poco representados en el vocabulario. Si necesitas exactitud, que lo haga una herramienta (código), no el
          modelo.
        </Callout>
        <h3>El costo escala con los tokens, no con las palabras</h3>
        <p>
          Los proveedores cobran por millón de tokens de entrada y de salida (en esta simulación, US$ 3 y US$ 15). Cada proveedor usa su propio
          tokenizador, así que el mismo texto da conteos distintos según el modelo. Para presupuestar, mide con la API en vez de estimar:
        </p>
        <Code code={COUNT_CODE} lang="python" title="contar_tokens.py" />
      </Section>

      <KeyIdeas
        items={[
          'Un LLM procesa una lista de IDs enteros, no letras ni palabras. El tokenizador es un paso determinista previo al modelo.',
          'BPE construye el vocabulario fusionando repetidamente el par de símbolos más frecuente: las palabras comunes quedan enteras y las raras se arman con piezas o bytes.',
          'Cada ID solo selecciona una fila de la matriz de embeddings; esa secuencia de vectores es lo que entra a las capas del modelo.',
          'Español, números, código y emoji usan más tokens por carácter que el inglés: eso es más costo y menos espacio en la ventana.',
          'Contar letras o hacer aritmética larga falla porque el modelo no ve caracteres: delega eso a herramientas.',
        ]}
      />
    </>
  )
}
