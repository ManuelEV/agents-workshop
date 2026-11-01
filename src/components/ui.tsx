import { useState, type CSSProperties, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, FlaskConical, Info, Lightbulb, MousePointerClick, ShieldAlert, Sparkles } from 'lucide-react'
import { cellColor } from '../sim/embed'

export type Tone = 'user' | 'model' | 'tool' | 'data' | 'memory' | 'guard' | 'system' | 'error' | 'ok' | 'accent'

/** Variable CSS del color de un tono, para usar en estilos inline o SVG. */
export const toneVar = (t: Tone) => (t === 'accent' ? 'var(--accent)' : `var(--c-${t})`)

/* -------------------------------------------------------------------------- */
/* Estructura de la lección                                                    */
/* -------------------------------------------------------------------------- */

/** Bloque temático numerado de una lección. `id` permite enlazar con #ancla. */
export function Section({ n, title, id, children }: { n?: number | string; title: string; id?: string; children: ReactNode }) {
  return (
    <section className="section" id={id}>
      <div className="section-head">
        {n !== undefined && <span className="section-num">{String(n).padStart(2, '0')}</span>}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

/** Panel interactivo enmarcado ("laboratorio"). */
export function Lab({
  title,
  hint,
  badge = 'Lab',
  children,
  footer,
  bodyStyle,
}: {
  title: string
  hint?: ReactNode
  badge?: string
  children: ReactNode
  footer?: ReactNode
  bodyStyle?: CSSProperties
}) {
  return (
    <div className="lab">
      <div className="lab-head">
        <span className="lab-badge">
          <FlaskConical size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
          {badge}
        </span>
        <span className="lab-title">{title}</span>
        {hint && (
          <span className="lab-hint">
            <MousePointerClick size={14} /> {hint}
          </span>
        )}
      </div>
      <div className="lab-body" style={bodyStyle}>
        {children}
      </div>
      {footer && <div className="lab-foot">{footer}</div>}
    </div>
  )
}

const CALLOUT_ICON = { info: Info, tip: Lightbulb, warn: AlertTriangle, danger: ShieldAlert, ok: CheckCircle2 }
const CALLOUT_TONE: Record<keyof typeof CALLOUT_ICON, Tone> = { info: 'user', tip: 'data', warn: 'guard', danger: 'error', ok: 'ok' }

export function Callout({ tone = 'info', title, children }: { tone?: keyof typeof CALLOUT_ICON; title?: string; children: ReactNode }) {
  const Icon = CALLOUT_ICON[tone]
  return (
    <div className="callout" data-tone={CALLOUT_TONE[tone]}>
      <Icon size={20} className="callout-icon" />
      <div>
        {title && <div className="callout-title">{title}</div>}
        <div className="callout-body">{children}</div>
      </div>
    </div>
  )
}

export function KeyIdeas({ title = 'Ideas clave', items }: { title?: string; items: ReactNode[] }) {
  return (
    <div className="keyideas">
      <h3>
        <Sparkles size={18} color="var(--accent)" /> {title}
      </h3>
      <ul>
        {items.map((it, i) => (
          <li key={i}>
            <CheckCircle2 size={16} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Término con definición al pasar el mouse. */
export function Term({ tip, children }: { tip: ReactNode; children: ReactNode }) {
  return (
    <span className="term" tabIndex={0}>
      {children}
      <span className="term-tip" role="tooltip">
        {tip}
      </span>
    </span>
  )
}

export function Pill({ tone, mono, children, title }: { tone?: Tone; mono?: boolean; children: ReactNode; title?: string }) {
  return (
    <span className={`pill${mono ? ' mono' : ''}`} data-tone={tone} title={title}>
      {children}
    </span>
  )
}

export function Panel({ title, tone, children, right, bodyStyle }: { title: ReactNode; tone?: Tone; children: ReactNode; right?: ReactNode; bodyStyle?: CSSProperties }) {
  return (
    <div className="panel" data-tone={tone}>
      <div className="panel-head">
        <span className="tone-dot" />
        <span>{title}</span>
        {right && <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{right}</span>}
      </div>
      <div className="panel-body" style={bodyStyle}>
        {children}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Controles                                                                   */
/* -------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  style,
}: {
  label: ReactNode
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  style?: CSSProperties
}) {
  return (
    <label className="slider" style={style}>
      <span className="slider-top">
        <span>{label}</span>
        <span className="v">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

/** Pestañas con contenido. Si `numbered`, muestra 1, 2, 3… (útil para "etapas"). */
export function Tabs({ tabs, numbered, initial }: { tabs: { id: string; label: ReactNode; content: ReactNode }[]; numbered?: boolean; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id)
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  return (
    <div>
      <div className="tabs-list" role="tablist">
        {tabs.map((t, i) => (
          <button key={t.id} role="tab" aria-selected={t.id === active} className={t.id === active ? 'is-active' : ''} onClick={() => setActive(t.id)}>
            {numbered && <span className="tab-num">{i + 1}</span>}
            {t.label}
          </button>
        ))}
      </div>
      <div key={current.id} className="anim-fade">
        {current.content}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Visualización de datos                                                      */
/* -------------------------------------------------------------------------- */

/** Fila de barra horizontal (probabilidades, scores). */
export function BarRow({
  label,
  value,
  max = 1,
  display,
  tone,
  off,
  pick,
  title,
}: {
  label: ReactNode
  value: number
  max?: number
  display?: string
  tone?: Tone
  off?: boolean
  pick?: boolean
  title?: string
}) {
  const w = Math.max(0, Math.min(100, (value / (max || 1)) * 100))
  return (
    <div className={`bar-row${off ? ' is-off' : ''}${pick ? ' is-pick' : ''}`} data-tone={tone} title={title}>
      <span className="bl">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${w}%`, display: 'block' }} />
      </span>
      <span className="bv">{display ?? value.toFixed(3)}</span>
    </div>
  )
}

/** Vector como tira de celdas de color (azul negativo, naranja positivo). */
export function VectorStrip({ values, size = 'md', max = 0.6, labels, highlight }: { values: number[]; size?: 'sm' | 'md'; max?: number; labels?: string[]; highlight?: number[] }) {
  return (
    <span className={`vstrip${size === 'sm' ? ' sm' : ''}`}>
      {values.map((v, i) => (
        <span
          key={i}
          className="vc"
          title={`${labels?.[i] ?? `dim ${i}`}: ${v.toFixed(3)}`}
          style={{
            background: cellColor(v, max),
            outline: highlight?.includes(i) ? '2px solid var(--text)' : undefined,
            outlineOffset: highlight?.includes(i) ? 1 : undefined,
          }}
        />
      ))}
    </span>
  )
}

export type TokenView = { text: string; id?: number; tone?: Tone }

const TOKEN_TONES: Tone[] = ['user', 'tool', 'data', 'memory', 'model', 'guard']
/** Fichas de tokens; si no se indica tono, alterna colores para ver los cortes. */
export function TokenChips({ tokens, showIds = true }: { tokens: TokenView[]; showIds?: boolean }) {
  return (
    <div className="tokens">
      {tokens.map((t, i) => (
        <span key={i} className="token" data-tone={t.tone ?? TOKEN_TONES[i % TOKEN_TONES.length]}>
          <span>{t.text.replace(/ /g, '·').replace(/\n/g, '↵')}</span>
          {showIds && t.id !== undefined && <span className="tid">{t.id}</span>}
        </span>
      ))}
    </div>
  )
}

/** Métrica compacta (número grande + etiqueta). */
export function Stat({ label, value, tone, sub }: { label: ReactNode; value: ReactNode; tone?: Tone; sub?: ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', background: 'var(--bg-elev)', minWidth: 120 }} data-tone={tone}>
      <div className="label">{label}</div>
      <div className="mono tabular" style={{ fontSize: 22, fontWeight: 600, color: tone ? 'var(--tone)' : 'var(--text)', lineHeight: 1.3 }}>
        {value}
      </div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  )
}
