/* Datos hechos a mano para la lección. Los logits son inventados pero
   coherentes: lo que el contexto vuelve obvio tiene un logit muy alto. */

export type Cand = { t: string; l: number }

export const STOP = '⏹'

export const PROMPT_USER = '¿Cuándo llega mi pedido 4821?'
export const PROMPT_TOOL = '{"estado": "en_ruta", "courier": "Chilexpress", "eta": "2026-11-04"}'

/** Un paso de generación: candidatos con su logit. El primero es el elegido. */
export type GenStep = { cands: Cand[]; note: string }

export const GEN: GenStep[] = [
  {
    cands: [
      { t: 'Tu', l: 6.1 },
      { t: '¡', l: 4.9 },
      { t: 'Hola', l: 4.6 },
      { t: 'Según', l: 3.8 },
      { t: 'El', l: 3.5 },
      { t: 'Camila', l: 3.0 },
      { t: 'Lo', l: 1.2 },
    ],
    note: 'Primer token: varias aperturas son razonables, así que la distribución está repartida.',
  },
  {
    cands: [
      { t: ' pedido', l: 7.2 },
      { t: ' compra', l: 4.6 },
      { t: ' paquete', l: 4.3 },
      { t: ' envío', l: 3.9 },
      { t: ' orden', l: 3.1 },
      { t: ' producto', l: 1.5 },
    ],
    note: 'El usuario dijo «pedido»: repetir su palabra es lo más probable.',
  },
  {
    cands: [
      { t: ' llega', l: 5.4 },
      { t: ' está', l: 5.0 },
      { t: ' debería', l: 4.2 },
      { t: ' será', l: 3.3 },
      { t: ' estará', l: 3.1 },
      { t: ' ya', l: 2.0 },
    ],
    note: '«llega» y «está» compiten: ambas continúan bien. Gana por poco la que refleja la pregunta.',
  },
  {
    cands: [
      { t: ' el', l: 6.5 },
      { t: ' este', l: 4.1 },
      { t: ' entre', l: 3.2 },
      { t: ' en', l: 2.8 },
      { t: ' mañana', l: 2.0 },
      { t: ' a', l: 1.5 },
    ],
    note: '«mañana» tiene un logit bajo: el resultado de la herramienta dice 4 de noviembre, no lunes 2.',
  },
  {
    cands: [
      { t: ' miércoles', l: 7.0 },
      { t: ' 4', l: 4.8 },
      { t: ' próximo', l: 4.0 },
      { t: ' día', l: 3.6 },
      { t: ' martes', l: 2.4 },
      { t: ' jueves', l: 2.1 },
    ],
    note: 'El modelo “sabe” que 2026-11-04 cae miércoles porque lo aprendió de patrones en sus datos. Ojo: con fechas esto puede fallar.',
  },
  {
    cands: [
      { t: ' 4', l: 7.5 },
      { t: ',', l: 4.4 },
      { t: '.', l: 2.9 },
      { t: ' de', l: 2.0 },
      { t: ' próximo', l: 1.6 },
      { t: ' 5', l: 1.4 },
    ],
    note: 'El dato «04» del contexto domina. «5» casi no tiene probabilidad.',
  },
  {
    cands: [
      { t: ' de', l: 7.8 },
      { t: '.', l: 4.5 },
      { t: '/', l: 2.2 },
      { t: ',', l: 2.0 },
      { t: ' y', l: 1.0 },
    ],
    note: 'Construcción muy frecuente en español: «4 de …».',
  },
  {
    cands: [
      { t: ' noviembre', l: 8.3 },
      { t: ' nov', l: 3.6 },
      { t: ' este', l: 2.0 },
      { t: ' diciembre', l: 1.2 },
      { t: ' octubre', l: 1.0 },
    ],
    note: 'Casi determinista: el mes viene del «-11-» del contexto.',
  },
  {
    cands: [
      { t: '.', l: 6.0 },
      { t: ',', l: 4.6 },
      { t: ' (', l: 3.5 },
      { t: ' según', l: 3.0 },
      { t: ' con', l: 2.7 },
      { t: '!', l: 2.5 },
    ],
    note: 'La oración está completa: el punto es lo más probable.',
  },
  {
    cands: [
      { t: STOP, l: 5.2 },
      { t: ' ¿', l: 4.3 },
      { t: '\n', l: 3.0 },
      { t: ' Si', l: 3.6 },
      { t: ' Puedes', l: 3.4 },
      { t: ' El', l: 2.8 },
    ],
    note: 'El token especial de fin de turno también es un candidato más. Si gana, la generación termina.',
  },
]

