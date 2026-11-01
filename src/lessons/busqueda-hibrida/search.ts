/* ==========================================================================
   Motor de búsqueda de la lección: BM25 real, búsqueda vectorial (coseno),
   fusión RRF y un reranker "cross-encoder" simulado.
   Todo corre sobre KB_CHUNKS / KB_INDEX de Andes Market.
   ========================================================================== */
import { KB_CHUNKS, KB_INDEX, type KbChunk } from '../../sim/corpus'
import { analyze, CONCEPTS, embed, searchTopK } from '../../sim/embed'
import { cosine, countTokens, fold } from '../../sim/math'

/* ---------------------------------------------------------------- tokenizer */

/** Stopwords en español (lista corta, sin tildes porque se aplica después de fold). */
export const STOPWORDS = new Set(
  (
    'a al algo algunas algunos ante antes como con contra cual cuales de del desde donde durante e el ella ellas ellos ' +
    'en entre era es esa esas ese eso esos esta estan estas este esto estos fue ha hay hasta la las le les lo los me mi mis ' +
    'mas muy nada ni no nos o os otra otras otro otros para pero poco por porque que quien quienes se ser si sin sobre ' +
    'son su sus tambien te ti tu tus un una uno unos y ya yo puedo puede puedes hago hace tengo tiene cuanto cuanta cual ' +
    'mucho muchos todo todos toda todas esto les eso'
  ).split(' '),
)

/** fold() + separa en términos. Mantiene identificadores con guion o punto ("cx-99812-cl", "39.990"). */
export function tokenize(text: string): string[] {
  return fold(text).match(/[a-z0-9]+(?:[-.][a-z0-9]+)*/g) ?? []
}

export function terms(text: string): string[] {
  return tokenize(text).filter((t) => !STOPWORDS.has(t))
}

/* --------------------------------------------------------------------- BM25 */

export const K1 = 1.2
export const B = 0.75

type DocStats = { chunk: KbChunk; tf: Map<string, number>; len: number }

const DOCS: DocStats[] = KB_CHUNKS.map((chunk) => {
  const ts = terms(chunk.text)
  const tf = new Map<string, number>()
  for (const t of ts) tf.set(t, (tf.get(t) ?? 0) + 1)
  return { chunk, tf, len: ts.length }
})
export const N_DOCS = DOCS.length
export const AVGDL = DOCS.reduce((s, d) => s + d.len, 0) / N_DOCS
const DF = new Map<string, number>()
for (const d of DOCS) for (const t of d.tf.keys()) DF.set(t, (DF.get(t) ?? 0) + 1)

export const df = (t: string) => DF.get(t) ?? 0
/** idf de Lucene/BM25+: siempre positivo. */
export const idf = (t: string) => Math.log(1 + (N_DOCS - df(t) + 0.5) / (df(t) + 0.5))

export type TermContribution = { term: string; tf: number; df: number; idf: number; tfNorm: number; score: number }

export type Bm25Hit = { chunk: KbChunk; score: number; len: number; parts: TermContribution[] }

/** Puntaje BM25 de todos los chunks (ordenado desc). Los términos de la consulta se deduplican. */
export function bm25(query: string, k1 = K1, b = B): Bm25Hit[] {
  const q = [...new Set(terms(query))]
  return DOCS.map((d) => {
    const parts = q.map((term) => {
      const f = d.tf.get(term) ?? 0
      const i = idf(term)
      const tfNorm = f === 0 ? 0 : (f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / AVGDL))
      return { term, tf: f, df: df(term), idf: i, tfNorm, score: i * tfNorm }
    })
    return { chunk: d.chunk, len: d.len, parts, score: parts.reduce((s, p) => s + p.score, 0) }
  }).sort((a, b2) => b2.score - a.score)
}

/* ------------------------------------------------------------------- vector */

export type VecHit = { chunk: KbChunk; score: number }

export function vectorSearch(query: string): VecHit[] {
  return searchTopK(query, KB_INDEX, KB_INDEX.length).map((h) => ({ chunk: h.item, score: h.score }))
}

/* ---------------------------------------------------------------------- RRF */

export const RRF_K = 60
export const LIST_K = 8

export type FusedHit = {
  chunk: KbChunk
  rrf: number
  /** posición 1-based en cada lista (null si no aparece en su top) */
  bmRank: number | null
  vecRank: number | null
  bmPart: number
  vecPart: number
}

export type SearchResult = {
  query: string
  qTerms: string[]
  bm: Bm25Hit[] // solo con score > 0, top LIST_K
  bmAll: Bm25Hit[]
  vec: VecHit[] // top LIST_K
  fused: FusedHit[]
}

