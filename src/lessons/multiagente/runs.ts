/* ==========================================================================
   Corridas simuladas de cada patrón multi-agente sobre la MISMA solicitud.
   Cada corrida es una lista de "beats" (pasos del reproductor). Dentro de un
   beat, cada "lane" corre en paralelo y sus llamadas van en secuencia.
   Tokens y latencias son estimaciones didácticas, coherentes entre patrones.
   ========================================================================== */
import { ArrowRightLeft, Bot, ClipboardList, FileText, GitFork, Network, Package, PenLine, Route, ShieldCheck, User, Wallet, Wrench } from 'lucide-react'
import type { FlowEdge, FlowNode } from '../../components/Flow'
import type { Tone } from '../../components/ui'
import { PRICING } from '../../sim/scenario'

export const REQUEST = 'Mi mochila del pedido 4790 llegó con el cierre roto. Quiero devolverla y que me reembolsen a la tarjeta.'

export type PatternId = 'unico' | 'router' | 'supervisor' | 'handoff' | 'paralelo' | 'secuencial'

export type Call = { agent: string; kind: 'llm' | 'tool'; label: string; inTok?: number; outTok?: number; ms?: number }
export type Packet = { from: string; to: string; body: string }
export type Beat = { title: string; caption: string; flows: string[]; active?: string[]; packets: Packet[]; lanes: Call[][] }

export type Pattern = {
  id: PatternId
  label: string
  blurb: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  beats: Beat[]
  control: string
  resuelve: 'sí' | 'parcial'
  /** cuándo usarlo, en una línea */
  cuando: string
}

/** Latencia de una llamada al LLM (ms): overhead + prefill + generación (~40 tok/s). */
export const llmMs = (inTok: number, outTok: number) => Math.round(320 + inTok * 0.06 + outTok * 25)

const llm = (agent: string, label: string, inTok: number, outTok: number): Call => ({ agent, kind: 'llm', label, inTok, outTok, ms: llmMs(inTok, outTok) })
const tool = (agent: string, label: string, ms: number): Call => ({ agent, kind: 'tool', label, ms })

/* ---------------------------------------------------------------- agentes */

export const AGENT_INFO: Record<string, { label: string; tone: Tone }> = {
  user: { label: 'Camila', tone: 'user' },
  andi: { label: 'Andi', tone: 'model' },
  tools: { label: 'Herramientas', tone: 'tool' },
  router: { label: 'Router', tone: 'model' },
  sup: { label: 'Supervisor', tone: 'model' },
  triage: { label: 'Triage', tone: 'model' },
  orq: { label: 'Planificador', tone: 'model' },
  ped: { label: 'Ag. pedidos', tone: 'tool' },
  pol: { label: 'Ag. políticas', tone: 'data' },
  pag: { label: 'Ag. pagos', tone: 'guard' },
  red: { label: 'Ag. redactor', tone: 'accent' },
}

const N = {
  user: (x: number, y: number): FlowNode => ({ id: 'user', x, y, label: 'Camila', sub: 'usuario', tone: 'user', icon: User, w: 130 }),
  ped: (x: number, y: number): FlowNode => ({ id: 'ped', x, y, label: 'Ag. pedidos', sub: 'buscar_pedido', tone: 'tool', icon: Package, w: 160 }),
  pol: (x: number, y: number): FlowNode => ({ id: 'pol', x, y, label: 'Ag. políticas', sub: 'RAG · consultar_politicas', tone: 'data', icon: FileText, w: 190 }),
  pag: (x: number, y: number): FlowNode => ({ id: 'pag', x, y, label: 'Ag. pagos', sub: 'reembolsos', tone: 'guard', icon: Wallet, w: 150 }),
  red: (x: number, y: number): FlowNode => ({ id: 'red', x, y, label: 'Ag. redactor', sub: 'tono de marca', tone: 'accent', icon: PenLine, w: 160 }),
}

const ANSWER =
  'Lamento lo del cierre, Camila. Es una falla de fábrica, así que aplica la garantía: te reembolsamos $27.990 a tu tarjeta terminada en 4417, en 5 a 10 días hábiles desde que recibamos la mochila. Te envié la etiqueta de despacho gratis al correo.'

/* ---------------------------------------------------------------- patrones */

