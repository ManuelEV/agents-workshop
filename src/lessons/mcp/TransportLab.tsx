import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { Lab, Pill, Segmented, toneVar, type Tone } from '../../components/ui'
import { Code } from '../../components/Code'
import { ORDER_DATA, type Spec } from './data'

type Transport = 'stdio' | 'http'
type RespMode = 'json' | 'sse'
type Phase = 'idle' | 'req' | 'work' | 'progress' | 'res' | 'done'

const PHASE_MS: Record<Phase, number> = { idle: 0, req: 1300, work: 800, progress: 1100, res: 1300, done: 0 }

/** Paquete que recorre `path` una sola vez (SMIL con begin manual para que arranque al montarse). */
function Packet({ path, dur, tone }: { path: string; dur: number; tone: Tone }) {
  return (
    <circle r={6.5} className="mcp-packet" style={{ ['--atone' as string]: toneVar(tone) }}>
      <animateMotion
        ref={(el) => {
          try {
            ;(el as SVGAnimationElement | null)?.beginElement()
          } catch {
            /* sin SMIL */
          }
        }}
        begin="indefinite"
        dur={`${dur}ms`}
        fill="freeze"
        path={path}
      />
    </circle>
  )
}

function StdioScene({ phase, runKey }: { phase: Phase; runKey: number }) {
  const reqPath = 'M330,96 L570,96'
  const resPath = 'M570,160 L330,160'
  const on = (p: Phase[]) => p.includes(phase)
  return (
    <svg className="mcp-wire-svg" viewBox="0 0 900 270" role="img" aria-label="Transporte stdio: proceso host y subproceso servidor conectados por stdin y stdout">
      <g className={`mcp-proc${on(['req', 'res', 'progress']) ? ' is-on' : ''}`} data-tone="system">
        <rect x={30} y={36} width={300} height={190} rx={14} className="mcp-proc-box" />
        <text x={50} y={64} className="mcp-proc-title">
          Proceso host
        </text>
        <text x={50} y={82} className="mcp-proc-sub">
          andes-soporte-host · PID 4120
        </text>
        <rect x={150} y={118} width={160} height={58} rx={10} className="mcp-proc-inner" data-tone="accent" />
        <text x={230} y={152} textAnchor="middle" className="mcp-proc-inner-t">
          Cliente MCP
        </text>
      </g>
      <g className={`mcp-proc${on(['work']) ? ' is-on' : ''}`} data-tone="tool">
        <rect x={570} y={36} width={300} height={190} rx={14} className="mcp-proc-box" />
        <text x={590} y={64} className="mcp-proc-title">
          Subproceso (hijo)
        </text>
        <text x={590} y={82} className="mcp-proc-sub">
          python server.py · PID 4121
        </text>
        <rect x={590} y={118} width={160} height={58} rx={10} className="mcp-proc-inner" data-tone="tool" />
        <text x={670} y={152} textAnchor="middle" className="mcp-proc-inner-t">
          MCPServer
        </text>
        {phase === 'work' && (
          <text x={790} y={152} textAnchor="middle" className="mcp-working">
            ejecutando…
          </text>
        )}
      </g>
      <g className={`mcp-pipe${on(['req']) ? ' is-on' : ''}`} style={{ ['--atone' as string]: toneVar('accent') }}>
        <path d={reqPath} />
        <text x={450} y={86} textAnchor="middle">
          stdin →
        </text>
      </g>
      <g className={`mcp-pipe${on(['res', 'progress']) ? ' is-on' : ''}`} style={{ ['--atone' as string]: toneVar('tool') }}>
        <path d={resPath} />
        <text x={450} y={182} textAnchor="middle">
          ← stdout
        </text>
      </g>
      <g className="mcp-pipe is-dashed">
        <path d="M720,226 L720,256" />
        <text x={730} y={252}>
          stderr → logs (nunca por stdout)
        </text>
      </g>
      {phase === 'req' && <Packet key={`r${runKey}`} path={reqPath} dur={PHASE_MS.req} tone="accent" />}
      {(phase === 'res' || phase === 'progress') && <Packet key={`s${runKey}${phase}`} path={resPath} dur={PHASE_MS[phase]} tone="tool" />}
    </svg>
  )
}

const REPLICA_Y = [40, 110, 180]

