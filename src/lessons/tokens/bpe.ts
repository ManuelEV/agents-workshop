/* ==========================================================================
   Entrenamiento BPE (Byte-Pair Encoding) real, sobre un corpus mínimo.

   Algoritmo (Sennrich et al., 2016):
     1. Cada palabra empieza separada en caracteres.
     2. Cuenta todos los pares adyacentes, ponderados por la frecuencia
        de la palabra en el corpus.
     3. El par más frecuente se fusiona en un símbolo nuevo → regla de merge.
     4. Repite. El vocabulario = caracteres iniciales + símbolos fusionados.

   Aquí trabajamos sobre caracteres (no bytes) y sin marcador de fin de
   palabra para que se lea fácil. Empates: gana el par que aparece primero.
   ========================================================================== */

export type CorpusWord = { word: string; freq: number }
export type Pair = { a: string; b: string; count: number }
export type BpeState = {
  /** segmentación de cada palabra tras k merges */
  parts: string[][]
  /** pares contados sobre el estado anterior (o el actual si k = 0) */
  pairs: Pair[]
  /** merge aplicado para llegar a este estado (undefined en k = 0) */
  merge?: Pair
  /** reglas aprendidas hasta ahora, en orden */
  rules: Pair[]
  vocab: string[]
  /** tokens totales del corpus = Σ freq × nº de símbolos */
  totalTokens: number
}

export const BPE_CORPUS: CorpusWord[] = [
  { word: 'pedido', freq: 10 },
  { word: 'pedidos', freq: 6 },
  { word: 'enviado', freq: 5 },
  { word: 'envío', freq: 6 },
  { word: 'entrega', freq: 6 },
  { word: 'entregado', freq: 5 },
  { word: 'llega', freq: 7 },
  { word: 'llegado', freq: 4 },
  { word: 'estado', freq: 6 },
  { word: 'despacho', freq: 3 },
  { word: 'cambio', freq: 3 },
  { word: 'cambiado', freq: 2 },
]

function countPairs(parts: string[][], corpus: CorpusWord[]): Pair[] {
  const m = new Map<string, Pair>()
  parts.forEach((p, w) => {
    for (let i = 0; i < p.length - 1; i++) {
      const key = p[i] + '\u0000' + p[i + 1]
      const cur = m.get(key)
      if (cur) cur.count += corpus[w].freq
      else m.set(key, { a: p[i], b: p[i + 1], count: corpus[w].freq })
    }
  })
  // sort estable: en empate conserva el orden de aparición
  return [...m.values()].sort((x, y) => y.count - x.count)
}

export function applyMerge(p: string[], a: string, b: string): string[] {
  const out: string[] = []
  for (let i = 0; i < p.length; i++) {
    if (i < p.length - 1 && p[i] === a && p[i + 1] === b) {
      out.push(a + b)
      i++
    } else out.push(p[i])
  }
  return out
}

const total = (parts: string[][], corpus: CorpusWord[]) => parts.reduce((s, p, i) => s + p.length * corpus[i].freq, 0)

export function trainBpe(corpus: CorpusWord[], merges: number): BpeState[] {
  let parts = corpus.map((c) => Array.from(c.word))
  const chars = [...new Set(parts.flat())].sort()
  const states: BpeState[] = [{ parts, pairs: countPairs(parts, corpus), rules: [], vocab: chars, totalTokens: total(parts, corpus) }]
  for (let k = 0; k < merges; k++) {
    const pairs = countPairs(parts, corpus)
    const best = pairs[0]
    if (!best || best.count < 2) break
    parts = parts.map((p) => applyMerge(p, best.a, best.b))
    const prev = states[states.length - 1]
    states.push({
      parts,
      pairs,
      merge: best,
      rules: [...prev.rules, best],
      vocab: [...prev.vocab, best.a + best.b],
      totalTokens: total(parts, corpus),
    })
  }
  return states
}

/** Tokeniza una palabra nueva aplicando las reglas aprendidas, en orden. */
export function encodeWithRules(word: string, rules: Pair[]): string[] {
  let p = Array.from(word)
  for (const r of rules) p = applyMerge(p, r.a, r.b)
  return p
}
