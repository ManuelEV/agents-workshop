import { useState } from 'react'
import { Lab, Segmented } from '../../components/ui'
import { Json } from '../../components/Code'
import { KB_DOCS, KB_INDEX } from '../../sim/corpus'
import { embed } from '../../sim/embed'
import { cosine } from '../../sim/math'

const QUERIES = ['¿En cuántos días me devuelven la plata?', '¿Puedo pagar en cuotas?', 'Me llegó un producto roto', '¿Cuánto demora el despacho a regiones?']
const DATES = [
  { value: 'all', label: 'Todas' },
  { value: '2026-08-01', label: 'desde ago-2026' },
  { value: '2026-09-01', label: 'desde sep-2026' },
] as const
type DateF = (typeof DATES)[number]['value']

export function FilterLab() {
  const [qi, setQi] = useState(0)
  const [docs, setDocs] = useState<string[]>(KB_DOCS.map((d) => d.id))
  const [since, setSince] = useState<DateF>('all')
  const qv = embed(QUERIES[qi])

  const pass = (c: (typeof KB_INDEX)[number]) => docs.includes(c.docId) && (since === 'all' || c.updated >= since)
  const rows = KB_INDEX.map((c) => ({ c, score: cosine(qv, c.vector), ok: pass(c) }))
  const top = rows
    .filter((r) => r.ok)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  const topIds = new Set(top.map((t) => t.c.id))
  const shown = [...rows].sort((a, b) => Number(b.ok) - Number(a.ok) || b.score - a.score)

  const filter: Record<string, unknown> = {}
  if (docs.length < KB_DOCS.length) filter.doc = { $in: docs }
  if (since !== 'all') filter.actualizado = { $gte: since }

  const toggle = (id: string) => setDocs((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))

  return (
    <Lab title="Filtros por metadata" hint="Activa o desactiva documentos y fechas">
      <div className="stack">
        <div className="row">
          <select className="select" style={{ maxWidth: 380 }} value={qi} onChange={(e) => setQi(Number(e.target.value))} aria-label="Consulta">
            {QUERIES.map((q, i) => (
              <option key={q} value={i}>
                {q}
              </option>
            ))}
          </select>
          <Segmented options={DATES.map((d) => ({ value: d.value, label: d.label }))} value={since} onChange={setSince} />
        </div>
        <div className="indexacion-filters" role="group" aria-label="Filtrar por documento">
          {KB_DOCS.map((d) => (
            <button key={d.id} className={`indexacion-toggle${docs.includes(d.id) ? ' is-on' : ''}`} onClick={() => toggle(d.id)} aria-pressed={docs.includes(d.id)}>
              doc: {d.id} · {d.updated}
            </button>
          ))}
        </div>
        <div className="split">
          <div className="table-wrap" style={{ margin: 0, maxHeight: 360, overflowY: 'auto' }}>
            <table className="tbl indexacion-tbl">
              <thead>
                <tr>
                  <th>id</th>
                  <th>actualizado</th>
                  <th style={{ textAlign: 'right' }}>coseno</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ c, score, ok }) => (
                  <tr key={c.id} className={topIds.has(c.id) ? 'is-hl' : ok ? '' : 'is-off'} title={c.text}>
                    <td className="mono">
                      {topIds.has(c.id) ? '★ ' : ''}
                      {c.id}
                    </td>
                    <td className="mono">{c.updated}</td>
                    <td className="num">{ok ? score.toFixed(3) : 'filtrado'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="stack">
            <Json title="filtro enviado junto a la consulta" value={{ top_k: 3, filter }} />
            <div className="small muted">
              {rows.filter((r) => r.ok).length} de {rows.length} chunks pasan el filtro. Solo esos compiten por el top 3 (★). Así evitas, por ejemplo, responder con una política
              vieja o de otra categoría.
            </div>
          </div>
        </div>
      </div>
    </Lab>
  )
}
