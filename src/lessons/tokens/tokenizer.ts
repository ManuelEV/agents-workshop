/* ==========================================================================
   Tokenizador de subpalabras DIDÁCTICO (determinista).

   Imita la forma de trabajar de los tokenizadores BPE reales (tipo GPT):
   1. Pre-tokenización con una expresión regular: palabras con su espacio
      inicial, números en grupos de hasta 3 dígitos, puntuación, espacios.
   2. Dentro de cada trozo, coincidencia voraz (greedy longest-match) contra un
      vocabulario hecho a mano de subpalabras comunes en español e inglés.
   3. Fallback a bytes UTF-8 para caracteres que no están en el vocabulario
      (emoji, símbolos raros): un emoji puede costar 4 tokens.

   Los IDs son deterministas y únicos dentro de este vocabulario, pero no
   corresponden a ningún tokenizador real.
   ========================================================================== */
import { hashString } from '../../sim/math'

/* Palabras inglesas frecuentes: casi siempre son un solo token. */
const EN_WORDS =
  'I is my order need it before Friday the a an to of and in for on with you your we our can will when where what how do does did have has was are be not this that please thanks help change address delivery package status track tracking today tomorrow week shoes jacket number arrive arrives ship shipped shipping return returns refund days card credit pay payment want long take size store free over hello there many letters letter word words in how much cost costs money back railway are there'.split(
    ' ',
  )
const EN_START = 'Where When What How Hello Hi Thanks Please My The I Can Is Do Your Order It We You This'.split(' ')

/* Palabras españolas cortas y muy frecuentes: un token (con espacio). */
const ES_WORDS =
  'de la el que en los las un una por con para mi tu su lo le es se no si ya del al más hay muy pero como antes hoy gracias sin pago día mes año todo bien hola favor cuando entrega Lo La El Mi Tu Por'.split(
    ' ',
  )
const ES_START = 'Hola Gracias Tu Mi El La Lo Qu Cu Por Si No Me Te Se Es En'.split(' ')

/* Raíces con espacio inicial (inicio de palabra) que NO son palabras completas. */
const ES_STEMS =
  ' ped neces tien vier lle entre env est cambi direc devol tarj cr dem din compr zapat chaqu cuot desp seguim fer ten pued quier mand recib resp prob cont pregunt nov mart miérc sáb'.split(
    ' ',
  )

/* Sufijos y trozos internos (sin espacio). */
const PIECES =
  'ido ito nes ón ción ciones de ado ada ados adas ento iento mente ar er ir os as es ra re ro ri la le lo li ta te to ti ca co ga go da do di na ne no ni ma me mo mi sa se so si va ve vo vi ba be bo bi pa pe po pi ll rr qu ch ue ie ia io ua al el il ol ul an en in on un ega eta ía ías ería illa ero era ores ador miento car ril iero ución án ora dito amos emos imos aron ieron ando iendo ible itas itos ones ante entes ad ud ar emb iembre ero bre'.split(
    ' ',
  )

/* Alfabeto base: si un carácter está aquí, al menos existe como token propio. */
const BASE_CHARS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).concat(Array.from('áéíóúñüÁÉÍÓÚÑÜ¿¡'))

const VOCAB_LIST: string[] = [
  ...BASE_CHARS,
  ...EN_WORDS.map((w) => ' ' + w),
  ...EN_START,
  ...ES_WORDS.map((w) => ' ' + w),
  ...ES_START,
  ...ES_STEMS.filter(Boolean).map((w) => ' ' + w),
  ...PIECES,
  ' #',
  ' $',
  ' (',
  ' "',
  ' ¿',
  '...',
  '?\n',
  ' -',
  ' —',
  ' ·',
]

export const VOCAB = new Set(VOCAB_LIST)
const MAX_LEN = Math.max(...VOCAB_LIST.map((t) => t.length))

/* IDs únicos y deterministas: 0–255 son bytes; el resto, repartido en ~100k. */
const ID = new Map<string, number>()
const used = new Set<number>()
function assign(t: string) {
  if (ID.has(t)) return
  let id = 256 + (hashString(t) % 99_744)
  while (used.has(id)) id++
  used.add(id)
  ID.set(t, id)
}
;[...VOCAB].sort().forEach(assign)
for (let n = 0; n < 1000; n++) {
  assign(String(n))
  if (n < 100) assign(String(n).padStart(2, '0'))
  if (n < 10) assign(String(n).padStart(3, '0'))
}

