import { Link } from 'react-router'
import { Callout, KeyIdeas, Section, Tabs, Term } from '../../components/ui'
import { Code } from '../../components/Code'
import { ScaleLab } from './ScaleLab'
import { LayersLab } from './LayersLab'
import { ParamsLab } from './ParamsLab'
import './lesson.css'

const SQL = `-- pgvector: índice HNSW sobre la tabla de chunks
CREATE INDEX kb_chunks_embedding_hnsw
  ON kb_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- por sesión: tamaño de la lista de candidatos al buscar
SET hnsw.ef_search = 40;

-- <=> es la distancia coseno; ORDER BY + LIMIT usa el índice
SELECT id, texto, 1 - (embedding <=> $1) AS similitud
FROM kb_chunks
WHERE doc = 'devoluciones'
ORDER BY embedding <=> $1
LIMIT 5;`

const PY = `import hnswlib
import numpy as np

dim = 1536
vectores = np.load("kb_vectores.npy")          # (N, 1536) float32

index = hnswlib.Index(space="cosine", dim=dim)
index.init_index(max_elements=len(vectores), M=16, ef_construction=200)
index.add_items(vectores, ids=np.arange(len(vectores)))

index.set_ef(50)                                # ef_search: debe ser >= k
labels, distancias = index.knn_query(consulta_vec, k=5)`

