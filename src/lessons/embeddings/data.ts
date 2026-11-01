import type { Tone } from '../../components/ui'
import { analyze, CONCEPTS, DIMS, embed, project } from '../../sim/embed'
import { fold, hashString, rng } from '../../sim/math'

/* Frases de clientes de Andes Market (y algunas fuera de tema) para el mapa. */
export const PHRASES: string[] = [
  // devoluciones
  'Quiero devolver las zapatillas que compré',
  '¿Cómo pido un reembolso?',
  '¿Cuánto demora la devolución del dinero?',
  'Me arrepentí de la compra, ¿puedo retornarla?',
  '¿Me reembolsan si devuelvo el producto?',
  // envíos
  '¿Cuándo llega mi pedido?',
  '¿Hacen despacho a regiones?',
  'Quiero cambiar la dirección de entrega',
  '¿Dónde veo el número de seguimiento?',
  'Mi paquete dice entregado pero no llegó',
  // pagos
  '¿Puedo pagar en cuotas sin interés?',
  'Me rechazaron la tarjeta de débito',
  'Necesito factura para mi empresa',
  'Me cobraron dos veces la misma compra',
  '¿Aceptan transferencia bancaria?',
  // cuenta
  'Olvidé mi contraseña',
  'No puedo iniciar sesión en mi cuenta',
  '¿Cómo cambio el correo de mi perfil?',
  // garantía
  'La chaqueta vino rota, con un defecto en la costura',
  'El audífono dejó de funcionar a la semana',
  '¿Cuánto dura la garantía?',
  'Necesito servicio técnico para reparar mi mochila',
  // producto
  '¿Tienen esta polera en talla M?',
  '¿Hay stock del modelo azul?',
  '¿Qué medida de zapatilla me recomiendan?',
  '¿Cuándo reponen el color negro?',
  // plazos y precio
  '¿En cuántos días hábiles llega?',
  '¿Cuántos días tarda el despacho a Arica?',
  '¿El envío es gratis o tiene costo?',
  '¿Tienen algún cupón de descuento?',
  '¿Cuánto cuesta el despacho?',
  // problemas / seguridad
  'Tengo un problema urgente con mi pedido',
  'Quiero hacer un reclamo',
  'Me llegó un correo sospechoso pidiendo mi clave',
  'Creo que hackearon mi cuenta',
  '¿Cómo activo la verificación en dos pasos?',
  // conversación
  'Hola, muchas gracias por la ayuda',
  '¡Buenas tardes!',
  // fuera de tema
  '¿Va a llover mañana? Quiero saber el clima',
  '¿Quién ganó el partido de fútbol?',
  'Dame una receta de pastel de choclo',
  'Recomiéndame una película',
  'Dime un chiste corto',
]

/** Color de cada concepto en el mapa (se repiten tonos solo entre barrios lejanos). */
export const CONCEPT_TONE: Record<string, Tone> = {
  devoluciones: 'tool',
  envios: 'data',
  pagos: 'guard',
  cuenta: 'model',
  garantia: 'error',
  producto: 'memory',
  plazos: 'ok',
  precio: 'accent',
  problema: 'system',
  saludo: 'system',
  otro: 'system',
  seguridad: 'accent',
}

/** Abreviaturas para cabeceras de columnas (16 dims). */
export const DIM_SHORT = ['Dev', 'Env', 'Pag', 'Cta', 'Gar', 'Prod', 'Plz', 'Prec', 'Prob', 'Conv', 'Fuera', 'Seg', 'm1', 'm2', 'm3', 'm4']

export type Phrase = { id: string; text: string; vector: number[]; xy: [number, number]; concept: number }

/** Índice del concepto dominante (o -1 si ninguna palabra activó un concepto). */
export function dominant(text: string): number {
  const { scores } = analyze(text)
  let best = -1
  let bestS = 0
  scores.forEach((s, i) => {
    if (s > bestS) {
      bestS = s
      best = i
    }
  })
  return best
}

export const CORPUS: Phrase[] = PHRASES.map((text, i) => ({
  id: `f${i}`,
  text,
  vector: embed(text),
  xy: project(text),
  concept: dominant(text),
}))

export const toneOf = (concept: number): Tone => (concept < 0 ? 'system' : CONCEPT_TONE[CONCEPTS[concept].id])
export const conceptLabel = (concept: number) => (concept < 0 ? 'sin concepto' : CONCEPTS[concept].label)

/**
 * Vector "crudo" antes de normalizar. Replica exactamente lo que hace `embed()`
 * (mismo generador determinista) pero sin el paso final de normalización,
 * para poder mostrar ese paso en la animación.
 */
export function rawEmbed(text: string): number[] {
  const { scores } = analyze(text)
  const r = rng(hashString(fold(text)))
  const v: number[] = []
  for (let i = 0; i < CONCEPTS.length; i++) {
    const s = scores[i] > 0 ? 0.55 + 0.45 * Math.min(scores[i], 3) : 0
    v.push(s - 0.1 + (r() - 0.5) * 0.12)
  }
  for (let i = CONCEPTS.length; i < DIMS; i++) v.push((r() - 0.5) * 0.5)
  return v
}

/** Tokenizador simplificado (tipo BPE): palabras, puntuación y subpalabras en palabras largas. */
export function toyTokens(text: string): { text: string; id: number }[] {
  const parts = text.match(/\s*[\p{L}\p{N}]+|\s*[^\s\p{L}\p{N}]/gu) ?? []
  const out: { text: string; id: number }[] = []
  for (const p of parts) {
    const core = p.trim()
    if (core.length > 7) {
      const cut = p.length - core.length + Math.ceil(core.length * 0.55)
      out.push({ text: p.slice(0, cut), id: hashString(p.slice(0, cut)) % 100000 })
      out.push({ text: p.slice(cut), id: hashString(p.slice(cut)) % 100000 })
    } else out.push({ text: p, id: hashString(p) % 100000 })
  }
  return out
}

/** Otro modelo de embeddings (simulado): mismas ideas, pero en otras coordenadas. */
const PERM = (() => {
  const r = rng(99)
  const idx = Array.from({ length: DIMS }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  const sign = idx.map(() => (r() < 0.5 ? -1 : 1))
  return { idx, sign }
})()
export function embedOtherModel(text: string): number[] {
  const v = embed(text)
  return PERM.idx.map((j, i) => v[j] * PERM.sign[i])
}
