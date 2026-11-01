import { useMemo, useState } from 'react'
import { Lab, Panel, Pill } from '../../components/ui'
import { fmt } from '../../sim/math'
import { Hl, QueryBar } from './parts'
import { hybrid, PRESETS, RRF_K, shortText, type Bm25Hit } from './search'

/* Lab 1: los tres rankings lado a lado para la misma consulta. */
export function CompareLab({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  const r = useMemo(() => hybrid(query), [query])
  const [hover, setHover] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const preset = PRESETS.find((p) => p.q === query)
  const bmMax = r.bm[0]?.score || 1
  const vecMax = Math.max(0.0001, r.vec[0]?.score ?? 1)
  const rrfMax = r.fused[0]?.rrf || 1
  const sel: Bm25Hit | undefined = r.bm.find((h) => h.chunk.id === picked) ?? r.bm[0]

  const rowProps = (id: string) => ({
    onMouseEnter: () => setHover(id),
    onMouseLeave: () => setHover((h) => (h === id ? null : h)),
    'data-hl': hover === id ? 'true' : undefined,
  })

  return (
    <Lab title="Tres rankings para la misma consulta" hint="Prueba los presets; pasa el mouse por un chunk para verlo en las 3 listas">
      <QueryBar query={query} onChange={setQuery} />
      {preset && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          <b style={{ color: 'var(--text-2)' }}>Por qué este ejemplo:</b> {preset.why}.
        </p>
      )}
      <div className="row small" style={{ margin: '10px 0 12px', gap: 6 }}>
        <span className="muted">Términos BM25 (sin stopwords):</span>
        {r.qTerms.length ? r.qTerms.map((t) => <Pill key={t} tone="tool" mono>{t}</Pill>) : <span className="muted">—</span>}
      </div>

      <div className="grid-3">
        <Panel title="BM25 · palabras" tone="tool" right={<span className="small muted">{r.bm.length} con score &gt; 0</span>}>
          {r.bm.length === 0 && (
            <div className="busqueda-hibrida-empty">
              Ningún término de la consulta aparece en la base. BM25 devuelve <b>cero resultados</b>.
            </div>
          )}
          <ol className="busqueda-hibrida-list">
            {r.bm.map((h, i) => (
              <li key={h.chunk.id} {...rowProps(h.chunk.id)} data-pick={sel?.chunk.id === h.chunk.id ? 'true' : undefined}>
                <button className="busqueda-hibrida-item" onClick={() => setPicked(h.chunk.id)} title="Ver desglose por término">
                  <span className="busqueda-hibrida-rank">{i + 1}</span>
                  <span className="busqueda-hibrida-body">
                    <span className="busqueda-hibrida-id">{h.chunk.id}</span>
                    <span className="busqueda-hibrida-bar" data-tone="tool">
                      <span style={{ width: `${(h.score / bmMax) * 100}%` }} />
                    </span>
                  </span>
                  <span className="busqueda-hibrida-score">{fmt(h.score, 2)}</span>
                </button>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Vector · coseno" tone="data" right={<span className="small muted">siempre devuelve algo</span>}>
          <ol className="busqueda-hibrida-list">
            {r.vec.map((h, i) => (
              <li key={h.chunk.id} {...rowProps(h.chunk.id)}>
                <div className="busqueda-hibrida-item">
                  <span className="busqueda-hibrida-rank">{i + 1}</span>
                  <span className="busqueda-hibrida-body">
                    <span className="busqueda-hibrida-id">{h.chunk.id}</span>
                    <span className="busqueda-hibrida-bar" data-tone="data">
                      <span style={{ width: `${(Math.max(0, h.score) / vecMax) * 100}%` }} />
                    </span>
                  </span>
                  <span className="busqueda-hibrida-score">{h.score.toFixed(3)}</span>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={`Híbrida · RRF k=${RRF_K}`} tone="accent" right={<span className="small muted">top 8</span>}>
          <ol className="busqueda-hibrida-list">
            {r.fused.slice(0, 8).map((h, i) => (
              <li key={h.chunk.id} {...rowProps(h.chunk.id)}>
                <div className="busqueda-hibrida-item">
                  <span className="busqueda-hibrida-rank">{i + 1}</span>
                  <span className="busqueda-hibrida-body">
                    <span className="busqueda-hibrida-id">
                      {h.chunk.id}{' '}
                      <span className="busqueda-hibrida-src">
                        {h.bmRank && <span data-tone="tool">B{h.bmRank}</span>}
                        {h.vecRank && <span data-tone="data">V{h.vecRank}</span>}
                      </span>
                    </span>
                    <span className="busqueda-hibrida-bar" data-tone="accent">
                      <span style={{ width: `${(h.rrf / rrfMax) * 100}%` }} />
                    </span>
                  </span>
                  <span className="busqueda-hibrida-score">{h.rrf.toFixed(4)}</span>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {(hover || sel) && (
        <div className="busqueda-hibrida-preview anim-fade" key={hover ?? sel?.chunk.id}>
          <span className="label">{hover ?? sel?.chunk.id}</span>{' '}
          <Hl text={(r.bmAll.find((h) => h.chunk.id === (hover ?? sel?.chunk.id))?.chunk.text) ?? ''} terms={r.qTerms} />
        </div>
      )}

      {sel && (
        <div style={{ marginTop: 14 }}>
          <div className="label" style={{ marginBottom: 6 }}>
            Desglose BM25 de {sel.chunk.id} · {sel.len} términos (promedio {fmt(r.bmAll.reduce((s, h) => s + h.len, 0) / r.bmAll.length, 1)})
          </div>
          <div className="table-wrap" style={{ margin: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>término</th>
                  <th style={{ textAlign: 'right' }}>tf</th>
                  <th style={{ textAlign: 'right' }}>df</th>
                  <th style={{ textAlign: 'right' }}>idf</th>
                  <th style={{ textAlign: 'right' }}>tf norm.</th>
                  <th style={{ textAlign: 'right' }}>aporte</th>
                </tr>
              </thead>
              <tbody>
                {sel.parts.map((p) => (
                  <tr key={p.term} className={p.score > 0 ? 'is-hl' : undefined}>
                    <td className="mono">{p.term}</td>
                    <td className="num">{p.tf}</td>
                    <td className="num">{p.df}</td>
                    <td className="num">{p.idf.toFixed(2)}</td>
                    <td className="num">{p.tfNorm.toFixed(2)}</td>
                    <td className="num" style={{ color: p.score > 0 ? 'var(--c-tool)' : undefined, fontWeight: 600 }}>
                      {p.score.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right' }}>
                    total = Σ idf · tf norm.
                  </td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {sel.score.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            {shortText(sel.chunk.text, 140)} — haz clic en otra fila de BM25 para ver su desglose.
          </p>
        </div>
      )}
    </Lab>
  )
}
