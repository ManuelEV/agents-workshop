/* ==========================================================================
   Modelo de embeddings SIMULADO (didáctico).

   Un modelo real (p. ej. text-embedding-3-large, Titan, Gemini embedding, Cohere)
   produce vectores de 768–3072 dimensiones aprendidas que nadie puede "leer".
   Aquí usamos 16 dimensiones: las 12 primeras son interpretables (cada una mide
   cuánto habla el texto de un concepto) y las 4 últimas son "matices" (ruido
   determinista que imita las dimensiones no interpretables).

   Lo importante es que respeta las propiedades que importan para entender RAG:
   - textos parecidos en significado → vectores parecidos (coseno alto)
   - funciona con palabras distintas que apuntan al mismo concepto
     ("reembolso" y "devolver" caen juntos)
   - la posición 2D es una PROYECCIÓN (como UMAP/PCA): pierde información.
   ========================================================================== */
import { clamp, cosine, fold, hashString, normalize, rng } from './math'

export type Concept = {
  id: string
  label: string
  /** prefijos (sin tildes) que activan el concepto */
  stems: string[]
  /** posición del "barrio" del concepto en el mapa 2D (0..100) */
  anchor: [number, number]
}

export const CONCEPTS: Concept[] = [
  { id: 'devoluciones', label: 'Devoluciones', anchor: [20, 26], stems: ['devol', 'devuel', 'reembols', 'retorn', 'arrepent', 'reintegr', 'reversa', 'cambio de producto', 'cambiar el producto', 'cambiar un producto'] },
  { id: 'envios', label: 'Envíos', anchor: [70, 20], stems: ['envio', 'envia', 'despach', 'entreg', 'llega', 'llego', 'courier', 'seguimiento', 'tracking', 'direccion', 'domicilio', 'retiro', 'region', 'pedido', 'orden', 'paquete', 'chilexpress', 'starken'] },
  { id: 'pagos', label: 'Pagos', anchor: [66, 76], stems: ['pag', 'tarjeta', 'cuota', 'cobr', 'factura', 'boleta', 'transferencia', 'debito', 'credito', 'webpay', 'cargo', 'abono'] },
  { id: 'cuenta', label: 'Cuenta', anchor: [30, 86], stems: ['cuenta', 'contrasena', 'clave', 'sesion', 'correo', 'email', 'registr', 'perfil', 'login', 'usuario', 'acceso', 'ingresar'] },
  { id: 'garantia', label: 'Garantía', anchor: [12, 50], stems: ['garantia', 'falla', 'defect', 'roto', 'rota', 'danad', 'repar', 'tecnico', 'funciona', 'desperfecto'] },
  { id: 'producto', label: 'Producto', anchor: [36, 52], stems: ['talla', 'color', 'stock', 'disponib', 'modelo', 'zapatilla', 'polera', 'chaqueta', 'producto', 'articulo', 'tamano', 'medida', 'mochila'] },
  { id: 'plazos', label: 'Plazos', anchor: [86, 36], stems: ['dia', 'plazo', 'hora', 'cuando', 'habil', 'demora', 'tarda', 'semana', 'rapido', 'pronto', 'fecha'] },
  { id: 'precio', label: 'Precio', anchor: [86, 64], stems: ['precio', 'costo', 'gratis', 'gratuito', 'descuento', 'cupon', 'valor', 'dinero', 'cuesta', 'oferta', '$', 'monto', 'clp'] },
  { id: 'problema', label: 'Problemas', anchor: [52, 40], stems: ['problema', 'error', 'reclamo', 'mal', 'no puedo', 'no llega', 'no me', 'molest', 'urgente', 'ayuda', 'equivoc'] },
  { id: 'saludo', label: 'Conversación', anchor: [94, 88], stems: ['hola', 'gracias', 'buenos', 'buenas', 'saludo', 'adios', 'chao'] },
  { id: 'otro', label: 'Fuera de tema', anchor: [92, 6], stems: ['clima', 'lluvia', 'futbol', 'partido', 'receta', 'pelicula', 'musica', 'sol ', 'temperatura', 'chiste'] },
  { id: 'seguridad', label: 'Seguridad', anchor: [10, 76], stems: ['fraude', 'segur', 'hacke', 'robo', 'sospech', 'verificac', '2fa', 'codigo', 'phishing', 'bloque'] },
]

