/* Datos simulados de la lección MCP: el servidor "andes-pedidos" y los mensajes
   JSON-RPC 2.0 que intercambia con el cliente. Formas según la spec 2025-11-25
   (handshake initialize) y la 2026-07-28 (stateless, server/discover). */
import { MODEL_ID, ORDERS, SYSTEM_PROMPT } from '../../sim/scenario'

export type Spec = '2025-11-25' | '2026-07-28'

export const SERVER_NAME = 'andes-pedidos'
export const HOST_NAME = 'andes-soporte-host'

export const ORDER = ORDERS['4821']

/** Lo que devuelve buscar_pedido como datos estructurados. */
export const ORDER_DATA = {
  pedido_id: ORDER.id,
  estado: ORDER.estado,
  courier: ORDER.courier,
  seguimiento: ORDER.seguimiento,
  eta: ORDER.eta,
  direccion: ORDER.direccion,
}

/** Herramienta tal como la anuncia el servidor MCP en tools/list (camelCase). */
export const MCP_TOOL = {
  name: 'buscar_pedido',
  title: 'Buscar pedido',
  description: 'Obtiene estado, courier, seguimiento y fecha estimada de un pedido de Andes Market.',
  inputSchema: {
    type: 'object',
    properties: {
      pedido_id: { type: 'string', description: 'Número de pedido de 4 dígitos', pattern: '^[0-9]{4}$' },
    },
    required: ['pedido_id'],
  },
  annotations: { readOnlyHint: true },
}

export const MCP_TOOL_2 = {
  name: 'cambiar_direccion',
  title: 'Cambiar dirección',
  description: 'Cambia la dirección de entrega. Solo si el pedido está "preparando".',
  inputSchema: {
    type: 'object',
    properties: {
      pedido_id: { type: 'string' },
      nueva_direccion: { type: 'string', description: 'Calle, número y comuna' },
    },
    required: ['pedido_id', 'nueva_direccion'],
  },
  annotations: { destructiveHint: false, idempotentHint: true },
}

/** La misma herramienta convertida al parámetro `tools` de la Messages API. */
export const API_TOOL = {
  name: MCP_TOOL.name,
  description: MCP_TOOL.description,
  input_schema: MCP_TOOL.inputSchema,
}

const j = (v: unknown) => JSON.stringify(v, null, 2)

/** `_meta` que acompaña cada request en la spec 2026-07-28 (claves simplificadas). */
const META_2026 = {
  protocolVersion: '2026-07-28',
  clientInfo: { name: HOST_NAME, version: '3.2.0' },
  capabilities: { elicitation: {} },
}

export type Lane = 'user' | 'llm' | 'host' | 'client' | 'server'
export type ArrowKind = 'req' | 'res' | 'notif' | 'self' | 'api'

export type SeqStep = {
  from: Lane
  to: Lane
  kind: ArrowKind
  /** texto sobre la flecha */
  label: string
  title: string
  body: string
  codeTitle: string
  code: string
  lang: 'json' | 'text' | 'http'
  /** fragmentos de texto a resaltar en el código */
  hl?: string[]
  /** paso especial: muestra la conversión de esquemas lado a lado */
  convert?: boolean
  /** pastillas con datos clave del mensaje */
  tags?: string[]
}

