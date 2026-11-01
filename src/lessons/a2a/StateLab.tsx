import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Callout, Lab, Pill } from '../../components/ui'
import { STATE_INFO, TERMINAL, type TaskState } from './data'
import { StateMachine, STATE_TONE } from './StateMachine'

type Ev = { id: string; label: string; who: 'remoto' | 'cliente'; from: TaskState[]; to: TaskState; wire: string }

const EVENTS: Ev[] = [
  { id: 'start', label: 'Empieza a trabajar', who: 'remoto', from: ['SUBMITTED'], to: 'WORKING', wire: 'statusUpdate → WORKING' },
  { id: 'input', label: 'Le falta un dato', who: 'remoto', from: ['WORKING'], to: 'INPUT_REQUIRED', wire: 'status.message con la pregunta' },
  { id: 'auth', label: 'Necesita otra credencial', who: 'remoto', from: ['WORKING'], to: 'AUTH_REQUIRED', wire: 'statusUpdate → AUTH_REQUIRED' },
  { id: 'reply', label: 'Envía el dato', who: 'cliente', from: ['INPUT_REQUIRED'], to: 'WORKING', wire: 'SendMessage con taskId' },
  { id: 'login', label: 'Se autentica', who: 'cliente', from: ['AUTH_REQUIRED'], to: 'WORKING', wire: 'nueva credencial + SendMessage' },
  { id: 'done', label: 'Termina con éxito', who: 'remoto', from: ['WORKING'], to: 'COMPLETED', wire: 'artifacts + COMPLETED' },
  { id: 'fail', label: 'Falla un sistema', who: 'remoto', from: ['WORKING'], to: 'FAILED', wire: 'statusUpdate → FAILED' },
  { id: 'reject', label: 'Decide no hacerla', who: 'remoto', from: ['SUBMITTED', 'WORKING'], to: 'REJECTED', wire: 'statusUpdate → REJECTED' },
  { id: 'cancel', label: 'Cancela la tarea', who: 'cliente', from: ['SUBMITTED', 'WORKING', 'INPUT_REQUIRED', 'AUTH_REQUIRED'], to: 'CANCELED', wire: 'CancelTask' },
]

const TERMINAL_TIP: Partial<Record<TaskState, string>> = {
  COMPLETED: 'Lee los artefactos y valídalos con un esquema antes de actuar: vienen de un agente que no controlas.',
  FAILED: 'Distingue un fallo transitorio (reintentar más tarde) de uno permanente (escalar a un humano). No reintentes en bucle.',
  CANCELED: 'Úsalo cuando el usuario se arrepiente o vence tu presupuesto de tiempo. El remoto libera lo que tenía reservado.',
  REJECTED: 'No es un error del protocolo: el remoto aplicó su política. Explícale al usuario por qué y ofrece otra vía.',
}

export function StateLab() {
  const [state, setState] = useState<TaskState>('SUBMITTED')
  const [history, setHistory] = useState<{ ev: Ev; from: TaskState }[]>([])
  const terminal = TERMINAL.includes(state)
  const last = history[history.length - 1]
  const visited = Array.from(new Set<TaskState>(['SUBMITTED', ...history.map((h) => h.ev.to)]))

  const fire = (ev: Ev) => {
    if (!ev.from.includes(state)) return
    setHistory((h) => [...h, { ev, from: state }])
    setState(ev.to)
  }
  const reset = () => {
    setState('SUBMITTED')
    setHistory([])
  }

  return (
    <Lab title="Máquina de estados de una Task" hint="Dispara eventos; los ilegales se desactivan">
      <div className="a2a-statelab">
        <div>
          <div className="a2a-sm-head">
            <span className="label">Estado actual</span>
            <Pill tone={STATE_TONE[state]} mono>
              TASK_STATE_{state}
            </Pill>
            <span className="small muted mono">v0.3: {STATE_INFO[state].v03}</span>
          </div>
          <StateMachine current={state} lastEdge={last ? [last.from, last.ev.to] : null} visited={visited} />
          <div className="small" style={{ color: 'var(--text-2)', marginTop: 6 }}>
            {STATE_INFO[state].desc}
          </div>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {(['remoto', 'cliente'] as const).map((who) => (
            <div key={who}>
              <div className="label" style={{ marginBottom: 6 }}>
                {who === 'remoto' ? 'Lo decide el agente remoto' : 'Lo hace el cliente'}
              </div>
              <div className="a2a-evs">
                {EVENTS.filter((e) => e.who === who).map((e) => {
                  const ok = e.from.includes(state)
                  return (
                    <button
                      key={e.id}
                      className="a2a-ev"
                      data-tone={STATE_TONE[e.to]}
                      disabled={!ok}
                      onClick={() => fire(e)}
                      title={ok ? `${state} → ${e.to}` : `No se puede desde ${state}`}
                    >
                      <span>{e.label}</span>
                      <span className="mono a2a-ev-to">→ {e.to}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              Historial
            </div>
            <ol className="a2a-hist">
              <li className="mono">SUBMITTED</li>
              {history.map((h, i) => (
                <li key={i}>
                  <span className="mono">{h.ev.to}</span> <span className="muted small">· {h.ev.wire}</span>
                </li>
              ))}
            </ol>
          </div>
          <button className="btn btn-sm" onClick={reset} style={{ alignSelf: 'flex-start' }}>
            <RotateCcw size={14} /> Nueva tarea
          </button>
        </div>
      </div>
      {terminal && (
        <Callout tone={state === 'COMPLETED' ? 'ok' : state === 'CANCELED' ? 'info' : 'danger'} title={`${state}: estado terminal`}>
          {TERMINAL_TIP[state]} Una tarea terminal no se reabre: si hay que seguir, se envía un mensaje nuevo en el mismo <code>contextId</code>, que crea
          otra tarea.
        </Callout>
      )}
    </Lab>
  )
}