export const FULL_ANSWER = GEN.slice(0, -1)
  .map((g) => g.cands[0].t)
  .join('')

/* ------------------------- playground de muestreo ------------------------- */

export type Dist = { id: string; label: string; context: string; cands: Cand[] }

export const DISTS: Dist[] = [
  {
    id: 'dato',
    label: 'Dato concreto',
    context: 'Tu pedido llega el miércoles 4 de',
    cands: [
      { t: ' noviembre', l: 9.0 },
      { t: ' nov', l: 5.2 },
      { t: ' diciembre', l: 3.0 },
      { t: ' octubre', l: 2.6 },
      { t: ' este', l: 2.0 },
      { t: ' mes', l: 1.5 },
      { t: ' enero', l: 0.8 },
    ],
  },
  {
    id: 'inicio',
    label: 'Inicio de respuesta',
    context: '[user] ¿Cuándo llega mi pedido 4821?  [assistant]',
    cands: [
      { t: '¡Hola', l: 3.0 },
      { t: 'Hola', l: 2.8 },
      { t: 'Tu', l: 2.6 },
      { t: 'Claro', l: 1.9 },
      { t: 'Según', l: 1.6 },
      { t: 'Buenas', l: 1.2 },
      { t: 'Gracias', l: 1.0 },
      { t: 'Lamentablemente', l: -0.5 },
    ],
  },
  {
    id: 'abierto',
    label: 'Frase abierta',
    context: '¡Gracias por tu compra, Camila! Que disfrutes tus',
    cands: [
      { t: ' zapatillas', l: 3.4 },
      { t: ' nuevas', l: 3.1 },
      { t: ' compras', l: 2.2 },
      { t: ' productos', l: 2.0 },
      { t: ' salidas', l: 1.6 },
      { t: ' aventuras', l: 1.5 },
      { t: ' Trail', l: 1.1 },
      { t: ' calcetines', l: 0.9 },
    ],
  },
]

/* ------------------- árbol para "mismo prompt, distintas corridas" ------------------- */

export type Branch = { t: string; l: number; next: string | null }

/** Cada rama agrupa varios tokens para que se lea; la lógica es la misma. */
export const TREE: Record<string, Branch[]> = {
  root: [
    { t: 'Tu pedido', l: 3.0, next: 'A' },
    { t: 'Hola Camila,', l: 2.3, next: 'C' },
    { t: '¡Buenas noticias!', l: 2.0, next: 'B' },
    { t: 'Según el seguimiento,', l: 1.4, next: 'D' },
  ],
  A: [
    { t: ' llega', l: 3.0, next: 'A1' },
    { t: ' está en camino y', l: 2.2, next: 'A2' },
    { t: ' va con Chilexpress y', l: 1.6, next: 'A2' },
  ],
  B: [
    { t: ' Tu pedido', l: 2.5, next: 'A' },
    { t: ' Tu compra ya va en camino y', l: 2.0, next: 'A2' },
  ],
  C: [
    { t: ' tu pedido', l: 3.0, next: 'A' },
    { t: ' tu pedido 4821', l: 2.2, next: 'A' },
  ],
  D: [
    { t: ' tu pedido', l: 2.6, next: 'A' },
    { t: ' Chilexpress lo entrega', l: 1.8, next: 'A1' },
  ],
  A1: [
    { t: ' el miércoles 4 de noviembre', l: 3.2, next: 'E' },
    { t: ' este miércoles', l: 2.0, next: 'E' },
    { t: ' en 3 días', l: 0.8, next: 'E' },
  ],
  A2: [
    { t: ' llega el miércoles 4', l: 2.8, next: 'E' },
    { t: ' debería llegar el miércoles', l: 2.0, next: 'E' },
    { t: ' lo recibes el miércoles', l: 1.5, next: 'E' },
  ],
  E: [
    { t: '.', l: 3.0, next: 'F' },
    { t: ', según Chilexpress.', l: 1.5, next: 'F' },
    { t: ' 🙂', l: 1.0, next: 'F' },
  ],
  F: [
    { t: STOP, l: 3.0, next: null },
    { t: ' ¿Te ayudo con algo más?', l: 2.0, next: 'G' },
    { t: ' Puedes seguirlo con el código CX-99812-CL.', l: 1.6, next: 'G' },
  ],
  G: [{ t: STOP, l: 4.0, next: null }],
}
