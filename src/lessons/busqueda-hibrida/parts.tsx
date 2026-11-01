import { Search } from 'lucide-react'
import { PRESETS, tokenize } from './search'

/** Input de consulta + presets. Se comparte entre los labs de la lección. */
export function QueryBar({ query, onChange }: { query: string; onChange: (q: string) => void }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <label className="busqueda-hibrida-query">
        <Search size={16} aria-hidden />
        <input className="input" value={query} onChange={(e) => onChange(e.target.value)} placeholder="Escribe una consulta…" aria-label="Consulta" />
      </label>
      <div className="row" style={{ gap: 6 }}>
        {PRESETS.map((p) => (
          <button key={p.q} className={`btn btn-sm${p.q === query ? ' btn-primary' : ''}`} onClick={() => onChange(p.q)} title={p.why}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Resalta en `text` las palabras cuyos términos coinciden con `terms` (exacto o por prefijo de 5). */
export function Hl({ text, terms, prefix = false }: { text: string; terms: string[]; prefix?: boolean }) {
  const set = new Set(terms)
  const hit = (w: string) =>
    tokenize(w).some((t) => set.has(t) || (prefix && t.length >= 4 && terms.some((q) => q.length >= 4 && q.slice(0, 5) === t.slice(0, 5))))
  return (
    <>
      {text.split(/(\s+)/).map((w, i) =>
        hit(w) ? (
          <mark key={i} className="busqueda-hibrida-mark">
            {w}
          </mark>
        ) : (
          <span key={i}>{w}</span>
        ),
      )}
    </>
  )
}