export function buildSteps(spec: Spec): SeqStep[] {
  const stateless = spec === '2026-07-28'
  const withMeta = <T extends object>(params: T) => (stateless ? { ...params, _meta: META_2026 } : params)

  const handshake: SeqStep[] = stateless
    ? [
        {
          from: 'client',
          to: 'server',
          kind: 'req',
          label: 'server/discover',
          title: 'Descubrir al servidor (sin handshake)',
          body: 'En la spec 2026-07-28 no hay initialize ni sesión. El cliente llama a server/discover para saber qué versión y capacidades ofrece el servidor. Desde ahora, cada request se describe a sí misma con _meta.',
          codeTitle: 'Cliente → Servidor · request',
          code: j({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: META_2026 } }),
          lang: 'json',
          hl: ['"method"', '"_meta"', '"protocolVersion"'],
          tags: ['id: 1', 'request'],
        },
        {
          from: 'server',
          to: 'client',
          kind: 'res',
          label: 'result: versión + capacidades',
          title: 'El servidor se presenta',
          body: 'La respuesta lleva el mismo id (1). El servidor declara qué primitivas soporta. No se guarda nada: si mañana otra réplica atiende la siguiente request, da igual.',
          codeTitle: 'Servidor → Cliente · response (forma simplificada)',
          code: j({
            jsonrpc: '2.0',
            id: 1,
            result: {
              protocolVersion: '2026-07-28',
              capabilities: { tools: { listChanged: true }, resources: {} },
              serverInfo: { name: SERVER_NAME, version: '1.4.0' },
            },
          }),
          lang: 'json',
          hl: ['"id"', '"capabilities"', '"serverInfo"'],
          tags: ['id: 1', 'response'],
        },
      ]
    : [
        {
          from: 'client',
          to: 'server',
          kind: 'req',
          label: 'initialize',
          title: 'Handshake: initialize',
          body: 'Antes de nada, el cliente propone una versión del protocolo y declara sus propias capacidades (aquí: puede mostrar formularios de elicitation al usuario). Es una request JSON-RPC: tiene id y espera respuesta.',
          codeTitle: 'Cliente → Servidor · request',
          code: j({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-11-25',
              capabilities: { elicitation: {} },
              clientInfo: { name: HOST_NAME, version: '3.2.0' },
            },
          }),
          lang: 'json',
          hl: ['"method"', '"protocolVersion"', '"capabilities"'],
          tags: ['id: 1', 'request'],
        },
        {
          from: 'server',
          to: 'client',
          kind: 'res',
          label: 'result: capabilities, serverInfo',
          title: 'El servidor acepta y negocia',
          body: 'Responde con el mismo id. Confirma la versión (si no la soportara, propondría otra), anuncia sus capacidades —tools con listChanged: avisará si cambia la lista— y su identidad. instructions es un texto opcional que el host puede pasar al modelo.',
          codeTitle: 'Servidor → Cliente · response',
          code: j({
            jsonrpc: '2.0',
            id: 1,
            result: {
              protocolVersion: '2025-11-25',
              capabilities: { tools: { listChanged: true }, resources: {} },
              serverInfo: { name: SERVER_NAME, version: '1.4.0' },
              instructions: 'Pedidos de Andes Market. Usa buscar_pedido antes de responder sobre un despacho.',
            },
          }),
          lang: 'json',
          hl: ['"id"', '"capabilities"', '"serverInfo"'],
          tags: ['id: 1', 'response'],
        },
        {
          from: 'client',
          to: 'server',
          kind: 'notif',
          label: 'notifications/initialized',
          title: 'Notificación: listo para operar',
          body: 'El cliente confirma que terminó la inicialización. Es una notificación: no lleva id y nadie responde. Desde aquí la sesión está abierta (en HTTP, identificada por el header Mcp-Session-Id).',
          codeTitle: 'Cliente → Servidor · notificación (sin id)',
          code: j({ jsonrpc: '2.0', method: 'notifications/initialized' }),
          lang: 'json',
          hl: ['"method"'],
          tags: ['sin id', 'notificación'],
        },
      ]

  const n = stateless ? 2 : 3 // ids siguientes
  const listResult: Record<string, unknown> = { tools: [MCP_TOOL, MCP_TOOL_2] }
  if (stateless) listResult.ttlMs = 300000

  const userText = '¿Dónde está mi pedido 4821?'
  const toolUseId = 'toolu_01HmK3pQ7vX'
  const resultText = JSON.stringify(ORDER_DATA)

  return [
    ...handshake,
    {
      from: 'client',
      to: 'server',
      kind: 'req',
      label: 'tools/list',
      title: '¿Qué herramientas tienes?',
      body: stateless
        ? 'Pide el catálogo de herramientas. Igual que todas las requests de esta versión, viaja con su _meta: el servidor no recuerda quién preguntó antes.'
        : 'Pide el catálogo de herramientas. No necesita params (se podría paginar con cursor).',
      codeTitle: 'Cliente → Servidor · request',
      code: j({ jsonrpc: '2.0', id: n, method: 'tools/list', params: withMeta({}) }),
      lang: 'json',
      hl: ['"method"'],
      tags: [`id: ${n}`, 'request'],
    },
    {
      from: 'server',
      to: 'client',
      kind: 'res',
      label: 'result: tools[ ]',
      title: 'El catálogo: nombre, descripción e inputSchema',
      body: stateless
        ? 'Cada tool trae name, description y su inputSchema (JSON Schema, en camelCase). En 2026-07-28 la lista viene en orden determinista y con ttlMs/cacheScope como pista de caché: bueno para el prompt caching del host.'
        : 'Cada tool trae name, description y su inputSchema (JSON Schema, en camelCase). Las annotations (readOnlyHint…) son pistas para el host, no garantías: vienen de un servidor que podría mentir.',
      codeTitle: 'Servidor → Cliente · response',
      code: j({ jsonrpc: '2.0', id: n, result: listResult }),
      lang: 'json',
      hl: ['"name"', '"inputSchema"', '"ttlMs"'],
      tags: [`id: ${n}`, '2 tools'],
    },
    {
      from: 'client',
      to: 'host',
      kind: 'self',
      label: 'MCP tool → tool del LLM',
      title: 'El host traduce: inputSchema → input_schema',
      body: 'El LLM no habla MCP. El host toma cada tool del catálogo y la convierte al formato de la API de su modelo: en la Messages API de Anthropic el campo se llama input_schema (snake_case); en OpenAI sería function.parameters. Algunos hosts además prefijan el nombre con el servidor para evitar choques.',
      codeTitle: 'Conversión en el host',
      code: '',
      lang: 'json',
      convert: true,
      tags: ['sin red', 'código del host'],
    },
    {
      from: 'user',
      to: 'host',
      kind: 'api',
      label: `"${userText}"`,
      title: 'Camila pregunta',
      body: 'Llega un mensaje del usuario al host (la app de soporte). Hasta ahora todo fue preparación: conexión y catálogo.',
      codeTitle: 'Chat · mensaje del usuario',
      code: userText,
      lang: 'text',
      tags: ['usuario'],
    },
    {
      from: 'host',
      to: 'llm',
      kind: 'api',
      label: 'messages.create (tools)',
      title: 'El host llama al modelo con las tools',
      body: 'Request HTTP normal a la API del modelo. Las tools que vinieron por MCP ahora son parte del prompt: el modelo solo ve nombre, descripción y esquema. No sabe que detrás hay un servidor MCP.',
      codeTitle: 'Host → API del LLM · POST /v1/messages',
      code: j({
        model: MODEL_ID,
        max_tokens: 1024,
        system: SYSTEM_PROMPT.split('\n')[0],
        tools: [API_TOOL],
        messages: [{ role: 'user', content: userText }],
      }),
      lang: 'json',
      hl: ['"tools"', '"input_schema"'],
      tags: ['Messages API'],
    },
    {
      from: 'llm',
      to: 'host',
      kind: 'api',
      label: 'stop_reason: tool_use',
      title: 'El modelo pide usar una herramienta',
      body: 'El modelo no ejecuta nada: devuelve un bloque tool_use con el nombre y los argumentos que generó, y se detiene con stop_reason "tool_use". Ejecutarla es trabajo del host.',
      codeTitle: 'API del LLM → Host · response',
      code: j({
        role: 'assistant',
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Reviso tu pedido.' },
          { type: 'tool_use', id: toolUseId, name: 'buscar_pedido', input: { pedido_id: '4821' } },
        ],
      }),
      lang: 'json',
      hl: ['"stop_reason"', '"tool_use"', '"input"'],
      tags: ['tool_use'],
    },
    {
      from: 'client',
      to: 'server',
      kind: 'req',
      label: 'tools/call buscar_pedido',
      title: 'tools/call: input → arguments',
      body: 'El host le pasa el tool_use a su cliente MCP, que arma la request tools/call. Fíjate en el cambio de nombres: el input del modelo pasa a ser arguments en MCP.',
      codeTitle: 'Cliente → Servidor · request',
      code: j({
        jsonrpc: '2.0',
        id: n + 1,
        method: 'tools/call',
        params: withMeta({ name: 'buscar_pedido', arguments: { pedido_id: '4821' } }),
      }),
      lang: 'json',
      hl: ['"method"', '"name"', '"arguments"'],
      tags: [`id: ${n + 1}`, 'request'],
    },
    {
      from: 'server',
      to: 'client',
      kind: 'res',
      label: 'result: content, isError',
      title: 'El servidor ejecuta y responde',
      body: 'El servidor consulta su sistema (con su propia credencial) y devuelve content: una lista de bloques (text, image, resource…). structuredContent lleva el mismo dato como JSON validable contra un outputSchema. isError: true indicaría un fallo de la herramienta que el modelo debe ver, no un error de protocolo.',
      codeTitle: 'Servidor → Cliente · response',
      code: j({
        jsonrpc: '2.0',
        id: n + 1,
        result: { content: [{ type: 'text', text: resultText }], structuredContent: ORDER_DATA, isError: false },
      }),
      lang: 'json',
      hl: ['"content"', '"structuredContent"', '"isError"'],
      tags: [`id: ${n + 1}`, 'isError: false'],
    },
    {
      from: 'host',
      to: 'llm',
      kind: 'api',
      label: 'tool_result',
      title: 'De vuelta al modelo como tool_result',
      body: 'El host traduce otra vez: content de MCP → bloque tool_result con el mismo tool_use_id; isError → is_error. Se agrega al historial y se vuelve a llamar al modelo.',
      codeTitle: 'Host → API del LLM · nuevo mensaje en messages[]',
      code: j({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUseId, content: resultText }],
      }),
      lang: 'json',
      hl: ['"tool_result"', '"tool_use_id"'],
      tags: ['tool_result'],
    },
    {
      from: 'llm',
      to: 'host',
      kind: 'api',
      label: 'stop_reason: end_turn',
      title: 'Respuesta final',
      body: 'Con el dato real en contexto, el modelo redacta la respuesta y termina con end_turn. No hace falta otra herramienta.',
      codeTitle: 'API del LLM → Host · response',
      code: j({
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [
          {
            type: 'text',
            text: `Tu pedido ${ORDER.id} va en ruta con ${ORDER.courier} (seguimiento ${ORDER.seguimiento}). Debería llegar el miércoles 4 de noviembre a ${ORDER.direccion}.`,
          },
        ],
      }),
      lang: 'json',
      hl: ['"end_turn"'],
      tags: ['end_turn'],
    },
    {
      from: 'host',
      to: 'user',
      kind: 'api',
      label: 'respuesta',
      title: 'Camila recibe la respuesta',
      body: stateless
        ? 'Resumen: 2 requests de preparación (discover + list, cacheables), 1 tools/call y 2 llamadas al modelo. Ninguna request dependió de una sesión.'
        : 'Resumen: 1 request + 1 notificación de handshake, 1 tools/list, 1 tools/call y 2 llamadas al modelo. El handshake y el catálogo se hacen una vez por conexión, no por pregunta.',
      codeTitle: 'Chat · respuesta de Andi',
      code: `Tu pedido ${ORDER.id} va en ruta con ${ORDER.courier} (seguimiento ${ORDER.seguimiento}). Debería llegar el miércoles 4 de noviembre a ${ORDER.direccion}.`,
      lang: 'text',
      tags: ['fin'],
    },
  ]
}

