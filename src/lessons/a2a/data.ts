/* Datos simulados de la lección A2A (spec v1.0): Andi (Andes Market) delega en
   el agente de un courier ficticio, "RutaSur Logística", la reprogramación de
   la entrega del pedido 5230. */

export type TaskState = 'SUBMITTED' | 'WORKING' | 'INPUT_REQUIRED' | 'AUTH_REQUIRED' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'REJECTED'

export const TERMINAL: TaskState[] = ['COMPLETED', 'FAILED', 'CANCELED', 'REJECTED']

export const STATE_INFO: Record<TaskState, { v03: string; desc: string }> = {
  SUBMITTED: { v03: 'submitted', desc: 'Recibida; el agente remoto aún no empieza.' },
  WORKING: { v03: 'working', desc: 'El agente remoto está trabajando: razona, usa sus herramientas, coordina.' },
  INPUT_REQUIRED: { v03: 'input-required', desc: 'Pausada: falta un dato del cliente. Se retoma con un nuevo mensaje en la misma tarea.' },
  AUTH_REQUIRED: { v03: 'auth-required', desc: 'Pausada: se necesita una credencial o autorización adicional.' },
  COMPLETED: { v03: 'completed', desc: 'Terminó con éxito. Los artefactos tienen el resultado.' },
  FAILED: { v03: 'failed', desc: 'Terminó con error (del remoto o de sus sistemas). Conviene reintentar con criterio o escalar.' },
  CANCELED: { v03: 'canceled', desc: 'El cliente la canceló (CancelTask). El trabajo parcial se descarta.' },
  REJECTED: { v03: 'rejected', desc: 'El agente remoto decidió no hacerla: fuera de su política o de sus capacidades. Es una respuesta válida.' },
}

const CARD_URL = 'https://agentes.rutasur.cl/.well-known/agent-card.json'
export const TASK_ID = 'tsk-7f3a9c'
export const CONTEXT_ID = 'ctx-5230-andes'
export const TRACKING = 'RS-52300-CL'

export const AGENT_CARD = {
  name: 'RutaSur Logística · Agente de despachos',
  description: 'Reprograma entregas, informa seguimiento y coordina retiros de envíos RutaSur en Chile.',
  version: '1.2.0',
  provider: { organization: 'RutaSur Logística SpA', url: 'https://www.rutasur.cl' },
  supportedInterfaces: [{ url: 'https://agentes.rutasur.cl/a2a/jsonrpc', protocolBinding: 'JSONRPC', protocolVersion: '1.0' }],
  capabilities: { streaming: true, pushNotifications: true, extendedAgentCard: false },
  securitySchemes: {
    rutasur_oauth: {
      oauth2SecurityScheme: {
        flows: { clientCredentials: { tokenUrl: 'https://auth.rutasur.cl/oauth/token', scopes: { 'envios.reprogramar': 'Reprogramar entregas' } } },
      },
    },
  },
  securityRequirements: [{ schemes: { rutasur_oauth: { list: ['envios.reprogramar'] } } }],
  defaultInputModes: ['text/plain', 'application/json'],
  defaultOutputModes: ['application/json'],
  skills: [
    {
      id: 'reprogramar_entrega',
      name: 'Reprogramar entrega',
      description: 'Mueve la entrega de un envío a otra fecha y ventana horaria con cupo en la comuna de destino.',
      tags: ['entregas', 'reprogramación'],
      examples: ['Reprograma el envío RS-52300-CL: el destinatario no estará el miércoles'],
      inputModes: ['application/json', 'text/plain'],
      outputModes: ['application/json'],
    },
    {
      id: 'consultar_seguimiento',
      name: 'Consultar seguimiento',
      description: 'Estado y ubicación de un envío por número de seguimiento.',
      tags: ['seguimiento'],
      examples: ['¿Dónde está el envío RS-52300-CL?'],
    },
  ],
}

const j = (v: unknown) => JSON.stringify(v, null, 2)

export type ActorId = 'camila' | 'andi' | 'card' | 'rutasur'

export type DelegStep = {
  title: string
  body: string
  flows: string[]
  active?: ActorId[]
  /** estado de la tarea después de este paso (null = aún no existe) */
  state: TaskState | null
  /** arista recorrida en la máquina de estados */
  edge?: [TaskState, TaskState]
  time: string
  event: string
  eventTone: 'user' | 'model' | 'tool' | 'data'
  codeTitle: string
  code: string
  lang: 'json' | 'http' | 'text'
  hl?: string[]
  /** si es mensaje de chat, quién habla */
  chat?: 'user' | 'model'
}