export const DIMS = 16
export const DIM_LABELS = [...CONCEPTS.map((c) => c.label), 'matiz 1', 'matiz 2', 'matiz 3', 'matiz 4']

export type Analysis = {
  /** puntaje bruto por concepto (cantidad de coincidencias) */
  scores: number[]
  /** términos que activaron cada concepto */
  hits: string[][]
}

export function analyze(text: string): Analysis {
  const t = ' ' + fold(text).replace(/[¿?¡!.,;:()"]/g, ' ') + ' '
  const words = t.split(/\s+/).filter(Boolean)
  const scores = CONCEPTS.map(() => 0)
  const hits: string[][] = CONCEPTS.map(() => [])
  CONCEPTS.forEach((c, ci) => {
    for (const stem of c.stems) {
      if (stem.includes(' ') || stem === '$') {
        if (t.includes(stem)) {
          scores[ci] += 1
          hits[ci].push(stem.trim())
        }
      } else {
        const w = words.find((w) => w.startsWith(stem))
        if (w) {
          scores[ci] += 1
          if (!hits[ci].includes(w)) hits[ci].push(w)
        }
      }
    }
  })
  return { scores, hits }
}

/** Vector unitario de 16 dimensiones. */
export function embed(text: string): number[] {
  const { scores } = analyze(text)
  const r = rng(hashString(fold(text)))
  const v: number[] = []
  for (let i = 0; i < CONCEPTS.length; i++) {
    const s = scores[i] > 0 ? 0.55 + 0.45 * Math.min(scores[i], 3) : 0
    v.push(s - 0.1 + (r() - 0.5) * 0.12)
  }
  for (let i = CONCEPTS.length; i < DIMS; i++) v.push((r() - 0.5) * 0.5)
  return normalize(v)
}

/** Proyección 2D (0..100) "tipo UMAP": centro ponderado de los barrios de concepto. */
export function project(text: string): [number, number] {
  const { scores } = analyze(text)
  const r = rng(hashString('xy:' + fold(text)))
  let sx = 0
  let sy = 0
  let sw = 0
  scores.forEach((s, i) => {
    if (s <= 0) return
    const w = s * s
    sx += CONCEPTS[i].anchor[0] * w
    sy += CONCEPTS[i].anchor[1] * w
    sw += w
  })
  if (sw === 0) return [clamp(50 + (r() - 0.5) * 22, 4, 96), clamp(56 + (r() - 0.5) * 18, 4, 96)]
  const jitter = 7.5
  return [clamp(sx / sw + (r() - 0.5) * jitter, 3, 97), clamp(sy / sw + (r() - 0.5) * jitter, 3, 97)]
}

export type Embedded<T = object> = T & { text: string; vector: number[]; xy: [number, number] }

export function embedAll<T extends { text: string }>(items: T[]): Embedded<T>[] {
  return items.map((it) => ({ ...it, vector: embed(it.text), xy: project(it.text) }))
}

export type Hit<T> = { item: Embedded<T>; score: number }

/** Búsqueda exacta (fuerza bruta) por similitud coseno. */
export function searchTopK<T extends { text: string }>(query: string | number[], items: Embedded<T>[], k = 3): Hit<T>[] {
  const q = typeof query === 'string' ? embed(query) : query
  return items
    .map((item) => ({ item, score: cosine(q, item.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}

/** Color (CSS) para una celda de vector: azul negativo → neutro → naranja positivo. */
export function cellColor(x: number, max = 0.6): string {
  const t = clamp(Math.abs(x) / max, 0, 1)
  const pole = x >= 0 ? 'var(--v-pos)' : 'var(--v-neg)'
  return `color-mix(in srgb, ${pole} ${Math.round(t * 100)}%, var(--v-mid))`
}

/** Cadena tipo "[0.12, -0.03, …]" para mostrar un vector. */
export function vecToString(v: number[], n = 6, d = 3): string {
  const head = v.slice(0, n).map((x) => x.toFixed(d))
  return `[${head.join(', ')}${v.length > n ? ', …' : ''}]`
}
