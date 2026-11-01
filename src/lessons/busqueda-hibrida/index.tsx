import { useState } from 'react'
import { Callout, KeyIdeas, Section, Term } from '../../components/ui'
import { Code } from '../../components/Code'
import { Bm25Lab } from './Bm25Lab'
import { CompareLab } from './CompareLab'
import { FusionLab } from './FusionLab'
import { RerankLab } from './RerankLab'
import { PRESETS } from './search'
import './lesson.css'

const RRF_CODE = `def rrf(listas: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    """Reciprocal Rank Fusion: combina rankings usando solo la posición."""
    puntaje: dict[str, float] = {}
    for lista in listas:                      # p. ej. [ids_bm25, ids_vector]
        for rank, doc_id in enumerate(lista, start=1):
            puntaje[doc_id] = puntaje.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(puntaje.items(), key=lambda x: x[1], reverse=True)

def buscar(pregunta: str, top_k: int = 3) -> list[str]:
    ids_bm25   = bm25.search(pregunta, limit=20)          # índice invertido
    ids_vector = vectores.search(embed(pregunta), limit=20)  # ANN (HNSW)
    candidatos = [doc for doc, _ in rrf([ids_bm25, ids_vector])][:20]
    # el reranker puntúa pares (pregunta, chunk) y nos quedamos con los mejores
    puntajes = reranker.score([(pregunta, texto(d)) for d in candidatos])
    orden = sorted(zip(candidatos, puntajes), key=lambda x: x[1], reverse=True)
    return [doc for doc, s in orden[:top_k] if s > 0.3]  # umbral opcional`

