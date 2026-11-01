/* Datos simulados de la lección de memoria (cliente: Camila Rojas). */
import type { Msg } from '../../components/Messages'
import { ORDERS } from '../../sim/scenario'

/* ------------------------------------------------ dos sesiones con Andi */

export const BASE_SYSTEM = `Eres Andi, asistente de soporte de Andes Market.
Responde en español, breve y cordial. Usa herramientas para datos reales.`

export const SESSION1: Msg[] = [
  { role: 'system', content: BASE_SYSTEM },
  { role: 'user', content: 'Hola, las Trail Andes talla 39 que compré me quedaron chicas. ¿Puedo cambiarlas por una 40?' },
  { role: 'assistant', content: '¡Hola, Camila! Sí, tienes 30 días para cambios. Te dejo el cambio a talla 40. ¿Prefieres despacho a domicilio o retiro en tienda?' },
  { role: 'user', content: 'Retiro en tienda, siempre me acomoda más. Vivo en Providencia y la tienda de Costanera me queda cerca.' },
  { role: 'assistant', content: 'Listo: cambio CAM-2291 a talla 40 con retiro en Costanera Center. Te avisamos por correo cuando esté disponible (24 h).' },
  { role: 'user', content: 'Gracias. Las uso para correr trail los fines de semana, ojalá estas agarren bien en el cerro.' },
  { role: 'assistant', content: '¡Seguro que sí! Cualquier cosa, aquí estoy.' },
]

export const EXTRACT_PROMPT = `Lee la conversación y extrae hechos DURADEROS sobre el cliente
que sirvan en futuras conversaciones.
- No guardes datos transitorios (n.º de pedido, estado de un cambio).
- No guardes datos de pago, claves ni documentos de identidad.
- Devuelve SOLO un arreglo JSON: [{"tipo", "clave", "texto", "confianza"}]
  tipo ∈ perfil | preferencia | contexto`

export type MemRecord = { id: string; tipo: 'perfil' | 'preferencia' | 'contexto'; clave: string; texto: string; confianza: number }

export const EXTRACTED: MemRecord[] = [
  { id: 'm1', tipo: 'preferencia', clave: 'talla_zapatillas', texto: 'Usa talla 40 en zapatillas (la 39 le quedó chica)', confianza: 0.95 },
  { id: 'm2', tipo: 'preferencia', clave: 'entrega', texto: 'Prefiere retiro en tienda en vez de despacho a domicilio', confianza: 0.9 },
  { id: 'm3', tipo: 'perfil', clave: 'comuna', texto: 'Vive en Providencia (Santiago)', confianza: 0.85 },
  { id: 'm4', tipo: 'contexto', clave: 'actividad', texto: 'Corre trail los fines de semana; busca modelos con buen agarre', confianza: 0.7 },
]

export const S2_QUERY = '¿Me recomiendas unas zapatillas para trail?'

/* ------------------------------------------------ conversación larga (compactación) */

export type LongMsg = Msg & {
  /** hechos que un buen resumen debe conservar de este mensaje */
  facts?: string[]
}

const o4821 = ORDERS['4821']

export const LONG_CONVO: LongMsg[] = [
  { role: 'user', content: 'Hola, ¿dónde viene mi pedido 4821?' },
  { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_01', name: 'buscar_pedido', input: { pedido_id: '4821' } }] },
  {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: o4821 }],
    facts: ['Pedido 4821 (Zapatillas Trail Andes 40) en ruta con Chilexpress, seguimiento CX-99812-CL, llega el 04-11'],
  },
  { role: 'assistant', content: 'Tu pedido 4821 va en ruta con Chilexpress (seguimiento CX-99812-CL) y llega el 4 de noviembre.' },
  { role: 'user', content: 'Perfecto. ¿Y el 5102 se puede mandar a otra dirección? Me cambié a Ñuñoa, a Irarrázaval 2550.', facts: ['Camila se cambió a Ñuñoa (Irarrázaval 2550)'] },
  { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_02', name: 'cambiar_direccion', input: { pedido_id: '5102', nueva_direccion: 'Irarrázaval 2550, Ñuñoa' } }] },
  {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 'toolu_02', content: { ok: true, pedido_id: '5102', direccion: 'Irarrázaval 2550, Ñuñoa' } }],
    facts: ['Pedido 5102 (chaqueta) redirigido a Irarrázaval 2550, Ñuñoa'],
  },
  { role: 'assistant', content: 'Listo, el pedido 5102 se despachará a Irarrázaval 2550, Ñuñoa.' },
  { role: 'user', content: 'Otra cosa: en mi tarjeta aparecen dos cargos por el mismo pedido.' },
  { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_03', name: 'consultar_politicas', input: { pregunta: 'cargo duplicado en la tarjeta' } }] },
  {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'toolu_03',
        content: [
          { fuente: 'ayuda/pagos.md', score: 0.83, texto: 'Si tu pago fue rechazado, revisa el cupo de tu tarjeta o intenta con otro medio. Ningún cargo rechazado se cobra; si ves un cargo pendiente se reversa en 72 horas.' },
          { fuente: 'ayuda/pagos.md', score: 0.71, texto: 'Aceptamos tarjetas de crédito y débito vía Webpay, transferencia bancaria y saldo de gift card.' },
        ],
      },
    ],
  },
  { role: 'assistant', content: 'Si uno de los cargos está pendiente, se reversa solo en 72 horas. Si ambos están confirmados, abro un ticket.' },
  { role: 'user', content: 'Están los dos confirmados. Prefiero que me respondan por correo, no por teléfono.', facts: ['Prefiere contacto por correo, no por teléfono'] },
  { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_04', name: 'crear_ticket', input: { resumen: 'Cobro duplicado confirmado, pedido 4821', prioridad: 'alta' } }] },
  {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 'toolu_04', content: { ticket: 'TK-20931', prioridad: 'alta', sla: '4 horas hábiles' } }],
    facts: ['Ticket TK-20931 (alta) por cobro duplicado; SLA 4 h hábiles'],
  },
  { role: 'assistant', content: 'Creé el ticket TK-20931 con prioridad alta; te escribirán por correo en máximo 4 horas hábiles.' },
  { role: 'user', content: 'Gracias. Última pregunta: ¿la chaqueta del 5102 tiene garantía?' },
]

