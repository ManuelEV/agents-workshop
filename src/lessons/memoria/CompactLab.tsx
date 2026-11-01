import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { MessageList, msgText, msgTokens, type Msg } from '../../components/Messages'
import { Lab, Segmented, Slider, Stat } from '../../components/ui'
import { countTokens, fmtInt, pct } from '../../sim/math'
import { BASE_SYSTEM, KEY_FACTS, LONG_CONVO, type LongMsg } from './data'

type Strategy = 'recortar' | 'limpiar' | 'resumir'
type Status = 'keep' | 'drop' | 'cleared' | 'summary'

const SYS: Msg = { role: 'system', content: BASE_SYSTEM }
const CLEARED = '[resultado antiguo omitido]'

const isToolResult = (m: LongMsg) => typeof m.content !== 'string' && m.content[0]?.type === 'tool_result'
const clearMsg = (m: LongMsg): LongMsg =>
  isToolResult(m) && typeof m.content !== 'string' && m.content[0].type === 'tool_result'
    ? { ...m, content: [{ ...m.content[0], content: CLEARED }] }
    : m

function summaryText(facts: string[]) {
  return `Resumen de la conversación anterior:\n${facts.map((f) => `- ${f}`).join('\n')}`
}

/** Aplica una estrategia y devuelve el estado de cada mensaje y el contexto final. */
function compact(budget: number, strategy: Strategy) {
  const msgs = LONG_CONVO
  const n = msgs.length
  const sysTok = msgTokens(SYS)
  const status: Status[] = msgs.map(() => 'keep')
  let working = msgs.map((m) => m)

  if (strategy === 'limpiar') {
    // limpia todos los tool_result salvo el más reciente
    const lastTool = msgs.map((m, i) => (isToolResult(m) ? i : -1)).filter((i) => i >= 0).pop() ?? -1
    working = msgs.map((m, i) => (isToolResult(m) && i !== lastTool ? clearMsg(m) : m))
    working.forEach((m, i) => {
      if (m !== msgs[i]) status[i] = 'cleared'
    })
  }

  const toks = working.map((m) => msgTokens(m))
  const total = (from: number, summary: string | null) =>
    sysTok + (summary ? countTokens(summary) + 4 : 0) + toks.slice(from).reduce((s, t) => s + t, 0)

  // `from` = primer mensaje que se conserva literal
  let from = 0
  let facts: string[] = []
  let summary: string | null = null
  const factsBefore = (i: number) => msgs.slice(0, i).flatMap((m) => m.facts ?? [])

  const fits = (f: number) => {
    const s = strategy === 'resumir' && f > 0 ? summaryText(factsBefore(f)) : null
    return total(f, s) <= budget
  }
  while (from < n - 1 && !fits(from)) from++
  // no empezar con un tool_result huérfano (su tool_use quedaría fuera)
  while (from < n - 1 && isToolResult(msgs[from])) from++

  if (strategy === 'resumir' && from > 0) {
    facts = factsBefore(from)
    // si ni así cabe, se recortan hechos (el resumen también tiene presupuesto)
    while (facts.length > 1 && total(from, summaryText(facts)) > budget) facts = facts.slice(1)
    summary = summaryText(facts)
  }
  for (let i = 0; i < from; i++) status[i] = strategy === 'resumir' ? 'summary' : 'drop'

  const context: Msg[] = [SYS]
  if (summary) context.push({ role: 'user', content: summary, note: 'resumen (compactación)' })
  context.push(...working.slice(from))
  const after = context.reduce((s, m) => s + msgTokens(m), 0)
  const before = sysTok + msgs.reduce((s, m) => s + msgTokens(m), 0)
  const blob = context.map(msgText).join(' ')
  return { status, context, before, after, from, summaryFacts: facts, survives: KEY_FACTS.map((f) => blob.includes(f.needle)), toks }
}

export function CompactLab() {
  const full = useMemo(() => msgTokens(SYS) + LONG_CONVO.reduce((s, m) => s + msgTokens(m), 0), [])
  const [budget, setBudget] = useState(Math.round(full * 0.55))
  const [strategy, setStrategy] = useState<Strategy>('resumir')
  const r = useMemo(() => compact(budget, strategy), [budget, strategy])
  const maxTok = Math.max(...r.toks, ...LONG_CONVO.map((m) => msgTokens(m)))

  const LABEL: Record<Status, string> = { keep: 'literal', drop: 'descartado', cleared: 'limpiado', summary: 'al resumen' }

  return (
    <Lab title="Compactar una conversación larga" hint="Baja el presupuesto y cambia de estrategia">
      <div className="row" style={{ gap: 18, marginBottom: 12 }}>
        <Slider
          label="Presupuesto de contexto"
          value={budget}
          min={180}
          max={full + 40}
          step={10}
          onChange={setBudget}
          format={(v) => `${fmtInt(v)} tok`}
          style={{ flex: '1 1 260px' }}
        />
        <Segmented
          options={[
            { value: 'recortar', label: 'Recortar' },
            { value: 'limpiar', label: 'Limpiar tool_results' },
            { value: 'resumir', label: 'Resumir antiguos' },
          ]}
          value={strategy}
          onChange={setStrategy}
        />
      </div>

      <div className="split">
        <div>
          <div className="label" style={{ marginBottom: 6 }}>
            Historial original · {LONG_CONVO.length} mensajes · {fmtInt(full)} tok
          </div>
          <div className="memoria-strip">
            {LONG_CONVO.map((m, i) => {
              const st = r.status[i]
              const kind = isToolResult(m) ? 'tool_result' : typeof m.content === 'string' ? m.role : 'tool_use'
              return (
                <div key={i} className="memoria-strip-row" data-status={st} title={msgText(m).slice(0, 160)}>
                  <span className="memoria-strip-i mono">{i + 1}</span>
                  <span className="memoria-strip-kind mono" data-tone={kind === 'user' ? 'user' : kind === 'assistant' ? 'model' : 'tool'}>
                    {kind}
                  </span>
                  <span className="memoria-strip-bar">
                    <span style={{ width: `${(msgTokens(m) / maxTok) * 100}%` }} />
                  </span>
                  <span className="memoria-strip-st">{LABEL[st]}</span>
                </div>
              )
            })}
          </div>
          <div className="row" style={{ marginTop: 12, alignItems: 'stretch' }}>
            <Stat label="Antes" value={fmtInt(r.before)} sub="tokens" />
            <Stat label="Después" value={fmtInt(r.after)} tone={r.after <= budget ? 'ok' : 'error'} sub={`${pct(1 - r.after / r.before, 0)} menos`} />
          </div>
          <div className="memoria-facts">
            <div className="label">¿Qué sobrevive?</div>
            {KEY_FACTS.map((f, i) => (
              <div key={f.label} className="memoria-fact" data-ok={r.survives[i] ? 'true' : 'false'}>
                {r.survives[i] ? <Check size={14} /> : <X size={14} />} {f.label}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>
            Lo que recibe el modelo · {fmtInt(r.after)} tok
          </div>
          <MessageList messages={r.context} highlight={r.context[1]?.note ? [1] : []} showTokens maxHeight={520} />
        </div>
      </div>
    </Lab>
  )
}