export default function Lesson() {
  const [query, setQuery] = useState(PRESETS[0].q)

  return (
    <>
      <Section n={1} title="Dos buscadores, dos puntos ciegos">
        <p>
          La búsqueda vectorial entiende el <i>significado</i>: “me arrepentí de la compra” cae cerca de la política de devoluciones aunque no compartan palabras. Pero un embedding
          comprime todo en un punto y pierde lo literal: un RUT, un código de seguimiento o “trajes de baño” pueden no activar ninguna dimensión útil.
        </p>
        <p>
          <Term tip="Best Matching 25: función de ranking léxico (Robertson et al.). Puntúa por término según frecuencia en el documento (tf), rareza en la colección (idf) y largo del documento.">BM25</Term>{' '}
          hace lo contrario: es exacto con las palabras y ciego a los sinónimos. Compara los tres rankings con la misma consulta.
        </p>
        <CompareLab query={query} setQuery={setQuery} />
        <Callout tone="info" title="Lo que está simulado">
          BM25 es real (k1 = 1,2, b = 0,75, sin stemming) sobre los 20 chunks de Andes Market. El vector usa el modelo didáctico de 16 dimensiones del taller, que solo
          “entiende” 12 conceptos: por eso falla con palabras fuera de esos conceptos, de forma exagerada pero en la misma dirección que un modelo real con identificadores raros.
        </Callout>
      </Section>

      <Section n={2} title="BM25 por dentro">
        <p>
          Para cada término de la consulta, BM25 multiplica dos cosas: <b>idf</b> (qué tan raro es el término en la colección: “rut” aparece en 1 de 20 chunks, vale mucho) y
          <b> tf normalizado</b> (cuántas veces aparece en el chunk, con saturación). La suma de los aportes es el puntaje.
        </p>
        <p>
          <code>k1</code> controla la saturación: la décima repetición de “devolución” no debería valer diez veces la primera. <code>b</code> castiga a los chunks largos, que
          contienen más palabras “por azar”.
        </p>
        <Bm25Lab query={query} />
        <Callout tone="tip" title="Sin stemming, “compra” ≠ “compras”">
          Este BM25 compara términos exactos. Motores como Elasticsearch u OpenSearch aplican un analizador por idioma (minúsculas, stopwords, stemming), así “compra” y
          “compras” coinciden. Aun así, BM25 nunca relaciona “arrepentí” con “devolución”: eso es trabajo del vector.
        </Callout>
      </Section>

      <Section n={3} title="Fusión: Reciprocal Rank Fusion">
        <p>
          ¿Cómo combinar un puntaje BM25 de 5,4 con un coseno de 0,03? No se puede sumar sin normalizar, y normalizar es frágil. <b>RRF</b> evita el problema: solo usa la
          posición de cada chunk en cada lista, <code>1 / (k + rank)</code>, y suma. Con k = 60 (el valor del paper original de Cormack et al., 2009) es robusto y casi no
          requiere ajuste.
        </p>
        <FusionLab query={query} />
        <p>
          Alternativa común: <b>fusión ponderada</b> (<code>α · vector + (1 − α) · bm25</code>, con puntajes normalizados a 0–1). Da más control, pero hay que calibrar α por
          dominio. RRF es el punto de partida razonable.
        </p>
      </Section>

      <Section n={4} title="Reranking con cross-encoder">
        <p>
          BM25 y los embeddings son <Term tip="Codifican consulta y documento por separado; el documento se indexa una vez. Muy rápido, pero no ve la interacción entre ambos textos.">bi-encoders</Term>{' '}
          (o algo equivalente): consulta y documento se procesan por separado, y por eso escalan a millones de chunks. Un <b>cross-encoder</b> lee la consulta y el chunk{' '}
          <i>juntos</i>, palabra contra palabra, y entrega una relevancia mucho más fina. Es caro: hay que correrlo por cada par, así que solo reordena los primeros 20–100
          candidatos.
        </p>
        <RerankLab query={query} />
        <Callout tone="info" title="Cross-encoder simulado">
          Aquí el puntaje combina cobertura de conceptos, cobertura de términos (con variantes), coincidencias exactas raras y similitud densa. Un reranker real (p. ej. modelos
          tipo bge-reranker o servicios de rerank gestionados) es un transformer entrenado con pares pregunta-pasaje; la idea —exigir que el pasaje responda la pregunta
          completa— es la misma.
        </Callout>
      </Section>

      <Section n={5} title="¿Cuándo gana cada uno?">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Caso</th>
                <th>BM25</th>
                <th>Vector</th>
                <th>Híbrida + rerank</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Códigos e identificadores (RUT, SKU, CX-99812-CL)</td>
                <td>✅ exacto</td>
                <td>❌ suelen perderse</td>
                <td>✅</td>
              </tr>
              <tr>
                <td>Nombres propios (Webpay, Chilexpress)</td>
                <td>✅</td>
                <td>⚠️ si el modelo los vio</td>
                <td>✅</td>
              </tr>
              <tr>
                <td>Sinónimos y paráfrasis (“me arrepentí”)</td>
                <td>❌</td>
                <td>✅</td>
                <td>✅</td>
              </tr>
              <tr>
                <td>Multilingüe (“refund policy” sobre docs en español)</td>
                <td>❌</td>
                <td>✅ con modelo multilingüe</td>
                <td>✅</td>
              </tr>
              <tr>
                <td>Errores de tipeo (“reembloso”)</td>
                <td>❌ (salvo fuzzy)</td>
                <td>⚠️ a veces</td>
                <td>⚠️</td>
              </tr>
              <tr className="is-hl">
                <td>Latencia típica</td>
                <td>ms (índice invertido)</td>
                <td>ms (ANN) + embeber la consulta</td>
                <td>ambos en paralelo + 50–300 ms del rerank</td>
              </tr>
              <tr className="is-hl">
                <td>Costo</td>
                <td>muy bajo</td>
                <td>embeddings + memoria del índice</td>
                <td>+ inferencia del reranker por par</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Code code={RRF_CODE} lang="python" title="hibrida.py · pipeline completo (bm25, vectores y reranker son tus clientes)" />
        <Callout tone="warn" title="Errores comunes">
          Fusionar puntajes crudos sin normalizar; aplicar el reranker sobre muy pocos candidatos (si el chunk correcto no llegó al top-20, ningún reranker lo rescata);
          enviar el top-20 completo al LLM “por si acaso”, que encarece y mete ruido; y no medir: evalúa recall@k con preguntas reales antes y después de cada cambio.
        </Callout>
        <KeyIdeas
          items={[
            'BM25 acierta con lo literal (códigos, nombres, palabras raras); el vector acierta con el significado. Cada uno cubre el punto ciego del otro.',
            'RRF fusiona por posición, 1/(k + rank), sin normalizar puntajes: estar alto en ambas listas pesa más que ser primero en una.',
            'El cross-encoder lee consulta y chunk juntos: más preciso pero caro, por eso solo reordena los primeros candidatos.',
            'El pipeline típico: híbrida para recall (top 20–100) → reranker para precisión → top 3–5 al LLM.',
            'Menos chunks pero mejores = menos tokens, menos costo y menos ruido en la respuesta.',
          ]}
        />
      </Section>
    </>
  )
}
