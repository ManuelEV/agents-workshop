import { Link } from 'react-router'
import { Database, Search } from 'lucide-react'
import { Callout, KeyIdeas, Section, Term } from '../../components/ui'
import { Code } from '../../components/Code'
import { RagPipeline, SYSTEM_RAG } from './Pipeline'
import { AgenticLab, DiagnosisLab, VersusLab } from './Labs'
import { KB_CHUNKS } from '../../sim/corpus'
import './lesson.css'

const TOOL_CODE = `# RAG agéntico: la búsqueda es una herramienta más del agente
@tool
def consultar_politicas(pregunta: str) -> list[dict]:
    """Busca en la base de conocimiento de Andes Market (devoluciones,
    envíos, pagos, garantía, cuenta). Devuelve fragmentos con su fuente."""
    hits = buscar(pregunta, k=2, umbral=0.45)   # el mismo buscar() de arriba
    return [{"fuente": c["fuente"], "score": round(s, 3), "texto": c["texto"]}
            for c, s in hits]`

export default function Lesson() {
  return (
    <>
      <Section n={1} title="Buscar antes de responder">
        <p>
          Un LLM solo sabe lo que vio al entrenarse. No conoce tu política de devoluciones, ni el precio de hoy, ni el manual interno. Si le
          preguntas igual, no dice "no sé": completa con lo más probable. <strong>RAG</strong> (
          <Term tip="Retrieval-Augmented Generation: generar una respuesta después de recuperar información relevante y ponerla en el prompt.">
            Retrieval-Augmented Generation
          </Term>
          ) resuelve esto sin reentrenar: antes de llamar al modelo, buscas los fragmentos relevantes y se los pegas en el prompt.
        </p>
        <VersusLab />
        <div className="brag-overview">
          <div className="brag-phase">
            <h4>
              <Database size={17} color="var(--c-data)" /> Fase 1 · Indexar (una vez)
            </h4>
            <p>
              Documentos → chunks → vectores → vector store. Lo viste en <Link to="/leccion/indexacion">Ingesta</Link>.
            </p>
          </div>
          <div className="brag-phase">
            <h4>
              <Search size={17} color="var(--c-user)" /> Fase 2 · Consultar (cada pregunta)
            </h4>
            <p>Pregunta → vector → vecinos más cercanos → prompt aumentado → respuesta con citas. Es lo que verás ahora.</p>
          </div>
        </div>
      </Section>

      <Section n={2} title="Una consulta de punta a punta">
        <p>
          Sigue la pregunta en sus ocho pasos. El mapa muestra los {KB_CHUNKS.length} chunks de la base de conocimiento de Andes Market ya indexados; la
          estrella azul es tu pregunta. Cambia la consulta, <strong>k</strong> o el <strong>umbral</strong> en cualquier momento: todo se recalcula
          (incluida la respuesta, que solo puede usar los fragmentos que llegaron al prompt). Con el botón <em>Código</em> ves la línea de Python
          que ejecuta cada paso.
        </p>
        <RagPipeline />
        <Callout tone="tip" title="Prueba esto">
          <p>
            Con "¿Cuánto demora el reembolso…?" baja <strong>k a 1</strong>: la respuesta pierde la mitad. Con "¿Va a llover mañana…?" baja el
            umbral a 0: entran fragmentos de despachos, pero el system prompt le da permiso al modelo para decir que no sabe.
          </p>
        </Callout>
        <h3>El prompt que hace el trabajo</h3>
        <p>
          La calidad de un RAG depende tanto de la búsqueda como de las instrucciones. Este es el system prompt que usa el lab: tres líneas que
          obligan a usar solo los documentos, citar y admitir cuando no hay respuesta.
        </p>
        <Code code={SYSTEM_RAG} lang="text" title="SYSTEM_RAG" lineNumbers={false} />
      </Section>

      <Section n={3} title="Cuando el RAG falla">
        <p>
          Casi todos los errores de un RAG en producción son errores de <strong>recuperación</strong>, no del modelo: si el fragmento correcto no
          llega al prompt, ningún LLM puede usarlo. Y si llega basura, el modelo la usa con total confianza.
        </p>
        <DiagnosisLab />
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Parámetro</th>
                <th>Muy bajo</th>
                <th>Muy alto</th>
                <th>Punto de partida</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>k (vecinos)</td>
                <td>Se pierde información útil</td>
                <td>Ruido, más tokens, más costo</td>
                <td className="mono">3–8 (más si usas reranker)</td>
              </tr>
              <tr>
                <td>Umbral de similitud</td>
                <td>Entra basura irrelevante</td>
                <td>Respondes "no sé" demasiado</td>
                <td className="mono">calíbralo con tus datos</td>
              </tr>
              <tr>
                <td>Tamaño de chunk</td>
                <td>Respuestas partidas</td>
                <td>Vectores "diluidos"</td>
                <td className="mono">por párrafo/sección</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout tone="warn" title="El umbral depende del modelo">
          Cada modelo de embeddings tiene su propia distribución de similitudes: en uno, 0,45 es "bastante parecido"; en otro, todo cae entre 0,7
          y 0,9. No copies umbrales: mídelos con un conjunto de preguntas reales.
        </Callout>
      </Section>

      <Section n={4} title="RAG agéntico: el agente decide cuándo y qué buscar">
        <p>
          En el RAG clásico la búsqueda ocurre siempre, con el texto literal del usuario. En un agente, la búsqueda es una{' '}
          <Link to="/leccion/herramientas">herramienta</Link>: el modelo decide si necesita buscar, <strong>reescribe la consulta</strong> para que
          sea buena para el buscador y, si el resultado no alcanza, busca otra vez.
        </p>
        <AgenticLab />
        <Code code={TOOL_CODE} lang="python" title="tools.py" />
        <p style={{ marginTop: 14 }}>
          El costo: al menos una llamada extra al LLM por pregunta, y menos control sobre cuándo se busca. Muchas aplicaciones combinan ambos:
          recuperación fija para el caso común y la herramienta para que el agente profundice.
        </p>
      </Section>

      <KeyIdeas
        items={[
          <>RAG no cambia el modelo: cambia el <strong>prompt</strong>. El LLM solo "sabe" lo que le pegas en el contexto.</>,
          <>La consulta se vectoriza con el <strong>mismo modelo</strong> que los documentos y se compara por similitud coseno.</>,
          <>Top-k y umbral deciden qué llega al prompt; casi todos los errores de RAG son errores de recuperación.</>,
          <>Pide citas y da permiso para decir "no sé": es la defensa más barata contra alucinaciones.</>,
          <>En un agente, la búsqueda es una herramienta: el modelo reformula la consulta y decide cuándo buscar.</>,
        ]}
      />
    </>
  )
}
