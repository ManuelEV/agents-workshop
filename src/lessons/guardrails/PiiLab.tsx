import { useMemo, useState, type ReactNode } from 'react'
import { Lab, Panel, Pill, Segmented, type Tone } from '../../components/ui'
import { PII_LABEL, detectPii, luhnCalc, maskPii, rutCalc, type MaskMode, type PiiKind, type PiiMatch } from './pii'

const SAMPLE = `Hola, soy Camila Rojas (RUT 12.345.678-5). Pagué con la tarjeta 4111 1111 1111 1111 y me cobraron dos veces. Escríbanme a camila.rojas@correo.cl o al +56 9 8765 4321.
Ojo: el RUT 12.345.678-9 que les di antes estaba mal, y la tarjeta 4111 1111 1111 1112 era un error de tipeo.`

const KIND_TONE: Record<PiiKind, Tone> = { rut: 'user', tarjeta: 'tool', email: 'data', telefono: 'memory' }
const KINDS: PiiKind[] = ['rut', 'tarjeta', 'email', 'telefono']

function Highlighted({ text, matches, sel, onPick }: { text: string; matches: PiiMatch[]; sel: number; onPick: (i: number) => void }) {
  const out: ReactNode[] = []
  let i = 0
  matches.forEach((m, k) => {
    if (m.start > i) out.push(text.slice(i, m.start))
    out.push(
      <button
        key={k}
        className={`guardrails-hit${m.valid ? '' : ' is-invalid'}${sel === k ? ' is-sel' : ''}`}
        data-tone={m.valid ? KIND_TONE[m.kind] : 'system'}
        onClick={() => onPick(k)}
        title={m.why}
      >
        {m.text}
        <span className="tag">{m.valid ? PII_LABEL[m.kind] : 'no válido'}</span>
      </button>,
    )
    i = m.end
  })
  out.push(text.slice(i))
  return <div className="guardrails-hl">{out}</div>
}

function RutDetail({ m }: { m: PiiMatch }) {
  const c = rutCalc(m.text)
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="small" style={{ color: 'var(--text-2)' }}>
        Multiplica cada dígito, de derecha a izquierda, por 2, 3, 4, 5, 6, 7 (y vuelve a 2). Suma, calcula el resto de dividir por 11 y haz 11 − resto
        (11 → 0, 10 → K).
      </div>
      <div className="guardrails-calc">
        {[...c.digits].reverse().map((d, i) => (
          <div key={i} className="cell">
            <span className="d">{d.d}</span>
            <span className="f">×{d.f}</span>
            <span className="p">{d.p}</span>
          </div>
        ))}
      </div>
      <div className="mono small">
        suma = {c.sum} · {c.sum} mod 11 = {c.mod} · 11 − {c.mod} = {11 - c.mod} → DV <strong>{c.dv}</strong> · viene <strong>{c.given}</strong>{' '}
        {c.valid ? <Pill tone="ok">válido</Pill> : <Pill tone="error">inválido</Pill>}
      </div>
    </div>
  )
}

function LuhnDetail({ m }: { m: PiiMatch }) {
  const c = luhnCalc(m.text)
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="small" style={{ color: 'var(--text-2)' }}>
        Desde la derecha, duplica uno sí y uno no (si pasa de 9, resta 9). La suma total debe ser múltiplo de 10.
      </div>
      <div className="guardrails-calc">
        {c.cells.map((x, i) => (
          <div key={i} className={`cell${x.doubled ? ' is-dbl' : ''}`}>
            <span className="d">{x.d}</span>
            <span className="f">{x.doubled ? '×2' : '·'}</span>
            <span className="p">{x.v}</span>
          </div>
        ))}
      </div>
      <div className="mono small">
        suma = {c.sum} → {c.sum % 10 === 0 ? 'múltiplo de 10' : `resto ${c.sum % 10}`} · marca {c.brand}{' '}
        {c.valid ? <Pill tone="ok">válida</Pill> : <Pill tone="error">inválida</Pill>}
      </div>
    </div>
  )
}

export function PiiLab() {
  const [text, setText] = useState(SAMPLE)
  const [mode, setMode] = useState<MaskMode>('etiqueta')
  const [kinds, setKinds] = useState<PiiKind[]>(KINDS)
  const [sel, setSel] = useState(0)
  const matches = useMemo(() => detectPii(text, kinds), [text, kinds])
  const { masked, vault } = useMemo(() => maskPii(text, matches, mode), [text, matches, mode])
  const cur = matches[Math.min(sel, matches.length - 1)]
  const valid = matches.filter((m) => m.valid).length

  return (
    <Lab title="Redacción de PII con validación real" hint="Edita el texto o haz clic en un hallazgo">
      <textarea className="textarea mono" rows={4} value={text} onChange={(e) => setText(e.target.value)} aria-label="Texto a analizar" style={{ fontSize: 13.5 }} />
      <div className="row" style={{ margin: '10px 0', gap: 10 }}>
        <div className="row" style={{ gap: 6 }}>
          {KINDS.map((k) => (
            <button
              key={k}
              className={`guardrails-kind${kinds.includes(k) ? ' is-on' : ''}`}
              data-tone={KIND_TONE[k]}
              aria-pressed={kinds.includes(k)}
              onClick={() => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]))}
            >
              {PII_LABEL[k]}
            </button>
          ))}
        </div>
        <Segmented
          options={[
            { value: 'etiqueta', label: 'etiqueta' },
            { value: 'parcial', label: 'parcial' },
            { value: 'seudonimo', label: 'seudónimo' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <span className="small muted">
          {matches.length} candidatos · {valid} válidos
        </span>
      </div>
      <div className="grid-2">
        <Panel title="detección" tone="guard">
          <Highlighted text={text} matches={matches} sel={sel} onPick={setSel} />
        </Panel>
        <Panel title="lo que recibe el modelo" tone="model">
          <div className="guardrails-masked">{masked}</div>
          {mode === 'seudonimo' && vault.length > 0 && (
            <div className="guardrails-vault">
              <div className="label" style={{ marginBottom: 4 }}>
                bóveda (fuera del modelo)
              </div>
              {vault.map(([tok, orig]) => (
                <div key={tok} className="mono small">
                  {tok} = {orig}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      {cur && (
        <div style={{ marginTop: 12 }} className="anim-fade" key={`${cur.start}-${cur.text}`}>
          <Panel
            title={`${PII_LABEL[cur.kind]} · ${cur.text}`}
            tone={cur.valid ? KIND_TONE[cur.kind] : 'system'}
            right={<span className="mono small">{cur.why}</span>}
          >
            {cur.kind === 'rut' ? (
              <RutDetail m={cur} />
            ) : cur.kind === 'tarjeta' ? (
              <LuhnDetail m={cur} />
            ) : (
              <div className="small" style={{ color: 'var(--text-2)' }}>
                {cur.kind === 'email'
                  ? 'Solo se valida el formato (usuario@dominio.tld). No hay dígito verificador: confirmar que el correo existe requeriría enviarle algo.'
                  : 'Móvil chileno: +56 opcional, un 9 y ocho dígitos. Solo formato; un número con la forma correcta puede no existir.'}
              </div>
            )}
          </Panel>
        </div>
      )}
    </Lab>
  )
}
