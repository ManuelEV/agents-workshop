import { useState } from 'react'
import { CheckCircle2, Lock, XCircle } from 'lucide-react'
import { Code } from '../../components/Code'
import { PlayerBar } from '../../components/Player'
import { BarRow, Lab, Panel, Segmented } from '../../components/ui'
import { usePlayer } from '../../lib/hooks'

/* Decodificación restringida: en cada paso, los tokens que harían imposible
   cumplir el JSON Schema se enmascaran (probabilidad 0) y el resto se
   renormaliza. Probabilidades ilustrativas. */

type FieldId = 'pedido' | 'prioridad'
type Cand = { t: string; p: number }
type Step = { cands: Cand[]; pickFree: string; pickStrict: string }

type Field = {
  label: string
  user: string
  schema: object
  prefix: string
  /** ¿el valor parcial `v` todavía puede completarse válidamente? ('"' = cerrar) */
  canExtend: (v: string, tok: string) => boolean
  rule: (v: string) => string
  free: Step[]
  strict: Step[]
  validate: (v: string) => string | null
}

const ENUM = ['baja', 'media', 'alta']

const FIELDS: Record<FieldId, Field> = {
  pedido: {
    label: 'pedido_id (pattern)',
    user: 'Hola, mi pedido es el #4821 y todavía no llega.',
    schema: { pedido_id: { type: 'string', pattern: '^[0-9]{4}$' } },
    prefix: '{"pedido_id": "',
    canExtend: (v, tok) => (tok === '"' ? /^[0-9]{4}$/.test(v) : /^[0-9]*$/.test(tok) && (v + tok).length <= 4),
    rule: (v) => (v.length < 4 ? `solo dígitos · faltan ${4 - v.length}` : 'ya hay 4 dígitos · solo puede cerrar "'),
    free: [
      { cands: [{ t: '#', p: 0.46 }, { t: '482', p: 0.41 }, { t: '#4', p: 0.06 }, { t: '48', p: 0.04 }, { t: 'N°', p: 0.03 }], pickFree: '#', pickStrict: '' },
      { cands: [{ t: '482', p: 0.9 }, { t: '48', p: 0.07 }, { t: '"', p: 0.03 }], pickFree: '482', pickStrict: '' },
      { cands: [{ t: '1', p: 0.95 }, { t: '"', p: 0.03 }, { t: '0', p: 0.02 }], pickFree: '1', pickStrict: '' },
      { cands: [{ t: '"', p: 0.97 }, { t: '0', p: 0.02 }, { t: '-B', p: 0.01 }], pickFree: '"', pickStrict: '' },
    ],
    strict: [
      { cands: [{ t: '#', p: 0.46 }, { t: '482', p: 0.41 }, { t: '#4', p: 0.06 }, { t: '48', p: 0.04 }, { t: 'N°', p: 0.03 }], pickFree: '', pickStrict: '482' },
      { cands: [{ t: '1', p: 0.95 }, { t: '"', p: 0.03 }, { t: '0', p: 0.02 }], pickFree: '', pickStrict: '1' },
      { cands: [{ t: '"', p: 0.93 }, { t: '0', p: 0.04 }, { t: '-B', p: 0.03 }], pickFree: '', pickStrict: '"' },
    ],
    validate: (v) => (/^[0-9]{4}$/.test(v) ? null : `'${v}' does not match '^[0-9]{4}$'`),
  },
  prioridad: {
    label: 'prioridad (enum)',
    user: '¡Es urgente! Necesito hablar con una persona ya.',
    schema: { prioridad: { type: 'string', enum: ENUM } },
    prefix: '{"resumen": "Cliente pide contacto urgente", "prioridad": "',
    canExtend: (v, tok) => (tok === '"' ? ENUM.includes(v) : ENUM.some((e) => e.startsWith(v + tok))),
    rule: (v) => (ENUM.includes(v) ? 'valor completo · solo puede cerrar "' : `solo prefijos de: ${ENUM.join(' | ')}`),
    free: [
      { cands: [{ t: 'urg', p: 0.48 }, { t: 'alta', p: 0.41 }, { t: 'crít', p: 0.05 }, { t: 'media', p: 0.04 }, { t: 'baja', p: 0.02 }], pickFree: 'urg', pickStrict: '' },
      { cands: [{ t: 'ente', p: 0.97 }, { t: 'encia', p: 0.03 }], pickFree: 'ente', pickStrict: '' },
      { cands: [{ t: '"', p: 0.98 }, { t: '!', p: 0.02 }], pickFree: '"', pickStrict: '' },
    ],
    strict: [
      { cands: [{ t: 'urg', p: 0.48 }, { t: 'alta', p: 0.41 }, { t: 'crít', p: 0.05 }, { t: 'media', p: 0.04 }, { t: 'baja', p: 0.02 }], pickFree: '', pickStrict: 'alta' },
      { cands: [{ t: '"', p: 0.88 }, { t: '-', p: 0.07 }, { t: ' ', p: 0.05 }], pickFree: '', pickStrict: '"' },
    ],
    validate: (v) => (ENUM.includes(v) ? null : `'${v}' is not one of ['baja', 'media', 'alta']`),
  },
}