export function hybrid(query: string, k = RRF_K, listK = LIST_K): SearchResult {
  const bmAll = bm25(query)
  const bm = bmAll.filter((h) => h.score > 0).slice(0, listK)
  const vec = vectorSearch(query).slice(0, listK)
  const map = new Map<string, FusedHit>()
  const get = (c: KbChunk) => {
    let f = map.get(c.id)
    if (!f) {
      f = { chunk: c, rrf: 0, bmRank: null, vecRank: null, bmPart: 0, vecPart: 0 }
      map.set(c.id, f)
    }
    return f
  }
  bm.forEach((h, i) => {
    const f = get(h.chunk)
    f.bmRank = i + 1
    f.bmPart = 1 / (k + i + 1)
    f.rrf += f.bmPart
  })
  vec.forEach((h, i) => {
    const f = get(h.chunk)
    f.vecRank = i + 1
    f.vecPart = 1 / (k + i + 1)
    f.rrf += f.vecPart
  })
  // orden estable: empate → el que aparece primero en alguna lista
  const fused = [...map.values()].sort((a, b) => b.rrf - a.rrf || Math.min(a.bmRank ?? 99, a.vecRank ?? 99) - Math.min(b.bmRank ?? 99, b.vecRank ?? 99))
  return { query, qTerms: [...new Set(terms(query))], bm, bmAll, vec, fused }
}

/* ------------------------------------------------- reranker (cross-encoder) */

export type RerankDetail = {
  chunk: KbChunk
  score: number
  /** fracción de conceptos de la consulta cubiertos por el chunk */
  conceptCov: number
  /** fracción de términos de la consulta presentes (con variantes: compra ≈ compras) */
  termCov: number
  /** similitud densa (coseno) como señal adicional */
  dense: number
  /** conceptos del chunk ajenos a la pregunta */
  offTopic: number
  matched: string[]
  exact: string[]
  qConcepts: string[]
  cConcepts: string[]
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
const prefixMatch = (a: string, b: string) => {
  const n = Math.min(5, a.length, b.length)
  return n >= 4 ? a.slice(0, n) === b.slice(0, n) : a === b
}

/**
 * Cross-encoder SIMULADO: "lee" la consulta y el chunk juntos y exige que el
 * chunk cubra TODOS los aspectos de la pregunta (no solo uno), con bono por
 * términos raros exactos. Un cross-encoder real es un transformer que recibe
 * "[CLS] consulta [SEP] documento" y devuelve un logit de relevancia.
 */
export function rerankScore(query: string, chunk: KbChunk): RerankDetail {
  const qT = [...new Set(terms(query))]
  const cT = terms(chunk.text)
  const matched = qT.filter((t) => cT.some((c) => prefixMatch(t, c)))
  const exact = qT.filter((t) => cT.includes(t) && idf(t) > 1.6)
  const qa = analyze(query).scores
  const ca = analyze(chunk.text).scores
  const qC = CONCEPTS.filter((_, i) => qa[i] > 0).map((c) => c.id)
  const cC = CONCEPTS.filter((_, i) => ca[i] > 0).map((c) => c.id)
  const inter = qC.filter((c) => cC.includes(c))
  const termCov = qT.length ? matched.length / qT.length : 0
  // si la consulta no activa ningún concepto, el modelo se apoya solo en las palabras
  const conceptCov = qC.length ? inter.length / qC.length : termCov
  const offTopic = qC.length ? cC.filter((c) => !qC.includes(c)).length : 0
  const dense = Math.max(0, cosine(embed(query), embed(chunk.text)))
  const logit = -3.3 + 1.9 * conceptCov + 2.4 * termCov + 1.0 * Math.min(exact.length, 2) + 1.8 * dense - 0.2 * offTopic + (conceptCov === 1 && qC.length > 1 ? 0.7 : 0)
  return { chunk, score: sigmoid(logit), conceptCov, termCov, dense, offTopic, matched, exact, qConcepts: qC, cConcepts: cC }
}

export function rerank(query: string, candidates: KbChunk[]): RerankDetail[] {
  return candidates.map((c) => rerankScore(query, c)).sort((a, b) => b.score - a.score)
}

/** Tokens que ocupa un chunk dentro del prompt (texto + cabecera con fuente). */
export const chunkTokens = (c: KbChunk) => countTokens(c.text) + 14

/* ------------------------------------------------------------------ presets */

export type Preset = { q: string; label: string; why: string }

export const PRESETS: Preset[] = [
  { q: 'RUT de la empresa', label: 'RUT empresa', why: 'identificador exacto: BM25 lo encuentra, el vector casi no' },
  { q: 'trajes de baño higiene', label: 'trajes de baño', why: 'palabras raras sin concepto en el embedding' },
  { q: 'me arrepentí de la compra', label: 'me arrepentí', why: 'paráfrasis: no comparte palabras con el chunk correcto' },
  { q: '¿Cuánto demora el reembolso si pagué con tarjeta?', label: 'demora reembolso', why: 'mezcla dos temas: ambos métodos aportan' },
  { q: 'Webpay cuotas sin interés', label: 'Webpay cuotas', why: 'nombre propio + concepto' },
  { q: 'olvidé la clave para entrar', label: 'olvidé la clave', why: 'sinónimo (clave ≈ contraseña)' },
]

export const shortText = (s: string, n = 70) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