const message1 = {
  messageId: 'msg-andi-0001',
  role: 'ROLE_USER',
  parts: [
    { text: 'La destinataria no estará el miércoles 4 de noviembre. Reprograma la entrega a la próxima ventana disponible.' },
    { data: { seguimiento: TRACKING, pedido: '5230', comuna: 'Providencia' }, mediaType: 'application/json' },
  ],
}

export const DELEG_STEPS: DelegStep[] = [
  {
    title: 'Camila pide algo que Andi no puede hacer solo',
    body: 'Andi consulta el pedido 5230 con su herramienta y ve que el despacho está en manos de RutaSur, una empresa externa. Andi no controla la agenda del courier: tiene que pedírselo a su agente.',
    flows: ['camila>andi'],
    state: null,
    time: '15:02:04',
    event: 'Mensaje de Camila',
    eventTone: 'user',
    codeTitle: 'Chat · Camila',
    code: 'No voy a estar el miércoles. ¿Pueden entregar mi pedido 5230 otro día?',
    lang: 'text',
    chat: 'user',
  },
  {
    title: 'Descubrimiento: la Agent Card',
    body: 'Andi descarga la Agent Card de RutaSur desde su ruta conocida. Ahí lee qué sabe hacer (skills), dónde escucha (supportedInterfaces), qué soporta (streaming, push) y cómo autenticarse. No ve su código, ni su prompt, ni sus herramientas.',
    flows: ['andi>card', 'card>andi'],
    state: null,
    time: '15:02:05',
    event: 'GET agent-card.json',
    eventTone: 'data',
    codeTitle: `GET ${CARD_URL}`,
    code: j(AGENT_CARD),
    lang: 'json',
    hl: ['"skills"', '"id": "reprogramar_entrega"', '"supportedInterfaces"', '"capabilities"', '"securitySchemes"'],
  },
  {
    title: 'SendMessage: delegar la tarea',
    body: 'Con un token OAuth (client credentials, como exige la card), Andi envía un mensaje con dos Parts: texto para que el agente entienda la intención y data con los campos exactos. El LLM de RutaSur decide cómo resolverlo.',
    flows: ['andi>rutasur'],
    state: null,
    time: '15:02:06',
    event: 'SendMessage',
    eventTone: 'model',
    codeTitle: 'POST /a2a/jsonrpc · Andi → RutaSur',
    code: j({ jsonrpc: '2.0', id: 'req-1', method: 'SendMessage', params: { message: message1, configuration: { acceptedOutputModes: ['application/json'] } } }),
    lang: 'json',
    hl: ['"method"', '"role"', '"text"', '"data"'],
  },
  {
    title: 'Nace una Task: SUBMITTED',
    body: 'RutaSur no responde con un mensaje directo: crea una tarea con id propio y un contextId que agrupa la conversación. Andi guarda ambos para seguirla.',
    flows: ['rutasur>andi'],
    state: 'SUBMITTED',
    time: '15:02:06',
    event: 'Task creada',
    eventTone: 'tool',
    codeTitle: 'Respuesta · RutaSur → Andi',
    code: j({ jsonrpc: '2.0', id: 'req-1', result: { task: { id: TASK_ID, contextId: CONTEXT_ID, status: { state: 'TASK_STATE_SUBMITTED', timestamp: '2026-11-01T18:02:06Z' } } } }),
    lang: 'json',
    hl: ['"id": "tsk', '"contextId"', '"state"'],
  },
  {
    title: 'GetTask: WORKING',
    body: 'Andi consulta el estado (polling). El agente de RutaSur está revisando cupos de ruta en Providencia. En la sección 4 comparamos esto con streaming y push.',
    flows: ['andi>rutasur', 'rutasur>andi'],
    state: 'WORKING',
    edge: ['SUBMITTED', 'WORKING'],
    time: '15:02:09',
    event: 'GetTask → WORKING',
    eventTone: 'tool',
    codeTitle: 'GetTask · request y respuesta',
    code: `// → request\n${j({ jsonrpc: '2.0', id: 'req-2', method: 'GetTask', params: { id: TASK_ID } })}\n\n// ← response\n${j({ jsonrpc: '2.0', id: 'req-2', result: { id: TASK_ID, contextId: CONTEXT_ID, status: { state: 'TASK_STATE_WORKING', timestamp: '2026-11-01T18:02:08Z' } } })}`,
    lang: 'json',
    hl: ['"GetTask"', 'TASK_STATE_WORKING'],
  },
  {
    title: 'INPUT_REQUIRED: falta un dato',
    body: 'Hay cupos, pero en dos ventanas. En vez de adivinar, el agente pausa la tarea y explica qué necesita en status.message. La tarea no terminó: está interrumpida, esperando al cliente.',
    flows: ['andi>rutasur', 'rutasur>andi'],
    state: 'INPUT_REQUIRED',
    edge: ['WORKING', 'INPUT_REQUIRED'],
    time: '15:02:14',
    event: 'GetTask → INPUT_REQUIRED',
    eventTone: 'tool',
    codeTitle: 'GetTask · respuesta',
    code: j({
      jsonrpc: '2.0',
      id: 'req-3',
      result: {
        id: TASK_ID,
        contextId: CONTEXT_ID,
        status: {
          state: 'TASK_STATE_INPUT_REQUIRED',
          message: {
            messageId: 'msg-rs-0007',
            role: 'ROLE_AGENT',
            parts: [
              { text: 'Hay cupo el viernes 6 (09–13 o 14–19) o el lunes 9 (09–13). ¿Qué ventana prefiere la destinataria?' },
              {
                data: {
                  opciones: [
                    { fecha: '2026-11-06', ventana: '09:00-13:00' },
                    { fecha: '2026-11-06', ventana: '14:00-19:00' },
                    { fecha: '2026-11-09', ventana: '09:00-13:00' },
                  ],
                },
              },
            ],
          },
        },
      },
    }),
    lang: 'json',
    hl: ['TASK_STATE_INPUT_REQUIRED', '"ROLE_AGENT"', '"opciones"'],
  },
  {
    title: 'Andi le pregunta a Camila',
    body: 'Andi no inventa la respuesta: traduce la pregunta del agente remoto a lenguaje natural para su usuaria. La tarea en RutaSur sigue en INPUT_REQUIRED mientras tanto (podrían pasar minutos u horas).',
    flows: ['andi>camila'],
    state: 'INPUT_REQUIRED',
    time: '15:02:15',
    event: 'Andi pregunta',
    eventTone: 'model',
    codeTitle: 'Chat · Andi',
    code: 'RutaSur puede entregarlo el viernes 6 (9 a 13 h o 14 a 19 h) o el lunes 9 (9 a 13 h). ¿Cuál te acomoda?',
    lang: 'text',
    chat: 'model',
  },
  {
    title: 'Camila elige',
    body: 'La respuesta llega a Andi, que la convierte en datos estructurados para RutaSur.',
    flows: ['camila>andi'],
    state: 'INPUT_REQUIRED',
    time: '15:03:40',
    event: 'Camila responde',
    eventTone: 'user',
    codeTitle: 'Chat · Camila',
    code: 'El viernes en la tarde, porfa.',
    lang: 'text',
    chat: 'user',
  },
  {
    title: 'SendMessage en la misma tarea',
    body: 'El nuevo mensaje lleva taskId y contextId: así RutaSur sabe que continúa la tarea pausada y no crea una nueva.',
    flows: ['andi>rutasur'],
    state: 'INPUT_REQUIRED',
    time: '15:03:41',
    event: 'SendMessage (continúa)',
    eventTone: 'model',
    codeTitle: 'POST /a2a/jsonrpc · Andi → RutaSur',
    code: j({
      jsonrpc: '2.0',
      id: 'req-4',
      method: 'SendMessage',
      params: {
        message: {
          messageId: 'msg-andi-0002',
          taskId: TASK_ID,
          contextId: CONTEXT_ID,
          role: 'ROLE_USER',
          parts: [{ text: 'Viernes 6 en la tarde.' }, { data: { fecha: '2026-11-06', ventana: '14:00-19:00' } }],
        },
      },
    }),
    lang: 'json',
    hl: ['"taskId"', '"contextId"', '"ventana"'],
  },
  {
    title: 'Vuelve a WORKING',
    body: 'RutaSur acepta el dato y retoma el trabajo: reserva el cupo y actualiza la ruta del viernes.',
    flows: ['rutasur>andi'],
    state: 'WORKING',
    edge: ['INPUT_REQUIRED', 'WORKING'],
    time: '15:03:41',
    event: 'Task → WORKING',
    eventTone: 'tool',
    codeTitle: 'Respuesta · RutaSur → Andi',
    code: j({ jsonrpc: '2.0', id: 'req-4', result: { task: { id: TASK_ID, contextId: CONTEXT_ID, status: { state: 'TASK_STATE_WORKING' } } } }),
    lang: 'json',
    hl: ['TASK_STATE_WORKING'],
  },
  {
    title: 'COMPLETED + artefacto',
    body: 'La tarea termina y el resultado viene como artefacto: un JSON validable (no prosa) con el comprobante. Andi debería validarlo con un esquema antes de usarlo: viene de un sistema que no controla.',
    flows: ['andi>rutasur', 'rutasur>andi'],
    state: 'COMPLETED',
    edge: ['WORKING', 'COMPLETED'],
    time: '15:03:47',
    event: 'GetTask → COMPLETED',
    eventTone: 'tool',
    codeTitle: 'GetTask · respuesta',
    code: j({
      jsonrpc: '2.0',
      id: 'req-5',
      result: {
        id: TASK_ID,
        contextId: CONTEXT_ID,
        status: { state: 'TASK_STATE_COMPLETED', timestamp: '2026-11-01T18:03:47Z' },
        artifacts: [
          {
            artifactId: 'art-01',
            name: 'comprobante-reprogramacion',
            parts: [
              {
                data: {
                  seguimiento: TRACKING,
                  nueva_fecha: '2026-11-06',
                  ventana: '14:00-19:00',
                  codigo: 'RPG-55820',
                  sin_costo: true,
                },
                mediaType: 'application/json',
              },
            ],
          },
        ],
      },
    }),
    lang: 'json',
    hl: ['TASK_STATE_COMPLETED', '"artifacts"', '"codigo"'],
  },
  {
    title: 'Andi cierra con Camila',
    body: 'Fin de la delegación. Camila nunca supo que hubo dos agentes y siete mensajes A2A; Andi nunca vio cómo RutaSur eligió el cupo.',
    flows: ['andi>camila'],
    state: 'COMPLETED',
    time: '15:03:48',
    event: 'Respuesta final',
    eventTone: 'model',
    codeTitle: 'Chat · Andi',
    code: 'Listo: tu pedido 5230 llegará el viernes 6 de noviembre entre 14 y 19 h, sin costo. Comprobante RPG-55820.',
    lang: 'text',
    chat: 'model',
  },
]