/** Hechos clave para verificar qué sobrevive a cada estrategia. `needle` se busca en el contexto resultante. */
export const KEY_FACTS = [
  { label: 'Seguimiento CX-99812-CL', needle: 'CX-99812-CL' },
  { label: 'Nueva dirección Irarrázaval 2550', needle: 'Irarrázaval 2550' },
  { label: 'Ticket TK-20931', needle: 'TK-20931' },
  { label: 'Prefiere contacto por correo', needle: 'correo' },
  { label: 'La pregunta actual (garantía 5102)', needle: 'garantía' },
]

/* ------------------------------------------------ higiene de memoria */

export type StoreRec = {
  id: string
  tipo: 'perfil' | 'preferencia' | 'contexto'
  clave: string
  texto: string
  /** días desde que se creó o actualizó */
  edad: number
  /** días de vida; null = sin vencimiento */
  ttl: number | null
  previo?: string
  estado: 'activo' | 'nuevo' | 'actualizado' | 'borrado' | 'expirado'
}

export const STORE0: StoreRec[] = [
  { id: 'm1', tipo: 'preferencia', clave: 'talla_zapatillas', texto: 'Usa talla 40 en zapatillas', edad: 6, ttl: null, estado: 'activo' },
  { id: 'm2', tipo: 'perfil', clave: 'direccion', texto: 'Dirección de despacho: Av. Providencia 1234, Providencia', edad: 6, ttl: null, estado: 'activo' },
  { id: 'm3', tipo: 'preferencia', clave: 'entrega', texto: 'Prefiere retiro en tienda (Costanera Center)', edad: 6, ttl: null, estado: 'activo' },
  { id: 'm4', tipo: 'contexto', clave: 'evento', texto: 'Entrena para una carrera de trail en diciembre', edad: 6, ttl: 45, estado: 'activo' },
  { id: 'm5', tipo: 'contexto', clave: 'reclamo', texto: 'Tiene un reclamo abierto por cobro duplicado (TK-20931)', edad: 2, ttl: 14, estado: 'activo' },
]

export type Op = 'ADD' | 'UPDATE' | 'DELETE' | 'NOOP'

export type FactPreset = {
  label: string
  /** lo que dijo Camila */
  dicho: string
  /** hecho candidato que extrae el LLM (null si no hay nada que guardar) */
  hecho: { tipo: StoreRec['tipo']; clave: string; texto: string } | null
  op: Op
  target?: string
  motivo: string
  guard?: boolean
  ttl?: number | null
}

export const FACT_PRESETS: FactPreset[] = [
  {
    label: 'Se cambió de casa',
    dicho: 'Me cambié a Ñuñoa; mi nueva dirección de despacho es Irarrázaval 2550.',
    hecho: { tipo: 'perfil', clave: 'direccion', texto: 'Dirección de despacho: Irarrázaval 2550, Ñuñoa' },
    op: 'UPDATE',
    target: 'm2',
    motivo: 'Misma clave (direccion) con valor nuevo: reemplaza y archiva la versión anterior.',
  },
  {
    label: 'Repite su talla',
    dicho: 'Ah, y uso talla 40 en zapatillas.',
    hecho: { tipo: 'preferencia', clave: 'talla_zapatillas', texto: 'Usa talla 40 en zapatillas' },
    op: 'NOOP',
    target: 'm1',
    motivo: 'Ya existe un recuerdo equivalente: no se duplica.',
  },
  {
    label: 'Cambia preferencia de entrega',
    dicho: 'Ya no quiero retiro en tienda, mejor despacho a domicilio.',
    hecho: { tipo: 'preferencia', clave: 'entrega', texto: 'Prefiere despacho a domicilio (antes: retiro en tienda)' },
    op: 'UPDATE',
    target: 'm3',
    motivo: 'Contradice a m3: la preferencia más reciente gana.',
  },
  {
    label: 'Dato nuevo',
    dicho: 'Soy vegana, no me ofrezcan productos de cuero.',
    hecho: { tipo: 'preferencia', clave: 'materiales', texto: 'Evita productos de cuero (vegana)' },
    op: 'ADD',
    motivo: 'No hay ningún recuerdo parecido: se agrega.',
  },
  {
    label: 'Pide olvidar',
    dicho: 'Por favor, borra mi dirección de tus registros.',
    hecho: null,
    op: 'DELETE',
    target: 'm2',
    motivo: 'Solicitud explícita de olvido: se elimina (y no solo se oculta).',
  },
  {
    label: 'Dato sensible',
    dicho: 'Guárdate mi tarjeta: 4111 1111 1111 1111, vence 08/29.',
    hecho: null,
    op: 'NOOP',
    motivo: 'Dato de pago (PCI): la política de extracción prohíbe guardarlo. Se descarta antes de llegar al store.',
    guard: true,
  },
]