function HttpScene({ phase, runKey, spec, replica }: { phase: Phase; runKey: number; spec: Spec; replica: number }) {
  const ry = REPLICA_Y[replica] + 25
  const reqPath = `M230,135 L610,135 L680,${ry}`
  const resPath = `M680,${ry} L610,135 L500,135 L230,135`
  const on = (p: Phase[]) => p.includes(phase)
  const stateful = spec === '2025-11-25'
  return (
    <svg className="mcp-wire-svg" viewBox="0 0 900 270" role="img" aria-label="Transporte Streamable HTTP: host, red, balanceador y réplicas del servidor">
      <g className={`mcp-proc${on(['req', 'res', 'progress']) ? ' is-on' : ''}`} data-tone="system">
        <rect x={30} y={80} width={200} height={110} rx={14} className="mcp-proc-box" />
        <text x={48} y={108} className="mcp-proc-title">
          Host
        </text>
        <text x={48} y={126} className="mcp-proc-sub">
          Cliente MCP B
        </text>
        <text x={48} y={170} className="mcp-proc-sub">
          POST /mcp
        </text>
      </g>
      <g className="mcp-cloud">
        <rect x={290} y={105} width={160} height={60} rx={30} />
        <text x={370} y={140} textAnchor="middle">
          Internet · TLS
        </text>
      </g>
      <g className="mcp-proc" data-tone="system">
        <rect x={500} y={105} width={110} height={60} rx={10} className="mcp-proc-box" />
        <text x={555} y={133} textAnchor="middle" className="mcp-proc-title" style={{ fontSize: 13 }}>
          Gateway / LB
        </text>
        <text x={555} y={150} textAnchor="middle" className="mcp-proc-sub">
          {stateful ? 'afinidad de sesión' : 'lee Mcp-Method'}
        </text>
      </g>
      {REPLICA_Y.map((y, i) => (
        <g key={i} className={`mcp-proc${phase === 'work' && i === replica ? ' is-on' : ''}${i === replica ? ' is-target' : ''}`} data-tone="tool">
          <path className="mcp-lb-link" d={`M610,135 L680,${y + 25}`} />
          <rect x={680} y={y} width={190} height={50} rx={10} className="mcp-proc-box" />
          <text x={696} y={y + 22} className="mcp-proc-title" style={{ fontSize: 13 }}>
            andes-pedidos · réplica {i + 1}
          </text>
          <text x={696} y={y + 39} className="mcp-proc-sub">
            {stateful && i === 1 ? 'sesión 9f1c… vive aquí' : stateful ? 'no conoce la sesión' : 'sin estado'}
          </text>
        </g>
      ))}
      <g className={`mcp-pipe${on(['req', 'res', 'progress']) ? ' is-on' : ''}`} style={{ ['--atone' as string]: toneVar(phase === 'req' ? 'accent' : 'tool') }}>
        <path d="M230,135 L290,135 M450,135 L500,135" />
      </g>
      {phase === 'req' && <Packet key={`r${runKey}`} path={reqPath} dur={PHASE_MS.req} tone="accent" />}
      {(phase === 'res' || phase === 'progress') && <Packet key={`s${runKey}${phase}`} path={resPath} dur={PHASE_MS[phase]} tone="tool" />}
    </svg>
  )
}

function wire(transport: Transport, spec: Spec, mode: RespMode) {
  const sse = transport === 'http' && mode === 'sse'
  const params: Record<string, unknown> = { name: 'buscar_pedido', arguments: { pedido_id: '4821' } }
  if (sse) params._meta = { progressToken: 'p-3' }
  const req = JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params })
  const result = JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    result: { content: [{ type: 'text', text: JSON.stringify(ORDER_DATA) }], isError: false },
  })
  const progress = JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/progress',
    params: { progressToken: 'p-3', progress: 1, total: 2, message: 'Consultando al courier…' },
  })
  if (transport === 'stdio') {
    return {
      request: ['# el host escribe en el stdin del subproceso (una línea = un mensaje)', `${req}⏎`],
      progress: [] as string[],
      response: ['# el servidor escribe en su stdout', `${result}⏎`],
    }
  }
  const headers =
    spec === '2025-11-25'
      ? ['MCP-Protocol-Version: 2025-11-25', 'Mcp-Session-Id: 9f1c2a7e-4b0d-4e61-9d2a-5c3f8e1a0b77']
      : ['Mcp-Method: tools/call', 'Mcp-Name: buscar_pedido']
  return {
    request: [
      'POST /mcp HTTP/1.1',
      'Host: mcp.andesmarket.cl',
      'Authorization: Bearer eyJhbGciOiJSUzI1NiIs…',
      'Content-Type: application/json',
      'Accept: application/json, text/event-stream',
      ...headers,
      '',
      req,
    ],
    progress: sse ? ['HTTP/1.1 200 OK', 'Content-Type: text/event-stream', '', 'event: message', `data: ${progress}`, ''] : [],
    response: sse ? ['event: message', `data: ${result}`] : ['HTTP/1.1 200 OK', 'Content-Type: application/json', '', result],
  }
}