/* -------------------------------------------------------------------------- */
/* ¿MCP o A2A?                                                                  */
/* -------------------------------------------------------------------------- */

export const QUIZ: { text: string; answer: 'mcp' | 'a2a'; why: string }[] = [
  {
    text: 'Consultar el stock de un producto en el ERP.',
    answer: 'mcp',
    why: 'Entrada y salida predecibles, respuesta en milisegundos. Es una función: tool MCP.',
  },
  {
    text: 'Pedirle al courier que reprograme una entrega: debe revisar cupos de ruta y quizá preguntar una ventana horaria.',
    answer: 'a2a',
    why: 'El otro lado decide, puede pedir datos (INPUT_REQUIRED) y es de otra empresa: un agente opaco. A2A.',
  },
  {
    text: 'Calcular el costo de despacho a una comuna.',
    answer: 'mcp',
    why: 'Cálculo determinista con parámetros claros. Convertirlo en agente solo agrega latencia y tokens.',
  },
  {
    text: 'Que el agente de Finanzas (otro equipo, otro framework) apruebe una compensación según su política.',
    answer: 'a2a',
    why: 'Finanzas aplica su propio criterio y puede escalar a un humano. Tú delegas el resultado, no el cómo.',
  },
  {
    text: 'Leer la política de devoluciones vigente.',
    answer: 'mcp',
    why: 'Es un dato: un resource o una tool de búsqueda MCP.',
  },
  {
    text: 'Encargar a un partner el retiro de un producto en garantía, que puede tardar días.',
    answer: 'a2a',
    why: 'Tarea larga con estados y avisos (push notifications). Justo para lo que existe la Task de A2A.',
  },
]