/** Tamaño del vocabulario simulado (para mostrar). */
export const VOCAB_SIZE = ID.size + 256

export type TokKind = 'word' | 'sub' | 'num' | 'byte' | 'char' | 'space'
export type Tok = { text: string; id: number; kind: TokKind }

export function idOf(t: string): number {
  return ID.get(t) ?? 256 + (hashString(t) % 99_744)
}

const PRE = / ?[\p{L}\p{M}]+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+|\s+/gu
const enc = new TextEncoder()

function kindOf(t: string): TokKind {
  if (/^\p{N}+$/u.test(t)) return 'num'
  if (t.trim() === '') return 'space'
  if (t.length === 1) return 'char'
  if (t.startsWith(' ') && /^ \p{L}+$/u.test(t) && (EN_WORDS.includes(t.slice(1)) || ES_WORDS.includes(t.slice(1)))) return 'word'
  return 'sub'
}

/** Corta un trozo pre-tokenizado con coincidencia voraz + fallback a bytes. */
function splitPiece(piece: string, out: Tok[]) {
  if (/^\p{N}+$/u.test(piece)) {
    out.push({ text: piece, id: idOf(piece), kind: 'num' })
    return
  }
  let i = 0
  while (i < piece.length) {
    let match = ''
    for (let L = Math.min(MAX_LEN, piece.length - i); L >= 1; L--) {
      const cand = piece.slice(i, i + L)
      if (VOCAB.has(cand)) {
        match = cand
        break
      }
    }
    if (match) {
      out.push({ text: match, id: idOf(match), kind: kindOf(match) })
      i += match.length
      continue
    }
    // carácter fuera del vocabulario → sus bytes UTF-8
    const cp = piece.codePointAt(i) ?? 0
    const ch = String.fromCodePoint(cp)
    for (const b of enc.encode(ch)) {
      out.push({ text: `<0x${b.toString(16).toUpperCase().padStart(2, '0')}>`, id: b, kind: 'byte' })
    }
    i += ch.length
  }
}

export function tokenize(text: string): Tok[] {
  const out: Tok[] = []
  for (const m of text.matchAll(PRE)) splitPiece(m[0], out)
  return out
}

/** Tokens → texto (decodificación). Los bytes sueltos se re-ensamblan. */
export function detokenize(toks: Tok[]): string {
  const bytes: number[] = []
  let s = ''
  const flush = () => {
    if (bytes.length) s += new TextDecoder().decode(new Uint8Array(bytes))
    bytes.length = 0
  }
  for (const t of toks) {
    if (t.kind === 'byte') bytes.push(t.id)
    else {
      flush()
      s += t.text
    }
  }
  flush()
  return s
}

/* ---------------------------- ejemplos ---------------------------------- */

export const PRESETS: { id: string; label: string; text: string }[] = [
  { id: 'pedido', label: 'Pedido', text: '¿Dónde está mi pedido #4821? Lo necesito antes del viernes 🙏' },
  { id: 'numeros', label: 'Números y fechas', text: 'Pedido 4821 del 04/11/2026 por $54.990 · 3,14 kg · 1000000 · 2026-11-04' },
  { id: 'letras', label: 'ferrocarril', text: '¿Cuántas r tiene ferrocarril?' },
  { id: 'raro', label: 'Emoji y símbolos', text: 'Llegó 📦✅ pero la caja venía rota 😢 → ¿garantía? 50€' },
]

export const PAIRS: { es: string; en: string }[] = [
  { es: '¿Dónde está mi pedido #4821? Lo necesito antes del viernes 🙏', en: 'Where is my order #4821? I need it before Friday 🙏' },
  { es: 'Quiero cambiar la dirección de entrega de mi pedido.', en: 'I want to change the delivery address of my order.' },
  { es: '¿Cuánto demora la devolución del dinero a mi tarjeta de crédito?', en: 'How long does the refund to my credit card take?' },
]