export function TransportLab() {
  const [transport, setTransport] = useState<Transport>('stdio')
  const [spec, setSpec] = useState<Spec>('2025-11-25')
  const [mode, setMode] = useState<RespMode>('json')
  const [phase, setPhase] = useState<Phase>('idle')
  const [runKey, setRunKey] = useState(0)
  const [replica, setReplica] = useState(1)

  const order: Phase[] = transport === 'http' && mode === 'sse' ? ['req', 'work', 'progress', 'res', 'done'] : ['req', 'work', 'res', 'done']

  useEffect(() => {
    if (phase === 'idle' || phase === 'done') return
    const i = order.indexOf(phase)
    const t = setTimeout(() => setPhase(order[i + 1] ?? 'done'), PHASE_MS[phase])
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, runKey])

  const send = () => {
    setRunKey((k) => k + 1)
    if (transport === 'http') setReplica(spec === '2025-11-25' ? 1 : (runKey + 2) % 3)
    setPhase('req')
  }
  const resetTo = () => setPhase('idle')

  const w = wire(transport, spec, mode)
  const reached = (p: Phase) => phase !== 'idle' && order.indexOf(phase) >= order.indexOf(p)
  const lines: string[] = []
  const hl: number[] = []
  const push = (ls: string[], mark: boolean) => {
    ls.forEach((l) => {
      lines.push(l)
      if (mark) hl.push(lines.length)
    })
  }
  if (transport === 'http') {
    push(['# → request'], false)
    push(w.request, phase === 'req')
    if (w.progress.length && reached('progress')) {
      push(['', '# ← response (stream SSE abierto)'], false)
      push(w.progress, phase === 'progress')
    }
    if (reached('res')) {
      if (!w.progress.length) push(['', '# ← response'], false)
      push(w.response, phase === 'res')
    }
  } else {
    push(w.request, phase === 'req')
    if (reached('res')) {
      push([''], false)
      push(w.response, phase === 'res')
    }
  }

  return (
    <Lab
      title="Mismo mensaje, dos transportes"
      hint="Elige transporte y presiona Enviar"
      footer={
        <span className="small muted">
          Headers mínimos e ilustrativos. El JSON-RPC del cuerpo es idéntico en ambos transportes: solo cambia el "sobre".
        </span>
      }
    >
      <div className="row" style={{ marginBottom: 12 }}>
        <Segmented
          options={[
            { value: 'stdio', label: 'stdio (local)' },
            { value: 'http', label: 'Streamable HTTP (remoto)' },
          ]}
          value={transport}
          onChange={(v) => {
            setTransport(v)
            resetTo()
          }}
        />
        {transport === 'http' && (
          <>
            <Segmented
              options={[
                { value: '2025-11-25', label: '2025-11-25' },
                { value: '2026-07-28', label: '2026-07-28' },
              ]}
              value={spec}
              onChange={(v) => {
                setSpec(v)
                resetTo()
              }}
            />
            <Segmented
              options={[
                { value: 'json', label: 'respuesta JSON' },
                { value: 'sse', label: 'stream SSE' },
              ]}
              value={mode}
              onChange={(v) => {
                setMode(v)
                resetTo()
              }}
            />
          </>
        )}
        <button className="btn btn-primary" onClick={send} disabled={phase !== 'idle' && phase !== 'done'}>
          <Send size={15} /> Enviar tools/call
        </button>
      </div>
      <div className="mcp-wire-stage">
        {transport === 'stdio' ? <StdioScene phase={phase} runKey={runKey} /> : <HttpScene phase={phase} runKey={runKey} spec={spec} replica={replica} />}
      </div>
      <div className="row" style={{ gap: 6, margin: '10px 0' }}>
        {order.map((p) => (
          <Pill key={p} tone={phase === p ? 'accent' : reached(p) ? 'ok' : undefined} mono>
            {{ req: 'request', work: 'servidor trabaja', progress: 'evento de progreso', res: 'resultado', done: 'listo', idle: '' }[p]}
          </Pill>
        ))}
      </div>
      <Code
        code={lines.length ? lines.join('\n') : '# presiona "Enviar tools/call" para ver los bytes que viajan'}
        lang={transport === 'http' ? 'http' : 'text'}
        title={transport === 'http' ? 'Lo que viaja por la red' : 'Lo que viaja por los pipes'}
        highlight={hl}
        maxHeight={300}
      />
      <div className="mcp-facts">
        {transport === 'stdio' ? (
          <>
            <p>
              <strong>Framing:</strong> cada mensaje JSON-RPC va en <em>una línea</em> terminada en salto de línea; por eso el JSON no puede tener
              saltos de línea internos. No hay headers ni URL: la "sesión" es el propio proceso hijo.
            </p>
            <p>
              <strong>Credenciales:</strong> las del entorno del usuario (variables, perfil local). El servidor corre con tus permisos: instalar uno es
              ejecutar código.
            </p>
          </>
        ) : spec === '2025-11-25' ? (
          <>
            <p>
              <strong>Sesión:</strong> el servidor entrega <code>Mcp-Session-Id</code> al responder <code>initialize</code> y el cliente lo reenvía en
              cada POST. Si hay varias réplicas, el balanceador necesita afinidad para llegar siempre a la que tiene la sesión.
            </p>
            <p>
              <strong>Respuesta:</strong> según <code>Content-Type</code>, un JSON único o un stream SSE donde pueden llegar notificaciones (progreso)
              antes del resultado.
            </p>
          </>
        ) : (
          <>
            <p>
              <strong>Stateless:</strong> sin <code>Mcp-Session-Id</code>. Cada request lleva su contexto, así que{' '}
              <em>cualquier réplica</em> atiende (envía varias veces y mira cómo cambia).
            </p>
            <p>
              <strong>Headers de enrutamiento:</strong> <code>Mcp-Method</code> y <code>Mcp-Name</code> permiten a un gateway aplicar políticas por
              herramienta sin parsear el cuerpo.
            </p>
          </>
        )}
      </div>
    </Lab>
  )
}
