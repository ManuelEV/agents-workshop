import { useMemo, useState } from 'react'
import { BarRow, Lab, Pill, Segmented } from '../../components/ui'
import { fmt, fmtInt, fmtUsd } from '../../sim/math'
import { PATTERNS, timeline } from './runs'

type Metric = 'llm' | 'tokens' | 'ms' | 'usd'

const METRICS: { value: Metric; label: string }[] = [
  { value: 'llm', label: 'Llamadas LLM' },
  { value: 'tokens', label: 'Tokens' },
  { value: 'ms', label: 'Latencia' },
  { value: 'usd', label: 'Costo' },
]

export function CompareLab() {
  const [metric, setMetric] = useState<Metric>('tokens')
  const rows = useMemo(
    () =>
      PATTERNS.map((p) => {
        const t = timeline(p).total
        return { p, t, v: { llm: t.llm, tokens: t.inTok + t.outTok, ms: t.ms, usd: t.usd } as Record<Metric, number> }
      }),
    [],
  )
  const base = rows.find((r) => r.p.id === 'unico')!
  const max = Math.max(...rows.map((r) => r.v[metric]))
  const show = (m: Metric, v: number) => (m === 'llm' ? `${v}` : m === 'tokens' ? fmtInt(v) : m === 'ms' ? `${fmt(v / 1000, 1)} s` : fmtUsd(v))

  return (
    <Lab title="Comparar patrones sobre la misma tarea" hint="Cambia la métrica">
      <Segmented options={METRICS} value={metric} onChange={setMetric} />
      <div className="stack" style={{ gap: 7, marginTop: 14 }}>
        {[...rows]
          .sort((a, b) => a.v[metric] - b.v[metric])
          .map((r) => (
            <BarRow
              key={r.p.id}
              label={r.p.label.padEnd(15, ' ')}
              value={r.v[metric]}
              max={max}
              display={show(metric, r.v[metric])}
              tone={r.p.id === 'unico' ? 'ok' : r.p.resuelve === 'parcial' ? 'guard' : 'model'}
              pick={r.p.id === 'unico'}
            />
          ))}
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Patrón</th>
              <th style={{ textAlign: 'right' }}>LLM</th>
              <th style={{ textAlign: 'right' }}>Tokens</th>
              <th style={{ textAlign: 'right' }}>× agente único</th>
              <th style={{ textAlign: 'right' }}>Latencia</th>
              <th>Control</th>
              <th>¿Resuelve todo?</th>
              <th>Úsalo cuando…</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.id} className={r.p.id === 'unico' ? 'is-hl' : undefined}>
                <td style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{r.p.label}</td>
                <td className="num">{r.t.llm}</td>
                <td className="num">{fmtInt(r.v.tokens)}</td>
                <td className="num">{fmt(r.v.tokens / base.v.tokens, 1)}×</td>
                <td className="num">{fmt(r.t.ms / 1000, 1)} s</td>
                <td>{r.p.control}</td>
                <td>
                  <Pill tone={r.p.resuelve === 'sí' ? 'ok' : 'guard'}>{r.p.resuelve}</Pill>
                </td>
                <td className="small">{r.p.cuando}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Números de las corridas simuladas de arriba (latencia ≈ 0,32 s + prefill + 40 tok/s de salida; precios de referencia US$ 3 / 15 por millón de tokens). En tareas
        de investigación reales la diferencia es mucho mayor: Anthropic reporta que sus sistemas multi-agente usan del orden de 15× los tokens de un chat.
      </p>
    </Lab>
  )
}