export default function Lesson() {
  return (
    <>
      <Section n={1} title="El problema: comparar con todos">
        <p>
          En la <Link to="/leccion/embeddings">lección de embeddings</Link> buscamos vecinos comparando la consulta con cada vector. Eso es{' '}
          <Term tip="k vecinos más cercanos exactos: mide la distancia a todos los vectores y ordena. Siempre correcto, pero su costo crece lineal con N.">kNN exacto</Term> o fuerza
          bruta. Con 40 frases es instantáneo; con 10 millones de chunks de 1536 dimensiones son miles de millones de multiplicaciones por pregunta.
        </p>
        <p>
          Los vector stores usan índices <Term tip="Approximate Nearest Neighbors: encuentran casi siempre los vecinos correctos revisando una fracción mínima de la colección.">ANN</Term>{' '}
          (vecinos aproximados): aceptan perder de vez en cuando un vecino a cambio de revisar una fracción ínfima de la colección.
        </p>
        <ScaleLab />
      </Section>

      <Section n={2} title="La idea de HNSW: autopistas y calles">
        <p>
          HNSW (<i>Hierarchical Navigable Small World</i>) organiza los vectores en un grafo por capas. La capa 0 tiene todos los nodos, conectados con sus vecinos cercanos (las
          calles). Cada capa superior tiene una fracción sorteada de nodos con enlaces más largos (las autopistas).
        </p>
        <p>
          Para buscar, entra por arriba y avanza de forma <b>voraz</b>: salta al vecino más cercano a la consulta hasta que ninguno mejora; entonces baja una capa y repite. En la
          capa 0 hace una búsqueda más cuidadosa con una lista de <b>ef</b> candidatos. El grafo de abajo está construido de verdad con el algoritmo HNSW; la búsqueda también es
          real.
        </p>
        <LayersLab />
        <Callout tone="info" title="Simplificaciones">
          Usamos puntos 2D para poder dibujarlos y la selección de vecinos más simple (los M más cercanos). Las implementaciones reales trabajan con cientos o miles de dimensiones
          y usan una heurística que prefiere vecinos en direcciones distintas, lo que mejora la navegación.
        </Callout>
      </Section>

      <Section n={3} title="Las perillas: M y ef_search">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Parámetro</th>
                <th>Qué controla</th>
                <th>Si lo subes</th>
                <th>Valores típicos</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono">M</td>
                <td>Vecinos por nodo en cada capa (la capa 0 suele usar 2·M)</td>
                <td>Mejor recall y grafo más robusto; más memoria y más lento de construir</td>
                <td className="mono">8–64</td>
              </tr>
              <tr>
                <td className="mono">ef_construction</td>
                <td>Lista de candidatos al insertar cada nodo</td>
                <td>Grafo de mejor calidad; indexación más lenta (no afecta la consulta)</td>
                <td className="mono">64–400</td>
              </tr>
              <tr>
                <td className="mono">ef_search</td>
                <td>Lista de candidatos al consultar (debe ser ≥ k)</td>
                <td>Más recall; más distancias y más latencia por consulta</td>
                <td className="mono">40–400</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ParamsLab />
        <Callout tone="tip" title="Cómo elegir">
          Fija M y ef_construction al crear el índice; después ajusta ef_search en caliente midiendo recall@k contra una búsqueda exacta sobre una muestra. Un recall de 95–99 % suele
          ser indistinguible para RAG, porque el modelo igual recibe varios chunks relevantes.
        </Callout>
      </Section>

      <Section n={4} title="Otros índices y dónde viven">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Índice</th>
                <th>Cómo funciona</th>
                <th>Fortaleza</th>
                <th>Costo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>Flat</b> (fuerza bruta)
                </td>
                <td>Compara con todos</td>
                <td>Recall 100 %, cero construcción</td>
                <td>Lineal en N: solo para colecciones chicas o para medir recall</td>
              </tr>
              <tr>
                <td>
                  <b>HNSW</b>
                </td>
                <td>Grafo navegable por capas</td>
                <td>Muy rápido con recall alto; admite inserciones incrementales</td>
                <td>Mucha RAM (vectores + grafo); construcción costosa</td>
              </tr>
              <tr>
                <td>
                  <b>IVF</b>
                </td>
                <td>Agrupa los vectores en clusters (k-means) y solo revisa los clusters más cercanos (nprobe)</td>
                <td>Menos memoria que HNSW, construcción rápida</td>
                <td>Necesita entrenar los centroides; recall depende de nprobe</td>
              </tr>
              <tr>
                <td>
                  <b>PQ / cuantización</b>
                </td>
                <td>Comprime cada vector (p. ej. float32 → int8, binario o códigos de subvectores)</td>
                <td>Hasta decenas de veces menos memoria; se combina con IVF o HNSW</td>
                <td>Pierde precisión: suele re-ordenarse el top con los vectores completos</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          No tienes que implementarlos: vienen dentro de las bases vectoriales. <b>pgvector</b> (extensión de PostgreSQL) ofrece HNSW e IVFFlat; <b>OpenSearch</b> y
          Elasticsearch traen HNSW (con opciones de cuantización); servicios administrados como <b>Pinecone</b> o <b>Amazon S3 Vectors</b> esconden el índice detrás de una API;
          librerías como <b>FAISS</b> o <b>hnswlib</b> te dan los índices para usarlos en tu propio proceso.
        </p>
        <Tabs
          tabs={[
            { id: 'sql', label: 'pgvector (SQL)', content: <Code code={SQL} lang="text" title="indice_hnsw.sql" /> },
            { id: 'py', label: 'hnswlib (Python)', content: <Code code={PY} lang="python" title="indice.py" /> },
          ]}
        />
        <Callout tone="warn" title="Filtros + ANN">
          Combinar un filtro de metadata con un índice aproximado tiene trampa: si el filtro descarta la mayoría de los candidatos que el grafo visitó, puedes recibir menos de k
          resultados. Revisa cómo maneja tu base el filtrado (antes, durante o después de la búsqueda).
        </Callout>
      </Section>

      <KeyIdeas
        items={[
          'La búsqueda exacta compara con todos los vectores: su costo crece lineal con N. Sirve para colecciones chicas y para medir recall.',
          'HNSW navega un grafo por capas: saltos largos arriba, búsqueda fina abajo. Revisa una fracción mínima de la colección.',
          'M define la conectividad del grafo (recall y memoria); ef_search define cuántos candidatos revisa cada consulta (recall y latencia).',
          'Los índices ANN cambian un poco de recall por mucha velocidad. Mide recall@k en tu caso en vez de asumirlo.',
          'IVF y la cuantización (PQ, int8, binaria) reducen memoria; los vector stores combinan estas técnicas detrás de su API.',
          <>
            Con la base indexada y una búsqueda rápida, ya puedes armar el flujo completo en la lección <Link to="/leccion/busqueda-rag">Consulta RAG</Link>.
          </>,
        ]}
      />
    </>
  )
}
