import { useState } from 'react'
import { Code } from '../../components/Code'
import { Lab, Segmented, type Tone } from '../../components/ui'
import { countTokens } from '../../sim/math'
import { MODEL_ID, SYSTEM_PROMPT, TOOLS } from '../../sim/scenario'

export const QUESTION = '¿Dónde está mi pedido 4821?'

type Seg = { id: string; label: string; tone: Tone; open?: string; close?: string; text: string }

/* Renderizado ILUSTRATIVO: cada proveedor usa su propia plantilla y tokens
   especiales, y no son públicos. Lo importante es la idea: todo termina siendo
   una secuencia de tokens. */
const TOOL_PREAMBLE =
  'Tienes acceso a las siguientes herramientas. Para usar una, emite una llamada con su nombre y argumentos JSON que cumplan su input_schema; luego espera el resultado.'

const toolsText = TOOLS.map((t) => JSON.stringify({ name: t.name, description: t.description, input_schema: t.input_schema })).join('\n')

export const SEGMENTS: Seg[] = [
  { id: 'system', label: 'system', tone: 'system', open: '<|system|>', close: '<|end|>', text: SYSTEM_PROMPT },
  { id: 'tools', label: 'herramientas', tone: 'tool', open: '<tools>', close: '</tools>', text: `${TOOL_PREAMBLE}\n${toolsText}` },
  { id: 'user', label: 'usuario', tone: 'user', open: '<|user|>', close: '<|end|>', text: QUESTION },
  { id: 'assistant', label: 'turno del asistente', tone: 'model', open: '<|assistant|>', text: '' },
]

const REQUEST = {
  model: MODEL_ID,
  max_tokens: 1024,
  system: SYSTEM_PROMPT,
  tools: TOOLS,
  tool_choice: { type: 'auto' },
  messages: [{ role: 'user', content: QUESTION }],
}

export function PromptLab() {
  const [view, setView] = useState<'api' | 'model'>('model')
  const [focus, setFocus] = useState<string | null>('tools')
  const counts = SEGMENTS.map((s) => countTokens(s.text) + (s.open ? 2 : 0))
  const total = counts.reduce((a, b) => a + b, 0)
  return (
    <Lab title="Lo que envías vs. lo que ve el modelo" hint="Cambia la vista y toca un segmento">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Segmented
          options={[
            { value: 'api', label: 'Lo que envías (JSON)' },
            { value: 'model', label: 'Lo que ve el modelo' },
          ]}
          value={view}
          onChange={setView}
        />
        {view === 'model' && <span className="small muted">plantilla ilustrativa · ~{total} tokens</span>}
      </div>
      {view === 'api' ? (
        <div style={{ marginTop: 12 }}>
          <Code code={JSON.stringify(REQUEST, null, 2)} lang="json" title="POST /v1/messages" maxHeight={420} />
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            Parece una estructura con campos separados: <code>tools</code> por un lado, <code>messages</code> por otro. Cambia a la otra vista para ver en qué se
            convierte.
          </p>
        </div>
      ) : (
        <div className="decision-herramienta-prompt-wrap">
          <div className="decision-herramienta-legend">
            {SEGMENTS.map((s, i) => (
              <button
                key={s.id}
                className={`decision-herramienta-legend-item${focus === s.id ? ' is-on' : ''}`}
                data-tone={s.tone}
                onClick={() => setFocus(focus === s.id ? null : s.id)}
              >
                <span className="dot" />
                {s.label}
                <span className="mono muted">{counts[i]} tok</span>
                <span className="decision-herramienta-legend-bar" style={{ width: `${(counts[i] / total) * 100}%` }} />
              </button>
            ))}
          </div>
          <div className="decision-herramienta-prompt" aria-label="Prompt tal como lo ve el modelo (ilustrativo)">
            {SEGMENTS.map((s) => (
              <div key={s.id} className={`decision-herramienta-seg${focus && focus !== s.id ? ' is-dim' : ''}`} data-tone={s.tone}>
                {s.open && <span className="decision-herramienta-special">{s.open}</span>}
                {s.text && <span className="decision-herramienta-seg-text">{s.text}</span>}
                {s.close && <span className="decision-herramienta-special">{s.close}</span>}
                {s.id === 'assistant' && <span className="caret" />}
              </div>
            ))}
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            Las herramientas son <strong>{Math.round((counts[1] / total) * 100)}%</strong> del prompt. Al final queda abierto el turno del asistente: lo único que hace
            el modelo es predecir qué token viene ahí.
          </p>
        </div>
      )}
    </Lab>
  )
}
