import { Bot, Cog, User, Wrench } from 'lucide-react'
import { countTokens } from '../sim/math'

/* Visor del arreglo `messages` que se envía a la API de un LLM.
   Usa la forma de la Messages API de Anthropic (bloques text / tool_use /
   tool_result); es la estructura que también siguen, con otros nombres, OpenAI
   (`tool_calls`, rol `tool`) y Gemini (`functionCall` / `functionResponse`). */

export type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown; is_error?: boolean }

export type Msg = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | Block[]
  /** nota pequeña bajo el rol (p. ej. "llamada 2") */
  note?: string
}

const ROLE: Record<Msg['role'], { tone: string; label: string; Icon: typeof User }> = {
  system: { tone: 'system', label: 'system', Icon: Cog },
  user: { tone: 'user', label: 'user', Icon: User },
  assistant: { tone: 'model', label: 'assistant', Icon: Bot },
  tool: { tone: 'tool', label: 'tool', Icon: Wrench },
}

export function msgText(m: Msg): string {
  if (typeof m.content === 'string') return m.content
  return m.content
    .map((b) => (b.type === 'text' ? b.text : b.type === 'tool_use' ? JSON.stringify(b.input) + b.name : JSON.stringify(b.content)))
    .join(' ')
}

export function msgTokens(m: Msg): number {
  return countTokens(msgText(m)) + 4
}

function BlockView({ b }: { b: Block }) {
  if (b.type === 'text') return <div className="msg-text">{b.text}</div>
  if (b.type === 'tool_use')
    return (
      <div className="msg-block" style={{ ['--btone' as string]: 'var(--c-tool)' }}>
        <span className="msg-block-label">
          tool_use · {b.name} <span className="muted">({b.id})</span>
        </span>
        {JSON.stringify(b.input, null, 1).replace(/\n\s*/g, ' ')}
      </div>
    )
  return (
    <div className="msg-block" style={{ ['--btone' as string]: b.is_error ? 'var(--c-error)' : 'var(--c-tool)' }}>
      <span className="msg-block-label">
        tool_result{b.is_error ? ' · error' : ''} <span className="muted">({b.tool_use_id})</span>
      </span>
      {typeof b.content === 'string' ? b.content : JSON.stringify(b.content)}
    </div>
  )
}

/**
 * @param highlight índices de mensajes a destacar
 * @param newFrom   los mensajes con índice >= newFrom entran con animación
 * @param showTokens muestra el conteo estimado de tokens por mensaje
 */
export function MessageList({
  messages,
  highlight = [],
  newFrom,
  showTokens = false,
  maxHeight,
}: {
  messages: Msg[]
  highlight?: number[]
  newFrom?: number
  showTokens?: boolean
  maxHeight?: number
}) {
  return (
    <div className="msgs" style={{ maxHeight, overflowY: maxHeight ? 'auto' : undefined }}>
      {messages.map((m, i) => {
        const r = ROLE[m.role]
        return (
          <div
            key={i}
            className={`msg${newFrom !== undefined && i >= newFrom ? ' is-new' : ''}${highlight.includes(i) ? ' is-hl' : ''}`}
            data-tone={r.tone}
          >
            <div className="msg-role">
              <r.Icon size={12} /> {r.label}
              {m.note && <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-3)' }}>· {m.note}</span>}
              {showTokens && <span className="tok">~{msgTokens(m)} tok</span>}
            </div>
            {typeof m.content === 'string' ? <div className="msg-text">{m.content}</div> : m.content.map((b, j) => <BlockView key={j} b={b} />)}
          </div>
        )
      })}
    </div>
  )
}