export const PATTERNS: Pattern[] = [
  {
    id: 'unico',
    label: 'Un solo agente',
    blurb: 'Línea base: Andi con todas las herramientas en un loop. Sin coordinación entre agentes.',
    control: 'Simple',
    resuelve: 'sí',
    cuando: 'Siempre como punto de partida; alcanza para la mayoría de los casos de soporte.',
    nodes: [
      N.user(110, 180),
      { id: 'andi', x: 420, y: 180, label: 'Andi', sub: '1 loop · 4 herramientas', tone: 'model', icon: Bot, w: 190 },
      { id: 'tools', x: 740, y: 180, label: 'Herramientas', sub: 'pedidos · políticas · pagos', tone: 'tool', icon: Wrench, w: 210 },
    ],
    edges: [
      { from: 'user', to: 'andi' },
      { from: 'andi', to: 'tools', label: 'tool_use' },
    ],
    beats: [
      {
        title: 'Camila escribe a Andi',
        caption: 'Una sola ventana: system prompt + 4 herramientas + el mensaje.',
        flows: ['user>andi'],
        packets: [{ from: 'user', to: 'andi', body: REQUEST }],
        lanes: [[llm('andi', 'decide: buscar_pedido', 1450, 55)]],
      },
      {
        title: 'Consulta el pedido',
        caption: 'tool_use → tu código ejecuta → tool_result vuelve al mismo historial.',
        flows: ['andi>tools'],
        packets: [{ from: 'andi', to: 'tools', body: '{"name":"buscar_pedido","input":{"pedido_id":"4790"}}' }],
        lanes: [[tool('andi', 'buscar_pedido', 130), llm('andi', 'decide: consultar_politicas', 1680, 60)]],
      },
      {
        title: 'Busca la política',
        caption: 'El historial crece con cada resultado: todo comparte una ventana.',
        flows: ['andi>tools'],
        packets: [{ from: 'andi', to: 'tools', body: '{"name":"consultar_politicas","input":{"pregunta":"producto con falla de fábrica, devolución del dinero"}}' }],
        lanes: [[tool('andi', 'consultar_politicas', 340), llm('andi', 'decide: iniciar_reembolso', 2120, 60)]],
      },
      {
        title: 'Inicia el reembolso y responde',
        caption: '4 llamadas al LLM en total, todas del mismo agente.',
        flows: ['andi>tools', 'andi>user'],
        packets: [
          { from: 'andi', to: 'tools', body: '{"name":"iniciar_reembolso","input":{"pedido_id":"4790","motivo":"garantia"}}' },
          { from: 'andi', to: 'user', body: ANSWER },
        ],
        lanes: [[tool('andi', 'iniciar_reembolso', 210), llm('andi', 'respuesta final', 2330, 140)]],
      },
    ],
  },
  {
    id: 'router',
    label: 'Router',
    blurb: 'Un clasificador elige UN especialista y le pasa la solicitud. Barato y predecible, pero una sola ruta.',
    control: 'Alto (rutas fijas)',
    resuelve: 'parcial',
    cuando: 'Intenciones bien separadas (FAQ vs. pedidos vs. pagos) y una por mensaje.',
    nodes: [N.user(90, 180), { id: 'router', x: 320, y: 180, label: 'Router', sub: 'clasificador', tone: 'model', icon: Route, w: 150 }, N.ped(640, 60), N.pol(640, 180), N.pag(640, 300)],
    edges: [
      { from: 'user', to: 'router' },
      { from: 'router', to: 'ped', dashed: true },
      { from: 'router', to: 'pol' },
      { from: 'router', to: 'pag', dashed: true },
    ],
    beats: [
      {
        title: 'El router clasifica',
        caption: 'Una llamada corta (puede ser un modelo pequeño): salida estructurada con la ruta.',
        flows: ['user>router'],
        packets: [
          { from: 'user', to: 'router', body: REQUEST },
          { from: 'router', to: 'router', body: '{"ruta":"politicas","confianza":0.64,"alternativa":"pagos"}' },
        ],
        lanes: [[llm('router', 'clasificar intención', 420, 18)]],
      },
      {
        title: 'Deriva a UN especialista',
        caption: 'La solicitud mezcla pedido + política + pago, pero solo puede ir a una ruta.',
        flows: ['router>pol'],
        packets: [{ from: 'router', to: 'pol', body: REQUEST }],
        lanes: [[llm('pol', 'decide: consultar_politicas', 980, 50), tool('pol', 'consultar_politicas', 340), llm('pol', 'respuesta', 1420, 150)]],
      },
      {
        title: 'Responde… a medias',
        caption: 'Explica la política, pero no revisó el pedido ni inició el reembolso.',
        flows: ['pol>user'],
        packets: [
          {
            from: 'pol',
            to: 'user',
            body: 'Por falla de fábrica tienes 6 meses de garantía y puedes pedir la devolución del dinero. Para iniciarla, entra a Mis pedidos y elige “Solicitar devolución”.',
          },
        ],
        lanes: [],
      },
    ],
  },
  {
    id: 'supervisor',
    label: 'Supervisor',
    blurb: 'Orquestador-trabajadores: un agente central usa a los especialistas como herramientas y sintetiza.',
    control: 'Central, flexible',
    resuelve: 'sí',
    cuando: 'Respuestas que combinan varios especialistas con una sola voz hacia el usuario.',
    nodes: [N.user(90, 180), { id: 'sup', x: 330, y: 180, label: 'Supervisor', sub: 'agentes como tools', tone: 'model', icon: Network, w: 180 }, N.ped(660, 60), N.pol(660, 180), N.pag(660, 300)],
    edges: [
      { from: 'user', to: 'sup' },
      { from: 'sup', to: 'ped' },
      { from: 'sup', to: 'pol' },
      { from: 'sup', to: 'pag' },
    ],
    beats: [
      {
        title: 'El supervisor planifica',
        caption: 'Sus “herramientas” son los otros agentes: agente_pedidos, agente_politicas, agente_pagos.',
        flows: ['user>sup'],
        packets: [{ from: 'user', to: 'sup', body: REQUEST }],
        lanes: [[llm('sup', 'decide: agente_pedidos', 1300, 70)]],
      },
      {
        title: 'Delega: pedidos',
        caption: 'El trabajador arranca con contexto limpio: solo recibe el encargo, no la conversación.',
        flows: ['sup>ped'],
        packets: [{ from: 'sup', to: 'ped', body: '{"tarea":"Estado y fecha de entrega del pedido 4790. Devuelve 1 línea."}' }],
        lanes: [[llm('ped', 'decide: buscar_pedido', 900, 40), tool('ped', 'buscar_pedido', 130), llm('ped', 'resumen', 1250, 60)]],
      },
      {
        title: 'Vuelve un resumen',
        caption: 'Resumen, no transcripción: el supervisor no ve el JSON completo del pedido.',
        flows: ['ped>sup'],
        packets: [{ from: 'ped', to: 'sup', body: 'Pedido 4790: Mochila Urbana 22L, $27.990, entregado por Starken el 29-10.' }],
        lanes: [[llm('sup', 'decide: agente_politicas', 1480, 75)]],
      },
      {
        title: 'Delega: políticas',
        caption: 'El agente de políticas hace RAG sobre la base de conocimiento.',
        flows: ['sup>pol'],
        packets: [{ from: 'sup', to: 'pol', body: '{"tarea":"¿Aplica garantía o devolución? Mochila entregada 29-10 con cierre roto."}' }],
        lanes: [[llm('pol', 'decide: consultar_politicas', 950, 45), tool('pol', 'consultar_politicas', 340), llm('pol', 'resumen', 1500, 90)]],
      },
      {
        title: 'Política confirmada',
        caption: 'Con eso el supervisor decide pedir el reembolso.',
        flows: ['pol>sup'],
        packets: [{ from: 'pol', to: 'sup', body: 'Falla de fábrica: garantía de 6 meses; puede elegir devolución del dinero (garantia.md).' }],
        lanes: [[llm('sup', 'decide: agente_pagos', 1700, 70)]],
      },
      {
        title: 'Delega: pagos',
        caption: 'Acción sensible aislada en un agente con permisos mínimos.',
        flows: ['sup>pag'],
        packets: [{ from: 'sup', to: 'pag', body: '{"tarea":"Iniciar reembolso del pedido 4790 por garantía a la tarjeta original."}' }],
        lanes: [[llm('pag', 'decide: iniciar_reembolso', 880, 40), tool('pag', 'iniciar_reembolso', 210), llm('pag', 'resumen', 1120, 60)]],
      },
      {
        title: 'El supervisor sintetiza y responde',
        caption: '4 llamadas del supervisor + 6 de los trabajadores = 10.',
        flows: ['pag>sup', 'sup>user'],
        packets: [
          { from: 'pag', to: 'sup', body: 'Reembolso RB-7731: $27.990 a Visa ****4417, 5–10 días hábiles desde recepción.' },
          { from: 'sup', to: 'user', body: ANSWER },
        ],
        lanes: [[llm('sup', 'respuesta final', 1900, 150)]],
      },
    ],
  },
  {
    id: 'handoff',
    label: 'Handoff',
    blurb: 'Transferencia: cada agente decide pasar el control al siguiente, que hereda la conversación y le responde al usuario.',
    control: 'Distribuido',
    resuelve: 'sí',
    cuando: 'Un especialista debe llevar la conversación completa (triage → facturación).',
    nodes: [
      N.user(90, 180),
      { id: 'triage', x: 310, y: 180, label: 'Triage', sub: 'primer contacto', tone: 'model', icon: ArrowRightLeft, w: 150 },
      N.ped(540, 70),
      N.pol(540, 300),
      N.pag(790, 180),
    ],
    edges: [
      { from: 'user', to: 'triage' },
      { from: 'triage', to: 'ped', label: 'handoff' },
      { from: 'triage', to: 'pol', dashed: true },
      { from: 'ped', to: 'pag', label: 'handoff' },
      { from: 'pol', to: 'pag', dashed: true },
    ],
    beats: [
      {
        title: 'Triage recibe',
        caption: 'Cada agente tiene una herramienta de transferencia (p. ej. handoff_to_agent).',
        flows: ['user>triage'],
        packets: [{ from: 'user', to: 'triage', body: REQUEST }],
        lanes: [[llm('triage', 'handoff → pedidos', 800, 35)]],
      },
      {
        title: 'Transfiere a pedidos',
        caption: 'El nuevo agente hereda el historial: el contexto viaja con el control.',
        flows: ['triage>ped'],
        packets: [{ from: 'triage', to: 'ped', body: '{"handoff":"agente_pedidos","historial":[1 mensaje],"nota":"devolución por falla"}' }],
        lanes: [[llm('ped', 'decide: buscar_pedido', 1150, 40), tool('ped', 'buscar_pedido', 130), llm('ped', 'handoff → pagos', 1450, 60)]],
      },
      {
        title: 'Transfiere a pagos',
        caption: 'Pagos consulta la política por su cuenta e inicia el reembolso.',
        flows: ['ped>pag'],
        packets: [{ from: 'ped', to: 'pag', body: '{"handoff":"agente_pagos","historial":[5 mensajes],"nota":"4790 entregado 29-10, $27.990"}' }],
        lanes: [
          [
            llm('pag', 'decide: consultar_politicas', 1500, 45),
            tool('pag', 'consultar_politicas', 340),
            llm('pag', 'decide: iniciar_reembolso', 1900, 50),
            tool('pag', 'iniciar_reembolso', 210),
            llm('pag', 'respuesta final', 2150, 150),
          ],
        ],
      },
      {
        title: 'Pagos le responde a Camila',
        caption: 'Quien tiene el control habla con el usuario. Riesgo: ping-pong entre agentes si no hay límites.',
        flows: ['pag>user'],
        packets: [{ from: 'pag', to: 'user', body: ANSWER }],
        lanes: [],
      },
    ],
  },
  {
    id: 'paralelo',
    label: 'Paralelo',
    blurb: 'Fan-out / fan-in: se lanzan subtareas independientes a la vez y un agente consolida.',
    control: 'Estructurado',
    resuelve: 'sí',
    cuando: 'Subtareas independientes y lentas (investigación, revisar varios documentos).',
    nodes: [
      N.user(80, 180),
      { id: 'orq', x: 270, y: 180, label: 'Planificador', sub: 'divide la tarea', tone: 'model', icon: GitFork, w: 160 },
      N.ped(520, 60),
      N.pol(520, 180),
      N.pag(520, 300),
      N.red(790, 180),
    ],
    edges: [
      { from: 'user', to: 'orq' },
      { from: 'orq', to: 'ped' },
      { from: 'orq', to: 'pol' },
      { from: 'orq', to: 'pag' },
      { from: 'ped', to: 'red' },
      { from: 'pol', to: 'red' },
      { from: 'pag', to: 'red' },
    ],
    beats: [
      {
        title: 'El planificador divide',
        caption: 'Genera 3 subtareas independientes en JSON.',
        flows: ['user>orq'],
        packets: [
          { from: 'user', to: 'orq', body: REQUEST },
          { from: 'orq', to: 'orq', body: '[{"a":"pedidos","t":"estado 4790"},{"a":"politicas","t":"falla de fábrica"},{"a":"pagos","t":"reembolso 4790"}]' },
        ],
        lanes: [[llm('orq', 'plan (3 subtareas)', 700, 110)]],
      },
      {
        title: 'Fan-out: tres agentes a la vez',
        caption: 'Las tres ramas corren en paralelo: la latencia es la de la rama más lenta. Ojo: pagos también tiene que buscar el pedido (trabajo duplicado).',
        flows: ['orq>ped', 'orq>pol', 'orq>pag'],
        packets: [
          { from: 'orq', to: 'ped', body: '{"tarea":"estado 4790"}' },
          { from: 'orq', to: 'pol', body: '{"tarea":"política para falla de fábrica"}' },
          { from: 'orq', to: 'pag', body: '{"tarea":"preparar reembolso 4790"}' },
        ],
        lanes: [
          [llm('ped', 'decide: buscar_pedido', 900, 40), tool('ped', 'buscar_pedido', 130), llm('ped', 'resumen', 1250, 60)],
          [llm('pol', 'decide: consultar_politicas', 950, 45), tool('pol', 'consultar_politicas', 340), llm('pol', 'resumen', 1500, 90)],
          [llm('pag', 'decide: buscar_pedido', 880, 40), tool('pag', 'buscar_pedido', 130), llm('pag', 'decide: iniciar_reembolso', 1180, 45), tool('pag', 'iniciar_reembolso', 210), llm('pag', 'resumen', 1350, 60)],
        ],
      },
      {
        title: 'Fan-in: el redactor consolida',
        caption: 'Recibe los tres resúmenes y escribe una sola respuesta.',
        flows: ['ped>red', 'pol>red', 'pag>red'],
        packets: [
          { from: 'ped', to: 'red', body: '4790 entregado 29-10, $27.990' },
          { from: 'pol', to: 'red', body: 'garantía 6 meses, devolución del dinero' },
          { from: 'pag', to: 'red', body: 'RB-7731 · Visa ****4417 · 5–10 días' },
        ],
        lanes: [[llm('red', 'redactar respuesta', 1400, 160)]],
      },
      {
        title: 'Respuesta',
        caption: '1 + 7 + 1 = 9 llamadas, pero buena parte ocurrió al mismo tiempo.',
        flows: ['red>user'],
        packets: [{ from: 'red', to: 'user', body: ANSWER }],
        lanes: [],
      },
    ],
  },
  {
    id: 'secuencial',
    label: 'Secuencial',
    blurb: 'Pipeline: etapas fijas en orden; cada una recibe la salida de la anterior. Sin LLM que decida el camino.',
    control: 'Máximo (orden fijo)',
    resuelve: 'sí',
    cuando: 'Procesos con pasos conocidos y auditables (validar → decidir → ejecutar → comunicar).',
    nodes: [
      N.user(90, 70),
      N.ped(130, 250),
      N.pol(350, 250),
      { id: 'pag', x: 580, y: 250, label: 'Ag. pagos', sub: 'reembolsos', tone: 'guard', icon: ShieldCheck, w: 150 },
      { id: 'red', x: 790, y: 250, label: 'Ag. redactor', sub: 'tono de marca', tone: 'accent', icon: ClipboardList, w: 160 },
    ],
    edges: [
      { from: 'user', to: 'ped' },
      { from: 'ped', to: 'pol' },
      { from: 'pol', to: 'pag' },
      { from: 'pag', to: 'red' },
    ],
    beats: [
      {
        title: 'Etapa 1: pedidos',
        caption: 'Extrae los datos del pedido en un formato fijo.',
        flows: ['user>ped'],
        packets: [{ from: 'user', to: 'ped', body: REQUEST }],
        lanes: [[llm('ped', 'decide: buscar_pedido', 620, 40), tool('ped', 'buscar_pedido', 130), llm('ped', 'ficha estructurada', 900, 70)]],
      },
      {
        title: 'Etapa 2: políticas',
        caption: 'Recibe solo la ficha, no la conversación: prompts pequeños.',
        flows: ['ped>pol'],
        packets: [{ from: 'ped', to: 'pol', body: '{"pedido":"4790","producto":"Mochila Urbana 22L","entregado":"2026-10-29","problema":"cierre roto"}' }],
        lanes: [[llm('pol', 'decide: consultar_politicas', 700, 40), tool('pol', 'consultar_politicas', 340), llm('pol', 'veredicto', 1150, 70)]],
      },
      {
        title: 'Etapa 3: pagos',
        caption: 'Ejecuta el reembolso según el veredicto.',
        flows: ['pol>pag'],
        packets: [{ from: 'pol', to: 'pag', body: '{"elegible":true,"via":"garantia","opcion":"devolucion_dinero","monto":27990}' }],
        lanes: [[llm('pag', 'arma iniciar_reembolso', 650, 45), tool('pag', 'iniciar_reembolso', 210)]],
      },
      {
        title: 'Etapa 4: redactor',
        caption: 'Convierte el resultado en un mensaje con tono de marca.',
        flows: ['pag>red'],
        packets: [{ from: 'pag', to: 'red', body: '{"reembolso":"RB-7731","monto":27990,"medio":"Visa ****4417","plazo":"5-10 días hábiles"}' }],
        lanes: [[llm('red', 'redactar respuesta', 800, 150)]],
      },
      {
        title: 'Respuesta',
        caption: '6 llamadas, contextos chicos, pero todo en serie.',
        flows: ['red>user'],
        packets: [{ from: 'red', to: 'user', body: ANSWER }],
        lanes: [],
      },
    ],
  },
]

