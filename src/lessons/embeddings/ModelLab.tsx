import { useState } from 'react'
import { BarRow, Callout, Lab, Panel, Segmented, VectorStrip } from '../../components/ui'
import { DIM_LABELS, embed } from '../../sim/embed'
import { cosine } from '../../sim/math'
import { KB_INDEX, SAMPLE_QUERIES } from '../../sim/corpus'
import { embedOtherModel } from './data'

type Mode = 'same' | 'other'
const QUERIES = SAMPLE_QUERIES.slice(0, 5)

export function ModelLab() {
  const [mode, setMode] = useState<Mode>('same')
  const [qi, setQi] = useState(0)
  const query = QUERIES[qi]
  const vA = embed(query)
  const vB = embedOtherModel(query)
  const qv = mode === 'same' ? vA : vB
  const ranked = KB_INDEX.map((c) => ({ c, score: cosine(qv, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return (
    <Lab title="¿Qué pasa si mezclas modelos?" hint="Cambia el modelo con que se embebe la consulta">
      <div className="stack">
        <div className="row">
          <select className="select" style={{ maxWidth: 420 }} value={qi} onChange={(e) => setQi(Number(e.target.value))} aria-label="Consulta">
            {QUERIES.map((q, i) => (
              <option key={q} value={i}>
                {q}
              </option>
            ))}
          </select>
          <Segmented
            options={[
              { value: 'same', label: 'Consulta con el modelo A' },
              { value: 'other', label: 'Consulta con el modelo B' },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>
        <div className="grid-2">
          <Panel title="Misma frase, dos modelos" tone="user">
            <div className="stack" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="label" style={{ width: 70 }}>
                  modelo A
                </span>
                <VectorStrip values={vA} labels={DIM_LABELS} size="sm" />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="label" style={{ width: 70 }}>
                  modelo B
                </span>
                <VectorStrip values={vB} size="sm" />
              </div>
              <div className="small muted">
                El modelo B también “entiende” la frase, pero ordena el significado en otros ejes. Coseno entre ambas versiones: <b className="mono">{cosine(vA, vB).toFixed(2)}</b>.
              </div>
            </div>
          </Panel>
          <Panel title="Top 3 en la base (indexada con el modelo A)" tone="data">
            <div className="stack" style={{ gap: 8 }}>
              {ranked.map((r, i) => (
                <div key={r.c.id}>
                  <div className="small">
                    <span className="mono muted">{r.c.id}</span> {r.c.text.slice(0, 90)}…
                  </div>
                  <BarRow label={`#${i + 1}`} value={Math.max(0, r.score)} display={r.score.toFixed(3)} tone={mode === 'same' ? 'data' : 'error'} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
        {mode === 'other' ? (
          <Callout tone="danger" title="Resultados sin sentido">
            Los documentos se indexaron con el modelo A y la consulta con el B: estás comparando coordenadas de dos mapas distintos. No da error, simplemente devuelve basura.
          </Callout>
        ) : (
          <Callout tone="ok">Documentos y consulta usan el mismo modelo: los resultados tienen sentido.</Callout>
        )}
      </div>
    </Lab>
  )
}
