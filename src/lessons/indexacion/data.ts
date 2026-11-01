import type { Tone } from '../../components/ui'
import { chunkByWords, type KbDoc } from '../../sim/corpus'

/** Tonos para colorear chunks consecutivos (se distinguen bien entre vecinos). */
export const CHUNK_TONES: Tone[] = ['user', 'tool', 'data', 'memory', 'model', 'guard']
export const chunkTone = (i: number) => CHUNK_TONES[i % CHUNK_TONES.length]
export const chunkBg = (i: number, pct = 20) => `color-mix(in srgb, var(--c-${chunkTone(i)}) ${pct}%, transparent)`

/** Líneas del documento "crudo" tal como sale del CMS, marcando cuáles son ruido. */
export type RawLine = { text: string; noise: boolean; why?: string }

export function rawLines(d: KbDoc): RawLine[] {
  const crumbs = d.source.split('/')[0] === 'politicas' ? 'Políticas' : d.source.startsWith('catalogo') ? 'Catálogo' : 'Ayuda'
  const lines: RawLine[] = [
    { text: '---', noise: true, why: 'front matter → metadata' },
    { text: `title: ${d.title}`, noise: true, why: 'front matter → metadata' },
    { text: `updated: ${d.updated}`, noise: true, why: 'front matter → metadata' },
    { text: '---', noise: true, why: 'front matter → metadata' },
    { text: `[Inicio](/) › [${crumbs}](/${crumbs.toLowerCase()}) › ${d.title}`, noise: true, why: 'navegación' },
    { text: `# ${d.title}`, noise: false },
  ]
  d.paragraphs.forEach((p, i) => {
    lines.push({ text: '', noise: false })
    lines.push({ text: i === 1 ? p.replace(/  +/g, ' ').replace('. ', '.   ') : p, noise: false })
  })
  lines.push({ text: '', noise: false })
  lines.push({ text: '<!-- banner: CyberDay 30% dcto -->', noise: true, why: 'HTML/comentarios' })
  lines.push({ text: '¿Te sirvió este artículo? 👍 👎', noise: true, why: 'widget' })
  lines.push({ text: `© 2026 Andes Market SpA · Todos los derechos reservados`, noise: true, why: 'pie de página' })
  return lines
}

export const rawText = (d: KbDoc) => rawLines(d).map((l) => l.text).join('\n')

/* -------------------------------------------------------------------------- */
/* Chunking sobre un arreglo de palabras (para poder pintarlo)                 */
/* -------------------------------------------------------------------------- */

export type Strategy = 'fijo' | 'parrafo' | 'oracion'
export type Range = { start: number; end: number; text: string }

export type Chunked = {
  words: string[]
  /** índice de palabra donde empieza cada párrafo */
  paraStarts: number[]
  chunks: Range[]
}

export function chunkDoc(paragraphs: string[], strategy: Strategy, size: number, overlap: number): Chunked {
  const words: string[] = []
  const paraStarts: number[] = []
  paragraphs.forEach((p) => {
    paraStarts.push(words.length)
    words.push(...p.split(/\s+/).filter(Boolean))
  })
  const mk = (start: number, end: number): Range => ({ start, end, text: words.slice(start, end).join(' ') })

  if (strategy === 'fijo') {
    // mismas palabras que chunkByWords sobre el texto completo
    const { chunks } = chunkByWords(paragraphs.join('\n\n'), size, overlap)
    return { words, paraStarts, chunks }
  }
  if (strategy === 'parrafo') {
    const chunks = paraStarts.map((s, i) => mk(s, paraStarts[i + 1] ?? words.length))
    return { words, paraStarts, chunks }
  }
  // por oración: agrupa oraciones completas hasta `size` palabras
  const sentences: [number, number][] = []
  let s0 = 0
  words.forEach((w, i) => {
    const endsPara = paraStarts.includes(i + 1)
    if (/[.!?]$/.test(w) || endsPara || i === words.length - 1) {
      sentences.push([s0, i + 1])
      s0 = i + 1
    }
  })
  const chunks: Range[] = []
  let cur: [number, number] | null = null
  for (const [a, b] of sentences) {
    if (!cur) cur = [a, b]
    else if (b - cur[0] <= size) cur[1] = b
    else {
      chunks.push(mk(cur[0], cur[1]))
      cur = [a, b]
    }
  }
  if (cur) chunks.push(mk(cur[0], cur[1]))
  return { words, paraStarts, chunks }
}

/** Precio de referencia de embeddings (US$ por millón de tokens, modelos comerciales pequeños–grandes). */
export const EMBED_PRICE_LOW = 0.02
export const EMBED_PRICE_HIGH = 0.13