/* ---------------------------------------------------------------- timeline */

export type TimedCall = Call & { beat: number; start: number; end: number }

export type Timeline = {
  calls: TimedCall[]
  beatEnd: number[]
  lanes: string[]
  total: { llm: number; inTok: number; outTok: number; ms: number; usd: number }
}

export function timeline(p: Pattern): Timeline {
  const calls: TimedCall[] = []
  const beatEnd: number[] = []
  let t = 0
  p.beats.forEach((b, bi) => {
    let end = t
    for (const lane of b.lanes) {
      let s = t
      for (const c of lane) {
        const e = s + (c.ms ?? 0)
        calls.push({ ...c, beat: bi, start: s, end: e })
        s = e
      }
      end = Math.max(end, s)
    }
    t = end + (b.lanes.length ? 0 : 40) // un mensaje sin cómputo igual tarda algo (red)
    beatEnd.push(t)
  })
  const lanes = [...new Set(calls.map((c) => c.agent))]
  const llms = calls.filter((c) => c.kind === 'llm')
  const inTok = llms.reduce((s, c) => s + (c.inTok ?? 0), 0)
  const outTok = llms.reduce((s, c) => s + (c.outTok ?? 0), 0)
  return {
    calls,
    beatEnd,
    lanes,
    total: { llm: llms.length, inTok, outTok, ms: t, usd: (inTok * PRICING.inputPerM + outTok * PRICING.outputPerM) / 1e6 },
  }
}

/** Acumulado hasta el beat `upTo` (inclusive). */
export function tallyUpTo(tl: Timeline, upTo: number) {
  const cs = tl.calls.filter((c) => c.beat <= upTo && c.kind === 'llm')
  const inTok = cs.reduce((s, c) => s + (c.inTok ?? 0), 0)
  const outTok = cs.reduce((s, c) => s + (c.outTok ?? 0), 0)
  return { llm: cs.length, inTok, outTok, ms: tl.beatEnd[upTo] ?? 0, usd: (inTok * PRICING.inputPerM + outTok * PRICING.outputPerM) / 1e6 }
}
