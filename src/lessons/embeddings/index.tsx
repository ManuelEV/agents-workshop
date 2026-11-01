import { Link } from 'react-router'
import { Callout, KeyIdeas, Section, Term } from '../../components/ui'
import { cosine, dot, euclid } from '../../sim/math'
import { CORPUS } from './data'
import { MapLab } from './MapLab'
import { CosineLab } from './CosineLab'
import { TextToVectorLab } from './TextToVectorLab'
import { ModelLab } from './ModelLab'
import './lesson.css'

const A = CORPUS[0]
const B = CORPUS[1]
const C = CORPUS.find((p) => p.text.includes('llover'))!

export default function Lesson() {
  return (
    <>
      <Section n={1} title="El significado como coordenadas">
        <p>
          Un <Term tip="Lista fija de números que representa el significado de un texto. Textos parecidos producen vectores cercanos.">embedding</Term> convierte un texto en un
          vector: una lista de números. La gracia es que la geometría refleja el significado: frases que dicen lo mismo quedan cerca, aunque no compartan ni una palabra.
        </p>
        <p>
          Abajo tienes 43 consultas reales de clientes de Andes Market convertidas en vectores y dibujadas en 2D. Mira cómo se forman barrios por tema y escribe tu propia frase
          para ver dónde cae.
        </p>
        <Callout tone="info" title="Modelo didáctico">
          Aquí usamos un modelo simulado de <b>16 dimensiones</b> donde 12 son legibles (cada una mide un concepto) para que puedas ver qué pasa. Los modelos reales producen entre{' '}
          <b>768 y 3072 dimensiones</b> aprendidas que nadie puede interpretar una por una, y entienden sinónimos, contexto e idiomas mucho mejor.
        </Callout>
        <MapLab />
      </Section>

      <Section n={2} title="De texto a vector">
        <p>
          ¿Qué pasa entre la frase y el punto? El texto se corta en tokens, un modelo los procesa juntos y entrega un vector de largo fijo. Ese vector se normaliza y, solo para
          mirarlo, se proyecta a 2D.
        </p>
        <TextToVectorLab />
      </Section>

      <Section n={3} title="Medir parecido: similitud coseno">
        <p>
          Para saber si dos vectores “dicen lo mismo” se mide el ángulo entre ellos. La <b>similitud coseno</b> vale 1 si apuntan en la misma dirección, 0 si son perpendiculares
          (sin relación) y −1 si son opuestos. Se calcula multiplicando dimensión por dimensión, sumando, y dividiendo por los largos.
        </p>
        <CosineLab />
        <Callout tone="tip" title="Fíjate en el primer par">
          “Quiero devolver las zapatillas” y “¿Cómo pido un reembolso?” no comparten palabras, pero dan un coseno alto porque activan la misma dimensión (Devoluciones). Esto es lo
          que una búsqueda por palabras clave no puede hacer.
        </Callout>
      </Section>

      <Section n={4} title="Coseno, producto punto o distancia euclidiana">
        <p>
          Las bases vectoriales te dejan elegir la métrica. Con vectores normalizados (lo habitual), las tres ordenan los resultados igual; la diferencia está en la escala y en el
          costo de cálculo.
        </p>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Métrica</th>
                <th>Qué mide</th>
                <th>Rango</th>
                <th>Ejemplo: “devolver” vs “reembolso”</th>
                <th>Ejemplo: “devolver” vs “llover”</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>Coseno</b>
                </td>
                <td>Ángulo entre vectores; ignora el largo</td>
                <td className="mono">−1 a 1 (más alto = más parecido)</td>
                <td className="num">{cosine(A.vector, B.vector).toFixed(3)}</td>
                <td className="num">{cosine(A.vector, C.vector).toFixed(3)}</td>
              </tr>
              <tr>
                <td>
                  <b>Producto punto</b>
                </td>
                <td>Σ aᵢ·bᵢ; igual al coseno si los vectores miden 1</td>
                <td className="mono">sin límite (más alto = más parecido)</td>
                <td className="num">{dot(A.vector, B.vector).toFixed(3)}</td>
                <td className="num">{dot(A.vector, C.vector).toFixed(3)}</td>
              </tr>
              <tr>
                <td>
                  <b>Euclidiana (L2)</b>
                </td>
                <td>Distancia en línea recta; con vectores unitarios ‖a−b‖² = 2 − 2·cos</td>
                <td className="mono">0 a 2 (más bajo = más parecido)</td>
                <td className="num">{euclid(A.vector, B.vector).toFixed(3)}</td>
                <td className="num">{euclid(A.vector, C.vector).toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Hay una regla que no se negocia: <b>los documentos y las consultas deben embeberse con el mismo modelo</b> (y la misma versión). Cada modelo inventa su propio sistema de
          coordenadas. Pruébalo:
        </p>
        <ModelLab />
        <Callout tone="warn" title="Si cambias de modelo, reindexa todo">
          Actualizar el modelo de embeddings obliga a recalcular los vectores de toda la base. Guarda el nombre del modelo en la metadata de cada registro para detectar mezclas.
        </Callout>
      </Section>

      <KeyIdeas
        items={[
          'Un embedding es un vector de largo fijo que captura el significado de un texto: cerca en el espacio = parecido en significado.',
          'La similitud coseno mide el ángulo entre vectores. Con vectores normalizados es igual al producto punto, y la distancia euclidiana da el mismo orden.',
          'El mapa 2D es una proyección (UMAP/PCA) para mirar; la búsqueda se hace con todas las dimensiones (768–3072 en modelos reales).',
          'Documentos y consultas deben usar el mismo modelo de embeddings: mezclar modelos no falla, pero devuelve resultados sin sentido.',
          <>
            Siguiente paso: preparar los documentos para buscarlos (<Link to="/leccion/indexacion">Ingesta e indexación</Link>) y luego usarlos en una{' '}
            <Link to="/leccion/busqueda-rag">consulta RAG</Link> completa.
          </>,
        ]}
      />
    </>
  )
}
