import { Link } from 'react-router'
import { Callout, KeyIdeas, Section, Tabs, Term } from '../../components/ui'
import { Code, Json } from '../../components/Code'
import { KB_INDEX } from '../../sim/corpus'
import { hashString } from '../../sim/math'
import { PipelineLab } from './PipelineLab'
import { ChunkLab } from './ChunkLab'
import { FilterLab } from './FilterLab'
import { ReindexLab } from './ReindexLab'
import './lesson.css'

const SAMPLE = KB_INDEX.filter((c) => c.docId === 'devoluciones').slice(0, 2)
const PAYLOAD = {
  namespace: 'kb-andes',
  vectors: SAMPLE.map((c) => ({
    id: c.id,
    values: c.vector.map((x) => Number(x.toFixed(4))),
    metadata: {
      texto: c.text,
      doc: c.docId,
      fuente: c.source,
      actualizado: c.updated,
      hash: hashString(c.text).toString(16),
      modelo_embeddings: 'sim-16d',
    },
  })),
}

const PY = `import chromadb

client = chromadb.PersistentClient(path="./kb_andes")
col = client.get_or_create_collection(name="andes_kb")

chunks = cortar_por_parrafo(documento)          # tu chunker
textos = [c.texto for c in chunks]
vectores = embeber(textos)                      # el MISMO modelo que usarás en las consultas

col.upsert(
    ids=[c.id for c in chunks],                 # "devoluciones#1", "devoluciones#2", …
    embeddings=vectores,
    documents=textos,
    metadatas=[
        {"doc": c.doc_id, "fuente": c.fuente,
         "actualizado": c.actualizado, "hash": c.hash}
        for c in chunks
    ],
)

# más adelante, al consultar (con filtro de metadata):
res = col.query(
    query_embeddings=embeber(["¿Cuánto demora el reembolso?"]),
    n_results=3,
    where={"doc": "devoluciones"},
)`

const SQL = `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE kb_chunks (
  id          text PRIMARY KEY,        -- 'devoluciones#3'
  doc         text NOT NULL,
  texto       text NOT NULL,
  embedding   vector(1536) NOT NULL,   -- dimensiones del modelo
  fuente      text,
  actualizado date,
  hash        text
);

-- upsert: inserta o reemplaza si el id ya existe
INSERT INTO kb_chunks (id, doc, texto, embedding, fuente, actualizado, hash)
VALUES ('devoluciones#3', 'devoluciones',
        'El reembolso se realiza al mismo medio de pago…',
        '[0.0123, -0.0441, 0.0870, …]',
        'politicas/devoluciones.md', '2026-09-14', '9f3a1c07')
ON CONFLICT (id) DO UPDATE
  SET texto = EXCLUDED.texto,
      embedding = EXCLUDED.embedding,
      actualizado = EXCLUDED.actualizado,
      hash = EXCLUDED.hash;`

