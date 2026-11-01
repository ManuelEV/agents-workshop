/* ==========================================================================
   Base de conocimiento simulada de "Andes Market" (retail online ficticio).
   Es la fuente que usan las lecciones de RAG: documentos → chunks → vectores.
   ========================================================================== */
import { embedAll, type Embedded } from './embed'

export type KbDoc = {
  id: string
  title: string
  source: string
  updated: string
  paragraphs: string[]
}

export const KB_DOCS: KbDoc[] = [
  {
    id: 'devoluciones',
    title: 'Política de devoluciones',
    source: 'politicas/devoluciones.md',
    updated: '2026-09-14',
    paragraphs: [
      'Puedes devolver cualquier producto dentro de 30 días corridos desde la entrega, siempre que esté sin uso y con sus etiquetas. El derecho a retracto aplica a todas las compras online.',
      'Para iniciar una devolución entra a Mis pedidos, elige el producto y presiona Solicitar devolución. Te enviaremos una etiqueta de despacho gratuita al correo.',
      'El reembolso se realiza al mismo medio de pago. Con tarjeta de crédito o débito demora entre 5 y 10 días hábiles desde que recibimos el producto en bodega.',
      'Los productos de ropa interior, trajes de baño y artículos personalizados no tienen devolución por razones de higiene, salvo que presenten una falla de fábrica.',
    ],
  },
  {
    id: 'envios',
    title: 'Envíos y despachos',
    source: 'ayuda/envios.md',
    updated: '2026-10-02',
    paragraphs: [
      'Despachamos a todo Chile con Chilexpress y Starken. En Santiago la entrega demora 1 a 2 días hábiles y en regiones entre 3 y 6 días hábiles.',
      'El envío es gratis en compras sobre $39.990. Para montos menores el costo de despacho se calcula según la comuna y el peso del paquete.',
      'Puedes seguir tu pedido con el número de seguimiento que llega por correo cuando el paquete sale de bodega. El estado se actualiza cada 4 horas.',
      'La dirección de entrega solo se puede cambiar mientras el pedido está en preparación. Si ya fue despachado, debes coordinar el cambio directamente con el courier.',
      'También puedes elegir retiro gratis en tienda: el pedido queda disponible en 24 horas y lo guardamos por 10 días.',
    ],
  },
  {
    id: 'pagos',
    title: 'Medios de pago',
    source: 'ayuda/pagos.md',
    updated: '2026-08-20',
    paragraphs: [
      'Aceptamos tarjetas de crédito y débito vía Webpay, transferencia bancaria y saldo de gift card. Con tarjeta de crédito puedes pagar hasta en 6 cuotas sin interés.',
      'Si tu pago fue rechazado, revisa el cupo de tu tarjeta o intenta con otro medio. Ningún cargo rechazado se cobra; si ves un cargo pendiente se libera en 72 horas.',
      'La boleta electrónica llega a tu correo apenas se confirma el pago. Si necesitas factura, debes indicar el RUT de la empresa antes de pagar.',
    ],
  },
  {
    id: 'garantia',
    title: 'Garantía y fallas',
    source: 'politicas/garantia.md',
    updated: '2026-07-11',
    paragraphs: [
      'Todos los productos tienen 6 meses de garantía legal por fallas de fabricación. Si tu producto llegó roto o dañado, repórtalo dentro de 48 horas con fotos.',
      'Con la garantía puedes elegir entre reparación, cambio por un producto igual o la devolución del dinero. El servicio técnico revisa el producto en un máximo de 10 días hábiles.',
      'La garantía no cubre daños por mal uso, caídas o desgaste normal. Las zapatillas tienen garantía de 3 meses sobre la suela y costuras.',
    ],
  },
  {
    id: 'cuenta',
    title: 'Cuenta y seguridad',
    source: 'ayuda/cuenta.md',
    updated: '2026-09-30',
    paragraphs: [
      'Si olvidaste tu contraseña, usa la opción Recuperar clave en la página de inicio de sesión. Te enviaremos un enlace al correo registrado que vence en 30 minutos.',
      'Nunca te pediremos tu clave ni el código de verificación por teléfono o WhatsApp. Si recibes un mensaje sospechoso, repórtalo como phishing.',
      'Puedes activar la verificación en dos pasos (2FA) desde tu perfil. Tras 5 intentos fallidos de ingreso la cuenta se bloquea por 15 minutos.',
    ],
  },
  {
    id: 'productos',
    title: 'Guía de tallas y productos',
    source: 'catalogo/guia-tallas.md',
    updated: '2026-06-05',
    paragraphs: [
      'Nuestras zapatillas usan talla chilena. Si estás entre dos tallas, te recomendamos elegir la más grande. La guía de medidas está en cada ficha de producto.',
      'El stock que ves en la ficha es en tiempo real. Si un color o talla aparece como no disponible, puedes activar un aviso de reposición por correo.',
    ],
  },
]

export type KbChunk = {
  id: string
  docId: string
  docTitle: string
  source: string
  updated: string
  /** posición del chunk en el documento (0-based) */
  index: number
  text: string
}

/** Un chunk por párrafo (estrategia "por estructura"). */
export const KB_CHUNKS: KbChunk[] = KB_DOCS.flatMap((d) =>
  d.paragraphs.map((text, index) => ({
    id: `${d.id}#${index + 1}`,
    docId: d.id,
    docTitle: d.title,
    source: d.source,
    updated: d.updated,
    index,
    text,
  })),
)

/** Chunks ya "indexados": con vector de 16 dims y posición 2D. */
export const KB_INDEX: Embedded<KbChunk>[] = embedAll(KB_CHUNKS)

/** Texto completo de un documento (para lecciones de chunking). */
export const docText = (d: KbDoc) => d.paragraphs.join('\n\n')

/** Consultas de ejemplo que funcionan bien con el simulador. */
export const SAMPLE_QUERIES = [
  '¿Cuánto demora el reembolso si pagué con tarjeta?',
  '¿Puedo cambiar la dirección de mi pedido?',
  'Me llegó la zapatilla rota, ¿qué hago?',
  '¿El envío es gratis?',
  'Olvidé mi contraseña',
  '¿Va a llover mañana en Santiago?',
]

/**
 * Chunking por tamaño fijo (en palabras) con solapamiento.
 * Devuelve rangos [inicio, fin) sobre el arreglo de palabras para poder pintarlos.
 */
export function chunkByWords(text: string, size: number, overlap: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const step = Math.max(1, size - overlap)
  const chunks: { start: number; end: number; text: string }[] = []
  for (let start = 0; start < words.length; start += step) {
    const end = Math.min(words.length, start + size)
    chunks.push({ start, end, text: words.slice(start, end).join(' ') })
    if (end === words.length) break
  }
  return { words, chunks }
}
