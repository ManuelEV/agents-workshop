import { useState } from 'react'
import { Lab, Stat, type Tone } from '../../components/ui'
import { KB_DOCS } from '../../sim/corpus'
import { countTokens, hashString } from '../../sim/math'

const DOC = KB_DOCS.find((d) => d.id === 'envios')!
const ORIGINAL = DOC.paragraphs.join('\n\n')
const hash = (t: string) => hashString(t.trim()).toString(16).padStart(8, '0')
const OLD = DOC.paragraphs.map((p) => ({ text: p, hash: hash(p) }))

const EDITS: { label: string; apply: (ps: string[]) => string[] }[] = [
  { label: 'Original', apply: (ps) => ps },
  { label: 'Envío gratis desde $29.990', apply: (ps) => ps.map((p, i) => (i === 1 ? p.replace('$39.990', '$29.990') : p)) },
  { label: 'Agregar párrafo nuevo', apply: (ps) => [...ps, 'Los pedidos con productos voluminosos, como muebles o bicicletas, se despachan en un plazo especial de 5 a 10 días hábiles.'] },
  { label: 'Quitar retiro en tienda', apply: (ps) => ps.slice(0, 4) },
]

type Status = 'igual' | 'nuevo' | 'eliminado'
const STATUS: Record<Status, { tone: Tone; label: string; action: string }> = {
  igual: { tone: 'system', label: 'sin cambios', action: 'se reutiliza el vector' },
  nuevo: { tone: 'data', label: 'hash nuevo', action: 'embeber + upsert' },
  eliminado: { tone: 'error', label: 'ya no existe', action: 'delete del índice' },
}

export function ReindexLab() {
  const [text, setText] = useState(ORIGINAL)
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const newHashes = new Set(paras.map(hash))
  const oldHashes = new Set(OLD.map((o) => o.hash))

  const rows: { id: string; text: string; hash: string; status: Status }[] = [
    ...paras.map((p, i) => ({ id: `envios#${i + 1}`, text: p, hash: hash(p), status: (oldHashes.has(hash(p)) ? 'igual' : 'nuevo') as Status })),
    ...OLD.filter((o) => !newHashes.has(o.hash)).map((o) => ({ id: 'envios#?', text: o.text, hash: o.hash, status: 'eliminado' as Status })),
  ]
  const toEmbed = rows.filter((r) => r.status === 'nuevo')
  const tokNew = toEmbed.reduce((n, r) => n + countTokens(r.text), 0)
  const tokAll = paras.reduce((n, p) => n + countTokens(p), 0)

  return (
    <Lab title="Re-indexación incremental con hash de contenido" hint="Aplica un cambio o edita el texto">
      <div className="stack">
        <div className="row" style={{ gap: 6 }}>
          {EDITS.map((e) => {
            const t = e.apply(DOC.paragraphs).join('\n\n')
            return (
              <button key={e.label} className={`btn btn-sm${t === text ? ' btn-primary' : ''}`} onClick={() => setText(t)}>
                {e.label}
              </button>
            )
          })}
        </div>
        <textarea className="textarea mono" style={{ fontSize: 13, minHeight: 150 }} value={text} onChange={(e) => setText(e.target.value)} aria-label={`Contenido de ${DOC.source}`} />
        <div className="table-wrap" style={{ margin: 0 }}>
          <table className="tbl indexacion-tbl">
            <thead>
              <tr>
                <th>chunk</th>
                <th>sha (simplificado)</th>
                <th>texto</th>
                <th>acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.status}-${i}-${r.hash}`} className={r.status === 'nuevo' ? 'is-hl' : ''}>
                  <td className="mono">{r.id}</td>
                  <td className="mono">{r.hash}</td>
                  <td className="txt" style={r.status === 'eliminado' ? { textDecoration: 'line-through' } : undefined}>
                    {r.text.length > 70 ? r.text.slice(0, 68) + '…' : r.text}
                  </td>
                  <td>
                    <span className="indexacion-status" data-tone={STATUS[r.status].tone}>
                      {STATUS[r.status].label}
                    </span>{' '}
                    <span className="small muted">{STATUS[r.status].action}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="indexacion-stats">
          <Stat label="chunks a re-embeber" value={`${toEmbed.length} de ${paras.length}`} tone="data" />
          <Stat label="tokens procesados" value={tokNew} sub={`vs ${tokAll} re-indexando todo`} />
          <Stat label="deletes" value={rows.filter((r) => r.status === 'eliminado').length} tone="error" />
        </div>
        <div className="small muted">
          Usamos un hash FNV de 32 bits para que se lea fácil; en producción se usa SHA-256 del texto normalizado. Ojo: si el ID depende de la posición (envios#3), insertar un
          párrafo al medio corre todos los IDs. Por eso conviene guardar el hash en la metadata y comparar por contenido.
        </div>
      </div>
    </Lab>
  )
}