export default function Lesson() {
  return (
    <>
      <Section n={1} title="Preparar antes de buscar">
        <p>
          Un sistema RAG no busca en tus documentos “tal cual”. Antes hay una <b>ingesta</b>: limpiar el texto, cortarlo en pedazos (
          <Term tip="Fragmento de un documento que se embebe y se recupera como unidad. Lo que el modelo leerá como contexto.">chunks</Term>), convertir cada chunk en un vector y
          guardarlo con su metadata en un <Term tip="Base de datos que guarda vectores y encuentra los más cercanos a una consulta.">vector store</Term>.
        </p>
        <p>Esto ocurre una vez por documento (y otra vez cada vez que cambia). Mira la tubería completa con la base de conocimiento de Andes Market:</p>
        <PipelineLab />
      </Section>

      <Section n={2} title="Chunking: dónde cortar">
        <p>
          El tamaño del chunk es una decisión con consecuencias. Muy chico: el chunk pierde contexto y la respuesta queda partida. Muy grande: el vector “promedia” varios temas,
          compite peor en la búsqueda y llena la ventana de contexto con texto que no sirve. El <b>solapamiento</b> repite unas palabras entre chunks vecinos para que nada quede
          cortado justo en el borde.
        </p>
        <ChunkLab />
        <Callout tone="tip" title="Punto de partida razonable">
          En documentos reales suele empezarse con chunks de 200–800 tokens y 10–20 % de solapamiento, respetando la estructura (títulos, párrafos) cuando existe. Después se ajusta
          midiendo: arma un set de preguntas con su respuesta esperada y revisa si el chunk correcto aparece en el top-k.
        </Callout>
      </Section>

      <Section n={3} title="El registro: vector + texto + metadata">
        <p>
          Cada chunk se guarda como una fila: un <b>ID estable</b>, el <b>vector</b>, el <b>texto</b> (para entregárselo al modelo) y <b>metadata</b> (de dónde viene, cuándo se
          actualizó, a qué documento pertenece). La operación típica es <code>upsert</code>: si el ID existe lo reemplaza, si no lo crea.
        </p>
        <Tabs
          tabs={[
            { id: 'json', label: 'Payload de upsert (JSON)', content: <Json value={PAYLOAD} title="POST /vectors/upsert · formato genérico" maxHeight={380} /> },
            { id: 'py', label: 'Python · Chroma', content: <Code code={PY} lang="python" title="ingesta.py" maxHeight={420} /> },
            { id: 'sql', label: 'SQL · pgvector', content: <Code code={SQL} lang="text" title="kb_chunks.sql" maxHeight={420} /> },
          ]}
        />
        <p>
          La metadata no es decoración: permite <b>filtrar</b> antes de comparar vectores. Si la pregunta es sobre pagos, o si solo quieres políticas vigentes, el filtro descarta
          candidatos que de otro modo podrían colarse por parecido.
        </p>
        <FilterLab />
      </Section>

      <Section n={4} title="Mantener el índice al día">
        <p>
          Los documentos cambian. Re-embeber todo en cada cambio es caro y lento; lo habitual es guardar un <b>hash del contenido</b> de cada chunk y solo procesar lo que cambió.
          Lo que desaparece del documento hay que borrarlo del índice, o el agente seguirá citando información vieja.
        </p>
        <ReindexLab />
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Costo</th>
                <th>Cuándo se paga</th>
                <th>Orden de magnitud</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Embeber documentos</td>
                <td>Al indexar y en cada cambio</td>
                <td>~US$0,02–0,13 por millón de tokens en modelos comerciales; 1 millón de tokens ≈ 2.500 páginas</td>
              </tr>
              <tr>
                <td>Almacenamiento</td>
                <td>Mensual</td>
                <td>N° chunks × dimensiones × 4 bytes: 1 millón de chunks de 1536 dims ≈ 6 GB solo en vectores</td>
              </tr>
              <tr>
                <td>Embeber la consulta</td>
                <td>En cada pregunta</td>
                <td>Unos pocos tokens: despreciable, pero suma latencia (una llamada más)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout tone="warn" title="Errores comunes">
          Indexar menús, pies de página o tablas de navegación (ensucian los resultados); perder la fecha o la fuente (no puedes filtrar ni citar); y cambiar de modelo de
          embeddings sin re-indexar todo (ver <Link to="/leccion/embeddings">Embeddings</Link>).
        </Callout>
      </Section>

      <KeyIdeas
        items={[
          'La ingesta es una tubería: documento → limpieza → chunks → embeddings → upsert en el vector store. Se hace antes de cualquier consulta.',
          'El tamaño del chunk y el solapamiento deciden si la respuesta llega completa o partida al modelo. Mídelo con preguntas reales.',
          'Cada fila guarda ID estable, vector, texto y metadata. La metadata permite filtrar (documento, fecha, categoría) y citar la fuente.',
          'Con un hash del contenido solo re-embebes lo que cambió y borras lo que ya no existe.',
          <>
            Cuando hay millones de filas, comparar con todas es lento: la siguiente lección muestra cómo lo resuelve un <Link to="/leccion/indice-hnsw">índice HNSW</Link>.
          </>,
        ]}
      />
    </>
  )
}