/* -------------------------------------------------------------------------- */
/* Primitivas                                                                   */
/* -------------------------------------------------------------------------- */

export type PrimId = 'tools' | 'resources' | 'prompts' | 'elicitation'

export const PRIMITIVES: Record<
  PrimId,
  {
    label: string
    side: 'servidor' | 'cliente'
    control: string
    controlTone: 'model' | 'system' | 'user'
    methods: string[]
    what: string
    example: string
    req: unknown
    res: unknown
    note?: string
  }
> = {
  tools: {
    label: 'Tools',
    side: 'servidor',
    control: 'Lo decide el modelo',
    controlTone: 'model',
    methods: ['tools/list', 'tools/call'],
    what: 'Acciones o consultas con efecto. El LLM decide cuándo llamarlas a partir de su descripción.',
    example: 'buscar_pedido, cambiar_direccion',
    req: { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'buscar_pedido', arguments: { pedido_id: '5102' } } },
    res: {
      jsonrpc: '2.0',
      id: 7,
      result: { content: [{ type: 'text', text: '{"pedido_id":"5102","estado":"preparando"}' }], isError: false },
    },
  },
  resources: {
    label: 'Resources',
    side: 'servidor',
    control: 'Lo decide la aplicación',
    controlTone: 'system',
    methods: ['resources/list', 'resources/read'],
    what: 'Datos de contexto identificados por URI. El host elige qué cargar (p. ej. el usuario adjunta una política al chat).',
    example: 'policy://devoluciones/cl',
    req: { jsonrpc: '2.0', id: 8, method: 'resources/read', params: { uri: 'policy://devoluciones/cl' } },
    res: {
      jsonrpc: '2.0',
      id: 8,
      result: {
        contents: [
          {
            uri: 'policy://devoluciones/cl',
            mimeType: 'text/markdown',
            text: 'Puedes devolver cualquier producto dentro de 30 días corridos…',
          },
        ],
      },
    },
  },
  prompts: {
    label: 'Prompts',
    side: 'servidor',
    control: 'Lo elige el usuario',
    controlTone: 'user',
    methods: ['prompts/list', 'prompts/get'],
    what: 'Plantillas reutilizables que el usuario invoca, típicamente como comando "/". Devuelven mensajes listos para el modelo.',
    example: '/resumir_reclamo',
    req: { jsonrpc: '2.0', id: 9, method: 'prompts/get', params: { name: 'resumir_reclamo', arguments: { ticket_id: 'TK-20931' } } },
    res: {
      jsonrpc: '2.0',
      id: 9,
      result: {
        description: 'Resume un reclamo antes de escalarlo',
        messages: [{ role: 'user', content: { type: 'text', text: 'Resume el reclamo TK-20931: causa, impacto y acción sugerida.' } }],
      },
    },
  },
  elicitation: {
    label: 'Elicitation',
    side: 'cliente',
    control: 'El servidor pide, el usuario responde',
    controlTone: 'user',
    methods: ['elicitation/create (2025-11-25)', 'input_required / MRTR (2026-07-28)'],
    what: 'El servidor necesita un dato o una confirmación del usuario. El host muestra un formulario; la respuesta no pasa por el LLM.',
    example: 'confirmar un cambio de dirección',
    req: {
      jsonrpc: '2.0',
      id: 41,
      method: 'elicitation/create',
      params: {
        message: '¿Confirmas cambiar la dirección del pedido 5102?',
        requestedSchema: {
          type: 'object',
          properties: { confirmar: { type: 'boolean' }, comuna: { type: 'string' } },
          required: ['confirmar'],
        },
      },
    },
    res: { jsonrpc: '2.0', id: 41, result: { action: 'accept', content: { confirmar: true, comuna: 'Ñuñoa' } } },
    note: 'En 2025-11-25 el servidor envía elicitation/create al cliente (request iniciada por el servidor). En 2026-07-28 eso desaparece: el servidor responde resultType "input_required" con inputRequests y el cliente reintenta la misma llamada con inputResponses (MRTR). Sampling, Roots y Logging quedaron deprecados en esa versión.',
  },
}
