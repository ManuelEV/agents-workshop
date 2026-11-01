import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { BarRow, Callout, Lab, Panel, VectorStrip } from '../../components/ui'
import { VectorMap, type MapLink, type MapPoint } from '../../components/VectorMap'
import { analyze, CONCEPTS, DIM_LABELS, embed, project } from '../../sim/embed'
import { cosine } from '../../sim/math'
import { CORPUS, conceptLabel, toneOf } from './data'

const SUGGESTIONS = ['Me llegó la zapatilla rota, ¿qué hago?', '¿Cuánto demora el reembolso?', 'No me deja entrar a mi cuenta', '¿Va a llover mañana en Santiago?', 'Quiero pagar con transferencia']

export function MapLab() {
  const [text, setText] = useState('Me llegó la zapatilla rota, ¿qué hago?')
  const q = text.trim()

  const result = useMemo(() => {
    if (!q) return null
    const vector = embed(q)
    const xy = project(q)
    const { scores, hits } = analyze(q)
    const ranked = CORPUS.map((p) => ({ p, score: cosine(vector, p.vector) })).sort((a, b) => b.score - a.score)
    return { vector, xy, scores, hits, top: ranked.slice(0, 3) }
  }, [q])

  const topIds = new Set(result?.top.map((t) => t.p.id))
  const points: MapPoint[] = CORPUS.map((p) => ({
    id: p.id,
    x: p.xy[0],
    y: p.xy[1],
    tone: toneOf(p.concept),
    label: p.text.length > 34 ? p.text.slice(0, 32) + '…' : p.text,
    tip: `${p.text} · ${conceptLabel(p.concept)}`,
    hl: topIds.has(p.id),
    dim: !!result && !topIds.has(p.id),
    r: topIds.has(p.id) ? 8 : 6.5,
  }))
  const links: MapLink[] = (result?.top ?? []).map((t) => ({ from: result!.xy, to: t.p.xy, label: t.score.toFixed(2), tone: 'user' }))
  const usedConcepts = [...new Set(CORPUS.map((p) => p.concept))]
  const anyHit = result ? result.scores.some((s) => s > 0) : false

  return (
    <Lab title="Mapa semántico de las consultas de Andes Market" hint="Escribe una frase o haz clic en un punto">
      <div className="stack">
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <Search size={18} color="var(--c-user)" style={{ flexShrink: 0 }} />
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe una consulta de cliente…" aria-label="Frase a ubicar en el mapa" />
        </div>
        <div className="embeddings-chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} className={`embeddings-chip${s === text ? ' is-active' : ''}`} onClick={() => setText(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className="split">
          <div>
            <VectorMap
              points={points}
              query={result ? { x: result.xy[0], y: result.xy[1], label: 'tu frase' } : null}
              links={links}
              onPointClick={(id) => setText(CORPUS.find((p) => p.id === id)?.text ?? '')}
              ariaLabel="Mapa 2D de frases de clientes agrupadas por significado"
            />
            <div className="embeddings-legend">
              {usedConcepts.map((c) => (
                <span key={c} data-tone={toneOf(c)}>
                  <i /> {conceptLabel(c)}
                </span>
              ))}
            </div>
          </div>

          <div className="stack">
            {result ? (
              <>
                <Panel title="Tu frase como vector (16 dims)" tone="user">
                  <VectorStrip values={result.vector} labels={DIM_LABELS} highlight={result.scores.map((s, i) => (s > 0 ? i : -1)).filter((i) => i >= 0)} />
                  <div className="small muted" style={{ marginTop: 6 }}>
                    Naranja = valor positivo, azul = negativo. Pasa el mouse por cada celda para ver su dimensión.
                  </div>
                </Panel>
                <Panel title="Por qué cayó aquí" tone="data">
                  {anyHit ? (
                    <div className="embeddings-hits">
                      {CONCEPTS.map((c, i) =>
                        result.scores[i] > 0 ? (
                          <div key={c.id} className="embeddings-hit" data-tone={toneOf(i)}>
                            <b>{c.label}</b>
                            <span className="muted">←</span>
                            {result.hits[i].map((w) => (
                              <span key={w} className="w">
                                {w}
                              </span>
                            ))}
                            <span className="v">dim {i}: {result.vector[i].toFixed(2)}</span>
                          </div>
                        ) : null,
                      )}
                    </div>
                  ) : (
                    <div className="small muted">
                      Nuestro modelo didáctico no reconoció ninguna palabra, así que la frase cae cerca del centro, sin barrio claro. Un modelo real sí entendería “llover” o
                      “Santiago”, porque aprendió de miles de millones de textos.
                    </div>
                  )}
                </Panel>
                <Panel title="Vecinos más cercanos (coseno)" tone="user">
                  <div className="stack" style={{ gap: 8 }}>
                    {result.top.map((t, i) => (
                      <div key={t.p.id}>
                        <div className="small" style={{ color: 'var(--text)' }}>
                          {t.p.text}
                        </div>
                        <BarRow label={`#${i + 1}`} value={Math.max(0, t.score)} display={t.score.toFixed(3)} tone={toneOf(t.p.concept)} pick={i === 0} />
                      </div>
                    ))}
                  </div>
                </Panel>
              </>
            ) : (
              <Callout tone="info">Escribe algo para ubicarlo en el mapa.</Callout>
            )}
          </div>
        </div>
        <div className="small muted">
          Las líneas unen tu frase con sus 3 vecinos según el coseno calculado en las 16 dimensiones. El mapa es una proyección a 2D, por eso a veces el vecino “real” no es el
          punto que se ve más cerca.
        </div>
      </div>
    </Lab>
  )
}