export function ConstrainLab() {
  const [fid, setFid] = useState<FieldId>('pedido')
  const [mode, setMode] = useState<'free' | 'strict'>('free')
  const f = FIELDS[fid]
  const steps = mode === 'free' ? f.free : f.strict
  const player = usePlayer(steps.length + 1, { interval: 2600 })
  const s = player.step
  const done = s === steps.length
  const picks = steps.slice(0, s).map((x) => (mode === 'free' ? x.pickFree : x.pickStrict))
  const value = picks.filter((p) => p !== '"').join('')
  const cur = done ? null : steps[s]
  const pick = cur ? (mode === 'free' ? cur.pickFree : cur.pickStrict) : ''

  const rows = cur
    ? (() => {
        const valid = cur.cands.map((c) => mode === 'free' || f.canExtend(value, c.t))
        const z = cur.cands.reduce((a, c, i) => a + (valid[i] ? c.p : 0), 0)
        return cur.cands.map((c, i) => ({ ...c, valid: valid[i], q: valid[i] ? c.p / z : 0 }))
      })()
    : []

  const err = done ? f.validate(value) : null
  const reset = () => player.reset()

  return (
    <Lab title="Decodificación restringida por esquema" hint="Compara libre vs. estricto">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Segmented
          options={[
            { value: 'pedido', label: 'pedido_id · pattern' },
            { value: 'prioridad', label: 'prioridad · enum' },
          ]}
          value={fid}
          onChange={(v) => {
            setFid(v)
            reset()
          }}
        />
        <Segmented
          options={[
            { value: 'free', label: 'generación libre' },
            { value: 'strict', label: 'con esquema estricto' },
          ]}
          value={mode}
          onChange={(v) => {
            setMode(v)
            reset()
          }}
        />
      </div>
      <div className="decision-herramienta-q" style={{ marginTop: 12 }}>
        <span className="label">usuario</span> {f.user}
      </div>
      <PlayerBar player={player} labels={[...steps.map((_, i) => `token ${i + 1}`), 'validación']} />
      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="stack" style={{ gap: 10 }}>
          <Panel title="argumentos generados" tone="data">
            <div className="mono decision-herramienta-args">
              <span className="muted">{f.prefix}</span>
              {picks.map((p, i) => (
                <span key={i} className={`decision-herramienta-argtok${i === picks.length - 1 ? ' is-new' : ''}`}>
                  {p}
                </span>
              ))}
              {done ? <span className="muted">{'}'}</span> : <span className="caret" />}
            </div>
          </Panel>
          <Code code={JSON.stringify(f.schema, null, 2)} lang="json" title="input_schema (propiedad)" lineNumbers={false} />
          {mode === 'strict' && !done && (
            <div className="decision-herramienta-rule small">
              <Lock size={14} /> la gramática permite ahora: <strong>{f.rule(value)}</strong>
            </div>
          )}
        </div>
        <div>
          {cur ? (
            <Panel title={`candidatos · token ${s + 1}`} tone="model" right={<span className="mono small">{mode === 'strict' ? 'máscara activa' : 'sin máscara'}</span>}>
              <div className="decision-herramienta-ctab">
                <span className="label">token</span>
                <span className="label">p modelo</span>
                <span className="label">p final</span>
                {rows.map((r) => (
                  <div key={r.t} className={`decision-herramienta-crow${r.valid ? '' : ' is-masked'}`}>
                    <span className="mono">{JSON.stringify(r.t)}</span>
                    <span className="mono small muted">{r.p.toFixed(2)}</span>
                    <BarRow label="" value={r.q} display={r.valid ? r.q.toFixed(2) : '✕ 0'} tone={r.valid ? 'data' : 'error'} off={!r.valid} pick={r.t === pick} />
                  </div>
                ))}
              </div>
              {mode === 'strict' && rows.some((r) => !r.valid) && (
                <p className="small muted" style={{ margin: '8px 0 0' }}>
                  Los tokens tachados no pueden llevar a un valor válido: su logit pasa a −∞ y el resto se renormaliza.
                </p>
              )}
            </Panel>
          ) : (
            <div className="decision-herramienta-verdict anim-in" data-tone={err ? 'error' : 'ok'}>
              {err ? <XCircle size={22} /> : <CheckCircle2 size={22} />}
              <div>
                <div className="decision-herramienta-verdict-title">{err ? 'Falla la validación' : 'Cumple el esquema'}</div>
                <div className="mono small">{err ?? `"${value}" ✓`}</div>
                <p className="small" style={{ margin: '6px 0 0' }}>
                  {err
                    ? 'Tu código tendría que rechazarlo y devolver un error al modelo (otra vuelta del loop), o lo pasaría tal cual a tu sistema.'
                    : 'Por construcción: el modelo no tenía forma de generar otra cosa. Ojo: válido no significa correcto, solo bien formado.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Lab>
  )
}
